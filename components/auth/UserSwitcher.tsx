"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";
import { showConfirm } from "@/components/shared/ToastProvider";
import type { SheetRow } from "@/lib/types";

type UserSwitcherProps = {
  people?: SheetRow[];
  currentUser: { id: string; name: string; role: string; pictureUrl?: string } | null;
  theme?: "dark" | "light";
  isCollapsed?: boolean;
  compact?: boolean;
};

export function UserSwitcher({ currentUser, theme = "dark", isCollapsed = false, compact = false }: UserSwitcherProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: "ออกจากระบบ",
      message: "ต้องการออกจากระบบใช่หรือไม่?",
      confirmText: "ออกจากระบบ",
      cancelText: "ยกเลิก",
      variant: "warning"
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("line_user_logged_out", "true");
      }
      try {
        // @ts-ignore
        const liff = (await import("@line/liff")).default;
        if (liff && liff.isLoggedIn()) {
          liff.logout();
        }
      } catch (e) {}

      await fetch("/api/auth", { method: "DELETE" });
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  const isLight = theme === "light";

  if (compact) {
    if (isCollapsed) {
      return (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          title={`ออกจากระบบ (${currentUser.name || currentUser.id})`}
          className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center text-xs shadow-md cursor-pointer hover:opacity-90 transition shrink-0 overflow-hidden"
        >
          {currentUser.pictureUrl ? (
            <img src={currentUser.pictureUrl} alt={currentUser.name} className="w-full h-full object-cover" />
          ) : (
            currentUser.name ? String(currentUser.name).slice(0, 2).toUpperCase() : "CT"
          )}
        </button>
      );
    }

    return (
      <div className="relative w-full" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          className={`sidebar-profile-btn flex items-center justify-between gap-1.5 min-w-0 w-full text-left p-1.5 rounded-lg transition-colors ${isLight ? "hover:bg-slate-200/70" : "hover:bg-white/10"}`}
          title="คลิกเพื่อดูโปรไฟล์และออกจากระบบ"
        >
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            <div className={`h-7.5 w-7.5 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${isLight ? "bg-slate-200 text-slate-700" : "bg-white/20 text-white"}`}>
              {currentUser.pictureUrl ? (
                <img src={currentUser.pictureUrl} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <User size={15} className={isLight ? "text-slate-700" : "text-white"} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-xs truncate leading-tight flex items-center gap-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                <span>{currentUser.name || currentUser.id}</span>
                <ChevronDown size={12} className={`${isLight ? "text-slate-500" : "text-white/80"} transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </span>
              <span className={`text-xs uppercase tracking-wider leading-none mt-0.5 ${isLight ? "text-slate-500" : "text-white/70"}`}>
                {currentUser.role}
              </span>
            </div>
          </div>
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-1.5 w-44 bg-white rounded-lg shadow-xl border border-slate-200 p-1.5 z-50 text-slate-800 animate-in fade-in slide-in-from-bottom-1">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut size={16} className="text-red-500 shrink-0" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="flex items-center justify-center w-full py-1">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          title="ออกจากระบบ"
          className={`p-2 rounded-md transition-colors disabled:opacity-50 ${isLight ? "text-gray-500 hover:text-gray-900 hover:bg-gray-200" : "text-white/70 hover:text-white hover:bg-white/10"}`}
        >
          <LogOut size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isLight ? "bg-gray-100 border-gray-200" : "bg-white/10 border-white/20"}`}>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${isLight ? "bg-gray-200" : "bg-white/20"}`}>
          {currentUser.pictureUrl ? (
            <img src={currentUser.pictureUrl} alt={currentUser.name} className="w-full h-full object-cover" />
          ) : (
            <User size={16} className={isLight ? "text-gray-600" : "text-white"} />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className={`text-sm font-medium truncate leading-tight ${isLight ? "text-gray-900" : "text-white"}`}>
            {currentUser.name || currentUser.id}
          </span>
          <span className={`text-xs uppercase tracking-wider ${isLight ? "text-gray-500" : "text-white/70"}`}>
            {currentUser.role}
          </span>
        </div>
      </div>
      
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        title="ออกจากระบบ"
        className={`ml-2 p-1.5 rounded-md transition-colors disabled:opacity-50 ${isLight ? "text-gray-500 hover:text-gray-900 hover:bg-gray-200" : "text-white/70 hover:text-white hover:bg-white/10"}`}
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}

