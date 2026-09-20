"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";

type StatusData = {
  isConfigured: boolean;
  maskedUrl: string;
  isAnonKeySet: boolean;
  isServiceKeySet: boolean;
  connectionOk: boolean;
  latencyMs: number;
  connectionMessage: string;
  billsBucketStatus: string;
  tableStats: Array<{
    name: string;
    table: string;
    count: number | null;
    status: string;
  }>;
};

const STATUS_CACHE_KEY = "costlab_supabase_status_cache";

export default function SettingsPage() {
  // Ensure SSR and initial client hydration match exactly to prevent hydration warnings
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  async function fetchStatus(isManual = false) {
    if (isManual) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const res = await fetch("/api/supabase-status");
      const json = await res.json();
      if (json && typeof json.connectionOk === "boolean") {
        setData(json);
        sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(json));
      }
    } catch (err) {
      console.error("Failed to fetch Supabase status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // 1. Read cache on client side after mount to avoid hydration mismatch
    let hasCache = false;
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem(STATUS_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setData(parsed);
          setLoading(false);
          hasCache = true;
        } catch (e) {}
      }
    }

    // 2. Perform fresh fetch
    fetchStatus(!hasCache);
  }, []);

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
              <Database className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-1.5">
                  สถานะ Supabase Database
                  <span className="text-[11px] font-bold text-slate-400 tracking-normal hidden sm:inline">
                    / SYSTEM & DATABASE HEALTH
                  </span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0 shadow-2xs">
                  <Database className="w-3 h-3 text-[#d4f54e]" />
                  <span>PostgreSQL Cloud</span>
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 ${
                  data?.connectionOk
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${data?.connectionOk ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  <span>{data?.connectionOk ? "ออนไลน์สมบูรณ์" : "กำลังตรวจสอบ"}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                ตรวจสอบความเร็ว Latency, การเชื่อมต่อ Storage Bucket รูปบิล และจำนวนข้อมูลในตารางระบบทั้งหมด
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchStatus(true)}
              disabled={loading || refreshing}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading || refreshing ? "animate-spin text-emerald-600" : "text-slate-500"} />
              <span>{loading ? "กำลังตรวจสอบ..." : "รีเฟรชสถานะ"}</span>
            </button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 text-xs shadow-2xs"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">เปิด</span> Dashboard
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. METRIC TICKER CARDS                                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Connection */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
            <span>การเชื่อมต่อ Database</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80">
              <Activity size={13} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${data?.connectionOk ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="font-bold text-slate-900 text-sm truncate">
              {data?.connectionOk ? "Supabase Active" : loading ? "กำลังตรวจสอบ..." : "Sheets Fallback"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono truncate m-0 font-medium">{data?.connectionMessage || "กำลังตรวจสอบ..."}</p>
        </div>

        {/* Card 2: Latency */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
            <span>ความเร็ว Latency</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
              <Zap size={13} />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-slate-900">
            {data?.connectionOk ? `${data.latencyMs} ms` : "-"}
          </div>
          <p className="text-[11px] text-slate-500 m-0 font-medium">{data?.connectionOk ? "ตอบสนองรวดเร็วผ่าน PostgreSQL" : "รอเชื่อมต่อ"}</p>
        </div>

        {/* Card 3: Storage Bucket */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
            <span>Storage Bucket (รูปบิล)</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/80">
              <HardDrive size={13} />
            </div>
          </div>
          <div className="font-bold text-slate-900 text-sm truncate">{data?.billsBucketStatus || "กำลังตรวจสอบ..."}</div>
          <p className="text-[11px] text-slate-500 m-0 font-medium">สำหรับจัดเก็บรูปใบเสร็จ บิล และไฟล์แนบ</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ENVIRONMENT VERIFICATION                                               */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/80 shadow-2xs">
              <ShieldCheck size={13} />
            </div>
            <span className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
              ตรวจสอบค่าคอนฟิกสภาพแวดล้อม (.env.local)
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            Environment Security
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
            <div className="min-w-0">
              <div className="text-slate-500 text-[11px] font-sans font-bold">NEXT_PUBLIC_SUPABASE_URL</div>
              <div className="text-slate-900 font-bold truncate mt-0.5">{data?.maskedUrl || "-"}</div>
            </div>
            {data?.isConfigured ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 ml-1.5" /> : <AlertTriangle size={16} className="text-amber-500 shrink-0 ml-1.5" />}
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
            <div>
              <div className="text-slate-500 text-[11px] font-sans font-bold">NEXT_PUBLIC_SUPABASE_ANON_KEY</div>
              <div className="text-slate-900 font-bold mt-0.5">{data?.isAnonKeySet ? "✓ ตั้งค่าแล้ว" : "✕ ยังไม่ได้ตั้งค่า"}</div>
            </div>
            {data?.isAnonKeySet ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 ml-1.5" /> : <AlertTriangle size={16} className="text-amber-500 shrink-0 ml-1.5" />}
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs">
            <div>
              <div className="text-slate-500 text-[11px] font-sans font-bold">SUPABASE_SERVICE_ROLE_KEY</div>
              <div className="text-slate-900 font-bold mt-0.5">{data?.isServiceKeySet ? "✓ ตั้งค่าแล้ว" : "✕ ยังไม่ได้ตั้งค่า"}</div>
            </div>
            {data?.isServiceKeySet ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0 ml-1.5" /> : <AlertTriangle size={16} className="text-amber-500 shrink-0 ml-1.5" />}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DATABASE TABLES STATISTICS                                             */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/80 shadow-2xs">
              <Server size={13} />
            </div>
            <span className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
              สถิติข้อมูลในตารางระบบ (Table Stats)
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {data?.tableStats?.length || 0} Tables
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {data?.tableStats ? (
            data.tableStats.map((t) => (
              <div key={t.table} className="p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-center justify-between shadow-2xs hover:border-emerald-300 transition">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate text-xs">{t.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{t.table}</div>
                </div>
                <div className="text-right shrink-0 ml-1.5">
                  <span className="font-bold font-mono text-emerald-800 text-xs px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md">
                    {t.count !== null ? t.count.toLocaleString() : "-"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-6 text-center text-slate-400 text-xs">
              <RefreshCw size={14} className="animate-spin mx-auto mb-1 text-emerald-600" />
              <span>กำลังโหลดสถิติตาราง...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

