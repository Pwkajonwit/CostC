"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, List, Pencil, Plus, Save, Trash2, X, Search, ArrowDownUp, Download, Upload, FileSpreadsheet, Loader2, Crown, Check, CheckCheck, User, MessageSquare, Building, AlertTriangle, AlertCircle, CheckCircle2, Sparkles, Briefcase } from "lucide-react";
import { BillImageThumbnail } from "@/components/bills/BillImageThumbnail";
import { showConfirm, showToast } from "@/components/shared/ToastProvider";
import type { RowValue, SheetRow } from "@/lib/types";
import { formatDateDisplay, toInputDateValue } from "@/lib/utils/dates";
import { TABLES } from "@/lib/config";
import { toNumber } from "@/lib/utils/numbers";

type BusyState = "add" | "edit" | "delete" | "import" | null;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

type ManageTableClientProps = {
  tableName: string;
  viewName: string;
  columns: string[];
  formColumns: string[];
  rows: SheetRow[];
  keyColumn: string;
  search?: string;
  rowLabel?: string;
  detailBasePath?: string;
  addOpenEventName?: string;
  editOpenEventName?: string;
  displayLookups?: Record<string, Record<string, string>>;
};

export function ManageTableClient({
  tableName,
  viewName,
  columns,
  formColumns,
  rows: initialRows,
  keyColumn,
  search = "",
  rowLabel = "รายการ",
  detailBasePath,
  addOpenEventName,
  editOpenEventName,
  displayLookups = {}
}: ManageTableClientProps) {
  const router = useRouter();
  const visibleColumns = useMemo(() => columns.filter(column => column !== "_sheetRow"), [columns]);
  const primaryLinkColumn = useMemo(() => {
    const preferred = [
      "ชื่อ-นามสกุล",
      "ชื่อ Project",
      "ชื่อโครงการ",
      "ชื่อร้านค้า",
      "ชื่อร้าน",
      "ชื่อบริษัท",
      "ชื่อลูกค้า",
      "ชื่อธนาคาร",
      "ชื่อประเภทสินค้า",
      "หมายเลขทะเบียน",
      "ชื่อ",
      "ชื่อเล่น",
    ];
    for (const col of preferred) {
      if (visibleColumns.includes(col)) return col;
    }
    return visibleColumns[0] || "";
  }, [visibleColumns]);
  const addColumns = useMemo(() => formColumns.filter(column => column !== "_sheetRow"), [formColumns]);
  const [rows, setRows] = useState<SheetRow[]>(initialRows);
  const [addOpen, setAddOpen] = useState(false);
  const [addValues, setAddValues] = useState<Record<string, string>>(() => emptyValues(addColumns));
  const [editing, setEditing] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [draftRows, setDraftRows] = useState<Record<string, Record<string, string>>>({});
  const [selectedRows, setSelectedRows] = useState<(string | number)[]>([]);
  const [busy, setBusy] = useState<BusyState>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [localSearch, setLocalSearch] = useState(search);
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];
    if (localSearch.trim()) {
      const lower = localSearch.toLowerCase();
      result = result.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(lower)));
    }
    if (sortDesc) {
      result.reverse();
    }
    return result;
  }, [rows, localSearch, sortDesc]);

  const isContractorTable = tableName === TABLES.CONTRACTOR || tableName === "contractors" || tableName === "รับเหมา" || viewName.includes("รับเหมา");

  const contractorStats = useMemo(() => {
    if (!isContractorTable) return null;
    const total = rows.length;
    const individualCount = rows.filter(r => (r["ประเภท"] || r.contractor_type) === "บุคคลธรรมดา").length;
    const corporateCount = rows.filter(r => (r["ประเภท"] || r.contractor_type) === "นิติบุคคล").length;
    const overlimitCount = rows.filter(r => r._limitStatus === "เกินโควตา" || Number(r["คงเหลือ"]) < 0).length;
    const warningCount = rows.filter(r => r._limitStatus === "ใกล้เต็ม").length;
    const totalSpentThisYear = rows.reduce((sum, r) => sum + (Number(r["ยอดเบิกจ่ายปีนี้"]) || 0), 0);
    const targetYear = rows[0]?._targetYear || new Date().getFullYear();

    return {
      total,
      individualCount,
      corporateCount,
      overlimitCount,
      warningCount,
      totalSpentThisYear,
      targetYear
    };
  }, [isContractorTable, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleRows = filteredAndSortedRows.slice(startIndex, startIndex + pageSize);
  const visibleStart = visibleRows.length ? startIndex + 1 : 0;
  const visibleEnd = startIndex + visibleRows.length;

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    const handleDataUpdated = (event: Event) => {
      const customEvt = event as CustomEvent;
      const updatedTable = customEvt.detail?.tableName;
      if (!updatedTable || updatedTable === tableName || updatedTable === viewName) {
        reloadRows().catch(() => undefined);
      }
    };

    const handleInvalidated = () => {
      reloadRows().catch(() => undefined);
    };

    window.addEventListener("data-updated", handleDataUpdated);
    window.addEventListener("bills-data-updated", handleInvalidated);
    window.addEventListener("schema-cache-invalidated", handleInvalidated);

    return () => {
      window.removeEventListener("data-updated", handleDataUpdated);
      window.removeEventListener("bills-data-updated", handleInvalidated);
      window.removeEventListener("schema-cache-invalidated", handleInvalidated);
    };
  }, [tableName, viewName]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setAddValues(emptyValues(addColumns));
  }, [addColumns]);

  async function reloadRows() {
    const params = new URLSearchParams({
      tableName,
      viewName,
      limit: "1000",
      _t: String(Date.now())
    });
    if (search) params.set("search", search);
    const response = await fetch(`/api/rows?${params.toString()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
    setRows(payload.rows || []);
    router.refresh();
  }

  function openAddForm() {
    setError("");
    if (addOpenEventName) {
      window.dispatchEvent(new Event(addOpenEventName));
      return;
    }
    const initial = emptyValues(addColumns);
    if ("ลำดับ" in initial || "id" in initial) {
      const nextSeq = rows.reduce((max, r) => {
        const val = Number(r["ลำดับ"] || r["id"] || 0);
        return Number.isFinite(val) ? Math.max(max, val) : max;
      }, 0) + 1;
      if ("ลำดับ" in initial) initial["ลำดับ"] = String(nextSeq);
      if ("id" in initial) initial["id"] = String(nextSeq);
    }
    setAddValues(initial);
    setAddOpen(true);
  }

  async function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("add");
    setError("");
    try {
      await requestJson("/api/rows", {
        method: "POST",
        body: JSON.stringify({ tableName, row: addValues })
      });
      setAddOpen(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("schema-cache-invalidated"));
      }
      await reloadRows();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เพิ่มข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  function beginEdit() {
    setError("");
    setDeleteMode(false);
    setSelectedRows([]);
    setDraftRows(Object.fromEntries(rows.map((row, index) => [rowId(row, index, keyColumn), draftFromRow(row, visibleColumns)])));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraftRows({});
    setError("");
  }

  function updateDraft(id: string, column: string, value: string) {
    setDraftRows(current => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [column]: value
      }
    }));
  }

  async function saveEdit() {
    const changedRows = rows.flatMap((row, index) => {
      const id = rowId(row, index, keyColumn);
      const draft = draftRows[id];
      if (!draft) return [];
      const values = changedValues(row, draft, visibleColumns);
      const targetIdentifier = row.id ?? (keyColumn ? row[keyColumn] : undefined) ?? row._sheetRow ?? row.id_bank ?? row.id_store ?? (index + 2);
      return Object.keys(values).length ? [{ id: targetIdentifier, sheetRow: targetIdentifier, values }] : [];
    });

    if (!changedRows.length) {
      setEditing(false);
      setDraftRows({});
      return;
    }

    setBusy("edit");
    setError("");
    try {
      await requestJson("/api/rows", {
        method: "PATCH",
        body: JSON.stringify({ tableName, patches: changedRows })
      });
      setEditing(false);
      setDraftRows({});
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("schema-cache-invalidated"));
      }
      await reloadRows();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  function beginDelete() {
    setError("");
    setEditing(false);
    setDraftRows({});
    setSelectedRows([]);
    setDeleteMode(true);
  }

  function toggleSelected(sheetRow: string | number) {
    setSelectedRows(current => current.includes(sheetRow) ? current.filter(row => row !== sheetRow) : [...current, sheetRow]);
  }

  async function confirmDelete() {
    if (!selectedRows.length) {
      setError("เลือกแถวที่ต้องการลบก่อน");
      return;
    }
    const confirmed = await showConfirm(`ลบ ${selectedRows.length} ${rowLabel}?`);
    if (!confirmed) return;

    setBusy("delete");
    setError("");
    try {
      await requestJson("/api/rows", {
        method: "DELETE",
        body: JSON.stringify({ tableName, ids: selectedRows, sheetRows: selectedRows })
      });
      setDeleteMode(false);
      setSelectedRows([]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("schema-cache-invalidated"));
      }
      await reloadRows();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ลบข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function deleteSingleRow(sheetRow: string | number) {
    if (!sheetRow) {
      setError("ไม่พบตำแหน่งแถวสำหรับลบ");
      return;
    }
    const confirmed = await showConfirm("คุณต้องการลบรายการนี้ใช่หรือไม่?");
    if (!confirmed) return;
    setBusy("delete");
    setError("");
    try {
      await requestJson("/api/rows", {
        method: "DELETE",
        body: JSON.stringify({ tableName, ids: [sheetRow], sheetRows: [sheetRow] })
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("schema-cache-invalidated"));
      }
      await reloadRows();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ลบข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  function exportToCSV() {
    if (!rows || rows.length === 0) {
      showToast("error", "ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const exportCols = visibleColumns.filter(c => c !== "_sheetRow");
    
    // Header line
    const headerLine = exportCols.map(c => `"${c.replace(/"/g, '""')}"`).join(",");

    // Data lines
    const dataLines = filteredAndSortedRows.map(row => {
      return exportCols.map(col => {
        const rawVal = row[col] !== undefined && row[col] !== null ? String(row[col]) : "";
        return `"${rawVal.replace(/"/g, '""')}"`;
      }).join(",");
    });

    // Combine with UTF-8 BOM (\uFEFF) for Excel Thai compatibility
    const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${viewName || tableName || "export"}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast("success", `ส่งออกข้อมูล ${filteredAndSortedRows.length} รายการเป็น CSV เรียบร้อยแล้ว`);
  }

  function handleImportCSV(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy("import");
    setImportProgress({ current: 0, total: 0, message: "กำลังอ่านไฟล์ CSV..." });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("ไฟล์เป็นแผ่นว่างเปล่า");

        const parsedRows = parseCSVText(text);
        if (parsedRows.length === 0) throw new Error("ไม่พบข้อมูลในไฟล์ CSV");

        setImportProgress({
          current: Math.floor(parsedRows.length / 2),
          total: parsedRows.length,
          message: `กำลังนำเข้าข้อมูล ${parsedRows.length} รายการเข้าสู่ Supabase...`
        });

        // Fast Bulk Batch Insert (Single Query Batch)
        const res = await requestJson("/api/rows", {
          method: "POST",
          body: JSON.stringify({ tableName, rows: parsedRows })
        });

        const successCount = res.count || parsedRows.length;

        setImportProgress({
          current: parsedRows.length,
          total: parsedRows.length,
          message: "นำเข้าข้อมูลสำเร็จแล้ว กำลังรีเฟรชตาราง..."
        });

        showToast("success", `นำเข้าข้อมูลสำเร็จ ${successCount} จาก ${parsedRows.length} รายการ`);
        await reloadRows();
      } catch (err) {
        showToast("error", err instanceof Error ? err.message : "นำเข้าไฟล์ CSV ไม่สำเร็จ");
      } finally {
        setBusy(null);
        setImportProgress(null);
        event.target.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function detectDelimiter(firstLine: string): string {
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    if (tabCount > commaCount && tabCount > semiCount) return "\t";
    if (semiCount > commaCount) return ";";
    return ",";
  }

  function parseCSVText(text: string): Record<string, string>[] {
    const cleanText = text.replace(/^\uFEFF/, "").trim();
    if (!cleanText) return [];

    const firstLineEnd = cleanText.indexOf("\n");
    const firstLine = firstLineEnd !== -1 ? cleanText.slice(0, firstLineEnd) : cleanText;
    const delimiter = detectDelimiter(firstLine);

    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentCell = "";
    let insideQuote = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        currentLine.push(currentCell.trim());
        currentCell = "";
      } else if ((char === '\r' || char === '\n') && !insideQuote) {
        if (char === '\r' && nextChar === '\n') i++;
        currentLine.push(currentCell.trim());
        if (currentLine.some(cell => cell.length > 0)) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    if (currentCell.length > 0 || currentLine.length > 0) {
      currentLine.push(currentCell.trim());
      if (currentLine.some(cell => cell.length > 0)) {
        lines.push(currentLine);
      }
    }

    if (lines.length < 2) return [];

    const rawHeaders = lines[0].map(h => h.replace(/^"+|"+$/g, '').trim());
    
    // Normalize headers to match table/view columns
    const headers = rawHeaders.map(h => {
      const cleanH = h.trim();
      const matchedCol = columns.find(c => c.toLowerCase() === cleanH.toLowerCase() || c === cleanH);
      return matchedCol || cleanH;
    });

    const dataRowsResult: Record<string, string>[] = [];

    for (let r = 1; r < lines.length; r++) {
      const rowValues = lines[r];
      const rowObj: Record<string, string> = {};
      let hasData = false;
      headers.forEach((h, colIdx) => {
        if (h) {
          let val = rowValues[colIdx] ?? "";
          val = val.replace(/^"+|"+$/g, '').trim();
          rowObj[h] = val;
          if (val) hasData = true;
        }
      });
      if (hasData) {
        dataRowsResult.push(rowObj);
      }
    }

    return dataRowsResult;
  }

  return (
    <div className="w-full flex flex-col gap-3 p-3 sm:p-4 max-w-[1600px] mx-auto font-sans text-xs text-slate-800">
      {/* CONTRACTOR ANNUAL LIMIT KPI STRIP */}
      {contractorStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-2xs font-medium">ผู้รับเหมาทั้งหมด</span>
              <Briefcase size={14} className="text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-slate-900 font-mono">{contractorStats.total}</span>
              <span className="text-2xs text-slate-400">ราย</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-sky-200 bg-sky-50/20 rounded-lg shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-sky-700">
              <span className="text-2xs font-medium">บุคคลธรรมดา (1.2M)</span>
              <User size={14} className="text-sky-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-sky-900 font-mono">{contractorStats.individualCount}</span>
              <span className="text-2xs text-sky-600">ราย</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-purple-200 bg-purple-50/20 rounded-lg shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-700">
              <span className="text-2xs font-medium">นิติบุคคล (2-5M)</span>
              <Building size={14} className="text-purple-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-purple-900 font-mono">{contractorStats.corporateCount}</span>
              <span className="text-2xs text-purple-600">ราย</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-emerald-200 bg-emerald-50/20 rounded-lg shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-2xs font-medium">ยอดเบิกจ่ายปี {contractorStats.targetYear}</span>
              <Sparkles size={14} className="text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-base font-bold text-emerald-900 font-mono">฿{contractorStats.totalSpentThisYear.toLocaleString()}</span>
            </div>
          </div>

          <div className={`p-3 border rounded-lg shadow-2xs flex flex-col justify-between ${
            contractorStats.overlimitCount > 0
              ? "bg-rose-50/50 border-rose-300"
              : contractorStats.warningCount > 0
                ? "bg-amber-50/50 border-amber-300"
                : "bg-white border-slate-200"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-2xs font-medium text-slate-600">เตือนโควตารายปี</span>
              {contractorStats.overlimitCount > 0 ? (
                <AlertTriangle size={14} className="text-rose-600" />
              ) : (
                <CheckCircle2 size={14} className="text-emerald-500" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              {contractorStats.overlimitCount > 0 ? (
                <span className="text-sm font-bold text-rose-700">
                  เกินโควตา {contractorStats.overlimitCount} ราย
                </span>
              ) : contractorStats.warningCount > 0 ? (
                <span className="text-sm font-bold text-amber-700">
                  ใกล้เต็ม {contractorStats.warningCount} ราย
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700">
                  อยู่ในเกณฑ์ปกติทั้งหมด
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FILTER & ACTION TOOLBAR (With View Name & Count) */}
      <div className="border border-slate-200 rounded-md p-2.5 sm:p-3 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs">
        {/* Left Side: Title & Live Search */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">{viewName}</h1>
            <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200 font-medium">
              {filteredAndSortedRows.length} {rowLabel}
            </span>
          </div>

          {/* Live Search Input Box */}
          <div className="relative flex items-center flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              className="w-full bg-white text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-500 placeholder:text-slate-400 transition"
            />
            {localSearch && (
              <X size={14} className="absolute right-2 text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setLocalSearch("")} />
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 bg-[#d4f54e] hover:bg-[#c2e438] text-[#0b3531] text-xs rounded-lg shadow-2xs border border-[#b8df28] transition cursor-pointer flex items-center gap-1.5 shrink-0"
            disabled={Boolean(busy)}
            onClick={openAddForm}
          >
            <Plus size={15} />
            <span>เพิ่มข้อมูล</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportToCSV}
            className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            title="ส่งออกไฟล์ CSV (UTF-8)"
          >
            <Download size={14} className="text-emerald-600 shrink-0" />
            <span>ส่งออก CSV</span>
          </button>

          {/* Import CSV Button */}
          <label className={`px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${busy === "import" ? "opacity-60 cursor-not-allowed" : ""}`}>
            {busy === "import" ? (
              <Loader2 size={14} className="text-indigo-600 animate-spin shrink-0" />
            ) : (
              <Upload size={14} className="text-indigo-600 shrink-0" />
            )}
            <span>{busy === "import" ? "กำลังนำเข้า..." : "นำเข้า CSV"}</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
              disabled={Boolean(busy)}
            />
          </label>

          <button
            type="button"
            onClick={() => setSortDesc(!sortDesc)}
            className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            title="สลับการเรียงลำดับ"
          >
            <ArrowDownUp size={14} className="text-slate-600 shrink-0" />
            <span>{sortDesc ? "ล่าสุดก่อน" : "เก่าสุดก่อน"}</span>
          </button>



          {deleteMode ? (
            <>
              <button
                type="button"
                className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                disabled={busy === "delete" || !selectedRows.length}
                onClick={confirmDelete}
              >
                <Trash2 size={14} />
                <span>ยืนยันลบ ({selectedRows.length})</span>
              </button>
              <button
                type="button"
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                disabled={Boolean(busy)}
                onClick={() => { setDeleteMode(false); setSelectedRows([]); }}
              >
                <X size={14} />
                <span>ยกเลิก</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              disabled={Boolean(busy) || !rows.length}
              onClick={beginDelete}
            >
              <Trash2 size={14} className="text-slate-600 shrink-0" />
              <span>เลือกลบ</span>
            </button>
          )}
        </div>
      </div>

      {error ? <div className="p-3 bg-rose-50 text-rose-700 rounded-md border border-rose-200 text-xs ">{error}</div> : null}

      {/* 3. WORK TABLE CARD */}
      <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 text-xs">
                  {deleteMode ? (
                    <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200">
                      <input
                        type="checkbox"
                        checked={
                          visibleRows.length > 0 &&
                          visibleRows.every((r, i) => {
                            const sr = getRowKey(r, startIndex + i, keyColumn);
                            return selectedRows.includes(sr);
                          })
                        }
                        onChange={(e) => {
                          const visibleSheetRows = visibleRows.map((r, i) => getRowKey(r, startIndex + i, keyColumn));
                          if (e.target.checked) {
                            setSelectedRows(prev => [...new Set([...prev, ...visibleSheetRows])]);
                          } else {
                            const visibleSet = new Set(visibleSheetRows);
                            setSelectedRows(prev => prev.filter(id => !visibleSet.has(id)));
                          }
                        }}
                        title="เลือกทั้งหมด"
                        className="cursor-pointer rounded border-slate-300 accent-slate-900"
                      />
                    </th>
                  ) : null}
                  {visibleColumns.map(column => (
                    <th
                      key={column}
                      data-label={column}
                      className={`py-2.5 px-3 border-r border-slate-200 ${
                        isAmountColumn(column) ? "text-right" : isCenterColumn(column) || isDateColumn(column) ? "text-center" : ""
                      }`}
                    >
                      {column}
                    </th>
                  ))}
                  {!editing && !deleteMode ? <th className="py-2.5 px-3 text-center" data-label="จัดการ">จัดการ</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const rowIndex = startIndex + index;
                  const id = rowId(row, rowIndex, keyColumn);
                  const sheetRow = getRowKey(row, rowIndex, keyColumn);
                  const targetKey = String(row[keyColumn] || row.id_store || row.id_Contractor || row.id_bank || row["ID Project"] || row["ชื่อร้าน"] || row["ชื่อร้านค้า"] || row.id || sheetRow || "");

                  return (
                    <tr key={id}>
                      {deleteMode ? (
                        <td className="py-2.5 px-3.5 text-center w-10" data-label="เลือก">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(sheetRow)}
                            disabled={Boolean(busy)}
                            onChange={() => toggleSelected(sheetRow)}
                            className="cursor-pointer w-4 h-4 rounded border-slate-300 accent-slate-900"
                          />
                        </td>
                      ) : null}
                      {visibleColumns.map(column => {
                        const draftValue = draftRows[id]?.[column] ?? stringify(row[column]);
                        const cellContent = renderDisplayCell(column, row[column], displayLookups, row);
                        const isLinkColumn = column === primaryLinkColumn;

                        return (
                          <td
                            key={column}
                            className={[
                              "py-2 px-3 text-xs border-r border-slate-100",
                              isAmountColumn(column) ? "text-right text-slate-900" : "",
                              isCenterColumn(column) ? "text-center" : "",
                              isDateColumn(column) ? "text-center" : "",
                              editing ? "editing-cell" : ""
                            ].filter(Boolean).join(" ") || undefined}
                            data-column={column}
                            data-label={column}
                          >
                            {editing ? (
                              isDateColumn(column) ? (
                                <input
                                  type="date"
                                  className="w-full px-2 py-0.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-slate-500 cursor-pointer"
                                  value={toInputDateValue(draftValue)}
                                  onChange={event => updateDraft(id, column, event.target.value)}
                                />
                              ) : (
                                <input
                                  className="w-full px-2 py-0.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-slate-500"
                                  value={draftValue}
                                  onChange={event => updateDraft(id, column, event.target.value)}
                                />
                              )
                            ) : detailBasePath && isLinkColumn ? (
                              <Link
                                href={`${detailBasePath}/${encodeURIComponent(targetKey)}`}
                                className="text-slate-900 hover:underline"
                              >
                                {cellContent}
                              </Link>
                            ) : (
                              cellContent
                            )}
                          </td>
                        );
                      })}
                      {!editing && !deleteMode ? (
                        <td className="py-2 px-3 text-center w-20" data-label="จัดการ">
                          <div className="flex items-center justify-center gap-1 min-w-[50px]">
                            {editOpenEventName ? (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-6 h-6 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                disabled={Boolean(busy)}
                                onClick={() => {
                                  if (typeof window !== "undefined") {
                                    window.dispatchEvent(new CustomEvent(editOpenEventName, { detail: { row } }));
                                  }
                                }}
                                aria-label="แก้ไข"
                                title="แก้ไข"
                              >
                                <Pencil size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-6 h-6 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                disabled={Boolean(busy)}
                                onClick={() => { setEditing(true); setDraftRows({ [id]: draftFromRow(row, visibleColumns) }); }}
                                aria-label="แก้ไข"
                                title="แก้ไข"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-6 h-6 rounded border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                              disabled={Boolean(busy) || !sheetRow}
                              onClick={() => deleteSingleRow(sheetRow)}
                              aria-label="ลบ"
                              title="ลบ"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">ไม่พบข้อมูล</div>
        )}
        {rows.length ? (
          <ManagePagination
            currentPage={currentPage}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSize={pageSize}
            rowLabel={rowLabel}
            totalPages={totalPages}
            totalRows={rows.length}
            visibleEnd={visibleEnd}
            visibleStart={visibleStart}
          />
        ) : null}
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" role="presentation">
          <form
            className="w-full max-w-xl bg-white rounded-md shadow-xl overflow-hidden flex flex-col border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-add-title"
            onSubmit={submitAdd}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
              <div>
                <h3 id="manage-add-title" className="text-sm text-slate-900 m-0">เพิ่มข้อมูล</h3>
                <span className="text-xs text-slate-500 font-normal">{viewName}</span>
              </div>
              <button
                type="button"
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="ปิด"
                disabled={Boolean(busy)}
                onClick={() => setAddOpen(false)}
              >
                <X size={16} />
              </button>
            </header>
            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addColumns.map(column => (
                  <label className="flex flex-col gap-1 text-xs" key={column}>
                    <span className="text-slate-700">{column}</span>
                    {isDateColumn(column) ? (
                      <input
                        type="date"
                        name={column}
                        value={toInputDateValue(addValues[column])}
                        disabled={Boolean(busy)}
                        onChange={event => setAddValues(current => ({ ...current, [column]: event.target.value }))}
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 focus:border-slate-500 focus:outline-none rounded text-xs font-normal text-slate-900 transition cursor-pointer"
                      />
                    ) : (
                      <input
                        name={column}
                        value={addValues[column] || ""}
                        disabled={Boolean(busy)}
                        onChange={event => setAddValues(current => ({ ...current, [column]: event.target.value }))}
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 focus:border-slate-500 focus:outline-none rounded text-xs font-normal text-slate-900 placeholder:text-slate-400 transition"
                      />
                    )}
                  </label>
                ))}
              </div>
              {error ? <div className="p-2.5 bg-rose-50 text-rose-700 rounded text-xs font-medium border border-rose-200">{error}</div> : null}
            </div>
            <footer className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setAddOpen(false)}
                className="px-3 py-1 rounded text-xs text-slate-700 hover:bg-slate-200 transition"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={busy === "add"}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
              >
                <Save size={14} />
                <span>บันทึก</span>
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {/* 5. IMPORT PROGRESS MODAL OVERLAY */}
      {importProgress && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-900">กำลังนำเข้าข้อมูล...</h3>
              <p className="text-xs text-slate-600 font-medium">{importProgress.message}</p>
            </div>
            {importProgress.total > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                    style={{ width: `${Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>{importProgress.current} / {importProgress.total} รายการ</span>
                  <span>{Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%</span>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400">กรุณารอสักครู่ ระบบกำลังบันทึกลงฐานข้อมูล Supabase</p>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyValues(columns: string[]) {
  return Object.fromEntries(columns.map(column => [column, ""]));
}

function ManagePagination({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSize,
  rowLabel,
  totalPages,
  totalRows,
  visibleEnd,
  visibleStart
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSize: number;
  rowLabel: string;
  totalPages: number;
  totalRows: number;
  visibleEnd: number;
  visibleStart: number;
}) {
  const pages = pageWindow(currentPage, totalPages);
  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600" aria-label="pagination">
      <div className="flex items-center gap-3 font-medium">
        <span>แสดง {visibleStart}-{visibleEnd} จาก {totalRows} {rowLabel}</span>
        <div className="flex items-center gap-1" aria-label="rows per page">
          <span className="flex items-center gap-1 text-slate-500 font-medium text-xs">
            <span>ต่อหน้า:</span>
          </span>
          <div className="flex items-center gap-1">
            {PAGE_SIZE_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                className={`px-2 py-0.5 rounded text-xs transition cursor-pointer ${
                  option === pageSize
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                }`}
                aria-current={option === pageSize ? "true" : undefined}
                onClick={() => onPageSizeChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
      <nav className="flex items-center gap-1" aria-label="table pages">
        <PageButton disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft size={14} aria-hidden="true" />
          <span>ก่อนหน้า</span>
        </PageButton>
        {pages.map((page, index) => (
          page === "ellipsis" ? (
            <span className="px-1 text-xs text-slate-400 " key={`ellipsis-${index}`}>...</span>
          ) : (
            <button
              key={page}
              type="button"
              className={`min-w-6 h-6 px-1.5 rounded text-xs transition cursor-pointer ${
                page === currentPage
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              }`}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        ))}
        <PageButton disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <span>ถัดไป</span>
          <ChevronRight size={14} aria-hidden="true" />
        </PageButton>
      </nav>
    </div>
  );
}

function PageButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function pageWindow(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) pages.push("ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

function rowId(row: SheetRow, index: number, keyColumn: string) {
  return String(row.id ?? (keyColumn ? row[keyColumn] : undefined) ?? row._sheetRow ?? index);
}

function draftFromRow(row: SheetRow, columns: string[]) {
  return Object.fromEntries(columns.map(column => [column, stringify(row[column])]));
}

function changedValues(row: SheetRow, draft: Record<string, string>, columns: string[]) {
  return Object.fromEntries(
    columns
      .filter(column => stringify(row[column]) !== (draft[column] ?? ""))
      .map(column => [column, draft[column] ?? ""])
  );
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "ดำเนินการไม่สำเร็จ");
  return payload;
}

function stringify(value: RowValue | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatValue(value: RowValue | undefined, column = "") {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  if (isAmountColumn(column)) {
    const parsed = Number(String(value).replace(/,/g, ""));
    if (Number.isFinite(parsed) && String(value).trim() !== "") {
      return parsed.toLocaleString("th-TH", { maximumFractionDigits: 2 });
    }
  }
  return String(value);
}

function renderDisplayCell(column: string, value: RowValue | undefined, displayLookups: Record<string, Record<string, string>>, row?: SheetRow) {
  if (isImageColumn(column)) return <BillImageThumbnail value={value} />;
  if (column === "color") return <ColorDot value={value} />;

  // 1.5 Contractor Annual Limits & Quota
  if (column === "ประเภท" && (value === "บุคคลธรรมดา" || value === "นิติบุคคล" || row?.["id_Contractor"])) {
    const typeStr = String(value || row?.["ประเภท"] || "").trim();
    if (typeStr === "นิติบุคคล") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold shadow-2xs whitespace-nowrap">
          <Building size={12} className="text-purple-600 shrink-0" />
          <span>นิติบุคคล</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold shadow-2xs whitespace-nowrap">
        <User size={12} className="text-sky-600 shrink-0" />
        <span>บุคคลธรรมดา</span>
      </span>
    );
  }

  if (column === "จำกัดยอด/ปี" || column === "annual_limit") {
    const num = toNumber(value);
    return (
      <span className="font-mono font-medium text-slate-800 whitespace-nowrap">
        {num > 0 ? `฿${num.toLocaleString()}` : "-"}
      </span>
    );
  }

  if (column === "ยอดเบิกจ่ายปีนี้") {
    const spent = toNumber(value);
    const limit = toNumber(row?.["จำกัดยอด/ปี"] || row?.annual_limit);
    const percent = row?._spentPercent !== undefined ? Number(row._spentPercent) : (limit > 0 ? (spent / limit) * 100 : 0);
    const cappedPercent = Math.min(100, Math.max(0, percent));
    const isOver = percent >= 100;
    const isNear = percent >= 70 && !isOver;

    const barColor = isOver ? "bg-rose-500" : isNear ? "bg-amber-500" : "bg-emerald-500";
    const textColor = isOver ? "text-rose-700 font-bold" : isNear ? "text-amber-700 font-semibold" : "text-slate-800 font-medium";

    return (
      <div className="w-full min-w-[130px] flex flex-col gap-1 py-0.5">
        <div className="flex items-center justify-between text-2xs gap-1.5">
          <span className={`font-mono text-xs ${textColor}`}>฿{spent.toLocaleString()}</span>
          <span className={`px-1.5 py-0.2 rounded text-2xs font-semibold shrink-0 ${
            isOver ? "bg-rose-100 text-rose-700 border border-rose-200" : isNear ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}>
            {percent.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/80">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${cappedPercent}%` }}
          />
        </div>
      </div>
    );
  }

  if (column === "คงเหลือ") {
    const rem = toNumber(value);
    const isOver = rem < 0;
    return (
      <span className={`font-mono text-xs font-semibold whitespace-nowrap ${isOver ? "text-rose-600 flex items-center gap-1" : "text-emerald-700"}`}>
        {isOver ? <AlertTriangle size={12} className="text-rose-600 shrink-0" /> : null}
        <span>{rem < 0 ? `-฿${Math.abs(rem).toLocaleString()}` : `฿${rem.toLocaleString()}`}</span>
      </span>
    );
  }

  if (column === "สถานะ" && (row?._limitStatus || row?.["id_Contractor"])) {
    const status = String(value || row?._limitStatus || "ปกติ").trim();
    if (status === "เกินโควตา") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-2xs font-bold shadow-2xs whitespace-nowrap">
          <AlertTriangle size={11} className="text-rose-600 shrink-0" />
          <span>เกินโควตา</span>
        </span>
      );
    }
    if (status === "ใกล้เต็ม") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-2xs font-semibold shadow-2xs whitespace-nowrap">
          <AlertCircle size={11} className="text-amber-600 shrink-0" />
          <span>ใกล้เต็ม (&gt;70%)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-2xs font-medium shadow-2xs whitespace-nowrap">
        <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
        <span>ปกติ</span>
      </span>
    );
  }

  // 1. LINE Column Display with Icon
  if (column === "LINE" || column === "LINE User ID" || column === "สถานะ LINE") {
    const lineUserId = String(row?.line_user_id || row?.["LINE User ID"] || row?.["LINE"] || value || "").trim();
    const pic = row?.pictureUrl || row?.pictureurl;
    const isLinked = Boolean(lineUserId && lineUserId.length > 5 && lineUserId !== "-");

    if (isLinked) {
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium cursor-pointer hover:bg-emerald-100 hover:border-emerald-300 transition shadow-2xs group"
          title={`LINE ID: ${lineUserId} (คลิกเพื่อคัดลอก ID)`}
          onClick={(e) => {
            e.stopPropagation();
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(lineUserId);
              showToast("success", "คัดลอก LINE User ID เรียบร้อย");
            }
          }}
        >
          {pic ? (
            <img src={pic} alt="" className="w-4 h-4 rounded-full object-cover border border-emerald-400 shrink-0" />
          ) : (
            <svg className="w-3.5 h-3.5 fill-[#06C755] shrink-0" viewBox="0 0 24 24">
              <path d="M24 10.304c0-4.58-4.51-8.304-10.05-8.304-5.543 0-10.05 3.724-10.05 8.304 0 4.1 3.58 7.53 8.42 8.16.33.07.77.21.88.49.1.26.07.66.03.93l-.15.93c-.05.29-.24 1.13.99.62 1.23-.52 6.64-3.91 9.07-6.69 1.57-1.74 2.86-3.83 2.86-6.44zm-14.88 1.9h-1.87v-3.79h.61v3.18h1.26v.61zm2.39 0h-.61v-3.79h.61v3.79zm3.56 0h-.62l-1.39-2.07v2.07h-.61v-3.79h.62l1.39 2.06v-2.06h.61v3.79zm3.32-3.18h-1.25v.98h1.25v.6h-1.25v1.0h1.25v.6h-1.86v-3.79h1.86v.61z" />
            </svg>
          )}
          <span className="text-[11px] font-semibold text-emerald-700">เชื่อมต่อแล้ว</span>
        </div>
      );
    }

    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <span className="text-[11px]">ยังไม่ผูก</span>
      </div>
    );
  }

  // 2. Permission Column Display with Icons
  if (column === "สิทธิ์การใช้งาน" || column === "สิทธิ์") {
    const permStr = String(value || row?.["สิทธิ์การใช้งาน"] || "");
    const hasOwner = permStr.includes("Owner") || permStr.includes("เจ้าของระบบ") || Boolean(row?.is_owner) || Boolean(row?.["เจ้าของระบบ"]);
    const hasApprover = permStr.includes("Approver") || permStr.includes("อนุมัติบิล") || Boolean(row?.can_close_bill) || Boolean(row?.["อนุมัติบิล"]);
    const hasFinance = permStr.includes("Finance") || permStr.includes("ฝ่ายการเงิน") || permStr.includes("ปิดบิล") || Boolean(row?.can_approve) || Boolean(row?.["ฝ่ายการเงิน"]);
    const hasDelete = permStr.includes("Delete") || permStr.includes("ลบข้อมูล") || Boolean(row?.can_delete) || Boolean(row?.["สิทธิ์ลบข้อมูล"]);

    const badges: ReactNode[] = [];
    if (hasOwner) {
      badges.push(
        <span key="owner" title="เจ้าของระบบ (Owner)" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold shadow-2xs">
          <Crown size={12} className="text-amber-600 shrink-0" />
          <span>เจ้าของ</span>
        </span>
      );
    }
    if (hasApprover) {
      badges.push(
        <span key="approver" title="อนุมัติบิล (Approver)" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-2xs">
          <Check size={12} className="text-emerald-600 shrink-0" />
          <span>อนุมัติ</span>
        </span>
      );
    }
    if (hasFinance) {
      badges.push(
        <span key="finance" title="ฝ่ายการเงิน (Finance)" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold shadow-2xs">
          <CheckCheck size={12} className="text-blue-600 shrink-0" />
          <span>การเงิน</span>
        </span>
      );
    }
    if (hasDelete) {
      badges.push(
        <span key="delete" title="สิทธิ์ลบข้อมูล (Delete)" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium shadow-2xs">
          <Trash2 size={11} className="text-rose-600 shrink-0" />
          <span>ลบได้</span>
        </span>
      );
    }

    if (badges.length === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 text-xs">
          <User size={11} className="text-slate-400" />
          <span>ทั่วไป</span>
        </span>
      );
    }

    return <div className="inline-flex flex-wrap items-center gap-1">{badges}</div>;
  }

  const rawValue = stringify(value);
  const lookup = displayLookups[column];
  if (lookup && rawValue) return lookup[rawValue] || rawValue.replace(/^Ba\d+\s*[-–—]?\s*/i, "");
  if ((column === "ธนาคาร" || column === "bank" || column === "bank_name") && rawValue) {
    return rawValue.replace(/^Ba\d+\s*[-–—]?\s*/i, "").trim() || rawValue;
  }
  if (column === "เครดิตจ่าย" && rawValue && rawValue !== "-") {
    const match = rawValue.match(/\d+/);
    if (match) {
      const dayNum = parseInt(match[0], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px] bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs">
            <span>🗓️</span>
            <span>วันที่ {dayNum} ของเดือน</span>
          </span>
        );
      }
    }
    return rawValue;
  }
  if (isDateColumn(column) && rawValue) return formatDateDisplay(rawValue);
  return formatValue(value, column);
}

function ColorDot({ value }: { value: RowValue | undefined }) {
  const raw = stringify(value).trim();
  const tone = raw.toLowerCase();
  const isRed = tone === "red" || tone.includes("แดง") || tone.includes("ใหญ่");
  const isGreen = tone === "green" || tone.includes("เขียว") || tone.includes("เล็ก");
  const isBlack = tone === "black" || tone.includes("ดำ") || tone.includes("เสร็จ");

  const bgClass = isGreen
    ? "bg-emerald-500 ring-2 ring-emerald-200"
    : isRed
      ? "bg-rose-500 ring-2 ring-rose-200"
      : isBlack
        ? "bg-slate-900 ring-2 ring-slate-300"
        : "bg-slate-200";

  const displayTitle = isRed
    ? "Red (งานใหญ่)"
    : isGreen
      ? "Green (งานเล็ก)"
      : isBlack
        ? "Black (งานเสร็จแล้ว)"
        : raw || "-";

  return (
    <span className="inline-flex items-center gap-1.5" title={displayTitle}>
      <span className={`w-2.5 h-2.5 rounded-full ${bgClass} transition-all shrink-0`} aria-label={displayTitle} />
      <span className="text-xs text-slate-700">{displayTitle}</span>
    </span>
  );
}

function isImageColumn(column: string) {
  return column === "image" || column.includes("รูปถ่าย") || column.toLowerCase().includes("image");
}

function isDateColumn(column: string) {
  return /วันที่|date|ว\/ด\/ป|ดู\/ทำ|ส่งงาน|นัดดู|นัดเสนอ|วันเริ่ม|วันจบ/.test(column);
}

function isCenterColumn(column: string) {
  return column === "color" || column === "COLOR" || column === "จัดการ" || column === "ประเภท" || column === "สถานะ" || column === "เครดิตจ่าย";
}

function isAmountColumn(column: string) {
  if (column === "เครดิตจ่าย") return false;
  return /ยอด|เงิน|ราคา|vat|หัก|เครดิต|ค่าแรง|รวม|คงเหลือ|โอน|งบ/.test(column);
}

function getRowKey(row: SheetRow, defaultIndex: number, keyColumn?: string): string | number {
  const val = row.id ?? (keyColumn ? row[keyColumn] : undefined) ?? row.id_store ?? row.id_bank ?? row.id_Contractor ?? row.id_car ?? row.id_cus ?? row.id_Company ?? row._sheetRow;
  if (typeof val === "string" || typeof val === "number") return val;
  return defaultIndex;
}

