"use client";

import { Banknote, Check, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeBillStatus } from "@/lib/bills/bill-status";
import { showConfirm } from "@/components/shared/ToastProvider";
import type { SheetRow } from "@/lib/types";
import type { UserPermissions } from "@/lib/user-permissions";

type BillWorkflowActionsProps = {
  row: SheetRow;
  compact?: boolean;
  allowEdit?: boolean;
  redirectAfterDelete?: string;
  userPermissions?: UserPermissions | null;
};

export function BillWorkflowActions({
  row,
  compact = false,
  allowEdit = false,
  redirectAfterDelete,
  userPermissions,
}: BillWorkflowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"status" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [clientPerms, setClientPerms] = useState<UserPermissions | null>(userPermissions || null);

  useEffect(() => {
    if (userPermissions) {
      setClientPerms(userPermissions);
      return;
    }

    if (typeof document !== "undefined") {
      const roleMatch = document.cookie.match(/auth_role=([^;]+)/);
      const role = roleMatch ? decodeURIComponent(roleMatch[1]) : "";
      const isOwner = role === "Owner" || role === "Admin";
      const canDeleteMatch = document.cookie.match(/auth_can_delete=([^;]+)/);
      const canDelete = canDeleteMatch ? canDeleteMatch[1] === "true" : false;
      const empMatch = document.cookie.match(/auth_employee_id=([^;]+)/);
      const empId = empMatch ? decodeURIComponent(empMatch[1]) : "";
      const nameMatch = document.cookie.match(/auth_name=([^;]+)/);
      const name = nameMatch ? decodeURIComponent(nameMatch[1]) : "";

      setClientPerms({
        id: empId,
        displayName: name,
        role: role || "User",
        isOwner,
        canApprove: isOwner || role === "Finance",
        canCloseBill: isOwner || role === "Approver",
        canDelete: isOwner || canDelete,
      });
    }
  }, [userPermissions]);

  useEffect(() => {
    const handlePermUpdate = () => {
      fetch("/api/auth/sync", { cache: "no-store" })
        .then(res => res.json())
        .then(data => {
          if (data?.success && data.user) {
            setClientPerms(data.user);
          }
        })
        .catch(() => undefined);
    };
    window.addEventListener("user-permissions-updated", handlePermUpdate);
    return () => window.removeEventListener("user-permissions-updated", handlePermUpdate);
  }, []);

  const isOwner = Boolean(clientPerms?.isOwner || clientPerms?.role === "Owner" || clientPerms?.role === "Admin");
  const canApproveBill = isOwner || Boolean(clientPerms?.canCloseBill) || clientPerms?.role === "Approver" || clientPerms?.role === "Admin_Approver";
  const canMarkPaid = isOwner || Boolean(clientPerms?.canApprove) || Boolean(clientPerms?.canCloseBill) || clientPerms?.role === "Finance" || clientPerms?.role === "Approver" || clientPerms?.role === "Admin_Closer";
  const canDeleteBill = isOwner || Boolean(clientPerms?.canDelete);

  const sheetRow = row.id ?? row["ลำดับ"] ?? row._sheetRow;
  const status = normalizeBillStatus(row["สถานะ"]);
  const pending = status === "รออนุมัติ" || status === "ตั้งเบิก" || status === "รอตั้งเบิก";
  const approved = status === "อนุมัติ";

  function editBill() {
    window.dispatchEvent(new CustomEvent("open-bill-edit-form", { detail: { row, id: sheetRow, sheetRow } }));
  }

  async function updateStatus(nextStatus: "อนุมัติ" | "เบิกแล้ว") {
    setBusy("status");
    setError("");
    try {
      const response = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: "Data", id: sheetRow, sheetRow, values: { "สถานะ": nextStatus } })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "เปลี่ยนสถานะไม่สำเร็จ");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function deleteBill() {
    const confirmed = await showConfirm(`ลบบิล ${String(row["ลำดับ"] || row.id || "")} ใช่หรือไม่`);
    if (!confirmed) return;
    setBusy("delete");
    setError("");
    try {
      const response = await fetch("/api/rows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: "Data", ids: [sheetRow], sheetRows: [sheetRow] })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "ลบบิลไม่สำเร็จ");
      if (redirectAfterDelete) router.push(redirectAfterDelete);
      else router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ลบบิลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  const btnBase = "inline-flex items-center justify-center gap-1.5 h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs shrink-0";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {allowEdit ? (
        <button
          type="button"
          onClick={editBill}
          title="แก้ไขบิล"
          aria-label="แก้ไขบิล"
          className={`${btnBase} bg-white text-slate-800 border border-slate-300 hover:bg-slate-100`}
        >
          <Pencil size={14} className="shrink-0 text-slate-700" />
          {compact ? null : <span>แก้ไข</span>}
        </button>
      ) : null}

      {pending && canApproveBill ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => updateStatus("อนุมัติ")}
          title="อนุมัติบิล"
          className={`${btnBase} bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900`}
        >
          {busy === "status" ? <LoaderCircle className="animate-spin shrink-0" size={14} /> : <Check size={14} className="shrink-0" />}
          {compact ? null : <span>อนุมัติ</span>}
        </button>
      ) : null}

      {approved && canMarkPaid ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => updateStatus("เบิกแล้ว")}
          title="บันทึกว่าเบิกแล้ว"
          className={`${btnBase} bg-sky-700 text-white hover:bg-sky-800 active:bg-sky-900`}
        >
          {busy === "status" ? <LoaderCircle className="animate-spin shrink-0" size={14} /> : <Banknote size={14} className="shrink-0" />}
          {compact ? null : <span>เบิกแล้ว</span>}
        </button>
      ) : null}

      {canDeleteBill ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={deleteBill}
          title="ลบบิล"
          aria-label="ลบบิล"
          className={`${btnBase} bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100`}
        >
          {busy === "delete" ? <LoaderCircle className="animate-spin shrink-0" size={14} /> : <Trash2 size={14} className="shrink-0 text-rose-600" />}
          {compact ? null : <span>ลบ</span>}
        </button>
      ) : null}

      {error ? <span className="text-xs text-rose-600 font-medium">{error}</span> : null}
    </div>
  );
}

