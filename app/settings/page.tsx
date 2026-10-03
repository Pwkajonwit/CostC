"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  HardDrive,
  ImageIcon,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";

type BucketDetail = {
  name: string;
  public: boolean;
  fileCount: number;
  totalBytes: number;
  sizePretty: string;
  description: string;
};

type StorageStats = {
  totalFiles: number;
  totalBytes: number;
  totalPretty: string;
  quotaBytes: number;
  quotaPretty: string;
  quotaPercent: number;
  buckets: BucketDetail[];
};

type DatabaseStats = {
  dbSizeBytes: number | null;
  dbSizePretty: string | null;
  quotaBytes: number;
  quotaPretty: string;
  quotaPercent: number | null;
};

type StatusData = {
  isConfigured: boolean;
  maskedUrl: string;
  isAnonKeySet: boolean;
  isServiceKeySet: boolean;
  connectionOk: boolean;
  latencyMs: number;
  connectionMessage: string;
  billsBucketStatus: string;
  storageStats?: StorageStats;
  databaseStats?: DatabaseStats;
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Connection */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
            <span>การเชื่อมต่อ DB</span>
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
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
            <span>ความเร็ว Latency</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
              <Zap size={13} />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-slate-900">
            {data?.connectionOk ? `${data.latencyMs} ms` : "-"}
          </div>
          <p className="text-[11px] text-slate-500 m-0 font-medium truncate">{data?.connectionOk ? "ตอบสนองรวดเร็วผ่าน Cloud DB" : "รอเชื่อมต่อ"}</p>
        </div>

        {/* Card 3: Storage Bucket */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
            <span>พื้นที่เก็บรูปภาพ</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/80">
              <ImageIcon size={13} />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-indigo-900 truncate">
            {data?.storageStats ? data.storageStats.totalPretty : data?.billsBucketStatus || "-"}
          </div>
          <p className="text-[11px] text-slate-500 m-0 font-medium truncate">
            {data?.storageStats 
              ? `${data.storageStats.totalFiles} ไฟล์ (${(data.storageStats.quotaPercent || 0).toFixed(1)}% ของ 1 GB)` 
              : "จัดเก็บรูปใบเสร็จ & ไฟล์แนบ"}
          </p>
        </div>

        {/* Card 4: Total Records */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
            <span>ข้อมูลในระบบ</span>
            <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/80">
              <Layers size={13} />
            </div>
          </div>
          <div className="text-xl font-black font-mono text-teal-900 truncate">
            {data?.tableStats ? `${data.tableStats.reduce((acc, t) => acc + (t.count || 0), 0).toLocaleString()} รายการ` : "-"}
          </div>
          <p className="text-[11px] text-slate-500 m-0 font-medium truncate">
            ครอบคลุม {data?.tableStats?.length || 0} ตารางระบบ Supabase
          </p>
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
      {/* 4. STORAGE & MEDIA USAGE (พื้นที่จัดเก็บรูปภาพและไฟล์)                        */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/80 shadow-2xs">
              <HardDrive size={15} />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight uppercase flex items-center gap-2">
                พื้นที่จัดเก็บรูปภาพและไฟล์ (Supabase Storage)
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                ตรวจสอบความจุรูปใบเสร็จบิลเบิกจ่าย และไฟล์สำรองข้อมูลบนคลาวด์
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              ใช้ไป {data?.storageStats?.totalPretty || "0 B"} / {data?.storageStats?.quotaPretty || "1 GB"}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <ImageIcon size={13} className="text-slate-500" />
              ความจุพื้นที่จัดเก็บ (Free Tier Quota 1 GB)
            </span>
            <span className="font-mono font-bold text-indigo-700">
              {(data?.storageStats?.quotaPercent || 0).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(1, Math.min(100, data?.storageStats?.quotaPercent || 1))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-0.5">
            <span>รวมทั้งหมด {data?.storageStats?.totalFiles ?? 0} ไฟล์</span>
            <span>
              เหลือพื้นที่ว่างอีก{" "}
              {data?.storageStats
                ? (Math.max(0, 1024 - (data.storageStats.totalBytes / (1024 * 1024)))).toFixed(1)
                : "1024.0"}{" "}
              MB
            </span>
          </div>
        </div>

        {/* Storage Buckets List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data?.storageStats?.buckets && data.storageStats.buckets.length > 0 ? (
            data.storageStats.buckets.map((b) => (
              <div
                key={b.name}
                className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 shadow-2xs hover:border-indigo-300 transition flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {b.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          b.public
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {b.public ? "Public CDN" : "Private"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium mt-1 truncate">
                      {b.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black font-mono text-slate-900">
                      {b.sizePretty}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {b.fileCount.toLocaleString()} ไฟล์
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                  <span className="text-slate-500">
                    {b.name === "repairs"
                      ? "รองรับการดูรูปใบเสร็จผ่าน LINE & แดชบอร์ด"
                      : b.name === "backups"
                      ? "สำรองฐานข้อมูลระบบ JSON"
                      : "พื้นที่จัดเก็บไฟล์ทั่วไป"}
                  </span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} /> พร้อมใช้งาน
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-4 text-center text-slate-400 text-xs">
              <RefreshCw size={14} className="animate-spin mx-auto mb-1 text-emerald-600" />
              <span>กำลังตรวจสอบพื้นที่จัดเก็บ...</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. DATABASE TABLES STATISTICS                                             */}
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
          <div className="flex items-center gap-2">
            {data?.databaseStats?.dbSizePretty && (
              <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                ขนาด DB: {data.databaseStats.dbSizePretty}
              </span>
            )}
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {data?.tableStats?.length || 0} Tables
            </span>
          </div>
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

