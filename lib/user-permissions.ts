import type { SheetRow } from "@/lib/types";

export type UserPermissions = {
  id: string;
  displayName: string;
  role: "Owner" | "Approver" | "Finance" | "User" | string;
  isOwner: boolean;
  canApprove: boolean;
  canCloseBill: boolean;
  canDelete: boolean;
  pictureUrl?: string;
};

export function extractMemberPermissions(member: any): UserPermissions {
  if (!member) {
    return {
      id: "",
      displayName: "",
      role: "User",
      isOwner: false,
      canApprove: false,
      canCloseBill: false,
      canDelete: false,
    };
  }

  const d = (member.data && typeof member.data === "object") ? member.data : {};

  const isOwner = Boolean(
    (member.is_owner ?? member["เจ้าของระบบ"] ?? d.is_owner ?? d["เจ้าของระบบ"]) ||
    member.role === "Owner" ||
    member.system_role === "Owner" ||
    d.role === "Owner"
  );

  const canCloseBill = isOwner || Boolean(
    (member.can_close_bill ?? member["อนุมัติบิล"] ?? d.can_close_bill ?? d["อนุมัติบิล"]) ||
    member.role === "Approver" ||
    member.system_role === "Approver"
  );

  const canApprove = isOwner || Boolean(
    (member.can_approve ?? member["ฝ่ายการเงิน"] ?? d.can_approve ?? d["ฝ่ายการเงิน"]) ||
    member.role === "Finance" ||
    member.system_role === "Finance"
  );

  const canDelete = isOwner || Boolean(
    (member.can_delete ?? member["สิทธิ์ลบข้อมูล"] ?? d.can_delete ?? d["สิทธิ์ลบข้อมูล"])
  );

  const role = isOwner
    ? "Owner"
    : (canCloseBill ? "Approver" : (canApprove ? "Finance" : (member.system_role || member.role || d.role || "User")));

  const empId = String(member.id || member["รหัสพนักงาน"] || d.id || "").trim();
  const displayName = String(
    member.nickname ||
    member["ชื่อเล่น"] ||
    d.nickname ||
    member.full_name ||
    member["ชื่อ-นามสกุล"] ||
    d.full_name ||
    empId
  ).trim();

  return {
    id: empId,
    displayName,
    role,
    isOwner,
    canApprove,
    canCloseBill,
    canDelete,
    pictureUrl: member.pictureurl || member.pictureUrl || d.pictureurl || d.pictureUrl || member["รูปภาพ"] || "",
  };
}

export function findMemberInPeopleRows(peopleRows: SheetRow[], empId: string): SheetRow | null {
  if (!empId || !Array.isArray(peopleRows) || peopleRows.length === 0) return null;
  const cleanId = empId.trim().toLowerCase();

  return peopleRows.find(p => {
    const id = String(p.id || p["รหัสพนักงาน"] || "").trim().toLowerCase();
    const sheetRow = String(p._sheetRow || "").trim().toLowerCase();
    return (id && id === cleanId) || (sheetRow && sheetRow === cleanId);
  }) || null;
}
