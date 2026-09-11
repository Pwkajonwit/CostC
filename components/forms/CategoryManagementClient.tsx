"use client";

import { useState } from "react";
import { Check, FolderPlus, Layers, Plus, Save, Sparkles, Trash2, Users, Store, Package } from "lucide-react";

type CategoryManagementClientProps = {
  initialOptions: Record<string, string[]>;
};

const DEFAULT_MASTER = [
  "1.ค่าของ",
  "2.ค่าแรง",
  "3.พนักงาน",
  "4.น้ำมัน",
  "5.ซ่อมรถ",
  "6.เครื่องจักร",
  "7.เครื่องมือ",
  "8.อื่นๆ"
];

const DEFAULT_CONTRACTOR = ["2.ค่าแรง", "3.พนักงาน", "8.อื่นๆ"];
const DEFAULT_STORE = ["1.ค่าของ", "4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร", "7.เครื่องมือ", "8.อื่นๆ"];
const DEFAULT_STORE_ITEM = ["4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร"];

export function CategoryManagementClient({ initialOptions }: CategoryManagementClientProps) {
  const [masterCategories, setMasterCategories] = useState<string[]>(() => {
    const fromSys = initialOptions["รายการประเภททั้งหมด"] || initialOptions["ประเภท"];
    if (fromSys && fromSys.length > 0) return fromSys;
    // Extract unique from groups if available
    const g1 = initialOptions["ประเภท (ผู้รับเหมา)"] || [];
    const g2 = initialOptions["ประเภท (ร้านค้า)"] || [];
    const g3 = initialOptions["ประเภท (ร้านค้า+เลือกสินค้า)"] || [];
    const combined = Array.from(new Set([...g1, ...g2, ...g3, ...DEFAULT_MASTER]));
    return combined.length > 0 ? combined : DEFAULT_MASTER;
  });

  const [contractorGroup, setContractorGroup] = useState<string[]>(() => {
    const val = initialOptions["ประเภท (ผู้รับเหมา)"];
    return val && val.length > 0 ? val : DEFAULT_CONTRACTOR;
  });

  const [storeGroup, setStoreGroup] = useState<string[]>(() => {
    const val = initialOptions["ประเภท (ร้านค้า)"];
    return val && val.length > 0 ? val : DEFAULT_STORE;
  });

  const [storeItemGroup, setStoreItemGroup] = useState<string[]>(() => {
    const val = initialOptions["ประเภท (ร้านค้า+เลือกสินค้า)"];
    return val && val.length > 0 ? val : DEFAULT_STORE_ITEM;
  });

  const [newCatInput, setNewCatInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleAddMasterCategory() {
    const val = newCatInput.trim();
    if (!val) return;
    if (masterCategories.includes(val)) {
      setError(`ประเภท "${val}" มีอยู่ในรายการแล้ว`);
      return;
    }
    setError("");
    setMasterCategories((prev) => [...prev, val]);
    setNewCatInput("");
  }

  function handleRemoveMasterCategory(itemToRemove: string) {
    setMasterCategories((prev) => prev.filter((cat) => cat !== itemToRemove));
    setContractorGroup((prev) => prev.filter((cat) => cat !== itemToRemove));
    setStoreGroup((prev) => prev.filter((cat) => cat !== itemToRemove));
    setStoreItemGroup((prev) => prev.filter((cat) => cat !== itemToRemove));
  }

  function toggleCategoryInGroup(group: "contractor" | "store" | "storeItem", categoryName: string) {
    if (group === "contractor") {
      setContractorGroup((prev) =>
        prev.includes(categoryName) ? prev.filter((c) => c !== categoryName) : [...prev, categoryName]
      );
    } else if (group === "store") {
      setStoreGroup((prev) =>
        prev.includes(categoryName) ? prev.filter((c) => c !== categoryName) : [...prev, categoryName]
      );
    } else if (group === "storeItem") {
      setStoreItemGroup((prev) =>
        prev.includes(categoryName) ? prev.filter((c) => c !== categoryName) : [...prev, categoryName]
      );
    }
  }

  async function handleSaveAll() {
    setSaving(true);
    setSavedSuccess(false);
    setError("");

    try {
      const payloadOptions: Record<string, string[]> = {
        ...initialOptions,
        "รายการประเภททั้งหมด": masterCategories,
        "ประเภท (ผู้รับเหมา)": contractorGroup,
        "ประเภท (ร้านค้า)": storeGroup,
        "ประเภท (ร้านค้า+เลือกสินค้า)": storeItemGroup
      };

      const res = await fetch("/api/system-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: payloadOptions })
      });

      if (!res.ok) {
        throw new Error("ไม่สามารถบันทึกข้อมูลได้");
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full flex-1 flex flex-col bg-white font-sans text-xs text-slate-800">
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
        <div>
          <h1 className="text-base text-slate-900">
            จัดการประเภทและกลุ่มประเภทสำหรับสร้างบิล
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            กำหนดรายการประเภททั้งหมด และจัดกลุ่มประเภทเพื่อใช้กำหนดตัวเลือกในฟอร์มสร้างบิล
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
              <Check size={14} />
              <span>บันทึกเรียบร้อยแล้ว</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-4 py-1.5 rounded-md transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Save size={15} />
            <span>{saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-rose-500 hover:text-rose-800 ">
            ✕
          </button>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* LEFT COLUMN: รายการประเภททั้งหมด (Master Categories List) */}
        <div className="lg:col-span-5 bg-white rounded-md border border-slate-200 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-xs text-slate-800">1. รายการประเภททั้งหมด</h2>
              <p className="text-xs text-slate-500">มาสเตอร์ประเภทสินค้า/ค่าใช้จ่ายทั้งหมดในระบบ</p>
            </div>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200">
              {masterCategories.length} รายการ
            </span>
          </div>

          {/* Add New Category Form */}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMasterCategory())}
              placeholder="เพิ่มชื่อประเภทใหม่ เช่น 9.ค่าขนส่ง..."
              className="flex-1 bg-white border border-slate-300 text-slate-800 text-xs px-3 py-1 rounded-md focus:outline-none focus:border-slate-500 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={handleAddMasterCategory}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1 rounded-md transition cursor-pointer"
            >
              <Plus size={14} />
              <span>เพิ่ม</span>
            </button>
          </div>

          {/* Master Categories Badge Container */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 max-h-[500px] pr-1">
            {masterCategories.map((cat, idx) => (
              <div
                key={cat}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-2 rounded-md transition group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-white border border-slate-200 text-slate-500 flex items-center justify-center text-xs ">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-slate-800">{cat}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveMasterCategory(cat)}
                  className="w-5 h-5 rounded bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 flex items-center justify-center transition cursor-pointer text-xs"
                  title={`ลบประเภท ${cat}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: การจัดกลุ่มประเภทสำหรับสร้างบิล (Bill Category Groups) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-md border border-slate-200 p-4">
            <div className="pb-3 border-b border-slate-200">
              <h2 className="text-xs text-slate-800">2. จัดกลุ่มประเภทสำหรับสร้างบิล</h2>
              <p className="text-xs text-slate-500">เลือกประเภทที่จะให้แสดงเป็นตัวเลือกในฟอร์มสร้างบิลแต่ละรูปแบบ</p>
            </div>

            {/* 3 GROUP CARDS */}
            <div className="mt-3 space-y-3">
              {/* GROUP 1: ผู้รับเหมา */}
              <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs text-slate-800">กลุ่มประเภท (ผู้รับเหมา)</h3>
                    <p className="text-xs text-slate-500">แสดงในฟอร์มบิลเมื่อเลือกร้านค้าประเภทผู้รับเหมา</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                    {contractorGroup.length} เลือกแล้ว
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {masterCategories.map((cat) => {
                    const isSelected = contractorGroup.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoryInGroup("contractor", cat)}
                        className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition cursor-pointer border ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* GROUP 2: ร้านค้า */}
              <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs text-slate-800">กลุ่มประเภท (ร้านค้าทั่วไป)</h3>
                    <p className="text-xs text-slate-500">แสดงในฟอร์มบิลเมื่อเลือกร้านค้าทั่วไป</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                    {storeGroup.length} เลือกแล้ว
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {masterCategories.map((cat) => {
                    const isSelected = storeGroup.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoryInGroup("store", cat)}
                        className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition cursor-pointer border ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* GROUP 3: ร้านค้า+เลือกสินค้า */}
              <div className="p-3.5 rounded-md border border-slate-200 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs text-slate-800">กลุ่มประเภท (ร้านค้า + เลือกสินค้า)</h3>
                    <p className="text-xs text-slate-500">แสดงเมื่อมีการกรอกเลือกรายละเอียดสินค้าเฉพาะเจาะจง</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                    {storeItemGroup.length} เลือกแล้ว
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {masterCategories.map((cat) => {
                    const isSelected = storeItemGroup.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoryInGroup("storeItem", cat)}
                        className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition cursor-pointer border ${
                          isSelected
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

