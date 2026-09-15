"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileCheck,
  FileText,
  Layers,
  Receipt,
  ShieldCheck,
  Tag,
  User,
  Wrench,
  Store
} from "lucide-react";
import { BillImageThumbnail } from "@/components/bills/BillImageThumbnail";
import { BillWorkflowActions } from "@/components/bills/BillWorkflowActions";
import { getCostCodeBadgeStyle } from "@/lib/cost-codes";
import { DataTable } from "@/components/tables/DataTable";
import dynamic from "next/dynamic";

const FormModal = dynamic(
  () => import("@/components/forms/FormModal").then((mod) => mod.FormModal),
  { ssr: false }
);

const BillDocumentModal = dynamic(
  () => import("@/components/documents/BillDocumentModal").then((mod) => mod.BillDocumentModal),
  { ssr: false }
);
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateThai } from "@/lib/utils/dates";
import { isVatActive, isDeductActive, parseDeductPercent, parseCreditDays } from "@/lib/project-summary";
import type { SheetRow } from "@/lib/types";
import type { BillDocumentModel } from "@/lib/bills/bill-document";
import type { UserPermissions } from "@/lib/user-permissions";

type BillDetailClientProps = {
  bill: SheetRow;
  decodedBillId: string;
  project: SheetRow[];
  contract: SheetRow[];
  matchedContract?: SheetRow | null;
  contractDisplay?: string;
  contractLink?: string;
  requesterDisplay?: string;
  requesterLink?: string;
  createdByDisplay?: string;
  vendorDisplay?: string;
  vendorSubText?: string;
  vendorLink?: string;
  form?: any;
  documentData?: BillDocumentModel | null;
  userPermissions?: UserPermissions | null;
  stores?: SheetRow[];
};

export function BillDetailClient({
  bill,
  decodedBillId,
  project,
  contract,
  matchedContract: propsMatchedContract,
  contractDisplay: propsContractDisplay,
  contractLink: propsContractLink,
  requesterDisplay,
  requesterLink,
  createdByDisplay,
  vendorDisplay,
  vendorSubText,
  vendorLink,
  form,
  documentData,
  userPermissions,
  stores = [],
}: BillDetailClientProps) {
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [currentBill, setCurrentBill] = useState(bill);

  useEffect(() => {
    setCurrentBill(bill);
  }, [bill]);

  const billId = billKey(currentBill) || decodedBillId;

  const resolveStoreName = useCallback((token: string): string => {
    const trimmed = (token || "").trim();
    if (!trimmed) return "";
    if (!stores || stores.length === 0) return trimmed;
    const found = stores.find((s) => {
      const code = text(s["id_store"] || s.id).toLowerCase();
      const shortName = text(s["ชื่อร้านค้า"]).toLowerCase();
      const fullName = text(s["ชื่อเต็ม"]).toLowerCase();
      const target = trimmed.toLowerCase();
      return code === target || shortName === target || fullName === target;
    });
    if (found) {
      return text(found["ชื่อร้านค้า"] || found["ชื่อเต็ม"] || found.name) || trimmed;
    }
    return trimmed;
  }, [stores]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail?.row;
      if (updated) {
        const uId = String(updated.id ?? updated["ลำดับ"] ?? updated._sheetRow ?? "");
        const myId = String(billId);
        if (uId === myId || uId === decodedBillId) {
          setCurrentBill(prev => ({ ...prev, ...updated }));
        }
      }
    };
    window.addEventListener("bills-data-updated", handleUpdate as EventListener);
    window.addEventListener("data-updated", handleUpdate as EventListener);
    return () => {
      window.removeEventListener("bills-data-updated", handleUpdate as EventListener);
      window.removeEventListener("data-updated", handleUpdate as EventListener);
    };
  }, [billId, decodedBillId]);

  const staffName = text(currentBill["ชื่อพนักงาน"] || currentBill.staff_name || (currentBill.data as any)?.["ชื่อพนักงาน"] || (currentBill.data as any)?.staff_name);
  const rawCat = text(currentBill["ประเภท"] || currentBill.category);
  const isStaffBill = rawCat.startsWith("3.") || rawCat.includes("พนักงาน") || Boolean(staffName && !text(currentBill["ผู้รับเหมา"]));

  const matchedContract = propsMatchedContract || contract[0] || null;
  const contractDisplay = propsContractDisplay || (matchedContract ? text(matchedContract.id_Conwork || matchedContract.id) : "");
  const contractLink = !isStaffBill && (propsContractLink || (contractDisplay ? `/contract-open/${encodeURIComponent(contractDisplay)}` : ""));

  const projectId = text(currentBill["ID Project"]);
  const projectName = text(currentBill["ชื่อ Project"]) || "ไม่ระบุโครงการ";
  const imageValue = currentBill["รูปถ่ายบิล"];
  const total = toNumber(currentBill["ยอดเงิน"]);
  const status = text(currentBill["สถานะ"]) || "รอตั้งเบิก";
  const isApproved = status === "อนุมัติ";
  const isPaid = status === "เบิกแล้ว";

  const hasVat = isVatActive(currentBill.vat);
  const vatDisplay = text(currentBill.vat) || (hasVat ? "รวม VAT" : "ไม่มี VAT");

  const hasExplicitZeroWht = (currentBill.withholding_tax !== null && currentBill.withholding_tax !== undefined && Number(currentBill.withholding_tax) === 0) ||
    String(currentBill["หัก"] ?? "").trim() === "" || String(currentBill["หัก"] ?? "").includes("ไม่มี");
  const hasDeduct = !hasExplicitZeroWht && isDeductActive(currentBill["หัก"] || currentBill.withholding_tax);
  const deductRate = hasDeduct ? parseDeductPercent(currentBill["หัก"] || currentBill.withholding_tax) : 0;
  const rawDeductAmt = hasDeduct ? toNumber(currentBill["จำนวนหัก"] ?? currentBill["3เปอร์"] ?? currentBill["3เปอร์เซ็น"] ?? currentBill.deduct_amount) : 0;
  const deductAmount = hasDeduct
    ? (rawDeductAmt > 0 ? rawDeductAmt : (hasVat ? (total / 1.07) * (deductRate / 100) : (total * deductRate) / 100))
    : 0;

  const rawTransfer = toNumber(currentBill["ยอดโอน"] || currentBill.transfer_amount);
  const transferAmount = hasDeduct
    ? (rawTransfer > 0 ? rawTransfer : (total - deductAmount))
    : (rawTransfer > 0 ? rawTransfer : total);

  const creditDays = parseCreditDays(currentBill["เครดิต"]);
  const creditDisplay = text(currentBill["เครดิต"]) || (creditDays > 0 ? `${creditDays} วัน` : "เงินสด");

  const isContractorBill = !isStaffBill && (
    text(currentBill["ร้านค้า/ผู้รับเหมา"]) === "ผู้รับเหมา" ||
    Boolean(text(currentBill["ผู้รับเหมา"])) ||
    rawCat.startsWith("2.") ||
    rawCat.includes("ค่าแรง") ||
    toNumber(currentBill["ค่าแรง"]) > 0 ||
    Boolean(text(currentBill["statusค่าแรง"]))
  );
  const vendorType = isStaffBill ? "พนักงาน" : (text(currentBill["ร้านค้า/ผู้รับเหมา"]) || (isContractorBill ? "ผู้รับเหมา" : "ร้านค้า"));
  const rawVendorValue = firstText(currentBill, ["ชื่อร้านค้า", "ชื่อผู้รับเหมา", "ร้านค้า", "ผู้รับเหมา", "ร้าน/บุคคล"]);
  const resolvedVendorFallback = !isContractorBill && rawVendorValue
    ? (rawVendorValue.includes(",")
        ? rawVendorValue.split(",").map(t => resolveStoreName(t)).filter(Boolean).join(", ")
        : resolveStoreName(rawVendorValue))
    : rawVendorValue;
  const vendor = isStaffBill
    ? (staffName || "พนักงาน")
    : (vendorDisplay || resolvedVendorFallback || "-");
  const requester = requesterDisplay || text(currentBill["ผู้เบิก"]) || "-";
  const createdBy = text(currentBill["ผู้สร้างบิล"] || currentBill["created_by"] || currentBill["ผู้บันทึก"]) || "-";
  const billNo = text(currentBill["บิล"] || currentBill.bill_no) || "-";
  const category = text(currentBill["ประเภท"] || currentBill.category) || "-";
  const productOrWork = text(currentBill["สินค้า/ทำงาน"] || currentBill["สินค้า"] || currentBill["รายละเอียดงาน"] || currentBill.description) || "-";
  const laborStatus = text(currentBill["statusค่าแรง"]);
  const itemName = text(currentBill["รายการ"] || currentBill.sub_category);
  const toolName = text(currentBill["ชื่อเครื่องมือ"] || currentBill.tool_name);
  const carPlate = text(currentBill["ทะเบียน"] || currentBill.plate_no);

  const billDate = formatDateThai(currentBill["ว/ด/ป"] || currentBill.bill_date);
  const billReceivedDate = formatDateThai(currentBill["วันได้บิล"] || currentBill.bill_received_date);
  const whtIssuedDate = formatDateThai(currentBill["วันออก 3%"] || currentBill.wht_issued_date);
  const paidDueDate = formatDateThai(currentBill["วันจ่าย"] || currentBill.paid_date);
  const createdAtFormatted = formatDateThai(currentBill.created_at);

  // Expense Breakdown List
  const expenseBreakdown = useMemo(() => {
    const items: Array<{ label: string; value: unknown; extra?: string; isAmount?: boolean }> = [];

    if (hasValue(currentBill["ค่าของ"])) items.push({ label: "ค่าของ (วัสดุก่อสร้าง)", value: currentBill["ค่าของ"], isAmount: true });
    if (hasValue(currentBill["ค่าแรง"])) items.push({ label: "ค่าแรง", value: currentBill["ค่าแรง"], isAmount: true, extra: laborStatus ? `สถานะ: ${laborStatus}` : undefined });
    if (hasValue(currentBill["พนักงาน"])) items.push({ label: "ค่าแรงพนักงาน", value: currentBill["พนักงาน"], isAmount: true, extra: staffName ? `ชื่อ: ${staffName}` : undefined });
    if (hasValue(currentBill["น้ำมัน"])) items.push({ label: "ค่าน้ำมัน", value: currentBill["น้ำมัน"], isAmount: true });
    if (hasValue(currentBill["ซ่อมรถ"])) items.push({ label: "ค่าซ่อมรถ", value: currentBill["ซ่อมรถ"], isAmount: true, extra: carPlate ? `ทะเบียน: ${carPlate}` : undefined });
    if (hasValue(currentBill["เครื่องจักร"])) items.push({ label: "ค่าเครื่องจักร", value: currentBill["เครื่องจักร"], isAmount: true });
    if (hasValue(currentBill["เครื่องมือ"])) items.push({ label: "ค่าเครื่องมือ", value: currentBill["เครื่องมือ"], isAmount: true, extra: toolName ? `ชื่อ: ${toolName}` : undefined });
    if (hasValue(currentBill["อื่นๆ"])) items.push({ label: "ค่าใช้จ่ายอื่นๆ", value: currentBill["อื่นๆ"], isAmount: true, extra: itemName ? `รายการ: ${itemName}` : undefined });
    if (hasValue(currentBill["ค่าแรงคงเหลือ"])) items.push({ label: "ค่าแรงคงเหลือของสัญญา", value: currentBill["ค่าแรงคงเหลือ"], isAmount: true });

    return items;
  }, [currentBill, laborStatus, itemName, toolName, carPlate, staffName]);

  const lineItems = useMemo<Array<{ category?: string; categoryType?: string; amount?: string | number; name?: string; type?: string; price?: string | number; total?: string | number; storeGroup?: string }>>(() => {
    const raw = currentBill.items || (currentBill.data as any)?.items;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    if (typeof raw === "string" && raw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  }, [currentBill]);

  return (
    <div className="w-full flex flex-col gap-3 p-3 sm:p-4 max-w-[1400px] mx-auto font-sans text-sm text-slate-900">
      {/* 1. HEADER BREADCRUMB & WORKFLOW ACTIONS */}
      <div className="flex items-center justify-between gap-2.5 border-b border-slate-300 pb-2.5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Link
            href="/bills"
            className="flex items-center gap-1.5 text-xs text-slate-800 hover:text-slate-950 transition shrink-0 font-semibold px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100"
          >
            <ArrowLeft size={13} className="text-slate-700" />
            <span>รายการบิลทั้งหมด</span>
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-xs font-bold text-white shrink-0 bg-slate-900 px-2 py-0.5 rounded border border-slate-900">
            บิล #{billId}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded text-xs font-bold shrink-0 border ${
              isPaid
                ? "bg-slate-200 text-slate-900 border-slate-400"
                : isApproved
                ? "bg-emerald-100 text-emerald-950 border-emerald-400"
                : "bg-amber-100 text-amber-950 border-amber-400"
            }`}
          >
            {status}
          </span>
          {contractLink && (
            <Link
              href={contractLink}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-400 px-2.5 py-0.5 rounded transition shrink-0 shadow-2xs"
              title={`ดูรายละเอียดสัญญาเปิดจ้าง ${contractDisplay}`}
            >
              <Wrench size={13} className="text-amber-700 shrink-0" />
              <span>สัญญา {contractDisplay}</span>
              <ArrowUpRight size={12} className="text-amber-700 shrink-0" />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {contractLink && (
            <Link
              href={contractLink}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition cursor-pointer"
              title={`เปิดดูสัญญา ${contractDisplay}`}
            >
              <Wrench size={13} className="text-amber-700 shrink-0" />
              <span>เปิดดูสัญญา {contractDisplay}</span>
              <ArrowUpRight size={12} className="text-amber-700 shrink-0" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsDocModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition cursor-pointer"
            title="พิมพ์เอกสารสัญญาจ้าง / ใบสำคัญจ่าย / 50 ทวิ"
          >
            <FileText size={13} className="text-emerald-700 shrink-0" />
            <span>พิมพ์เอกสาร / 50 ทวิ</span>
          </button>
          <BillWorkflowActions row={currentBill} allowEdit userPermissions={userPermissions} redirectAfterDelete="/bills" />
        </div>
      </div>

      {/* 2. UNIFIED COMPACT HEADER & 4 FINANCIAL KPI STATS */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden">
        {/* Top bar: Project Name & Metadata */}
        <div className="p-3 sm:px-4 sm:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50/70 border-b border-slate-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-950 m-0 truncate">{projectName}</h1>
              {projectId && (
                <span className="text-[11px] bg-indigo-100 text-indigo-950 border border-indigo-300 px-2 py-0.2 rounded font-mono font-bold shrink-0">
                  PJ-{projectId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 mt-1 flex-wrap font-medium">
              <span>{isStaffBill ? "พนักงาน: " : "คู่ค้า: "}<strong className="text-slate-950 font-bold">{vendor}</strong></span>
              <span className="text-slate-300">•</span>
              <span>ผู้เบิก: <strong className="text-slate-950 font-bold">{requester}</strong></span>
              <span className="text-slate-300">•</span>
              <span>วันที่บิล: <strong className="text-slate-950 font-bold">{billDate}</strong></span>
              {contractLink && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>
                    สัญญาเปิดจ้าง:{" "}
                    <Link href={contractLink} className="text-amber-800 hover:text-amber-950 font-bold hover:underline inline-flex items-center gap-0.5">
                      <span>[{contractDisplay}]</span>
                      <ArrowUpRight size={11} />
                    </Link>
                  </span>
                </>
              )}
              {billNo !== "-" && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>เลขที่บิล: <strong className="text-slate-950 font-bold">{billNo}</strong></span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 md:self-center">
            <span className="text-xs text-slate-600 font-bold">หมวดหมู่:</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${getCostCodeBadgeStyle(category)}`}>
              {category}
            </span>
          </div>
        </div>

        {/* Bottom bar: 4 KPI Metrics in a Clean Compact Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-white">
          {/* 1: ยอดเงินรวม */}
          <div className="p-2.5 sm:px-4 sm:py-2.5 flex flex-col justify-center">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold mb-0.5">
              <span>ยอดเงินรวม</span>
              <Receipt size={14} className="text-slate-500" />
            </div>
            <div className="text-base sm:text-lg font-black text-slate-950 leading-tight">{money(total)} ฿</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{category}</div>
          </div>

          {/* 2: หัก ณ ที่จ่าย */}
          <div className="p-2.5 sm:px-4 sm:py-2.5 flex flex-col justify-center bg-amber-50/40">
            <div className="flex items-center justify-between text-xs text-amber-950 font-bold mb-0.5">
              <span>หัก ณ ที่จ่าย</span>
              <ShieldCheck size={14} className="text-amber-700" />
            </div>
            <div className={`text-base sm:text-lg font-black leading-tight ${deductAmount > 0 ? "text-amber-900" : "text-slate-700"}`}>
              {deductAmount > 0 ? `-${money(deductAmount)} ฿` : "0.00 ฿"}
            </div>
            <div className="text-[11px] text-amber-800 font-medium mt-0.5 truncate">
              {hasDeduct ? `อัตรา ${currentBill["หัก"]}` : "ไม่มีการหักภาษี"}
            </div>
          </div>

          {/* 3: ยอดโอนสุทธิ */}
          <div className="p-2.5 sm:px-4 sm:py-2.5 flex flex-col justify-center bg-emerald-50/40">
            <div className="flex items-center justify-between text-xs text-emerald-950 font-bold mb-0.5">
              <span>ยอดโอนสุทธิ</span>
              <Banknote size={14} className="text-emerald-700" />
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-900 leading-tight">{money(transferAmount)} ฿</div>
            <div className="text-[11px] text-emerald-800 font-medium mt-0.5 truncate">
              {isPaid ? "สถานะ: โอนชำระแล้ว" : "ยอดที่ต้องโอนจริง"}
            </div>
          </div>

          {/* 4: เงื่อนไขชำระ */}
          <div className="p-2.5 sm:px-4 sm:py-2.5 flex flex-col justify-center bg-indigo-50/40">
            <div className="flex items-center justify-between text-xs text-indigo-950 font-bold mb-0.5">
              <span>เงื่อนไขชำระเงิน</span>
              <CreditCard size={14} className="text-indigo-700" />
            </div>
            <div className="text-base sm:text-lg font-black text-indigo-950 leading-tight truncate">{creditDisplay}</div>
            <div className="text-[11px] text-indigo-800 font-medium mt-0.5 truncate">
              {paidDueDate !== "-" ? `ครบกำหนด: ${paidDueDate}` : "ชำระทันที"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT: Left Details & Right Attachments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

        {/* LEFT COLUMN: General Info + Expenses + Taxes (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">

          {/* Section 1: ข้อมูลทั่วไปของบิล */}
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <FileText size={14} className="text-slate-700" />
                <span>ข้อมูลทั่วไปของบิล</span>
              </div>
              <span className="text-xs text-slate-700 font-bold font-mono">#{billId}</span>
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">เลขที่เอกสาร / บิล:</span>
                <span className="sm:col-span-2 text-slate-950 font-bold">{billNo}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">วันที่ของบิล (ว/ด/ป):</span>
                <span className="sm:col-span-2 text-slate-950 font-medium">{billDate}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">โครงการ:</span>
                <span className="sm:col-span-2 text-slate-950 font-medium">
                  {projectId ? (
                    <Link href={`/views/project-all?search=${encodeURIComponent(projectId)}`} className="text-indigo-700 hover:text-indigo-950 hover:underline inline-flex items-center gap-1 font-bold">
                      <span>[{projectId}] {projectName}</span>
                      <ArrowUpRight size={12} />
                    </Link>
                  ) : (
                    projectName
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">{isStaffBill ? "พนักงาน:" : "ร้านค้า / ผู้รับเหมา:"}</span>
                <div className="sm:col-span-2 flex flex-col gap-0.5">
                  <div className="text-slate-950 font-medium flex items-center gap-1.5 flex-wrap">
                    {isStaffBill ? (
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-950 font-bold">{staffName || vendor || "-"}</span>
                        <span className="text-[11px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-semibold">พนักงานบริษัท</span>
                      </span>
                    ) : vendorLink ? (
                      <Link href={vendorLink} className="text-indigo-700 hover:text-indigo-950 hover:underline inline-flex items-center gap-1 font-bold">
                        <span>{vendor}</span>
                        <span className="text-slate-600 font-normal">({vendorType})</span>
                        <ArrowUpRight size={12} />
                      </Link>
                    ) : (
                      <span>{vendor} <span className="text-slate-600 font-normal">({vendorType})</span></span>
                    )}
                  </div>
                  {vendorSubText && !isStaffBill && (
                    <span className="text-[11px] text-slate-500 font-normal">
                      {vendorSubText}
                    </span>
                  )}
                </div>
              </div>

              {contractLink && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2.5 gap-1 bg-amber-50/70 border-y border-amber-200">
                  <span className="text-amber-950 font-bold flex items-center gap-1.5">
                    <Wrench size={14} className="text-amber-700 shrink-0" />
                    <span>สัญญาเปิดจ้าง (เปิดจ้าง):</span>
                  </span>
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={contractLink}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-200 text-amber-950 hover:bg-amber-300 border border-amber-400 transition"
                        title={`เปิดดูสัญญา ${contractDisplay}`}
                      >
                        <span>เปิดดูสัญญา {contractDisplay}</span>
                        <ArrowUpRight size={12} />
                      </Link>
                      {matchedContract && (
                        <span className="text-xs text-slate-800 font-semibold truncate max-w-[320px]">
                          {matchedContract["รายละเอียดงาน"] || matchedContract["ชื่อ Project"] || ""}
                        </span>
                      )}
                    </div>
                    {matchedContract && (
                      <div className="text-[11px] text-slate-700 flex items-center gap-2 flex-wrap mt-0.5 font-medium">
                        <span>ยอดจ้าง: <strong className="text-slate-950 font-bold">{money(matchedContract["ยอดเงินจ้าง"])} ฿</strong></span>
                        <span>•</span>
                        <span>จ่ายแล้ว: <strong className="text-emerald-700 font-bold">{money(matchedContract["ยอดเงินจ่าย"])} ฿</strong></span>
                        <span>•</span>
                        <span>คงเหลือ: <strong className="text-amber-900 font-bold">{money(matchedContract["ค่าแรงคงเหลือ"])} ฿</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">หมวดหมู่ค่าใช้จ่าย:</span>
                <span className="sm:col-span-2 text-slate-950 font-bold">{category}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">สินค้า / ทำงาน:</span>
                <span className="sm:col-span-2 text-slate-950 font-medium">{productOrWork}</span>
              </div>

              {itemName && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">รายการย่อย (อื่นๆ):</span>
                  <span className="sm:col-span-2 text-slate-950 font-medium">{itemName}</span>
                </div>
              )}

              {toolName && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">ชื่อเครื่องมือ:</span>
                  <span className="sm:col-span-2 text-slate-950 font-medium">{toolName}</span>
                </div>
              )}

              {carPlate && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">หมายเลขทะเบียนรถ:</span>
                  <span className="sm:col-span-2 text-slate-950 font-medium">{carPlate}</span>
                </div>
              )}

              {staffName && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">ชื่อพนักงาน:</span>
                  <span className="sm:col-span-2 text-slate-950 font-medium">{staffName}</span>
                </div>
              )}
              {laborStatus && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">รูปแบบการจ้างค่าแรง:</span>
                  <span className="sm:col-span-2 text-slate-950">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${laborStatus === "บริษัท" ? "bg-purple-100 text-purple-950 border-purple-300" : "bg-blue-100 text-blue-950 border-blue-300"}`}>
                      {laborStatus === "บริษัท" ? "บริษัท (มี VAT)" : "บุคคลธรรมดา (หัก ณ ที่จ่าย)"}
                    </span>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">ผู้เบิกเงิน:</span>
                <span className="sm:col-span-2 text-slate-950 font-medium">
                  {requesterLink ? (
                    <Link href={requesterLink} className="text-indigo-700 hover:text-indigo-950 hover:underline inline-flex items-center gap-1 font-bold">
                      <span>{requester}</span>
                      <ArrowUpRight size={12} />
                    </Link>
                  ) : (
                    requester
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">ผู้สร้าง/บันทึกบิล:</span>
                <div className="sm:col-span-2 flex items-center gap-2 flex-wrap">
                  <span className="text-slate-950 font-bold">{createdByDisplay || createdBy}</span>
                  {(() => {
                    const c = (createdByDisplay || createdBy).toLowerCase().trim();
                    const r = (requesterDisplay || requester).toLowerCase().trim();
                    if (c && r && c !== "-" && r !== "-" && !c.includes(r) && !r.includes(c)) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-sky-100 text-sky-950 px-2 py-0.2 rounded border border-sky-300 font-bold">
                          สร้างแทนผู้เบิก
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {createdAtFormatted !== "-" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">บันทึกเข้าระบบเมื่อ:</span>
                  <span className="sm:col-span-2 text-slate-800 font-medium">{createdAtFormatted}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2.1: รายการสินค้าในบิล (Multi-Line Items Breakdown if present) */}
          {lineItems.length > 0 && (() => {
            const hasStoreGroups = lineItems.some(i => i.storeGroup && !i.storeGroup.startsWith("ร้านที่ "));
            if (hasStoreGroups) {
              const groups: { storeName: string; items: typeof lineItems; total: number }[] = [];
              const groupMap = new Map<string, { storeName: string; items: typeof lineItems; total: number }>();
              lineItems.forEach(item => {
                const rawStore = (item.storeGroup || "").trim();
                const sName = resolveStoreName(rawStore) || "ร้านค้าทั่วไป";
                if (!groupMap.has(sName)) {
                  const g = { storeName: sName, items: [], total: 0 };
                  groupMap.set(sName, g);
                  groups.push(g);
                }
                const g = groupMap.get(sName)!;
                g.items.push(item);
                g.total += toNumber(item.amount ?? item.price ?? item.total);
              });

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Store size={15} className="text-emerald-700" />
                      <span>รายการสินค้าแยกตามร้านค้า ({groups.length} ร้าน, {lineItems.length} รายการ)</span>
                    </div>
                    <span className="text-xs font-black text-slate-950">{money(total)} ฿</span>
                  </div>
                  {groups.map((group, gIdx) => (
                    <div key={gIdx} className="border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
                      <div className="px-3.5 py-2 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                          <Store size={14} className="text-slate-600" />
                          <span>{group.storeName}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                            {group.items.length} รายการ
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-800">{money(group.total)} ฿</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr>
                              <th className="px-3.5 py-2 text-left w-10">#</th>
                              <th className="px-3.5 py-2 text-left">สินค้า / หมวดงาน</th>
                              <th className="px-3.5 py-2 text-left w-28">ประเภท</th>
                              <th className="px-3.5 py-2 text-right w-32">จำนวนเงิน</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {group.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition">
                                <td className="px-3.5 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-3.5 py-2 text-slate-900 font-semibold">{item.category || item.name || "-"}</td>
                                <td className="px-3.5 py-2 text-slate-600">
                                  <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${getCostCodeBadgeStyle(item.categoryType || item.type || "101 เตรียมงาน")}`}>
                                    {item.categoryType || item.type || "101 เตรียมงาน"}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-950">
                                  {money(toNumber(item.amount ?? item.price ?? item.total))} ฿
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-300 font-bold text-xs text-slate-950">
                    <span>รวมยอดสินค้าทุกร้านค้า ({lineItems.length} รายการ)</span>
                    <span className="font-black text-sm text-emerald-800">
                      {money(lineItems.reduce((s, i) => s + toNumber(i.amount ?? i.price ?? i.total), 0))} ฿
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div className="border border-slate-300 rounded-xl bg-white overflow-hidden">
                <div className="px-3.5 py-2 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Receipt size={14} className="text-slate-700" />
                    <span>รายการสินค้าในบิล ({lineItems.length} รายการ)</span>
                  </div>
                  <span className="text-xs font-black text-slate-950">{money(total)} ฿</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3.5 py-2 text-left w-10">#</th>
                        <th className="px-3.5 py-2 text-left">สินค้า / หมวดงาน</th>
                        <th className="px-3.5 py-2 text-left w-28">ประเภท</th>
                        <th className="px-3.5 py-2 text-right w-32">จำนวนเงิน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="px-3.5 py-2 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-3.5 py-2 text-slate-900 font-semibold">{item.category || item.name || "-"}</td>
                          <td className="px-3.5 py-2 text-slate-600">
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${getCostCodeBadgeStyle(item.categoryType || item.type || "101 เตรียมงาน")}`}>
                              {item.categoryType || item.type || "101 เตรียมงาน"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-right font-mono font-bold text-slate-950">
                            {money(toNumber(item.amount ?? item.price ?? item.total))} ฿
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                        <td colSpan={3} className="px-3.5 py-2 text-slate-950 text-xs">รวมยอดสินค้า ({lineItems.length} รายการ)</td>
                        <td className="px-3.5 py-2 text-right text-slate-950 text-xs font-black">
                          {money(lineItems.reduce((s, i) => s + toNumber(i.amount ?? i.price ?? i.total), 0))} ฿
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Section 2: รายการค่าใช้จ่าย (Expense Breakdown) */}
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <Layers size={14} className="text-slate-700" />
                <span>แจกแจงรายการค่าใช้จ่าย</span>
              </div>
              <span className="text-xs font-black text-slate-950">{money(total)} ฿</span>
            </div>

            {expenseBreakdown.length > 0 ? (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-200">
                  {expenseBreakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="px-3.5 py-2 text-slate-800 font-semibold w-[45%]">
                        <div>{item.label}</div>
                        {item.extra && <div className="text-[11px] text-slate-600 font-normal mt-0.5">{item.extra}</div>}
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-slate-950">
                        {item.isAmount ? `${money(item.value)} ฿` : String(item.value)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                    <td className="px-3.5 py-2 text-slate-950 text-xs">ยอดเงินรวมทั้งสิ้น</td>
                    <td className="px-3.5 py-2 text-right text-slate-950 text-sm font-black">{money(total)} ฿</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="p-3 text-center text-slate-600 text-xs font-medium">
                ยอดเงินรวม {money(total)} ฿ (ไม่มีการแจกแจงหมวดย่อยเพิ่มเติม)
              </div>
            )}
          </div>

          {/* Section 3: ภาษี & เงื่อนไขการชำระเงิน */}
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <CreditCard size={14} className="text-slate-700" />
                <span>ภาษี & เงื่อนไขการชำระเงิน</span>
              </div>
              <span className={`text-xs px-2 py-0.2 rounded font-bold border ${hasVat ? "bg-emerald-100 text-emerald-950 border-emerald-300" : "bg-slate-200 text-slate-900 border-slate-300"}`}>
                {vatDisplay}
              </span>
            </div>

            <div className="divide-y divide-slate-200 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">ภาษีมูลค่าเพิ่ม (VAT):</span>
                <span className="sm:col-span-2 text-slate-950 font-bold">
                  {vatDisplay}
                </span>
              </div>

              {hasVat && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">วันที่ได้รับใบกำกับภาษี (วันได้บิล):</span>
                  <span className="sm:col-span-2 text-slate-950 flex items-center gap-2 font-medium">
                    <span>{billReceivedDate}</span>
                    {billReceivedDate !== "-" ? (
                      <span className="bg-emerald-100 text-emerald-950 text-xs px-2 py-0.2 rounded border border-emerald-300 font-bold">ได้รับแล้ว</span>
                    ) : (
                      <span className="bg-amber-100 text-amber-950 text-xs px-2 py-0.2 rounded border border-amber-300 font-bold">รอใบกำกับ</span>
                    )}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">ภาษีหัก ณ ที่จ่าย (หัก):</span>
                <span className="sm:col-span-2 text-slate-950">
                  {hasDeduct ? (
                    <span className="text-amber-900 font-bold">{currentBill["หัก"]}</span>
                  ) : (
                    <span className="text-slate-600 font-medium">ไม่มีการหักภาษี</span>
                  )}
                </span>
              </div>

              {hasDeduct && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                    <span className="text-slate-700 font-semibold">จำนวนเงินที่หัก (จำนวนหัก):</span>
                    <span className="sm:col-span-2 text-amber-900 font-black">{money(deductAmount)} ฿</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                    <span className="text-slate-700 font-semibold">วันที่ออกหนังสือ 50 ทวิ (วันออก 3%):</span>
                    <span className="sm:col-span-2 text-slate-950 flex items-center gap-2 font-medium">
                      <span>{whtIssuedDate}</span>
                      {whtIssuedDate !== "-" ? (
                        <span className="bg-emerald-100 text-emerald-950 text-xs px-2 py-0.2 rounded border border-emerald-300 font-bold">ออกหนังสือแล้ว</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-950 text-xs px-2 py-0.2 rounded border border-amber-300 font-bold">รอออกหนังสือ</span>
                      )}
                    </span>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                <span className="text-slate-700 font-semibold">ระยะเวลาเครดิต:</span>
                <span className="sm:col-span-2 text-slate-950 font-bold">{creditDisplay}</span>
              </div>

              {paidDueDate !== "-" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1">
                  <span className="text-slate-700 font-semibold">วันครบกำหนดชำระ (วันจ่าย):</span>
                  <span className="sm:col-span-2 text-indigo-950 font-bold">{paidDueDate}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 px-3.5 py-2 gap-1 bg-emerald-50 border-t-2 border-emerald-300">
                <span className="text-emerald-950 font-black">ยอดโอนสุทธิ (ยอดโอน):</span>
                <span className="sm:col-span-2 text-emerald-950 font-black text-sm">{money(transferAmount)} ฿</span>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Bill Image & Proof Attachments (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden h-full flex flex-col">
            <div className="px-3.5 py-2 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <Receipt size={14} className="text-slate-700" />
                <span>รูปถ่ายบิล & สลิปเอกสารแนบ</span>
              </div>
              {hasValue(imageValue) && (
                <span className="text-xs text-slate-600 font-semibold">คลิกเพื่อดูภาพขยาย</span>
              )}
            </div>

            <div className="p-3 flex-1 flex flex-col items-center justify-center min-h-[220px]">
              <BillImageThumbnail value={imageValue} large />
            </div>

            {hasValue(imageValue) && (
              <div className="p-2.5 bg-slate-100 border-t border-slate-300 flex items-center justify-between text-xs text-slate-700 font-medium">
                <span>เอกสารแนบในระบบ</span>
                <a
                  href={String(imageValue).split(",")[0]?.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-950 hover:underline font-bold"
                >
                  <span>เปิดรูปขนาดเต็ม</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. RELATED PROJECT & CONTRACT WORK TABLES */}
      <div className="space-y-3 mt-1">
        {project.length > 0 && (
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <Building2 size={14} className="text-indigo-700" />
                <span>โครงการที่เกี่ยวข้อง ({project.length})</span>
              </div>
              <Link href={`/views/project-all?search=${encodeURIComponent(projectId)}`} className="text-xs text-indigo-700 hover:text-indigo-950 hover:underline inline-flex items-center gap-1 font-bold">
                <span>ดูรายละเอียดโครงการ</span>
                <ArrowUpRight size={12} />
              </Link>
            </div>
            <DataTable
              columns={["ID Project", "ชื่อ Project", "ยอดงาน", "ยอดรวม vat", "งบไม่เกิน", "วันที่", "รับผิดชอบ"]}
              rows={project}
              title=""
              rowLabel="รายการ"
              limit={5}
              detailBasePath="/work-status"
              detailKeyColumn="ID Project"
              showDetailColumn={false}
              cellFormatters={{
                "วันที่": (v) => formatDateThai(v),
                "ยอดงาน": (v) => money(v),
                "ยอดรวม vat": (v) => money(v),
                "งบไม่เกิน": (v) => money(v),
              }}
            />
          </div>
        )}

        {contract.length > 0 && (
          <div className="border border-slate-300 rounded-xl bg-white overflow-hidden">
            <div className="px-3.5 py-2 border-b border-slate-300 bg-amber-50/70 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <Wrench size={14} className="text-amber-700" />
                <span>สัญญาเปิดจ้างผู้รับเหมาที่เกี่ยวข้อง ({contract.length})</span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={contractLink || `/contract-open/${encodeURIComponent(contract[0]?.id_Conwork || contract[0]?.id || "")}`}
                  className="text-xs text-amber-800 hover:text-amber-950 hover:underline inline-flex items-center gap-1 font-bold"
                >
                  <span>เปิดดูสัญญา {contractDisplay || contract[0]?.id_Conwork || contract[0]?.id}</span>
                  <ArrowUpRight size={12} />
                </Link>
                <span className="text-slate-300">|</span>
                <Link href="/contract-open" className="text-xs text-slate-600 hover:text-slate-900 hover:underline inline-flex items-center gap-1 font-medium">
                  <span>รายการเปิดจ้างทั้งหมด</span>
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
            <DataTable
              columns={["id_Conwork", "id_Contractor", "ชื่อ Project", "ยอดเงินจ้าง", "ยอดเงินจ่าย", "ค่าแรงคงเหลือ", "รายละเอียดงาน", "วันที่"]}
              rows={contract}
              title=""
              rowLabel="รายการ"
              limit={5}
              detailBasePath="/contract-open"
              detailKeyColumn="id_Conwork"
              showDetailColumn={true}
              cellFormatters={{
                "วันที่": (v) => formatDateThai(v),
                "ยอดเงินจ้าง": (v) => money(v),
                "ยอดเงินจ่าย": (v) => money(v),
                "ค่าแรงคงเหลือ": (v) => money(v),
              }}
            />
          </div>
        )}
      </div>

      {/* EDIT FORM MODAL */}
      <FormModal
        tableName="Data"
        form={form}
        title="แก้ไขบิล"
        submitPath="/api/rows"
        openEventName="open-bill-edit-form"
        hideLauncher
        relaxed
      />

      {/* DOCUMENT PREVIEW & PRINT MODAL */}
      {documentData && (
        <BillDocumentModal
          data={documentData}
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
        />
      )}
    </div>
  );
}

function text(value: unknown) {
  return String(value || "").trim();
}

function firstText(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const val = text(row[column]);
    if (val) return val;
  }
  return "";
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "" && String(value).trim() !== "0" && String(value).trim() !== "0.00";
}

function billKey(row: SheetRow) {
  return text(row["ลำดับ"]) || text(row._sheetRow);
}
