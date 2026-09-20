"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Trash2,
  Wrench,
  DollarSign,
  Package,
  FileText,
  Hash,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Lock,
  X,
  Calendar,
  CalendarDays,
  Layers,
  Info,
  Pencil,
  Check
} from "lucide-react";
import {
  FiscalPeriodConfig,
  ResolvedFiscalPeriod,
  resolveEffectivePeriodRanges
} from "@/lib/fiscal-periods/fiscal-period-types";
import { useYearFilter } from "@/lib/context/YearFilterContext";

type SystemOptionsMap = Record<string, string[]>;

type SequenceInfo = {
  totalBills: number;
  maxBillId: number;
  configuredStartSequence: number;
  nextSequence: number;
};

const DEFAULT_CATEGORIES: Array<{ key: string; label: string; icon: any; defaultValues: string[] }> = [
  {
    key: "ชื่อเครื่องมือ",
    label: "รายชื่อเครื่องมือ (สำหรับเลือกประเภท 504 เครื่องมือ)",
    icon: Wrench,
    defaultValues: ["สว่านเจาะเหล็กไฟฟ้า", "สว่านเจาะปูน Rotary", "ลูกหมูขนาด 4\"", "ลูกหมูขนาด 7\"", "ไฟเบอร์ตัดเหล็ก"]
  },
  {
    key: "สินค้า",
    label: "ประเภทสินค้า (สำหรับเลือกประเภท 100 ค่าของ)",
    icon: Package,
    defaultValues: [
      "1 เหล็กเส้น", "2 เหล็กรูปพรรณ", "3 คอนกรีต", "4 ไม้แบบ", "5 วัสดุมุง", "6 ฝ้าผนัง",
      "7 ปูพื้น", "8 กระจก", "9 ไฟฟ้า", "10 ประปา", "11 อื่นๆ(วัสดุ)", "12 สีเคมี",
      "13 สุขภัณฑ์", "14 บิวอิน", "15 แอร์", "16 ดิน", "17 หินทราย", "18 เตรียมงาน",
      "101 น้ำมัน", "102 ค่าขนส่ง", "103 เครื่องจักร", "104 ซ่อมรถ", "105 เครื่องมือ", "200 ดำเนินการ(อื่นๆ)", "non"
    ]
  },
  {
    key: "vat",
    label: "อัตราเปอร์เซ็นต์ VAT",
    icon: DollarSign,
    defaultValues: ["1", "3", "5", "7", "ระบุเอง"]
  },
  {
    key: "หัก",
    label: "อัตราเปอร์เซ็นต์ หัก ณ ที่จ่าย",
    icon: DollarSign,
    defaultValues: ["1", "3", "5", "ระบุเอง"]
  },
  {
    key: "เครดิต",
    label: "ระยะเวลาเครดิต (วัน)",
    icon: FileText,
    defaultValues: ["30", "45", "60", "ระบุเอง"]
  },
  {
    key: "ประเภทบิล",
    label: "ตัวเลือกประเภทบิล",
    icon: FileText,
    defaultValues: ["หลัก", "ย่อย"]
  },
  {
    key: "statusค่าแรง",
    label: "ตัวเลือกประเภทค่าแรง",
    icon: FileText,
    defaultValues: ["บุคคลธรรมดา", "บริษัท"]
  },
  {
    key: "รายละเอียดงาน",
    label: "รายละเอียดงาน (สำหรับเปิดจ้างงานรับเหมา)",
    icon: FileText,
    defaultValues: [
      "งานฐานราก/เสาเข็ม",
      "งานโครงสร้าง/ผูกเหล็ก/เข้าแบบ",
      "งานเทคอนกรีต",
      "งานมุงหลังคา/กันสาด",
      "งานก่ออิฐ/ฉาบปูน",
      "งานปูกระเบื้อง/พื้น",
      "งานระบบไฟฟ้า",
      "งานระบบประปา/สุขาภิบาล",
      "งานสีและเคมี",
      "งานประตู/หน้าต่าง/กระจก",
      "งานบิวท์อิน/ตกแต่ง"
    ]
  },
  {
    key: "รายการ",
    label: "รายการค่าใช้จ่าย (สำหรับเลือกประเภท 8.อื่นๆ)",
    icon: FileText,
    defaultValues: ["ค่าที่พัก", "ห้องรายเดือน", "เงินพิเศษ", "ค่าน้ำ/ค่าไฟ", "ค่าส่งเอกสาร", "ค่าธรรมเนียม", "ค่าประกันภัย"]
  },
  {
    key: "รับผิดชอบ",
    label: "ผู้รับผิดชอบโครงการ (สำหรับ 1.Project รวม)",
    icon: Sliders,
    defaultValues: ["PW1", "PW2", "PW3", "PW4", "PW"]
  },
  {
    key: "รถของ",
    label: "ความเป็นเจ้าของรถ (สำหรับ 7.ทะเบียนรถ)",
    icon: Sliders,
    defaultValues: ["รถบริษัท", "รถส่วนตัว", "รถเช่า"]
  },
  {
    key: "ยี่ห้อรถ",
    label: "ยี่ห้อรถยนต์ (สำหรับ 7.ทะเบียนรถ)",
    icon: Sliders,
    defaultValues: ["Toyota", "Isuzu", "Ford", "Mitsubishi", "Nissan", "Honda", "MG", "Mazda"]
  }
];

export default function SystemOptionsSettingsPage() {
  const { selectedYear, setSelectedYear } = useYearFilter();
  const [options, setOptions] = useState<SystemOptionsMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [newItemInputs, setNewItemInputs] = useState<Record<string, string>>({});

  // Sequence management state
  const [seqInfo, setSeqInfo] = useState<SequenceInfo | null>(null);
  const [startSeqInput, setStartSeqInput] = useState<string>("");
  const [isUpdatingSeq, setIsUpdatingSeq] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isResettingBills, setIsResettingBills] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>("");

  function openResetModal() {
    setResetStep(1);
    setAcknowledgedRisk(false);
    setConfirmText("");
    setShowResetModal(true);
  }

  function closeResetModal() {
    setShowResetModal(false);
    setResetStep(1);
    setAcknowledgedRisk(false);
    setConfirmText("");
  }

  async function loadSequenceInfo() {
    try {
      const res = await fetch("/api/bills/sequence");
      const json = await res.json();
      if (json.success) {
        setSeqInfo(json);
        setStartSeqInput(String(json.configuredStartSequence || 1));
      }
    } catch (err) {
      console.warn("Failed fetching bill sequence info:", err);
    }
  }

  // Custom Fiscal Period Management
  const [fiscalPeriods, setFiscalPeriods] = useState<ResolvedFiscalPeriod[]>([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState<boolean>(false);
  const [isSavingPeriods, setIsSavingPeriods] = useState<boolean>(false);
  const [periodMsg, setPeriodMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const currentYear = new Date().getFullYear();
  const [newPeriodType, setNewPeriodType] = useState<"year" | "quarter">("year");
  const [newPeriodYear, setNewPeriodYear] = useState<number>(currentYear);
  const [newPeriodQuarter, setNewPeriodQuarter] = useState<number>(1);
  const [newPeriodStartSeq, setNewPeriodStartSeq] = useState<string>("");
  const [newPeriodLabel, setNewPeriodLabel] = useState<string>("");

  async function loadFiscalPeriods() {
    setIsLoadingPeriods(true);
    try {
      const res = await fetch("/api/settings/fiscal-periods");
      const json = await res.json();
      if (json.success && Array.isArray(json.periods)) {
        const merged: ResolvedFiscalPeriod[] = json.periods.map((p: ResolvedFiscalPeriod) => ({
          ...p,
          billCount: typeof json.counts?.[p.id] === "number" ? json.counts[p.id] : p.billCount
        }));
        setFiscalPeriods(merged);
      }
    } catch (err) {
      console.warn("Failed fetching fiscal periods:", err);
    } finally {
      setIsLoadingPeriods(false);
    }
  }

  async function saveFiscalPeriodConfigs(configs: FiscalPeriodConfig[]) {
    setIsSavingPeriods(true);
    setPeriodMsg(null);
    try {
      const res = await fetch("/api/settings/fiscal-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periods: configs })
      });
      const json = await res.json();
      if (json.success) {
        if (Array.isArray(json.periods)) {
          setFiscalPeriods(json.periods);
        }
        setPeriodMsg({ type: "success", text: "บันทึกการกำหนดรอบปี / ไตรมาส เรียบร้อยแล้ว" });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("fiscal-periods-updated"));
        }
        // Refresh to recompute bill counts
        loadFiscalPeriods();
      } else {
        setPeriodMsg({ type: "error", text: json.error || "เกิดข้อผิดพลาดในการบันทึก" });
      }
    } catch (err: any) {
      setPeriodMsg({ type: "error", text: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์" });
    } finally {
      setIsSavingPeriods(false);
    }
  }

  async function handleAddPeriod() {
    const seq = parseInt(newPeriodStartSeq.trim(), 10);
    if (!seq || seq <= 0) {
      setPeriodMsg({ type: "error", text: "กรุณาระบุเลขที่บิลเริ่มต้นที่มากกว่า 0" });
      return;
    }

    const id = `period-${newPeriodYear}-${newPeriodType === "quarter" ? "q" + newPeriodQuarter + "-" : ""}${seq}`;

    const customName = newPeriodLabel.trim();
    const defaultName = newPeriodType === "year"
      ? `ปี ${newPeriodYear}`
      : `ปี ${newPeriodYear} Q${newPeriodQuarter}`;

    const label = customName || defaultName;

    const existingConfigs: FiscalPeriodConfig[] = fiscalPeriods.map(p => ({
      id: p.id,
      label: p.label,
      customName: p.customName,
      type: p.type,
      year: p.year,
      quarter: p.quarter,
      startSeq: p.startSeq,
      endSeq: p.endSeq
    }));

    // Update if exists with same startSeq or append
    const filtered = existingConfigs.filter(p => p.id !== id);
    const newConfig: FiscalPeriodConfig = {
      id,
      label,
      customName: customName || undefined,
      type: newPeriodType,
      year: newPeriodYear,
      quarter: newPeriodType === "quarter" ? newPeriodQuarter : undefined,
      startSeq: seq
    };

    const updated = [...filtered, newConfig];
    await saveFiscalPeriodConfigs(updated);

    // Automatically set the new period active in the sidebar and throughout the system
    setSelectedYear(id);

    // Reset inputs
    setNewPeriodStartSeq("");
    setNewPeriodLabel("");
  }

  // Period Editing State
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    customName: string;
    type: "year" | "quarter";
    year: number;
    quarter: number;
    startSeq: string;
  }>({
    customName: "",
    type: "year",
    year: currentYear,
    quarter: 1,
    startSeq: "1"
  });

  function startEditPeriod(period: ResolvedFiscalPeriod) {
    const cName = period.customName?.trim() || 
      (period.label && period.label !== String(period.year) && period.label !== `ปี ${period.year}` ? period.label : "");
    setEditingPeriodId(period.id);
    setEditForm({
      customName: cName,
      type: period.type,
      year: period.year,
      quarter: period.quarter || 1,
      startSeq: String(period.startSeq)
    });
  }

  function cancelEditPeriod() {
    setEditingPeriodId(null);
  }

  async function handleSaveEditPeriod() {
    if (!editingPeriodId) return;
    const seq = parseInt(editForm.startSeq.trim(), 10);
    if (!seq || seq <= 0) {
      setPeriodMsg({ type: "error", text: "กรุณาระบุเลขที่บิลเริ่มต้นที่มากกว่า 0" });
      return;
    }

    const newId = `period-${editForm.year}-${editForm.type === "quarter" ? "q" + editForm.quarter + "-" : ""}${seq}`;

    const defaultName = editForm.type === "year"
      ? `ปี ${editForm.year}`
      : `ปี ${editForm.year} Q${editForm.quarter}`;

    const customName = editForm.customName.trim();
    const label = customName || defaultName;

    const otherConfigs: FiscalPeriodConfig[] = fiscalPeriods
      .filter(p => p.id !== editingPeriodId && p.id !== newId)
      .map(p => ({
        id: p.id,
        label: p.label,
        customName: p.customName,
        type: p.type,
        year: p.year,
        quarter: p.quarter,
        startSeq: p.startSeq,
        endSeq: p.endSeq
      }));

    const updatedConfig: FiscalPeriodConfig = {
      id: newId,
      label,
      customName: customName || undefined,
      type: editForm.type,
      year: editForm.year,
      quarter: editForm.type === "quarter" ? editForm.quarter : undefined,
      startSeq: seq
    };

    const updated = [...otherConfigs, updatedConfig];
    await saveFiscalPeriodConfigs(updated);

    // If this period is currently selected in sidebar, update selectedYear to newId
    if (selectedYear === editingPeriodId) {
      setSelectedYear(newId);
    }

    setEditingPeriodId(null);
  }

  async function handleDeletePeriod(id: string) {
    const existingConfigs: FiscalPeriodConfig[] = fiscalPeriods
      .filter(p => p.id !== id)
      .map(p => ({
        id: p.id,
        label: p.label,
        customName: p.customName,
        type: p.type,
        year: p.year,
        quarter: p.quarter,
        startSeq: p.startSeq,
        endSeq: p.endSeq
      }));

    await saveFiscalPeriodConfigs(existingConfigs);
    if (editingPeriodId === id) {
      setEditingPeriodId(null);
    }
  }

  async function handleResetToCalendarDefaults() {
    if (confirm("ต้องการล้างการกำหนดรอบทั้งหมด และกลับไปใช้การตัดรอบตามวันที่ในปฏิทินแบบเดิมใช่หรือไม่?")) {
      await saveFiscalPeriodConfigs([]);
      setSelectedYear("all");
      setEditingPeriodId(null);
    }
  }

  useEffect(() => {
    async function loadOptions() {
      setLoading(true);
      try {
        const [res] = await Promise.all([
          fetch("/api/system-options"),
          loadSequenceInfo(),
          loadFiscalPeriods()
        ]);
        const json = await res.json();
        if (json.success && json.options) {
          const loaded = { ...json.options };
          // Fill missing keys with defaults if not present
          DEFAULT_CATEGORIES.forEach(cat => {
            if (!loaded[cat.key] || !Array.isArray(loaded[cat.key]) || loaded[cat.key].length === 0) {
              loaded[cat.key] = cat.defaultValues;
            }
          });
          setOptions(loaded);
        } else {
          // Initialize defaults
          const initial: SystemOptionsMap = {};
          DEFAULT_CATEGORIES.forEach(cat => {
            initial[cat.key] = cat.defaultValues;
          });
          setOptions(initial);
        }
      } catch (err) {
        console.error("Failed to load system options:", err);
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, []);

  function handleAddItem(key: string) {
    const val = (newItemInputs[key] || "").trim();
    if (!val) return;
    const currentList = options[key] || [];
    if (currentList.includes(val)) {
      setErrorMsg(`"${val}" มีอยู่ในรายการแล้ว`);
      return;
    }
    setOptions(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), val]
    }));
    setNewItemInputs(prev => ({ ...prev, [key]: "" }));
    setErrorMsg("");
  }

  function handleRemoveItem(key: string, indexToRemove: number) {
    setOptions(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, idx) => idx !== indexToRemove)
    }));
  }

  async function handleSave() {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/system-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "บันทึกไม่สำเร็จ");

      setSuccessMsg("บันทึกตัวเลือกระบบเรียบร้อยแล้ว");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStartSequence() {
    const val = parseInt(startSeqInput.trim(), 10);
    if (isNaN(val) || val < 1) {
      setErrorMsg("กรุณาระบุเลขเริ่มต้นที่เป็นตัวเลขตั้งแต่ 1 ขึ้นไป");
      return;
    }

    setIsUpdatingSeq(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/bills/sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_start_sequence", startSequence: val })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "ตั้งค่าเลขเริ่มต้นไม่สำเร็จ");

      setSuccessMsg(`บันทึกเลขเริ่มต้นบิลเป็น ${val} เรียบร้อยแล้ว`);
      await loadSequenceInfo();
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการตั้งค่าเลขเริ่มต้น");
    } finally {
      setIsUpdatingSeq(false);
    }
  }

  async function handleResetBills() {
    setIsResettingBills(true);
    setErrorMsg("");
    try {
      const val = parseInt(startSeqInput.trim(), 10) || 1;
      const res = await fetch("/api/bills/sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_bills_and_sequence", startSequence: val })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "รีเซ็ตบิลไม่สำเร็จ");

      closeResetModal();
      setSuccessMsg(`ล้างข้อมูลบิลทั้งหมดและรีเซ็ตเลขเริ่มต้นเป็น ${val} สำเร็จ!`);
      await loadSequenceInfo();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการรีเซ็ตข้อมูลบิล");
    } finally {
      setIsResettingBills(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans text-xs flex items-center justify-center gap-2 font-normal">
        <RefreshCw size={16} className="animate-spin text-emerald-600" />
        กำลังโหลดข้อมูลตัวเลือกระบบ...
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 p-2.5 sm:p-4 font-sans text-slate-800 antialiased pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP COMMAND RIBBON & HEADER                                             */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl px-3.5 py-3 sm:px-4 sm:py-3.5 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Badges */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#0b3531] text-[#34d399] flex items-center justify-center shrink-0 shadow-2xs border border-emerald-700/50">
              <Sliders className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-1.5">
                  ตั้งค่าตัวเลือก & เงื่อนไขระบบ
                  <span className="text-[11px] font-bold text-slate-400 tracking-normal hidden sm:inline">
                    / SYSTEM OPTIONS & CONFIGURATION
                  </span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0 shadow-2xs">
                  <Sliders className="w-3 h-3 text-[#d4f54e]" />
                  <span>ตัวเลือกระบบ</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>พร้อมใช้งาน</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                จัดการเลขลำดับบิล ตัดรอบปี/ไตรมาสตามเลขบิล และกำหนดตัวเลือก Dropdown สำหรับแบบฟอร์มทั่วทั้งระบบ
              </p>
            </div>
          </div>

          {/* Quick Action Save Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-2xs"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? "กำลังบันทึก..." : "บันทึกตัวเลือกระบบ"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. NOTIFICATIONS                                                          */}
      {/* ========================================================================= */}
      {successMsg && (
        <div className="px-3.5 py-2.5 bg-emerald-50/90 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2.5 text-xs shadow-2xs">
          <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
            <CheckCircle2 size={13} />
          </div>
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="px-3.5 py-2.5 bg-rose-50/90 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-2.5 text-xs shadow-2xs">
          <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-700">
            <AlertTriangle size={13} />
          </div>
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BILL SEQUENCE & NUMBERING SECTION                                      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/80 shadow-2xs">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
                จัดการเลขลำดับบิล
              </span>
              <span className="text-[11px] font-bold text-slate-400 block">
                BILL SEQUENCE & NUMBERING
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={loadSequenceInfo}
            className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="รีเฟรชข้อมูลเลขบิล"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Status Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500">เลขบิลสูงสุดในระบบปัจจุบัน</div>
            <div className="text-sm font-black text-slate-900 mt-1 font-mono">
              {seqInfo ? (seqInfo.maxBillId > 0 ? `#${seqInfo.maxBillId}` : "ไม่มีรายการบิล (0)") : "-"}
            </div>
          </div>
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500">จำนวนบิลทั้งหมดในระบบ</div>
            <div className="text-sm font-black text-slate-900 mt-1 font-mono">
              {seqInfo ? `${seqInfo.totalBills} รายการ` : "-"}
            </div>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-800">เลขบิลที่จะถูกสร้างถัดไป</div>
            <div className="text-sm font-black text-emerald-900 mt-1 font-mono">
              {seqInfo ? `#${seqInfo.nextSequence}` : "-"}
            </div>
          </div>
        </div>

        {/* Setting Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2.5 flex-1 flex-wrap">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              เลขเริ่มต้นบิลถัดไป:
            </label>
            <input
              type="number"
              min="1"
              value={startSeqInput}
              onChange={(e) => setStartSeqInput(e.target.value)}
              placeholder="เช่น 1, 1001, 3000"
              className="w-36 px-3 py-1.5 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-900 text-xs font-mono font-medium focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
            />
            <button
              type="button"
              onClick={handleSaveStartSequence}
              disabled={isUpdatingSeq}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer text-xs shadow-2xs disabled:opacity-50"
            >
              {isUpdatingSeq ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              <span>บันทึกเลขเริ่มต้น</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={openResetModal}
              className="w-full sm:w-auto px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer text-xs shadow-2xs"
            >
              <RotateCcw size={12} />
              <span>ล้างบิลทดสอบทั้งหมด & เริ่มที่เลข {startSeqInput || 1}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Step Security Confirmation Modal for Resetting Bills */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl p-4 sm:p-5 max-w-md w-full border border-slate-200 space-y-4 shadow-xl">
            {/* Header & Step Indicator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="p-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    ระบบป้องกันการลบข้อมูล (ยืนยัน {resetStep}/3)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">ล้างข้อมูลบิลทั้งหมดออกจากระบบ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeResetModal}
                disabled={isResettingBills}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Step Progress Bar */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className={`h-1.5 rounded-full transition-all ${resetStep >= 1 ? "bg-rose-500" : "bg-slate-200"}`} />
              <div className={`h-1.5 rounded-full transition-all ${resetStep >= 2 ? "bg-rose-500" : "bg-slate-200"}`} />
              <div className={`h-1.5 rounded-full transition-all ${resetStep >= 3 ? "bg-rose-500" : "bg-slate-200"}`} />
            </div>

            {/* STEP 1: IMPACT AUDIT */}
            {resetStep === 1 && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>แจ้งเตือน: ตรวจสอบผลกระทบ (ขั้นตอนที่ 1 จาก 3)</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed pl-5">
                    การดำเนินการนี้จะลบรายการบิลทั้งหมดที่มีอยู่ในฐานข้อมูล <b>จำนวน {seqInfo?.totalBills || 0} รายการ</b> ออกจากระบบอย่างถาวร
                  </p>
                </div>

                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">จำนวนบิลที่จะถูกลบ:</span>
                    <span className="text-rose-600 font-bold">{seqInfo?.totalBills || 0} รายการ</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">เลขเริ่มต้นบิลใหม่:</span>
                    <span className="text-slate-900 font-bold font-mono">#{startSeqInput || 1}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] leading-relaxed font-medium">
                  ⚠️ <b>คำเตือน:</b> หากระบบนี้เริ่มใช้งานจริงและมีบิลของบริษัทอยู่แล้ว <b>ห้ามกดดำเนินการต่อ</b> ให้กดยกเลิกทันที!
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeResetModal}
                    className="flex-1 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep(2)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>ยืนยันครั้งที่ 1 (ไปขั้นตอนที่ 2)</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: RISK ACKNOWLEDGEMENT */}
            {resetStep === 2 && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-orange-800">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>แจ้งเตือน: ยืนยันความเสี่ยงข้อมูลสูญหาย (ขั้นตอนที่ 2 จาก 3)</span>
                  </div>
                  <p className="text-[11px] text-orange-700 leading-relaxed pl-5">
                    ข้อมูลค่าใช้จ่าย ยอดเงิน เอกสารแนบ และประวัติการติดตามบิลทั้งหมดจะถูกลบทิ้ง <b>ไม่สามารถกู้คืน (Undo) ได้ทุกกรณี</b>
                  </p>
                </div>

                <label className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acknowledgedRisk}
                    onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-medium leading-relaxed">
                    ข้าพเจ้ายืนยันและรับทราบว่า ข้อมูลบิลทั้งหมด {seqInfo?.totalBills || 0} รายการจะถูกลบถาวร และยอมรับความเสี่ยงนี้
                  </span>
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="py-2 px-3 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft size={13} />
                    <span>ย้อนกลับ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep(3)}
                    disabled={!acknowledgedRisk}
                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span>ยืนยันครั้งที่ 2 (ไปขั้นตอนสุดท้าย)</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SECURITY KEYWORD CONFIRMATION */}
            {resetStep === 3 && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <Lock size={14} className="shrink-0" />
                    <span>ขั้นตอนสุดท้าย: พิมพ์ข้อความเพื่อปลดล็อก (ขั้นตอนที่ 3 จาก 3)</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed pl-5">
                    เพื่อป้องกันการกดพลาดโดยไม่ตั้งใจ กรุณาพิมพ์คำว่า:
                  </p>
                  <div className="pl-5 pt-1">
                    <span className="inline-block px-2 py-1 bg-white border border-rose-300 rounded-lg text-rose-900 font-mono text-xs select-all font-bold">
                      ยืนยันลบข้อมูลทั้งหมด
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">พิมพ์คำยืนยันด้านล่าง:</label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="พิมพ์ ยืนยันลบข้อมูลทั้งหมด"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 font-mono"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(2)}
                    disabled={isResettingBills}
                    className="py-2 px-3 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
                  >
                    <ArrowLeft size={13} />
                    <span>ย้อนกลับ</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBills}
                    disabled={isResettingBills || confirmText.trim() !== "ยืนยันลบข้อมูลทั้งหมด"}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-2xs"
                  >
                    {isResettingBills ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>กำลังล้างข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        <span>🔥 ยืนยันล้างข้อมูลบิลทั้งหมด (ลบถาวร)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CUSTOM FISCAL PERIODS (YEAR & QUARTER BY BILL RANGE)                   */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200/80 shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
                กำหนดรอบปี / ไตรมาส ตามช่วงเลขที่บิล
              </span>
              <span className="text-[11px] font-bold text-slate-400 block">
                CUSTOM FISCAL PERIODS BY BILL RANGE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {fiscalPeriods.length > 0 && (
              <button
                type="button"
                onClick={handleResetToCalendarDefaults}
                disabled={isSavingPeriods}
                className="text-slate-500 hover:text-rose-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer border border-slate-200 font-medium"
                title="ล้างรอบกำหนดเองและกลับไปใช้การตัดรอบตามวันที่ในปฏิทิน"
              >
                คืนค่าเริ่มต้น (ตามวันที่)
              </button>
            )}
            <button
              type="button"
              onClick={loadFiscalPeriods}
              disabled={isLoadingPeriods}
              className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-200"
              title="รีเฟรชข้อมูลรอบปี"
            >
              <RefreshCw size={13} className={isLoadingPeriods ? "animate-spin text-emerald-600" : ""} />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {periodMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs ${
              periodMsg.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-rose-50 border border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-1.5 font-medium">
              {periodMsg.type === "success" ? (
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
              )}
              <span>{periodMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setPeriodMsg(null)}
              className="text-slate-400 hover:text-slate-600 text-xs p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Active Synchronization with Sidebar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-600 font-bold">รอบที่กำลังเลือกใช้งานในระบบ (แสดงบนเมนูซ้าย):</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0 shadow-2xs">
              <Calendar size={13} className="text-[#d4f54e]" />
              <span>
                {selectedYear === "all"
                  ? "ทุกปี (All Years) - รวมข้อมูลบิลทั้งหมด"
                  : (() => {
                      const matched = fiscalPeriods.find(
                        (p) => String(p.year) === selectedYear || p.id === selectedYear
                      );
                      if (!matched) return `ปี ${selectedYear}`;
                      const cName = matched.customName?.trim() || 
                        (matched.label && matched.label !== String(matched.year) && matched.label !== `ปี ${matched.year}` ? matched.label : "");
                      return cName ? `ปี ${matched.year} (${cName})` : `ปี ${matched.year}`;
                    })()}
              </span>
            </span>
          </div>
          {selectedYear !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedYear("all")}
              className="text-slate-500 hover:text-slate-800 text-[11px] underline cursor-pointer self-start sm:self-auto font-medium"
            >
              สลับเป็นดูทุกปี (All)
            </button>
          )}
        </div>

        {/* Existing Fiscal Periods Table */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
                <th className="py-2.5 px-3">ชื่อรอบที่แสดง</th>
                <th className="py-2.5 px-3">ประเภท</th>
                <th className="py-2.5 px-3">ปี ค.ศ.</th>
                <th className="py-2.5 px-3">ช่วงเลขที่บิล (Effective Range)</th>
                <th className="py-2.5 px-3 text-right">บิลในระบบ</th>
                <th className="py-2.5 px-3 text-center">เลือกแสดงในเมนู</th>
                <th className="py-2.5 px-3 text-center w-20">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {fiscalPeriods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 bg-slate-50/50 italic">
                    ยังไม่มีการกำหนดรอบตามเลขที่บิล (ปัจจุบันระบบกรองข้อมูลตามปี ค.ศ. ในวันที่ของบิลตามปกติ)
                  </td>
                </tr>
              ) : (
                fiscalPeriods.map((period) => {
                  const isEditing = editingPeriodId === period.id;
                  const isCurrentlyActive =
                    selectedYear === period.id ||
                    (fiscalPeriods.filter((x) => x.year === period.year).length === 1 &&
                      selectedYear === String(period.year));
                  const cName = period.customName?.trim() || 
                    (period.label && period.label !== String(period.year) && period.label !== `ปี ${period.year}` ? period.label : "");

                  if (isEditing) {
                    return (
                      <tr key={period.id} className="bg-emerald-50/50 border-y border-emerald-200">
                        {/* Custom Name */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={editForm.customName}
                            onChange={(e) => setEditForm(prev => ({ ...prev, customName: e.target.value }))}
                            placeholder="ชื่อรอบ (ไม่ใส่ก็ได้)"
                            className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                            autoFocus
                          />
                        </td>
                        {/* Type */}
                        <td className="py-2.5 px-3">
                          <select
                            value={editForm.type}
                            onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as "year" | "quarter" }))}
                            className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          >
                            <option value="year">รอบปี (Year)</option>
                            <option value="quarter">ไตรมาส (Quarter)</option>
                          </select>
                        </td>
                        {/* Year / Quarter */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editForm.year}
                              onChange={(e) => setEditForm(prev => ({ ...prev, year: parseInt(e.target.value, 10) || currentYear }))}
                              className="w-20 px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono"
                              min="2000"
                              max="2100"
                            />
                            {editForm.type === "quarter" && (
                              <select
                                value={editForm.quarter}
                                onChange={(e) => setEditForm(prev => ({ ...prev, quarter: parseInt(e.target.value, 10) || 1 }))}
                                className="px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono"
                              >
                                <option value={1}>Q1</option>
                                <option value={2}>Q2</option>
                                <option value={3}>Q3</option>
                                <option value={4}>Q4</option>
                              </select>
                            )}
                          </div>
                        </td>
                        {/* Start Sequence */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500 whitespace-nowrap">เริ่มบิล #</span>
                            <input
                              type="number"
                              value={editForm.startSeq}
                              onChange={(e) => setEditForm(prev => ({ ...prev, startSeq: e.target.value }))}
                              placeholder="เช่น 1, 500"
                              min="1"
                              className="w-24 px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                            />
                          </div>
                        </td>
                        {/* Bill count */}
                        <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                          -
                        </td>
                        {/* Selection status */}
                        <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">
                          -
                        </td>
                        {/* Actions: Save / Cancel */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleSaveEditPeriod}
                              disabled={isSavingPeriods || !editForm.startSeq.trim()}
                              className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg cursor-pointer transition disabled:opacity-50 shadow-2xs"
                              title="บันทึกการแก้ไข"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditPeriod}
                              disabled={isSavingPeriods}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer transition"
                              title="ยกเลิกการแก้ไข"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={period.id}
                      className={`transition-colors ${
                        isCurrentlyActive ? "bg-emerald-50/40 hover:bg-emerald-50/70 font-medium" : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-slate-400 shrink-0" />
                          {cName ? (
                            <span className="font-bold">{cName}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-normal">(ไม่ระบุ)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            period.type === "year"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {period.type === "year" ? "รอบปี (Year)" : `ไตรมาส Q${period.quarter || 1}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">
                        {period.year} (พ.ศ. {period.year + 543})
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-bold">
                          {period.rangeLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                        {typeof period.billCount === "number" ? `${period.billCount} รายการ` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isCurrentlyActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 text-[10px]">
                            <CheckCircle2 size={11} className="text-emerald-700" />
                            <span>กำลังเลือกใช้งาน</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedYear(period.id)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-300 hover:border-emerald-300 text-[10px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="คลิกเพื่อเลือกให้เมนูด้านข้างและระบบกรองข้อมูลตามรอบนี้"
                          >
                            <span>เลือกใช้งานรอบนี้</span>
                            <ArrowRight size={10} />
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditPeriod(period)}
                            disabled={isSavingPeriods}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition cursor-pointer"
                            title={`แก้ไขรอบ ${period.label}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePeriod(period.id)}
                            disabled={isSavingPeriods}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title={`ลบรอบ ${period.label}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add New Period Form */}
        <div className="p-3.5 bg-slate-50/60 border border-slate-200/80 rounded-xl space-y-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
            <Plus size={13} className="text-emerald-700" />
            <span>เพิ่มการกำหนดรอบปี / ไตรมาสใหม่</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            {/* Type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">ประเภท</label>
              <select
                value={newPeriodType}
                onChange={(e) => setNewPeriodType(e.target.value as "year" | "quarter")}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
              >
                <option value="year">รอบปี (Year)</option>
                <option value="quarter">ไตรมาส (Quarter)</option>
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">ปี ค.ศ.</label>
              <input
                type="number"
                value={newPeriodYear}
                onChange={(e) => setNewPeriodYear(parseInt(e.target.value, 10) || currentYear)}
                min="2000"
                max="2100"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Quarter (if quarter type) */}
            {newPeriodType === "quarter" ? (
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ไตรมาส</label>
                <select
                  value={newPeriodQuarter}
                  onChange={(e) => setNewPeriodQuarter(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                >
                  <option value={1}>ไตรมาส 1 (Q1)</option>
                  <option value={2}>ไตรมาส 2 (Q2)</option>
                  <option value={3}>ไตรมาส 3 (Q3)</option>
                  <option value={4}>ไตรมาส 4 (Q4)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">ชื่อรอบที่แสดง (ระบุเองได้)</label>
                <input
                  type="text"
                  value={newPeriodLabel}
                  onChange={(e) => setNewPeriodLabel(e.target.value)}
                  placeholder={`เช่น ปี ${newPeriodYear}`}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            )}

            {/* Start Bill Sequence */}
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">เริ่มที่บิลเลขที่ (#)</label>
              <input
                type="number"
                value={newPeriodStartSeq}
                onChange={(e) => setNewPeriodStartSeq(e.target.value)}
                placeholder="เช่น 1 หรือ 500"
                min="1"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="button"
                onClick={handleAddPeriod}
                disabled={isSavingPeriods || !newPeriodStartSeq.trim()}
                className="w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isSavingPeriods ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                <span>เพิ่มรอบนี้</span>
              </button>
            </div>
          </div>

          {newPeriodStartSeq && parseInt(newPeriodStartSeq, 10) > 1 && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded border border-emerald-100">
              <Info size={12} className="shrink-0" />
              <span>
                เมื่อรอบนี้เริ่มที่ <b>บิล #{newPeriodStartSeq}</b> ระบบจะตัดจบรอบก่อนหน้าที่ <b>บิล #{parseInt(newPeriodStartSeq, 10) - 1}</b> ให้อัตโนมัติทันที
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Option Categories List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEFAULT_CATEGORIES.map((cat) => {
          const IconComp = cat.icon || Sliders;
          const currentList = options[cat.key] || cat.defaultValues;
          return (
            <div key={cat.key} className="bg-white border border-slate-200 rounded-md p-3 space-y-2 shadow-2xs">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <IconComp size={13} className="text-emerald-700 shrink-0" />
                <h2 className="text-xs font-medium text-slate-900 m-0">{cat.label}</h2>
              </div>

              {/* Items Chip Grid */}
              <div className="flex flex-wrap gap-1 min-h-[36px] items-center p-2 bg-slate-50 rounded border border-slate-200">
                {currentList.length === 0 ? (
                  <span className="text-slate-400 italic text-xs">ไม่มีรายการตัวเลือก</span>
                ) : (
                  currentList.map((item, idx) => (
                    <span
                      key={`${item}-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-300 text-slate-800 rounded text-xs font-normal"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(cat.key, idx)}
                        className="text-slate-400 hover:text-rose-600 transition cursor-pointer p-0.5"
                        title="ลบรายการนี้"
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add New Input */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  placeholder="พิมพ์ตัวเลือกใหม่..."
                  value={newItemInputs[cat.key] || ""}
                  onChange={(e) => setNewItemInputs((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddItem(cat.key);
                    }
                  }}
                  className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-800 text-xs focus:outline-none focus:border-slate-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddItem(cat.key)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded flex items-center gap-1 transition cursor-pointer text-xs"
                >
                  <Plus size={13} />
                  <span>เพิ่ม</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
