"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Coins,
  DollarSign,
  FileCheck2,
  Filter,
  HandCoins,
  History,
  Image as ImageIcon,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
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
  "รออนุมัติ": { label: "รออนุมัติ", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "อนุมัติแล้ว": { label: "อนุมัติแล้ว", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "จ่ายเงินแล้ว": { label: "จ่ายเงินแล้ว", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "เคลียร์บิลแล้ว": { label: "เคลียร์บิลแล้ว", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "ยกเลิก": { label: "ยกเลิก", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
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
      list = list.filter((r) => String(r["สถานะ"] || "รออนุมัติ") === selectedStatus);
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
  const pendingCount = useMemo(() => filteredRows.filter((r) => (r["สถานะ"] || "รออนุมัติ") === "รออนุมัติ").length, [filteredRows]);

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
    const rowId = row["id_petty_cash"] || row["id"];
    if (!rowId || !confirm(`ต้องการลบรายการเปิดเงินสดย่อย "${rowId}" หรือไม่?`)) return;

    setDeletingId(String(rowId));
    try {
      const res = await fetch(`/api/rows?tableName=${encodeURIComponent(TABLES.PETTY_CASH)}&id=${encodeURIComponent(rowId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: TABLES.PETTY_CASH, ids: [rowId] })
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("data-updated"));
        router.refresh();
      } else {
        alert("ไม่สามารถลบรายการได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการลบ");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 p-3 sm:p-5 max-w-[1600px] mx-auto font-sans text-sm text-slate-800">
      {/* HEADER TITLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0b3531] flex items-center gap-2">
            <Coins className="text-[#0b3531]" size={26} />
            <span>เปิดเงินสดย่อย (เบิกเงินล่วงหน้า)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกและติดตามการเบิกเงินทดรองจ่าย เงินสดย่อยหน้างาน พร้อมระบบควบคุมยอดเคลียร์บิล
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateForm}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0b3531] hover:bg-[#144d47] text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer active:scale-98"
        >
          <Plus size={16} className="text-[#d4f54e]" />
          <span>เปิดเงินสดย่อย</span>
        </button>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">รายการทั้งหมด</span>
            <span className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
              <Receipt size={14} />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {filteredRows.length} <span className="text-xs font-normal text-slate-500">รายการ</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5 font-medium">
            รออนุมัติ: {pendingCount} รายการ
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">ยอดเบิกล่วงหน้ารวม</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <HandCoins size={14} />
            </span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {money(totalAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            วงเงินขอเบิกทั้งหมด
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">เคลียร์บิลแล้ว</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileCheck2 size={14} />
            </span>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {money(totalCleared)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
            {totalAmount > 0 ? `${((totalCleared / totalAmount) * 100).toFixed(1)}% เคลียร์แล้ว` : "0%"}
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">คงเหลือค้างเคลียร์</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Wallet size={14} />
            </span>
          </div>
          <div className={`text-xl font-bold mt-1 ${totalRemaining > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {money(totalRemaining)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            ยอดเงินที่ยังไม่นำบิลมาส่ง
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Search input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหารหัสสดย่อย, ผู้เบิก, โครงการ, วัตถุประสงค์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-7 py-2 rounded-lg border border-slate-200 focus:outline-none focus:bg-white focus:border-[#0b3531] transition placeholder:text-slate-400"
          />
          {searchTerm && (
            <X
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600"
              onClick={() => setSearchTerm("")}
            />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter chips */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedStatus("all")}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                selectedStatus === "all"
                  ? "bg-[#0b3531] text-[#d4f54e] shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด
            </button>
            {Object.keys(STATUS_CONFIG).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                  selectedStatus === st
                    ? "bg-[#0b3531] text-[#d4f54e] shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort toggle button */}
          <button
            type="button"
            onClick={() => setSortDesc((prev) => !prev)}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 flex items-center justify-center cursor-pointer transition"
            title={sortDesc ? "เรียงใหม่สุดไปเก่าสุด" : "เรียงเก่าสุดไปใหม่สุด"}
          >
            {sortDesc ? <ArrowDownWideNarrow size={14} /> : <ArrowUpWideNarrow size={14} />}
          </button>
        </div>
      </div>

      {/* TABLE CONTAINER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3 whitespace-nowrap">รหัสสดย่อย</th>
                <th className="py-2.5 px-3 whitespace-nowrap">วันที่</th>
                <th className="py-2.5 px-3 whitespace-nowrap">ผู้ขอเบิก</th>
                <th className="py-2.5 px-3 whitespace-nowrap">โครงการ</th>
                <th className="py-2.5 px-3">วัตถุประสงค์ / รายละเอียด</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">ยอดเบิกล่วงหน้า</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">เคลียร์แล้ว</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">คงเหลือ</th>
                <th className="py-2.5 px-3 whitespace-nowrap">กำหนดเคลียร์</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">สถานะ</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">สลิป</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Coins size={36} className="text-slate-300" />
                      <span>ยังไม่มีรายการเปิดเงินสดย่อย</span>
                      <button
                        type="button"
                        onClick={handleOpenCreateForm}
                        className="mt-1 text-xs text-[#0b3531] font-semibold hover:underline cursor-pointer"
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
                  const status = String(row["สถานะ"] || "รออนุมัติ");
                  const badge = STATUS_CONFIG[status] || STATUS_CONFIG["รออนุมัติ"];
                  const slipUrl = row["สลิป"] || row["image_url"] || "";

                  return (
                    <tr key={String(id)} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {String(id)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {formatDateDisplay(row["วันที่"] || row["ว/ด/ป"])}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {resolveRequesterName(String(row["ผู้เบิก"] || ""))}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        <div className="truncate max-w-[140px]" title={String(row["ชื่อ Project"] || row["ID Project"] || "-")}>
                          {String(row["ชื่อ Project"] || row["ID Project"] || "-")}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div className="truncate max-w-[200px]" title={String(row["วัตถุประสงค์"] || "-")}>
                          {String(row["วัตถุประสงค์"] || "-")}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {money(amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-700 whitespace-nowrap">
                        {money(cleared)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${remaining > 0 ? "text-amber-700" : "text-slate-700"}`}>
                        {money(remaining)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {row["กำหนดเคลียร์"] ? formatDateDisplay(row["กำหนดเคลียร์"]) : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
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
