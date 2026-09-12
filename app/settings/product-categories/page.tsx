"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  Package,
  Layers,
  Search,
  Trash2,
  Edit2,
  Building2,
  ShieldAlert,
  Sparkles,
  Home,
  Zap,
  Truck,
  FolderKanban,
  Settings2,
  X
} from "lucide-react";
import { showConfirm, showToast } from "@/components/shared/ToastProvider";

export type ProductCategoryItem = {
  id: string;
  code: string;
  name: string;
  group: string;
  description?: string;
  active: boolean;
};

const DEFAULT_GROUPS = [
  "หมวดงานโครงสร้าง",
  "หมวดงานสถาปัตยกรรม & ตกแต่ง",
  "หมวดงานระบบ M&E",
  "หมวดงานเตรียมดิน & โลจิสติกส์",
  "หมวดงานทั่วไป & ดำเนินการ"
];

const DEFAULT_PRODUCT_CATEGORIES: ProductCategoryItem[] = [
  // 1. หมวดงานโครงสร้าง
  { id: "1", code: "1", name: "ปูน/ทราย/หิน", group: "หมวดงานโครงสร้าง", description: "ปูนซีเมนต์, ทรายหยาบ/ละเอียด, หินผสม", active: true },
  { id: "2", code: "2", name: "เหล็กเส้น/รูปพรรณ", group: "หมวดงานโครงสร้าง", description: "เหล็กเส้น DB, RB, เหล็กกล่อง, H-Beam, C-Channel", active: true },
  { id: "3", code: "3", name: "คอนกรีตผสมเสร็จ", group: "หมวดงานโครงสร้าง", description: "คอนกรีตผสมเสร็จ, คอนกรีตหล่อสำเร็จ", active: true },
  { id: "4", code: "4", name: "ไม้แบบ/ไม้อัด", group: "หมวดงานโครงสร้าง", description: "ไม้แบบอัด, ไม้แปรรูป, ยูคล้อง", active: true },

  // 2. หมวดงานสถาปัตย์ & ตกแต่ง
  { id: "5", code: "5", name: "วัสดุมุง", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", description: "กระเบื้องหลังคา, เมทัลชีท", active: true },
  { id: "6", code: "6", name: "ฝ้าผนัง", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", description: "แผ่นยิปซัม, สมาร์ทบอร์ด, อิฐก่อ", active: true },
  { id: "7", code: "7", name: "ปูพื้น", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", description: "กระเบื้องยาง, แกรนิตโต้, ไม้ลามิเนต", active: true },
  { id: "8", code: "8", name: "กระจก", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", description: "กระจกอลูมิเนียม, กระจกเทมเปอร์", active: true },
  { id: "12", code: "12", name: "สีเคมี", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", description: "สีทาภายใน/นอก, เคมีภัณฑ์กันซึม", active: true },
  { id: "13", code: "13", name: "สุขภัณฑ์", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", description: "โถส้วม, อ่างล้างหน้า, ก๊อกน้ำ", active: true },
  { id: "14", code: "14", name: "บิวอิน", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", description: "เฟอร์นิเจอร์สั่งทำ, ตู้บิวท์อิน", active: true },

  // 3. หมวดงานระบบ M&E
  { id: "9", code: "9", name: "ไฟฟ้า", group: "หมวดงานระบบ M&E", description: "สายไฟ, ตู้ควบคุม, หลอดไฟ, ท่อร้อยสาย", active: true },
  { id: "10", code: "10", name: "ประปา", group: "หมวดงานระบบ M&E", description: "ท่อ PVC, ถังเก็บน้ำ, ปั๊มน้ำ", active: true },
  { id: "15", code: "15", name: "แอร์", group: "หมวดงานระบบ M&E", description: "เครื่องปรับอากาศ, ท่อน้ำยา", active: true },

  // 4. หมวดงานเตรียมดิน & โลจิสติกส์
  { id: "16", code: "16", name: "ดิน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", description: "ดินถม, ดินลูกรัง", active: true },
  { id: "17", code: "17", name: "หินทราย", group: "หมวดงานเตรียมดิน & โลจิสติกส์", description: "หิน 1-2, ทรายถม", active: true },
  { id: "18", code: "18", name: "เตรียมงาน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", description: "ป้ายโครงการ, นั่งร้าน, รั้วชั่วคราว", active: true },
  { id: "101", code: "101", name: "น้ำมัน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", description: "น้ำมันดีเซล/เบนซิน เครื่องจักรและยานพาหนะ", active: true },
  { id: "102", code: "102", name: "ค่าขนส่ง", group: "หมวดงานเตรียมดิน & โลจิสติกส์", description: "ค่าขนส่งสินค้า, ค่ารถสิบล้อ", active: true },
  { id: "103", code: "103", name: "เครื่องจักร", group: "หมวดงานเตรียมดิน & โลจิสติกส์", description: "ค่าเช่าแบคโฮ, เครน, เครื่องปั่นไฟ", active: true },

  // 5. อื่นๆ & ดำเนินการ
  { id: "11", code: "11", name: "อื่นๆ(วัสดุ)", group: "หมวดงานทั่วไป & ดำเนินการ", description: "วัสดุสิ้นเปลืองทั่วไป", active: true },
  { id: "200", code: "200", name: "ดำเนินการ(อื่นๆ)", group: "หมวดงานทั่วไป & ดำเนินการ", description: "ค่าใช้จ่ายดำเนินงานอื่นๆ", active: true },
];

function getGroupIcon(groupName: string) {
  if (groupName.includes("โครงสร้าง")) return <Building2 size={13} className="text-amber-600 shrink-0" />;
  if (groupName.includes("สถาปัตยกรรม")) return <Home size={13} className="text-indigo-600 shrink-0" />;
  if (groupName.includes("ระบบ")) return <Zap size={13} className="text-cyan-600 shrink-0" />;
  if (groupName.includes("เตรียมดิน") || groupName.includes("โลจิสติกส์")) return <Truck size={13} className="text-emerald-600 shrink-0" />;
  return <Package size={13} className="text-slate-600 shrink-0" />;
}


export default function ProductCategoryMasterPage() {
  const [groups, setGroups] = useState<string[]>(DEFAULT_GROUPS);
  const [categories, setCategories] = useState<ProductCategoryItem[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Item Modal state (Create & Edit)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductCategoryItem | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formGroup, setFormGroup] = useState(DEFAULT_GROUPS[0]);
  const [formDesc, setFormDesc] = useState("");

  // Group Management Modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    async function loadOptions() {
      setLoading(true);
      try {
        const res = await fetch("/api/system-options");
        const json = await res.json();
        if (json.success && json.options) {
          // Load custom work groups if saved
          if (Array.isArray(json.options["WORK_GROUPS_MASTER"]) && json.options["WORK_GROUPS_MASTER"].length > 0) {
            setGroups(json.options["WORK_GROUPS_MASTER"]);
          }
          // Load product categories master data
          if (Array.isArray(json.options["PRODUCT_MASTER_DATA"])) {
            const cleaned: ProductCategoryItem[] = json.options["PRODUCT_MASTER_DATA"].map((item: ProductCategoryItem) => ({
              ...item,
              group: item.group.replace(/^[\p{Emoji}\s]+/gu, "").trim()
            }));
            setCategories(cleaned);
          } else if (Array.isArray(json.options["สินค้า"])) {
            const rawStrings: string[] = json.options["สินค้า"];
            const parsed = rawStrings.map((str, idx) => {
              const match = str.match(/^(\d+)\s+(.+)$/);
              const code = match ? match[1] : String(idx + 1);
              const name = match ? match[2] : str;
              const existingDefault = DEFAULT_PRODUCT_CATEGORIES.find(d => d.code === code || d.name === name);
              return {
                id: existingDefault ? existingDefault.id : String(Date.now() + idx),
                code,
                name,
                group: existingDefault ? existingDefault.group : "หมวดงานทั่วไป & ดำเนินการ",
                description: existingDefault?.description || "",
                active: true
              };
            });
            setCategories(parsed);
          }
        }
      } catch (err) {
        console.error("Failed to load product categories master data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, []);

  // --- ITEM CRUD ACTIONS ---
  function handleOpenCreateItem() {
    setEditingItem(null);
    setFormCode("");
    setFormName("");
    setFormGroup(groups[0] || DEFAULT_GROUPS[0]);
    setFormDesc("");
    setIsItemModalOpen(true);
  }

  function handleOpenEditItem(item: ProductCategoryItem) {
    setEditingItem(item);
    setFormCode(item.code);
    setFormName(item.name);
    setFormGroup(item.group);
    setFormDesc(item.description || "");
    setIsItemModalOpen(true);
  }

  function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      setErrorMsg("กรุณาระบุทั้งรหัสสินค้าและชื่อหมวดสินค้า");
      return;
    }

    if (editingItem) {
      setCategories(prev =>
        prev.map(item =>
          item.id === editingItem.id
            ? { ...item, code: formCode.trim(), name: formName.trim(), group: formGroup, description: formDesc.trim() }
            : item
        )
      );
    } else {
      const newItem: ProductCategoryItem = {
        id: String(Date.now()),
        code: formCode.trim(),
        name: formName.trim(),
        group: formGroup,
        description: formDesc.trim(),
        active: true
      };
      setCategories(prev => [...prev, newItem]);
    }

    setIsItemModalOpen(false);
  }

  async function handleDeleteItem(id: string) {
    const confirmed = await showConfirm("คุณแน่ใจหรือไม่ว่าต้องการลบหมวดสินค้านี้?");
    if (!confirmed) return;
    setCategories(prev => prev.filter(item => item.id !== id));
  }

  // --- GROUP CRUD ACTIONS ---
  function handleAddGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (groups.includes(trimmed)) {
      showToast("info", `มีหมวดงาน "${trimmed}" อยู่ในระบบแล้ว`);
      return;
    }
    setGroups(prev => [...prev, trimmed]);
    setNewGroupName("");
  }

  async function handleDeleteGroup(groupToDelete: string) {
    const countInGroup = categories.filter(c => c.group === groupToDelete).length;
    if (countInGroup > 0) {
      const confirmed = await showConfirm(`มีหมวดสินค้าอยู่ ${countInGroup} รายการใน "${groupToDelete}" ต้องการลบใช่หรือไม่? (สินค้าย่อยจะถูกเปลี่ยนไปอยู่หมวดทั่วไป)`);
      if (!confirmed) return;
      setCategories(prev => prev.map(c => c.group === groupToDelete ? { ...c, group: "หมวดงานทั่วไป & ดำเนินการ" } : c));
    }
    setGroups(prev => prev.filter(g => g !== groupToDelete));
    if (selectedGroupFilter === groupToDelete) {
      setSelectedGroupFilter("ALL");
    }
  }

  // --- SAVE ALL TO DATABASE ---
  async function handleSaveAllToDatabase() {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const legacyStrings = categories.map(c => `${c.code} ${c.name}`);

      const getRes = await fetch("/api/system-options");
      const getJson = await getRes.json();
      const currentOptions = getJson.options || {};

      const updatedOptions = {
        ...currentOptions,
        "สินค้า": legacyStrings,
        "WORK_GROUPS_MASTER": groups,
        "PRODUCT_MASTER_DATA": categories
      };

      const res = await fetch("/api/system-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: updatedOptions })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "บันทึกไม่สำเร็จ");

      setSuccessMsg("บันทึกฐานข้อมูลหมวดหมู่สินค้าและหมวดงานหลักเรียบร้อยแล้ว");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  }

  // Filtered categories
  const filteredCategories = categories.filter(c => {
    const matchesSearch = c.code.toLowerCase().includes(searchQuery.toLowerCase()) || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroupFilter === "ALL" || c.group === selectedGroupFilter;
    return matchesSearch && matchesGroup;
  });

  return (
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-3.5 font-sans text-xs text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 pb-2.5 bg-white p-3 rounded-md border shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
            <Package size={16} />
          </div>
          <div>
            <h1 className="text-sm font-medium text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>จัดการหมวดสินค้า & รหัสจัดกลุ่มงบประมาณ</span>
              <span className="text-xs px-2 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full flex items-center gap-1">
                <Sparkles size={10} /> Master Data
              </span>
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">จัดการเพิ่ม/ลบหมวดงานหลัก และรหัสประเภทสินค้าอย่างเป็นระบบ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-medium rounded border border-indigo-200 transition cursor-pointer text-xs"
          >
            <Settings2 size={13} />
            <span>หมวดงานหลัก ({groups.length})</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreateItem}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded transition cursor-pointer text-xs"
          >
            <Plus size={13} />
            <span>เพิ่มหมวดสินค้า</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAllToDatabase}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded transition shadow-2xs disabled:opacity-50 cursor-pointer text-xs"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
          <ShieldAlert size={14} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหารหัส หรือ ชื่อหมวดสินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-slate-500 focus:bg-white transition"
          />
        </div>

        {/* Group Filter Pill Buttons */}
        <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedGroupFilter("ALL")}
            className={`px-2.5 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
              selectedGroupFilter === "ALL"
                ? "bg-slate-800 text-white font-medium"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FolderKanban size={12} />
            <span>ทั้งหมด ({categories.length})</span>
          </button>
          {groups.map((g) => {
            const count = categories.filter((c) => c.group === g).length;
            const isSelected = selectedGroupFilter === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGroupFilter(g)}
                className={`px-2 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? "bg-emerald-700 text-white font-medium shadow-2xs"
                    : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {getGroupIcon(g)}
                <span>{g}</span>
                <span className="text-xs font-mono px-1 rounded bg-slate-200/60 text-slate-800">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Master Data Table */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-700">
                <th className="py-2.5 px-3 w-20 text-center border-r border-slate-200">รหัส (Code)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">ชื่อหมวดสินค้า (Name)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">กลุ่มประเภทงาน (Group)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">คำอธิบายขอบเขตงาน</th>
                <th className="py-2.5 px-3 w-24 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                    <RefreshCw size={16} className="animate-spin mx-auto mb-1 text-slate-500" />
                    <span>กำลังโหลดข้อมูลหมวดสินค้า...</span>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                    ไม่พบหมวดสินค้าที่ตรงกับคำค้นหา
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50 transition-colors text-xs">
                    <td className="py-2 px-3 font-mono font-medium text-center text-indigo-800 bg-indigo-50/50 border-r border-slate-100">
                      {cat.code}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900 border-r border-slate-100">
                      {cat.name}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
                        {getGroupIcon(cat.group)}
                        <span>{cat.group}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-xs border-r border-slate-100">
                      {cat.description || "-"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditItem(cat)}
                          className="w-6 h-6 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
                          title="แก้ไขหมวดสินค้านี้"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(cat.id)}
                          className="w-6 h-6 rounded border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                          title="ลบหมวดสินค้านี้"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>แสดง {filteredCategories.length} จากทั้งหมด {categories.length} รายการ</span>
          <span> CostLab Master Data Management</span>
        </div>
      </div>

      {/* Modal 1: ITEM Create / Edit Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-3.5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-medium text-xs text-slate-900">
                {editingItem ? "แก้ไขหมวดสินค้า" : "เพิ่มหมวดสินค้าใหม่"}
              </h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-3.5 space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-1 space-y-1">
                  <label className="text-xs text-slate-700 block">รหัส (Code) *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 1, 101"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-medium text-indigo-800 focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-slate-700 block">ชื่อหมวดสินค้า (Name) *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เหล็กเส้น, คอนกรีต"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 block">กลุ่มประเภทงาน (Group)</label>
                <select
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-500 cursor-pointer"
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-700 block">คำอธิบายขอบเขตงาน</label>
                <textarea
                  rows={2}
                  placeholder="รายละเอียดประเภทสินค้าย่อย..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3 py-1 rounded border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition text-xs cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded text-xs transition cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: GROUP MANAGEMENT Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-3.5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-xs text-slate-900">
                <Settings2 size={15} className="text-indigo-600" />
                <span>จัดการหมวดงานหลัก (Work Groups Master)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Add Group Form */}
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block">เพิ่มหมวดงานหลักใหม่:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="เช่น หมวดงานครุภัณฑ์..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddGroup();
                      }
                    }}
                    className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-medium rounded text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>เพิ่ม</span>
                  </button>
                </div>
              </div>

              {/* Group List */}
              <div className="space-y-1">
                <label className="text-xs text-slate-700 block">รายการหมวดงานหลักปัจจุบัน ({groups.length}):</label>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded overflow-hidden bg-white max-h-56 overflow-y-auto">
                  {groups.map((group) => {
                    const countInGroup = categories.filter((c) => c.group === group).length;
                    return (
                      <div key={group} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 transition">
                        <div className="flex items-center gap-1.5 text-xs font-normal text-slate-800">
                          {getGroupIcon(group)}
                          <span>{group}</span>
                          <span className="text-xs font-mono px-1 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                            {countInGroup} รายการ
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group)}
                          className="w-5 h-5 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                          title="ลบหมวดงานนี้"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded text-xs transition cursor-pointer"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
