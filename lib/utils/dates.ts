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

