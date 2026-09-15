"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Coins,
  Layers,
  PieChart,
  ShieldAlert,
  Sparkles,
  X,
  Building2,
  Home,
  Zap,
  Truck,
  Package,
  BarChart3,
  Table as TableIcon,
  LayoutGrid,
  Search,
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  FileText,
  Filter
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import { getRowAmount, getRowTransferAmount } from "@/lib/reports";
import { isPaidBill, isCommittedBill } from "@/lib/bills/bill-status";
import { isMaterialCost, isLaborCost, isStaffCost } from "@/lib/cost-codes";

import {
  ALLOCATED_BUDGET_ITEMS,
  BudgetItemDefinition,
  extractBillItems,
  matchesBudgetItem,
  getProjectBudgetValue,
} from "@/lib/project-budget-control";

export type ProjectBudgetControlMatrixProps = {
  projectRows: SheetRow[];
  dataRows: SheetRow[];
  selectedProjectId: string;
  onSelectProject?: (projId: string) => void;
};

type ViewMode = "all" | "chart" | "table";

export function ProjectBudgetControlMatrix({
  projectRows,
  dataRows,
  selectedProjectId,
  onSelectProject
}: ProjectBudgetControlMatrixProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [budgetGroupFilter, setBudgetGroupFilter] = useState<"all" | "material" | "labor">("all");
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<"all" | "spent" | "over" | "available">("all");
  const [drilldownModal, setDrilldownModal] = useState<{ title: string; rows: SheetRow[] } | null>(null);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all") return null;
    return projectRows.find(p => String(p["ID Project"] || "").trim() === selectedProjectId) || null;
  }, [projectRows, selectedProjectId]);

  const projectBills = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all") return dataRows;
    return dataRows.filter(b => String(b["ID Project"] || "").trim() === selectedProjectId);
  }, [dataRows, selectedProjectId]);

  const parsedProjectBillItems = useMemo(() => {
    return extractBillItems(projectBills);
  }, [projectBills]);

  const categoryAnalysis = useMemo(() => {
    return ALLOCATED_BUDGET_ITEMS.map((def) => {
      // 1. Calculate Budget Cap
      let budgetCap = 0;
      if (selectedProject) {
        budgetCap = getProjectBudgetValue(selectedProject, def.field, def.code);
      } else {
        budgetCap = projectRows.reduce((sum, p) => sum + getProjectBudgetValue(p, def.field, def.code), 0);
      }

      // 2. Matched parsed bill items
      const matchedItems = parsedProjectBillItems.filter((it) => matchesBudgetItem(it, def));

      // Matched unique bills
      const billMap = new Map<string | number, SheetRow>();
      matchedItems.forEach((it) => {
        billMap.set(it.billId, it.rawBill);
      });
      const matchingBills = Array.from(billMap.values());
      const paidMatchingBills = matchingBills.filter(isPaidBill);
      const pendingMatchingBills = matchingBills.filter((b) => !isPaidBill(b) && isCommittedBill(b));

      const actualSpent = matchedItems
        .filter((it) => it.isPaid)
        .reduce((sum, it) => sum + it.amount, 0);

      const pendingSpent = matchedItems
        .filter((it) => !it.isPaid)
        .reduce((sum, it) => sum + it.amount, 0);

      const totalCommitted = actualSpent + pendingSpent;
      const remaining = budgetCap - totalCommitted;
      const usagePercent = budgetCap > 0 ? Number(((totalCommitted / budgetCap) * 100).toFixed(1)) : 0;
      const isOver = budgetCap > 0 && totalCommitted > budgetCap;
      const isWarning = budgetCap > 0 && !isOver && (usagePercent >= 85 || totalCommitted > budgetCap);

      return {
        ...def,
        budgetCap,
        actualSpent,
        pendingSpent,
        totalCommitted,
        remaining,
        usagePercent,
        isOver,
        isWarning,
        matchingBills,
        paidMatchingBills,
        pendingMatchingBills,
      };
    });
  }, [selectedProject, projectRows, parsedProjectBillItems]);

  const filteredCategoryAnalysis = useMemo(() => {
    let list = categoryAnalysis;
    if (budgetGroupFilter === "material") {
      list = list.filter((c) => c.group === "ค่าของ (Material Cost Code)");
    } else if (budgetGroupFilter === "labor") {
      list = list.filter((c) => c.group === "ค่าแรง (Labor Cost Code)");
    }

    if (budgetStatusFilter === "spent") {
      list = list.filter((c) => c.totalCommitted > 0);
    } else if (budgetStatusFilter === "over") {
      list = list.filter((c) => c.isOver);
    } else if (budgetStatusFilter === "available") {
      list = list.filter((c) => c.remaining > 0);
    }

    const query = searchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.label.toLowerCase().includes(query) ||
          c.group.toLowerCase().includes(query)
      );
    }
    return list;
  }, [categoryAnalysis, budgetGroupFilter, budgetStatusFilter, searchTerm]);

  const categoryComparisonStats = useMemo(() => {
    return categoryAnalysis
      .filter((c) => c.budgetCap > 0 || c.totalCommitted > 0)
      .slice(0, 15)
      .map((cat) => {
        const capSum = cat.budgetCap;
        const spentSum = cat.totalCommitted;
        const usagePercent = cat.usagePercent;
        const isOver = cat.isOver;
        const isWarning = cat.isWarning;
        const totalBills = cat.matchingBills.length;

        return {
          title: `${cat.code}. ${cat.label.replace(/^\d+\.\s*/, "")}`,
          icon: cat.icon || "📦",
          capSum,
          spentSum,
          usagePercent,
          isOver,
          isWarning,
          totalBills,
        };
      });
  }, [categoryAnalysis]);

  const topCategoriesChart = useMemo(() => {
    return [...categoryAnalysis]
      .filter((c) => c.totalCommitted > 0)
      .sort((a, b) => b.totalCommitted - a.totalCommitted)
      .slice(0, 5);
  }, [categoryAnalysis]);

  const riskAlertCategories = useMemo(() => {
    return categoryAnalysis.filter((c) => c.isOver || c.isWarning);
  }, [categoryAnalysis]);

  const totalProjectCap = selectedProject
    ? toNumber(selectedProject["งบไม่เกิน"] || selectedProject["ยอดงาน"])
    : projectRows.reduce((sum, p) => sum + toNumber(p["งบไม่เกิน"] || p["ยอดงาน"]), 0);

  const totalCategoryCapAllocated = categoryAnalysis.reduce((sum, c) => sum + c.budgetCap, 0);
  const paidProjectBills = useMemo(() => projectBills.filter(isPaidBill), [projectBills]);
  const pendingProjectBills = useMemo(
    () => projectBills.filter((b) => !isPaidBill(b) && isCommittedBill(b)),
    [projectBills]
  );
  const totalActualSpent = useMemo(
    () => paidProjectBills.reduce((sum, b) => sum + getRowTransferAmount(b), 0),
    [paidProjectBills]
  );
  const totalPendingSpent = useMemo(
    () => pendingProjectBills.reduce((sum, b) => sum + getRowTransferAmount(b), 0),
    [pendingProjectBills]
  );
  const overallUsagePercent =
    totalProjectCap > 0 ? Number((((totalActualSpent + totalPendingSpent) / totalProjectCap) * 100).toFixed(1)) : 0;

  return (
    <div className="bg-white text-slate-900 rounded-lg border border-slate-200 p-4 sm:p-5 space-y-4 font-sans my-4 max-w-full">
      {/* 1. EXECUTIVE TITLE & TOOLBAR CONTROLS */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-normal">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-700 text-white rounded-md">
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 className="text-base font-normal text-slate-900 tracking-tight">
                รายงานวิเคราะห์ความเสี่ยงงบประมาณโครงการ
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-normal">
                วิเคราะห์วงเงินคุมงบ
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Selector Buttons */}
          <div className="inline-flex p-1 bg-white rounded-md border border-slate-300 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded font-normal transition flex items-center gap-1.5 cursor-pointer ${viewMode === "all" ? "bg-slate-900 text-white" : "text-slate-700 hover:text-slate-900"
                }`}
            >
              <LayoutGrid size={14} />
              <span>แสดงทั้งหมด</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("chart")}
              className={`px-3 py-1.5 rounded font-normal transition flex items-center gap-1.5 cursor-pointer ${viewMode === "chart" ? "bg-slate-900 text-white" : "text-slate-700 hover:text-slate-900"
                }`}
            >
              <BarChart3 size={14} />
              <span>กราฟวิเคราะห์</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded font-normal transition flex items-center gap-1.5 cursor-pointer ${viewMode === "table" ? "bg-slate-900 text-white" : "text-slate-700 hover:text-slate-900"
                }`}
            >
              <TableIcon size={14} />
              <span>ตารางคุมงบ</span>
            </button>
          </div>

          {/* Project Dropdown Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectProject?.(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 min-w-[200px]"
            >
              <option value="all">📂 รวมทุกโครงการ ({projectRows.length} โครงการ)</option>
              {projectRows.map((p) => {
                const id = String(p["ID Project"] || p.id || "").trim();
                const name = String(p["ชื่อ Project"] || p.name || "").trim();
                return (
                  <option key={id} value={id}>
                    {id} - {name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Project Cap */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-slate-600 uppercase">งบโครงการรวม (Project Cap)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-normal">
              <Coins size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-normal text-slate-900">{money(totalProjectCap)} ฿</div>
            <div className="text-xs text-slate-500 mt-0.5 font-normal">วงเงินงบประมาณตั้งต้นของโครงการ</div>
          </div>
        </div>

        {/* Card 2: Total Category Allocated Cap */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-slate-600 uppercase">รวมงบจัดสรรรายหมวด</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-normal">
              <Layers size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-normal text-sky-800">{money(totalCategoryCapAllocated)} ฿</div>
            <div className="text-xs text-slate-500 mt-0.5 font-normal">
              {totalProjectCap > 0 ? `จัดสรรไปแล้ว ${((totalCategoryCapAllocated / totalProjectCap) * 100).toFixed(1)}%` : "กระจายงบตามหมวดสินค้า"}
            </div>
          </div>
        </div>

        {/* Card 3: Total Actual Spent */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-slate-600 uppercase">ยอดเบิกจ่ายจริงสะสม</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-normal">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl font-normal text-emerald-800">{money(totalActualSpent)} ฿</div>
            <div className="text-xs text-slate-500 mt-0.5 font-normal">
              จากบิลเบิกแล้ว {paidProjectBills.length} บิล
              {totalPendingSpent > 0 && (
                <span className="text-amber-600 ml-1">(รอเบิก {money(totalPendingSpent)} ฿)</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Budget Risk Level */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-slate-600 uppercase">สถานะความเสี่ยงงบประมาณ</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-normal ${overallUsagePercent > 100 ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}>
              {overallUsagePercent > 100 ? <ShieldAlert size={16} className="animate-pulse" /> : <ShieldCheck size={16} />}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className={`text-xl font-normal ${overallUsagePercent > 100 ? "text-rose-700" : "text-slate-900"}`}>
                {overallUsagePercent}%
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-normal border ${overallUsagePercent > 100
                  ? "bg-rose-100 text-rose-900 border-rose-300"
                  : overallUsagePercent >= 85
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-emerald-100 text-emerald-900 border-emerald-300"
                }`}>
                {overallUsagePercent > 100 ? "เกินงบโครงการ" : overallUsagePercent >= 85 ? "เฝ้าระวังงบ" : "ปกติ"}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${overallUsagePercent > 100 ? "bg-rose-600" : overallUsagePercent >= 85 ? "bg-amber-500" : "bg-emerald-600"
                  }`}
                style={{ width: `${Math.min(100, overallUsagePercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. RISK ALERT BANNER (If any over-budget or warning categories exist) */}
      {riskAlertCategories.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 p-4 rounded-lg space-y-2 font-normal">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <span className="font-normal text-amber-950 text-xs flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-amber-700 animate-pulse" />
              <span>รายการแจ้งเตือนหมวดที่มีความเสี่ยงงบประมาณ (พบ {riskAlertCategories.length} หมวดเสี่ยง/เกินงบ)</span>
            </span>
            <span className="text-xs font-normal text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full border border-amber-300">
              ต้องติดตามเป็นพิเศษ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {riskAlertCategories.map((cat, idx) => (
              <div key={idx} className="bg-white p-2.5 rounded-md border border-amber-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-normal text-slate-900 text-xs block truncate">{cat.label}</span>
                  <span className="text-xs text-slate-600 font-normal block mt-0.5">
                    จ่ายแล้ว: <span className="text-emerald-800">{money(cat.actualSpent)}</span> / Cap: {money(cat.budgetCap)} ฿
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-normal shrink-0 border ${cat.isOver ? "bg-rose-100 text-rose-900 border-rose-300" : "bg-amber-100 text-amber-950 border-amber-300"
                  }`}>
                  {cat.isOver ? `เกิน ${money(Math.abs(cat.remaining))}` : `ใช้ไป ${cat.usagePercent}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. VISUAL CHARTS SECTION (GRAPH DASHBOARD) */}
      {(viewMode === "all" || viewMode === "chart") && (
        <div className="space-y-4 font-normal">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* CHART A: CATEGORY BUDGET COMPARISON BAR CHART (2 Columns) */}
            <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-xs font-normal text-slate-900 flex items-center gap-2">
                  <BarChart3 size={16} className="text-emerald-700" />
                  <span>เปรียบเทียบ วงเงินคุมงบ (Cap) vs ยอดจ่ายจริง (Actual) รายหมวด</span>
                </h3>
                <span className="text-xs text-slate-500 font-normal">Category Budget Analysis</span>
              </div>

              <div className="space-y-3">
                {categoryComparisonStats.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs font-normal">
                    ไม่มีข้อมูลเปรียบเทียบสำหรับเงื่อนไขนี้
                  </div>
                ) : (
                  categoryComparisonStats.map((item) => (
                    <div key={item.title} className="bg-white border border-slate-200 rounded-md p-3.5 space-y-2 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <span className="font-normal text-slate-900 flex items-center gap-1.5">
                          <span>{item.icon}</span>
                          <span>{item.title}</span>
                          <span className="text-xs text-slate-500 font-normal">({item.totalBills} บิล)</span>
                        </span>

                        <div className="flex items-center gap-2 text-xs font-normal">
                          <span className="text-slate-700">Cap: <span className="text-slate-900 font-normal">{money(item.capSum)}</span> ฿</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-700">Spent: <span className="text-emerald-800 font-normal">{money(item.spentSum)}</span> ฿</span>
                          {item.isOver ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-normal text-xs border border-rose-300">เกินงบ</span>
                          ) : item.isWarning ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full font-normal text-xs border border-amber-300">เฝ้าระวัง</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-normal text-xs border border-emerald-300">ปกติ</span>
                          )}
                        </div>
                      </div>

                      {/* Visual Dual Comparison Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-300 flex">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${item.isOver ? "bg-rose-600" : item.isWarning ? "bg-amber-500" : "bg-emerald-600"
                              }`}
                            style={{ width: `${Math.min(100, item.usagePercent)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-700 font-normal">
                          <span>ใช้วงเงินไป {item.usagePercent}%</span>
                          <span>
                            {item.capSum > 0
                              ? item.capSum - item.spentSum >= 0
                                ? `คงเหลือ ${money(item.capSum - item.spentSum)} ฿`
                                : `เกินงบ ${money(Math.abs(item.capSum - item.spentSum))} ฿`
                              : `จ่ายสะสม ${money(item.spentSum)} ฿`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CHART B: TOP 5 HIGHEST SPENDING CATEGORIES (1 Column) */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-xs font-normal text-slate-900 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-600" />
                  <span>5 อันดับหมวดสินค้าที่เบิกจ่ายสูงสุด</span>
                </h3>
                <span className="text-xs text-slate-500 font-normal">Top 5 Spending</span>
              </div>

              <div className="space-y-3">
                {topCategoriesChart.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs font-normal">
                    ยังไม่มีรายการเบิกจ่ายในหมวดสินค้า
                  </div>
                ) : (
                  topCategoriesChart.map((cat, idx) => {
                    const shareOfTotal = totalActualSpent > 0 ? (cat.actualSpent / totalActualSpent) * 100 : 0;

                    return (
                      <div key={cat.field} className="bg-white border border-slate-200 rounded-md p-3 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-normal text-slate-900 flex items-center gap-2 truncate">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-normal flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate">{cat.label}</span>
                          </span>
                          <span className="font-normal text-emerald-800 text-xs shrink-0">
                            {money(cat.actualSpent)} ฿
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-slate-900 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, shareOfTotal)}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-xs text-slate-600 font-normal">
                          <span>{cat.matchingBills.length} บิล</span>
                          <span>{shareOfTotal.toFixed(1)}% ของยอดรวม</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* CHART C: BUDGET ALLOCATION DISTRIBUTION GRID */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-xs font-normal text-slate-900 flex items-center gap-2">
                <PieChart size={16} className="text-sky-700" />
                <span>การกระจายสัดส่วนงบประมาณแยกตามหมวดสินค้า (Category Spending Distribution)</span>
              </h3>
              <span className="text-xs text-slate-500 font-normal">Category Breakdown</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryComparisonStats.filter(c => c.spentSum > 0).map((cat) => {
                const itemShare = totalActualSpent > 0 ? (cat.spentSum / totalActualSpent) * 100 : 0;

                return (
                  <div key={cat.title} className="bg-white p-3 rounded-md border border-slate-200 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-normal text-slate-900 flex items-center gap-1.5 truncate">
                        <span>{cat.icon}</span>
                        <span className="truncate">{cat.title}</span>
                      </span>
                      <span className="font-normal text-slate-900 text-xs shrink-0">{itemShare.toFixed(1)}%</span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-sky-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, itemShare)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-slate-600 font-normal">
                      <span>เบิกจ่าย: {money(cat.spentSum)} ฿</span>
                      <span>{cat.totalBills} บิล</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. CATEGORY CONTROL BREAKDOWN TABLE (MATRIX VIEW) */}
      {(viewMode === "all" || viewMode === "table") && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm space-y-3 p-4 font-normal">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-normal text-slate-900 flex items-center gap-2">
                <TableIcon size={16} className="text-slate-800" />
                <span>ตารางคุมงบประมาณ 51 รายการ (Category Budget Control Matrix)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">
                ตารางสรุปวงเงิน Cap vs เบิกจริง และภาระผูกพันรายหมวดสินค้า/ค่าแรง ({filteredCategoryAnalysis.length} รายการ)
              </p>
            </div>

            {/* Category Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหารหัส หรือ ชื่อหมวด..."
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 w-full sm:w-60"
              />
            </div>
          </div>

          {/* Group & Status Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setBudgetGroupFilter("all")}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    budgetGroupFilter === "all"
                      ? "bg-white text-slate-900 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ทั้งหมด (51 รายการ)
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetGroupFilter("material")}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    budgetGroupFilter === "material"
                      ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📦 ค่าของ (27)
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetGroupFilter("labor")}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    budgetGroupFilter === "labor"
                      ? "bg-white text-indigo-800 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  👷 ค่าแรง & พนักงาน (24)
                </button>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setBudgetStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    budgetStatusFilter === "all"
                      ? "bg-white text-slate-900 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ทุกสถานะ
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetStatusFilter("spent")}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    budgetStatusFilter === "spent"
                      ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  เบิกแล้ว ({categoryAnalysis.filter((c) => c.totalCommitted > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetStatusFilter("over")}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    budgetStatusFilter === "over"
                      ? "bg-white text-rose-700 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  เกินงบ ({categoryAnalysis.filter((c) => c.isOver).length})
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetStatusFilter("available")}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    budgetStatusFilter === "available"
                      ? "bg-white text-blue-700 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  งบยังเหลือ ({categoryAnalysis.filter((c) => c.remaining > 0).length})
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px] border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-slate-900 text-white font-normal sticky top-0 z-10 whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-3 font-normal text-center w-16">รหัส</th>
                  <th className="py-2.5 px-3.5 font-normal">หมวดสินค้า / ประเภทงาน</th>
                  <th className="py-2.5 px-3 font-normal text-slate-300">หมวดหลัก</th>
                  <th className="py-2.5 px-3.5 text-right font-normal">งบตั้งไว้ (Cap)</th>
                  <th className="py-2.5 px-3.5 text-right text-emerald-300 font-normal">จ่ายจริง (Actual)</th>
                  <th className="py-2.5 px-3.5 text-right text-amber-300 font-normal">รอจ่าย (Pending)</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold text-white">รวมใช้ไป</th>
                  <th className="py-2.5 px-3.5 text-right font-normal">งบคงเหลือ</th>
                  <th className="py-2.5 px-3.5 text-center w-36 font-normal">สัดส่วนการใช้งบ</th>
                  <th className="py-2.5 px-3 text-center font-normal">สถานะ</th>
                  <th className="py-2.5 px-3 text-center font-normal">ดูบิล</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-900 bg-white font-normal">
                {filteredCategoryAnalysis.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500 font-normal">
                      ไม่พบข้อมูลหมวดสินค้าที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredCategoryAnalysis.map((cat, idx) => {
                    const isMaterial = cat.group === "ค่าของ (Material Cost Code)";

                    return (
                      <tr key={`${cat.code}-${idx}`} className="hover:bg-slate-50 transition border-b border-slate-100">
                        {/* Cost Code Badge */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold ${
                              isMaterial
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                            }`}
                          >
                            {cat.code}
                          </span>
                        </td>

                        {/* Category Label */}
                        <td className="py-2.5 px-3.5 font-medium text-slate-900 flex items-center gap-2 whitespace-nowrap">
                          <span>{cat.icon || "📦"}</span> <span>{cat.label}</span>
                        </td>

                        {/* Group */}
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {isMaterial ? "ค่าของ" : "ค่าแรง & พนักงาน"}
                        </td>

                        {/* Budget Cap */}
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-900">
                          {cat.budgetCap > 0 ? `${money(cat.budgetCap)}` : "-"}
                        </td>

                        {/* Actual Spend */}
                        <td className="py-2.5 px-3.5 text-right font-mono text-emerald-800 bg-emerald-50/20">
                          {cat.actualSpent > 0 ? `${money(cat.actualSpent)}` : "-"}
                        </td>

                        {/* Pending Spend */}
                        <td className="py-2.5 px-3.5 text-right font-mono text-amber-700">
                          {cat.pendingSpent > 0 ? `${money(cat.pendingSpent)}` : "-"}
                        </td>

                        {/* Total Committed */}
                        <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-900">
                          {cat.totalCommitted > 0 ? `${money(cat.totalCommitted)}` : "-"}
                        </td>

                        {/* Remaining / Over */}
                        <td
                          className={`py-2.5 px-3.5 text-right font-mono font-semibold ${
                            cat.remaining < 0 ? "text-rose-700" : cat.budgetCap > 0 ? "text-emerald-700" : "text-slate-400"
                          }`}
                        >
                          {cat.budgetCap > 0
                            ? cat.remaining < 0
                              ? `-${money(Math.abs(cat.remaining))}`
                              : `${money(cat.remaining)}`
                            : cat.totalCommitted > 0
                            ? `-${money(cat.totalCommitted)}`
                            : "-"}
                        </td>

                        {/* Progress Bar */}
                        <td className="py-2.5 px-3.5 align-middle">
                          {cat.budgetCap > 0 ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-800 font-normal">
                                <span>{cat.usagePercent}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-300">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    cat.isOver ? "bg-rose-600" : cat.isWarning ? "bg-amber-500" : "bg-emerald-600"
                                  }`}
                                  style={{ width: `${Math.min(100, cat.usagePercent)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 block text-center">-</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {cat.budgetCap === 0 && cat.totalCommitted === 0 ? (
                            <span className="text-xs font-normal text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              ยังไม่เบิก
                            </span>
                          ) : cat.isOver ? (
                            <span className="text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded-full inline-flex items-center justify-center gap-1">
                              <AlertCircle size={12} /> เกินงบ
                            </span>
                          ) : cat.isWarning ? (
                            <span className="text-xs font-medium bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center justify-center gap-1">
                              <AlertTriangle size={12} /> เฝ้าระวัง
                            </span>
                          ) : cat.totalCommitted > 0 ? (
                            <span className="text-xs font-medium bg-emerald-100 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center justify-center gap-1">
                              <CheckCircle2 size={12} /> ปกติ
                            </span>
                          ) : (
                            <span className="text-xs font-normal text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                              ยังไม่เบิก
                            </span>
                          )}
                        </td>

                        {/* Drilldown Action */}
                        <td className="py-2.5 px-3 text-center">
                          {cat.matchingBills.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDrilldownModal({
                                  title: `รายการบิลเบิกจ่ายหมวด "${cat.code}. ${cat.label}" (${cat.matchingBills.length} รายการ)`,
                                  rows: cat.matchingBills,
                                })
                              }
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-medium rounded-md border border-slate-300 transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-xs"
                            >
                              <span>{cat.matchingBills.length}</span>
                              <ChevronRight size={12} />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {filteredCategoryAnalysis.length > 0 && (
                <tfoot className="sticky bottom-0 z-20 bg-slate-100 text-slate-900 font-semibold text-xs border-t-2 border-slate-300 shadow-2xs whitespace-nowrap">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 border-r border-slate-300 text-slate-900">
                      รวม ({filteredCategoryAnalysis.length} รายการ)
                    </td>
                    <td className="py-2.5 px-3.5 text-right border-r border-slate-300 font-mono">
                      {money(filteredCategoryAnalysis.reduce((sum, c) => sum + c.budgetCap, 0))}
                    </td>
                    <td className="py-2.5 px-3.5 text-right border-r border-slate-300 font-mono text-emerald-800 bg-emerald-100">
                      {money(filteredCategoryAnalysis.reduce((sum, c) => sum + c.actualSpent, 0))}
                    </td>
                    <td className="py-2.5 px-3.5 text-right border-r border-slate-300 font-mono text-amber-800">
                      {money(filteredCategoryAnalysis.reduce((sum, c) => sum + c.pendingSpent, 0))}
                    </td>
                    <td className="py-2.5 px-3.5 text-right border-r border-slate-300 font-mono text-slate-900">
                      {money(filteredCategoryAnalysis.reduce((sum, c) => sum + c.totalCommitted, 0))}
                    </td>
                    <td className="py-2.5 px-3.5 text-right border-r border-slate-300 font-mono text-emerald-800">
                      {money(filteredCategoryAnalysis.reduce((sum, c) => sum + c.remaining, 0))}
                    </td>
                    <td className="py-2.5 px-3.5 border-r border-slate-300 text-center font-mono">
                      {(() => {
                        const bTotal = filteredCategoryAnalysis.reduce((sum, c) => sum + c.budgetCap, 0);
                        const cTotal = filteredCategoryAnalysis.reduce((sum, c) => sum + c.totalCommitted, 0);
                        return bTotal > 0 ? `${((cTotal / bTotal) * 100).toFixed(1)}%` : "-";
                      })()}
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-center text-slate-400">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 6. DRILLDOWN BILLS MODAL */}
      {drilldownModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-slate-300 shadow-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-normal text-slate-900">{drilldownModal.title}</h3>
              <button
                type="button"
                onClick={() => setDrilldownModal(null)}
                className="text-slate-400 hover:text-slate-700 font-normal p-1 rounded-md hover:bg-slate-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="bg-slate-900 text-white font-normal sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-normal">วันที่</th>
                    <th className="py-2.5 px-3 font-normal">โครงการ</th>
                    <th className="py-2.5 px-3 font-normal">ผู้เบิก</th>
                    <th className="py-2.5 px-3 font-normal">ร้านค้า / รายการ</th>
                    <th className="py-2.5 px-3 text-right font-normal">จำนวนเงิน</th>
                    <th className="py-2.5 px-3 text-center font-normal">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {drilldownModal.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-normal text-slate-700">
                        {String(row["ว/ด/ป"] || row["วันที่"] || "-")}
                      </td>
                      <td className="py-2 px-3 font-normal text-slate-900">
                        {String(row["ID Project"] || "-")}
                      </td>
                      <td className="py-2 px-3 font-normal text-slate-800">
                        {String(row["ผู้เบิก"] || row["ชื่อพนักงาน"] || "-")}
                      </td>
                      <td className="py-2 px-3 text-slate-900 font-normal">
                        {String(row["ร้านค้า"] || row["รายการ"] || row["สินค้า/ทำงาน"] || "-")}
                      </td>
                      <td className="py-2 px-3 text-right font-normal text-emerald-800">
                        {money(getRowTransferAmount(row))} ฿
                      </td>
                      <td className="py-2 px-3 text-center font-normal text-slate-700">
                        {String(row["สถานะ"] || "สำเร็จ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
