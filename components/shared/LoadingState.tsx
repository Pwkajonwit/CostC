"use client";

import { Loader2 } from "lucide-react";

export type LoadingStateProps = {
  title?: string;
  message?: string;
  compact?: boolean;
  type?: "dashboard" | "table" | "detail" | "compact";
};

export function LoadingState({
  title = "กำลังโหลดข้อมูล...",
  message = "ระบบกำลังประมวลผลและดึงข้อมูลภาพรวมสำหรับคุณ",
  compact = false,
  type = "dashboard",
}: LoadingStateProps) {
  if (compact || type === "compact") {
    return (
      <div className="flex items-center justify-center gap-2.5 p-3 text-slate-700 text-xs ">
        <Loader2 size={16} className="animate-spin text-emerald-600 shrink-0" />
        {title ? <span>{title}</span> : null}
      </div>
    );
  }

  return (
    <div className="w-full min-h-[45vh] flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-150">
      <div className="relative mb-4 flex items-center justify-center">
        {/* Soft glowing aura */}
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center animate-pulse">
          <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-emerald-600">
            <Loader2 size={24} className="animate-spin" />
          </div>
        </div>
      </div>

      <h3 className="text-sm text-slate-800 tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-500 font-medium max-w-xs leading-relaxed">
        {message}
      </p>
    </div>
  );
}
