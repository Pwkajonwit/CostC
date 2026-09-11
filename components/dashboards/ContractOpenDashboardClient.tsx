"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import dynamic from "next/dynamic";

const FormModal = dynamic(
  () => import("@/components/forms/FormModal").then((mod) => mod.FormModal),
  { ssr: false }
);
import { FORM_SCHEMAS } from "@/lib/schemas";
import { TABLES } from "@/lib/config";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateDisplay } from "@/lib/utils/dates";
import type { SheetRow } from "@/lib/types";

type ContractOpenDashboardClientProps = {
  columns: string[];
  initialRows: SheetRow[];
  form?: any;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

export function ContractOpenDashboardClient({
  columns,
  initialRows,
  form,
}: ContractOpenDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    const handleDataUpdate = () => {
      router.refresh();
    };
    window.addEventListener("data-updated", handleDataUpdate);
    window.addEventListener("bills-data-updated", handleDataUpdate);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdate);
      window.removeEventListener("bills-data-updated", handleDataUpdate);
    };
  }, [router]);

  const filteredRows = useMemo(() => {
    let list = initialRows;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(row =>
        Object.values(row).some(val => String(val || "").toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      const seqA = Number(a._sheetRow || a["id_Conwork"] || a.id || 0);
      const seqB = Number(b._sheetRow || b["id_Conwork"] || b.id || 0);
      return sortDesc ? seqB - seqA : seqA - seqB;
    });
  }, [initialRows, searchTerm, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const visibleStart = visibleRows.length ? pageStart + 1 : 0;
  const visibleEnd = pageStart + visibleRows.length;
  const totalHire = useMemo(() => filteredRows.reduce((sum, r) => sum + toNumber(r["ยอดเงินจ้าง"]), 0), [filteredRows]);
  const totalPaid = useMemo(() => filteredRows.reduce((sum, r) => sum + toNumber(r["ยอดเงินจ่าย"]), 0), [filteredRows]);
  const totalRemaining = totalHire - totalPaid;

  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="w-full flex flex-col gap-3 p-3 sm:p-5 max-w-[1600px] mx-auto font-sans text-sm text-slate-800">

      {/* 1. DESKTOP SUMMARY KPI CARDS (Hidden on Mobile, 4 Columns on Desktop) */}
      <div className="hidden md:grid grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block truncate">สัญญาจ้างทั้งหมด</span>
          <div className="text-lg text-slate-900 mt-0.5">{filteredRows.length} <span className="text-xs font-normal text-slate-500">สัญญา</span></div>
        </div>

        <div className="bg-white rounded-md p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block truncate">ยอดเงินจ้างรวม</span>
          <div className="text-lg text-slate-900 mt-0.5">{money(totalHire)}</div>
        </div>

        <div className="bg-white rounded-md p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block truncate">ยอดจ่ายแล้วรวม</span>
          <div className="text-lg text-emerald-700 mt-0.5">{money(totalPaid)}</div>
        </div>

        <div className="bg-white rounded-md p-3 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block truncate">ค่าแรงคงเหลือรวม</span>
          <div className="text-lg text-amber-700 mt-0.5">{money(totalRemaining)}</div>
        </div>
      </div>

      {/* 2. FILTER TOOLBAR & SEARCH */}
      {/* 2. MOBILE SEARCH & SORT TOOLBAR (Visible only on Mobile) */}
      <div className="flex md:hidden items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 flex items-center">
          <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ Project, ID, สัญญา, ผู้รับเหมา..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:bg-white focus:border-slate-400 placeholder:text-slate-400"
          />
          {searchTerm && (
            <X size={14} className="absolute right-2 text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setSearchTerm("")} />
          )}
        </div>
        <button
          type="button"
          onClick={() => setSortDesc(cur => !cur)}
          className="p-2 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 cursor-pointer active:bg-slate-200 shadow-2xs"
          title="สลับการเรียงลำดับ"
        >
          {sortDesc ? <ArrowDownWideNarrow size={14} className="text-slate-600" /> : <ArrowUpWideNarrow size={14} className="text-slate-600" />}
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open-contract-form"))}
          className="px-2.5 py-1.5 bg-[#0b3531] text-white rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 shadow-2xs"
          title="เปิดจ้างงานรับเหมา"
        >
          <Plus size={14} className="text-[#d4f54e]" />
          <span>เปิดจ้าง</span>
        </button>
      </div>

      {/* 2. DESKTOP FILTER & ACTION CONTROLS (Visible only on Desktop) */}
      <div className="hidden md:flex border border-slate-200 rounded-md p-2.5 bg-white items-center justify-between gap-2 text-xs shadow-2xs">
        {/* Search Input */}
        <div className="relative flex items-center flex-1 min-w-0">
          <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ Project, ID, สัญญา, ผู้รับเหมา..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:border-slate-500 placeholder:text-slate-400"
          />
          {searchTerm && (
            <X size={14} className="absolute right-2 text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setSearchTerm("")} />
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSortDesc(cur => !cur)}
            className="px-2.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-md text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            title="สลับการเรียงลำดับ"
          >
            {sortDesc ? <ArrowDownWideNarrow size={14} className="text-slate-600" /> : <ArrowUpWideNarrow size={14} className="text-slate-600" />}
            <span>{sortDesc ? "ล่าสุดก่อน" : "เก่าสุดก่อน"}</span>
          </button>

          <FormModal
            tableName={TABLES.CONTRACT_WORK}
            form={form}
            buttonLabel="เปิดจ้างงาน"
            title="เปิดจ้างงานรับเหมา"
            submitPath="/api/rows"
            openEventName="open-contract-form"
          />
        </div>
      </div>

      {/* 3. WORK TABLE / MOBILE HIGH-DENSITY CARD FEED */}
      {/* 3. MOBILE INDEPENDENT CONTRACT CARDS FEED */}
      <div className="block md:hidden space-y-2.5">
        {!visibleRows.length ? (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 border border-slate-200 text-xs font-medium shadow-2xs">
            ไม่พบรายการสัญญาจ้าง
          </div>
        ) : (
          visibleRows.map((row, idx) => {
            const contractId = String(row["id_Conwork"] || row._sheetRow || row.id || idx + 1);
            const contractorName = String(row["id_Contractor_name"] || row["ชื่อเล่น"] || row["ชื่อ-นามสกุล"] || row["ผู้รับเหมา"] || row["ช่าง"] || row["id_Contractor"] || "-");
            const projectId = String(row["ID Project"] || "");
            const projectName = String(row["ชื่อ Project"] || "-");
            const hireAmount = toNumber(row["ยอดเงินจ้าง"]);
            const workDetails = String(row["รายละเอียดงาน"] || "-");
            const contractDate = formatDateDisplay(row["วันที่"] || row["ว/ด/ป"] || row["created_at"]);
            const phone = String(row["เบอร์โทรศัพท์"] || row["เบอร์โทร"] || "");
            const paidAmount = toNumber(row["ยอดเงินจ่าย"]);
            const remaining = hireAmount - paidAmount;
            const payPercent = hireAmount > 0 ? Math.min(100, Math.round((paidAmount / hireAmount) * 100)) : 0;

            return (
              <div
                key={`mob-contract-${contractId}-${idx}`}
                onClick={() => window.location.href = `/contract-open/${encodeURIComponent(contractId)}`}
                className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs hover:border-slate-300 active:bg-slate-50 transition cursor-pointer space-y-2.5"
              >
                {/* Header Row: id_Conwork badge + Project Name + ยอดเงินจ้าง */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs bg-slate-900 text-white px-2 py-0.5 rounded-md shrink-0">
                      #{contractId}
                    </span>
                    <span className="text-xs text-slate-900 truncate">
                      {projectId ? `[${projectId}] ` : ""}{projectName}
                    </span>
                  </div>
                  <span className="text-xs text-slate-900 shrink-0">
                    {money(hireAmount)} ฿
                  </span>
                </div>

                {/* รายละเอียดงาน */}
                {workDetails && workDetails !== "-" && (
                  <div className="text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-100 line-clamp-2">
                    <span className="text-slate-400 mr-1.5">งาน:</span>{workDetails}
                  </div>
                )}

                {/* id_Contractor (ช่าง) & เบอร์โทรศัพท์ & วันที่ */}
                <div className="flex items-center justify-between text-xs text-slate-500 gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-500">ช่าง:</span>
                    <span className="truncate text-slate-800">{contractorName}</span>
                    {phone && phone !== "-" && (
                      <span className="text-slate-400 text-xs shrink-0">({phone})</span>
                    )}
                  </div>
                  {contractDate !== "-" && (
                    <span className="text-slate-400 text-xs shrink-0">{contractDate}</span>
                  )}
                </div>

                {/* Progress Bar & Financial Breakdown (ยอดเงินจ่าย & ค่าแรงคงเหลือ) */}
                <div className="bg-slate-50/90 rounded-lg p-2.5 border border-slate-200/70 space-y-1.5">
                  <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        payPercent >= 100 ? "bg-emerald-600" : "bg-sky-500"
                      }`}
                      style={{ width: `${payPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-slate-500">
                      จ่ายแล้ว: <strong className="text-emerald-700">{money(paidAmount)} ฿</strong> <span className="text-slate-400 text-xs">({payPercent}%)</span>
                    </span>
                    <span className="text-slate-500">
                      คงเหลือ: <strong className={`${remaining > 0 ? "text-amber-700" : "text-slate-400"}`}>{money(remaining)} ฿</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Minimal Pagination Card */}
        {filteredRows.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3">
            {totalPages <= 1 ? (
              <div className="text-center text-xs text-slate-400 font-medium">
                แสดงทั้งหมด {filteredRows.length} รายการ
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs">
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
        )}
      </div>

      {/* 4. DESKTOP WORK TABLE */}
      <div className="hidden md:block border border-slate-200 rounded-md bg-white overflow-hidden shadow-2xs">
        {!visibleRows.length ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">ไม่พบรายการสัญญาจ้าง</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse font-sans">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-200 text-xs">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">รหัสจ้าง</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ผู้รับเหมา</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">รหัสโครงการ</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ชื่อโครงการ</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">ยอดเงินจ้าง</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">รายละเอียดงาน</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center whitespace-nowrap">วันที่</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center whitespace-nowrap">เบอร์โทรศัพท์</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">ยอดเงินจ่าย</th>
                    <th className="py-2.5 px-3 text-right">ค่าแรงคงเหลือ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row, idx) => {
                    const contractId = String(row["id_Conwork"] || row._sheetRow || row.id || idx + 1);
                    const contractorName = String(row["id_Contractor_name"] || row["ชื่อเล่น"] || row["ชื่อ-นามสกุล"] || row["ผู้รับเหมา"] || row["ช่าง"] || row["id_Contractor"] || "-");
                    const projectId = String(row["ID Project"] || "-");
                    const projectName = String(row["ชื่อ Project"] || "-");
                    const hireAmount = toNumber(row["ยอดเงินจ้าง"]);
                    const workDetails = String(row["รายละเอียดงาน"] || "-");
                    const contractDate = formatDateDisplay(row["วันที่"] || row["ว/ด/ป"] || row["created_at"]);
                    const phone = String(row["เบอร์โทรศัพท์"] || row["เบอร์โทร"] || "-");
                    const paidAmount = toNumber(row["ยอดเงินจ่าย"]);
                    const remaining = hireAmount - paidAmount;

                    return (
                      <tr
                        key={`${contractId}-${idx}`}
                        onClick={() => window.location.href = `/contract-open/${encodeURIComponent(contractId)}`}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-2 px-3 text-center text-slate-900 border-r border-slate-100">{contractId}</td>
                        <td className="py-2 px-3 text-slate-800 max-w-[160px] truncate border-r border-slate-100" title={contractorName}>
                          {contractorName}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-100">{projectId}</td>
                        <td className="py-2 px-3 text-slate-900 max-w-[200px] truncate border-r border-slate-100" title={projectName}>
                          {projectName}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-900 border-r border-slate-100">{money(hireAmount)}</td>
                        <td className="py-2 px-3 text-slate-700 max-w-[200px] truncate border-r border-slate-100" title={workDetails}>{workDetails}</td>
                        <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-100 whitespace-nowrap">{contractDate}</td>
                        <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-100 whitespace-nowrap">{phone}</td>
                        <td className="py-2 px-3 text-right text-emerald-700 border-r border-slate-100">{money(paidAmount)}</td>
                        <td className={`py-2 px-3 text-right ${remaining > 0 ? "text-amber-700" : "text-slate-400"}`}>
                          {money(remaining)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Full Pagination */}
            {filteredRows.length > 0 && (
              <div className="flex flex-row items-center justify-between gap-3 p-3 border-t border-slate-200 text-xs text-slate-600 bg-slate-50">
                <div>
                  แสดง {visibleStart}-{visibleEnd} จาก {filteredRows.length} รายการ
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
            )}
          </>
        )}
      </div>

      {/* Hidden Global & Mobile Modal Trigger for open-contract-form */}
      <FormModal
        tableName={TABLES.CONTRACT_WORK}
        form={form}
        buttonLabel="เปิดจ้างงาน"
        title="เปิดจ้างงานรับเหมา"
        submitPath="/api/rows"
        openEventName="open-contract-form"
        hideLauncher
      />

      {/* Hidden Edit Modal Trigger */}
      <FormModal
        tableName={TABLES.CONTRACT_WORK}
        form={form}
        buttonLabel="แก้ไข"
        title="แก้ไขงานรับเหมา"
        submitPath="/api/rows"
        openEventName="open-edit-contract-form"
        hideLauncher
      />
    </div>
  );
}

