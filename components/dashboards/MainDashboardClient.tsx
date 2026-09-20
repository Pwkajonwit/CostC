"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRealtimeSync } from "@/lib/use-realtime-sync";
import {
  Calendar,
  Clock3,
  Coins,
  FileCheck,
  FolderKanban,
  Fuel,
  Hammer,
  HardHat,
  Layers,
  PieChart,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Building2,
  Package,
  Sliders,
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import { ALLOCATED_BUDGET_ITEMS } from "@/lib/project-budget-control";
import {
  computeCashFlowBreakdown,
  getBudgetHealthStatus,
  hydrateProjectRowsForList,
  isCreditActive,
  isDeductActive,
  isVatActive,
} from "@/lib/project-summary";
import { isCommittedBill, isPaidBill } from "@/lib/bills/bill-status";
import {
  isFuelCost,
  isLaborCost,
  isMachineCost,
  isMaterialCost,
  isRepairCost,
  isStaffCost,
  isToolCost,
} from "@/lib/cost-codes";
import { useYearFilter } from "@/lib/context/YearFilterContext";
import type { SheetRow } from "@/lib/types";
import { useSearchParams } from "next/navigation";

type MainDashboardClientProps = {
  initialDataRows: SheetRow[];
  initialProjectRows: SheetRow[];
  initialPettyCashRows?: SheetRow[];
};

type Preset = "today" | "yesterday" | "month" | "previousMonth" | "all" | "custom";

// Modern 4-Cost-Code classification helper
export function classifyExpenseItem(categoryStr: string, vendorType: string): "100" | "200" | "300" | "500" {
  const c = (categoryStr || "").trim();
  const v = (vendorType || "").trim();

  // 500 Equipment / Fleet / Fuel / Repairs / Tools
  if (isFuelCost(c) || isRepairCost(c) || isMachineCost(c) || isToolCost(c)) {
    return "500";
  }
  // 300 Staff
  if (isStaffCost(c) || v === "พนักงาน") {
    return "300";
  }
  // 200 Labor / Contractor
  if (isLaborCost(c) || v === "ผู้รับเหมา") {
    return "200";
  }
  // 100 Material / Store default
  return "100";
}

export function MainDashboardClient({ initialDataRows, initialProjectRows, initialPettyCashRows = [] }: MainDashboardClientProps) {
  const searchParams = useSearchParams();
  const urlSearch = (searchParams.get("search") || "").trim().toLowerCase();
  const { filterRowsByYear, filterProjectsByYear, activeYearLabel } = useYearFilter();

  const [dataRows, setDataRows] = useState<SheetRow[]>(initialDataRows || []);
  const [projectRows, setProjectRows] = useState<SheetRow[]>(initialProjectRows || []);
  const [pettyCashRows, setPettyCashRows] = useState<SheetRow[]>(initialPettyCashRows || []);

  useEffect(() => {
    if (initialDataRows) setDataRows(initialDataRows);
  }, [initialDataRows]);

  useEffect(() => {
    if (initialProjectRows) setProjectRows(initialProjectRows);
  }, [initialProjectRows]);

  useEffect(() => {
    if (initialPettyCashRows) setPettyCashRows(initialPettyCashRows);
  }, [initialPettyCashRows]);

  const [preset, setPreset] = useState<Preset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [costBreakdownTab, setCostBreakdownTab] = useState<"paid" | "pending">("paid");
  const [costGroupMode, setCostGroupMode] = useState<"budget-control" | "cost-code">("budget-control");
  const [projectFilterTab, setProjectFilterTab] = useState<"all" | "warning" | "over">("all");

  // 1. Filter by Year
  const yearFilteredDataRows = useMemo(() => filterRowsByYear(dataRows), [dataRows, filterRowsByYear]);
  const yearFilteredProjectRows = useMemo(
    () => filterProjectsByYear(projectRows, yearFilteredDataRows),
    [projectRows, filterProjectsByYear, yearFilteredDataRows]
  );

  // 2. Filter by Date range
  const range = useMemo(() => getRange(preset, from, to), [preset, from, to]);
  const dateFilteredDataRows = useMemo(
    () => filterRowsByDate(yearFilteredDataRows, range, ["ว/ด/ป", "วันที่"]),
    [yearFilteredDataRows, range]
  );
  const dateFilteredProjectRows = useMemo(
    () => filterRowsByDate(yearFilteredProjectRows, range, ["วันที่", "start_date"]),
    [yearFilteredProjectRows, range]
  );

  // 3. Search filter
  const filteredDataRows = useMemo(() => {
    if (!urlSearch) return dateFilteredDataRows;
    return dateFilteredDataRows.filter((row) => {
      const p1 = String(row["ชื่อ Project"] || "").toLowerCase().includes(urlSearch);
      const p2 = String(row["ร้าน/บุคคล"] || "").toLowerCase().includes(urlSearch);
      const p3 = String(row["สินค้า/ทำงาน"] || "").toLowerCase().includes(urlSearch);
      const p4 = String(row["บิล"] || "").toLowerCase().includes(urlSearch);
      return p1 || p2 || p3 || p4;
    });
  }, [dateFilteredDataRows, urlSearch]);

  const filteredProjectRows = useMemo(() => {
    const list = !urlSearch
      ? dateFilteredProjectRows
      : dateFilteredProjectRows.filter((row) => {
          const p1 = String(row["ชื่อ Project"] || row.name || "").toLowerCase().includes(urlSearch);
          const p2 = String(row["ชื่อลูกค้า"] || row.customer_name || "").toLowerCase().includes(urlSearch);
          return p1 || p2;
        });

    const seen = new Set<string>();
    return list.filter((row) => {
      const id = String(row["ID Project"] || row.id || "").trim();
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [dateFilteredProjectRows, urlSearch]);

  // Realtime Live Sync from Supabase
  async function refreshData() {
    try {
      const response = await fetch("/api/dashboard?refresh=1", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload.dataRows) setDataRows(payload.dataRows);
      if (payload.projectRows) setProjectRows(payload.projectRows);
      if (payload.pettyCashRows) setPettyCashRows(payload.pettyCashRows);
    } catch {}
  }

  useRealtimeSync({
    channelName: "main_dashboard_live_sync",
    tables: ["bills", "projects", "เปิดเงินสดย่อย"],
    onSync: refreshData,
    debounceMs: 700,
    pollingIntervalMs: 0,
    syncOnFocus: false,
  });

  const presetLabels: Record<Preset, string> = {
    all: "ข้อมูลทั้งหมด",
    today: "วันนี้",
    yesterday: "เมื่อวาน",
    month: "เดือนนี้",
    previousMonth: "เดือนก่อน",
    custom: "ช่วงวันที่กำหนด",
  };

  function handlePresetChange(newPreset: Preset) {
    setPreset(newPreset);
    if (newPreset === "all") {
      setFrom("");
      setTo("");
    } else if (newPreset === "today") {
      const today = toLocalYMD(new Date());
      setFrom(today);
      setTo(today);
    } else if (newPreset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const ymd = toLocalYMD(y);
      setFrom(ymd);
      setTo(ymd);
    } else if (newPreset === "month") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFrom(toLocalYMD(first));
      setTo(toLocalYMD(last));
    } else if (newPreset === "previousMonth") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(toLocalYMD(first));
      setTo(toLocalYMD(last));
    }
  }

  // Summary Metrics Computation based on modern cost codes
  const summary = useMemo(() => {
    return buildModernSummary(filteredDataRows, filteredProjectRows);
  }, [filteredDataRows, filteredProjectRows]);

  // Petty Cash Statistics
  const yearFilteredPettyCashRows = useMemo(() => filterRowsByYear(pettyCashRows), [pettyCashRows, filterRowsByYear]);
  const pettyCashStats = useMemo(() => {
    const activeRows = yearFilteredPettyCashRows.filter((r) => {
      const st = String(r["สถานะ"] || "").trim();
      return st !== "ยกเลิก";
    });

    const unclearedRows = activeRows.filter((r) => {
      const amt = toNumber(r["จำนวนเงิน"]);
      const clr = toNumber(r["ยอดเคลียร์แล้ว"]);
      const rem = Math.max(0, amt - clr);
      const st = String(r["สถานะ"] || "").trim();
      return st !== "เคลียร์บิลแล้ว" && rem > 0;
    });

    const totalUnclearedAmount = unclearedRows.reduce((sum, r) => {
      const amt = toNumber(r["จำนวนเงิน"]);
      const clr = toNumber(r["ยอดเคลียร์แล้ว"]);
      return sum + Math.max(0, amt - clr);
    }, 0);

    return {
      unclearedCount: unclearedRows.length,
      totalUnclearedAmount,
      totalCount: activeRows.length,
    };
  }, [yearFilteredPettyCashRows]);

  // Hydrated active projects for Budget Health table
  const hydratedActiveProjects = useMemo(() => {
    const hydrated = hydrateProjectRowsForList(filteredProjectRows, filteredDataRows);
    // Filter active projects (not completed / not black)
    return hydrated
      .filter((p) => {
        const c = String(p.color || "").toLowerCase();
        const st = String(p["สถานะ"] || "").toLowerCase();
        return c !== "black" && !st.includes("เสร็จ");
      })
      .sort((a, b) => {
        const aSpent = toNumber(a["รวม ALL"]);
        const bSpent = toNumber(b["รวม ALL"]);
        return bSpent - aSpent;
      });
  }, [filteredProjectRows, filteredDataRows]);

  // Project table filter
  const displayedProjects = useMemo(() => {
    if (projectFilterTab === "all") return hydratedActiveProjects;
    return hydratedActiveProjects.filter((p) => {
      const health = p.budgetHealth?.status;
      if (projectFilterTab === "warning") return health === "warning";
      if (projectFilterTab === "over") return health === "danger" || health === "critical";
      return true;
    });
  }, [hydratedActiveProjects, projectFilterTab]);

  const costBreakdownData = useMemo(() => {
    const isPaid = costBreakdownTab === "paid";
    const total = isPaid ? summary.cashPaid : summary.pendingAP;

    const items = [
      {
        code: "100",
        name: "ค่าของ & วัสดุก่อสร้าง",
        subtitle: "ร้านค้า, วัสดุ, อุปกรณ์ (101-123)",
        amount: isPaid ? summary.cost100.paid : summary.cost100.pending,
        paidAmt: summary.cost100.paid,
        pendingAmt: summary.cost100.pending,
        percent: total > 0 ? ((isPaid ? summary.cost100.paid : summary.cost100.pending) / total) * 100 : 0,
        color: "bg-emerald-600",
        textColor: "text-emerald-900",
        badgeBg: "bg-emerald-50 border-emerald-300 text-emerald-900",
        icon: Package,
      },
      {
        code: "200",
        name: "ค่าแรงผู้รับเหมา",
        subtitle: "งานงวดค่าแรง, ช่างเหมา (201-223)",
        amount: isPaid ? summary.cost200.paid : summary.cost200.pending,
        paidAmt: summary.cost200.paid,
        pendingAmt: summary.cost200.pending,
        percent: total > 0 ? ((isPaid ? summary.cost200.paid : summary.cost200.pending) / total) * 100 : 0,
        color: "bg-amber-600",
        textColor: "text-amber-900",
        badgeBg: "bg-amber-50 border-amber-300 text-amber-900",
        icon: HardHat,
      },
      {
        code: "300",
        name: "บุคลากร & พนักงาน",
        subtitle: "ค่าจ้างรายวัน/เดือน, ช่างประจำไซต์ (301)",
        amount: isPaid ? summary.cost300.paid : summary.cost300.pending,
        paidAmt: summary.cost300.paid,
        pendingAmt: summary.cost300.pending,
        percent: total > 0 ? ((isPaid ? summary.cost300.paid : summary.cost300.pending) / total) * 100 : 0,
        color: "bg-blue-600",
        textColor: "text-blue-900",
        badgeBg: "bg-blue-50 border-blue-300 text-blue-900",
        icon: Users,
      },
      {
        code: "500",
        name: "เครื่องจักร & ยานพาหนะ",
        subtitle: "น้ำมัน, ซ่อมรถ, เครื่องมือ (501-504)",
        amount: isPaid ? summary.cost500.paid : summary.cost500.pending,
        paidAmt: summary.cost500.paid,
        pendingAmt: summary.cost500.pending,
        percent: total > 0 ? ((isPaid ? summary.cost500.paid : summary.cost500.pending) / total) * 100 : 0,
        color: "bg-purple-600",
        textColor: "text-purple-900",
        badgeBg: "bg-purple-50 border-purple-300 text-purple-900",
        icon: Truck,
      },
    ];

    return items;
  }, [summary, costBreakdownTab]);

  // Budget Control Groups (แบ่งตาม 2 หมวดควบคุมงบหลัก: ค่าของ vs ค่าแรง)
  const budgetControlBreakdownData = useMemo(() => {
    const isPaid = costBreakdownTab === "paid";
    const total = isPaid ? summary.cashPaid : summary.pendingAP;

    // หมวดค่าของ: รวม 100 ค่าของ + 500 เครื่องจักร/ยานพาหนะ/น้ำมัน
    const materialPaid = summary.cost100.paid + summary.cost500.paid;
    const materialPending = summary.cost100.pending + summary.cost500.pending;
    const materialAmount = isPaid ? materialPaid : materialPending;
    const materialPercent = total > 0 ? (materialAmount / total) * 100 : 0;

    // หมวดค่าแรง: รวม 200 ค่าแรงผู้รับเหมา + 300 บุคลากร/พนักงาน
    const laborPaid = summary.cost200.paid + summary.cost300.paid;
    const laborPending = summary.cost200.pending + summary.cost300.pending;
    const laborAmount = isPaid ? laborPaid : laborPending;
    const laborPercent = total > 0 ? (laborAmount / total) * 100 : 0;

    // วงเงินควบคุมงบประมาณรวมจากทุกโครงการ
    let totalMaterialBudget = 0;
    let totalLaborBudget = 0;
    for (const p of filteredProjectRows) {
      const rawMatCap = toNumber(p["งบไม่เกินค่าของ"]);
      const subMat = ALLOCATED_BUDGET_ITEMS
        .filter((i) => i.group === "ค่าของ (Material Cost Code)")
        .reduce((sum, item) => sum + toNumber(p[item.field]), 0);
      totalMaterialBudget += Math.max(rawMatCap, subMat);

      const rawLabCap = toNumber(p["งบไม่เกินค่าแรง"]);
      const staffCap = toNumber(p["งบไม่เกินพนักงาน"]);
      const subLab = ALLOCATED_BUDGET_ITEMS
        .filter((i) => i.group === "ค่าแรง (Labor Cost Code)")
        .reduce((sum, item) => sum + toNumber(p[item.field]), 0);
      totalLaborBudget += Math.max(rawLabCap, subLab, rawLabCap + staffCap);
    }

    return [
      {
        key: "material",
        name: "หมวดควบคุมงบ: ค่าของ",
        subtitle: "วัสดุก่อสร้าง, อุปกรณ์, เครื่องจักร, ยานพาหนะ, น้ำมัน (หมวด 100 & 500)",
        amount: materialAmount,
        paidAmt: materialPaid,
        pendingAmt: materialPending,
        totalAmt: materialPaid + materialPending,
        totalBudget: totalMaterialBudget,
        percent: materialPercent,
        color: "bg-emerald-600",
        textColor: "text-emerald-900",
        badgeBg: "bg-emerald-50 border-emerald-300 text-emerald-900",
        icon: Package,
        subItems: [
          { label: "100 ค่าของ & วัสดุก่อสร้าง", amount: isPaid ? summary.cost100.paid : summary.cost100.pending, totalAmt: summary.cost100.paid + summary.cost100.pending },
          { label: "500 เครื่องจักร/ยานพาหนะ/น้ำมัน", amount: isPaid ? summary.cost500.paid : summary.cost500.pending, totalAmt: summary.cost500.paid + summary.cost500.pending },
        ],
      },
      {
        key: "labor",
        name: "หมวดควบคุมงบ: ค่าแรง",
        subtitle: "ค่าแรงผู้รับเหมา, ช่างเหมา, ช่างประจำไซต์, พนักงาน (หมวด 200 & 300)",
        amount: laborAmount,
        paidAmt: laborPaid,
        pendingAmt: laborPending,
        totalAmt: laborPaid + laborPending,
        totalBudget: totalLaborBudget,
        percent: laborPercent,
        color: "bg-amber-600",
        textColor: "text-amber-900",
        badgeBg: "bg-amber-50 border-amber-300 text-amber-900",
        icon: HardHat,
        subItems: [
          { label: "200 ค่าแรงผู้รับเหมา/ช่าง", amount: isPaid ? summary.cost200.paid : summary.cost200.pending, totalAmt: summary.cost200.paid + summary.cost200.pending },
          { label: "300 บุคลากร & พนักงานไซต์", amount: isPaid ? summary.cost300.paid : summary.cost300.pending, totalAmt: summary.cost300.paid + summary.cost300.pending },
        ],
      },
    ];
  }, [summary, costBreakdownTab, filteredProjectRows]);

  return (
    <div className="w-full flex flex-col gap-2.5 sm:gap-3 p-2 sm:p-3 max-w-[1600px] mx-auto font-sans text-slate-800 antialiased pb-10">
      {/* ========================================================================= */}
      {/* 1. TOP COMMAND RIBBON & FILTERS                                           */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Software Title & Year Badge */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#0b3531] text-[#34d399] flex items-center justify-center shrink-0 shadow-2xs border border-emerald-700/50">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-1.5">
                  แดชบอร์ดภาพรวมการเงิน
                  <span className="text-[11px] font-bold text-slate-400 tracking-normal hidden sm:inline">
                    / FINANCIAL COCKPIT
                  </span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0 shadow-2xs">
                  <Calendar className="w-3 h-3 text-[#d4f54e]" />
                  <span>{activeYearLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{presetLabels[preset]}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Integrated Date Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start lg:justify-end min-w-0">
            {/* Inline Date Inputs */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-xs shrink-0 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">จาก:</span>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("custom");
                }}
                className="bg-white text-slate-900 text-xs px-2 py-0.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer w-[125px]"
              />
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">ถึง:</span>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("custom");
                }}
                className="bg-white text-slate-900 text-xs px-2 py-0.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer w-[125px]"
              />
              {(from || to) && (
                <button
                  type="button"
                  title="ล้างวันที่ (แสดงทั้งหมด)"
                  onClick={() => handlePresetChange("all")}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-200 rounded transition cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Preset Switcher */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto no-scrollbar text-xs shrink-0 shadow-2xs">
              {(
                [
                  ["all", "ทั้งหมด"],
                  ["today", "วันนี้"],
                  ["yesterday", "เมื่อวาน"],
                  ["month", "เดือนนี้"],
                  ["previousMonth", "เดือนก่อน"],
                ] as const
              ).map(([key, label]) => {
                const isActive = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePresetChange(key as Preset)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold shrink-0 whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/90"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {preset === "custom" && (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold shrink-0 whitespace-nowrap bg-[#0b3531] text-white shadow-2xs">
                  กำหนดเอง
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE FINANCIAL TICKER STRIP (4 MAIN KPIS)                         */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {/* Metric 1: Cash Disbursed */}
        <div className="p-3.5 sm:p-4 flex flex-col justify-between hover:bg-slate-50/50 transition">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200/80 shadow-2xs">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase truncate">
                ยอดเบิกจ่ายจริง
              </span>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                summary.pendingCount > 0
                  ? "text-amber-800 bg-amber-50 border-amber-300"
                  : "text-indigo-800 bg-indigo-50 border-indigo-200"
              }`}
            >
              จ่ายแล้ว {summary.paidCount} บิล
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
              ฿{money(summary.cashPaid)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] truncate">
              {summary.pendingAP > 0 ? (
                <span className="font-semibold text-amber-700">
                  รอเบิก ฿{money(summary.pendingAP)} ({summary.pendingCount} บิล)
                </span>
              ) : (
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>จ่ายครบทุกรายการแล้ว</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Revenue */}
        <div className="p-3.5 sm:p-4 flex flex-col justify-between hover:bg-slate-50/50 transition">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/80 shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase truncate">
                ยอดงานรวมสัญญา
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
              {summary.projectCount} โครงการ
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight truncate">
              ฿{money(summary.revenue)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
              ยอดมูลค่าสัญญางานรวมภาษีทั้งหมด
            </div>
          </div>
        </div>

        {/* Metric 3: Net Profit */}
        <div className="p-3.5 sm:p-4 flex flex-col justify-between hover:bg-slate-50/50 transition">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                  summary.profit >= 0
                    ? "bg-teal-50 text-teal-800 border-teal-200/80"
                    : "bg-rose-50 text-rose-800 border-rose-200/80"
                }`}
              >
                <Coins className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase truncate">
                กำไรสุทธิ (PROFIT)
              </span>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                summary.profitPercent >= 0
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {summary.profitPercent >= 0 ? "+" : ""}
              {summary.profitPercent.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2.5">
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight truncate ${
                summary.profit >= 0 ? "text-teal-800" : "text-rose-600"
              }`}
            >
              ฿{money(summary.profit)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
              {summary.pendingAP > 0 ? (
                <span>
                  กระแสเงินสดคงเหลือ{" "}
                  <strong className="text-slate-800 font-bold">฿{money(summary.cashProfit)}</strong>
                </span>
              ) : (
                <span>คำนวณตามรายจ่ายจริง</span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 4: Projects Status */}
        <div className="p-3.5 sm:p-4 flex flex-col justify-between hover:bg-slate-50/50 transition">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/80 shadow-2xs">
                <FolderKanban className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase truncate">
                สถานะโครงการ
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
              รวม {summary.activeProjects + summary.completeProjects} โครงการ
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-slate-800">กำลังทำ</span>
              </div>
              <span className="text-base font-black text-emerald-800">{summary.activeProjects}</span>
            </div>
            <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-xs font-black text-slate-800">เสร็จสิ้น</span>
              </div>
              <span className="text-base font-black text-slate-800">{summary.completeProjects}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE GRID: LEFT (COST CODES & PROJECTS), RIGHT (ACTION DOCK) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 items-start">
        {/* LEFT COLUMN: Modern Cost Distribution & Active Projects Health */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-2.5 sm:gap-3 min-w-0">
          {/* ========================================================================= */}
          {/* SECTION A: COST DISTRIBUTION BAR (หมวดควบคุมงบ หรือ 4 COST CODES)         */}
          {/* ========================================================================= */}
          <section className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow-2xs ${
                    costBreakdownTab === "paid"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {costGroupMode === "budget-control" ? <Sliders className="w-4 h-4" /> : <PieChart className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-tight flex items-center gap-1.5">
                    <span>{costGroupMode === "budget-control" ? "สัดส่วนต้นทุนตามหมวดควบคุมงบ" : "สัดส่วนต้นทุนตามโครงสร้าง Cost Code"}</span>
                  </h2>
                  <p className="text-[11px] font-medium text-slate-600">
                    {costGroupMode === "budget-control"
                      ? "แบ่งตาม 2 หมวดควบคุมงบหลัก: หมวดค่าของ (รวม 100 & 500) และ หมวดค่าแรง (รวม 200 & 300)"
                      : "แบ่งตาม 4 หมวดหลัก (100 ค่าของ, 200 ค่าแรง, 300 พนักงาน, 500 เครื่องจักร/ยานพาหนะ)"}
                  </p>
                </div>
              </div>

              {/* Controls: Mode Switcher (ควบคุมงบ vs Cost Code) + Paid/Pending Switcher */}
              <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto">
                {/* Mode Switcher */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setCostGroupMode("budget-control")}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                      costGroupMode === "budget-control"
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Sliders size={12} className={costGroupMode === "budget-control" ? "text-indigo-600" : ""} />
                    <span>แบ่งตามควบคุมงบ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostGroupMode("cost-code")}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                      costGroupMode === "cost-code"
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <PieChart size={12} className={costGroupMode === "cost-code" ? "text-indigo-600" : ""} />
                    <span>4 Cost Codes</span>
                  </button>
                </div>

                {/* Segmented Paid vs Pending Switcher */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setCostBreakdownTab("paid")}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      costBreakdownTab === "paid"
                        ? "bg-white text-indigo-950 shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Wallet size={12} />
                    <span>เบิกจ่ายจริง (฿{money(summary.cashPaid)})</span>
                  </button>
                  {summary.pendingAP > 0 && (
                    <button
                      type="button"
                      onClick={() => setCostBreakdownTab("pending")}
                      className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        costBreakdownTab === "pending"
                          ? "bg-amber-100 text-amber-950 shadow-2xs border border-amber-300"
                          : "text-amber-800 hover:text-amber-950"
                      }`}
                    >
                      <Clock3 size={12} />
                      <span>ยอดรอเบิก (฿{money(summary.pendingAP)})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Visual Precision Progress Bar */}
            <div className="w-full h-5 rounded-lg overflow-hidden flex bg-slate-100 border border-slate-200 p-0.5 gap-0.5 shadow-2xs">
              {costGroupMode === "budget-control" ? (
                budgetControlBreakdownData.some((c) => c.amount > 0) ? (
                  budgetControlBreakdownData
                    .filter((c) => c.amount > 0)
                    .map((item) => (
                      <div
                        key={item.key}
                        className={`h-full rounded-sm ${item.color} transition-all duration-300 flex items-center justify-center overflow-hidden`}
                        style={{ width: `${Math.max(4, item.percent)}%` }}
                        title={`${item.name}: ${item.percent.toFixed(1)}% (฿${money(item.amount)})`}
                      >
                        {item.percent >= 8 && (
                          <span className="text-[10px] font-black text-white px-1 truncate select-none">
                            {item.name}: {item.percent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-semibold">
                    ยังไม่มีรายการค่าใช้จ่าย
                  </div>
                )
              ) : (
                costBreakdownData.some((c) => c.amount > 0) ? (
                  costBreakdownData
                    .filter((c) => c.amount > 0)
                    .map((item) => (
                      <div
                        key={item.code}
                        className={`h-full rounded-sm ${item.color} transition-all duration-300 flex items-center justify-center overflow-hidden`}
                        style={{ width: `${Math.max(4, item.percent)}%` }}
                        title={`${item.name}: ${item.percent.toFixed(1)}% (฿${money(item.amount)})`}
                      >
                        {item.percent >= 10 && (
                          <span className="text-[10px] font-black text-white px-1 truncate select-none">
                            {item.percent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-semibold">
                    ยังไม่มีรายการค่าใช้จ่าย
                  </div>
                )
              )}
            </div>

            {/* CARDS DISPLAY */}
            {costGroupMode === "budget-control" ? (
              /* 2 BUDGET CONTROL CARDS (Material vs Labor) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                {budgetControlBreakdownData.map((item) => {
                  const Icon = item.icon;
                  const hasBudget = item.totalBudget > 0;
                  const remaining = item.totalBudget - item.totalAmt;
                  const budgetPercent = hasBudget ? Math.round((item.totalAmt / item.totalBudget) * 100) : 0;

                  return (
                    <div
                      key={item.key}
                      className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/90 shadow-2xs hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${item.badgeBg}`}>
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-black text-slate-950 tracking-tight truncate">{item.name}</div>
                              <div className="text-[11px] font-medium text-slate-500 truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          <span className={`text-xs font-black shrink-0 px-2 py-0.5 rounded-md ${item.badgeBg}`}>
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>

                        {/* Amount & Sub-details */}
                        <div className="mt-2.5 flex items-baseline justify-between gap-2">
                          <div>
                            <div className="text-xl font-black text-slate-900 tracking-tight">
                              ฿{money(item.amount)}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>จ่ายแล้ว: <strong className="text-slate-700">{money(item.paidAmt)}</strong></span>
                              <span>·</span>
                              {item.pendingAmt > 0 ? (
                                <span className="text-amber-700 font-bold">
                                  รอเบิก ฿{money(item.pendingAmt)}
                                </span>
                              ) : (
                                <span className="text-emerald-700">ไม่มีค้างเบิก</span>
                              )}
                            </div>
                          </div>

                          {/* Budget Cap Comparison */}
                          {hasBudget && (
                            <div className="text-right shrink-0">
                              <div className="text-[10px] text-slate-400 font-medium">
                                งบควบคุมรวม: ฿{money(item.totalBudget)}
                              </div>
                              <div className={`text-xs font-bold ${remaining < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                                {remaining < 0 ? `เกินงบ ฿${money(Math.abs(remaining))}` : `คงเหลือ ฿${money(remaining)}`}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sub-item Pills */}
                      <div className="pt-2 border-t border-slate-200/70 grid grid-cols-2 gap-2 text-xs">
                        {item.subItems.map((sub) => (
                          <div key={sub.label} className="bg-white/80 p-2 rounded-lg border border-slate-200/80">
                            <div className="text-[10px] text-slate-500 truncate">{sub.label}</div>
                            <div className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                              ฿{money(sub.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 4 COST CODE CARDS (100, 200, 300, 500) */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 pt-1">
                {costBreakdownData.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.code}
                      className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/90 shadow-2xs hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${item.badgeBg}`}
                          >
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-slate-950 tracking-tight truncate">{item.name}</div>
                            <div className="text-[11px] font-medium text-slate-500 truncate">{item.subtitle}</div>
                          </div>
                        </div>
                        <span className={`text-[11px] font-black shrink-0 ${item.textColor}`}>
                          {item.percent.toFixed(1)}%
                        </span>
                      </div>

                      <div className="pt-1 border-t border-slate-200/60">
                        <div className="text-base font-black text-slate-900 tracking-tight">
                          ฿{money(item.amount)}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                          <span>จ่ายแล้ว: ฿{money(item.paidAmt)}</span>
                          {item.pendingAmt > 0 && (
                            <span className="text-amber-700 font-bold">
                              รอเบิก ฿{money(item.pendingAmt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ========================================================================= */}
          {/* SECTION B: ACTIVE PROJECTS BUDGET HEALTH TABLE                            */}
          {/* ========================================================================= */}
          <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
            {/* Header with Project Health Filter Tabs */}
            <div className="p-3 sm:px-4 sm:py-3 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Building2 size={15} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-tight">
                    สถานะคุมงบประมาณโครงการที่กำลังทำอยู่ (ACTIVE PROJECTS)
                  </h2>
                  <p className="text-[11px] font-medium text-slate-600">
                    ติดตามยอดใช้จ่ายเทียบงบประมาณ และเตือนโครงการที่ใกล้เต็มหรือเกินงบ
                  </p>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-200 text-xs shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setProjectFilterTab("all")}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    projectFilterTab === "all"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ทั้งหมด ({hydratedActiveProjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectFilterTab("warning")}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                    projectFilterTab === "warning"
                      ? "bg-amber-100 text-amber-900 shadow-2xs"
                      : "text-amber-700 hover:text-amber-900"
                  }`}
                >
                  <AlertTriangle size={12} />
                  <span>ใกล้เต็ม</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProjectFilterTab("over")}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                    projectFilterTab === "over"
                      ? "bg-rose-100 text-rose-900 shadow-2xs"
                      : "text-rose-700 hover:text-rose-900"
                  }`}
                >
                  <AlertCircle size={12} />
                  <span>เกินงบ</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-black border-b border-slate-200">
                    <th className="py-2.5 px-3 border-r border-slate-200">โครงการ / ลูกค้า</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">งบประมาณ (฿)</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">เบิกสะสมรวม (฿)</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 text-right">คงเหลือ (฿)</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 w-36 text-center">คุมงบ (% ใช้ไป)</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
                  {displayedProjects.length > 0 ? (
                    displayedProjects.map((proj) => {
                      const pId = String(proj["ID Project"] || proj.id || "").trim();
                      const pName = String(proj["ชื่อ Project"] || proj.name || "").trim();
                      const cusName = String(proj["ชื่อลูกค้า"] || proj.customer_name || "-").trim();
                      const spent = toNumber(proj["รวม ALL"]);
                      const budgetCap = toNumber(proj["งบไม่เกิน"] || proj["ยอดงาน"]);
                      const remaining = budgetCap - spent;
                      const percent = budgetCap > 0 ? Math.min(999, Math.round((spent / budgetCap) * 100)) : 0;
                      const isOver = remaining < 0;
                      const isWarning = !isOver && percent >= 80;

                      return (
                        <tr key={pId} className="hover:bg-slate-50/90 transition group">
                          {/* Project Name */}
                          <td className="py-2.5 px-3 border-r border-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 truncate">
                                  <span className="text-slate-400 font-mono text-[11px]">#{pId}</span>
                                  <span className="truncate">{pName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  ลูกค้า: {cusName}
                                </div>
                              </div>
                              <Link
                                href={`/bills?search=${encodeURIComponent(pId)}`}
                                title="ดูบิลทั้งหมดในโครงการนี้"
                                className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition opacity-0 group-hover:opacity-100 shrink-0"
                              >
                                <ExternalLink size={13} />
                              </Link>
                            </div>
                          </td>

                          {/* Budget Cap */}
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-semibold text-slate-800">
                            ฿{money(budgetCap)}
                          </td>

                          {/* Spent */}
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-slate-900">
                            <div>฿{money(spent)}</div>
                            {toNumber(proj["หนี้สินรอจ่าย"]) > 0 && (
                              <div className="text-[10px] text-amber-700 font-medium">
                                (รอเบิก ฿{money(toNumber(proj["หนี้สินรอจ่าย"]))})
                              </div>
                            )}
                          </td>

                          {/* Remaining */}
                          <td
                            className={`py-2.5 px-3 border-r border-slate-200 text-right font-black ${
                              isOver ? "text-rose-600" : "text-emerald-700"
                            }`}
                          >
                            {isOver ? `-฿${money(Math.abs(remaining))}` : `฿${money(remaining)}`}
                          </td>

                          {/* Progress */}
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/80">
                                <div
                                  className={`h-full rounded-full ${
                                    isOver
                                      ? "bg-rose-500"
                                      : isWarning
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(100, percent)}%` }}
                                />
                              </div>
                              <span
                                className={`text-[11px] font-black w-9 text-right shrink-0 ${
                                  isOver ? "text-rose-700" : isWarning ? "text-amber-700" : "text-slate-700"
                                }`}
                              >
                                {percent}%
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 text-center">
                            {isOver ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertCircle size={11} />
                                <span>เกินงบ</span>
                              </span>
                            ) : isWarning ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertTriangle size={11} />
                                <span>ใกล้เต็ม</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 size={11} />
                                <span>ปกติ</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        ไม่พบโครงการที่ตรงกับเงื่อนไข
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>แสดงทั้งหมด {displayedProjects.length} โครงการที่กำลังดำเนินการ</span>
              <Link
                href="/views/project-all"
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 hover:underline"
              >
                <span>ดูสรุปทุกโครงการแบบละเอียด</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </section>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: ACTIONABLE OPERATIONS DOCK                                  */}
        {/* ========================================================================= */}
        <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-2.5 sm:gap-3 min-w-0 lg:sticky lg:top-2 self-start">
          <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
            {/* Dock Header */}
            <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Clock3 className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-tight truncate">
                  งานที่ต้องติดตาม / จัดการ
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 shrink-0">
                {summary.pendingWithdrawCount +
                  pettyCashStats.unclearedCount +
                  summary.creditCount +
                  summary.vatFollowCount +
                  summary.naturalDeductCount}{" "}
                รายการ
              </span>
            </div>

            <div className="p-3 flex flex-col gap-2.5">
              {/* 1. Pending Withdraw Alert */}
              <Link
                href="/withdraw-request"
                className={`p-3 rounded-xl border transition-all active:scale-[0.99] group flex items-center justify-between ${
                  summary.pendingWithdrawCount > 0
                    ? "bg-amber-50/90 border-amber-300 shadow-2xs hover:bg-amber-100/80"
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      summary.pendingWithdrawCount > 0
                        ? "bg-amber-200 text-amber-900 border-amber-400/80"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Clock3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-950 text-xs sm:text-sm font-black truncate">บิลรอตั้งเบิก / รอจ่าย</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {summary.pendingWithdrawCount > 0
                        ? `฿${money(summary.pendingAP)} (ยังไม่ได้โอน)`
                        : "ไม่มีบิลค้างเบิก"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      summary.pendingWithdrawCount > 0
                        ? "bg-amber-200 text-amber-950 font-sans"
                        : "bg-slate-100 text-slate-500 font-sans"
                    }`}
                  >
                    {summary.pendingWithdrawCount}
                  </span>
                </div>
              </Link>

              {/* 2. Petty Cash Uncleared Tracker */}
              <Link
                href="/petty-cash"
                className={`p-3 rounded-xl border transition-all active:scale-[0.99] group flex items-center justify-between ${
                  pettyCashStats.unclearedCount > 0
                    ? "bg-amber-50/90 border-amber-300 shadow-2xs hover:bg-amber-100/80"
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      pettyCashStats.unclearedCount > 0
                        ? "bg-amber-200 text-amber-900 border-amber-400/80"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-950 text-xs sm:text-sm font-black truncate flex items-center gap-1.5">
                      <span>เงินสดย่อยค้างเคลียร์</span>
                      {pettyCashStats.unclearedCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 font-semibold">
                          ถือเงินสด
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {pettyCashStats.unclearedCount > 0
                        ? `฿${money(pettyCashStats.totalUnclearedAmount)} (ค้างส่งบิล)`
                        : "เคลียร์บิลครบทุกรายการแล้ว"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      pettyCashStats.unclearedCount > 0
                        ? "bg-amber-200 text-amber-950 font-sans"
                        : "bg-slate-100 text-slate-500 font-sans"
                    }`}
                  >
                    {pettyCashStats.unclearedCount} รายการ
                  </span>
                </div>
              </Link>

              {/* 2. Credit Bills Follow */}
              <Link
                href="/bill-follow?tab=credit"
                className={`p-3 rounded-xl border transition-all active:scale-[0.99] group flex items-center justify-between ${
                  summary.creditCount > 0
                    ? "bg-white border-amber-300/80 shadow-2xs hover:border-amber-500"
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      summary.creditCount > 0
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-950 text-xs sm:text-sm font-black truncate">ตามบิลเครดิต (รอจ่าย)</div>
                    <div className="text-[11px] text-slate-500 truncate">บิลเครดิตที่ยังไม่ได้ลงวันจ่าย</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      summary.creditCount > 0
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {summary.creditCount} บิล
                  </span>
                </div>
              </Link>

              {/* 3. VAT Follow */}
              <Link
                href="/bill-follow?tab=vat"
                className={`p-3 rounded-xl border transition-all active:scale-[0.99] group flex items-center justify-between ${
                  summary.vatFollowCount > 0
                    ? "bg-white border-sky-300/80 shadow-2xs hover:border-sky-500"
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      summary.vatFollowCount > 0
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-950 text-xs sm:text-sm font-black truncate">ตาม VAT (รอได้บิล)</div>
                    <div className="text-[11px] text-slate-500 truncate">บิลภาษีที่ยังไม่ได้ใบเสร็จ</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      summary.vatFollowCount > 0
                        ? "bg-sky-100 text-sky-900"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {summary.vatFollowCount} บิล
                  </span>
                </div>
              </Link>

              {/* 4. Natural WHT 3% Follow */}
              <Link
                href="/bill-follow?tab=natural"
                className={`p-3 rounded-xl border transition-all active:scale-[0.99] group flex items-center justify-between ${
                  summary.naturalDeductCount > 0
                    ? "bg-white border-purple-300/80 shadow-2xs hover:border-purple-500"
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                      summary.naturalDeductCount > 0
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-950 text-xs sm:text-sm font-black truncate">ตาม หัก 3% บุคคล</div>
                    <div className="text-[11px] text-slate-500 truncate">ค่าแรงช่าง / บุคคลธรรมดา</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      summary.naturalDeductCount > 0
                        ? "bg-purple-100 text-purple-900"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {summary.naturalDeductCount} บิล
                  </span>
                </div>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Modern Summary Calculator
// ----------------------------------------------------------------------------
function buildModernSummary(dataRows: SheetRow[], projectRows: SheetRow[]) {
  const cashFlow = computeCashFlowBreakdown(dataRows);
  const total = cashFlow.totalCommitted;
  const cashPaid = cashFlow.actualPaid;
  const pendingAP = cashFlow.pendingPayables;

  const paidBills = dataRows.filter(isPaidBill);
  const pendingBills = dataRows.filter((r) => isCommittedBill(r) && !isPaidBill(r));
  const paidCount = paidBills.length;
  const pendingCount = pendingBills.length;

  // Project revenue
  const revenue = projectRows.reduce((sum, row) => {
    const vatTotal = toNumber(row["ยอดรวม vat"] || row["ยอดรวม VAT"]);
    if (vatTotal > 0) return sum + vatTotal;
    const workAmt = toNumber(row["ยอดงาน"]);
    if (workAmt > 0) return sum + workAmt * 1.07;
    return sum;
  }, 0);

  const profit = revenue - total;
  const profitPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  const cashProfit = revenue - cashPaid;

  const activeProjects = projectRows.filter(
    (row) => lower(row.color) === "red" || lower(row.color) === "green" || lower(row["สถานะ"]).includes("ทำ")
  ).length;
  const completeProjects = projectRows.filter(
    (row) => lower(row.color) === "black" || lower(row["สถานะ"]).includes("เสร็จ")
  ).length;

  // Follow-up counts
  const pendingWithdrawCount = dataRows.filter((r) => {
    const st = String(r["สถานะ"] || "").trim().toLowerCase();
    return st.includes("รอตั้งเบิก") || st.includes("ตั้งเบิก") || st.includes("รออนุมัติ");
  }).length;

  const creditCount = dataRows.filter((r) => isCreditActive(r["เครดิต"]) && !hasValue(r["วันจ่าย"])).length;
  const vatFollowCount = dataRows.filter((r) => isVatActive(r.vat) && !hasValue(r["วันได้บิล"])).length;
  const naturalDeductCount = dataRows.filter(
    (r) =>
      isDeductActive(r["หัก"]) &&
      !hasValue(r["วันออก 3%"]) &&
      !String(r["statusค่าแรง"] || "").includes("บริษัท")
  ).length;

  // 4 Cost Code buckets
  const cost100 = { paid: 0, pending: 0, total: 0 };
  const cost200 = { paid: 0, pending: 0, total: 0 };
  const cost300 = { paid: 0, pending: 0, total: 0 };
  const cost500 = { paid: 0, pending: 0, total: 0 };

  for (const b of dataRows) {
    if (!isCommittedBill(b)) continue;
    const isPaid = isPaidBill(b);
    const bAmt = toNumber(b["ยอดเงิน"]);
    const vType = String(b["ร้านค้า/ผู้รับเหมา"] || b.vendor_type || "").trim();

    // Line items inspection
    let items: any[] = [];
    if (typeof b.line_items === "string" && b.line_items.trim().startsWith("[")) {
      try {
        items = JSON.parse(b.line_items);
      } catch {}
    } else if (Array.isArray(b.line_items)) {
      items = b.line_items;
    }

    if (items.length > 0) {
      for (const it of items) {
        const amt = toNumber(it.amount ?? it.price ?? 0);
        const cat = String(it.categoryType || it.category || it.type || "").trim();
        const code = classifyExpenseItem(cat, vType);
        if (code === "100") isPaid ? (cost100.paid += amt) : (cost100.pending += amt);
        else if (code === "200") isPaid ? (cost200.paid += amt) : (cost200.pending += amt);
        else if (code === "300") isPaid ? (cost300.paid += amt) : (cost300.pending += amt);
        else if (code === "500") isPaid ? (cost500.paid += amt) : (cost500.pending += amt);
      }
    } else {
      const cat = String(b["ประเภท"] || b["สินค้า"] || "").trim();
      const code = classifyExpenseItem(cat, vType);
      if (code === "100") isPaid ? (cost100.paid += bAmt) : (cost100.pending += bAmt);
      else if (code === "200") isPaid ? (cost200.paid += bAmt) : (cost200.pending += bAmt);
      else if (code === "300") isPaid ? (cost300.paid += bAmt) : (cost300.pending += bAmt);
      else if (code === "500") isPaid ? (cost500.paid += bAmt) : (cost500.pending += bAmt);
    }
  }

  cost100.total = cost100.paid + cost100.pending;
  cost200.total = cost200.paid + cost200.pending;
  cost300.total = cost300.paid + cost300.pending;
  cost500.total = cost500.paid + cost500.pending;

  return {
    cashPaid,
    pendingAP,
    total,
    revenue,
    profit,
    profitPercent,
    cashProfit,
    paidCount,
    pendingCount,
    activeProjects,
    completeProjects,
    projectCount: projectRows.length,
    pendingWithdrawCount,
    creditCount,
    vatFollowCount,
    naturalDeductCount,
    cost100,
    cost200,
    cost300,
    cost500,
  };
}

// ----------------------------------------------------------------------------
// Date Helpers
// ----------------------------------------------------------------------------
function filterRowsByDate(rows: SheetRow[], range: { from?: Date; to?: Date } | null, dateColumns: string[]) {
  if (!range || (!range.from && !range.to)) return rows;
  return rows.filter((row) => {
    const rawDate = firstValue(row, dateColumns);
    const date = parseDateCell(rawDate);
    if (!date) return true;
    if (range.from && date < range.from) return false;
    if (range.to && date > range.to) return false;
    return true;
  });
}

function toLocalYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRange(preset: Preset, from: string, to: string) {
  if (preset === "all") return null;
  const now = new Date();

  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (preset === "yesterday") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (preset === "previousMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  const fromDate = parseInputDate(from);
  const toDate = parseInputDate(to);
  if (toDate) toDate.setHours(23, 59, 59, 999);
  return { from: fromDate || undefined, to: toDate || undefined };
}

function parseInputDate(value: string) {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function parseDateCell(value: unknown) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const dmMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const month = Number(dmMatch[2]) - 1;
    const rawYear = Number(dmMatch[3]);
    const year = rawYear > 2400 ? rawYear - 543 : rawYear;
    return new Date(year, month, day);
  }

  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function firstValue(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    if (hasValue(row[column])) return row[column];
  }
  return "";
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function lower(value: unknown) {
  return String(value || "").toLowerCase();
}
