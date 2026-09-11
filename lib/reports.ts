import type { SheetRow } from "@/lib/types";
import { toNumber } from "@/lib/utils/numbers";
import { computeBillTransferAmount } from "@/lib/project-summary";

export function hasValue(val: unknown): boolean {
  return val !== null && val !== undefined && String(val).trim() !== "";
}

export function getRowAmount(row: SheetRow): number {
  if (!row) return 0;
  const direct = toNumber(row["ยอดเงิน"]);
  if (direct > 0) return direct;

  const costCols = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];
  return costCols.reduce((sum, col) => sum + toNumber(row[col]), 0);
}

export function getRowTransferAmount(row: SheetRow): number {
  if (!row) return 0;
  const direct = toNumber(row["ยอดโอน"] || row["โอนเงิน"]);
  if (direct > 0) return direct;
  return computeBillTransferAmount(row);
}

export function getRowCategory(row: SheetRow): string {
  return String(row["ประเภท"] || "").trim();
}

export function getRowCategoryAmount(row: SheetRow, categoryKeyword: string): number {
  if (!row) return 0;
  const legacyVal = toNumber(row[categoryKeyword]);
  if (legacyVal > 0) return legacyVal;

  const categoryType = getRowCategory(row).toLowerCase();
  if (categoryType.includes(categoryKeyword.toLowerCase())) {
    return getRowAmount(row);
  }

  return 0;
}

export function isLaborRow(row: SheetRow): boolean {
  const cat = getRowCategory(row).toLowerCase();
  if (cat.includes("ค่าแรง")) return true;
  if (hasValue(row["statusค่าแรง"])) return true;
  if (hasValue(row["ผู้รับเหมา"])) return true;
  return toNumber(row["ค่าแรง"]) > 0;
}

export function isMaterialOrExpenseRow(row: SheetRow): boolean {
  return !isLaborRow(row);
}

export function filterBillsByProject(bills: SheetRow[], projectId: string): SheetRow[] {
  if (!projectId || projectId === "all") return bills;
  const cleanId = String(projectId).trim();
  return bills.filter(row => {
    const rowProjId = String(row["ID Project"] || "").trim();
    const rowProjName = String(row["ชื่อ Project"] || "").trim();
    return rowProjId === cleanId || rowProjName === cleanId || cleanId.includes(rowProjId);
  });
}
