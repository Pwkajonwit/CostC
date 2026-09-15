"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { FormModal } from "@/components/forms/FormModal";
import { TABLES } from "@/lib/config";
import { FORM_SCHEMAS } from "@/lib/schemas";
import { useRouter } from "next/navigation";
import { showConfirm, showToast } from "@/components/shared/ToastProvider";
import type { SheetRow } from "@/lib/types";

const EDIT_EVENT = "open-contract-detail-edit-form";

type ContractDetailEditButtonProps = {
  form?: any;
  row: SheetRow | undefined;
};

export function ContractDetailEditButton({ form, row }: ContractDetailEditButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  function handleEditClick() {
    const sheetRow = row?._sheetRow ?? row?.id_Conwork ?? row?.id;
    window.dispatchEvent(
      new CustomEvent(EDIT_EVENT, {
        detail: { row: row ?? {}, sheetRow }
      })
    );
  }

  async function handleDelete() {
    const label = String(row?.id || row?.id_Conwork || row?._sheetRow || "");
    const confirmed = await showConfirm(`ลบสัญญา ${label} ใช่หรือไม่?`);
    if (!confirmed) return;
    const sheetRow = row?.id ?? row?.id_Conwork ?? row?._sheetRow;
    if (!sheetRow) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/rows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: TABLES.CONTRACT_WORK, ids: [sheetRow], sheetRows: [sheetRow] })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("data-updated", { detail: { tableName: TABLES.CONTRACT_WORK } }));
      }
      showToast("success", "ลบสัญญาสำเร็จแล้ว");
      router.push("/contract-open");
      router.refresh();
    } catch (e: any) {
      showToast("error", `เกิดข้อผิดพลาด: ${e?.message || "ลบไม่สำเร็จ"}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleEditClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-700 transition"
        >
          <Pencil size={13} />
          <span>แก้ไข</span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-rose-200 rounded-md bg-white hover:bg-rose-50 text-rose-600 transition disabled:opacity-40"
        >
          <Trash2 size={13} />
          <span>{deleting ? "กำลังลบ..." : "ลบ"}</span>
        </button>
      </div>

      <FormModal
        key="contract-detail-edit-modal"
        tableName={TABLES.CONTRACT_WORK}
        form={form}
        buttonLabel="แก้ไขสัญญา"
        title="แก้ไขสัญญาจ้างงาน"
        submitPath="/api/rows"
        openEventName={EDIT_EVENT}
        hideLauncher
      />
    </>
  );
}
