"use client";

import { useMemo, useState } from "react";
import { BarChart3, LineChart, PieChart, TrendingUp } from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import { getRowAmount, getRowCategory, getRowCategoryAmount } from "@/lib/reports";
import { isPaidBill } from "@/lib/bills/bill-status";

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

// 8 Real System Categories (ตรงตามฐานข้อมูลจริง 100%)
const REAL_8_CATEGORIES = [
  { id: "หมวด 100 ค่าของ", label: "หมวด 100 ค่าของ", shortLabel: "ค่าของ", budgetField: "งบไม่เกินค่าของ", color: "#059669" },
  { id: "หมวด 200 ค่าแรง", label: "หมวด 200 ค่าแรง", shortLabel: "ค่าแรง", budgetField: "งบไม่เกินค่าแรง", color: "#4f46e5" },
  { id: "หมวด 300 พนักงาน", label: "หมวด 300 พนักงาน", shortLabel: "พนักงาน", budgetField: "งบไม่เกินพนักงาน", color: "#9333ea" },
  { id: "501 น้ำมัน", label: "501 น้ำมัน", shortLabel: "น้ำมัน", budgetField: "งบไม่เกินน้ำมัน", color: "#d97706" },
  { id: "502 ซ่อมรถ", label: "502 ซ่อมรถ", shortLabel: "ซ่อมรถ", budgetField: "งบไม่เกินซ่อมรถ", color: "#ea580c" },
  { id: "503 เครื่องจักร", label: "503 เครื่องจักร", shortLabel: "เครื่องจักร", budgetField: "งบไม่เกินเครื่องจักร", color: "#2563eb" },
  { id: "504 เครื่องมือ", label: "504 เครื่องมือ", shortLabel: "เครื่องมือ", budgetField: "งบไม่เกินเครื่องมือ", color: "#0891b2" },
  { id: "อื่นๆ / ดำเนินการ", label: "อื่นๆ / ดำเนินการ", shortLabel: "อื่นๆ", budgetField: "งบไม่เกินอื่นๆ", color: "#e11d48" },
];

function formatShortAmount(amount: number): string {
  if (amount >= 1_000_000) {
    return `฿${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `฿${(amount / 1_000).toFixed(0)}k`;
  }
  return `฿${amount.toLocaleString()}`;
}

export function ProjectExecutiveCharts({
  projectRows,
  dataRows,
  selectedProjectId,
  selectedCategory = "all",
}: ProjectExecutiveChartsProps) {
  const [budgetVsActualChartType, setBudgetVsActualChartType] = useState<ChartType>("bar");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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
      rows = rows.filter((r) => getRowCategory(r).includes(selectedCategory));
    }
    return rows;
  }, [dataRows, selectedProjectId, selectedCategory]);

  const paidBills = useMemo(() => {
    return activeBills.filter(isPaidBill);
  }, [activeBills]);

  // 2. Compute 8 Real Categories: Budget vs Actual Spending
  const categoryStats = useMemo(() => {
    const totalBudgetCap = activeProjects.reduce((sum, p) => sum + (Number(p["งบไม่เกิน"]) || 0), 0);
    const totalSpentAll = paidBills.reduce((sum, r) => sum + getRowAmount(r), 0);

    return REAL_8_CATEGORIES.map((cat) => {
      // Calculate exact actual spent from paid bills in this category
      const spent = paidBills.reduce((sum, r) => sum + getRowCategoryAmount(r, cat.shortLabel), 0);

      // Extract specific budget cap from project table if available
      let budget = activeProjects.reduce((sum, p) => {
        const directCap = toNumber(p[cat.budgetField] || p[`งบไม่เกิน${cat.id}`] || p[`งบไม่เกิน ${cat.shortLabel}`]);
        return sum + directCap;
      }, 0);

      // Fallback: If no granular sub-budget is configured in project row, use proportional allocation from total budget
      if (budget === 0 && totalBudgetCap > 0) {
        const defaultWeights: Record<string, number> = {
          "ค่าของ": 0.40,
          "ค่าแรง": 0.35,
          "พนักงาน": 0.05,
          "น้ำมัน": 0.05,
          "ซ่อมรถ": 0.04,
          "เครื่องจักร": 0.05,
          "เครื่องมือ": 0.03,
          "อื่นๆ": 0.03,
        };
        budget = Math.round(totalBudgetCap * (defaultWeights[cat.shortLabel] || 0.05));
      }

      const variance = budget - spent;
      const burnRate = budget > 0 ? (spent / budget) * 100 : 0;
      const percentOfTotal = totalSpentAll > 0 ? (spent / totalSpentAll) * 100 : 0;

      return {
        ...cat,
        budget,
        spent,
        variance,
        burnRate,
        percentOfTotal,
      };
    });
  }, [activeProjects, paidBills]);

  // Max value for 8 Categories Chart Y-Axis
  const maxCategoryValue = useMemo(() => {
    const maxVal = Math.max(...categoryStats.map((c) => Math.max(c.budget, c.spent)), 50000);
    return Math.ceil(maxVal / 50000) * 50000;
  }, [categoryStats]);

  // 3. Compute Donut Chart Data from 8 Real Categories
  const donutData = useMemo(() => {
    const totalSpent = categoryStats.reduce((sum, c) => sum + c.spent, 0);
    let accumulatedPercent = 0;
    const radius = 75;
    const circumference = 2 * Math.PI * radius;

    return categoryStats.map((c) => {
      const percent = totalSpent > 0 ? (c.spent / totalSpent) * 100 : 100 / REAL_8_CATEGORIES.length;
      const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += percent;

      return {
        ...c,
        percent,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categoryStats]);

  const totalSpentAmount = useMemo(() => {
    return paidBills.reduce((sum, r) => sum + getRowAmount(r), 0);
  }, [paidBills]);

  // 4. Compute Monthly S-Curve Cumulative Spending
  const monthlySCurveData = useMemo(() => {
    const monthsMap: Record<number, number> = {};
    for (let i = 0; i < 12; i++) monthsMap[i] = 0;

    paidBills.forEach((r) => {
      const dateStr = String(r["ว/ด/ป"] || r["วันที่"] || "").trim();
      const match = dateStr.match(/^(\d{4})[-/.](0?[1-9]|1[0-2])/);
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

  return (
    <div className="space-y-4 font-sans">
      {/* TOP ROW: 2 CHARTS SIDE-BY-SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART 1: งบประมาณ VS ค่าใช้จ่ายจริง (8 หมวดหมู่จริง) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={16} />
                <span>งบประมาณ VS ค่าใช้จ่ายจริง (8 หมวดหมู่หลัก)</span>
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                เปรียบเทียบงบประมาณที่จัดสรรเทียบกับค่าใช้จ่ายเกิดขึ้นจริงแยกตาม 8 หมวดหมู่จริงในระบบ
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

          {/* Chart SVG Visualization */}
          <div className="h-64 sm:h-72 w-full pt-2">
            <svg viewBox="0 0 720 240" className="w-full h-full overflow-visible">
              {/* Y-Axis Gridlines & Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = 200 - ratio * 160;
                const val = maxCategoryValue * ratio;
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
                // Dual Bar Chart for 8 Categories
                categoryStats.map((item, idx) => {
                  const barGroupWidth = 78;
                  const xBase = 65 + idx * barGroupWidth;
                  const barWidth = 22;

                  const budgetHeight = maxCategoryValue > 0 ? (item.budget / maxCategoryValue) * 160 : 0;
                  const spentHeight = maxCategoryValue > 0 ? (item.spent / maxCategoryValue) * 160 : 0;

                  const budgetY = 200 - budgetHeight;
                  const spentY = 200 - spentHeight;

                  const isHovered = hoveredCategory === item.id;

                  return (
                    <g
                      key={item.id}
                      onMouseEnter={() => setHoveredCategory(item.id)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="cursor-pointer transition-opacity"
                      opacity={hoveredCategory && !isHovered ? 0.4 : 1}
                    >
                      {/* Budget Bar (Blue) */}
                      <rect
                        x={xBase}
                        y={budgetY}
                        width={barWidth}
                        height={Math.max(budgetHeight, 2)}
                        rx="3"
                        fill="#3b82f6"
                        className="transition-all duration-300 hover:brightness-110"
                      >
                        <title>{`${item.label} (งบประมาณ): ${money(item.budget)} บาท`}</title>
                      </rect>

                      {/* Actual Spent Bar (Amber/Orange) */}
                      <rect
                        x={xBase + barWidth + 3}
                        y={spentY}
                        width={barWidth}
                        height={Math.max(spentHeight, 2)}
                        rx="3"
                        fill="#f59e0b"
                        className="transition-all duration-300 hover:brightness-110"
                      >
                        <title>{`${item.label} (จ่ายจริง): ${money(item.spent)} บาท`}</title>
                      </rect>

                      {/* X-Axis Category Label */}
                      <text
                        x={xBase + barWidth + 1}
                        y="218"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#475569"
                        fontWeight="normal"
                      >
                        {item.shortLabel}
                      </text>
                    </g>
                  );
                })
              ) : (
                // Line Comparison Mode
                <g>
                  {/* Budget Path */}
                  <path
                    d={categoryStats
                      .map((item, idx) => {
                        const x = 90 + idx * 78;
                        const y = 200 - (item.budget / maxCategoryValue) * 160;
                        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />

                  {/* Spent Path */}
                  <path
                    d={categoryStats
                      .map((item, idx) => {
                        const x = 90 + idx * 78;
                        const y = 200 - (item.spent / maxCategoryValue) * 160;
                        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                  />

                  {/* Points */}
                  {categoryStats.map((item, idx) => {
                    const x = 90 + idx * 78;
                    const yBudget = 200 - (item.budget / maxCategoryValue) * 160;
                    const ySpent = 200 - (item.spent / maxCategoryValue) * 160;

                    return (
                      <g key={item.id}>
                        <circle cx={x} cy={yBudget} r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5">
                          <title>{`${item.label} (งบประมาณ): ${money(item.budget)} บาท`}</title>
                        </circle>
                        <circle cx={x} cy={ySpent} r="4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5">
                          <title>{`${item.label} (จ่ายจริง): ${money(item.spent)} บาท`}</title>
                        </circle>
                        <text x={x} y="218" textAnchor="middle" fontSize="10" fill="#475569">
                          {item.shortLabel}
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
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
              <span className="text-slate-700">ค่าใช้จ่ายจริง</span>
            </div>
          </div>
        </div>

        {/* CHART 2: สัดส่วนค่าใช้จ่าย (8 หมวดหมู่จริง Donut Chart) */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <PieChart className="text-emerald-700" size={16} />
              <span>สัดส่วนค่าใช้จ่าย (8 หมวดหมู่)</span>
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              การกระจายตัวของค่าใช้จ่ายตามหมวดหมู่จริง
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

          {/* Legend Items (8 Real Categories) */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-xs">
            {donutData.map((item) => (
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
