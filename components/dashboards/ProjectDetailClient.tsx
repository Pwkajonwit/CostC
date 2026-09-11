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
  CheckCircle2
} from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { ProjectDetailEditor } from "@/components/forms/ProjectDetailEditor";
import { getProjectColorInfo } from "@/components/dashboards/WorkStatusDashboardClient";
import { money, toNumber } from "@/lib/utils/numbers";
import { isPaidBill } from "@/lib/bills/bill-status";
import type { SheetRow } from "@/lib/types";

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
  summaryRows: SheetRow[];
  expenseBreakdown: Record<string, number>;
  pendingBreakdown?: Record<string, number>;
  detailFields: string[];
  relatedColumns: string[];
  expenseCategories: string[];
};

const PRODUCT_BUDGET_FIELDS: { name: string; field: string }[] = [
  { name: "ปูน/ทราย/หิน", field: "งบไม่เกินปูนทรายหิน" },
  { name: "เหล็กเส้น/รูปพรรณ", field: "งบไม่เกินเหล็กเส้น" },
  { name: "คอนกรีตผสมเสร็จ", field: "งบไม่เกินคอนกรีต" },
  { name: "ไม้แบบ/ไม้อัด", field: "งบไม่เกินไม้แบบ" },
  { name: "วัสดุมุง", field: "งบไม่เกินวัสดุมุง" },
  { name: "ฝ้าผนัง", field: "งบไม่เกินฝ้าผนัง" },
  { name: "ปูพื้น", field: "งบไม่เกินปูพื้น" },
  { name: "กระจก", field: "งบไม่เกินกระจก" },
  { name: "ไฟฟ้า", field: "งบไม่เกินไฟฟ้า" },
  { name: "ประปา", field: "งบไม่เกินประปา" },
  { name: "อื่นๆ(วัสดุ)", field: "งบไม่เกินวัสดุอื่นๆ" },
  { name: "สีเคมี", field: "งบไม่เกินสีเคมี" },
  { name: "สุขภัณฑ์", field: "งบไม่เกินสุขภัณฑ์" },
  { name: "บิวอิน", field: "งบไม่เกินบิวอิน" },
  { name: "แอร์", field: "งบไม่เกินแอร์" },
  { name: "ดิน", field: "งบไม่เกินดิน" },
  { name: "หินทราย", field: "งบไม่เกินหินทราย" },
  { name: "เตรียมงาน", field: "งบไม่เกินเตรียมงาน" },
  { name: "น้ำมัน", field: "งบไม่เกินน้ำมัน" },
  { name: "ค่าขนส่ง", field: "งบไม่เกินค่าขนส่ง" },
  { name: "เครื่องจักร", field: "งบไม่เกินเครื่องจักร" },
  { name: "ดำเนินการ(อื่นๆ)", field: "งบไม่เกินดำเนินการ" },
];

function getProductPillarBadge(name: string) {
  if (name.includes("น้ำมัน")) {
    return <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-50 text-amber-800 border border-amber-200 shrink-0">น้ำมัน</span>;
  }
  if (name.includes("ขนส่ง")) {
    return <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-cyan-50 text-cyan-800 border border-cyan-200 shrink-0">ขนส่ง</span>;
  }
  if (name.includes("เครื่องจักร")) {
    return <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 shrink-0">เครื่องจักร</span>;
  }
  if (name.includes("ดำเนินการ")) {
    return <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">ดำเนินการ</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">ค่าของ</span>;
}

export function ProjectDetailClient({
  projectId,
  projectName,
  hydratedProject,
  customerDisplay,
  companyDisplay,
  totals,
  summaryRows,
  expenseBreakdown,
  pendingBreakdown,
  detailFields,
  relatedColumns,
  expenseCategories,
}: ProjectDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"bills" | "expenses" | "products" | "edit">("bills");

  const colorInfo = getProjectColorInfo(hydratedProject.color);

  // Financial calculations - strictly basing "เบิกจ่ายจริง" on actual paid bills
  const actualPaid = totals.actualPaid ?? 0;
  const pendingAmount = totals.pendingPayables ?? Math.max(0, totals.totalAll - actualPaid);
  const percentUsed = totals.budget > 0 ? Math.min(100, Math.round((actualPaid / totals.budget) * 100)) : 0;
  const remainingBudget = totals.budget > 0 ? totals.budget - actualPaid : 0;

  const customer = customerDisplay || String(hydratedProject["ชื่อลูกค้า"] || hydratedProject["ลูกค้า"] || "-");
  const company = companyDisplay || String(hydratedProject["บริษัท"] || hydratedProject["บริษัทรับงาน"] || "-");
  const owner = String(hydratedProject["รับผิดชอบ"] || "-");
  const date = formatDateThai(hydratedProject["วันที่"]);
  const location = String(hydratedProject["สถานที่"] || "-");

  // Product Budget Control calculations - only count paid bills as "เบิกจ่ายแล้ว"
  const productSpendingMap = useMemo(() => {
    const map: Record<string, { spent: number; count: number; pendingSpent: number; pendingCount: number }> = {};
    summaryRows.forEach(row => {
      const itemRaw = String(row["สินค้า/ทำงาน"] || row["สินค้า"] || row["รายการ"] || "อื่นๆ").trim();
      if (!itemRaw) return;
      const amt = toNumber(row["ยอดเงิน"]);
      const isPaid = isPaidBill(row);
      if (!map[itemRaw]) {
        map[itemRaw] = { spent: 0, count: 0, pendingSpent: 0, pendingCount: 0 };
      }
      if (isPaid) {
        map[itemRaw].spent += amt;
        map[itemRaw].count += 1;
      } else {
        map[itemRaw].pendingSpent += amt;
        map[itemRaw].pendingCount += 1;
      }
    });
    return map;
  }, [summaryRows]);

  const productControlRows = useMemo(() => {
    const list: {
      name: string;
      budget: number;
      spent: number;
      pendingSpent: number;
      billCount: number;
      pendingCount: number;
    }[] = [];

    const processedItemNames = new Set<string>();

    PRODUCT_BUDGET_FIELDS.forEach(p => {
      const budget = toNumber(hydratedProject[p.field]);
      let spent = 0;
      let count = 0;
      let pendingSpent = 0;
      let pendingCount = 0;
      Object.entries(productSpendingMap).forEach(([itemName, data]) => {
        const cleanItem = itemName.replace(/^\d+\s*/, "").trim().toLowerCase();
        const cleanP = p.name.toLowerCase();
        const isMatch = 
          cleanItem === cleanP ||
          itemName.toLowerCase() === cleanP ||
          cleanItem.includes(cleanP) ||
          cleanP.includes(cleanItem);

        if (isMatch) {
          spent += data.spent;
          count += data.count;
          pendingSpent += data.pendingSpent;
          pendingCount += data.pendingCount;
          processedItemNames.add(itemName);
        }
      });
      if (budget > 0 || spent > 0 || pendingSpent > 0) {
        list.push({ name: p.name, budget, spent, pendingSpent, billCount: count, pendingCount });
      }
    });

    Object.entries(productSpendingMap).forEach(([itemName, data]) => {
      if (!processedItemNames.has(itemName)) {
        list.push({
          name: itemName,
          budget: 0,
          spent: data.spent,
          pendingSpent: data.pendingSpent,
          billCount: data.count,
          pendingCount: data.pendingCount
        });
      }
    });

    return list;
  }, [hydratedProject, productSpendingMap]);

  // Main Expense Categories Budget Control calculations (8 Categories)
  const categoryControlRows = useMemo(() => {
    const productBudgetSum = PRODUCT_BUDGET_FIELDS
      .filter(p => p.field !== "งบไม่เกินอื่นๆ")
      .reduce((sum, p) => sum + toNumber(hydratedProject[p.field]), 0);

    return expenseCategories.map(cat => {
      const spent = expenseBreakdown[cat] || 0;
      const pendingSpent = pendingBreakdown?.[cat] || 0;
      let budget = 0;

      if (cat === "ค่าของ") {
        budget = toNumber(hydratedProject["งบไม่เกินค่าของ"]);
        if (budget === 0 && productBudgetSum > 0) {
          budget = productBudgetSum;
        }
      } else if (cat === "ค่าแรง") {
        budget = toNumber(hydratedProject["งบไม่เกินค่าแรง"]);
      } else if (cat === "พนักงาน") {
        budget = toNumber(hydratedProject["งบไม่เกินพนักงาน"]);
      } else if (cat === "น้ำมัน") {
        budget = toNumber(hydratedProject["งบไม่เกินน้ำมัน"]);
      } else if (cat === "ซ่อมรถ") {
        budget = toNumber(hydratedProject["งบไม่เกินซ่อมรถ"]);
      } else if (cat === "เครื่องจักร") {
        budget = toNumber(hydratedProject["งบไม่เกินเครื่องจักร"]);
      } else if (cat === "เครื่องมือ") {
        budget = toNumber(hydratedProject["งบไม่เกินเครื่องมือ"]);
      } else if (cat === "อื่นๆ") {
        budget = toNumber(hydratedProject["งบไม่เกินอื่นๆ"]);
      }

      const paidCount = summaryRows.filter(r => isPaidBill(r) && (toNumber(r[cat]) > 0 || String(r["ประเภท"]).includes(cat))).length;
      const pendingCount = summaryRows.filter(r => !isPaidBill(r) && (toNumber(r[cat]) > 0 || String(r["ประเภท"]).includes(cat))).length;
      const remaining = budget > 0 ? budget - spent : 0;
      const percent = budget > 0 ? Math.min(999, Math.round((spent / budget) * 100)) : 0;
      const isOver = budget > 0 && remaining < 0;

      return {
        name: cat,
        budget,
        spent,
        pendingSpent,
        remaining,
        percent,
        isOver,
        billCount: paidCount,
        pendingCount
      };
    });
  }, [hydratedProject, expenseCategories, expenseBreakdown, pendingBreakdown, summaryRows]);

  const totalAllocatedCategoryBudget = useMemo(() => {
    return categoryControlRows.reduce((sum, r) => sum + r.budget, 0);
  }, [categoryControlRows]);

  const totalCategorySpent = useMemo(() => {
    return categoryControlRows.reduce((sum, r) => sum + r.spent, 0);
  }, [categoryControlRows]);

  return (
    <div className="w-full flex flex-col gap-4 p-4 sm:p-5 max-w-[1400px] mx-auto font-sans text-sm text-slate-800">
      {/* 1. HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/work-status"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft size={14} />
            <span>รายการสถานะงาน</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-700">#{projectId}</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs ${colorInfo.badgeClass}`}
          >
            <span>{colorInfo.label}</span>
          </span>
        </div>
      </div>

      {/* 2. TITLE & META */}
      <div>
        <h1 className="text-lg text-slate-900">{projectName}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          ลูกค้า: <span className="text-slate-700">{customer}</span> · บริษัท: <span className="text-slate-700">{company}</span> · ผู้รับผิดชอบ: <span className="text-slate-700">{owner}</span>
        </p>
      </div>

      {/* 3. FINANCIAL SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="border border-slate-200 rounded-xl md:rounded-md p-3 sm:p-4 bg-white shadow-2xs">
          <div className="text-xs text-slate-400 font-medium mb-0.5">งบประมาณ</div>
          <div className="text-base sm:text-lg text-slate-900 font-bold font-mono">{money(totals.budget)}</div>
        </div>

        <div className="border border-slate-200 rounded-xl md:rounded-md p-3 sm:p-4 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-0.5">
            <span>เบิกจ่ายจริง</span>
            <span className="text-indigo-700 font-mono font-medium">{percentUsed}%</span>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <div className="text-base sm:text-lg text-indigo-700 font-bold font-mono">{money(actualPaid)}</div>
            {pendingAmount > 0 && (
              <span className="text-xs text-amber-600 font-normal">
                (รอเบิก {money(pendingAmount)})
              </span>
            )}
          </div>
          {totals.budget > 0 && (
            <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  percentUsed > 90 ? "bg-rose-500" : percentUsed > 75 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          )}
        </div>

        <div className="border border-slate-200 rounded-xl md:rounded-md p-3 sm:p-4 bg-white shadow-2xs">
          <div className="text-xs text-slate-400 font-medium mb-0.5">ยอดคงเหลือ</div>
          <div className={`text-base sm:text-lg font-bold font-mono ${remainingBudget < 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {money(remainingBudget)}
            {remainingBudget < 0 && <span className="text-xs text-rose-500 ml-1 font-normal font-sans">เกินงบ</span>}
          </div>
        </div>
      </div>

      {/* 4. WORKSPACE TABS (Scrollable on mobile) */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab("bills")}
          className={`px-3 py-2 border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "bills"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          รายการบิลเบิกจ่าย ({totals.billCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("expenses")}
          className={`px-3 py-2 border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "expenses"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          สรุปหมวดหมู่ค่าใช้จ่าย ({categoryControlRows.length} หมวด)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`px-3 py-2 border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "products"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          คุมงบรายสินค้า ({productControlRows.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`px-3 py-2 border-b-2 transition shrink-0 cursor-pointer ${
            activeTab === "edit"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          รายละเอียด & แก้ไขข้อมูล
        </button>
      </div>

      {/* 5. TABBED CONTENT PANELS */}
      {activeTab === "bills" && (
        <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
          <DataTable
            columns={relatedColumns}
            rows={summaryRows}
            limit={100}
            title="รายการบิลเบิกจ่ายที่เกี่ยวข้อง"
            subtitle={`ทั้งหมด ${summaryRows.length} รายการ`}
            showSearch
            detailBasePath="/bills"
            detailKeyColumn="ลำดับ"
            cellFormatters={{
              "ว/ด/ป": (v) => formatDateThai(v),
              "วันที่": (v) => formatDateThai(v),
            }}
          />
        </div>
      )}

      {activeTab === "expenses" && (
        <div className="space-y-4">
          {/* Top Summary Banner for Categories */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-indigo-600" />
                <span>สรุปหมวดหมู่ค่าใช้จ่าย & ค่าควบคุมงบประมาณ (Category Budget Control)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบวงเงินงบประมาณที่ควบคุมไว้กับยอดเบิกจ่ายจริง จำแนกตาม 8 หมวดหมู่หลัก
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <span className="text-slate-500">งบควบคุมรวม: </span>
                <strong className="text-slate-900 font-mono">{money(totalAllocatedCategoryBudget)}</strong>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg">
                <span className="text-indigo-700">เบิกจ่ายจริงรวม: </span>
                <strong className="text-indigo-900 font-mono">{money(totalCategorySpent)}</strong>
              </div>
            </div>
          </div>

          {/* Cards Grid Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {categoryControlRows.map((cat) => {
              return (
                <div
                  key={cat.name}
                  className={`p-3.5 bg-white rounded-xl border transition shadow-2xs space-y-2.5 ${
                    cat.isOver ? "border-rose-200 bg-rose-50/20" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                      {getCategoryIcon(cat.name)}
                      <span>{cat.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {cat.billCount} บิล{cat.pendingCount > 0 ? ` (${cat.pendingCount} รอเบิก)` : ""}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-slate-500">เบิกจ่ายจริง:</span>
                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-indigo-700">{money(cat.spent)}</span>
                        {cat.pendingSpent > 0 && (
                          <div className="text-[10px] text-amber-600 font-normal">
                            (รอเบิก {money(cat.pendingSpent)})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[11px] text-slate-500">ค่าควบคุม:</span>
                      <span className="font-mono text-slate-700 text-xs">
                        {cat.budget > 0 ? money(cat.budget) : <span className="text-slate-400 font-normal">-</span>}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">คงเหลือ:</span>
                      <span className={`font-mono font-semibold text-xs ${cat.isOver ? "text-rose-600" : cat.budget > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                        {cat.budget > 0 ? (
                          <>
                            {money(cat.remaining)} {cat.isOver && <span className="text-[10px] text-rose-500 font-normal">(เกินงบ)</span>}
                          </>
                        ) : "-"}
                      </span>
                    </div>
                  </div>

                  {cat.budget > 0 && (
                    <div className="pt-0.5">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-400 text-[10px]">สัดส่วน</span>
                        <span className={`font-mono text-[11px] font-medium ${cat.isOver ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                          {cat.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            cat.isOver ? "bg-rose-500" : cat.percent > 85 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, cat.percent)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Category vs Control Table */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800">
                ตารางเปรียบเทียบค่าควบคุมและยอดเบิกจ่ายจริง (8 หมวดหมู่หลัก)
              </h3>
              <span className="text-[11px] text-slate-500">
                รวมทั้งหมด {categoryControlRows.length} หมวด
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px]">
                    <th className="py-2.5 px-4 font-semibold">หมวดหมู่ค่าใช้จ่าย</th>
                    <th className="py-2.5 px-4 text-right font-semibold">ค่าควบคุม (งบประมาณ)</th>
                    <th className="py-2.5 px-4 text-right font-semibold">เบิกจ่ายจริง</th>
                    <th className="py-2.5 px-4 text-right font-semibold">ยอดคงเหลือ</th>
                    <th className="py-2.5 px-4 text-center font-semibold">สัดส่วนการใช้งบ</th>
                    <th className="py-2.5 px-4 text-center font-semibold">สถานะ</th>
                    <th className="py-2.5 px-4 text-center font-semibold">จำนวนบิล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categoryControlRows.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4 font-medium text-slate-800 flex items-center gap-2">
                        {getCategoryIcon(cat.name)}
                        <span>{cat.name}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                        {cat.budget > 0 ? money(cat.budget) : <span className="text-slate-400 font-sans text-xs">ไม่ได้ตั้งงบ</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-indigo-700">
                        <div>{money(cat.spent)}</div>
                        {cat.pendingSpent > 0 && (
                          <div className="text-[10px] text-amber-600 font-normal">
                            (รอเบิก {money(cat.pendingSpent)})
                          </div>
                        )}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-semibold ${
                        cat.isOver ? "text-rose-600" : cat.budget > 0 ? "text-emerald-700" : "text-slate-400"
                      }`}>
                        {cat.budget > 0 ? money(cat.remaining) : <span className="text-slate-400 font-sans text-xs">-</span>}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {cat.budget > 0 ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  cat.isOver ? "bg-rose-500" : cat.percent > 85 ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(100, cat.percent)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-mono ${cat.isOver ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                              {cat.percent}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {cat.budget > 0 ? (
                          cat.isOver ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              เกินงบ
                            </span>
                          ) : cat.percent >= 85 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              ใกล้เต็ม
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ปกติ
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[10px]">ทั่วไป</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700">
                          {cat.billCount} บิล
                          {cat.pendingCount > 0 && (
                            <span className="text-amber-600 ml-1">({cat.pendingCount} รอเบิก)</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-xs">
                  <tr>
                    <td className="py-2.5 px-4 text-slate-900">รวมทั้งหมด</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-900">
                      {money(totalAllocatedCategoryBudget)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-indigo-700">
                      {money(totalCategorySpent)}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono ${
                      totalAllocatedCategoryBudget - totalCategorySpent < 0 ? "text-rose-600" : "text-emerald-700"
                    }`}>
                      {money(totalAllocatedCategoryBudget - totalCategorySpent)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-700">
                      {totalAllocatedCategoryBudget > 0
                        ? `${Math.round((totalCategorySpent / totalAllocatedCategoryBudget) * 100)}%`
                        : "-"}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-xs text-slate-800">คุมงบประมาณรายสินค้า / หมวดงาน (Product Budget Control Matrix)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เปรียบเทียบวงเงินจัดสรรรายหมวด กับยอดเงินเบิกจ่ายจริงตามบิล ({productControlRows.length} รายการ)
              </p>
            </div>
            <div className="text-xs text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              รวมเบิกจ่ายแล้ว: <span className="text-indigo-700 font-mono font-semibold">{money(productControlRows.reduce((sum, r) => sum + r.spent, 0))}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-xs">
                  <th className="py-2.5 px-4">รายการสินค้า / หมวดงาน</th>
                  <th className="py-2.5 px-4 text-right">วงเงินงบประมาณ</th>
                  <th className="py-2.5 px-4 text-right">เบิกจ่ายแล้ว</th>
                  <th className="py-2.5 px-4 text-right">คงเหลือวงเงิน</th>
                  <th className="py-2.5 px-4 text-center">สัดส่วนการใช้งบ</th>
                  <th className="py-2.5 px-4 text-center">จำนวนบิล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productControlRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      ยังไม่มีการตั้งวงเงิน หรือเบิกจ่ายสินค้าในโครงการนี้
                    </td>
                  </tr>
                ) : (
                  productControlRows.map((item, idx) => {
                    const remaining = item.budget > 0 ? item.budget - item.spent : 0;
                    const percent = item.budget > 0 ? Math.min(100, Math.round((item.spent / item.budget) * 100)) : 0;
                    const isOver = item.budget > 0 && remaining < 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4 text-slate-800 flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {getProductPillarBadge(item.name)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-600">
                          {item.budget > 0 ? money(item.budget) : <span className="text-slate-400 text-xs">-</span>}
                        </td>
                        <td className="py-2.5 px-4 text-right text-indigo-700 font-mono font-semibold">
                          <div>{money(item.spent)}</div>
                          {item.pendingSpent > 0 && (
                            <div className="text-[10px] text-amber-600 font-normal">
                              (รอเบิก {money(item.pendingSpent)})
                            </div>
                          )}
                        </td>
                        <td className={`py-2.5 px-4 text-right ${isOver ? "text-rose-600" : item.budget > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                          {item.budget > 0 ? money(remaining) : <span className="text-slate-400 text-xs">-</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {item.budget > 0 ? (
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isOver ? "bg-rose-500" : percent > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className={`text-xs ${isOver ? "text-rose-600" : "text-slate-600"}`}>{percent}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">ไม่ได้คุมงบ</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                            {item.billCount} บิล
                            {item.pendingCount > 0 && (
                              <span className="text-amber-600 ml-1">({item.pendingCount} รอเบิก)</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "edit" && (
        <div className="border border-slate-200 rounded-md bg-white p-4">
          <ProjectDetailEditor
            fields={detailFields}
            project={hydratedProject}
            customerDisplay={customer}
            companyDisplay={company}
          />
        </div>
      )}
    </div>
  );
}

function formatDateThai(value: unknown): string {
  const str = String(value || "").trim();
  if (!str) return "-";
  const m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return str;
}

function getCategoryIcon(name: string) {
  switch (name) {
    case "ค่าของ":
      return <Package size={14} className="text-emerald-600 shrink-0" />;
    case "ค่าแรง":
      return <Hammer size={14} className="text-amber-600 shrink-0" />;
    case "พนักงาน":
      return <Users size={14} className="text-indigo-600 shrink-0" />;
    case "น้ำมัน":
      return <Fuel size={14} className="text-cyan-600 shrink-0" />;
    case "ซ่อมรถ":
      return <Wrench size={14} className="text-orange-600 shrink-0" />;
    case "เครื่องจักร":
      return <Truck size={14} className="text-blue-600 shrink-0" />;
    case "เครื่องมือ":
      return <Wrench size={14} className="text-purple-600 shrink-0" />;
    default:
      return <FileText size={14} className="text-slate-500 shrink-0" />;
  }
}


