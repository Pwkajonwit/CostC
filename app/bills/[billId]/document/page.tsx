import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { getBillDocumentData } from "@/lib/bills/bill-document";
import { BillDocumentPrintClient } from "@/components/documents/BillDocumentPrintClient";

export const dynamic = "force-dynamic";

type BillDocumentPageProps = {
  params: Promise<{ billId: string }>;
};

export default async function BillDocumentPage({ params }: BillDocumentPageProps) {
  const { billId } = await params;
  const decodedBillId = decodeURIComponent(billId).trim();
  const targetId = decodedBillId.toLowerCase();

  const [rawDataRows, rawProjectRows, rawContractRows, storeRows, contractorRows, rawCompanyRows] = await Promise.all([
    getRows(TABLES.DATA).catch(() => []),
    getRows(TABLES.PROJECT).catch(() => []),
    getRows(TABLES.CONTRACT_WORK).catch(() => []),
    getRows(TABLES.STORE).catch(() => []),
    getRows(TABLES.CONTRACTOR).catch(() => []),
    getRows(TABLES.COMPANY).catch(() => []),
  ]);

  const bill = rawDataRows.find(
    (row) =>
      String(row["ลำดับ"] || "").trim().toLowerCase() === targetId ||
      String(row["ลำดับtest"] || "").trim().toLowerCase() === targetId ||
      String(row._sheetRow || "").trim() === targetId ||
      String(row._RowNumber || "").trim() === targetId ||
      String(row.id || "").trim().toLowerCase() === targetId
  );

  if (!bill) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <FileText size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">ไม่พบเอกสารบิล #{decodedBillId}</h2>
            <p className="text-xs text-slate-500">บิลนี้อาจถูกลบไปแล้ว หรือระบุหมายเลขบิลไม่ถูกต้อง</p>
          </div>
          <div className="pt-2">
            <Link
              href="/bills"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
            >
              <ArrowLeft size={14} />
              <span>กลับหน้ารายการบิล</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const docData = await getBillDocumentData(bill, {
    projects: rawProjectRows,
    companies: rawCompanyRows,
    contractors: contractorRows,
    bills: rawDataRows,
  });

  if (!docData) notFound();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-slate-900 font-sans">
      {/* TOP ACTION BAR (No Print) */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 text-slate-900 px-4 py-3 shadow-2xs flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Link
            href={`/bills/${encodeURIComponent(decodedBillId)}`}
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 transition px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 font-medium"
          >
            <ArrowLeft size={14} />
            <span>กลับหน้ารายละเอียดบิล</span>
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <FileText size={15} />
            </div>
            <h1 className="text-sm font-semibold text-slate-900 truncate">
              เอกสารสัญญาจ้าง / ใบสำคัญจ่าย / 50 ทวิ <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono ml-1">บิล #{docData.billSequence}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden md:inline">
            โครงการ: <strong className="text-slate-800">{docData.project.name}</strong>
          </span>
        </div>
      </div>

      {/* PRINT CLIENT WRAPPER */}
      <BillDocumentPrintClient data={docData} />
    </div>
  );
}
