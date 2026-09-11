"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Printer, FileText, Receipt, FileCheck2, ArrowLeft, Files, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { renderMultipleBillsDocumentHtml, type BillDocumentPageMode } from "@/lib/bills/document-template-html";
import type { BillDocumentModel } from "@/lib/bills/bill-document";

type BatchBillDocumentPrintClientProps = {
  documents: BillDocumentModel[];
  initialMode?: BillDocumentPageMode;
  monthLabel?: string;
};

export function BatchBillDocumentPrintClient({
  documents,
  initialMode = "all",
  monthLabel,
}: BatchBillDocumentPrintClientProps) {
  const [activeTab, setActiveTab] = useState<BillDocumentPageMode>(initialMode);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState("1800px");

  const renderedHtml = useMemo(() => {
    return renderMultipleBillsDocumentHtml(documents, activeTab, { monthLabel });
  }, [documents, activeTab, monthLabel]);

  useEffect(() => {
    function updateHeight() {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
          if (doc && doc.body) {
            const h = doc.body.scrollHeight;
            if (h > 100) {
              setIframeHeight(`${h + 60}px`);
            }
          }
        } catch {}
      }
    }

    const timer = setTimeout(updateHeight, 400);
    return () => clearTimeout(timer);
  }, [renderedHtml]);

  function handlePrint() {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  }

  let totalPages = documents.length;
  if (activeTab === "all") {
    totalPages = documents.length * 3;
  } else if (activeTab === "all_with_index") {
    const indexPages = documents.length <= 12 ? 1 : Math.max(1, Math.ceil((documents.length - 14) / 20) + 1);
    totalPages = documents.length * 3 + indexPages;
  } else if (activeTab === "index") {
    totalPages = documents.length <= 12 ? 1 : Math.max(1, Math.ceil((documents.length - 14) / 20) + 1);
  } else {
    totalPages = documents.length;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* TOP STICKY TOOLBAR (No Print) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition border border-slate-200 font-medium"
          >
            <ArrowLeft size={14} />
            <span>กลับหน้าเลือกเอกสาร</span>
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <Files size={16} />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span>พิมพ์เอกสารชุด</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {documents.length} บิล
              </span>
              <span className="text-xs text-slate-500 font-normal hidden sm:inline">
                ({totalPages} หน้ากระดาษ A4)
              </span>
            </h1>
          </div>
        </div>

        {/* Mode Selector & Print Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer font-medium ${
                activeTab === "all"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ครบชุด 3 หน้า
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all_with_index")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-medium ${
                activeTab === "all_with_index"
                  ? "bg-emerald-700 text-white shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Files size={13} />
              <span>ทั้งชุด + สารบัญ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("index")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-medium ${
                activeTab === "index"
                  ? "bg-indigo-600 text-white shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCheck2 size={13} />
              <span>สารบัญแนวนอน</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tax50twi")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-medium ${
                activeTab === "tax50twi"
                  ? "bg-emerald-700 text-white shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCheck2 size={13} />
              <span>50 ทวิ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("contract")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-medium ${
                activeTab === "contract"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText size={13} />
              <span>สัญญาจ้าง</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("voucher")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-medium ${
                activeTab === "voucher"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Receipt size={13} />
              <span>ใบสำคัญจ่าย</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Printer size={16} />
            <span>สั่งพิมพ์ {totalPages} หน้า (Print / PDF)</span>
          </button>
        </div>
      </header>

      {/* DOCUMENT PREVIEW CONTAINER */}
      <main className="flex-1 w-full py-8 px-2 sm:px-6 flex flex-col items-center justify-start print:p-0 print:bg-white">
        <div className={`w-full ${activeTab === "index" || activeTab === "all_with_index" ? "max-w-[315mm]" : "max-w-[225mm]"} rounded-xl overflow-hidden shadow-2xl border border-slate-700 print:border-none print:shadow-none bg-[#525659] transition-all duration-300`}>
          <iframe
            ref={iframeRef}
            srcDoc={renderedHtml}
            title="เอกสารรวมสำหรับพิมพ์"
            className="w-full border-0 block bg-[#525659]"
            style={{ height: iframeHeight, minHeight: "1200px" }}
            onLoad={() => {
              if (iframeRef.current && iframeRef.current.contentWindow) {
                try {
                  const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
                  if (doc && doc.body) {
                    setIframeHeight(`${doc.body.scrollHeight + 60}px`);
                  }
                } catch {}
              }
            }}
          />
        </div>
      </main>
    </div>
  );
}
