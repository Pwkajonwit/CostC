"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileText, Info, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";

export type ContractorQuotaGuardrailProps = {
  contractorId: string;
  currentHireAmount: number | string;
  excludeConworkId?: string;
  contractorRow?: Record<string, any>;
  className?: string;
};

type ContractorQuotaInfo = {
  hasContractor: boolean;
  contractorId: string;
  contractorName: string;
  contractorNickname: string;
  contractorFullName: string;
  contractorType: "บุคคลธรรมดา" | "นิติบุคคล";
  annualLimit: number;
  paidBillsThisYear: number;
  pendingContractsThisYear: number;
  totalUsedSoFar: number;
  remainingBefore: number;
  targetYear: number;
  contractCount: number;
  contractsSummary?: Array<{
    id: string;
    projectId: string;
    projectName: string;
    hireAmount: number;
    paidAmount: number;
    remainingAmount: number;
    details: string;
    date: string;
  }>;
};

export function ContractorQuotaGuardrail({
  contractorId,
  currentHireAmount,
  excludeConworkId,
  contractorRow,
  className = ""
}: ContractorQuotaGuardrailProps) {
  const [quotaInfo, setQuotaInfo] = useState<ContractorQuotaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showContractList, setShowContractList] = useState(false);

  const cleanContractorId = String(contractorId || "").trim();
  const currentAmt = toNumber(currentHireAmount);

  useEffect(() => {
    if (!cleanContractorId) {
      setQuotaInfo(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/contractor-annual-quota?contractorId=${encodeURIComponent(cleanContractorId)}&excludeConworkId=${encodeURIComponent(excludeConworkId || "")}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.success && data.hasContractor) {
            setQuotaInfo(data);
          } else {
            // Fallback from contractorRow if provided
            if (contractorRow) {
              const type = (contractorRow["ประเภท"] || contractorRow.contractor_type) === "นิติบุคคล" ? "นิติบุคคล" : "บุคคลธรรมดา";
              const limit = toNumber(contractorRow["จำกัดยอด/ปี"] || contractorRow.annual_limit) || (type === "นิติบุคคล" ? 2_000_000 : 1_200_000);
              const nickname = String(contractorRow["ชื่อเล่น"] || contractorRow.nickname || cleanContractorId);
              const fullName = String(contractorRow["ชื่อ-นามสกุล"] || contractorRow.full_name || "");

              setQuotaInfo({
                hasContractor: true,
                contractorId: cleanContractorId,
                contractorName: nickname || fullName,
                contractorNickname: nickname,
                contractorFullName: fullName,
                contractorType: type,
                annualLimit: limit,
                paidBillsThisYear: 0,
                pendingContractsThisYear: 0,
                totalUsedSoFar: 0,
                remainingBefore: limit,
                targetYear: new Date().getFullYear(),
                contractCount: 0,
                contractsSummary: []
              });
            } else {
              setQuotaInfo(null);
            }
          }
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn("Failed to fetch contractor annual quota:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cleanContractorId, excludeConworkId, contractorRow]);

  if (!cleanContractorId) {
    return null;
  }

  if (loading && !quotaInfo) {
    return (
      <div className={`h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-[11px] text-slate-400 animate-pulse ${className}`}>
        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0" />
        <span>กำลังตรวจโควตารายปีผู้รับเหมา...</span>
      </div>
    );
  }

  if (!quotaInfo || !quotaInfo.hasContractor) {
    return null;
  }

  const {
    contractorName,
    contractorType,
    annualLimit,
    paidBillsThisYear,
    pendingContractsThisYear,
    totalUsedSoFar,
    contractCount,
    targetYear,
    contractsSummary = []
  } = quotaInfo;

  const totalAfterThisContract = totalUsedSoFar + currentAmt;
  const remainingAfter = annualLimit - totalAfterThisContract;
  const percentUsed = annualLimit > 0 ? (totalAfterThisContract / annualLimit) * 100 : 0;
  const isOverQuota = totalAfterThisContract > annualLimit;
  const isWarning = !isOverQuota && percentUsed >= 70;

  return (
    <div
      className={`rounded-lg border px-3 py-1.5 transition-all text-xs font-sans relative overflow-hidden ${
        isOverQuota
          ? "bg-rose-50/80 border-rose-300 text-rose-950"
          : isWarning
          ? "bg-amber-50/80 border-amber-300 text-amber-950"
          : "bg-slate-50 border-slate-200 text-slate-900"
      } ${className}`}
    >
      {/* Header Info Tag: Contractor Name & Year */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 pb-1 border-b border-slate-200/60 mb-1">
        <div className="flex items-center gap-1.5 truncate">
          <Users size={12} className={isOverQuota ? "text-rose-500" : isWarning ? "text-amber-600" : "text-slate-400"} />
          <span className="font-medium text-slate-700 truncate">
            โควตารายปี: {contractorName}
          </span>
          <span className={`px-1 py-0.2 rounded text-[9px] font-semibold ${
            contractorType === "นิติบุคคล" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
          }`}>
            {contractorType}
          </span>
        </div>
        <span className="text-slate-400 text-[9px] shrink-0">
          ปี {targetYear}
        </span>
      </div>

      {/* 3 Metric Columns in 1 compact row (Identical to ContractLaborBudgetGuardrail) */}
      <div className="flex items-center justify-between gap-2">
        {/* Col 1: จำกัดยอด/ปี */}
        <div className="min-w-0 flex-1">
          <span className="text-[10px] text-slate-500 block truncate leading-tight">จำกัดยอด/ปี</span>
          <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block mt-0.5">
            {money(annualLimit)} ฿
          </span>
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Col 2: จ้างสะสมปีนี้ (เบิกจ่ายแล้ว + สัญญาค้างเบิก + สัญญานี้) */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 leading-tight">
            <span className="truncate">จ้างแล้วปีนี้</span>
            {contractCount > 0 && (
              <button
                type="button"
                onClick={() => setShowContractList(prev => !prev)}
                className="text-[9px] px-1 py-0.2 bg-white rounded border border-slate-200 hover:border-slate-400 text-slate-600 transition cursor-pointer"
                title="ดูรายการสัญญาของช่างในปีนี้"
              >
                {contractCount} 📋
              </button>
            )}
          </div>
          <span className="font-semibold text-slate-600 text-xs sm:text-sm truncate block mt-0.5">
            {money(totalAfterThisContract)} ฿
          </span>
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Col 3: คงเหลือ / เกินโควตา (Highlighted) */}
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center justify-end gap-1 text-[10px] leading-tight">
            <span className={`truncate font-medium ${isOverQuota ? "text-rose-600" : isWarning ? "text-amber-700" : "text-emerald-700"}`}>
              {remainingAfter < 0 ? "เกินโควตา" : "คงเหลือโควตา"}
            </span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
              isOverQuota ? "bg-rose-100 text-rose-700" : isWarning ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
            }`}>
              {percentUsed.toFixed(0)}%
            </span>
          </div>
          <span className={`font-bold text-xs sm:text-sm truncate block mt-0.5 ${
            isOverQuota ? "text-rose-600" : isWarning ? "text-amber-700" : "text-emerald-700"
          }`}>
            {remainingAfter < 0 ? `-${money(Math.abs(remainingAfter))} ฿` : `${money(remainingAfter)} ฿`}
          </span>
        </div>
      </div>

      {/* Slim 2.5px Progress Bar at bottom */}
      <div className="w-full bg-slate-200/80 h-1 rounded-full overflow-hidden mt-1.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOverQuota ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-600"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentUsed))}%` }}
        />
      </div>

      {/* Warning Notice if Over Quota or Warning */}
      {isOverQuota && (
        <div className="mt-1.5 pt-1.5 border-t border-rose-200/80 flex items-start gap-1.5 text-[10px] text-rose-700">
          <AlertTriangle size={12} className="shrink-0 text-rose-600 mt-0.5" />
          <span>
            ยอดจ้างนี้จะทำให้ยอดสะสมปีนี้เกินเพดาน <strong>{money(annualLimit)} ฿</strong> ไป <strong>{money(Math.abs(remainingAfter))} ฿</strong>
            {contractorType === "บุคคลธรรมดา" && " (เสี่ยงต่อเกณฑ์ภาษีบุคคลธรรมดา 1.8M / VAT)"}
          </span>
        </div>
      )}

      {/* Expandable popup/list for contractor's contract history if toggled */}
      {showContractList && contractsSummary.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px]">
            <span>ประวัติสัญญาปี {targetYear} ({contractsSummary.length} สัญญา):</span>
            <button
              type="button"
              onClick={() => setShowContractList(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ปิด ✕
            </button>
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {contractsSummary.map((c, i) => (
              <div key={c.id || i} className="bg-white p-1.5 rounded border border-slate-200 flex items-center justify-between gap-1 text-[10px]">
                <div className="truncate flex-1">
                  <span className="font-semibold text-slate-800 mr-1">#{c.id}</span>
                  <span className="text-slate-600 truncate">[{c.projectId}] {c.details || "งานรับเหมา"}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold text-slate-900 block">{money(c.hireAmount)} ฿</span>
                  <span className="text-[9px] text-slate-400">จ่าย {money(c.paidAmount)} | ค้าง {money(c.remainingAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
