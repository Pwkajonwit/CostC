import type { SheetRow } from "@/lib/types";
import { toNumber } from "@/lib/utils/numbers";
import { isCommittedBill, normalizeBillStatus } from "@/lib/bills/bill-status";

export type ContractorType = "บุคคลธรรมดา" | "นิติบุคคล";

export const DEFAULT_LIMIT_INDIVIDUAL = 1_200_000; // 1.2 ล้าน สำหรับบุคคลธรรมดา
export const DEFAULT_LIMIT_CORPORATE = 2_000_000;  // 2 ล้าน สำหรับนิติบุคคล (ค่าเริ่มต้น)

const CORPORATE_REGEX = /บริษัท|หจก|บจก|จำกัด|corporation|company/i;

/**
 * Auto-detect contractor type based on full name and nickname.
 * If contains บริษัท, หจก, บจก, จำกัด -> นิติบุคคล
 * Otherwise -> บุคคลธรรมดา
 */
export function detectContractorType(fullName?: string, nickname?: string): ContractorType {
  const combined = `${fullName || ""} ${nickname || ""}`.trim();
  if (CORPORATE_REGEX.test(combined)) {
    return "นิติบุคคล";
  }
  return "บุคคลธรรมดา";
}

/**
 * Get default annual limit based on contractor type
 */
export function getDefaultAnnualLimit(type: ContractorType): number {
  return type === "นิติบุคคล" ? DEFAULT_LIMIT_CORPORATE : DEFAULT_LIMIT_INDIVIDUAL;
}

/**
 * Extract 4-digit Christian calendar year from bill date string or timestamp.
 * Handles Thai Buddhist era (e.g. 2569 -> 2026).
 */
export function extractBillYear(bill: SheetRow): number {
  const rawDate = String(
    bill["วันจ่าย"] ||
    bill.paid_date ||
    bill.paid_at ||
    bill["ว/ด/ป"] ||
    bill.bill_date ||
    bill.date ||
    bill.created_at ||
    ""
  ).trim();

  if (!rawDate) return new Date().getFullYear();

  // Match 4 digits
  const match = rawDate.match(/(\d{4})/);
  if (match) {
    let yr = parseInt(match[1], 10);
    if (yr > 2400) {
      yr -= 543; // Buddhist to Christian era
    }
    return yr;
  }

  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    let yr = parsed.getFullYear();
    if (yr > 2400) yr -= 543;
    return yr;
  }

  return new Date().getFullYear();
}

/**
 * Check if a bill is considered paid / withdrawn
 */
export function isPaidBillStrict(bill: SheetRow): boolean {
  if (!bill) return false;
  const status = normalizeBillStatus(bill["สถานะ"] ?? bill.status);
  if (status === "เบิกแล้ว") return true;
  const statusLower = String(bill["สถานะ"] ?? bill.status ?? "").toLowerCase();
  if (statusLower.includes("เบิกแล้ว") || statusLower === "paid" || statusLower === "withdrawn") return true;
  if (Boolean(bill.paid_date) || Boolean(bill.paid_at)) return true;
  return false;
}

/**
 * Hydrate contractor rows with actual bill payments for the target year.
 */
export function hydrateContractorsWithYearlySpend(
  contractorRows: SheetRow[],
  billRows: SheetRow[],
  targetYear?: number
): SheetRow[] {
  const currentYear = targetYear || new Date().getFullYear();

  // Pre-filter bills for the target year that are committed and paid
  const paidBillsThisYear = billRows.filter(b => {
    if (!isCommittedBill(b)) return false;
    if (!isPaidBillStrict(b)) return false;
    const yr = extractBillYear(b);
    return yr === currentYear;
  });

  return contractorRows.map(contractor => {
    const cId = String(contractor["id_Contractor"] || contractor.id || "").trim();
    const cNick = String(contractor["ชื่อเล่น"] || contractor.nickname || "").trim();
    const cFull = String(contractor["ชื่อ-นามสกุล"] || contractor.full_name || "").trim();

    // 1. Resolve contractor type
    const explicitType = String(
      contractor["ประเภท"] ||
      contractor.contractor_type ||
      contractor.data?.["ประเภท"] ||
      contractor.data?.contractor_type ||
      ""
    ).trim() as ContractorType;

    const type: ContractorType = (explicitType === "บุคคลธรรมดา" || explicitType === "นิติบุคคล")
      ? explicitType
      : detectContractorType(cFull, cNick);

    // 2. Resolve annual limit
    let limit = toNumber(contractor["จำกัดยอด/ปี"] ?? contractor.annual_limit ?? contractor.data?.["จำกัดยอด/ปี"]);
    if (limit <= 0) {
      limit = getDefaultAnnualLimit(type);
    }

    // 3. Compute actual payments made this year for this contractor
    let yearlySpent = 0;
    for (const b of paidBillsThisYear) {
      const bVendor = String(b["ร้าน/บุคคล"] || b.vendor_or_person || "").trim();
      const bContractor = String(b["ผู้รับเหมา"] || b.contractor_id || "").trim();
      const bConwork = String(b.conwork_id || "").trim();

      const isMatch =
        (cId && (bVendor === cId || bContractor === cId || bConwork.startsWith(cId))) ||
        (cNick && (bVendor === cNick || bContractor === cNick)) ||
        (cFull && (bVendor === cFull || bContractor === cFull));

      if (isMatch) {
        // Use transfer amount or amount or labor cost
        const amt = toNumber(b["ยอดโอน"] || b.transfer_amount || b["ยอดเงิน"] || b.amount || b["ค่าแรง"] || b.labor_cost);
        yearlySpent += amt;
      }
    }

    const remaining = limit - yearlySpent;
    const spentPercent = limit > 0 ? (yearlySpent / limit) * 100 : 0;

    let limitStatus: "ปกติ" | "ใกล้เต็ม" | "เกินโควตา" = "ปกติ";
    if (spentPercent >= 100) {
      limitStatus = "เกินโควตา";
    } else if (spentPercent >= 70) {
      limitStatus = "ใกล้เต็ม";
    }

    return {
      ...contractor,
      "ประเภท": type,
      "จำกัดยอด/ปี": limit,
      "ยอดเบิกจ่ายปีนี้": yearlySpent,
      "คงเหลือ": remaining,
      "สถานะ": limitStatus,
      _spentPercent: Math.round(spentPercent * 10) / 10,
      _limitStatus: limitStatus,
      _targetYear: currentYear,
      contractor_type: type,
      annual_limit: limit
    };
  });
}
