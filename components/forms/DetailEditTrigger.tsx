"use client";

import { Pencil } from "lucide-react";

type Props = {
  eventName?: string;
  row: Record<string, any>;
  label?: string;
};

export function DetailEditTrigger({ eventName, row, label = "แก้ไขข้อมูล" }: Props) {
  if (!eventName) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(eventName, { detail: { row } }));
        }
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition cursor-pointer"
    >
      <Pencil size={13} className="text-slate-600" />
      <span>{label}</span>
    </button>
  );
}
