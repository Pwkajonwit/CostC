"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Trash2,
  X,
  Loader2,
  RotateCcw,
  Calendar,
  Clock,
  Bell,
  Shield,
  CheckCircle2,
  Info,
} from "lucide-react";
import type { BackupSnapshotSummary, BackupConfig } from "@/lib/backup-service";
import { showToast } from "@/components/shared/ToastProvider";

// ==========================================
// 1. DELETE CONFIRM MODAL
// ==========================================
export interface BackupDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: BackupSnapshotSummary | null;
  onConfirmDelete: (snapshot: BackupSnapshotSummary) => Promise<void>;
}

export function BackupDeleteConfirmModal({
  isOpen,
  onClose,
  snapshot,
  onConfirmDelete,
}: BackupDeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !snapshot) return null;

  const dateFormatted = new Date(snapshot.createdAt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
  });

  async function handleExecuteDelete() {
    if (!snapshot) return;
    setDeleting(true);
    try {
      await onConfirmDelete(snapshot);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900">
        <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">ยืนยันการลบจุดสำรองข้อมูล</h2>
              <p className="text-xs text-rose-700">ไฟล์สำรองและประวัติจะถูกลบออกจากระบบอย่างถาวร</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">รหัสจุดสำรอง:</span>
              <span className="font-mono text-slate-900 font-semibold">{snapshot.id}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">วันที่สำรอง:</span>
              <span className="text-slate-900 font-medium">{dateFormatted}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">จำนวนตาราง & แถว:</span>
              <span className="text-emerald-700 font-semibold">
                {snapshot.totalTables || 12} ตาราง ({snapshot.totalRows.toLocaleString()} รายการ)
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">ขนาดไฟล์:</span>
              <span className="text-slate-700 font-mono">{(snapshot.sizeBytes / 1024).toFixed(1)} KB</span>
            </div>
            {snapshot.filename && (
              <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-200/60 text-slate-600">
                <span className="text-slate-500">ชื่อไฟล์ในระบบจัดเก็บ:</span>
                <span className="font-mono text-[11px] text-slate-800 break-all">{snapshot.filename}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-rose-800 leading-relaxed bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5">คำเตือนการลบข้อมูลถาวร</div>
              เมื่อลบแล้วจะไม่สามารถกู้คืนจุดสำรองนี้หรือดาวน์โหลดไฟล์นี้ได้อีก กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleExecuteDelete}
            disabled={deleting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>กำลังลบข้อมูล...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันลบจุดสำรองข้อมูล</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. RESTORE CONFIRM MODAL
// ==========================================
export interface BackupRestoreConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: BackupSnapshotSummary | null;
  onConfirmRestore: (snapshot: BackupSnapshotSummary) => Promise<void>;
}

export function BackupRestoreConfirmModal({
  isOpen,
  onClose,
  snapshot,
  onConfirmRestore,
}: BackupRestoreConfirmModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);

  if (!isOpen || !snapshot) return null;

  const dateFormatted = new Date(snapshot.createdAt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
  });

  const isConfirmed = confirmText.trim().toUpperCase() === "RESTORE";

  async function handleExecuteRestore() {
    if (!snapshot || !isConfirmed) return;
    setRestoring(true);
    try {
      await onConfirmRestore(snapshot);
      onClose();
    } finally {
      setRestoring(false);
      setConfirmText("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900">
        <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">ยืนยันการกู้คืนข้อมูลระบบ</h2>
              <p className="text-xs text-amber-800">ระบบจะเขียนทับ/อัปเดตข้อมูลด้วยจุดสำรองนี้</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">รหัสจุดสำรอง:</span>
              <span className="font-mono text-slate-900 font-semibold">{snapshot.id}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">วันที่สำรอง:</span>
              <span className="text-slate-900 font-medium">{dateFormatted}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">จำนวนตาราง & แถว:</span>
              <span className="text-emerald-700 font-semibold">
                {snapshot.totalTables} ตาราง ({snapshot.totalRows.toLocaleString()} รายการ)
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">ขนาดไฟล์:</span>
              <span className="text-slate-700">{(snapshot.sizeBytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          <div className="text-xs text-slate-700 leading-relaxed bg-rose-50 border border-rose-200 p-3 rounded-xl">
            <div className="font-semibold text-rose-800 mb-1">⚠️ คำเตือนเรื่องความปลอดภัย</div>
            การกู้คืนข้อมูลจะนำข้อมูลจากจุดสำรองนี้ไปบันทึกทับข้อมูลปัจจุบัน เพื่อป้องกันความผิดพลาด กรุณาพิมพ์คำว่า{" "}
            <span className="font-bold text-rose-900 uppercase bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">
              RESTORE
            </span>{" "}
            ด้านล่างเพื่อยืนยัน:
          </div>

          <input
            type="text"
            placeholder="พิมพ์ RESTORE เพื่อยืนยัน"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 focus:border-amber-500 rounded-xl text-center text-sm font-semibold text-slate-900 tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2.5 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!isConfirmed || restoring}
            onClick={handleExecuteRestore}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            เริ่มการกู้คืนข้อมูลทันที
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. SCHEDULE MODAL
// ==========================================
export interface BackupScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BackupConfig;
  onSave: (updatedConfig: BackupConfig) => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "วันอาทิตย์ (Sunday) - แนะนำ" },
  { value: 1, label: "วันจันทร์ (Monday)" },
  { value: 2, label: "วันอังคาร (Tuesday)" },
  { value: 3, label: "วันพุธ (Wednesday)" },
  { value: 4, label: "วันพฤหัสบดี (Thursday)" },
  { value: 5, label: "วันศุกร์ (Friday)" },
  { value: 6, label: "วันเสาร์ (Saturday)" },
];

export function BackupScheduleModal({ isOpen, onClose, config, onSave }: BackupScheduleModalProps) {
  const [enabled, setEnabled] = useState(config.enabled ?? true);
  const [frequency, setFrequency] = useState<"weekly" | "daily" | "monthly">(config.frequency || "weekly");
  const [dayOfWeek, setDayOfWeek] = useState<number>(config.dayOfWeek ?? 0);
  const [time, setTime] = useState<string>(config.time || "02:00");
  const [retentionSnapshots, setRetentionSnapshots] = useState<number>(config.retentionSnapshots || 12);
  const [notifyLine, setNotifyLine] = useState<boolean>(config.notifyLine ?? true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const updated: Partial<BackupConfig> = {
        enabled,
        frequency,
        dayOfWeek,
        time,
        retentionSnapshots,
        notifyLine,
      };

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-config", config: updated }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "บันทึกการตั้งค่าไม่สำเร็จ");

      showToast("success", "บันทึกการตั้งค่าตารางเวลาสำรองข้อมูลสำเร็จ");
      onSave(json.config);
      onClose();
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md sm:backdrop-blur-lg animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">ตั้งเวลาสำรองข้อมูลอัตโนมัติ</h2>
              <p className="text-xs text-slate-500">กำหนดรอบเวลาสำรองข้อมูลทั้ง 12 ตารางลงระบบ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                เปิดใช้งานระบบสำรองอัตโนมัติ
              </div>
              <p className="text-xs text-slate-500">ระบบจะทำการสำรองข้อมูลอัตโนมัติตามรอบที่กำหนด</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  ความถี่ในการสำรองข้อมูล
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "weekly", label: "ทุกสัปดาห์", sub: "Weekly (แนะนำ)" },
                    { id: "daily", label: "ทุกวัน", sub: "Daily" },
                    { id: "monthly", label: "ทุกเดือน", sub: "Monthly" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFrequency(f.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        frequency === f.id
                          ? "bg-emerald-50 border-emerald-500 text-slate-900 shadow-2xs ring-1 ring-emerald-500/50"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">{f.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{f.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {frequency === "weekly" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    เลือกวันในสัปดาห์
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.value} value={d.value} className="bg-white text-slate-900">
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  เวลาที่ต้องการให้เริ่มสำรอง
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <p className="text-[11px] text-slate-500">
                  💡 แนะนำตั้งช่วงเวลา 01:00 - 04:00 น. ซึ่งเป็นช่วงเวลาที่ไม่มีผู้ใช้งานระบบ
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  จำนวนประวัติที่ต้องการเก็บย้อนหลัง
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={3}
                    max={52}
                    value={retentionSnapshots}
                    onChange={(e) => setRetentionSnapshots(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 text-center focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-xs text-slate-500">
                    จุดสำรอง (Snapshots) — เช่น 12 สัปดาห์ (~3 เดือน)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-900 flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-blue-600" />
                    ส่งแจ้งเตือนสรุปผลเข้า LINE
                  </div>
                  <p className="text-[11px] text-slate-500">
                    แจ้งเตือนผลและจำนวนแถวที่สำรองสำเร็จไปยังกลุ่มไลน์แอดมิน
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyLine}
                  onChange={(e) => setNotifyLine(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex gap-2.5 text-blue-800 text-xs leading-relaxed">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <div>
                  <div className="font-semibold text-blue-900 mb-0.5">ระบบ Cron Endpoint</div>
                  สามารถผูก URL <code>/api/cron/backup</code> กับ Vercel Cron หรือ External Cron เพื่อให้ระบบทำงานอัตโนมัติตามกำหนดได้อย่างแม่นยำ
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2.5 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            บันทึกการตั้งค่า
          </button>
        </div>
      </div>
    </div>
  );
}
