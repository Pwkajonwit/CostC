"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Receipt,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  X,
  Sparkles,
  LayoutGrid,
  FileText,
  Eye,
  Info,
} from "lucide-react";
import type { CompanySettings } from "@/lib/types";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/types";
import { compressImageFile } from "@/lib/utils/image-compressor";

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const cached = localStorage.getItem("costlab_company_settings");
    if (cached) {
      try {
        setSettings({ ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(cached) });
      } catch (e) {}
    }

    async function loadSettings() {
      try {
        const res = await fetch("/api/company-settings");
        const json = await res.json();
        if (json.success && json.settings) {
          setSettings(json.settings);
          localStorage.setItem("costlab_company_settings", JSON.stringify(json.settings));
        }
      } catch (err) {}
    }
    loadSettings();
  }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    setUploadingLogo(true);
    setErrorMsg("");

    try {
      const compressed = await compressImageFile(file, 800, 0.85);
      const formData = new FormData();
      formData.append("logoFile", compressed);

      const res = await fetch("/api/company-settings", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.logoUrl) {
        const updated = json.settings ? json.settings : { ...settings, logoUrl: json.logoUrl };
        setSettings(updated);
        localStorage.setItem("costlab_company_settings", JSON.stringify(updated));
        window.dispatchEvent(new Event("company-settings-updated"));
        setSuccessMsg("อัปโหลดและบันทึกโลโก้สำเร็จเรียบร้อยแล้ว");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setErrorMsg(json.error || "ไม่สามารถอัปโหลดไฟล์รูปภาพได้");
      }
    } catch (err: any) {
      setErrorMsg(`เกิดข้อผิดพลาดในการอัปโหลด: ${err?.message || "โปรดลองใหม่อีกครั้ง"}`);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    const updated = { ...settings, logoUrl: "" };
    setSettings(updated);
    localStorage.setItem("costlab_company_settings", JSON.stringify(updated));
    window.dispatchEvent(new Event("company-settings-updated"));

    try {
      await fetch("/api/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updated }),
      });
      setSuccessMsg("ลบรูปโลโก้เรียบร้อยแล้ว");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e) {
      console.warn("Failed to persist logo removal:", e);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      localStorage.setItem("costlab_company_settings", JSON.stringify(settings));
      const res = await fetch("/api/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "บันทึกไม่สำเร็จ");

      setSuccessMsg("บันทึกข้อมูลบริษัทเรียบร้อยแล้ว");
      window.dispatchEvent(new Event("company-settings-updated"));
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
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
              <Building2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-1.5">
                  ตั้งค่าทั่วไป & ข้อมูลบริษัท
                  <span className="text-[11px] font-bold text-slate-400 tracking-normal hidden sm:inline">
                    / COMPANY PROFILE & SETTINGS
                  </span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0 shadow-2xs">
                  <Building2 className="w-3 h-3 text-[#d4f54e]" />
                  <span>ระบบหลัก</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>พร้อมใช้งาน</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                กำหนดข้อมูลองค์กร โลโก้ เลขประจำตัวผู้เสียภาษี และข้อมูลติดต่อสำหรับแสดงผลในระบบและหัวรายงาน
              </p>
            </div>
          </div>

          {/* Quick Action Save Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              form="company-settings-form"
              disabled={saving}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-2xs"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</span>
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
            <ShieldCheck size={13} />
          </div>
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN FORM & REALTIME PREVIEWS                                         */}
      {/* ========================================================================= */}
      <form id="company-settings-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column: Form Controls (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Card 1: Logo & Company Name */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/80 shadow-2xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
                    อัตลักษณ์และข้อมูลองค์กร
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 block">
                    COMPANY IDENTITY & BRANDING
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                ข้อมูลหลัก
              </span>
            </div>

            {/* Logo Upload Section */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-2 tracking-tight">
                โลโก้บริษัท / เครื่องหมายการค้า (Company Logo)
              </label>
              <div className="flex items-center gap-4 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                {/* Logo Preview Container */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 group shadow-2xs">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Logo"
                      className="w-full h-full object-contain p-1.5 transition duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300">
                      <Building2 size={24} className="text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">ไม่มีรูป</span>
                    </div>
                  )}

                  {settings.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute inset-0 bg-rose-950/75 text-rose-200 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all cursor-pointer backdrop-blur-[1px]"
                      title="ลบโลโก้"
                    >
                      <X size={16} className="text-white" />
                      <span className="text-[9px] font-bold mt-0.5 text-white">ลบรูป</span>
                    </button>
                  )}
                </div>

                {/* Upload Action & Notes */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-3 py-1.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold rounded-lg border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 text-xs shadow-2xs hover:border-slate-300">
                      {uploadingLogo ? (
                        <RefreshCw size={13} className="animate-spin text-emerald-600" />
                      ) : (
                        <Upload size={13} className="text-emerald-700" />
                      )}
                      <span>{uploadingLogo ? "กำลังอัปโหลด..." : "อัปโหลดโลโก้ใหม่"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                    </label>

                    {settings.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 font-medium rounded-lg border border-rose-200 transition text-xs shadow-2xs"
                      >
                        ลบออก
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    รองรับไฟล์ PNG, JPG, WebP สูงสุด 5MB (ระบบจะบีบอัดและปรับขนาดให้พอดีอัตโนมัติ)
                  </p>
                </div>
              </div>
            </div>

            {/* Name & Subtitle Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5 tracking-tight">
                  ชื่อบริษัท / องค์กร <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  placeholder="เช่น บจก. นวัตกรรมก่อสร้างไทย"
                  className="w-full px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs font-medium"
                />
                <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                  จะแสดงผลที่แถบเมนูด้านข้างและหัวเอกสารทุกฉบับ
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5 tracking-tight">
                  สโลแกน / คำอธิบายย่อย
                </label>
                <input
                  type="text"
                  value={settings.companySubTitle}
                  onChange={(e) => setSettings({ ...settings, companySubTitle: e.target.value })}
                  placeholder="เช่น ระบบบริหารและติดตามงบประมาณก่อสร้าง"
                  className="w-full px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs font-medium"
                />
                <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                  ข้อความสั้นใต้ชื่อบริษัทสำหรับเสริมความน่าเชื่อถือ
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Contact & Tax Information */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200/80 shadow-2xs">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
                    ข้อมูลติดต่อ & การออกเอกสาร
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 block">
                    BILLING & CONTACT INFORMATION
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                Tax & Invoicing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5 tracking-tight flex items-center gap-1">
                  <Receipt size={12} className="text-slate-400" />
                  <span>เลขประจำตัวผู้เสียภาษี (Tax ID)</span>
                </label>
                <input
                  type="text"
                  value={settings.taxId}
                  onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                  placeholder="0105559000000"
                  className="w-full px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5 tracking-tight flex items-center gap-1">
                  <Phone size={12} className="text-slate-400" />
                  <span>เบอร์โทรศัพท์</span>
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="02-123-4567, 081-xxx-xxxx"
                  className="w-full px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5 tracking-tight flex items-center gap-1">
                  <Mail size={12} className="text-slate-400" />
                  <span>อีเมล</span>
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="contact@company.com"
                  className="w-full px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 shadow-2xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5 tracking-tight flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                <span>ที่อยู่สำนักงาน / บริษัท</span>
              </label>
              <textarea
                rows={3}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="ระบุเลขที่ อาคาร ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์..."
                className="w-full px-3 py-2 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 resize-none shadow-2xs font-medium"
              />
            </div>
          </div>

          {/* Bottom Save Action Bar */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Info size={14} className="text-emerald-600 shrink-0" />
              <span>การบันทึกจะซิงก์ข้อมูลไปยังระบบหลักและอัปเดตแคชออฟไลน์ทันที</span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-2xs"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Interface & Document Previews (1 col) */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-4 sticky top-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#0b3531] text-[#34d399] flex items-center justify-center shrink-0 border border-emerald-700/50 shadow-2xs">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
                    ตัวอย่างการแสดงผล
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 block">
                    LIVE SYSTEM PREVIEW
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0 shadow-2xs">
                <Sparkles size={11} />
                <span>Live</span>
              </span>
            </div>

            {/* Preview 1: App Sidebar Header Preview */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 block flex items-center gap-1.5">
                <LayoutGrid size={12} className="text-emerald-700" />
                <span>1. แถบเมนูด้านข้าง (Dual Sidebar Brand)</span>
              </span>

              <div className="rounded-xl bg-[#0b3531] text-slate-100 p-3 border border-[#062e2b] shadow-2xs space-y-2.5">
                {/* Dual Layout Mockup */}
                <div className="flex items-center gap-3 bg-[#062e2b] p-2 rounded-lg border border-[#13443e]">
                  {/* Slim Rail Icon Mockup */}
                  <div className="w-9 h-9 rounded-md bg-[#072825] border border-[#144d47] flex items-center justify-center shrink-0 overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 size={18} className="text-[#d4f54e]" />
                    )}
                  </div>

                  {/* Drawer Title Mockup */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate text-xs leading-snug">
                      {settings.companyName || "CostLab Executive"}
                    </div>
                    <div className="text-[11px] text-[#a2ccc3] font-medium truncate leading-tight mt-0.5">
                      {settings.companySubTitle || "ระบบบริหารและติดตามงบประมาณ"}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-[#8eaba5] px-1 flex items-center justify-between">
                  <span>สถานะแถบข้าง</span>
                  <span className="text-[#d4f54e] font-semibold">อัปเดตแบบเรียลไทม์</span>
                </div>
              </div>
            </div>

            {/* Preview 2: Document & Report Header Preview */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-600 block flex items-center gap-1.5">
                <FileText size={12} className="text-indigo-600" />
                <span>2. หัวเอกสาร & รายงานสรุป (Report Header)</span>
              </span>

              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/90 shadow-2xs space-y-2">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <Building2 size={16} className="text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate text-xs">
                      {settings.companyName || "ชื่อบริษัท / องค์กร"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Tax ID: {settings.taxId || "-"}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {settings.phone ? `โทร: ${settings.phone}` : ""} {settings.email ? `| อีเมล: ${settings.email}` : ""}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 px-1 truncate">
                  {settings.address || "ยังไม่ได้ระบุที่อยู่บริษัท"}
                </div>
              </div>
            </div>

            {/* Quick Helper Tips */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-emerald-950 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1 text-emerald-900">
                <Sparkles size={12} className="text-emerald-700" />
                <span>คำแนะนำการใช้งาน</span>
              </div>
              <p className="text-emerald-900/80 leading-relaxed font-normal">
                การตั้งค่าข้อมูลบริษัทที่ครบถ้วนจะช่วยให้หัวเอกสาร PO, ใบเบิกเงินสดย่อย และรายงานสรุปทางการเงินแสดงผลได้อย่างถูกต้องเป็นมืออาชีพ
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}


