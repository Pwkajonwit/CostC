import { toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";

export interface BillFinancialDetails {
  grossAmount: number;         // ยอดเงินรวมทั้งสิ้น (ก่อนหัก ณ ที่จ่าย)
  laborAndStaff: number;       // ค่าแรง + พนักงาน + อื่นๆ
  isCorporate: boolean;        // นิติบุคคล/บริษัท หรือไม่
  hasVat: boolean;             // มีภาษีมูลค่าเพิ่ม 7% รวมอยู่ในยอดหรือไม่
  taxBase: number;             // ฐานภาษีที่นำไปคำนวณหัก ณ ที่จ่าย (สำหรับ 50 ทวิ ยอดก่อน VAT)
  taxRate: number;             // % หัก ณ ที่จ่าย (เช่น 3, 5, 1)
  hasDeduct: boolean;          // มีการหัก ณ ที่จ่ายหรือไม่
  withholdingTax: number;      // จำนวนเงินภาษีที่หัก ณ ที่จ่าย
  netTransfer: number;         // ยอดโอนจ่ายสุทธิ (Gross - WithholdingTax)
}

export function isVatActive(vatValue: unknown): boolean {
  if (vatValue === null || vatValue === undefined) return false;
  const str = String(vatValue).trim().toLowerCase();
  return str !== "" && str !== "0" && str !== "0.00" && str !== "0%" && str !== "ไม่มี" && str !== "ไม่มี vat" && str !== "false" && str !== "no";
}

export function parseDeductPercent(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim().toLowerCase();
  if (!str || str === "-" || str === "0" || str === "0%" || str === "false" || str.includes("ไม่มี")) return 0;
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

export function isDeductActive(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toLowerCase();
  if (!str || str === "-" || str === "0" || str === "0%" || str === "false" || str.includes("ไม่มี")) return false;
  return parseDeductPercent(value) > 0 || str.includes("หัก");
}

/**
 * ดึงยอดภาษีหัก ณ ที่จ่ายที่บันทึกไว้ในบิล (แก้บั๊กสตริง "0" ทับค่าจริง)
 */
export function resolveCustomWithholdingTax(row: SheetRow, laborAmount = 0): number {
  if (!row) return 0;

  const rawCustom = [
    row["จำนวนหัก"],
    row["3เปอร์"],
    row.deduct_amount,
    row["3เปอร์เซ็น"]
  ]
    .map(v => toNumber(v))
    .find(v => v > 0) || 0;

  if (rawCustom > 0) return rawCustom;

  // ในไฟล์บัญชีเดิม คอลัมน์ "หัก 3%" อาจเก็บยอดโอนสุทธิ (เช่น 5,820 จากยอด 6,000)
  const rawWhtCol = toNumber(row["หัก 3%"]);
  if (rawWhtCol > 0) {
    if (laborAmount > 0 && rawWhtCol > laborAmount * 0.5) {
      return Math.max(0, Math.round((laborAmount - rawWhtCol) * 100) / 100);
    }
    return rawWhtCol;
  }

  return 0;
}

/**
 * ตรวจสอบว่าผู้รับเหมา/บิลนี้เป็นนิติบุคคล (บริษัท) หรือไม่
 */
export function isBillCorporate(row: SheetRow, contractorRow?: SheetRow): boolean {
  if (!row) return false;
  const statusLabor = String(row["Statusค่าแรง"] || row["statusค่าแรง"] || row.labor_status || "").trim();
  if (statusLabor.includes("บริษัท")) return true;
  if (String(row["ร้านค้า/ผู้รับเหมา"] || row.vendor_type || "").trim() === "ร้านค้า") return true;
  if (contractorRow && Boolean(contractorRow["เลขประจำตัวผู้เสียภาษี"])) return true;
  return false;
}

/**
 * ตรวจสอบว่าบิลนี้มี VAT 7% หรือไม่
 */
export function isBillHavingVat(
  row: SheetRow,
  isCorporate: boolean,
  customWht: number,
  baseAmount: number
): boolean {
  if (!row) return false;

  // 1. มีการระบุ vat ในคอลัมน์โดยตรง
  if (isVatActive(row.vat ?? row["vat"] ?? row.VAT)) return true;
  if (row.vat_amount !== undefined && row.vat_amount !== null && Number(row.vat_amount) > 0) return true;

  // 2. กรณีผู้รับเหมาบริษัทที่ยอดรวมมี VAT 7% แฝงอยู่ และยอดหัก 3% คำนวณมาจากฐานก่อน VAT (base / 1.07 * 0.03)
  if (isCorporate && customWht > 0 && baseAmount > 0) {
    const preVatWht3 = (baseAmount / 1.07) * 0.03;
    if (Math.abs(Math.round(preVatWht3 * 10) / 10 - customWht) < 2) {
      return true;
    }
    const preVatWht5 = (baseAmount / 1.07) * 0.05;
    if (Math.abs(Math.round(preVatWht5 * 10) / 10 - customWht) < 2) {
      return true;
    }
  }

  return false;
}

/**
 * ฟังก์ชันหลัก: คำนวณตัวเลขทางการเงินและภาษีของบิลแบบ Single Source of Truth
 */
export function calculateBillFinancials(row: SheetRow, contractorRow?: SheetRow): BillFinancialDetails {
  if (!row) {
    return {
      grossAmount: 0,
      laborAndStaff: 0,
      isCorporate: false,
      hasVat: false,
      taxBase: 0,
      taxRate: 0,
      hasDeduct: false,
      withholdingTax: 0,
      netTransfer: 0
    };
  }

  // 1. คำนวณยอดเงินค่าจ้าง/ค่าแรง
  let laborAndStaff = toNumber(row["ค่าแรง+พนักงาน+อื่นๆ"] || row["ค่าแรง+พนักงาน+อื่น"]);
  if (!laborAndStaff) {
    laborAndStaff = toNumber(row["ค่าแรง"]) + toNumber(row["พนักงาน"]) + toNumber(row["อื่นๆ"]);
  }
  if (!laborAndStaff) {
    laborAndStaff = toNumber(row["ค่าจ้าง"]) || toNumber(row["ยอดเงิน"]);
  }

  const grossAmount = toNumber(row["ยอดเงิน"]) || laborAndStaff || 0;
  const isCorporate = isBillCorporate(row, contractorRow);
  const customWht = resolveCustomWithholdingTax(row, laborAndStaff);
  const hasVat = isBillHavingVat(row, isCorporate, customWht, grossAmount || laborAndStaff);

  // 2. คำนวณอัตราภาษีและสถานะการหัก ณ ที่จ่าย
  const rawDeduct = row["หัก"] ?? row["หัก ณ ที่จ่าย"] ?? row["หักณที่จ่าย"] ?? row.deduct ?? row.withholding_tax;
  const hasExplicitZeroWht =
    (row.withholding_tax !== null && row.withholding_tax !== undefined && Number(row.withholding_tax) === 0) ||
    String(rawDeduct ?? "").includes("ไม่มี");

  const hasDeduct = !hasExplicitZeroWht && (customWht > 0 || isDeductActive(rawDeduct));
  let taxRate = hasDeduct ? parseDeductPercent(rawDeduct) : 0;

  // 3. กำหนดฐานภาษี (Tax Base) สำหรับ 50 ทวิ
  const taxBase = hasVat
    ? Math.round(((laborAndStaff || grossAmount) / 1.07) * 100) / 100
    : (laborAndStaff || grossAmount);

  if (hasDeduct && !taxRate && customWht > 0) {
    taxRate = taxBase > 0 ? Math.round((customWht / taxBase) * 100) : 3;
  }

  // 4. คำนวณยอดเงินภาษีหัก ณ ที่จ่าย
  let withholdingTax = 0;
  if (hasDeduct) {
    if (customWht > 0) {
      withholdingTax = customWht;
    } else if (taxRate > 0) {
      withholdingTax = Math.round((taxBase * (taxRate / 100)) * 100) / 100;
    }
  }

  // 5. คำนวณยอดโอนจ่ายสุทธิ
  const rawNetFromCol = toNumber(row["จ่าย"] || row["ยอดโอน"] || row["คงเหลือ"] || row.transfer_amount);
  const rawNetFromCsvWht = toNumber(row["หัก 3%"]) > laborAndStaff * 0.5 ? toNumber(row["หัก 3%"]) : 0;
  
  let netTransfer = rawNetFromCol || rawNetFromCsvWht;
  if (!netTransfer && grossAmount > 0) {
    netTransfer = Math.round((grossAmount - withholdingTax) * 100) / 100;
  } else if (!netTransfer && laborAndStaff > 0) {
    netTransfer = Math.round((laborAndStaff - withholdingTax) * 100) / 100;
  }

  return {
    grossAmount,
    laborAndStaff,
    isCorporate,
    hasVat,
    taxBase,
    taxRate,
    hasDeduct,
    withholdingTax,
    netTransfer
  };
}
