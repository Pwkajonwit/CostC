/**
 * Cost Code System Constants & Helpers
 * Based on New Material Cost Code System
 */

export interface CostCodeItem {
  code: string;
  name: string;
  category: string;
  group: "material" | "labor" | "staff" | "equipment";
  subItems?: string[];
}

// 1. หมวด 100: ค่าของ (Material Cost Code)
export const MATERIAL_100_CODES = [
  { code: "101", name: "เตรียมงาน" },
  { code: "102", name: "ดิน/ทราย/หิน" },
  { code: "103", name: "เสาเข็ม" },
  { code: "104", name: "เหล็กเส้น" },
  { code: "105", name: "ไม้แบบค้ำยัน" },
  { code: "106", name: "คอนกรีตผสมเสร็จ" },
  { code: "107", name: "เหล็กรูปพรรณ" },
  { code: "108", name: "วัสดุหลังคา" },
  { code: "109", name: "ก่อฉาบ" },
  { code: "110", name: "ฝ้าเพดาน" },
  { code: "111", name: "ผิวพื้นผนัง" },
  { code: "112", name: "ประตูหน้าต่าง" },
  { code: "113", name: "ทาสี" },
  { code: "114", name: "สุขภัณฑ์" },
  { code: "115", name: "ระบบประปา" },
  { code: "116", name: "ระบบไฟฟ้า" },
  { code: "117", name: "ระบบปรับอากาศ" },
  { code: "118", name: "ตบแต่งภายใน" },
  { code: "119", name: "เฟอร์นิเจอร์" },
  { code: "120", name: "ภูมิทัศน์" },
  { code: "121", name: "แก้ไขเก็บงาน" },
  { code: "122", name: "ตั้งนั่งร้าน" },
  { code: "123", name: "ดำเนินการ(อื่นๆ)" }
] as const;

// Sub-items สำหรับ 123 ดำเนินการ(อื่นๆ)
export const SUB_ITEMS_123 = [
  "1 อุปกรณ์สำนักงาน",
  "2 ค่าที่พัก",
  "3 ค่าเช่าที่ดิน",
  "4 ค่าผ่อนรถ",
  "5 ค่าน้ำ/ค่าไฟ",
  "6 โทรศัพท์",
  "7 ค่าอาหาร",
  "8 ค่าฝึกอบรม",
  "9 ค่าตรวจสุขภาพ",
  "10 ค่าเดินทางช่าง",
  "11 ค่าส่งเอกสาร",
  "12 ค่าธรรมเนียม",
  "13 ค่าประกันภัย"
];

// 2. หมวด 500: ค่าของ (ยานพาหนะ/เครื่องจักร/เครื่องมือ)
export const EQUIPMENT_500_CODES = [
  { code: "501", name: "น้ำมัน" },
  { code: "502", name: "ซ่อมรถ" },
  { code: "503", name: "เครื่องจักร" },
  { code: "504", name: "เครื่องมือ" }
] as const;

// 3. หมวด 200: ค่าแรง (Material Cost Code)
export const LABOR_200_CODES = [
  { code: "201", name: "เตรียมงาน" },
  { code: "202", name: "ดิน/ทราย/หิน" },
  { code: "203", name: "เสาเข็ม" },
  { code: "204", name: "เหล็กเส้น" },
  { code: "205", name: "ไม้แบบค้ำยัน" },
  { code: "206", name: "คอนกรีตผสมเสร็จ" },
  { code: "207", name: "เหล็กรูปพรรณ" },
  { code: "208", name: "วัสดุหลังคา" },
  { code: "209", name: "ก่อฉาบ" },
  { code: "210", name: "ฝ้าเพดาน" },
  { code: "211", name: "ผิวพื้นผนัง" },
  { code: "212", name: "ประตูหน้าต่าง" },
  { code: "213", name: "ทาสี" },
  { code: "214", name: "สุขภัณฑ์" },
  { code: "215", name: "ระบบประปา" },
  { code: "216", name: "ระบบไฟฟ้า" },
  { code: "217", name: "ระบบปรับอากาศ" },
  { code: "218", name: "ตบแต่งภายใน" },
  { code: "219", name: "เฟอร์นิเจอร์" },
  { code: "220", name: "ภูมิทัศน์" },
  { code: "221", name: "แก้ไขเก็บงาน" },
  { code: "222", name: "ตั้งนั่งร้าน" },
  { code: "223", name: "ค่าบริการ(อื่นๆ)" }
] as const;

// Sub-items สำหรับ 223 ค่าบริการ(อื่นๆ)
export const SUB_ITEMS_223 = [
  "1 ออกแบบ",
  "2 เซ็นรับรอง",
  "3 เงินพิเศษ"
];

// 4. หมวด 300: พนักงาน
export const STAFF_300_CODES = [
  { code: "301", name: "พนักงาน" }
] as const;

// Format label e.g. "101 เตรียมงาน"
export const MATERIAL_CATEGORY_OPTIONS = MATERIAL_100_CODES.map(c => `${c.code} ${c.name}`);
export const PURE_MATERIAL_CATEGORY_OPTIONS = MATERIAL_100_CODES.filter(c => c.code !== "123").map(c => `${c.code} ${c.name}`);
export const EQUIPMENT_CATEGORY_OPTIONS = EQUIPMENT_500_CODES.map(c => `${c.code} ${c.name}`);
export const LABOR_CATEGORY_OPTIONS = LABOR_200_CODES.map(c => `${c.code} ${c.name}`);
export const STAFF_CATEGORY_OPTIONS = STAFF_300_CODES.map(c => `${c.code} ${c.name}`);

// ค่าของ ทั้งหมด (101-123 + 501-504)
export const ALL_STORE_CATEGORIES = [
  ...MATERIAL_CATEGORY_OPTIONS,
  ...EQUIPMENT_CATEGORY_OPTIONS
];

// ผู้รับเหมา ทั้งหมด (201-223 + 301)
export const ALL_CONTRACTOR_CATEGORIES = [
  ...LABOR_CATEGORY_OPTIONS,
  ...STAFF_CATEGORY_OPTIONS
];

// รวมทุกประเภทใหม่
export const ALL_NEW_CATEGORIES = [
  ...ALL_STORE_CATEGORIES,
  ...ALL_CONTRACTOR_CATEGORIES
];

/**
 * Check whether a category string belongs to a specific group
 * Supports both new formats ("101 เตรียมงาน", "501 น้ำมัน", "201 เตรียมงาน")
 * and legacy formats ("1.ค่าของ", "4.น้ำมัน", "2.ค่าแรง", etc.) for backward compatibility
 */
export function isMaterialCost(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "1.ค่าของ" || c === "ค่าของ") return true;
  // 101 - 122 (123 ดำเนินการ(อื่นๆ) เป็นค่าใช้จ่ายอื่นๆ)
  if (/^1(?:0[1-9]|1[0-9]|2[0-2])\b/.test(c)) return true;
  return false;
}

export function isLaborCost(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "2.ค่าแรง" || c === "ค่าแรง") return true;
  // 201 - 223
  if (/^2(?:0[1-9]|1[0-9]|2[0-3])\b/.test(c)) return true;
  return false;
}

export function isStaffCost(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "3.พนักงาน" || c === "พนักงาน") return true;
  if (/^301\b/.test(c) || c.includes("พนักงาน")) return true;
  return false;
}

export function isFuelCost(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "4.น้ำมัน" || c === "น้ำมัน") return true;
  if (/^501\b/.test(c) || c.includes("น้ำมัน")) return true;
  return false;
}

export function isRepairCost(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "5.ซ่อมรถ" || c === "ซ่อมรถ") return true;
  if (/^502\b/.test(c) || c.includes("ซ่อมรถ")) return true;
  return false;
}

export function isMachineCost(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "6.เครื่องจักร" || c === "เครื่องจักร") return true;
  if (/^503\b/.test(c) || c.includes("เครื่องจักร")) return true;
  return false;
}

export function isToolCost(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "7.เครื่องมือ" || c === "เครื่องมือ") return true;
  if (/^504\b/.test(c) || c.includes("เครื่องมือ")) return true;
  return false;
}

export function isOtherExpense(cat: string = ""): boolean {
  const c = String(cat).trim();
  if (c === "8.อื่นๆ" || c === "อื่นๆ") return true;
  if (/^123\b/.test(c) || /^223\b/.test(c)) return true;
  return false;
}

/**
 * Returns which expense field in the database should hold the amount:
 * "ค่าของ" | "ค่าแรง" | "พนักงาน" | "น้ำมัน" | "ซ่อมรถ" | "เครื่องจักร" | "เครื่องมือ" | "อื่นๆ"
 */
export function getExpenseFieldForCategory(cat: string = ""): string {
  if (isFuelCost(cat)) return "น้ำมัน";
  if (isRepairCost(cat)) return "ซ่อมรถ";
  if (isMachineCost(cat)) return "เครื่องจักร";
  if (isToolCost(cat)) return "เครื่องมือ";
  if (isStaffCost(cat)) return "พนักงาน";
  if (isLaborCost(cat)) return "ค่าแรง";
  if (isOtherExpense(cat)) {
    if (/^223\b/.test(cat)) return "ค่าแรง";
    return "อื่นๆ";
  }
  if (isMaterialCost(cat)) return "ค่าของ";
  return "ค่าของ";
}

/**
 * Badge style for UI rendering
 */
export function getCostCodeBadgeStyle(cat: string = ""): string {
  if (isMaterialCost(cat)) return "bg-emerald-50 text-emerald-800 border-emerald-200/90";
  if (isLaborCost(cat)) return "bg-amber-50 text-amber-800 border-amber-200/90";
  if (isStaffCost(cat)) return "bg-blue-50 text-blue-800 border-blue-200/90";
  if (isFuelCost(cat)) return "bg-sky-50 text-sky-800 border-sky-200/90";
  if (isRepairCost(cat)) return "bg-purple-50 text-purple-800 border-purple-200/90";
  if (isMachineCost(cat)) return "bg-orange-50 text-orange-800 border-orange-200/90";
  if (isToolCost(cat)) return "bg-teal-50 text-teal-800 border-teal-200/90";
  return "bg-slate-100 text-slate-800 border-slate-300";
}

export function isFuelProduct(prod: unknown): boolean {
  const str = String(prod || "").trim();
  return str === "501 น้ำมัน" || str === "101 น้ำมัน" || str.includes("น้ำมัน") || str.startsWith("501");
}

export function isMachineProduct(prod: unknown): boolean {
  const str = String(prod || "").trim();
  return str === "503 เครื่องจักร" || str === "103 เครื่องจักร" || str.includes("เครื่องจักร") || str.startsWith("503");
}

export function isCarRepairProduct(prod: unknown): boolean {
  const str = String(prod || "").trim();
  return str === "502 ซ่อมรถ" || str === "104 ซ่อมรถ" || str.includes("ซ่อมรถ") || str.startsWith("502");
}

export function isOtherExpenseProduct(prod: unknown): boolean {
  const str = String(prod || "").trim();
  return str === "123 ดำเนินการ(อื่นๆ)" || str === "223 ค่าบริการ(อื่นๆ)" || str === "200 ดำเนินการ(อื่นๆ)" || str.includes("ดำเนินการ") || str.startsWith("123") || str.startsWith("223") || str.startsWith("200");
}

export function isToolProduct(prod: unknown): boolean {
  const str = String(prod || "").trim();
  return str === "504 เครื่องมือ" || str === "105 เครื่องมือ" || str.includes("เครื่องมือ") || str.startsWith("504");
}

export function deriveCategoryFromProduct(prod: unknown): string {
  const p = String(prod || "").trim();
  if (!p) return "";
  if (isFuelProduct(p)) return "501 น้ำมัน";
  if (isCarRepairProduct(p)) return "502 ซ่อมรถ";
  if (isMachineProduct(p)) return "503 เครื่องจักร";
  if (isToolProduct(p)) return "504 เครื่องมือ";
  if (isOtherExpenseProduct(p)) return p.startsWith("223") ? "223 ค่าบริการ(อื่นๆ)" : "123 ดำเนินการ(อื่นๆ)";

  const matched = ALL_STORE_CATEGORIES.find(c => c === p || (c.startsWith(p.slice(0, 3)) && p.length >= 3));
  if (matched) return matched;
  return p;
}

/**
 * Map new Cost Code or Product Name to Project Budget Field (งบไม่เกิน...)
 */
export function getCostCodeBudgetField(codeOrName: string): string {
  const clean = String(codeOrName || "").trim();
  if (!clean) return "";

  // 500 ยานพาหนะ / เครื่องจักร / เครื่องมือ
  if (clean.startsWith("501") || clean.includes("น้ำมัน")) return "งบไม่เกินน้ำมัน";
  if (clean.startsWith("502") || clean.includes("ซ่อมรถ")) return "งบไม่เกินซ่อมรถ";
  if (clean.startsWith("503") || clean.includes("เครื่องจักร")) return "งบไม่เกินเครื่องจักร";
  if (clean.startsWith("504") || clean.includes("เครื่องมือ")) return "งบไม่เกินเครื่องมือ";

  // 100 ค่าของ (Material)
  if (clean.startsWith("101") || clean.includes("เตรียมงาน")) return "งบไม่เกินเตรียมงาน";
  if (clean.startsWith("102") || clean.includes("หินทราย") || clean.includes("ดิน/ทราย/หิน")) return "งบไม่เกินหินทราย";
  if (clean.startsWith("103") || clean.includes("เสาเข็ม")) return "งบไม่เกินเสาเข็ม";
  if (clean.startsWith("104") || clean.includes("เหล็กเส้น")) return "งบไม่เกินเหล็กเส้น";
  if (clean.startsWith("105") || clean.includes("ไม้แบบ")) return "งบไม่เกินไม้แบบ";
  if (clean.startsWith("106") || clean.includes("คอนกรีต")) return "งบไม่เกินคอนกรีต";
  if (clean.startsWith("107") || clean.includes("รูปพรรณ")) return "งบไม่เกินรูปพรรณ";
  if (clean.startsWith("108") || clean.includes("หลังคา") || clean.includes("วัสดุมุง")) return "งบไม่เกินวัสดุมุง";
  if (clean.startsWith("109") || clean.includes("ก่อฉาบ") || clean.includes("ปูน")) return "งบไม่เกินก่อฉาบ";
  if (clean.startsWith("110") || clean.includes("ฝ้า")) return "งบไม่เกินฝ้าผนัง";
  if (clean.startsWith("111") || clean.includes("ปูพื้น") || clean.includes("ผิวพื้นผนัง")) return "งบไม่เกินปูพื้น";
  if (clean.startsWith("112") || clean.includes("ประตูหน้าต่าง") || clean.includes("กระจก")) return "งบไม่เกินกระจก";
  if (clean.startsWith("113") || clean.includes("ทาสี") || clean.includes("สีเคมี")) return "งบไม่เกินสีเคมี";
  if (clean.startsWith("114") || clean.includes("สุขภัณฑ์")) return "งบไม่เกินสุขภัณฑ์";
  if (clean.startsWith("115") || clean.includes("ประปา")) return "งบไม่เกินประปา";
  if (clean.startsWith("116") || clean.includes("ไฟฟ้า")) return "งบไม่เกินไฟฟ้า";
  if (clean.startsWith("117") || clean.includes("ปรับอากาศ") || clean.includes("แอร์")) return "งบไม่เกินแอร์";
  if (clean.startsWith("118") || clean.includes("บิวอิน") || clean.includes("ตบแต่งภายใน")) return "งบไม่เกินบิวอิน";
  if (clean.startsWith("119") || clean.includes("เฟอร์นิเจอร์")) return "งบไม่เกินเฟอร์นิเจอร์";
  if (clean.startsWith("120") || clean.includes("ภูมิทัศน์")) return "งบไม่เกินภูมิทัศน์";
  if (clean.startsWith("121") || clean.includes("แก้ไขเก็บงาน")) return "งบไม่เกินแก้ไขเก็บงาน";
  if (clean.startsWith("122") || clean.includes("ตั้งนั่งร้าน") || clean.includes("นั่งร้าน")) return "งบไม่เกินตั้งนั่งร้าน";
  if (clean.startsWith("123") || clean.includes("ดำเนินการ") || clean.includes("อื่นๆ")) return "งบไม่เกินดำเนินการ";

  // 200 ค่าแรง
  if (clean.startsWith("2") || clean.includes("ค่าแรง")) return "งบไม่เกินค่าแรง";

  // 300 พนักงาน
  if (clean.startsWith("3") || clean.includes("พนักงาน")) return "งบไม่เกินพนักงาน";

  // Fallback
  return "งบไม่เกินค่าของ";
}

/**
 * Friendly Budget Control Label for UI Display (e.g. "คุมงบ: งบไม่เกินน้ำมัน")
 */
export function getBudgetControlDisplayLabel(codeOrName: string): string {
  const field = getCostCodeBudgetField(codeOrName);
  return field ? `คุมงบ: ${field}` : "คุมงบ: งบไม่เกินค่าของ";
}

