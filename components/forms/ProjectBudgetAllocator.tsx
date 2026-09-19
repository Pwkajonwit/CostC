"use client";

import { useMemo, useState } from "react";
import {
  Package,
  Hammer,
  Search,
  Filter,
  Layers,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
  PenLine,
  Eye,
  EyeOff,
  Check
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

// 1. หมวดค่าของ (Material Cost Code) - 27 หมวดตามบิล (101-123 และ 501-504)
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

// 2. หมวดค่าแรง (Labor Cost Code) - 24 หมวดตามบิล (201-223 + 301 พนักงาน)
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
  // Collapsible sub-allocation section state (defaults to false/hidden)
  const [showSubAllocations, setShowSubAllocations] = useState(defaultExpanded ?? false);

  const [activeTab, setActiveTab] = useState<"split" | "material" | "labor">("split");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyAllocated, setOnlyAllocated] = useState(false);

  const workAmount = toNumber(values["ยอดงาน"]);
  const vatTotal = toNumber(values["ยอดรวม vat"] || values["ยอดรวม VAT"]);
  const budgetCap = toNumber(values["งบไม่เกิน"]);
  const totalProjectBudget = workAmount > 0
    ? workAmount
    : vatTotal > 0
    ? Math.round((vatTotal / 1.07) * 100) / 100
    : budgetCap > 0
    ? budgetCap
    : 0;

  // Value Extractors
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

  // 1. Material SubTotal calculation (27 items)
  const materialSubTotal = useMemo(() => {
    return MATERIAL_ITEMS.reduce((sum, item) => sum + toNumber(getMaterialVal(item)), 0);
  }, [values]);

  // 2. Labor SubTotal calculation (24 items including 301)
  const laborSubTotal = useMemo(() => {
    return LABOR_SUB_ITEMS.reduce((sum, item) => sum + toNumber(getLaborVal(item)), 0);
  }, [values]);

  // Mode states (Auto-calculated from sub-items VS Manual custom input)
  const [materialMode, setMaterialMode] = useState<"auto" | "manual">(() => {
    const rawVal = values["งบไม่เกินค่าของ"];
    const subVal = MATERIAL_ITEMS.reduce((sum, item) => sum + toNumber(getMaterialVal(item)), 0);
    if (rawVal !== undefined && rawVal !== "" && toNumber(rawVal) > 0 && toNumber(rawVal) !== subVal && subVal > 0) {
      return "manual";
    }
    return "auto";
  });

  const [laborMode, setLaborMode] = useState<"auto" | "manual">(() => {
    const rawVal = values["งบไม่เกินค่าแรง"];
    const subVal = LABOR_SUB_ITEMS.reduce((sum, item) => sum + toNumber(getLaborVal(item)), 0);
    if (rawVal !== undefined && rawVal !== "" && toNumber(rawVal) > 0 && toNumber(rawVal) !== subVal && subVal > 0) {
      return "manual";
    }
    return "auto";
  });

  const rawMaterialCap = toNumber(values["งบไม่เกินค่าของ"]);
  const rawLaborCap = toNumber(values["งบไม่เกินค่าแรง"]);
  const staffBudget = toNumber(values["งบไม่เกินพนักงาน"]);

  // Effective Material Budget
  const materialBudget = materialMode === "auto"
    ? (materialSubTotal > 0 ? materialSubTotal : rawMaterialCap)
    : (rawMaterialCap > 0 ? rawMaterialCap : materialSubTotal);

  // Effective Labor Budget (Labor direct + Staff)
  const effectiveLaborCap = laborMode === "auto"
    ? (laborSubTotal > 0 ? laborSubTotal : rawLaborCap)
    : (rawLaborCap > 0 ? rawLaborCap : laborSubTotal);
  const laborBudget = effectiveLaborCap + staffBudget;

  // Overall totals
  const totalAllocated = materialBudget + laborBudget;
  const remainingBudget = totalProjectBudget - totalAllocated;

  // Percentages
  const materialPercent = totalProjectBudget > 0 ? ((materialBudget / totalProjectBudget) * 100).toFixed(1) : "0.0";
  const laborPercent = totalProjectBudget > 0 ? ((laborBudget / totalProjectBudget) * 100).toFixed(1) : "0.0";
  const rawLaborPercent = totalProjectBudget > 0 ? ((effectiveLaborCap / totalProjectBudget) * 100).toFixed(1) : "0.0";
  const rawMaterialPercent = totalProjectBudget > 0 ? ((materialBudget / totalProjectBudget) * 100).toFixed(1) : "0.0";
  const staffPercent = totalProjectBudget > 0 ? ((staffBudget / totalProjectBudget) * 100).toFixed(1) : "0.0";
  const remainingPercent = totalProjectBudget > 0 ? ((remainingBudget / totalProjectBudget) * 100).toFixed(1) : "0.0";

  // Counts
  const materialItemsWithBudgetCount = useMemo(() => {
    return MATERIAL_ITEMS.filter(item => toNumber(getMaterialVal(item)) > 0).length;
  }, [values]);

  const laborItemsWithBudgetCount = useMemo(() => {
    return LABOR_SUB_ITEMS.filter(item => toNumber(getLaborVal(item)) > 0).length;
  }, [values]);

  // Overall Cap Handlers (Manual mode)
  function handleOverallMaterialChange(val: string) {
    setMaterialMode("manual");
    onChange("งบไม่เกินค่าของ", val);
  }

  function handleOverallLaborChange(val: string) {
    setLaborMode("manual");
    onChange("งบไม่เกินค่าแรง", val);
  }

  function handleOverallStaffChange(val: string) {
    onChange("งบไม่เกินพนักงาน", val);
  }

  // Switch Material Mode
  function toggleMaterialMode(targetMode: "auto" | "manual") {
    setMaterialMode(targetMode);
    if (targetMode === "auto") {
      onChange("งบไม่เกินค่าของ", materialSubTotal > 0 ? String(materialSubTotal) : "");
    } else {
      if (!values["งบไม่เกินค่าของ"] && materialSubTotal > 0) {
        onChange("งบไม่เกินค่าของ", String(materialSubTotal));
      }
    }
  }

  // Switch Labor Mode
  function toggleLaborMode(targetMode: "auto" | "manual") {
    setLaborMode(targetMode);
    if (targetMode === "auto") {
      onChange("งบไม่เกินค่าแรง", laborSubTotal > 0 ? String(laborSubTotal) : "");
    } else {
      if (!values["งบไม่เกินค่าแรง"] && laborSubTotal > 0) {
        onChange("งบไม่เกินค่าแรง", String(laborSubTotal));
      }
    }
  }

  // Sub-item Handlers
  function handleMaterialItemChange(field: string, val: string) {
    onChange(field, val);
    if (materialMode === "auto") {
      const nextMaterialSubTotal = MATERIAL_ITEMS.reduce((sum, item) => {
        const itemVal = item.field === field ? val : getMaterialVal(item);
        return sum + toNumber(itemVal);
      }, 0);
      onChange("งบไม่เกินค่าของ", nextMaterialSubTotal > 0 ? String(nextMaterialSubTotal) : "");
    }
  }

  function handleLaborItemChange(field: string, val: string) {
    onChange(field, val);
    if (laborMode === "auto") {
      const nextLaborSubTotal = LABOR_SUB_ITEMS.reduce((sum, item) => {
        const itemVal = item.field === field ? val : getLaborVal(item);
        return sum + toNumber(itemVal);
      }, 0);
      onChange("งบไม่เกินค่าแรง", nextLaborSubTotal > 0 ? String(nextLaborSubTotal) : "");
    }
  }

  // Reset Handlers
  function handleResetMaterialSubItems() {
    MATERIAL_ITEMS.forEach(item => {
      onChange(item.field, "");
    });
    onChange("งบไม่เกินดิน", "");
    onChange("งบไม่เกินปูนทรายหิน", "");
    onChange("งบไม่เกินประตูหน้าต่าง", "");
    onChange("งบไม่เกินตบแต่งภายใน", "");
    onChange("งบไม่เกินอื่นๆ", "");
    onChange("งบไม่เกินวัสดุอื่นๆ", "");
    if (materialMode === "auto") {
      onChange("งบไม่เกินค่าของ", "");
    }
  }

  function handleResetLaborSubItems() {
    LABOR_SUB_ITEMS.forEach(item => {
      onChange(item.field, "");
    });
    if (laborMode === "auto") {
      onChange("งบไม่เกินค่าแรง", "");
    }
  }

  // Filtering
  const filteredMaterialItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return MATERIAL_ITEMS.filter(item => {
      if (onlyAllocated && toNumber(getMaterialVal(item)) <= 0) return false;
      if (!q) return true;
      return item.label.toLowerCase().includes(q) || item.code.includes(q);
    });
  }, [searchQuery, onlyAllocated, values]);

  const filteredLaborItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return LABOR_SUB_ITEMS.filter(item => {
      if (onlyAllocated && toNumber(getLaborVal(item)) <= 0) return false;
      if (!q) return true;
      return item.label.toLowerCase().includes(q) || item.code.includes(q);
    });
  }, [searchQuery, onlyAllocated, values]);

  return (
    <div className="col-span-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs my-2 font-sans">
      {/* 1. TOP SUMMARY KPI BAR (กระชับ แถวเดียว พร้อม % สัดส่วน) */}
      <div className="p-2 sm:p-2.5 bg-slate-50/90 border-b border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* 100% Total Project */}
          <div className="bg-white border border-slate-200/90 shadow-2xs px-2.5 py-1.5 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
              <span>งบโครงการ</span>
              <span className="text-[10px] font-bold px-1 rounded bg-slate-100 text-slate-600">100%</span>
            </div>
            <span className="text-slate-900 font-bold text-xs sm:text-sm block mt-0.5">{money(totalProjectBudget)} บาท</span>
          </div>

          {/* 1. Material Budget */}
          <div className="bg-emerald-50/60 border border-emerald-300/80 shadow-2xs px-2.5 py-1.5 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-800 font-semibold">
              <span>1. งบค่าของ</span>
              <span className="text-[10px] font-bold px-1 rounded bg-emerald-100 text-emerald-800">{rawMaterialPercent}%</span>
            </div>
            <span className="text-emerald-950 font-bold text-xs sm:text-sm block mt-0.5">{money(materialBudget)} บาท</span>
          </div>

          {/* 2. Labor Budget */}
          <div className="bg-indigo-50/60 border border-indigo-300/80 shadow-2xs px-2.5 py-1.5 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-indigo-800 font-semibold">
              <span>2. งบค่าแรง & ช่าง</span>
              <span className="text-[10px] font-bold px-1 rounded bg-indigo-100 text-indigo-800">{laborPercent}%</span>
            </div>
            <span className="text-indigo-950 font-bold text-xs sm:text-sm block mt-0.5">{money(laborBudget)} บาท</span>
          </div>

          {/* Remaining */}
          <div className={`px-2.5 py-1.5 rounded-lg text-center border shadow-2xs ${
            remainingBudget < 0
              ? "bg-rose-50 border-rose-300 text-rose-800"
              : "bg-white border-slate-200 text-slate-700"
          }`}>
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
              <span>คงเหลือจัดสรร</span>
              <span className={`text-[10px] font-bold px-1 rounded ${
                remainingBudget < 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"
              }`}>{remainingPercent}%</span>
            </div>
            <span className="font-bold text-xs sm:text-sm block mt-0.5">
              {remainingBudget < 0 ? `เกิน ${money(Math.abs(remainingBudget))}` : money(remainingBudget)} บาท
            </span>
          </div>
        </div>
      </div>

      {/* 2. OVERALL TOTAL BUDGET INPUTS (กำหนดงบภาพรวม: ค่าของ / ค่าแรง / พนักงาน พร้อมปุ่มสลับคำนวณจากย่อย หรือ กรอกเอง) */}
      <div className="p-2.5 sm:p-3 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Sparkles size={13} className="text-amber-500" />
            <span>กำหนดงบภาพรวม (ค่าหลัก):</span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            เลือกคำนวณจากหมวดย่อยอัตโนมัติ หรือ สลับเป็นแบบกรอกยอดเองได้
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* ช่องกรอกรวมค่าของภาพรวม */}
          <div className="bg-emerald-50/20 p-2.5 rounded-xl border border-emerald-300 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Package size={14} className="text-emerald-700" />
                <span>งบค่าของ</span>
              </label>

              {/* Mode Toggle Button: Auto vs Manual */}
              <div className="inline-flex items-center p-0.5 bg-emerald-100/80 rounded-md border border-emerald-200 text-[10px]">
                <button
                  type="button"
                  onClick={() => toggleMaterialMode("auto")}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5 font-medium ${
                    materialMode === "auto"
                      ? "bg-emerald-700 text-white font-bold shadow-2xs"
                      : "text-emerald-800 hover:text-emerald-950"
                  }`}
                  title="คำนวณยอดรวมจาก 27 หมวดย่อยอัตโนมัติ"
                >
                  <Zap size={10} />
                  <span>คำนวณจากย่อย</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleMaterialMode("manual")}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5 font-medium ${
                    materialMode === "manual"
                      ? "bg-slate-800 text-white font-bold shadow-2xs"
                      : "text-emerald-800 hover:text-emerald-950"
                  }`}
                  title="กรอกตัวเลขงบค่าของเองโดยตรง"
                >
                  <PenLine size={10} />
                  <span>กรอกเอง</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {materialMode === "auto" ? (
                <div
                  onClick={() => toggleMaterialMode("manual")}
                  title="คลิกเพื่อสลับเป็นโหมดกรอกเอง"
                  className="w-full bg-emerald-50/60 border border-emerald-300 hover:border-emerald-500 rounded-lg px-2.5 py-1 text-sm font-bold text-right text-emerald-950 shadow-2xs font-mono flex items-center justify-between cursor-pointer group transition"
                >
                  <span className="text-[10px] font-sans font-medium text-emerald-700 flex items-center gap-1">
                    <Zap size={11} className="text-amber-500" />
                    <span>{materialItemsWithBudgetCount > 0 ? `รวม ${materialItemsWithBudgetCount} หมวด` : "ยังไม่ตั้งย่อย"}</span>
                  </span>
                  <span className="text-emerald-950">
                    {materialSubTotal > 0 ? money(materialSubTotal) : "0.00"}
                  </span>
                </div>
              ) : (
                <input
                  type="number"
                  value={values["งบไม่เกินค่าของ"] ?? ""}
                  onChange={e => handleOverallMaterialChange(e.target.value)}
                  placeholder="ระบุงบรวมค่าของ (บาท)"
                  className="w-full bg-white border border-emerald-400 focus:border-emerald-600 focus:bg-white rounded-lg px-2.5 py-1 text-sm font-bold text-right text-emerald-950 focus:outline-none shadow-2xs font-mono"
                />
              )}
              <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">บาท</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-emerald-700 pt-0.5">
              <span>สัดส่วนงบค่าของ: <strong className="font-bold text-emerald-900">{rawMaterialPercent}%</strong></span>
              {materialMode === "manual" && materialSubTotal > 0 && (
                <button
                  type="button"
                  onClick={() => toggleMaterialMode("auto")}
                  className="text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                >
                  ซิงค์จากย่อย (฿{money(materialSubTotal)})
                </button>
              )}
            </div>
          </div>

          {/* ช่องกรอกรวมค่าแรงภาพรวม */}
          <div className="bg-indigo-50/20 p-2.5 rounded-xl border border-indigo-300 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Hammer size={14} className="text-indigo-700" />
                <span>งบค่าแรง</span>
              </label>

              {/* Mode Toggle Button: Auto vs Manual */}
              <div className="inline-flex items-center p-0.5 bg-indigo-100/80 rounded-md border border-indigo-200 text-[10px]">
                <button
                  type="button"
                  onClick={() => toggleLaborMode("auto")}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5 font-medium ${
                    laborMode === "auto"
                      ? "bg-indigo-700 text-white font-bold shadow-2xs"
                      : "text-indigo-800 hover:text-indigo-950"
                  }`}
                  title="คำนวณยอดรวมจาก 24 หมวดย่อยอัตโนมัติ"
                >
                  <Zap size={10} />
                  <span>คำนวณจากย่อย</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleLaborMode("manual")}
                  className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5 font-medium ${
                    laborMode === "manual"
                      ? "bg-slate-800 text-white font-bold shadow-2xs"
                      : "text-indigo-800 hover:text-indigo-950"
                  }`}
                  title="กรอกตัวเลขงบค่าแรงเองโดยตรง"
                >
                  <PenLine size={10} />
                  <span>กรอกเอง</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {laborMode === "auto" ? (
                <div
                  onClick={() => toggleLaborMode("manual")}
                  title="คลิกเพื่อสลับเป็นโหมดกรอกเอง"
                  className="w-full bg-indigo-50/60 border border-indigo-300 hover:border-indigo-500 rounded-lg px-2.5 py-1 text-sm font-bold text-right text-indigo-950 shadow-2xs font-mono flex items-center justify-between cursor-pointer group transition"
                >
                  <span className="text-[10px] font-sans font-medium text-indigo-700 flex items-center gap-1">
                    <Zap size={11} className="text-amber-500" />
                    <span>{laborItemsWithBudgetCount > 0 ? `รวม ${laborItemsWithBudgetCount} หมวด` : "ยังไม่ตั้งย่อย"}</span>
                  </span>
                  <span className="text-indigo-950">
                    {laborSubTotal > 0 ? money(laborSubTotal) : "0.00"}
                  </span>
                </div>
              ) : (
                <input
                  type="number"
                  value={values["งบไม่เกินค่าแรง"] ?? ""}
                  onChange={e => handleOverallLaborChange(e.target.value)}
                  placeholder="ระบุงบรวมค่าแรง (บาท)"
                  className="w-full bg-white border border-indigo-400 focus:border-indigo-600 focus:bg-white rounded-lg px-2.5 py-1 text-sm font-bold text-right text-indigo-950 focus:outline-none shadow-2xs font-mono"
                />
              )}
              <span className="text-xs font-bold text-indigo-800 whitespace-nowrap">บาท</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-indigo-700 pt-0.5">
              <span>สัดส่วนงบค่าแรง: <strong className="font-bold text-indigo-900">{rawLaborPercent}%</strong></span>
              {laborMode === "manual" && laborSubTotal > 0 && (
                <button
                  type="button"
                  onClick={() => toggleLaborMode("auto")}
                  className="text-indigo-800 hover:text-indigo-950 underline cursor-pointer"
                >
                  ซิงค์จากย่อย (฿{money(laborSubTotal)})
                </button>
              )}
            </div>
          </div>

          {/* ช่องกรอกงบพนักงาน */}
          <div className="bg-slate-50/40 p-2.5 rounded-xl border border-slate-300 shadow-2xs space-y-1.5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>👥 งบพนักงาน</span>
              </label>
              {staffBudget > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-800 rounded font-bold">
                  {staffPercent}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={values["งบไม่เกินพนักงาน"] ?? ""}
                onChange={e => handleOverallStaffChange(e.target.value)}
                placeholder="ระบุงบพนักงาน (บาท)"
                className="w-full bg-white border border-slate-300 focus:border-slate-500 focus:bg-white rounded-lg px-2.5 py-1 text-sm font-bold text-right text-slate-900 focus:outline-none shadow-2xs font-mono"
              />
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap">บาท</span>
            </div>
            <div className="text-[10px] text-slate-500 pt-0.5">
              <span>ช่างประจำ & บุคลากรไซต์งาน (รหัส 301)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. COLLAPSIBLE ACCORDION TOGGLE BAR (เปิด / ซ่อน ควบคุมงบย่อย โดยเริ่มต้นที่ซ่อน) */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowSubAllocations(prev => !prev)}
          className="flex items-center gap-2.5 text-xs font-bold text-slate-800 hover:text-slate-950 transition cursor-pointer select-none group text-left min-w-0 flex-1"
        >
          <div className={`p-1.5 rounded-lg transition shrink-0 ${showSubAllocations ? "bg-slate-800 text-white" : "bg-white border border-slate-300 text-slate-700 group-hover:border-slate-400"}`}>
            {showSubAllocations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-900 font-bold">⚙️ จัดสรรงบประมาณย่อยแบบละเอียด</span>
              <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">(27 หมวดค่าของ / 24 หมวดค่าแรง)</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                showSubAllocations ? "bg-slate-200 text-slate-800" : "bg-amber-100 text-amber-900 border border-amber-200"
              }`}>
                {showSubAllocations ? "กำลังแสดงรายละเอียด" : "ซ่อนอยู่ (เริ่มต้นใช้ค่างบหลัก)"}
              </span>
            </div>
            <div className="text-[11px] font-normal text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              {materialItemsWithBudgetCount > 0 ? (
                <span className="text-emerald-700 font-medium">📦 ค่าของ: {materialItemsWithBudgetCount} หมวด (฿{money(materialSubTotal)})</span>
              ) : (
                <span>📦 ค่าของ: ยังไม่ตั้ง</span>
              )}
              <span>•</span>
              {laborItemsWithBudgetCount > 0 ? (
                <span className="text-indigo-700 font-medium">🔨 ค่าแรง: {laborItemsWithBudgetCount} หมวด (฿{money(laborSubTotal)})</span>
              ) : (
                <span>🔨 ค่าแรง: ยังไม่ตั้ง</span>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowSubAllocations(prev => !prev)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-2xs ${
            showSubAllocations
              ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {showSubAllocations ? (
            <>
              <EyeOff size={13} />
              <span>ซ่อนหมวดย่อย</span>
            </>
          ) : (
            <>
              <Eye size={13} />
              <span>เปิดดู / จัดสรรงบย่อย</span>
            </>
          )}
        </button>
      </div>

      {/* 4. EXPANDABLE SUB-ITEMS SECTION (แสดงเมื่อกดเปิดเท่านั้น) */}
      {showSubAllocations && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Tab controls & Search bar */}
          <div className="px-3 sm:px-4 py-2.5 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
            {/* Tab switcher */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("split")}
                className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "split"
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers size={13} />
                <span className="hidden sm:inline">ดู 2 ฝั่งคู่</span>
                <span className="sm:hidden">ทั้งหมด</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("material")}
                className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "material"
                    ? "bg-emerald-700 text-white shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Package size={13} />
                <span>ย่อยค่าของ ({MATERIAL_ITEMS.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("labor")}
                className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "labor"
                    ? "bg-indigo-700 text-white shadow-2xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Hammer size={13} />
                <span>ย่อยค่าแรง ({LABOR_SUB_ITEMS.length})</span>
              </button>
            </div>

            {/* Search & Show only allocated toggle */}
            <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหารหัสหรือชื่อหมวดย่อย..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 pl-8 pr-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:bg-white focus:border-slate-500 shadow-2xs"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyAllocated(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-lg border transition text-xs font-medium cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  onlyAllocated
                    ? "bg-slate-800 text-white border-slate-800 shadow-2xs font-bold"
                    : "bg-white text-slate-600 hover:bg-slate-100 border-slate-300"
                }`}
                title="กรองแสดงเฉพาะหมวดที่มีการตั้งงบไว้"
              >
                <Filter size={12} />
                <span>เฉพาะที่มีงบ</span>
              </button>
            </div>
          </div>

          {/* Sub-items tables grid */}
          <div className="p-3 sm:p-4 bg-slate-50/50">
            <div className={`grid gap-4 ${
              activeTab === "split"
                ? "grid-cols-1 lg:grid-cols-2"
                : "grid-cols-1"
            }`}>
              {/* LEFT TABLE: 📦 ย่อยค่าของ (Material) */}
              {(activeTab === "split" || activeTab === "material") && (
                <div className="border border-emerald-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="p-1 bg-emerald-200 text-emerald-800 rounded shrink-0">
                        <Package size={14} />
                      </div>
                      <span className="font-bold text-xs text-emerald-950 truncate">
                        ย่อยค่าของ ({filteredMaterialItems.length} รายการ)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-emerald-900">
                        รวม: {money(materialSubTotal)} บาท
                      </span>
                      {materialSubTotal > 0 && (
                        <button
                          type="button"
                          onClick={handleResetMaterialSubItems}
                          className="text-[10.5px] px-2 py-0.5 rounded-md border border-emerald-300 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-emerald-800 font-medium flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          title="รีเซ็ตค่าของย่อยทั้งหมดเป็นค่าว่าง (ไม่ตั้งงบย่อย)"
                        >
                          <RotateCcw size={11} />
                          <span>รีเซ็ตเป็นไม่ตั้ง</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-1 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <div className="col-span-6 sm:col-span-7">รหัส & หมวดสินค้า/งาน</div>
                    <div className="col-span-4 sm:col-span-3 text-right">วงเงินงบประมาณ (บาท)</div>
                    <div className="col-span-2 text-right">สัดส่วน</div>
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                    {filteredMaterialItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        ไม่พบหมวดค่าของที่ตรงกับเงื่อนไขค้นหา
                      </div>
                    ) : (
                      filteredMaterialItems.map(item => {
                        const val = getMaterialVal(item);
                        const numVal = toNumber(val);
                        const hasVal = numVal > 0;
                        const percent = totalProjectBudget > 0 ? ((numVal / totalProjectBudget) * 100).toFixed(1) : "0";

                        return (
                          <div
                            key={item.code}
                            className={`grid grid-cols-12 gap-1 px-3 py-1.5 items-center transition-colors ${
                              hasVal
                                ? "bg-emerald-50/50 hover:bg-emerald-50/80"
                                : "hover:bg-slate-50/80"
                            }`}
                          >
                            <div className="col-span-6 sm:col-span-7 flex items-center gap-1.5 min-w-0 pr-1">
                              {item.icon && <span className="text-xs shrink-0">{item.icon}</span>}
                              <span className={`text-xs truncate ${hasVal ? "font-bold text-emerald-950" : "text-slate-700"}`}>
                                {item.label}
                              </span>
                            </div>

                            <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-1">
                              <input
                                type="number"
                                value={val}
                                onChange={e => handleMaterialItemChange(item.field, e.target.value)}
                                placeholder="0"
                                className={`w-full text-right px-2 py-1 rounded-md text-xs font-mono focus:outline-none transition ${
                                  hasVal
                                    ? "bg-white border border-emerald-400 font-bold text-emerald-950 shadow-2xs focus:border-emerald-600 focus:ring-1 focus:ring-emerald-400"
                                    : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-white focus:bg-white focus:border-slate-400"
                                }`}
                              />
                            </div>

                            <div className="col-span-2 text-right">
                              <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                                hasVal ? "bg-emerald-100 text-emerald-800 font-bold" : "text-slate-400"
                              }`}>
                                {hasVal ? `${percent}%` : "-"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* RIGHT TABLE: 🔨 ย่อยค่าแรง (Labor) */}
              {(activeTab === "split" || activeTab === "labor") && (
                <div className="border border-indigo-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="p-1 bg-indigo-200 text-indigo-800 rounded shrink-0">
                        <Hammer size={14} />
                      </div>
                      <span className="font-bold text-xs text-indigo-950 truncate">
                        ย่อยค่าแรง & บุคลากร ({filteredLaborItems.length} รายการ)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-indigo-900">
                        รวม: {money(laborSubTotal)} บาท
                      </span>
                      {laborSubTotal > 0 && (
                        <button
                          type="button"
                          onClick={handleResetLaborSubItems}
                          className="text-[10.5px] px-2 py-0.5 rounded-md border border-indigo-300 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-indigo-800 font-medium flex items-center gap-1 transition cursor-pointer shadow-2xs"
                          title="รีเซ็ตค่าแรงย่อยทั้งหมดเป็นค่าว่าง (ไม่ตั้งงบย่อย)"
                        >
                          <RotateCcw size={11} />
                          <span>รีเซ็ตเป็นไม่ตั้ง</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-1 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <div className="col-span-6 sm:col-span-7">รหัส & หมวดงานค่าแรง</div>
                    <div className="col-span-4 sm:col-span-3 text-right">วงเงินงบประมาณ (บาท)</div>
                    <div className="col-span-2 text-right">สัดส่วน</div>
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                    {filteredLaborItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        ไม่พบหมวดค่าแรงที่ตรงกับเงื่อนไขค้นหา
                      </div>
                    ) : (
                      filteredLaborItems.map(item => {
                        const val = getLaborVal(item);
                        const numVal = toNumber(val);
                        const hasVal = numVal > 0;
                        const percent = totalProjectBudget > 0 ? ((numVal / totalProjectBudget) * 100).toFixed(1) : "0";

                        return (
                          <div
                            key={item.code}
                            className={`grid grid-cols-12 gap-1 px-3 py-1.5 items-center transition-colors ${
                              hasVal
                                ? "bg-indigo-50/50 hover:bg-indigo-50/80"
                                : "hover:bg-slate-50/80"
                            }`}
                          >
                            <div className="col-span-6 sm:col-span-7 flex items-center gap-1.5 min-w-0 pr-1">
                              {item.icon && <span className="text-xs shrink-0">{item.icon}</span>}
                              <span className={`text-xs truncate ${hasVal ? "font-bold text-indigo-950" : "text-slate-700"}`}>
                                {item.label}
                              </span>
                            </div>

                            <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-1">
                              <input
                                type="number"
                                value={val}
                                onChange={e => handleLaborItemChange(item.field, e.target.value)}
                                placeholder="0"
                                className={`w-full text-right px-2 py-1 rounded-md text-xs font-mono focus:outline-none transition ${
                                  hasVal
                                    ? "bg-white border border-indigo-400 font-bold text-indigo-950 shadow-2xs focus:border-indigo-600 focus:ring-1 focus:ring-indigo-400"
                                    : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-white focus:bg-white focus:border-slate-400"
                                }`}
                              />
                            </div>

                            <div className="col-span-2 text-right">
                              <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                                hasVal ? "bg-indigo-100 text-indigo-800 font-bold" : "text-slate-400"
                              }`}>
                                {hasVal ? `${percent}%` : "-"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
