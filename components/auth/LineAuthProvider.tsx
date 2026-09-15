"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { MessageSquare, Phone, UserCheck, Shield, RefreshCw, X, LogIn } from "lucide-react";

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

interface LineAuthContextType {
  isLiffReady: boolean;
  liffId: string;
  lineProfile: LineProfile | null;
  isLoading: boolean;
  loginWithLine: () => void;
  openPhoneModal: (profile?: LineProfile) => void;
}

const LineAuthContext = createContext<LineAuthContextType>({
  isLiffReady: false,
  liffId: "",
  lineProfile: null,
  isLoading: false,
  loginWithLine: () => {},
  openPhoneModal: () => {},
});

export const useLineAuth = () => useContext(LineAuthContext);

export function LineAuthProvider({
  children,
  isAuthenticated = false,
}: {
  children: React.ReactNode;
  isAuthenticated?: boolean;
}) {
  const [liffId, setLiffId] = useState("");
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [lineProfile, setLineProfile] = useState<LineProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [liffInstance, setLiffInstance] = useState<any>(null);

  // Registration / Account Linking Modal State
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registering, setRegistering] = useState(false);

  // 1. Fetch LIFF ID dynamically from Server
  useEffect(() => {
    async function initLiff() {
      try {
        let activeLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";
        if (!activeLiffId) {
          const res = await fetch("/api/line/config");
          const data = await res.json();
          activeLiffId = data?.liffId || "";
        }
        if (activeLiffId) {
          setLiffId(activeLiffId);
          await loadLiffSdk(activeLiffId);
        }
      } catch (err) {
        console.warn("⚠️ Failed to load LIFF config:", err);
      }
    }
    initLiff();
  }, []);

  // 2. Load & Init @line/liff SDK
  async function loadLiffSdk(id: string) {
    try {
      let liff: any;
      try {
        // @ts-ignore
        liff = (await import("@line/liff")).default;
      } catch (err) {
        if (typeof window !== "undefined" && (window as any).liff) {
          liff = (window as any).liff;
        } else {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load LIFF CDN"));
            document.head.appendChild(script);
          });
          liff = (window as any).liff;
        }
      }

      if (!liff) return;
      await liff.init({ liffId: id });
      setLiffInstance(liff);
      setIsLiffReady(true);

      const isLoggedOutSession = typeof window !== "undefined" && sessionStorage.getItem("line_user_logged_out") === "true";

      if (liff.isLoggedIn() && !isLoggedOutSession) {
        const profile = await liff.getProfile();
        const pData: LineProfile = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
        };
        setLineProfile(pData);

        // Only trigger auto-login if the user is NOT already authenticated in the app
        if (!isAuthenticated) {
          await checkAndLoginLineUser(pData, false);
        }
      }
    } catch (err: any) {
      console.warn("⚠️ LIFF SDK init error:", err);
    }
  }

  // 3. Attempt LINE Login (isManual: true when user clicks login button, false when auto-login on LoginScreen)
  async function checkAndLoginLineUser(profile: LineProfile, isManual = false) {
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("line_user_logged_out");
        }

        // Refresh/redirect to current URL only if user was not authenticated or if user manually clicked login
        if (!isAuthenticated || isManual) {
          const currentUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
          window.location.href = currentUrl || "/";
        }
      } else {
        // User not found in DB ➡️ Prompt for Phone Registration / Account Linking
        setShowPhoneModal(true);
      }
    } catch (err) {
      console.error("❌ LINE Auth login check failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // 4. Trigger LINE Login (Redirects to LINE OAuth if not logged in)
  async function loginWithLine() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("line_user_logged_out");
    }
    let currentLiffId = liffId;
    let currentLiff = liffInstance;

    // Retry loading config dynamically if liffId state hasn't populated yet
    if (!currentLiffId || !currentLiff) {
      setIsLoading(true);
      try {
        const res = await fetch("/api/line/config");
        const data = await res.json();
        const activeLiffId = data?.liffId || process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";
        if (activeLiffId) {
          currentLiffId = activeLiffId;
          setLiffId(activeLiffId);
          // @ts-ignore
          const liff = (await import("@line/liff")).default;
          await liff.init({ liffId: activeLiffId });
          setLiffInstance(liff);
          setIsLiffReady(true);
          currentLiff = liff;
        }
      } catch (err) {
        console.warn("⚠️ Failed to re-fetch LIFF config on login:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (!currentLiffId) {
      alert("⚠️ กรุณากำหนดค่า LIFF ID ในการตั้งค่า LINE System (/settings/line-system) ครับ");
      return;
    }

    if (currentLiff) {
      if (!currentLiff.isLoggedIn()) {
        const currentUri = typeof window !== "undefined" ? window.location.href : undefined;
        currentLiff.login(currentUri ? { redirectUri: currentUri } : undefined);
      } else {
        try {
          const profile = await currentLiff.getProfile();
          const pData: LineProfile = {
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            statusMessage: profile.statusMessage,
          };
          setLineProfile(pData);
          await checkAndLoginLineUser(pData, true);
        } catch (err: any) {
          alert(`⚠️ ไม่สามารถดึงโปรไฟล์ LINE ได้: ${err?.message || "โปรดลองใหม่อีกครั้ง"}`);
        }
      }
    } else {
      alert("⚠️ ระบบกำลังเชื่อมต่อ LIFF SDK กรุณาลองใหม่อีกครั้งในครู่เดียวครับ");
    }
  }

  function openPhoneModal(profile?: LineProfile) {
    if (profile) setLineProfile(profile);
    setShowPhoneModal(true);
  }

  // 5. Submit Registration / Account Linking Form
  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneInput.trim() || !lineProfile) return;

    setRegistering(true);
    setRegisterError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          lineUserId: lineProfile.userId,
          displayName: lineProfile.displayName,
          pictureUrl: lineProfile.pictureUrl,
          phone: phoneInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowPhoneModal(false);
        const currentUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
        window.location.href = currentUrl || "/";
      } else {
        setRegisterError(data.error || "เกิดข้อผิดพลาดในการลงทะเบียน");
      }
    } catch (err: any) {
      setRegisterError(err.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <LineAuthContext.Provider
      value={{
        isLiffReady,
        liffId,
        lineProfile,
        isLoading,
        loginWithLine,
        openPhoneModal,
      }}
    >
      {children}

      {/* Account Linking / Registration Modal */}
      {showPhoneModal && lineProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base text-slate-900 leading-tight">ผูกบัญชี LINE กับระบบ</h3>
                  <p className="text-xs text-slate-500 font-medium">ยืนยันเบอร์โทรศัพท์ที่ลงทะเบียนไว้ในระบบ</p>
                </div>
              </div>
              <button
                onClick={() => setShowPhoneModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Avatar & Display Name from LINE */}
            <div className="flex items-center gap-3 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
              {lineProfile.pictureUrl ? (
                <img
                  src={lineProfile.pictureUrl}
                  alt={lineProfile.displayName}
                  className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center text-base shrink-0">
                  {lineProfile.displayName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-900 truncate">{lineProfile.displayName}</div>
                <div className="text-xs text-emerald-700 font-mono truncate">{lineProfile.userId}</div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
              <div className="text-slate-800 flex items-center gap-1.5 font-medium">
                <Shield size={13} className="text-slate-500" />
                <span>คำแนะนำการผูกบัญชี:</span>
              </div>
              <p className="m-0 leading-relaxed">
                • กรอก<b>เบอร์โทรศัพท์ที่ลงทะเบียนไว้ในระบบ</b> เพื่อผูกบัญชี LINE กับข้อมูลผู้ใช้เดิม<br />
                • หากยังไม่มีข้อมูลในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มข้อมูลก่อน
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-sm font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
                  <Phone size={16} className="text-emerald-700" />
                  <span>เบอร์โทรศัพท์ *</span>
                </label>
                <input
                  type="tel"
                  placeholder="ระบุเบอร์โทรศัพท์ เช่น 0812345678"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/80 border-2 border-slate-300 rounded-xl text-base sm:text-lg font-mono font-bold tracking-wider text-slate-900 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 transition-all shadow-inner"
                  required
                  autoFocus
                />
              </div>

              {registerError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs ">
                  {registerError}
                </div>
              )}

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-xs rounded-xl hover:bg-slate-50 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={registering || !phoneInput.trim()}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {registering ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck size={15} />
                      <span>ยืนยันข้อมูล</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LineAuthContext.Provider>
  );
}
