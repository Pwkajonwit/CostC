"use client";

import { useMemo, useState } from "react";
import {
  History,
  FileSpreadsheet,
  Upload,
  RotateCcw,
  HardDriveDownload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Download,
  Eye,
  X,
  FileText,
  Clock,
  Layers,
  Database,
  User,
  AlertCircle
} from "lucide-react";
import type { ImportHistoryItem, ImportType, ImportStatus } from "@/lib/import-history-service";
import { showToast } from "@/components/shared/ToastProvider";

interface ImportHistoryViewProps {
  history: ImportHistoryItem[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onNavigateToImport?: () => void;
}

export function ImportHistoryView({
  history,
  loading,
  onRefresh,
  onDeleteEntry,
  onClearAll,
  onNavigateToImport
}: ImportHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | ImportType>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | ImportStatus>("all");
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<ImportHistoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ImportHistoryItem | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    const totalImports = history.length;
    const totalRowsImported = history.reduce((sum, h) => sum + (h.successCount || 0), 0);
    const successImports = history.filter((h) => h.status === "success").length;
    const successRate = totalImports > 0 ? Math.round((successImports / totalImports) * 100) : 100;
    const lastImportTime = history[0]?.createdAt
      ? new Date(history[0].createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
      : "ยังไม่มีประวัติ";

    return {
      totalImports,
      totalRowsImported,
      successRate,
      lastImportTime
    };
  }, [history]);

  // Filtered List
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.tableName && item.tableName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.actor && item.actor.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = selectedType === "all" || item.importType === selectedType;
      const matchStatus = selectedStatus === "all" || item.status === selectedStatus;

      return matchSearch && matchType && matchStatus;
    });
  }, [history, searchQuery, selectedType, selectedStatus]);

  // Export History as CSV
  function handleExportHistoryCSV() {
    if (history.length === 0) {
      showToast("info", "ยังไม่มีประวัติการนำเข้าข้อมูลให้ส่งออก");
      return;
    }

    const headers = [
      "รหัสการนำเข้า",
      "วันที่และเวลา",
      "ประเภท",
      "ชื่อหัวข้อ",
      "ตารางเป้าหมาย",
      "ชื่อไฟล์",
      "จำนวนแถวทั้งหมด",
      "สำเร็จ",
      "ล้มเหลว",
      "สถานะ",
      "ผู้ดำเนินการ"
    ];

    const rows = history.map((h) => [
      `"${h.id}"`,
      `"${new Date(h.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}"`,
      `"${getTypeLabel(h.importType)}"`,
      `"${h.title.replace(/"/g, '""')}"`,
      `"${(h.tableName || "-").replace(/"/g, '""')}"`,
      `"${h.fileName.replace(/"/g, '""')}"`,
      `"${h.totalRows}"`,
      `"${h.successCount}"`,
      `"${h.failedCount}"`,
      `"${getStatusLabel(h.status)}"`,
      `"${(h.actor || "system").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CostLab_Import_History_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("success", "ส่งออกรายงานประวัติการนำเข้าเป็นไฟล์ CSV สำเร็จ");
  }

  // Handle single delete
  async function confirmDeleteSingle() {
    if (!itemToDelete) return;
    setActionLoading(true);
    try {
      await onDeleteEntry(itemToDelete.id);
      showToast("success", "ลบรายการประวัติการนำเข้าเรียบร้อยแล้ว");
      setItemToDelete(null);
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "ลบรายการประวัติไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  // Handle clear all
  async function confirmClearAll() {
    setActionLoading(true);
    try {
      await onClearAll();
      showToast("success", "ล้างประวัติการนำเข้าข้อมูลทั้งหมดเรียบร้อยแล้ว");
      setIsClearingAll(false);
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "ล้างประวัติไม่สำเร็จ");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. COMPACT OVERVIEW BAR */}
      <div className="bg-white border border-slate-200/90 rounded-xl px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">นำเข้าทั้งหมด:</span>
            <span className="font-bold text-slate-900 font-mono">{stats.totalImports.toLocaleString()} ครั้ง</span>
          </div>
          <span className="text-slate-200 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">ข้อมูลรวม:</span>
            <span className="font-bold text-emerald-700 font-mono">+{stats.totalRowsImported.toLocaleString()} แถว</span>
          </div>
          <span className="text-slate-200 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">อัตราสำเร็จ:</span>
            <span className="font-bold text-indigo-700 font-mono">{stats.successRate}%</span>
          </div>
          <span className="text-slate-200 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="text-slate-400">ล่าสุด:</span>
            <span className="font-medium text-slate-700">{stats.lastImportTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportHistoryCSV}
            disabled={history.length === 0}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-50 shadow-2xs"
            title="ส่งออกรายงานประวัติเป็นไฟล์ CSV"
          >
            <Download size={12} className="text-slate-500" />
            <span>ส่งออก CSV</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-50 shadow-2xs"
            title="รีเฟรชประวัติ"
          >
            <RefreshCw size={12} className={loading ? "animate-spin text-emerald-600" : "text-slate-500"} />
            <span>รีเฟรช</span>
          </button>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearingAll(true)}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer shadow-2xs"
              title="ล้างประวัติการนำเข้าทั้งหมด"
            >
              <Trash2 size={12} className="text-rose-600" />
              <span>ล้างประวัติ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. FILTER & ACTION TOOLBAR */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex items-center flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาชื่อไฟล์, ตาราง, หรือผู้ดำเนินการ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:bg-white placeholder:text-slate-400 transition"
            />
            {searchQuery && (
              <X
                size={14}
                className="absolute right-2.5 text-slate-400 cursor-pointer hover:text-slate-600"
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>
        </div>

        {/* Filters pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Type filters */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter size={11} /> ประเภท:
            </span>
            <button
              type="button"
              onClick={() => setSelectedType("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedType === "all"
                  ? "bg-[#0b3531] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("single_csv")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedType === "single_csv"
                  ? "bg-[#0b3531] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              CSV เดี่ยว
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("multi_csv")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedType === "multi_csv"
                  ? "bg-[#0b3531] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              หลายไฟล์ CSV
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("restore_zip")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedType === "restore_zip"
                  ? "bg-[#0b3531] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              กู้คืนระบบ (.ZIP / .JSON)
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("restore_point")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedType === "restore_point"
                  ? "bg-[#0b3531] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              กู้คืนจากจุดสำรอง
            </button>
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-slate-400 font-medium mr-1">สถานะ:</span>
            <button
              type="button"
              onClick={() => setSelectedStatus("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedStatus === "all"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus("success")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedStatus === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              สำเร็จ
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus("failed")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedStatus === "failed"
                  ? "bg-rose-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              มีข้อผิดพลาด
            </button>
          </div>
        </div>
      </div>

      {/* 3. HISTORY TABLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        {filteredHistory.length === 0 ? (
          <div className="py-14 text-center space-y-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">
                {history.length === 0 ? "ยังไม่มีประวัติการนำเข้าข้อมูลในระบบ" : "ไม่พบประวัติที่ตรงกับเงื่อนไขการค้นหา"}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {history.length === 0
                  ? "เมื่อคุณนำเข้าไฟล์ CSV หรือกู้คืนข้อมูล ประวัติจะถูกบันทึกและแสดงที่นี่โดยอัตโนมัติ"
                  : "ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองประเภทและสถานะ"}
              </p>
            </div>
            {history.length === 0 && onNavigateToImport && (
              <button
                type="button"
                onClick={onNavigateToImport}
                className="px-4 py-2 bg-[#0b3531] hover:bg-[#072724] text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#d4f54e]" />
                <span>ไปที่หน้านำเข้า CSV แยกตาราง</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-3 px-3.5 rounded-tl-xl">วันที่ & เวลา</th>
                  <th className="py-3 px-3">ประเภท</th>
                  <th className="py-3 px-3">ตารางเป้าหมาย</th>
                  <th className="py-3 px-3">ชื่อไฟล์ & ผู้ดำเนินการ</th>
                  <th className="py-3 px-3">จำนวนรายการ</th>
                  <th className="py-3 px-3">สถานะ</th>
                  <th className="py-3 px-3 text-right rounded-tr-xl">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((item) => {
                  const dateFormatted = new Date(item.createdAt).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok"
                  });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Date & Time */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-900">{dateFormatted}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.id}</div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${getTypeBadge(item.importType)}`}>
                          {getTypeIcon(item.importType)}
                          <span>{getTypeLabel(item.importType)}</span>
                        </span>
                      </td>

                      {/* Target Table */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          {item.tableName || "ทุกตาราง (12 ตาราง)"}
                        </div>
                        {item.targetTableId && (
                          <div className="text-[10px] font-mono text-slate-400">
                            table: {item.targetTableId}
                          </div>
                        )}
                      </td>

                      {/* File Name & Actor */}
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="font-medium text-slate-900 truncate" title={item.fileName}>
                          {item.fileName}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <User size={10} />
                          <span>{item.actor || "system"}</span>
                          {item.fileSize && <span>• {item.fileSize}</span>}
                        </div>
                      </td>

                      {/* Rows count */}
                      <td className="py-3 px-3 font-mono">
                        <div className="font-semibold text-emerald-700">
                          +{item.successCount.toLocaleString()} รายการ
                        </div>
                        {item.failedCount > 0 && (
                          <div className="text-[10px] text-rose-600">
                            (ล้มเหลว {item.failedCount.toLocaleString()} รายการ)
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {item.status === "success" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>สำเร็จ</span>
                          </span>
                        ) : item.status === "partial" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle size={12} className="text-amber-600" />
                            <span>สำเร็จบางส่วน</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle size={12} className="text-rose-600" />
                            <span>ล้มเหลว</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedItemForDetails(item)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="ดูรายละเอียดการนำเข้านี้"
                          >
                            <Eye size={12} className="text-slate-500" />
                            <span>รายละเอียด</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                            title="ลบประวัตินี้"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. DETAIL MODAL */}
      {selectedItemForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <History size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">
                    รายละเอียดประวัติการนำเข้าข้อมูล
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {selectedItemForDetails.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Details */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Summary Overview Grid */}
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">ประเภท:</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {getTypeLabel(selectedItemForDetails.importType)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">สถานะ:</span>
                  <div className="mt-0.5">
                    {getStatusBadge(selectedItemForDetails.status)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">วันที่ & เวลา:</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {new Date(selectedItemForDetails.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">ผู้ดำเนินการ:</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {selectedItemForDetails.actor || "system"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">ตารางเป้าหมาย:</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {selectedItemForDetails.tableName || "ทุกตาราง (12 ตาราง)"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">จำนวนที่บันทึกสำเร็จ:</span>
                  <div className="font-mono font-bold text-emerald-700 mt-0.5">
                    +{selectedItemForDetails.successCount.toLocaleString()} รายการ
                  </div>
                </div>
              </div>

              {/* Sub Details breakdown if multi-file or full backup */}
              {selectedItemForDetails.details && selectedItemForDetails.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>รายการไฟล์และตารางย่อย ({selectedItemForDetails.details.length})</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      สำเร็จ {selectedItemForDetails.details.filter(d => d.success).length} จาก {selectedItemForDetails.details.length}
                    </span>
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    {selectedItemForDetails.details.map((sub, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2 text-xs bg-white hover:bg-slate-50">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {sub.success ? (
                              <span className="text-emerald-600 font-bold">✓</span>
                            ) : (
                              <span className="text-rose-600 font-bold">✕</span>
                            )}
                            <span className="font-semibold text-slate-800 truncate">{sub.tableName}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{sub.filename}</p>
                          {sub.error && <p className="text-[10px] text-rose-600">{sub.error}</p>}
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 font-medium ${
                            sub.success
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {sub.success ? `+${sub.count.toLocaleString()} แถว` : "ล้มเหลว"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes or error message */}
              {selectedItemForDetails.notes && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertCircle size={13} />
                    <span>หมายเหตุ / บันทึกเพิ่มเติม:</span>
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed break-all">
                    {selectedItemForDetails.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItemForDetails(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. CONFIRM DELETE SINGLE MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 size={16} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs">ยืนยันการลบประวัติ</h3>
                <p className="text-[11px] text-rose-600">รายการประวัตินี้จะถูกลบออกจากระบบ</p>
              </div>
            </div>

            <div className="p-4 space-y-2 text-xs">
              <p className="text-slate-600">
                คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการนำเข้านี้?
              </p>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px]">
                <div className="text-slate-800 font-semibold truncate">{itemToDelete.title}</div>
                <div className="text-slate-400 mt-0.5">{itemToDelete.id}</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingle}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition disabled:opacity-50"
              >
                {actionLoading ? "กำลังลบ..." : "ลบรายการนี้"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CONFIRM CLEAR ALL MODAL */}
      {isClearingAll && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs">ยืนยันการล้างประวัติทั้งหมด</h3>
                <p className="text-[11px] text-rose-600">ประวัติการนำเข้าทั้งหมด {history.length} รายการจะถูกลบ</p>
              </div>
            </div>

            <div className="p-4 space-y-2 text-xs text-slate-600">
              <p>
                การดำเนินการนี้จะลบประวัติการนำเข้าข้อมูลทั้งหมดออกจากระบบ (แต่ไม่กระทบกับข้อมูลในตารางจริง)
              </p>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClearingAll(false)}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmClearAll}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition disabled:opacity-50"
              >
                {actionLoading ? "กำลังล้างประวัติ..." : "ล้างประวัติทั้งหมด"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function getTypeLabel(type: ImportType): string {
  switch (type) {
    case "single_csv":
      return "นำเข้า CSV ตารางเดี่ยว";
    case "multi_csv":
      return "นำเข้าหลายไฟล์ CSV";
    case "restore_json":
      return "กู้คืนระบบ (.JSON)";
    case "restore_zip":
      return "กู้คืนระบบ (.ZIP รวมรูป)";
    case "restore_point":
      return "กู้คืนจากจุดสำรอง";
    default:
      return "นำเข้าข้อมูล";
  }
}

function getTypeIcon(type: ImportType) {
  switch (type) {
    case "single_csv":
      return <FileSpreadsheet size={11} className="text-emerald-600" />;
    case "multi_csv":
      return <Layers size={11} className="text-indigo-600" />;
    case "restore_json":
    case "restore_zip":
      return <HardDriveDownload size={11} className="text-amber-600" />;
    case "restore_point":
      return <RotateCcw size={11} className="text-blue-600" />;
    default:
      return <Upload size={11} />;
  }
}

function getTypeBadge(type: ImportType): string {
  switch (type) {
    case "single_csv":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "multi_csv":
      return "bg-indigo-50 text-indigo-800 border-indigo-200";
    case "restore_json":
    case "restore_zip":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "restore_point":
      return "bg-blue-50 text-blue-800 border-blue-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getStatusLabel(status: ImportStatus): string {
  switch (status) {
    case "success":
      return "สำเร็จสมบูรณ์";
    case "partial":
      return "สำเร็จบางส่วน";
    case "failed":
      return "มีข้อผิดพลาด";
    default:
      return status;
  }
}

function getStatusBadge(status: ImportStatus) {
  switch (status) {
    case "success":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={11} /> สำเร็จ
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle size={11} /> สำเร็จบางส่วน
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle size={11} /> ล้มเหลว
        </span>
      );
  }
}
