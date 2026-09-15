"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  PieChart,
  Package,
  Hammer,
  Layers
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";

export type ProjectBudgetAllocatorProps = {
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  defaultExpanded?: boolean;
};

type CategoryItem = {
  code: string;
  field: string;
  label: string;
  group: string;
  icon?: string;
};

// =========================================================================
// 1. หมวดค่าของ (Material Cost Code) - 27 หมวดตามบิล (101-123 และ 501-504)
// =========================================================================
const MATERIAL_ITEMS: CategoryItem[] = [
  { code: "101", field: "งบไม่เกินเตรียมงาน", label: "101. เตรียมงาน", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "🚜" },
  { code: "102", field: "งบไม่เกินหินทราย", label: "102. ดิน/ทราย/หิน", group: "หมวดงานโครงสร้าง", icon: "🪨" },
  { code: "103", field: "งบไม่เกินเสาเข็ม", label: "103. เสาเข็ม", group: "หมวดงานโครงสร้าง", icon: "🏗️" },
  { code: "104", field: "งบไม่เกินเหล็กเส้น", label: "104. เหล็กเส้น", group: "หมวดงานโครงสร้าง", icon: "🏗️" },
  { code: "105", field: "งบไม่เกินไม้แบบ", label: "105. ไม้แบบค้ำยัน", group: "หมวดงานโครงสร้าง", icon: "🪵" },
  { code: "106", field: "งบไม่เกินคอนกรีต", label: "106. คอนกรีตผสมเสร็จ", group: "หมวดงานโครงสร้าง", icon: "🚚" },
  { code: "107", field: "งบไม่เกินรูปพรรณ", label: "107. เหล็กรูปพรรณ", group: "หมวดงานโครงสร้าง", icon: "📐" },
  { code: "108", field: "งบไม่เกินวัสดุมุง", label: "108. วัสดุหลังคา", group: "หมวดงานโครงสร้าง", icon: "🏠" },
  { code: "109", field: "งบไม่เกินก่อฉาบ", label: "109. ก่อฉาบ", group: "หมวดงานโครงสร้าง", icon: "🧱" },
  { code: "110", field: "งบไม่เกินฝ้าผนัง", label: "110. ฝ้าเพดาน", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🖼️" },
  { code: "111", field: "งบไม่เกินปูพื้น", label: "111. ผิวพื้นผนัง", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🏁" },
  { code: "112", field: "งบไม่เกินกระจก", label: "112. ประตูหน้าต่าง", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🪟" },
  { code: "113", field: "งบไม่เกินสีเคมี", label: "113. ทาสี", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🎨" },
  { code: "114", field: "งบไม่เกินสุขภัณฑ์", label: "114. สุขภัณฑ์", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🚽" },
  { code: "115", field: "งบไม่เกินประปา", label: "115. ระบบประปา", group: "หมวดงานระบบ M&E", icon: "💧" },
  { code: "116", field: "งบไม่เกินไฟฟ้า", label: "116. ระบบไฟฟ้า", group: "หมวดงานระบบ M&E", icon: "⚡" },
  { code: "117", field: "งบไม่เกินแอร์", label: "117. ระบบปรับอากาศ", group: "หมวดงานระบบ M&E", icon: "❄️" },
  { code: "118", field: "งบไม่เกินบิวอิน", label: "118. ตบแต่งภายใน", group: "หมวดงานตกแต่ง & ภูมิทัศน์", icon: "🛋️" },
  { code: "119", field: "งบไม่เกินเฟอร์นิเจอร์", label: "119. เฟอร์นิเจอร์", group: "หมวดงานตกแต่ง & ภูมิทัศน์", icon: "🪑" },
  { code: "120", field: "งบไม่เกินภูมิทัศน์", label: "120. ภูมิทัศน์", group: "หมวดงานตกแต่ง & ภูมิทัศน์", icon: "🌳" },
  { code: "121", field: "งบไม่เกินแก้ไขเก็บงาน", label: "121. แก้ไขเก็บงาน", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "🔧" },
  { code: "122", field: "งบไม่เกินตั้งนั่งร้าน", label: "122. ตั้งนั่งร้าน", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "🪜" },
  { code: "123", field: "งบไม่เกินดำเนินการ", label: "123. ดำเนินการ(อื่นๆ)", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "📁" },
  { code: "501", field: "งบไม่เกินน้ำมัน", label: "501. น้ำมัน", group: "หมวดงานยานพาหนะ & เครื่องมือ", icon: "⛽" },
  { code: "502", field: "งบไม่เกินซ่อมรถ", label: "502. ซ่อมรถ", group: "หมวดงานยานพาหนะ & เครื่องมือ", icon: "🚗" },
  { code: "503", field: "งบไม่เกินเครื่องจักร", label: "503. เครื่องจักร", group: "หมวดงานยานพาหนะ & เครื่องมือ", icon: "🏗️" },
  { code: "504", field: "งบไม่เกินเครื่องมือ", label: "504. เครื่องมือ", group: "หมวดงานยานพาหนะ & เครื่องมือ", icon: "🛠️" },
];

// =========================================================================
// 2. หมวดค่าแรง (Labor Cost Code) - 24 หมวดตามบิล (201-223 + 301 พนักงาน)
// =========================================================================
const LABOR_SUB_ITEMS: CategoryItem[] = [
  { code: "201", field: "งบไม่เกินค่าแรง_201", label: "201. เตรียมงาน", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "🚜" },
  { code: "202", field: "งบไม่เกินค่าแรง_202", label: "202. ดิน/ทราย/หิน", group: "หมวดงานโครงสร้าง", icon: "🪨" },
  { code: "203", field: "งบไม่เกินค่าแรง_203", label: "203. เสาเข็ม", group: "หมวดงานโครงสร้าง", icon: "🏗️" },
  { code: "204", field: "งบไม่เกินค่าแรง_204", label: "204. เหล็กเส้น", group: "หมวดงานโครงสร้าง", icon: "🏗️" },
  { code: "205", field: "งบไม่เกินค่าแรง_205", label: "205. ไม้แบบค้ำยัน", group: "หมวดงานโครงสร้าง", icon: "🪵" },
  { code: "206", field: "งบไม่เกินค่าแรง_206", label: "206. คอนกรีตผสมเสร็จ", group: "หมวดงานโครงสร้าง", icon: "🚚" },
  { code: "207", field: "งบไม่เกินค่าแรง_207", label: "207. เหล็กรูปพรรณ", group: "หมวดงานโครงสร้าง", icon: "📐" },
  { code: "208", field: "งบไม่เกินค่าแรง_208", label: "208. วัสดุหลังคา", group: "หมวดงานโครงสร้าง", icon: "🏠" },
  { code: "209", field: "งบไม่เกินค่าแรง_209", label: "209. ก่อฉาบ", group: "หมวดงานโครงสร้าง", icon: "🧱" },
  { code: "210", field: "งบไม่เกินค่าแรง_210", label: "210. ฝ้าเพดาน", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🖼️" },
  { code: "211", field: "งบไม่เกินค่าแรง_211", label: "211. ผิวพื้นผนัง", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🏁" },
  { code: "212", field: "งบไม่เกินค่าแรง_212", label: "212. ประตูหน้าต่าง", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🪟" },
  { code: "213", field: "งบไม่เกินค่าแรง_213", label: "213. ทาสี", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🎨" },
  { code: "214", field: "งบไม่เกินค่าแรง_214", label: "214. สุขภัณฑ์", group: "หมวดงานสถาปัตยกรรม & ปูผิว", icon: "🚽" },
  { code: "215", field: "งบไม่เกินค่าแรง_215", label: "215. ระบบประปา", group: "หมวดงานระบบ M&E", icon: "💧" },
  { code: "216", field: "งบไม่เกินค่าแรง_216", label: "216. ระบบไฟฟ้า", group: "หมวดงานระบบ M&E", icon: "⚡" },
  { code: "217", field: "งบไม่เกินค่าแรง_217", label: "217. ระบบปรับอากาศ", group: "หมวดงานระบบ M&E", icon: "❄️" },
  { code: "218", field: "งบไม่เกินค่าแรง_218", label: "218. ตบแต่งภายใน", group: "หมวดงานตกแต่ง & ภูมิทัศน์", icon: "🛋️" },
  { code: "219", field: "งบไม่เกินค่าแรง_219", label: "219. เฟอร์นิเจอร์", group: "หมวดงานตกแต่ง & ภูมิทัศน์", icon: "🪑" },
  { code: "220", field: "งบไม่เกินค่าแรง_220", label: "220. ภูมิทัศน์", group: "หมวดงานตกแต่ง & ภูมิทัศน์", icon: "🌳" },
  { code: "221", field: "งบไม่เกินค่าแรง_221", label: "221. แก้ไขเก็บงาน", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "🔧" },
  { code: "222", field: "งบไม่เกินค่าแรง_222", label: "222. ตั้งนั่งร้าน", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "🪜" },
  { code: "223", field: "งบไม่เกินค่าแรง_223", label: "223. ค่าบริการ(อื่นๆ)", group: "หมวดงานเตรียมงาน & ดำเนินการ", icon: "📁" },
  { code: "301", field: "งบไม่เกินพนักงาน", label: "301. พนักงาน (ช่างประจำ/ไซต์งาน)", group: "หมวดงานบุคลากร", icon: "👥" },
];

export function ProjectBudgetAllocator({
  values,
  onChange,
  defaultExpanded = false
}: ProjectBudgetAllocatorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // States for Material Sub-items (27 items)
  const [showMaterialSubItems, setShowMaterialSubItems] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  // States for Labor Sub-items (24 items including staff)
  const [showLaborSubItems, setShowLaborSubItems] = useState(false);
  const [laborSearch, setLaborSearch] = useState("");

  const workAmount = toNumber(values["ยอดงาน"]);
  const budgetCap = toNumber(values["งบไม่เกิน"]);
  const totalProjectBudget = budgetCap > 0 ? budgetCap : (workAmount > 0 ? workAmount : 0);

  // Helper for material item values with legacy fallbacks
  function getMaterialVal(item: CategoryItem): string {
    if (values[item.field] !== undefined && values[item.field] !== "") {
      return String(values[item.field]);
    }
    if (item.code === "102" && values["งบไม่เกินดิน"]) return String(values["งบไม่เกินดิน"]);
    if (item.code === "109" && values["งบไม่เกินปูนทรายหิน"]) return String(values["งบไม่เกินปูนทรายหิน"]);
    if (item.code === "112" && values["งบไม่เกินประตูหน้าต่าง"]) return String(values["งบไม่เกินประตูหน้าต่าง"]);
    if ((item.code === "118" || item.code === "119") && values["งบไม่เกินตบแต่งภายใน"]) return String(values["งบไม่เกินตบแต่งภายใน"]);
    if (item.code === "123" && values["งบไม่เกินอื่นๆ"]) return String(values["งบไม่เกินอื่นๆ"]);
    if (item.code === "121" && values["งบไม่เกินวัสดุอื่นๆ"]) return String(values["งบไม่เกินวัสดุอื่นๆ"]);

    if (values.data && typeof values.data === "object") {
      if (values.data[item.field] !== undefined && values.data[item.field] !== "") {
        return String(values.data[item.field]);
      }
    }
    return "";
  }

  // Helper for labor item values (including 301 staff)
  function getLaborVal(item: CategoryItem): string {
    if (values[item.field] !== undefined && values[item.field] !== "") {
      return String(values[item.field]);
    }
    if (values.data && typeof values.data === "object") {
      if (values.data[item.field] !== undefined && values.data[item.field] !== "") {
        return String(values.data[item.field]);
      }
    }
    return "";
  }

  // 1. Material Sub-total (27 items)
  const materialSubTotal = useMemo(() => {
    return MATERIAL_ITEMS.reduce((sum, item) => sum + toNumber(getMaterialVal(item)), 0);
  }, [values]);

  const rawMaterialCap = toNumber(values["งบไม่เกินค่าของ"]);
  const materialBudget = Math.max(rawMaterialCap, materialSubTotal);

  // 2. Labor Sub-total (24 items including staff)
  const laborSubTotal = useMemo(() => {
    return LABOR_SUB_ITEMS.reduce((sum, item) => sum + toNumber(getLaborVal(item)), 0);
  }, [values]);

  const rawLaborCap = toNumber(values["งบไม่เกินค่าแรง"]);
  const staffCap = toNumber(values["งบไม่เกินพนักงาน"]);
  // Include staff budget in labor budget
  const laborBudget = Math.max(rawLaborCap, laborSubTotal, (rawLaborCap + staffCap));

  // Total allocated (2 main groups: ค่าของ + ค่าแรง)
  const totalAllocated = materialBudget + laborBudget;
  const remainingBudget = totalProjectBudget - totalAllocated;
  const allocatedPercent = totalProjectBudget > 0 ? (totalAllocated / totalProjectBudget) * 100 : 0;
  const remainingPercent = totalProjectBudget > 0 ? (remainingBudget / totalProjectBudget) * 100 : 0;

  // Counts of items with budgets
  const materialItemsWithBudgetCount = useMemo(() => {
    return MATERIAL_ITEMS.filter(item => toNumber(getMaterialVal(item)) > 0).length;
  }, [values]);

  const laborItemsWithBudgetCount = useMemo(() => {
    return LABOR_SUB_ITEMS.filter(item => toNumber(getLaborVal(item)) > 0).length;
  }, [values]);

  // Filtered lists (Flat by search only, no work group filtering)
  const filteredMaterialItems = useMemo(() => {
    const q = materialSearch.toLowerCase().trim();
    if (!q) return MATERIAL_ITEMS;
    return MATERIAL_ITEMS.filter(item => item.label.toLowerCase().includes(q) || item.code.includes(q));
  }, [materialSearch]);

  const filteredLaborItems = useMemo(() => {
    const q = laborSearch.toLowerCase().trim();
    if (!q) return LABOR_SUB_ITEMS;
    return LABOR_SUB_ITEMS.filter(item => item.label.toLowerCase().includes(q) || item.code.includes(q));
  }, [laborSearch]);

  // Handler for Material Sub-item Changes
  function handleMaterialItemChange(field: string, val: string) {
    onChange(field, val);

    const nextValNum = toNumber(val);
    let newSum = 0;
    MATERIAL_ITEMS.forEach(item => {
      if (item.field === field) {
        newSum += nextValNum;
      } else {
        newSum += toNumber(getMaterialVal(item));
      }
    });

    onChange("งบไม่เกินค่าของ", newSum > 0 ? String(newSum) : "");
  }

  // Handler for Labor Sub-item Changes (including 301 staff)
  function handleLaborItemChange(field: string, val: string) {
    onChange(field, val);

    const nextValNum = toNumber(val);
    let newSum = 0;
    LABOR_SUB_ITEMS.forEach(item => {
      if (item.field === field) {
        newSum += nextValNum;
      } else {
        newSum += toNumber(getLaborVal(item));
      }
    });

    onChange("งบไม่เกินค่าแรง", newSum > 0 ? String(newSum) : "");
  }

  return (
    <div className="col-span-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all shadow-2xs my-2 font-sans">
      {/* Accordion Toggle Header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between transition border-b border-slate-200/80 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300">
            <PieChart size={16} />
          </div>
          <div className="text-left">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>จัดสรรงบประมาณโครงการ</span>
              {totalAllocated > 0 && (
                <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full font-semibold">
                  จัดสรรแล้ว {money(totalAllocated)} ฿ ({allocatedPercent.toFixed(1)}%)
                </span>
              )}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 font-medium">
          <span>{expanded ? "ซ่อนรายละเอียด" : "ตั้งค่างบประมาณ"}</span>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-4 space-y-4 bg-slate-50/70">
          {/* Top Bar: KPI Summary (2 Main Categories) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="shrink-0">
              <span className="text-xs font-bold text-slate-900">
                สรุปการจัดสรรงบประมาณ
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs flex-wrap">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-right">
                <span className="text-[10px] text-slate-400 block font-medium">งบรวมโครงการ</span>
                <span className="text-slate-900 font-bold text-xs">{money(totalProjectBudget)} ฿</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 text-right">
                <span className="text-[10px] text-emerald-700 block font-medium">1. รวมงบค่าของ (27 หมวด)</span>
                <span className="text-emerald-900 font-bold text-xs">{money(materialBudget)} ฿</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 text-right">
                <span className="text-[10px] text-indigo-700 block font-medium">2. รวมงบค่าแรง & บุคลากร (24 หมวด)</span>
                <span className="text-indigo-900 font-bold text-xs">{money(laborBudget)} ฿</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-right">
                <span className="text-[10px] text-slate-400 block font-medium">จัดสรรแล้ว</span>
                <span className="text-slate-900 font-bold text-xs">
                  {money(totalAllocated)} ฿ <span className="text-slate-500 font-normal text-[10px]">({allocatedPercent.toFixed(1)}%)</span>
                </span>
              </div>
              <div className={`rounded-lg px-2.5 py-1 text-right border ${remainingBudget < 0 ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-emerald-50/50 border-emerald-200 text-emerald-800"}`}>
                <span className="text-[10px] block font-medium opacity-80">คงเหลือจัดสรร</span>
                <span className="font-bold text-xs">
                  {money(remainingBudget)} ฿ <span className="font-normal text-[10px]">({remainingPercent.toFixed(1)}%)</span>
                </span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* หมวดใหญ่ที่ 1: 📦 หมวดค่าของ (Material Cost Code) 27 รายการ */}
          {/* ======================================================== */}
          <div className="bg-white border-2 border-emerald-300 rounded-xl p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300 shrink-0">
                  <Package size={18} />
                </div>
                <div className="min-w-0">
                  <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>1. หมวดค่าของ & เครื่องมือยานพาหนะ</span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                      {MATERIAL_ITEMS.length} หมวดตามบิล
                    </span>
                  </h5>
                </div>
              </div>

              {/* Box แสดงยอดรวมค่าของ */}
              <div className="flex items-center gap-2.5 bg-emerald-50/90 px-3.5 py-2 rounded-xl border border-emerald-300 shrink-0">
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-950">รวมงบค่าของ:</span>
                </div>
                <div className="flex items-center gap-1 w-36">
                  <input
                    type="number"
                    value={rawMaterialCap > 0 ? rawMaterialCap : (materialSubTotal > 0 ? materialSubTotal : "")}
                    onChange={e => onChange("งบไม่เกินค่าของ", e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-emerald-400 focus:border-emerald-600 rounded-lg px-2.5 py-1 text-sm text-right font-bold text-emerald-950 focus:outline-none shadow-2xs"
                  />
                  <span className="text-xs font-bold text-emerald-800">฿</span>
                </div>
              </div>
            </div>

            {/* Sub-items Toggle Control Bar */}
            <button
              type="button"
              onClick={() => setShowMaterialSubItems(prev => !prev)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition cursor-pointer ${
                showMaterialSubItems
                  ? "bg-slate-100/90 hover:bg-slate-200/80 border-slate-300 text-slate-700"
                  : "bg-emerald-50/60 hover:bg-emerald-100/70 border-dashed border-emerald-300 text-emerald-900 shadow-2xs"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg transition ${showMaterialSubItems ? "bg-slate-200 text-slate-700" : "bg-emerald-200 text-emerald-800"}`}>
                  <Layers size={15} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold flex items-center gap-2 flex-wrap">
                    <span>แจกแจงรายหมวดตามบิล ({MATERIAL_ITEMS.length} หมวด)</span>
                    {materialItemsWithBudgetCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold">
                        กำหนดแล้ว {materialItemsWithBudgetCount} หมวด ({money(materialSubTotal)} ฿)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition shrink-0 ${
                showMaterialSubItems
                  ? "bg-white text-slate-700 border-slate-300 shadow-2xs hover:bg-slate-50"
                  : "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-2xs"
              }`}>
                <span>{showMaterialSubItems ? "ยุบหมวดย่อย" : "ขยายดูรายหมวด"}</span>
                {showMaterialSubItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {/* Grid 27 รายการสินค้า (แสดงเมื่อกดขยาย) */}
            {showMaterialSubItems && (
              <div className="space-y-3 pt-1">
                {/* Search Bar for Material */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between text-xs pb-1">
                  <span className="text-xs text-slate-500 font-medium">
                    หมวดค่าของทั้งหมด ({MATERIAL_ITEMS.length} รายการ)
                  </span>

                  <div className="w-full sm:w-56">
                    <input
                      type="text"
                      value={materialSearch}
                      onChange={e => setMaterialSearch(e.target.value)}
                      placeholder="🔍 ค้นหาหมวดค่าของ..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredMaterialItems.map((item) => {
                    const val = getMaterialVal(item);
                    const numVal = toNumber(val);
                    const hasVal = numVal > 0;

                    return (
                      <div
                        key={item.code}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 shadow-2xs ${
                          hasVal
                            ? "bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-200"
                            : "bg-slate-50/80 hover:bg-white border-slate-200 hover:border-emerald-300"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            {item.icon && <span className="text-sm">{item.icon}</span>}
                            <span
                              className={`text-xs block leading-snug break-words ${
                                hasVal ? "font-bold text-emerald-950" : "font-semibold text-slate-800"
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>

                          {hasVal && materialBudget > 0 && (
                            <span className="text-[10px] text-emerald-700 font-medium block">
                              {((numVal / materialBudget) * 100).toFixed(1)}% ของค่าของ
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 w-28 sm:w-32">
                          <input
                            type="number"
                            value={val}
                            onChange={e => handleMaterialItemChange(item.field, e.target.value)}
                            placeholder="0.00"
                            className={`w-full rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none transition ${
                              hasVal
                                ? "bg-white border border-emerald-400 font-bold text-emerald-950 focus:border-emerald-600 shadow-2xs"
                                : "bg-white border border-slate-200 text-slate-800 focus:border-emerald-500"
                            }`}
                          />
                          <span className="text-xs text-slate-400">฿</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowMaterialSubItems(false)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition border border-slate-200 cursor-pointer shadow-2xs"
                  >
                    <ChevronUp size={13} />
                    <span>ยุบรายการสินค้าย่อย</span>
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* ======================================================== */}
          {/* หมวดใหญ่ที่ 2: 👷 หมวดค่าแรง & บุคลากร (Labor Cost Code) */}
          {/* รวมทั้ง 201-223 และ 301 พนักงาน (24 หมวดตามบิล) */}
          {/* ======================================================== */}
          <div className="bg-white border-2 border-indigo-300 rounded-xl p-4 shadow-2xs space-y-3.5">
            {/* Header: รวมงบค่าแรง */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl border border-indigo-300 shrink-0">
                  <Hammer size={18} />
                </div>
                <div className="min-w-0">
                  <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>2. หมวดค่าแรง & บุคลากร (Labor Cost Code)</span>
                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-semibold">
                      {LABOR_SUB_ITEMS.length} หมวดตามบิล (รวมพนักงาน)
                    </span>
                  </h5>
                </div>
              </div>

              {/* Box แสดงยอดรวมค่าแรง */}
              <div className="flex items-center gap-2.5 bg-indigo-50/90 px-3.5 py-2 rounded-xl border border-indigo-300 shrink-0">
                <div className="text-right">
                  <span className="text-xs font-bold text-indigo-950">รวมงบค่าแรง:</span>
                </div>
                <div className="flex items-center gap-1 w-36">
                  <input
                    type="number"
                    value={rawLaborCap > 0 ? rawLaborCap : (laborSubTotal > 0 ? laborSubTotal : "")}
                    onChange={e => onChange("งบไม่เกินค่าแรง", e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-indigo-400 focus:border-indigo-600 rounded-lg px-2.5 py-1 text-sm text-right font-bold text-indigo-950 focus:outline-none shadow-2xs"
                  />
                  <span className="text-xs font-bold text-indigo-800">฿</span>
                </div>
              </div>
            </div>

            {/* Sub-items Toggle Control Bar for Labor */}
            <button
              type="button"
              onClick={() => setShowLaborSubItems(prev => !prev)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition cursor-pointer ${
                showLaborSubItems
                  ? "bg-slate-100/90 hover:bg-slate-200/80 border-slate-300 text-slate-700"
                  : "bg-indigo-50/60 hover:bg-indigo-100/70 border-dashed border-indigo-300 text-indigo-900 shadow-2xs"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg transition ${showLaborSubItems ? "bg-slate-200 text-slate-700" : "bg-indigo-200 text-indigo-800"}`}>
                  <Layers size={15} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold flex items-center gap-2 flex-wrap">
                    <span>แจกแจงรายหมวดตามบิล ({LABOR_SUB_ITEMS.length} หมวด รวมพนักงาน)</span>
                    {laborItemsWithBudgetCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-semibold">
                        กำหนดแล้ว {laborItemsWithBudgetCount} หมวด ({money(laborSubTotal)} ฿)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition shrink-0 ${
                showLaborSubItems
                  ? "bg-white text-slate-700 border-slate-300 shadow-2xs hover:bg-slate-50"
                  : "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-2xs"
              }`}>
                <span>{showLaborSubItems ? "ยุบหมวดย่อย" : "ขยายดูรายหมวด"}</span>
                {showLaborSubItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {/* Grid 24 รายการค่าแรง (แสดงเมื่อกดขยาย) */}
            {showLaborSubItems && (
              <div className="space-y-3 pt-1">
                {/* Search Bar for Labor */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between text-xs pb-1">
                  <span className="text-xs text-slate-500 font-medium">
                    หมวดค่าแรงทั้งหมด ({LABOR_SUB_ITEMS.length} รายการ รวมพนักงาน)
                  </span>

                  <div className="w-full sm:w-56">
                    <input
                      type="text"
                      value={laborSearch}
                      onChange={e => setLaborSearch(e.target.value)}
                      placeholder="🔍 ค้นหาหมวดค่าแรง..."
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredLaborItems.map((item) => {
                    const val = getLaborVal(item);
                    const numVal = toNumber(val);
                    const hasVal = numVal > 0;
                    const isStaff = item.code === "301";

                    return (
                      <div
                        key={item.code}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 shadow-2xs ${
                          hasVal
                            ? isStaff
                              ? "bg-purple-50/90 border-purple-400 ring-1 ring-purple-200"
                              : "bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-200"
                            : isStaff
                              ? "bg-purple-50/40 hover:bg-white border-purple-200 hover:border-purple-400"
                              : "bg-slate-50/80 hover:bg-white border-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            {item.icon && <span className="text-sm">{item.icon}</span>}
                            <span
                              className={`text-xs block leading-snug break-words ${
                                hasVal
                                  ? isStaff ? "font-bold text-purple-950" : "font-bold text-indigo-950"
                                  : isStaff ? "font-bold text-purple-900" : "font-semibold text-slate-800"
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>

                          {hasVal && laborBudget > 0 && (
                            <span className={`text-[10px] font-medium block ${isStaff ? "text-purple-700" : "text-indigo-700"}`}>
                              {((numVal / laborBudget) * 100).toFixed(1)}% ของค่าแรง
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 w-28 sm:w-32">
                          <input
                            type="number"
                            value={val}
                            onChange={e => handleLaborItemChange(item.field, e.target.value)}
                            placeholder="0.00"
                            className={`w-full rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none transition ${
                              hasVal
                                ? isStaff
                                  ? "bg-white border border-purple-400 font-bold text-purple-950 focus:border-purple-600 shadow-2xs"
                                  : "bg-white border border-indigo-400 font-bold text-indigo-950 focus:border-indigo-600 shadow-2xs"
                                : "bg-white border border-slate-200 text-slate-800 focus:border-indigo-500"
                            }`}
                          />
                          <span className="text-xs text-slate-400">฿</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLaborSubItems(false)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition border border-slate-200 cursor-pointer shadow-2xs"
                  >
                    <ChevronUp size={13} />
                    <span>ยุบรายการหมวดย่อยค่าแรง</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
