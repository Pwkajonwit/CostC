export interface FiscalPeriodConfig {
  id: string;              // e.g. "year_2026", "q1_2026", "year_2027"
  type: "year" | "quarter"; // "year" or "quarter"
  year: number;            // e.g. 2026
  quarter?: number;        // 1, 2, 3, 4 (if type === "quarter")
  label: string;           // e.g. "ปี 2026", "ไตรมาส 1/2026"
  customName?: string;     // custom label entered by user, e.g. "ไตรมาส 1", "งบพิเศษ"
  startSeq: number;        // e.g. 1, 500
  endSeq?: number | null;  // e.g. 499 (optional, auto-calculated if null)
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResolvedFiscalPeriod extends FiscalPeriodConfig {
  effectiveEndSeq: number | null; // null means unbounded (to infinity / latest)
  rangeLabel: string;             // e.g. "บิล #1 - #499" or "บิล #500 ขึ้นไป"
  billCount?: number;
}

/**
 * Calculates effective ranges for a list of periods.
 * Example:
 * - Period A: startSeq = 1 (no endSeq)
 * - Period B: startSeq = 500 (no endSeq)
 * -> Period A effectiveEndSeq = 499 (500 - 1)
 * -> Period B effectiveEndSeq = null (unbounded)
 */
export function resolveEffectivePeriodRanges(periods: FiscalPeriodConfig[]): ResolvedFiscalPeriod[] {
  if (!Array.isArray(periods) || periods.length === 0) return [];

  // Separate into years and quarters or sort all by startSeq
  // We sort by startSeq ascending
  const sorted = [...periods].sort((a, b) => a.startSeq - b.startSeq);

  return sorted.map((item, idx) => {
    let effectiveEnd = item.endSeq !== undefined && item.endSeq !== null && item.endSeq > 0
      ? item.endSeq
      : null;

    if (!effectiveEnd) {
      // Find the next period with startSeq > this startSeq
      const nextItem = sorted.slice(idx + 1).find(p => p.startSeq > item.startSeq);
      if (nextItem && nextItem.startSeq > item.startSeq) {
        effectiveEnd = nextItem.startSeq - 1;
      }
    }

    const rangeLabel = effectiveEnd !== null
      ? (effectiveEnd >= item.startSeq ? `บิล #${item.startSeq.toLocaleString()} - #${effectiveEnd.toLocaleString()}` : `บิล #${item.startSeq.toLocaleString()}`)
      : `บิล #${item.startSeq.toLocaleString()} ขึ้นไป`;

    return {
      ...item,
      effectiveEndSeq: effectiveEnd,
      rangeLabel
    };
  });
}

/**
 * Extract sequence number from a bill row.
 */
export function extractBillSeq(row: Record<string, any> | null | undefined): number {
  if (!row) return 0;
  const rawSeq = row["ลำดับ"] ?? row.seq ?? row.bill_no ?? row.id ?? row._sheetRow;
  if (typeof rawSeq === "number" && Number.isFinite(rawSeq)) return rawSeq;
  const num = parseInt(String(rawSeq || "").replace(/\D/g, ""), 10);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Extract 4-digit calendar year from a date value or row.
 */
export function extractRowYear(row: Record<string, any> | null | undefined): number | null {
  if (!row) return null;
  const candidates = [
    row["ว/ด/ป"],
    row.bill_date,
    row["วันจ่าย"],
    row.paid_date,
    row.paid_at,
    row["วันที่"],
    row.start_date,
    row.startDate,
    row["วันเริ่ม"],
    row.date,
    row.created_at,
  ];

  for (const c of candidates) {
    if (c !== null && c !== undefined && c !== "") {
      const str = String(c).trim();
      const match = str.match(/(\d{4})/);
      if (match) {
        let yr = parseInt(match[1], 10);
        if (yr > 2400) yr -= 543;
        if (yr >= 1900 && yr <= 2100) return yr;
      }
    }
  }

  return null;
}

/**
 * Extract target 4-digit calendar year from a year string or period ID.
 * Examples:
 * - "2026" -> "2026"
 * - "period-2026-1" -> "2026"
 * - "quarter-2026-1" -> "2026"
 * - "all" -> "all"
 */
export function extractTargetYear(yearParam?: string | null): string {
  if (!yearParam || yearParam === "all") return "all";
  const str = String(yearParam).trim();
  const match = str.match(/(?:period|quarter|year)-(\d{4})/i);
  if (match) return match[1];
  const yrMatch = str.match(/^(\d{4})$/);
  if (yrMatch) return yrMatch[1];
  const generalDigitMatch = str.match(/\b(20\d\d)\b/);
  if (generalDigitMatch) return generalDigitMatch[1];
  return str;
}

/**
 * Check if a row's bill sequence falls into a given resolved period.
 */
export function isBillInFiscalPeriod(row: Record<string, any> | null | undefined, period: ResolvedFiscalPeriod): boolean {
  if (!row || !period) return false;

  // Extract sequence number from bill
  const seq = extractBillSeq(row);
  if (seq > 0) {
    if (seq < period.startSeq) return false;
    if (period.effectiveEndSeq !== null && seq > period.effectiveEndSeq) return false;
    return true;
  }

  // Fallback to row date if sequence is not present
  const rowYr = extractRowYear(row);
  if (rowYr) {
    return rowYr === period.year;
  }

  return true;
}

/**
 * Universal matcher for filtering bills / rows by year or fiscal period.
 * Works uniformly on Server Components, API routes, and Client Components.
 */
export function isRowMatchingYearOrPeriod(
  row: Record<string, any> | null | undefined,
  selectedYear?: string | null,
  periods?: ResolvedFiscalPeriod[]
): boolean {
  if (!selectedYear || selectedYear === "all") return true;
  if (!row) return false;

  const target = String(selectedYear).trim();

  // 1. If explicit periods are passed, check if target matches period ID
  if (periods && periods.length > 0) {
    const exactPeriod = periods.find(p => p.id === target);
    if (exactPeriod) {
      return isBillInFiscalPeriod(row, exactPeriod);
    }

    // If target is just a year (e.g. "2026"), match any bill from that year or within its periods
    const yrMatch = target.match(/^(\d{4})$/);
    if (yrMatch) {
      const yrNum = parseInt(yrMatch[1], 10);
      const rowYr = extractRowYear(row);
      if (rowYr && rowYr === yrNum) return true;
      const periodsInYear = periods.filter(p => p.year === yrNum);
      if (periodsInYear.length > 0) {
        return periodsInYear.some(p => isBillInFiscalPeriod(row, p));
      }
      return !rowYr || rowYr === yrNum;
    }
  }

  // 2. Pattern: "period-{year}-{startSeq}"
  const periodMatch = target.match(/^period-(\d{4})-(\d+)$/i);
  if (periodMatch) {
    const pYear = parseInt(periodMatch[1], 10);
    const startSeq = parseInt(periodMatch[2], 10);
    const seq = extractBillSeq(row);
    if (seq > 0 && seq < startSeq) return false;
    const rowYr = extractRowYear(row);
    if (rowYr && rowYr !== pYear) return false;
    return true;
  }

  // 3. Fallback: extract calendar year
  const targetYear = extractTargetYear(target);
  if (!targetYear || targetYear === "all") return true;

  const rowYr = extractRowYear(row);
  return !rowYr || String(rowYr) === String(targetYear);
}

