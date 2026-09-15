"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { TABLES } from "@/lib/config";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateDisplay } from "@/lib/utils/dates";
import type { SheetRow } from "@/lib/types";

type ProjectDetailEditorProps = {
  fields: string[];
  project: SheetRow;
  customerDisplay?: string;
  companyDisplay?: string;
  initialEditing?: boolean;
};

export function ProjectDetailEditor({
  fields,
  project,
  customerDisplay,
  companyDisplay,
  initialEditing = false
}: ProjectDetailEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(initialEditing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>(() => draftFromProject(project, fields));
  const rowKey = project.id ?? project["ID Project"] ?? project._sheetRow;
  const canSave = Boolean(rowKey);

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

  if (editing) {
    return (
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 transition-all">
        <form onSubmit={submit}>
          <header className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base text-slate-800">แก้ไขข้อมูล Project</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={cancelEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                <X size={15} />
                <span>ยกเลิก</span>
              </button>
              <button
                type="submit"
                disabled={busy || !canSave}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition-all shadow-xs"
              >
                <Save size={15} />
                <span>บันทึก</span>
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.filter(f => (!f.startsWith("งบไม่เกิน") || f === "งบไม่เกิน") && f !== "คุมงบประเภทงาน").map(field => (
              <label className="flex flex-col gap-1.5" key={field}>
                <span className="text-xs text-slate-500 uppercase tracking-wider">{field}</span>
                {readonlyField(field) ? (
                  <input
                    value={formatDisplay(project[field], field)}
                    readOnly
                    className="w-full px-3 py-2 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg cursor-not-allowed"
                  />
                ) : field === "color" ? (
                  <select
                    value={draft[field] || ""}
                    disabled={busy}
                    onChange={event => setDraftValue(field, event.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value=""></option>
                    <option value="Green">Green</option>
                    <option value="Red">Red</option>
                    <option value="Black">Black</option>
                  </select>
                ) : longField(field) ? (
                  <textarea
                    value={draft[field] || ""}
                    disabled={busy}
                    rows={3}
                    onChange={event => setDraftValue(field, event.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                ) : (
                  <input
                    value={draft[field] || ""}
                    disabled={busy}
                    inputMode={amountField(field) ? "decimal" : undefined}
                    onChange={event => setDraftValue(field, event.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                )}
              </label>
            ))}
          </div>

          {error ? <div className="mt-4 p-3 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium border border-rose-200">{error}</div> : null}
        </form>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 transition-all">
      <header className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <h3 className="text-base text-slate-800">ข้อมูล Project</h3>
        <button
          type="button"
          disabled={!canSave}
          onClick={beginEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <Pencil size={15} />
          <span>แก้ไข</span>
        </button>
      </header>
      <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map(field => (
          <div key={field} className="p-3 bg-slate-50/60 rounded-lg border border-slate-100 flex flex-col justify-between">
            <dt className="text-xs text-slate-400 uppercase tracking-wider mb-1">{field}</dt>
            <dd className={`text-xs text-slate-800 ${amountField(field) ? "text-right text-emerald-700 " : ""}`}>
              {field === "ชื่อลูกค้า" || field === "ลูกค้า"
                ? customerDisplay || formatDisplay(project[field], field) || "-"
                : field === "บริษัท"
                ? companyDisplay || formatDisplay(project[field], field) || "-"
                : formatDisplay(project[field], field) || "-"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );

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

function amountField(field: string) {
  return ["ยอดงาน", "ยอดรวม vat", "งบไม่เกิน", "รวม ALL"].includes(field) || field.startsWith("งบไม่เกิน");
}

function longField(field: string) {
  return field === "ชื่อ Project" || field === "ชื่อลูกค้า" || field === "บริษัท" || field === "สถานที่";
}

function isDateField(field: string) {
  return /วันที่|date|ว\/ด\/ป/.test(field);
}

function formatDisplay(value: unknown, field: string) {
  if (amountField(field)) return money(value);
  if (isDateField(field)) return formatDateDisplay(value);
  return stringify(value);
}

