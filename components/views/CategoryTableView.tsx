"use client";

import { useMemo, useState } from "react";
import {
  Layers,
  Search,
  Package,
  HardHat,
  Users,
  Wrench,
  Fuel,
  Car,
  Truck,
  CheckCircle2,
  Info,
  SlidersHorizontal,
  FileSpreadsheet
} from "lucide-react";
import {
  MATERIAL_100_CODES,
  EQUIPMENT_500_CODES,
  LABOR_200_CODES,
  STAFF_300_CODES,
  SUB_ITEMS_123,
  SUB_ITEMS_223,
  getExpenseFieldForCategory,
  getCostCodeBadgeStyle
} from "@/lib/cost-codes";

type WorkGroup = "โครงสร้าง" | "สถาปัตยกรรม & ปูผิว" | "งานระบบ M&E" | "ตกแต่ง & ภูมิทัศน์" | "เตรียมงาน & ดำเนินการ" | "ยานพาหนะ & เครื่องมือ" | "พนักงาน";

function getWorkGroup(code: string): WorkGroup {
  const num = parseInt(code.replace(/\D/g, ""), 10);
  if ([101, 201, 121, 221, 122, 222, 123, 223].includes(num)) return "เตรียมงาน & ดำเนินการ";
  if ([102, 202, 103, 203, 104, 204, 105, 205, 106, 206, 107, 207, 108, 208, 109, 209].includes(num)) return "โครงสร้าง";
  if ([110, 210, 111, 211, 112, 212, 113, 213, 114, 214].includes(num)) return "สถาปัตยกรรม & ปูผิว";
  if ([115, 215, 116, 216, 117, 217].includes(num)) return "งานระบบ M&E";
  if ([118, 218, 119, 219, 120, 220].includes(num)) return "ตกแต่ง & ภูมิทัศน์";
  if ([501, 502, 503, 504].includes(num)) return "ยานพาหนะ & เครื่องมือ";
  if (num === 301) return "พนักงาน";
  return "เตรียมงาน & ดำเนินการ";
}

export function CategoryTableView() {
  const [activeTab, setActiveTab] = useState<"all" | "material" | "labor">("all");
  const [search, setSearch] = useState("");

  // Build full combined list of comparison items (101 vs 201)
  const comparisonList = useMemo(() => {
    const list: Array<{
      index: number;
      materialCode: string;
      materialName: string;
      laborCode: string;
      laborName: string;
      group: WorkGroup;
      subItems?: string[];
    }> = [];

    // Pair 101-123 with 201-223
    for (let i = 0; i < MATERIAL_100_CODES.length; i++) {
      const mat = MATERIAL_100_CODES[i];
      const lab = LABOR_200_CODES[i] || { code: "-", name: "-" };
      list.push({
        index: i + 1,
        materialCode: mat.code,
        materialName: mat.name,
        laborCode: lab.code,
        laborName: lab.name,
        group: getWorkGroup(mat.code),
        subItems: mat.code === "123" ? SUB_ITEMS_123 : (lab.code === "223" ? SUB_ITEMS_223 : undefined)
      });
    }

    // Equipment 501-504
    EQUIPMENT_500_CODES.forEach((eq, idx) => {
      list.push({
        index: MATERIAL_100_CODES.length + idx + 1,
        materialCode: eq.code,
        materialName: eq.name,
        laborCode: "-",
        laborName: "-",
        group: "ยานพาหนะ & เครื่องมือ"
      });
    });

    // Staff 301
    STAFF_300_CODES.forEach((st, idx) => {
      list.push({
        index: MATERIAL_100_CODES.length + EQUIPMENT_500_CODES.length + idx + 1,
        materialCode: "-",
        materialName: "-",
        laborCode: st.code,
        laborName: st.name,
        group: "พนักงาน"
      });
    });

    return list;
  }, []);

  // Filtered comparison items
  const filteredComparison = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return comparisonList;

    return comparisonList.filter(item => {
      return (
        item.materialCode.includes(q) ||
        item.materialName.toLowerCase().includes(q) ||
        item.laborCode.includes(q) ||
        item.laborName.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.subItems && item.subItems.some(s => s.toLowerCase().includes(q)))
      );
    });
  }, [comparisonList, search]);

  // Separate material list
  const materialList = useMemo(() => {
    const items = [
      ...MATERIAL_100_CODES.map(m => ({
        code: m.code,
        name: m.name,
        type: m.code === "123" ? "อื่นๆ" : "ค่าของ",
        group: getWorkGroup(m.code),
        subItems: m.code === "123" ? SUB_ITEMS_123 : undefined
      })),
      ...EQUIPMENT_500_CODES.map(e => ({
        code: e.code,
        name: e.name,
        type: getExpenseFieldForCategory(e.code),
        group: "ยานพาหนะ & เครื่องมือ" as WorkGroup,
        subItems: undefined
      }))
    ];

    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter(i =>
      i.code.includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q) ||
      i.group.toLowerCase().includes(q) ||
      (i.subItems && i.subItems.some(s => s.toLowerCase().includes(q)))
    );
  }, [search]);

  // Separate labor list
  const laborList = useMemo(() => {
    const items = [
      ...LABOR_200_CODES.map(l => ({
        code: l.code,
        name: l.name,
        type: "ค่าแรง",
        group: getWorkGroup(l.code),
        subItems: l.code === "223" ? SUB_ITEMS_223 : undefined
      })),
      ...STAFF_300_CODES.map(s => ({
        code: s.code,
        name: s.name,
        type: "พนักงาน",
        group: "พนักงาน" as WorkGroup,
        subItems: undefined
      }))
    ];

    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter(i =>
      i.code.includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.type.toLowerCase().includes(q) ||
      i.group.toLowerCase().includes(q) ||
      (i.subItems && i.subItems.some(s => s.toLowerCase().includes(q)))
    );
  }, [search]);

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0b3531] to-[#124d45] rounded-xl p-5 sm:p-6 text-white shadow-sm border border-[#14574e]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#195a52] text-[#d4f54e]">
                <Layers size={20} />
              </span>
              <h1 className="text-xl font-bold tracking-tight">3. ตารางรหัสประเภท (ค่าของ & ค่าแรง)</h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-[#195a52] text-emerald-200 border border-[#217066]">
                แสดงข้อมูลมาตรฐาน (Read-Only)
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 max-w-3xl">
              ตารางรหัสและหมวดหมู่งานมาตรฐานของระบบ สำหรับใช้เลือกในแบบฟอร์มกรอกบิล, ตรวจสอบการตั้งเบิก, และควบคุมงบประมาณโครงการ (Cost Code Standards)
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-[#082a27]/80 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-[#1b635a] text-center">
              <div className="text-[11px] text-emerald-200/80 font-medium">หมวดค่าของ (100+500)</div>
              <div className="text-base font-bold text-white">27 <span className="text-xs font-normal text-emerald-300">รหัส</span></div>
            </div>
            <div className="bg-[#082a27]/80 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-[#1b635a] text-center">
              <div className="text-[11px] text-emerald-200/80 font-medium">หมวดค่าแรง (200+300)</div>
              <div className="text-base font-bold text-white">24 <span className="text-xs font-normal text-emerald-300">รหัส</span></div>
            </div>
          </div>
        </div>

        {/* Tab & Search Control Bar */}
        <div className="mt-5 pt-4 border-t border-emerald-800/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center bg-[#072421] p-1 rounded-lg border border-[#175249] w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "all"
                  ? "bg-[#d4f54e] text-[#0b3531] font-bold shadow-xs"
                  : "text-emerald-200 hover:text-white hover:bg-[#124d45]"
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>เปรียบเทียบ ค่าของ vs ค่าแรง ({comparisonList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("material")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "material"
                  ? "bg-[#d4f54e] text-[#0b3531] font-bold shadow-xs"
                  : "text-emerald-200 hover:text-white hover:bg-[#124d45]"
              }`}
            >
              <Package size={14} />
              <span>เฉพาะ ค่าของ ({MATERIAL_100_CODES.length + EQUIPMENT_500_CODES.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("labor")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === "labor"
                  ? "bg-[#d4f54e] text-[#0b3531] font-bold shadow-xs"
                  : "text-emerald-200 hover:text-white hover:bg-[#124d45]"
              }`}
            >
              <HardHat size={14} />
              <span>เฉพาะ ค่าแรง & พนักงาน ({LABOR_200_CODES.length + STAFF_300_CODES.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหารหัส หรือชื่อหมวดหมู่..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#072421] text-xs text-white placeholder-emerald-400/60 border border-[#175249] focus:outline-hidden focus:border-[#d4f54e] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-emerald-300 hover:text-white px-1"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* VIEW 1: All / Comparison View */}
        {activeTab === "all" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-44">
                    <div className="flex items-center gap-1.5 text-emerald-800">
                      <Package size={14} className="text-emerald-600" />
                      <span>รหัสค่าของ (100/500)</span>
                    </div>
                  </th>
                  <th className="py-3 px-4">ชื่อรายการ (ค่าของ)</th>
                  <th className="py-3 px-4 w-44">
                    <div className="flex items-center gap-1.5 text-amber-800">
                      <HardHat size={14} className="text-amber-600" />
                      <span>รหัสค่าแรง (200/300)</span>
                    </div>
                  </th>
                  <th className="py-3 px-4">ชื่อรายการ (ค่าแรง)</th>
                  <th className="py-3 px-4 w-48">กลุ่มหมวดงาน</th>
                  <th className="py-3 px-4">รายละเอียด / รายการย่อย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12px]">
                {filteredComparison.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      ไม่พบข้อมูลที่ตรงกับคำค้นหา &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                ) : (
                  filteredComparison.map((item) => (
                    <tr key={item.index} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {item.index}
                      </td>

                      {/* Material Code */}
                      <td className="py-2.5 px-4">
                        {item.materialCode !== "-" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {item.materialCode}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Material Name */}
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {item.materialName !== "-" ? (
                          <span>{item.materialName}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Labor Code */}
                      <td className="py-2.5 px-4">
                        {item.laborCode !== "-" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
                            {item.laborCode}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Labor Name */}
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {item.laborName !== "-" ? (
                          <span>{item.laborName}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Work Group */}
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                          {item.group}
                        </span>
                      </td>

                      {/* Sub-items / Note */}
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {item.subItems && item.subItems.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-lg">
                            {item.subItems.map((sub, sIdx) => (
                              <span key={sIdx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                {sub}
                              </span>
                            ))}
                          </div>
                        ) : item.materialCode.startsWith("50") ? (
                          <span className="text-slate-400 italic">หมวดยานพาหนะ/เครื่องมือ</span>
                        ) : item.laborCode === "301" ? (
                          <span className="text-slate-400 italic">เงินเดือน/ค่าแรงพนักงานประจำ</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: Material Only View */}
        {activeTab === "material" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 border-collapse">
              <thead>
                <tr className="bg-emerald-50/70 border-b border-emerald-100 text-emerald-900 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-20 text-center">รหัส</th>
                  <th className="py-3 px-4 w-60">ชื่อหมวดสินค้า/ค่าของ</th>
                  <th className="py-3 px-4 w-36">ประเภทบัญชีหลัก</th>
                  <th className="py-3 px-4 w-48">กลุ่มงานก่อสร้าง</th>
                  <th className="py-3 px-4">รายละเอียด / รายการย่อย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12px]">
                {materialList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      ไม่พบข้อมูลที่ตรงกับคำค้นหา
                    </td>
                  </tr>
                ) : (
                  materialList.map((item) => (
                    <tr key={item.code} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                          {item.group}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {item.subItems ? (
                          <div className="flex flex-wrap gap-1 max-w-xl">
                            {item.subItems.map((sub, sIdx) => (
                              <span key={sIdx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                {sub}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 3: Labor Only View */}
        {activeTab === "labor" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700 border-collapse">
              <thead>
                <tr className="bg-amber-50/70 border-b border-amber-100 text-amber-900 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-20 text-center">รหัส</th>
                  <th className="py-3 px-4 w-60">ชื่อหมวดงานค่าแรง</th>
                  <th className="py-3 px-4 w-36">ประเภทบัญชีหลัก</th>
                  <th className="py-3 px-4 w-48">กลุ่มงานก่อสร้าง</th>
                  <th className="py-3 px-4">รายละเอียด / รายการย่อย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12px]">
                {laborList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      ไม่พบข้อมูลที่ตรงกับคำค้นหา
                    </td>
                  </tr>
                ) : (
                  laborList.map((item) => (
                    <tr key={item.code} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs bg-amber-100 text-amber-800 border border-amber-300/80">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {item.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                          {item.group}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {item.subItems ? (
                          <div className="flex flex-wrap gap-1 max-w-xl">
                            {item.subItems.map((sub, sIdx) => (
                              <span key={sIdx} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60 text-[10px]">
                                {sub}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary */}
        <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <Info size={14} className="text-slate-400 shrink-0" />
            <span>
              รหัสค่าของ (101–122) และค่าแรง (201–222) จัดโครงสร้างแบบคู่ขนาน 1:1 เพื่อความแม่นยำในการคุมงบประมาณโครงการ
            </span>
          </div>
          <div className="text-slate-400 shrink-0">
            {activeTab === "all" && `แสดงทั้งหมด ${filteredComparison.length} รายการ`}
            {activeTab === "material" && `แสดงค่าของ ${materialList.length} รายการ`}
            {activeTab === "labor" && `แสดงค่าแรง ${laborList.length} รายการ`}
          </div>
        </div>
      </div>
    </div>
  );
}
