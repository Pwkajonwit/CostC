"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { checkCategoryBudgetCap, type CategoryBudgetCheckResult } from "@/lib/bills/bill-validation";
import { money } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";

export type BillCategoryBudgetGuardrailProps = {
  values: Record<string, string>;
  projectRows?: SheetRow[];
  existingBills?: SheetRow[];
};

export function BillCategoryBudgetGuardrail({ values, projectRows = [], existingBills = [] }: BillCategoryBudgetGuardrailProps) {
  const [budgetStatus, setBudgetStatus] = useState<CategoryBudgetCheckResult | null>(null);

  const selectedProjectId = String(values["ID Project"] || "").trim();
  const selectedProduct = String(values["สินค้า"] || "").trim();
  const selectedCategory = String(values["ประเภท"] || "").trim();

  useEffect(() => {
    if (!selectedProjectId || (!selectedProduct && !selectedCategory)) {
      setBudgetStatus(null);
      return;
    }

    const matchedProject = projectRows.find(p => {
      const projId = String(p["ID Project"] || p.id || "").trim();
      const projName = String(p["ชื่อ Project"] || p.name || "").trim();
      if (!projId && !projName) return false;
      return (
        projId === selectedProjectId ||
        projName === selectedProjectId ||
        selectedProjectId.startsWith(`${projId} `) ||
        selectedProjectId.startsWith(`${projId} -`) ||
        selectedProjectId === `${projId} - ${projName}` ||
        (projId && selectedProjectId.includes(projId))
      );
    });

    if (!matchedProject) {
      setBudgetStatus(null);
      return;
    }

    const status = checkCategoryBudgetCap(values, matchedProject, existingBills);
    setBudgetStatus(status);
  }, [selectedProjectId, selectedProduct, selectedCategory, values, projectRows, existingBills]);

  if (!budgetStatus) {
    return null;
  }

  if (!budgetStatus.hasBudgetCap) {
    const label = budgetStatus.categoryLabel || selectedCategory || selectedProduct || "หมวดนี้";
    return (
      <div className="w-full min-w-0 max-w-full h-10 sm:h-9 px-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-slate-500 text-xs font-sans flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <Info size={14} className="text-slate-400 shrink-0" />
          <span className="truncate">หมวด '{label}': ไม่ได้ตั้งวงเงินคุมงบ</span>
        </div>
        <span className="text-[11px] text-slate-400 shrink-0 bg-slate-200/60 px-1.5 py-0.5 rounded">
          ไม่คุมงบ
        </span>
      </div>
    );
  }

  const {
    categoryLabel,
    budgetLimit,
    currentBillAmount,
    totalAfterBill,
    remainingAfterBill,
    percentUsedAfterBill,
    isOverBudget,
    isWarning,
  } = budgetStatus;

  return (
    <div
      className={`w-full min-w-0 max-w-full h-10 sm:h-9 px-3 rounded-lg border transition-all text-xs font-sans flex items-center justify-between gap-2 shadow-2xs ${
        isOverBudget
          ? "bg-rose-50 border-rose-300 text-rose-900 animate-pulse"
          : isWarning
          ? "bg-amber-50 border-amber-300 text-amber-900"
          : "bg-emerald-50/90 border-emerald-200/80 text-emerald-900"
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
        {isOverBudget ? (
          <ShieldAlert size={15} className="text-rose-600 shrink-0" />
        ) : isWarning ? (
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
        ) : (
          <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
        )}

        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span className="font-semibold text-xs truncate">คุมงบ: {categoryLabel}</span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0 ${
              isOverBudget
                ? "bg-rose-200 text-rose-800"
                : isWarning
                ? "bg-amber-200 text-amber-800"
                : "bg-emerald-200 text-emerald-800"
            }`}
          >
            {percentUsedAfterBill}%
          </span>
        </div>
      </div>

      <div className="text-right shrink-0 text-xs font-semibold">
        {remainingAfterBill < 0 ? (
          <span className="text-rose-700 font-bold">เกิน {money(Math.abs(remainingAfterBill))} ฿</span>
        ) : (
          <span className="text-emerald-800">คงเหลือ {money(remainingAfterBill)} ฿</span>
        )}
      </div>
    </div>
  );
}

export function BudgetStatusCard({
  check,
  prefix,
}: {
  check: CategoryBudgetCheckResult;
  prefix?: string;
}) {
  const {
    categoryLabel,
    remainingAfterBill,
    percentUsedAfterBill,
    isOverBudget,
    isWarning,
  } = check;

  const displayTitle = prefix ? `${prefix}: ${categoryLabel}` : `คุมงบ: ${categoryLabel}`;

  return (
    <div
      className={`w-full min-w-0 h-9 px-3 rounded-lg border transition-all text-xs font-sans flex items-center justify-between gap-2 shadow-2xs ${
        isOverBudget
          ? "bg-rose-50 border-rose-300 text-rose-950 animate-pulse"
          : isWarning
          ? "bg-amber-50 border-amber-300 text-amber-950"
          : "bg-emerald-50/90 border-emerald-200/80 text-emerald-950"
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
        {isOverBudget ? (
          <ShieldAlert size={14} className="text-rose-600 shrink-0" />
        ) : isWarning ? (
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
        ) : (
          <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
        )}

        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span className="font-semibold text-xs truncate">{displayTitle}</span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0 ${
              isOverBudget
                ? "bg-rose-200 text-rose-800"
                : isWarning
                ? "bg-amber-200 text-amber-800"
                : "bg-emerald-200 text-emerald-800"
            }`}
          >
            {percentUsedAfterBill}%
          </span>
        </div>
      </div>

      <div className="text-right shrink-0 text-xs font-semibold pl-1">
        {remainingAfterBill < 0 ? (
          <span className="text-rose-700 font-bold">เกินงบ {money(Math.abs(remainingAfterBill))} ฿</span>
        ) : (
          <span className="text-emerald-800">คงเหลือ {money(remainingAfterBill)} ฿</span>
        )}
      </div>
    </div>
  );
}

export type MultiItemsBudgetGuardrailProps = {
  items: { id: string; category: string; categoryType: string; amount: string }[];
  projectId: string;
  projectRows?: SheetRow[];
  values: Record<string, string>;
  existingBills?: SheetRow[];
};

export function MultiItemsBudgetGuardrail({
  items,
  projectId,
  projectRows = [],
  values,
  existingBills = [],
}: MultiItemsBudgetGuardrailProps) {
  const matchedProject = projectRows.find(p => {
    const projId = String(p["ID Project"] || p.id || "").trim();
    const projName = String(p["ชื่อ Project"] || p.name || "").trim();
    if (!projId && !projName) return false;
    return (
      projId === projectId ||
      projName === projectId ||
      projectId.startsWith(`${projId} `) ||
      projectId.startsWith(`${projId} -`) ||
      projectId === `${projId} - ${projName}` ||
      (projId && projectId.includes(projId))
    );
  });

  if (!matchedProject || items.length === 0) return null;

  // ตรวจสอบงบภาพรวมของหมวดหมู่ในบิล (เช่น ค่าของ ภาพรวม)
  // หมายเหตุ: งบเฉพาะรายการย่อยได้แสดงแยกอยู่ใต้แต่ละแถวแล้ว ที่นี่จึงแสดงเฉพาะงบภาพรวมของหมวด
  const distinctTypes = Array.from(
    new Set(items.map(i => (i.categoryType || "1.ค่าของ").trim()).filter(Boolean))
  );
  if (distinctTypes.length === 0) distinctTypes.push(values["ประเภท"] || "1.ค่าของ");

  const overallChecks = distinctTypes
    .map(catType => {
      const amtSum = items
        .filter(i => (i.categoryType || "1.ค่าของ").trim() === catType)
        .reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const rowForCat: SheetRow = {
        ...values,
        "สินค้า": "", // เคลียร์สินค้าออกเพื่อให้คำนวณงบภาพรวมของหมวดหมู่ ไม่ไปจับคู่งบเฉพาะสินค้า
        "ประเภท": catType,
        "ยอดเงิน": String(amtSum),
        "ค่าของ": catType === "1.ค่าของ" ? String(amtSum) : "",
        "เครื่องมือ": catType === "7.เครื่องมือ" ? String(amtSum) : "",
        "อื่นๆ": catType === "8.อื่นๆ" ? String(amtSum) : "",
      };
      return checkCategoryBudgetCap(rowForCat, matchedProject, existingBills);
    })
    .filter(c => c && c.hasBudgetCap);

  // หากไม่มีหมวดใดที่ตั้งงบภาพรวมไว้
  if (overallChecks.length === 0) {
    return (
      <div className="w-full h-9 px-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-slate-500 text-xs font-sans flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-1.5 truncate">
          <Info size={14} className="text-slate-400 shrink-0" />
          <span className="truncate">โครงการนี้ไม่ได้ตั้งวงเงินคุมงบสำหรับหมวดหมู่นี้</span>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0 bg-slate-200/60 px-1.5 py-0.5 rounded">
          ไม่คุมงบ
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-full">
      {overallChecks.map(check => (
        <BudgetStatusCard
          key={check.categoryLabel}
          check={check}
          prefix="คุมงบภาพรวม"
        />
      ))}
    </div>
  );
}

