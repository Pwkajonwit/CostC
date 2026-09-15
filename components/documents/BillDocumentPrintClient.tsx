"use client";

import React, { useState } from "react";
import { Printer, FileText, Receipt, FileCheck2 } from "lucide-react";
import { BillContractDocument } from "@/components/documents/BillContractDocument";
import type { BillDocumentModel } from "@/lib/bills/bill-document";

type BillDocumentPrintClientProps = {
  data: BillDocumentModel;
};

export function BillDocumentPrintClient({ data }: BillDocumentPrintClientProps) {
  const [activeTab, setActiveTab] = useState<"all" | "contract" | "voucher" | "tax50twi">("all");

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
    <div className="flex flex-col items-center">
      {/* SECONDARY TOOLBAR (No Print) */}
      <div className="w-full bg-white border-b border-slate-200 py-2.5 px-4 sticky top-[49px] z-30 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-md text-xs transition ${
              activeTab === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            ครบชุด 3 หน้า
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contract")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
              activeTab === "contract"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileText size={13} />
            <span>1. สัญญาจ้างเหมา</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("voucher")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
              activeTab === "voucher"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Receipt size={13} />
            <span>2. ใบสำคัญจ่าย</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tax50twi")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition ${
              activeTab === "tax50twi"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileCheck2 size={13} />
            <span>3. หนังสือรับรอง 50 ทวิ</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Printer size={15} />
          <span>สั่งพิมพ์เอกสาร (Print / Save as PDF)</span>
        </button>
      </div>

      {/* DOCUMENT PREVIEW */}
      <div className="w-full py-6 px-2 sm:px-4 print:p-0">
        <BillContractDocument
          data={data}
          pages={[activeTab]}
        />
      </div>
    </div>
  );
}
