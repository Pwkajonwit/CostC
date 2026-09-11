"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, Filter, Plus, RotateCcw, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { BillWorkflowActions } from "@/components/bills/BillWorkflowActions";
import { BillImageThumbnail } from "@/components/bills/BillImageThumbnail";

const FormModal = dynamic(
  () => import("@/components/forms/FormModal").then((mod) => mod.FormModal),
  { ssr: false }
);

const BillDetailDrawer = dynamic(
  () => import("@/components/bills/BillDetailDrawer").then((mod) => mod.BillDetailDrawer),
  { ssr: false }
);
import { FORM_SCHEMAS } from "@/lib/schemas";
import { formatDateDisplay, normalizeDateToIso, parseDateStrict } from "@/lib/utils/dates";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatBillConditions, normalizeBillStatus } from "@/lib/bills/bill-status";
import { showConfirm, showToast } from "@/components/shared/ToastProvider";
import { useRealtimeSync } from "@/lib/use-realtime-sync";
import type { SheetRow } from "@/lib/types";

type BillsDashboardClientProps = {
  columns: string[];
  initialRows: SheetRow[];
  form?: any;
  isAdmin: boolean;
  peopleRows: SheetRow[];
  authEmpId?: string;
  authName?: string;
  search: string;
  page: number;
  pageSize: number;
  sort: "latest" | "oldest";
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

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

export function BillsDashboardClient({
  columns,
  initialRows,
  form,
  isAdmin,
  peopleRows,
  authEmpId,
  authName,
  search: initialSearch = "",
  page: initialPage = 1,
  pageSize: initialPageSize = 20,
  sort: initialSort = "latest",
}: BillsDashboardClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState<SheetRow[]>(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const initialRequester = useMemo(() => {
    return resolveMatchingRequesterKey(peopleRows, authEmpId, authName);
  }, [peopleRows, authEmpId, authName]);

  const todayIso = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }, []);

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [filters, setFilters] = useState(() => ({
    requester: isAdmin ? "" : initialRequester,
    date: isAdmin ? "" : todayIso,
    bill: "",
    status: "",
    search: initialSearch,
  }));

  // Auto-sync initial requester when peopleRows finishes loading if not yet set (only for non-admins)
  useEffect(() => {
    if (!isAdmin && !filters.requester) {
      const resolvedReq = resolveMatchingRequesterKey(peopleRows, authEmpId, authName);
      if (resolvedReq) {
        setFilters(prev => ({ ...prev, requester: resolvedReq }));
      }
    }
  }, [isAdmin, peopleRows, authEmpId, authName]);

  useEffect(() => {
    setSearchInput(initialSearch);
  }, [initialSearch]);

  // Debounce search input by 250ms to prevent UI main thread lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => (prev.search === searchInput ? prev : { ...prev, search: searchInput }));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortDesc, setSortDesc] = useState(initialSort === "latest");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const refreshBillsData = useCallback(async () => {
    try {
      const res = await fetch(`/api/bills?pageSize=10000&page=1&_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache" }
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload && Array.isArray(payload.rows)) {
          setRows(payload.rows);
        }
      }
    } catch {}
    router.refresh();
  }, [router]);

  // Instant optimistic update on local form creation / edit events so new bills never flicker or disappear
  useEffect(() => {
    const handleBillUpdated = (event: Event) => {
      const customEvt = event as CustomEvent<{ row?: SheetRow; tableName?: string }>;
      const newRow = customEvt.detail?.row;
      if (newRow) {
        const newSeq = String(newRow["ลำดับ"] || newRow.id || newRow._sheetRow || "");
        setRows(prev => {
          const exists = prev.some(r => String(r["ลำดับ"] || r.id || r._sheetRow || "") === newSeq);
          if (exists) {
            return prev.map(r => String(r["ลำดับ"] || r.id || r._sheetRow || "") === newSeq ? { ...r, ...newRow } : r);
          }
          return [newRow, ...prev];
        });
      }
      refreshBillsData();
    };

    window.addEventListener("bills-data-updated", handleBillUpdated);
    window.addEventListener("data-updated", handleBillUpdated);
    return () => {
      window.removeEventListener("bills-data-updated", handleBillUpdated);
      window.removeEventListener("data-updated", handleBillUpdated);
    };
  }, [refreshBillsData]);

  // High-performance debounced live sync from Supabase PostgreSQL + Local Form Events + Auto Polling
  useRealtimeSync({
    channelName: "bills_table_live_sync",
    tables: ["bills"],
    onSync: refreshBillsData,
    debounceMs: 500,
    pollingIntervalMs: 8_000,
  });

  // Bill Detail Drawer State
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);

  const requesterNames = useMemo(() => {
    return peopleRows.reduce<Record<string, string>>((names, row) => {
      const key = String(row["รหัสพนักงาน"] || row["ชื่อเล่น"] || "").trim();
      const name = String(row["ชื่อเล่น"] || "").trim();
      if (key && name) names[key] = name;
      return names;
    }, {});
  }, [peopleRows]);

  const filteredRows = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const requester = filters.requester.trim();
    const bill = filters.bill.trim();
    const status = filters.status.trim();
    const filterDateIso = filters.date.trim();
    const reqName = requester ? (requesterNames[requester] || requester) : "";

    return rows.filter(row => {
      if (requester) {
        const rowReq = String(row["ผู้เบิก"] || row.requester || "").trim().toLowerCase();
        const mappedReqName = (requesterNames[rowReq] || requesterNames[String(row["ผู้เบิก"] || "")] || "").toLowerCase();
        const rowCreator = String(row["ผู้สร้างบิล"] || row.created_by || "").trim().toLowerCase();
        const mappedCreatorName = (requesterNames[rowCreator] || requesterNames[String(row["ผู้สร้างบิล"] || "")] || "").toLowerCase();
        const reqLower = requester.toLowerCase();
        const reqNameLower = reqName.toLowerCase();

        const matchesReq =
          rowReq === reqLower ||
          rowReq === reqNameLower ||
          mappedReqName === reqLower ||
          mappedReqName === reqNameLower;

        const matchesCreator =
          rowCreator === reqLower ||
          rowCreator === reqNameLower ||
          mappedCreatorName === reqLower ||
          mappedCreatorName === reqNameLower;

        if (!matchesReq && !matchesCreator) return false;
      }
      if (bill && String(row["บิล"] || "").trim() !== bill) return false;
      if (status && String(row["สถานะ"] || "").trim() !== status) return false;
      if (filterDateIso) {
        const rowIso = normalizeDateToIso(row["ว/ด/ป"]);
        if (rowIso !== filterDateIso) return false;
      }
      if (query) {
        // Fast search checks over primary visible fields first before scanning all values
        const primaryMatch = 
          String(row["ชื่อ Project"] || "").toLowerCase().includes(query) ||
          String(row["ร้าน/บุคคล"] || "").toLowerCase().includes(query) ||
          String(row["สินค้า/ทำงาน"] || "").toLowerCase().includes(query) ||
          String(row["ผู้เบิก"] || "").toLowerCase().includes(query) ||
          String(row["บิล"] || "").toLowerCase().includes(query) ||
          String(row["ลำดับ"] || "").toLowerCase().includes(query);
        if (primaryMatch) return true;

        const found = Object.values(row).some(v => typeof v === "string" && v.toLowerCase().includes(query));
        if (!found) return false;
      }
      return true;
    }).sort((a, b) => {
      const seqA = Number(a._sheetRow || a["ลำดับ"] || a.id || 0);
      const seqB = Number(b._sheetRow || b["ลำดับ"] || b.id || 0);
      return sortDesc ? seqB - seqA : seqA - seqB;
    });
  }, [rows, filters, sortDesc, requesterNames]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const visibleStart = visibleRows.length ? pageStart + 1 : 0;
  const visibleEnd = pageStart + visibleRows.length;

  const { totalAmount, approvedAmount, pendingAmount } = useMemo(() => {
    let tot = 0;
    let app = 0;
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      const amt = toNumber(row["ยอดเงิน"]);
      tot += amt;
      const st = normalizeBillStatus(row["สถานะ"]);
      if (st === "อนุมัติ" || st === "เบิกแล้ว") {
        app += amt;
      }
    }
    return { totalAmount: tot, approvedAmount: app, pendingAmount: tot - app };
  }, [filteredRows]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.requester) count++;
    if (filters.date) count++;
    if (filters.bill) count++;
    if (filters.status) count++;
    return count;
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  function updateFilter(name: string, value: string) {
    if (name === "search") {
      setSearchInput(value);
    } else {
      setFilters(cur => ({ ...cur, [name]: value }));
    }
  }

  return (
    <div className="w-full flex flex-col gap-3 p-3 sm:p-5 max-w-[1600px] mx-auto font-sans text-sm text-slate-800">
      {/* 1. EXECUTIVE SUMMARY KPI CARDS (Hidden on Mobile for clean layout) */}
      <div className="hidden md:grid md:grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-2.5 sm:p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs sm:text-xs text-slate-500 block truncate">รายการบิลทั้งหมด</span>
          <div className="text-base sm:text-lg text-slate-900 mt-0.5">{filteredRows.length} รายการ</div>
        </div>

        <div className="bg-white rounded-md p-2.5 sm:p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs sm:text-xs text-slate-500 block truncate">รวมยอดเงินบิล</span>
          <div className="text-base sm:text-lg text-slate-900 mt-0.5">{money(totalAmount)}</div>
        </div>

        <div className="bg-white rounded-md p-2.5 sm:p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs sm:text-xs text-slate-500 block truncate">ยอดอนุมัติ/เบิกแล้ว</span>
          <div className="text-base sm:text-lg text-emerald-700 mt-0.5">{money(approvedAmount)}</div>
        </div>

        <div className="bg-white rounded-md p-2.5 sm:p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs sm:text-xs text-slate-500 block truncate">ยอดรออนุมัติ</span>
          <div className="text-base sm:text-lg text-amber-700 mt-0.5">{money(pendingAmount)}</div>
        </div>
      </div>

      {/* 2. MOBILE QUICK TOOLBAR & STATUS CHIPS (Visible only on Mobile) */}
      <div className="flex md:hidden flex-col gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        {/* Search + Filter + Sort row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาบิล, ร้านค้า, โครงการ..."
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:bg-white focus:border-slate-400 placeholder:text-slate-400"
            />
            {searchInput && (
              <X size={14} className="absolute right-2 text-slate-400 cursor-pointer" onClick={() => setSearchInput("")} />
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters(cur => !cur)}
            className={`p-1.5 rounded-lg border flex items-center gap-1 text-xs shrink-0 cursor-pointer transition-all ${
              showMobileFilters || activeFilterCount > 0
                ? "bg-emerald-800 text-white border-emerald-800 shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
            }`}
            title="ตัวกรอง"
          >
            <Filter size={14} />
            {activeFilterCount > 0 ? (
              <span className="w-4 h-4 bg-emerald-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setSortDesc(cur => !cur)}
            className="p-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1 text-xs shrink-0 cursor-pointer active:bg-slate-200"
            title="สลับการเรียงลำดับ"
          >
            {sortDesc ? <ArrowDownWideNarrow size={14} /> : <ArrowUpWideNarrow size={14} />}
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-bill-form"))}
            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 shrink-0 shadow-xs ring-1 ring-emerald-400/50 active:scale-95 transition-all cursor-pointer"
            title="เพิ่มบิล"
          >
            <Plus size={15} className="stroke-[2.5]" />
            <span className="hidden xs:inline">เพิ่มบิล</span>
          </button>
        </div>

        {/* Expandable Mobile Filter Panel */}
        {showMobileFilters ? (
          <div className="pt-2 border-t border-slate-100 space-y-2.5 animate-in slide-in-from-top duration-150">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                <Filter size={13} className="text-emerald-700" />
                <span>ตัวกรองข้อมูล</span>
              </span>
              <button
                type="button"
                onClick={() => setFilters({ requester: "", date: "", bill: "", status: "", search: searchInput })}
                className="text-[11px] text-rose-600 hover:underline cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Requester Filter */}
              <div className="col-span-2 space-y-1">
                <label className="text-[11px] font-medium text-slate-600">ผู้เบิก:</label>
                <select
                  value={filters.requester}
                  onChange={event => updateFilter("requester", event.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs text-slate-800 px-2.5 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-slate-800 cursor-pointer"
                >
                  <option value="">ทั้งหมด (ทุกคน)</option>
                  {filters.requester && !peopleRows.some(row => String(row["รหัสพนักงาน"] || row["ชื่อเล่น"] || row._sheetRow || "") === filters.requester) ? (
                    <option value={filters.requester}>{requesterNames[filters.requester] || filters.requester}</option>
                  ) : null}
                  {peopleRows.map(row => {
                    const key = String(row["รหัสพนักงาน"] || row["ชื่อเล่น"] || row._sheetRow || "");
                    const label = row["ชื่อเล่น"] ? `${key} - ${row["ชื่อเล่น"]}` : key;
                    return key ? <option key={key} value={key}>{label}</option> : null;
                  })}
                </select>
              </div>

              {/* Date Filter */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-600">วันที่:</label>
                  {filters.date ? (
                    <button
                      type="button"
                      onClick={() => updateFilter("date", "")}
                      className="text-[10px] text-slate-400 hover:text-slate-700 underline"
                    >
                      ล้าง
                    </button>
                  ) : null}
                </div>
                <input
                  type="date"
                  value={filters.date}
                  onChange={event => updateFilter("date", event.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs text-slate-800 px-2 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-slate-800 cursor-pointer"
                />
              </div>

              {/* Bill Type Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">ประเภทบิล:</label>
                <select
                  value={filters.bill}
                  onChange={event => updateFilter("bill", event.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs text-slate-800 px-2.5 py-1.5 rounded-lg focus:outline-none focus:bg-white focus:border-slate-800 cursor-pointer"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="หลัก">หลัก</option>
                  <option value="ย่อย">ย่อย</option>
                </select>
              </div>
            </div>
          </div>
        ) : null}

        {/* Quick Filter Chips (Horizontal Scrollable) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => updateFilter("status", "")}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer text-xs ${
              filters.status === ""
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ทั้งหมด ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => updateFilter("status", "รออนุมัติ")}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer text-xs ${
              filters.status === "รออนุมัติ"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
            }`}
          >
            รออนุมัติ
          </button>
          <button
            type="button"
            onClick={() => updateFilter("status", "อนุมัติ")}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer text-xs ${
              filters.status === "อนุมัติ"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
            }`}
          >
            อนุมัติแล้ว
          </button>
          <button
            type="button"
            onClick={() => updateFilter("status", "เบิกแล้ว")}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer text-xs ${
              filters.status === "เบิกแล้ว"
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            เบิกแล้ว
          </button>
        </div>
      </div>

      {/* 2. DESKTOP FILTER TOOLBAR */}
      {/* 2. DESKTOP UNIFIED COMMAND BAR RIBBON */}
      <div className="hidden md:flex border border-slate-200/90 rounded-xl p-2 bg-white items-center justify-between gap-2 text-xs shadow-2xs flex-wrap">
        {/* Left: Search & Filter Controls Ribbon */}
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          {/* Search Input */}
          <div className="relative flex items-center w-48 lg:w-60 shrink-0">
            <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาบิล, ร้านค้า, โครงการ..."
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 transition-all"
            />
            {searchInput && (
              <X size={13} className="absolute right-2 text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setSearchInput("")} />
            )}
          </div>

          <div className="hidden xl:block h-4 w-px bg-slate-200 shrink-0" />

          {/* Requester Filter Pill */}
          <div className="relative flex items-center">
            <select
              value={filters.requester}
              onChange={event => updateFilter("requester", event.target.value)}
              className={`text-xs pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                filters.requester
                  ? "bg-emerald-50/90 border-emerald-300 text-emerald-900 font-semibold shadow-2xs"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
              title="กรองตามผู้เบิก"
            >
              <option value="">ผู้เบิก: ทั้งหมด</option>
              {filters.requester && !peopleRows.some(row => String(row["รหัสพนักงาน"] || row["ชื่อเล่น"] || row._sheetRow || "") === filters.requester) ? (
                <option value={filters.requester}>ผู้เบิก: {requesterNames[filters.requester] || filters.requester}</option>
              ) : null}
              {peopleRows.map(row => {
                const key = String(row["รหัสพนักงาน"] || row["ชื่อเล่น"] || row._sheetRow || "");
                const label = row["ชื่อเล่น"] ? `${key} - ${row["ชื่อเล่น"]}` : key;
                return key ? <option key={key} value={key}>ผู้เบิก: {label}</option> : null;
              })}
            </select>
            <ChevronDown size={13} className="absolute right-2 pointer-events-none text-slate-400" />
          </div>

          {/* Date Filter Pill */}
          <div className="flex items-center gap-1">
            <div className="relative flex items-center">
              <Calendar size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={filters.date}
                onChange={event => updateFilter("date", event.target.value)}
                className={`text-xs pl-7 pr-6 py-1.5 rounded-lg border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                  filters.date
                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-900 font-semibold shadow-2xs"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
                title="กรองตามวันที่"
              />
              {filters.date ? (
                <button
                  type="button"
                  onClick={() => updateFilter("date", "")}
                  className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="ล้างวันที่ (ดูทั้งหมด)"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>
            {filters.date !== todayIso ? (
              <button
                type="button"
                onClick={() => updateFilter("date", todayIso)}
                className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-md text-[11px] font-medium border border-slate-200 transition cursor-pointer whitespace-nowrap"
                title="กรองเฉพาะวันนี้"
              >
                วันนี้
              </button>
            ) : null}
          </div>

          {/* Bill Type Filter Pill */}
          <div className="relative flex items-center">
            <select
              value={filters.bill}
              onChange={event => updateFilter("bill", event.target.value)}
              className={`text-xs pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                filters.bill
                  ? "bg-emerald-50/90 border-emerald-300 text-emerald-900 font-semibold shadow-2xs"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
              title="กรองตามประเภทบิล"
            >
              <option value="">ประเภท: ทั้งหมด</option>
              <option value="หลัก">ประเภท: หลัก</option>
              <option value="ย่อย">ประเภท: ย่อย</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 pointer-events-none text-slate-400" />
          </div>

          {/* Status Filter Pill */}
          <div className="relative flex items-center">
            <select
              value={filters.status}
              onChange={event => updateFilter("status", event.target.value)}
              className={`text-xs pl-2.5 pr-6 py-1.5 rounded-lg border appearance-none cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                filters.status
                  ? "bg-emerald-50/90 border-emerald-300 text-emerald-900 font-semibold shadow-2xs"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
              title="กรองตามสถานะบิล"
            >
              <option value="">สถานะ: ทั้งหมด</option>
              <option value="รออนุมัติ">สถานะ: รออนุมัติ</option>
              <option value="ตั้งเบิก">สถานะ: ตั้งเบิก</option>
              <option value="อนุมัติ">สถานะ: อนุมัติ</option>
              <option value="เบิกแล้ว">สถานะ: เบิกแล้ว</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 pointer-events-none text-slate-400" />
          </div>

          {/* Reset Filters (Only when filtered) */}
          {(filters.requester || filters.date || filters.bill || filters.status || searchInput) ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setFilters({ requester: "", date: "", bill: "", status: "", search: "" });
              }}
              className="px-2 py-1 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md flex items-center gap-1 transition cursor-pointer whitespace-nowrap font-medium"
              title="ล้างตัวกรองทั้งหมด"
            >
              <RotateCcw size={11} />
              <span>ล้างกรอง</span>
            </button>
          ) : null}
        </div>

        {/* Right: Sort & Add Actions */}
        <div className="flex items-center gap-2 shrink-0 justify-end ml-auto">
          <button
            type="button"
            onClick={() => setSortDesc(cur => !cur)}
            className="px-2.5 py-1.5 border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-2xs"
            title="สลับการเรียงลำดับ"
          >
            {sortDesc ? <ArrowDownWideNarrow size={14} className="text-slate-500" /> : <ArrowUpWideNarrow size={14} className="text-slate-500" />}
            <span>{sortDesc ? "ล่าสุดก่อน" : "เก่าสุดก่อน"}</span>
          </button>

          <FormModal
            tableName="Data"
            form={form}
            title="เพิ่มบิล"
            buttonLabel="เพิ่มบิล"
            buttonClassName="px-4 py-1.5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-[13px] rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950/20 hover:shadow-lg hover:shadow-emerald-900/30 ring-2 ring-emerald-400/60 hover:ring-emerald-300 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            buttonIcon={<Plus size={16} className="text-white stroke-[2.8]" />}
            submitPath="/api/bills"
            openEventName="open-bill-form"
          />
        </div>
      </div>

      {/* Hidden Add Modal Trigger for Mobile & Global Events */}
      <FormModal
        tableName="Data"
        form={form}
        title="เพิ่มบิล"
        buttonLabel="เพิ่มบิล"
        submitPath="/api/bills"
        openEventName="open-bill-form"
        hideLauncher
      />

      {/* Hidden Edit Modal Trigger */}
      <FormModal
        tableName="Data"
        form={form}
        title="แก้ไขบิล"
        buttonLabel="แก้ไขบิล"
        submitPath="/api/rows"
        openEventName="open-bill-edit-form"
        hideLauncher
      />

      {/* 3. WORK TABLE / MOBILE HIGH-DENSITY CARD FEED */}
      <div className="border border-slate-200 rounded-xl md:rounded-md bg-white overflow-hidden shadow-2xs">
        {!visibleRows.length ? (
          <div className="p-8 text-center text-slate-500 text-xs font-medium space-y-2">
            <div>
              ไม่พบรายการบิล{filters.date ? ` สำหรับวันที่ ${formatDateDisplay(filters.date)}` : ""}{filters.requester ? ` ของ ${requesterNames[filters.requester] || filters.requester}` : ""}
            </div>
            {(filters.date || filters.requester) && (
              <div className="flex items-center justify-center gap-2 pt-1">
                {filters.date && (
                  <button
                    type="button"
                    onClick={() => updateFilter("date", "")}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs shadow-2xs cursor-pointer"
                  >
                    ดูบิลทุกวัน (ล้างวันที่)
                  </button>
                )}
                {filters.requester && (
                  <button
                    type="button"
                    onClick={() => updateFilter("requester", "")}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs shadow-2xs cursor-pointer"
                  >
                    ดูบิลทุกคน (ล้างผู้เบิก)
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* MOBILE COMPACT CARD FEED (High-Density & Fast Scanning) */}
            <div className="block md:hidden divide-y divide-slate-200 border-t border-slate-200">
              {visibleRows.map((row, idx) => {
                const seq = String(row["ลำดับ"] || row._sheetRow || row.id || idx + 1);
                const statusStr = String(row["สถานะ"] || "รออนุมัติ").trim();
                const requesterKey = String(row["ผู้เบิก"] || "").trim();
                const requesterName = requesterNames[requesterKey] || requesterKey || "-";
                const isPending = statusStr.includes("รออนุมัติ") || statusStr.includes("ตั้งเบิก");
                const isApproved = statusStr.includes("อนุมัติ");

                return (
                  <div
                    key={`mobile-${seq}-${idx}`}
                    onClick={() => window.location.href = `/bills/${seq}`}
                    className="p-3 hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer flex items-center gap-3 relative"
                  >
                    {/* 1. Left Thumbnail (46x46) */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <BillImageThumbnail value={row["รูปถ่ายบิล"]} />
                    </div>

                    {/* 2. Middle Content (Project, Shop, Items) */}
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

                    {/* 3. Right Amount & Status Badge */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-xs sm:text-sm text-slate-900">
                        {money(row["ยอดเงิน"])} <span className="text-xs font-normal text-slate-500">฿</span>
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        isApproved
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                          : isPending
                          ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                        {statusStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (Display only on screens >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">ลำดับ</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">ID Project</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ชื่อ Project</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">รูปถ่ายบิล</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ร้าน/บุคคล</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">สินค้า/ทำงาน</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">บิล</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">ประเภท</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">ยอดเงิน</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">เงื่อนไข</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">ผู้เบิก</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">ว/ด/ป</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row, idx) => {
                    const seq = String(row["ลำดับ"] || row._sheetRow || row.id || idx + 1);
                    const statusStr = String(row["สถานะ"] || "รออนุมัติ").trim();
                    const requesterKey = String(row["ผู้เบิก"] || "").trim();
                    const requesterName = requesterNames[requesterKey] || requesterKey || "-";
                    const conditions = formatBillConditions(row);

                    return (
                      <tr
                        key={`${seq}-${idx}`}
                        onClick={() => window.location.href = `/bills/${seq}`}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-2 px-3 text-center text-slate-900 border-r border-slate-100">{seq}</td>
                        <td className="py-2 px-3 text-center text-slate-900 border-r border-slate-100">{String(row["ID Project"] || "-")}</td>
                        <td className="py-2 px-3 text-slate-900 max-w-[200px] truncate border-r border-slate-100" title={String(row["ชื่อ Project"] || "")}>
                          {String(row["ชื่อ Project"] || "-")}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                          <BillImageThumbnail value={row["รูปถ่ายบิล"]} />
                        </td>
                        <td className="py-2 px-3 text-slate-800 max-w-[160px] truncate border-r border-slate-100" title={String(row["ร้าน/บุคคล"] || "")}>
                          {String(row["ร้าน/บุคคล"] || "-")}
                        </td>
                        <td className="py-2 px-3 text-slate-700 max-w-[180px] truncate border-r border-slate-100" title={String(row["สินค้า/ทำงาน"] || "")}>
                          {String(row["สินค้า/ทำงาน"] || "-")}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-700 border-r border-slate-100">{String(row["บิล"] || "-")}</td>
                        <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-100">{String(row["ประเภท"] || "-")}</td>
                        <td className="py-2 px-3 text-right text-slate-900 border-r border-slate-100">{money(row["ยอดเงิน"])}</td>
                        <td className="py-2 px-3 text-center text-xs text-slate-500 border-r border-slate-100">{conditions || "-"}</td>
                        <td className="py-2 px-3 text-center text-slate-700 border-r border-slate-100">{requesterName}</td>
                        <td className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-100 whitespace-nowrap">{formatDateDisplay(row["ว/ด/ป"])}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                            statusStr.includes("อนุมัติ")
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : statusStr.includes("เบิกแล้ว")
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {statusStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PAGINATION: SEPARATE SLEEK MOBILE & DESKTOP DESIGNS */}
        {filteredRows.length > 0 && (
          <>
            {/* 1. Sleek Mobile Pagination */}
            <div className="block md:hidden border-t border-slate-100 bg-slate-50/50">
              {totalPages <= 1 ? (
                <div className="p-3 text-center text-xs text-slate-400 font-medium">
                  แสดงทั้งหมด {filteredRows.length} รายการ
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 sm:p-3 text-xs">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(page - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition text-slate-700 flex items-center gap-1 cursor-pointer active:bg-slate-100 shadow-2xs"
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
                    onClick={() => setPage(page + 1)}
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
                แสดง <strong className="text-slate-800 ">{visibleStart}-{visibleEnd}</strong> จาก <strong className="text-slate-800 ">{filteredRows.length}</strong> รายการ
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 font-medium">แสดงต่อหน้า:</span>
                  {PAGE_SIZE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPageSize(opt)}
                      className={`px-2 py-0.5 rounded text-xs transition cursor-pointer ${
                        opt === pageSize ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(page - 1)}
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
                    onClick={() => setPage(page + 1)}
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

      {/* BILL DETAIL DRAWER & PROJECT DETAIL LINK */}
      {selectedDetailIndex !== null && (
        <BillDetailDrawer
          bill={visibleRows[selectedDetailIndex] || null}
          onClose={() => setSelectedDetailIndex(null)}
          onEdit={(bill) => {
            setSelectedDetailIndex(null);
            window.dispatchEvent(new CustomEvent("open-bill-edit-form", { detail: { row: bill } }));
          }}
          onDelete={isAdmin ? async (bill) => {
            const currentStatus = normalizeBillStatus(bill["สถานะ"]);
            if (currentStatus !== "รออนุมัติ") {
              showToast("error", "สามารถลบได้เฉพาะบิลที่มีสถานะรออนุมัติเท่านั้น");
              return;
            }
            const sheetRow = Number(bill.id || bill["ลำดับ"] || bill._sheetRow);
            const confirmed = await showConfirm(`คุณต้องการลบบิล ${String(bill["ลำดับ"] || bill.id || bill["รายการ"] || "")} ใช่หรือไม่?`);
            if (!confirmed) return;
            try {
              const res = await fetch("/api/rows", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tableName: "Data", ids: [sheetRow], sheetRows: [sheetRow] }),
              });
              if (res.ok) {
                setSelectedDetailIndex(null);
                showToast("success", "ลบบิลสำเร็จเรียบร้อย");
                router.refresh();
              } else {
                const err = await res.json();
                showToast("error", `ลบบิลไม่สำเร็จ: ${err.error || "เกิดข้อผิดพลาด"}`);
              }
            } catch (e: any) {
              showToast("error", `เกิดข้อผิดพลาด: ${e.message}`);
            }
          } : undefined}
          onPrev={() => setSelectedDetailIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setSelectedDetailIndex((i) => (i !== null && i < visibleRows.length - 1 ? i + 1 : i))}
          hasPrev={selectedDetailIndex > 0}
          hasNext={selectedDetailIndex < visibleRows.length - 1}
        />
      )}
    </div>
  );
}

