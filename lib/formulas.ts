import { TABLES } from "@/lib/config";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { computeBillAmount, computeBillDeductMultiplier, computeBillTransferAmount, isVatActive, isDeductActive, parseDeductPercent, parseBillItems } from "@/lib/project-summary";
import { getExpenseFieldForCategory } from "@/lib/cost-codes";
import { getRows } from "@/lib/db";
import type { SheetRow } from "@/lib/types";
import { getTodayDateIso } from "@/lib/utils/dates";
import { hydrateContractorsWithYearlySpend } from "@/lib/contractors/contractor-limits";

export async function applyBillFormulas(row: SheetRow) {
  const context = await getBillFormulaContext();
  return applyBillFormulasFast(row, context);
}

export async function hydrateBillRows(
  rows: SheetRow[],
  preloadedContext?: {
    projects?: SheetRow[];
    stores?: SheetRow[];
    contracts?: SheetRow[];
    contractors?: SheetRow[];
    cars?: SheetRow[];
    people?: SheetRow[];
    products?: SheetRow[];
  }
) {
  const [
    projects,
    stores,
    rawContracts,
    contractors,
    cars,
    people,
    products
  ] = await Promise.all([
    preloadedContext?.projects ? Promise.resolve(preloadedContext.projects) : getRows(TABLES.PROJECT, 120_000),
    preloadedContext?.stores ? Promise.resolve(preloadedContext.stores) : getRows(TABLES.STORE, 120_000),
    preloadedContext?.contracts ? Promise.resolve(preloadedContext.contracts) : getRows(TABLES.CONTRACT_WORK, 60_000),
    preloadedContext?.contractors ? Promise.resolve(preloadedContext.contractors) : getRows(TABLES.CONTRACTOR, 60_000).catch(() => []),
    preloadedContext?.cars ? Promise.resolve(preloadedContext.cars) : getRows(TABLES.CAR, 120_000).catch(() => []),
    preloadedContext?.people ? Promise.resolve(preloadedContext.people) : getRows(TABLES.PEOPLE, 120_000).catch(() => []),
    preloadedContext?.products ? Promise.resolve(preloadedContext.products) : getRows(TABLES.PRODUCT, 120_000).catch(() => []),
  ]);

  const contractorMap = new Map<string, string>();
  for (const c of contractors) {
    const id = String(c["id_Contractor"] || c.id || "").trim();
    const name = String(c["ชื่อเล่น"] || c["ชื่อ-นามสกุล"] || c["ชื่อผู้รับเหมา"] || c.name || "").trim();
    if (id && name) contractorMap.set(id, name);
  }

  const projectMap = new Map<string, SheetRow>();
  for (const item of projects) {
    const k1 = String(item["ID Project"] || "").trim();
    const k2 = String(item.id || "").trim();
    const k3 = String(item["ชื่อ Project"] || "").trim();
    const k4 = String(item.name || "").trim();
    if (k1) projectMap.set(k1, item);
    if (k2) projectMap.set(k2, item);
    if (k3) projectMap.set(k3, item);
    if (k4) projectMap.set(k4, item);
  }

  const storeMap = new Map<string, SheetRow>();
  for (const item of stores) {
    const k1 = String(item["id_store"] || "").trim();
    const k2 = String(item.id || "").trim();
    const k3 = String(item["ชื่อร้านค้า"] || "").trim();
    const k4 = String(item.name || "").trim();
    if (k1) storeMap.set(k1, item);
    if (k2) storeMap.set(k2, item);
    if (k3) storeMap.set(k3, item);
    if (k4) storeMap.set(k4, item);
  }

  const contractMap = new Map<string, SheetRow>();
  for (const item of rawContracts) {
    const contractorId = String(item["id_Contractor"] || "").trim();
    const contractorName = contractorMap.get(contractorId) || String(item["ชื่อเล่น"] || item["ผู้รับเหมา"] || "").trim();

    const hydratedItem = {
      ...item,
      "ชื่อเล่น": contractorName || item["ชื่อเล่น"] || "",
      "ผู้รับเหมา": contractorName || item["ผู้รับเหมา"] || ""
    };

    const k1 = String(item["id_Conwork"] || "").trim();
    const k2 = String(item.id || "").trim();
    const k3 = String(item["ชื่อเล่น"] || "").trim();
    const k4 = String(item["รายละเอียดงาน"] || "").trim();
    if (k1) contractMap.set(k1, hydratedItem);
    if (k2) contractMap.set(k2, hydratedItem);
    if (k3) contractMap.set(k3, hydratedItem);
    if (k4) contractMap.set(k4, hydratedItem);
  }

  const carMap = new Map<string, SheetRow>();
  for (const item of cars) {
    const k1 = String(item["id_car"] || item.id || "").trim();
    const plate = String(item["หมายเลขทะเบียน"] || item.plate_no || item["ทะเบียน"] || "").trim();
    if (k1) {
      carMap.set(k1, item);
      carMap.set(k1.toLowerCase(), item);
      carMap.set(k1.toUpperCase(), item);
    }
    if (plate) {
      carMap.set(plate, item);
      carMap.set(plate.toLowerCase(), item);
      carMap.set(plate.replace(/\s+/g, ""), item);
    }
  }

  const peopleMap = new Map<string, SheetRow>();
  for (const item of people) {
    const k1 = String(item["รหัสพนักงาน"] || item.id || "").trim();
    const nick = String(item["ชื่อเล่น"] || item.nickname || "").trim();
    const full = String(item["ชื่อ-นามสกุล"] || item.full_name || "").trim();
    if (k1) {
      peopleMap.set(k1, item);
      peopleMap.set(k1.toLowerCase(), item);
      peopleMap.set(k1.toUpperCase(), item);
    }
    if (nick) peopleMap.set(nick, item);
    if (full) peopleMap.set(full, item);
  }

  const productMap = new Map<string, SheetRow>();
  for (const item of products) {
    const k1 = String(item["id_product"] || item["รหัสสินค้า"] || item.id || "").trim();
    const name = String(item["ชื่อประเภทสินค้า"] || item["ชื่อสินค้า"] || item.name || "").trim();
    if (k1) productMap.set(k1, item);
    if (name) productMap.set(name, item);
  }

  const indexedContext = { projectMap, storeMap, contractMap, carMap, peopleMap, productMap };
  return rows.map(row => applyBillFormulasFast({ ...row }, indexedContext));
}

export async function applyContractFormulas(row: SheetRow) {
  const [hydrated] = await hydrateContractRows([{ ...row }]);
  return hydrated || row;
}

export function applyProjectFormulas(row: SheetRow) {
  const output = { ...row };
  const workAmount = toNumber(output["ยอดงาน"]);
  const vatAmount = toNumber(output["ยอดรวม vat"]);

  if (workAmount > 0 && (!hasValue(output["ยอดรวม vat"]) || vatAmount === 0)) {
    output["ยอดรวม vat"] = Math.round(workAmount * 1.07 * 100) / 100;
  } else if (vatAmount > 0 && (!hasValue(output["ยอดงาน"]) || workAmount === 0)) {
    output["ยอดงาน"] = Math.round((vatAmount / 1.07) * 100) / 100;
  }

  // Calculate overall budget cap "งบไม่เกิน"
  const currentCap = toNumber(output["งบไม่เกิน"]);
  const recalculatedWorkAmount = toNumber(output["ยอดงาน"]);
  const recalculatedVatAmount = toNumber(output["ยอดรวม vat"]);

  const categorySum = Object.keys(output)
    .filter(k => k.startsWith("งบไม่เกิน") && k !== "งบไม่เกิน")
    .reduce((sum, k) => sum + toNumber(output[k]), 0);

  if (categorySum > 0) {
    // Priority 1: Sub-category allocations exist (e.g. 3,000,000 in Category Budget Matrix)
    output["งบไม่เกิน"] = categorySum;
  } else if (
    currentCap === 0 ||
    (recalculatedVatAmount > 0 && currentCap === recalculatedVatAmount && recalculatedWorkAmount > 0 && recalculatedWorkAmount !== recalculatedVatAmount)
  ) {
    // Priority 2: No sub-category allocations, and currentCap is empty/0 or incorrectly set to vatAmount
    if (recalculatedWorkAmount > 0) {
      output["งบไม่เกิน"] = recalculatedWorkAmount;
    } else if (recalculatedVatAmount > 0) {
      output["งบไม่เกิน"] = Math.round(recalculatedVatAmount / 1.07);
    }
  }

  if (!hasValue(output["วันที่"])) output["วันที่"] = getTodayDateIso();
  if (!hasValue(output["color"])) output["color"] = "Red";
  return output;
}

export function hydrateProjectRows(rows: SheetRow[]): SheetRow[] {
  return rows.map(row => applyProjectFormulas(row));
}

export async function hydrateContractRows(
  rows: SheetRow[],
  preloadedContext?: { projects?: SheetRow[]; contractors?: SheetRow[]; dataRows?: SheetRow[]; targetYear?: number }
) {
  const context = await getContractFormulaContext(preloadedContext);
  
  // Build lookup maps for O(1) matching
  const projectMap = new Map<string, SheetRow>();
  for (const p of context.projects) {
    const k1 = String(p["ID Project"] || "").trim();
    const k2 = String(p.id || "").trim();
    if (k1) projectMap.set(k1, p);
    if (k2) projectMap.set(k2, p);
  }

  // Pre-calculate contractor annual quota for specified or current calendar year
  const hydratedContractors = hydrateContractorsWithYearlySpend(
    context.contractors,
    context.dataRows,
    preloadedContext?.targetYear
  );
  const contractorMap = new Map<string, SheetRow>();
  for (const c of hydratedContractors) {
    const k1 = String(c["id_Contractor"] || c.id || "").trim();
    const k2 = String(c.id || "").trim();
    const k3 = String(c["ชื่อเล่น"] || "").trim();
    const k4 = String(c["ชื่อ-นามสกุล"] || "").trim();
    if (k1) contractorMap.set(k1, c);
    if (k2) contractorMap.set(k2, c);
    if (k3 && !contractorMap.has(k3)) contractorMap.set(k3, c);
    if (k4 && !contractorMap.has(k4)) contractorMap.set(k4, c);
  }

  return rows.map(row => applyContractFormulasWithFastContext(row, { projectMap, contractorMap, dataRows: context.dataRows }));
}
async function getContractFormulaContext(preloadedContext?: { projects?: SheetRow[]; contractors?: SheetRow[]; dataRows?: SheetRow[]; targetYear?: number }) {
  const [projects, contractors, dataRows] = await Promise.all([
    preloadedContext?.projects ? Promise.resolve(preloadedContext.projects) : getRows(TABLES.PROJECT, 60_000).catch(() => []),
    preloadedContext?.contractors ? Promise.resolve(preloadedContext.contractors) : getRows(TABLES.CONTRACTOR, 180_000).catch(() => []),
    preloadedContext?.dataRows ? Promise.resolve(preloadedContext.dataRows) : getRows(TABLES.DATA, 20_000, 3_000).catch(() => []),
  ]);
  return { projects, contractors, dataRows };
}

function applyContractFormulasWithFastContext(
  row: SheetRow,
  context: { projectMap: Map<string, SheetRow>; contractorMap: Map<string, SheetRow>; dataRows: SheetRow[] }
) {
  const pId = String(row["ID Project"] || row.project_id || "").trim();
  const project = context.projectMap.get(pId);
  if (project) {
    row["ชื่อ Project"] = project["ชื่อ Project"] || row["ชื่อ Project"] || "";
  }

  const cId = String(row["id_Contractor"] || row.contractor_id || "").trim();
  const contractor = context.contractorMap.get(cId);
  if (contractor) {
    const cName = contractor["ชื่อเล่น"] || contractor["ชื่อ-นามสกุล"] || row["ชื่อเล่น"] || "";
    row["ชื่อเล่น"] = cName;
    row["ผู้รับเหมา"] = cName;
    row["ช่าง"] = cName;
    row["เบอร์โทรศัพท์"] = contractor["เบอร์โทรศัพท์"] || contractor["เบอร์โทร"] || row["เบอร์โทรศัพท์"] || row["เบอร์โทร"] || "";
    row["_contractorAnnualLimit"] = contractor["จำกัดยอด/ปี"] || contractor.annual_limit;
    row["_contractorType"] = contractor["ประเภท"] || contractor.contractor_type;
    row["_contractorYearlySpent"] = contractor["ยอดเบิกจ่ายปีนี้"];
    row["_contractorRemainingQuota"] = contractor["คงเหลือ"];
    row["_contractorLimitStatus"] = contractor._limitStatus || contractor["สถานะ"];
    row["_contractorSpentPercent"] = contractor._spentPercent;
  } else {
    row["ช่าง"] = row["ชื่อเล่น"] || row["ผู้รับเหมา"] || row["ชื่อ-นามสกุล"] || "";
    row["เบอร์โทรศัพท์"] = row["เบอร์โทรศัพท์"] || row["เบอร์โทร"] || "";
  }

  if (!row["วันที่"] && (row["date"] || row["contract_date"] || row["created_at"])) {
    row["วันที่"] = row["date"] || row["contract_date"] || row["created_at"];
  }

  const paid = computePaidForContract(row, context.dataRows);
  const hireAmount = toNumber(firstValue(row, ["ยอดเงินจ้าง"]));
  row["ยอดเงินจ่าย"] = paid;
  row["ค่าแรงคงเหลือ"] = hireAmount - paid;
  return row;
}


function computePaidForContract(contractRow: SheetRow, dataRows: SheetRow[]): number {
  const cConworkId = String(contractRow["id_Conwork"] || contractRow.id || "").trim();
  const cProjectId = String(contractRow["ID Project"] || contractRow.project_id || "").trim();
  const cContractorId = String(contractRow["id_Contractor"] || contractRow.contractor_id || "").trim();
  const cName = String(contractRow["ชื่อเล่น"] || contractRow["ผู้รับเหมา"] || contractRow["ชื่อ-นามสกุล"] || "").trim();

  let totalPaid = 0;

  for (const b of dataRows) {
    if (!isCommittedBill(b)) continue;

    // Only count bills that are actually paid/withdrawn towards "ยอดเงินจ่าย"
    const status = String(b["สถานะ"] || b.status || "").trim().toLowerCase();
    const isPaid = status.includes("เบิกแล้ว") || status === "paid" || status === "withdrawn" || Boolean(b.paid_date) || Boolean(b.paid_at);
    if (!isPaid) continue;

    const bVendorType = String(b["ร้านค้า/ผู้รับเหมา"] || "").trim();
    const bContractorRef = String(b["ผู้รับเหมา"] || b.contractor_id || b.conwork_id || "").trim();
    const bVendorRef = String(b["ร้าน/บุคคล"] || "").trim();
    const bProjectId = String(b["ID Project"] || b.project_id || "").trim();

    const isContractorBill = bVendorType === "ผู้รับเหมา" || bContractorRef !== "" || bVendorRef.startsWith("CW");
    if (!isContractorBill) continue;

    let isMatch = false;

    // 1. Match on id_Conwork ID (e.g. "CW1001")
    if (cConworkId && (bContractorRef === cConworkId || bVendorRef === cConworkId || bContractorRef.includes(cConworkId) || bVendorRef.includes(cConworkId))) {
      isMatch = true;
    }
    // 2. Match by Project ID + Contractor ID / Name
    else if (cProjectId && bProjectId === cProjectId) {
      if (cContractorId && (bContractorRef === cContractorId || bVendorRef === cContractorId)) {
        isMatch = true;
      } else if (cName && (bContractorRef === cName || bVendorRef === cName || bContractorRef.includes(cName) || bVendorRef.includes(cName))) {
        isMatch = true;
      }
    }
    // 3. Match by Contractor Name globally
    else if (cName && (bContractorRef === cName || bVendorRef === cName)) {
      isMatch = true;
    }

    if (isMatch) {
      const amt = toNumber(b["ค่าแรง"]) || toNumber(b["ยอดเงิน"]) || toNumber(b["ยอดโอน"]);
      totalPaid += amt;
    }
  }

  return totalPaid;
}

function firstValue(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (hasValue(value)) return value;
  }
  return "";
}

async function getBillFormulaContext() {
  const [projects, stores, contracts, cars, people, products] = await Promise.all([
    getRows(TABLES.PROJECT, 120_000),
    getRows(TABLES.STORE, 120_000),
    getRows(TABLES.CONTRACT_WORK, 60_000),
    getRows(TABLES.CAR, 120_000).catch(() => []),
    getRows(TABLES.PEOPLE, 120_000).catch(() => []),
    getRows(TABLES.PRODUCT, 120_000).catch(() => [])
  ]);

  const projectMap = new Map<string, SheetRow>();
  for (const item of projects) {
    const key = String(item["ID Project"] || "").trim();
    if (key) projectMap.set(key, item);
  }

  const storeMap = new Map<string, SheetRow>();
  for (const item of stores) {
    const key = String(item["id_store"] || "").trim();
    if (key) storeMap.set(key, item);
  }

  const contractMap = new Map<string, SheetRow>();
  for (const item of contracts) {
    const key = String(item["id_Conwork"] || "").trim();
    if (key) contractMap.set(key, item);
  }

  const carMap = new Map<string, SheetRow>();
  for (const item of cars) {
    const k1 = String(item["id_car"] || item.id || "").trim();
    const plate = String(item["หมายเลขทะเบียน"] || item.plate_no || item["ทะเบียน"] || "").trim();
    if (k1) {
      carMap.set(k1, item);
      carMap.set(k1.toLowerCase(), item);
      carMap.set(k1.toUpperCase(), item);
    }
    if (plate) {
      carMap.set(plate, item);
      carMap.set(plate.toLowerCase(), item);
      carMap.set(plate.replace(/\s+/g, ""), item);
    }
  }

  const peopleMap = new Map<string, SheetRow>();
  for (const item of people) {
    const k1 = String(item["รหัสพนักงาน"] || item.id || "").trim();
    const nick = String(item["ชื่อเล่น"] || item.nickname || "").trim();
    const full = String(item["ชื่อ-นามสกุล"] || item.full_name || "").trim();
    if (k1) {
      peopleMap.set(k1, item);
      peopleMap.set(k1.toLowerCase(), item);
      peopleMap.set(k1.toUpperCase(), item);
    }
    if (nick) peopleMap.set(nick, item);
    if (full) peopleMap.set(full, item);
  }

  const productMap = new Map<string, SheetRow>();
  for (const item of products) {
    const k1 = String(item["id_product"] || item["รหัสสินค้า"] || item.id || "").trim();
    const name = String(item["ชื่อประเภทสินค้า"] || item["ชื่อสินค้า"] || item.name || "").trim();
    if (k1) productMap.set(k1, item);
    if (name) productMap.set(name, item);
  }

  return { projectMap, storeMap, contractMap, carMap, peopleMap, productMap };
}

function applyBillFormulasFast(
  row: SheetRow,
  context: {
    projectMap: Map<string, SheetRow>;
    storeMap: Map<string, SheetRow>;
    contractMap: Map<string, SheetRow>;
    carMap?: Map<string, SheetRow>;
    peopleMap?: Map<string, SheetRow>;
    productMap?: Map<string, SheetRow>;
  }
) {
  const projKey = String(row["ID Project"] || "").trim();
  if (projKey) {
    const project = context.projectMap.get(projKey);
    if (project) {
      row["ชื่อ Project"] = project["ชื่อ Project"] || row["ชื่อ Project"] || "";
      row["ชื่อบริษัท"] = project["ชื่อบริษัท"] || row["ชื่อบริษัท"] || "";
    }
  }

  const rawContractorId = String(row["ผู้รับเหมา"] || row.contractor_id || row.conwork_id || "").trim();
  const rawVendorStr = String(row["ร้าน/บุคคล"] || "").trim();
  if (!row["_rawVendor"]) row["_rawVendor"] = rawVendorStr;
  if (!row["_rawContractor"]) row["_rawContractor"] = rawContractorId;

  const contractKey = rawContractorId || (rawVendorStr.startsWith("CW") ? rawVendorStr : "");
  let contract: SheetRow | undefined;
  if (contractKey) {
    contract = context.contractMap.get(contractKey);
    if (contract) {
      row["รายละเอียดงาน"] = contract["รายละเอียดงาน"] || row["รายละเอียดงาน"] || "";
      row["ค่าแรงคงเหลือ"] = contract["ค่าแรงคงเหลือ"] || "";
    }
  }

  const items = parseBillItems(row);
  if (items.length > 0) {
    const catSums: Record<string, number> = {};
    for (const item of items) {
      const catName = String(item.categoryType || item.category || item.type || "").trim();
      const field = getExpenseFieldForCategory(catName);
      const amt = toNumber(item.amount ?? item.price ?? item.total);
      catSums[field] = (catSums[field] || 0) + amt;
    }
    const catKeys = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];
    for (const k of catKeys) {
      if (catSums[k] !== undefined && catSums[k] > 0) {
        row[k] = catSums[k];
      }
    }
  }

  const sumAmount = computeBillAmount(row);
  row["ยอดเงิน"] = sumAmount > 0 ? sumAmount : (hasValue(row["ยอดเงิน"]) ? toNumber(row["ยอดเงิน"]) : 0);
  row["ค่าแรง+พนักงาน+อื่น"] = toNumber(row["ค่าแรง"]) + toNumber(row["พนักงาน"]) + toNumber(row["อื่นๆ"]);
  const isDeduct = isDeductActive(row["หัก"]);
  row["3เปอร์"] = isDeduct ? deductAmount(row) : "";
  row["รวม"] = isDeduct ? toNumber(row["ค่าแรง+พนักงาน+อื่น"]) - toNumber(row["3เปอร์"]) : "";
  row["ค่าแรง(หัก)"] = isDeduct ? computeBillDeductMultiplier(row) : "";
  row["ยอดโอน(มีvat)"] = row["ยอดเงิน"];
  row["ยอดโอน(มีหัก)"] = isDeduct ? computeBillTransferAmount(row) : "";
  row["ยอดโอน(vat,หัก)"] = hasValue(row["vat"]) && isDeduct ? computeBillTransferAmount(row) : "";
  row["ยอดโอน"] = computeBillTransferAmount(row);
  
  const vendorNameResult = vendorNameFast(row, context.storeMap, contract);
  row["ร้าน/บุคคล"] = vendorNameResult;
  if (contract || rawContractorId || rawVendorStr.startsWith("CW") || String(row["ร้านค้า/ผู้รับเหมา"]).trim() === "ผู้รับเหมา") {
    row["ผู้รับเหมา"] = vendorNameResult;
  }

  const cat = String(row["ประเภท"] || row.category || "").trim();
  const rawP = String(row["สินค้า"] || row.product || "").trim();
  const itemFast = String(row["รายการ"] || row.sub_category || "").trim();
  const toolFast = String(row["ชื่อเครื่องมือ"] || "").trim();
  const carFast = String(row["ทะเบียน"] || row.plate_no || "").trim();
  const staffFast = String(row["ชื่อพนักงาน"] || row.staff_name || "").trim();
  const dFast = String(row["รายละเอียดงาน"] || row.work_details || "").trim();

  // Resolve Product name if it's an ID
  let pFast = rawP;
  if (context.productMap && rawP) {
    const prod = context.productMap.get(rawP) || context.productMap.get(rawP.toLowerCase());
    if (prod) {
      pFast = prod["ชื่อประเภทสินค้า"] || prod["ชื่อสินค้า"] || prod.name || rawP;
    }
  }

  // Resolve Vehicle display name (e.g. "1ฒล3982 (Toyota)" or "1ฒล3982")
  let carName = carFast;
  if (context.carMap && carFast) {
    const car = context.carMap.get(carFast) || context.carMap.get(carFast.toLowerCase()) || context.carMap.get(carFast.toUpperCase());
    if (car) {
      const plate = String(car["หมายเลขทะเบียน"] || car.plate_no || "").trim();
      const brand = String(car["ยี่ห้อรถ"] || car.brand || "").trim();
      if (plate) {
        carName = brand && !plate.includes(brand) ? `${plate} (${brand})` : plate;
      }
    }
  }

  // Resolve Staff display name
  let staffName = staffFast;
  if (context.peopleMap && staffFast) {
    const person = context.peopleMap.get(staffFast) || context.peopleMap.get(staffFast.toLowerCase()) || context.peopleMap.get(staffFast.toUpperCase());
    if (person) {
      const nick = String(person["ชื่อเล่น"] || person.nickname || "").trim();
      const full = String(person["ชื่อ-นามสกุล"] || person.full_name || "").trim();
      staffName = nick || full || staffFast;
    }
  }

  // Category-aware description construction
  let combinedDesc = "";
  if (cat.includes("น้ำมัน") || cat.startsWith("4.")) {
    combinedDesc = carName ? `น้ำมัน (${carName})` : (pFast || "น้ำมัน");
    if (!row["สินค้า"]) row["สินค้า"] = "น้ำมัน";
  } else if (cat.includes("ซ่อมรถ") || cat.startsWith("5.")) {
    combinedDesc = carName ? `ซ่อมรถ (${carName})` : (pFast || "ซ่อมรถ");
    if (!row["สินค้า"]) row["สินค้า"] = "ซ่อมรถ";
  } else if (cat.includes("พนักงาน") || cat.startsWith("3.")) {
    combinedDesc = staffName ? `พนักงาน (${staffName})` : (pFast || "พนักงาน");
    if (!row["สินค้า"]) row["สินค้า"] = "พนักงาน";
  } else if (cat.includes("เครื่องมือ") || cat.startsWith("7.")) {
    combinedDesc = toolFast ? `เครื่องมือ (${toolFast})` : (pFast || "เครื่องมือ");
    if (!row["สินค้า"]) row["สินค้า"] = toolFast || "เครื่องมือ";
  } else if (cat.includes("อื่นๆ") || cat.startsWith("8.")) {
    combinedDesc = itemFast ? `อื่นๆ (${itemFast})` : (pFast || "อื่นๆ");
    if (!row["สินค้า"]) row["สินค้า"] = itemFast || "อื่นๆ";
  } else {
    combinedDesc = pFast;
    if (itemFast) {
      combinedDesc = combinedDesc ? `${combinedDesc} (${itemFast})` : itemFast;
    } else if (toolFast) {
      combinedDesc = combinedDesc ? `${combinedDesc} (${toolFast})` : toolFast;
    } else if (carName) {
      combinedDesc = combinedDesc ? `${combinedDesc} (${carName})` : carName;
    } else if (staffName) {
      combinedDesc = combinedDesc ? `${combinedDesc} (${staffName})` : staffName;
    } else if (dFast) {
      combinedDesc = combinedDesc ? `${combinedDesc} / ${dFast}` : dFast;
    }
  }
  row["สินค้า/ทำงาน"] = combinedDesc || row["สินค้า/ทำงาน"] || row.description || "";
  return row;
}

function vendorNameFast(row: SheetRow, storeMap: Map<string, SheetRow>, contract?: SheetRow) {
  const vendorType = String(row["ร้านค้า/ผู้รับเหมา"] || "").trim();
  const rawVendor = String(row["ร้าน/บุคคล"] || "").trim();
  const rawContractor = String(row["ผู้รับเหมา"] || "").trim();

  const isContractor = vendorType === "ผู้รับเหมา" || (!vendorType && (rawContractor || rawVendor.startsWith("CW") || contract));

  if (isContractor) {
    const nameFromContract = contract?.["ชื่อเล่น"] || contract?.["ชื่อ-นามสกุล"] || contract?.["ผู้รับเหมา"];
    if (nameFromContract) return nameFromContract;
    if (rawVendor && !rawVendor.startsWith("CW")) return rawVendor;
    if (rawContractor && !rawContractor.startsWith("CW")) return rawContractor;
    return contract?.["id_Conwork"] || rawVendor || rawContractor || "";
  }
  const storeKey = String(row["ร้านค้า"] || row.store_id || "").trim();
  if (!storeKey) return rawVendor || "";
  const store = storeMap.get(storeKey);
  return store?.["ชื่อร้านค้า"] || store?.["ชื่อเต็ม"] || store?.name || rawVendor || storeKey;
}

function applyBillFormulasWithContext(
  row: SheetRow,
  context: {
    projects: SheetRow[];
    stores: SheetRow[];
    contracts: SheetRow[];
    cars?: SheetRow[];
    people?: SheetRow[];
    products?: SheetRow[];
  }
) {
  const project = context.projects.find(item => String(item["ID Project"]) === String(row["ID Project"]));
  if (project) {
    row["ชื่อ Project"] = project["ชื่อ Project"] || row["ชื่อ Project"] || "";
    row["ชื่อบริษัท"] = project["ชื่อบริษัท"] || row["ชื่อบริษัท"] || "";
  }

  const contract = context.contracts.find(item => String(item["id_Conwork"]) === String(row["ผู้รับเหมา"]));
  if (contract) {
    row["รายละเอียดงาน"] = contract["รายละเอียดงาน"] || row["รายละเอียดงาน"] || "";
    row["ค่าแรงคงเหลือ"] = contract["ค่าแรงคงเหลือ"] || "";
  }

  const sumAmount = computeBillAmount(row);
  row["ยอดเงิน"] = sumAmount > 0 ? sumAmount : (hasValue(row["ยอดเงิน"]) ? toNumber(row["ยอดเงิน"]) : 0);
  row["ค่าแรง+พนักงาน+อื่น"] = toNumber(row["ค่าแรง"]) + toNumber(row["พนักงาน"]) + toNumber(row["อื่นๆ"]);
  const isDeduct = isDeductActive(row["หัก"]);
  row["3เปอร์"] = isDeduct ? deductAmount(row) : "";
  row["รวม"] = isDeduct ? toNumber(row["ค่าแรง+พนักงาน+อื่น"]) - toNumber(row["3เปอร์"]) : "";
  row["ค่าแรง(หัก)"] = isDeduct ? computeBillDeductMultiplier(row) : "";
  row["ยอดโอน(มีvat)"] = row["ยอดเงิน"];
  row["ยอดโอน(มีหัก)"] = isDeduct ? computeBillTransferAmount(row) : "";
  row["ยอดโอน(vat,หัก)"] = hasValue(row["vat"]) && isDeduct ? computeBillTransferAmount(row) : "";
  row["ยอดโอน"] = computeBillTransferAmount(row);
  row["ร้าน/บุคคล"] = vendorName(row, context.stores, contract);
  
  const cat = String(row["ประเภท"] || row.category || "").trim();
  const rawP = String(row["สินค้า"] || row.product || "").trim();
  const itemVal = String(row["รายการ"] || row.sub_category || "").trim();
  const toolVal = String(row["ชื่อเครื่องมือ"] || "").trim();
  const carVal = String(row["ทะเบียน"] || row.plate_no || "").trim();
  const staffVal = String(row["ชื่อพนักงาน"] || row.staff_name || "").trim();
  const dVal = String(row["รายละเอียดงาน"] || row.work_details || "").trim();

  let pVal = rawP;
  if (context.products && rawP) {
    const prod = context.products.find(item => String(item["id_product"]) === rawP || String(item["รหัสสินค้า"]) === rawP || String(item.id) === rawP);
    if (prod) {
      pVal = prod["ชื่อประเภทสินค้า"] || prod["ชื่อสินค้า"] || prod.name || rawP;
    }
  }

  let carName = carVal;
  if (context.cars && carVal) {
    const car = context.cars.find(item => String(item["id_car"]) === carVal || String(item.id) === carVal || String(item["หมายเลขทะเบียน"]) === carVal);
    if (car) {
      const plate = String(car["หมายเลขทะเบียน"] || car.plate_no || "").trim();
      const brand = String(car["ยี่ห้อรถ"] || car.brand || "").trim();
      if (plate) {
        carName = brand && !plate.includes(brand) ? `${plate} (${brand})` : plate;
      }
    }
  }

  let staffName = staffVal;
  if (context.people && staffVal) {
    const person = context.people.find(item => String(item["รหัสพนักงาน"]) === staffVal || String(item.id) === staffVal);
    if (person) {
      const nick = String(person["ชื่อเล่น"] || person.nickname || "").trim();
      const full = String(person["ชื่อ-นามสกุล"] || person.full_name || "").trim();
      staffName = nick || full || staffVal;
    }
  }

  let combinedVal = "";
  if (cat.includes("น้ำมัน") || cat.startsWith("4.")) {
    combinedVal = carName ? `น้ำมัน (${carName})` : (pVal || "น้ำมัน");
    if (!row["สินค้า"]) row["สินค้า"] = "น้ำมัน";
  } else if (cat.includes("ซ่อมรถ") || cat.startsWith("5.")) {
    combinedVal = carName ? `ซ่อมรถ (${carName})` : (pVal || "ซ่อมรถ");
    if (!row["สินค้า"]) row["สินค้า"] = "ซ่อมรถ";
  } else if (cat.includes("พนักงาน") || cat.startsWith("3.")) {
    combinedVal = staffName ? `พนักงาน (${staffName})` : (pVal || "พนักงาน");
    if (!row["สินค้า"]) row["สินค้า"] = "พนักงาน";
  } else if (cat.includes("เครื่องมือ") || cat.startsWith("7.")) {
    combinedVal = toolVal ? `เครื่องมือ (${toolVal})` : (pVal || "เครื่องมือ");
    if (!row["สินค้า"]) row["สินค้า"] = toolVal || "เครื่องมือ";
  } else if (cat.includes("อื่นๆ") || cat.startsWith("8.")) {
    combinedVal = itemVal ? `อื่นๆ (${itemVal})` : (pVal || "อื่นๆ");
    if (!row["สินค้า"]) row["สินค้า"] = itemVal || "อื่นๆ";
  } else {
    combinedVal = pVal;
    if (itemVal) {
      combinedVal = combinedVal ? `${combinedVal} (${itemVal})` : itemVal;
    } else if (toolVal) {
      combinedVal = combinedVal ? `${combinedVal} (${toolVal})` : toolVal;
    } else if (carName) {
      combinedVal = combinedVal ? `${combinedVal} (${carName})` : carName;
    } else if (staffName) {
      combinedVal = combinedVal ? `${combinedVal} (${staffName})` : staffName;
    } else if (dVal) {
      combinedVal = combinedVal ? `${combinedVal} / ${dVal}` : dVal;
    }
  }

  row["สินค้า/ทำงาน"] = combinedVal || row["สินค้า/ทำงาน"] || row.description || "";
  return row;
}

function vendorName(row: SheetRow, stores: SheetRow[], contract?: SheetRow) {
  const vendorType = String(row["ร้านค้า/ผู้รับเหมา"] || "").trim();
  if (vendorType === "ผู้รับเหมา") return contract?.["ชื่อเล่น"] || contract?.["ชื่อ-นามสกุล"] || row["ผู้รับเหมา"] || row["ร้าน/บุคคล"] || "";
  const storeKey = String(row["ร้านค้า"] || row.store_id || "").trim();
  if (!storeKey) return row["ร้าน/บุคคล"] || "";
  const store = stores.find(item => String(item["id_store"]) === storeKey || String(item.id) === storeKey || String(item["ชื่อร้านค้า"]) === storeKey || String(item.name) === storeKey);
  return store?.["ชื่อร้านค้า"] || store?.["ชื่อเต็ม"] || store?.name || row["ร้าน/บุคคล"] || storeKey;
}

function deductAmount(row: SheetRow) {
  if (!isDeductActive(row["หัก"])) return 0;
  if (hasValue(row["จำนวนหัก"])) return toNumber(row["จำนวนหัก"]);
  const hasVat = isVatActive(row.vat);
  const baseAmt = toNumber(row["ยอดเงิน"]) || toNumber(row["ค่าแรง+พนักงาน+อื่น"]);
  const deductRate = parseDeductPercent(row["หัก"]);
  if (deductRate <= 0 || baseAmt <= 0) return 0;
  if (hasVat) {
    return (baseAmt / 1.07) * (deductRate / 100);
  }
  return (baseAmt * deductRate) / 100;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}
