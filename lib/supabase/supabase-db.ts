import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
export { supabaseAdmin };
import { normalizeDateToIso, formatDateDisplay, getTodayDateIso } from "@/lib/utils/dates";
import { cached, clearCache } from "@/lib/utils/cache";
import { isVatActive, isDeductActive, parseDeductPercent, parseCreditDays } from "@/lib/project-summary";
import { ALL_STORE_CATEGORIES, ALL_CONTRACTOR_CATEGORIES } from "@/lib/cost-codes";

export type SheetRow = Record<string, any>;

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && !url.includes("placeholder") && key && !key.includes("placeholder"));
}

function hasValue(val: unknown) {
  return val !== null && val !== undefined && String(val).trim() !== "";
}

function toNumber(val: unknown) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  const num = Number(String(val).replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
}

const TABLE_MAP: Record<string, string> = {
  Data: "bills",
  data: "bills",
  bills: "bills",
  Project: "projects",
  project: "projects",
  projects: "projects",
  ร้านค้า: "stores",
  store: "stores",
  stores: "stores",
  รับเหมา: "contractors",
  contractor: "contractors",
  contractors: "contractors",
  งานรับเหมา: "contract_works",
  Contract_work: "contract_works",
  Contract_Work: "contract_works",
  contract_work: "contract_works",
  ContractWork: "contract_works",
  CONTRACT_WORK: "contract_works",
  contractWork: "contract_works",
  contractwork: "contract_works",
  contract_works: "contract_works",
  เปิดจ้าง: "contract_works",
  "5. เปิดจ้าง": "contract_works",
  เปิดจ้างงาน: "contract_works",
  Tasks: "tasks",
  Works: "works",
  Plan: "plans",
  "Master Member": "master_members",
  รายชื่อ: "master_members",
  พนักงาน: "master_members",
  ชื่อพนักงาน: "master_members",
  "6. ชื่อพนักงาน": "master_members",
  รายชื่อพนักงาน: "master_members",
  PEOPLE: "master_members",
  people: "master_members",
  master_members: "master_members",
  ธนาคาร: "banks",
  BANK: "banks",
  bank: "banks",
  banks: "banks",
  ทะเบียน: "cars",
  CAR: "cars",
  car: "cars",
  cars: "cars",
  ประเภท: "categories",
  CATEGORY: "categories",
  category: "categories",
  categories: "categories",
  ลูกค้า: "customers",
  CUSTOMER: "customers",
  customer: "customers",
  customers: "customers",
  บริษัท: "companies",
  COMPANY: "companies",
  company: "companies",
  companies: "companies",
  ยืมเงิน: "loans",
  LOAN: "loans",
  loan: "loans",
  loans: "loans",
  เบิกเงิน: "bills",
  WITHDRAW: "bills",
  ตัวเลือกระบบ: "system_options",
  ระบบLog: "audit_logs",
  สินค้า: "products",
  PRODUCT: "products",
  product: "products",
  products: "products",
  "ประเภทสินค้า": "products"
};

export function getDbTableName(tableName: string): string {
  if (!tableName) return "";
  if (TABLE_MAP[tableName]) return TABLE_MAP[tableName];
  const normalized = tableName.trim().toLowerCase().replace(/[-_]/g, "");
  if (normalized === "contractwork" || normalized === "contractworks" || normalized === "conwork" || tableName === "งานรับเหมา") {
    return "contract_works";
  }
  if (normalized === "data" || normalized === "bills" || normalized === "bill") {
    return "bills";
  }
  if (normalized === "project" || normalized === "projects") {
    return "projects";
  }
  if (normalized === "store" || normalized === "stores" || tableName === "ร้านค้า") {
    return "stores";
  }
  if (normalized === "contractor" || normalized === "contractors" || tableName === "รับเหมา") {
    return "contractors";
  }
  if (normalized === "people" || normalized === "mastermember" || normalized === "mastermembers" || tableName === "รายชื่อ") {
    return "master_members";
  }
  if (normalized === "bank" || normalized === "banks" || tableName === "ธนาคาร") {
    return "banks";
  }
  if (normalized === "car" || normalized === "cars" || tableName === "ทะเบียน") {
    return "cars";
  }
  if (normalized === "category" || normalized === "categories" || tableName === "ประเภท") {
    return "categories";
  }
  if (normalized === "customer" || normalized === "customers" || tableName === "ลูกค้า") {
    return "customers";
  }
  if (normalized === "company" || normalized === "companies" || tableName === "บริษัท") {
    return "companies";
  }
  if (normalized === "loan" || normalized === "loans" || tableName === "ยืมเงิน") {
    return "loans";
  }
  if (normalized === "tasks" || normalized === "task" || tableName === "งาน" || tableName === "Tasks") {
    return "tasks";
  }
  if (normalized === "works" || normalized === "work" || tableName === "งานPW" || tableName === "PW" || tableName === "Works") {
    return "works";
  }
  if (normalized === "plans" || normalized === "plan" || tableName === "แผนงาน" || tableName === "Plan") {
    return "plans";
  }
  if (normalized === "product" || normalized === "products" || tableName === "สินค้า" || tableName === "ประเภทสินค้า") {
    return "products";
  }
  return TABLE_MAP[tableName] || tableName.toLowerCase();
}

export const DEFAULT_PRODUCT_CATEGORIES: SheetRow[] = [
  { _sheetRow: 1, id_product: "1", รหัสสินค้า: "1", ชื่อประเภทสินค้า: "ปูน/ทราย/หิน", หมายเหตุ: "" },
  { _sheetRow: 2, id_product: "2", รหัสสินค้า: "2", ชื่อประเภทสินค้า: "เหล็กเส้น/รูปพรรณ", หมายเหตุ: "" },
  { _sheetRow: 3, id_product: "3", รหัสสินค้า: "3", ชื่อประเภทสินค้า: "คอนกรีตผสมเสร็จ", หมายเหตุ: "" },
  { _sheetRow: 4, id_product: "4", รหัสสินค้า: "4", ชื่อประเภทสินค้า: "ไม้แบบ/ไม้อัด", หมายเหตุ: "" },
  { _sheetRow: 5, id_product: "5", รหัสสินค้า: "5", ชื่อประเภทสินค้า: "วัสดุมุง", หมายเหตุ: "" },
  { _sheetRow: 6, id_product: "6", รหัสสินค้า: "6", ชื่อประเภทสินค้า: "ฝ้าผนัง", หมายเหตุ: "" },
  { _sheetRow: 7, id_product: "7", รหัสสินค้า: "7", ชื่อประเภทสินค้า: "ปูพื้น", หมายเหตุ: "" },
  { _sheetRow: 8, id_product: "8", รหัสสินค้า: "8", ชื่อประเภทสินค้า: "กระจก", หมายเหตุ: "" },
  { _sheetRow: 9, id_product: "9", รหัสสินค้า: "9", ชื่อประเภทสินค้า: "ไฟฟ้า", หมายเหตุ: "" },
  { _sheetRow: 10, id_product: "10", รหัสสินค้า: "10", ชื่อประเภทสินค้า: "ประปา", หมายเหตุ: "" },
  { _sheetRow: 11, id_product: "11", รหัสสินค้า: "11", ชื่อประเภทสินค้า: "อื่นๆ(วัสดุ)", หมายเหตุ: "" },
  { _sheetRow: 12, id_product: "12", รหัสสินค้า: "12", ชื่อประเภทสินค้า: "สีเคมี", หมายเหตุ: "" },
  { _sheetRow: 13, id_product: "13", รหัสสินค้า: "13", ชื่อประเภทสินค้า: "สุขภัณฑ์", หมายเหตุ: "" },
  { _sheetRow: 14, id_product: "14", รหัสสินค้า: "14", ชื่อประเภทสินค้า: "บิวอิน", หมายเหตุ: "" },
  { _sheetRow: 15, id_product: "15", รหัสสินค้า: "15", ชื่อประเภทสินค้า: "แอร์", หมายเหตุ: "" },
  { _sheetRow: 16, id_product: "16", รหัสสินค้า: "16", ชื่อประเภทสินค้า: "ดิน", หมายเหตุ: "" },
  { _sheetRow: 17, id_product: "17", รหัสสินค้า: "17", ชื่อประเภทสินค้า: "หินทราย", หมายเหตุ: "" },
  { _sheetRow: 18, id_product: "18", รหัสสินค้า: "18", ชื่อประเภทสินค้า: "เตรียมงาน", หมายเหตุ: "" },
  { _sheetRow: 19, id_product: "101", รหัสสินค้า: "101", ชื่อประเภทสินค้า: "น้ำมัน", หมายเหตุ: "" },
  { _sheetRow: 20, id_product: "102", รหัสสินค้า: "102", ชื่อประเภทสินค้า: "ค่าขนส่ง", หมายเหตุ: "" },
  { _sheetRow: 21, id_product: "103", รหัสสินค้า: "103", ชื่อประเภทสินค้า: "เครื่องจักร", หมายเหตุ: "" },
  { _sheetRow: 22, id_product: "104", รหัสสินค้า: "104", ชื่อประเภทสินค้า: "ซ่อมรถ", หมายเหตุ: "" },
  { _sheetRow: 23, id_product: "200", รหัสสินค้า: "200", ชื่อประเภทสินค้า: "ดำเนินการ(อื่นๆ)", หมายเหตุ: "" },
  { _sheetRow: 24, id_product: "non", รหัสสินค้า: "non", ชื่อประเภทสินค้า: "non (7.เครื่องมือ 8.อื่นๆ ที่พัก)", หมายเหตุ: "" }
];

export function cleanDataPayload(obj: any): Record<string, any> {
  if (!obj || typeof obj !== "object") return {};

  // Collect nested layers from inside out (innermost oldest, outermost newest)
  const layers: Record<string, any>[] = [];
  let curr: any = obj;
  let depth = 0;
  while (curr && typeof curr === "object" && !Array.isArray(curr) && depth < 30) {
    const copy = { ...curr };
    const nextData = copy.data;
    delete copy.data;
    layers.unshift(copy); // innermost at index 0, outermost (newest) at end
    curr = nextData;
    depth++;
  }

  const result: Record<string, any> = {};
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (k !== "data") {
        result[k] = v;
      }
    }
  }
  delete result.data;
  return result;
}

export function mapSupabaseRowToSheetRow(dbTable: string, row: Record<string, any>, idx: number = 0): SheetRow {
  if (!row) return {};
  const dataObj = cleanDataPayload(row.data);
  const res: SheetRow = { ...dataObj, ...row };
  delete res.data;

  if (dbTable === "bills") {
    res["ลำดับ"] = row.id ?? row["ลำดับ"] ?? dataObj["ลำดับ"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ID Project"] = row.project_id ?? row["ID Project"] ?? dataObj["ID Project"];
    res["ชื่อ Project"] = row.project_name ?? row["ชื่อ Project"] ?? dataObj["ชื่อ Project"];
    res["ร้าน/บุคคล"] = row.vendor_or_person ?? row["ร้าน/บุคคล"] ?? dataObj["ร้าน/บุคคล"];
    res["สินค้า/ทำงาน"] = row.description ?? row["สินค้า/ทำงาน"] ?? dataObj["สินค้า/ทำงาน"];
    res["บิล"] = row.bill_no ?? row["บิล"] ?? dataObj["บิล"];
    res["ประเภท"] = row.category ?? row["ประเภท"] ?? dataObj["ประเภท"];
    res["ยอดเงิน"] = row.amount ?? row["ยอดเงิน"] ?? dataObj["ยอดเงิน"];
    
    const hasExplicitZeroWht = row.withholding_tax !== null && row.withholding_tax !== undefined && Number(row.withholding_tax) === 0;
    const rawWhtStr = String(row["หัก"] || dataObj["หัก"] || "").trim();
    const isWhtActive = !hasExplicitZeroWht && (
      Number(row.withholding_tax) > 0 ||
      isDeductActive(row["หัก"]) ||
      isDeductActive(dataObj["หัก"])
    );
    res["หัก"] = isWhtActive ? (typeof row.withholding_tax === "number" && row.withholding_tax > 0 ? `หัก ${row.withholding_tax}%` : (rawWhtStr || `หัก 3%`)) : "";
    res["จำนวนหัก"] = isWhtActive ? (row.deduct_amount ?? row["จำนวนหัก"] ?? dataObj["จำนวนหัก"] ?? "") : "";
    res["3เปอร์"] = isWhtActive ? res["จำนวนหัก"] : "";
    res["3เปอร์เซ็น"] = isWhtActive ? res["จำนวนหัก"] : "";
    if (!isWhtActive) {
      res["วันออก 3%"] = "";
    }

    const hasExplicitZeroVat = row.vat_amount !== null && row.vat_amount !== undefined && Number(row.vat_amount) === 0;
    const isVat = !hasExplicitZeroVat && (Number(row.vat_amount) > 0 || isVatActive(row.vat) || isVatActive(dataObj.vat));
    if (!isVat) {
      res["vat"] = "";
      res.vat = "";
    }
    res["เครดิต"] = row.credit_days ?? row["เครดิต"] ?? dataObj["เครดิต"];
    res["ผู้เบิก"] = row.requester ?? row["ผู้เบิก"] ?? dataObj["ผู้เบิก"];
    res["ผู้สร้างบิล"] = row.created_by ?? row["ผู้สร้างบิล"] ?? dataObj["ผู้สร้างบิล"] ?? dataObj["ผู้บันทึก"] ?? "";
    res["created_by"] = res["ผู้สร้างบิล"];
    res["รูปถ่ายบิล"] = row.image_url ?? row["รูปถ่ายบิล"] ?? dataObj["รูปถ่ายบิล"];
    res["สถานะ"] = row.status ?? row["สถานะ"] ?? dataObj["สถานะ"];
    const resolvedBillDate = row.bill_date ? String(row.bill_date) : row["ว/ด/ป"] ?? row["วันที่"] ?? dataObj["ว/ด/ป"] ?? dataObj["วันที่"] ?? (row.created_at ? getTodayDateIso(new Date(row.created_at)) : "");
    res["ว/ด/ป"] = resolvedBillDate;
    res["วันที่"] = resolvedBillDate;
    res.bill_date = resolvedBillDate;
    res["เลขบัญชี"] = row.bank_account ?? row["เลขบัญชี"] ?? dataObj["เลขบัญชี"] ?? "";
    res["ธนาคาร"] = row.bank_name ?? row.bank ?? row["ธนาคาร"] ?? dataObj["ธนาคาร"] ?? "";
    res["ชื่อบัญชี"] = row.account_name ?? row["ชื่อบัญชี"] ?? dataObj["ชื่อบัญชี"] ?? "";

    res["ค่าของ"] = row.material_cost ?? row["ค่าของ"] ?? dataObj["ค่าของ"] ?? "";
    res["ค่าแรง"] = row.labor_cost ?? row["ค่าแรง"] ?? dataObj["ค่าแรง"] ?? "";
    res["พนักงาน"] = row.staff_cost ?? row["พนักงาน"] ?? dataObj["พนักงาน"] ?? "";
    res["น้ำมัน"] = row.fuel_cost ?? row["น้ำมัน"] ?? dataObj["น้ำมัน"] ?? "";
    res["ซ่อมรถ"] = row.repair_cost ?? row["ซ่อมรถ"] ?? dataObj["ซ่อมรถ"] ?? "";
    res["เครื่องจักร"] = row.machine_cost ?? row["เครื่องจักร"] ?? dataObj["เครื่องจักร"] ?? "";
    res["เครื่องมือ"] = row.tool_cost ?? row["เครื่องมือ"] ?? dataObj["เครื่องมือ"] ?? "";
    res["อื่นๆ"] = row.other_cost ?? row["อื่นๆ"] ?? dataObj["อื่นๆ"] ?? "";

    const cat = String(res["ประเภท"] || row.category || "").trim();
    const amt = row.amount ?? res["ยอดเงิน"] ?? "";
    if (cat.startsWith("1.") || cat.includes("ค่าของ")) res["ค่าของ"] = res["ค่าของ"] || amt;
    if (cat.startsWith("2.") || cat.includes("ค่าแรง")) res["ค่าแรง"] = res["ค่าแรง"] || amt;
    if (cat.startsWith("3.") || cat.includes("พนักงาน")) res["พนักงาน"] = res["พนักงาน"] || amt;
    if (cat.startsWith("4.") || cat.includes("น้ำมัน")) res["น้ำมัน"] = res["น้ำมัน"] || amt;
    if (cat.startsWith("5.") || cat.includes("ซ่อมรถ")) res["ซ่อมรถ"] = res["ซ่อมรถ"] || amt;
    if (cat.startsWith("6.") || cat.includes("เครื่องจักร")) res["เครื่องจักร"] = res["เครื่องจักร"] || amt;
    if (cat.startsWith("7.") || cat.includes("เครื่องมือ")) res["เครื่องมือ"] = res["เครื่องมือ"] || amt;
    if (cat.startsWith("8.") || cat.includes("อื่นๆ")) res["อื่นๆ"] = res["อื่นๆ"] || amt;

    res["statusค่าแรง"] = row.labor_status ?? row.status_labor ?? row["statusค่าแรง"] ?? dataObj["statusค่าแรง"] ?? "";
    res["ยอดโอน"] = row.transfer_amount ?? row["ยอดโอน"] ?? dataObj["ยอดโอน"] ?? "";
    res["วันได้บิล"] = row.bill_received_date ?? row["วันได้บิล"] ?? dataObj["วันได้บิล"] ?? "";
    res["วันออก 3%"] = row.wht_issued_date ?? row["วันออก 3%"] ?? dataObj["วันออก 3%"] ?? "";
    res["วันจ่าย"] = row.paid_date ?? row["วันจ่าย"] ?? dataObj["วันจ่าย"] ?? "";

    const rawCategory = String(row.category ?? row["ประเภท"] ?? dataObj["ประเภท"] ?? "").trim();
    const rawLaborStatus = String(row.labor_status ?? row["statusค่าแรง"] ?? dataObj["statusค่าแรง"] ?? "").trim();
    const hasLaborCost = Number(row.labor_cost ?? row["ค่าแรง"] ?? dataObj["ค่าแรง"] ?? 0) > 0;
    const rawStaffName = String(row.staff_name ?? row["ชื่อพนักงาน"] ?? dataObj["ชื่อพนักงาน"] ?? dataObj.staff_name ?? "").trim();
    const isStaffBill = rawCategory.startsWith("3.") || rawCategory.includes("พนักงาน") || Boolean(rawStaffName && !row.contractor_id && !dataObj["ผู้รับเหมา"]);
    const isContractorBill = !isStaffBill && (
      row.vendor_type === "ผู้รับเหมา" ||
      dataObj["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา" ||
      Boolean(row.contractor_id) ||
      Boolean(dataObj["ผู้รับเหมา"]) ||
      rawCategory.startsWith("2.") ||
      rawCategory.includes("ค่าแรง") ||
      rawCategory.includes("จ้าง") ||
      Boolean(rawLaborStatus) ||
      hasLaborCost
    );

    res["ร้านค้า/ผู้รับเหมา"] = isStaffBill ? "พนักงาน" : (isContractorBill ? "ผู้รับเหมา" : (row.vendor_type || dataObj["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า"));
    if (isStaffBill) {
      res["ผู้รับเหมา"] = "";
      res["ร้านค้า"] = "";
      res["รายละเอียดงาน"] = row.work_details ?? row.description ?? dataObj["รายละเอียดงาน"] ?? dataObj["สินค้า/ทำงาน"] ?? "";
      res["สินค้า"] = "";
      res["ร้าน/บุคคล"] = rawStaffName || row.vendor_or_person || dataObj["ร้าน/บุคคล"] || "พนักงาน";
    } else if (isContractorBill) {
      res["ผู้รับเหมา"] = row.contractor_id ?? dataObj["ผู้รับเหมา"] ?? row.vendor_or_person ?? dataObj["ร้าน/บุคคล"] ?? "";
      res["ร้านค้า"] = "";
      res["รายละเอียดงาน"] = row.work_details ?? row.description ?? dataObj["รายละเอียดงาน"] ?? dataObj["สินค้า/ทำงาน"] ?? "";
      res["สินค้า"] = "";
    } else {
      res["ร้านค้า"] = row.store_id ?? dataObj["ร้านค้า"] ?? row.vendor_or_person ?? dataObj["ร้าน/บุคคล"] ?? "";
      res["ผู้รับเหมา"] = "";
      res["สินค้า"] = row.product ?? row.description ?? dataObj["สินค้า"] ?? dataObj["สินค้า/ทำงาน"] ?? "";
      res["รายละเอียดงาน"] = "";
    }
    res["รายการ"] = row.sub_category ?? row.item_name ?? row["รายการ"] ?? dataObj["รายการ"] ?? "";
    res["ชื่อเครื่องมือ"] = row.tool_name ?? row["ชื่อเครื่องมือ"] ?? dataObj["ชื่อเครื่องมือ"] ?? "";
    res["ทะเบียน"] = row.plate_no ?? row["ทะเบียน"] ?? dataObj["ทะเบียน"] ?? "";
    res["ชื่อพนักงาน"] = row.staff_name ?? row["ชื่อพนักงาน"] ?? dataObj["ชื่อพนักงาน"] ?? "";
    res.items = row.items ?? dataObj.items ?? [];
  } else if (dbTable === "projects") {
    res["ID Project"] = row.id ?? row["ID Project"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่อ Project"] = row.name ?? row["ชื่อ Project"];
    res["ชื่อลูกค้า"] = row.customer_name ?? row["ชื่อลูกค้า"];
    res["สถานที่"] = row.location ?? row.place ?? row["สถานที่"];
    res["ยอดงาน"] = row.work_amount ?? row["ยอดงาน"];
    res["งบไม่เกิน"] = row.budget ?? row["งบไม่เกิน"];
    res["ยอดรวม vat"] = row.vat_total ?? row["ยอดรวม vat"];
    res["วันที่"] = row.start_date ? String(row.start_date) : (row.created_at ? getTodayDateIso(new Date(row.created_at)) : "");
    res["color"] = row.color ?? row["color"];
    res["รับผิดชอบ"] = row.responsible_person ?? row["รับผิดชอบ"];
    if (dataObj && typeof dataObj === "object") {
      Object.assign(res, dataObj);
    }
  } else if (dbTable === "stores") {
    res["id_store"] = row.id ?? row["id_store"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่อร้านค้า"] = row.name ?? row["ชื่อร้านค้า"];
    res["ชื่อเต็ม"] = row.full_name ?? row["ชื่อเต็ม"];
    res["เลขบัญชี"] = row.bank_account ?? row["เลขบัญชี"];
    res["ธนาคาร"] = row.bank_name ?? row.bank ?? row["ธนาคาร"];
    res["เบอร์โทร"] = row.phone ?? row["เบอร์โทร"];
    res["ที่อยู่"] = row.address ?? row["ที่อยู่"];
    res["เลขที่ผู้เสียภาษี"] = row.tax_id ?? row["เลขที่ผู้เสียภาษี"];
  } else if (dbTable === "contractors") {
    res["id_Contractor"] = row.id ?? row["id_Contractor"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่อเล่น"] = row.nickname ?? row["ชื่อเล่น"];
    res["ชื่อ-นามสกุล"] = row.full_name ?? row["ชื่อ-นามสกุล"];
    res["เลขบัญชี"] = row.bank_account ?? row["เลขบัญชี"];
    res["ธนาคาร"] = row.bank_name ?? row.bank ?? row["ธนาคาร"];
    res["บัตรประจำตัวประชาชน"] = row.id_card ?? row["บัตรประจำตัวประชาชน"];
    res["เบอร์โทรศัพท์"] = row.phone ?? row["เบอร์โทรศัพท์"];
    res["ที่อยู่"] = row.address ?? row["ที่อยู่"];
    const cFull = String(row.full_name ?? row["ชื่อ-นามสกุล"] ?? dataObj["ชื่อ-นามสกุล"] ?? "");
    const cNick = String(row.nickname ?? row["ชื่อเล่น"] ?? dataObj["ชื่อเล่น"] ?? "");
    const isCorp = /บริษัท|หจก|บจก|จำกัด|corporation|company/i.test(cFull + " " + cNick);
    const resolvedType = (row.contractor_type || row["ประเภท"] || dataObj["ประเภท"] || dataObj["contractor_type"] || (isCorp ? "นิติบุคคล" : "บุคคลธรรมดา")) as string;
    res["ประเภท"] = resolvedType;

    let limit = toNumber(row.annual_limit ?? row["จำกัดยอด/ปี"] ?? dataObj["จำกัดยอด/ปี"]);
    if (limit <= 0) {
      limit = resolvedType === "นิติบุคคล" ? 2_000_000 : 1_200_000;
    }
    res["จำกัดยอด/ปี"] = limit;
  } else if (dbTable === "contract_works") {
    res["id_Conwork"] = row.id ?? row["id_Conwork"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["id_Contractor"] = row.contractor_id ?? row["id_Contractor"];
    res["ID Project"] = row.project_id ?? row["ID Project"];
    res["ชื่อ Project"] = row.project_name ?? row["ชื่อ Project"];
    res["ยอดเงินจ้าง"] = row.total_contract_amount ?? row["ยอดเงินจ้าง"];
    res["รายละเอียดงาน"] = row.work_details ?? row["รายละเอียดงาน"];
    res["เบอร์โทรศัพท์"] = row.phone ?? row["เบอร์โทรศัพท์"];
    res["ยอดเงินจ่าย"] = row.paid_amount ?? row["ยอดเงินจ่าย"];
    res["วันที่"] = row.work_date ?? row.date ?? row.contract_date ?? row["วันที่"] ?? row["ว/ด/ป"] ?? row.created_at ?? "";
    res["สถานที่"] = row.location ?? row["สถานที่"] ?? "";
    res["เลขบัญชี"] = row.bank_account ?? row["เลขบัญชี"] ?? "";
    res["ธนาคาร"] = row.bank_name ?? row.bank ?? row["ธนาคาร"] ?? "";
    res["บัตรประจำตัวประชาชน"] = row.id_card ?? row["บัตรประจำตัวประชาชน"] ?? "";
    res["ที่อยู่"] = row.address ?? row["ที่อยู่"] ?? "";
    res["ชื่อ-นามสกุล"] = row.full_name ?? row["ชื่อ-นามสกุล"] ?? "";
    res["ชื่อเล่น"] = row.nickname ?? row["ชื่อเล่น"] ?? "";
    res["ค่าแรงคงเหลือ"] = row.remaining_amount ?? row["ค่าแรงคงเหลือ"] ?? "";
  } else if (dbTable === "master_members") {
    res["รหัสพนักงาน"] = row.id ?? row["รหัสพนักงาน"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่อเล่น"] = row.nickname ?? row["ชื่อเล่น"];
    res["ชื่อ-นามสกุล"] = row.full_name ?? row["ชื่อ-นามสกุล"];
    res["เลขบัญชี"] = row.bank_account ?? row["เลขบัญชี"];
    res["ธนาคาร"] = row.bank_name ?? row.bank ?? row["ธนาคาร"];
    res["เบอร์โทร"] = row.phone ?? row["เบอร์โทร"];
    res["ที่อยู่"] = row.address ?? row["ที่อยู่"];
    res["เลขที่บัตรประชาชน"] = row.id_card ?? row["เลขที่บัตรประชาชน"];

    const d = (row.data && typeof row.data === "object") ? row.data : {};
    const isOwner = (row.is_owner !== undefined && row.is_owner !== null)
      ? Boolean(row.is_owner)
      : Boolean(d.is_owner ?? d["เจ้าของระบบ"] ?? row["เจ้าของระบบ"]);

    const canClose = (row.can_close_bill !== undefined && row.can_close_bill !== null)
      ? Boolean(row.can_close_bill)
      : Boolean(d.can_close_bill ?? d["อนุมัติบิล"] ?? row["อนุมัติบิล"]);

    const canApprove = (row.can_approve !== undefined && row.can_approve !== null)
      ? Boolean(row.can_approve)
      : Boolean(d.can_approve ?? d["ฝ่ายการเงิน"] ?? row["ฝ่ายการเงิน"]);

    const canDelete = (row.can_delete !== undefined && row.can_delete !== null)
      ? Boolean(row.can_delete)
      : Boolean(d.can_delete ?? d["สิทธิ์ลบข้อมูล"] ?? row["สิทธิ์ลบข้อมูล"]);

    const rawPermStr = String(row["สิทธิ์การใช้งาน"] ?? d["สิทธิ์การใช้งาน"] ?? "");
    const activePerms: string[] = [];
    if (isOwner) activePerms.push("เจ้าของระบบ (Owner)");
    if (canClose) activePerms.push("อนุมัติบิล (Approver)");
    if (canApprove) activePerms.push("ฝ่ายการเงิน (Finance)");
    if (canDelete) activePerms.push("ลบข้อมูล (Delete)");

    res["สิทธิ์การใช้งาน"] = activePerms.join(", ");
    const lineId = row.line_user_id ?? d.line_user_id ?? row["LINE User ID"] ?? d["LINE User ID"] ?? row["LINE"] ?? d["LINE"] ?? "";
    res["LINE"] = lineId;
    res["LINE User ID"] = lineId;
    res["สถานะ"] = row.status ?? d.status ?? row["สถานะ"] ?? d["สถานะ"] ?? "Active";
    res["เจ้าของระบบ"] = isOwner;
    res["ฝ่ายการเงิน"] = canApprove;
    res["อนุมัติบิล"] = canClose;
    res["สิทธิ์ลบข้อมูล"] = canDelete;
    res.is_owner = isOwner;
    res.can_close_bill = canClose;
    res.can_approve = canApprove;
    res.can_delete = canDelete;
    res["pictureUrl"] = row.pictureurl ?? d.pictureUrl ?? d.pictureurl ?? row["pictureUrl"] ?? "";
    res["pictureurl"] = row.pictureurl ?? d.pictureUrl ?? d.pictureurl ?? row["pictureUrl"] ?? "";
  } else if (dbTable === "banks") {
    res["id_bank"] = row.id ?? row["id_bank"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่อธนาคาร"] = row.name ?? row["ชื่อธนาคาร"];
    res["image"] = row.image ?? row.image_url ?? row["image"];
    res["รูปภาพ"] = row.image ?? row.image_url ?? row["รูปภาพ"];
  } else if (dbTable === "cars") {
    res["id_car"] = row.id ?? row["id_car"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["หมายเลขทะเบียน"] = row.plate_no ?? row["หมายเลขทะเบียน"];
    res["ยี่ห้อรถ"] = row.brand ?? row["ยี่ห้อรถ"];
    res["สี"] = row.color ?? row["สี"];
    res["รับผิดชอบ"] = row.responsible_person ?? row["รับผิดชอบ"];
    res["รถของ"] = row.owner ?? row["รถของ"];
  } else if (dbTable === "customers") {
    res["id_cus"] = row.id ?? row["id_cus"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่อลูกค้า"] = row.name ?? row["ชื่อลูกค้า"];
    res["ที่อยู่"] = row.address ?? row["ที่อยู่"];
    res["เลขที่ผู้เสียภาษี"] = row.tax_id ?? row["เลขที่ผู้เสียภาษี"];
    delete res.name;
    delete res.address;
    delete res.tax_id;
  } else if (dbTable === "companies") {
    res["id_Company"] = row.id ?? row["id_Company"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่ออังกฤษ"] = row.name_en ?? row["ชื่ออังกฤษ"];
    res["ชื่อบริษัท"] = row.name_th ?? row["ชื่อบริษัท"];
    res["สำนักงาน"] = row.branch ?? row["สำนักงาน"];
    res["ที่อยู่"] = row.address ?? row["ที่อยู่"];
    res["เลขที่สียภาษี "] = row.tax_id ?? row["เลขที่สียภาษี "];
    res["เบอร์โทร"] = row.phone ?? row["เบอร์โทร"];
  } else if (dbTable === "loans") {
    res["id"] = row.id ?? row["id"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ชื่อ"] = row.borrower_name ?? row["ชื่อ"];
    res["type"] = row.type ?? row["type"];
    res["จำนวนเงิน"] = row.amount ?? row["จำนวนเงิน"];
  } else if (dbTable === "categories") {
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ประเภท Name1"] = row.name1 ?? row.contractor_type ?? row["ประเภท Name1"];
    res["ประเภท Name2"] = row.name2 ?? row.store_type ?? row["ประเภท Name2"];
    res["ประเภท Name3"] = row.name3 ?? row.store_item_type ?? row["ประเภท Name3"];
  } else if (dbTable === "products") {
    res["id_product"] = row.id ?? row["id_product"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["รหัสสินค้า"] = row.code ?? row["รหัสสินค้า"];
    res["ชื่อประเภทสินค้า"] = row.name ?? row["ชื่อประเภทสินค้า"];
    res["หมายเหตุ"] = row.note ?? row["หมายเหตุ"];
  } else if (dbTable === "tasks") {
    res["id"] = row.id ?? row["id"];
    res["ลำดับ"] = row.id ?? row["ลำดับ"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["รายการ"] = row.title ?? row["รายการ"] ?? "";
    const doDateFormatted = row.do_date ? formatDateDisplay(row.do_date) : (row["ดู/ทำ"] ? formatDateDisplay(row["ดู/ทำ"]) : (row["วันที่ดู/ทำ"] ? formatDateDisplay(row["วันที่ดู/ทำ"]) : "-"));
    const sendDateFormatted = row.send_date ? formatDateDisplay(row.send_date) : (row["ส่งงาน"] ? formatDateDisplay(row["ส่งงาน"]) : (row["วันที่ส่งงาน"] ? formatDateDisplay(row["วันที่ส่งงาน"]) : "-"));
    res["ดู/ทำ"] = doDateFormatted;
    res["วันที่ดู/ทำ"] = doDateFormatted;
    res["ส่งงาน"] = sendDateFormatted;
    res["วันที่ส่งงาน"] = sendDateFormatted;
    res["รหัสพนักงาน"] = row.assignee_id ?? row["รหัสพนักงาน"] ?? "";
    res["ผู้รับมอบหมาย"] = row.assignee_name ?? row["ผู้รับมอบหมาย"] ?? row["ผู้รับผิดชอบ"] ?? "";
    res["ผู้รับผิดชอบ"] = row.assignee_name ?? row["ผู้รับผิดชอบ"] ?? row["ผู้รับมอบหมาย"] ?? "";
    res["สถานะ"] = row.status ?? row["สถานะ"] ?? "ดำเนินการ";
    const typeNum = Number(row.task_type ?? row["ประเภท"] ?? 1);
    res["ประเภท"] = typeNum === 2 ? "2 (แผนงาน)" : typeNum === 3 ? "3 (PJSA)" : "1 (เอกสาร)";
    res["task_type"] = typeNum;
  } else if (dbTable === "works") {
    res["id"] = row.id ?? row["id"];
    res["ลำดับ"] = row.id ?? row["ลำดับ"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["ทีม"] = row.team ?? row["ทีม"] ?? "PW";
    res["กิจกรรม"] = row.activity_type ?? row["กิจกรรม"] ?? "เสนอราคา";
    res["เรื่อง"] = row.title ?? row["เรื่อง"] ?? "";
    res["PR"] = row.pr_no ?? row["PR"] ?? "-";
    res["สถานที่"] = row.location ?? row["สถานที่"] ?? "-";
    res["นัดดู"] = row.date_inspect ?? row["นัดดู"] ?? "-";
    res["นัดเสนอ"] = row.date_propose ?? row["นัดเสนอ"] ?? "-";
    res["ติดต่อ1"] = row.contact1 ?? row["ติดต่อ1"] ?? "-";
    res["เบอร์1"] = row.phone1 ?? row["เบอร์1"] ?? "-";
    res["ติดต่อ2"] = row.contact2 ?? row["ติดต่อ2"] ?? "-";
    res["เบอร์2"] = row.phone2 ?? row["เบอร์2"] ?? "-";
    res["บริษัท"] = row.company ?? row["บริษัท"] ?? "-";
    res["สถานะ"] = row.status ?? row["สถานะ"] ?? "รอดูงาน";
    res["หมายเหตุ"] = row.note ?? row["หมายเหตุ"] ?? "";
  } else if (dbTable === "plans") {
    res["id"] = row.id ?? row["id"];
    res["ลำดับ"] = row.id ?? row["ลำดับ"];
    res["_sheetRow"] = row.id ?? row._sheetRow;
    res["รหัสงาน"] = row.project_code ?? row["รหัสงาน"] ?? "";
    res["ชื่อแผนงาน"] = row.job_name ?? row["ชื่อแผนงาน"] ?? "";
    res["รายการ"] = row.item_name ?? row["รายการ"] ?? "";
    res["วันที่เริ่ม"] = row.start_date ? String(row.start_date) : (row["วันที่เริ่ม"] ?? "");
    res["วันที่จบ"] = row.end_date ? String(row.end_date) : (row["วันที่จบ"] ?? "");
    res["จำนวนวัน"] = row.days_count ?? row["จำนวนวัน"] ?? 0;
    res["%แผน"] = row.plan_percentage ?? row["%แผน"] ?? 0;
    res["actual"] = row.actual_percentage ?? row["actual"] ?? 0;
    res["สถานะ"] = row.status ?? row["สถานะ"] ?? "Open";
  }

  // Assign canonical Supabase entity primary key ID
  const canonicalId = row.id ??
    res.id ??
    res["ลำดับ"] ??
    res["ID Project"] ??
    res["id_store"] ??
    res["id_Contractor"] ??
    res["id_Conwork"] ??
    res["รหัสพนักงาน"] ??
    res["id_bank"] ??
    res["id_car"] ??
    res["id_cus"] ??
    res["id_Company"] ??
    res["id_product"] ??
    row._sheetRow ??
    res["_sheetRow"];

  const finalId = (canonicalId !== undefined && canonicalId !== null && String(canonicalId).trim() !== "")
    ? canonicalId
    : idx + 1;

  res["id"] = finalId;
  res["_sheetRow"] = finalId;

  return res;
}

export function mapSheetRowToSupabaseRow(tableName: string, row: Record<string, any>): Record<string, any> {
  const dbTable = getDbTableName(tableName);
  const dbRow: Record<string, any> = {};

  if (dbTable === "bills") {
    const rawId = row["ลำดับ"] ?? row.id;
    if (hasValue(rawId)) {
      const numId = Number(rawId);
      if (Number.isFinite(numId)) dbRow.id = numId;
    }

    const rawProjectId = row["ID Project"] ?? row.project_id;
    if (hasValue(rawProjectId)) dbRow.project_id = String(rawProjectId).trim();

    const rawProjectName = row["ชื่อ Project"] ?? row.project_name;
    if (hasValue(rawProjectName)) dbRow.project_name = String(rawProjectName).trim();

    const rawVendor = row["ร้าน/บุคคล"] ?? row.vendor_or_person;
    if (hasValue(rawVendor)) dbRow.vendor_or_person = String(rawVendor).trim();

    const rawDesc = row["สินค้า/ทำงาน"] ?? row.description;
    if (hasValue(rawDesc)) dbRow.description = String(rawDesc).trim();

    const rawBillNo = row["บิล"] ?? row.bill_no;
    if (hasValue(rawBillNo)) dbRow.bill_no = String(rawBillNo).trim();

    const rawCategory = row["ประเภท"] ?? row.category;
    if (hasValue(rawCategory)) dbRow.category = String(rawCategory).trim();

    const rawAmount = row["ยอดเงิน"] ?? row.amount;
    if (hasValue(rawAmount)) dbRow.amount = toNumber(rawAmount);

    const rawVat = row["vat"] ?? row.vat_amount;
    if (row["vat"] !== undefined || row.vat_amount !== undefined) {
      const isVat = isVatActive(rawVat);
      if (isVat) {
        const parsed = parseDeductPercent(rawVat);
        dbRow.vat_amount = parsed > 0 ? parsed : 7;
      } else {
        dbRow.vat_amount = 0;
      }
    }

    const rawDeduct = row["หัก"] ?? row.withholding_tax;
    if (row["หัก"] !== undefined || row.withholding_tax !== undefined) {
      const isDeduct = isDeductActive(rawDeduct);
      if (isDeduct) {
        const rate = parseDeductPercent(rawDeduct);
        dbRow.withholding_tax = rate > 0 ? rate : 3;
        const customDeduct = toNumber(row["จำนวนหัก"] ?? row.deduct_amount ?? row["3เปอร์"] ?? 0);
        dbRow.deduct_amount = customDeduct;
      } else {
        dbRow.withholding_tax = 0;
        dbRow.deduct_amount = 0;
        dbRow.wht_issued_date = null;
      }
    }

    const rawCredit = row["เครดิต"] ?? row.credit_days;
    if (row["เครดิต"] !== undefined || row.credit_days !== undefined) {
      const cDays = parseCreditDays(rawCredit);
      dbRow.credit_days = cDays;
    }

    const rawRequester = row["ผู้เบิก"] ?? row.requester;
    if (hasValue(rawRequester)) dbRow.requester = String(rawRequester).trim();

    const rawCreatedBy = row["ผู้สร้างบิล"] ?? row.created_by ?? row["ผู้บันทึก"];
    if (hasValue(rawCreatedBy)) {
      dbRow.created_by = String(rawCreatedBy).trim();
      dbRow["ผู้สร้างบิล"] = String(rawCreatedBy).trim();
    }

    const rawImage = row["รูปถ่ายบิล"] ?? row.image_url;
    if (hasValue(rawImage)) dbRow.image_url = String(rawImage).trim();

    const rawStatus = row["สถานะ"] ?? row.status;
    if (hasValue(rawStatus)) dbRow.status = String(rawStatus).trim();

    const rawDate = row["ว/ด/ป"] ?? row["วันที่"] ?? row.bill_date;
    if (hasValue(rawDate)) dbRow.bill_date = normalizeDateToIso(rawDate);

    const rawBillReceived = row["วันได้บิล"] ?? row.bill_received_date;
    if (hasValue(rawBillReceived)) {
      const iso = normalizeDateToIso(rawBillReceived) || String(rawBillReceived).trim();
      dbRow.bill_received_date = iso;
      dbRow["วันได้บิล"] = iso;
    }

    const rawWhtIssued = row["วันออก 3%"] ?? row.wht_issued_date;
    if (hasValue(rawWhtIssued)) {
      const iso = normalizeDateToIso(rawWhtIssued) || String(rawWhtIssued).trim();
      dbRow.wht_issued_date = iso;
      dbRow["วันออก 3%"] = iso;
    }

    const rawPaidDate = row["วันจ่าย"] ?? row.paid_date;
    if (hasValue(rawPaidDate)) {
      const iso = normalizeDateToIso(rawPaidDate) || String(rawPaidDate).trim();
      dbRow.paid_date = iso;
      dbRow["วันจ่าย"] = iso;
    }

    if (hasValue(row["ค่าของ"] ?? row.material_cost)) dbRow.material_cost = toNumber(row["ค่าของ"] ?? row.material_cost);
    if (hasValue(row["ค่าแรง"] ?? row.labor_cost)) dbRow.labor_cost = toNumber(row["ค่าแรง"] ?? row.labor_cost);
    if (hasValue(row["พนักงาน"] ?? row.staff_cost)) dbRow.staff_cost = toNumber(row["พนักงาน"] ?? row.staff_cost);
    if (hasValue(row["น้ำมัน"] ?? row.fuel_cost)) dbRow.fuel_cost = toNumber(row["น้ำมัน"] ?? row.fuel_cost);
    if (hasValue(row["ซ่อมรถ"] ?? row.repair_cost)) dbRow.repair_cost = toNumber(row["ซ่อมรถ"] ?? row.repair_cost);
    if (hasValue(row["เครื่องจักร"] ?? row.machine_cost)) dbRow.machine_cost = toNumber(row["เครื่องจักร"] ?? row.machine_cost);
    if (hasValue(row["เครื่องมือ"] ?? row.tool_cost)) dbRow.tool_cost = toNumber(row["เครื่องมือ"] ?? row.tool_cost);
    if (hasValue(row["อื่นๆ"] ?? row.other_cost)) dbRow.other_cost = toNumber(row["อื่นๆ"] ?? row.other_cost);
    if (hasValue(row["statusค่าแรง"] ?? row.labor_status)) dbRow.labor_status = String(row["statusค่าแรง"] ?? row.labor_status).trim();
    if (hasValue(row["ยอดโอน"] ?? row.transfer_amount)) dbRow.transfer_amount = toNumber(row["ยอดโอน"] ?? row.transfer_amount);

    if (hasValue(row["ร้านค้า"] ?? row.store_id)) dbRow.store_id = String(row["ร้านค้า"] ?? row.store_id).trim();
    if (hasValue(row["ผู้รับเหมา"] ?? row.contractor_id)) dbRow.contractor_id = String(row["ผู้รับเหมา"] ?? row.contractor_id).trim();
    if (hasValue(row["ร้านค้า/ผู้รับเหมา"] ?? row.vendor_type)) dbRow.vendor_type = String(row["ร้านค้า/ผู้รับเหมา"] ?? row.vendor_type).trim();
    if (hasValue(row["สินค้า"] ?? row.product)) dbRow.product = String(row["สินค้า"] ?? row.product).trim();
    if (hasValue(row["รายละเอียดงาน"] ?? row.work_details)) dbRow.work_details = String(row["รายละเอียดงาน"] ?? row.work_details).trim();
    if (hasValue(row["รายการ"] ?? row.sub_category)) dbRow.sub_category = String(row["รายการ"] ?? row.sub_category).trim();
    if (hasValue(row["ชื่อพนักงาน"] ?? row.staff_name)) {
      dbRow.staff_name = String(row["ชื่อพนักงาน"] ?? row.staff_name).trim();
      if (!dbRow.data) dbRow.data = {};
      dbRow.data["ชื่อพนักงาน"] = dbRow.staff_name;
    }
    if (row.items !== undefined || row["items"] !== undefined) {
      dbRow.items = row.items ?? row["items"];
    }
  } else if (dbTable === "projects") {
    if (row["ID Project"] !== undefined) dbRow.id = row["ID Project"];
    if (row["ชื่อ Project"] !== undefined) dbRow.name = row["ชื่อ Project"];
    if (row["ชื่อลูกค้า"] !== undefined) dbRow.customer_name = row["ชื่อลูกค้า"];
    if (row["สถานที่"] !== undefined) dbRow.location = row["สถานที่"];
    if (row["ยอดงาน"] !== undefined) dbRow.work_amount = row["ยอดงาน"];
    if (row["งบไม่เกิน"] !== undefined) dbRow.budget = row["งบไม่เกิน"];
    if (row["ยอดรวม vat"] !== undefined) dbRow.vat_total = row["ยอดรวม vat"];
    if (row["วันที่"] !== undefined) dbRow.start_date = row["วันที่"] || null;
    if (row["color"] !== undefined) dbRow.color = row["color"];
    if (row["บริษัท"] !== undefined) dbRow.company = row["บริษัท"];
    if (row["รับผิดชอบ"] !== undefined) dbRow.responsible_person = row["รับผิดชอบ"];

    // Preserve dynamic budget allocation fields into data JSONB
    const projectData = (row.data && typeof row.data === "object") ? { ...row.data } : {};
    Object.entries(row).forEach(([k, v]) => {
      if (
        !k.startsWith("_") &&
        !["ID Project", "ชื่อ Project", "ชื่อลูกค้า", "สถานที่", "ยอดงาน", "งบไม่เกิน", "ยอดรวม vat", "วันที่", "color", "บริษัท", "รับผิดชอบ", "id", "name", "customer_name", "location", "work_amount", "budget", "vat_total", "start_date", "company", "responsible_person", "created_at", "data"].includes(k)
      ) {
        projectData[k] = v;
      }
    });
    dbRow.data = projectData;
  } else if (dbTable === "stores") {
    if (row["id_store"] !== undefined || row["id"] !== undefined) {
      dbRow.id = row["id_store"] ?? row["id"];
    }
    if (row["ชื่อร้านค้า"] !== undefined) dbRow.name = row["ชื่อร้านค้า"];
    if (row["ชื่อเต็ม"] !== undefined) dbRow.full_name = row["ชื่อเต็ม"];
    if (row["เลขบัญชี"] !== undefined) dbRow.bank_account = row["เลขบัญชี"];
    if (row["ธนาคาร"] !== undefined) dbRow.bank_name = row["ธนาคาร"];
    if (row["เบอร์โทร"] !== undefined) dbRow.phone = row["เบอร์โทร"];
    if (row["ที่อยู่"] !== undefined) dbRow.address = row["ที่อยู่"];
    if (row["เลขที่ผู้เสียภาษี"] !== undefined) dbRow.tax_id = row["เลขที่ผู้เสียภาษี"];
  } else if (dbTable === "contractors") {
    if (row["id_Contractor"] !== undefined || row["id"] !== undefined) {
      dbRow.id = row["id_Contractor"] ?? row["id"];
    }
    if (row["ชื่อเล่น"] !== undefined) dbRow.nickname = row["ชื่อเล่น"];
    if (row["ชื่อ-นามสกุล"] !== undefined) dbRow.full_name = row["ชื่อ-นามสกุล"];
    if (row["เลขบัญชี"] !== undefined) dbRow.bank_account = row["เลขบัญชี"];
    if (row["ธนาคาร"] !== undefined) dbRow.bank_name = row["ธนาคาร"];
    if (row["บัตรประจำตัวประชาชน"] !== undefined) dbRow.id_card = row["บัตรประจำตัวประชาชน"];
    if (row["เบอร์โทรศัพท์"] !== undefined) dbRow.phone = row["เบอร์โทรศัพท์"];
    if (row["ที่อยู่"] !== undefined) dbRow.address = row["ที่อยู่"];
    if (row["จำกัดยอด/ปี"] !== undefined) dbRow.annual_limit = row["จำกัดยอด/ปี"];
    if (row["ประเภท"] !== undefined || row["contractor_type"] !== undefined) {
      const typeVal = row["ประเภท"] ?? row["contractor_type"];
      if (!dbRow.data) dbRow.data = {};
      dbRow.data["ประเภท"] = typeVal;
      dbRow.data["contractor_type"] = typeVal;
    }
  } else if (dbTable === "banks") {
    if (row["id_bank"] !== undefined || row["id"] !== undefined) {
      dbRow.id = row["id_bank"] ?? row["id"];
    }
    if (row["ชื่อธนาคาร"] !== undefined) dbRow.name = row["ชื่อธนาคาร"];
    if (row["image"] !== undefined || row["รูปภาพ"] !== undefined || row["image_url"] !== undefined) {
      dbRow.image = row["image"] ?? row["รูปภาพ"] ?? row["image_url"];
    }
  } else if (dbTable === "cars") {
    if (row["id_car"] !== undefined || row["id"] !== undefined) {
      dbRow.id = row["id_car"] ?? row["id"];
    }
    if (row["หมายเลขทะเบียน"] !== undefined) dbRow.plate_no = row["หมายเลขทะเบียน"];
    if (row["ยี่ห้อรถ"] !== undefined) dbRow.brand = row["ยี่ห้อรถ"];
    if (row["สี"] !== undefined) dbRow.color = row["สี"];
    if (row["รับผิดชอบ"] !== undefined) dbRow.responsible_person = row["รับผิดชอบ"];
    if (row["รถของ"] !== undefined) dbRow.owner = row["รถของ"];
  } else if (dbTable === "customers") {
    if (row["id_cus"] !== undefined || row["id"] !== undefined) {
      dbRow.id = row["id_cus"] ?? row["id"];
    }
    if (row["ชื่อลูกค้า"] !== undefined) dbRow.name = row["ชื่อลูกค้า"];
    if (row["ที่อยู่"] !== undefined) dbRow.address = row["ที่อยู่"];
    if (row["เลขที่ผู้เสียภาษี"] !== undefined) dbRow.tax_id = row["เลขที่ผู้เสียภาษี"];
  } else if (dbTable === "companies") {
    if (row["id_Company"] !== undefined || row["id"] !== undefined) {
      dbRow.id = row["id_Company"] ?? row["id"];
    }
    if (row["ชื่ออังกฤษ"] !== undefined) dbRow.name_en = row["ชื่ออังกฤษ"];
    if (row["ชื่อบริษัท"] !== undefined) dbRow.name_th = row["ชื่อบริษัท"];
    if (row["สำนักงาน"] !== undefined) dbRow.branch = row["สำนักงาน"];
    if (row["ที่อยู่"] !== undefined) dbRow.address = row["ที่อยู่"];
    if (row["เลขที่สียภาษี "] !== undefined || row["เลขที่ผู้เสียภาษี"] !== undefined) dbRow.tax_id = row["เลขที่สียภาษี "] ?? row["เลขที่ผู้เสียภาษี"];
    if (row["เบอร์โทร"] !== undefined) dbRow.phone = row["เบอร์โทร"];
  } else if (dbTable === "master_members") {
    if (row["รหัสพนักงาน"] !== undefined && String(row["รหัสพนักงาน"]).trim() !== "") {
      dbRow.id = String(row["รหัสพนักงาน"]).trim();
    } else if (row["id"] !== undefined && String(row["id"]).trim() !== "") {
      dbRow.id = String(row["id"]).trim();
    }
    if (row["ชื่อเล่น"] !== undefined) dbRow.nickname = row["ชื่อเล่น"];
    if (row["ชื่อ-นามสกุล"] !== undefined) dbRow.full_name = row["ชื่อ-นามสกุล"];
    if (row["เลขบัญชี"] !== undefined) dbRow.bank_account = row["เลขบัญชี"];
    if (row["ธนาคาร"] !== undefined) dbRow.bank_name = row["ธนาคาร"];
    if (row["เบอร์โทร"] !== undefined) dbRow.phone = row["เบอร์โทร"];
    if (row["ที่อยู่"] !== undefined) dbRow.address = row["ที่อยู่"];
    if (row["เลขที่บัตรประชาชน"] !== undefined) dbRow.id_card = row["เลขที่บัตรประชาชน"];
    if (row["สิทธิ์การใช้งาน"] !== undefined) {
      const permStr = String(row["สิทธิ์การใช้งาน"] || "");
      const hasOwner = permStr.includes("Owner") || permStr.includes("เจ้าของระบบ");
      const hasApprover = permStr.includes("Approver") || permStr.includes("อนุมัติบิล");
      const hasFinance = permStr.includes("Finance") || permStr.includes("ฝ่ายการเงิน") || permStr.includes("ปิดบิล");
      const hasDelete = permStr.includes("Delete") || permStr.includes("ลบข้อมูล");
      const hasAdmin = permStr.includes("Admin") || hasOwner;

      dbRow.is_owner = hasOwner;
      dbRow.can_close_bill = hasApprover;
      dbRow.can_approve = hasFinance;
      dbRow.can_delete = hasDelete;

      dbRow.role = (hasAdmin || hasOwner || hasApprover || hasFinance || hasDelete) ? "Admin" : "User";
      dbRow.system_role = hasFinance ? "Admin_Closer" : hasApprover ? "Admin_Approver" : hasAdmin ? "Admin" : "User";
    } else {
      if (row["เจ้าของระบบ"] !== undefined || row["is_owner"] !== undefined) {
        dbRow.is_owner = Boolean(row["เจ้าของระบบ"] ?? row["is_owner"]);
      }
      if (row["ฝ่ายการเงิน"] !== undefined || row["can_approve"] !== undefined) {
        dbRow.can_approve = Boolean(row["ฝ่ายการเงิน"] ?? row["can_approve"]);
      }
      if (row["อนุมัติบิล"] !== undefined || row["can_close_bill"] !== undefined) {
        dbRow.can_close_bill = Boolean(row["อนุมัติบิล"] ?? row["can_close_bill"]);
      }
      if (row["สิทธิ์ลบข้อมูล"] !== undefined || row["can_delete"] !== undefined) {
        dbRow.can_delete = Boolean(row["สิทธิ์ลบข้อมูล"] ?? row["can_delete"]);
      }
    }
    if (row["LINE User ID"] !== undefined || row["LINE"] !== undefined || row["line_user_id"] !== undefined || row["Line"] !== undefined || row["line"] !== undefined) {
      const lineVal = row["LINE User ID"] !== undefined
        ? String(row["LINE User ID"] ?? "").trim()
        : row["LINE"] !== undefined
          ? String(row["LINE"] ?? "").trim()
          : row["line_user_id"] !== undefined
            ? String(row["line_user_id"] ?? "").trim()
            : String(row["Line"] ?? row["line"] ?? "").trim();
      dbRow.line_user_id = lineVal;
    }
    if (row["สถานะ"] !== undefined || row["status"] !== undefined) {
      dbRow.status = row["สถานะ"] ?? row["status"];
    }
    if (row["pictureUrl"] !== undefined || row["pictureurl"] !== undefined) {
      dbRow.pictureurl = row["pictureUrl"] ?? row["pictureurl"];
    }
    const rawData = (row.data && typeof row.data === "object") ? row.data : {};
    dbRow.data = {
      ...rawData,
      can_close_bill: dbRow.can_close_bill ?? rawData.can_close_bill ?? false,
      can_approve: dbRow.can_approve ?? rawData.can_approve ?? false,
      is_owner: dbRow.is_owner ?? rawData.is_owner ?? false,
      can_delete: dbRow.can_delete ?? rawData.can_delete ?? false,
      system_role: dbRow.system_role || rawData.system_role || "User",
      role: dbRow.role || rawData.role || "User",
      "อนุมัติบิล": dbRow.can_close_bill ?? rawData.can_close_bill ?? false,
      "ฝ่ายการเงิน": dbRow.can_approve ?? rawData.can_approve ?? false,
      "เจ้าของระบบ": dbRow.is_owner ?? rawData.is_owner ?? false,
      "สิทธิ์ลบข้อมูล": dbRow.can_delete ?? rawData.can_delete ?? false,
      "สิทธิ์การใช้งาน": row["สิทธิ์การใช้งาน"] ?? rawData["สิทธิ์การใช้งาน"] ?? "",
      "LINE User ID": dbRow.line_user_id !== undefined ? dbRow.line_user_id : (rawData["LINE User ID"] ?? rawData.line_user_id ?? ""),
      line_user_id: dbRow.line_user_id !== undefined ? dbRow.line_user_id : (rawData.line_user_id ?? rawData["LINE User ID"] ?? ""),
      LINE: dbRow.line_user_id !== undefined ? dbRow.line_user_id : (rawData.line_user_id ?? rawData["LINE User ID"] ?? "")
    };
  } else if (dbTable === "contract_works") {
    if (row["id_Conwork"] !== undefined || row["id"] !== undefined) {
      dbRow.id = row["id_Conwork"] ?? row["id"];
    }
    if (row["id_Contractor"] !== undefined) dbRow.contractor_id = row["id_Contractor"];
    if (row["ID Project"] !== undefined) dbRow.project_id = row["ID Project"];
    if (row["ชื่อ Project"] !== undefined) dbRow.project_name = row["ชื่อ Project"];
    if (row["ยอดเงินจ้าง"] !== undefined) dbRow.total_contract_amount = row["ยอดเงินจ้าง"];
    if (row["รายละเอียดงาน"] !== undefined) dbRow.work_details = row["รายละเอียดงาน"];
    if (row["เบอร์โทรศัพท์"] !== undefined) dbRow.phone = row["เบอร์โทรศัพท์"];
    if (row["ยอดเงินจ่าย"] !== undefined) dbRow.paid_amount = row["ยอดเงินจ่าย"];
    if (row["วันที่"] !== undefined || row["work_date"] !== undefined || row["date"] !== undefined || row["contract_date"] !== undefined) {
      dbRow.work_date = row["วันที่"] ?? row["work_date"] ?? row["date"] ?? row["contract_date"];
    }
  } else if (dbTable === "loans") {
    if (row["id"] !== undefined) dbRow.id = row["id"];
    if (row["ชื่อ"] !== undefined) dbRow.borrower_name = row["ชื่อ"];
    if (row["type"] !== undefined) dbRow.type = row["type"];
    if (row["จำนวนเงิน"] !== undefined) dbRow.amount = row["จำนวนเงิน"];
  } else if (dbTable === "categories") {
    if (row["id"] !== undefined) dbRow.id = row["id"];
    if (row["ประเภท Name1"] !== undefined) dbRow.name1 = row["ประเภท Name1"];
    if (row["ประเภท Name2"] !== undefined) dbRow.name2 = row["ประเภท Name2"];
    if (row["ประเภท Name3"] !== undefined) dbRow.name3 = row["ประเภท Name3"];
  } else if (dbTable === "tasks") {
    if (row["id"] !== undefined || row["ลำดับ"] !== undefined) {
      const parsedId = Number(row["id"] ?? row["ลำดับ"]);
      if (Number.isFinite(parsedId) && parsedId > 0) dbRow.id = parsedId;
    }
    if (row["รายการ"] !== undefined || row["title"] !== undefined || row["รายละเอียด"] !== undefined) {
      dbRow.title = String(row["รายการ"] ?? row["title"] ?? row["รายละเอียด"] ?? "").trim();
    }
    if (row["ดู/ทำ"] !== undefined || row["วันที่ดู/ทำ"] !== undefined || row["do_date"] !== undefined) {
      const d = row["วันที่ดู/ทำ"] ?? row["ดู/ทำ"] ?? row["do_date"];
      dbRow.do_date = (d && d !== "-") ? (normalizeDateToIso(d) || null) : null;
    }
    if (row["ส่งงาน"] !== undefined || row["วันที่ส่งงาน"] !== undefined || row["send_date"] !== undefined) {
      const d = row["วันที่ส่งงาน"] ?? row["ส่งงาน"] ?? row["send_date"];
      dbRow.send_date = (d && d !== "-") ? (normalizeDateToIso(d) || null) : null;
    }
    if (row["รหัสพนักงาน"] !== undefined || row["assignee_id"] !== undefined) {
      dbRow.assignee_id = String(row["รหัสพนักงาน"] ?? row["assignee_id"] ?? "").trim() || null;
    }
    if (row["ผู้รับมอบหมาย"] !== undefined || row["ผู้รับผิดชอบ"] !== undefined || row["assignee_name"] !== undefined || row["ชื่อเล่น"] !== undefined) {
      dbRow.assignee_name = String(row["ผู้รับมอบหมาย"] ?? row["ผู้รับผิดชอบ"] ?? row["assignee_name"] ?? row["ชื่อเล่น"] ?? "").trim();
    }
    if (row["ประเภท"] !== undefined || row["task_type"] !== undefined) {
      const rawType = String(row["ประเภท"] ?? row["task_type"] ?? "1").trim();
      const typeNum = parseInt(rawType.replace(/\D/g, "") || "1", 10);
      dbRow.task_type = (typeNum === 2 || typeNum === 3) ? typeNum : 1;
    }
    if (row["สถานะ"] !== undefined || row["status"] !== undefined) {
      dbRow.status = String(row["สถานะ"] ?? row["status"] ?? "ดำเนินการ").trim();
    }
  } else if (dbTable === "works") {
    if (row["id"] !== undefined || row["ลำดับ"] !== undefined) {
      const parsedId = Number(row["id"] ?? row["ลำดับ"]);
      if (Number.isFinite(parsedId) && parsedId > 0) dbRow.id = parsedId;
    }
    if (row["ทีม"] !== undefined || row["team"] !== undefined) {
      dbRow.team = String(row["ทีม"] ?? row["team"] ?? "PW").trim();
    }
    if (row["กิจกรรม"] !== undefined || row["activity_type"] !== undefined) {
      dbRow.activity_type = String(row["กิจกรรม"] ?? row["activity_type"] ?? "เสนอราคา").trim();
    }
    if (row["เรื่อง"] !== undefined || row["title"] !== undefined) {
      dbRow.title = String(row["เรื่อง"] ?? row["title"] ?? "").trim();
    }
    if (row["PR"] !== undefined || row["pr_no"] !== undefined) {
      dbRow.pr_no = String(row["PR"] ?? row["pr_no"] ?? "-").trim();
    }
    if (row["สถานที่"] !== undefined || row["location"] !== undefined) {
      dbRow.location = String(row["สถานที่"] ?? row["location"] ?? "-").trim();
    }
    if (row["นัดดู"] !== undefined || row["date_inspect"] !== undefined) {
      dbRow.date_inspect = String(row["นัดดู"] ?? row["date_inspect"] ?? "-").trim();
    }
    if (row["นัดเสนอ"] !== undefined || row["date_propose"] !== undefined) {
      dbRow.date_propose = String(row["นัดเสนอ"] ?? row["date_propose"] ?? "-").trim();
    }
    if (row["ติดต่อ1"] !== undefined || row["contact1"] !== undefined) {
      dbRow.contact1 = String(row["ติดต่อ1"] ?? row["contact1"] ?? "-").trim();
    }
    if (row["เบอร์1"] !== undefined || row["phone1"] !== undefined) {
      dbRow.phone1 = String(row["เบอร์1"] ?? row["phone1"] ?? "-").trim();
    }
    if (row["ติดต่อ2"] !== undefined || row["contact2"] !== undefined) {
      dbRow.contact2 = String(row["ติดต่อ2"] ?? row["contact2"] ?? "-").trim();
    }
    if (row["เบอร์2"] !== undefined || row["phone2"] !== undefined) {
      dbRow.phone2 = String(row["เบอร์2"] ?? row["phone2"] ?? "-").trim();
    }
    if (row["บริษัท"] !== undefined || row["company"] !== undefined) {
      dbRow.company = String(row["บริษัท"] ?? row["company"] ?? "-").trim();
    }
    if (row["สถานะ"] !== undefined || row["status"] !== undefined) {
      dbRow.status = String(row["สถานะ"] ?? row["status"] ?? "รอดูงาน").trim();
    }
    if (row["หมายเหตุ"] !== undefined || row["note"] !== undefined) {
      dbRow.note = String(row["หมายเหตุ"] ?? row["note"] ?? "").trim();
    }
  } else if (dbTable === "plans") {
    if (row["id"] !== undefined || row["ลำดับ"] !== undefined) {
      const parsedId = Number(row["id"] ?? row["ลำดับ"]);
      if (Number.isFinite(parsedId) && parsedId > 0) dbRow.id = parsedId;
    }
    if (row["รหัสงาน"] !== undefined || row["project_code"] !== undefined) {
      dbRow.project_code = String(row["รหัสงาน"] ?? row["project_code"] ?? "").trim();
    }
    if (row["ชื่อแผนงาน"] !== undefined || row["job_name"] !== undefined) {
      dbRow.job_name = String(row["ชื่อแผนงาน"] ?? row["job_name"] ?? "").trim();
    }
    if (row["รายการ"] !== undefined || row["item_name"] !== undefined) {
      dbRow.item_name = String(row["รายการ"] ?? row["item_name"] ?? "").trim();
    }
    if (row["วันที่เริ่ม"] !== undefined || row["start_date"] !== undefined) {
      const d = row["วันที่เริ่ม"] ?? row["start_date"];
      dbRow.start_date = d ? (normalizeDateToIso(d) || null) : null;
    }
    if (row["วันที่จบ"] !== undefined || row["end_date"] !== undefined) {
      const d = row["วันที่จบ"] ?? row["end_date"];
      dbRow.end_date = d ? (normalizeDateToIso(d) || null) : null;
    }
    if (row["จำนวนวัน"] !== undefined || row["days_count"] !== undefined) {
      dbRow.days_count = toNumber(row["จำนวนวัน"] ?? row["days_count"]);
    }
    if (row["%แผน"] !== undefined || row["plan_percentage"] !== undefined) {
      dbRow.plan_percentage = toNumber(row["%แผน"] ?? row["plan_percentage"]);
    }
    if (row["actual"] !== undefined || row["actual_percentage"] !== undefined) {
      dbRow.actual_percentage = toNumber(row["actual"] ?? row["actual_percentage"]);
    }
    if (row["สถานะ"] !== undefined || row["status"] !== undefined) {
      dbRow.status = String(row["สถานะ"] ?? row["status"] ?? "Open").trim();
    }
  } else {
    Object.entries(row).forEach(([k, v]) => {
      if (!k.startsWith("_")) dbRow[k] = v;
    });
  }

  return dbRow;
}

export async function saveEntityBankOption(entityId: string, bankVal: string) {
  if (!isSupabaseConfigured() || !entityId || !bankVal) return;
  try {
    const { data } = await supabaseAdmin.from("system_options").select("*").eq("id", "entity_banks").maybeSingle();
    const existingMap = (data?.data && typeof data.data === "object") ? { ...data.data } : {};
    existingMap[String(entityId).trim()] = String(bankVal).trim();
    await supabaseAdmin.from("system_options").upsert({
      id: "entity_banks",
      data: existingMap,
      updated_at: new Date().toISOString()
    });
    clearCache("sys_opt:entity_banks");
    clearCache("sys_opt:all");
  } catch (e) {
    console.warn("Failed to persist entity bank in system_options:", e);
  }
}

export async function saveEntityBanksBatch(bankMap: Record<string, string>) {
  if (!isSupabaseConfigured() || !Object.keys(bankMap).length) return;
  try {
    const { data } = await supabaseAdmin.from("system_options").select("*").eq("id", "entity_banks").maybeSingle();
    const existing = (data?.data && typeof data.data === "object") ? { ...data.data } : {};
    for (const [k, v] of Object.entries(bankMap)) {
      if (k && v) existing[String(k).trim()] = String(v).trim();
    }
    await supabaseAdmin.from("system_options").upsert({
      id: "entity_banks",
      data: existing,
      updated_at: new Date().toISOString()
    });
    clearCache("sys_opt:entity_banks");
    clearCache("sys_opt:all");
  } catch (e) {
    console.warn("Failed to persist entity banks batch in system_options:", e);
  }
}

export async function getEntityBankMapFromSupabase(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};
  return cached("sys_opt:entity_banks", 300_000, async () => {
    try {
      const { data } = await supabaseAdmin.from("system_options").select("*").eq("id", "entity_banks").maybeSingle();
      return (data?.data && typeof data.data === "object") ? data.data : {};
    } catch (e) {
      return {};
    }
  });
}

export async function getNextBillSequence(customStart?: number): Promise<number> {
  if (!isSupabaseConfigured()) return 1;

  let startSeq = customStart;
  if (startSeq === undefined || startSeq <= 0) {
    try {
      const options = await getSystemOptionsFromSupabase();
      startSeq = Number((options as any)?.bill_start_sequence || (options as any)?.["ลำดับบิลเริ่มต้น"] || 1);
    } catch {
      startSeq = 1;
    }
  }
  if (!Number.isFinite(startSeq) || startSeq < 1) startSeq = 1;

  try {
    // 1. Check if startSeq is available directly
    const { data: exactMatch } = await supabaseAdmin
      .from("bills")
      .select("id")
      .eq("id", startSeq)
      .maybeSingle();

    if (!exactMatch) {
      return startSeq;
    }

    // 2. If startSeq exists, find the lowest unused sequence >= startSeq
    const { data: existingRows } = await supabaseAdmin
      .from("bills")
      .select("id")
      .gte("id", startSeq)
      .order("id", { ascending: true })
      .limit(2000);

    if (!existingRows || existingRows.length === 0) {
      return startSeq;
    }

    const takenSet = new Set(existingRows.map(r => Number(r.id)));
    let candidate = startSeq;
    while (takenSet.has(candidate)) {
      candidate++;
    }

    return candidate;
  } catch (e) {
    console.warn("Error calculating next bill sequence:", e);
    return startSeq || 1;
  }
}

export async function saveBillFollowDate(billId: string, patch: Record<string, any>) {
  if (!isSupabaseConfigured() || !billId) return;
  const followKeys = [
    "ลำดับ", "ลำดับtest",
    "วันได้บิล", "วันออก 3%", "วันจ่าย", "vat", "หัก", "จำนวนหัก", "3เปอร์", "3เปอร์เซ็น", "เครดิต", "ยอดโอน",
    "รายการ", "ชื่อเครื่องมือ", "ทะเบียน", "ชื่อพนักงาน", "statusค่าแรง",
    "ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ",
    "ผู้สร้างบิล", "ผู้บันทึก", "สินค้า", "รายละเอียดงาน", "ค่าแรงคงเหลือ"
  ];
  const datesToSave: Record<string, any> = {};
  for (const k of followKeys) {
    if (patch[k] !== undefined && patch[k] !== null) {
      datesToSave[k] = patch[k];
    }
  }

  // If deduction is inactive or explicitly removed, ensure all tax keys in follow dates are cleared
  const checkDeduct = patch["หัก"] !== undefined ? patch["หัก"] : patch.withholding_tax;
  if (checkDeduct !== undefined && !isDeductActive(checkDeduct)) {
    datesToSave["หัก"] = "";
    datesToSave["จำนวนหัก"] = "";
    datesToSave["3เปอร์"] = "";
    datesToSave["3เปอร์เซ็น"] = "";
    datesToSave["วันออก 3%"] = "";
  }

  const checkVat = patch["vat"] !== undefined ? patch["vat"] : patch.vat_amount;
  if (checkVat !== undefined && !isVatActive(checkVat)) {
    datesToSave["vat"] = "";
  }

  if (!Object.keys(datesToSave).length) return;

  try {
    const { data } = await supabaseAdmin.from("system_options").select("*").eq("id", "bill_follow_dates").maybeSingle();
    const existingMap = (data?.data && typeof data.data === "object") ? { ...data.data } : {};
    
    const mainKey = String(billId).trim();
    if (mainKey) {
      existingMap[mainKey] = {
        ...(existingMap[mainKey] || {}),
        ...datesToSave
      };
    }

    const altSeq = String(patch["ลำดับ"] || patch.id || patch._sheetRow || "").trim();
    if (altSeq && altSeq !== mainKey) {
      existingMap[altSeq] = {
        ...(existingMap[altSeq] || {}),
        ...datesToSave
      };
    }

    await supabaseAdmin.from("system_options").upsert({
      id: "bill_follow_dates",
      data: existingMap,
      updated_at: new Date().toISOString()
    });
    clearCache("sys_opt:bill_follow_dates");
    clearCache("sys_opt:all");
  } catch (e) {
    console.warn("Failed to persist bill follow dates in system_options:", e);
  }
}

export async function getBillFollowDatesFromSupabase(): Promise<Record<string, Record<string, string>>> {
  if (!isSupabaseConfigured()) return {};
  return cached("sys_opt:bill_follow_dates", 180_000, async () => {
    try {
      const { data } = await supabaseAdmin.from("system_options").select("*").eq("id", "bill_follow_dates").maybeSingle();
      return (data?.data && typeof data.data === "object") ? data.data : {};
    } catch {
      return {};
    }
  });
}

export async function saveProjectBudgetAllocation(projectId: string, patch: Record<string, any>) {
  if (!isSupabaseConfigured() || !projectId) return;
  const budgetKeys = Object.keys(patch).filter(k => k.startsWith("งบไม่เกิน") || k === "คุมงบประเภทงาน");
  if (!budgetKeys.length) return;

  try {
    const { data } = await supabaseAdmin.from("system_options").select("*").eq("id", "project_budget_allocations").maybeSingle();
    const existingMap = (data?.data && typeof data.data === "object") ? { ...data.data } : {};

    const mainKey = String(projectId).trim();
    const currentBudgets = existingMap[mainKey] && typeof existingMap[mainKey] === "object" ? { ...existingMap[mainKey] } : {};

    for (const k of budgetKeys) {
      if (patch[k] !== undefined) {
        currentBudgets[k] = patch[k];
      }
    }
    existingMap[mainKey] = currentBudgets;

    const altKey = String(patch["ID Project"] || patch.id || "").trim();
    if (altKey && altKey !== mainKey) {
      existingMap[altKey] = currentBudgets;
    }

    await supabaseAdmin.from("system_options").upsert({
      id: "project_budget_allocations",
      data: existingMap,
      updated_at: new Date().toISOString()
    });
    clearCache("sys_opt:project_budget_allocations");
    clearCache("sys_opt:all");
  } catch (e) {
    console.warn("Failed to persist project budget allocations in system_options:", e);
  }
}

export async function getProjectBudgetAllocationsFromSupabase(): Promise<Record<string, Record<string, any>>> {
  if (!isSupabaseConfigured()) return {};
  return cached("sys_opt:project_budget_allocations", 180_000, async () => {
    try {
      const { data } = await supabaseAdmin.from("system_options").select("*").eq("id", "project_budget_allocations").maybeSingle();
      return (data?.data && typeof data.data === "object") ? data.data : {};
    } catch {
      return {};
    }
  });
}

export async function updateRowInSupabase(tableName: string, keyColumn: string, keyValue: any, patch: Record<string, any>) {
  if (!isSupabaseConfigured()) return null;

  const dbTable = getDbTableName(tableName);
  const dbPatch = mapSheetRowToSupabaseRow(tableName, patch);
  delete dbPatch._sheetRow;

  // Determine the true Supabase primary key ID:
  // For master entities, prioritize the entity code (e.g. CT362, PT105, ST101, etc.) over numeric sheetRow numbers
  const entityCode = patch["รหัสพนักงาน"] ??
    patch["id_Contractor"] ??
    patch["id_store"] ??
    patch["id_bank"] ??
    patch["id_car"] ??
    patch["id_cus"] ??
    patch["id_Company"] ??
    patch["id_Conwork"] ??
    patch["ID Project"] ??
    (keyColumn !== "id" && keyColumn !== "_sheetRow" ? patch[keyColumn] : undefined) ??
    patch.id;

  // For auto-increment tables (bills, tasks, loans), prevent updating primary key id
  if (dbTable === "bills" || dbTable === "tasks" || dbTable === "loans") {
    delete dbPatch.id;
  } else if (entityCode !== undefined && entityCode !== null && String(entityCode).trim() !== "") {
    // For entity master tables (like master_members), allow updating the ID (e.g. employee code)
    dbPatch.id = String(entityCode).trim();
  }

  // The primary target is the existing record's original ID (keyValue)
  let primaryVal: any = keyValue;
  if (primaryVal === undefined || primaryVal === null || String(primaryVal).trim() === "" || String(primaryVal) === "0") {
    primaryVal = entityCode;
  }

  const numId = Number(primaryVal);
  if (Number.isFinite(numId) && String(primaryVal).trim() !== "" && (dbTable === "bills" || dbTable === "tasks" || dbTable === "loans")) {
    primaryVal = numId;
  } else if (typeof primaryVal === "string") {
    primaryVal = primaryVal.trim();
  }

  const patchKeys = Object.keys(patch).filter(k => !k.startsWith("_") && k !== "id");
  const isStatusOnly = patchKeys.length > 0 && patchKeys.every(k => ["สถานะ", "status"].includes(k));

  if (!isStatusOnly) {
    const bankVal = patch["ธนาคาร"] || patch["bank_name"];
    const sideTasks: Promise<any>[] = [];

    if (bankVal && primaryVal) {
      sideTasks.push(saveEntityBankOption(String(primaryVal), String(bankVal)));
    }

    if (dbTable === "bills" || tableName === "Data" || tableName === "bills" || tableName === "DATA") {
      const targetBillId = String(patch["ลำดับ"] ?? patch.id ?? primaryVal ?? keyValue);
      if (targetBillId) {
        sideTasks.push(saveBillFollowDate(targetBillId, patch));
      }
    }

    if (dbTable === "projects" || tableName === "Project" || tableName === "PROJECT") {
      const targetProjId = String(patch["ID Project"] ?? patch.id ?? primaryVal ?? keyValue);
      sideTasks.push(saveProjectBudgetAllocation(targetProjId, patch));
    }

    sideTasks.push(syncCustomOptionsFromRow(patch));

    // Run side-effects concurrently without blocking
    Promise.all(sideTasks).catch(() => undefined);

    try {
      const { data: currentRecord } = await supabaseAdmin.from(dbTable).select("data").eq("id", primaryVal).maybeSingle();
      const existingData = cleanDataPayload(currentRecord?.data);
      const incomingPatch = cleanDataPayload(patch);
      const existingDbPatchData = cleanDataPayload(dbPatch.data);
      
      const mergedData = cleanDataPayload({ ...existingData, ...existingDbPatchData, ...incomingPatch });
      delete mergedData.data;
      dbPatch.data = mergedData;

      if (dbTable === "bills") {
        const checkDeductVal = patch["หัก"] !== undefined 
          ? patch["หัก"] 
          : (dbPatch.withholding_tax !== undefined 
              ? dbPatch.withholding_tax 
              : (mergedData["หัก"] ?? patch["3เปอร์"] ?? patch["จำนวนหัก"]));
        const isDeduct = isDeductActive(checkDeductVal);
        if (!isDeduct) {
          dbPatch.withholding_tax = 0;
          dbPatch.deduct_amount = 0;
          dbPatch.wht_issued_date = null;
          dbPatch.data["หัก"] = "";
          dbPatch.data["จำนวนหัก"] = "";
          dbPatch.data["3เปอร์"] = "";
          dbPatch.data["3เปอร์เซ็น"] = "";
          dbPatch.data["วันออก 3%"] = "";
          dbPatch.data.withholding_tax = 0;
          dbPatch.data.deduct_amount = 0;
        } else {
          if (dbPatch.withholding_tax === undefined) {
            dbPatch.withholding_tax = parseDeductPercent(checkDeductVal);
          }
        }
        const checkVatVal = patch["vat"] !== undefined ? patch["vat"] : (dbPatch.vat_amount !== undefined ? dbPatch.vat_amount : mergedData["vat"]);
        const isVat = isVatActive(checkVatVal);
        if (!isVat) {
          dbPatch.vat_amount = 0;
          dbPatch.data["vat"] = "";
          dbPatch.data.vat_amount = 0;
        }
      }
      if (dbTable === "master_members" && dbPatch.line_user_id !== undefined) {
        dbPatch.data.line_user_id = dbPatch.line_user_id;
        dbPatch.data["LINE User ID"] = dbPatch.line_user_id;
        dbPatch.data["LINE"] = dbPatch.line_user_id;
      }
    } catch {
      const incomingPatch = cleanDataPayload(patch);
      const existingDbPatchData = cleanDataPayload(dbPatch.data);
      const mergedData = cleanDataPayload({ ...existingDbPatchData, ...incomingPatch });
      delete mergedData.data;
      dbPatch.data = mergedData;

      if (dbTable === "bills") {
        const checkDeductVal = patch["หัก"] !== undefined ? patch["หัก"] : dbPatch.withholding_tax;
        const isDeduct = isDeductActive(checkDeductVal);
        if (!isDeduct) {
          dbPatch.withholding_tax = 0;
          dbPatch.deduct_amount = 0;
          dbPatch.wht_issued_date = null;
          dbPatch.data["หัก"] = "";
          dbPatch.data["จำนวนหัก"] = "";
          dbPatch.data["3เปอร์"] = "";
          dbPatch.data["3เปอร์เซ็น"] = "";
          dbPatch.data["วันออก 3%"] = "";
          dbPatch.data.withholding_tax = 0;
          dbPatch.data.deduct_amount = 0;
        }
      }
      if (dbTable === "master_members" && dbPatch.line_user_id !== undefined) {
        dbPatch.data.line_user_id = dbPatch.line_user_id;
        dbPatch.data["LINE User ID"] = dbPatch.line_user_id;
        dbPatch.data["LINE"] = dbPatch.line_user_id;
      }
    }
  }

  try {
    console.log(`[Supabase UPDATE] table: "${dbTable}", id: "${primaryVal}", payload:`, JSON.stringify(dbPatch));
    let res = await supabaseAdmin
      .from(dbTable)
      .update(dbPatch)
      .eq("id", primaryVal)
      .select();

    // Fallback: If 0 rows updated and entityCode is available and different, try entityCode
    if ((res.error || !res.data || res.data.length === 0) && entityCode && String(entityCode).trim() !== String(primaryVal).trim()) {
      res = await supabaseAdmin
        .from(dbTable)
        .update(dbPatch)
        .eq("id", String(entityCode).trim())
        .select();
    }

    if ((res.error || !res.data || res.data.length === 0) && typeof primaryVal === "number") {
      const resStr = await supabaseAdmin
        .from(dbTable)
        .update(dbPatch)
        .eq("id", String(primaryVal))
        .select();
      if (!resStr.error && resStr.data && resStr.data.length > 0) {
        res = resStr;
      }
    }

    let retries = 0;
    while (res.error && retries < 10) {
      retries++;
      if (res.error.message.includes("ALWAYS AS IDENTITY") || res.error.message.includes("identity") || res.error.message.includes("DEFAULT")) {
        delete dbPatch.id;
        res = await supabaseAdmin.from(dbTable).update(dbPatch).eq("id", primaryVal).select();
        continue;
      }
      if (res.error.message.includes("invalid input syntax")) {
        Object.keys(dbPatch).forEach(k => {
          if (dbPatch[k] === "" || dbPatch[k] === undefined) delete dbPatch[k];
        });
        res = await supabaseAdmin.from(dbTable).update(dbPatch).eq("id", primaryVal).select();
        continue;
      }
      const missingCol = extractMissingColumnName(res.error.message);
      if (missingCol) {
        const matchingKey = Object.keys(dbPatch).find(k => k === missingCol || k.startsWith(missingCol) || missingCol.startsWith(k));
        if (matchingKey) {
          delete dbPatch[matchingKey];
          res = await supabaseAdmin.from(dbTable).update(dbPatch).eq("id", primaryVal).select();
          continue;
        }
      }
      if (res.error.message.includes("bank_name") && "bank_name" in dbPatch) {
        delete dbPatch.bank_name;
        res = await supabaseAdmin.from(dbTable).update(dbPatch).eq("id", primaryVal).select();
        continue;
      }
      break;
    }

    if (res.error) {
      console.error(`[Supabase UPDATE ERROR '${dbTable}'] id "${primaryVal}":`, res.error.message);
      throw new Error(res.error.message);
    } else {
      console.log(`[Supabase UPDATE SUCCESS '${dbTable}'] id "${primaryVal}" -> updated ${res.data?.length || 0} row(s)`);
    }

    return res.data;
  } catch (err) {
    console.error(`[Supabase UPDATE EXCEPTION '${dbTable}'] id "${primaryVal}":`, err);
    throw err;
  }
}

export async function deleteRowsFromSupabase(tableName: string, targetVals: (string | number)[]) {
  if (!isSupabaseConfigured() || !targetVals.length) return null;

  const dbTable = getDbTableName(tableName);
  try {
    const numVals = targetVals.map(v => Number(v)).filter(n => Number.isFinite(n));
    const strVals = targetVals.map(v => String(v).trim()).filter(Boolean);

    await Promise.all([
      numVals.length ? supabaseAdmin.from(dbTable).delete().in("id", numVals) : Promise.resolve(),
      strVals.length ? supabaseAdmin.from(dbTable).delete().in("id", strVals) : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn(`Exception deleting batch from Supabase '${dbTable}':`, err);
  }
}

export async function deleteRowFromSupabase(tableName: string, keyColumn: string, keyValue: any, row?: Record<string, any>) {
  if (!isSupabaseConfigured()) return null;

  const dbTable = getDbTableName(tableName);
  const rawVal = row?.id ?? row?.[keyColumn] ?? row?.id_Conwork ?? row?.id_bank ?? row?.id_store ?? row?.id_Contractor ?? row?.id_cus ?? row?.id_Company ?? row?.id_car ?? keyValue;
  const numId = Number(rawVal);
  const targetVal = Number.isFinite(numId) && String(rawVal).trim() !== "" ? numId : rawVal;

  try {
    const res = await supabaseAdmin
      .from(dbTable)
      .delete()
      .eq("id", targetVal);

    if (res.error && typeof targetVal === "number") {
      await supabaseAdmin
        .from(dbTable)
        .delete()
        .eq("id", String(targetVal));
    }
  } catch (err) {
    console.warn(`Exception deleting from Supabase '${dbTable}':`, err);
  }
}

export async function getRowsFromSupabase(tableName: string, maxRows = 10_000): Promise<SheetRow[]> {
  if (!isSupabaseConfigured()) return [];

  const dbTable = getDbTableName(tableName);

  try {
    const isAscending = dbTable !== "bills";
    const rangeEnd = Math.max(0, maxRows - 1);
    
    // Concurrently fetch main rows and only the required auxiliary maps for the specific table
    const isMasterTable = dbTable === "stores" || dbTable === "contractors" || dbTable === "master_members";
    const isBillTable = dbTable === "bills";
    const isProjectTable = dbTable === "projects";

    const [mainResult, entityBankMap, billFollowDatesMap, projectBudgetsMap] = await Promise.all([
      supabaseAdmin.from(dbTable).select("*").order("id", { ascending: isAscending }).range(0, rangeEnd),
      isMasterTable ? getEntityBankMapFromSupabase() : Promise.resolve({} as Record<string, string>),
      isBillTable ? getBillFollowDatesFromSupabase() : Promise.resolve({} as Record<string, Record<string, string>>),
      isProjectTable ? getProjectBudgetAllocationsFromSupabase() : Promise.resolve({} as Record<string, Record<string, any>>)
    ]);

    const { data, error } = mainResult;

    if (error) {
      console.warn(`Could not fetch rows from Supabase table '${dbTable}' (requested '${tableName}'): ${error.message}`);
      return [];
    }

    if (!data || data.length === 0) {
      if ((tableName === "ประเภท" || dbTable === "categories")) {
        const options = await getSystemOptionsFromSupabase();
        const list1 = options["ประเภท (ผู้รับเหมา)"] || options["ประเภท_ผู้รับเหมา"] || ALL_CONTRACTOR_CATEGORIES;
        const list2 = options["ประเภท (ร้านค้า)"] || options["ประเภท_ร้านค้า"] || ALL_STORE_CATEGORIES;
        const list3 = options["ประเภท (ร้านค้า+เลือกสินค้า)"] || options["ประเภท_ร้านค้า_สินค้า"] || ALL_STORE_CATEGORIES;

        const maxLen = Math.max(list1.length, list2.length, list3.length);
        const generatedRows: SheetRow[] = [];
        for (let i = 0; i < maxLen; i++) {
          generatedRows.push({
            _sheetRow: i + 1,
            "ประเภท Name1": list1[i] || "",
            "ประเภท Name2": list2[i] || "",
            "ประเภท Name3": list3[i] || ""
          });
        }
        return generatedRows;
      }

      if ((tableName === "สินค้า" || dbTable === "products")) {
        const options = await getSystemOptionsFromSupabase();
        if (Array.isArray(options["PRODUCT_MASTER_DATA"]) && options["PRODUCT_MASTER_DATA"].length > 0) {
          return options["PRODUCT_MASTER_DATA"].map((item: any, idx: number) => ({
            _sheetRow: idx + 2,
            id_product: item.id || item.code || String(idx + 1),
            "รหัสสินค้า": item.code || String(idx + 1),
            "ชื่อประเภทสินค้า": item.name || "",
            "หมายเหตุ": item.description || ""
          }));
        }
        return DEFAULT_PRODUCT_CATEGORIES;
      }
      return [];
    }

    const hasBankMap = isMasterTable && Object.keys(entityBankMap).length > 0;
    const hasFollowMap = isBillTable && Object.keys(billFollowDatesMap).length > 0;
    const hasBudgetMap = isProjectTable && Object.keys(projectBudgetsMap).length > 0;

    const rowCount = data.length;
    const mapped: SheetRow[] = new Array(rowCount);

    for (let idx = 0; idx < rowCount; idx++) {
      const row = data[idx];
      const res = mapSupabaseRowToSheetRow(dbTable, row, idx);

      if (hasBankMap) {
        const entityId = res.id_store || res.id_Contractor || res.รหัสพนักงาน || res.id;
        if ((!res["ธนาคาร"] || res["ธนาคาร"] === "-") && entityId && entityBankMap[entityId]) {
          res["ธนาคาร"] = entityBankMap[entityId];
        }
      }

      if (isBillTable) {
        if (hasFollowMap) {
          const rawId = String(row.id || "");
          const rawSeq = String(res["ลำดับ"] || res._sheetRow || "");
          const followData = (rawId && billFollowDatesMap[rawId]) || (rawSeq && billFollowDatesMap[rawSeq]);
          if (followData) {
            Object.assign(res, followData);

            // Re-enforce withholding tax and VAT consistency after followData merge
            const hasExplicitZeroWht = row.withholding_tax !== null && row.withholding_tax !== undefined && Number(row.withholding_tax) === 0;
            const isWhtActive = !hasExplicitZeroWht && (
              Number(row.withholding_tax) > 0 ||
              isDeductActive(res["หัก"]) ||
              isDeductActive(row["หัก"])
            );
            if (!isWhtActive) {
              res["หัก"] = "";
              res["จำนวนหัก"] = "";
              res["3เปอร์"] = "";
              res["3เปอร์เซ็น"] = "";
              res["วันออก 3%"] = "";
            }

            const hasExplicitZeroVat = row.vat_amount !== null && row.vat_amount !== undefined && Number(row.vat_amount) === 0;
            const isVat = !hasExplicitZeroVat && (Number(row.vat_amount) > 0 || isVatActive(res["vat"]) || isVatActive(row.vat));
            if (!isVat) {
              res["vat"] = "";
              res.vat = "";
            }

            if (followData["ลำดับ"]) {
              res["ลำดับ"] = followData["ลำดับ"];
            }
            if (followData["ผู้สร้างบิล"]) {
              res["ผู้สร้างบิล"] = followData["ผู้สร้างบิล"];
              res["created_by"] = followData["ผู้สร้างบิล"];
            } else if (followData["created_by"]) {
              res["ผู้สร้างบิล"] = followData["created_by"];
              res["created_by"] = followData["created_by"];
            } else if (followData["ผู้บันทึก"]) {
              res["ผู้สร้างบิล"] = followData["ผู้บันทึก"];
              res["created_by"] = followData["ผู้บันทึก"];
            }
          }
        }
        if (!res["ผู้สร้างบิล"]) {
          res["ผู้สร้างบิล"] = res["ผู้เบิก"] || "";
          res["created_by"] = res["ผู้สร้างบิล"];
        }
      }

      if (isProjectTable && hasBudgetMap) {
        const pId = String(res["ID Project"] || res.id || res._sheetRow || "");
        if (pId && projectBudgetsMap[pId]) {
          Object.assign(res, projectBudgetsMap[pId]);
        }
      }

      mapped[idx] = res;
    }

    if ((tableName === "ประเภท" || dbTable === "categories") && mapped.length === 0) {
      const options = await getSystemOptionsFromSupabase();
      const list1 = options["ประเภท (ผู้รับเหมา)"] || options["ประเภท_ผู้รับเหมา"] || ALL_CONTRACTOR_CATEGORIES;
      const list2 = options["ประเภท (ร้านค้า)"] || options["ประเภท_ร้านค้า"] || ALL_STORE_CATEGORIES;
      const list3 = options["ประเภท (ร้านค้า+เลือกสินค้า)"] || options["ประเภท_ร้านค้า_สินค้า"] || ALL_STORE_CATEGORIES;

      const maxLen = Math.max(list1.length, list2.length, list3.length);
      const generatedRows: SheetRow[] = [];
      for (let i = 0; i < maxLen; i++) {
        generatedRows.push({
          _sheetRow: i + 1,
          "ประเภท Name1": list1[i] || "",
          "ประเภท Name2": list2[i] || "",
          "ประเภท Name3": list3[i] || ""
        });
      }
      return generatedRows;
    }

    if ((tableName === "สินค้า" || dbTable === "products") && mapped.length === 0) {
      const options = await getSystemOptionsFromSupabase();
      if (Array.isArray(options["PRODUCT_MASTER_DATA"]) && options["PRODUCT_MASTER_DATA"].length > 0) {
        return options["PRODUCT_MASTER_DATA"].map((item: any, idx: number) => {
          const pId = item.id || item.code || String(idx + 1);
          return {
            id: pId,
            _sheetRow: pId,
            id_product: pId,
            "รหัสสินค้า": item.code || String(idx + 1),
            "ชื่อประเภทสินค้า": item.name || "",
            "หมายเหตุ": item.description || ""
          };
        });
      }
      return DEFAULT_PRODUCT_CATEGORIES;
    }

    return mapped;
  } catch (err) {
    console.warn(`Exception fetching rows from Supabase table '${dbTable}':`, err);
    return [];
  }
}

export async function getWithdrawBillsFromSupabase(maxRows = 3_000): Promise<SheetRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const rangeEnd = Math.max(0, maxRows - 1);
    const [mainResult, billFollowDatesMap] = await Promise.all([
      supabaseAdmin
        .from("bills")
        .select("*")
        .or("status.eq.รอตั้งเบิก,status.eq.ตั้งเบิก,status.eq.รออนุมัติ,status.eq.อนุมัติ")
        .order("id", { ascending: false })
        .range(0, rangeEnd),
      getBillFollowDatesFromSupabase()
    ]);

    const { data, error } = mainResult;
    if (error || !data) return [];

    const hasFollowMap = Object.keys(billFollowDatesMap).length > 0;
    const rowCount = data.length;
    const mapped: SheetRow[] = new Array(rowCount);

    for (let idx = 0; idx < rowCount; idx++) {
      const row = data[idx];
      const res = mapSupabaseRowToSheetRow("bills", row, idx);

      if (hasFollowMap) {
        const rawId = String(row.id || "");
        const rawSeq = String(res["ลำดับ"] || res._sheetRow || "");
        const followData = (rawId && billFollowDatesMap[rawId]) || (rawSeq && billFollowDatesMap[rawSeq]);
        if (followData) {
          Object.assign(res, followData);
          if (followData["ลำดับ"]) res["ลำดับ"] = followData["ลำดับ"];
          if (followData["ผู้สร้างบิล"]) {
            res["ผู้สร้างบิล"] = followData["ผู้สร้างบิล"];
            res["created_by"] = followData["ผู้สร้างบิล"];
          }
        }
      }

      mapped[idx] = res;
    }

    return mapped;
  } catch (err) {
    console.warn("Exception fetching withdraw bills from Supabase:", err);
    return [];
  }
}

export async function getBillFollowRowsFromSupabase(maxRows = 3_000): Promise<SheetRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const rangeEnd = Math.max(0, maxRows - 1);
    const [mainResult, billFollowDatesMap] = await Promise.all([
      supabaseAdmin
        .from("bills")
        .select("*")
        .or("vat_amount.gt.0,withholding_tax.gt.0,credit_days.gt.0")
        .order("id", { ascending: false })
        .range(0, rangeEnd),
      getBillFollowDatesFromSupabase()
    ]);

    const { data, error } = mainResult;
    if (error || !data) return [];

    const hasFollowMap = Object.keys(billFollowDatesMap).length > 0;
    const rowCount = data.length;
    const mapped: SheetRow[] = new Array(rowCount);

    for (let idx = 0; idx < rowCount; idx++) {
      const row = data[idx];
      const res = mapSupabaseRowToSheetRow("bills", row, idx);

      if (hasFollowMap) {
        const rawId = String(row.id || "");
        const rawSeq = String(res["ลำดับ"] || res._sheetRow || "");
        const followData = (rawId && billFollowDatesMap[rawId]) || (rawSeq && billFollowDatesMap[rawSeq]);
        if (followData) {
          Object.assign(res, followData);
          if (followData["ลำดับ"]) res["ลำดับ"] = followData["ลำดับ"];
          if (followData["ผู้สร้างบิล"]) {
            res["ผู้สร้างบิล"] = followData["ผู้สร้างบิล"];
            res["created_by"] = followData["ผู้สร้างบิล"];
          }
        }
      }
      if (!res["ผู้สร้างบิล"]) {
        res["ผู้สร้างบิล"] = res["ผู้เบิก"] || "";
        res["created_by"] = res["ผู้สร้างบิล"];
      }

      mapped[idx] = res;
    }

    return mapped;
  } catch (err) {
    console.warn("Exception fetching bill follow rows from Supabase:", err);
    return [];
  }
}

export async function getDashboardFinancialSummaryFromSupabase(startDate?: string, endDate?: string, projectId?: string): Promise<Record<string, any> | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await (supabaseAdmin.rpc as any)("get_dashboard_financial_summary", {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_project_id: projectId || null,
    });

    if (error) {
      console.warn("RPC get_dashboard_financial_summary error:", error.message);
      return null;
    }

    return data || null;
  } catch (err) {
    console.warn("Exception calling get_dashboard_financial_summary RPC:", err);
    return null;
  }
}

export type BillsPagedParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  sortDesc?: boolean;
};

export type BillsPagedResult = {
  rows: SheetRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getBillsPagedFromSupabase(params: BillsPagedParams = {}): Promise<BillsPagedResult> {
  if (!isSupabaseConfigured()) {
    return { rows: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };
  }

  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(params.pageSize) || 50));
  const offset = (page - 1) * pageSize;
  const sortDesc = params.sortDesc !== false;

  try {
    let query = supabaseAdmin
      .from("bills")
      .select("*", { count: "exact" });

    if (params.status && params.status.trim()) {
      query = query.eq("status", params.status.trim());
    }

    if (params.projectId && params.projectId.trim()) {
      query = query.eq("project_id", params.projectId.trim());
    }

    if (params.startDate) {
      query = query.gte("bill_date", params.startDate);
    }
    if (params.endDate) {
      query = query.lte("bill_date", params.endDate);
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      query = query.or(`product.ilike.%${q}%,work_details.ilike.%${q}%,requester.ilike.%${q}%,vendor_type.ilike.%${q}%,id.ilike.%${q}%,sub_category.ilike.%${q}%`);
    }

    query = query
      .order("created_at", { ascending: !sortDesc })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      console.warn("getBillsPagedFromSupabase query error:", error.message);
      return { rows: [], total: 0, page, pageSize, totalPages: 1 };
    }

    const total = count || (data?.length || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const rows: SheetRow[] = (data || []).map((row, idx) => {
      const sheetRow = mapSupabaseRowToSheetRow("bills", row, offset + idx);
      if (!sheetRow["ผู้สร้างบิล"]) {
        sheetRow["ผู้สร้างบิล"] = sheetRow["ผู้เบิก"] || "";
        sheetRow["created_by"] = sheetRow["ผู้สร้างบิล"];
      }
      return sheetRow;
    });

    return {
      rows,
      total,
      page,
      pageSize,
      totalPages
    };
  } catch (err) {
    console.warn("Exception in getBillsPagedFromSupabase:", err);
    return { rows: [], total: 0, page, pageSize, totalPages: 1 };
  }
}

export async function getSystemOptionsFromSupabase(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured()) return {};

  return cached("sys_opt:all", 120_000, async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from("system_options")
        .select("*");

      if (error || !data || data.length === 0) return {};

      const singleDoc = data.find(row => row.id === "system_options");
      if (singleDoc && singleDoc.data && Object.keys(singleDoc.data).length > 0) {
        return singleDoc.data;
      }

      const result: Record<string, string[]> = {};
      for (const row of data) {
        for (const [col, val] of Object.entries(row)) {
          if (col === "id" || col === "created_at" || col === "updated_at" || col === "data") continue;
          if (val !== null && val !== undefined && String(val).trim() !== "") {
            const strVal = String(val).trim();
            if (!result[col]) result[col] = [];
            if (!result[col].includes(strVal)) result[col].push(strVal);
          }
        }
      }
      return result;
    } catch (err) {
      console.warn("Failed to load system_options from Supabase", err);
      return {};
    }
  });
}

const SYNCABLE_OPTION_FIELDS = [
  "ชื่อเครื่องมือ",
  "รายละเอียดงาน",
  "รายการ",
  "ยี่ห้อรถ",
  "ยี่ห้อ",
  "รถของ",
  "รับผิดชอบ",
  "บิล",
  "ประเภทบิล"
];

const OPTION_KEY_MAP: Record<string, string> = {
  "ยี่ห้อ": "ยี่ห้อรถ",
  "บิล": "ประเภทบิล"
};

export async function syncCustomOptionsFromRow(row: Record<string, any>) {
  if (!isSupabaseConfigured() || !row || typeof row !== "object") return;

  const newEntries: Record<string, string[]> = {};

  for (const fieldName of SYNCABLE_OPTION_FIELDS) {
    const rawVal = row[fieldName];
    if (!rawVal || typeof rawVal !== "string") continue;

    const items = rawVal
      .split(",")
      .map(s => s.trim())
      .filter(s => s && s !== "-" && s !== "0" && s !== "non");

    if (items.length > 0) {
      const targetKey = OPTION_KEY_MAP[fieldName] || fieldName;
      newEntries[targetKey] = items;
    }
  }

  if (Object.keys(newEntries).length === 0) return;

  try {
    const currentOptions = await getSystemOptionsFromSupabase();
    let hasChanges = false;
    const updatedOptions: Record<string, string[]> = { ...currentOptions };

    for (const [field, items] of Object.entries(newEntries)) {
      const existingList = Array.isArray(updatedOptions[field]) ? [...updatedOptions[field]] : [];
      let fieldChanged = false;

      for (const item of items) {
        if (!existingList.includes(item)) {
          existingList.push(item);
          fieldChanged = true;
        }
      }

      if (fieldChanged) {
        updatedOptions[field] = existingList;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await supabaseAdmin.from("system_options").upsert({
        id: "system_options",
        data: updatedOptions,
        updated_at: new Date().toISOString()
      });
      clearCache("sys_opt:all");
      clearCache("sys_opt:all_options");
    }
  } catch (err) {
    console.warn("Failed to auto-sync new custom options to system_options:", err);
  }
}

function extractMissingColumnName(errorMessage: string): string | null {
  if (!errorMessage) return null;

  const m1 = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (m1 && m1[1]) return m1[1];

  const m2 = errorMessage.match(/column\s+(?:[^\s.]+\.)?["']?([^"'\s,;]+)["']?\s+does not exist/i);
  if (m2 && m2[1]) return m2[1];

  const m3 = errorMessage.match(/column\s+["']?([^"'\s,;]+)["']?\s+of relation/i);
  if (m3 && m3[1]) return m3[1];

  return null;
}

export async function insertRowToSupabase(tableName: string, rowData: Record<string, any>) {
  if (!isSupabaseConfigured()) return null;

  const dbTable = getDbTableName(tableName);
  const dbRow = mapSheetRowToSupabaseRow(tableName, rowData);
  dbRow.data = { ...(rowData.data || {}), ...rowData };

  const bankVal = rowData["ธนาคาร"] || rowData["bank_name"];
  const entityId = dbRow.id || rowData["id_store"] || rowData["id_Contractor"] || rowData["รหัสพนักงาน"];
  const sideTasks: Promise<any>[] = [];

  if (bankVal && entityId) {
    sideTasks.push(saveEntityBankOption(String(entityId), String(bankVal)));
  }

  if (dbTable === "projects" || tableName === "Project" || tableName === "PROJECT") {
    const targetProjId = String(rowData["ID Project"] ?? rowData.id ?? dbRow.id);
    sideTasks.push(saveProjectBudgetAllocation(targetProjId, rowData));
  }

  sideTasks.push(syncCustomOptionsFromRow(rowData));
  Promise.all(sideTasks).catch(() => undefined);

  try {
    let res = await supabaseAdmin.from(dbTable).insert(dbRow).select();
    let retries = 0;

    while (res.error && retries < 25) {
      retries++;
      if (res.error.message.includes("duplicate key") || res.error.message.includes("unique constraint") || res.error.message.includes("already exists")) {
        res = await supabaseAdmin.from(dbTable).upsert(dbRow).select();
        if (!res.error) break;
      }
      if (res.error.message.includes("cannot insert a non-DEFAULT value") || res.error.message.includes("ALWAYS AS IDENTITY") || res.error.message.includes("identity")) {
        delete dbRow.id;
        res = await supabaseAdmin.from(dbTable).insert(dbRow).select();
        continue;
      }
      if (res.error.message.includes("invalid input syntax")) {
        Object.keys(dbRow).forEach(k => {
          if (dbRow[k] === "" || dbRow[k] === undefined) delete dbRow[k];
        });
        res = await supabaseAdmin.from(dbTable).insert(dbRow).select();
        continue;
      }
      const missingCol = extractMissingColumnName(res.error.message);
      if (missingCol) {
        const matchingKey = Object.keys(dbRow).find(k => k === missingCol || k.startsWith(missingCol) || missingCol.startsWith(k));
        if (matchingKey) {
          delete dbRow[matchingKey];
          res = await supabaseAdmin.from(dbTable).insert(dbRow).select();
          continue;
        }
      }
      if (res.error.message.includes("bank_name") && "bank_name" in dbRow) {
        delete dbRow.bank_name;
        res = await supabaseAdmin.from(dbTable).insert(dbRow).select();
        continue;
      }
      break;
    }

    if (res.error) {
      console.warn(`Failed to insert into Supabase '${dbTable}': ${res.error.message}`);
      throw new Error(`บันทึกลงตาราง '${dbTable}' ไม่สำเร็จ: ${res.error.message}`);
    }

    const insertedItem = Array.isArray(res.data) ? res.data[0] : res.data;
    const insertedId = insertedItem?.id || rowData["ลำดับ"] || rowData.id;
    if (insertedId && (dbTable === "bills" || tableName === "Data" || tableName === "bills")) {
      await saveBillFollowDate(String(insertedId), rowData);
    }

    return res.data;
  } catch (err) {
    console.warn(`Exception inserting into Supabase '${dbTable}':`, err);
    throw err;
  }
}

function getBusinessKey(dbTable: string, row: Record<string, any>): string {
  if (!row || typeof row !== "object") return "";

  if (dbTable === "banks") {
    return String(row.name || row["ชื่อธนาคาร"] || "").trim().toLowerCase();
  }
  if (dbTable === "stores") {
    return String(row.name || row.full_name || row["ชื่อร้านค้า"] || row["ชื่อเต็ม"] || "").trim().toLowerCase();
  }
  if (dbTable === "contractors") {
    const idCard = String(row.id_card || row["บัตรประจำตัวประชาชน"] || "").trim();
    if (idCard && idCard.length >= 5) return `idcard:${idCard}`;
    return String(row.full_name || row.nickname || row["ชื่อ-นามสกุล"] || row["ชื่อเล่น"] || "").trim().toLowerCase();
  }
  if (dbTable === "master_members") {
    const phone = String(row.phone || row["เบอร์โทร"] || "").replace(/\D/g, "");
    if (phone.length >= 9) return `phone:${phone}`;
    const idCard = String(row.id_card || row["เลขที่บัตรประชาชน"] || "").trim();
    if (idCard && idCard.length >= 5) return `idcard:${idCard}`;
    return String(row.full_name || row.nickname || row["ชื่อ-นามสกุล"] || row["ชื่อเล่น"] || "").trim().toLowerCase();
  }
  if (dbTable === "cars") {
    return String(row.plate_no || row["หมายเลขทะเบียน"] || "").trim().toLowerCase().replace(/\s+/g, "");
  }
  if (dbTable === "products") {
    const code = String(row.code || row["รหัสสินค้า"] || "").trim();
    if (code) return `code:${code.toLowerCase()}`;
    return String(row.name || row["ชื่อประเภทสินค้า"] || "").trim().toLowerCase();
  }
  if (dbTable === "customers") {
    return String(row.name || row["ชื่อลูกค้า"] || "").trim().toLowerCase();
  }
  if (dbTable === "companies") {
    return String(row.name_th || row.name_en || row["ชื่อบริษัท"] || row["ชื่ออังกฤษ"] || "").trim().toLowerCase();
  }
  if (dbTable === "projects") {
    return String(row.name || row["ชื่อ Project"] || "").trim().toLowerCase();
  }
  if (dbTable === "bills") {
    const proj = String(row.project_id || row["ID Project"] || "").trim();
    const bill = String(row.bill_no || row["บิล"] || "").trim();
    const amount = String(row.amount || row["ยอดเงิน"] || "").trim();
    const date = String(row.bill_date || row["ว/ด/ป"] || "").trim();
    if (proj && bill) return `bill:${proj}:${bill}:${amount}:${date}`.toLowerCase();
    return "";
  }
  return "";
}

function getPrefixForTable(dbTable: string): string {
  switch (dbTable) {
    case "banks": return "Ba";
    case "stores": return "St";
    case "contractors": return "Con";
    case "contract_works": return "CW";
    case "master_members": return "U";
    case "cars": return "Car";
    case "customers": return "Cus";
    case "companies": return "Comp";
    case "loans": return "L";
    default: return "";
  }
}

export async function bulkInsertRowsToSupabase(tableName: string, rowsData: Record<string, any>[]) {
  if (!isSupabaseConfigured() || !rowsData.length) return [];

  const dbTable = getDbTableName(tableName);
  const rawDbRows = rowsData
    .map(r => mapSheetRowToSupabaseRow(tableName, r))
    .filter(r => Object.keys(r).length > 0);

  if (!rawDbRows.length) return [];

  try {
    // 1. Fetch existing records to prevent duplicates and match IDs
    const { data: existingRecords } = await supabaseAdmin.from(dbTable).select("*");
    const existingList = existingRecords || [];

    const existingById = new Map<string, Record<string, any>>();
    const existingByBusinessKey = new Map<string, Record<string, any>>();

    let maxNum = 100;
    const prefix = getPrefixForTable(dbTable);

    for (const record of existingList) {
      if (record.id !== undefined && record.id !== null) {
        existingById.set(String(record.id).trim().toLowerCase(), record);

        const match = String(record.id).match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }

      const bKey = getBusinessKey(dbTable, record);
      if (bKey) {
        existingByBusinessKey.set(bKey, record);
      }
    }

    // 2. Intelligent deduplication and ID assignment
    const dedupedMap = new Map<string, Record<string, any>>();

    for (const incomingRow of rawDbRows) {
      const rowCopy = { ...incomingRow };
      const rawId = String(rowCopy.id || "").trim().toLowerCase();
      const bKey = getBusinessKey(dbTable, rowCopy);

      let matchedRecord: Record<string, any> | undefined;

      if (rawId && existingById.has(rawId)) {
        matchedRecord = existingById.get(rawId);
      } else if (bKey && existingByBusinessKey.has(bKey)) {
        matchedRecord = existingByBusinessKey.get(bKey);
      }

      if (matchedRecord) {
        // Link to existing ID to update instead of duplicating
        rowCopy.id = matchedRecord.id;
        const dedupKey = String(matchedRecord.id);
        const merged = { ...matchedRecord, ...(dedupedMap.get(dedupKey) || {}), ...rowCopy };
        dedupedMap.set(dedupKey, merged);
      } else {
        // New record
        if (!rowCopy.id && dbTable !== "bills") {
          maxNum++;
          rowCopy.id = prefix ? `${prefix}${maxNum}` : `${maxNum}`;
        }
        const dedupKey = rowCopy.id ? String(rowCopy.id) : (bKey || `temp_${Math.random()}`);
        dedupedMap.set(dedupKey, rowCopy);

        if (rowCopy.id) {
          existingById.set(String(rowCopy.id).trim().toLowerCase(), rowCopy);
        }
        if (bKey) {
          existingByBusinessKey.set(bKey, rowCopy);
        }
      }
    }

    const dedupedRows = Array.from(dedupedMap.values());

    // Save entity banks in system_options for stores/contractors/master_members
    if (dbTable === "stores" || dbTable === "contractors" || dbTable === "master_members") {
      const bankEntries: Record<string, string> = {};
      for (const r of dedupedRows) {
        const eid = String(r.id || "").trim();
        const bname = String(r.bank_name || r["ธนาคาร"] || "").trim();
        if (eid && bname) {
          bankEntries[eid] = bname;
        }
      }
      if (Object.keys(bankEntries).length > 0) {
        saveEntityBanksBatch(bankEntries).catch(() => {});
      }
    }

    const chunkSize = 200;
    const insertedResults: any[] = [];

    for (let i = 0; i < dedupedRows.length; i += chunkSize) {
      const chunk = dedupedRows.slice(i, i + chunkSize);

      const sanitizedChunk = chunk.map(item => {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(item)) {
          if (v !== undefined) clean[k] = v;
        }
        return clean;
      });

      let currentChunk = sanitizedChunk;
      let res = await supabaseAdmin.from(dbTable).upsert(currentChunk, { onConflict: "id" }).select();

      // Auto-retry if any column is missing in Postgres schema cache (e.g. bank_name)
      let retries = 0;
      while (res.error && retries < 6) {
        retries++;
        const match = res.error.message.match(/Could not find the '([^']+)' column/i);
        if (match && match[1]) {
          const missingCol = match[1];
          currentChunk = currentChunk.map(item => {
            const copy = { ...item };
            delete copy[missingCol];
            return copy;
          });
          res = await supabaseAdmin.from(dbTable).upsert(currentChunk, { onConflict: "id" }).select();
          continue;
        }
        break;
      }

      if (res.error) {
        res = await supabaseAdmin.from(dbTable).upsert(currentChunk).select();
      }

      if (res.error) {
        res = await supabaseAdmin.from(dbTable).insert(currentChunk).select();
      }

      if (res.error) {
        console.warn(`Bulk insert error in table '${dbTable}':`, res.error.message);
        throw new Error(`นำเข้าข้อมูลตาราง '${dbTable}' ไม่สำเร็จ: ${res.error.message}`);
      }

      if (res.data) {
        insertedResults.push(...res.data);
      }
    }

    clearCache(`rows:${tableName}`);
    clearCache(`headers:${tableName}`);
    clearCache("rows:");

    return insertedResults;
  } catch (err) {
    console.warn(`Exception in bulkInsertRowsToSupabase for '${dbTable}':`, err);
    throw err;
  }
}

export async function insertAuditLogToSupabase(entry: Record<string, any>) {
  if (!isSupabaseConfigured()) return null;

  try {
    await supabaseAdmin.from("audit_logs").insert({
      action: String(entry.action || "UPDATE"),
      table_name: String(entry.tableName || ""),
      actor: String(entry.actor || "system"),
      details: entry.details || {}
    });
  } catch (err) {
    // Ignore audit log error silently
  }
}

export function sanitizeSupabaseStorageKey(key: string): string {
  let clean = key
    .replace(/ธนาคาร/g, "banks")
    .replace(/ร้านค้า/g, "stores")
    .replace(/รับเหมา/g, "contractors")
    .replace(/ชื่อพนักงาน|PEOPLE|รายชื่อ/g, "people")
    .replace(/ทะเบียน|CAR/g, "cars")
    .replace(/ลูกค้า|CUSTOMER/g, "customers")
    .replace(/บริษัท|COMPANY/g, "companies")
    .replace(/ยืมเงิน|LOAN/g, "loans")
    .replace(/รูปถ่ายบิล|รูปถ่าย|รูปภาพ/g, "img");

  clean = clean.normalize("NFD").replace(/[^\x00-\x7F]/g, "_");
  return clean.replace(/[^a-zA-Z0-9_\-\.]/g, "_").replace(/_+/g, "_");
}

export async function uploadFileToSupabaseStorage(bucketName: string, path: string, file: File | Buffer, contentType?: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const cleanPath = sanitizeSupabaseStorageKey(path);

  let buffer: Buffer;
  if (file instanceof File) {
    buffer = Buffer.from(await file.arrayBuffer());
    contentType = contentType || file.type || "image/jpeg";
  } else {
    buffer = file;
    contentType = contentType || "image/jpeg";
  }

  let { data, error } = await supabaseAdmin.storage
    .from(bucketName)
    .upload(cleanPath, buffer, {
      contentType,
      upsert: true
    });

  if (error && (error.message.includes("not found") || error.message.includes("Bucket") || error.message.includes("bucket"))) {
    try {
      await supabaseAdmin.storage.createBucket(bucketName, { public: true });
      const retry = await supabaseAdmin.storage
        .from(bucketName)
        .upload(cleanPath, buffer, {
          contentType,
          upsert: true
        });
      data = retry.data;
      error = retry.error;
    } catch (createErr) {
      console.warn(`Failed to auto-create bucket '${bucketName}':`, createErr);
    }
  }

  if (error) {
    console.warn(`Supabase Storage upload error for bucket '${bucketName}':`, error.message);
    return `data:${contentType || "image/jpeg"};base64,${buffer.toString("base64")}`;
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucketName)
    .getPublicUrl(cleanPath);

  return publicUrlData.publicUrl;
}

/**
 * Delete uploaded image/attachment files from Supabase Storage buckets to save disk space
 */
export async function deleteStorageFilesFromSupabase(urls: (string | null | undefined)[]) {
  if (!isSupabaseConfigured() || !urls.length) return;

  const filePathsByBucket: Record<string, string[]> = {};

  for (const rawUrl of urls) {
    if (!rawUrl || typeof rawUrl !== "string" || rawUrl.startsWith("data:")) continue;

    const items = rawUrl.split(",").map(s => s.trim()).filter(Boolean);

    for (const item of items) {
      const match = item.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/i);
      if (match) {
        const bucket = match[1];
        const filePath = match[2];
        if (!filePathsByBucket[bucket]) filePathsByBucket[bucket] = [];
        filePathsByBucket[bucket].push(filePath);
      }
    }
  }

  for (const [bucket, paths] of Object.entries(filePathsByBucket)) {
    if (paths.length > 0) {
      try {
        const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
        if (error) {
          console.warn(`Failed to delete files from Supabase Storage bucket '${bucket}':`, error.message);
        } else {
          console.log(`Successfully deleted ${paths.length} storage file(s) from bucket '${bucket}'.`);
        }
      } catch (err) {
        console.warn(`Exception deleting files from storage bucket '${bucket}':`, err);
      }
    }
  }
}

export async function getUsersListFromSupabase(): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];
  return cached("sys_opt:users_list", 180_000, async () => {
    try {
      const { data } = await supabaseAdmin.from("system_options").select("data").eq("id", "users_list").maybeSingle();
      return Array.isArray(data?.data) ? data.data : [];
    } catch {
      return [];
    }
  });
}

export type StorageCleanupResult = {
  success: boolean;
  dryRun: boolean;
  totalFilesInBucket: number;
  referencedCount: number;
  orphanedCount: number;
  orphanedFiles: string[];
  deletedCount: number;
  freedBytesEstimate: number;
  error?: string;
};

/**
 * Scans Supabase Storage bucket and deletes orphaned image files not referenced anywhere in the database
 */
export async function cleanupOrphanedStorageImages(bucketName = "repairs", dryRun = true): Promise<StorageCleanupResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      dryRun,
      totalFilesInBucket: 0,
      referencedCount: 0,
      orphanedCount: 0,
      orphanedFiles: [],
      deletedCount: 0,
      freedBytesEstimate: 0,
      error: "Supabase not configured",
    };
  }

  try {
    const { data: fileList, error: listErr } = await supabaseAdmin.storage
      .from(bucketName)
      .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

    if (listErr) {
      return {
        success: false,
        dryRun,
        totalFilesInBucket: 0,
        referencedCount: 0,
        orphanedCount: 0,
        orphanedFiles: [],
        deletedCount: 0,
        freedBytesEstimate: 0,
        error: listErr.message,
      };
    }

    const files = fileList || [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const { data: billsData } = await supabaseAdmin
      .from("bills")
      .select("image_url, data");

    const activePaths = new Set<string>();

    function extractPath(urlStr: string) {
      if (!urlStr || typeof urlStr !== "string") return;
      const parts = urlStr.split(",");
      for (const p of parts) {
        const trimmed = p.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/i);
        if (match && match[1] === bucketName) {
          activePaths.add(match[2]);
        } else {
          const slashIdx = trimmed.lastIndexOf("/");
          if (slashIdx >= 0) {
            activePaths.add(trimmed.slice(slashIdx + 1));
          } else {
            activePaths.add(trimmed);
          }
        }
      }
    }

    for (const b of billsData || []) {
      if (b.image_url) extractPath(b.image_url);
      if (b.data && typeof b.data === "object") {
        if (b.data["รูปถ่ายบิล"]) extractPath(b.data["รูปถ่ายบิล"]);
        if (b.data["รูปภาพ"]) extractPath(b.data["รูปภาพ"]);
      }
    }

    const orphanedFiles: string[] = [];
    let freedBytes = 0;

    for (const file of files) {
      if (!file.name || file.name === ".emptyFolderPlaceholder") continue;

      const fileCreated = file.created_at ? new Date(file.created_at).getTime() : 0;
      if (fileCreated > oneDayAgo) continue;

      const isReferenced = activePaths.has(file.name);
      if (!isReferenced) {
        orphanedFiles.push(file.name);
        freedBytes += file.metadata?.size || (file as any).size || 250_000;
      }
    }

    let deletedCount = 0;
    if (!dryRun && orphanedFiles.length > 0) {
      for (let i = 0; i < orphanedFiles.length; i += 100) {
        const batch = orphanedFiles.slice(i, i + 100);
        const { error: delErr } = await supabaseAdmin.storage.from(bucketName).remove(batch);
        if (!delErr) {
          deletedCount += batch.length;
        } else {
          console.warn(`Error deleting batch from bucket '${bucketName}':`, delErr.message);
        }
      }
    }

    return {
      success: true,
      dryRun,
      totalFilesInBucket: files.length,
      referencedCount: activePaths.size,
      orphanedCount: orphanedFiles.length,
      orphanedFiles,
      deletedCount: dryRun ? 0 : deletedCount,
      freedBytesEstimate: freedBytes,
    };
  } catch (err: any) {
    console.error("cleanupOrphanedStorageImages exception:", err);
    return {
      success: false,
      dryRun,
      totalFilesInBucket: 0,
      referencedCount: 0,
      orphanedCount: 0,
      orphanedFiles: [],
      deletedCount: 0,
      freedBytesEstimate: 0,
      error: err?.message || String(err),
    };
  }
}

export async function syncContractWorkPaidAmount(conworkIdOrRef: string, projectId?: string): Promise<number | null> {
  if (!isSupabaseConfigured() || !conworkIdOrRef) return null;
  try {
    const rawRef = String(conworkIdOrRef).trim();
    if (!rawRef) return null;

    // 1. Find the contract in contract_works table
    let contractQuery = supabaseAdmin.from("contract_works").select("*");
    if (rawRef.startsWith("CW") || !isNaN(Number(rawRef))) {
      contractQuery = contractQuery.eq("id", rawRef);
    } else if (projectId) {
      contractQuery = contractQuery.eq("project_id", projectId).or(`contractor_id.eq.${rawRef},work_details.ilike.%${rawRef}%`);
    } else {
      contractQuery = contractQuery.or(`id.eq.${rawRef},contractor_id.eq.${rawRef}`);
    }

    const { data: matchedContracts } = await contractQuery.limit(1);
    const contract = matchedContracts?.[0];
    if (!contract) return null;

    const targetContractId = contract.id;
    const targetProjectId = contract.project_id;
    const contractorId = contract.contractor_id;

    // 2. Query all paid bills matching this contract
    const { data: bills, error: billsErr } = await supabaseAdmin
      .from("bills")
      .select("id, project_id, vendor_or_person, labor_cost, amount, status, paid_date, data");

    if (billsErr || !bills) return null;

    let totalPaid = 0;
    for (const b of bills) {
      const d = (b.data && typeof b.data === "object") ? b.data : {};
      const status = String(b.status || d["สถานะ"] || "").trim().toLowerCase();
      const isPaid = status.includes("เบิกแล้ว") || status === "paid" || status === "withdrawn" || Boolean(b.paid_date);
      if (!isPaid) continue;
      const bRef = String(d._rawContractor || d.conwork_id || d["สัญญา"] || d["_rawVendor"] || "").trim();
      const bContractor = String(d["ผู้รับเหมา"] || b.vendor_or_person || "").trim();
      const bProjId = String(b.project_id || d["ID Project"] || "").trim();

      let isMatch = false;
      if (bRef && (bRef === targetContractId || bRef.includes(targetContractId))) {
        isMatch = true;
      } else if (targetProjectId && bProjId === targetProjectId) {
        if (contractorId && (bContractor === contractorId || bRef === contractorId)) {
          isMatch = true;
        } else if (contract.nickname && (bContractor === contract.nickname || bContractor.includes(contract.nickname))) {
          isMatch = true;
        }
      }

      if (isMatch) {
        const labor = Number(b.labor_cost || d["ค่าแรง"] || b.amount || 0);
        totalPaid += labor;
      }
    }

    // 3. Update contract_works
    const contractTotal = Number(contract.total_contract_amount || 0);
    const remainingLabor = Math.max(0, contractTotal - totalPaid);

    const updatePayload: Record<string, any> = {
      paid_amount: totalPaid
    };
    if ("remaining_amount" in contract) {
      updatePayload.remaining_amount = remainingLabor;
    }

    await supabaseAdmin
      .from("contract_works")
      .update(updatePayload)
      .eq("id", targetContractId);

    clearCache("rows:contract_works");
    clearCache("rows:งานรับเหมา");
    clearCache("rows:Contract_work");
    clearCache("headers:contract_works");

    return totalPaid;
  } catch (e) {
    console.warn("Error in syncContractWorkPaidAmount:", e);
    return null;
  }
}

