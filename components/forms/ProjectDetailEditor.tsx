"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Save,
  X,
  Building2,
  MapPin,
  Calendar,
  User,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Briefcase,
  Layers,
  Wallet,
  Coins,
  FileText,
  Lock,
  ChevronDown
} from "lucide-react";
import { TABLES } from "@/lib/config";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateDisplay, formatDateThai, toInputDateValue } from "@/lib/utils/dates";
import { getProjectColorInfo, PROJECT_COLOR_OPTIONS } from "@/components/dashboards/WorkStatusDashboardClient";
import type { SheetRow } from "@/lib/types";

type ProjectDetailEditorProps = {
  fields: string[];
  project: SheetRow;
  customerDisplay?: string;
  companyDisplay?: string;
  ownerDisplay?: string;
  customerOptions?: Array<{ value: string; label: string; name: string }>;
  companyOptions?: Array<{ value: string; label: string; name: string }>;
  responsibleOptions?: Array<{ value: string; label: string; name: string }>;
  initialEditing?: boolean;
};

export function ProjectDetailEditor({
  fields,
  project,
  customerDisplay,
  companyDisplay,
  ownerDisplay,
  customerOptions = [],
  companyOptions = [],
  responsibleOptions = [],
  initialEditing = false
}: ProjectDetailEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>(() => draftFromProject(project, fields));
  const rowKey = project.id ?? project["ID Project"] ?? project._sheetRow;
  const canSave = Boolean(rowKey);

  const pId = String(project["ID Project"] || project.id || "").trim();
  const pName = String(project["ชื่อ Project"] || project.name || "").trim() || `Project #${pId}`;
  const colorInfo = getProjectColorInfo(project.color || project.COLOR);
  const customer = customerDisplay || String(project["ชื่อลูกค้า"] || project["ลูกค้า"] || "-");
  const company = companyDisplay || String(project["บริษัท"] || project["บริษัทรับงาน"] || "-");
  const location = String(project["สถานที่"] || "-");
  const owner = ownerDisplay || String(project["รับผิดชอบ"] || "-");
  const dateVal = formatDateDisplay(project["วันที่"]);
  const workType = String(project["คุมงบประเภทงาน"] || "-");

  // Financial figures
  const workAmount = toNumber(project["ยอดงาน"]);
  const vatAmount = toNumber(project["ยอดรวม vat"]);
  const budgetCap = toNumber(project["งบไม่เกิน"] || project["ยอดงาน"]);
  const spent = toNumber(project["รวม ALL"]);
  const remaining = budgetCap - spent;
  const percent = budgetCap > 0 ? Math.min(999, Math.round((spent / budgetCap) * 100)) : 0;
  const isOver = remaining < 0;
  const isWarning = !isOver && percent >= 80;

  const changedValues = useMemo(() => {
    const rawObj = (project._raw || project) as SheetRow;
    return Object.fromEntries(
      Object.keys(draft)
        .filter(field => !readonlyField(field))
        .filter(field => {
          const draftVal = stringify(draft[field]).trim();
          const rawVal = stringify(rawObj[field]).trim();
          return draftVal !== rawVal;
        })
        .map(field => [field, stringify(draft[field])])
    );
  }, [draft, project]);

  function beginEdit() {
    setError("");
    setDraft(draftFromProject(project, fields));
    setEditing(true);
  }

  function cancelEdit() {
    setError("");
    setDraft(draftFromProject(project, fields));
    setEditing(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      setError("ไม่พบรหัสโครงการสำหรับการบันทึก");
      return;
    }
    if (!Object.keys(changedValues).length) {
      setEditing(false);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: TABLES.PROJECT,
          id: rowKey,
          sheetRow: rowKey,
          values: changedValues
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "บันทึกข้อมูลไม่สำเร็จ");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function setDraftValue(field: string, value: any) {
    const strVal = stringify(value);
    setDraft(current => {
      const next = { ...current, [field]: strVal };
      if (field === "ยอดงาน") {
        const workNum = toNumber(strVal);
        if (workNum > 0 && (!current["ยอดรวม vat"] || toNumber(current["ยอดรวม vat"]) === 0)) {
          next["ยอดรวม vat"] = String(Math.round(workNum * 1.07));
        }
        if (workNum > 0 && (!current["งบไม่เกิน"] || toNumber(current["งบไม่เกิน"]) === 0)) {
          next["งบไม่เกิน"] = String(workNum);
        }
      } else if (field === "ยอดรวม vat") {
        const vatNum = toNumber(strVal);
        if (vatNum > 0 && (!current["ยอดงาน"] || toNumber(current["ยอดงาน"]) === 0)) {
          next["ยอดงาน"] = String(Math.round(vatNum / 1.07));
        }
        if (vatNum > 0 && (!current["งบไม่เกิน"] || toNumber(current["งบไม่เกิน"]) === 0)) {
          next["งบไม่เกิน"] = String(vatNum);
        }
      }
      return next;
    });
  }

  // =========================================================================
  // VIEW MODE: CLEAN, STRUCTURED & COMFORTABLE ON THE EYES
  // =========================================================================
  if (!editing) {
    return (
      <div className="space-y-4 font-sans text-slate-800">
        {/* Card Header & Edit Trigger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/80 shadow-2xs">
              <FolderKanban size={20} className="text-slate-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  #{pId}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {pName}
                </h3>
                {colorInfo && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${colorInfo.badgeClass}`}>
                    <span className="text-xs">{colorInfo.icon}</span>
                    <span>{colorInfo.name}</span>
                    <span className="text-[10px] opacity-80">({colorInfo.description})</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                ผู้ว่าจ้าง: <span className="font-medium text-slate-700">{customer}</span> · ผู้รับงาน: <span className="font-medium text-slate-700">{company}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!canSave}
            onClick={beginEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Pencil size={13} className="text-slate-500" />
            <span>แก้ไขข้อมูล</span>
          </button>
        </div>

        {/* 1. FINANCIAL SUMMARY HIGHLIGHTS (4 Clean Metric Cards) */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Coins size={13} className="text-emerald-700" />
            <span>สรุปสถานะงบประมาณและการเงิน (Financial Overview)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. ยอดงาน */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-500">ยอดงาน (มูลค่าสัญญา)</span>
              <div className="mt-1">
                <div className="text-lg font-bold font-mono text-slate-900">
                  ฿{money(workAmount)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">ก่อนภาษีมูลค่าเพิ่ม</div>
              </div>
            </div>

            {/* 2. ยอดรวม VAT */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-500">ยอดรวม VAT 7%</span>
              <div className="mt-1">
                <div className="text-lg font-bold font-mono text-slate-800">
                  ฿{money(vatAmount)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">รวมภาษี 7%</div>
              </div>
            </div>

            {/* 3. กรอบงบประมาณ (งบไม่เกิน) */}
            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-500">กรอบงบประมาณ (งบไม่เกิน)</span>
              <div className="mt-1">
                <div className="text-lg font-bold font-mono text-emerald-800">
                  ฿{money(budgetCap)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">วงเงินคุมจ่ายสูงสุด</div>
              </div>
            </div>

            {/* 4. เบิกสะสมรวม (รวม ALL) */}
            <div
              className={`rounded-xl p-3.5 border flex flex-col justify-between ${
                isOver
                  ? "bg-rose-50/70 border-rose-200 text-rose-900"
                  : isWarning
                  ? "bg-amber-50/70 border-amber-200 text-amber-900"
                  : "bg-emerald-50/60 border-emerald-200 text-emerald-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-600">เบิกสะสมรวม (รวม ALL)</span>
                {isOver ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-200 text-rose-950">
                    <AlertCircle size={10} />
                    <span>เกินงบ</span>
                  </span>
                ) : isWarning ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-950">
                    <AlertTriangle size={10} />
                    <span>ใกล้เต็ม</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-200 text-emerald-950">
                    <CheckCircle2 size={10} />
                    <span>ปกติ</span>
                  </span>
                )}
              </div>

              <div className="mt-1">
                <div className="text-lg font-black font-mono">
                  ฿{money(spent)}
                </div>
                <div className="text-[11px] font-medium mt-0.5 flex items-center justify-between">
                  <span>คงเหลือ: ฿{money(remaining)}</span>
                  <span className="font-mono font-bold">({percent}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. TWO-COLUMN DETAILED INFO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Section A: ข้อมูลโครงการและการดำเนินงาน */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200">
              <Briefcase size={14} className="text-slate-500" />
              <span>ข้อมูลโครงการและการดำเนินงาน</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">รหัสโครงการ:</span>
                <span className="font-mono font-semibold text-slate-800">#{pId}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">ชื่อโครงการ:</span>
                <span className="font-semibold text-slate-900 text-right">{pName}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">สถานะ/ขนาดงาน:</span>
                <div>
                  {colorInfo ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${colorInfo.badgeClass}`}>
                      <span>{colorInfo.icon}</span>
                      <span>{colorInfo.name}</span>
                      <span className="text-[10px] opacity-80">({colorInfo.description})</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">ผู้รับผิดชอบ:</span>
                <span className="font-medium text-slate-800">{owner}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">วันที่เริ่ม/สัญญา:</span>
                <span className="font-medium text-slate-800">{dateVal || "-"}</span>
              </div>
            </div>
          </div>

          {/* Section B: ข้อมูลคู่สัญญาและสถานที่ */}
          <div className="bg-slate-50/40 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200">
              <Building2 size={14} className="text-slate-500" />
              <span>ข้อมูลคู่สัญญาและสถานที่</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">ลูกค้า/ผู้ว่าจ้าง:</span>
                <span className="font-semibold text-slate-900 text-right">{customer}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">บริษัทผู้รับงาน:</span>
                <span className="font-semibold text-slate-800 text-right">{company}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">สถานที่ปฏิบัติงาน:</span>
                <span className="text-slate-800 text-right">{location}</span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-500 shrink-0">คุมงบประเภทงาน:</span>
                <span className="text-slate-600">{workType}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // EDIT MODE: CLEAN, LOGICALLY GROUPED INPUT FORM
  // =========================================================================
  return (
    <form onSubmit={submit} className="space-y-5 font-sans text-slate-800">
      {/* Edit Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Pencil size={15} className="text-indigo-600" />
            <span>แก้ไขข้อมูลโครงการ #{pId}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            ปรับปรุงรายละเอียดโครงการ ข้อมูลสัญญา และกรอบวงเงินงบประมาณ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={cancelEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
          >
            <X size={14} />
            <span>ยกเลิก</span>
          </button>
          <button
            type="submit"
            disabled={busy || !canSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition shadow-xs cursor-pointer"
          >
            <Save size={14} />
            <span>{busy ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-xs font-medium border border-rose-200 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 3 GROUPED SECTIONS */}
      <div className="space-y-4">
        {/* GROUP 1: ข้อมูลโครงการ */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200">
            <Briefcase size={14} className="text-indigo-600" />
            <span>1. ข้อมูลโครงการและขนาดงาน</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* ID Project (Readonly) */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>รหัสโครงการ (ID Project)</span>
                <Lock size={10} className="text-slate-400" />
              </span>
              <input
                value={pId}
                readOnly
                className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed"
              />
            </div>

            {/* ชื่อ Project */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[11px] font-semibold text-slate-700">ชื่อ Project</span>
              <input
                value={draft["ชื่อ Project"] ?? ""}
                disabled={busy}
                onChange={e => setDraftValue("ชื่อ Project", e.target.value)}
                placeholder="ระบุชื่อโครงการ"
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Color Status Buttons */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[11px] font-semibold text-slate-700">สถานะ/ขนาดงาน (Color)</span>
              <div className="grid grid-cols-3 gap-2">
                {PROJECT_COLOR_OPTIONS.map(opt => {
                  const isSelected = (draft["color"] || draft["COLOR"] || "").toLowerCase() === opt.value.toLowerCase();
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setDraftValue("color", opt.value);
                        setDraftValue("COLOR", opt.value);
                      }}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition cursor-pointer select-none ${
                        isSelected
                          ? opt.activeClass
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xs">{opt.icon}</span>
                      <span className="font-semibold">{opt.name}</span>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">({opt.description})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ผู้รับผิดชอบ */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">ผู้รับผิดชอบ</span>
              {responsibleOptions.length > 0 ? (
                <div className="relative">
                  <select
                    value={draft["รับผิดชอบ"] ?? ""}
                    disabled={busy}
                    onChange={e => setDraftValue("รับผิดชอบ", e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
                  >
                    <option value="">-- เลือกผู้รับผิดชอบ --</option>
                    {draft["รับผิดชอบ"] && !responsibleOptions.some(o => o.value === draft["รับผิดชอบ"] || o.name === draft["รับผิดชอบ"]) && (
                      <option value={draft["รับผิดชอบ"]}>{draft["รับผิดชอบ"]}</option>
                    )}
                    {responsibleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <input
                  value={draft["รับผิดชอบ"] ?? ""}
                  disabled={busy}
                  onChange={e => setDraftValue("รับผิดชอบ", e.target.value)}
                  placeholder="เช่น PW1, PW2, PW3, ป๊อป"
                  className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              )}
            </div>

            {/* วันที่ */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                <span>วันที่เริ่ม/สัญญา</span>
                {draft["วันที่"] && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    {formatDateDisplay(draft["วันที่"])} ({formatDateThai(draft["วันที่"])})
                  </span>
                )}
              </span>
              <input
                type="date"
                value={toInputDateValue(draft["วันที่"])}
                disabled={busy}
                onChange={e => setDraftValue("วันที่", e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* GROUP 2: คู่สัญญาและสถานที่ */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200">
            <Building2 size={14} className="text-indigo-600" />
            <span>2. ข้อมูลคู่สัญญาและสถานที่</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* ชื่อลูกค้า */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">ชื่อลูกค้า / ผู้ว่าจ้าง</span>
              {customerOptions.length > 0 ? (
                <div className="relative">
                  <select
                    value={draft["ชื่อลูกค้า"] ?? draft["ลูกค้า"] ?? ""}
                    disabled={busy}
                    onChange={e => {
                      setDraftValue("ชื่อลูกค้า", e.target.value);
                      const matched = customerOptions.find(o => o.value === e.target.value);
                      if (matched && (!draft["สถานที่"] || draft["สถานที่"] === "-")) {
                        setDraftValue("สถานที่", matched.name);
                      }
                    }}
                    className="w-full pl-3 pr-8 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
                  >
                    <option value="">-- เลือกลูกค้า / ผู้ว่าจ้าง --</option>
                    {(draft["ชื่อลูกค้า"] || draft["ลูกค้า"]) &&
                      !customerOptions.some(o => o.value === (draft["ชื่อลูกค้า"] || draft["ลูกค้า"]) || o.name === (draft["ชื่อลูกค้า"] || draft["ลูกค้า"])) && (
                        <option value={draft["ชื่อลูกค้า"] || draft["ลูกค้า"]}>{draft["ชื่อลูกค้า"] || draft["ลูกค้า"]}</option>
                    )}
                    {customerOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <input
                  value={draft["ชื่อลูกค้า"] ?? draft["ลูกค้า"] ?? ""}
                  disabled={busy}
                  onChange={e => setDraftValue("ชื่อลูกค้า", e.target.value)}
                  placeholder="ชื่อบริษัทหรือบุคคลผู้ว่าจ้าง"
                  className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              )}
            </div>

            {/* บริษัท */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">บริษัทผู้รับงาน</span>
              {companyOptions.length > 0 ? (
                <div className="relative">
                  <select
                    value={draft["บริษัท"] ?? draft["บริษัทรับงาน"] ?? ""}
                    disabled={busy}
                    onChange={e => setDraftValue("บริษัท", e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
                  >
                    <option value="">-- เลือกบริษัทผู้รับงาน --</option>
                    {(draft["บริษัท"] || draft["บริษัทรับงาน"]) &&
                      !companyOptions.some(o => o.value === (draft["บริษัท"] || draft["บริษัทรับงาน"]) || o.name === (draft["บริษัท"] || draft["บริษัทรับงาน"])) && (
                        <option value={draft["บริษัท"] || draft["บริษัทรับงาน"]}>{draft["บริษัท"] || draft["บริษัทรับงาน"]}</option>
                    )}
                    {companyOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                <input
                  value={draft["บริษัท"] ?? draft["บริษัทรับงาน"] ?? ""}
                  disabled={busy}
                  onChange={e => setDraftValue("บริษัท", e.target.value)}
                  placeholder="ชื่อบริษัทฝั่งเราที่รับงาน"
                  className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              )}
            </div>

            {/* สถานที่ */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[11px] font-semibold text-slate-700">สถานที่ปฏิบัติงาน</span>
              <input
                value={draft["สถานที่"] ?? ""}
                disabled={busy}
                onChange={e => setDraftValue("สถานที่", e.target.value)}
                placeholder="สถานที่ตั้งโครงการ หรือ สาขาปฏิบัติงาน"
                className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {/* GROUP 3: ตัวเลขสัญญาและกรอบงบประมาณ */}
        <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-200">
            <Coins size={14} className="text-indigo-600" />
            <span>3. มูลค่างานและกรอบงบประมาณ</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* ยอดงาน */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">ยอดงาน (ก่อน VAT)</span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft["ยอดงาน"] ?? ""}
                  disabled={busy}
                  onChange={e => setDraftValue("ยอดงาน", e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-3 pr-8 py-2 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-right"
                />
                <span className="absolute right-2.5 top-2 text-xs text-slate-400 pointer-events-none">฿</span>
              </div>
              <span className="text-[10px] text-slate-400">คำนวณ VAT 7% ให้อัตโนมัติ</span>
            </div>

            {/* ยอดรวม VAT */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">ยอดรวม VAT 7%</span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft["ยอดรวม vat"] ?? ""}
                  disabled={busy}
                  onChange={e => setDraftValue("ยอดรวม vat", e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-3 pr-8 py-2 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-right"
                />
                <span className="absolute right-2.5 top-2 text-xs text-slate-400 pointer-events-none">฿</span>
              </div>
              <span className="text-[10px] text-slate-400">ยอดรวมภาษีมูลค่าเพิ่ม</span>
            </div>

            {/* งบไม่เกิน */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-emerald-800">กรอบงบประมาณ (งบไม่เกิน)</span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft["งบไม่เกิน"] ?? ""}
                  disabled={busy}
                  onChange={e => setDraftValue("งบไม่เกิน", e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-3 pr-8 py-2 text-xs font-mono font-bold text-emerald-800 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-right"
                />
                <span className="absolute right-2.5 top-2 text-xs text-emerald-500 pointer-events-none">฿</span>
              </div>
              <span className="text-[10px] text-slate-400">วงเงินสูงสุดที่อนุญาตให้เบิก</span>
            </div>

            {/* รวม ALL (Readonly) */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>เบิกสะสมรวม (รวม ALL)</span>
                <Lock size={10} className="text-slate-400" />
              </span>
              <div className="relative">
                <input
                  value={money(spent)}
                  readOnly
                  className="w-full pl-3 pr-8 py-2 text-xs font-mono font-black text-slate-600 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed text-right"
                />
                <span className="absolute right-2.5 top-2 text-xs text-slate-400 pointer-events-none">฿</span>
              </div>
              <span className="text-[10px] text-slate-400">คำนวณจากยอดบิลจริงในระบบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          disabled={busy}
          onClick={cancelEdit}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
        >
          <X size={14} />
          <span>ยกเลิก</span>
        </button>
        <button
          type="submit"
          disabled={busy || !canSave}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition shadow-xs cursor-pointer"
        >
          <Save size={14} />
          <span>{busy ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</span>
        </button>
      </div>
    </form>
  );
}

function draftFromProject(project: SheetRow, fields: string[]) {
  const raw = project._raw || project;
  const allKeys = [...new Set([...fields, ...Object.keys(project).filter(k => !k.startsWith("_"))])];
  return Object.fromEntries(allKeys.map(field => [field, stringify(raw[field] ?? project[field])]));
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function readonlyField(field: string) {
  return field === "ID Project" || field === "รวม ALL";
}
