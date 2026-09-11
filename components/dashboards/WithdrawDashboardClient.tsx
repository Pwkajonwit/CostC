"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Banknote, Check, ChevronLeft, ChevronRight, Download, Filter, List, LoaderCircle, RotateCw, Search, Send, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { showToast } from "@/components/shared/ToastProvider";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import { formatDateDisplay, normalizeDateToIso, parseDateStrict } from "@/lib/utils/dates";
import { useRealtimeSync } from "@/lib/use-realtime-sync";
import { exportToCsv } from "@/lib/utils/export-utils";

export type WithdrawFilters = {
  requester?: string;
  date?: string;
  bill?: string;
  search?: string;
};

type WithdrawDashboardClientProps = {
  rows: SheetRow[];
  peopleRows: SheetRow[];
  usersList?: any[];
  initialFilters?: WithdrawFilters;
  isAdmin?: boolean;
};

const ALL_COLUMNS = ["ลำดับ", "ID Project", "ชื่อ Project", "ร้าน/บุคคล", "สินค้า/ทำงาน", "บิล", "ประเภท", "ยอดเงิน", "ยอดโอน", "ผู้เบิก", "ว/ด/ป", "จัดการ"];
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

export function WithdrawDashboardClient({ rows, peopleRows, usersList = [], initialFilters = {}, isAdmin = false }: WithdrawDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";

  const [effectiveIsAdmin, setEffectiveIsAdmin] = useState(isAdmin);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/auth_role=([^;]+)/);
      const role = match ? decodeURIComponent(match[1]) : "";
      if (role === "Admin" || role === "Owner" || isAdmin) {
        setEffectiveIsAdmin(true);
      }
    }
  }, [isAdmin]);

  const columns = useMemo(() => ALL_COLUMNS, [effectiveIsAdmin]);
  const [filters, setFilters] = useState(() => normalizeFilters(initialFilters));
  const [searchInput, setSearchInput] = useState(() => initialFilters.search || "");

  useEffect(() => {
    if (urlSearch !== (filters.search || "")) {
      setSearchInput(urlSearch);
      setFilters(prev => ({ ...prev, search: urlSearch }));
    }
  }, [urlSearch]);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => (prev.search === searchInput ? prev : { ...prev, search: searchInput }));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({});
  const [approvingRow, setApprovingRow] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isBatchApproving, setIsBatchApproving] = useState(false);
  const [resendMode, setResendMode] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    setFilters(normalizeFilters(initialFilters));
  }, [initialFilters.requester, initialFilters.date, initialFilters.bill, initialFilters.search]);

  // Client-side fallback to match logged-in requester for non-admin users if not already filtered
  useEffect(() => {
    if (!effectiveIsAdmin && !isAdmin && typeof document !== "undefined" && !initialFilters.requester) {
      const empMatch = document.cookie.match(/auth_employee_id=([^;]+)/);
      const nameMatch = document.cookie.match(/auth_name=([^;]+)/);
      const empId = empMatch ? decodeURIComponent(empMatch[1]) : "";
      const name = nameMatch ? decodeURIComponent(nameMatch[1]) : "";
      if (empId || name) {
        const matched = findMatchingRequesterKey(peopleRows, empId, name, usersList);
        if (matched) {
          setFilters(prev => (prev.requester ? prev : { ...prev, requester: matched }));
        }
      }
    }
  }, [effectiveIsAdmin, isAdmin, peopleRows, usersList, initialFilters.requester]);

  // High-performance debounced live sync from Supabase PostgreSQL + Local Form Events + Auto Polling
  useRealtimeSync({
    channelName: "withdraw_live_sync",
    tables: ["bills"],
    onSync: () => router.refresh(),
    debounceMs: 700,
    pollingIntervalMs: 8_000,
  });

  const requesterNames = useMemo(() => requesterNameMap(peopleRows), [peopleRows]);

  const displayRows = useMemo(() => {
    const currentRows = rows.map(row => {
      const rowKey = Number(row.id ?? row["ลำดับ"] ?? row._sheetRow);
      const override = statusOverrides[rowKey];
      return override ? { ...row, "สถานะ": override } : row;
    });
    // แสดงบิลสถานะ "รอตั้งเบิก", "ตั้งเบิก" และ "อนุมัติ" (ยังไม่เบิก/ปิดงาน)
    return filterWithdrawRows(currentRows, filters, requesterNames)
      .filter(row => {
        const st = normalizedStatus(row["สถานะ"]);
        return st === "รอตั้งเบิก" || st === "ตั้งเบิก" || st === "รออนุมัติ" || st === "อนุมัติ";
      })
      .sort((a, b) => Number(b.id ?? b["ลำดับ"] ?? b._sheetRow ?? 0) - Number(a.id ?? a["ลำดับ"] ?? a._sheetRow ?? 0));
  }, [rows, filters, statusOverrides, requesterNames]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleRows = displayRows.slice(pageStart, pageStart + pageSize);
  const visibleStart = visibleRows.length ? pageStart + 1 : 0;
  const visibleEnd = pageStart + visibleRows.length;
  const amount = displayRows.reduce((sum, row) => sum + toNumber(row["ยอดเงิน"]), 0);
  // ยอดโอน = รวมเฉพาะแถวที่อนุมัติแล้ว
  const transfer = displayRows.reduce((sum, row) => sum + (normalizedStatus(row["สถานะ"]) === "อนุมัติ" ? toNumber(row["ยอดโอน"]) : 0), 0);

  useEffect(() => {
    setPage(1);
  }, [filters.requester, filters.date, filters.bill, filters.search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function updateFilter(name: keyof WithdrawFilters, value: string) {
    if (name === "search") {
      setSearchInput(value);
    } else {
      setFilters(current => ({ ...current, [name]: value }));
    }
  }

  async function approveRow(row: SheetRow) {
    const sheetRow = Number(row.id ?? row["ลำดับ"] ?? row._sheetRow);
    if (!Number.isInteger(sheetRow) || sheetRow < 1) return;

    // Guard: Prevent duplicate submission if already requested/approved
    const currentSt = normalizedStatus(row["สถานะ"]);
    if (currentSt === "ตั้งเบิก" || currentSt === "อนุมัติ" || currentSt === "เบิกแล้ว") {
      setActionError("⚠️ รายการนี้ได้รับการตั้งเบิกหรืออนุมัติเรียบร้อยแล้ว ไม่สามารถสั่งตั้งเบิกซ้ำได้");
      return;
    }

    const nextStatus = "ตั้งเบิก";
    setApprovingRow(sheetRow);
    setActionError("");

    // ⚡ Optimistic UI Update: Update status immediately (< 20ms)
    setStatusOverrides(current => ({ ...current, [sheetRow]: nextStatus }));

    try {
      const response = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: "Data", id: sheetRow, sheetRow, values: { "สถานะ": nextStatus } })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "อัปเดตไม่สำเร็จ");

      const updatedRow = { ...row, "สถานะ": nextStatus };

      // Automatically send LINE Flex message to the Requester in background
      fetch("/api/line/notify-withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: updatedRow, targetRole: "requester" })
      }).catch(err => console.warn("Failed sending LINE withdraw notification:", err));

      router.refresh();
    } catch (error) {
      // 🔄 Rollback optimistic change on network/API failure
      setStatusOverrides(current => {
        const rollback = { ...current };
        delete rollback[sheetRow];
        return rollback;
      });
      setActionError(error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setApprovingRow(null);
    }
  }

  async function approveSelected(targetStatus: "ตั้งเบิก" | "อนุมัติ" = "ตั้งเบิก") {
    if (selectedRows.size === 0) return;
    setIsBatchApproving(true);
    setActionError("");

    // Filter out rows that are already in target or finished status
    const validSheetRows = Array.from(selectedRows).filter(sheetRow => {
      const targetRow = rows.find(r => Number(r.id ?? r["ลำดับ"] ?? r._sheetRow) === sheetRow);
      if (!targetRow) return false;
      const currentSt = normalizedStatus(targetRow["สถานะ"]);
      // If approving or requesting withdraw, skip rows that are ALREADY approved or paid/closed
      if (targetStatus === "อนุมัติ" && (currentSt === "อนุมัติ" || currentSt === "เบิกแล้ว")) return false;
      if (targetStatus === "ตั้งเบิก" && (currentSt === "ตั้งเบิก" || currentSt === "อนุมัติ" || currentSt === "เบิกแล้ว")) return false;
      return true;
    });

    if (validSheetRows.length === 0) {
      setActionError("⚠️ รายการที่เลือกอยู่ในสถานะดังกล่าวแล้ว หรือปิดงานเรียบร้อยแล้ว (ไม่สามารถสั่งซ้ำได้)");
      setIsBatchApproving(false);
      return;
    }

    // ⚡ Optimistic UI Update: Apply target status to all valid selected rows immediately
    setStatusOverrides(current => {
      const next = { ...current };
      validSheetRows.forEach(sheetRow => {
        next[sheetRow] = targetStatus;
      });
      return next;
    });

    try {
      const patches = validSheetRows.map(sheetRow => ({ id: sheetRow, sheetRow, values: { "สถานะ": targetStatus } }));
      const res = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: "Data", patches })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "อัปเดตไม่สำเร็จ");
      }

      const updatedRowsList: SheetRow[] = [];
      validSheetRows.forEach(sheetRow => {
        const targetRow = rows.find(r => Number(r.id ?? r["ลำดับ"] ?? r._sheetRow) === sheetRow);
        if (targetRow) {
          const updatedRow = { ...targetRow, "สถานะ": targetStatus };
          updatedRowsList.push(updatedRow);
        }
      });

      if (updatedRowsList.length > 0) {
        const targetRole = targetStatus === "อนุมัติ" ? "approver" : "requester";
        fetch("/api/line/notify-withdraw-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: updatedRowsList, targetRole })
        }).catch(err => console.warn("Failed sending LINE withdraw notification:", err));
      }

      setSelectedRows(new Set());
      router.refresh();
    } catch (error) {
      // 🔄 Rollback optimistic change on failure
      setStatusOverrides(current => {
        const rollback = { ...current };
        validSheetRows.forEach(sheetRow => {
          delete rollback[sheetRow];
        });
        return rollback;
      });
      setActionError(error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setIsBatchApproving(false);
    }
  }

  async function handleResendSelected() {
    if (selectedRows.size === 0) return;
    setIsResending(true);
    setActionError("");

    try {
      const selectedList = rows.filter(r => selectedRows.has(Number(r.id ?? r["ลำดับ"] ?? r._sheetRow)));
      if (selectedList.length === 0) {
        setActionError("ไม่พบรายการที่เลือกสำหรับส่งซ้ำ");
        setIsResending(false);
        return;
      }

      const res = await fetch("/api/line/notify-withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: selectedList, targetRole: "requester" })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "ส่งข้อความไม่สำเร็จ");
      }

      showToast("success", `ส่งข้อความแจ้งเตือนซ้ำเรียบร้อยแล้ว (${selectedList.length} รายการ)`);
      setSelectedRows(new Set());
      setResendMode(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งข้อความซ้ำ");
    } finally {
      setIsResending(false);
    }
  }

  function handleExportCsv() {
    if (!displayRows.length) return;
    const filename = `รายการขอเบิกเงิน_${new Date().toISOString().slice(0, 10)}`;
    const headers = [
      "ลำดับ",
      "ว/ด/ป",
      "ID Project",
      "ชื่อ Project",
      "ร้าน/บุคคล",
      "สินค้า/ทำงาน",
      "บิล",
      "ประเภท",
      "สถานะ",
      "ยอดเงิน",
      "ยอดโอน",
      "ผู้เบิก"
    ];
    const data = displayRows.map((r, idx) => [
      r["ลำดับ"] || idx + 1,
      r["ว/ด/ป"] || "",
      r["ID Project"] || "",
      r["ชื่อ Project"] || "",
      r["ร้าน/บุคคล"] || "",
      r["สินค้า/ทำงาน"] || r["รายการ"] || "",
      r["บิล"] || "",
      r["ประเภท"] || "",
      r["สถานะ"] || "",
      toNumber(r["ยอดเงิน"]),
      toNumber(r["ยอดโอน"]),
      r["ผู้เบิก"] || ""
    ]);
    exportToCsv(filename, headers, data);
    showToast("success", `ส่งออกไฟล์ Excel (${displayRows.length} รายการ) สำเร็จ!`);
  }

  return (
    <div className="w-full flex flex-col gap-3 p-3 sm:p-5 max-w-[1600px] mx-auto font-sans text-sm text-slate-800">
      {/* 1. EXECUTIVE SUMMARY KPI CARDS (Hidden on mobile for clean layout) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-3 border border-sky-200 bg-sky-50/40">
          <span className="text-xs text-sky-800">📌 สถานะ: รอตั้งเบิก</span>
          <div className="text-lg text-sky-900 mt-1">
            {displayRows.filter(r => normalizedStatus(r["สถานะ"]) === "รอตั้งเบิก" || normalizedStatus(r["สถานะ"]) === "รออนุมัติ").length} รายการ
          </div>
        </div>

        <div className="bg-white rounded-md p-3 border border-amber-200 bg-amber-50/40">
          <span className="text-xs text-amber-800">📌 สถานะ: ตั้งเบิก</span>
          <div className="text-lg text-amber-900 mt-1">
            {displayRows.filter(r => normalizedStatus(r["สถานะ"]) === "ตั้งเบิก").length} รายการ
          </div>
        </div>

        <div className="bg-white rounded-md p-3 border border-emerald-200 bg-emerald-50/40">
          <span className="text-xs text-emerald-800">✅ สถานะ: อนุมัติแล้ว</span>
          <div className="text-lg text-emerald-900 mt-1">
            {displayRows.filter(r => normalizedStatus(r["สถานะ"]) === "อนุมัติ").length} รายการ
          </div>
        </div>

        <div className="bg-white rounded-md p-3 border border-slate-200">
          <span className="text-xs text-slate-500">ยอดโอนเงินรวม (บิลอนุมัติ)</span>
          <div className="text-lg text-emerald-700 mt-1">{money(transfer)}</div>
        </div>
      </div>

      {/* 2. FILTER TOOLBAR & SEARCH */}
      <div className="border border-slate-200 rounded-xl md:rounded-md p-2.5 bg-white flex flex-col gap-2 text-xs shadow-2xs">
        {/* Search Bar & Controls Header */}
        <div className="flex items-center gap-2 w-full">
          {/* Universal Search Bar */}
          <div className="relative flex items-center flex-1">
            <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหา Project, ร้านค้า, รายการ..."
              value={searchInput}
              onChange={event => updateFilter("search", event.target.value)}
              className="w-full bg-slate-50 md:bg-white text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg md:rounded-md border border-slate-200 md:border-slate-300 focus:outline-none focus:bg-white focus:border-slate-400 placeholder:text-slate-400"
            />
            {searchInput && (
              <X size={14} className="absolute right-2 text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => updateFilter("search", "")} />
            )}
          </div>

          {/* Resend Checklist Mode Button */}
          <button
            type="button"
            onClick={() => {
              setResendMode(!resendMode);
              setSelectedRows(new Set());
              setActionError("");
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
              resendMode
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
                : "bg-white hover:bg-amber-50 text-amber-800 border-amber-300"
            }`}
            title="เปิดโหมดเลือกรายการเพื่อส่งข้อความแจ้งเตือนซ้ำ (ไม่เปลี่ยนสถานะ)"
          >
            <RotateCw size={13} className={resendMode ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{resendMode ? "ออกจากโหมดส่งซ้ำ" : "ส่งซ้ำ (Resend)"}</span>
            <span className="sm:hidden">{resendMode ? "ออก" : "ส่งซ้ำ"}</span>
          </button>

          {/* Export to Excel (CSV) Button */}
          {displayRows.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs active:scale-95"
              title="ส่งออกรายการขอเบิกเงินเป็นไฟล์ Excel (CSV)"
            >
              <Download size={13} className="text-slate-600" />
              <span className="hidden sm:inline">ส่งออก</span> Excel
            </button>
          )}

          {/* Mobile Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1 shrink-0 cursor-pointer active:bg-slate-200"
          >
            <Filter size={13} />
            <span>{showMobileFilters ? "ซ่อน" : "ตัวกรอง"}</span>
          </button>
        </div>

        {/* Expandable Filter Controls */}
        <div className={`flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100 md:border-t-0 md:pt-0 ${showMobileFilters ? "flex" : "hidden md:flex"}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Requester dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 whitespace-nowrap">ผู้เบิก:</span>
              <select
                value={filters.requester}
                onChange={event => updateFilter("requester", event.target.value)}
                className="bg-white border border-slate-300 text-xs text-slate-800 px-2 py-1 rounded-md focus:outline-none cursor-pointer"
              >
                <option value="">ทั้งหมด</option>
                {peopleRows.map(row => {
                  const key = String(row["รหัสพนักงาน"] || row["ชื่อเล่น"] || row._sheetRow || "");
                  const label = row["ชื่อเล่น"] ? `${key} - ${row["ชื่อเล่น"]}` : key;
                  return key ? <option key={key} value={key}>{label}</option> : null;
                })}
              </select>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 whitespace-nowrap">วันที่:</span>
              <input
                type="date"
                value={filters.date}
                onChange={event => updateFilter("date", event.target.value)}
                className="bg-white border border-slate-300 text-xs text-slate-800 px-2 py-1 rounded-md focus:outline-none cursor-pointer"
              />
            </div>

            {/* Bill Type */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 whitespace-nowrap">ประเภท:</span>
              <select
                value={filters.bill}
                onChange={event => updateFilter("bill", event.target.value)}
                className="bg-white border border-slate-300 text-xs text-slate-800 px-2 py-1 rounded-md focus:outline-none cursor-pointer"
              >
                <option value="">ทั้งหมด</option>
                <option value="หลัก">หลัก</option>
                <option value="ย่อย">ย่อย</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 ACTION BAR (Resend Mode vs Normal Batch Mode) */}
      {resendMode ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-amber-50 text-amber-900 rounded-xl shadow-xs border border-amber-200 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                <RotateCw size={12} />
                <span>โหมดส่งซ้ำ</span>
              </span>
              <span className="text-xs text-amber-900 ">
                เลือก <strong className="text-amber-950 ">{selectedRows.size}</strong> รายการ <span className="hidden md:inline text-amber-700 font-normal">(สถานะในระบบจะไม่ถูกเปลี่ยนแปลง)</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setResendMode(false);
                setSelectedRows(new Set());
              }}
              className="sm:hidden text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedRows.size === 0 || isResending}
              onClick={handleResendSelected}
              className="flex-1 sm:flex-initial px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {isResending ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}
              <span>ส่งแจ้งเตือนซ้ำที่เลือก ({selectedRows.size})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setResendMode(false);
                setSelectedRows(new Set());
              }}
              className="hidden sm:flex px-3 py-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs transition cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : selectedRows.size > 0 ? (
        <div className="fixed sm:static bottom-3 inset-x-3 sm:inset-x-auto z-40 sm:z-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-white text-slate-900 rounded-xl shadow-xl sm:shadow-2xs border border-slate-300 sm:border-slate-200 animate-in slide-in-from-bottom-2 fade-in duration-150">
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-md font-medium">
                เลือก {selectedRows.size} รายการ
              </span>
              <span className="text-xs text-slate-700">
                รวม <strong className="text-slate-900">{money(displayRows.filter(r => selectedRows.has(Number(r.id ?? r["ลำดับ"] ?? r._sheetRow))).reduce((sum, r) => sum + toNumber(r["ยอดเงิน"]), 0))}</strong> ฿
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRows(new Set())}
              className="sm:hidden text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => approveSelected("ตั้งเบิก")}
              disabled={isBatchApproving}
              className="flex-1 sm:flex-initial px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
            >
              {isBatchApproving ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}
              <span>ตั้งเบิกที่เลือก ({selectedRows.size})</span>
            </button>

            {effectiveIsAdmin && (
              <button
                type="button"
                onClick={() => approveSelected("อนุมัติ")}
                disabled={isBatchApproving}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Check size={14} />
                <span>อนุมัติ ({selectedRows.size})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedRows(new Set())}
              className="hidden sm:flex px-3 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}

      {actionError ? <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-xs ">{actionError}</div> : null}

      {/* 3. WORK TABLE / MOBILE SELECTABLE FEED */}
      <div className="border border-slate-200 rounded-xl md:rounded-md bg-white overflow-hidden shadow-2xs">
        {/* Mobile Select All Header Bar */}
        {visibleRows.length > 0 && (
          <div className="flex md:hidden items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={
                  visibleRows.length > 0 &&
                  (resendMode
                    ? visibleRows.every(r => selectedRows.has(Number(r.id ?? r["ลำดับ"] ?? r._sheetRow)))
                    : visibleRows.filter(r => normalizedStatus(r["สถานะ"]) === "รอตั้งเบิก" || normalizedStatus(r["สถานะ"]) === "รออนุมัติ").length > 0 &&
                      visibleRows.filter(r => normalizedStatus(r["สถานะ"]) === "รอตั้งเบิก" || normalizedStatus(r["สถานะ"]) === "รออนุมัติ").every(r => selectedRows.has(Number(r.id ?? r["ลำดับ"] ?? r._sheetRow))))
                }
                onChange={e => {
                  const eligibleIds = visibleRows
                    .filter(r => resendMode ? true : (normalizedStatus(r["สถานะ"]) === "รอตั้งเบิก" || normalizedStatus(r["สถานะ"]) === "รออนุมัติ"))
                    .map(r => Number(r.id ?? r["ลำดับ"] ?? r._sheetRow));
                  if (e.target.checked) setSelectedRows(new Set([...selectedRows, ...eligibleIds]));
                  else {
                    const newSet = new Set(selectedRows);
                    eligibleIds.forEach(id => newSet.delete(id));
                    setSelectedRows(newSet);
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 accent-slate-900 cursor-pointer"
              />
              <span>{resendMode ? "เลือกทั้งหมดในหน้านี้ (ส่งซ้ำ)" : "เลือกทั้งหมดที่รอตั้งเบิก"}</span>
            </label>
            <span className="text-xs text-slate-500 font-normal">
              {visibleRows.length} รายการ
            </span>
          </div>
        )}

        {/* MOBILE SELECTABLE CARD FEED */}
        <div className="block md:hidden divide-y divide-slate-200 border-t border-slate-200">
          {!visibleRows.length ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">ไม่พบรายการตั้งเบิก</div>
          ) : (
            visibleRows.map((row, index) => {
              const sheetRowId = Number(row.id ?? row["ลำดับ"] ?? row._sheetRow);
              const isSelected = selectedRows.has(sheetRowId);
              const status = normalizedStatus(row["สถานะ"]);
              const isSelectable = resendMode ? true : (status === "รอตั้งเบิก" || status === "รออนุมัติ");
              const seq = String(row.id || row["ลำดับ"] || row._sheetRow || index + 1);
              const requesterKey = String(row["ผู้เบิก"] || "").trim();
              const requesterName = requesterNames[requesterKey] || requesterKey || "-";

              return (
                <div
                  key={`withdraw-mob-${sheetRowId}-${index}`}
                  onClick={() => {
                    if (isSelectable) {
                      const newSet = new Set(selectedRows);
                      if (newSet.has(sheetRowId)) newSet.delete(sheetRowId);
                      else newSet.add(sheetRowId);
                      setSelectedRows(newSet);
                    }
                  }}
                  className={`p-3 transition flex items-center gap-3 cursor-pointer ${
                    isSelected
                      ? resendMode
                        ? "bg-amber-50/70 border-l-4 border-l-amber-500"
                        : "bg-sky-50/50 border-l-4 border-l-sky-500"
                      : "hover:bg-slate-50 active:bg-slate-100"
                  }`}
                >
                  {/* Left Checkbox */}
                  <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isSelectable}
                      onChange={() => {
                        if (isSelectable) {
                          const newSet = new Set(selectedRows);
                          if (newSet.has(sheetRowId)) newSet.delete(sheetRowId);
                          else newSet.add(sheetRowId);
                          setSelectedRows(newSet);
                        }
                      }}
                      className={`w-5 h-5 rounded border-slate-300 ${resendMode ? "text-amber-600 accent-amber-600" : "text-sky-600 accent-sky-600"} cursor-pointer ${
                        !isSelectable ? "opacity-30 cursor-not-allowed" : ""
                      }`}
                    />
                  </div>

                  {/* Middle Details */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs bg-slate-900 text-white px-1.5 py-0.2 rounded shrink-0">
                        #{seq}
                      </span>
                      <span className="text-xs text-slate-900 truncate">
                        {row["ID Project"] ? `[${row["ID Project"]}] ` : ""}{String(row["ชื่อ Project"] || "-")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 font-medium truncate" title={String(row["ร้าน/บุคคล"] || "")}>
                      {String(row["ร้าน/บุคคล"] || "-")}
                    </div>

                    <div className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                      <span>{formatDateDisplay(row["ว/ด/ป"])}</span>
                      <span>•</span>
                      <span className="truncate">{String(row["สินค้า/ทำงาน"] || "-")}</span>
                      <span>•</span>
                      <span>{requesterName}</span>
                    </div>
                  </div>

                  {/* Right Amount & Status Action */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs sm:text-sm text-slate-900">
                      {money(row["ยอดเงิน"])} <span className="text-xs font-normal text-slate-500">฿</span>
                    </span>

                    {status === "ตั้งเบิก" ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
                        ตั้งเบิกแล้ว
                      </span>
                    ) : status === "อนุมัติ" ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                        อนุมัติแล้ว
                      </span>
                    ) : status === "เบิกแล้ว" ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200">
                        ปิดงานแล้ว
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={approvingRow === sheetRowId}
                        onClick={() => approveRow(row)}
                        className="px-2 py-0.5 rounded text-xs flex items-center gap-1 transition cursor-pointer bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 active:scale-95 shadow-2xs"
                      >
                        {approvingRow === sheetRowId ? (
                          <LoaderCircle className="spin" size={11} />
                        ) : (
                          <Check size={11} />
                        )}
                        <span>ตั้งเบิก</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW (Hidden on Mobile) */}
        <div className="hidden md:block">
          <WithdrawTable
            approvingRow={approvingRow}
            columns={columns}
            onApprove={approveRow}
            requesterNames={requesterNames}
            rows={visibleRows}
            selectedRows={selectedRows}
            resendMode={resendMode}
            onSelectRow={rowId => {
              const newSet = new Set(selectedRows);
              if (newSet.has(rowId)) newSet.delete(rowId);
              else newSet.add(rowId);
              setSelectedRows(newSet);
            }}
            onSelectAll={rowIds => {
              if (rowIds.length === 0) setSelectedRows(new Set());
              else setSelectedRows(new Set([...selectedRows, ...rowIds]));
            }}
          />
        </div>

        {/* SLEEK PAGINATION */}
        <WithdrawPagination
          currentPage={currentPage}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSize={pageSize}
          totalPages={totalPages}
          totalRows={displayRows.length}
          visibleEnd={visibleEnd}
          visibleStart={visibleStart}
        />
      </div>
    </div>
  );
}

function getLocalTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeFilters(filters: WithdrawFilters) {
  return {
    requester: String(filters.requester || ""),
    date: String(filters.date || ""),
    bill: String(filters.bill || ""),
    search: String(filters.search || "")
  };
}

function filterWithdrawRows(rows: SheetRow[], filters: Required<WithdrawFilters>, requesterNames: Record<string, string> = {}) {
  const requester = filters.requester.trim();
  const bill = filters.bill.trim();
  const query = filters.search.trim().toLowerCase();
  const filterDateStr = filters.date.trim();

  return rows.filter(row => {
    if (requester) {
      const rowReq = String(row["ผู้เบิก"] || "").trim();
      const mappedName = requesterNames[rowReq] || "";
      const matches = rowReq === requester ||
        rowReq.toLowerCase() === requester.toLowerCase() ||
        mappedName.toLowerCase() === requester.toLowerCase() ||
        (requesterNames[requester] && requesterNames[requester].toLowerCase() === rowReq.toLowerCase());
      if (!matches) return false;
    }
    if (bill && String(row["บิล"] || "").trim() !== bill) return false;
    if (filterDateStr) {
      const rowIsoDate = normalizeDateToIso(row["ว/ด/ป"]);
      if (rowIsoDate !== filterDateStr) return false;
    }
    if (query && !Object.values(row).some(value => String(value || "").toLowerCase().includes(query))) return false;
    return true;
  });
}

function WithdrawTable({
  rows,
  columns,
  requesterNames,
  approvingRow,
  onApprove,
  selectedRows,
  resendMode = false,
  onSelectRow,
  onSelectAll
}: {
  rows: SheetRow[];
  columns: string[];
  requesterNames: Record<string, string>;
  approvingRow: number | null;
  onApprove: (row: SheetRow) => void;
  selectedRows: Set<number>;
  resendMode?: boolean;
  onSelectRow: (rowId: number) => void;
  onSelectAll: (rowIds: number[]) => void;
}) {
  if (!rows.length) return <div className="p-8 text-center text-slate-400 text-xs font-medium">ไม่พบรายการตั้งเบิก</div>;

  // Filter rows eligible for selection
  const eligibleRows = rows.filter(r => {
    if (resendMode) return true;
    const st = normalizedStatus(r["สถานะ"]);
    return st === "รอตั้งเบิก" || st === "รออนุมัติ";
  });

  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every(r => selectedRows.has(Number(r.id ?? r["ลำดับ"] ?? r._sheetRow)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans">
        <thead>
          <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 text-xs">
            <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200">
              <input 
                type="checkbox" 
                checked={allEligibleSelected}
                disabled={eligibleRows.length === 0}
                onChange={e => {
                  if (e.target.checked) onSelectAll(eligibleRows.map(r => Number(r.id ?? r["ลำดับ"] ?? r._sheetRow)));
                  else onSelectAll([]);
                }}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title={
                  eligibleRows.length === 0
                    ? "ไม่มีรายการที่สามารถเลือกได้"
                    : resendMode
                    ? "เลือกทั้งหมดในหน้านี้เพื่อส่งแจ้งเตือนซ้ำ"
                    : "เลือกทั้งหมดที่รอตั้งเบิก"
                }
              />
            </th>
            {columns.map(column => (
              <th key={column} className={`py-2.5 px-3 border-r border-slate-200 ${isAmountColumn(column) ? "text-right" : ""}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => {
            const sheetRowId = Number(row.id ?? row["ลำดับ"] ?? row._sheetRow);
            const isSelected = selectedRows.has(sheetRowId);
            const status = normalizedStatus(row["สถานะ"]);
            const isSelectable = resendMode ? true : (status === "รอตั้งเบิก" || status === "รออนุมัติ");

            return (
              <tr key={`${sheetRowId}-${index}`} className={`transition-colors ${isSelected && resendMode ? "bg-amber-50/50" : "hover:bg-slate-50"}`}>
                <td className="py-2 px-3 text-center border-r border-slate-100">
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    disabled={!isSelectable}
                    onChange={() => {
                      if (isSelectable) onSelectRow(sheetRowId);
                    }}
                    className={`rounded border-slate-300 ${resendMode ? "text-amber-600 accent-amber-600 focus:ring-amber-500" : "text-slate-900 focus:ring-slate-500"} ${
                      isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-30 bg-slate-100"
                    }`}
                    title={
                      !isSelectable
                        ? `รายการสถานะ "${row["สถานะ"] || status}" ตั้งเบิกเรียบร้อยแล้ว (เปิดโหมดส่งซ้ำเพื่อเลือกส่งใหม่)`
                        : resendMode
                        ? "เลือกรายการนี้เพื่อส่งข้อความแจ้งเตือนซ้ำ"
                        : "เลือกรายการนี้เพื่อตั้งเบิก"
                    }
                  />
                </td>

                {columns.map(column => (
                  <td key={column} className={`py-2 px-3 border-r border-slate-100 ${isAmountColumn(column) ? "text-right text-slate-900" : ""}`}>
                    {column === "จัดการ" ? (
                      normalizedStatus(row["สถานะ"]) === "ตั้งเบิก" ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                          ตั้งเบิกแล้ว
                        </span>
                      ) : normalizedStatus(row["สถานะ"]) === "อนุมัติ" ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                          อนุมัติแล้ว
                        </span>
                      ) : normalizedStatus(row["สถานะ"]) === "เบิกแล้ว" ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                          ปิดงานแล้ว
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={approvingRow === sheetRowId}
                          onClick={() => onApprove(row)}
                          className="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                        >
                          {approvingRow === sheetRowId ? (
                            <LoaderCircle className="spin" size={13} />
                          ) : (
                            <Check size={13} />
                          )}
                          <span>ตั้งเบิก</span>
                        </button>
                      )
                    ) : (
                      formatWithdrawCell(column, row[column], requesterNames)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function requesterNameMap(peopleRows: SheetRow[]) {
  return peopleRows.reduce<Record<string, string>>((names, row) => {
    const key = String(row["รหัสพนักงาน"] || "").trim();
    const name = String(row["ชื่อเล่น"] || "").trim();
    if (key && name) names[key] = name;
    return names;
  }, {});
}

export function findMatchingRequesterKey(
  peopleRows: SheetRow[],
  authEmpId?: string,
  authName?: string,
  usersList: any[] = []
): string {
  const cleanEmpId = String(authEmpId || "").trim().toLowerCase();
  const cleanName = String(authName || "").trim().toLowerCase();
  if (!cleanEmpId && !cleanName) return "";

  // 1. Cross-reference with users_list to find canonical employee ID / username
  let targetEmpId = cleanEmpId;
  if (usersList && usersList.length > 0) {
    const matchedUser = usersList.find(u => {
      const uId = String(u.id || "").trim().toLowerCase();
      const uUser = String(u.username || "").trim().toLowerCase();
      const uDisplay = String(u.displayName || "").trim().toLowerCase();
      const uName = String(u.name || "").trim().toLowerCase();
      return (
        (cleanEmpId && (uId === cleanEmpId || uUser === cleanEmpId)) ||
        (cleanName && (uDisplay === cleanName || uName === cleanName || uId === cleanName || uUser === cleanName))
      );
    });
    if (matchedUser) {
      targetEmpId = String(matchedUser.username || matchedUser.id || "").trim().toLowerCase();
    }
  }

  // 2. Match by Employee Code (รหัสพนักงาน) in peopleRows
  if (targetEmpId) {
    const matched = peopleRows.find(row => {
      const rowId = String(row["รหัสพนักงาน"] || row["id"] || row["employee_id"] || "").trim().toLowerCase();
      return rowId && rowId === targetEmpId;
    });
    if (matched) {
      return String(matched["รหัสพนักงาน"] || matched["ชื่อเล่น"] || "");
    }
  }

  // 3. Match by Nickname (ชื่อเล่น) or Full name (ชื่อ-นามสกุล)
  if (cleanName) {
    const matched = peopleRows.find(row => {
      const nickname = String(row["ชื่อเล่น"] || "").trim().toLowerCase();
      const fullName = String(row["ชื่อ-นามสกุล"] || row["name"] || "").trim().toLowerCase();
      return (nickname && nickname === cleanName) || (fullName && fullName.includes(cleanName));
    });
    if (matched) {
      return String(matched["รหัสพนักงาน"] || matched["ชื่อเล่น"] || "");
    }
  }

  return targetEmpId || authEmpId || authName || "";
}

function WithdrawPagination({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSize,
  totalPages,
  totalRows,
  visibleEnd,
  visibleStart
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSize: number;
  totalPages: number;
  totalRows: number;
  visibleEnd: number;
  visibleStart: number;
}) {
  if (totalRows === 0) return null;

  return (
    <>
      {/* 1. Mobile Minimal Pagination */}
      <div className="block md:hidden border-t border-slate-100 bg-slate-50/50">
        {totalPages <= 1 ? (
          <div className="p-3 text-center text-xs text-slate-400 font-medium">
            แสดงทั้งหมด {totalRows} รายการ
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 sm:p-3 text-xs">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition text-slate-700 flex items-center gap-1 cursor-pointer active:bg-slate-100 shadow-2xs"
            >
              <ChevronLeft size={14} />
              <span>ก่อนหน้า</span>
            </button>

            <span className="text-slate-700 text-xs">
              หน้า {currentPage} / {totalPages} <span className="font-normal text-slate-400 text-xs">({totalRows} รายการ)</span>
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition text-slate-700 flex items-center gap-1 cursor-pointer active:bg-slate-100 shadow-2xs"
            >
              <span>ถัดไป</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 2. Professional Desktop Pagination */}
      <div className="hidden md:flex flex-row items-center justify-between gap-3 p-3 border-t border-slate-200 text-xs text-slate-600 bg-slate-50/80">
        <div>
          แสดง <strong className="text-slate-800 ">{visibleStart}-{visibleEnd}</strong> จาก <strong className="text-slate-800 ">{totalRows}</strong> รายการ
        </div>

        <div className="flex items-center gap-3">
          {/* Rows per page */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">แสดงต่อหน้า:</span>
            {PAGE_SIZE_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => onPageSizeChange(opt)}
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
              onClick={() => onPageChange(currentPage - 1)}
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
              onClick={() => onPageChange(currentPage + 1)}
              className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer text-slate-700"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function parseInputDate(value?: string) {
  if (!value) return null;
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]) - 1;
  const day = Number(matched[3]);
  return new Date(year, month, day);
}

function parseSheetDate(value: unknown) {
  const parsed = parseDateStrict(value);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

function normalizedStatus(value: unknown): "รอตั้งเบิก" | "ตั้งเบิก" | "รออนุมัติ" | "อนุมัติ" | "เบิกแล้ว" {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("รอตั้งเบิก")) return "รอตั้งเบิก";
  if ((text.includes("อนุมัติ") && !text.includes("รออนุมัติ")) || text === "approved") return "อนุมัติ";
  if (text.includes("เบิกแล้ว") || text === "withdrawn" || text === "paid") return "เบิกแล้ว";
  if (text.includes("ตั้งเบิก")) return "ตั้งเบิก";
  if (text.includes("รออนุมัติ")) return "รออนุมัติ";
  return "รอตั้งเบิก";
}

function isAmountColumn(column: string) {
  return column === "ยอดเงิน" || column === "ยอดโอน" || column === "ยอดรวม vat" || column === "งบไม่เกิน" || column === "รวม ALL";
}

function formatWithdrawCell(column: string, value: unknown, requesterNames: Record<string, string>) {
  if (value === null || value === undefined) return "-";
  if (column === "ผู้เบิก") {
    const key = String(value).trim();
    return requesterNames[key] || key || "-";
  }
  if (column === "สถานะ") {
    const status = normalizedStatus(value);
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs ${
          status === "อนุมัติ"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : status === "เบิกแล้ว"
            ? "bg-slate-100 text-slate-700 border border-slate-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}
      >
        {status}
      </span>
    );
  }
  if (column === "ว/ด/ป" || column.includes("วัน")) {
    return formatDateDisplay(value);
  }
  if (isAmountColumn(column)) {
    return money(value);
  }
  return String(value) || "-";
}

