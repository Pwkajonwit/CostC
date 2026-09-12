"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileCheck,
  Filter,
  Loader2,
  MessageSquare,
  Receipt,
  RotateCw,
  Search,
  Upload,
  Download,
  X,
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateDisplay, normalizeDateToIso, getTodayDateIso } from "@/lib/utils/dates";
import { isVatActive, parseDeductPercent, parseCreditDays } from "@/lib/project-summary";
import { formatVatDisplay, formatDeductDisplay, formatCreditDisplay } from "@/lib/bills/bill-status";
import { useRealtimeSync } from "@/lib/use-realtime-sync";
import { exportToCsv } from "@/lib/utils/export-utils";
import { BillImageThumbnail } from "@/components/bills/BillImageThumbnail";
import type { SheetRow } from "@/lib/types";

const PAGE_SIZE_OPTIONS = [20, 40, 60, 100];

export type BillFollowTab = "all" | "vat" | "urgent" | "warning" | "normal" | "credit";

type BillFollowDashboardClientProps = {
  vatRows: SheetRow[];
  naturalDeductRows?: SheetRow[];
  companyDeductRows?: SheetRow[];
  creditRows?: SheetRow[];
  requesterNames: Record<string, string>;
  peopleRows?: SheetRow[];
  initialRequester?: string;
  authEmpId?: string;
  authName?: string;
};

function resolveMatchingRequesterKey(
  peopleRows: SheetRow[],
  authEmpId?: string,
  authName?: string
): string {
  let empId = String(authEmpId || "").trim();
  let name = String(authName || "").trim();

  if (!empId && !name && typeof document !== "undefined") {
    const empMatch = document.cookie.match(/auth_employee_id=([^;]+)/);
    const nameMatch = document.cookie.match(/auth_name=([^;]+)/);
    empId = empMatch ? decodeURIComponent(empMatch[1]).trim() : "";
    name = nameMatch ? decodeURIComponent(nameMatch[1]).trim() : "";
  }

  if (!empId && !name) return "";

  const cleanEmpId = empId.toLowerCase();
  const cleanName = name.toLowerCase();

  const matched = peopleRows.find(p => {
    const pId = String(p["รหัสพนักงาน"] || p.id || "").trim().toLowerCase();
    const pNick = String(p["ชื่อเล่น"] || "").trim().toLowerCase();
    const pFull = String(p["ชื่อ-นามสกุล"] || "").trim().toLowerCase();
    return (
      (cleanEmpId && (pId === cleanEmpId || pNick === cleanEmpId || pFull === cleanEmpId)) ||
      (cleanName && (pNick === cleanName || pFull === cleanName || pId === cleanName))
    );
  });

  if (matched) {
    return String(matched["รหัสพนักงาน"] || matched.id || matched["ชื่อเล่น"] || "");
  }
  return empId || name || "";
}

function calculateDaysElapsed(dateVal: unknown): number {
  if (!dateVal) return 0;
  const iso = normalizeDateToIso(dateVal);
  if (!iso) return 0;
  const billDate = new Date(iso);
  if (isNaN(billDate.getTime())) return 0;
  const today = new Date();
  const diffTime = Math.max(0, today.getTime() - billDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function BillFollowDashboardClient({
  vatRows,
  naturalDeductRows,
  companyDeductRows,
  creditRows,
  requesterNames,
  peopleRows = [],
  initialRequester = "",
  authEmpId = "",
  authName = "",
}: BillFollowDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";

  const [activeTab, setActiveTab] = useState<BillFollowTab>("all");
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [selectedRequester, setSelectedRequester] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Realtime live synchronization on bills changes + Auto Polling
  useRealtimeSync({
    channelName: "bill-follow-live-sync",
    tables: ["bills"],
    onSync: () => router.refresh(),
    debounceMs: 500,
    pollingIntervalMs: 60_000,
    customEvents: ["bills-data-updated", "data-updated"]
  });

  useEffect(() => {
    setSearchTerm(urlSearch);
    setDebouncedSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Quick Action & Notification States
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [completedRowIds, setCompletedRowIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Multi-Select & 2-Step Inline Confirmation States (No Modal)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmingRowId, setConfirmingRowId] = useState<string | null>(null);
  const [isBatchConfirming, setIsBatchConfirming] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // VAT Aging buckets (คำนวณจำนวนวันค้างส่งบิล VAT)
  const urgentVatRows = useMemo(() => {
    return vatRows.filter((r) => calculateDaysElapsed(r["ว/ด/ป"]) >= 15);
  }, [vatRows]);

  const warningVatRows = useMemo(() => {
    return vatRows.filter((r) => {
      const days = calculateDaysElapsed(r["ว/ด/ป"]);
      return days >= 8 && days < 15;
    });
  }, [vatRows]);

  const normalVatRows = useMemo(() => {
    return vatRows.filter((r) => calculateDaysElapsed(r["ว/ด/ป"]) < 8);
  }, [vatRows]);

  // ตามบิล แสดงเฉพาะบิลที่มี VAT ที่ค้างส่งใบกำกับภาษี/ใบเสร็จ (หัก ณ ที่จ่าย จะไม่แสดงในหน้านี้)
  const allPendingRows = useMemo(() => vatRows, [vatRows]);

  const activeCategoryRows = useMemo(() => {
    switch (activeTab) {
      case "urgent":
        return urgentVatRows;
      case "warning":
        return warningVatRows;
      case "normal":
        return normalVatRows;
      case "credit":
        return creditRows || [];
      case "all":
      case "vat":
      default:
        return vatRows;
    }
  }, [activeTab, urgentVatRows, warningVatRows, normalVatRows, creditRows, vatRows]);

  // Filtered rows by requester, date, and search term
  const filteredRows = useMemo(() => {
    return activeCategoryRows.filter((row) => {
      // Filter by requester
      if (selectedRequester) {
        const rowReq = String(row["ผู้เบิก"] || row.requester || "").trim().toLowerCase();
        const mappedReqName = (requesterNames[rowReq] || requesterNames[String(row["ผู้เบิก"] || "")] || "").toLowerCase();
        const rowCreator = String(row["ผู้สร้างบิล"] || row.created_by || "").trim().toLowerCase();
        const mappedCreatorName = (requesterNames[rowCreator] || requesterNames[String(row["ผู้สร้างบิล"] || "")] || "").toLowerCase();
        const selLower = selectedRequester.toLowerCase();
        const selNameLower = (requesterNames[selectedRequester] || selectedRequester).toLowerCase();

        const matchesReq =
          rowReq === selLower ||
          rowReq === selNameLower ||
          mappedReqName === selLower ||
          mappedReqName === selNameLower;

        const matchesCreator =
          rowCreator === selLower ||
          rowCreator === selNameLower ||
          mappedCreatorName === selLower ||
          mappedCreatorName === selNameLower;

        if (!matchesReq && !matchesCreator) return false;
      }
      // Filter by date
      if (selectedDate) {
        const rowIso = normalizeDateToIso(row["ว/ด/ป"]);
        if (rowIso !== selectedDate) return false;
      }
      // Filter by search
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const match =
          String(row["ลำดับ"] || "").toLowerCase().includes(q) ||
          String(row["ร้าน/บุคคล"] || "").toLowerCase().includes(q) ||
          String(row["ชื่อ Project"] || "").toLowerCase().includes(q) ||
          String(row["สินค้า/ทำงาน"] || row["รายการ"] || "").toLowerCase().includes(q) ||
          String(row["ผู้เบิก"] || "").toLowerCase().includes(q) ||
          String(row["บิล"] || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [activeCategoryRows, selectedRequester, selectedDate, debouncedSearch]);

  // Financial totals
  const allPendingTotal = useMemo(() => vatRows.reduce((sum, r) => sum + toNumber(r["ยอดเงิน"]), 0), [vatRows]);
  const vatTotal = allPendingTotal;
  const urgentTotal = useMemo(() => urgentVatRows.reduce((sum, r) => sum + toNumber(r["ยอดเงิน"]), 0), [urgentVatRows]);
  const warningTotal = useMemo(() => warningVatRows.reduce((sum, r) => sum + toNumber(r["ยอดเงิน"]), 0), [warningVatRows]);
  const normalTotal = useMemo(() => normalVatRows.reduce((sum, r) => sum + toNumber(r["ยอดเงิน"]), 0), [normalVatRows]);
  const creditTotal = useMemo(() => (creditRows || []).reduce((sum, r) => sum + toNumber(r["ยอดเงิน"]), 0), [creditRows]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleStart = filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const visibleEnd = Math.min(currentPage * pageSize, filteredRows.length);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleTabChange = (tab: BillFollowTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  // Multi-Select & Batch Approval Computations
  const selectedRows = useMemo(() => {
    const idSet = new Set(selectedIds);
    return allPendingRows.filter((r) => idSet.has(String(r.id ?? r["ลำดับ"] ?? r._sheetRow ?? "")));
  }, [selectedIds, allPendingRows]);

  const selectedTotalAmount = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + toNumber(r["ยอดเงิน"]), 0);
  }, [selectedRows]);

  const selectablePaginatedRows = useMemo(() => {
    return paginatedRows.filter((r) => {
      const bId = String(r.id ?? r["ลำดับ"] ?? r._sheetRow ?? "");
      const isComp = completedRowIds.has(bId) || Boolean(r["วันได้บิล"]);
      return !isComp;
    });
  }, [paginatedRows, completedRowIds]);

  const isAllPaginatedSelected = useMemo(() => {
    return (
      selectablePaginatedRows.length > 0 &&
      selectablePaginatedRows.every((r) => selectedIds.includes(String(r.id ?? r["ลำดับ"] ?? r._sheetRow ?? "")))
    );
  }, [selectablePaginatedRows, selectedIds]);

  function handleToggleSelectAll() {
    if (isAllPaginatedSelected) {
      const pageIds = new Set(selectablePaginatedRows.map((r) => String(r.id ?? r["ลำดับ"] ?? r._sheetRow ?? "")));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = selectablePaginatedRows.map((r) => String(r.id ?? r["ลำดับ"] ?? r._sheetRow ?? ""));
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function handleToggleRow(billId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(billId)) {
        return prev.filter((id) => id !== billId);
      } else {
        return [...prev, billId];
      }
    });
  }

  // 2-Step Inline Confirmation Execution Handlers (Single and Batch - No Modal)
  async function handleExecuteSingleRow(row: SheetRow) {
    const rowId = String(row.id ?? row["ลำดับ"] ?? row._sheetRow ?? "");
    const sheetRow = row.id ?? row["ลำดับ"] ?? row._sheetRow;
    setSavingRowId(rowId);

    const todayStr = getTodayDateIso();

    // ⚡ Optimistic UI Update: Mark row completed immediately (< 20ms)
    setCompletedRowIds((prev) => new Set([...prev, rowId]));
    setConfirmingRowId(null);

    try {
      const updateValues: SheetRow = {
        "วันได้บิล": todayStr,
      };
      if (rowId) {
        updateValues["ลำดับ"] = rowId;
      }

      const res = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: "Data",
          id: sheetRow,
          sheetRow,
          values: updateValues,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");

      showToast(`อนุมัติได้รับบิล #${rowId} เรียบร้อยแล้ว`);

      // Remove from selectedIds if selected
      setSelectedIds((prev) => prev.filter((id) => id !== rowId));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bills-data-updated"));
        window.dispatchEvent(new CustomEvent("data-updated", { detail: { tableName: "Data" } }));
      }
      router.refresh();
    } catch (err: any) {
      // 🔄 Rollback optimistic change on error
      setCompletedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      showToast(`เกิดข้อผิดพลาดในการอนุมัติบิล: ${err?.message || "กรุณาลองใหม่อีกครั้ง"}`);
    } finally {
      setSavingRowId(null);
    }
  }

  async function handleExecuteBatch() {
    if (!selectedRows.length) return;
    setIsProcessingBatch(true);

    const todayStr = getTodayDateIso();
    const rowIds = selectedRows.map((r) => String(r.id ?? r["ลำดับ"] ?? r._sheetRow ?? ""));

    // ⚡ Optimistic UI Update
    setCompletedRowIds((prev) => {
      const next = new Set(prev);
      rowIds.forEach((id) => next.add(id));
      return next;
    });
    setIsBatchConfirming(false);

    try {
      const patches = selectedRows.map((row) => {
        const sheetRow = row.id ?? row["ลำดับ"] ?? row._sheetRow;
        const rowId = String(row.id ?? row["ลำดับ"] ?? row._sheetRow ?? "");
        const updateValues: SheetRow = {
          "วันได้บิล": todayStr,
        };
        if (rowId) {
          updateValues["ลำดับ"] = rowId;
        }
        return {
          id: sheetRow,
          sheetRow,
          values: updateValues,
        };
      });

      const res = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: "Data",
          patches,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Batch update failed");

      showToast(`อนุมัติได้รับบิลทั้งหมด ${selectedRows.length} รายการ เรียบร้อยแล้ว`);
      setSelectedIds([]);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bills-data-updated"));
        window.dispatchEvent(new CustomEvent("data-updated", { detail: { tableName: "Data" } }));
      }
      router.refresh();
    } catch (err: any) {
      setCompletedRowIds((prev) => {
        const next = new Set(prev);
        rowIds.forEach((id) => next.delete(id));
        return next;
      });
      showToast(`เกิดข้อผิดพลาดในการอนุมัติบิล: ${err?.message || "กรุณาลองใหม่อีกครั้ง"}`);
    } finally {
      setIsProcessingBatch(false);
    }
  }

  // Generate LINE follow-up message text
  function generateLineText(row: SheetRow) {
    const billId = String(row.id || row["ลำดับ"] || row._sheetRow || "");
    const vendor = String(row["ร้าน/บุคคล"] || "-");
    const project = String(row["ชื่อ Project"] || "-");
    const item = String(row["สินค้า/ทำงาน"] || row["รายการ"] || "-");
    const date = formatDateDisplay(row["ว/ด/ป"]);
    const requesterCode = String(row["ผู้เบิก"] || "").trim();
    const requesterName = requesterNames[requesterCode] || requesterCode || "ผู้เบิก";
    const amount = money(toNumber(row["ยอดเงิน"]));
    const days = calculateDaysElapsed(row["ว/ด/ป"]);

    const conditions = [];
    if (row.vat && !row["วันได้บิล"]) conditions.push(`ใบกำกับภาษี ${formatVatDisplay(row.vat)}`);
    if (row["เครดิต"] && !row["วันจ่าย"]) conditions.push(`บิล${formatCreditDisplay(row["เครดิต"])}`);
    const condStr = conditions.join(" / ") || "ใบกำกับภาษี / ใบเสร็จรับเงิน";

    return `📢 แจ้งติดตามเอกสารบิล/ใบเสร็จรับเงิน
----------------------------------
👤 ผู้เบิก: ${requesterName}
🏗️ โครงการ: ${project}
🏪 ร้าน/บุคคล: ${vendor}
📄 เลขที่บิล/ลำดับ: #${billId}
📝 รายการ: ${item}
💰 ยอดเงิน: ${amount} บาท
📅 วันที่รายการ: ${date}
⏳ ค้างเอกสารมาแล้ว: ${days} วัน
📌 เอกสารที่ต้องส่ง: ${condStr}
----------------------------------
รบกวนนำส่งเอกสารต้นฉบับให้ฝ่ายบัญชีด้วยครับ/ค่ะ 🙏`;
  }

  function copyLineText(row: SheetRow) {
    const billId = String(row.id || row["ลำดับ"] || row._sheetRow || "");
    const text = generateLineText(row);
    navigator.clipboard.writeText(text);
    setCopiedId(billId);
    showToast(`คัดลอกข้อความติดตามบิล #${billId} สำหรับส่ง LINE แล้ว!`);
    setTimeout(() => setCopiedId(null), 2500);
  }

  // Copy batch summary for selected requester
  function copyRequesterBatchText() {
    if (!selectedRequester || !filteredRows.length) return;
    const reqName = requesterNames[selectedRequester] || selectedRequester;
    let text = `📢 สรุปรายการตามบิลค้างส่งของคุณ ${reqName} (${filteredRows.length} รายการ)\n----------------------------------\n`;

    filteredRows.forEach((r, idx) => {
      const bId = String(r.id || r["ลำดับ"] || r._sheetRow || idx + 1);
      const prj = String(r["ชื่อ Project"] || "-");
      const vdr = String(r["ร้าน/บุคคล"] || "-");
      const amt = money(toNumber(r["ยอดเงิน"]));
      const days = calculateDaysElapsed(r["ว/ด/ป"]);
      text += `${idx + 1}. #${bId} - ${prj} (${vdr}) ยอด ${amt} บ. [ค้าง ${days} วัน]\n`;
    });

    text += `----------------------------------\nรบกวนตรวจสอบและส่งเอกสารให้ฝ่ายบัญชีด้วยนะครับ/ค่ะ 🙏`;
    navigator.clipboard.writeText(text);
    showToast(`คัดลอกสรุปรายการตามบิลของคุณ ${reqName} แล้ว!`);
  }

  // Export filtered rows to CSV / Excel with UTF-8 BOM
  function handleExportCsv() {
    if (!filteredRows.length) return;
    const tabNameMap: Record<string, string> = {
      all: "ตาม_VAT_ทั้งหมด",
      vat: "ตาม_VAT",
      urgent: "ค้างเกิน15วัน_ด่วน",
      warning: "ค้าง8_14วัน_เตือน",
      normal: "ค้าง1_7วัน_ปกติ",
      credit: "ตาม_เครดิต"
    };
    const filename = `รายงานตามบิลVAT_${tabNameMap[activeTab] || "VAT"}_${new Date().toISOString().slice(0, 10)}`;
    const headers = [
      "ลำดับ",
      "ว/ด/ป",
      "ID Project",
      "ชื่อ Project",
      "ร้าน/บุคคล",
      "สินค้า/ทำงาน",
      "ยอดเงิน",
      "ยอดโอน",
      "VAT",
      "หัก ณ ที่จ่าย",
      "เครดิต",
      "ผู้เบิก",
      "วันได้บิล",
      "วันออก 3%",
      "วันจ่าย"
    ];
    const data = filteredRows.map(r => [
      r["ลำดับ"] || "",
      r["ว/ด/ป"] || "",
      r["ID Project"] || "",
      r["ชื่อ Project"] || "",
      r["ร้าน/บุคคล"] || "",
      r["สินค้า/ทำงาน"] || r["รายการ"] || "",
      toNumber(r["ยอดเงิน"]),
      toNumber(r["ยอดโอน"]),
      r.vat || "",
      r["หัก"] || "",
      r["เครดิต"] || "",
      r["ผู้เบิก"] || "",
      r["วันได้บิล"] || "",
      r["วันออก 3%"] || "",
      r["วันจ่าย"] || ""
    ]);
    exportToCsv(filename, headers, data);
    showToast(`ส่งออกไฟล์ Excel (${filteredRows.length} รายการ) สำเร็จ!`);
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 sm:p-5 max-w-[1600px] mx-auto font-sans text-sm text-slate-800 relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-3 rounded-md shadow-lg flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="text-xs ">{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-2">
            <X size={15} />
          </button>
        </div>
      )}

      {/* 1. EXECUTIVE SUMMARY KPI CARDS (Horizontal Scrollable Tabs on Mobile, Grid on Desktop) */}
      <div className={`flex sm:grid ${(creditRows?.length || 0) > 0 ? "sm:grid-cols-2 md:grid-cols-5" : "sm:grid-cols-2 md:grid-cols-4"} gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-1`}>
        {/* Card 1: All VAT Bills Total Card */}
        <div
          onClick={() => handleTabChange("all")}
          className={`min-w-[140px] sm:min-w-0 flex-1 rounded-xl p-2.5 sm:p-3 border transition cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
            activeTab === "all" || activeTab === "vat"
              ? "border-2 border-[#0b3531] bg-[#f2f9f6] shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-xs">
            <span className={`truncate ${activeTab === "all" || activeTab === "vat" ? "text-[#0b3531] font-semibold" : "text-slate-700"}`}>ตาม VAT ทั้งหมด</span>
            <span className={`shrink-0 ml-1 font-mono text-xs px-1.5 py-0.2 rounded-full ${
              activeTab === "all" || activeTab === "vat" ? "bg-[#0b3531] text-[#d4f54e]" : "bg-slate-100 text-slate-500"
            }`}>{vatRows.length}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-sm sm:text-lg truncate ${activeTab === "all" || activeTab === "vat" ? "text-[#0b3531] font-bold" : "text-slate-900"}`}>{money(vatTotal)}</span>
          </div>
        </div>

        {/* Card 2: Normal (1 - 7 Days) */}
        <div
          onClick={() => handleTabChange("normal")}
          className={`min-w-[140px] sm:min-w-0 flex-1 rounded-xl p-2.5 sm:p-3 border transition cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
            activeTab === "normal"
              ? "border-2 border-emerald-600 bg-emerald-50/60 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-xs">
            <span className={`truncate ${activeTab === "normal" ? "text-emerald-800 font-semibold" : "text-slate-700"}`}>ค้าง 1 - 7 วัน</span>
            <span className={`shrink-0 ml-1 font-mono text-xs px-1.5 py-0.2 rounded-full ${
              activeTab === "normal" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"
            }`}>{normalVatRows.length}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-sm sm:text-lg truncate ${activeTab === "normal" ? "text-emerald-900 font-bold" : "text-slate-900"}`}>{money(normalTotal)}</span>
          </div>
        </div>

        {/* Card 3: Warning (8 - 14 Days) */}
        <div
          onClick={() => handleTabChange("warning")}
          className={`min-w-[140px] sm:min-w-0 flex-1 rounded-xl p-2.5 sm:p-3 border transition cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
            activeTab === "warning"
              ? "border-2 border-amber-500 bg-amber-50/60 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-xs">
            <span className={`truncate ${activeTab === "warning" ? "text-amber-800 font-semibold" : "text-slate-700"}`}>ค้าง 8 - 14 วัน</span>
            <span className={`shrink-0 ml-1 font-mono text-xs px-1.5 py-0.2 rounded-full ${
              activeTab === "warning" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700"
            }`}>{warningVatRows.length}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-sm sm:text-lg truncate ${activeTab === "warning" ? "text-amber-900 font-bold" : "text-slate-900"}`}>{money(warningTotal)}</span>
          </div>
        </div>

        {/* Card 4: Urgent (>= 15 Days) */}
        <div
          onClick={() => handleTabChange("urgent")}
          className={`min-w-[140px] sm:min-w-0 flex-1 rounded-xl p-2.5 sm:p-3 border transition cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
            activeTab === "urgent"
              ? "border-2 border-rose-500 bg-rose-50/60 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs sm:text-xs">
            <span className={`truncate ${activeTab === "urgent" ? "text-rose-800 font-semibold" : "text-slate-700"}`}>ค้างเกิน 15 วัน (ด่วน)</span>
            <span className={`shrink-0 ml-1 font-mono text-xs px-1.5 py-0.2 rounded-full ${
              activeTab === "urgent" ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700"
            }`}>{urgentVatRows.length}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-sm sm:text-lg truncate ${activeTab === "urgent" ? "text-rose-900 font-bold" : "text-slate-900"}`}>{money(urgentTotal)}</span>
          </div>
        </div>

        {/* Card 5: Credit (Optional, only shown if credit bills with VAT exist) */}
        {(creditRows?.length || 0) > 0 && (
          <div
            onClick={() => handleTabChange("credit")}
            className={`min-w-[140px] sm:min-w-0 flex-1 rounded-xl p-2.5 sm:p-3 border transition cursor-pointer shadow-2xs shrink-0 active:scale-95 ${
              activeTab === "credit"
                ? "border-2 border-[#0b3531] bg-[#f2f9f6] shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-xs sm:text-xs">
              <span className={`truncate ${activeTab === "credit" ? "text-[#0b3531] font-semibold" : "text-slate-700"}`}>ตาม เครดิต</span>
              <span className={`shrink-0 ml-1 font-mono text-xs px-1.5 py-0.2 rounded-full ${
                activeTab === "credit" ? "bg-[#0b3531] text-[#d4f54e]" : "bg-slate-100 text-slate-500"
              }`}>{creditRows?.length || 0}</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className={`text-sm sm:text-lg truncate ${activeTab === "credit" ? "text-[#0b3531] font-bold" : "text-slate-900"}`}>{money(creditTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. FILTER & ACTION TOOLBAR (UNIFIED SINGLE ROW) */}
      <div className="border border-slate-200 rounded-xl md:rounded-md p-2 bg-white flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs shadow-2xs">
        {/* Left Section: Search Box (compact) + Filters in the same row */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Universal Search Box (Compact width) */}
          <div className="relative flex items-center w-full md:w-44 lg:w-56 shrink-0">
            <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none shrink-0" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-50 md:bg-white text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg md:rounded-md border border-slate-200 md:border-slate-300 focus:outline-none focus:bg-white focus:border-slate-400 placeholder:text-slate-400"
            />
            {searchTerm && (
              <X
                size={14}
                className="absolute right-2 text-slate-400 cursor-pointer hover:text-slate-600"
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                }}
              />
            )}
          </div>

          <div className="hidden lg:block h-4 w-px bg-slate-200 shrink-0" />

          {/* Filters (Desktop all in one row, Mobile expandable) */}
          <div className={`flex-wrap items-center gap-2 ${showMobileFilters ? "flex w-full md:w-auto" : "hidden md:flex"}`}>
            {/* Requester dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-700 whitespace-nowrap">ผู้เบิก:</span>
              <select
                value={selectedRequester}
                onChange={(e) => {
                  setSelectedRequester(e.target.value);
                  setPage(1);
                }}
                className="bg-white border border-slate-300 text-xs text-slate-800 px-2 py-1 rounded-md focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="">ทั้งหมด ({allPendingRows.length})</option>
                {peopleRows.map((row) => {
                  const key = String(row["รหัสพนักงาน"] || row["ชื่อเล่น"] || row._sheetRow || "").trim();
                  const label = row["ชื่อเล่น"] ? `${key} - ${row["ชื่อเล่น"]}` : key;
                  return key ? (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ) : null;
                })}
              </select>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-700 whitespace-nowrap">วันที่:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setPage(1);
                }}
                className="bg-white border border-slate-300 text-xs text-slate-800 px-2 py-1 rounded-md focus:outline-none cursor-pointer"
              />
              {selectedDate ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate("");
                    setPage(1);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                  title="ดูทุกวัน (ไม่จำกัดวันที่)"
                >
                  ทั้งหมด
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right Section: Action Buttons (LINE, Batch Approve, Export, Mobile Toggle) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`md:hidden px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 transition ${
              showMobileFilters || selectedRequester || selectedDate
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
          >
            <Filter size={13} className={showMobileFilters || selectedRequester || selectedDate ? "text-[#d4f54e]" : "text-slate-500"} />
            <span>{showMobileFilters ? "ซ่อน" : "ตัวกรอง"}</span>
          </button>

          {selectedRequester && filteredRows.length > 0 && (
            <button
              type="button"
              onClick={copyRequesterBatchText}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs active:scale-95"
              title="คัดลอกข้อความสรุปบิลค้างทั้งหมดของผู้เบิกรายนี้"
            >
              <span>LINE ({filteredRows.length})</span>
            </button>
          )}

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setIsBatchConfirming(true)}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-lg transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs active:scale-95 font-medium animate-in fade-in"
              title="อนุมัติบิลที่เลือกทั้งหมด"
            >
              <CheckCircle2 size={13} />
              <span>อนุมัติที่เลือก ({selectedIds.length})</span>
            </button>
          )}

          {filteredRows.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs rounded-lg border border-slate-200 transition cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs active:scale-95"
              title="ส่งออกรายการตามบิลที่กรองอยู่เป็นไฟล์ Excel (CSV)"
            >
              <Download size={13} className="text-slate-600" />
              <span className="hidden sm:inline">ส่งออก</span> Excel
            </button>
          )}
        </div>
      </div>

      {/* 3. WORK TABLE / MOBILE ULTRA-COMPACT CARDS FEED */}
      <div className="md:border md:border-slate-200 md:rounded-md md:bg-white md:overflow-hidden md:shadow-2xs">
        {/* MOBILE ULTRA-COMPACT CARD FEED */}
        <div className="block md:hidden space-y-2">
          {!paginatedRows.length ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200 shadow-2xs">
              ไม่พบรายการตามบิลที่ค้นหา
            </div>
          ) : (
            paginatedRows.map((row, index) => {
              const billId = String(row["ลำดับ"] || row._sheetRow || index);
              const vendor = String(row["ร้าน/บุคคล"] || "-");
              const project = String(row["ชื่อ Project"] || "-");
              const item = String(row["สินค้า/ทำงาน"] || row["รายการ"] || "-");
              const date = formatDateDisplay(row["ว/ด/ป"]);
              const requesterCode = String(row["ผู้เบิก"] || "").trim();
              const requesterName = requesterNames[requesterCode] || requesterCode || "-";
              const amount = toNumber(row["ยอดเงิน"]);
              const daysElapsed = calculateDaysElapsed(row["ว/ด/ป"]);

              const hasVat = isVatActive(row.vat);
              const hasDeduct = parseDeductPercent(row["หัก"]) > 0;
              const isCompany = String(row["statusค่าแรง"] || "").trim() === "บริษัท";
              const hasCredit = parseCreditDays(row["เครดิต"]) > 0;

              const isSaving = savingRowId === billId;
              const isCopied = copiedId === billId;
              const isCompleted = completedRowIds.has(billId) || (hasVat && Boolean(row["วันได้บิล"])) || (hasCredit && Boolean(row["วันจ่าย"]));

              // Card aging border highlight
              const agingBorderClass =
                daysElapsed >= 15
                  ? "border-l-[3.5px] border-l-rose-500"
                  : daysElapsed >= 8
                  ? "border-l-[3.5px] border-l-amber-500"
                  : "border-l-[3.5px] border-l-slate-300";

              return (
                <div
                  key={`mob-bill-follow-${billId}-${index}`}
                  className={`bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs space-y-1.5 transition ${agingBorderClass}`}
                >
                  {/* Row 1: Checkbox + Bill ID + Project Name ── Amount */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!isCompleted && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(billId)}
                          onChange={() => handleToggleRow(billId)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                          title="เลือกรายการนี้"
                        />
                      )}
                      <Link
                        href={`/bills/${encodeURIComponent(billId)}`}
                        className="text-xs bg-slate-900 text-white px-1.5 py-0.2 rounded shrink-0 hover:bg-slate-800 active:scale-95 transition"
                        title="ดูรายละเอียดบิล"
                      >
                        #{billId}
                      </Link>
                      <span className="text-xs text-slate-900 truncate">
                        {project}
                      </span>
                    </div>

                    <span className="text-xs sm:text-sm text-slate-900 shrink-0">
                      {money(amount)} <span className="text-xs font-normal text-slate-400">฿</span>
                    </span>
                  </div>

                  {/* Row 2: Vendor • Item • Requester • Date ── Aging Tag */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="text-slate-800 truncate">{vendor}</span>
                      {item && item !== "-" && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 truncate">{item}</span>
                        </>
                      )}
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-400 shrink-0">{requesterName}</span>
                    </div>

                    <span className={`px-1.5 py-0.2 rounded text-xs shrink-0 ${
                      daysElapsed >= 15
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : daysElapsed >= 8
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      ค้าง {daysElapsed} วัน
                    </span>
                  </div>

                  {/* Row 3: Conditions Badges ── Quick Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80">
                    {/* Condition badges */}
                    <div className="flex flex-wrap items-center gap-1">
                      {hasVat && (
                        <span className="px-1.5 py-0.2 rounded text-xs bg-sky-50 text-sky-700 border border-sky-200">
                          {formatVatDisplay(row.vat)}
                        </span>
                      )}
                      {hasCredit && (
                        <span className="px-1.5 py-0.2 rounded text-xs bg-orange-50 text-orange-700 border border-orange-200">
                          {formatCreditDisplay(row["เครดิต"])}
                        </span>
                      )}
                    </div>

                    {/* Quick Actions: Single Unified Button & LINE text */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyLineText(row)}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition border cursor-pointer active:scale-95 ${
                          isCopied
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200 shadow-2xs"
                        }`}
                        title="คัดลอกข้อความส่ง LINE ติดตาม"
                      >
                        <MessageSquare size={12} />
                      </button>

                      {isCompleted ? (
                        <div
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-1 select-none font-medium"
                          title="อนุมัติได้รับบิลเรียบร้อยแล้ว"
                        >
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>ได้บิลแล้ว</span>
                        </div>
                      ) : confirmingRowId === billId ? (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            disabled={savingRowId === billId}
                            onClick={() => handleExecuteSingleRow(row)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50"
                            title="ยืนยันอนุมัติได้รับบิลนี้"
                          >
                            {savingRowId === billId ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} strokeWidth={3} />
                            )}
                            <span>ยืนยัน</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingRowId === billId}
                            onClick={() => setConfirmingRowId(null)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-0.5 border border-slate-300 transition cursor-pointer disabled:opacity-50"
                            title="ยกเลิก"
                          >
                            <X size={12} />
                            <span>ยกเลิก</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isProcessingBatch || savingRowId !== null}
                          onClick={() => setConfirmingRowId(billId)}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs flex items-center gap-1"
                          title="กดเพื่อยืนยันอนุมัติได้รับบิล"
                        >
                          <Check size={12} strokeWidth={2.5} />
                          <span>ได้บิลแล้ว</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP HIGH-DENSITY TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 text-xs">
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-10">
                  <input
                    type="checkbox"
                    checked={isAllPaginatedSelected}
                    disabled={selectablePaginatedRows.length === 0}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                    title={isAllPaginatedSelected ? "ยกเลิกเลือกทั้งหมดในหน้านี้" : "เลือกทั้งหมดในหน้านี้"}
                  />
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200">ลำดับ</th>
                <th className="py-2.5 px-3 border-r border-slate-200">ร้าน/บุคคล</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Project</th>
                <th className="py-2.5 px-3 border-r border-slate-200">สินค้า/ทำงาน</th>
                <th className="py-2.5 px-3 border-r border-slate-200">วันที่</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">ค้างเอกสาร</th>
                <th className="py-2.5 px-3 border-r border-slate-200">ผู้เบิก</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right">ยอดเงิน</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">เงื่อนไข</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center">เอกสารแนบ</th>
                <th className="py-2.5 px-3 text-center">จัดการตามบิล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.map((row, index) => {
                const billId = String(row["ลำดับ"] || row._sheetRow || index);
                const vendor = String(row["ร้าน/บุคคล"] || "-");
                const project = String(row["ชื่อ Project"] || "-");
                const item = String(row["สินค้า/ทำงาน"] || row["รายการ"] || "-");
                const date = formatDateDisplay(row["ว/ด/ป"]);
                const requesterCode = String(row["ผู้เบิก"] || "").trim();
                const requesterName = requesterNames[requesterCode] || requesterCode || "-";
                const amount = toNumber(row["ยอดเงิน"]);
                const daysElapsed = calculateDaysElapsed(row["ว/ด/ป"]);

                const hasVat = isVatActive(row.vat);
                const hasDeduct = parseDeductPercent(row["หัก"]) > 0;
                const isCompany = String(row["statusค่าแรง"] || "").trim() === "บริษัท";
                const hasCredit = parseCreditDays(row["เครดิต"]) > 0;

                const isSaving = savingRowId === billId;
                const isCopied = copiedId === billId;
                const isCompleted = completedRowIds.has(billId) || (hasVat && Boolean(row["วันได้บิล"])) || (hasCredit && Boolean(row["วันจ่าย"]));

                return (
                  <tr key={`${billId}-${index}`} className="hover:bg-slate-50 transition-colors">
                    {/* Checkbox */}
                    <td className="py-2 px-3 text-center border-r border-slate-100 w-10">
                      {isCompleted ? (
                        <span className="text-slate-300 font-mono text-xs select-none">-</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(billId)}
                          onChange={() => handleToggleRow(billId)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="เลือกรายการนี้"
                        />
                      )}
                    </td>

                    {/* Sequence */}
                    <td className="py-2 px-3 text-slate-800 border-r border-slate-100">
                      <Link
                        href={`/bills/${encodeURIComponent(billId)}`}
                        className="text-slate-900 hover:underline"
                        title="ดูรายละเอียดบิล"
                      >
                        #{billId}
                      </Link>
                    </td>

                    {/* Vendor */}
                    <td className="py-2 px-3 text-slate-900 border-r border-slate-100">
                      {vendor}
                    </td>

                    {/* Project */}
                    <td className="py-2 px-3 text-slate-700 border-r border-slate-100">
                      {project}
                    </td>

                    {/* Item */}
                    <td className="py-2 px-3 text-slate-700 border-r border-slate-100">
                      {item}
                    </td>

                    {/* Date */}
                    <td className="py-2 px-3 text-slate-500 border-r border-slate-100 whitespace-nowrap">
                      {date}
                    </td>

                    {/* Days Elapsed Aging */}
                    <td className="py-2 px-3 text-center border-r border-slate-100">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        daysElapsed >= 15
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : daysElapsed >= 8
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {daysElapsed} วัน
                      </span>
                    </td>

                    {/* Requester */}
                    <td className="py-2 px-3 text-slate-700 font-medium border-r border-slate-100">
                      {requesterName}
                    </td>

                    {/* Amount */}
                    <td className="py-2 px-3 text-right text-slate-900 border-r border-slate-100">
                      {money(amount)}
                    </td>

                    {/* Conditions */}
                    <td className="py-2 px-3 text-center border-r border-slate-100">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {hasVat && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                            {formatVatDisplay(row.vat)}
                          </span>
                        )}
                        {hasCredit && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
                            {formatCreditDisplay(row["เครดิต"])}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Attached Documents */}
                    <td className="py-2 px-3 text-center border-r border-slate-100">
                      <div className="flex items-center justify-center">
                        {row["รูปถ่ายบิล"] ? (
                          <BillImageThumbnail value={row["รูปถ่ายบิล"]} compact />
                        ) : (
                          <span className="text-slate-300 font-mono select-none text-xs">-</span>
                        )}
                      </div>
                    </td>

                    {/* Actions: Single Unified Button & LINE Copy */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {completedRowIds.has(billId) || (hasVat && Boolean(row["วันได้บิล"])) || (hasCredit && Boolean(row["วันจ่าย"])) ? (
                          <div
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-200 flex items-center gap-1 select-none font-medium"
                            title="อนุมัติได้รับบิลเรียบร้อยแล้ว"
                          >
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span>ได้บิลแล้ว</span>
                          </div>
                        ) : confirmingRowId === billId ? (
                          <div className="flex items-center justify-center gap-1 animate-in fade-in zoom-in-95 duration-150">
                            <button
                              type="button"
                              disabled={savingRowId === billId}
                              onClick={() => handleExecuteSingleRow(row)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded flex items-center gap-1 shadow-xs transition cursor-pointer disabled:opacity-50"
                              title="ยืนยันอนุมัติได้รับบิลนี้"
                            >
                              {savingRowId === billId ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} strokeWidth={3} />
                              )}
                              <span>ยืนยัน</span>
                            </button>
                            <button
                              type="button"
                              disabled={savingRowId === billId}
                              onClick={() => setConfirmingRowId(null)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-medium rounded flex items-center gap-0.5 border border-slate-300 transition cursor-pointer disabled:opacity-50"
                              title="ยกเลิก"
                            >
                              <X size={12} />
                              <span>ยกเลิก</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessingBatch || isSaving}
                            onClick={() => setConfirmingRowId(billId)}
                            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded transition cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs flex items-center gap-1.5"
                            title="กดเพื่อยืนยันอนุมัติได้รับบิล"
                          >
                            <Check size={13} strokeWidth={2.5} />
                            <span>ได้บิลแล้ว</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => copyLineText(row)}
                          className={`p-1 rounded text-xs transition border cursor-pointer ${
                            isCopied
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-600 hover:bg-slate-50 border-slate-300"
                          }`}
                          title="คัดลอกข้อความส่ง LINE ติดตาม"
                        >
                          <MessageSquare size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!paginatedRows.length && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 text-xs font-medium">
                    ไม่พบรายการตามบิลที่ค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. SLEEK PAGINATION */}
        {filteredRows.length > 0 && (
          <>
            {/* Mobile Minimal Pagination (Clean Minimal Footer) */}
            <div className="block md:hidden pt-1 pb-3">
              {totalPages <= 1 ? (
                <div className="text-center text-xs text-slate-400 font-medium select-none">
                  • แสดงครบทั้งหมด {filteredRows.length} รายการ •
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 text-xs bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 transition text-slate-700 flex items-center gap-1 cursor-pointer active:bg-slate-200"
                  >
                    <ChevronLeft size={14} />
                    <span>ก่อนหน้า</span>
                  </button>

                  <span className="text-slate-700 text-xs">
                    หน้า {currentPage} / {totalPages} <span className="font-normal text-slate-400 text-xs">({filteredRows.length} รายการ)</span>
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-30 transition text-slate-700 flex items-center gap-1 cursor-pointer active:bg-slate-200"
                  >
                    <span>ถัดไป</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Full Pagination */}
            <div className="hidden md:flex flex-row items-center justify-between gap-3 p-3 border-t border-slate-200 text-xs text-slate-600 bg-slate-50">
              <div>
                แสดง {visibleStart}-{visibleEnd} จาก {filteredRows.length} รายการ
              </div>

              <div className="flex items-center gap-3">
                {/* Rows per page */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-medium">แสดงต่อหน้า:</span>
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setPageSize(opt);
                        setPage(1);
                      }}
                      className={`px-2 py-0.5 rounded text-xs transition cursor-pointer ${
                        opt === pageSize ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {/* Page prev next navigation */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer text-slate-700"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-slate-800 px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer text-slate-700"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Bottom Batch Action Bar */}
      {selectedIds.length > 0 && (
        <aside
          aria-label="แถบจัดการหลายรายการ"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl bg-[#0b3531]/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold text-sm">
              {selectedIds.length}
            </div>
            <div>
              <div className="text-xs text-emerald-200/90 font-medium">
                เลือกแล้ว <span className="text-white font-bold">{selectedIds.length}</span> รายการ
              </div>
              <div className="text-sm font-bold text-white tracking-tight">
                ยอดรวม: <span className="text-emerald-300 font-mono">฿{money(selectedTotalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isBatchConfirming ? (
              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  disabled={isProcessingBatch}
                  onClick={() => setIsBatchConfirming(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isProcessingBatch}
                  onClick={handleExecuteBatch}
                  className="px-3.5 py-1.5 text-xs md:text-sm font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isProcessingBatch ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} strokeWidth={3} />
                  )}
                  <span>ยืนยันอนุมัติ ({selectedIds.length})</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer active:scale-95"
                >
                  ยกเลิกทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setIsBatchConfirming(true)}
                  className="px-4 py-2 text-xs md:text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <CheckCircle2 size={16} className="text-white" />
                  <span>อนุมัติได้รับบิล ({selectedIds.length})</span>
                </button>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
