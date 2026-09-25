import type { SheetRow } from "@/lib/types";
import { toNumber } from "@/lib/utils/numbers";

export function validateBillStatusTransition(currentStatus: unknown, nextStatus: unknown) {
  const current = normalizeBillStatus(currentStatus);
  const next = normalizeBillStatus(nextStatus);
  if (current === next) return;

  const validTransitions: Record<string, string[]> = {
    "": ["รอตั้งเบิก", "ตั้งเบิก", "อนุมัติ", "เบิกแล้ว", "ไม่อนุมัติ"],
    "รอตั้งเบิก": ["ตั้งเบิก", "อนุมัติ", "เบิกแล้ว", "ไม่อนุมัติ"],
    "รออนุมัติ": ["รอตั้งเบิก", "ตั้งเบิก", "อนุมัติ", "เบิกแล้ว", "ไม่อนุมัติ"],
    "ตั้งเบิก": ["รอตั้งเบิก", "อนุมัติ", "เบิกแล้ว", "ไม่อนุมัติ"],
    "อนุมัติ": ["ตั้งเบิก", "เบิกแล้ว", "ไม่อนุมัติ"],
    "เบิกแล้ว": ["อนุมัติ", "ตั้งเบิก"],
    "ไม่อนุมัติ": ["รอตั้งเบิก", "ตั้งเบิก", "อนุมัติ", "เบิกแล้ว"],
    "ยกเลิก": ["รอตั้งเบิก", "ตั้งเบิก"]
  };

  const allowed = validTransitions[current] || ["รอตั้งเบิก", "ตั้งเบิก", "อนุมัติ", "เบิกแล้ว", "ไม่อนุมัติ"];
  if (!allowed.includes(next)) {
    throw new Error(`เปลี่ยนสถานะจาก ${current || "ว่าง"} เป็น ${next || "ว่าง"} ไม่ได้`);
  }
}

export function canEditOrDeleteBill(_status: unknown) {
  return true;
}

export function isValidBill(row: SheetRow) {
  if (!row) return false;
  const hasSeq = Boolean(row["ลำดับ"] || row._sheetRow || row.id);
  const hasVendor = Boolean(row["ร้าน/บุคคล"] && String(row["ร้าน/บุคคล"]).trim() !== "");
  const hasProject = Boolean(row["ชื่อ Project"] || row["ID Project"]);
  const hasMoney = toNumber(row["ยอดเงิน"]) > 0;
  return hasSeq || hasVendor || hasProject || hasMoney;
}

export function isCommittedBill(row: SheetRow) {
  return isValidBill(row);
}

export function isUnpaidBill(row: SheetRow) {
  return normalizeBillStatus(row["สถานะ"] ?? row.status) !== "เบิกแล้ว";
}

export function isPaidBill(row: SheetRow) {
  if (!row) return false;
  return normalizeBillStatus(row["สถานะ"] ?? row.status) === "เบิกแล้ว";
}

export function normalizeBillStatus(value: unknown): string {
  const str = String(value || "").trim();
  if (!str) return "";
  if (str.includes("ไม่อนุมัติ") || str.includes("ปฏิเสธ") || str.toLowerCase() === "rejected") {
    return "ไม่อนุมัติ";
  }
  if (str.includes("ยกเลิก") || str.toLowerCase() === "cancelled" || str.toLowerCase() === "canceled") {
    return "ยกเลิก";
  }
  if (str.includes("รอตั้งเบิก")) {
    return "รอตั้งเบิก";
  }
  if (
    str.includes("เบิกแล้ว") ||
    str.includes("ปิดงาน") ||
    str.includes("จ่ายแล้ว") ||
    str.includes("โอนแล้ว") ||
    str.toLowerCase() === "paid" ||
    str.toLowerCase() === "withdrawn"
  ) {
    return "เบิกแล้ว";
  }
  if (str.includes("รออนุมัติ") || str.includes("รอตรวจสอบ")) {
    return "รออนุมัติ";
  }
  if (str.includes("อนุมัติ")) {
    return "อนุมัติ";
  }
  if (str.includes("ตั้งเบิก")) {
    return "ตั้งเบิก";
  }
  return str;
}

export type BillStatusConfig = {
  label: string;
  badge: string;
  dot: string;
};

export function getBillStatusConfig(statusValue: unknown): BillStatusConfig {
  const norm = normalizeBillStatus(statusValue);
  switch (norm) {
    case "เบิกแล้ว":
      return {
        label: "เบิกแล้ว",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100/70",
        dot: "bg-emerald-500",
      };
    case "อนุมัติ":
      return {
        label: "อนุมัติ",
        badge: "bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100/70",
        dot: "bg-sky-500",
      };
    case "ตั้งเบิก":
      return {
        label: "ตั้งเบิก",
        badge: "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/70",
        dot: "bg-amber-500",
      };
    case "รออนุมัติ":
      return {
        label: "รออนุมัติ",
        badge: "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/70",
        dot: "bg-amber-500",
      };
    case "รอตั้งเบิก":
      return {
        label: "รอตั้งเบิก",
        badge: "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100/70",
        dot: "bg-purple-500",
      };
    case "ไม่อนุมัติ":
      return {
        label: "ไม่อนุมัติ",
        badge: "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100/70",
        dot: "bg-rose-500",
      };
    case "ยกเลิก":
      return {
        label: "ยกเลิก",
        badge: "bg-slate-100 text-slate-500 border-slate-300 line-through hover:bg-slate-200/70",
        dot: "bg-slate-400",
      };
    default:
      return {
        label: String(statusValue || "-"),
        badge: "bg-slate-100 text-slate-700 border-slate-300",
        dot: "bg-slate-400",
      };
  }
}

export function formatVatDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (!str || str === "-" || str === "0" || str === "0%") return "";
  if (str.toUpperCase().startsWith("VAT")) return str;
  return str.includes("%") ? `VAT ${str}` : `VAT ${str}%`;
}

export function formatDeductDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (!str || str === "-" || str === "0" || str === "0%") return "";
  if (str.startsWith("หัก")) return str;
  return str.includes("%") ? `หัก ${str}` : `หัก ${str}%`;
}

export function formatCreditDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (!str || str === "-" || str === "0") return "";
  if (str.startsWith("เครดิต")) return str;
  return str.includes("วัน") ? `เครดิต ${str}` : `เครดิต ${str} วัน`;
}

export function formatBillConditions(row: SheetRow): string {
  if (!row) return "";
  const vat = formatVatDisplay(row.vat ?? row["vat"]);
  const deduct = formatDeductDisplay(row["หัก"] ?? row.deduct);
  const credit = formatCreditDisplay(row["เครดิต"] ?? row.credit);
  return [vat, deduct, credit].filter(Boolean).join(" · ");
}

