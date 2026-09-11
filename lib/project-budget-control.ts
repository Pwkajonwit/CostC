import type { SheetRow } from "@/lib/types";
import { toNumber } from "@/lib/utils/numbers";
import { isCommittedBill, isPaidBill } from "@/lib/bills/bill-status";
import { getRowTransferAmount } from "@/lib/reports";

export type BudgetGroup =
  | "หมวดงานโครงสร้าง"
  | "หมวดงานสถาปัตยกรรม & ตกแต่ง"
  | "หมวดงานระบบ M&E"
  | "หมวดงานเตรียมดิน & โลจิสติกส์"
  | "หมวดงานทั่วไป & ดำเนินการ"
  | "หมวดงานค่าแรง & บุคลากร";

export type BudgetItemDefinition = {
  code: string;
  field: string;
  label: string;
  group: BudgetGroup;
  categoryType: "ค่าของ" | "ค่าแรง" | "พนักงาน" | "อื่นๆ";
  icon: string;
  matchKeywords: string[];
};

// 22 รายการสินค้า/งานในหมวดค่าของ + 2 รายการในหมวดค่าแรง ตาม Master Data ของ ProjectBudgetAllocator
export const ALLOCATED_BUDGET_ITEMS: BudgetItemDefinition[] = [
  // 1. หมวดงานโครงสร้าง
  { code: "1", field: "งบไม่เกินปูนทรายหิน", label: "1. ปูน/ทราย/หิน", group: "หมวดงานโครงสร้าง", categoryType: "ค่าของ", icon: "🧱", matchKeywords: ["ปูน/ทราย/หิน", "ปูน", "ทราย", "หิน", "ซีเมนต์"] },
  { code: "2", field: "งบไม่เกินเหล็กเส้น", label: "2. เหล็กเส้น/รูปพรรณ", group: "หมวดงานโครงสร้าง", categoryType: "ค่าของ", icon: "🏗️", matchKeywords: ["เหล็กเส้น/รูปพรรณ", "เหล็กเส้น", "เหล็ก", "รูปพรรณ"] },
  { code: "3", field: "งบไม่เกินคอนกรีต", label: "3. คอนกรีตผสมเสร็จ", group: "หมวดงานโครงสร้าง", categoryType: "ค่าของ", icon: "🚚", matchKeywords: ["คอนกรีตผสมเสร็จ", "คอนกรีต", "ผสมเสร็จ", "cpack"] },
  { code: "4", field: "งบไม่เกินไม้แบบ", label: "4. ไม้แบบ/ไม้อัด", group: "หมวดงานโครงสร้าง", categoryType: "ค่าของ", icon: "🪵", matchKeywords: ["ไม้แบบ/ไม้อัด", "ไม้แบบ", "ไม้อัด", "ไม้"] },

  // 2. หมวดงานสถาปัตยกรรม & ตกแต่ง
  { code: "5", field: "งบไม่เกินวัสดุมุง", label: "5. วัสดุมุง", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", categoryType: "ค่าของ", icon: "🏠", matchKeywords: ["วัสดุมุง", "หลังคา", "เมทัลชีท", "กระเบื้องมุง"] },
  { code: "6", field: "งบไม่เกินฝ้าผนัง", label: "6. ฝ้าผนัง", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", categoryType: "ค่าของ", icon: "🖼️", matchKeywords: ["ฝ้าผนัง", "ฝ้า", "ยิปซั่ม", "สมาร์ทบอร์ด", "isowall"] },
  { code: "7", field: "งบไม่เกินปูพื้น", label: "7. ปูพื้น", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", categoryType: "ค่าของ", icon: "🏁", matchKeywords: ["ปูพื้น", "กระเบื้องปูพื้น", "หินขัด", "ลามิเนต", "ยางปูพื้น"] },
  { code: "8", field: "งบไม่เกินกระจก", label: "8. กระจก", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", categoryType: "ค่าของ", icon: "🪟", matchKeywords: ["กระจก", "อลูมิเนียม", "บานกระทุ้ง", "บานเลื่อน"] },
  { code: "12", field: "งบไม่เกินสีเคมี", label: "12. สีเคมี", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", categoryType: "ค่าของ", icon: "🎨", matchKeywords: ["สีเคมี", "สี", "ทาสี", "เคมีภัณฑ์", "ทินเนอร์", "รองพื้น"] },
  { code: "13", field: "งบไม่เกินสุขภัณฑ์", label: "13. สุขภัณฑ์", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", categoryType: "ค่าของ", icon: "🚽", matchKeywords: ["สุขภัณฑ์", "โถส้วม", "อ่างล้างหน้า", "ก๊อก", "ชักโครก"] },
  { code: "14", field: "งบไม่เกินบิวอิน", label: "14. บิวอิน", group: "หมวดงานสถาปัตยกรรม & ตกแต่ง", categoryType: "ค่าของ", icon: "🛋️", matchKeywords: ["บิวอิน", "เฟอร์นิเจอร์", "เคาน์เตอร์", "ตู้", "นั่งร้าน"] },

  // 3. หมวดงานระบบ M&E
  { code: "9", field: "งบไม่เกินไฟฟ้า", label: "9. ไฟฟ้า", group: "หมวดงานระบบ M&E", categoryType: "ค่าของ", icon: "⚡", matchKeywords: ["ไฟฟ้า", "สายไฟ", "ตู้ไฟ", "เบรกเกอร์", "หลอดไฟ", "ท่อร้อยสาย"] },
  { code: "10", field: "งบไม่เกินประปา", label: "10. ประปา", group: "หมวดงานระบบ M&E", categoryType: "ค่าของ", icon: "💧", matchKeywords: ["ประปา", "ท่อpvc", "ท่อน้ำ", "ปั๊มน้ำ", "ถังเก็บน้ำ", "วาล์ว"] },
  { code: "15", field: "งบไม่เกินแอร์", label: "15. แอร์", group: "หมวดงานระบบ M&E", categoryType: "ค่าของ", icon: "❄️", matchKeywords: ["แอร์", "เครื่องปรับอากาศ", "ท่อน้ำยาแอร์"] },

  // 4. หมวดงานเตรียมดิน & โลจิสติกส์
  { code: "16", field: "งบไม่เกินดิน", label: "16. ดิน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", categoryType: "ค่าของ", icon: "🌱", matchKeywords: ["ดิน", "ถมดิน", "ดินลูกรัง"] },
  { code: "17", field: "งบไม่เกินหินทราย", label: "17. หินทราย", group: "หมวดงานเตรียมดิน & โลจิสติกส์", categoryType: "ค่าของ", icon: "🪨", matchKeywords: ["หินทราย", "หินคลุก", "ลูกรัง"] },
  { code: "18", field: "งบไม่เกินเตรียมงาน", label: "18. เตรียมงาน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", categoryType: "ค่าของ", icon: "🚜", matchKeywords: ["เตรียมงาน", "ปรับพื้นที่", "เคลียร์ริ่ง", "สำรวจ"] },
  { code: "101", field: "งบไม่เกินน้ำมัน", label: "101. น้ำมัน", group: "หมวดงานเตรียมดิน & โลจิสติกส์", categoryType: "ค่าของ", icon: "⛽", matchKeywords: ["น้ำมัน", "ดีเซล", "เบนซิน", "แก๊สโซฮอล์", "4.น้ำมัน"] },
  { code: "102", field: "งบไม่เกินค่าขนส่ง", label: "102. ค่าขนส่ง", group: "หมวดงานเตรียมดิน & โลจิสติกส์", categoryType: "ค่าของ", icon: "🚛", matchKeywords: ["ค่าขนส่ง", "ขนส่ง", "ค่ารถ", "บรรทุก"] },
  { code: "103", field: "งบไม่เกินเครื่องจักร", label: "103. เครื่องจักร", group: "หมวดงานเตรียมดิน & โลจิสติกส์", categoryType: "ค่าของ", icon: "🏗️", matchKeywords: ["เครื่องจักร", "แม็คโคร", "รถเครน", "รถขุด", "รถบด", "6.เครื่องจักร"] },

  // 5. หมวดงานทั่วไป & ดำเนินการ
  { code: "11", field: "งบไม่เกินวัสดุอื่นๆ", label: "11. อื่นๆ(วัสดุ)", group: "หมวดงานทั่วไป & ดำเนินการ", categoryType: "ค่าของ", icon: "📦", matchKeywords: ["อื่นๆ(วัสดุ)", "วัสดุอื่นๆ", "วัสดุสิ้นเปลือง", "น็อต", "ตะปู"] },
  { code: "200", field: "งบไม่เกินดำเนินการ", label: "200. ดำเนินการ(อื่นๆ)", group: "หมวดงานทั่วไป & ดำเนินการ", categoryType: "ค่าของ", icon: "📁", matchKeywords: ["ดำเนินการ(อื่นๆ)", "ดำเนินการ", "เบ็ดเตล็ด"] },

  // 6. หมวดงานค่าแรง & บุคลากร
  { code: "L1", field: "งบไม่เกินค่าแรง", label: "2. ค่าแรง (เปิดจ้างผู้รับเหมา)", group: "หมวดงานค่าแรง & บุคลากร", categoryType: "ค่าแรง", icon: "👷", matchKeywords: ["ค่าแรง", "2.ค่าแรง", "ผู้รับเหมา", "ช่าง", "เปิดจ้าง"] },
  { code: "L2", field: "งบไม่เกินพนักงาน", label: "3. พนักงาน (ช่างประจำ/ไซต์งาน)", group: "หมวดงานค่าแรง & บุคลากร", categoryType: "พนักงาน", icon: "👥", matchKeywords: ["พนักงาน", "3.พนักงาน", "เงินเดือน", "โอที", "เบี้ยเลี้ยง"] },
];

export type ParsedBillItem = {
  billId: string | number;
  itemName: string;
  categoryType: string;
  amount: number;
  isPaid: boolean;
  rawBill: SheetRow;
};

/**
 * Extract all items from bills, expanding multi-item line items if present.
 */
export function extractBillItems(bills: SheetRow[]): ParsedBillItem[] {
  const result: ParsedBillItem[] = [];

  for (const b of bills) {
    if (!isCommittedBill(b)) continue;
    const isPaid = isPaidBill(b);
    const billId = b.id || b["ลำดับ"] || b._sheetRow || "";

    // 1. Check if bill has data.items (multi-item lines)
    let rawItems: any[] = [];
    const dataObj = typeof b.data === "object" && b.data ? b.data : {};
    if (Array.isArray(b.items)) rawItems = b.items;
    else if (Array.isArray(dataObj.items)) rawItems = dataObj.items;
    else if (typeof dataObj.items === "string") {
      try {
        rawItems = JSON.parse(dataObj.items);
      } catch {
        rawItems = [];
      }
    }

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      for (const item of rawItems) {
        const itemAmount = toNumber(item.amount);
        if (itemAmount <= 0) continue;
        const itemName = String(item.category || item.name || item.description || "").trim();
        const categoryType = String(item.categoryType || item.type || b["ประเภท"] || "1.ค่าของ").trim();

        result.push({
          billId,
          itemName: itemName || String(b["สินค้า/ทำงาน"] || b["สินค้า"] || b["รายการ"] || "").trim(),
          categoryType,
          amount: itemAmount,
          isPaid,
          rawBill: b
        });
      }
    } else {
      // Single item bill
      const totalAmount = toNumber(b["ยอดเงิน"] || b["ยอดโอน"] || b.amount || 0);
      const itemName = String(b["สินค้า/ทำงาน"] || b["สินค้า"] || b["รายการ"] || b["รายละเอียดงาน"] || "").trim();
      const categoryType = String(b["ประเภท"] || b.category || "1.ค่าของ").trim();

      result.push({
        billId,
        itemName,
        categoryType,
        amount: totalAmount,
        isPaid,
        rawBill: b
      });
    }
  }

  return result;
}

/**
 * Check if a parsed bill item matches a budget item definition.
 */
export function matchesBudgetItem(item: ParsedBillItem, def: BudgetItemDefinition): boolean {
  const itemLower = item.itemName.toLowerCase().trim();
  const catLower = item.categoryType.toLowerCase().trim();
  const cleanItem = itemLower.replace(/^\d+\s*[-.]?\s*/, "").trim();

  // 1. Direct code prefix match (e.g. "1. ปูน", "1 ปูน", "101 น้ำมัน")
  if (itemLower.startsWith(`${def.code} `) || itemLower.startsWith(`${def.code}.`)) {
    return true;
  }

  // 2. Specific categoryType checks
  if (def.field === "งบไม่เกินน้ำมัน") {
    if (catLower.includes("น้ำมัน") || catLower === "4.น้ำมัน") return true;
  }
  if (def.field === "งบไม่เกินเครื่องจักร") {
    if (catLower.includes("เครื่องจักร") || catLower === "6.เครื่องจักร") return true;
  }
  if (def.field === "งบไม่เกินค่าแรง") {
    if (catLower.includes("ค่าแรง") || catLower === "2.ค่าแรง") return true;
  }
  if (def.field === "งบไม่เกินพนักงาน") {
    if (catLower.includes("พนักงาน") || catLower === "3.พนักงาน") return true;
  }

  // 3. Keyword matching
  for (const kw of def.matchKeywords) {
    const kwLower = kw.toLowerCase().trim();
    if (!kwLower) continue;
    if (cleanItem === kwLower || itemLower === kwLower) return true;
    if (cleanItem.includes(kwLower) || itemLower.includes(kwLower)) return true;
    if (catLower.includes(kwLower)) return true;
  }

  return false;
}

export type BudgetItemAnalysis = BudgetItemDefinition & {
  budgetCap: number;
  actualSpent: number;
  pendingSpent: number;
  totalCommitted: number;
  remaining: number;
  percentUsed: number;
  isOver: number; // 0 = ok, 1 = over
  isWarning: boolean;
  billCount: number;
  pendingCount: number;
};

export type ProjectBudgetSummary = {
  projectBudget: number; // งบโครงการรวม (จาก งบไม่เกิน หรือ ยอดงาน)
  workAmount: number;    // ยอดงานรวม (สัญญาจ้าง)
  vatTotal: number;

  // งบที่จัดสรรในแต่ละหมวดใหญ่
  materialBudget: number; // งบค่าของ (ผลรวม 22 รายการ หรือ งบไม่เกินค่าของ)
  laborDirectBudget: number; // งบค่าแรง (งบไม่เกินค่าแรง)
  staffBudget: number; // งบพนักงาน (งบไม่เกินพนักงาน)
  laborBudget: number; // รวมค่าแรง + พนักงาน

  totalAllocated: number; // งบที่จัดสรรแล้วทั้งหมด
  unallocatedBudget: number; // งบคงเหลือที่ยังไม่ได้จัดสรร
  allocatedPercent: number; // สัดส่วนการจัดสรร (%)

  // ยอดเบิกจ่ายจริง
  actualPaidTotal: number;
  pendingTotal: number;
  actualMaterialPaid: number;
  actualLaborPaid: number;
  actualStaffPaid: number;
  actualOtherPaid: number;

  netRemainingBudget: number; // projectBudget - actualPaidTotal
  spendPercentOfBudget: number; // (actualPaidTotal / projectBudget) * 100

  // รายการแจกแจงระดับไอเท็ม 24 รายการ
  items: BudgetItemAnalysis[];
  groups: {
    groupName: BudgetGroup;
    budget: number;
    spent: number;
    pending: number;
    remaining: number;
    percent: number;
    items: BudgetItemAnalysis[];
  }[];
};

/**
 * Calculate full budget control & allocation alignment for a project.
 */
export function calculateProjectBudgetControl(
  project: SheetRow,
  projectBills: SheetRow[]
): ProjectBudgetSummary {
  const workAmount = toNumber(project["ยอดงาน"]);
  const rawBudget = toNumber(project["งบไม่เกิน"]);
  const vatTotal = toNumber(project["ยอดรวม vat"] || project["ยอดรวม VAT"] || (workAmount > 0 ? workAmount * 1.07 : 0));

  // งบประมาณโครงการ (ตามเกณฑ์ของ ProjectBudgetAllocator)
  const projectBudget = rawBudget > 0 ? rawBudget : (workAmount > 0 ? workAmount : 0);

  // 1. คำนวณยอดจัดสรรของ 22 รายการค่าของ
  const materialSubTotal = ALLOCATED_BUDGET_ITEMS
    .filter(i => i.categoryType === "ค่าของ")
    .reduce((sum, item) => sum + toNumber(project[item.field] || 0), 0);

  const rawMaterialCap = toNumber(project["งบไม่เกินค่าของ"]);
  const materialBudget = Math.max(rawMaterialCap, materialSubTotal);

  // 2. คำนวณยอดจัดสรรค่าแรง
  const laborDirectBudget = toNumber(project["งบไม่เกินค่าแรง"]);
  const staffBudget = toNumber(project["งบไม่เกินพนักงาน"]);
  const laborBudget = laborDirectBudget + staffBudget;

  // 3. รวมจัดสรรทั้งหมด
  const totalAllocated = materialBudget + laborBudget;
  const unallocatedBudget = projectBudget - totalAllocated;
  const allocatedPercent = projectBudget > 0 ? (totalAllocated / projectBudget) * 100 : 0;

  // 4. สกัดและจับคู่บิลทั้งหมด
  const parsedItems = extractBillItems(projectBills);

  let actualPaidTotal = 0;
  let pendingTotal = 0;
  let actualMaterialPaid = 0;
  let actualLaborPaid = 0;
  let actualStaffPaid = 0;
  let actualOtherPaid = 0;

  for (const item of parsedItems) {
    if (item.isPaid) {
      actualPaidTotal += item.amount;
      if (item.categoryType.includes("ค่าแรง") || item.categoryType === "2.ค่าแรง") actualLaborPaid += item.amount;
      else if (item.categoryType.includes("พนักงาน") || item.categoryType === "3.พนักงาน") actualStaffPaid += item.amount;
      else if (item.categoryType.includes("ค่าของ") || item.categoryType === "1.ค่าของ") actualMaterialPaid += item.amount;
      else actualOtherPaid += item.amount;
    } else {
      pendingTotal += item.amount;
    }
  }

  // 5. คำนวณการใช้จ่ายราย BudgetItemDefinition
  const analyzedItems: BudgetItemAnalysis[] = ALLOCATED_BUDGET_ITEMS.map(def => {
    let budgetCap = toNumber(project[def.field] || 0);

    // If there is an un-itemized material budget, attribute the remaining un-itemized portion to "อื่นๆ(วัสดุ)"
    if (def.field === "งบไม่เกินวัสดุอื่นๆ" && budgetCap <= 0 && rawMaterialCap > materialSubTotal) {
      budgetCap = rawMaterialCap - materialSubTotal;
    }

    let actualSpent = 0;
    let pendingSpent = 0;
    let billCount = 0;
    let pendingCount = 0;

    for (const item of parsedItems) {
      if (matchesBudgetItem(item, def)) {
        if (item.isPaid) {
          actualSpent += item.amount;
          billCount++;
        } else {
          pendingSpent += item.amount;
          pendingCount++;
        }
      }
    }

    const totalCommitted = actualSpent + pendingSpent;
    const remaining = budgetCap > 0 ? budgetCap - actualSpent : 0;
    const percentUsed = budgetCap > 0 ? Number(((actualSpent / budgetCap) * 100).toFixed(1)) : 0;
    const isOver = budgetCap > 0 && actualSpent > budgetCap ? 1 : 0;
    const isWarning = budgetCap > 0 && !isOver && (percentUsed >= 80 || totalCommitted > budgetCap);

    return {
      ...def,
      budgetCap,
      actualSpent,
      pendingSpent,
      totalCommitted,
      remaining,
      percentUsed,
      isOver,
      isWarning,
      billCount,
      pendingCount
    };
  });

  // 6. จัดกลุ่มตาม BudgetGroup
  const groupNames: BudgetGroup[] = [
    "หมวดงานโครงสร้าง",
    "หมวดงานสถาปัตยกรรม & ตกแต่ง",
    "หมวดงานระบบ M&E",
    "หมวดงานเตรียมดิน & โลจิสติกส์",
    "หมวดงานทั่วไป & ดำเนินการ",
    "หมวดงานค่าแรง & บุคลากร"
  ];

  const groups = groupNames.map(groupName => {
    const groupItems = analyzedItems.filter(i => i.group === groupName);
    const bSum = groupItems.reduce((s, i) => s + i.budgetCap, 0);
    const sSum = groupItems.reduce((s, i) => s + i.actualSpent, 0);
    const pSum = groupItems.reduce((s, i) => s + i.pendingSpent, 0);
    const rSum = bSum > 0 ? bSum - sSum : 0;
    const pct = bSum > 0 ? Number(((sSum / bSum) * 100).toFixed(1)) : 0;

    return {
      groupName,
      budget: bSum,
      spent: sSum,
      pending: pSum,
      remaining: rSum,
      percent: pct,
      items: groupItems
    };
  });

  const netRemainingBudget = projectBudget > 0 ? projectBudget - actualPaidTotal : 0;
  const spendPercentOfBudget = projectBudget > 0 ? Number(((actualPaidTotal / projectBudget) * 100).toFixed(1)) : 0;

  return {
    projectBudget,
    workAmount,
    vatTotal,
    materialBudget,
    laborDirectBudget,
    staffBudget,
    laborBudget,
    totalAllocated,
    unallocatedBudget,
    allocatedPercent: Number(allocatedPercent.toFixed(1)),
    actualPaidTotal,
    pendingTotal,
    actualMaterialPaid,
    actualLaborPaid,
    actualStaffPaid,
    actualOtherPaid,
    netRemainingBudget,
    spendPercentOfBudget,
    items: analyzedItems,
    groups
  };
}
