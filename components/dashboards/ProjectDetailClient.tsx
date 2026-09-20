"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Hammer,
  Users,
  Fuel,
  Wrench,
  Truck,
  FileText,
  SlidersHorizontal,
  AlertCircle,
  CheckCircle2,
  PieChart,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Pencil,
  TrendingUp,
  Filter,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { ProjectDetailEditor } from "@/components/forms/ProjectDetailEditor";
import { ProjectBudgetAllocationManager } from "@/components/dashboards/ProjectBudgetAllocationManager";
import { getProjectColorInfo } from "@/components/dashboards/WorkStatusDashboardClient";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateDisplay } from "@/lib/utils/dates";
import { isPaidBill } from "@/lib/bills/bill-status";
import type { SheetRow } from "@/lib/types";
import {
  calculateProjectBudgetControl,
  type ProjectBudgetSummary,
  type BudgetItemAnalysis,
  type BudgetGroup
} from "@/lib/project-budget-control";

type ProjectDetailClientProps = {
  projectId: string;
  projectName: string;
  hydratedProject: SheetRow;
  customerDisplay?: string;
  companyDisplay?: string;
  totals: {
    workTotal: number;
    totalVat: number;
    budget: number;
    totalAll: number;
    billCount: number;
    remaining: number;
    actualPaid?: number;
    pendingPayables?: number;
  };
  budgetControl?: ProjectBudgetSummary;
  summaryRows: SheetRow[];
  detailFields: string[];
  relatedColumns: string[];
  initialTab?: string;
};

export function ProjectDetailClient({
  projectId,
  projectName,
  hydratedProject,
  customerDisplay,
  companyDisplay,
  totals,
  budgetControl,
  summaryRows,
  detailFields,
  relatedColumns,
  initialTab,
}: ProjectDetailClientProps) {
  const validInitialTab: "bills" | "budget-control" | "allocation" | "edit" =
    initialTab === "allocation" || initialTab === "budget-control" || initialTab === "edit" || initialTab === "bills"
      ? initialTab
      : "bills";
  const [activeTab, setActiveTab] = useState<"bills" | "budget-control" | "allocation" | "edit">(validInitialTab);
  const [budgetViewMode, setBudgetViewMode] = useState<"grouped" | "table">("table");
  const [hideEmptyBudgets, setHideEmptyBudgets] = useState(false);
  const [billFilterTerm, setBillFilterTerm] = useState<string>("");
  const [autoEditMode, setAutoEditMode] = useState(false);
  const [autoEditAllocation, setAutoEditAllocation] = useState(false);

  // Group accordion toggle state - default all open
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "ค่าของ (Material Cost Code)": true,
    "ค่าแรง (Labor Cost Code)": true
  });

  const colorInfo = getProjectColorInfo(hydratedProject.color);

  // Derive complete budget control summary aligned with ProjectBudgetAllocator
  const bCtrl = useMemo(() => {
    return budgetControl || calculateProjectBudgetControl(hydratedProject, summaryRows);
  }, [budgetControl, hydratedProject, summaryRows]);

  // List of overbudget items for alerts
  const overbudgetItems = useMemo(() => {
    return bCtrl.items.filter(i => i.isOver === 1);
  }, [bCtrl]);

  const customer = customerDisplay || String(hydratedProject["ชื่อลูกค้า"] || hydratedProject["ลูกค้า"] || "-");
  const company = companyDisplay || String(hydratedProject["บริษัท"] || hydratedProject["บริษัทรับงาน"] || "-");
  const owner = String(hydratedProject["รับผิดชอบ"] || "-");
  const date = formatDateDisplay(hydratedProject["วันที่"]);
  const location = String(hydratedProject["สถานที่"] || "-");

  // Filter summary rows if user clicked on an item filter
  const displayedSummaryRows = useMemo(() => {
    if (!billFilterTerm) return summaryRows;
    const term = billFilterTerm.toLowerCase().trim();
    return summaryRows.filter(r => {
      const item = String(r["สินค้า/ทำงาน"] || r["สินค้า"] || r["รายการ"] || "").toLowerCase();
      const type = String(r["ประเภท"] || "").toLowerCase();
      const contractor = String(r["ร้าน/บุคคล"] || "").toLowerCase();
      return item.includes(term) || type.includes(term) || contractor.includes(term);
    });
  }, [summaryRows, billFilterTerm]);

  function toggleGroup(groupName: string) {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  }

  function handleFilterBillsByItem(itemName: string) {
    const clean = itemName.replace(/^\d+[-.]?\s*/, "").trim();
    setBillFilterTerm(clean);
    setActiveTab("bills");
  }

  function handleOpenAllocatorEdit() {
    setAutoEditAllocation(true);
    setActiveTab("allocation");
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4 sm:p-5 max-w-[1440px] mx-auto font-sans text-sm text-slate-800">
      {/* 1. HEADER BREADCRUMB & STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/work-status"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft size={14} />
            <span>รายการสถานะงาน</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-700">#{projectId}</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${colorInfo.badgeClass}`}>
            <span>{colorInfo.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAllocatorEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition shadow-2xs cursor-pointer font-medium"
          >
            <Pencil size={13} />
            <span>จัดสรรงบประมาณโครงการ</span>
          </button>
        </div>
      </div>

      {/* 2. TITLE & META INFO */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{projectName}</h1>
        <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>ลูกค้า: <strong className="text-slate-700 font-medium">{customer}</strong></span>
          <span>·</span>
          <span>บริษัท: <strong className="text-slate-700 font-medium">{company}</strong></span>
          <span>·</span>
          <span>ผู้รับผิดชอบ: <strong className="text-slate-700 font-medium">{owner}</strong></span>
          {location !== "-" && (
            <>
              <span>·</span>
              <span>สถานที่: <strong className="text-slate-700 font-medium">{location}</strong></span>
            </>
          )}
          {date !== "-" && (
            <>
              <span>·</span>
              <span>วันที่: <strong className="text-slate-700 font-medium">{date}</strong></span>
            </>
          )}
        </p>
      </div>

      {/* 3. FINANCIAL SUMMARY - 4 CARDS STRICTLY ALIGNED WITH PROJECT BUDGET ALLOCATION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Project Budget Cap */}
        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
              <span>งบประมาณโครงการ</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-normal">
                กรอบวงเงิน
              </span>
            </div>
            <div className="text-xl sm:text-2xl text-slate-900 font-bold font-mono">
              {money(bCtrl.projectBudget)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>สัญญา (ยอดงาน):</span>
            <span className="font-mono text-slate-700 font-semibold">{money(bCtrl.workAmount)}</span>
          </div>
        </div>

        {/* Card 2: Allocated Budget */}
        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
              <span>จัดสรรงบแล้ว</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                bCtrl.allocatedPercent > 100
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-300"
              }`}>
                {bCtrl.allocatedPercent.toFixed(1)}%
              </span>
            </div>
            <div className="text-xl sm:text-2xl text-slate-900 font-bold font-mono">
              {money(bCtrl.totalAllocated)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px]">1. ค่าของ (22 รายการ):</span>
              <span className="font-mono text-emerald-800 font-semibold">{money(bCtrl.materialBudget)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px]">2. ค่าแรง & พนักงาน:</span>
              <span className="font-mono text-indigo-700 font-semibold">{money(bCtrl.laborBudget)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Unallocated Quota */}
        <div className={`border rounded-xl p-4 bg-white shadow-2xs flex flex-col justify-between ${
          bCtrl.unallocatedBudget < 0 ? "border-rose-300 bg-rose-50/20" : "border-slate-200"
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs font-medium mb-1">
              <span className={bCtrl.unallocatedBudget < 0 ? "text-rose-600 font-semibold" : "text-slate-400"}>
                คงเหลือยังไม่จัดสรร
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                bCtrl.unallocatedBudget < 0
                  ? "bg-rose-100 text-rose-800 border border-rose-300"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {bCtrl.projectBudget > 0
                  ? `${Math.max(0, Math.min(100, 100 - bCtrl.allocatedPercent)).toFixed(1)}%`
                  : "-"}
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold font-mono ${
              bCtrl.unallocatedBudget < 0 ? "text-rose-600" : "text-emerald-700"
            }`}>
              {money(bCtrl.unallocatedBudget)}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs">
            {bCtrl.unallocatedBudget < 0 ? (
              <span className="text-rose-600 flex items-center gap-1 font-medium">
                <AlertCircle size={13} />
                <span>จัดสรรเกินงบโครงการ {money(Math.abs(bCtrl.unallocatedBudget))}</span>
              </span>
            ) : (
              <span className="text-slate-500 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-700" />
                <span>พร้อมสำหรับการจัดสรรเพิ่ม</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Actual Paid vs Budget */}
        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
              <span>เบิกจ่ายจริงสะสม</span>
              <span className="text-indigo-700 font-mono font-medium">
                {bCtrl.spendPercentOfBudget.toFixed(1)}% ใช้งบ
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <div className="text-xl sm:text-2xl text-indigo-700 font-bold font-mono">
                {money(bCtrl.actualPaidTotal)}
              </div>
              {bCtrl.pendingTotal > 0 && (
                <span className="text-xs text-amber-600 font-normal">
                  (รอเบิก {money(bCtrl.pendingTotal)})
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>งบคงเหลือสุทธิ:</span>
            <span className={`font-mono font-semibold ${
              bCtrl.netRemainingBudget < 0 ? "text-rose-600" : "text-emerald-700"
            }`}>
              {money(bCtrl.netRemainingBudget)}
            </span>
          </div>
        </div>
      </div>

      {/* DUAL-TRACK PROGRESS BARS: ALLOCATION & SPENDING */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-slate-800 flex items-center gap-2">
            <PieChart size={15} className="text-indigo-600" />
            <span>สัดส่วนความคืบหน้างบประมาณและการเบิกจ่ายโครงการ</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>ค่าของ ({bCtrl.materialBudget > 0 && bCtrl.projectBudget > 0 ? `${((bCtrl.materialBudget / bCtrl.projectBudget) * 100).toFixed(0)}%` : "0%"})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>ค่าแรง & พนักงาน ({bCtrl.laborBudget > 0 && bCtrl.projectBudget > 0 ? `${((bCtrl.laborBudget / bCtrl.projectBudget) * 100).toFixed(0)}%` : "0%"})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>รอเบิกจ่าย ({bCtrl.pendingTotal > 0 ? money(bCtrl.pendingTotal) : "0"})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span>ยังไม่จัดสรร ({bCtrl.unallocatedBudget > 0 ? money(bCtrl.unallocatedBudget) : "0"})</span>
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {/* Track 1: Allocation Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>1. สัดส่วนการจัดสรรงบ (Allocation): {money(bCtrl.totalAllocated)} / {money(bCtrl.projectBudget)}</span>
              <span className="font-mono font-medium text-slate-700">{bCtrl.allocatedPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
              <div
                style={{ width: `${Math.min(100, (bCtrl.materialBudget / (bCtrl.projectBudget || 1)) * 100)}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`ค่าของ: ${money(bCtrl.materialBudget)}`}
              />
              <div
                style={{ width: `${Math.min(100 - (bCtrl.materialBudget / (bCtrl.projectBudget || 1)) * 100, (bCtrl.laborBudget / (bCtrl.projectBudget || 1)) * 100)}%` }}
                className="bg-indigo-500 h-full transition-all duration-300"
                title={`ค่าแรง/พนักงาน: ${money(bCtrl.laborBudget)}`}
              />
            </div>
          </div>

          {/* Track 2: Spending Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>2. สัดส่วนการเบิกจ่ายจริง (Spent vs Allocated): {money(bCtrl.actualPaidTotal)} / {money(bCtrl.totalAllocated || bCtrl.projectBudget)}</span>
              <span className="font-mono font-medium text-indigo-700">
                {bCtrl.totalAllocated > 0
                  ? `${((bCtrl.actualPaidTotal / bCtrl.totalAllocated) * 100).toFixed(1)}%`
                  : `${bCtrl.spendPercentOfBudget.toFixed(1)}%`}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
              <div
                style={{ width: `${Math.min(100, (bCtrl.actualPaidTotal / (bCtrl.totalAllocated || bCtrl.projectBudget || 1)) * 100)}%` }}
                className={`h-full transition-all duration-300 ${
                  bCtrl.actualPaidTotal > (bCtrl.totalAllocated || bCtrl.projectBudget)
                    ? "bg-rose-500"
                    : "bg-indigo-600"
                }`}
                title={`จ่ายแล้ว: ${money(bCtrl.actualPaidTotal)}`}
              />
              <div
                style={{ width: `${Math.min(100, (bCtrl.pendingTotal / (bCtrl.totalAllocated || bCtrl.projectBudget || 1)) * 100)}%` }}
                className="bg-amber-400 h-full transition-all duration-300"
                title={`รอเบิก: ${money(bCtrl.pendingTotal)}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. WORKSPACE TABS */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab("bills")}
          className={`px-3.5 py-2.5 border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "bills"
              ? "border-slate-900 text-slate-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 font-medium"
          }`}
        >
          รายการบิลเบิกจ่าย ({summaryRows.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("budget-control")}
          className={`px-3.5 py-2.5 border-b-2 transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === "budget-control"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 font-medium"
          }`}
        >
          <span>ควบคุมงบประมาณตามการจัดสรร ({bCtrl.groups.length} หมวด / {bCtrl.items.length} รายการ)</span>
          {overbudgetItems.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setAutoEditAllocation(false);
            setActiveTab("allocation");
          }}
          className={`px-3.5 py-2.5 border-b-2 transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === "allocation"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 font-medium"
          }`}
        >
          <PieChart size={14} />
          <span>การจัดสรรงบประมาณโครงการ</span>
          {bCtrl.totalAllocated > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
              {bCtrl.allocatedPercent.toFixed(0)}%
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setAutoEditMode(false);
            setActiveTab("edit");
          }}
          className={`px-3.5 py-2.5 border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "edit"
              ? "border-slate-900 text-slate-900 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800 font-medium"
          }`}
        >
          รายละเอียด & แก้ไขโครงการ
        </button>
      </div>

      {/* 5. TAB 1: BILLS TABLE */}
      {activeTab === "bills" && (
        <div className="space-y-3">
          {billFilterTerm && (
            <div className="bg-indigo-50 border border-indigo-200 px-3.5 py-2 rounded-lg flex items-center justify-between text-xs">
              <span className="text-indigo-800">
                กำลังกรองบิลที่ตรงกับ: <strong>{billFilterTerm}</strong> ({displayedSummaryRows.length} รายการ)
              </span>
              <button
                type="button"
                onClick={() => setBillFilterTerm("")}
                className="text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
              >
                ล้างตัวกรอง
              </button>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
            <DataTable
              columns={relatedColumns}
              rows={displayedSummaryRows}
              limit={100}
              title="รายการบิลเบิกจ่ายที่เกี่ยวข้อง"
              subtitle={`ทั้งหมด ${displayedSummaryRows.length} รายการ`}
              showSearch
              detailBasePath="/bills"
              detailKeyColumn="ลำดับ"
              cellFormatters={{
                "ว/ด/ป": (v) => formatDateDisplay(v),
                "วันที่": (v) => formatDateDisplay(v),
              }}
            />
          </div>
        </div>
      )}

      {/* 6. TAB 2: BUDGET CONTROL (STRICTLY ALIGNED WITH PROJECT BUDGET ALLOCATION) */}
      {activeTab === "budget-control" && (
        <div className="space-y-4">
          {/* Top Control Bar & Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-indigo-600" />
                <span>การควบคุมงบประมาณตามการจัดสรรโครงการ</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                จำแนกตาม 2 หมวดหลัก: ค่าของ ({bCtrl.items.filter(i => i.group === "ค่าของ (Material Cost Code)").length} รายการ) และ ค่าแรง ({bCtrl.items.filter(i => i.group === "ค่าแรง (Labor Cost Code)").length} รายการ รวมพนักงาน) ตาม Cost Code
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Switcher */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setBudgetViewMode("table")}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                    budgetViewMode === "table" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ตารางทั้งหมด ({bCtrl.items.length} รายการ)
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetViewMode("grouped")}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                    budgetViewMode === "grouped" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  จัดกลุ่ม 2 หมวดหลัก (ค่าของ & ค่าแรง)
                </button>
              </div>

              {/* Hide Empty Toggle */}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={hideEmptyBudgets}
                  onChange={(e) => setHideEmptyBudgets(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>ซ่อนรายการไม่มีงบ</span>
              </label>

              {/* Button: Edit Allocations */}
              <button
                type="button"
                onClick={handleOpenAllocatorEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition shadow-2xs cursor-pointer"
              >
                <Pencil size={13} />
                <span>ปรับปรุงการจัดสรรงบ</span>
              </button>
            </div>
          </div>

          {/* Overbudget Alert Notice if any item exceeded allocation */}
          {overbudgetItems.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-2xs flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-rose-900">
                  พบรายการเบิกจ่ายเกินวงเงินจัดสรร ({overbudgetItems.length} รายการ)
                </div>
                <div className="text-rose-700 flex flex-wrap gap-2 pt-0.5">
                  {overbudgetItems.map(item => (
                    <span key={item.code} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-rose-200 font-mono">
                      <span>{item.label}:</span>
                      <strong className="text-rose-600">เกิน {money(item.actualSpent - item.budgetCap)} ฿</strong>
                      <span className="text-slate-400 font-normal font-sans">(งบ {money(item.budgetCap)} / จ่าย {money(item.actualSpent)})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 1: GROUPED ACCORDION (6 GROUPS) */}
          {budgetViewMode === "grouped" && (
            <div className="space-y-3">
              {bCtrl.groups.map((group) => {
                const isExpanded = expandedGroups[group.groupName] ?? true;
                const visibleItems = hideEmptyBudgets
                  ? group.items.filter(i => i.budgetCap > 0 || i.actualSpent > 0 || i.pendingSpent > 0)
                  : group.items;

                if (hideEmptyBudgets && visibleItems.length === 0) return null;

                const isGroupOver = group.budget > 0 && group.spent > group.budget;
                const groupPercent = group.budget > 0 ? Math.round((group.spent / group.budget) * 100) : 0;

                return (
                  <div
                    key={group.groupName}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
                  >
                    {/* Group Header Card */}
                    <div
                      onClick={() => toggleGroup(group.groupName)}
                      className="px-4 py-3.5 bg-slate-50/70 hover:bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer border-b border-slate-100 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{getGroupIcon(group.groupName)}</span>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{group.groupName}</span>
                            <span className="text-[10px] text-slate-500 font-normal bg-white px-2 py-0.5 rounded border border-slate-200">
                              {visibleItems.length} รายการ
                            </span>
                            {isGroupOver && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                เกินงบหมวด
                              </span>
                            )}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap text-xs">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">งบจัดสรร</span>
                          <span className="font-mono font-bold text-slate-800">
                            {group.budget > 0 ? money(group.budget) : <span className="text-slate-400 font-normal">-</span>}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">เบิกจ่ายจริง</span>
                          <span className="font-mono font-bold text-indigo-700">
                            {money(group.spent)}
                            {group.pending > 0 && (
                              <span className="text-[10px] text-amber-600 font-normal ml-1">
                                (รอ {money(group.pending)})
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">คงเหลือ</span>
                          <span className={`font-mono font-bold ${
                            isGroupOver ? "text-rose-600" : group.budget > 0 ? "text-emerald-700" : "text-slate-400"
                          }`}>
                            {group.budget > 0 ? money(group.remaining) : "-"}
                          </span>
                        </div>

                        {group.budget > 0 && (
                          <div className="w-24 shrink-0 hidden sm:block">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>ใช้ไป</span>
                              <span className={`font-mono ${isGroupOver ? "text-rose-600 font-bold" : ""}`}>{groupPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isGroupOver ? "bg-rose-500" : groupPercent > 80 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, groupPercent)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="text-slate-400 ml-1">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Group Items Table */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/60 border-b border-slate-200/80 text-slate-600 text-[11px]">
                              <th className="py-2.5 px-4 font-semibold">รายการจัดสรร</th>
                              <th className="py-2.5 px-4 text-right font-semibold">วงเงินจัดสรร</th>
                              <th className="py-2.5 px-4 text-right font-semibold">เบิกจ่ายจริง</th>
                              <th className="py-2.5 px-4 text-right font-semibold">ยอดคงเหลือ</th>
                              <th className="py-2.5 px-4 text-center font-semibold">สัดส่วนการใช้งบ</th>
                              <th className="py-2.5 px-4 text-center font-semibold">สถานะ</th>
                              <th className="py-2.5 px-4 text-center font-semibold">บิลที่เกี่ยวข้อง</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {visibleItems.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                                  ไม่มีรายการที่มีการตั้งงบหรือเบิกจ่ายในหมวดนี้
                                </td>
                              </tr>
                            ) : (
                              visibleItems.map((item) => {
                                return (
                                  <tr key={item.code} className="hover:bg-slate-50/70 transition">
                                    <td className="py-2.5 px-4 text-slate-800">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">{item.icon}</span>
                                        <span className="font-medium">{item.label}</span>
                                      </div>
                                    </td>

                                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                                      {item.budgetCap > 0 ? (
                                        money(item.budgetCap)
                                      ) : (
                                        <span className="text-slate-400 font-sans text-xs">ไม่ได้ตั้งงบ</span>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700">
                                      <div>{money(item.actualSpent)}</div>
                                      {item.pendingSpent > 0 && (
                                        <div className="text-[10px] text-amber-600 font-normal">
                                          (รอ {money(item.pendingSpent)})
                                        </div>
                                      )}
                                    </td>

                                    <td className={`py-2.5 px-4 text-right font-mono font-semibold ${
                                      item.isOver ? "text-rose-600 font-bold" : item.budgetCap > 0 ? "text-emerald-700" : "text-slate-400"
                                    }`}>
                                      {item.budgetCap > 0 ? money(item.remaining) : "-"}
                                    </td>

                                    <td className="py-2.5 px-4 text-center">
                                      {item.budgetCap > 0 ? (
                                        <div className="flex items-center gap-2 justify-center">
                                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${
                                                item.isOver ? "bg-rose-500" : item.percentUsed > 80 ? "bg-amber-500" : "bg-emerald-500"
                                              }`}
                                              style={{ width: `${Math.min(100, item.percentUsed)}%` }}
                                            />
                                          </div>
                                          <span className={`text-[11px] font-mono ${item.isOver ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                                            {item.percentUsed}%
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 text-[11px]">-</span>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4 text-center">
                                      {item.budgetCap > 0 ? (
                                        item.isOver ? (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                            เกินงบ
                                          </span>
                                        ) : item.isWarning ? (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                            ใกล้เต็ม
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-300">
                                            ปกติ
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-slate-400 text-[10px]">ทั่วไป</span>
                                      )}
                                    </td>

                                    <td className="py-2.5 px-4 text-center">
                                      {item.billCount > 0 || item.pendingCount > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => handleFilterBillsByItem(item.label)}
                                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 transition cursor-pointer font-medium"
                                          title="คลิกเพื่อดูบิลที่ตรงกับรายการนี้"
                                        >
                                          <span>{item.billCount} บิล</span>
                                          {item.pendingCount > 0 && (
                                            <span className="text-amber-600">({item.pendingCount} รอ)</span>
                                          )}
                                          <ExternalLink size={10} className="text-slate-400" />
                                        </button>
                                      ) : (
                                        <span className="text-slate-400 text-[11px]">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE 2: DETAILED TABLE (24 ITEMS FLAT MATRIX) */}
          {budgetViewMode === "table" && (
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-800">
                  ตารางเปรียบเทียบงบประมาณจัดสรรและการเบิกจ่ายจริงทั้งหมด ({bCtrl.items.length} หมวดตามบิล)
                </h3>
                <span className="text-[11px] text-slate-500">
                  รวมจัดสรร {money(bCtrl.totalAllocated)} ฿ · จ่ายจริง {money(bCtrl.actualPaidTotal)} ฿
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px]">
                      <th className="py-2.5 px-4 font-semibold">รหัส & รายการ</th>
                      <th className="py-2.5 px-4 font-semibold">หมวดงาน</th>
                      <th className="py-2.5 px-4 text-right font-semibold">วงเงินจัดสรร</th>
                      <th className="py-2.5 px-4 text-right font-semibold">เบิกจ่ายจริง</th>
                      <th className="py-2.5 px-4 text-right font-semibold">ยอดคงเหลือ</th>
                      <th className="py-2.5 px-4 text-center font-semibold">สัดส่วนการใช้งบ</th>
                      <th className="py-2.5 px-4 text-center font-semibold">สถานะ</th>
                      <th className="py-2.5 px-4 text-center font-semibold">จำนวนบิล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bCtrl.items
                      .filter(i => !hideEmptyBudgets || (i.budgetCap > 0 || i.actualSpent > 0 || i.pendingSpent > 0))
                      .map((item) => (
                        <tr key={item.code} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-4 text-slate-800 flex items-center gap-2">
                            <span className="text-sm">{item.icon}</span>
                            <span className="font-medium">{item.label}</span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                            {item.group}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                            {item.budgetCap > 0 ? money(item.budgetCap) : <span className="text-slate-400 font-sans text-xs">ไม่ได้ตั้งงบ</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700">
                            <div>{money(item.actualSpent)}</div>
                            {item.pendingSpent > 0 && (
                              <div className="text-[10px] text-amber-600 font-normal">
                                (รอ {money(item.pendingSpent)})
                              </div>
                            )}
                          </td>
                          <td className={`py-2.5 px-4 text-right font-mono font-semibold ${
                            item.isOver ? "text-rose-600 font-bold" : item.budgetCap > 0 ? "text-emerald-700" : "text-slate-400"
                          }`}>
                            {item.budgetCap > 0 ? money(item.remaining) : "-"}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {item.budgetCap > 0 ? (
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.isOver ? "bg-rose-500" : item.percentUsed > 80 ? "bg-amber-500" : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.min(100, item.percentUsed)}%` }}
                                  />
                                </div>
                                <span className={`text-[11px] font-mono ${item.isOver ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                                  {item.percentUsed}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {item.budgetCap > 0 ? (
                              item.isOver ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  เกินงบ
                                </span>
                              ) : item.isWarning ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  ใกล้เต็ม
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  ปกติ
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[10px]">ทั่วไป</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {item.billCount > 0 || item.pendingCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleFilterBillsByItem(item.label)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition cursor-pointer text-[11px]"
                              >
                                <span>{item.billCount} บิล</span>
                                {item.pendingCount > 0 && <span className="text-amber-600">({item.pendingCount} รอ)</span>}
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-xs">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 text-slate-900">รวมทั้งหมด {bCtrl.items.length} รายการจัดสรร</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900">{money(bCtrl.totalAllocated)}</td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-700">{money(bCtrl.actualPaidTotal)}</td>
                      <td className={`py-3 px-4 text-right font-mono ${bCtrl.totalAllocated - bCtrl.actualPaidTotal < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {money(bCtrl.totalAllocated - bCtrl.actualPaidTotal)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {bCtrl.totalAllocated > 0 ? `${Math.round((bCtrl.actualPaidTotal / bCtrl.totalAllocated) * 100)}%` : "-"}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 3: PROJECT BUDGET ALLOCATION (DEDICATED ALLOCATOR TAB) */}
      {activeTab === "allocation" && (
        <ProjectBudgetAllocationManager
          project={hydratedProject}
          projectId={projectId}
          initialEditing={autoEditAllocation}
        />
      )}

      {/* 8. TAB 4: EDIT & DETAIL VIEW */}
      {activeTab === "edit" && (
        <div className="border border-slate-200 rounded-xl bg-white p-4 shadow-2xs">
          <ProjectDetailEditor
            fields={detailFields}
            project={hydratedProject}
            customerDisplay={customer}
            companyDisplay={company}
            initialEditing={autoEditMode}
          />
        </div>
      )}
    </div>
  );
}


function getGroupIcon(groupName: BudgetGroup): string {
  switch (groupName) {
    case "ค่าของ (Material Cost Code)":
      return "📦";
    case "ค่าแรง (Labor Cost Code)":
      return "👷";
    default:
      return "📁";
  }
}
