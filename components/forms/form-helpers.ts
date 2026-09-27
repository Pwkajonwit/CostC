import { TABLES } from "@/lib/config";
import type { FieldSchema, RefOption, SheetRow } from "@/lib/types";
import type { FormPayload } from "./form-types";
import { normalizeDateToIso, parseDateStrict, toInputDateValue, getTodayDateIso } from "@/lib/utils/dates";
import { imagePreviewUrl } from "@/components/bills/BillImageThumbnail";
import {
  ALL_STORE_CATEGORIES,
  ALL_CONTRACTOR_CATEGORIES,
  LABOR_CATEGORY_OPTIONS,
  STAFF_CATEGORY_OPTIONS,
  SUB_ITEMS_123,
  SUB_ITEMS_223,
  isMaterialCost,
  isLaborCost,
  isStaffCost,
  isFuelCost,
  isRepairCost,
  isMachineCost,
  isToolCost,
  isOtherExpense,
  getExpenseFieldForCategory,
  isFuelProduct,
  isMachineProduct,
  isCarRepairProduct,
  isOtherExpenseProduct,
  deriveCategoryFromProduct,
} from "@/lib/cost-codes";

export function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(";").shift() || "");
  return "";
}

export function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function toDateInputValue(value: string): string {
  return toInputDateValue(value);
}

export function normalizeBillDateInput(value: string): string {
  return normalizeDateToIso(value);
}

export function optionLabel(option: RefOption | undefined, fieldName?: string): string {
  if (!option) return "";
  const val = String(option.value || "").trim();
  const rawLabel = String(option.label || option.value || "").trim();

  if (fieldName === "ผู้รับเหมา") {
    const idConwork = String(option.row?.id_Conwork || option.value || "").trim();
    const contractorName = String(option.row?.["ชื่อเล่น"] || option.row?.["ผู้รับเหมา"] || option.row?.["ชื่อ-นามสกุล"] || "").trim();
    if (idConwork && contractorName) {
      return contractorName.startsWith(idConwork) ? contractorName : `${idConwork}-${contractorName}`;
    }
    if (rawLabel) {
      if (idConwork && !rawLabel.startsWith(idConwork)) return `${idConwork}-${rawLabel}`;
      return rawLabel;
    }
    return idConwork || val;
  }

  if (
    fieldName === "id_Contractor" ||
    fieldName === "id_contractor" ||
    fieldName === "ช่าง" ||
    fieldName === "contractor" ||
    fieldName === "id_Contractor_name"
  ) {
    if (option.row) {
      const rowName = String(option.row["ชื่อเล่น"] || option.row["ผู้รับเหมา"] || option.row["ชื่อ-นามสกุล"] || "").trim();
      if (rowName) return rowName;
    }
    let clean = rawLabel;
    if (clean.includes(" - ")) {
      const parts = clean.split(" - ");
      clean = parts.slice(1).join(" - ").trim() || clean;
    }
    if (option.row?.["รายละเอียดงาน"]) {
      const details = String(option.row["รายละเอียดงาน"]).trim();
      if (details && clean.includes(`(${details})`)) {
        clean = clean.replace(`(${details})`, "").trim();
      }
    }
    return clean;
  }

  if (fieldName === "ทะเบียน" || fieldName === "ทะเบียนรถ") {
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    return rawLabel;
  }

  if (fieldName === "ผู้เบิก") {
    const loggedInId = getCookie("auth_employee_id").trim();
    const loggedInName = getCookie("auth_name").trim();
    if (loggedInName && (val === loggedInId || rawLabel.includes(loggedInId) || val === loggedInName)) {
      return loggedInName;
    }
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    return rawLabel;
  }

  if (fieldName === "ธนาคาร" || fieldName === "bank" || fieldName === "bank_name" || fieldName === "id_bank") {
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    const cleanBank = rawLabel.replace(/^Ba\d+\s*[-–—]?\s*/i, "").trim();
    if (cleanBank) return cleanBank;
    if (option.row?.["ชื่อธนาคาร"]) return String(option.row["ชื่อธนาคาร"]).trim();
    if (option.row?.name) return String(option.row.name).trim();
    return rawLabel;
  }

  if (fieldName === "ร้านค้า" || fieldName === "ร้าน/บุคคล" || fieldName?.startsWith("store_select_")) {
    if (option.row?.["ชื่อร้านค้า"]) return String(option.row["ชื่อร้านค้า"]).trim();
    if (option.row?.["ชื่อเต็ม"]) return String(option.row["ชื่อเต็ม"]).trim();
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    const cleanStore = rawLabel.replace(/^[A-Za-z0-9_-]+\s*[-:]\s*/, "").trim();
    if (cleanStore) return cleanStore;
    return rawLabel;
  }

  if (!val) return rawLabel;
  if (!rawLabel || rawLabel === val) return val;
  if (rawLabel.startsWith(val)) return rawLabel;
  return `${val} - ${rawLabel}`;
}

export function optionSearchText(option: RefOption, fieldName?: string): string {
  const rowDetails = option.row ? Object.values(option.row).filter(v => typeof v === "string" || typeof v === "number").join(" ") : "";
  return `${String(option.value || "")} ${optionLabel(option, fieldName)} ${rowDetails}`.toLowerCase();
}

/** กรองและดึง URL รูปภาพที่ถูกต้อง (HTTP/HTTPS, Data URL) */
export function isValidImgUrl(url: string): string {
  return imagePreviewUrl(url);
}

export function customChoiceConfig(fieldName: string) {
  if (fieldName === "vat") return { optionValue: "ระบุเอง", placeholder: "กำหนด VAT เอง" };
  if (fieldName === "หัก") return { optionValue: "ระบุเอง", placeholder: "กำหนดเปอร์เซ็นต์หักเอง" };
  if (fieldName === "เครดิต") return { optionValue: "ระบุเอง", placeholder: "กำหนดเครดิตเอง (วัน)" };
  return null;
}

export function getFieldOptionLabel(fieldName: string, label: string): string {
  if (fieldName === "color" || fieldName === "COLOR") {
    const val = label.trim().toLowerCase();
    if (val === "red" || val.includes("แดง") || val.includes("ใหญ่")) return "Red (งานใหญ่)";
    if (val === "green" || val.includes("เขียว") || val.includes("เล็ก")) return "Green (งานเล็ก)";
    if (val === "black" || val.includes("ดำ") || val.includes("เสร็จ")) return "Black (งานเสร็จแล้ว)";
  }
  return label;
}

export function getOptionButtonStyle(fieldName: string, optionValue: string, checked: boolean): string {
  if (fieldName === "สิทธิ์การใช้งาน") {
    const val = optionValue.trim();
    if (val.includes("เจ้าของ") || val.includes("Owner")) {
      return checked
        ? "bg-amber-500 text-white border-amber-600 shadow-xs font-semibold ring-1 ring-amber-400"
        : "bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100 font-medium";
    }
    if (val.includes("อนุมัติ") || val.includes("Approver")) {
      return checked
        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold ring-1 ring-emerald-400"
        : "bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100 font-medium";
    }
    if (val.includes("การเงิน") || val.includes("Finance") || val.includes("ปิดบิล")) {
      return checked
        ? "bg-blue-600 text-white border-blue-600 shadow-xs font-semibold ring-1 ring-blue-400"
        : "bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100 font-medium";
    }
    if (val.includes("ลบ") || val.includes("Delete")) {
      return checked
        ? "bg-rose-600 text-white border-rose-600 shadow-xs font-semibold ring-1 ring-rose-400"
        : "bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100 font-medium";
    }
  }

  if (fieldName === "color" || fieldName === "COLOR") {
    const val = optionValue.trim().toLowerCase();
    if (val === "red" || val.includes("แดง") || val.includes("ใหญ่")) {
      return checked
        ? "bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-400"
        : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 font-medium";
    }
    if (val === "green" || val.includes("เขียว") || val.includes("เล็ก")) {
      return checked
        ? "bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400"
        : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-medium";
    }
    if (val === "black" || val.includes("ดำ") || val.includes("เสร็จ")) {
      return checked
        ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400"
        : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 font-medium";
    }
  }

  return checked
    ? "bg-slate-800 text-white border-slate-800 font-medium"
    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
}

export function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

export function getInitialStringValues(form: FormPayload): Record<string, string> {
  const todayIso = getTodayDateIso();
  const values = Object.fromEntries(
    form.schema.map(field => {
      if (form.tableName === TABLES.DATA || form.tableName === "Data") {
        if (field.name === "ร้านค้า/ผู้รับเหมา") {
          return [field.name, "ร้านค้า"];
        }
        if (field.name === "ประเภท") {
          return [field.name, "101 เตรียมงาน"];
        }
      }
      if (field.initialValue === "today" || (field.type === "Date" && (field.initialValue === "today" || field.name === "ว/ด/ป" || field.name === "วันที่" || field.name === "ดู/ทำ"))) {
        return [field.name, todayIso];
      }
      return [field.name, String(form.initialValues[field.name] ?? "")];
    })
  );
  if (form.tableName === TABLES.DATA || form.tableName === "Data") {
    const loggedInEmployeeId = getCookie("auth_employee_id");
    const loggedInName = getCookie("auth_name");
    if (loggedInEmployeeId || loggedInName) {
      const requesterOptions = form.refOptions["ผู้เบิก"] || [];

      // 1. Match by logged-in display name first (e.g. "คุณแมน")
      const matchedByName = loggedInName ? requesterOptions.find(opt =>
        String(opt.label).trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
        String(opt.value).trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
        (opt.row && (
          String(opt.row["ชื่อเล่น"] || "").trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
          String(opt.row["ชื่อ-นามสกุล"] || "").trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
          String(opt.row["name"] || "").trim().toLowerCase() === loggedInName.trim().toLowerCase()
        ))
      ) : undefined;

      // 2. Fallback: match by employee ID / username (e.g. "PT101")
      const matchedById = loggedInEmployeeId ? requesterOptions.find(opt =>
        String(opt.value) === loggedInEmployeeId ||
        String(opt.row?.id) === loggedInEmployeeId ||
        String(opt.row?.employee_id) === loggedInEmployeeId ||
        String(opt.row?.user_id) === loggedInEmployeeId ||
        String(opt.row?.username) === loggedInEmployeeId
      ) : undefined;

      const matchedUserOption = matchedByName || matchedById;

      if (matchedUserOption) {
        values["ผู้เบิก"] = String(matchedUserOption.value);
      } else if (loggedInName) {
        values["ผู้เบิก"] = loggedInName;
      } else if (loggedInEmployeeId) {
        values["ผู้เบิก"] = loggedInEmployeeId;
      }

      const loggedInUser = loggedInName || loggedInEmployeeId;
      if (loggedInUser) {
        values["ผู้สร้างบิล"] = loggedInUser;
      }
    }
  }
  return values;
}

export function getRowStringValues(form: FormPayload, row: SheetRow): Record<string, string> {
  const values: Record<string, string> = {};

  const rawCategory = String(row["ประเภท"] || row.category || "").trim();
  const rawLaborStatus = String(row["statusค่าแรง"] || row.labor_status || "").trim();
  const hasLaborCost = Number(row["ค่าแรง"] || row.labor_cost || 0) > 0;
  const hasStaffCost = Number(row["พนักงาน"] || row.staff_cost || 0) > 0 || Boolean(row["ชื่อพนักงาน"] || row.staff_name);
  const rawVendorType = firstNonEmpty(row["ร้านค้า/ผู้รับเหมา"], row.vendor_type);

  let vendorType = "ร้านค้า";
  if (rawVendorType === "พนักงาน" || rawCategory.startsWith("3.") || rawCategory.includes("พนักงาน") || hasStaffCost) {
    vendorType = "พนักงาน";
  } else if (
    rawVendorType === "ผู้รับเหมา" ||
    Boolean(firstNonEmpty(row["ผู้รับเหมา"], row.contractor_id)) ||
    Boolean(firstNonEmpty(row["id_Conwork"], row["งานรับเหมา"])) ||
    rawCategory.startsWith("2.") ||
    rawCategory.includes("ค่าแรง") ||
    rawCategory.includes("จ้าง") ||
    Boolean(rawLaborStatus) ||
    hasLaborCost
  ) {
    vendorType = "ผู้รับเหมา";
  } else {
    vendorType = "ร้านค้า";
  }

  form.schema.forEach(field => {
    let rawVal = firstNonEmpty(
      row[field.name],
      (field.name === "รหัสพนักงาน" ? row.id : undefined),
      (field.name === "id_store" ? row.id : undefined),
      (field.name === "id_Contractor" ? row.id : undefined),
      (field.name === "id_bank" ? row.id : undefined),
      (field.name === "id_car" ? row.id : undefined),
      (field.name === "id_cus" ? row.id : undefined),
      (field.name === "id_Company" ? row.id : undefined),
      (field.name === "id_Conwork" ? row.id : undefined),
      (field.name === "id_petty_cash" ? (row.id_petty_cash || row.id) : undefined),
      (field.name === "ID Project" ? (row["ID Project"] || row.project_id || (form.tableName === TABLES.PROJECT || form.tableName === "Project" ? row.id : undefined)) : undefined),
      form.initialValues[field.name]
    );

    if (form.tableName === TABLES.DATA || form.tableName === "Data") {
      if (field.name === "ร้านค้า/ผู้รับเหมา") {
        rawVal = vendorType;
      } else if (field.name === "ประเภท") {
        if (vendorType === "พนักงาน") {
          rawVal = "301 พนักงาน";
        } else if (vendorType === "ผู้รับเหมา") {
          rawVal = "201 เตรียมงาน";
        } else {
          rawVal = rawCategory || deriveCategoryFromProduct(row["สินค้า"] || row.product) || "101 เตรียมงาน";
        }
      } else if (field.name === "ร้านค้า") {
        rawVal = vendorType === "ร้านค้า" ? firstNonEmpty(row["ร้านค้า"], row.store_id, row["ร้าน/บุคคล"], row.vendor_or_person) : "";
      } else if (field.name === "ผู้รับเหมา") {
        rawVal = vendorType === "ผู้รับเหมา" ? firstNonEmpty(row["ผู้รับเหมา"], row.contractor_id, row["ร้าน/บุคคล"], row.vendor_or_person) : "";
      } else if (field.name === "ชื่อพนักงาน") {
        rawVal = vendorType === "พนักงาน" ? firstNonEmpty(row["ชื่อพนักงาน"], row.staff_name, row["ร้าน/บุคคล"], row.vendor_or_person) : "";
      } else if (field.name === "สินค้า") {
        rawVal = vendorType === "ร้านค้า" ? firstNonEmpty(row["สินค้า"], row.product, row["สินค้า/ทำงาน"], row.description, "101 เตรียมงาน") : (vendorType === "ผู้รับเหมา" ? "201 เตรียมงาน" : "301 พนักงาน");
      } else if (field.name === "รายละเอียดงาน") {
        rawVal = vendorType === "ผู้รับเหมา" ? firstNonEmpty(row["รายละเอียดงาน"], row.work_details, row["สินค้า/ทำงาน"], row.description) : "";
      } else if (field.name === "รายการ") {
        rawVal = firstNonEmpty(row["รายการ"], row.sub_category, row.item_name);
      } else if (field.name === "ชื่อเครื่องมือ") {
        rawVal = firstNonEmpty(row["ชื่อเครื่องมือ"], row.tool_name);
      } else if (field.name === "ทะเบียน") {
        rawVal = firstNonEmpty(row["ทะเบียน"], row.plate_no);
      } else if (field.name === "ชื่อพนักงาน") {
        rawVal = firstNonEmpty(row["ชื่อพนักงาน"], row.staff_name);
      } else if (field.name === "statusค่าแรง") {
        rawVal = firstNonEmpty(row["statusค่าแรง"], row.labor_status);
      } else if (["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"].includes(field.name)) {
        const rowType = String(row["ประเภท"] || row.category || "").toLowerCase();
        const rowAmount = firstNonEmpty(row[field.name], row["ยอดเงิน"], row.amount);
        if (!hasValue(rawVal) && hasValue(rowAmount) && rowType.includes(field.name.toLowerCase())) {
          rawVal = String(rowAmount);
        }
      }
    }

    if (field.name === "สิทธิ์การใช้งาน") {
      const active: string[] = [];
      const permStr = String(row["สิทธิ์การใช้งาน"] || "");
      const d = (row.data && typeof row.data === "object") ? row.data : {};
      const hasOwner = permStr.includes("Owner") || permStr.includes("เจ้าของระบบ") || Boolean(row.is_owner) || Boolean(row["เจ้าของระบบ"]) || Boolean(d.is_owner) || Boolean(d["เจ้าของระบบ"]);
      const hasApprover = permStr.includes("Approver") || permStr.includes("อนุมัติบิล") || Boolean(row.can_close_bill) || Boolean(row["อนุมัติบิล"]) || Boolean(d.can_close_bill) || Boolean(d["อนุมัติบิล"]);
      const hasFinance = permStr.includes("Finance") || permStr.includes("ฝ่ายการเงิน") || permStr.includes("ปิดบิล") || Boolean(row.can_approve) || Boolean(row["ฝ่ายการเงิน"]) || Boolean(d.can_approve) || Boolean(d["ฝ่ายการเงิน"]);
      const hasDelete = permStr.includes("Delete") || permStr.includes("ลบข้อมูล") || Boolean(row.can_delete) || Boolean(row["สิทธิ์ลบข้อมูล"]) || Boolean(d.can_delete) || Boolean(d["สิทธิ์ลบข้อมูล"]);

      if (hasOwner) active.push("เจ้าของระบบ (Owner)");
      if (hasApprover) active.push("อนุมัติบิล (Approver)");
      if (hasFinance) active.push("ฝ่ายการเงิน (Finance)");
      if (hasDelete) active.push("ลบข้อมูล (Delete)");

      rawVal = active.join(", ");
    } else if (field.name === "LINE User ID" || field.name === "LINE") {
      const d = (row.data && typeof row.data === "object") ? row.data : {};
      rawVal = String(row["LINE User ID"] || row["LINE"] || row.line_user_id || d.line_user_id || d["LINE User ID"] || d["LINE"] || "").trim();
    }

    if ((field.name === "vat" || field.name === "หัก" || field.name === "เครดิต") && (rawVal === "0" || rawVal === "0.00" || String(rawVal) === "0")) {
      rawVal = "";
    }

    if (field.type === "Date" && rawVal) {
      values[field.name] = toInputDateValue(rawVal);
    } else if (field.type === "Ref" && rawVal) {
      const options = form.refOptions[field.name] || [];
      const match = options.find(opt =>
        String(opt.value) === rawVal ||
        String(opt.label) === rawVal ||
        (opt.row && (
          String(opt.row.id) === rawVal ||
          String(opt.row.id_store) === rawVal ||
          String(opt.row.id_Conwork) === rawVal ||
          String(opt.row.id_bank) === rawVal ||
          String(opt.row["ชื่อธนาคาร"]) === rawVal ||
          String(opt.row.name) === rawVal ||
          String(opt.row["ชื่อร้านค้า"]) === rawVal ||
          String(opt.row["ชื่อเล่น"]) === rawVal ||
          String(opt.row["ชื่อ-นามสกุล"]) === rawVal ||
          Object.values(opt.row).some(v => String(v) === rawVal)
        ))
      );
      values[field.name] = match ? String(match.value) : rawVal;
    } else if (field.name === "สินค้า" && rawVal) {
      const enumOpts = field.values || [];
      const match = enumOpts.find(opt => opt === rawVal || opt.endsWith(rawVal) || rawVal.endsWith(opt) || opt.includes(rawVal));
      values[field.name] = match || rawVal;
    } else if (field.name === "รายการ" && rawVal) {
      const enumOpts = field.values || [];
      const match = enumOpts.find(opt => opt === rawVal || opt.trim() === rawVal.trim());
      values[field.name] = match || rawVal;
    } else {
      values[field.name] = rawVal;
    }
  });

  // Preserve any extra budget or custom properties from row and row.data
  if (row && typeof row === "object") {
    Object.entries(row).forEach(([k, v]) => {
      if (k.startsWith("งบไม่เกิน") || k === "คุมงบประเภทงาน") {
        if (v !== undefined && v !== null && (values[k] === undefined || values[k] === "")) {
          values[k] = String(v);
        }
      }
    });
    if (row.data && typeof row.data === "object") {
      Object.entries(row.data).forEach(([k, v]) => {
        if (k.startsWith("งบไม่เกิน") || k === "คุมงบประเภทงาน") {
          if (v !== undefined && v !== null && (values[k] === undefined || values[k] === "")) {
            values[k] = String(v);
          }
        }
      });
    }
  }

  return values;
}

export function splitEnumListValue(value: string): string[] {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

export function filterRefOptions(field: FieldSchema, options: RefOption[], values: Record<string, string>): RefOption[] {
  if (!field.filterBy) return options;
  const expectedValue = String(values[field.filterBy.field] || "").trim();
  if (!expectedValue) return [];

  const currentValue = String(values[field.name] || "").trim();
  const expectedId = expectedValue.includes(" - ") ? expectedValue.split(" - ")[0].trim() : expectedValue;

  return options.filter(option => {
    const rowVal = String(option.row?.[field.filterBy!.column] ?? "").trim();
    const rowId = rowVal.includes(" - ") ? rowVal.split(" - ")[0].trim() : rowVal;

    if (rowVal !== expectedValue && rowId !== expectedId && rowId !== expectedValue && rowVal !== expectedId) {
      return false;
    }

    if (currentValue && (String(option.value) === currentValue || String(option.label) === currentValue)) {
      return true;
    }

    if (field.filterBy?.openContract) {
      const hireAmt = toNumber(option.row?.["ยอดเงินจ้าง"]);
      const paidAmt = toNumber(option.row?.["ยอดเงินจ่าย"]);
      return hireAmt > paidAmt;
    }

    return true;
  });
}

export const ALL_EXPENSE_FIELDS = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];

export function transferAmountToCategory(values: Record<string, string>, targetCategory: string) {
  const targetField = getExpenseFieldForCategory(targetCategory);
  if (!targetField) return;

  if (hasValue(values[targetField])) return;

  const sourceField = ALL_EXPENSE_FIELDS.find(f => f !== targetField && hasValue(values[f]));
  if (sourceField) {
    values[targetField] = values[sourceField];
    values[sourceField] = "";
  }
}

export function getEnumValues(field: FieldSchema, values: Record<string, string>): string[] {
  const defaultValues = field.values || [];
  if (field.dynamicValues !== "billTypeOptions" || !field.dynamicOptionSets) return defaultValues;

  let dynamicList: string[] = [];
  if (values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา") {
    dynamicList = field.dynamicOptionSets.contractor || [];
  } else if (isFuelProduct(values["สินค้า"]) || isMachineProduct(values["สินค้า"]) || isCarRepairProduct(values["สินค้า"])) {
    dynamicList = field.dynamicOptionSets.storeDefault || [];
  } else if (isOtherExpenseProduct(values["สินค้า"])) {
    dynamicList = field.dynamicOptionSets.storeWithItem || ALL_STORE_CATEGORIES;
  } else if (hasValue(values["สินค้า"])) {
    dynamicList = field.dynamicOptionSets.storeWithItem || [];
  } else {
    dynamicList = field.dynamicOptionSets.storeDefault || [];
  }

  return dynamicList.length > 0 ? dynamicList : defaultValues;
}

export function getFieldOptions(field: FieldSchema, form: FormPayload, values: Record<string, string>): RefOption[] {
  if (field.type === "Ref") {
    return filterRefOptions(field, form.refOptions[field.name] || [], values);
  }

  if (field.name === "สินค้า" || field.dynamicValues === "productCategoryOptions") {
    const vType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
    if (vType === "ผู้รับเหมา") {
      return LABOR_CATEGORY_OPTIONS.map(c => ({ value: c, label: c }));
    }
    if (vType === "พนักงาน") {
      return STAFF_CATEGORY_OPTIONS.map(c => ({ value: c, label: c }));
    }
    return ALL_STORE_CATEGORIES.map(c => ({ value: c, label: c }));
  }

  if (field.name === "รายการ") {
    const isLabor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา" || isLaborCost(values["ประเภท"]) || values["สินค้า"]?.startsWith("223");
    const subList = isLabor ? SUB_ITEMS_223 : SUB_ITEMS_123;
    return subList.map(v => ({ value: v, label: v }));
  }

  return getEnumValues(field, values).map(value => ({ value, label: value }));
}

export function calculateDueDate(baseDateStr: string, days: number): string {
  const parsed = parseDateStrict(baseDateStr);
  if (!parsed || isNaN(days) || days <= 0) return "";
  const dt = new Date(parsed.year, parsed.month - 1, parsed.day);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseCreditCutoffDay(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (!str || str === "-" || str === "0") return 0;
  const match = str.match(/\d+/);
  if (!match) return 0;
  const day = parseInt(match[0], 10);
  return day >= 1 && day <= 31 ? day : 0;
}

export function calculateMonthlyCutoffDueDate(baseDateStr: string, cutoffDay: number): string {
  const parsed = parseDateStrict(baseDateStr);
  if (!parsed || isNaN(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) return "";
  
  let targetYear = parsed.year;
  let targetMonth = parsed.month;
  
  if (parsed.day > cutoffDay) {
    if (targetMonth === 12) {
      targetYear += 1;
      targetMonth = 1;
    } else {
      targetMonth += 1;
    }
  }
  
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(cutoffDay, daysInMonth);
  
  const y = targetYear;
  const m = String(targetMonth).padStart(2, "0");
  const d = String(targetDay).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseCreditDays(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (str === "เงินสด" || str === "ไม่มี" || str === "0" || str === "" || str === "false") return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function parseDeductPercent(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim().toLowerCase();
  if (!str || str === "-" || str === "0" || str === "0%" || str === "false" || str.includes("ไม่มี")) return 0;
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

export function isDeductActive(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toLowerCase();
  if (!str || str === "-" || str === "0" || str === "0%" || str === "false" || str.includes("ไม่มี")) return false;
  return parseDeductPercent(value) > 0 || str.includes("หัก");
}

export function isVatActive(vatValue: unknown): boolean {
  if (vatValue === null || vatValue === undefined) return false;
  const str = String(vatValue).trim().toLowerCase();
  return str !== "" && str !== "0" && str !== "0.00" && str !== "0%" && str !== "ไม่มี" && str !== "ไม่มี vat" && str !== "false" && str !== "no";
}

export function applyBillDeductAmount(values: Record<string, string>) {
  const expenseFields = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];
  const totalExpense = expenseFields.reduce((sum, field) => sum + toNumber(values[field]), 0);
  const baseAmount = totalExpense > 0 ? totalExpense : toNumber(values["ยอดเงิน"]);

  if (baseAmount > 0) {
    values["ยอดเงิน"] = String(baseAmount);
  }

  const deductValue = values["หัก"];
  const deductPercent = parseDeductPercent(deductValue);
  let deductAmount = 0;

  const hasVat = isVatActive(values["vat"]);
  const hasDeduct = isDeductActive(deductValue) && deductPercent > 0;

  if (!hasDeduct) {
    values["จำนวนหัก"] = "";
    values["3เปอร์"] = "";
    deductAmount = 0;
  } else {
    if (hasVat) {
      const preVatAmount = baseAmount / 1.07;
      deductAmount = (preVatAmount * deductPercent) / 100;
    } else {
      deductAmount = (baseAmount * deductPercent) / 100;
    }
    values["จำนวนหัก"] = deductAmount > 0 ? formatDecimal(deductAmount) : "";
    values["3เปอร์"] = values["จำนวนหัก"];
  }

  let netTransfer = baseAmount;
  if (hasVat && hasDeduct) {
    netTransfer = baseAmount - deductAmount;
  } else if (hasDeduct) {
    netTransfer = baseAmount - deductAmount;
  } else {
    netTransfer = baseAmount;
  }

  values["ยอดโอน"] = netTransfer > 0 ? formatDecimal(netTransfer) : (baseAmount > 0 ? String(baseAmount) : "");

  const creditDays = parseCreditDays(values["เครดิต"]);
  if (creditDays > 0) {
    const baseDate = values["วันได้บิล"] || values["ว/ด/ป"] || values["วันที่"];
    if (hasValue(baseDate)) {
      const dueDate = calculateDueDate(baseDate, creditDays);
      if (dueDate) {
        values["วันจ่าย"] = dueDate;
      }
    }
  }
}

export function applyLocalFormulas(values: Record<string, string>, tableName: string) {
  if (tableName === TABLES.PROJECT || tableName === "Project" || tableName === "1. Project รวม") {
    if (hasValue(values["ยอดงาน"])) {
      const workNum = toNumber(values["ยอดงาน"]);
      const vatTotal = Math.round(workNum * 1.07 * 100) / 100;
      values["ยอดรวม vat"] = String(vatTotal);
    }
    return;
  }
  if (tableName === TABLES.DATA) {
    applyBillDeductAmount(values);
    return;
  }
  if (tableName === TABLES.PETTY_CASH || tableName === "เปิดเงินสดย่อย") {
    const total = toNumber(values["จำนวนเงิน"]);
    const cleared = toNumber(values["ยอดเคลียร์แล้ว"]);
    values["ยอดคงเหลือ"] = String(Math.max(0, total - cleared));
    return;
  }
  if (tableName !== TABLES.CONTRACT_WORK) return;
  const hireAmount = toNumber(values["ยอดเงินจ้าง"]);
  const paidAmount = toNumber(values["ยอดเงินจ่าย"]);
  if (hasValue(values["ยอดเงินจ้าง"]) || hasValue(values["ยอดเงินจ่าย"])) {
    values["ยอดเงินจ่าย"] = String(paidAmount);
    values["ค่าแรงคงเหลือ"] = String(hireAmount - paidAmount);
  }
}

export function parseContractRemainingLabor(rawVal: string): { originalBalance: number; hasContract: boolean } {
  if (!rawVal) return { originalBalance: 0, hasContract: false };
  const firstPart = rawVal.split("จาก")[0] || rawVal;
  const num = toNumber(firstPart);
  return { originalBalance: num, hasContract: true };
}

export function normalizeDependentValues(values: Record<string, string>, changedField: string, form: FormPayload) {
  const isContractorForm = form.tableName === TABLES.CONTRACTOR || form.tableName === "contractors" || form.tableName === "รับเหมา" || form.tableName === "5. รับเหมา";
  if (isContractorForm && changedField === "ประเภท") {
    if (values["ประเภท"] === "นิติบุคคล") {
      const cur = toNumber(values["จำกัดยอด/ปี"]);
      if (cur <= 1_200_000) values["จำกัดยอด/ปี"] = "2000000";
    } else if (values["ประเภท"] === "บุคคลธรรมดา") {
      values["จำกัดยอด/ปี"] = "1200000";
    }
  }

  if (changedField === "ID Project") {
    values["ผู้รับเหมา"] = "";
    values["รายละเอียดงาน"] = "";
    values["ค่าแรงคงเหลือ"] = "";
  }

  if (changedField === "ร้านค้า/ผู้รับเหมา") {
    const vType = values["ร้านค้า/ผู้รับเหมา"];
    if (vType === "ร้านค้า") {
      values["ผู้รับเหมา"] = "";
      values["รายละเอียดงาน"] = "";
      values["ค่าแรงคงเหลือ"] = "";
      values["ชื่อพนักงาน"] = "";
      values["statusค่าแรง"] = "";
      if (!values["สินค้า"] || !ALL_STORE_CATEGORIES.includes(values["สินค้า"])) {
        values["สินค้า"] = "101 เตรียมงาน";
      }
      const derived = deriveCategoryFromProduct(values["สินค้า"]);
      values["ประเภท"] = derived;
      transferAmountToCategory(values, derived);
    } else if (vType === "พนักงาน") {
      values["ร้านค้า"] = "";
      values["ผู้รับเหมา"] = "";
      values["รายละเอียดงาน"] = "";
      values["ค่าแรงคงเหลือ"] = "";
      values["statusค่าแรง"] = "";
      values["สินค้า"] = "301 พนักงาน";
      values["ประเภท"] = "301 พนักงาน";
      transferAmountToCategory(values, "301 พนักงาน");
    } else if (vType === "ผู้รับเหมา") {
      values["ร้านค้า"] = "";
      values["ชื่อพนักงาน"] = "";
      if (!values["สินค้า"] || !LABOR_CATEGORY_OPTIONS.includes(values["สินค้า"])) {
        values["สินค้า"] = "201 เตรียมงาน";
      }
      values["ประเภท"] = values["สินค้า"] || "201 เตรียมงาน";
      transferAmountToCategory(values, values["ประเภท"]);
    }
  }

  if (changedField === "ร้านค้า") {
    if (hasValue(values["ร้านค้า"])) {
      const storeOption = (form.refOptions?.["ร้านค้า"] || []).find(opt => opt.value === values["ร้านค้า"]);
      const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
      const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
      if (storeCutoffDay > 0) {
        const baseDate = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();
        const cutoffDueDate = calculateMonthlyCutoffDueDate(baseDate, storeCutoffDay);
        if (cutoffDueDate) {
          values["วันจ่าย"] = cutoffDueDate;
        }
        values["เครดิต"] = "";
      }
    }
  }

  if (changedField === "สินค้า") {
    const selectedProd = String(values["สินค้า"] || "").trim();
    const vType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
    if (vType === "ร้านค้า") {
      const derived = deriveCategoryFromProduct(selectedProd);
      values["ประเภท"] = derived;
      transferAmountToCategory(values, derived);
    } else if (vType === "ผู้รับเหมา") {
      values["ประเภท"] = selectedProd || "201 เตรียมงาน";
      transferAmountToCategory(values, selectedProd || "201 เตรียมงาน");
    } else if (vType === "พนักงาน") {
      values["ประเภท"] = "301 พนักงาน";
      transferAmountToCategory(values, "301 พนักงาน");
    }
  }

  if (changedField === "ประเภท") {
    const selectedCat = String(values["ประเภท"] || "").trim();
    if (selectedCat) {
      transferAmountToCategory(values, selectedCat);
    }

    if (isFuelCost(selectedCat) && hasValue(values["สินค้า"]) && !isFuelProduct(values["สินค้า"])) {
      values["สินค้า"] = "";
    } else if (isRepairCost(selectedCat) && hasValue(values["สินค้า"]) && !isCarRepairProduct(values["สินค้า"])) {
      values["สินค้า"] = "";
    } else if (isMachineCost(selectedCat) && hasValue(values["สินค้า"]) && !isMachineProduct(values["สินค้า"])) {
      values["สินค้า"] = "";
    } else if (isOtherExpense(selectedCat) && hasValue(values["สินค้า"]) && !isOtherExpenseProduct(values["สินค้า"])) {
      if (isFuelProduct(values["สินค้า"]) || isMachineProduct(values["สินค้า"]) || isCarRepairProduct(values["สินค้า"])) {
        values["สินค้า"] = "";
      }
    } else if (
      (isMaterialCost(selectedCat) || isToolCost(selectedCat)) &&
      (isFuelProduct(values["สินค้า"]) || isMachineProduct(values["สินค้า"]) || isCarRepairProduct(values["สินค้า"]) || isOtherExpenseProduct(values["สินค้า"]))
    ) {
      values["สินค้า"] = "";
    }
  }

  if (changedField === "ชื่อเครื่องมือ") {
    if (hasValue(values["ชื่อเครื่องมือ"])) {
      if (!isToolCost(values["ประเภท"])) {
        values["ประเภท"] = "504 เครื่องมือ";
        transferAmountToCategory(values, "504 เครื่องมือ");
      }
    }
  }

  if (changedField === "ผู้รับเหมา") {
    if (hasValue(values["ผู้รับเหมา"])) {
      if (!values["ประเภท"] || isMaterialCost(values["ประเภท"])) {
        values["ประเภท"] = "201 เตรียมงาน";
        transferAmountToCategory(values, "201 เตรียมงาน");
      }
      const conOption = (form.refOptions?.["ผู้รับเหมา"] || []).find(opt => opt.value === values["ผู้รับเหมา"]);
      const conType = String(conOption?.row?.["ประเภท"] || conOption?.row?.["statusค่าแรง"] || "");
      if (conType) {
        if (conType.includes("นิติบุคคล") || conType.includes("บริษัท")) {
          values["statusค่าแรง"] = "บริษัท";
        } else if (conType.includes("บุคคล")) {
          values["statusค่าแรง"] = "บุคคลธรรมดา";
        }
      }
    }
  }

  if (changedField === "vat") {
    if (isVatActive(values["vat"])) {
      values["วันได้บิล"] = getTodayDateIso();
    } else {
      values["วันได้บิล"] = "";
    }
  }

  if (changedField === "เครดิต") {
    const storeOption = (form.refOptions?.["ร้านค้า"] || []).find(opt => opt.value === values["ร้านค้า"]);
    const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
    const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
    const baseDate = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();

    if (storeCutoffDay > 0) {
      values["วันได้บิล"] = "";
      const cutoffDueDate = calculateMonthlyCutoffDueDate(baseDate, storeCutoffDay);
      if (cutoffDueDate) {
        values["วันจ่าย"] = cutoffDueDate;
      }
    } else {
      const creditDays = parseCreditDays(values["เครดิต"]);
      if (creditDays > 0) {
        values["วันได้บิล"] = "";
        const dueDate = calculateDueDate(baseDate, creditDays);
        if (dueDate) {
          values["วันจ่าย"] = dueDate;
        }
      } else {
        values["วันจ่าย"] = "";
      }
    }
  }

  if (changedField === "หัก" && !hasValue(values["หัก"])) {
    values["จำนวนหัก"] = "";
    values["วันออก 3%"] = "";
  }

  if (changedField === "ว/ด/ป" || changedField === "วันที่") {
    const storeOption = (form.refOptions?.["ร้านค้า"] || []).find(opt => opt.value === values["ร้านค้า"]);
    const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
    const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
    const baseDate = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();

    if (storeCutoffDay > 0) {
      const cutoffDueDate = calculateMonthlyCutoffDueDate(baseDate, storeCutoffDay);
      if (cutoffDueDate) {
        values["วันจ่าย"] = cutoffDueDate;
      }
    } else {
      const creditDays = parseCreditDays(values["เครดิต"]);
      if (creditDays > 0) {
        if (hasValue(baseDate)) {
          const dueDate = calculateDueDate(baseDate, creditDays);
          if (dueDate) {
            values["วันจ่าย"] = dueDate;
          }
        }
      }
    }
  }

  if (form.tableName !== TABLES.DATA && form.tableName !== "Data") {
    const typeField = form.schema.find(field => field.name === "ประเภท");
    if (typeField && values["ประเภท"] && !getEnumValues(typeField, values).includes(values["ประเภท"])) {
      values["ประเภท"] = "";
    }
  }
}

export function applyRefFill(values: Record<string, string>, field: FieldSchema, form: FormPayload, value: string) {
  if (field.type !== "Ref" || !field.refFill) return;
  const selectedOption = (form.refOptions[field.name] || []).find(option => String(option.value) === value);
  Object.entries(field.refFill).forEach(([targetField, sourceColumn]) => {
    let filledVal = selectedOption ? String(selectedOption.row?.[sourceColumn] ?? "") : "";
    if (sourceColumn.includes("{")) {
      filledVal = selectedOption ? sourceColumn.replace(/\{([^}]+)\}/g, (_, key) => {
        const val = selectedOption.row?.[key];
        if (typeof val === "number") return new Intl.NumberFormat("th-TH").format(val);
        if (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "") return new Intl.NumberFormat("th-TH").format(Number(val));
        return String(val ?? "");
      }) : "";
    }
    if (targetField === "ธนาคาร" && filledVal && (form.refOptions["ธนาคาร"] || []).length > 0) {
      const bankOpt = form.refOptions["ธนาคาร"].find(b =>
        String(b.value) === filledVal ||
        String(b.label) === filledVal ||
        String(b.row?.id_bank) === filledVal ||
        String(b.row?.id) === filledVal
      );
      if (bankOpt) {
        filledVal = String(bankOpt.row?.["ชื่อธนาคาร"] || bankOpt.label || bankOpt.value);
      }
    }
    values[targetField] = filledVal;
  });
}

export function isFieldVisible(field: FieldSchema, values: Record<string, string>, form?: FormPayload): boolean {
  const vendorType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
  const cat = values["ประเภท"] || "";

  // 1. Vendor / Contractor / Staff specific fields
  if (field.name === "ร้านค้า") {
    return vendorType === "ร้านค้า";
  }
  if (field.name === "สินค้า") {
    return true;
  }
  if (field.name === "ผู้รับเหมา" || field.name === "ค่าแรงคงเหลือ") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "statusค่าแรง") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "รายละเอียดงาน") {
    return false;
  }
  if (field.name === "ชื่อพนักงาน") {
    return vendorType === "พนักงาน" || isStaffCost(cat);
  }

  // 2. Expense amounts & specifics
  if (field.name === "ค่าแรง") {
    return vendorType === "ผู้รับเหมา" || isLaborCost(cat);
  }
  if (field.name === "พนักงาน") {
    return vendorType === "พนักงาน" || isStaffCost(cat);
  }
  if (field.name === "น้ำมัน") {
    return isFuelCost(cat);
  }
  if (field.name === "ซ่อมรถ") {
    return isRepairCost(cat);
  }
  if (field.name === "ทะเบียน") {
    return (
      isFuelCost(cat) ||
      isRepairCost(cat) ||
      values["has_fuel_or_repair"] === "true" ||
      Number(values["น้ำมัน"] || 0) > 0 ||
      Number(values["ซ่อมรถ"] || 0) > 0
    );
  }
  if (field.name === "เครื่องจักร") {
    return isMachineCost(cat);
  }
  if (field.name === "เครื่องมือ" || field.name === "ชื่อเครื่องมือ") {
    return isToolCost(cat);
  }
  if (field.name === "อื่นๆ") {
    return vendorType === "ร้านค้า" && isOtherExpense(cat);
  }
  if (field.name === "รายการ") {
    return isOtherExpense(cat);
  }
  if (field.name === "ค่าของ") {
    return vendorType === "ร้านค้า" && (!cat || isMaterialCost(cat));
  }

  // 3. Tax / Credit
  const storeOption = (form?.refOptions?.["ร้านค้า"] || []).find(opt => opt.value === values["ร้านค้า"]);
  const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
  const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
  const hasStoreCredit = storeCutoffDay > 0 || (hasValue(storeCutoffRaw) && storeCutoffRaw !== "-" && storeCutoffRaw !== "0");

  if (field.name === "วันได้บิล") {
    const hasVat = isVatActive(values["vat"]);
    const hasCredit = parseCreditDays(values["เครดิต"]) > 0 || hasStoreCredit || Boolean(values["วันจ่าย"]);
    return hasVat && !hasCredit;
  }
  if (field.name === "vat") {
    return vendorType === "ร้านค้า" || (vendorType === "ผู้รับเหมา" && values["statusค่าแรง"] === "บริษัท");
  }
  if (field.name === "เครดิต") {
    return hasValue(values["เครดิต"]) && parseCreditDays(values["เครดิต"]) > 0;
  }
  if (field.name === "วันจ่าย") {
    return Boolean(hasStoreCredit || values["วันจ่าย"] || parseCreditDays(values["เครดิต"]) > 0);
  }
  if (field.name === "หัก") {
    return vendorType === "ผู้รับเหมา" || isLaborCost(cat) || isOtherExpense(cat);
  }

  if (!field.showIf) return true;
  const actual = values[field.showIf.column] || "";
  if (field.showIf.equals !== undefined) return actual === field.showIf.equals;
  if (field.showIf.in) return field.showIf.in.includes(actual);
  if (field.showIf.notBlank) {
    if (field.showIf.column === "vat") return isVatActive(actual);
    if (field.showIf.column === "หัก") return parseDeductPercent(actual) > 0;
    if (field.showIf.column === "เครดิต") return parseCreditDays(actual) > 0;
    return hasValue(actual);
  }
  return true;
}

export function pruneHiddenConditionalValues(values: Record<string, string>, form: FormPayload) {
  form.schema.forEach(field => {
    if (field.type === "Hidden" || field.name === "ประเภท" || field.name.startsWith("งบไม่เกิน") || field.name === "คุมงบประเภทงาน") return;
    if (field.name === "วันจ่าย" && hasValue(values["วันจ่าย"])) return;
    if (field.name === "เครดิต" && hasValue(values["เครดิต"])) return;
    if (isFieldVisible(field, values, form)) return;
    values[field.name] = "";
  });
}

export function sanitizeValuesForSubmit(values: Record<string, string>, form: FormPayload): Record<string, string> {
  const next = { ...values };
  pruneHiddenConditionalValues(next, form);
  applyLocalFormulas(next, form.tableName);
  if (form.tableName === TABLES.DATA || form.tableName === "Data" || form.tableName === "bills") {
    const vType = String(next["ร้านค้า/ผู้รับเหมา"] || "").trim();
    if (vType === "พนักงาน") {
      next["ประเภท"] = "301 พนักงาน";
      if (next["ชื่อพนักงาน"]) {
        next["ร้าน/บุคคล"] = next["ชื่อพนักงาน"];
      }
      next["ผู้รับเหมา"] = "";
      next["ร้านค้า"] = "";
      next["statusค่าแรง"] = "";
    } else if (vType === "ผู้รับเหมา") {
      if (!next["ประเภท"] || next["ประเภท"] === "2.ค่าแรง" || !ALL_CONTRACTOR_CATEGORIES.includes(next["ประเภท"])) {
        next["ประเภท"] = "201 เตรียมงาน";
      }
      next["ร้านค้า"] = "";
      next["ชื่อพนักงาน"] = "";
    } else {
      next["ร้านค้า/ผู้รับเหมา"] = "ร้านค้า";
      next["ผู้รับเหมา"] = "";
      next["ชื่อพนักงาน"] = "";
      next["statusค่าแรง"] = "";
      if (!next["ประเภท"] || next["ประเภท"] === "1.ค่าของ") {
        next["ประเภท"] = deriveCategoryFromProduct(next["สินค้า"]) || "101 เตรียมงาน";
      }
    }
  }
  return next;
}

export function isFieldRequired(field: FieldSchema, values: Record<string, string>, tableName?: string): boolean {
  if (!field.required) return false;
  if (field.type === "Hidden" || field.readonly) return false;

  const vendorType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
  if (field.name === "ร้านค้า") {
    return vendorType === "ร้านค้า";
  }
  if (field.name === "ผู้รับเหมา") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "statusค่าแรง") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "ชื่อพนักงาน") {
    return vendorType === "พนักงาน";
  }
  if (field.name === "ประเภท") {
    return false;
  }

  return true;
}

export function getFieldLabel(field: FieldSchema, values?: Record<string, string>): string {
  if (field.label) return field.label;
  if (field.name === "น้ำมัน" || field.name === "ซ่อมรถ" || field.name === "เครื่องจักร" || field.name === "เครื่องมือ" || field.name === "ค่าของ" || field.name === "อื่นๆ") {
    return "ค่าใช้จ่าย";
  }
  if (field.name === "ร้านค้า/ผู้รับเหมา") return "ประเภทค่าใช้จ่าย";
  if (field.name === "สินค้า") {
    const vType = values?.["ร้านค้า/ผู้รับเหมา"];
    if (vType === "ผู้รับเหมา") return "ประเภทงาน (ผู้รับเหมา)";
    if (vType === "พนักงาน") return "ประเภทงาน (พนักงาน)";
    return "ประเภทสินค้า";
  }
  if (field.name === "พนักงาน") return "ยอดเงิน (พนักงาน)";
  if (field.name === "LINE User ID" || field.name === "LINE") return "LINE User ID (ไอดีไลน์สำหรับแจ้งเตือน)";
  if (field.name === "วันออก 3%") return "วันออก";
  if (field.name === "id_Contractor" || field.name === "id_contractor") return "ผู้รับเหมา";
  if (field.name === "id_Conwork" || field.name === "id_conwork") return "รหัสสัญญา";
  if (field.name === "color" || field.name === "COLOR") return "color (ประเภทงาน)";
  return field.name;
}

export function validateVisibleRequiredFields(values: Record<string, string>, form: FormPayload): string {
  const missingField = form.schema.find(field => {
    if (!isFieldRequired(field, values, form.tableName)) return false;
    if (!isFieldVisible(field, values, form)) return false;
    return !hasValue(values[field.name]);
  });

  return missingField ? `กรุณากรอก ${getFieldLabel(missingField)}` : "";
}

export function getFieldClassName(field: FieldSchema, values?: Record<string, string>): string {
  const vendorType = values?.["ร้านค้า/ผู้รับเหมา"];

  if (field.name === "ผู้รับเหมา") {
    return "col-span-1";
  }
  if (field.name === "รายละเอียดงาน") {
    return "hidden";
  }
  if (
    field.type === "LongText" ||
    field.type === "Image" ||
    field.type === "File" ||
    field.type === "EnumList" ||
    field.name === "ร้านค้า/ผู้รับเหมา"
  ) {
    return "col-span-full";
  }
  if (field.name === "สินค้า" && vendorType === "ผู้รับเหมา") {
    return "col-span-1";
  }
  if (
    field.name === "ID Project" ||
    field.name === "ชื่อ Project" ||
    field.name === "ร้านค้า" ||
    field.name === "ชื่อพนักงาน" ||
    field.name === "ประเภท"
  ) {
    return "col-span-1 sm:col-span-2 lg:col-span-2";
  }
  return "col-span-1";
}
