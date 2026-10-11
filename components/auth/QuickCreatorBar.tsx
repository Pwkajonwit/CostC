"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Phone,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  X,
  ShieldCheck,
  Check,
  ChevronRight,
  UserCheck,
  LogIn,
  MessageSquare
} from "lucide-react";

export interface QuickCreator {
  name: string;
  fullName?: string;
  phone: string;
  employeeId?: string;
  role?: string;
  pictureUrl?: string;
  lineUserId?: string;
  isLineVerified?: boolean;
}

const STORAGE_KEY = "costcode_quick_creator";

export function getStoredQuickCreator(): QuickCreator | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.name || parsed.phone)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to read creator from localStorage:", err);
  }

  // Fallback to cookies if localStorage is empty
  try {
    const cookies = document.cookie.split(";").reduce((acc, c) => {
      const [k, v] = c.trim().split("=");
      if (k && v) acc[k] = decodeURIComponent(v);
      return acc;
    }, {} as Record<string, string>);

    if (cookies["auth_name"]) {
      return {
        name: cookies["auth_name"],
        phone: cookies["auth_phone"] || "",
        employeeId: cookies["auth_employee_id"] || "",
        role: cookies["auth_role"] || "User",
        pictureUrl: cookies["auth_picture_url"] || "",
        lineUserId: cookies["auth_line_user_id"] || "",
        isLineVerified: Boolean(cookies["auth_line_user_id"])
      };
    }
  } catch (err) {
    console.warn("Failed to read creator from cookies:", err);
  }

  return null;
}

export function saveQuickCreator(creator: QuickCreator) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creator));
  } catch (err) {
    console.warn("Failed to save creator to localStorage:", err);
  }

  // Set 1-year cookies so other parts of the app can share this identity
  try {
    const maxAge = 365 * 24 * 60 * 60;
    document.cookie = `auth_name=${encodeURIComponent(creator.name)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (creator.phone) {
      document.cookie = `auth_phone=${encodeURIComponent(creator.phone)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
    if (creator.employeeId) {
      document.cookie = `auth_employee_id=${encodeURIComponent(creator.employeeId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
    if (creator.pictureUrl) {
      document.cookie = `auth_picture_url=${encodeURIComponent(creator.pictureUrl)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
    if (creator.lineUserId) {
      document.cookie = `auth_line_user_id=${encodeURIComponent(creator.lineUserId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  } catch (err) {
    console.warn("Failed to set cookies:", err);
  }
}

export function clearQuickCreator() {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to remove creator from localStorage:", err);
  }

  try {
    document.cookie = "auth_name=; path=/; max-age=0";
    document.cookie = "auth_phone=; path=/; max-age=0";
    document.cookie = "auth_employee_id=; path=/; max-age=0";
    document.cookie = "auth_picture_url=; path=/; max-age=0";
    document.cookie = "auth_line_user_id=; path=/; max-age=0";
  } catch (err) {}
}

interface QuickCreatorBarProps {
  creator: QuickCreator | null;
  onCreatorChange: (creator: QuickCreator | null) => void;
  accentColor?: "emerald" | "blue" | "indigo";
}

export function QuickCreatorBar({
  creator,
  onCreatorChange,
  accentColor = "emerald"
}: QuickCreatorBarProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [manualNameInput, setManualNameInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);

  // LIFF & LINE Identity states
  const [liffLoading, setLiffLoading] = useState(false);
  const [liffInstance, setLiffInstance] = useState<any>(null);
  const [lineProfile, setLineProfile] = useState<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null>(null);
  const [needPhoneLink, setNeedPhoneLink] = useState(false);

  // 1. LIFF Auto-detection and profile matching on mount
  useEffect(() => {
    let isMounted = true;

    async function initLiffAuth() {
      // Step A: Load stored identity first so UI renders instantly
      const stored = getStoredQuickCreator();
      if (stored && isMounted) {
        onCreatorChange(stored);
      }

      // Step B: Auto-detect via LIFF SDK
      try {
        let activeLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";
        if (!activeLiffId) {
          const cfgRes = await fetch("/api/line/config");
          const cfgData = await cfgRes.json();
          activeLiffId = cfgData?.liffId || "2011122961-40UXax1L";
        }
        if (!activeLiffId) return;

        // Dynamic import LIFF SDK
        const liffModule = await import("@line/liff");
        const liff = liffModule.default || (window as any).liff;
        if (!liff) return;

        await liff.init({ liffId: activeLiffId });
        if (!isMounted) return;
        setLiffInstance(liff);

        // If inside LINE app or already logged in via LIFF
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          if (!isMounted) return;
          setLineProfile({
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
          });

          // Match LINE user ID against master_members
          const authRes = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "login",
              lineUserId: profile.userId,
              displayName: profile.displayName,
              pictureUrl: profile.pictureUrl
            })
          });

          const authData = await authRes.json();
          if (authRes.ok && authData.success && authData.user) {
            const u = authData.user;
            const newCreator: QuickCreator = {
              name: u.displayName || u.fullName || profile.displayName,
              fullName: u.fullName || "",
              phone: u.phone || "-",
              employeeId: u.id || "",
              role: u.role || "User",
              pictureUrl: profile.pictureUrl || u.pictureUrl || "",
              lineUserId: profile.userId,
              isLineVerified: true
            };
            saveQuickCreator(newCreator);
            if (isMounted) {
              onCreatorChange(newCreator);
              setNeedPhoneLink(false);
            }
          } else {
            // Logged in to LINE but not yet linked in master_members table
            if (isMounted && (!stored || !stored.name)) {
              setNeedPhoneLink(true);
              setModalOpen(true);
            }
          }
        }
      } catch (err) {
        console.warn("QuickCreatorBar LIFF auto-detect notice:", err);
      }
    }

    initLiffAuth();
    return () => {
      isMounted = false;
    };
  }, [onCreatorChange]);

  // 2. Explicit LINE Login (Triggered when user clicks LINE button)
  const handleLineLogin = async () => {
    setLiffLoading(true);
    setSearchError(null);

    try {
      let liff = liffInstance;
      if (!liff) {
        let activeLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";
        if (!activeLiffId) {
          const cfgRes = await fetch("/api/line/config");
          const cfgData = await cfgRes.json();
          activeLiffId = cfgData?.liffId || "2011122961-40UXax1L";
        }
        const liffModule = await import("@line/liff");
        liff = liffModule.default || (window as any).liff;
        await liff.init({ liffId: activeLiffId });
        setLiffInstance(liff);
      }

      if (!liff) {
        throw new Error("ไม่สามารถโหลด LINE LIFF SDK ได้");
      }

      if (!liff.isLoggedIn()) {
        const currentUri = typeof window !== "undefined" ? window.location.href : undefined;
        liff.login(currentUri ? { redirectUri: currentUri } : undefined);
        return;
      }

      // If already logged in, fetch profile and link
      const profile = await liff.getProfile();
      setLineProfile({
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl
      });

      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl
        })
      });

      const authData = await authRes.json();
      if (authRes.ok && authData.success && authData.user) {
        const u = authData.user;
        const newCreator: QuickCreator = {
          name: u.displayName || u.fullName || profile.displayName,
          fullName: u.fullName || "",
          phone: u.phone || "-",
          employeeId: u.id || "",
          role: u.role || "User",
          pictureUrl: profile.pictureUrl || u.pictureUrl || "",
          lineUserId: profile.userId,
          isLineVerified: true
        };
        saveQuickCreator(newCreator);
        onCreatorChange(newCreator);
        setModalOpen(false);
      } else {
        // Needs 1-time phone linking
        setNeedPhoneLink(true);
        setModalOpen(true);
      }
    } catch (err: any) {
      setSearchError(err?.message || "เข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLiffLoading(false);
    }
  };

  // 3. Search / Link by Phone or Employee ID
  const handlePhoneSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = phoneInput.trim();
    if (!clean) {
      setSearchError("กรุณากรอกเบอร์โทรศัพท์หรือชื่อ");
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // If we have active lineProfile, link it with this member account!
      const isLinkingLine = Boolean(lineProfile && lineProfile.userId);
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLinkingLine
            ? {
                action: "link",
                lineUserId: lineProfile!.userId,
                pictureUrl: lineProfile!.pictureUrl,
                phone: clean
              }
            : { phone: clean, identifier: clean }
        )
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        const u = data.user;
        const newCreator: QuickCreator = {
          name: u.displayName || u.fullName || clean,
          fullName: u.fullName || "",
          phone: u.phone || clean,
          employeeId: u.id || "",
          role: u.role || "User",
          pictureUrl: lineProfile?.pictureUrl || u.pictureUrl || "",
          lineUserId: lineProfile?.userId || "",
          isLineVerified: Boolean(lineProfile?.userId)
        };
        saveQuickCreator(newCreator);
        onCreatorChange(newCreator);
        setModalOpen(false);
        setPhoneInput("");
        setNeedPhoneLink(false);
        setShowManualFallback(false);
      } else {
        setShowManualFallback(true);
        setSearchError(data.error || "ไม่พบเบอร์นี้ในระบบพนักงาน กรุณากรอกชื่อของคุณด้านล่างเพื่อเริ่มบันทึกงาน");
      }
    } catch (err: any) {
      setShowManualFallback(true);
      setSearchError(err?.message || "ไม่สามารถเชื่อมต่อระบบได้ กรุณาระบุชื่อของคุณด้านล่าง");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = manualNameInput.trim();
    if (!name) {
      setSearchError("กรุณากรอกชื่อผู้บันทึก");
      return;
    }

    const newCreator: QuickCreator = {
      name,
      phone: phoneInput.trim() || "-",
      role: "User",
      pictureUrl: lineProfile?.pictureUrl || "",
      lineUserId: lineProfile?.userId || ""
    };

    saveQuickCreator(newCreator);
    onCreatorChange(newCreator);
    setModalOpen(false);
    setPhoneInput("");
    setManualNameInput("");
    setShowManualFallback(false);
    setSearchError(null);
  };

  const handleSwitchUser = () => {
    setPhoneInput(creator?.phone || "");
    setManualNameInput(creator?.name || "");
    setShowManualFallback(false);
    setSearchError(null);
    setModalOpen(true);
  };

  const themeClasses = {
    emerald: {
      badgeBg: "bg-emerald-50/80 border-emerald-200/80 hover:bg-emerald-50",
      iconBg: "bg-emerald-100 text-emerald-700",
      accentText: "text-emerald-700",
      btnPrimary: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
      ring: "focus:ring-emerald-500/20 focus:border-emerald-500"
    },
    blue: {
      badgeBg: "bg-blue-50/80 border-blue-200/80 hover:bg-blue-50",
      iconBg: "bg-blue-100 text-blue-700",
      accentText: "text-blue-700",
      btnPrimary: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20",
      ring: "focus:ring-blue-500/20 focus:border-blue-500"
    },
    indigo: {
      badgeBg: "bg-indigo-50/80 border-indigo-200/80 hover:bg-indigo-50",
      iconBg: "bg-indigo-100 text-indigo-700",
      accentText: "text-indigo-700",
      btnPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20",
      ring: "focus:ring-indigo-500/20 focus:border-indigo-500"
    }
  }[accentColor];

  return (
    <>
      {/* IDENTITY BADGE / BAR */}
      <div className="w-full">
        {creator ? (
          <div
            className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${themeClasses.badgeBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {creator.pictureUrl ? (
                <img
                  src={creator.pictureUrl}
                  alt={creator.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/30 shrink-0"
                />
              ) : (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ring-2 ring-white shadow-xs ${themeClasses.iconBg}`}
                >
                  {creator.name ? creator.name.slice(0, 1) : <User size={14} />}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase font-semibold text-slate-600 tracking-wider">
                    ผู้เปิดงาน / ผู้สร้าง
                  </span>
                  {creator.isLineVerified || creator.lineUserId ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block animate-pulse" />
                      LINE LIFF
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-white/80 text-slate-600 border border-slate-200">
                      <ShieldCheck size={10} className="text-emerald-600" />
                      จำไว้ในเครื่อง
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800 truncate">
                  {creator.name}
                  {creator.fullName && creator.fullName !== creator.name && (
                    <span className="text-slate-500 font-normal ml-1 text-[11px] hidden sm:inline">
                      ({creator.fullName})
                    </span>
                  )}
                  {creator.phone && creator.phone !== "-" && (
                    <span className="text-slate-500 font-normal ml-1.5 text-[11px]">
                      • {creator.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSwitchUser}
              className="ml-2 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs transition shrink-0 cursor-pointer"
            >
              สลับผู้ใช้
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-emerald-200 bg-emerald-50/90 text-emerald-950 transition-all shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#06C755] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                <MessageSquare size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">เข้าสู่ระบบด้วย LINE LIFF</div>
                <div className="text-[10px] text-emerald-800 truncate">ผูกบัญชีพนักงานอัตโนมัติ ไม่ต้องกรอกเบอร์</div>
              </div>
            </div>

            <button
              type="button"
              disabled={liffLoading}
              onClick={handleLineLogin}
              className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-white shadow-2xs transition shrink-0 cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              {liffLoading ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>กำลังเชื่อมต่อ...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบด้วย LINE</span>
                  <ChevronRight size={13} />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* MODAL: IDENTIFY USER (LINE LIFF + PHONE FALLBACK) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 text-slate-800">
            {/* Modal Header */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {needPhoneLink ? "ผูกบัญชี LINE กับพนักงาน" : "ระบุตัวตนผู้เปิดงาน"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {needPhoneLink ? "ทำเพียงครั้งเดียว ระบบจะจำบัญชี LINE ของคุณไว้" : "ใช้งานผ่าน LINE LIFF สะดวก รวดเร็ว"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {searchError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-tight">{searchError}</span>
                </div>
              )}

              {/* Notice when LINE detected but needs 1-time phone link */}
              {needPhoneLink && lineProfile && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                  {lineProfile.pictureUrl ? (
                    <img
                      src={lineProfile.pictureUrl}
                      alt={lineProfile.displayName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#06C755] text-white flex items-center justify-center shrink-0">
                      <MessageSquare size={18} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-950 truncate">
                      {lineProfile.displayName}
                    </div>
                    <div className="text-[10px] text-emerald-700">
                      ตรวจพบบัญชี LINE แล้ว กรุณากรอกเบอร์โทรพนักงานเพื่อผูกบัญชี
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Action: LINE LIFF Login Button (if not already detected) */}
              {!needPhoneLink && (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={liffLoading}
                    onClick={handleLineLogin}
                    className="w-full h-10.5 rounded-xl text-xs font-bold bg-[#06C755] hover:bg-[#05b34c] text-white flex items-center justify-center gap-2 shadow-sm transition cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {liffLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>กำลังเชื่อมต่อ LINE...</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare size={16} />
                        <span>เข้าสู่ระบบด้วย LINE (LIFF)</span>
                      </>
                    )}
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-3 text-[10px] text-slate-400">หรือค้นหาด้วยเบอร์โทร</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>
                </div>
              )}

              {/* Form: Search/Link by Phone */}
              <form onSubmit={handlePhoneSearch} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>{needPhoneLink ? "เบอร์โทรศัพท์ที่ลงทะเบียนไว้" : "เบอร์โทรศัพท์ หรือ ชื่อเล่น"}</span>
                    <span className="text-[10px] text-slate-400 font-normal">เช่น 0812345678</span>
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      autoFocus={needPhoneLink}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="กรอกเบอร์โทร หรือ ชื่อพนักงาน"
                      className={`w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${themeClasses.ring}`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSearching || !phoneInput.trim()}
                  className={`w-full h-10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 ${themeClasses.btnPrimary}`}
                >
                  {isSearching ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>กำลังตรวจสอบข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <span>{needPhoneLink ? "ผูกบัญชี LINE กับพนักงานนี้" : "ค้นหาและยืนยันตัวตน"}</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              {/* Fallback Form: Manual Name Input if not in member database */}
              {showManualFallback && (
                <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in">
                  <div className="text-[11px] text-slate-600 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    💡 ไม่เป็นไรครับ หากเบอร์ยังไม่ได้ลงทะเบียนในระบบ สามารถพิมพ์ชื่อเรียกของคุณเพื่อเริ่มบันทึกงานได้ทันที
                  </div>
                  <form onSubmit={handleManualSave} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        ชื่อผู้บันทึก (ชื่อเล่น / ชื่อจริง) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={manualNameInput}
                        onChange={(e) => setManualNameInput(e.target.value)}
                        placeholder="เช่น ช่างเอก, วิศวกรต้น, PW-ทีมงาน"
                        className={`w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${themeClasses.ring}`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!manualNameInput.trim()}
                      className="w-full h-10 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Check size={14} />
                      <span>บันทึกชื่อนี้และเริ่มใช้งาน</span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Modal Footer Note */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
              <span>🔒 เชื่อมต่อปลอดภัยผ่าน LINE Official</span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
