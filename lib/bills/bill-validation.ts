import { TABLES } from "@/lib/config";
import { hydrateContractRows } from "@/lib/formulas";
import { getRows } from "@/lib/db";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";

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
  "200 ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",
  "ค่าขนส่ง": "งบไม่เกินค่าขนส่ง",
  "ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",

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

const CATEGORY_BUDGET_MAP: Record<string, string> = {
  "1.ค่าของ": "งบไม่เกินค่าของ",
  "2.ค่าแรง": "งบไม่เกินค่าแรง",
  "3.พนักงาน": "งบไม่เกินพนักงาน",
  "4.น้ำมัน": "งบไม่เกินน้ำมัน",
  "5.ซ่อมรถ": "งบไม่เกินซ่อมรถ",
  "6.เครื่องจักร": "งบไม่เกินเครื่องจักร",
  "7.เครื่องมือ": "งบไม่เกินเครื่องมือ",
  "8.อื่นๆ": "งบไม่เกินอื่นๆ",
  "ค่าของ": "งบไม่เกินค่าของ",
  "ค่าแรง": "งบไม่เกินค่าแรง",
  "พนักงาน": "งบไม่เกินพนักงาน",
  "น้ำมัน": "งบไม่เกินน้ำมัน",
  "ซ่อมรถ": "งบไม่เกินซ่อมรถ",
  "เครื่องจักร": "งบไม่เกินเครื่องจักร",
  "เครื่องมือ": "งบไม่เกินเครื่องมือ",
  "อื่นๆ": "งบไม่เกินอื่นๆ",
};

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
  const productVal = String(row["สินค้า"] || "").trim();
  const categoryVal = String(row["ประเภท"] || "").trim();

  let targetBudgetField = "";
  let categoryLabel = "";
  let isProductLevel = false;

  // A. หากผู้ใช้เลือกหมวดที่ไม่ใช่ค่าของ (เช่น "7.เครื่องมือ", "8.อื่นๆ", "4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร", "2.ค่าแรง", "3.พนักงาน")
  // ให้คุมงบตามหมวดนั้นทันที โดยไม่ไปเช็กสินค้า (เพราะสินค้าเป็นของหมวดค่าของ)
  const isNonMaterialCategory = Boolean(
    categoryVal &&
    categoryVal !== "1.ค่าของ" &&
    categoryVal !== "ค่าของ"
  );

  if (isNonMaterialCategory && CATEGORY_BUDGET_MAP[categoryVal]) {
    const fieldName = CATEGORY_BUDGET_MAP[categoryVal];
    const limit = toNumber(project[fieldName]);
    if (limit > 0) {
      targetBudgetField = fieldName;
      categoryLabel = categoryVal;
      isProductLevel = false;
    }
  }

  // หากยังไม่มีวงเงินเฉพาะ ให้ตรวจสอบรายสินค้า หรือถอยกลับมาคุมงบภาพรวมค่าของ
  if (!targetBudgetField) {
    // B. ตรวจสอบงบประมาณเฉพาะรายสินค้าก่อน (หากมีการระบุสินค้า)
    if (productVal) {
      let matchedField = PRODUCT_BUDGET_MAP[productVal];
      if (!matchedField) {
        const cleanProd = productVal.replace(/^\d+\s*/, "").trim();
        matchedField = PRODUCT_BUDGET_MAP[cleanProd];
      }

      if (matchedField && toNumber(project[matchedField]) > 0) {
        targetBudgetField = matchedField;
        categoryLabel = productVal;
        isProductLevel = true;
      }
    }

    // C. หากไม่ได้ระบุงบเฉพาะสินค้านั้น หรือหมวดไซต์งานไม่ได้ตั้งงบแยก -> Fallback ถอยกลับมาคุมงบภาพรวม "1.ค่าของ"
    const isMaterialOrSite =
      !categoryVal ||
      categoryVal === "1.ค่าของ" ||
      categoryVal === "ค่าของ" ||
      categoryVal.includes("ค่าของ") ||
      categoryVal.includes("น้ำมัน") ||
      categoryVal.includes("ซ่อมรถ") ||
      categoryVal.includes("เครื่องจักร") ||
      categoryVal.includes("เครื่องมือ") ||
      categoryVal.includes("อื่นๆ") ||
      Boolean(productVal);

    if (!targetBudgetField && isMaterialOrSite) {
      if (toNumber(project["งบไม่เกินค่าของ"]) > 0) {
        targetBudgetField = "งบไม่เกินค่าของ";
        categoryLabel = "ค่าของ (ภาพรวม)";
        isProductLevel = false;
      }
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
    message: ""
  };

  if (!targetBudgetField) return defaultResult;

  const budgetLimit = toNumber(project[targetBudgetField]);
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

    if (bLineItems.length > 0) {
      if (isProductLevel) {
        for (const it of bLineItems) {
          const itCat = String(it.category || it.name || "").trim();
          const itClean = itCat.replace(/^\d+[\.\s\-]+/, "").trim();
          const targetClean = productVal.replace(/^\d+[\.\s\-]+/, "").trim();
          const itField = PRODUCT_BUDGET_MAP[itCat] || PRODUCT_BUDGET_MAP[itClean];
          if (itCat === productVal || itClean === targetClean || (itField && itField === targetBudgetField)) {
            accumulatedAmount += toNumber(it.amount ?? it.price ?? it.total ?? 0);
          }
        }
      } else {
        for (const it of bLineItems) {
          const itType = String(it.categoryType || it.type || "").trim();
          if (CATEGORY_BUDGET_MAP[itType] === targetBudgetField || (!itType && targetBudgetField === "งบไม่เกินค่าของ")) {
            accumulatedAmount += toNumber(it.amount ?? it.price ?? it.total ?? 0);
          }
        }
      }
    } else {
      const bProd = String(b["สินค้า"] || "").trim();
      const bCat = String(b["ประเภท"] || "").trim();

      let isMatch = false;
      if (isProductLevel) {
        isMatch = Boolean(
          productVal && (
            bProd === productVal ||
            bProd.replace(/^\d+\s*/, "").trim() === productVal.replace(/^\d+\s*/, "").trim()
          )
        );
      } else if (targetBudgetField === "งบไม่เกินค่าของ") {
        isMatch = Boolean(bCat === "1.ค่าของ" || bCat === "ค่าของ" || (!bCat && bProd) || toNumber(b["ค่าของ"]) > 0);
      } else if (targetBudgetField === "งบไม่เกินค่าแรง") {
        isMatch = Boolean(bCat === "2.ค่าแรง" || bCat === "ค่าแรง" || toNumber(b["ค่าแรง"]) > 0);
      } else if (targetBudgetField === "งบไม่เกินพนักงาน") {
        isMatch = Boolean(bCat === "3.พนักงาน" || bCat === "พนักงาน" || toNumber(b["พนักงาน"]) > 0);
      } else if (targetBudgetField === "งบไม่เกินน้ำมัน") {
        isMatch = Boolean(bCat === "4.น้ำมัน" || bCat === "น้ำมัน" || toNumber(b["น้ำมัน"]) > 0);
      } else if (targetBudgetField === "งบไม่เกินซ่อมรถ") {
        isMatch = Boolean(bCat === "5.ซ่อมรถ" || bCat === "ซ่อมรถ" || toNumber(b["ซ่อมรถ"]) > 0);
      } else if (targetBudgetField === "งบไม่เกินเครื่องจักร") {
        isMatch = Boolean(bCat === "6.เครื่องจักร" || bCat === "เครื่องจักร" || toNumber(b["เครื่องจักร"]) > 0);
      } else if (targetBudgetField === "งบไม่เกินเครื่องมือ") {
        isMatch = Boolean(bCat === "7.เครื่องมือ" || bCat === "เครื่องมือ" || toNumber(b["เครื่องมือ"]) > 0);
      } else if (targetBudgetField === "งบไม่เกินอื่นๆ") {
        isMatch = Boolean(bCat === "8.อื่นๆ" || bCat === "อื่นๆ" || toNumber(b["อื่นๆ"]) > 0);
      } else {
        isMatch = Boolean(categoryVal && (bCat === categoryVal || bCat.replace(/^\d+\.\s*/, "") === categoryVal.replace(/^\d+\.\s*/, "")));
      }

      if (isMatch) {
        const amt = getBillRowAmount(b);
        accumulatedAmount += amt;
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
    isProductLevel
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
