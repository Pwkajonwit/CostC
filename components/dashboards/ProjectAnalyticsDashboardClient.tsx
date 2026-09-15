"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Coins,
  Download,
  FileSpreadsheet,
  Filter,
  Grid,
  HardHat,
  Layers,
  LayoutGrid,
  Package,
  PieChart as PieIcon,
  Printer,
  Receipt,
  RotateCw,
  Search,
  Table as TableIcon,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import { isPaidBill, isCommittedBill } from "@/lib/bills/bill-status";
import {
  filterBillsByProject,
  getRowAmount,
  getRowCategory,
  getRowTransferAmount,
} from "@/lib/reports";
import {
  computeCashFlowBreakdown,
  getBudgetHealthStatus,
  getProfitHealthStatus,
  hydrateProjectRowsForList,
} from "@/lib/project-summary";
import { ProjectBudgetControlMatrix } from "@/components/dashboards/ProjectBudgetControlMatrix";
import { ProjectExecutiveCharts } from "@/components/dashboards/ProjectExecutiveCharts";
import {
  isMaterialCost,
  isLaborCost,
  isStaffCost,
  isFuelCost,
  isRepairCost,
  isMachineCost,
  isToolCost,
  isOtherExpense
} from "@/lib/cost-codes";
import { useYearFilter } from "@/lib/context/YearFilterContext";
import { formatDateThai, THAI_MONTHS_SHORT } from "@/lib/utils/dates";

type ProjectAnalyticsDashboardClientProps = {
  initialDataRows: SheetRow[];
  initialProjectRows: SheetRow[];
  initialStoreRows?: SheetRow[];
  initialContractorRows?: SheetRow[];
  initialPeopleRows: SheetRow[];
};

type MainAnalyticsTab = "budget_variance" | "cost_structure" | "budget_matrix";
type BudgetViewMode = "cards" | "table";

const CATEGORY_COLORS: Record<string, { hex: string; bg: string; text: string }> = {
  "1.ค่าของ": { hex: "#059669", bg: "bg-emerald-600", text: "text-emerald-700" },
  "หมวด 100 ค่าของ": { hex: "#059669", bg: "bg-emerald-600", text: "text-emerald-700" },
  "2.ค่าแรง": { hex: "#4f46e5", bg: "bg-indigo-600", text: "text-indigo-700" },
  "หมวด 200 ค่าแรง": { hex: "#4f46e5", bg: "bg-indigo-600", text: "text-indigo-700" },
  "3.พนักงาน": { hex: "#9333ea", bg: "bg-purple-600", text: "text-purple-700" },
  "หมวด 300 พนักงาน": { hex: "#9333ea", bg: "bg-purple-600", text: "text-purple-700" },
  "4.น้ำมัน": { hex: "#d97706", bg: "bg-amber-600", text: "text-amber-700" },
  "501 น้ำมัน": { hex: "#d97706", bg: "bg-amber-600", text: "text-amber-700" },
  "5.ซ่อมรถ": { hex: "#ea580c", bg: "bg-orange-600", text: "text-orange-700" },
  "502 ซ่อมรถ": { hex: "#ea580c", bg: "bg-orange-600", text: "text-orange-700" },
  "6.เครื่องจักร": { hex: "#2563eb", bg: "bg-blue-600", text: "text-blue-700" },
  "503 เครื่องจักร": { hex: "#2563eb", bg: "bg-blue-600", text: "text-blue-700" },
  "7.เครื่องมือ": { hex: "#0891b2", bg: "bg-cyan-600", text: "text-cyan-700" },
  "504 เครื่องมือ": { hex: "#0891b2", bg: "bg-cyan-600", text: "text-cyan-700" },
  "8.อื่นๆ": { hex: "#e11d48", bg: "bg-rose-600", text: "text-rose-700" },
  "อื่นๆ / ดำเนินการ": { hex: "#e11d48", bg: "bg-rose-600", text: "text-rose-700" },
};

function getCategoryColor(name: string): { hex: string; bg: string; text: string } {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  if (isMaterialCost(name)) return { hex: "#059669", bg: "bg-emerald-600", text: "text-emerald-700" };
  if (isLaborCost(name)) return { hex: "#4f46e5", bg: "bg-indigo-600", text: "text-indigo-700" };
  if (isStaffCost(name)) return { hex: "#9333ea", bg: "bg-purple-600", text: "text-purple-700" };
  if (isFuelCost(name)) return { hex: "#d97706", bg: "bg-amber-600", text: "text-amber-700" };
  if (isRepairCost(name)) return { hex: "#ea580c", bg: "bg-orange-600", text: "text-orange-700" };
  if (isMachineCost(name)) return { hex: "#2563eb", bg: "bg-blue-600", text: "text-blue-700" };
  if (isToolCost(name)) return { hex: "#0891b2", bg: "bg-cyan-600", text: "text-cyan-700" };
  return { hex: "#e11d48", bg: "bg-rose-600", text: "text-rose-700" };
}

const PALETTE = [
  "#059669", "#4f46e5", "#9333ea", "#d97706", "#ea580c",
  "#2563eb", "#0891b2", "#e11d48", "#65a30d", "#db2777",
  "#475569", "#0d9488", "#0284c7"
];


export function ProjectAnalyticsDashboardClient({
  initialDataRows,
  initialProjectRows,
  initialPeopleRows,
}: ProjectAnalyticsDashboardClientProps) {
  const { filterRowsByYear, filterProjectsByYear } = useYearFilter();
  const [dataRows, setDataRows] = useState<SheetRow[]>(initialDataRows);
  const [rawProjectRows, setRawProjectRows] = useState<SheetRow[]>(initialProjectRows);

  useEffect(() => {
    if (initialDataRows) setDataRows(initialDataRows);
  }, [initialDataRows]);
  useEffect(() => {
    if (initialProjectRows) setRawProjectRows(initialProjectRows);
  }, [initialProjectRows]);

  // Re-structured 3 Main Tabs & Sub-view
  const [activeMainTab, setActiveMainTab] = useState<MainAnalyticsTab>("budget_variance");
  const [budgetViewMode, setBudgetViewMode] = useState<BudgetViewMode>("cards");

  // Filters State
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Drilldown Modal
  const [drilldownModal, setDrilldownModal] = useState<{
    title: string;
    subtitle?: string;
    rows: SheetRow[];
  } | null>(null);

  // People Map
  const peopleMap = useMemo(() => {
    const map: Record<string, string> = {};
    (initialPeopleRows || []).forEach((r) => {
      const code = String(r["รหัสพนักงาน"] || r["รหัส"] || r["ID"] || "").trim().toLowerCase();
      const nickname = String(r["ชื่อเล่น"] || "").trim();
      const fullName = String(r["ชื่อ-นามสกุล"] || r["ชื่อ"] || "").trim();
      const displayName = nickname || fullName;
      if (code && displayName) map[code] = displayName;
    });
    return map;
  }, [initialPeopleRows]);

  function getRequesterDisplayName(raw: unknown): string {
    const val = String(raw || "").trim();
    if (!val) return "-";
    return peopleMap[val.toLowerCase()] || val;
  }

  // Hydrate Project Rows
  // Filter bills and projects by selected year first
  const yearFilteredDataRows = useMemo(() => filterRowsByYear(dataRows), [dataRows, filterRowsByYear]);
  const yearFilteredProjectRows = useMemo(
    () => filterProjectsByYear(rawProjectRows, yearFilteredDataRows),
    [rawProjectRows, filterProjectsByYear, yearFilteredDataRows]
  );

  const hydratedProjects = useMemo(() => {
    const list = hydrateProjectRowsForList(yearFilteredProjectRows, yearFilteredDataRows);
    const seen = new Set<string>();
    return list.filter((p) => {
      const id = String(p["ID Project"] || p.id || "").trim();
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [yearFilteredProjectRows, yearFilteredDataRows]);

  // Projects list for dropdown selector
  const projectsList = useMemo(() => {
    return hydratedProjects
      .map((p) => {
        const id = String(p["ID Project"] || p.id || "").trim();
        const name = String(p["ชื่อ Project"] || p.name || "").trim();
        return { id, name, label: id && name ? `${id} - ${name}` : id || name, row: p };
      })
      .filter((p) => p.id || p.name);
  }, [hydratedProjects]);

  // Filtered Data Rows based on Project & Category & Search
  const filteredDataRows = useMemo(() => {
    let rows = yearFilteredDataRows;
    if (selectedProjectId !== "all") {
      rows = filterBillsByProject(rows, selectedProjectId);
    }
    if (selectedCategory !== "all") {
      rows = rows.filter((r) => getRowCategory(r).includes(selectedCategory));
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      rows = rows.filter((r) => {
        const reqName = getRequesterDisplayName(r["ผู้เบิก"]);
        return (
          String(r["ID Project"] || "").toLowerCase().includes(q) ||
          String(r["ร้าน/บุคคล"] || "").toLowerCase().includes(q) ||
          String(r["ร้านค้า"] || "").toLowerCase().includes(q) ||
          String(r["ผู้รับเหมา"] || "").toLowerCase().includes(q) ||
          String(r["สินค้า/ทำงาน"] || "").toLowerCase().includes(q) ||
          String(r["รายละเอียดงาน"] || "").toLowerCase().includes(q) ||
          String(r["ประเภท"] || "").toLowerCase().includes(q) ||
          String(r["ผู้เบิก"] || "").toLowerCase().includes(q) ||
          reqName.toLowerCase().includes(q)
        );
      });
    }
    return rows;
  }, [dataRows, selectedProjectId, selectedCategory, debouncedSearch, peopleMap]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const activeProjects = selectedProjectId === "all"
      ? hydratedProjects
      : hydratedProjects.filter(p => String(p["ID Project"] || p.id || "").trim() === selectedProjectId);

    const totalRevenue = activeProjects.reduce((sum, p) => sum + (Number(p["ยอดงาน"]) || Number(p["งบไม่เกิน"]) || 0), 0);
    const totalBudget = activeProjects.reduce((sum, p) => sum + (Number(p["งบไม่เกิน"]) || 0), 0);
    const totalSpent = filteredDataRows.reduce((sum, r) => sum + getRowAmount(r), 0);
    const totalTransfer = filteredDataRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
    const remainingBudget = totalBudget - totalSpent;
    const burnRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    const totalGrossProfit = totalRevenue - totalSpent;
    const avgProfitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const profitHealth = getProfitHealthStatus(avgProfitMargin);
    const budgetHealth = getBudgetHealthStatus(totalBudget, totalSpent);

    const cashFlow = computeCashFlowBreakdown(filteredDataRows);

    const materialSpent = filteredDataRows.filter(r => getRowCategory(r).includes("ค่าของ")).reduce((sum, r) => sum + getRowAmount(r), 0);
    const laborSpent = filteredDataRows.filter(r => getRowCategory(r).includes("ค่าแรง")).reduce((sum, r) => sum + getRowAmount(r), 0);
    const otherSpent = totalSpent - (materialSpent + laborSpent);

    return {
      totalRevenue,
      totalBudget,
      totalSpent,
      totalTransfer,
      totalGrossProfit,
      avgProfitMargin,
      profitHealth,
      budgetHealth,
      cashPaid: cashFlow.actualPaid,
      pendingAP: cashFlow.pendingPayables,
      remainingBudget,
      burnRate,
      materialSpent,
      laborSpent,
      otherSpent,
      billCount: filteredDataRows.length,
      projectCount: activeProjects.length,
    };
  }, [hydratedProjects, filteredDataRows, selectedProjectId]);

  // Per-Project Breakdown Data
  const projectBreakdown = useMemo(() => {
    return hydratedProjects.map(p => {
      const id = String(p["ID Project"] || p.id || "").trim();
      const name = String(p["ชื่อ Project"] || p.name || "").trim();
      const pRows = yearFilteredDataRows.filter(r => String(r["ID Project"] || "").trim() === id);

      const budgetCap = Number(p["งบไม่เกิน"]) || 0;
      const paidRows = pRows.filter(isPaidBill);
      const pendingRows = pRows.filter((r) => !isPaidBill(r) && isCommittedBill(r));
      const spent = paidRows.reduce((sum, r) => sum + getRowAmount(r), 0);
      const pendingSpent = pendingRows.reduce((sum, r) => sum + getRowAmount(r), 0);
      const totalCommitted = spent + pendingSpent;
      const transfer = paidRows.reduce((sum, r) => sum + getRowTransferAmount(r), 0);
      const remaining = budgetCap - spent;
      const burnRate = budgetCap > 0 ? (spent / budgetCap) * 100 : 0;

      const mat = paidRows.filter(r => isMaterialCost(getRowCategory(r))).reduce((sum, r) => sum + getRowAmount(r), 0);
      const lab = paidRows.filter(r => isLaborCost(getRowCategory(r))).reduce((sum, r) => sum + getRowAmount(r), 0);
      const oth = spent - (mat + lab);

      return {
        id,
        name,
        displayName: name ? `${id} - ${name}` : id,
        budgetCap,
        spent,
        pendingSpent,
        totalCommitted,
        transfer,
        remaining,
        burnRate,
        mat,
        lab,
        oth,
        billCount: pRows.length,
        paidBillCount: paidRows.length,
        rows: pRows,
      };
    }).sort((a, b) => b.budgetCap - a.budgetCap);
  }, [hydratedProjects, yearFilteredDataRows]);

  // Category Breakdown Data
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { amount: number; count: number; rows: SheetRow[] }> = {};
    filteredDataRows.forEach(r => {
      const cat = getRowCategory(r) || "8.อื่นๆ";
      if (!map[cat]) map[cat] = { amount: 0, count: 0, rows: [] };
      map[cat].amount += getRowAmount(r);
      map[cat].count += 1;
      map[cat].rows.push(r);
    });

    const total = Object.values(map).reduce((sum, c) => sum + c.amount, 0);

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        percent: total > 0 ? (data.amount / total) * 100 : 0,
        color: getCategoryColor(name).hex,
        rows: data.rows,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredDataRows]);

  // Monthly Spending Trend Data
  const monthlyTrend = useMemo(() => {
    const monthsMap: Record<string, { label: string; yearMonth: string; amount: number; transfer: number; rows: SheetRow[] }> = {};

    filteredDataRows.forEach(r => {
      const dateStr = String(r["ว/ด/ป"] || r["วันที่"] || "").trim();
      let ymKey = "Unspecified";
      let displayLabel = "ไม่ระบุ";

      const match = dateStr.match(/^(\d{4})[-/.](0?[1-9]|1[0-2])/);
      if (match) {
        const y = match[1];
        const mIdx = parseInt(match[2], 10) - 1;
        ymKey = `${y}-${match[2].padStart(2, "0")}`;
        displayLabel = `${THAI_MONTHS_SHORT[mIdx]} ${y}`;
      } else {
        const matchThai = dateStr.match(/(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*(20\d\d|25\d\d|\d\d)?/);
        if (matchThai) {
          displayLabel = matchThai[0];
          ymKey = matchThai[0];
        }
      }

      if (!monthsMap[ymKey]) {
        monthsMap[ymKey] = { label: displayLabel, yearMonth: ymKey, amount: 0, transfer: 0, rows: [] };
      }
      monthsMap[ymKey].amount += getRowAmount(r);
      monthsMap[ymKey].transfer += getRowTransferAmount(r);
      monthsMap[ymKey].rows.push(r);
    });

    return Object.values(monthsMap).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }, [filteredDataRows]);

  // SVG Donut Paths
  const donutPaths = useMemo(() => {
    let accumulatedAngle = 0;
    const radius = 75;
    const circumference = 2 * Math.PI * radius;

    return categoryBreakdown.map((item) => {
      const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedAngle / 100) * circumference);
      accumulatedAngle += item.percent;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categoryBreakdown]);

  async function refreshData() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard?refresh=1", { cache: "no-store" });
      if (!response.ok) throw new Error("Refresh failed");
      const payload = await response.json();
      setDataRows(payload.dataRows || []);
      setRawProjectRows(payload.projectRows || []);
    } finally {
      setRefreshing(false);
    }
  }

  function handleExportCSV() {
    let csvContent = "\uFEFFรหัสโครงการ,ชื่อโครงการ,งบประมาณตั้งไว้,ค่าของ(เบิกแล้ว),ค่าแรง(เบิกแล้ว),เบิกจ่ายจริง,รอเบิก,งบคงเหลือ,Burn Rate (%)\n";
    projectBreakdown.forEach((p) => {
      csvContent += `"${p.id}","${p.name}",${p.budgetCap},${p.mat},${p.lab},${p.spent},${p.pendingSpent},${p.remaining},${p.burnRate.toFixed(1)}%\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `project_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 sm:p-5 max-w-[1700px] mx-auto font-sans text-sm text-slate-800 print:p-0 font-normal">
      {/* 1. HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 no-print">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-emerald-700" size={22} />
            <span>ศูนย์วิเคราะห์และควบคุมต้นทุนโครงการ</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">
            ระบบวิเคราะห์ผลต่างงบประมาณ (Variance) สัดส่วนค่าของ ค่าแรง และแนวโน้มเบิกจ่าย
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="ดาวน์โหลดไฟล์ CSV"
          >
            <Download size={14} />
            <span>ส่งออก CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="พิมพ์หน้ารายงาน"
          >
            <Printer size={14} />
            <span>พิมพ์</span>
          </button>

          <button
            type="button"
            onClick={refreshData}
            disabled={refreshing}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
          >
            <RotateCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{refreshing ? "รีเฟรช..." : "รีเฟรช"}</span>
          </button>
        </div>
      </div>

      {/* 2. 4 TOP KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Budget */}
        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-800 font-medium">งบประมาณตั้งไว้ (Budget Cap)</span>
            <div className="w-6 h-6 rounded-md bg-blue-200/80 text-blue-800 flex items-center justify-center">
              <Briefcase size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-blue-950 mt-1">
            {money(summaryMetrics.totalBudget)}
          </div>
          <div className="text-[11px] text-blue-700 mt-0.5">
            {summaryMetrics.projectCount} โครงการเปิดดำเนินการ
          </div>
        </div>

        {/* Card 2: Actual Spent */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">เบิกจ่ายสะสมจริง (Actual Spent)</span>
            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
              <Receipt size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            {money(summaryMetrics.totalSpent)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
            โอนจ่ายสุทธิ: {money(summaryMetrics.totalTransfer)}
          </div>
        </div>

        {/* Card 3: Remaining Budget Variance */}
        <div className={`p-3.5 rounded-xl border shadow-2xs ${
          summaryMetrics.remainingBudget >= 0
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-rose-200 bg-rose-50/60"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${
              summaryMetrics.remainingBudget >= 0 ? "text-emerald-800" : "text-rose-800"
            }`}>
              งบคงเหลือ / ส่วนต่าง
            </span>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
              summaryMetrics.remainingBudget >= 0 ? "bg-emerald-200/80 text-emerald-800" : "bg-rose-200/80 text-rose-800"
            }`}>
              {summaryMetrics.remainingBudget >= 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            </div>
          </div>
          <div className={`text-lg sm:text-xl font-bold mt-1 ${
            summaryMetrics.remainingBudget >= 0 ? "text-emerald-950" : "text-rose-950"
          }`}>
            {money(summaryMetrics.remainingBudget)}
          </div>
          <div className={`text-[11px] mt-0.5 font-medium ${
            summaryMetrics.remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700"
          }`}>
            {summaryMetrics.remainingBudget >= 0 ? "อยู่ในงบประมาณที่กำหนด" : "เกินงบประมาณตั้งไว้"}
          </div>
        </div>

        {/* Card 4: Burn Rate Gauge */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">อัตราใช้งบ (Burn Rate)</span>
            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            <span className={summaryMetrics.burnRate > 100 ? "text-rose-600" : summaryMetrics.burnRate > 85 ? "text-amber-600" : "text-emerald-700"}>
              {summaryMetrics.burnRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                summaryMetrics.burnRate > 100 ? "bg-rose-600" : summaryMetrics.burnRate > 85 ? "bg-amber-500" : "bg-emerald-600"
              }`}
              style={{ width: `${Math.min(summaryMetrics.burnRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. SINGLE UNIFIED FILTER TOOLBAR */}
      <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col lg:flex-row items-center justify-between gap-3 text-xs shadow-2xs no-print">
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Project Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">โครงการ:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 max-w-[210px] cursor-pointer"
            >
              <option value="all">ทุกโครงการ ({projectsList.length} โครงการ)</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">หมวดหมู่:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-normal text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 max-w-[190px] cursor-pointer"
            >
              <option value="all">ทุกหมวดหมู่ต้นทุน (8 หมวด)</option>
              {Object.keys(CATEGORY_COLORS).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Real-time Search Box */}
        <div className="relative flex items-center w-full sm:w-72">
          <Search size={14} className="absolute left-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาโครงการ, ร้านค้า, ผู้รับเหมา..."
            className="w-full bg-white border border-slate-300 text-xs pl-8 pr-7 py-1.5 rounded-lg focus:outline-none focus:border-emerald-600 font-normal placeholder:text-slate-400"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm("")} className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 4. 3 CORE RE-STRUCTURED TABS (ตัดความซ้ำซ้อน ไม่ซอยย่อย) */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-medium no-print">
        <button
          type="button"
          onClick={() => setActiveMainTab("budget_variance")}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeMainTab === "budget_variance"
              ? "border-emerald-700 text-emerald-800 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart2 size={15} />
          <span>1. ติดตามงบประมาณโครงการ ({projectBreakdown.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("cost_structure")}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeMainTab === "cost_structure"
              ? "border-emerald-700 text-emerald-800 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <PieIcon size={15} />
          <span>2. โครงสร้างต้นทุน & กระแสเงินสด</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("budget_matrix")}
          className={`px-4 py-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeMainTab === "budget_matrix"
              ? "border-emerald-700 text-emerald-800 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Grid size={15} />
          <span>3. เมตริกซ์ควบคุมงบรายหมวด</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 📊 TAB 1: ติดตามงบประมาณโครงการ (BUDGET VARIANCE & TABLE COMBINED)       */}
      {/* ========================================================================= */}
      {activeMainTab === "budget_variance" && (
        <div className="space-y-3">
          {/* Sub-view Switcher: Cards vs Table */}
          <div className="flex items-center justify-between no-print">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setBudgetViewMode("cards")}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer flex items-center gap-1.5 ${
                  budgetViewMode === "cards"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid size={13} />
                <span>มุมมองกราฟแท่งเปรียบเทียบ</span>
              </button>
              <button
                type="button"
                onClick={() => setBudgetViewMode("table")}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer flex items-center gap-1.5 ${
                  budgetViewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TableIcon size={13} />
                <span>มุมมองตารางสรุปตัวเลข (Matrix Table)</span>
              </button>
            </div>

            <div className="text-xs text-slate-600 font-medium">
              เบิกจ่ายรวม: <strong className="text-slate-900">{money(summaryMetrics.totalSpent)}</strong> | งบคงเหลือรวม: <strong className={summaryMetrics.remainingBudget >= 0 ? "text-emerald-700" : "text-rose-600"}>{money(summaryMetrics.remainingBudget)}</strong>
            </div>
          </div>

          {/* Sub-view 1: Cards View with Dual-Track Bars */}
          {budgetViewMode === "cards" && (
            <div className="space-y-3">
              {projectBreakdown.map((p) => {
                const maxVal = Math.max(p.budgetCap, p.spent, 1);
                const budgetPercent = (p.budgetCap / maxVal) * 100;
                const spentPercent = (p.spent / maxVal) * 100;

                return (
                  <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-300">
                          {p.id}
                        </span>
                        <span className="font-semibold text-sm text-slate-900">{p.name || p.id}</span>
                        <span className="text-xs text-slate-500">({p.billCount} รายการบิล)</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.burnRate > 100
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : p.burnRate > 85
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        }`}>
                          Burn Rate: {p.burnRate.toFixed(1)}%
                        </span>

                        <button
                          onClick={() => setDrilldownModal({ title: `รายการเบิกจ่าย - ${p.displayName}`, rows: p.rows })}
                          className="text-xs text-emerald-800 hover:text-emerald-900 font-medium flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                        >
                          ดูรายการ <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Dual Bar Track */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-3">
                        <span className="w-24 text-xs font-medium text-slate-600 shrink-0">งบประมาณตั้งไว้:</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 relative overflow-hidden flex items-center">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(budgetPercent, 1)}%` }}
                          />
                        </div>
                        <span className="w-32 text-right text-xs font-mono text-slate-800 shrink-0 font-medium">
                          {p.budgetCap > 0 ? `${money(p.budgetCap)} ฿` : "ไม่ได้ตั้งงบ"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="w-24 text-xs font-medium text-slate-600 shrink-0">เบิกจ่ายสะสม:</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 relative overflow-hidden flex items-center">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              p.burnRate > 100 ? "bg-rose-600" : p.burnRate > 85 ? "bg-amber-500" : "bg-emerald-600"
                            }`}
                            style={{ width: `${Math.max(spentPercent, 1)}%` }}
                          />
                        </div>
                        <span className={`w-32 text-right text-xs font-mono shrink-0 font-semibold ${
                          p.burnRate > 100 ? "text-rose-600" : "text-emerald-700"
                        }`}>
                          {money(p.spent)} ฿
                        </span>
                      </div>
                    </div>

                    {/* Variance Breakdown Footer */}
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 font-medium text-slate-700">
                      <div className="flex items-center gap-4">
                        <span>
                          งบคงเหลือ: <strong className={`font-mono ${p.remaining >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(p.remaining)} ฿</strong>
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-slate-600">
                          ค่าของ: <strong className="text-emerald-700 font-mono">{money(p.mat)}</strong> | ค่าแรง: <strong className="text-indigo-700 font-mono">{money(p.lab)}</strong>
                        </span>
                      </div>
                      <div>
                        <span>โอนจ่ายสุทธิ: </span>
                        <span className="font-mono text-slate-900 font-bold">{money(p.transfer)} ฿</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-view 2: Variance Matrix Table View */}
          {budgetViewMode === "table" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs font-sans">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3.5 border-r border-slate-200">รหัสโครงการ</th>
                      <th className="py-2.5 px-3.5 border-r border-slate-200">ชื่อโครงการ</th>
                      <th className="py-2.5 px-3.5 text-right border-r border-slate-200">งบประมาณตั้งไว้</th>
                      <th className="py-2.5 px-3.5 text-right border-r border-slate-200 text-emerald-900 bg-emerald-50/60">ค่าของ</th>
                      <th className="py-2.5 px-3.5 text-right border-r border-slate-200 text-indigo-900 bg-indigo-50/60">ค่าแรง</th>
                      <th className="py-2.5 px-3.5 text-right border-r border-slate-200">เบิกจ่ายจริง</th>
                      <th className="py-2.5 px-3.5 text-right border-r border-slate-200">งบคงเหลือ</th>
                      <th className="py-2.5 px-3.5 text-center border-r border-slate-200">% Burn Rate</th>
                      <th className="py-2.5 px-3.5 text-center border-r border-slate-200">สถานะ</th>
                      <th className="py-2.5 px-3.5 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {projectBreakdown.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3.5 font-mono font-medium text-slate-800 border-r border-slate-200">{p.id}</td>
                        <td className="py-2.5 px-3.5 font-medium text-slate-900 border-r border-slate-200">{p.name || p.id}</td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-800 border-r border-slate-200">
                          {p.budgetCap > 0 ? money(p.budgetCap) : "-"}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-emerald-800 border-r border-slate-200 bg-emerald-50/30 font-medium">
                          {money(p.mat)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono text-indigo-800 border-r border-slate-200 bg-indigo-50/30 font-medium">
                          {money(p.lab)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-900 border-r border-slate-200">
                          <div>{money(p.spent)}</div>
                          {p.pendingSpent > 0 && (
                            <div className="text-[10px] text-amber-600 font-normal">
                              (รอเบิก {money(p.pendingSpent)})
                            </div>
                          )}
                        </td>
                        <td className={`py-2.5 px-3.5 text-right font-mono font-semibold border-r border-slate-200 ${
                          p.remaining >= 0 ? "text-emerald-700" : "text-rose-600"
                        }`}>
                          {money(p.remaining)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono font-medium border-r border-slate-200">
                          {p.burnRate.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3.5 text-center border-r border-slate-200">
                          {p.burnRate > 100 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-300">
                              เกินงบ
                            </span>
                          ) : p.burnRate > 85 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-300">
                              เฝ้าระวัง
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ปกติ
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <button
                            onClick={() => setDrilldownModal({ title: `รายการเบิกจ่าย - ${p.displayName}`, rows: p.rows })}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs border border-slate-300 shadow-2xs transition flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            ดูรายการ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20 bg-slate-100 text-slate-900 font-semibold text-xs border-t-2 border-slate-300 shadow-2xs">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3.5 border-r border-slate-300 text-slate-900">
                        รวมสุทธิทั้งสิ้น ({projectBreakdown.length} โครงการ)
                      </td>
                      <td className="py-2.5 px-3.5 text-right border-r border-slate-300 font-mono text-slate-900">
                        {money(summaryMetrics.totalBudget)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right border-r border-slate-300 text-emerald-800 font-mono">
                        {money(summaryMetrics.materialSpent)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right border-r border-slate-300 text-indigo-800 font-mono">
                        {money(summaryMetrics.laborSpent)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right border-r border-slate-300 font-mono text-slate-900">
                        {money(summaryMetrics.totalSpent)}
                      </td>
                      <td className={`py-2.5 px-3.5 text-right border-r border-slate-300 font-mono ${
                        summaryMetrics.remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}>
                        {money(summaryMetrics.remainingBudget)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center border-r border-slate-300 font-mono">
                        {summaryMetrics.burnRate.toFixed(1)}%
                      </td>
                      <td colSpan={2} className="py-2.5 px-3.5 text-center text-slate-400">
                        -
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🥧 TAB 2: โครงสร้างต้นทุน & กราฟภาพรวมผู้บริหาร (EXECUTIVE VISUAL CHARTS)  */}
      {/* ========================================================================= */}
      {activeMainTab === "cost_structure" && (
        <ProjectExecutiveCharts
          projectRows={hydratedProjects}
          dataRows={yearFilteredDataRows}
          selectedProjectId={selectedProjectId}
          selectedCategory={selectedCategory}
        />
      )}

      {/* ========================================================================= */}
      {/* 🎛️ TAB 3: เมตริกซ์ควบคุมงบรายหมวด (BUDGET CONTROL MATRIX)                */}
      {/* ========================================================================= */}
      {activeMainTab === "budget_matrix" && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Grid className="text-emerald-700" size={16} />
              <span>ตารางเมตริกซ์ควบคุมงบรายหมวดหมู่ (Project Budget Control Matrix)</span>
            </h2>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              ควบคุมและจัดสรรงบประมาณย่อยใน 8 หมวดหมู่ต้นทุนหลักแยกตามรายโครงการ
            </p>
          </div>

          <ProjectBudgetControlMatrix
            projectRows={hydratedProjects}
            dataRows={yearFilteredDataRows}
            selectedProjectId={selectedProjectId}
          />
        </div>
      )}

      {/* 6. DRILLDOWN MODAL */}
      {drilldownModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-slate-50 text-slate-900 flex items-center justify-between border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-base text-slate-900">{drilldownModal.title}</h3>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  พบทั้งสิ้น {drilldownModal.rows.length} รายการ | รวมเบิกจ่าย: {money(drilldownModal.rows.reduce((s, r) => s + getRowAmount(r), 0))} บาท
                </p>
              </div>
              <button
                onClick={() => setDrilldownModal(null)}
                className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-auto p-4 flex-1">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="sticky top-0 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center">ลำดับ</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ผู้เบิก</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ร้านค้า/ผู้รับเหมา</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">รายละเอียดงาน</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">ประเภท</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">ยอดเงิน</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200 text-emerald-900 bg-emerald-50">โอนจริง</th>
                    <th className="py-2.5 px-3 text-center">ว/ด/ป</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {drilldownModal.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 text-center text-slate-500">{r["ลำดับ"] || i + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{getRequesterDisplayName(r["ผู้เบิก"])}</td>
                      <td className="py-2 px-3 text-slate-900">
                        {r["ร้านค้า"] || r["ผู้รับเหมา"] || r["ร้าน/บุคคล"] || "-"}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{r["รายละเอียดงาน"] || r["สินค้า/ทำงาน"] || "-"}</td>
                      <td className="py-2 px-3 font-medium text-emerald-700">{getRowCategory(r) || "-"}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-800">{money(getRowAmount(r))}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-emerald-700 bg-emerald-50/50">
                        {money(getRowTransferAmount(r))}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">{formatDateThai(r["ว/ด/ป"] || r["วันที่"])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDrilldownModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-medium text-xs hover:bg-slate-900 transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
