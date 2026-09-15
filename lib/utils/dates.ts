export function parseDateStrict(value: unknown): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === "-") return null;

  // 1. Check YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  // 2. Check DD-MM-YYYY or DD/MM/YYYY (Thai locale: Day first, Month second!)
  const dmYMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmYMatch) {
    const day = Number(dmYMatch[1]);
    const month = Number(dmYMatch[2]);
    const rawY = Number(dmYMatch[3]);
    const year = rawY > 2400 ? rawY - 543 : rawY;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  return null;
}

export const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

export function formatDateThai(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = parseDateStrict(value);
  if (!parsed) return String(value || "-");
  const monthIdx = parsed.month - 1;
  const thMonth = monthIdx >= 0 && monthIdx < 12 ? THAI_MONTHS_SHORT[monthIdx] : String(parsed.month);
  return `${parsed.day} ${thMonth} ${parsed.year}`;
}

export function formatDateDisplay(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const parsed = parseDateStrict(value);
  if (!parsed) return String(value || "-");
  const d = String(parsed.day).padStart(2, "0");
  const m = String(parsed.month).padStart(2, "0");
  return `${d}/${m}/${parsed.year}`;
}

export function toInputDateValue(value: unknown): string {
  if (!value) return "";
  const parsed = parseDateStrict(value);
  if (!parsed) return String(value);
  const d = String(parsed.day).padStart(2, "0");
  const m = String(parsed.month).padStart(2, "0");
  return `${parsed.year}-${m}-${d}`;
}

export function normalizeDateToIso(value: unknown): string {
  if (!value) return "";
  const parsed = parseDateStrict(value);
  if (!parsed) return String(value);
  const d = String(parsed.day).padStart(2, "0");
  const m = String(parsed.month).padStart(2, "0");
  return `${parsed.year}-${m}-${d}`;
}

/**
 * Returns today's date in YYYY-MM-DD string format in Thai timezone (Asia/Bangkok, UTC+7).
 * This prevents timezone discrepancies where UTC time lags behind local Thai time
 * (e.g. between 00:00 - 06:59 AM, UTC is still yesterday).
 */
export function getTodayDateIso(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  } catch {
    const tzOffset = 7 * 60; // Bangkok is UTC+7
    const localMs = date.getTime() + (date.getTimezoneOffset() + tzOffset) * 60000;
    const localDate = new Date(localMs);
    const y = localDate.getFullYear();
    const m = String(localDate.getMonth() + 1).padStart(2, "0");
    const d = String(localDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Returns today's date in D/M/YYYY or DD/MM/YYYY format in Thai timezone (Asia/Bangkok, UTC+7).
 */
export function getTodaySheetDate(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(date);
    const d = parts.find(p => p.type === "day")?.value || String(date.getDate());
    const m = parts.find(p => p.type === "month")?.value || String(date.getMonth() + 1);
    const y = parts.find(p => p.type === "year")?.value || String(date.getFullYear());
    return `${d}/${m}/${y}`;
  } catch {
    const tzOffset = 7 * 60;
    const localMs = date.getTime() + (date.getTimezoneOffset() + tzOffset) * 60000;
    const localDate = new Date(localMs);
    return `${localDate.getDate()}/${localDate.getMonth() + 1}/${localDate.getFullYear()}`;
  }
}

/**
 * Extract 4-digit Christian calendar year (e.g. 2026) from any date string, object, or number.
 * Automatically converts Thai Buddhist Era (2569 -> 2026).
 */
export function extractYearFromDate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (value > 2400) return value - 543;
    if (value >= 1900 && value <= 2100) return value;
  }
  
  const parsed = parseDateStrict(value);
  if (parsed && parsed.year) {
    return parsed.year;
  }

  const str = String(value).trim();
  const match = str.match(/(\d{4})/);
  if (match) {
    let yr = parseInt(match[1], 10);
    if (yr > 2400) yr -= 543;
    if (yr >= 1900 && yr <= 2100) return yr;
  }

  return null;
}

/**
 * Extract year from a data row by checking common date fields (ว/ด/ป, bill_date, paid_date, etc.).
 */
export function getRowYear(row: Record<string, any> | null | undefined): number | null {
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
    row["วันเริ่มโครงการ"],
    row.work_date,
    row.date,
    row["วันได้บิล"],
    row.bill_received_date,
    row.created_at,
  ];

  for (const c of candidates) {
    if (c !== null && c !== undefined && c !== "") {
      const yr = extractYearFromDate(c);
      if (yr) return yr;
    }
  }

  return null;
}

/**
 * Checks if a project belongs to a given year.
 * A project belongs to a year if:
 * 1. It has active bills in that year, OR
 * 2. Its own start_date/วันที่ matches that year.
 */
export function isProjectInYear(
  project: Record<string, any> | null | undefined,
  targetYear?: string,
  billsInYear?: Record<string, any>[]
): boolean {
  if (!project) return false;
  if (!targetYear || targetYear === "all") return true;

  // 1. If project has bills in the selected year, it's active in that year
  if (billsInYear && billsInYear.length > 0) {
    const pId = String(project["ID Project"] || project.id || "").trim();
    const pName = String(project["ชื่อ Project"] || project.name || "").trim().toLowerCase();
    const hasBillInYear = billsInYear.some((b) => {
      const bId = String(b["ID Project"] || b.project_id || "").trim();
      if (bId && pId && bId === pId) return true;
      const bName = String(b["ชื่อ Project"] || b.project_name || "").trim().toLowerCase();
      if (bName && pName && bName === pName) return true;
      return false;
    });
    if (hasBillInYear) return true;
  }

  // 2. Check project's own date
  const projYr = getRowYear(project);
  if (projYr) {
    return String(projYr) === String(targetYear);
  }

  return false;
}


