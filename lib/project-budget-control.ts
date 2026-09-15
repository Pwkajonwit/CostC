import type { SheetRow } from "@/lib/types";
import { toNumber } from "@/lib/utils/numbers";
import { isCommittedBill, isPaidBill } from "@/lib/bills/bill-status";
import { getRowTransferAmount } from "@/lib/reports";
import { isMaterialCost, isLaborCost, isStaffCost, isFuelCost, isMachineCost, isRepairCost, isToolCost } from "@/lib/cost-codes";

export type BudgetGroup =
  | "ค่าของ (Material Cost Code)"
  | "ค่าแรง (Labor Cost Code)";

export type BudgetItemDefinition = {
  code: string;
  field: string;
  label: string;
  group: BudgetGroup;
  categoryType: "ค่าของ" | "ค่าแรง" | "พนักงาน" | "อื่นๆ";
  icon: string;
  matchKeywords: string[];
};

// รายการหมวดสินค้า/งานทั้งหมดแบ่ง 2 หมวดหลัก:
// 1. ค่าของ (Material Cost Code) - 27 รายการ (101-123 และ 501-504)
// 2. ค่าแรง (Labor Cost Code) - 24 รายการ (201-223 และ 301 พนักงาน)
export const ALLOCATED_BUDGET_ITEMS: BudgetItemDefinition[] = [
  // ==========================================
  // ค่าของ (Material Cost Code) - 27 รายการ
  // ==========================================
  { code: "101", field: "งบไม่เกินเตรียมงาน", label: "101. เตรียมงาน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🚜", matchKeywords: ["101", "เตรียมงาน", "ปรับพื้นที่", "เคลียร์ริ่ง", "สำรวจ"] },
  { code: "102", field: "งบไม่เกินหินทราย", label: "102. ดิน/ทราย/หิน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🪨", matchKeywords: ["102", "ดิน/ทราย/หิน", "หินทราย", "ดิน", "หิน", "ทราย", "ลูกรัง"] },
  { code: "103", field: "งบไม่เกินเสาเข็ม", label: "103. เสาเข็ม", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🏗️", matchKeywords: ["103", "เสาเข็ม", "เข็มเจาะ", "เข็มตอก"] },
  { code: "104", field: "งบไม่เกินเหล็กเส้น", label: "104. เหล็กเส้น", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🏗️", matchKeywords: ["104", "เหล็กเส้น", "เหล็กข้ออ้อย", "เหล็กกลม", "ไวร์เมช", "เหล็ก"] },
  { code: "105", field: "งบไม่เกินไม้แบบ", label: "105. ไม้แบบค้ำยัน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🪵", matchKeywords: ["105", "ไม้แบบค้ำยัน", "ไม้แบบ", "ไม้อัด", "ค้ำยัน", "ไม้ยูคา"] },
  { code: "106", field: "งบไม่เกินคอนกรีต", label: "106. คอนกรีตผสมเสร็จ", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🚚", matchKeywords: ["106", "คอนกรีตผสมเสร็จ", "คอนกรีต", "ผสมเสร็จ", "cpack"] },
  { code: "107", field: "งบไม่เกินรูปพรรณ", label: "107. เหล็กรูปพรรณ", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "📐", matchKeywords: ["107", "เหล็กรูปพรรณ", "รูปพรรณ", "เหล็กกล่อง", "เอชบีม", "ไอบีม", "แป"] },
  { code: "108", field: "งบไม่เกินวัสดุมุง", label: "108. วัสดุหลังคา", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🏠", matchKeywords: ["108", "วัสดุหลังคา", "หลังคา", "เมทัลชีท", "กระเบื้องมุง", "ฉนวน"] },
  { code: "109", field: "งบไม่เกินก่อฉาบ", label: "109. ก่อฉาบ", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🧱", matchKeywords: ["109", "ก่อฉาบ", "ปูนก่อ", "ปูนฉาบ", "อิฐมวลเบา", "อิฐบล็อก", "อิฐมอญ", "ปูน"] },
  { code: "110", field: "งบไม่เกินฝ้าผนัง", label: "110. ฝ้าเพดาน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🖼️", matchKeywords: ["110", "ฝ้าเพดาน", "ฝ้า", "ยิปซั่ม", "สมาร์ทบอร์ด", "ฝ้าทีบาร์"] },
  { code: "111", field: "งบไม่เกินปูพื้น", label: "111. ผิวพื้นผนัง", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🏁", matchKeywords: ["111", "ผิวพื้นผนัง", "ปูพื้น", "กระเบื้อง", "แกรนิตโต้", "ลามิเนต", "หินขัด"] },
  { code: "112", field: "งบไม่เกินกระจก", label: "112. ประตูหน้าต่าง", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🪟", matchKeywords: ["112", "ประตูหน้าต่าง", "ประตู", "หน้าต่าง", "กระจก", "อลูมิเนียม", "วงกบ"] },
  { code: "113", field: "งบไม่เกินสีเคมี", label: "113. ทาสี", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🎨", matchKeywords: ["113", "ทาสี", "สี", "สีเคมี", "เคมีภัณฑ์", "ทินเนอร์", "รองพื้น"] },
  { code: "114", field: "งบไม่เกินสุขภัณฑ์", label: "114. สุขภัณฑ์", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🚽", matchKeywords: ["114", "สุขภัณฑ์", "โถส้วม", "อ่างล้างหน้า", "ก๊อก", "ชักโครก"] },
  { code: "115", field: "งบไม่เกินประปา", label: "115. ระบบประปา", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "💧", matchKeywords: ["115", "ระบบประปา", "ประปา", "ท่อpvc", "ท่อน้ำ", "ปั๊มน้ำ", "ถังเก็บน้ำ", "วาล์ว"] },
  { code: "116", field: "งบไม่เกินไฟฟ้า", label: "116. ระบบไฟฟ้า", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "⚡", matchKeywords: ["116", "ระบบไฟฟ้า", "ไฟฟ้า", "สายไฟ", "ตู้ไฟ", "เบรกเกอร์", "หลอดไฟ", "ท่อร้อยสาย"] },
  { code: "117", field: "งบไม่เกินแอร์", label: "117. ระบบปรับอากาศ", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "❄️", matchKeywords: ["117", "ระบบปรับอากาศ", "แอร์", "เครื่องปรับอากาศ", "ท่อน้ำยาแอร์"] },
  { code: "118", field: "งบไม่เกินบิวอิน", label: "118. ตบแต่งภายใน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🛋️", matchKeywords: ["118", "ตบแต่งภายใน", "บิวอิน", "ตกแต่งภายใน"] },
  { code: "119", field: "งบไม่เกินเฟอร์นิเจอร์", label: "119. เฟอร์นิเจอร์", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🪑", matchKeywords: ["119", "เฟอร์นิเจอร์", "โต๊ะ", "เก้าอี้", "ตู้", "เตียง"] },
  { code: "120", field: "งบไม่เกินภูมิทัศน์", label: "120. ภูมิทัศน์", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🌳", matchKeywords: ["120", "ภูมิทัศน์", "จัดสวน", "ต้นไม้", "ปูหญ้า"] },
  { code: "121", field: "งบไม่เกินแก้ไขเก็บงาน", label: "121. แก้ไขเก็บงาน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🔧", matchKeywords: ["121", "แก้ไขเก็บงาน", "เก็บงาน", "ซ่อมแซม", "แก้ไข"] },
  { code: "122", field: "งบไม่เกินตั้งนั่งร้าน", label: "122. ตั้งนั่งร้าน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🪜", matchKeywords: ["122", "ตั้งนั่งร้าน", "นั่งร้าน", "ขานั่งร้าน"] },
  { code: "123", field: "งบไม่เกินดำเนินการ", label: "123. ดำเนินการ(อื่นๆ)", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "📁", matchKeywords: ["123", "200", "ดำเนินการ", "อื่นๆ", "เบ็ดเตล็ด"] },
  { code: "501", field: "งบไม่เกินน้ำมัน", label: "501. น้ำมัน", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "⛽", matchKeywords: ["501", "น้ำมัน", "ดีเซล", "เบนซิน", "แก๊สโซฮอล์", "4.น้ำมัน"] },
  { code: "502", field: "งบไม่เกินซ่อมรถ", label: "502. ซ่อมรถ", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🚗", matchKeywords: ["502", "ซ่อมรถ", "104", "อะไหล่", "ยาง", "ถ่ายน้ำมันเครื่อง", "5.ซ่อมรถ"] },
  { code: "503", field: "งบไม่เกินเครื่องจักร", label: "503. เครื่องจักร", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🏗️", matchKeywords: ["503", "เครื่องจักร", "แม็คโคร", "รถเครน", "รถขุด", "รถบด", "6.เครื่องจักร"] },
  { code: "504", field: "งบไม่เกินเครื่องมือ", label: "504. เครื่องมือ", group: "ค่าของ (Material Cost Code)", categoryType: "ค่าของ", icon: "🛠️", matchKeywords: ["504", "เครื่องมือ", "สว่าน", "หินเจียร์", "ตู้เชื่อม", "7.เครื่องมือ"] },

  // ==========================================
  // ค่าแรง (Labor Cost Code) - 23 รายการ
  // ==========================================
  { code: "201", field: "งบไม่เกินค่าแรง_201", label: "201. เตรียมงาน", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🚜", matchKeywords: ["201", "เตรียมงาน"] },
  { code: "202", field: "งบไม่เกินค่าแรง_202", label: "202. ดิน/ทราย/หิน", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🪨", matchKeywords: ["202", "ดิน/ทราย/หิน", "หินทราย", "ดิน"] },
  { code: "203", field: "งบไม่เกินค่าแรง_203", label: "203. เสาเข็ม", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🏗️", matchKeywords: ["203", "เสาเข็ม", "เข็มเจาะ"] },
  { code: "204", field: "งบไม่เกินค่าแรง_204", label: "204. เหล็กเส้น", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🏗️", matchKeywords: ["204", "เหล็กเส้น", "ผูกเหล็ก"] },
  { code: "205", field: "งบไม่เกินค่าแรง_205", label: "205. ไม้แบบค้ำยัน", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🪵", matchKeywords: ["205", "ไม้แบบค้ำยัน", "ไม้แบบ", "เข้าแบบ"] },
  { code: "206", field: "งบไม่เกินค่าแรง_206", label: "206. คอนกรีตผสมเสร็จ", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🚚", matchKeywords: ["206", "คอนกรีตผสมเสร็จ", "เทปูน", "เทคอนกรีต"] },
  { code: "207", field: "งบไม่เกินค่าแรง_207", label: "207. เหล็กรูปพรรณ", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "📐", matchKeywords: ["207", "เหล็กรูปพรรณ", "เชื่อมเหล็ก", "โครงเหล็ก"] },
  { code: "208", field: "งบไม่เกินค่าแรง_208", label: "208. วัสดุหลังคา", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🏠", matchKeywords: ["208", "วัสดุหลังคา", "มุงหลังคา", "หลังคา"] },
  { code: "209", field: "งบไม่เกินค่าแรง_209", label: "209. ก่อฉาบ", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🧱", matchKeywords: ["209", "ก่อฉาบ", "ก่ออิฐ", "ฉาบปูน"] },
  { code: "210", field: "งบไม่เกินค่าแรง_210", label: "210. ฝ้าเพดาน", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🖼️", matchKeywords: ["210", "ฝ้าเพดาน", "ทำฝ้า", "ฝ้า"] },
  { code: "211", field: "งบไม่เกินค่าแรง_211", label: "211. ผิวพื้นผนัง", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🏁", matchKeywords: ["211", "ผิวพื้นผนัง", "ปูกระเบื้อง", "ปูพื้น"] },
  { code: "212", field: "งบไม่เกินค่าแรง_212", label: "212. ประตูหน้าต่าง", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🪟", matchKeywords: ["212", "ประตูหน้าต่าง", "ติดตั้งประตู", "ติดตั้งหน้าต่าง"] },
  { code: "213", field: "งบไม่เกินค่าแรง_213", label: "213. ทาสี", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🎨", matchKeywords: ["213", "ทาสี", "ช่างสี"] },
  { code: "214", field: "งบไม่เกินค่าแรง_214", label: "214. สุขภัณฑ์", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🚽", matchKeywords: ["214", "สุขภัณฑ์", "ติดตั้งสุขภัณฑ์"] },
  { code: "215", field: "งบไม่เกินค่าแรง_215", label: "215. ระบบประปา", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "💧", matchKeywords: ["215", "ระบบประปา", "เดินท่อ", "ช่างประปา"] },
  { code: "216", field: "งบไม่เกินค่าแรง_216", label: "216. ระบบไฟฟ้า", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "⚡", matchKeywords: ["216", "ระบบไฟฟ้า", "เดินสายไฟ", "ช่างไฟ"] },
  { code: "217", field: "งบไม่เกินค่าแรง_217", label: "217. ระบบปรับอากาศ", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "❄️", matchKeywords: ["217", "ระบบปรับอากาศ", "ติดตั้งแอร์", "ล้างแอร์"] },
  { code: "218", field: "งบไม่เกินค่าแรง_218", label: "218. ตบแต่งภายใน", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🛋️", matchKeywords: ["218", "ตบแต่งภายใน", "บิวอิน", "ตกแต่งภายใน"] },
  { code: "219", field: "งบไม่เกินค่าแรง_219", label: "219. เฟอร์นิเจอร์", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🪑", matchKeywords: ["219", "เฟอร์นิเจอร์", "ประกอบเฟอร์นิเจอร์"] },
  { code: "220", field: "งบไม่เกินค่าแรง_220", label: "220. ภูมิทัศน์", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🌳", matchKeywords: ["220", "ภูมิทัศน์", "จัดสวน", "คนสวน"] },
  { code: "221", field: "งบไม่เกินค่าแรง_221", label: "221. แก้ไขเก็บงาน", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🔧", matchKeywords: ["221", "แก้ไขเก็บงาน", "เก็บงาน", "ซ่อมงาน"] },
  { code: "222", field: "งบไม่เกินค่าแรง_222", label: "222. ตั้งนั่งร้าน", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "🪜", matchKeywords: ["222", "ตั้งนั่งร้าน", "รื้อนั่งร้าน"] },
  { code: "223", field: "งบไม่เกินค่าแรง_223", label: "223. ค่าบริการ(อื่นๆ)", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "📁", matchKeywords: ["223", "ค่าบริการ(อื่นๆ)", "ค่าบริการ", "ออกแบบ", "เซ็นรับรอง"] },

  // ==========================================
  // พนักงาน (Staff Cost Code) - อยู่ในหมวดค่าแรง
  // ==========================================
  { code: "301", field: "งบไม่เกินพนักงาน", label: "301. พนักงาน (ช่างประจำ/ไซต์งาน)", group: "ค่าแรง (Labor Cost Code)", categoryType: "ค่าแรง", icon: "👥", matchKeywords: ["301", "พนักงาน", "3.พนักงาน", "เงินเดือน", "โอที", "เบี้ยเลี้ยง"] },
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
        const categoryType = String(item.categoryType || item.type || b["ประเภท"] || itemName || "101 เตรียมงาน").trim();

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
      const categoryType = String(b["ประเภท"] || b.category || "101 เตรียมงาน").trim();

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
 * Helper to get budget value from project row with backward-compatible fallbacks
 */
export function getProjectBudgetValue(project: SheetRow, field: string, code?: string): number {
  if (!project) return 0;
  let val = toNumber(project[field]);
  if (val > 0) return val;

  // Specific fallbacks for backward compatibility
  if (field === "งบไม่เกินหินทราย") {
    val = toNumber(project["งบไม่เกินดิน"]);
    if (val > 0) return val;
  }
  if (field === "งบไม่เกินก่อฉาบ" || field === "งบไม่เกินเสาเข็ม") {
    val = toNumber(project["งบไม่เกินปูนทรายหิน"]);
    if (val > 0) return val;
  }
  if (field === "งบไม่เกินกระจก" || field === "งบไม่เกินประตูหน้าต่าง") {
    val = toNumber(project["งบไม่เกินกระจก"] || project["งบไม่เกินประตูหน้าต่าง"]);
    if (val > 0) return val;
  }
  if (field === "งบไม่เกินบิวอิน" || field === "งบไม่เกินตบแต่งภายใน" || field === "งบไม่เกินเฟอร์นิเจอร์") {
    val = toNumber(project["งบไม่เกินบิวอิน"] || project["งบไม่เกินตบแต่งภายใน"] || project["งบไม่เกินเฟอร์นิเจอร์"]);
    if (val > 0) return val;
  }
  if (field === "งบไม่เกินดำเนินการ") {
    val = toNumber(project["งบไม่เกินอื่นๆ"]);
    if (val > 0) return val;
  }
  if (field === "งบไม่เกินแก้ไขเก็บงาน") {
    val = toNumber(project["งบไม่เกินวัสดุอื่นๆ"]);
    if (val > 0) return val;
  }

  // Check project.data JSONB
  if (project.data && typeof project.data === "object") {
    const dataObj = project.data as Record<string, any>;
    if (dataObj[field] !== undefined) {
      val = toNumber(dataObj[field]);
      if (val > 0) return val;
    }
  }

  return 0;
}

/**
 * Check if a parsed bill item matches a budget item definition.
 */
export function matchesBudgetItem(item: ParsedBillItem, def: BudgetItemDefinition): boolean {
  const itemLower = item.itemName.toLowerCase().trim();
  const catLower = item.categoryType.toLowerCase().trim();
  const cleanItem = itemLower.replace(/^\d+\s*[-.]?\s*/, "").trim();

  // 1. Direct code prefix match in item name or category (e.g. "101 ", "101.", "201 ", "201.")
  if (
    itemLower.startsWith(`${def.code} `) ||
    itemLower.startsWith(`${def.code}.`) ||
    itemLower.startsWith(`${def.code}-`) ||
    catLower.startsWith(`${def.code} `) ||
    catLower.startsWith(`${def.code}.`) ||
    catLower.startsWith(`${def.code}-`) ||
    catLower === def.code
  ) {
    return true;
  }

  // Classification checks to prevent material/labor collision (e.g. 103 เสาเข็ม vs 203 เสาเข็ม)
  const isLabor = isLaborCost(item.categoryType) || catLower.includes("ค่าแรง") || catLower.startsWith("2");
  const isStaff = isStaffCost(item.categoryType) || catLower.includes("พนักงาน") || catLower.startsWith("301") || catLower.startsWith("3.");
  const isLaborOrStaff = isLabor || isStaff;
  const isFuel = isFuelCost(item.categoryType) || catLower.includes("น้ำมัน");
  const isRepair = isRepairCost(item.categoryType) || catLower.includes("ซ่อมรถ");
  const isMachine = isMachineCost(item.categoryType) || catLower.includes("เครื่องจักร");
  const isTool = isToolCost(item.categoryType) || catLower.includes("เครื่องมือ");

  // If item is labor or staff, do not match material definitions
  if (isLaborOrStaff && def.categoryType !== "ค่าแรง") return false;
  // If def is labor, do not match non-labor items unless code/prefix explicitly says 2xx or 3xx
  if (def.categoryType === "ค่าแรง" && !isLaborOrStaff && !catLower.startsWith("2") && !itemLower.startsWith("2") && !catLower.startsWith("3") && !itemLower.startsWith("3")) return false;
  // If item is distinctly staff, do not match contractor labor (201-223)
  if (isStaff && def.code !== "301") return false;
  // If def is 301 staff, do not match non-staff
  if (def.code === "301" && !isStaff && !catLower.startsWith("3") && !itemLower.startsWith("3")) return false;

  // 2. Specific categoryType checks
  if (def.code === "501" || def.field === "งบไม่เกินน้ำมัน") {
    if (isFuel) return true;
  }
  if (def.code === "502" || def.field === "งบไม่เกินซ่อมรถ") {
    if (isRepair) return true;
  }
  if (def.code === "503" || def.field === "งบไม่เกินเครื่องจักร") {
    if (isMachine) return true;
  }
  if (def.code === "504" || def.field === "งบไม่เกินเครื่องมือ") {
    if (isTool) return true;
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
  materialBudget: number; // งบค่าของ (ผลรวม 27 รายการ หรือ งบไม่เกินค่าของ)
  laborDirectBudget: number; // งบค่าแรง (ผลรวม 23 รายการ หรือ งบไม่เกินค่าแรง)
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

  // รายการแจกแจงระดับไอเท็ม
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

  // 1. คำนวณยอดจัดสรรของ 27 รายการค่าของ
  const materialSubTotal = ALLOCATED_BUDGET_ITEMS
    .filter(i => i.group === "ค่าของ (Material Cost Code)")
    .reduce((sum, item) => sum + getProjectBudgetValue(project, item.field, item.code), 0);

  const rawMaterialCap = toNumber(project["งบไม่เกินค่าของ"]);
  const materialBudget = Math.max(rawMaterialCap, materialSubTotal);

  // 2. คำนวณยอดจัดสรรของ 24 รายการค่าแรง (รวมพนักงาน 301)
  const laborSubTotal = ALLOCATED_BUDGET_ITEMS
    .filter(i => i.group === "ค่าแรง (Labor Cost Code)")
    .reduce((sum, item) => sum + getProjectBudgetValue(project, item.field, item.code), 0);

  const rawLaborCap = toNumber(project["งบไม่เกินค่าแรง"]);
  const staffBudget = toNumber(project["งบไม่เกินพนักงาน"]);
  const laborBudget = Math.max(rawLaborCap, laborSubTotal, (rawLaborCap + staffBudget));
  const laborDirectBudget = laborBudget;

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
      if (isLaborCost(item.categoryType)) actualLaborPaid += item.amount;
      else if (isStaffCost(item.categoryType)) actualStaffPaid += item.amount;
      else if (isMaterialCost(item.categoryType)) actualMaterialPaid += item.amount;
      else actualOtherPaid += item.amount;
    } else {
      pendingTotal += item.amount;
    }
  }

  // 5. คำนวณการใช้จ่ายราย BudgetItemDefinition
  const analyzedItems: BudgetItemAnalysis[] = ALLOCATED_BUDGET_ITEMS.map(def => {
    let budgetCap = getProjectBudgetValue(project, def.field, def.code);

    // If there is an un-itemized material budget, attribute the remaining un-itemized portion to "123 ดำเนินการ(อื่นๆ)"
    if (def.field === "งบไม่เกินดำเนินการ" && budgetCap <= 0 && rawMaterialCap > materialSubTotal) {
      budgetCap = rawMaterialCap - materialSubTotal;
    }
    // If there is an un-itemized labor budget, attribute the remaining un-itemized portion to "223 ค่าบริการ(อื่นๆ)"
    if (def.code === "223" && budgetCap <= 0 && rawLaborCap > laborSubTotal) {
      budgetCap = rawLaborCap - laborSubTotal;
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

  // 6. จัดกลุ่มตาม 2 หมวดหลัก
  const groupNames: BudgetGroup[] = [
    "ค่าของ (Material Cost Code)",
    "ค่าแรง (Labor Cost Code)"
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
