"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileText, Info, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";

export type ContractLaborBudgetGuardrailProps = {
  projectId: string;
  currentHireAmount: number | string;
  excludeConworkId?: string;
  projectRow?: Record<string, any>;
  className?: string;
};

type LaborBudgetInfo = {
  hasLaborBudget: boolean;
  laborBudgetCap: number;
  totalContractedSoFar: number;
  contractCount: number;
  remainingBefore: number;
  projectName?: string;
  contractsSummary?: Array<{
    id: string;
    contractor: string;
    amount: number;
    details: string;
  }>;
};

export function ContractLaborBudgetGuardrail({
  projectId,
  currentHireAmount,
  excludeConworkId,
  projectRow,
  className = ""
}: ContractLaborBudgetGuardrailProps) {
  const [budgetInfo, setBudgetInfo] = useState<LaborBudgetInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showContractList, setShowContractList] = useState(false);

  const cleanProjectId = String(projectId || "").trim();
  const currentAmt = toNumber(currentHireAmount);

  useEffect(() => {
    if (!cleanProjectId) {
      setBudgetInfo(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/project-labor-budget?projectId=${encodeURIComponent(cleanProjectId)}&excludeConworkId=${encodeURIComponent(excludeConworkId || "")}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.success) {
            setBudgetInfo(data);
          } else {
            // Fallback from projectRow if available
            if (projectRow) {
              const cap = toNumber(
                projectRow["งบไม่เกินค่าแรง"] ||
                projectRow["2.ค่าแรง"] ||
                projectRow["2. ค่าแรง"] ||
                projectRow["ค่าแรง"] ||
                (projectRow.data && typeof projectRow.data === "object" ? (
                  projectRow.data["งบไม่เกินค่าแรง"] ||
                  projectRow.data["2.ค่าแรง"] ||
                  projectRow.data["2. ค่าแรง"]
                ) : 0) ||
                (projectRow.budget_caps && typeof projectRow.budget_caps === "object" ? (
                  projectRow.budget_caps["งบไม่เกินค่าแรง"] ||
                  projectRow.budget_caps["2.ค่าแรง"] ||
                  projectRow.budget_caps["2. ค่าแรง"]
                ) : 0)
              );
              setBudgetInfo({
                hasLaborBudget: cap > 0,
                laborBudgetCap: cap,
                totalContractedSoFar: 0,
                contractCount: 0,
                remainingBefore: cap,
                projectName: String(projectRow["ชื่อ Project"] || cleanProjectId)
              });
            } else {
              setBudgetInfo(null);
            }
          }
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn("Failed to fetch project labor budget:", err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cleanProjectId, excludeConworkId, projectRow]);

  if (!cleanProjectId) {
    return null;
  }

  if (loading && !budgetInfo) {
    return (
      <div className={`h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-[11px] text-slate-400 animate-pulse ${className}`}>
        <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0" />
        <span>กำลังตรวจงบค่าแรง...</span>
      </div>
    );
  }

  if (!budgetInfo || !budgetInfo.hasLaborBudget) {
    return (
      <div className={`h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px] text-slate-400 ${className}`}>
        <span>งบค่าแรง: ไม่ได้จำกัดวงเงิน</span>
        <span className="text-[10px] text-slate-400">เปิดจ้างได้ตามจริง</span>
      </div>
    );
  }

  const {
    laborBudgetCap,
    totalContractedSoFar,
    contractCount,
    contractsSummary = []
  } = budgetInfo;

  const totalAfterThisContract = totalContractedSoFar + currentAmt;
  const remainingAfter = laborBudgetCap - totalAfterThisContract;
  const percentUsed = laborBudgetCap > 0 ? (totalAfterThisContract / laborBudgetCap) * 100 : 0;
  const isOverBudget = totalAfterThisContract > laborBudgetCap;
  const isWarning = !isOverBudget && percentUsed >= 85;

  return (
    <div
      className={`rounded-lg border px-3 py-1.5 transition-all text-xs font-sans relative overflow-hidden ${
        isOverBudget
          ? "bg-rose-50/80 border-rose-300 text-rose-950"
          : isWarning
          ? "bg-amber-50/80 border-amber-300 text-amber-950"
          : "bg-slate-50 border-slate-200 text-slate-900"
      } ${className}`}
    >
      {/* 3 Metric Columns in 1 compact row */}
      <div className="flex items-center justify-between gap-2">
        {/* Col 1: งบทั้งหมด */}
        <div className="min-w-0 flex-1">
          <span className="text-[10px] text-slate-500 block truncate leading-tight">งบค่าแรง</span>
          <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate block mt-0.5">
            {money(laborBudgetCap)} ฿
          </span>
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Col 2: เปิดแล้ว */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[10px] text-slate-500 leading-tight">
            <span className="truncate">เปิดแล้ว</span>
            {contractCount > 0 && (
              <button
                type="button"
                onClick={() => setShowContractList(prev => !prev)}
                className="text-[9px] px-1 py-0.2 bg-white rounded border border-slate-200 hover:border-slate-400 text-slate-600 transition cursor-pointer"
                title="ดูรายการสัญญาที่เปิดแล้ว"
              >
                {contractCount} 📋
              </button>
            )}
          </div>
          <span className="font-semibold text-slate-600 text-xs sm:text-sm truncate block mt-0.5">
            {money(totalContractedSoFar)} ฿
          </span>
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        {/* Col 3: คงเหลือ (Highlighted) */}
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center justify-end gap-1 text-[10px] leading-tight">
            <span className={`truncate font-medium ${isOverBudget ? "text-rose-600" : isWarning ? "text-amber-700" : "text-emerald-700"}`}>
              {remainingAfter < 0 ? "เกินงบ" : "คงเหลือ"}
            </span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
              isOverBudget ? "bg-rose-100 text-rose-700" : isWarning ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
            }`}>
              {percentUsed.toFixed(0)}%
            </span>
          </div>
          <span className={`font-bold text-xs sm:text-sm truncate block mt-0.5 ${
            isOverBudget ? "text-rose-600" : isWarning ? "text-amber-700" : "text-emerald-700"
          }`}>
            {remainingAfter < 0 ? `-${money(Math.abs(remainingAfter))} ฿` : `${money(remainingAfter)} ฿`}
          </span>
        </div>
      </div>

      {/* Slim 2.5px Progress Bar at bottom */}
      <div className="w-full bg-slate-200/80 h-1 rounded-full overflow-hidden mt-1.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOverBudget ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-600"
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentUsed))}%` }}
        />
      </div>

      {/* Expandable popup/list for contract history if toggled */}
      {showContractList && contractsSummary.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px]">
            <span>ประวัติสัญญาเดิม ({contractsSummary.length} รายการ):</span>
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
                <span className="truncate text-slate-700">{c.contractor || c.id} ({c.details || "งานรับเหมา"})</span>
                <span className="font-semibold text-slate-900 shrink-0">{money(c.amount)} ฿</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
