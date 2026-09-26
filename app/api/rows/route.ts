import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { clearCache, revalidateAllBillViews } from "@/lib/utils/cache";
import { canEditOrDeleteBill, normalizeBillStatus, validateBillStatusTransition } from "@/lib/bills/bill-status";
import { validateBillRelations } from "@/lib/bills/bill-validation";
import { PRIMARY_VIEWS, TABLE_KEYS, TABLES, VIEW_COLUMNS } from "@/lib/config";
import { uploadTableImage } from "@/lib/utils/drive";
import { applyBillFormulas, applyContractFormulas, applyProjectFormulas } from "@/lib/formulas";
import { getFormSchema } from "@/lib/schemas";
import { isVatActive, isDeductActive, parseDeductPercent, parseCreditDays, parseBillItems } from "@/lib/project-summary";
import { appendAuditLog, appendRow, bulkAppendRows, deleteRows, getRows, getSystemOptions, invalidateTableCache, updateRow } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getDbTableName, getNextBillSequence, syncContractWorkPaidAmount } from "@/lib/supabase/supabase-db";
import { extractMemberPermissions, type UserPermissions } from "@/lib/user-permissions";
import { autoClearPettyCashOnSubBillApproval, isSubBill } from "@/lib/petty-cash/petty-cash-clear";
import type { SheetRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store"
};

async function getUserPermissionsFromRequest(request: NextRequest): Promise<UserPermissions | null> {
  const empId = request.cookies.get("auth_employee_id")?.value;
  const cookieRole = request.cookies.get("auth_role")?.value || "";
  const cookieCanDelete = request.cookies.get("auth_can_delete")?.value === "true";
  const cookieName = request.cookies.get("auth_name")?.value || "";

  if (empId) {
    // 1. Direct server-side verification in master_members table (Source of Truth)
    try {
      const { data: member } = await supabaseAdmin
        .from("master_members")
        .select("*")
        .eq("id", empId)
        .maybeSingle();

      if (member) {
        return extractMemberPermissions(member);
      }
    } catch (e) {
      console.warn("getUserPermissionsFromRequest master_members lookup error:", e);
    }

    // 2. Fallback: Check users_list cache in database by employeeId
    try {
      const { data } = await supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "users_list")
        .maybeSingle();

      if (data?.data && Array.isArray(data.data)) {
        const u = data.data.find((x: any) => x.id === empId || x.username === empId);
        if (u) {
          return extractMemberPermissions(u);
        }
      }
    } catch (e) {}
  }

  // 3. Fallback from cookies if present
  if (cookieRole || empId) {
    const isOwner = cookieRole === "Owner" || cookieRole === "Admin";
    return {
      id: empId || "",
      displayName: cookieName || empId || "",
      role: cookieRole || "User",
      isOwner,
      canApprove: isOwner || cookieRole === "Finance",
      canCloseBill: isOwner || cookieRole === "Approver",
      canDelete: isOwner || cookieCanDelete,
    };
  }

  return null;
}

async function verifyDeletePermission(request: NextRequest): Promise<boolean> {
  const perms = await getUserPermissionsFromRequest(request);
  if (!perms) return false;
  return Boolean(perms.isOwner || perms.canDelete || perms.role === "Owner" || perms.role === "Admin");
}

function isMasterTable(tableName: string): boolean {
  if (!tableName) return false;
  const t = tableName.trim().toLowerCase();
  const canonical = getDbTableName(tableName)?.toLowerCase() || t;

  return (
    canonical === "stores" || t === "ร้านค้า" || t === "stores" ||
    canonical === "contractors" || t === "รับเหมา" || t === "contractors" ||
    canonical === "banks" || t === "ธนาคาร" || t === "banks" ||
    canonical === "categories" || t === "ประเภท" || t === "categories" ||
    canonical === "companies" || t === "บริษัท" || t === "companies" ||
    canonical === "customers" || t === "ลูกค้า" || t === "customers" ||
    canonical === "cars" || t === "ทะเบียนรถ" || t === "ทะเบียน" || t === "cars" ||
    canonical === "master_members" || t === "รายชื่อ" || t === "ชื่อพนักงาน" || t === "people" ||
    canonical === "projects" || t === "project" || t === "1. project รวม" ||
    canonical === "loans" || t === "ยืมเงิน" || t === "loans" ||
    canonical === "products" || t === "สินค้า" || t === "products" ||
    canonical === "system_options" || t === "ตัวเลือกระบบ" || t === "system_options"
  );
}

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get("tableName");
  const viewName = request.nextUrl.searchParams.get("viewName") || "";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
  const limit = Math.max(1, Math.min(500, Number(request.nextUrl.searchParams.get("limit") || 50)));
  const search = request.nextUrl.searchParams.get("search") || "";
  if (!tableName) return NextResponse.json({ error: "Missing tableName" }, { status: 400 });

  let allRows = await getRows(tableName);
  if (search) {
    const q = search.toLowerCase();
    allRows = allRows.filter(row => Object.values(row).some(value => String(value || "").toLowerCase().includes(q)));
  }

  const totalCount = allRows.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedRows = allRows.slice(startIndex, startIndex + limit);
  const keyColumn = TABLE_KEYS[tableName] || "_RowNumber";

  return NextResponse.json({
    tableName,
    viewName,
    columns: VIEW_COLUMNS[viewName] || Object.keys(allRows[0] || {}),
    keyColumn,
    page,
    limit,
    totalCount,
    totalPages,
    rows: paginatedRows
  }, { headers: NO_CACHE_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await readPostBody(request);
    const tableName = String(body.tableName || "");
    if (!canManageTable(tableName)) return NextResponse.json({ error: "Table is not manageable" }, { status: 403 });

    // High performance bulk batch insertion
    if (Array.isArray(body.rows) && body.rows.length > 0) {
      const rows = body.rows as SheetRow[];
      const actor = actorFromRequest(request);
      const processedRows: SheetRow[] = [];

      let startSeq = Number(rows[0]["ลำดับ"] || 0);
      if (startSeq <= 0 && (tableName === TABLES.DATA || tableName === "Data" || tableName === "bills")) {
        try {
          const sysOptions = await getSystemOptions();
          const configuredStart = Number((sysOptions as any)?.bill_start_sequence || (sysOptions as any)?.["ลำดับบิลเริ่มต้น"] || 1);
          startSeq = await getNextBillSequence(configuredStart);
        } catch {}
      }

      for (let i = 0; i < rows.length; i++) {
        const itemRow = { ...rows[i] };
        if (tableName === TABLES.DATA || tableName === "Data" || tableName === "bills") {
          if (startSeq > 0) {
            itemRow["ลำดับ"] = String(startSeq + i);
          }
          if (!itemRow["ผู้สร้างบิล"] && !itemRow["created_by"]) {
            itemRow["ผู้สร้างบิล"] = actor;
            itemRow["created_by"] = actor;
          }
          sanitizeBySchema(itemRow, tableName);
          const output = await applyBillFormulas(itemRow);
          processedRows.push(output);
        } else {
          sanitizeBySchema(itemRow, tableName);
          processedRows.push(itemRow);
        }
      }
      const inserted = await bulkAppendRows(tableName, processedRows);
      await appendAuditLog({
        action: "BULK_CREATE",
        tableName,
        key: `count:${processedRows.length}`,
        actor: actor,
        details: { count: processedRows.length }
      }).catch(() => undefined);
      invalidateTableCache(tableName);
      return NextResponse.json({ ok: true, count: inserted?.length || processedRows.length });
    }

    const row = body.row && typeof body.row === "object" ? body.row as SheetRow : {};
    const actor = actorFromRequest(request);
    if ((tableName === TABLES.DATA || tableName === "Data" || tableName === "bills")) {
      if (!row["ผู้สร้างบิล"] && !row["created_by"]) {
        row["ผู้สร้างบิล"] = actor;
        row["created_by"] = actor;
      } else if (!row["ผู้สร้างบิล"] && row["created_by"]) {
        row["ผู้สร้างบิล"] = row["created_by"];
      } else if (row["ผู้สร้างบิล"] && !row["created_by"]) {
        row["created_by"] = row["ผู้สร้างบิล"];
      }
    }
    if (row["LINE User ID"] !== undefined || row["LINE"] !== undefined || row["line_user_id"] !== undefined) {
      const lineVal = row["LINE User ID"] !== undefined
        ? String(row["LINE User ID"] ?? "").trim()
        : row["LINE"] !== undefined
          ? String(row["LINE"] ?? "").trim()
          : String(row["line_user_id"] ?? "").trim();
      row.line_user_id = lineVal;
      row["LINE User ID"] = lineVal;
      row["LINE"] = lineVal;
    }
    sanitizeBySchema(row, tableName);
    validateRequiredBySchema(row, tableName);
    if (tableName === TABLES.DATA) {
      await validateBillRelations(row);
    }
    const isPettyCash = tableName === TABLES.PETTY_CASH || tableName === "เปิดเงินสดย่อย" || tableName === "petty_cash";
    const output = tableName === TABLES.CONTRACT_WORK
      ? await applyContractFormulas(row)
      : tableName === TABLES.PROJECT
        ? applyProjectFormulas(row)
        : (tableName === TABLES.DATA || tableName === "Data" || tableName === "bills")
          ? await applyBillFormulas(row)
          : row;
    if (isPettyCash) {
      const amt = Number(output["จำนวนเงิน"] || 0);
      const clr = Number(output["ยอดเคลียร์แล้ว"] || 0);
      output["ยอดคงเหลือ"] = String(Math.max(0, amt - clr));
      const currentStatus = String(output["สถานะ"] || "").trim();
      if (amt > 0 && clr >= amt && currentStatus !== "ยกเลิก") {
        output["สถานะ"] = "เคลียร์บิลแล้ว";
      }
    }
    await appendRow(tableName, output);
    await appendAuditLog({
      action: "CREATE",
      tableName,
      key: String(output[TABLE_KEYS[tableName]] || ""),
      actor: actor,
      details: { projectId: output["ID Project"] || "" }
    }).catch(() => undefined);
    invalidateTableCache(tableName);
    revalidateAllBillViews();
    try {
      revalidatePath("/contract-open");
      revalidatePath("/petty-cash");
      revalidatePath("/views", "layout");
    } catch {}
    return NextResponse.json({ ok: true, row: output });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readPatchBody(request);
    const tableName = String(body.tableName || "");
    if (!canManageTable(tableName)) return NextResponse.json({ error: "Table is not manageable" }, { status: 403 });

    // High performance bulk batch patching
    if (Array.isArray(body.patches) && body.patches.length > 0) {
      const patches = body.patches as Array<{ id?: string | number; sheetRow?: string | number; values: SheetRow }>;

      // Check permissions if any patch modifies status on bills
      if (tableName === TABLES.DATA || tableName === "Data" || tableName === "bills") {
        const hasStatusChange = patches.some(p => p.values && p.values["สถานะ"] !== undefined);
        if (hasStatusChange) {
          const perms = await getUserPermissionsFromRequest(request);
          const isOwner = Boolean(perms?.isOwner || perms?.role === "Owner" || perms?.role === "Admin");
          const canApprove = isOwner || Boolean(perms?.canCloseBill) || perms?.role === "Approver" || perms?.role === "Admin_Approver";
          const canMarkPaid = isOwner || Boolean(perms?.canApprove) || Boolean(perms?.canCloseBill) || perms?.role === "Finance" || perms?.role === "Approver" || perms?.role === "Admin_Closer";

          for (const p of patches) {
            if (!p.values || p.values["สถานะ"] === undefined) continue;
            const targetSt = normalizeBillStatus(p.values["สถานะ"]);
            if (targetSt === "อนุมัติ" && !canApprove) {
              return NextResponse.json({ error: "⛔ คุณไม่มีสิทธิ์ในการอนุมัติบิล (เฉพาะผู้อนุมัติหรือเจ้าของระบบเท่านั้น)" }, { status: 403 });
            }
            if (targetSt === "เบิกแล้ว" && !canMarkPaid) {
              return NextResponse.json({ error: "⛔ คุณไม่มีสิทธิ์ในการปิดบิล/บันทึกเบิกแล้ว (เฉพาะฝ่ายการเงินหรือเจ้าของระบบเท่านั้น)" }, { status: 403 });
            }
          }
        }
      }
      const existingRows = await getRows(tableName);
      const keyCol = TABLE_KEYS[tableName] || "id";
      const isBillTable = tableName === TABLES.DATA || tableName === "Data" || tableName === "bills";
      const approvedSubBillsList: SheetRow[] = [];

      const results = await Promise.all(
        patches.map(async item => {
          const targetIdentifier = item.id !== undefined && item.id !== null && String(item.id).trim() !== "" ? item.id : item.sheetRow;
          const patch = item.values || {};
          const existing = existingRows.find((row: SheetRow) =>
            (row.id !== undefined && String(row.id) === String(targetIdentifier)) ||
            (keyCol && String(row[keyCol]) === String(targetIdentifier)) ||
            Number(row._sheetRow) === Number(targetIdentifier) ||
            String(row._sheetRow) === String(targetIdentifier) ||
            (row["รหัสพนักงาน"] !== undefined && String(row["รหัสพนักงาน"]) === String(targetIdentifier)) ||
            (row.id_bank !== undefined && String(row.id_bank) === String(targetIdentifier)) ||
            (row.id_store !== undefined && String(row.id_store) === String(targetIdentifier)) ||
            (row.id_Contractor !== undefined && String(row.id_Contractor) === String(targetIdentifier)) ||
            (row.id_car !== undefined && String(row.id_car) === String(targetIdentifier)) ||
            (row.id_cus !== undefined && String(row.id_cus) === String(targetIdentifier)) ||
            (row.id_Company !== undefined && String(row.id_Company) === String(targetIdentifier)) ||
            (row.id_petty_cash !== undefined && String(row.id_petty_cash) === String(targetIdentifier))
          );
          if (!existing) return null;
          const values = { ...existing, ...patch };

          // 🪙 Sub-bill handling:
          // Preserve 'อนุมัติ' upon approval, and queue petty cash auto-clear when closed/paid ('เบิกแล้ว')
          if (isBillTable && patch["สถานะ"] !== undefined) {
            const targetSt = normalizeBillStatus(patch["สถานะ"]);
            const nowIso = new Date().toISOString();
            const todayDate = nowIso.split("T")[0];
            if (targetSt === "อนุมัติ") {
              values["สถานะ"] = "อนุมัติ";
              values.status = "อนุมัติ";
              values.approved_at = nowIso;
            } else if (targetSt === "เบิกแล้ว" && (isSubBill(existing) || isSubBill(values))) {
              values["สถานะ"] = "เบิกแล้ว";
              values.status = "เบิกแล้ว";
              values.paid_at = nowIso;
              values.paid_date = todayDate;
              values["วันจ่าย"] = todayDate;
              approvedSubBillsList.push({ ...existing, ...values });
            }
          }

          if (patch["LINE User ID"] !== undefined || patch["LINE"] !== undefined || patch["line_user_id"] !== undefined) {
            const lineVal = patch["LINE User ID"] !== undefined
              ? String(patch["LINE User ID"] ?? "").trim()
              : patch["LINE"] !== undefined
                ? String(patch["LINE"] ?? "").trim()
                : String(patch["line_user_id"] ?? "").trim();
            values.line_user_id = lineVal;
            values["LINE User ID"] = lineVal;
            values["LINE"] = lineVal;
          }
          const isPettyCash = tableName === TABLES.PETTY_CASH || tableName === "เปิดเงินสดย่อย" || tableName === "petty_cash";
          if (isPettyCash) {
            const amt = Number(values["จำนวนเงิน"] !== undefined ? values["จำนวนเงิน"] : existing["จำนวนเงิน"] || 0);
            const clr = Number(values["ยอดเคลียร์แล้ว"] !== undefined ? values["ยอดเคลียร์แล้ว"] : existing["ยอดเคลียร์แล้ว"] || 0);
            values["ยอดคงเหลือ"] = String(Math.max(0, amt - clr));
            const currentStatus = String(values["สถานะ"] !== undefined ? values["สถานะ"] : existing["สถานะ"] || "").trim();
            if (amt > 0 && clr >= amt && currentStatus !== "ยกเลิก") {
              values["สถานะ"] = "เคลียร์บิลแล้ว";
            } else if (amt > 0 && clr < amt && currentStatus === "เคลียร์บิลแล้ว") {
              values["สถานะ"] = "จ่ายเงินแล้ว";
            }
          }
          const originalTarget = existing.id || (keyCol && existing[keyCol] ? existing[keyCol] : undefined) || targetIdentifier || existing._sheetRow;
          return updateRow(tableName, originalTarget, values);
        })
      );

      // Trigger automatic clearance of petty cash for approved sub-bills
      if (approvedSubBillsList.length > 0) {
        autoClearPettyCashOnSubBillApproval(approvedSubBillsList).catch(err => {
          console.warn("Failed autoClearPettyCashOnSubBillApproval in batch patches:", err);
        });
      }

      invalidateTableCache(tableName);
      try {
        revalidatePath("/views", "layout");
        revalidatePath("/views/people");
        revalidatePath("/views/customers");
        revalidatePath("/views/stores");
        revalidatePath("/views/contractors");
        revalidatePath("/views/cars");
        revalidatePath("/views/companies");
        revalidatePath("/bills");
        revalidatePath("/", "layout");
      } catch {}
      return NextResponse.json({ ok: true, count: results.filter(Boolean).length });
    }

    const targetRowKey = body.id !== undefined && body.id !== null && String(body.id).trim() !== ""
      ? body.id
      : (body.rowKey !== undefined && body.rowKey !== null && String(body.rowKey).trim() !== "" ? body.rowKey : body.sheetRow);
    const patch = body.values && typeof body.values === "object" ? body.values as SheetRow : {};
    const existingRows = await getRows(tableName);
    const keyCol = TABLE_KEYS[tableName] || "id";
    const existing = existingRows.find((row: SheetRow) =>
      (row.id !== undefined && String(row.id) === String(targetRowKey)) ||
      (keyCol && String(row[keyCol]) === String(targetRowKey)) ||
      Number(row._sheetRow) === Number(targetRowKey) ||
      String(row._sheetRow) === String(targetRowKey) ||
      (row["รหัสพนักงาน"] !== undefined && String(row["รหัสพนักงาน"]) === String(targetRowKey)) ||
      (row.id_Conwork !== undefined && String(row.id_Conwork) === String(targetRowKey)) ||
      (row.id_bank !== undefined && String(row.id_bank) === String(targetRowKey)) ||
      (row.id_store !== undefined && String(row.id_store) === String(targetRowKey)) ||
      (row.id_Contractor !== undefined && String(row.id_Contractor) === String(targetRowKey)) ||
      (row.id_car !== undefined && String(row.id_car) === String(targetRowKey)) ||
      (row.id_cus !== undefined && String(row.id_cus) === String(targetRowKey)) ||
      (row.id_Company !== undefined && String(row.id_Company) === String(targetRowKey)) ||
      (row.id_petty_cash !== undefined && String(row.id_petty_cash) === String(targetRowKey))
    );
    if (!existing) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
    const values = { ...existing, ...patch };
    if (patch["รหัสพนักงาน"] !== undefined && String(patch["รหัสพนักงาน"]).trim() !== "") {
      values.id = String(patch["รหัสพนักงาน"]).trim();
    } else if (patch["id_Contractor"] !== undefined && String(patch["id_Contractor"]).trim() !== "") {
      values.id = String(patch["id_Contractor"]).trim();
    } else if (patch["id_store"] !== undefined && String(patch["id_store"]).trim() !== "") {
      values.id = String(patch["id_store"]).trim();
    } else if (patch["id_bank"] !== undefined && String(patch["id_bank"]).trim() !== "") {
      values.id = String(patch["id_bank"]).trim();
    } else if (patch["id_car"] !== undefined && String(patch["id_car"]).trim() !== "") {
      values.id = String(patch["id_car"]).trim();
    } else if (patch["id_cus"] !== undefined && String(patch["id_cus"]).trim() !== "") {
      values.id = String(patch["id_cus"]).trim();
    } else if (patch["id_Company"] !== undefined && String(patch["id_Company"]).trim() !== "") {
      values.id = String(patch["id_Company"]).trim();
    } else if (patch["id_petty_cash"] !== undefined && String(patch["id_petty_cash"]).trim() !== "") {
      values.id = String(patch["id_petty_cash"]).trim();
    }

    if (patch["สิทธิ์การใช้งาน"] !== undefined) {
      const permStr = String(patch["สิทธิ์การใช้งาน"] || "");
      const hasOwner = permStr.includes("Owner") || permStr.includes("เจ้าของระบบ");
      const hasApprover = permStr.includes("Approver") || permStr.includes("อนุมัติบิล");
      const hasFinance = permStr.includes("Finance") || permStr.includes("ฝ่ายการเงิน") || permStr.includes("ปิดบิล");
      const hasDelete = permStr.includes("Delete") || permStr.includes("ลบข้อมูล");

      values["เจ้าของระบบ"] = hasOwner;
      values["อนุมัติบิล"] = hasApprover;
      values["ฝ่ายการเงิน"] = hasFinance;
      values["สิทธิ์ลบข้อมูล"] = hasDelete;
      values.is_owner = hasOwner;
      values.can_close_bill = hasApprover;
      values.can_approve = hasFinance;
      values.can_delete = hasDelete;
    }

    if (patch["LINE User ID"] !== undefined || patch["LINE"] !== undefined || patch["line_user_id"] !== undefined) {
      const lineVal = patch["LINE User ID"] !== undefined
        ? String(patch["LINE User ID"] ?? "").trim()
        : patch["LINE"] !== undefined
          ? String(patch["LINE"] ?? "").trim()
          : String(patch["line_user_id"] ?? "").trim();
      values.line_user_id = lineVal;
      values["LINE User ID"] = lineVal;
      values["LINE"] = lineVal;
    }
    const patchKeys = Object.keys(patch).filter(key => key !== "_sheetRow");
    const isFollowUpOrStatusPatch = tableName === TABLES.DATA && patchKeys.length > 0 && patchKeys.every(key =>
      ["สถานะ", "วันได้บิล", "วันออก 3%", "วันจ่าย", "รูปถ่ายบิล", "ลำดับ"].includes(key)
    );

    if (tableName === TABLES.DATA) {
      if (patch["สถานะ"] !== undefined) {
        const nextStatus = normalizeBillStatus(patch["สถานะ"]);
        const prevStatus = normalizeBillStatus(existing["สถานะ"]);
        if (nextStatus !== prevStatus) {
          const perms = await getUserPermissionsFromRequest(request);
          const isOwner = Boolean(perms?.isOwner || perms?.role === "Owner" || perms?.role === "Admin");
          const canApprove = isOwner || Boolean(perms?.canCloseBill) || perms?.role === "Approver" || perms?.role === "Admin_Approver";
          const canMarkPaid = isOwner || Boolean(perms?.canApprove) || Boolean(perms?.canCloseBill) || perms?.role === "Finance" || perms?.role === "Approver" || perms?.role === "Admin_Closer";

          if (nextStatus === "อนุมัติ" && !canApprove) {
            return NextResponse.json({ error: "⛔ คุณไม่มีสิทธิ์ในการอนุมัติบิล (เฉพาะผู้อนุมัติหรือเจ้าของระบบเท่านั้น)" }, { status: 403 });
          }
          if (nextStatus === "เบิกแล้ว" && !canMarkPaid) {
            return NextResponse.json({ error: "⛔ คุณไม่มีสิทธิ์ในการปิดบิล/บันทึกเบิกแล้ว (เฉพาะฝ่ายการเงินหรือเจ้าของระบบเท่านั้น)" }, { status: 403 });
          }
        }
      }

      ensureBillVendorType(values);
      validateBillPatch(existing, patch, values);
      if (patch["หัก"] !== undefined && !isDeductActive(patch["หัก"])) {
        values["หัก"] = "";
        values["จำนวนหัก"] = "";
        values["3เปอร์"] = "";
        values["3เปอร์เซ็น"] = "";
        values["วันออก 3%"] = "";
        values.withholding_tax = 0;
        values.deduct_amount = 0;
      }
      if (patch["vat"] !== undefined && !isVatActive(patch["vat"])) {
        values["vat"] = "";
        values.vat_amount = 0;
        values["วันได้บิล"] = "";
      }
      if (patch["เครดิต"] !== undefined && parseCreditDays(patch["เครดิต"]) <= 0) {
        values["เครดิต"] = "";
        values.credit_days = 0;
      }
    }

    if (!isFollowUpOrStatusPatch) {
      sanitizeBySchema(values, tableName);
      validateRequiredBySchema(values, tableName);
      if (tableName === TABLES.DATA) await validateBillRelations(values);
    }
    const isContractWork = tableName === TABLES.CONTRACT_WORK || tableName === "Contract_work" || tableName === "contract_works" || tableName === "ContractWork";
    const isProject = tableName === TABLES.PROJECT || tableName === "Project" || tableName === "projects";
    const isPettyCash = tableName === TABLES.PETTY_CASH || tableName === "เปิดเงินสดย่อย" || tableName === "petty_cash";
    const output = isFollowUpOrStatusPatch
      ? values
      : isContractWork
        ? await applyContractFormulas(values)
        : isProject
          ? applyProjectFormulas(values)
          : tableName === TABLES.DATA
            ? await applyBillFormulas(values)
            : values;

    const isBillTable = tableName === TABLES.DATA || tableName === "Data" || tableName === "bills";
    let isApprovedSubBill = false;
    if (isBillTable && (patch["สถานะ"] !== undefined || values["สถานะ"] !== undefined)) {
      const targetSt = normalizeBillStatus(patch["สถานะ"] ?? values["สถานะ"]);
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split("T")[0];
      if (targetSt === "อนุมัติ") {
        output["สถานะ"] = "อนุมัติ";
        output.status = "อนุมัติ";
        output.approved_at = nowIso;
      } else if (targetSt === "เบิกแล้ว" && (isSubBill(existing) || isSubBill(values))) {
        isApprovedSubBill = true;
        output["สถานะ"] = "เบิกแล้ว";
        output.status = "เบิกแล้ว";
        output.paid_at = nowIso;
        output.paid_date = todayDate;
        output["วันจ่าย"] = todayDate;
      }
    }

    if (isPettyCash) {
      const amt = Number(output["จำนวนเงิน"] !== undefined ? output["จำนวนเงิน"] : existing["จำนวนเงิน"] || 0);
      const clr = Number(output["ยอดเคลียร์แล้ว"] !== undefined ? output["ยอดเคลียร์แล้ว"] : existing["ยอดเคลียร์แล้ว"] || 0);
      output["ยอดคงเหลือ"] = String(Math.max(0, amt - clr));
      const currentStatus = String(output["สถานะ"] !== undefined ? output["สถานะ"] : existing["สถานะ"] || "").trim();
      if (amt > 0 && clr >= amt && currentStatus !== "ยกเลิก") {
        output["สถานะ"] = "เคลียร์บิลแล้ว";
      } else if (amt > 0 && clr < amt && currentStatus === "เคลียร์บิลแล้ว") {
        output["สถานะ"] = "จ่ายเงินแล้ว";
      }
    }
    console.log(`[PATCH /api/rows] tableName: "${tableName}", targetRowKey: "${targetRowKey}", values:`, patch);
    const originalTarget = existing.id || (keyCol && existing[keyCol] ? existing[keyCol] : undefined) || targetRowKey || existing._sheetRow;
    const row = await updateRow(tableName, originalTarget, output);
    console.log(`[PATCH /api/rows SUCCESS] updated "${tableName}" row key: "${originalTarget}"`);

    if (isBillTable) {
      const cRef = String(row._rawContractor || row["_rawContractor"] || row.conwork_id || row["สัญญา"] || row.contractor_id || row["ผู้รับเหมา"] || existing._rawContractor || existing.conwork_id || existing["ผู้รับเหมา"] || "").trim();
      const pId = String(row.project_id || row["ID Project"] || existing.project_id || existing["ID Project"] || "").trim();
      if (cRef) {
        syncContractWorkPaidAmount(cRef, pId).catch(() => null);
      }

      // 🪙 Trigger auto-clear petty cash when sub-bill is approved
      if (isApprovedSubBill || ((isSubBill(existing) || isSubBill(row)) && (normalizeBillStatus(patch["สถานะ"] ?? row["สถานะ"]) === "อนุมัติ" || normalizeBillStatus(patch["สถานะ"] ?? row["สถานะ"]) === "เบิกแล้ว"))) {
        autoClearPettyCashOnSubBillApproval([{ ...existing, ...row, ...output }]).catch(err => {
          console.warn("Failed autoClearPettyCashOnSubBillApproval in single PATCH:", err);
        });
      }
    }
    await appendAuditLog({
      action: tableName === TABLES.DATA && Object.keys(patch).every(key => key === "สถานะ") ? "STATUS" : "UPDATE",
      tableName,
      key: String(row[TABLE_KEYS[tableName]] || ""),
      sheetRow: Number(existing._sheetRow) || Number(originalTarget) || 0,
      actor: actorFromRequest(request),
      details: Object.fromEntries(Object.keys(patch).map(key => [key, row[key] ?? ""]))
    }).catch(() => undefined);
    invalidateTableCache(tableName);
    revalidateAllBillViews();
    try {
      revalidatePath("/views", "layout");
      revalidatePath("/views/people", "page");
      revalidatePath("/views/customers", "page");
      revalidatePath("/views/stores", "page");
      revalidatePath("/views/contractors", "page");
      revalidatePath("/views/cars", "page");
      revalidatePath("/views/companies", "page");
      revalidatePath("/contract-open", "page");
      revalidatePath("/contract-open", "layout");
      revalidatePath("/petty-cash", "page");
      revalidatePath("/petty-cash", "layout");
      revalidatePath("/bills", "page");
      revalidatePath("/bills", "layout");
      revalidatePath("/bills/follow-up", "page");
      if (tableName === TABLES.DATA || tableName === "Data" || tableName === "bills") {
        if (targetRowKey) revalidatePath(`/bills/${targetRowKey}`, "page");
        if (originalTarget && String(originalTarget) !== String(targetRowKey)) revalidatePath(`/bills/${originalTarget}`, "page");
        revalidatePath("/bills/[billId]", "page");
      }
    } catch {}
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let tableName = "";
    let rawKeys: (string | number)[] = [];
    try {
      const body = await request.json();
      tableName = String(body.tableName || "");
      rawKeys = Array.isArray(body.ids)
        ? body.ids
        : (Array.isArray(body.sheetRows) ? body.sheetRows : (body.id ? [body.id] : []));
    } catch {
      tableName = request.nextUrl.searchParams.get("tableName") || "";
      const idParam = request.nextUrl.searchParams.get("id");
      if (idParam) rawKeys = [idParam];
    }
    if (!canManageTable(tableName)) return NextResponse.json({ error: "Table is not manageable" }, { status: 403 });

    // จำกัดการลบเฉพาะข้อมูลมาสเตอร์ เมนูย่อย (ร้านค้า, ผู้รับเหมา, พนักงาน, ธนาคาร, ทะเบียนรถ, บริษัท, ลูกค้า, โครงการ ฯลฯ)
    // ในส่วนของเมนูหลัก (บิล/Data, เปิดเงินสดย่อย, เปิดจ้าง, งาน) ผู้ใช้งานสามารถลบและแก้ไขได้ปกติ
    if (isMasterTable(tableName)) {
      const isAllowed = await verifyDeletePermission(request);
      if (!isAllowed) {
        return NextResponse.json({
          error: "⛔ การลบข้อมูลมาสเตอร์ (เช่น ร้านค้า, ผู้รับเหมา, พนักงาน, ธนาคาร, โครงการ ฯลฯ) จำกัดเฉพาะผู้ดูแลระบบหรือผู้ได้รับสิทธิ์ลบข้อมูลเท่านั้น เพื่อป้องกันผลกระทบต่อรายการบิลและสัญญาในระบบ"
        }, { status: 403 });
      }
    }

    const keySet = new Set(rawKeys.map(k => String(k).trim()));
    const keyCol = TABLE_KEYS[tableName] || "id";
    const allRows = await getRows(tableName);
    const deletingRows = allRows.filter(row =>
      (row.id !== undefined && keySet.has(String(row.id))) ||
      (keyCol && String(row[keyCol]) !== undefined && keySet.has(String(row[keyCol]))) ||
      keySet.has(String(row._sheetRow)) ||
      (row["ลำดับ"] !== undefined && keySet.has(String(row["ลำดับ"]))) ||
      (row.id_Conwork !== undefined && keySet.has(String(row.id_Conwork))) ||
      (row.id_store !== undefined && keySet.has(String(row.id_store))) ||
      (row.id_bank !== undefined && keySet.has(String(row.id_bank))) ||
      (row.id_Contractor !== undefined && keySet.has(String(row.id_Contractor))) ||
      (row.id_car !== undefined && keySet.has(String(row.id_car))) ||
      (row.id_cus !== undefined && keySet.has(String(row.id_cus))) ||
      (row.id_Company !== undefined && keySet.has(String(row.id_Company))) ||
      (row.id_petty_cash !== undefined && keySet.has(String(row.id_petty_cash)))
    );

    const numericSheetRows = rawKeys.map(Number).filter(n => !isNaN(n));
    if (tableName === TABLES.PROJECT) await validateProjectDelete(numericSheetRows);
    if (tableName === TABLES.DATA) validateBillDelete(deletingRows);

    await deleteRows(tableName, rawKeys, deletingRows);
    await Promise.all(deletingRows.map(row => appendAuditLog({
      action: "DELETE",
      tableName,
      key: String(row[TABLE_KEYS[tableName]] || row.id || ""),
      sheetRow: Number(row._sheetRow) || 0,
      actor: actorFromRequest(request),
      details: { projectId: row["ID Project"] || "" }
    }).catch(() => undefined)));

    invalidateTableCache(tableName);
    if (tableName === TABLES.DATA || tableName === "Data" || tableName === "bills") {
      for (const dRow of deletingRows) {
        const cRef = String(dRow._rawContractor || dRow["_rawContractor"] || dRow.conwork_id || dRow["สัญญา"] || dRow.contractor_id || dRow["ผู้รับเหมา"] || "").trim();
        const pId = String(dRow.project_id || dRow["ID Project"] || "").trim();
        if (cRef) {
          syncContractWorkPaidAmount(cRef, pId).catch(() => null);
        }
      }
    }
    invalidateTableCache(tableName);
    revalidateAllBillViews();
    try {
      revalidatePath("/contract-open", "page");
      revalidatePath("/contract-open", "layout");
      revalidatePath("/petty-cash", "page");
      revalidatePath("/petty-cash", "layout");
      revalidatePath("/bills", "page");
      revalidatePath("/bills", "layout");
      revalidatePath("/bills/[billId]", "page");
      revalidatePath("/bills/follow-up", "page");
      revalidatePath("/views", "layout");
    } catch {}
    return NextResponse.json({ ok: true, deleted: rawKeys.length });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function validateBillPatch(existing: SheetRow, patch: SheetRow, values: SheetRow) {
  const patchKeys = Object.keys(patch).filter(key => key !== "_sheetRow");
  const statusOnly = patchKeys.length > 0 && patchKeys.every(key => key === "สถานะ");
  if (statusOnly) {
    validateBillStatusTransition(existing["สถานะ"], values["สถานะ"]);
    return;
  }
  if (!patch["สถานะ"]) {
    values["สถานะ"] = existing["สถานะ"] || "รออนุมัติ";
  }
}

function ensureBillVendorType(row: SheetRow) {
  const current = String(row["ร้านค้า/ผู้รับเหมา"] ?? row.vendor_type ?? "").trim();
  const category = String(row["ประเภท"] ?? row.category ?? "").trim();
  const hasLaborCost = Number(row["ค่าแรง"] ?? row.labor_cost ?? 0) > 0;
  const hasLaborStatus = Boolean(row["statusค่าแรง"] ?? row.labor_status);

  if (current === "ร้านค้า") {
    row["ร้านค้า/ผู้รับเหมา"] = "ร้านค้า";
    row["ผู้รับเหมา"] = "";
    if (!row["ร้านค้า"] && row["ร้าน/บุคคล"]) row["ร้านค้า"] = row["ร้าน/บุคคล"];
    return;
  }

  if (current === "พนักงาน") {
    row["ร้านค้า/ผู้รับเหมา"] = "พนักงาน";
    row["ผู้รับเหมา"] = "";
    row["ร้านค้า"] = "";
    return;
  }

  if (current === "ผู้รับเหมา") {
    row["ร้านค้า/ผู้รับเหมา"] = "ผู้รับเหมา";
    row["ร้านค้า"] = "";
    if (!row["ผู้รับเหมา"] && row["ร้าน/บุคคล"]) row["ผู้รับเหมา"] = row["ร้าน/บุคคล"];
    return;
  }

  if (
    hasRowValue(row["ผู้รับเหมา"]) ||
    hasRowValue(row.contractor_id) ||
    category.startsWith("2.") ||
    category.includes("ค่าแรง") ||
    hasLaborCost ||
    hasLaborStatus
  ) {
    row["ร้านค้า/ผู้รับเหมา"] = "ผู้รับเหมา";
    row["ร้านค้า"] = "";
    if (!row["ผู้รับเหมา"] && row["ร้าน/บุคคล"]) row["ผู้รับเหมา"] = row["ร้าน/บุคคล"];
  } else if (category.startsWith("3.") || category.includes("พนักงาน")) {
    row["ร้านค้า/ผู้รับเหมา"] = "พนักงาน";
    row["ผู้รับเหมา"] = "";
    row["ร้านค้า"] = "";
  } else {
    row["ร้านค้า/ผู้รับเหมา"] = "ร้านค้า";
    row["ผู้รับเหมา"] = "";
    if (!row["ร้านค้า"] && row["ร้าน/บุคคล"]) row["ร้านค้า"] = row["ร้าน/บุคคล"];
  }
}

function validateBillDelete(_deletingRows: SheetRow[]) {
  // Allow deleting bills
}

function canManageTable(tableName: string) {
  if (!tableName) return false;
  const knownTables = new Set([
    "Data", "bills", "data", "bills", "กรอกบิล",
    "Project", "projects", "project", "1. Project รวม",
    "ร้านค้า", "stores", "store", "4. ร้านค้า",
    "รับเหมา", "contractors", "contractor", "5. รับเหมา",
    "งานรับเหมา", "contract_works", "ContractWork", "contractwork", "CONTRACT_WORK", "Contract_work", "เปิดจ้าง",
    "รายชื่อ", "master_members", "PEOPLE", "Master Member", "people", "พนักงาน", "ชื่อพนักงาน", "6. ชื่อพนักงาน", "รายชื่อพนักงาน",
    "ธนาคาร", "banks", "bank", "BANK", "2. ธนาคาร",
    "ทะเบียน", "cars", "car", "CAR", "7. ทะเบียนรถ",
    "ประเภท", "categories", "category", "3. ประเภท",
    "ลูกค้า", "customers", "customer", "8. ลูกค้า",
    "บริษัท", "companies", "company", "9. บริษัท",
    "ยืมเงิน", "loans", "loan", "10. ยืมเงิน",
    "สินค้า", "products", "product",
    "Tasks", "tasks", "Works", "works", "Plan", "plans",
    "เปิดเงินสดย่อย", "petty_cash", "petty-cash"
  ]);
  if (knownTables.has(tableName)) return true;
  return PRIMARY_VIEWS.some(view => (view as any).table === tableName || (view as any).name === tableName || view.id === tableName);
}

function actorFromRequest(request: NextRequest) {
  const authName = request.cookies.get("auth_name")?.value;
  const authEmpId = request.cookies.get("auth_employee_id")?.value;
  return authName || authEmpId || request.headers.get("x-user-email") || "web";
}

function sanitizeBySchema(row: SheetRow, tableName: string) {
  const schema = getFormSchema(tableName);
  const items = (tableName === TABLES.DATA || tableName === "Data" || tableName === "bills") ? parseBillItems(row) : [];
  const hasMultiItems = items.length > 0;
  const amountCols = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];

  schema.forEach(field => {
    if (field.name === "สินค้า" && typeof row[field.name] === "string") {
      row[field.name] = (row[field.name] as string).replace(/^\d+\s*/, "");
    }
    if (field.type === "Hidden") return;
    if (hasMultiItems && amountCols.includes(field.name) && hasRowValue(row[field.name])) return;
    // CRITICAL: NEVER wipe out "วันจ่าย" or "เครดิต" if a value was provided
    if (field.name === "วันจ่าย" && (hasRowValue(row["วันจ่าย"]) || hasRowValue(row.paid_date))) return;
    if (field.name === "เครดิต" && (hasRowValue(row["เครดิต"]) || hasRowValue(row.credit_days))) return;
    if (isFieldVisible(field, row)) return;
    row[field.name] = "";
  });
  return row;
}

function validateRequiredBySchema(row: SheetRow, tableName: string) {
  const missing = getFormSchema(tableName).find(field => {
    if (!field.required || field.type === "Hidden" || field.readonly) return false;
    const vType = String(row["ร้านค้า/ผู้รับเหมา"] ?? row.vendor_type ?? "").trim();
    if (field.name === "statusค่าแรง") {
      if (vType !== "ผู้รับเหมา") return false;
    }
    if (field.name === "ผู้รับเหมา") {
      if (vType && vType !== "ผู้รับเหมา") return false;
      const category = String(row["ประเภท"] || row.category || "").trim();
      if (
        category.startsWith("3.") ||
        category.includes("พนักงาน") ||
        category.startsWith("8.") ||
        category.includes("อื่นๆ")
      ) {
        return false;
      }
    }
    if (!isFieldVisible(field, row)) return false;
    return !hasRowValue(row[field.name]);
  });
  if (missing) throw new Error(`กรุณากรอก ${missing.name}`);
}

function isFieldVisible(field: ReturnType<typeof getFormSchema>[number], row: SheetRow) {
  const vendorType = String(row["ร้านค้า/ผู้รับเหมา"] ?? row.vendor_type ?? "").trim();
  if (field.name === "statusค่าแรง") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "ผู้รับเหมา" || field.name === "ค่าแรงคงเหลือ") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "วันได้บิล") {
    const hasVat = isVatActive(row["vat"]);
    const hasCredit = parseCreditDays(row["เครดิต"]) > 0;
    return hasVat && !hasCredit;
  }
  if (field.name === "เครดิต") {
    return vendorType === "ร้านค้า" || isVatActive(row["vat"]) || parseCreditDays(row["เครดิต"]) > 0 || hasRowValue(row["เครดิต"]);
  }
  if (field.name === "วันจ่าย") {
    return Boolean(hasRowValue(row["วันจ่าย"]) || hasRowValue(row["paid_date"]) || parseCreditDays(row["เครดิต"]) > 0 || hasRowValue(row["เครดิต"]));
  }
  if (!field.showIf) return true;
  const actual = row[field.showIf.column] || "";
  if (field.showIf.equals !== undefined) return String(actual) === field.showIf.equals;
  if (field.showIf.in) return field.showIf.in.includes(String(actual));
  if (field.showIf.notBlank) {
    if (field.showIf.column === "vat") return isVatActive(actual);
    if (field.showIf.column === "หัก") return parseDeductPercent(actual) > 0;
    if (field.showIf.column === "เครดิต") return parseCreditDays(actual) > 0 || hasRowValue(actual);
    return hasRowValue(actual);
  }
  return true;
}

function hasRowValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

async function validateProjectDelete(sheetRows: number[]) {
  const [projects, dataRows, contractRows] = await Promise.all([
    getRows(TABLES.PROJECT),
    getRows(TABLES.DATA),
    getRows(TABLES.CONTRACT_WORK)
  ]);
  const deletingProjects = projects.filter(row => sheetRows.includes(Number(row._sheetRow)));
  const blocked = deletingProjects.flatMap(project => {
    const projectId = String(project["ID Project"] || "").trim();
    if (!projectId) return [];
    const billCount = dataRows.filter(row => String(row["ID Project"] || "").trim() === projectId).length;
    const contractCount = contractRows.filter(row => String(row["ID Project"] || "").trim() === projectId).length;
    return billCount || contractCount ? [`${projectId} (${billCount} บิล, ${contractCount} เปิดจ้าง)`] : [];
  });
  if (blocked.length) {
    throw new Error(`ลบ Project ไม่ได้ เพราะมีข้อมูลที่ผูกอยู่: ${blocked.slice(0, 5).join(", ")}`);
  }
}

async function readPostBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }

  const formData = await request.formData();
  const tableName = String(formData.get("tableName") || "");

  const rawRows = formData.get("rows");
  if (rawRows && typeof rawRows === "string") {
    try {
      const parsedRows = JSON.parse(rawRows);
      if (Array.isArray(parsedRows) && parsedRows.length > 0) {
        const dummyRow: SheetRow = {};
        await attachUploadedFiles(formData, tableName, dummyRow);
        const imgUrl = dummyRow["รูปถ่ายบิล"] || "";
        const finalRows = parsedRows.map(r => ({
          ...r,
          ...(imgUrl && !r["รูปถ่ายบิล"] ? { "รูปถ่ายบิล": imgUrl } : {})
        }));
        return { tableName, rows: finalRows };
      }
    } catch (e) {
      console.warn("Failed parsing bulk rows from formData:", e);
    }
  }

  const row: SheetRow = {};
  for (const [key, value] of formData.entries()) {
    if (key === "tableName" || key === "rows" || isFile(value)) continue;
    row[key] = typeof value === "string" ? value : "";
  }
  await attachUploadedFiles(formData, tableName, row);
  return { tableName, row };
}

async function readPatchBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const json = await request.json();
    const idVal = json.id !== undefined && json.id !== null && String(json.id).trim() !== ""
      ? json.id
      : (json.rowKey !== undefined && json.rowKey !== null && String(json.rowKey).trim() !== "" ? json.rowKey : json.sheetRow);
    return { ...json, id: idVal, sheetRow: idVal };
  }

  const formData = await request.formData();
  const tableName = String(formData.get("tableName") || "");
  const rawId = formData.get("id") || formData.get("rowKey") || formData.get("sheetRow");
  const parsedNum = Number(rawId);
  const targetId = Number.isFinite(parsedNum) && String(rawId).trim() !== "" ? parsedNum : String(rawId || "").trim();

  const values: SheetRow = {};
  for (const [key, value] of formData.entries()) {
    if (key === "tableName" || key === "sheetRow" || key === "id" || key === "rowKey" || isFile(value)) continue;
    values[key] = typeof value === "string" ? value : "";
  }
  await attachUploadedFiles(formData, tableName, values);
  return { tableName, id: targetId, sheetRow: targetId, values };
}

async function attachUploadedFiles(formData: FormData, tableName: string, row: SheetRow) {
  const filesByColumn = new Map<string, File[]>();
  for (const [key, value] of formData.entries()) {
    if (!isFile(value) || value.size <= 0) continue;
    if (!value.type.startsWith("image/") && value.type !== "application/pdf") continue;
    filesByColumn.set(key, [...(filesByColumn.get(key) || []), value]);
  }

  const extractedKey = String(formData.get("id") || formData.get("rowKey") || formData.get("sheetRow") || row.id || row[TABLE_KEYS[tableName] || ""] || row.id_bank || row.id_store || row.id_Contractor || "");

  for (const [columnName, files] of filesByColumn) {
    const uploadedUrls = await Promise.all(
      files.map(file => uploadTableImage(file, {
        tableName,
        rowKey: extractedKey,
        columnName
      }))
    );
    const existingVal = String(row[columnName] || "").trim();
    const existingUrls = existingVal
      ? existingVal.split(",").map(u => u.trim()).filter(Boolean)
      : [];
    row[columnName] = [...existingUrls, ...uploadedUrls].join(", ");
  }
}

function isFile(value: FormDataEntryValue): value is File {
  return Boolean(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value
  );
}

