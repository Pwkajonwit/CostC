"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  Printer,
  FileSpreadsheet,
  Layers,
  FileText,
  Search,
  CheckCircle2,
  Building2,
  UserCheck,
  Download,
  ExternalLink,
} from "lucide-react";
import type { BillDocumentModel } from "@/lib/bills/bill-document";
import { renderMultipleBillsDocumentHtml } from "@/lib/bills/document-template-html";

type DocumentIndexModalProps = {
  isOpen: boolean;
  onClose: () => void;
  documents: BillDocumentModel[];
  monthLabel?: string;
};

export function DocumentIndexModal({
  isOpen,
  onClose,
  documents,
  monthLabel = "สิงหาคม 2569",
}: DocumentIndexModalProps) {
  const [viewMode, setViewMode] = useState<"table" | "preview">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase().trim();
    return documents.filter(
      (d) =>
        d.billSequence.toLowerCase().includes(q) ||
        d.contractor.fullName.toLowerCase().includes(q) ||
        d.contractor.idCard.includes(q) ||
        d.jobDescription.toLowerCase().includes(q) ||
        (d.issuer && d.issuer.toLowerCase().includes(q))
    );
  }, [documents, searchQuery]);

  const summary = useMemo(() => {
    const totalLabor = documents.reduce((acc, d) => acc + (d.amounts.laborAndStaff || 0), 0);
    const totalWht = documents.reduce((acc, d) => acc + (d.amounts.withholdingTax || 0), 0);
    const totalNet = documents.reduce((acc, d) => acc + (d.amounts.netPayable || 0), 0);
    const pnd3Count = documents.filter((d) => !d.contractor.isCorporate).length;
    const pnd53Count = documents.filter((d) => d.contractor.isCorporate).length;
    return { totalLabor, totalWht, totalNet, pnd3Count, pnd53Count };
  }, [documents]);

  const renderedHtml = useMemo(() => {
    if (!isOpen || documents.length === 0) return "";
    return renderMultipleBillsDocumentHtml(documents, "index", {
      monthLabel,
      title: "สารบัญและใบปะหน้าสรุปรายการจ่ายค่าจ้าง / หักภาษี ณ ที่จ่าย (50 ทวิ)",
    });
  }, [isOpen, documents, monthLabel]);

  function handlePrintIndexOnly() {
    if (viewMode === "preview" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      const ids = documents.map((d) => d.billSequence).join(",");
      window.open(`/documents/print?ids=${encodeURIComponent(ids)}&mode=index`, "_blank");
    }
  }

  function handlePrintFullBundle() {
    const ids = documents.map((d) => d.billSequence).join(",");
    window.open(`/documents/print?ids=${encodeURIComponent(ids)}&mode=all_with_index`, "_blank");
  }

  function handleExportCsv() {
    if (documents.length === 0) return;

    const headers = [
      "ลำดับ",
      "ว/ด/ป",
      "ชื่อ-นามสกุล",
      "บัตรประจำตัวประชาชน",
      "ที่อยู่",
      "ค่าจ้าง",
      "หัก 3%",
      "คงเหลือ",
      "ผู้จ่าย",
      "รายละเอียดงาน",
      "แบบภาษี",
      "สถานะ",
    ];

    const rows = documents.map((doc) => [
      doc.billSequence,
      doc.billDate,
      `"${(doc.contractor.fullName || "").replace(/"/g, '""')}"`,
      `"${(doc.contractor.idCard || doc.contractor.taxId || "").replace(/"/g, '""')}"`,
      `"${(doc.contractor.address || "").replace(/"/g, '""')}"`,
      doc.amounts.laborAndStaff.toFixed(2),
      doc.amounts.withholdingTax.toFixed(2),
      doc.amounts.netPayable.toFixed(2),
      `"${(doc.issuer || doc.rawBill?.["ผู้จ่าย"] || "").replace(/"/g, '""')}"`,
      `"${(doc.jobDescription || "").replace(/"/g, '""')}"`,
      doc.contractor.isCorporate ? "ภ.ง.ด.53" : "ภ.ง.ด.3",
      doc.status || "เรียบร้อย",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `สารบัญเอกสาร_${monthLabel.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        {/* MODAL HEADER */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-white border-b border-slate-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  สารบัญและใบปะหน้าสรุปรายการจ่ายค่าจ้าง / 50 ทวิ
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  {documents.length} ฉบับ
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  {monthLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                เอกสารสรุปใบสำคัญจ่ายและหนังสือรับรองหัก ณ ที่จ่าย สำหรับยื่นภาษีและเบิกจ่าย
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium cursor-pointer transition-colors shadow-xs"
              title="ส่งออกตารางเป็นไฟล์ CSV สำหรับ Excel"
            >
              <Download size={13} />
              <span>ส่งออก CSV</span>
            </button>

            <button
              onClick={handlePrintIndexOnly}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              title="พิมพ์เฉพาะหน้าสารบัญ A4"
            >
              <Printer size={13} />
              <span>พิมพ์สารบัญ (A4)</span>
            </button>

            <button
              onClick={handlePrintFullBundle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              title="พิมพ์ชุดเอกสารครบทุกบิลพร้อมหน้าสารบัญปะหน้า"
            >
              <Layers size={13} />
              <span>พิมพ์ทั้งชุดพร้อมสารบัญ</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* SUMMARY KPI BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-xs">
          <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">ยอดค่าจ้างรวม (ก่อนหัก)</span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              ฿{summary.totalLabor.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">หักภาษี ณ ที่จ่ายรวม (3%)</span>
            <span className="text-sm font-bold text-rose-600 font-mono">
              ฿{summary.totalWht.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">ยอดจ่ายสุทธิรวม</span>
            <span className="text-sm font-bold text-emerald-700 font-mono">
              ฿{summary.totalNet.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-slate-500 block text-[11px]">สัดส่วนประเภทผู้รับเงิน</span>
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-2 mt-0.5">
              <span>ภ.ง.ด.3: <b className="text-indigo-600">{summary.pnd3Count}</b></span>
              <span className="text-slate-300">|</span>
              <span>ภ.ง.ด.53: <b className="text-purple-600">{summary.pnd53Count}</b></span>
            </span>
          </div>
        </div>

        {/* VIEW TABS & SEARCH */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-white border-b border-slate-200 gap-2">
          <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 rounded-lg">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📋 ตารางรายการ ({filteredDocs.length})
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                viewMode === "preview"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📄 แสดงตัวอย่างแบบพิมพ์ A4
            </button>
          </div>

          {viewMode === "table" && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, เลขบิล, รายละเอียดงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 sm:w-64 pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>
          )}
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50 p-2 sm:p-4">
          {viewMode === "table" ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3 w-16 text-center">ลำดับ</th>
                      <th className="py-2.5 px-3 w-24 text-center">ว/ด/ป</th>
                      <th className="py-2.5 px-3 min-w-[160px]">ชื่อผู้รับเงิน / ผู้รับเหมา</th>
                      <th className="py-2.5 px-3 w-36 text-center">เลขบัตร/เลขภาษี</th>
                      <th className="py-2.5 px-3 min-w-[180px]">รายละเอียดงาน</th>
                      <th className="py-2.5 px-3 w-28 text-right">ค่าจ้าง</th>
                      <th className="py-2.5 px-3 w-24 text-right">หัก 3%</th>
                      <th className="py-2.5 px-3 w-28 text-right">คงเหลือสุทธิ</th>
                      <th className="py-2.5 px-3 w-20 text-center">แบบ</th>
                      <th className="py-2.5 px-3 w-20 text-center">ผู้จ่าย</th>
                      <th className="py-2.5 px-3 w-20 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocs.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">
                          ไม่พบรายการที่ค้นหา
                        </td>
                      </tr>
                    ) : (
                      filteredDocs.map((doc, idx) => (
                        <tr key={`${doc.billSequence}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-center font-mono font-medium text-slate-700">
                            {doc.billSequence}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">
                            {doc.billDate}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            <div>{doc.contractor.fullName}</div>
                            {doc.contractor.address && doc.contractor.address !== "-" && (
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">
                                {doc.contractor.address}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                            {doc.contractor.idCard || doc.contractor.taxId || "-"}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            <div className="truncate max-w-xs">{doc.jobDescription || "-"}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                            {doc.amounts.laborAndStaff.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-rose-600">
                            {doc.amounts.withholdingTax.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            {doc.amounts.netPayable.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                doc.contractor.isCorporate
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              }`}
                            >
                              {doc.contractor.isCorporate ? "ภ.ง.ด.53" : "ภ.ง.ด.3"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600 text-[11px]">
                            {doc.issuer || doc.rawBill?.["ผู้จ่าย"] || "-"}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 size={10} />
                              {doc.status || "เรียบร้อย"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredDocs.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                        <td colSpan={5} className="py-2.5 px-3 text-center">
                          รวมรายการทั้งหมด ({filteredDocs.length} ฉบับ)
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {summary.totalLabor.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {summary.totalWht.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {summary.totalNet.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={3} className="py-2.5 px-3 text-center text-slate-500 font-normal">
                          บาท
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full bg-slate-800 rounded-lg p-2 sm:p-4 min-h-[500px]">
              <div className="w-full flex justify-end mb-2">
                <button
                  onClick={handlePrintIndexOnly}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <Printer size={14} />
                  <span>พิมพ์แบบฟอร์มแนวนอน (A4 Landscape)</span>
                </button>
              </div>
              <iframe
                ref={iframeRef}
                srcDoc={renderedHtml}
                title="A4 Index Preview"
                className="w-full bg-white rounded shadow-md border-0"
                style={{ height: "700px" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
