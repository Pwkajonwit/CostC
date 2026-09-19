import { TABLES } from "@/lib/config";
import { hydrateContractRows } from "@/lib/formulas";
import { getRows } from "@/lib/db";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import {
  isMaterialCost,
  isLaborCost,
  isStaffCost,
  isFuelCost,
  isRepairCost,
  isMachineCost,
  isToolCost,
  isOtherExpense,
  isFuelProduct,
  isMachineProduct,
  isCarRepairProduct,
  isToolProduct,
  isOtherExpenseProduct,
  getCostCodeBudgetField
} from "@/lib/cost-codes";

const PRODUCT_BUDGET_MAP: Record<string, string> = {
  // Current Master Data Options (Dropdown values)
  "1 ปูน/ทราย/หิน": "งบไม่เกินปูนทรายหิน",
  "2 เหล็กเส้น/รูปพรรณ": "งบไม่เกินเหล็กเส้น",
  "3 คอนกรีตผสมเสร็จ": "งบไม่เกินคอนกรีต",
  "4 ไม้แบบ/ไม้อัด": "งบไม่เกินไม้แบบ",
  "5 วัสดุมุง": "งบไม่เกินวัสดุมุง",
  "6 ฝ้าผนัง": "งบไม่เกินฝ้าผนัง",
  "7 ปูพื้น": "งบไม่เกินปูพื้น",
  "8 กระจก": "งบไม่เกินกระจก",
  "9 ไฟฟ้า": "งบไม่เกินไฟฟ้า",
  "10 ประปา": "งบไม่เกินประปา",
  "11 อื่นๆ(วัสดุ)": "งบไม่เกินวัสดุอื่นๆ",
  "12 สีเคมี": "งบไม่เกินสีเคมี",
  "13 สุขภัณฑ์": "งบไม่เกินสุขภัณฑ์",
  "14 บิวอิน": "งบไม่เกินบิวอิน",
  "15 แอร์": "งบไม่เกินแอร์",
  "16 ดิน": "งบไม่เกินดิน",
  "17 หินทราย": "งบไม่เกินหินทราย",
  "18 เตรียมงาน": "งบไม่เกินเตรียมงาน",
  "101 น้ำมัน": "งบไม่เกินน้ำมัน",
  "102 ค่าขนส่ง": "งบไม่เกินค่าขนส่ง",
  "103 เครื่องจักร": "งบไม่เกินเครื่องจักร",
  "104 ซ่อมรถ": "งบไม่เกินซ่อมรถ",
  "200 ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",
  "ค่าขนส่ง": "งบไม่เกินค่าขนส่ง",
  "ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",
  "ซ่อมรถ": "งบไม่เกินซ่อมรถ",

  // Clean names without prefix numbers
  "ปูน/ทราย/หิน": "งบไม่เกินปูนทรายหิน",
  "เหล็กเส้น": "งบไม่เกินเหล็กเส้น",
  "เหล็กรูปพรรณ": "งบไม่เกินรูปพรรณ",
  "เหล็กเส้น/รูปพรรณ": "งบไม่เกินเหล็กเส้น",
  "คอนกรีต": "งบไม่เกินคอนกรีต",
  "คอนกรีตผสมเสร็จ": "งบไม่เกินคอนกรีต",
  "ไม้แบบ": "งบไม่เกินไม้แบบ",
  "ไม้แบบ/ไม้อัด": "งบไม่เกินไม้แบบ",
  "วัสดุมุง": "งบไม่เกินวัสดุมุง",
  "ฝ้าผนัง": "งบไม่เกินฝ้าผนัง",
  "ปูพื้น": "งบไม่เกินปูพื้น",
  "กระจก": "งบไม่เกินกระจก",
  "ไฟฟ้า": "งบไม่เกินไฟฟ้า",
  "ประปา": "งบไม่เกินประปา",
  "อื่นๆ(วัสดุ)": "งบไม่เกินวัสดุอื่นๆ",
  "สีเคมี": "งบไม่เกินสีเคมี",
  "สุขภัณฑ์": "งบไม่เกินสุขภัณฑ์",
  "บิวอิน": "งบไม่เกินบิวอิน",
  "แอร์": "งบไม่เกินแอร์",
  "ดิน": "งบไม่เกินดิน",
  "หินทราย": "งบไม่เกินหินทราย",
  "เตรียมงาน": "งบไม่เกินเตรียมงาน",
  "น้ำมัน": "งบไม่เกินน้ำมัน",
  "เครื่องจักร": "งบไม่เกินเครื่องจักร",

  // Legacy format
  "1 เหล็กเส้น": "งบไม่เกินเหล็กเส้น",
  "2 เหล็กรูปพรรณ": "งบไม่เกินรูปพรรณ",
  "3 คอนกรีต": "งบไม่เกินคอนกรีต",
  "4 ไม้แบบ": "งบไม่เกินไม้แบบ",
};

const LABOR_SUB_BUDGET_MAP: Record<string, string> = {
  "201": "งบไม่เกินค่าแรง_201",
  "202": "งบไม่เกินค่าแรง_202",
  "203": "งบไม่เกินค่าแรง_203",
  "204": "งบไม่เกินค่าแรง_204",
  "205": "งบไม่เกินค่าแรง_205",
  "206": "งบไม่เกินค่าแรง_206",
  "207": "งบไม่เกินค่าแรง_207",
  "208": "งบไม่เกินค่าแรง_208",
  "209": "งบไม่เกินค่าแรง_209",
  "210": "งบไม่เกินค่าแรง_210",
  "211": "งบไม่เกินค่าแรง_211",
  "212": "งบไม่เกินค่าแรง_212",
  "213": "งบไม่เกินค่าแรง_213",
  "214": "งบไม่เกินค่าแรง_214",
  "215": "งบไม่เกินค่าแรง_215",
  "216": "งบไม่เกินค่าแรง_216",
  "217": "งบไม่เกินค่าแรง_217",
  "218": "งบไม่เกินค่าแรง_218",
  "219": "งบไม่เกินค่าแรง_219",
  "220": "งบไม่เกินค่าแรง_220",
  "221": "งบไม่เกินค่าแรง_221",
  "222": "งบไม่เกินค่าแรง_222",
  "223": "งบไม่เกินค่าแรง_223",
  "301": "งบไม่เกินพนักงาน",
};

const MATERIAL_SUB_BUDGET_MAP: Record<string, string> = {
  "101": "งบไม่เกินเตรียมงาน",
  "102": "งบไม่เกินหินทราย",
  "103": "งบไม่เกินเสาเข็ม",
  "104": "งบไม่เกินเหล็กเส้น",
  "105": "งบไม่เกินไม้แบบ",
  "106": "งบไม่เกินคอนกรีต",
  "107": "งบไม่เกินรูปพรรณ",
  "108": "งบไม่เกินวัสดุมุง",
  "109": "งบไม่เกินก่อฉาบ",
  "110": "งบไม่เกินฝ้าผนัง",
  "111": "งบไม่เกินปูพื้น",
  "112": "งบไม่เกินกระจก",
  "113": "งบไม่เกินสีเคมี",
  "114": "งบไม่เกินสุขภัณฑ์",
  "115": "งบไม่เกินประปา",
  "116": "งบไม่เกินไฟฟ้า",
  "117": "งบไม่เกินแอร์",
  "118": "งบไม่เกินบิวอิน",
  "119": "งบไม่เกินเฟอร์นิเจอร์",
  "120": "งบไม่เกินภูมิทัศน์",
  "121": "งบไม่เกินแก้ไขเก็บงาน",
  "122": "งบไม่เกินตั้งนั่งร้าน",
  "123": "งบไม่เกินดำเนินการ",
  "501": "งบไม่เกินน้ำมัน",
  "502": "งบไม่เกินซ่อมรถ",
  "503": "งบไม่เกินเครื่องจักร",
  "504": "งบไม่เกินเครื่องมือ",
};

export function getProjectBudgetVal(proj: SheetRow, fieldName: string): number {
  if (!proj || !fieldName) return 0;
  const direct = toNumber(proj[fieldName]);
  if (direct > 0) return direct;
  if (proj.data && typeof proj.data === "object") {
    const fromData = toNumber((proj.data as any)[fieldName]);
    if (fromData > 0) return fromData;
  }
  return 0;
}

function getCategoryBudgetField(cat: string): string {
  if (isFuelCost(cat)) return "งบไม่เกินน้ำมัน";
  if (isRepairCost(cat)) return "งบไม่เกินซ่อมรถ";
  if (isMachineCost(cat)) return "งบไม่เกินเครื่องจักร";
  if (isToolCost(cat)) return "งบไม่เกินเครื่องมือ";
  if (isStaffCost(cat)) return "งบไม่เกินพนักงาน";
  if (isLaborCost(cat)) {
    const codeMatch = cat.match(/^(20[1-9]|21[0-9]|22[0-3])/);
    if (codeMatch && LABOR_SUB_BUDGET_MAP[codeMatch[1]]) {
      return LABOR_SUB_BUDGET_MAP[codeMatch[1]];
    }
    return "งบไม่เกินค่าแรง";
  }
  if (isOtherExpense(cat)) return "งบไม่เกินอื่นๆ";
  if (isMaterialCost(cat)) return "งบไม่เกินค่าของ";
  return "";
}

export type CategoryBudgetCheckResult = {
  hasBudgetCap: boolean;
  categoryLabel: string;
  targetBudgetField: string;
  budgetLimit: number;
  accumulatedAmount: number;
  currentBillAmount: number;
  totalAfterBill: number;
  remainingBeforeBill: number;
  remainingAfterBill: number;
  percentUsedBeforeBill?: number;
  percentUsedAfterBill: number;
  isOverBudget: boolean;
  isWarning: boolean;
  message: string;
  isProductLevel?: boolean;
  isSpecificSubBudget?: boolean;
  isOverallFallback?: boolean;
};

export async function validateBillRelations(row: SheetRow) {
  const projectId = String(row["ID Project"] || "").trim();
  const [projects, contracts, dataRows] = await Promise.all([
    getRows(TABLES.PROJECT, 120_000),
    row["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา"
      ? getRows(TABLES.CONTRACT_WORK, 60_000)
      : Promise.resolve([]),
    getRows(TABLES.DATA, 150_000).catch(() => [])
  ]);

  const project = projects.find(p => String(p["ID Project"] || "").trim() === projectId);
  if (!project) {
    throw new Error("ไม่พบ Project ที่เลือก");
  }

  // Validate Contractor Relations if contractor bill
  if (row["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา") {
    const contractId = String(row["ผู้รับเหมา"] || "").trim();
    const category = String(row["ประเภท"] || row.category || "").trim();
    const isOptionalCategory =
      category.startsWith("3.") ||
      category.includes("พนักงาน") ||
      category.startsWith("8.") ||
      category.includes("อื่นๆ");

    if (!contractId && isOptionalCategory) {
      // เมื่อเลือกผู้รับเหมา แต่เป็นหมวดพนักงาน หรือหมวดอื่นๆ และไม่ได้ระบุผู้รับเหมา -> ไม่บังคับ
    } else {
      const hydratedContracts = await hydrateContractRows(contracts);
      const contract = hydratedContracts.find(item => String(item.id_Conwork || "").trim() === contractId);
      if (!contract) throw new Error("ไม่พบรายการเปิดจ้างที่เลือก");
      if (String(contract["ID Project"] || "").trim() !== projectId) {
        throw new Error("รายการเปิดจ้างไม่อยู่ใน Project ที่เลือก");
      }
      if (toNumber(contract["ค่าแรงคงเหลือ"]) <= 0) {
        throw new Error("รายการเปิดจ้างนี้ชำระครบแล้ว");
      }
    }
  }

  // Check Category Budget Cap
  const budgetCheck = checkCategoryBudgetCap(row, project, dataRows);
  if (budgetCheck.hasBudgetCap && budgetCheck.isOverBudget) {
    console.warn(`[Category Budget Over-Cap Warning] ${budgetCheck.message}`);
  }
}

export function checkCategoryBudgetCap(
  row: SheetRow,
  project: SheetRow,
  existingBills: SheetRow[] = []
): CategoryBudgetCheckResult {
  const vendorType = String(row["ร้านค้า/ผู้รับเหมา"] || "").trim();
  const productVal = String(row["สินค้า"] || "").trim();
  const categoryVal = String(row["ประเภท"] || "").trim();

  let targetBudgetField = "";
  let categoryLabel = "";
  let isProductLevel = false;
  let isSpecificSubBudget = false;
  let isOverallFallback = false;

  // 1. หมวดค่าแรง / ผู้รับเหมา (201 - 223)
  const isLabor = isLaborCost(categoryVal) || vendorType === "ผู้รับเหมา";
  if (isLabor) {
    const codeMatch = categoryVal.match(/^(20[1-9]|21[0-9]|22[0-3])/);
    const subCode = codeMatch ? codeMatch[1] : "";
    const specificField = subCode ? LABOR_SUB_BUDGET_MAP[subCode] : "";

    if (specificField && getProjectBudgetVal(project, specificField) > 0) {
      targetBudgetField = specificField;
      categoryLabel = categoryVal || `201 เตรียมงาน`;
      isProductLevel = false;
      isSpecificSubBudget = true;
    } else if (getProjectBudgetVal(project, "งบไม่เกินค่าแรง") > 0) {
      targetBudgetField = "งบไม่เกินค่าแรง";
      const isOverall = !categoryVal || categoryVal.includes("ทั้งหมด") || categoryVal.includes("ภาพรวม") || categoryVal === "2.ค่าแรง" || categoryVal === "ค่าแรง";
      categoryLabel = isOverall ? "งบค่าแรงทั้งหมด" : `${categoryVal} (คุมงบรวมค่าแรง)`;
      isProductLevel = false;
      isSpecificSubBudget = isOverall;
      isOverallFallback = !isOverall;
    }
  }

  // 2. หมวดพนักงาน (301)
  if (!targetBudgetField && (isStaffCost(categoryVal) || vendorType === "พนักงาน")) {
    if (getProjectBudgetVal(project, "งบไม่เกินพนักงาน") > 0) {
      targetBudgetField = "งบไม่เกินพนักงาน";
      categoryLabel = categoryVal || "พนักงาน / ช่างประจำไซต์";
      isProductLevel = false;
      isSpecificSubBudget = true;
    } else if (getProjectBudgetVal(project, "งบไม่เกินค่าแรง") > 0) {
      targetBudgetField = "งบไม่เกินค่าแรง";
      categoryLabel = "ค่าแรง & บุคลากร (ภาพรวม)";
      isProductLevel = false;
      isSpecificSubBudget = false;
      isOverallFallback = true;
    }
  }

  // 3. หมวดค่าของ & วัสดุ & เครื่องมือ (101 - 123, 501 - 504)
  if (!targetBudgetField) {
    const rawCode = (productVal.match(/^(1[0-2][0-9]|50[1-4])/) || categoryVal.match(/^(1[0-2][0-9]|50[1-4])/))?.[1] || "";
    let specificMaterialField = rawCode ? MATERIAL_SUB_BUDGET_MAP[rawCode] : "";
    if (!specificMaterialField && productVal) {
      specificMaterialField = PRODUCT_BUDGET_MAP[productVal] || PRODUCT_BUDGET_MAP[productVal.replace(/^\d+\s*/, "").trim()] || getCostCodeBudgetField(productVal);
    }

    if (specificMaterialField && getProjectBudgetVal(project, specificMaterialField) > 0) {
      targetBudgetField = specificMaterialField;
      categoryLabel = productVal || categoryVal || specificMaterialField;
      isProductLevel = true;
      isSpecificSubBudget = true;
    } else if (isFuelCost(categoryVal) && getProjectBudgetVal(project, "งบไม่เกินน้ำมัน") > 0) {
      targetBudgetField = "งบไม่เกินน้ำมัน";
      categoryLabel = "501. น้ำมัน";
      isSpecificSubBudget = true;
    } else if (isRepairCost(categoryVal) && getProjectBudgetVal(project, "งบไม่เกินซ่อมรถ") > 0) {
      targetBudgetField = "งบไม่เกินซ่อมรถ";
      categoryLabel = "502. ซ่อมรถ";
      isSpecificSubBudget = true;
    } else if (isMachineCost(categoryVal) && getProjectBudgetVal(project, "งบไม่เกินเครื่องจักร") > 0) {
      targetBudgetField = "งบไม่เกินเครื่องจักร";
      categoryLabel = "503. เครื่องจักร";
      isSpecificSubBudget = true;
    } else if (isToolCost(categoryVal) && getProjectBudgetVal(project, "งบไม่เกินเครื่องมือ") > 0) {
      targetBudgetField = "งบไม่เกินเครื่องมือ";
      categoryLabel = "504. เครื่องมือ";
      isSpecificSubBudget = true;
    } else if (isOtherExpense(categoryVal) && (getProjectBudgetVal(project, "งบไม่เกินดำเนินการ") > 0 || getProjectBudgetVal(project, "งบไม่เกินอื่นๆ") > 0)) {
      targetBudgetField = getProjectBudgetVal(project, "งบไม่เกินดำเนินการ") > 0 ? "งบไม่เกินดำเนินการ" : "งบไม่เกินอื่นๆ";
      categoryLabel = categoryVal || "ดำเนินการ(อื่นๆ)";
      isSpecificSubBudget = true;
    } else if (getProjectBudgetVal(project, "งบไม่เกินค่าของ") > 0) {
      // Fallback สู่ภาพรวมค่าของ
      targetBudgetField = "งบไม่เกินค่าของ";
      const isOverall = !productVal && (!categoryVal || categoryVal.includes("ทั้งหมด") || categoryVal.includes("ภาพรวม") || categoryVal === "1.ค่าของ" || categoryVal === "ค่าของ");
      categoryLabel = productVal ? `${productVal} (คุมงบรวมค่าของ)` : "ค่าของ (ภาพรวม)";
      isProductLevel = false;
      isSpecificSubBudget = isOverall;
      isOverallFallback = !isOverall;
    }
  }

  const defaultResult: CategoryBudgetCheckResult = {
    hasBudgetCap: false,
    categoryLabel: categoryLabel || categoryVal || productVal || "ทั่วไป",
    targetBudgetField: "",
    budgetLimit: 0,
    accumulatedAmount: 0,
    currentBillAmount: 0,
    totalAfterBill: 0,
    remainingBeforeBill: 0,
    remainingAfterBill: 0,
    percentUsedAfterBill: 0,
    isOverBudget: false,
    isWarning: false,
    message: "",
    isSpecificSubBudget: false,
    isOverallFallback: false
  };

  if (!targetBudgetField) return defaultResult;

  let budgetLimit = getProjectBudgetVal(project, targetBudgetField);
  if (budgetLimit <= 0) return defaultResult;

  const currentProjectId = String(project["ID Project"] || "").trim();
  const currentRowKey = String(row._sheetRow || row["ลำดับ"] || "").trim();

  // Sum up accumulated bills for same project and category/product
  let accumulatedAmount = 0;
  for (const b of existingBills) {
    const bProjId = String(b["ID Project"] || "").trim();
    if (bProjId !== currentProjectId) continue;

    const bRowKey = String(b._sheetRow || b["ลำดับ"] || "").trim();
    if (currentRowKey && bRowKey === currentRowKey) continue; // Skip self when editing

    const bStatus = String(b["สถานะ"] || b.status || "").trim().toLowerCase();
    if (bStatus === "ยกเลิก" || bStatus === "ไม่อนุมัติ" || bStatus === "cancelled" || bStatus === "rejected") {
      continue;
    }

    const rawItems = (b as any).items || (b as any).data?.items || (b as any)["รายการสินค้า"] || (b as any).line_items;
    let bLineItems: any[] = [];
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      bLineItems = rawItems;
    } else if (typeof rawItems === "string" && rawItems.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(rawItems);
        if (Array.isArray(parsed)) bLineItems = parsed;
      } catch {}
    }

    const bVendorType = String(b["ร้านค้า/ผู้รับเหมา"] || b.vendor_type || "").trim();
    const bIsContractor = bVendorType === "ผู้รับเหมา" || Boolean(b["ผู้รับเหมา"]) || Boolean(b.contractor_id);

    if (bLineItems.length > 0) {
      if (targetBudgetField.startsWith("งบไม่เกินค่าแรง_")) {
        const subCode = targetBudgetField.replace("งบไม่เกินค่าแรง_", "");
        for (const it of bLineItems) {
          const itType = String(it.categoryType || it.type || it.category || "").trim();
          if (itType.startsWith(subCode) || itType.includes(subCode)) {
            accumulatedAmount += toNumber(it.amount ?? it.price ?? it.total ?? 0);
          }
        }
      } else if (isProductLevel) {
        for (const it of bLineItems) {
          const itType = String(it.categoryType || it.type || "").trim();
          if (bIsContractor || isLaborCost(itType)) continue;

          const itCat = String(it.category || it.name || "").trim();
          const itClean = itCat.replace(/^\d+[\.\s\-]+/, "").trim();
          const targetClean = productVal.replace(/^\d+[\.\s\-]+/, "").trim();
          const itField = PRODUCT_BUDGET_MAP[itCat] || PRODUCT_BUDGET_MAP[itClean] || getCostCodeBudgetField(itCat);
          if (itCat === productVal || (itClean && itClean === targetClean) || (itField && itField === targetBudgetField)) {
            accumulatedAmount += toNumber(it.amount ?? it.price ?? it.total ?? 0);
          }
        }
      } else {
        for (const it of bLineItems) {
          const itType = String(it.categoryType || it.type || "").trim();
          const itCat = String(it.category || "").trim();
          if (targetBudgetField === "งบไม่เกินค่าแรง") {
            if (bIsContractor || isLaborCost(itType) || isLaborCost(itCat)) {
              accumulatedAmount += toNumber(it.amount ?? it.price ?? it.total ?? 0);
            }
          } else if (targetBudgetField === "งบไม่เกินค่าของ") {
            if (!bIsContractor && (isMaterialCost(itType) || isMaterialCost(itCat) || (!itType && !isLaborCost(itCat)))) {
              accumulatedAmount += toNumber(it.amount ?? it.price ?? it.total ?? 0);
            }
          } else if (getCategoryBudgetField(itType) === targetBudgetField || getCategoryBudgetField(itCat) === targetBudgetField) {
            accumulatedAmount += toNumber(it.amount ?? it.price ?? it.total ?? 0);
          }
        }
      }
    } else {
      const bProd = String(b["สินค้า"] || "").trim();
      const bCat = String(b["ประเภท"] || "").trim();

      let isMatch = false;
      let matchedAmt = 0;
      if (targetBudgetField.startsWith("งบไม่เกินค่าแรง_")) {
        const subCode = targetBudgetField.replace("งบไม่เกินค่าแรง_", "");
        isMatch = Boolean(bCat.startsWith(subCode) || bCat.includes(subCode) || bProd.startsWith(subCode));
        if (isMatch) matchedAmt = toNumber(b["ค่าแรง"] || b["ยอดเงิน"] || 0);
      } else if (isProductLevel) {
        if (!bIsContractor && !isLaborCost(bCat)) {
          const rawCode = (productVal.match(/^(1[0-2][0-9]|50[1-4])/) || categoryVal.match(/^(1[0-2][0-9]|50[1-4])/))?.[1] || "";
          isMatch = Boolean(
            (productVal && (
              bProd === productVal ||
              bProd.replace(/^\d+\s*/, "").trim() === productVal.replace(/^\d+\s*/, "").trim()
            )) ||
            (rawCode && (bProd.startsWith(rawCode) || bCat.startsWith(rawCode)))
          );
          if (isMatch) matchedAmt = toNumber(b["ค่าของ"] || b["ยอดเงิน"] || 0);
        }
      } else if (targetBudgetField === "งบไม่เกินค่าของ") {
        const hasSeparateRepairBudget = getProjectBudgetVal(project, "งบไม่เกินซ่อมรถ") > 0;
        const isExcludedFromMaterial = Boolean(
          bIsContractor || isFuelCost(bCat) || (hasSeparateRepairBudget && isRepairCost(bCat)) || isMachineCost(bCat) || isToolCost(bCat) || isOtherExpense(bCat) ||
          toNumber(b["น้ำมัน"]) > 0 || (hasSeparateRepairBudget && toNumber(b["ซ่อมรถ"]) > 0) || toNumber(b["เครื่องจักร"]) > 0 || toNumber(b["เครื่องมือ"]) > 0 || toNumber(b["อื่นๆ"]) > 0 ||
          (bProd && (
            isFuelProduct(bProd) || isMachineProduct(bProd) || (hasSeparateRepairBudget && isCarRepairProduct(bProd)) || isToolProduct(bProd) ||
            bProd === "200 ดำเนินการ(อื่นๆ)" || bProd.startsWith("200")
          ))
        );
        isMatch = !isExcludedFromMaterial && Boolean(
          isMaterialCost(bCat) || (!bCat && bProd) || toNumber(b["ค่าของ"]) > 0 ||
          (!hasSeparateRepairBudget && (isRepairCost(bCat) || toNumber(b["ซ่อมรถ"]) > 0 || (bProd && isCarRepairProduct(bProd))))
        );
        if (isMatch) {
          matchedAmt = toNumber(b["ค่าของ"]) > 0 ? toNumber(b["ค่าของ"]) : getBillRowAmount(b);
        }
      } else if (targetBudgetField === "งบไม่เกินค่าแรง") {
        isMatch = Boolean(bIsContractor || isLaborCost(bCat) || toNumber(b["ค่าแรง"]) > 0);
        if (isMatch) {
          matchedAmt = toNumber(b["ค่าแรง"]) > 0 ? toNumber(b["ค่าแรง"]) : (bIsContractor ? toNumber(b["ยอดเงิน"] || 0) : 0);
        }
      } else if (targetBudgetField === "งบไม่เกินพนักงาน") {
        isMatch = Boolean(isStaffCost(bCat) || toNumber(b["พนักงาน"]) > 0 || bVendorType === "พนักงาน");
        if (isMatch) {
          matchedAmt = toNumber(b["พนักงาน"]) > 0 ? toNumber(b["พนักงาน"]) : toNumber(b["ยอดเงิน"] || 0);
        }
      } else if (targetBudgetField === "งบไม่เกินน้ำมัน") {
        isMatch = Boolean(isFuelCost(bCat) || toNumber(b["น้ำมัน"]) > 0 || (bProd && isFuelProduct(bProd)));
        if (isMatch) matchedAmt = toNumber(b["น้ำมัน"]) > 0 ? toNumber(b["น้ำมัน"]) : toNumber(b["ยอดเงิน"] || 0);
      } else if (targetBudgetField === "งบไม่เกินซ่อมรถ") {
        isMatch = Boolean(isRepairCost(bCat) || toNumber(b["ซ่อมรถ"]) > 0 || (bProd && isCarRepairProduct(bProd)));
        if (isMatch) matchedAmt = toNumber(b["ซ่อมรถ"]) > 0 ? toNumber(b["ซ่อมรถ"]) : toNumber(b["ยอดเงิน"] || 0);
      } else if (targetBudgetField === "งบไม่เกินเครื่องจักร") {
        isMatch = Boolean(isMachineCost(bCat) || toNumber(b["เครื่องจักร"]) > 0 || (bProd && isMachineProduct(bProd)));
        if (isMatch) matchedAmt = toNumber(b["เครื่องจักร"]) > 0 ? toNumber(b["เครื่องจักร"]) : toNumber(b["ยอดเงิน"] || 0);
      } else if (targetBudgetField === "งบไม่เกินเครื่องมือ") {
        isMatch = Boolean(isToolCost(bCat) || toNumber(b["เครื่องมือ"]) > 0 || (bProd && isToolProduct(bProd)) || (b["ชื่อเครื่องมือ"] && String(b["ชื่อเครื่องมือ"]).trim() !== ""));
        if (isMatch) matchedAmt = toNumber(b["เครื่องมือ"]) > 0 ? toNumber(b["เครื่องมือ"]) : toNumber(b["ยอดเงิน"] || 0);
      } else if (targetBudgetField === "งบไม่เกินอื่นๆ" || targetBudgetField === "งบไม่เกินดำเนินการ") {
        isMatch = Boolean(
          isOtherExpense(bCat) || toNumber(b["อื่นๆ"]) > 0 ||
          (bProd && (bProd === "200 ดำเนินการ(อื่นๆ)" || bProd.includes("ดำเนินการ") || bProd.startsWith("200") || bProd.startsWith("123") || bProd.startsWith("223")))
        );
        if (isMatch) matchedAmt = toNumber(b["อื่นๆ"]) > 0 ? toNumber(b["อื่นๆ"]) : toNumber(b["ยอดเงิน"] || 0);
      } else {
        isMatch = Boolean(categoryVal && (bCat === categoryVal || bCat.replace(/^\d+\.\s*/, "") === categoryVal.replace(/^\d+\.\s*/, "")));
        if (isMatch) matchedAmt = getBillRowAmount(b);
      }

      if (isMatch) {
        accumulatedAmount += matchedAmt;
      }
    }
  }

  const currentBillAmount = getBillRowAmount(row);
  const totalAfterBill = accumulatedAmount + currentBillAmount;
  const remainingBeforeBill = budgetLimit - accumulatedAmount;
  const remainingAfterBill = budgetLimit - totalAfterBill;
  const percentUsedBeforeBill = budgetLimit > 0 ? Number(((accumulatedAmount / budgetLimit) * 100).toFixed(1)) : 0;
  const percentUsedAfterBill = budgetLimit > 0 ? Number(((totalAfterBill / budgetLimit) * 100).toFixed(1)) : 0;
  const isOverBudget = totalAfterBill > budgetLimit;
  const isWarning = !isOverBudget && percentUsedAfterBill >= 85;

  let message = "";
  if (isOverBudget) {
    const overAmt = totalAfterBill - budgetLimit;
    message = `ยอดเบิกหมวด '${categoryLabel}' รวมแล้ว ${money(totalAfterBill)} ฿ เกินวงเงินคุมงบ (${money(budgetLimit)} ฿) อยู่ ${money(overAmt)} ฿`;
  } else if (isWarning) {
    message = `ยอดเบิกหมวด '${categoryLabel}' รวมแล้ว ${money(totalAfterBill)} ฿ (คิดเป็น ${percentUsedAfterBill.toFixed(0)}% ของวงเงินคุมงบ ${money(budgetLimit)} ฿)`;
  } else {
    message = `งบหมวด '${categoryLabel}' คงเหลือเบิกได้ ${money(remainingAfterBill)} ฿ (จากวงเงินคุมงบ ${money(budgetLimit)} ฿)`;
  }

  return {
    hasBudgetCap: true,
    categoryLabel,
    targetBudgetField,
    budgetLimit,
    accumulatedAmount,
    currentBillAmount,
    totalAfterBill,
    remainingBeforeBill,
    remainingAfterBill,
    percentUsedBeforeBill,
    percentUsedAfterBill,
    isOverBudget,
    isWarning,
    message,
    isProductLevel,
    isSpecificSubBudget,
    isOverallFallback
  };
}

function getBillRowAmount(row: SheetRow): number {
  return toNumber(
    row["ยอดเงิน"] ||
    row["ค่าของ"] ||
    row["ค่าแรง"] ||
    row["พนักงาน"] ||
    row["น้ำมัน"] ||
    row["ซ่อมรถ"] ||
    row["เครื่องจักร"] ||
    row["เครื่องมือ"] ||
    row["อื่นๆ"] ||
    0
  );
}
