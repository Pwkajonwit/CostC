"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Check,
  CheckCircle2,
  Coins,
  DollarSign,
  FileCheck2,
  Filter,
  HandCoins,
  History,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
  X
} from "lucide-react";
import dynamic from "next/dynamic";

const FormModal = dynamic(
  () => import("@/components/forms/FormModal").then((mod) => mod.FormModal),
  { ssr: false }
);

import { TABLES } from "@/lib/config";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateDisplay, getRowYear } from "@/lib/utils/dates";
import { useYearFilter } from "@/lib/context/YearFilterContext";
import type { SheetRow } from "@/lib/types";

type PettyCashDashboardClientProps = {
  columns: string[];
  initialRows: SheetRow[];
  form?: any;
  projectOptions?: { value: string; label: string }[];
  peopleOptions?: { value: string; label: string }[];
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "เปิดแล้ว": { label: "เปิดแล้ว", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "จ่ายเงินแล้ว": { label: "จ่ายเงินแล้ว", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "เคลียร์บิลแล้ว": { label: "เคลียร์บิลแล้ว", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "ยกเลิก": { label: "ยกเลิก", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  // legacy fallback
  "รออนุมัติ": { label: "เปิดแล้ว", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "อนุมัติแล้ว": { label: "จ่ายเงินแล้ว", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

export function PettyCashDashboardClient({
  columns,
  initialRows,
  form,
  projectOptions = [],
  peopleOptions = [],
}: PettyCashDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const { filterRowsByYear } = useYearFilter();

  // สร้าง map: รหัสพนักงาน → ชื่อแสดงผล
  const peopleMap = useMemo(() => {
    return peopleOptions.reduce<Record<string, string>>((acc, opt) => {
      if (opt.value) acc[opt.value.trim()] = opt.label;
      return acc;
    }, {});
  }, [peopleOptions]);

  // ฟังก์ชันระบุชื่อผู้เบิก: ถ้าเก็บเป็น ID ให้แปลงเป็นชื่อ
  const resolveRequesterName = (raw: string) => {
    const trimmed = (raw || "").trim();
    return peopleMap[trimmed] || trimmed || "-";
  };

  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortDesc, setSortDesc] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    const handleDataUpdate = () => {
      router.refresh();
    };
    window.addEventListener("data-updated", handleDataUpdate);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdate);
    };
  }, [router]);

  // Year & Search Filtering
  const filteredRows = useMemo(() => {
    let list = filterRowsByYear(initialRows);

    if (selectedStatus !== "all") {
      list = list.filter((r) => String(r["สถานะ"] || "เปิดแล้ว") === selectedStatus);
    }

    if (selectedProject !== "all") {
      list = list.filter((r) => String(r["ID Project"] || "") === selectedProject);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((row) =>
        Object.values(row).some((val) => String(val || "").toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      const dateA = String(a["วันที่"] || a["ว/ด/ป"] || "");
      const dateB = String(b["วันที่"] || b["ว/ด/ป"] || "");
      const seqA = Number(String(a["id_petty_cash"] || a["id"] || "").replace(/\D/g, "")) || 0;
      const seqB = Number(String(b["id_petty_cash"] || b["id"] || "").replace(/\D/g, "")) || 0;
      if (dateA !== dateB) {
        return sortDesc ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
      }
      return sortDesc ? seqB - seqA : seqA - seqB;
    });
  }, [initialRows, searchTerm, selectedStatus, selectedProject, sortDesc, filterRowsByYear]);

  // KPI Calculations
  const totalAmount = useMemo(() => filteredRows.reduce((sum, r) => sum + toNumber(r["จำนวนเงิน"]), 0), [filteredRows]);
  const totalCleared = useMemo(() => filteredRows.reduce((sum, r) => sum + toNumber(r["ยอดเคลียร์แล้ว"]), 0), [filteredRows]);
  const totalRemaining = totalAmount - totalCleared;
  const pendingCount = useMemo(() => filteredRows.filter((r) => {
    const s = r["สถานะ"] || "เปิดแล้ว";
    return s === "เปิดแล้ว" || s === "รออนุมัติ"; // รองรับ legacy
  }).length, [filteredRows]);


  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleRows = filteredRows.slice(pageStart, pageStart + pageSize);

  const handleOpenCreateForm = () => {
    window.dispatchEvent(
      new CustomEvent("open-petty-cash-form")
    );
  };

  const handleEditRow = (row: SheetRow) => {
    const rowId = row["id_petty_cash"] || row["id"] || row["_sheetRow"];
    window.dispatchEvent(
      new CustomEvent("open-petty-cash-form", {
        detail: { row, sheetRow: rowId }
      })
    );
  };

  const handleDeleteRow = async (row: SheetRow) => {
    const rowId = row["id_petty_cash"] || row["id"] || row["_sheetRow"];
    if (!rowId || !confirm(`ต้องการลบรายการเปิดเงินสดย่อย "${rowId}" หรือไม่?`)) return;

    setDeletingId(String(rowId));
    try {
      const allPossibleIds = Array.from(new Set([
        rowId,
        row["id_petty_cash"],
        row["id"],
        row["_sheetRow"]
      ].filter(Boolean)));

      const res = await fetch(`/api/rows?tableName=${encodeURIComponent(TABLES.PETTY_CASH)}&id=${encodeURIComponent(String(rowId))}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: TABLES.PETTY_CASH, ids: allPossibleIds })
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("data-updated"));
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "ไม่สามารถลบรายการได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการลบ");
    } finally {
      setDeletingId(null);
    }
  };

  // Quick Clear State & Handlers
  const [clearingRow, setClearingRow] = useState<SheetRow | null>(null);
  const [clearMode, setClearMode] = useState<"full" | "custom">("full");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [clearingNote, setClearingNote] = useState<string>("");
  const [clearingSlipFile, setClearingSlipFile] = useState<File | null>(null);
  const [clearingSlipPreview, setClearingSlipPreview] = useState<string | null>(null);
  const [isSubmittingClear, setIsSubmittingClear] = useState<boolean>(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const handleOpenQuickClear = (row: SheetRow) => {
    setClearingRow(row);
    const amount = toNumber(row["จำนวนเงิน"]);
    const cleared = toNumber(row["ยอดเคลียร์แล้ว"]);
    const remaining = Math.max(0, amount - cleared);
    setClearMode(remaining > 0 ? "full" : "custom");
    setCustomAmount(remaining > 0 ? String(remaining) : "0");
    setClearingNote("");
    setClearingSlipFile(null);
    setClearingSlipPreview(null);
    setClearError(null);
  };

  const handleCloseQuickClear = () => {
    if (clearingSlipPreview && clearingSlipPreview.startsWith("blob:")) {
      URL.revokeObjectURL(clearingSlipPreview);
    }
    setClearingRow(null);
    setClearingSlipFile(null);
    setClearingSlipPreview(null);
    setClearError(null);
  };

  const handleSlipFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (clearingSlipPreview && clearingSlipPreview.startsWith("blob:")) {
        URL.revokeObjectURL(clearingSlipPreview);
      }
      setClearingSlipFile(file);
      setClearingSlipPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveSlipFile = () => {
    if (clearingSlipPreview && clearingSlipPreview.startsWith("blob:")) {
      URL.revokeObjectURL(clearingSlipPreview);
    }
    setClearingSlipFile(null);
    setClearingSlipPreview(null);
  };

  // Calculations for current clearing row
  const clearingTotalAmount = clearingRow ? toNumber(clearingRow["จำนวนเงิน"]) : 0;
  const clearingOldCleared = clearingRow ? toNumber(clearingRow["ยอดเคลียร์แล้ว"]) : 0;
  const clearingOldRemaining = Math.max(0, clearingTotalAmount - clearingOldCleared);

  const clearingAddedAmount = clearMode === "full"
    ? clearingOldRemaining
    : Math.max(0, Number(customAmount) || 0);

  const clearingNewTotalCleared = clearMode === "full"
    ? clearingTotalAmount
    : Math.min(clearingTotalAmount, clearingOldCleared + clearingAddedAmount);

  const clearingNewRemaining = Math.max(0, clearingTotalAmount - clearingNewTotalCleared);
  const clearingNewStatus = clearingNewTotalCleared >= clearingTotalAmount ? "เคลียร์บิลแล้ว" : "จ่ายเงินแล้ว";

  const handleSubmitClear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearingRow) return;
    const rowId = clearingRow["id_petty_cash"] || clearingRow["id"] || clearingRow["_sheetRow"];
    if (!rowId) {
      setClearError("ไม่พบรหัสอ้างอิงของรายการเงินสดย่อย");
      return;
    }

    setIsSubmittingClear(true);
    setClearError(null);

    try {
      let finalPurpose = String(clearingRow["วัตถุประสงค์"] || "").trim();
      if (clearingNote.trim()) {
        finalPurpose = finalPurpose ? `${finalPurpose} [เคลียร์: ${clearingNote.trim()}]` : `[เคลียร์: ${clearingNote.trim()}]`;
      }

      if (clearingSlipFile) {
        const formData = new FormData();
        formData.append("tableName", TABLES.PETTY_CASH);
        formData.append("id", String(rowId));
        formData.append("ยอดเคลียร์แล้ว", String(clearingNewTotalCleared));
        formData.append("ยอดคงเหลือ", String(clearingNewRemaining));
        formData.append("สถานะ", clearingNewStatus);
        if (clearingNote.trim()) {
          formData.append("วัตถุประสงค์", finalPurpose);
        }
        formData.append("สลิป", clearingSlipFile);

        const res = await fetch("/api/rows", {
          method: "PATCH",
          body: formData,
        });
        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(resData.error || "ไม่สามารถบันทึกข้อมูลได้");
        }
      } else {
        const res = await fetch("/api/rows", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: TABLES.PETTY_CASH,
            id: String(rowId),
            values: {
              "ยอดเคลียร์แล้ว": String(clearingNewTotalCleared),
              "ยอดคงเหลือ": String(clearingNewRemaining),
              "สถานะ": clearingNewStatus,
              ...(clearingNote.trim() ? { "วัตถุประสงค์": finalPurpose } : {})
            }
          })
        });
        const resData = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(resData.error || "ไม่สามารถบันทึกข้อมูลได้");
        }
      }

      window.dispatchEvent(new CustomEvent("data-updated"));
      router.refresh();
      handleCloseQuickClear();
    } catch (err: any) {
      setClearError(err.message || "เกิดข้อผิดพลาดในการบันทึกเคลียร์บิล");
    } finally {
      setIsSubmittingClear(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2.5 p-2.5 sm:p-3.5 max-w-[1600px] mx-auto font-sans text-xs text-slate-800">
      {/* HEADER TITLE */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0b3531] flex items-center justify-center text-[#d4f54e] shadow-2xs shrink-0">
            <Coins size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-[#0b3531] tracking-tight leading-none">
                เปิดเงินสดย่อย (เบิกเงินล่วงหน้า)
              </h1>
              <span className="px-1.5 py-0.5 rounded text-2xs bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                {filteredRows.length} รายการ
              </span>
            </div>
            <p className="text-2xs text-slate-500 mt-0.5 leading-tight">
              บันทึกและติดตามการเบิกเงินทดรองจ่าย เงินสดย่อยหน้างาน พร้อมควบคุมยอดเคลียร์บิล
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateForm}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0b3531] hover:bg-[#144d47] text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer active:scale-98"
        >
          <Plus size={14} className="text-[#d4f54e]" />
          <span>เปิดเงินสดย่อย</span>
        </button>
      </div>

      {/* KPI SUMMARY CARDS (Compact 2-tier design) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Card 1: รายการทั้งหมด */}
        <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-2xs font-medium">รายการทั้งหมด</span>
            <span className="p-1 rounded bg-slate-50 text-slate-500 border border-slate-100">
              <Receipt size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-slate-900 font-mono">{filteredRows.length}</span>
              <span className="text-2xs text-slate-400">รายการ</span>
            </div>
            {pendingCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded text-2xs font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
                รออนุมัติ: {pendingCount}
              </span>
            ) : (
              <span className="text-2xs text-slate-400">ครบแล้ว</span>
            )}
          </div>
        </div>

        {/* Card 2: ยอดเบิกล่วงหน้ารวม */}
        <div className="bg-white rounded-lg px-3 py-2 border border-blue-200/70 bg-blue-50/10 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-2xs font-medium">ยอดเบิกล่วงหน้ารวม</span>
            <span className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
              <HandCoins size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-base font-bold text-slate-900 font-mono">{money(totalAmount)}</span>
            <span className="text-2xs text-slate-400">วงเงินขอเบิก</span>
          </div>
        </div>

        {/* Card 3: เคลียร์บิลแล้ว */}
        <div className="bg-white rounded-lg px-3 py-2 border border-emerald-200/70 bg-emerald-50/10 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-2xs font-medium">เคลียร์บิลแล้ว</span>
            <span className="p-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileCheck2 size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className="text-base font-bold text-emerald-700 font-mono">{money(totalCleared)}</span>
            <span className="px-1.5 py-0.2 rounded text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              {totalAmount > 0 ? `${((totalCleared / totalAmount) * 100).toFixed(0)}%` : "0%"}
            </span>
          </div>
        </div>

        {/* Card 4: คงเหลือค้างเคลียร์ */}
        <div className={`rounded-lg px-3 py-2 border shadow-2xs flex flex-col justify-between ${
          totalRemaining > 0 ? "bg-amber-50/20 border-amber-200" : "bg-white border-slate-200"
        }`}>
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-2xs font-medium">คงเหลือค้างเคลียร์</span>
            <span className="p-1 rounded bg-amber-50 text-amber-600 border border-amber-100">
              <Wallet size={12} />
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <span className={`text-base font-bold font-mono ${totalRemaining > 0 ? "text-amber-700" : "text-slate-900"}`}>
              {money(totalRemaining)}
            </span>
            <span className="text-2xs text-slate-400">ค้างส่งบิล</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหารหัสสดย่อย, ผู้เบิก, โครงการ, วัตถุประสงค์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:bg-white focus:border-[#0b3531] transition placeholder:text-slate-400"
          />
          {searchTerm && (
            <X
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600"
              onClick={() => setSearchTerm("")}
            />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Status filter chips */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-2xs">
            <button
              type="button"
              onClick={() => setSelectedStatus("all")}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                selectedStatus === "all"
                  ? "bg-[#0b3531] text-[#d4f54e] shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด
            </button>
            {Object.keys(STATUS_CONFIG).filter(st => !["รออนุมัติ", "อนุมัติแล้ว"].includes(st)).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-2 py-1 rounded-md font-medium transition cursor-pointer whitespace-nowrap ${
                  selectedStatus === st
                    ? "bg-[#0b3531] text-[#d4f54e] shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Project dropdown filter */}
          {projectOptions.length > 0 && (
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md text-2xs py-1 px-2 text-slate-700 focus:outline-none focus:bg-white transition cursor-pointer"
            >
              <option value="all">ทุกโครงการ</option>
              {projectOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          )}

          {/* Sort toggle button */}
          <button
            type="button"
            onClick={() => setSortDesc((prev) => !prev)}
            className="p-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center justify-center cursor-pointer transition"
            title={sortDesc ? "เรียงใหม่สุดไปเก่าสุด" : "เรียงเก่าสุดไปใหม่สุด"}
          >
            {sortDesc ? <ArrowDownWideNarrow size={13} /> : <ArrowUpWideNarrow size={13} />}
          </button>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-2xs">
                <th className="py-2 px-2.5 whitespace-nowrap">รหัสสดย่อย</th>
                <th className="py-2 px-2.5 whitespace-nowrap">วันที่</th>
                <th className="py-2 px-2.5 whitespace-nowrap">ผู้ขอเบิก</th>
                <th className="py-2 px-2.5 whitespace-nowrap">โครงการ</th>
                <th className="py-2 px-2.5">วัตถุประสงค์ / รายละเอียด</th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">ยอดเบิกล่วงหน้า</th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">เคลียร์แล้ว</th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">คงเหลือ</th>
                <th className="py-2 px-2.5 whitespace-nowrap">กำหนดเคลียร์</th>
                <th className="py-2 px-2.5 text-center whitespace-nowrap">สถานะ</th>
                <th className="py-2 px-2.5 text-center whitespace-nowrap">สลิป</th>
                <th className="py-2 px-2.5 text-center whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Coins size={28} className="text-slate-300" />
                      <span>ยังไม่มีรายการเปิดเงินสดย่อย</span>
                      <button
                        type="button"
                        onClick={handleOpenCreateForm}
                        className="mt-0.5 text-xs text-[#0b3531] font-semibold hover:underline cursor-pointer"
                      >
                        + คลิกที่นี่เพื่อเปิดเงินสดย่อยรายการแรก
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, idx) => {
                  const id = row["id_petty_cash"] || row["id"] || `PC-${idx + 1}`;
                  const amount = toNumber(row["จำนวนเงิน"]);
                  const cleared = toNumber(row["ยอดเคลียร์แล้ว"]);
                  const remaining = toNumber(row["ยอดคงเหลือ"] || (amount - cleared));
                  const status = String(row["สถานะ"] || "เปิดแล้ว");
                  const badge = STATUS_CONFIG[status] || STATUS_CONFIG["เปิดแล้ว"];
                  const slipUrl = row["สลิป"] || row["image_url"] || "";

                  return (
                    <tr key={`row-${pageStart + idx}`} className="hover:bg-slate-50/70 transition">
                      <td className="py-2 px-2.5 font-semibold text-slate-900 whitespace-nowrap">
                        {String(id)}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">
                        {formatDateDisplay(row["วันที่"] || row["ว/ด/ป"])}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-slate-800 whitespace-nowrap">
                        {resolveRequesterName(String(row["ผู้เบิก"] || ""))}
                      </td>
                      <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">
                        <div className="truncate max-w-[130px]" title={String(row["ชื่อ Project"] || row["ID Project"] || "-")}>
                          {String(row["ชื่อ Project"] || row["ID Project"] || "-")}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-slate-600">
                        <div className="truncate max-w-[180px]" title={String(row["วัตถุประสงค์"] || "-")}>
                          {String(row["วัตถุประสงค์"] || "-")}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                        {money(amount)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-medium text-emerald-700 whitespace-nowrap font-mono">
                        {money(cleared)}
                      </td>
                      <td className={`py-2 px-2.5 text-right font-bold whitespace-nowrap font-mono ${remaining > 0 ? "text-amber-700" : "text-slate-700"}`}>
                        {remaining > 0 && status !== "ยกเลิก" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickClear(row)}
                            className="hover:underline hover:text-emerald-700 cursor-pointer inline-flex items-center gap-1 group"
                            title="คลิกเพื่อบันทึกเคลียร์บิลยอดคงเหลือนี้"
                          >
                            <span>{money(remaining)}</span>
                            <span className="opacity-0 group-hover:opacity-100 text-2xs text-emerald-600 transition">เคลียร์</span>
                          </button>
                        ) : (
                          money(remaining)
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-slate-500 whitespace-nowrap">
                        {row["กำหนดเคลียร์"] ? formatDateDisplay(row["กำหนดเคลียร์"]) : "-"}
                      </td>
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-2xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        {slipUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(String(slipUrl))}
                            className="p-1 rounded-md text-sky-600 hover:bg-sky-50 border border-sky-200 transition cursor-pointer"
                            title="ดูรูปสลิป"
                          >
                            <ImageIcon size={14} />
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {status !== "ยกเลิก" && (
                            <button
                              type="button"
                              onClick={() => handleOpenQuickClear(row)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold rounded-md border transition cursor-pointer active:scale-95 shadow-2xs ${
                                status === "เคลียร์บิลแล้ว"
                                  ? "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
                              }`}
                              title={status === "เคลียร์บิลแล้ว" ? "ปรับยอดเคลียร์" : "บันทึกเคลียร์บิลด่วน"}
                            >
                              <FileCheck2 size={12} className={status === "เคลียร์บิลแล้ว" ? "text-slate-400" : "text-emerald-600"} />
                              <span>{status === "เคลียร์บิลแล้ว" ? "ปรับยอด" : "เคลียร์บิล"}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditRow(row)}
                            className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="แก้ไข"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row)}
                            disabled={deletingId === String(id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer disabled:opacity-50"
                            title="ลบ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              แสดง {visibleRows.length > 0 ? pageStart + 1 : 0} ถึง {pageStart + visibleRows.length} จากทั้งหมด {filteredRows.length} รายการ
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ก่อนหน้า
              </button>
              <span className="px-2 py-1 font-medium text-slate-700">
                หน้า {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL IMAGE PREVIEW */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-white rounded-xl overflow-hidden p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/75 transition cursor-pointer"
            >
              <X size={16} />
            </button>
            <img src={previewImage} alt="สลิปเปิดเงินสดย่อย" className="max-h-[80vh] w-auto object-contain rounded-lg" />
          </div>
        </div>
      )}

      {/* QUICK CLEAR MODAL */}
      {clearingRow && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={handleCloseQuickClear}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0b3531] text-white border-b border-[#144d47]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#d4f54e]/20 flex items-center justify-center text-[#d4f54e]">
                  <FileCheck2 size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold leading-tight">บันทึกเคลียร์บิลเงินสดย่อย</h2>
                  <p className="text-2xs text-slate-300">
                    รหัส: <span className="font-mono text-[#d4f54e] font-semibold">{String(clearingRow["id_petty_cash"] || clearingRow["id"] || "")}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseQuickClear}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitClear} className="p-4 flex flex-col gap-3.5 text-xs text-slate-700">
              {clearError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-500" />
                  <span>{clearError}</span>
                </div>
              )}

              {/* Row Summary Info */}
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 grid grid-cols-2 gap-2 text-2xs">
                <div>
                  <span className="text-slate-400 block">ผู้ขอเบิก:</span>
                  <span className="font-semibold text-slate-800">
                    {resolveRequesterName(String(clearingRow["ผู้เบิก"] || ""))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">โครงการ:</span>
                  <span className="font-semibold text-slate-800 truncate block" title={String(clearingRow["ชื่อ Project"] || clearingRow["ID Project"] || "-")}>
                    {String(clearingRow["ชื่อ Project"] || clearingRow["ID Project"] || "-")}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">วัตถุประสงค์:</span>
                  <span className="text-slate-700">{String(clearingRow["วัตถุประสงค์"] || "-")}</span>
                </div>
              </div>

              {/* Balance Summary 3-col */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-100/70 border border-slate-200 rounded-lg p-2 text-center">
                  <span className="text-2xs text-slate-500 block">ยอดเบิกทั้งหมด</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">{money(clearingTotalAmount)} ฿</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 text-center">
                  <span className="text-2xs text-emerald-700 block">เคลียร์แล้วเดิม</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-emerald-700">{money(clearingOldCleared)} ฿</span>
                </div>
                <div className={`border rounded-lg p-2 text-center ${clearingOldRemaining > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-100 border-slate-200"}`}>
                  <span className={`text-2xs block ${clearingOldRemaining > 0 ? "text-amber-700 font-medium" : "text-slate-500"}`}>
                    คงเหลือที่ต้องเคลียร์
                  </span>
                  <span className={`font-mono font-bold text-xs sm:text-sm ${clearingOldRemaining > 0 ? "text-amber-700" : "text-slate-700"}`}>
                    {money(clearingOldRemaining)} ฿
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-800 text-2xs uppercase tracking-wider">
                  เลือกรูปแบบการเคลียร์บิล
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClearMode("full");
                      setCustomAmount(String(clearingOldRemaining));
                    }}
                    className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                      clearMode === "full"
                        ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">⚡ เคลียร์เต็มจำนวน</span>
                      {clearMode === "full" && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <span className="text-2xs text-slate-500">
                      เคลียร์ส่วนที่เหลือทั้งหมด ({money(clearingOldRemaining)} ฿) และปิดสถานะ
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setClearMode("custom");
                    }}
                    className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition cursor-pointer ${
                      clearMode === "custom"
                        ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">ระบุยอดเคลียร์ครั้งนี้</span>
                      {clearMode === "custom" && <Check size={14} className="text-emerald-600" />}
                    </div>
                    <span className="text-2xs text-slate-500">
                      เคลียร์บางส่วน หรือระบุยอดเองตามบิลจริง
                    </span>
                  </button>
                </div>
              </div>

              {/* Custom Amount Input when in "custom" mode */}
              {clearMode === "custom" && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-1.5 animate-in fade-in duration-100">
                  <label className="text-2xs font-semibold text-slate-700">
                    ยอดเงินที่นำมาเคลียร์ครั้งนี้ (บาท):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={clearingOldRemaining}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 pr-8 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">฿</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[500, 1000, 2000].map((amt) => (
                      amt <= clearingOldRemaining && (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCustomAmount(String(amt))}
                          className="px-2 py-0.5 rounded text-2xs bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                        >
                          +{money(amt)}
                        </button>
                      )
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomAmount(String(clearingOldRemaining))}
                      className="px-2 py-0.5 rounded text-2xs bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition cursor-pointer font-medium"
                    >
                      เต็มยอด ({money(clearingOldRemaining)})
                    </button>
                  </div>
                </div>
              )}

              {/* Outcome Preview Banner */}
              <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between text-2xs">
                <div className="flex flex-col">
                  <span className="text-slate-500">ผลลัพธ์หลังบันทึก:</span>
                  <span className="font-semibold text-slate-800">
                    ยอดเคลียร์สะสม: <strong className="text-emerald-700 font-mono">{money(clearingNewTotalCleared)} ฿</strong> | คงเหลือ: <strong className="text-slate-800 font-mono">{money(clearingNewRemaining)} ฿</strong>
                  </span>
                </div>
                <div className="shrink-0">
                  {clearingNewTotalCleared >= clearingTotalAmount ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Sparkles size={11} className="text-emerald-600" />
                      เคลียร์บิลแล้ว
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      จ่ายเงินแล้ว (เคลียร์บางส่วน)
                    </span>
                  )}
                </div>
              </div>

              {/* Slip / Receipt Upload */}
              <div className="flex flex-col gap-1">
                <label className="text-2xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>แนบรูปสลิป / บิลใบเสร็จ (ไม่บังคับ)</span>
                  {clearingSlipPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveSlipFile}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      ลบรูป
                    </button>
                  )}
                </label>
                {clearingSlipPreview ? (
                  <div className="relative w-full h-24 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                    <img src={clearingSlipPreview} alt="สลิปเคลียร์บิล" className="h-full w-auto object-contain" />
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/80 cursor-pointer text-slate-500 transition">
                    <Upload size={14} className="text-slate-400" />
                    <span className="text-2xs">คลิกเพื่อแนบรูปใบเสร็จหรือสลิปเคลียร์</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleSlipFileSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Note / Remarks */}
              <div className="flex flex-col gap-1">
                <label className="text-2xs font-semibold text-slate-700">
                  หมายเหตุ / เลขที่บิล (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={clearingNote}
                  onChange={(e) => setClearingNote(e.target.value)}
                  placeholder="เช่น ซื้อของไทวัสดุ คืนเงินทอน 200 บาท"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseQuickClear}
                  disabled={isSubmittingClear}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClear}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingClear ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>บันทึกเคลียร์บิล</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      <FormModal
        tableName={TABLES.PETTY_CASH}
        form={form}
        title="เปิดเงินสดย่อย (เบิกเงินล่วงหน้า)"
        buttonLabel="เปิดเงินสดย่อย"
        submitPath="/api/rows"
        openEventName="open-petty-cash-form"
        hideLauncher
      />
    </div>
  );
}
