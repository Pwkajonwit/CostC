"use client";

import React, { useState } from "react";
import {
  X,
  Printer,
  FileText,
  Receipt,
  FileCheck2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BillContractDocument } from "@/components/documents/BillContractDocument";
import type { BillDocumentModel } from "@/lib/bills/bill-document";

type BillDocumentModalProps = {
  data: BillDocumentModel | null;
  isOpen: boolean;
  onClose: () => void;
};

export function BillDocumentModal({
  data,
  isOpen,
  onClose,
}: BillDocumentModalProps) {
  const [activeTab, setActiveTab] = useState<"all" | "contract" | "voucher" | "tax50twi">("all");

  if (!isOpen || !data) return null;

  function handlePrint() {
    const iframe = document.querySelector(".bill-contract-exact-document iframe") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER (No Print) */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-b border-slate-200 text-slate-900 shrink-0 no-print gap-2">
          {/* Left: icon + title */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              {/* Mobile: compact */}
              <p className="sm:hidden text-xs text-slate-900 font-semibold leading-tight">
                พิมพ์เอกสาร
                <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  #{data.billSequence}
                </span>
              </p>
              {/* Desktop: full */}
              <h3 className="hidden sm:flex text-sm text-slate-900 font-semibold items-center gap-2 leading-tight">
                <span>เอกสารสัญญาจ้าง / ใบสำคัญจ่าย / 50 ทวิ</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  บิล #{data.billSequence}
                </span>
              </h3>
              <p className="hidden sm:block text-xs text-slate-500 truncate max-w-sm">
                โครงการ: {data.project.name} | ผู้รับเหมา: {data.contractor.fullName}
              </p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`/bills/${encodeURIComponent(data.billSequence)}/document`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition font-medium"
              title="เปิดหน้าพิมพ์เต็มจอในแท็บใหม่"
            >
              <ExternalLink size={14} />
              <span>เปิดแท็บใหม่</span>
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition active:scale-95 font-medium cursor-pointer"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">พิมพ์เอกสาร (Print / PDF)</span>
              <span className="sm:hidden">พิมพ์</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TAB CONTROLS (No Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 sm:px-4 py-1.5 sm:py-2 shrink-0 no-print text-xs">
          <div className="flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <span className="hidden sm:inline">ครบชุด 3 หน้า</span>
              <span className="sm:hidden">ครบชุด</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contract")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                activeTab === "contract"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <FileText size={12} />
              <span className="hidden sm:inline">1. สัญญาจ้างเหมา</span>
              <span className="sm:hidden">สัญญา</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("voucher")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                activeTab === "voucher"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Receipt size={12} />
              <span className="hidden sm:inline">2. ใบสำคัญจ่าย</span>
              <span className="sm:hidden">ใบสำคัญ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tax50twi")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                activeTab === "tax50twi"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <FileCheck2 size={12} />
              <span className="hidden sm:inline">3. หนังสือรับรอง 50 ทวิ</span>
              <span className="sm:hidden">50 ทวิ</span>
            </button>
          </div>
          <span className="text-xs text-slate-500 hidden md:block shrink-0 ml-2">
            * บันทึก PDF: เลือก "Save as PDF"
          </span>
        </div>

        {/* DOCUMENT PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto bg-slate-200/70 p-2 sm:p-6 print:p-0 print:bg-white">
          <BillContractDocument
            data={data}
            pages={[activeTab]}
          />
        </div>
      </div>
    </div>
  );
}
