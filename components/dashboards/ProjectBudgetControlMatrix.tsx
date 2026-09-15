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

export type ProjectBudgetControlMatrixProps = {
  projectRows: SheetRow[];
  dataRows: SheetRow[];
  selectedProjectId: string;
  onSelectProject?: (projId: string) => void;
};

type CategoryConfig = {
  field: string;
  label: string;
  group: string;
  icon?: string;
  matchKeys: string[];
};

type ViewMode = "all" | "chart" | "table";

const DEFAULT_CATEGORY_MAP: CategoryConfig[] = [
  { field: "งบไม่เกินปูนทรายหิน", label: "1. ปูน/ทราย/หิน", group: "หมวดงานโครงสร้าง", icon: "🧱", matchKeys: ["1", "ปูน/ทราย/หิน", "ปูนซีเมนต์"] },
  { field: "งบไม่เกินเหล็กเส้น", label: "2. เหล็กเส้น/รูปพรรณ", group: "หมวดงานโครงสร้าง", icon: "🏗️", matchKeys: ["2", "เหล็กเส้น/รูปพรรณ", "เหล็กเส้น", "รูปพรรณ"] },
  { field: "งบไม่เกินคอนกรีต", label: "3. คอนกรีตผสมเสร็จ", group: "หมวดงานโครงสร้าง", icon: "🚚", matchKeys: ["3", "คอนกรีตผสมเสร็จ", "คอนกรีต"] },
  { field: "งบไม่เกินไม้แบบ", label: "4. ไม้แบบ/ไม้อัด", group: "หมวดงานโครงสร้าง", icon: "🪵", matchKeys: ["4", "ไม้แบบ/ไม้อัด", "ไม้แบบ", "ไม้อัด"] },

  { field: "งบไม่เกินวัสดุมุง", label: "5. วัสดุมุง", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", icon: "🏠", matchKeys: ["5", "วัสดุมุง"] },
  { field: "งบไม่เกินฝ้าผนัง", label: "6. ฝ้าผนัง", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", icon: "🖼️", matchKeys: ["6", "ฝ้าผนัง"] },
  { field: "งบไม่เกินปูพื้น", label: "7. ปูพื้น", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", icon: "🏁", matchKeys: ["7", "ปูพื้น"] },
  { field: "งบไม่เกินกระจก", label: "8. กระจก", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", icon: "🪟", matchKeys: ["8", "กระจก"] },
  { field: "งบไม่เกินสีเคมี", label: "12. สีเคมี", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", icon: "🎨", matchKeys: ["12", "สีเคมี"] },
  { field: "งบไม่เกินสุขภัณฑ์", label: "13. สุขภัณฑ์", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", icon: "🚽", matchKeys: ["13", "สุขภัณฑ์"] },
  { field: "งบไม่เกินบิวอิน", label: "14. บิวอิน", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", icon: "🛋️", matchKeys: ["14", "บิวอิน", "นั่งร้าน"] },

  { field: "งบไม่เกินไฟฟ้า", label: "9. ไฟฟ้า", group: "หมวดงานระบบ M&E", icon: "⚡", matchKeys: ["9", "ไฟฟ้า"] },
  { field: "งบไม่เกินประปา", label: "10. ประปา", group: "หมวดงานระบบ M&E", icon: "𚗰", matchKeys: ["10", "ประปา"] },
  { field: "งบไม่เกินแอร์", label: "15. แอร์", group: "หมวดงานระบบ M&E", icon: "❄️", matchKeys: ["15", "แอร์"] },

  { field: "งบไม่เกินดิน", label: "16. ดิน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", icon: "🌱", matchKeys: ["16", "ดิน"] },
  { field: "งบไม่เกินหินทราย", label: "17. หินทราย", group: "หมวดงานเตรียมดิน & โลจิสติกส์", icon: "🪨", matchKeys: ["17", "หินทราย"] },
  { field: "งบไม่เกินเตรียมงาน", label: "18. เตรียมงาน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", icon: "🚜", matchKeys: ["18", "เตรียมงาน"] },
  { field: "งบไม่เกินน้ำมัน", label: "501. น้ำมันเชื้อเพลิง", group: "หมวดงานเตรียมดิน & โลจิสติกส์", icon: "⛽", matchKeys: ["501", "101", "4.น้ำมัน", "น้ำมัน"] },
  { field: "งบไม่เกินค่าขนส่ง", label: "505. ค่าขนส่ง", group: "หมวดงานเตรียมดิน & โลจิสติกส์", icon: "🚚", matchKeys: ["505", "102", "ขนส่ง", "ค่าขนส่ง"] },
  { field: "งบไม่เกินเครื่องจักร", label: "503. เครื่องจักร", group: "หมวดงานเตรียมดิน & โลจิสติกส์", icon: "🏗️", matchKeys: ["503", "103", "6.เครื่องจักร", "เครื่องจักร"] },
  { field: "งบไม่เกินซ่อมรถ", label: "502. ซ่อมรถ", group: "หมวดงานเตรียมดิน & โลจิสติกส์", icon: "🚗", matchKeys: ["502", "104", "5.ซ่อมรถ", "ซ่อมรถ"] },

  { field: "งบไม่เกินวัสดุอื่นๆ", label: "119. อื่นๆ(วัสดุ)", group: "หมวดงานทั่วไป & ดำเนินการ", icon: "📦", matchKeys: ["119", "11", "อื่นๆ(วัสดุ)"] },
  { field: "งบไม่เกินดำเนินการ", label: "อื่นๆ / ดำเนินการ", group: "หมวดงานทั่วไป & ดำเนินการ", icon: "📁", matchKeys: ["200", "ดำเนินการ(อื่นๆ)", "ดำเนินการ", "อื่นๆ"] },

  { field: "งบไม่เกินค่าของ", label: "หมวด 100 ค่าของ (ภาพรวม)", group: "ภาพรวมต้นทุนโครงการ", icon: "📦", matchKeys: ["100", "1.ค่าของ", "ค่าของ"] },
  { field: "งบไม่เกินค่าแรง", label: "หมวด 200 ค่าแรง (ภาพรวม)", group: "ภาพรวมต้นทุนโครงการ", icon: "👷", matchKeys: ["200", "2.ค่าแรง", "ค่าแรง"] },
  { field: "งบไม่เกินพนักงาน", label: "หมวด 300 พนักงาน", group: "หมวดงานทั่วไป & ดำเนินการ", icon: "👥", matchKeys: ["300", "3.พนักงาน", "พนักงาน"] },
  { field: "งบไม่เกินเครื่องมือ", label: "504. เครื่องมือช่าง", group: "หมวดงานทั่วไป & ดำเนินการ", icon: "🔨", matchKeys: ["504", "7.เครื่องมือ", "เครื่องมือ"] },
];


export function ProjectBudgetControlMatrix({
  projectRows,
  dataRows,
  selectedProjectId,
  onSelectProject
}: ProjectBudgetControlMatrixProps) {
  const [categoryMap, setCategoryMap] = useState<CategoryConfig[]>(DEFAULT_CATEGORY_MAP);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [drilldownModal, setDrilldownModal] = useState<{ title: string; rows: SheetRow[] } | null>(null);

  // Dynamically load options from /api/system-options
  useEffect(() => {
    async function loadMasterOptions() {
      try {
        const res = await fetch("/api/system-options");
        const json = await res.json();
        if (json.success && json.options && Array.isArray(json.options["PRODUCT_MASTER_DATA"])) {
          const masterList = json.options["PRODUCT_MASTER_DATA"];
          const dynamicMap: CategoryConfig[] = masterList.map((item: any) => {
            const code = item.code || "";
            const name = item.name || "";
            const group = (item.group || "").replace(/^[\p{Emoji}\s]+/gu, "").trim() || "หมวดงานทั่วไป & ดำเนินการ";
            const fieldName = `งบไม่เกิน${name.replace(/อื่นๆ\(วัสดุ\)/, "อื่นๆ").replace(/เหล็กรูปพรรณ/, "รูปพรรณ").replace(/[^a-zA-Z0-9ก-๙]/g, "")}`;
            return {
              field: fieldName,
              label: `${code ? code + ". " : ""}${name}`,
              group,
              matchKeys: [code, name]
            };
          });

          const fullMap = [
            { field: "งบไม่เกินค่าของ", label: "หมวด 100 ค่าของ (ภาพรวม)", group: "ภาพรวมต้นทุนโครงการ", icon: "📦", matchKeys: ["100", "1.ค่าของ", "ค่าของ"] },
            { field: "งบไม่เกินค่าแรง", label: "หมวด 200 ค่าแรง (ภาพรวม)", group: "ภาพรวมต้นทุนโครงการ", icon: "👷", matchKeys: ["200", "2.ค่าแรง", "ค่าแรง"] },
            ...dynamicMap
          ];

          const seen = new Set<string>();
          const cleanMap = fullMap.filter(c => {
            if (seen.has(c.field)) return false;
            seen.add(c.field);
            return true;
          });
          setCategoryMap(cleanMap);
        }
      } catch (err) {
        console.error("Failed to load master options for budget matrix:", err);
      }
    }
    loadMasterOptions();
  }, []);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all") return null;
    return projectRows.find(p => String(p["ID Project"] || "").trim() === selectedProjectId) || null;
  }, [projectRows, selectedProjectId]);

  const projectBills = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all") return dataRows;
    return dataRows.filter(b => String(b["ID Project"] || "").trim() === selectedProjectId);
  }, [dataRows, selectedProjectId]);

  const categoryAnalysis = useMemo(() => {
    return categoryMap.map((cat) => {
      const budgetCap = selectedProject ? toNumber(selectedProject[cat.field]) : 0;

      const matchingBills = projectBills.filter((b) => {
        const prod = String(b["สินค้า"] || b["สินค้า/ทำงาน"] || "").trim().toLowerCase();
        const typeCat = String(b["ประเภท"] || "").trim().toLowerCase();
        const cleanProd = prod.replace(/^\d+\s*/, "").trim();

        // Macro category checks
        if (cat.field === "งบไม่เกินค่าของ") {
          return isMaterialCost(typeCat) || (!typeCat && prod) || toNumber(b["ค่าของ"]) > 0;
        }
        if (cat.field === "งบไม่เกินค่าแรง") {
          return isLaborCost(typeCat) || toNumber(b["ค่าแรง"]) > 0;
        }
        if (cat.field === "งบไม่เกินพนักงาน") {
          return isStaffCost(typeCat) || toNumber(b["พนักงาน"]) > 0;
        }

        return cat.matchKeys.some(key => {
          if (!key) return false;
          const k = key.toLowerCase().trim();

          // Numeric code prefix (e.g. "1", "101")
          if (/^\d+$/.test(k)) {
            return prod.startsWith(`${k} `) || prod.startsWith(`${k}.`) || prod === k;
          }

          // Exact or clean name match
          if (cleanProd === k || prod === k) return true;

          // Word containment
          return cleanProd.includes(k) || typeCat === k;
        });
      });

      const paidMatchingBills = matchingBills.filter(isPaidBill);
      const pendingMatchingBills = matchingBills.filter((b) => !isPaidBill(b) && isCommittedBill(b));

      const actualSpent = paidMatchingBills.reduce((sum, b) => sum + getRowTransferAmount(b), 0);
      const pendingSpent = pendingMatchingBills.reduce((sum, b) => sum + getRowTransferAmount(b), 0);
      const remaining = budgetCap > 0 ? budgetCap - actualSpent : 0;
      const usagePercent = budgetCap > 0 ? Number(((actualSpent / budgetCap) * 100).toFixed(1)) : 0;
      const isOver = budgetCap > 0 && actualSpent > budgetCap;
      const isWarning = budgetCap > 0 && !isOver && (usagePercent >= 85 || (actualSpent + pendingSpent) > budgetCap);

      return {
        ...cat,
        budgetCap,
        actualSpent,
        pendingSpent,
        remaining,
        usagePercent,
        isOver,
        isWarning,
        matchingBills,
        paidMatchingBills,
        pendingMatchingBills,
      };
    }).filter(c => c.budgetCap > 0 || c.actualSpent > 0 || c.pendingSpent > 0);
  }, [selectedProject, projectBills, categoryMap]);

  const filteredCategoryAnalysis = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return categoryAnalysis;
    return categoryAnalysis.filter(
      c => c.label.toLowerCase().includes(query) || c.group.toLowerCase().includes(query)
    );
  }, [categoryAnalysis, searchTerm]);

  const categoryComparisonStats = useMemo(() => {
    return categoryAnalysis
      .filter(c => c.budgetCap > 0 || c.actualSpent > 0)
      .slice(0, 15)
      .map((cat) => {
        const capSum = cat.budgetCap;
        const spentSum = cat.actualSpent;
        const usagePercent = capSum > 0 ? Number(((spentSum / capSum) * 100).toFixed(1)) : 0;
        const isOver = capSum > 0 && spentSum > capSum;
        const isWarning = capSum > 0 && !isOver && usagePercent >= 85;
        const totalBills = cat.matchingBills.length;

        return {
          title: cat.label,
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
      .filter(c => c.actualSpent > 0)
      .sort((a, b) => b.actualSpent - a.actualSpent)
      .slice(0, 5);
  }, [categoryAnalysis]);

  const riskAlertCategories = useMemo(() => {
    return categoryAnalysis.filter(c => c.isOver || c.isWarning);
  }, [categoryAnalysis]);

  const totalProjectCap = selectedProject ? toNumber(selectedProject["งบไม่เกิน"] || selectedProject["ยอดงาน"]) : 0;
  const totalCategoryCapAllocated = categoryAnalysis.reduce((sum, c) => sum + c.budgetCap, 0);
  const paidProjectBills = useMemo(() => projectBills.filter(isPaidBill), [projectBills]);
  const pendingProjectBills = useMemo(() => projectBills.filter(b => !isPaidBill(b) && isCommittedBill(b)), [projectBills]);
  const totalActualSpent = useMemo(() => paidProjectBills.reduce((sum, b) => sum + getRowTransferAmount(b), 0), [paidProjectBills]);
  const totalPendingSpent = useMemo(() => pendingProjectBills.reduce((sum, b) => sum + getRowTransferAmount(b), 0), [pendingProjectBills]);
  const overallUsagePercent = totalProjectCap > 0 ? Number(((totalActualSpent / totalProjectCap) * 100).toFixed(1)) : 0;

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
                <span>ตารางคุมงบประมาณรายหมวดสินค้า (Category Budget Control Matrix)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">
                ตารางสรุปวงเงิน Cap vs เบิกจริง พร้อมสถานะความเสี่ยงรายสินค้า
              </p>
            </div>

            {/* Category Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาหมวดสินค้า..."
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 w-full sm:w-60"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px] border border-slate-200 rounded-md">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-slate-900 text-white font-normal sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-3.5 font-normal">หมวดสินค้า / ประเภทงาน</th>
                  <th className="py-3 px-3.5 text-right font-normal">วงเงินคุมงบ (Cap)</th>
                  <th className="py-3 px-3.5 text-right text-emerald-300 font-normal">จ่ายจริง (Actual)</th>
                  <th className="py-3 px-3.5 text-right font-normal">งบคงเหลือ / เกินงบ</th>
                  <th className="py-3 px-3.5 text-center w-40 font-normal">สัดส่วนการใช้วงเงิน</th>
                  <th className="py-3 px-3.5 text-center font-normal">สถานะ</th>
                  <th className="py-3 px-3.5 text-center font-normal">ดูรายการบิล</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-900 bg-white font-normal">
                {filteredCategoryAnalysis.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-normal">
                      ไม่พบข้อมูลหมวดสินค้าที่ตรงกับคำค้นหา "{searchTerm}"
                    </td>
                  </tr>
                ) : (
                  filteredCategoryAnalysis.map((cat, idx) => (
                    <tr key={`${cat.field}-${idx}`} className="hover:bg-slate-50 transition border-b border-slate-100">
                      {/* Category Label */}
                      <td className="py-2.5 px-3.5 font-normal text-slate-900 flex items-center gap-2 pl-4">
                        <span>{cat.icon || "📦"}</span> <span>{cat.label}</span>
                      </td>

                          {/* Budget Cap */}
                          <td className="py-2.5 px-3.5 text-right font-normal text-slate-900">
                            {cat.budgetCap > 0 ? `${money(cat.budgetCap)} ฿` : "-"}
                          </td>

                          {/* Actual Spend */}
                          <td className="py-2.5 px-3.5 text-right font-normal text-emerald-800">
                            <div>{cat.actualSpent > 0 ? `${money(cat.actualSpent)} ฿` : "0 ฿"}</div>
                            {cat.pendingSpent > 0 && (
                              <div className="text-[10px] text-amber-600 font-normal">
                                (รอเบิก {money(cat.pendingSpent)} ฿)
                              </div>
                            )}
                          </td>

                          {/* Remaining / Over */}
                          <td
                            className={`py-2.5 px-3.5 text-right font-normal ${cat.isOver ? "text-rose-700" : cat.remaining > 0 ? "text-cyan-800" : "text-slate-500"
                              }`}
                          >
                            {cat.budgetCap > 0
                              ? cat.remaining < 0
                                ? `เกินงบ ${money(Math.abs(cat.remaining))} ฿`
                                : `เหลือ ${money(cat.remaining)} ฿`
                              : "-"}
                          </td>

                          {/* Progress Bar */}
                          <td className="py-2.5 px-3.5 align-middle">
                            {cat.budgetCap > 0 ? (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-800 font-normal">
                                  <span>{cat.usagePercent}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-300">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${cat.isOver ? "bg-rose-600" : cat.isWarning ? "bg-amber-500" : "bg-emerald-600"
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
                          <td className="py-2.5 px-3.5 text-center">
                            {cat.budgetCap === 0 ? (
                              <span className="text-xs font-normal text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full">ทั่วไป</span>
                            ) : cat.isOver ? (
                              <span className="text-xs font-normal bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-0.5 rounded-full inline-flex items-center justify-center gap-1">
                                <AlertCircle size={13} /> เกินงบ
                              </span>
                            ) : cat.isWarning ? (
                              <span className="text-xs font-normal bg-amber-100 text-amber-950 border border-amber-300 px-2.5 py-0.5 rounded-full inline-flex items-center justify-center gap-1">
                                <AlertTriangle size={13} /> เฝ้าระวัง
                              </span>
                            ) : (
                              <span className="text-xs font-normal bg-emerald-100 text-emerald-950 border border-emerald-300 px-2.5 py-0.5 rounded-full inline-flex items-center justify-center gap-1">
                                <CheckCircle2 size={13} /> ปกติ
                              </span>
                            )}
                          </td>

                          {/* Drilldown Action */}
                          <td className="py-2.5 px-3.5 text-center">
                            {cat.matchingBills.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setDrilldownModal({
                                    title: `รายการบิลเบิกจ่ายหมวด "${cat.label}" (${cat.matchingBills.length} รายการ)`,
                                    rows: cat.matchingBills
                                  })
                                }
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-normal rounded-md border border-slate-300 transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-xs"
                              >
                                <span>{cat.matchingBills.length} บิล</span>
                                <ChevronRight size={13} />
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                  ))
                )}
              </tbody>
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
