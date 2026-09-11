export const APP_NAME = "Cost Test";

export const TABLES = {
  DATA: "Data",
  PROJECT: "Project",
  STORE: "ร้านค้า",
  CONTRACTOR: "รับเหมา",
  CAR: "ทะเบียน",
  BANK: "ธนาคาร",
  CATEGORY: "ประเภท",
  FILTER: "Filter",
  PEOPLE: "รายชื่อ",
  FILTER_MAIN: "Filter_main",
  MAIN: "main",
  MAIN2: "main2",
  CONTRACT_WORK: "งานรับเหมา",
  CUSTOMER: "ลูกค้า",
  COMPANY: "บริษัท",
  LOAN: "ยืมเงิน",
  MAIN3: "main3",
  MAIN4: "main4",
  MAIN5: "main5",
  WITHDRAW: "เบิกเงิน",
  SYSTEM_OPTIONS: "ตัวเลือกระบบ",
  PRODUCT: "สินค้า",
  TASKS: "Tasks",
  WORKS: "Works",
  PLANS: "Plan"
} as const;

export const TABLE_KEYS: Record<string, string> = {
  [TABLES.DATA]: "ลำดับ",
  bills: "ลำดับ",

  [TABLES.PROJECT]: "ID Project",
  projects: "ID Project",

  [TABLES.STORE]: "id_store",
  stores: "id_store",

  [TABLES.CONTRACTOR]: "id_Contractor",
  contractors: "id_Contractor",

  [TABLES.CAR]: "id_car",
  cars: "id_car",

  [TABLES.PEOPLE]: "รหัสพนักงาน",
  พนักงาน: "รหัสพนักงาน",
  ชื่อพนักงาน: "รหัสพนักงาน",
  "6. ชื่อพนักงาน": "รหัสพนักงาน",
  รายชื่อพนักงาน: "รหัสพนักงาน",
  master_members: "รหัสพนักงาน",
  PEOPLE: "รหัสพนักงาน",
  people: "รหัสพนักงาน",
  "Master Member": "รหัสพนักงาน",

  [TABLES.FILTER_MAIN]: "id_fmain",

  [TABLES.CONTRACT_WORK]: "id_Conwork",
  ContractWork: "id_Conwork",
  Contract_work: "id_Conwork",
  contract_work: "id_Conwork",
  contractwork: "id_Conwork",
  contract_works: "id_Conwork",

  [TABLES.TASKS]: "id",
  tasks: "id",

  [TABLES.WORKS]: "id",
  works: "id",

  [TABLES.PLANS]: "id",
  plans: "id",

  [TABLES.BANK]: "id_bank",
  banks: "id_bank",

  [TABLES.CUSTOMER]: "id_cus",
  customers: "id_cus",

  [TABLES.COMPANY]: "id_Company",
  companies: "id_Company",

  [TABLES.LOAN]: "id",
  loans: "id",

  [TABLES.PRODUCT]: "id_product",
  products: "id_product"
};

export const PRIMARY_VIEWS = [
  { id: "dashboard-main", name: "Main Program", type: "dashboard", position: "first", items: ["กรอง main", "main", "main2", "main 3", "main 4", "main 5"] },
  { id: "bill-entry", name: "กรอกบิล", type: "table", table: TABLES.DATA, position: "first" },
  { id: "withdraw-request", name: "ตั้งเบิก", type: "dashboard", position: "first", items: ["ตรวจการเบิกเงิน", "บิลหลัก/ย่อย", "รวมยอด รออนุมัติ(บาท)", "ยอดโอน รออนุมัติ(บาท)"] },
  { id: "contract-open", name: "เปิดจ้าง", type: "table", table: TABLES.CONTRACT_WORK, position: "next" },
  { id: "bill-follow", name: "ตามบิล", type: "dashboard", position: "next", items: ["ตาม vat", "หัก 3", "หัก 3 บริษัท", "เครดิต"] },
  { id: "work-status", name: "งานที่ทำ", type: "dashboard", position: "last", items: ["Project ทำอยู่", "Project เสร็จแล้ว"] },
  { id: "documents", name: "เอกสาร", type: "dashboard", position: "next", items: ["สัญญาจ้างเหมา", "ใบสำคัญจ่าย", "หนังสือรับรอง 50 ทวิ", "พิมพ์ชุดเอกสาร"] },
  { id: "reports", name: "สรุปข้อมูล", type: "dashboard", position: "next", items: ["สรุปค่าของ", "สรุปค่าแรง", "ค่าแรงต่อคน", "ค่าของต่อร้าน"] },
  { id: "project-analytics", name: "สรุปโครงการ", type: "dashboard", position: "next", items: ["เปรียบเทียบงบประมาณ", "สัดส่วนรายจ่าย", "วิเคราะห์กำไร", "สถานะโครงการ"] },
  { id: "project-all", name: "1. Project รวม", type: "table", table: TABLES.PROJECT, position: "menu" },
  { id: "banks", name: "2. ธนาคาร", type: "table", table: TABLES.BANK, position: "menu" },
  { id: "categories", name: "3. ประเภท", type: "table", table: TABLES.CATEGORY, position: "menu" },
  { id: "stores", name: "4. ร้านค้า", type: "table", table: TABLES.STORE, position: "menu" },
  { id: "contractors", name: "5. รับเหมา", type: "table", table: TABLES.CONTRACTOR, position: "menu" },
  { id: "people", name: "6. ชื่อพนักงาน", type: "table", table: TABLES.PEOPLE, position: "menu" },
  { id: "cars", name: "7. ทะเบียนรถ", type: "table", table: TABLES.CAR, position: "menu" },
  { id: "customers", name: "8. ลูกค้า", type: "table", table: TABLES.CUSTOMER, position: "menu" },
  { id: "companies", name: "9. บริษัท", type: "table", table: TABLES.COMPANY, position: "menu" },
  { id: "loans", name: "10. ยืมเงิน", type: "table", table: TABLES.LOAN, position: "menu" },
  { id: "tasks", name: "1. จัดการงาน (Tasks)", type: "table", table: TABLES.TASKS, position: "task" },
  { id: "works", name: "2. งานรับเหมา & PW", type: "table", table: TABLES.WORKS, position: "task" }
] as const;

export const VIEW_COLUMNS: Record<string, string[]> = {
  "กรอกบิล": ["ลำดับ", "ID Project", "ชื่อ Project", "ร้าน/บุคคล", "สินค้า/ทำงาน", "บิล", "ประเภท", "ยอดเงิน", "vat", "หัก", "เครดิต", "ผู้เบิก", "ว/ด/ป", "รูปถ่ายบิล", "สถานะ"],
  "เปิดจ้าง": ["รหัสจ้าง", "ผู้รับเหมา", "รหัสโครงการ", "ชื่อโครงการ", "ยอดเงินจ้าง", "รายละเอียดงาน", "วันที่", "เบอร์โทรศัพท์", "ยอดเงินจ่าย", "ค่าแรงคงเหลือ"],
  "1. Project รวม": ["ID Project", "ชื่อ Project", "ชื่อลูกค้า", "ยอดงาน", "ยอดรวม vat", "งบไม่เกิน", "วันที่", "color", "รวม ALL", "บริษัท", "รับผิดชอบ"],
  "2. ธนาคาร": ["id_bank", "ชื่อธนาคาร", "image"],
  "3. ประเภท": ["ประเภท Name1", "ประเภท Name2", "ประเภท Name3"],
  "4. ร้านค้า": ["id_store", "ชื่อร้านค้า", "ชื่อเต็ม", "เลขบัญชี", "ธนาคาร", "เบอร์โทร", "ที่อยู่", "เลขที่ผู้เสียภาษี"],
  "5. รับเหมา": ["id_Contractor", "ชื่อเล่น", "ชื่อ-นามสกุล", "เลขบัญชี", "ธนาคาร", "บัตรประจำตัวประชาชน", "เบอร์โทรศัพท์", "ที่อยู่", "รวมยอดเงินจ้าง", "จำกัดยอด/ปี"],
  "6. ชื่อพนักงาน": ["รหัสพนักงาน", "ชื่อเล่น", "ชื่อ-นามสกุล", "LINE", "สิทธิ์การใช้งาน", "เลขบัญชี", "ธนาคาร", "เบอร์โทร", "ที่อยู่", "เลขที่บัตรประชาชน"],
  "พนักงาน": ["รหัสพนักงาน", "ชื่อเล่น", "ชื่อ-นามสกุล", "LINE", "สิทธิ์การใช้งาน", "เลขบัญชี", "ธนาคาร", "เบอร์โทร", "ที่อยู่", "เลขที่บัตรประชาชน"],
  "people": ["รหัสพนักงาน", "ชื่อเล่น", "ชื่อ-นามสกุล", "LINE", "สิทธิ์การใช้งาน", "เลขบัญชี", "ธนาคาร", "เบอร์โทร", "ที่อยู่", "เลขที่บัตรประชาชน"],
  "รายชื่อ": ["รหัสพนักงาน", "ชื่อเล่น", "ชื่อ-นามสกุล", "LINE", "สิทธิ์การใช้งาน", "เลขบัญชี", "ธนาคาร", "เบอร์โทร", "ที่อยู่", "เลขที่บัตรประชาชน"],
  "7. ทะเบียนรถ": ["id_car", "หมายเลขทะเบียน", "ยี่ห้อรถ", "สี", "รับผิดชอบ", "รถของ"],
  "8. ลูกค้า": ["id_cus", "ชื่อลูกค้า", "ที่อยู่", "เลขที่ผู้เสียภาษี"],
  "8.ลูกค้า": ["id_cus", "ชื่อลูกค้า", "ที่อยู่", "เลขที่ผู้เสียภาษี"],
  "9. บริษัท": ["id_Company", "ชื่ออังกฤษ", "ชื่อบริษัท", "สำนักงาน", "ที่อยู่", "เลขที่สียภาษี ", "เบอร์โทร"],
  "10. ยืมเงิน": ["id", "ชื่อ", "type", "จำนวนเงิน", "วันที่"],
  "1. จัดการงาน (Tasks)": ["ลำดับ", "รายการ", "ดู/ทำ", "ส่งงาน", "ผู้รับมอบหมาย", "ประเภท", "สถานะ"],
  "11. จัดการงาน (Tasks)": ["ลำดับ", "รายการ", "ดู/ทำ", "ส่งงาน", "ผู้รับมอบหมาย", "ประเภท", "สถานะ"],
  "tasks": ["ลำดับ", "รายการ", "ดู/ทำ", "ส่งงาน", "ผู้รับมอบหมาย", "ประเภท", "สถานะ"],
  "2. งานรับเหมา & PW": ["ลำดับ", "ทีม", "กิจกรรม", "เรื่อง", "PR", "สถานที่", "นัดดู", "นัดเสนอ", "ติดต่อ1", "เบอร์1", "บริษัท", "สถานะ", "หมายเหตุ"],
  "12. งานรับเหมา & PW": ["ลำดับ", "ทีม", "กิจกรรม", "เรื่อง", "PR", "สถานที่", "นัดดู", "นัดเสนอ", "ติดต่อ1", "เบอร์1", "บริษัท", "สถานะ", "หมายเหตุ"],
  "works": ["ลำดับ", "ทีม", "กิจกรรม", "เรื่อง", "PR", "สถานที่", "นัดดู", "นัดเสนอ", "ติดต่อ1", "เบอร์1", "บริษัท", "สถานะ", "หมายเหตุ"],
  "11. ประเภทสินค้า": ["รหัสสินค้า", "ชื่อประเภทสินค้า", "หมายเหตุ"]
};
