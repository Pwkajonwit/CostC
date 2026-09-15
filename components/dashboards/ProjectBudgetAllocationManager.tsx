"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pencil,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles
} from "lucide-react";
import type { SheetRow } from "@/lib/types";
import { TABLES } from "@/lib/config";
import { money, toNumber } from "@/lib/utils/numbers";
import { ProjectBudgetAllocator } from "@/components/forms/ProjectBudgetAllocator";

type ProjectBudgetAllocationManagerProps = {
  project: SheetRow;
  projectId: string | number;
  initialEditing?: boolean;
};

export function ProjectBudgetAllocationManager({
  project,
  projectId,
  initialEditing = false
}: ProjectBudgetAllocationManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(initialEditing);
  const [draft, setDraft] = useState<Record<string, any>>({ ...project });
  const [changedFields, setChangedFields] = useState<Record<string, any>>({});
  const [error, setError] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  const rowKey = project.id || project["ID Project"] || project._sheetRow || projectId;

  function beginEdit() {
    setDraft({ ...project });
    setChangedFields({});
    setError("");
    setSaveSuccess(false);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft({ ...project });
    setChangedFields({});
    setError("");
    setEditing(false);
  }

  function handleDraftChange(field: string, value: any) {
    const strVal = String(value);
    setDraft(prev => ({
      ...prev,
      [field]: strVal
    }));
    setChangedFields(prev => ({
      ...prev,
      [field]: strVal
    }));
    setSaveSuccess(false);
  }

  async function handleSave() {
    if (!rowKey) {
      setError("ไม่พบรหัสโครงการสำหรับการบันทึก");
      return;
    }

    if (Object.keys(changedFields).length === 0) {
      setEditing(false);
      return;
    }

    setIsSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: TABLES.PROJECT,
          id: rowKey,
          sheetRow: rowKey,
          values: changedFields
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "บันทึกการจัดสรรงบประมาณไม่สำเร็จ");
      }

      setEditing(false);
      setChangedFields({});
      setSaveSuccess(true);

      startTransition(() => {
        router.refresh();
      });

      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSaving(false);
    }
  }

  const changeCount = Object.keys(changedFields).length;

  return (
    <div className="space-y-4 font-sans">
      {/* Top Manager Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-300 shrink-0">
            <PieChart size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>การจัดสรรงบประมาณโครงการ</span>
              {editing && (
                <span className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full font-semibold animate-pulse">
                  โหมดแก้ไข
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              กำหนดกรอบวงเงินงบประมาณ 2 หมวดหลัก: ค่าของ (27 หมวด) และ ค่าแรง & บุคลากร (24 หมวด รวมพนักงาน)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <button
              type="button"
              onClick={beginEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
            >
              <Pencil size={14} />
              <span>แก้ไขการจัดสรรงบ</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={cancelEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                <X size={14} />
                <span>ยกเลิก</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>บันทึกการจัดสรร ({changeCount})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2 shadow-2xs transition-all">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>บันทึกการจัดสรรงบประมาณโครงการเรียบร้อยแล้ว</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2 shadow-2xs">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Allocator Component */}
      <div className="border border-slate-200 rounded-xl bg-white p-2 sm:p-4 shadow-2xs">
        <ProjectBudgetAllocator
          values={editing ? draft : project}
          onChange={editing ? handleDraftChange : () => beginEdit()}
          defaultExpanded={true}
        />
      </div>

      {/* Sticky Bottom Bar while in edit mode */}
      {editing && changeCount > 0 && (
        <div className="sticky bottom-4 z-20 bg-slate-900 text-white p-3.5 rounded-xl shadow-lg flex items-center justify-between gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 text-xs">
            <Sparkles size={16} className="text-amber-400" />
            <span>มีการแก้ไขการจัดสรรงบประมาณทั้งหมด <strong>{changeCount}</strong> รายการ</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={cancelEdit}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>บันทึกข้อมูล</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
