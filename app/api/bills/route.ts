import { NextRequest, NextResponse } from "next/server";
import { TABLES } from "@/lib/config";
import { revalidateAllBillViews } from "@/lib/utils/cache";
import { validateBillRelations } from "@/lib/bills/bill-validation";
import { uploadBillImage } from "@/lib/utils/drive";
import { applyBillFormulas } from "@/lib/formulas";
import { getFormSchema } from "@/lib/schemas";
import { isVatActive, parseDeductPercent, parseCreditDays, parseBillItems } from "@/lib/project-summary";
import { appendAuditLog, appendRow, getSystemOptions, invalidateTableCache } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getNextBillSequence, mapSupabaseRowToSheetRow } from "@/lib/supabase/supabase-db";
import { deriveCategoryFromProduct } from "@/lib/cost-codes";
import type { SheetRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BILL_IMAGE_COLUMNS = ["รูปถ่ายบิล"];
const SEQUENCE_COLUMNS = ["ลำดับ", "ลำดับtest"];
const BILL_DATE_COLUMNS = ["ว/ด/ป"];
const STATUS_COLUMNS = ["สถานะ"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.max(1, Math.min(10000, Number(searchParams.get("pageSize") || 20)));
  const search = searchParams.get("search")?.trim().toLowerCase() || "";
  const status = searchParams.get("status")?.trim() || "";
  const projectId = searchParams.get("projectId")?.trim() || "";
  const requester = searchParams.get("requester")?.trim() || "";
  const sort = searchParams.get("sort") === "oldest" ? "oldest" : "latest";

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabaseAdmin.from("bills").select("*", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (projectId) query = query.eq("project_id", projectId);
    if (requester) query = query.eq("requester", requester);
    
    const yearParam = searchParams.get("year")?.trim() || request.cookies.get("costlab_selected_year")?.value?.trim();
    if (yearParam && yearParam !== "all") {
      const yr = parseInt(yearParam, 10);
      if (!isNaN(yr) && yr > 2000) {
        query = query.gte("bill_date", `${yr}-01-01`).lte("bill_date", `${yr}-12-31`);
      }
    }

    if (search) {
      query = query.or(`project_name.ilike.%${search}%,vendor_or_person.ilike.%${search}%,description.ilike.%${search}%,bill_no.ilike.%${search}%,requester.ilike.%${search}%`);
    }

    query = query.order("id", { ascending: sort === "oldest" }).range(from, to);

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data || []).map((row, idx) => mapSupabaseRowToSheetRow("bills", row, from + idx));

    return NextResponse.json({
      page,
      pageSize,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      rows: mapped
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch bills" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { rows } = await readBillRows(request);
    if (!rows || rows.length === 0) {
      throw new Error("ไม่พบข้อมูลบิลสำหรับบันทึก");
    }

    const outputRows: SheetRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      ensureBillVendorType(row);
      sanitizeBySchema(row, TABLES.DATA);
      validateRequiredBySchema(row, TABLES.DATA);
      await validateBillRelations(row);
      const output = await applyBillFormulas(row);
      applyAppSheetBillSystemFields(output);

      await appendRow(TABLES.DATA, output);
      outputRows.push(output);

      await appendAuditLog({
        action: "CREATE",
        tableName: TABLES.DATA,
        key: firstRowValue(output, SEQUENCE_COLUMNS),
        actor: request.headers.get("x-user-email") || "web",
        details: { projectId: output["ID Project"] || "", status: output["สถานะ"] || "" }
      }).catch(() => undefined);
    }

    invalidateTableCache(TABLES.DATA);
    revalidateAllBillViews();

    return NextResponse.json({
      ok: true,
      row: outputRows[0],
      rows: outputRows,
      count: outputRows.length
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

async function readBillRows(request: NextRequest): Promise<{ rows: SheetRow[]; images: string[] }> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await request.json();
    if (Array.isArray(body.rows) && body.rows.length > 0) {
      let startSeq = toSequenceNumber(body.rows[0]["ลำดับ"]);
      if (startSeq <= 0) {
        const sysOptions = await getSystemOptions();
        const configuredStart = Number((sysOptions as any)?.bill_start_sequence || (sysOptions as any)?.["ลำดับบิลเริ่มต้น"] || 1);
        startSeq = await getNextBillSequence(configuredStart);
      }

      const rows: SheetRow[] = [];
      for (let i = 0; i < body.rows.length; i++) {
        const r = { ...body.rows[i] };
        r["ลำดับ"] = String(startSeq + i);
        ensureBillStatus(r);
        rows.push(r);
      }
      return { rows, images: [] };
    }
    const single = ensureBillStatus(body);
    await ensureUniqueBillSequence(single);
    return { rows: [single], images: [] };
  }

  const formData = await request.formData();
  const rawRowsStr = formData.get("rows");
  let parsedRows: SheetRow[] | null = null;
  if (typeof rawRowsStr === "string" && rawRowsStr.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rawRowsStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsedRows = parsed;
      }
    } catch {}
  }

  const baseRow: SheetRow = {};
  for (const [key, value] of formData.entries()) {
    if (isFile(value)) continue;
    if (key === "rows") continue;
    baseRow[key] = value;
  }

  const billImageField = findFileField(formData, BILL_IMAGE_COLUMNS);
  const billImages = billImageField ? formData.getAll(billImageField).filter(isUsableFile) : [];
  let uploadedUrls: string[] = [];

  if (billImageField && billImages.length) {
    const startSeq = parsedRows?.[0] ? firstRowValue(parsedRows[0], SEQUENCE_COLUMNS) : firstRowValue(baseRow, SEQUENCE_COLUMNS);
    uploadedUrls = await Promise.all(
      billImages.map((billImage, index) =>
        uploadBillImage(billImage, {
          sequence: sequenceWithIndex(startSeq, index, billImages.length),
          projectId: String(baseRow["ID Project"] || ""),
          billDate: firstRowValue(baseRow, BILL_DATE_COLUMNS)
        })
      )
    );
  }

  const existingVal = String(baseRow[billImageField || "รูปถ่ายบิล"] || "").trim();
  const existingUrls = existingVal
    ? existingVal.split(",").map(u => u.trim()).filter(Boolean)
    : [];
  const allImagesStr = [...existingUrls, ...uploadedUrls].join(", ");

  if (parsedRows && parsedRows.length > 0) {
    let startSeq = toSequenceNumber(parsedRows[0]["ลำดับ"] || baseRow["ลำดับ"]);
    if (startSeq <= 0) {
      const sysOptions = await getSystemOptions();
      const configuredStart = Number((sysOptions as any)?.bill_start_sequence || (sysOptions as any)?.["ลำดับบิลเริ่มต้น"] || 1);
      startSeq = await getNextBillSequence(configuredStart);
    }

    const rows: SheetRow[] = [];
    for (let i = 0; i < parsedRows.length; i++) {
      const itemRow = { ...baseRow, ...parsedRows[i] };
      itemRow["ลำดับ"] = String(startSeq + i);
      itemRow["ค่าของ"] = parsedRows[i]["ค่าของ"] ?? "";
      itemRow["เครื่องมือ"] = parsedRows[i]["เครื่องมือ"] ?? "";
      itemRow["อื่นๆ"] = parsedRows[i]["อื่นๆ"] ?? "";
      itemRow["ค่าแรง"] = parsedRows[i]["ค่าแรง"] ?? "";
      itemRow["พนักงาน"] = parsedRows[i]["พนักงาน"] ?? "";
      itemRow["น้ำมัน"] = parsedRows[i]["น้ำมัน"] ?? "";
      itemRow["ซ่อมรถ"] = parsedRows[i]["ซ่อมรถ"] ?? "";
      itemRow["เครื่องจักร"] = parsedRows[i]["เครื่องจักร"] ?? "";
      itemRow["ยอดเงิน"] = parsedRows[i]["ยอดเงิน"] ?? "";
      itemRow["ยอดโอน"] = parsedRows[i]["ยอดโอน"] ?? "";
      itemRow["สินค้า"] = parsedRows[i]["สินค้า"] ?? "";
      itemRow["สินค้า/ทำงาน"] = parsedRows[i]["สินค้า/ทำงาน"] || parsedRows[i]["สินค้า"] || "";
      itemRow["ประเภท"] = parsedRows[i]["ประเภท"] || (itemRow["สินค้า"] ? deriveCategoryFromProduct(itemRow["สินค้า"]) : "101 เตรียมงาน");
      itemRow["items"] = parsedRows[i]["items"] || "";
      if (allImagesStr) {
        itemRow[billImageField || "รูปถ่ายบิล"] = allImagesStr;
      }
      ensureBillStatus(itemRow);
      rows.push(itemRow);
    }
    return { rows, images: uploadedUrls };
  }

  if (allImagesStr) {
    baseRow[billImageField || "รูปถ่ายบิล"] = allImagesStr;
  }
  await ensureUniqueBillSequence(baseRow);
  ensureBillStatus(baseRow);
  return { rows: [baseRow], images: uploadedUrls };
}

function ensureBillStatus(row: SheetRow) {
  STATUS_COLUMNS.forEach(column => {
    if (row[column] === undefined || row[column] === null || String(row[column]).trim() === "") {
      row[column] = "รอตั้งเบิก";
    }
  });
  if (!row["ประเภท"] && !row.category) {
    if (row["สินค้า"]) {
      row["ประเภท"] = deriveCategoryFromProduct(row["สินค้า"]);
    } else if (Number(row["ค่าของ"] || row.material_cost || 0) > 0) row["ประเภท"] = "101 เตรียมงาน";
    else if (Number(row["เครื่องมือ"] || row.tool_cost || 0) > 0) row["ประเภท"] = "504 เครื่องมือ";
    else if (Number(row["อื่นๆ"] || row.other_cost || 0) > 0) row["ประเภท"] = "123 ดำเนินการ(อื่นๆ)";
    else if (Number(row["น้ำมัน"] || row.fuel_cost || 0) > 0) row["ประเภท"] = "501 น้ำมัน";
    else if (Number(row["ซ่อมรถ"] || row.repair_cost || 0) > 0) row["ประเภท"] = "502 ซ่อมรถ";
    else if (Number(row["เครื่องจักร"] || row.machine_cost || 0) > 0) row["ประเภท"] = "503 เครื่องจักร";
    else if (Number(row["ค่าแรง"] || row.labor_cost || 0) > 0) row["ประเภท"] = "201 เตรียมงาน";
    else row["ประเภท"] = "101 เตรียมงาน";
  }
  return row;
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

  // Fallback heuristic only when current is not explicitly specified
  if (
    hasValue(row["ผู้รับเหมา"]) ||
    hasValue(row.contractor_id) ||
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
    if (hasMultiItems && amountCols.includes(field.name) && hasValue(row[field.name])) return;
    // CRITICAL: NEVER wipe out "วันจ่าย" or "เครดิต" if a value was provided
    if (field.name === "วันจ่าย" && (hasValue(row["วันจ่าย"]) || hasValue(row.paid_date))) return;
    if (field.name === "เครดิต" && (hasValue(row["เครดิต"]) || hasValue(row.credit_days))) return;
    if (isFieldVisible(field, row)) return;
    row[field.name] = "";
  });
  return row;
}

function validateRequiredBySchema(row: SheetRow, tableName: string) {
  const missing = getFormSchema(tableName).find(field => {
    if (!field.required || field.type === "Hidden" || field.readonly) return false;
    if (field.name === "ผู้รับเหมา") {
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
    return !hasValue(row[field.name]);
  });
  if (missing) throw new Error(`กรุณากรอก ${missing.name}`);
}

function isFieldVisible(field: ReturnType<typeof getFormSchema>[number], row: SheetRow) {
  if (field.name === "วันได้บิล") {
    const hasVat = isVatActive(row["vat"]);
    const hasCredit = parseCreditDays(row["เครดิต"]) > 0;
    return hasVat && !hasCredit;
  }
  if (field.name === "เครดิต") {
    const vendorType = String(row["ร้านค้า/ผู้รับเหมา"] ?? row.vendor_type ?? "").trim();
    return vendorType === "ร้านค้า" || isVatActive(row["vat"]) || parseCreditDays(row["เครดิต"]) > 0 || hasValue(row["เครดิต"]);
  }
  if (field.name === "วันจ่าย") {
    return Boolean(hasValue(row["วันจ่าย"]) || hasValue(row["paid_date"]) || parseCreditDays(row["เครดิต"]) > 0 || hasValue(row["เครดิต"]));
  }
  if (!field.showIf) return true;
  const actual = row[field.showIf.column] || "";
  if (field.showIf.equals !== undefined) return String(actual) === field.showIf.equals;
  if (field.showIf.in) return field.showIf.in.includes(String(actual));
  if (field.showIf.notBlank) {
    if (field.showIf.column === "vat") return isVatActive(actual);
    if (field.showIf.column === "หัก") return parseDeductPercent(actual) > 0;
    if (field.showIf.column === "เครดิต") return parseCreditDays(actual) > 0 || hasValue(actual);
    return hasValue(actual);
  }
  return true;
}

function applyAppSheetBillSystemFields(row: SheetRow) {
  row["3เปอร์เซ็น"] = String(toNumber(row["3เปอร์เซ็น"]) || deductAmount(row));
  row["textnumber "] = thaiBahtText(toNumber(row["3เปอร์เซ็น"]));
  if (!hasValue(row["filed"])) row["filed"] = buildFiledPath(row);
  ensureBillStatus(row);
  return row;
}

function deductAmount(row: SheetRow) {
  if (hasValue(row["หัก"]) && hasValue(row["ค่าแรง+พนักงาน+อื่นๆ"])) {
    return toNumber(row["ค่าแรง+พนักงาน+อื่นๆ"]) * toNumber(row["หัก"]) * 0.01;
  }
  if (hasValue(row["หัก"])) {
    return (toNumber(row["ค่าแรง"]) + toNumber(row["พนักงาน"]) + toNumber(row["อื่นๆ"])) * toNumber(row["หัก"]) * 0.01;
  }
  return 0;
}

function buildFiledPath(row: SheetRow) {
  const dateValue = firstRowValue(row, BILL_DATE_COLUMNS) || new Date().toLocaleDateString("th-TH");
  let month = new Date().getMonth() + 1;
  const parts = dateValue.split(/[/-]/);
  if (parts.length >= 2) {
    month = Number(parts[1]);
  }
  if (!Number.isFinite(month) || month <= 0) {
    month = new Date().getMonth() + 1;
  }

  let laborStatus = String(row["statusค่าแรง"] || "").trim();
  if (!laborStatus) {
    const vendorType = String(row["ร้านค้า/ผู้รับเหมา"] || "").trim();
    laborStatus = vendorType === "ผู้รับเหมา" ? "บุคคลธรรมดา" : "บริษัท";
  }

  const folder = `${laborStatus} เดือน ${month} ยื่นภาษี`;
  const sequence = firstRowValue(row, SEQUENCE_COLUMNS);
  return `My Drive/appsheet/data/Cost-584789250-24-06-08/${folder}/${sequence}สัญญาจ้างเหมา.pdf`;
}


function thaiBahtText(amount: number) {
  const rounded = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);
  const bahtText = `${thaiNumberText(baht)}บาท`;
  return satang ? `${bahtText}${thaiNumberText(satang)}สตางค์` : `${bahtText}ถ้วน`;
}

function thaiNumberText(value: number): string {
  if (!value) return "ศูนย์";
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const million = 1_000_000;
  if (value >= million) {
    const head = Math.floor(value / million);
    const tail = value % million;
    return `${thaiNumberText(head)}ล้าน${tail ? thaiNumberText(tail) : ""}`;
  }

  const chars = String(value).split("").map(Number);
  return chars.map((digit, index) => {
    if (!digit) return "";
    const position = chars.length - index - 1;
    if (position === 0 && digit === 1 && chars.length > 1) return "เอ็ด";
    if (position === 1 && digit === 1) return "สิบ";
    if (position === 1 && digit === 2) return "ยี่สิบ";
    return `${digits[digit]}${positions[position]}`;
  }).join("");
}


function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureUniqueBillSequence(row: SheetRow) {
  const currentSequence = firstRowValue(row, SEQUENCE_COLUMNS).trim();
  const currentSeqNum = Number(currentSequence);

  let configuredStart = 1;
  try {
    const sysOptions = await getSystemOptions();
    configuredStart = Number((sysOptions as any)?.bill_start_sequence || (sysOptions as any)?.["ลำดับบิลเริ่มต้น"] || 1);
  } catch {}

  // If user provided sequence is valid and not taken yet
  if (currentSequence && currentSeqNum > 0) {
    const { data: existingItem } = await supabaseAdmin.from("bills").select("id").eq("id", currentSeqNum).maybeSingle();
    if (!existingItem) {
      row["ลำดับ"] = currentSequence;
      return row;
    }
  }

  // Automatically assign the next available unique sequence
  const nextSeq = await getNextBillSequence(configuredStart);
  row["ลำดับ"] = String(nextSeq);
  return row;
}

function toSequenceNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findFileField(formData: FormData, columns: string[]) {
  return columns.find(column => formData.getAll(column).some(isUsableFile));
}

function firstRowValue(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "";
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value
  );
}

function isUsableFile(value: FormDataEntryValue): value is File {
  return isFile(value) && value.size > 0;
}

function sequenceWithIndex(sequence: string, index: number, total: number) {
  if (total <= 1) return sequence;
  const suffix = String(index + 1).padStart(2, "0");
  return sequence ? `${sequence}-${suffix}` : suffix;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Save bill failed";
}

