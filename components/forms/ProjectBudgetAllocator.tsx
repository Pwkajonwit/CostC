"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  PieChart,
  Package,
  Hammer,
  Layers,
  Calculator,
  CheckCircle2,
  Sparkles
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
};

// 1. รายการสินค้าทั้งหมดในหมวดค่าของ (22 รายการ Master Data)
const MATERIAL_ITEMS: CategoryItem[] = [
  { code: "1", field: "งบไม่เกินปูนทรายหิน", label: "1. ปูน/ทราย/หิน" },
  { code: "2", field: "งบไม่เกินเหล็กเส้น", label: "2. เหล็กเส้น/รูปพรรณ" },
  { code: "3", field: "งบไม่เกินคอนกรีต", label: "3. คอนกรีตผสมเสร็จ" },
  { code: "4", field: "งบไม่เกินไม้แบบ", label: "4. ไม้แบบ/ไม้อัด" },
  { code: "5", field: "งบไม่เกินวัสดุมุง", label: "5. วัสดุมุง" },
  { code: "6", field: "งบไม่เกินฝ้าผนัง", label: "6. ฝ้าผนัง" },
  { code: "7", field: "งบไม่เกินปูพื้น", label: "7. ปูพื้น" },
  { code: "8", field: "งบไม่เกินกระจก", label: "8. กระจก" },
  { code: "9", field: "งบไม่เกินไฟฟ้า", label: "9. ไฟฟ้า" },
  { code: "10", field: "งบไม่เกินประปา", label: "10. ประปา" },
  { code: "11", field: "งบไม่เกินวัสดุอื่นๆ", label: "11. อื่นๆ(วัสดุ)" },
  { code: "12", field: "งบไม่เกินสีเคมี", label: "12. สีเคมี" },
  { code: "13", field: "งบไม่เกินสุขภัณฑ์", label: "13. สุขภัณฑ์" },
  { code: "14", field: "งบไม่เกินบิวอิน", label: "14. บิวอิน" },
  { code: "15", field: "งบไม่เกินแอร์", label: "15. แอร์" },
  { code: "16", field: "งบไม่เกินดิน", label: "16. ดิน" },
  { code: "17", field: "งบไม่เกินหินทราย", label: "17. หินทราย" },
  { code: "18", field: "งบไม่เกินเตรียมงาน", label: "18. เตรียมงาน" },
  { code: "101", field: "งบไม่เกินน้ำมัน", label: "101. น้ำมัน" },
  { code: "102", field: "งบไม่เกินค่าขนส่ง", label: "102. ค่าขนส่ง" },
  { code: "103", field: "งบไม่เกินเครื่องจักร", label: "103. เครื่องจักร" },
  { code: "200", field: "งบไม่เกินดำเนินการ", label: "200. ดำเนินการ(อื่นๆ)" },
];

// 2. รายการในหมวดค่าแรง
const LABOR_ITEMS: CategoryItem[] = [
  { code: "2", field: "งบไม่เกินค่าแรง", label: "2. ค่าแรง (เปิดจ้างผู้รับเหมา)" },
  { code: "3", field: "งบไม่เกินพนักงาน", label: "3. พนักงาน (ช่างประจำ/ไซต์งาน)" },
];

export function ProjectBudgetAllocator({
  values,
  onChange,
  defaultExpanded = false
}: ProjectBudgetAllocatorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showMaterialSubItems, setShowMaterialSubItems] = useState(false); // Default collapsed as requested

  const workAmount = toNumber(values["ยอดงาน"]);
  const budgetCap = toNumber(values["งบไม่เกิน"]);
  const totalProjectBudget = workAmount > 0 ? workAmount : budgetCap;

  // ผลรวมของรายการสินค้าย่อยทั้งหมดในหมวดค่าของ
  const materialSubTotal = useMemo(() => {
    return MATERIAL_ITEMS.reduce((sum, item) => sum + toNumber(values[item.field] || 0), 0);
  }, [values]);

  // ยอดงบค่าของ (ถ้ามีกรอกย่อยจะสะท้อนตามยอดรวมสินค้าย่อย หรือตามค่าที่ระบุไว้)
  const rawMaterialCap = toNumber(values["งบไม่เกินค่าของ"]);
  const materialBudget = Math.max(rawMaterialCap, materialSubTotal);

  // ยอดงบค่าแรง
  const laborDirect = toNumber(values["งบไม่เกินค่าแรง"]);
  const staffDirect = toNumber(values["งบไม่เกินพนักงาน"]);
  const laborBudget = laborDirect + staffDirect;

  // จัดสรรแล้วทั้งหมด (2 หมวดใหญ่: ค่าของ + ค่าแรง)
  const totalAllocated = materialBudget + laborBudget;
  const remainingBudget = totalProjectBudget - totalAllocated;
  const allocatedPercent = totalProjectBudget > 0 ? (totalAllocated / totalProjectBudget) * 100 : 0;
  const remainingPercent = totalProjectBudget > 0 ? (remainingBudget / totalProjectBudget) * 100 : 0;

  // นับจำนวนรายการที่มีการระบุงบ
  const materialItemsWithBudgetCount = useMemo(() => {
    return MATERIAL_ITEMS.filter(item => toNumber(values[item.field] || 0) > 0).length;
  }, [values]);

  // ฟังก์ชันเมื่อเปลี่ยนค่าย่อยในหมวดค่าของ -> บันทึกค่านั้น และอัปเดตยอดรวม 'งบไม่เกินค่าของ' ทันที
  function handleMaterialItemChange(field: string, val: string) {
    onChange(field, val);

    // คำนวณผลรวมใหม่ทั้งหมดของหมวดค่าของ
    const nextValNum = toNumber(val);
    let newSum = 0;
    MATERIAL_ITEMS.forEach(item => {
      if (item.field === field) {
        newSum += nextValNum;
      } else {
        newSum += toNumber(values[item.field] || 0);
      }
    });

    // อัปเดตรวมเป็นยอดงบค่าของโดยอัตโนมัติ
    onChange("งบไม่เกินค่าของ", newSum > 0 ? String(newSum) : "");
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
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
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
          {/* Top Bar: KPI Summary */}
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
                <span className="text-[10px] text-emerald-700 block font-medium">1. รวมงบค่าของ</span>
                <span className="text-emerald-900 font-bold text-xs">{money(materialBudget)} ฿</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 text-right">
                <span className="text-[10px] text-indigo-700 block font-medium">2. รวมงบค่าแรง</span>
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
          {/* หมวดใหญ่ที่ 1: 📦 หมวดค่าของ (รวมสินค้า 22 รายการ) */}
          {/* ======================================================== */}
          <div className="bg-white border-2 border-emerald-300 rounded-xl p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300 shrink-0">
                  <Package size={18} />
                </div>
                <div className="min-w-0">
                  <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>1. หมวดค่าของ</span>
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                      {MATERIAL_ITEMS.length} รายการ
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

            {/* Sub-items Toggle Control Bar: แถบควบคุมรายการสินค้าย่อยแบบเต็มความกว้าง เรียบร้อย สวยงาม */}
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
                  <span className="text-xs font-bold flex items-center gap-2">
                    <span>สินค้าย่อยตามรายการ (22 รายการ)</span>
                    {materialItemsWithBudgetCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold">
                        กำหนดแล้ว {materialItemsWithBudgetCount} รายการ ({money(materialSubTotal)} ฿)
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
                <span>{showMaterialSubItems ? "ยุบสินค้าย่อย" : "ขยายดูสินค้าย่อย"}</span>
                {showMaterialSubItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {/* Grid 22 รายการสินค้า (แสดงเมื่อกดขยาย — จัด 3 คอลัมน์ อ่านชื่อสินค้าได้ครบถ้วน ไม่โดนตัด) */}
            {showMaterialSubItems && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {MATERIAL_ITEMS.map((item) => {
                    const val = values[item.field] !== undefined ? values[item.field] : "";
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
                          <span
                            className={`text-xs block leading-snug break-words ${
                              hasVal ? "font-bold text-emerald-950" : "font-semibold text-slate-800"
                            }`}
                          >
                            {item.label}
                          </span>
                          {hasVal && materialBudget > 0 && (
                            <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">
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

                {/* ปุ่มยุบด้านล่าง เพื่อความสะดวกเมื่อเลื่อนลงมาดูครบ 22 รายการ */}
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
          {/* หมวดใหญ่ที่ 2: 👷 หมวดค่าแรง */}
          {/* ======================================================== */}
          <div className="bg-white border-2 border-indigo-300 rounded-xl p-4 shadow-2xs space-y-3.5">
            {/* Header: รวมงบค่าแรง */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-indigo-100 text-indigo-800 rounded-xl border border-indigo-300 shrink-0">
                  <Hammer size={18} />
                </div>
                <div className="min-w-0">
                  <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>2. หมวดค่าแรง</span>
                  </h5>
                </div>
              </div>

              {/* Box แสดงยอดรวมค่าแรง */}
              <div className="flex items-center gap-2.5 bg-indigo-50/90 px-3.5 py-2 rounded-xl border border-indigo-300 shrink-0">
                <div className="text-right">
                  <span className="text-xs font-bold text-indigo-950">รวมงบค่าแรง:</span>
                </div>
                <div className="flex items-center justify-end w-36 px-2.5 py-1 text-sm font-bold text-indigo-950 bg-white border border-indigo-200 rounded-lg shadow-2xs">
                  <span>{money(laborBudget)}</span>
                  <span className="text-xs text-indigo-700 ml-1">฿</span>
                </div>
              </div>
            </div>

            {/* Grid รายการในหมวดค่าแรง */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {LABOR_ITEMS.map((cat) => {
                const val = values[cat.field] !== undefined ? values[cat.field] : "";
                const isMainLabor = cat.field === "งบไม่เกินค่าแรง";

                return (
                  <div
                    key={cat.code}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-2xs ${
                      isMainLabor
                        ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{cat.label}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 w-36">
                      <input
                        type="number"
                        value={val}
                        onChange={e => onChange(cat.field, e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-300 focus:border-indigo-600 rounded-lg px-2.5 py-1.5 text-xs text-right font-bold text-slate-900 focus:outline-none shadow-2xs"
                      />
                      <span className="text-xs text-slate-500 font-semibold">฿</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
