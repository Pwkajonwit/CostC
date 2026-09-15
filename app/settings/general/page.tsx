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
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-3.5 font-sans text-xs text-slate-800">
      {/* Compact Page Header Title */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 bg-white p-3 rounded-md border shadow-2xs">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-emerald-700 shrink-0" />
          <h1 className="text-sm font-medium text-slate-900 tracking-tight">ตั้งค่าทั่วไป & ข้อมูลบริษัท (Company Profile)</h1>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md flex items-center gap-2 text-xs">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-900 rounded-md flex items-center gap-2 text-xs">
          <ShieldCheck size={14} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Form Controls (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Section 1: Logo & Company Name */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-medium text-slate-900 flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-500" /> ชื่อองค์กร & โลโก้
              </span>
            </div>

            {/* Logo Row */}
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 group">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 size={20} className="text-slate-400" />
                )}
                {settings.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute inset-0 bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer"
                    title="ลบโลโก้"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded border border-slate-300 transition cursor-pointer flex items-center gap-1.5 shrink-0 text-xs disabled:opacity-50">
                  {uploadingLogo ? (
                    <RefreshCw size={13} className="animate-spin text-slate-600" />
                  ) : (
                    <Upload size={13} />
                  )}
                  <span>{uploadingLogo ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" />
                </label>
              </div>
            </div>

            {/* Name Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-slate-700 block mb-1 text-xs">ชื่อบริษัท / องค์กร</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  placeholder="ระบุชื่อบริษัท..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-normal text-slate-900 focus:outline-none focus:border-slate-500 text-xs"
                />
              </div>
              <div>
                <label className="text-slate-700 block mb-1 text-xs">สโลแกน / แท็กไลน์</label>
                <input
                  type="text"
                  value={settings.companySubTitle}
                  onChange={(e) => setSettings({ ...settings, companySubTitle: e.target.value })}
                  placeholder="ระบุคำอธิบายย่อย..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-normal text-slate-900 focus:outline-none focus:border-slate-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Tax Info */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-medium text-slate-900 flex items-center gap-1.5">
                <Receipt size={14} className="text-slate-500" /> ข้อมูลติดต่อ & ออกบิล
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-slate-700 block mb-1 text-xs">Tax ID</label>
                <input
                  type="text"
                  value={settings.taxId}
                  onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                  placeholder="เลขผู้เสียภาษี..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-900 focus:outline-none focus:border-slate-500 text-xs"
                />
              </div>
              <div>
                <label className="text-slate-700 block mb-1 text-xs">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="เบอร์โทรศัพท์..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-slate-900 focus:outline-none focus:border-slate-500 text-xs"
                />
              </div>
              <div>
                <label className="text-slate-700 block mb-1 text-xs">อีเมล</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="อีเมล..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-normal text-slate-900 focus:outline-none focus:border-slate-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-700 block mb-1 text-xs">ที่อยู่บริษัท</label>
              <textarea
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="ที่อยู่บริษัท..."
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-normal text-slate-900 focus:outline-none focus:border-slate-500 resize-none text-xs"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-0.5">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-2xs"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Sidebar Preview (1 col) */}
        <div>
          <div className="bg-[#0b3531] border border-[#0d3f3a] rounded-md p-3.5 text-slate-100 space-y-3 sticky top-4 shadow-2xs">
            <div className="text-xs font-medium uppercase text-[#8eaba5] flex items-center justify-between border-b border-[#12443e] pb-1.5">
              <span>Sidebar Live Preview</span>
              <span className="text-xs bg-[#d4f54e] text-[#0b3531] px-1.5 py-0.2 rounded font-medium">
                Live
              </span>
            </div>

            {/* Sidebar Preview Component */}
            <div className="p-2.5 bg-[#062e2b] rounded border border-[#13443e] flex items-center gap-2">
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 size={16} className="text-[#d4f54e]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white truncate text-xs leading-tight">
                  {settings.companyName || "ชื่อบริษัท..."}
                </div>
                <div className="text-xs text-[#8eaba5] truncate leading-tight mt-0.5">
                  {settings.companySubTitle || "คำอธิบายย่อย..."}
                </div>
              </div>
            </div>

            {/* Header Document Preview */}
            <div className="p-2.5 bg-white text-slate-900 rounded border border-slate-200 space-y-1">
              <div className="text-xs text-slate-400 uppercase">ตัวอย่างหัวรายงาน</div>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <Building2 size={12} className="text-slate-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate text-xs">{settings.companyName || "ชื่อบริษัท..."}</div>
                  <div className="text-xs text-slate-500 font-mono">Tax ID: {settings.taxId || "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

