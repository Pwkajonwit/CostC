import type { SheetRow } from "@/lib/types";
import { toNumber } from "@/lib/utils/numbers";
import { computeBillTransferAmount } from "@/lib/project-summary";
import {
  isMaterialCost,
  isLaborCost,
  isStaffCost,
  isFuelCost,
  isRepairCost,
  isMachineCost,
  isToolCost,
  isOtherExpense,
} from "@/lib/cost-codes";

export function hasValue(val: unknown): boolean {
  return val !== null && val !== undefined && String(val).trim() !== "";
}

export function getRowAmount(row: SheetRow): number {
  if (!row) return 0;
  return toNumber(row["ยอดเงิน"]);
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

  const categoryType = getRowCategory(row);
  const kw = categoryKeyword.trim();

  if (kw === "ค่าของ" && isMaterialCost(categoryType)) return getRowAmount(row);
  if (kw === "ค่าแรง" && isLaborCost(categoryType)) return getRowAmount(row);
  if (kw === "พนักงาน" && isStaffCost(categoryType)) return getRowAmount(row);
  if (kw === "น้ำมัน" && isFuelCost(categoryType)) return getRowAmount(row);
  if (kw === "ซ่อมรถ" && isRepairCost(categoryType)) return getRowAmount(row);
  if (kw === "เครื่องจักร" && isMachineCost(categoryType)) return getRowAmount(row);
  if (kw === "เครื่องมือ" && isToolCost(categoryType)) return getRowAmount(row);
  if (kw === "อื่นๆ" && isOtherExpense(categoryType)) return getRowAmount(row);

  if (categoryType.toLowerCase().includes(kw.toLowerCase())) {
    return getRowAmount(row);
  }

  return 0;
}

export function isLaborRow(row: SheetRow): boolean {
  const cat = getRowCategory(row);
  if (isLaborCost(cat)) return true;
  if (cat.toLowerCase().includes("ค่าแรง")) return true;
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
