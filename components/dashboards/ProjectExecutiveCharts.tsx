"use client";

import { useMemo, useState } from "react";
import { BarChart3, LineChart, PieChart, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import { getRowAmount, getRowCategory, getRowCategoryAmount } from "@/lib/reports";
import { isPaidBill } from "@/lib/bills/bill-status";
import {
  ALLOCATED_BUDGET_ITEMS,
  BudgetItemDefinition,
  extractBillItems,
  matchesBudgetItem,
  getProjectBudgetValue,
} from "@/lib/project-budget-control";
import { isMaterialCost, isLaborCost, isStaffCost } from "@/lib/cost-codes";

type ProjectExecutiveChartsProps = {
  projectRows: SheetRow[];
  dataRows: SheetRow[];
  selectedProjectId: string;
  selectedCategory?: string;
};

type ChartType = "bar" | "line";

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

// Color palette for 51 items (cycled if needed)
const ITEM_COLORS = [
  "#059669", "#0d9488", "#0891b2", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#9333ea",
  "#c026d3", "#db2777", "#e11d48", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#16a34a",
  "#059669", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#84cc16", "#22c55e", "#10b981",
  "#0d9488", "#0891b2", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#9333ea", "#c026d3",
  "#db2777", "#e11d48", "#ea580c", "#d97706", "#ca8a04", "#65a30d", "#16a34a", "#059669",
  "#14b8a6", "#06b6d4", "#0ea5e9",
];

// Group colors
const GROUP_COLORS = {
  material: "#059669",
  labor: "#4f46e5",
};

function formatShortAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `฿${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `฿${(amount / 1_000).toFixed(0)}k`;
  }
  return `฿${amount.toLocaleString()}`;
}

type ItemStat = {
  def: BudgetItemDefinition;
  budget: number;
  spent: number;
  variance: number;
  burnRate: number;
  color: string;
};

export function ProjectExecutiveCharts({
  projectRows,
  dataRows,
  selectedProjectId,
  selectedCategory = "all",
}: ProjectExecutiveChartsProps) {
  const [budgetVsActualChartType, setBudgetVsActualChartType] = useState<ChartType>("bar");
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // 1. Filter rows by selected project
  const activeProjects = useMemo(() => {
    if (selectedProjectId === "all") return projectRows;
    return projectRows.filter((p) => String(p["ID Project"] || p.id || "").trim() === selectedProjectId);
  }, [projectRows, selectedProjectId]);

  const activeBills = useMemo(() => {
    let rows = dataRows;
    if (selectedProjectId !== "all") {
      rows = rows.filter((r) => String(r["ID Project"] || "").trim() === selectedProjectId);
    }
    if (selectedCategory !== "all") {
      if (selectedCategory === "group_mat") {
        rows = rows.filter((r) => {
          const items = extractBillItems([r]);
          return items.some((item) => {
            const def = ALLOCATED_BUDGET_ITEMS.find((d) => matchesBudgetItem(item, d));
            return def?.group === "ค่าของ (Material Cost Code)" || isMaterialCost(item.categoryType) || isMaterialCost(item.itemName);
          });
        });
      } else if (selectedCategory === "group_lab") {
        rows = rows.filter((r) => {
          const items = extractBillItems([r]);
          return items.some((item) => {
            const def = ALLOCATED_BUDGET_ITEMS.find((d) => matchesBudgetItem(item, d));
            return def?.group === "ค่าแรง (Labor Cost Code)" || isLaborCost(item.categoryType) || isLaborCost(item.itemName) || isStaffCost(item.categoryType);
          });
        });
      } else {
        const targetDef = ALLOCATED_BUDGET_ITEMS.find((d) => d.code === selectedCategory);
        if (targetDef) {
          rows = rows.filter((r) => {
            const items = extractBillItems([r]);
            return items.some((item) => matchesBudgetItem(item, targetDef));
          });
        } else {
          rows = rows.filter((r) => getRowCategory(r).includes(selectedCategory));
        }
      }
    }
    return rows;
  }, [dataRows, selectedProjectId, selectedCategory]);

  const paidBills = useMemo(() => {
    return activeBills.filter(isPaidBill);
  }, [activeBills]);

  // 2. Compute per-item stats for all 51 budget control items
  const itemStats = useMemo((): ItemStat[] => {
    const parsedItems = extractBillItems(paidBills);

    return ALLOCATED_BUDGET_ITEMS.map((def, idx) => {
      // Budget from project rows
      const budget = activeProjects.reduce((sum, p) => sum + getProjectBudgetValue(p, def.field, def.code), 0);

      // Actual spent
      const spent = parsedItems
        .filter((item) => matchesBudgetItem(item, def))
        .reduce((sum, item) => sum + item.amount, 0);

      return {
        def,
        budget,
        spent,
        variance: budget - spent,
        burnRate: budget > 0 ? (spent / budget) * 100 : 0,
        color: ITEM_COLORS[idx % ITEM_COLORS.length],
      };
    });
  }, [activeProjects, paidBills]);

  // 3. Aggregate into 2 main groups for bar chart
  const groupStats = useMemo(() => {
    const materialItems = itemStats.filter((s) => s.def.group === "ค่าของ (Material Cost Code)");
    const laborItems = itemStats.filter((s) => s.def.group === "ค่าแรง (Labor Cost Code)");

    const matBudget = materialItems.reduce((sum, s) => sum + s.budget, 0);
    const matSpent = materialItems.reduce((sum, s) => sum + s.spent, 0);
    const labBudget = laborItems.reduce((sum, s) => sum + s.budget, 0);
    const labSpent = laborItems.reduce((sum, s) => sum + s.spent, 0);

    return [
      {
        id: "material",
        label: "📦 ค่าของ (Material)",
        shortLabel: "ค่าของ (27)",
        budget: matBudget,
        spent: matSpent,
        variance: matBudget - matSpent,
        burnRate: matBudget > 0 ? (matSpent / matBudget) * 100 : 0,
        color: GROUP_COLORS.material,
        itemCount: materialItems.length,
        items: materialItems,
      },
      {
        id: "labor",
        label: "👷 ค่าแรง & พนักงาน (Labor)",
        shortLabel: "ค่าแรง (24)",
        budget: labBudget,
        spent: labSpent,
        variance: labBudget - labSpent,
        burnRate: labBudget > 0 ? (labSpent / labBudget) * 100 : 0,
        color: GROUP_COLORS.labor,
        itemCount: laborItems.length,
        items: laborItems,
      },
    ];
  }, [itemStats]);

  // Max value for 2-group bar chart Y-Axis
  const maxGroupValue = useMemo(() => {
    const maxVal = Math.max(...groupStats.map((g) => Math.max(g.budget, g.spent)), 50000);
    return Math.ceil(maxVal / 50000) * 50000;
  }, [groupStats]);

  // 4. Donut chart: top N items with spending > 0
  const donutData = useMemo(() => {
    const activeItems = itemStats.filter((s) => s.spent > 0).sort((a, b) => b.spent - a.spent);
    const totalSpent = activeItems.reduce((sum, s) => sum + s.spent, 0);
    let accumulatedPercent = 0;
    const radius = 75;
    const circumference = 2 * Math.PI * radius;

    if (activeItems.length === 0) {
      // Show 2 groups with equal empty slices
      return groupStats.map((g, idx) => ({
        id: g.id,
        label: g.label,
        shortLabel: g.shortLabel,
        spent: 0,
        percent: 50,
        color: g.color,
        strokeDasharray: `${(50 / 100) * circumference} ${circumference}`,
        strokeDashoffset: -((idx * 50 / 100) * circumference),
      }));
    }

    return activeItems.map((item) => {
      const percent = totalSpent > 0 ? (item.spent / totalSpent) * 100 : 0;
      const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += percent;

      return {
        id: item.def.code,
        label: `${item.def.icon} ${item.def.label}`,
        shortLabel: item.def.label.replace(/^\d+\.\s*/, ""),
        spent: item.spent,
        percent,
        color: item.def.group === "ค่าของ (Material Cost Code)" ? item.color : ITEM_COLORS[(ALLOCATED_BUDGET_ITEMS.indexOf(item.def)) % ITEM_COLORS.length],
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [itemStats, groupStats]);

  const totalSpentAmount = useMemo(() => {
    return paidBills.reduce((sum, r) => sum + getRowAmount(r), 0);
  }, [paidBills]);

  // 5. Compute Monthly S-Curve Cumulative Spending
  const monthlySCurveData = useMemo(() => {
    const monthsMap: Record<number, number> = {};
    for (let i = 0; i < 12; i++) monthsMap[i] = 0;

    paidBills.forEach((r) => {
      const dateStr = String(r["ว/ด/ป"] || r["วันที่"] || "").trim();
      const match = dateStr.match(/^(\d{4})[-.\/](0?[1-9]|1[0-2])/);
      if (match) {
        const mIdx = parseInt(match[2], 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
          monthsMap[mIdx] += getRowAmount(r);
        }
      }
    });

    const totalBudgetCap = activeProjects.reduce((sum, p) => sum + (Number(p["งบไม่เกิน"]) || 0), 0);
    let cumulativeActual = 0;
    let cumulativePlan = 0;
    const currentMonthIdx = new Date().getMonth();

    return THAI_MONTHS_SHORT.map((monthLabel, idx) => {
      const actualThisMonth = monthsMap[idx] || 0;
      cumulativeActual += actualThisMonth;

      // S-curve Sigmoid curve model for Planned Budget (Plan Cumulative)
      const x = idx;
      const x0 = 5.5; // midpoint at June
      const k = 0.6;
      const sigmoidFactor = 1 / (1 + Math.exp(-k * (x - x0)));
      cumulativePlan = totalBudgetCap * sigmoidFactor;

      return {
        month: monthLabel,
        monthIdx: idx,
        actualMonthly: actualThisMonth,
        actualCumulative: idx <= currentMonthIdx ? cumulativeActual : null,
        planCumulative: cumulativePlan,
      };
    });
  }, [paidBills, activeProjects]);

  const maxSCurveValue = useMemo(() => {
    const totalBudget = activeProjects.reduce((sum, p) => sum + (Number(p["งบไม่เกิน"]) || 0), 0);
    const totalSpent = paidBills.reduce((sum, r) => sum + getRowAmount(r), 0);
    const maxVal = Math.max(totalBudget, totalSpent, 100000);
    return Math.ceil(maxVal / 100000) * 100000;
  }, [activeProjects, paidBills]);

  // Top items for donut legend (show max 10)
  const topDonutItems = useMemo(() => {
    return donutData.slice(0, 10);
  }, [donutData]);

  return (
    <div className="space-y-4 font-sans">
      {/* TOP ROW: 2 CHARTS SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART 1: งบประมาณ VS ค่าใช้จ่ายจริง (2 กลุ่มหลัก + รายการย่อย) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={16} />
                <span>งบประมาณ VS ค่าใช้จ่ายจริง (51 รายการควบคุมงบ)</span>
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                เปรียบเทียบงบที่จัดสรรเทียบกับค่าใช้จ่ายจริง — ค่าของ (27 รายการ) vs ค่าแรง & พนักงาน (24 รายการ)
              </p>
            </div>

            {/* Toggle: แท่ง / เส้น */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setBudgetVsActualChartType("bar")}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  budgetVsActualChartType === "bar"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                แท่ง
              </button>
              <button
                type="button"
                onClick={() => setBudgetVsActualChartType("line")}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                  budgetVsActualChartType === "line"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                เส้น
              </button>
            </div>
          </div>

          {/* Chart SVG Visualization — 2 Main Groups */}
          <div className="h-64 sm:h-72 w-full pt-2">
            <svg viewBox="0 0 720 240" className="w-full h-full overflow-visible">
              {/* Y-Axis Gridlines & Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = 200 - ratio * 160;
                const val = maxGroupValue * ratio;
                return (
                  <g key={i}>
                    <line x1="55" y1={y} x2="700" y2={y} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="48" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                      {formatShortAmount(val)}
                    </text>
                  </g>
                );
              })}

              {/* Bars or Lines */}
              {budgetVsActualChartType === "bar" ? (
                // Dual Bar Chart for 2 Main Groups
                groupStats.map((group, idx) => {
                  const barGroupWidth = 280;
                  const xBase = 100 + idx * barGroupWidth;
                  const barWidth = 80;

                  const budgetHeight = maxGroupValue > 0 ? (group.budget / maxGroupValue) * 160 : 0;
                  const spentHeight = maxGroupValue > 0 ? (group.spent / maxGroupValue) * 160 : 0;

                  const budgetY = 200 - budgetHeight;
                  const spentY = 200 - spentHeight;

                  const isHovered = hoveredGroup === group.id;

                  return (
                    <g
                      key={group.id}
                      onMouseEnter={() => setHoveredGroup(group.id)}
                      onMouseLeave={() => setHoveredGroup(null)}
                      className="cursor-pointer transition-opacity"
                      opacity={hoveredGroup && !isHovered ? 0.4 : 1}
                    >
                      {/* Budget Bar (Blue) */}
                      <rect
                        x={xBase}
                        y={budgetY}
                        width={barWidth}
                        height={Math.max(budgetHeight, 2)}
                        rx="4"
                        fill="#3b82f6"
                        className="transition-all duration-300 hover:brightness-110"
                      >
                        <title>{`${group.label} (งบประมาณ): ${money(group.budget)} บาท`}</title>
                      </rect>

                      {/* Actual Spent Bar */}
                      <rect
                        x={xBase + barWidth + 8}
                        y={spentY}
                        width={barWidth}
                        height={Math.max(spentHeight, 2)}
                        rx="4"
                        fill={group.color}
                        className="transition-all duration-300 hover:brightness-110"
                      >
                        <title>{`${group.label} (จ่ายจริง): ${money(group.spent)} บาท`}</title>
                      </rect>

                      {/* Budget Value Label */}
                      {budgetHeight > 12 && (
                        <text
                          x={xBase + barWidth / 2}
                          y={budgetY - 5}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#3b82f6"
                          fontWeight="600"
                          fontFamily="monospace"
                        >
                          {formatShortAmount(group.budget)}
                        </text>
                      )}

                      {/* Spent Value Label */}
                      {spentHeight > 12 && (
                        <text
                          x={xBase + barWidth + 8 + barWidth / 2}
                          y={spentY - 5}
                          textAnchor="middle"
                          fontSize="10"
                          fill={group.color}
                          fontWeight="600"
                          fontFamily="monospace"
                        >
                          {formatShortAmount(group.spent)}
                        </text>
                      )}

                      {/* X-Axis Group Label */}
                      <text
                        x={xBase + barWidth + 4}
                        y="218"
                        textAnchor="middle"
                        fontSize="11"
                        fill="#475569"
                        fontWeight="500"
                      >
                        {group.shortLabel}
                      </text>

                      {/* Item count sublabel */}
                      <text
                        x={xBase + barWidth + 4}
                        y="232"
                        textAnchor="middle"
                        fontSize="9"
                        fill="#94a3b8"
                        fontWeight="normal"
                      >
                        {group.itemCount} รายการ
                      </text>
                    </g>
                  );
                })
              ) : (
                // Line Comparison Mode
                <g>
                  {/* Budget Path */}
                  <path
                    d={groupStats
                      .map((group, idx) => {
                        const x = 200 + idx * 280;
                        const y = 200 - (group.budget / maxGroupValue) * 160;
                        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />

                  {/* Spent Path */}
                  <path
                    d={groupStats
                      .map((group, idx) => {
                        const x = 200 + idx * 280;
                        const y = 200 - (group.spent / maxGroupValue) * 160;
                        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke={GROUP_COLORS.material}
                    strokeWidth="3"
                  />

                  {/* Points */}
                  {groupStats.map((group, idx) => {
                    const x = 200 + idx * 280;
                    const yBudget = 200 - (group.budget / maxGroupValue) * 160;
                    const ySpent = 200 - (group.spent / maxGroupValue) * 160;

                    return (
                      <g key={group.id}>
                        <circle cx={x} cy={yBudget} r="5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2">
                          <title>{`${group.label} (งบประมาณ): ${money(group.budget)} บาท`}</title>
                        </circle>
                        <circle cx={x} cy={ySpent} r="5" fill={group.color} stroke="#ffffff" strokeWidth="2">
                          <title>{`${group.label} (จ่ายจริง): ${money(group.spent)} บาท`}</title>
                        </circle>
                        <text x={x} y="218" textAnchor="middle" fontSize="11" fill="#475569" fontWeight="500">
                          {group.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
          </div>

          {/* Legend Strip */}
          <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
              <span className="text-slate-700">งบประมาณ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: GROUP_COLORS.material }} />
              <span className="text-slate-700">ค่าของจริง</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: GROUP_COLORS.labor }} />
              <span className="text-slate-700">ค่าแรงจริง</span>
            </div>
          </div>

          {/* Expandable Sub-breakdown per Group */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {groupStats.map((group) => {
              const activeSubItems = group.items.filter((s) => s.spent > 0 || s.budget > 0);
              const isExpanded = expandedGroup === group.id;

              return (
                <div key={group.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                      <span className="font-medium text-slate-800">{group.label}</span>
                      <span className="text-slate-500">({activeSubItems.length}/{group.itemCount} รายการ)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-600">
                        งบ: <strong className="text-blue-700">{formatShortAmount(group.budget)}</strong> | จ่าย: <strong style={{ color: group.color }}>{formatShortAmount(group.spent)}</strong>
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && activeSubItems.length > 0 && (
                    <div className="max-h-52 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-slate-700 sticky top-0">
                          <tr>
                            <th className="py-1.5 px-2 text-left font-medium border-r border-slate-200">รหัส</th>
                            <th className="py-1.5 px-2 text-left font-medium border-r border-slate-200">รายการ</th>
                            <th className="py-1.5 px-2 text-right font-medium border-r border-slate-200">งบตั้งไว้</th>
                            <th className="py-1.5 px-2 text-right font-medium border-r border-slate-200">จ่ายจริง</th>
                            <th className="py-1.5 px-2 text-right font-medium border-r border-slate-200">คงเหลือ</th>
                            <th className="py-1.5 px-2 text-center font-medium">% ใช้งบ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeSubItems.map((item) => (
                            <tr key={item.def.code} className="hover:bg-slate-50 transition">
                              <td className="py-1.5 px-2 font-mono text-slate-600 border-r border-slate-200">{item.def.code}</td>
                              <td className="py-1.5 px-2 text-slate-800 border-r border-slate-200">
                                <span className="mr-1">{item.def.icon}</span>
                                {item.def.label.replace(/^\d+\.\s*/, "")}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono text-slate-700 border-r border-slate-200">
                                {item.budget > 0 ? money(item.budget) : "-"}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono font-medium border-r border-slate-200" style={{ color: item.spent > item.budget && item.budget > 0 ? "#e11d48" : "#059669" }}>
                                {money(item.spent)}
                              </td>
                              <td className={`py-1.5 px-2 text-right font-mono border-r border-slate-200 ${item.variance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                {item.budget > 0 ? money(item.variance) : "-"}
                              </td>
                              <td className="py-1.5 px-2 text-center font-mono">
                                {item.budget > 0 ? (
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                    item.burnRate > 100 ? "bg-rose-100 text-rose-800" :
                                    item.burnRate > 85 ? "bg-amber-100 text-amber-800" :
                                    "bg-emerald-100 text-emerald-800"
                                  }`}>
                                    {item.burnRate.toFixed(0)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CHART 2: สัดส่วนค่าใช้จ่าย (51 รายการ Donut Chart) */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <PieChart className="text-emerald-700" size={16} />
              <span>สัดส่วนค่าใช้จ่าย (51 รายการ)</span>
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              การกระจายตัวของค่าใช้จ่ายตามรายการควบคุมงบ
            </p>
          </div>

          {/* Donut SVG */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                {donutData.map((item, idx) => (
                  <circle
                    key={idx}
                    cx="100"
                    cy="100"
                    r="75"
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth="28"
                    strokeDasharray={item.strokeDasharray}
                    strokeDashoffset={item.strokeDashoffset}
                    className="transition-all duration-300 hover:opacity-85 cursor-pointer"
                  >
                    <title>{`${item.label}: ${money(item.spent)} บาท (${item.percent.toFixed(1)}%)`}</title>
                  </circle>
                ))}
              </svg>

              <div className="absolute text-center pointer-events-none">
                <span className="text-[11px] text-slate-400 block">รวมจ่ายจริง</span>
                <span className="text-sm font-bold text-slate-900 font-mono block">{formatShortAmount(totalSpentAmount)}</span>
              </div>
            </div>
          </div>

          {/* Legend Items (Top Items with spending) */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-xs">
            {topDonutItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-1 rounded hover:bg-slate-50 transition">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 truncate text-[11px]">{item.shortLabel}</span>
                </div>
                <div className="font-mono text-slate-900 font-medium text-[11px] ml-1">
                  {formatShortAmount(item.spent)}
                </div>
              </div>
            ))}
            {donutData.length > 10 && (
              <div className="col-span-2 text-center text-[10px] text-slate-400 pt-1">
                + อีก {donutData.length - 10} รายการ
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: CHART 3 - ค่าใช้จ่ายสะสมรายเดือน S-CURVE */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-emerald-600" size={16} />
              <span>ค่าใช้จ่ายสะสมรายเดือน</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-normal">
                ม.ค. - ธ.ค. 2569
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              กราฟเส้นแสดงการเบิกจ่ายจริงสะสม (S-Curve) เทียบกับแผนสะสมของโครงการ
            </p>
          </div>

          <div className="flex items-center gap-5 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" />
              <span className="text-slate-700">จริงสะสม (Actual)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-blue-500 inline-block" />
              <span className="text-slate-700">แผนสะสม (Planned S-Curve)</span>
            </div>
          </div>
        </div>

        {/* S-Curve SVG Graph */}
        <div className="h-64 sm:h-72 w-full pt-2">
          <svg viewBox="0 0 900 240" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Y-Axis Gridlines & Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = 200 - ratio * 160;
              const val = maxSCurveValue * ratio;
              return (
                <g key={i}>
                  <line x1="60" y1={y} x2="860" y2={y} stroke="#f1f5f9" strokeDasharray="3 3" strokeWidth="1" />
                  <text x="52" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                    {formatShortAmount(val)}
                  </text>
                </g>
              );
            })}

            {/* Planned Cumulative S-Curve (Dashed Blue Line) */}
            <path
              d={monthlySCurveData
                .map((m, idx) => {
                  const x = 80 + idx * 65;
                  const y = 200 - (m.planCumulative / maxSCurveValue) * 160;
                  return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />

            {/* Actual Cumulative Gradient Fill Area */}
            {(() => {
              const validPoints = monthlySCurveData.filter((m) => m.actualCumulative !== null);
              if (validPoints.length === 0) return null;

              const startX = 80;
              const pathPoints = validPoints.map((m, idx) => {
                const x = 80 + idx * 65;
                const y = 200 - ((m.actualCumulative || 0) / maxSCurveValue) * 160;
                return `L ${x} ${y}`;
              }).join(" ");

              const lastX = 80 + (validPoints.length - 1) * 65;
              const areaD = `M ${startX} 200 ${pathPoints} L ${lastX} 200 Z`;

              return <path d={areaD} fill="url(#actualGradient)" />;
            })()}

            {/* Actual Cumulative Solid Line (Amber) */}
            {(() => {
              const validPoints = monthlySCurveData.filter((m) => m.actualCumulative !== null);
              if (validPoints.length === 0) return null;

              const lineD = validPoints.map((m, idx) => {
                const x = 80 + idx * 65;
                const y = 200 - ((m.actualCumulative || 0) / maxSCurveValue) * 160;
                return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
              }).join(" ");

              return (
                <g>
                  <path d={lineD} fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
                  {validPoints.map((m, idx) => {
                    const x = 80 + idx * 65;
                    const y = 200 - ((m.actualCumulative || 0) / maxSCurveValue) * 160;
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r="4.5"
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-all hover:scale-125 cursor-pointer"
                      >
                        <title>{`${m.month}: สะสม ${money(m.actualCumulative || 0)} บาท`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            })()}

            {/* X-Axis Month Labels */}
            {monthlySCurveData.map((m, idx) => {
              const x = 80 + idx * 65;
              return (
                <text key={idx} x={x} y="218" textAnchor="middle" fontSize="10.5" fill="#475569">
                  {m.month}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
