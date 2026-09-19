import { TABLES } from "@/lib/config";
import type { FieldSchema } from "@/lib/types";
import {
  ALL_STORE_CATEGORIES,
  PURE_MATERIAL_CATEGORY_OPTIONS,
  ALL_CONTRACTOR_CATEGORIES,
  LABOR_CATEGORY_OPTIONS,
  SUB_ITEMS_123,
  SUB_ITEMS_223
} from "@/lib/cost-codes";

export const FORM_SCHEMAS: Record<string, FieldSchema[]> = {
  [TABLES.DATA]: [
    { name: "ลำดับ", type: "Text", key: true, initialValue: "nextDataSequence", required: true, readonlyOnEdit: true },
    { name: "ID Project", type: "Ref", refTable: TABLES.PROJECT, refKey: "ID Project", refLabel: "ชื่อ Project", validIf: "activeProjects", required: true, refFill: { "ชื่อ Project": "ชื่อ Project" } },
    { name: "ชื่อ Project", type: "Hidden" },
    { name: "บิล", type: "Enum", values: ["หลัก", "ย่อย"], initialValue: "หลัก", required: true, dynamicValues: "fieldOptions" },
    { name: "ร้านค้า/ผู้รับเหมา", type: "Enum", values: ["ร้านค้า", "ผู้รับเหมา"], inputMode: "buttons", initialValue: "ร้านค้า", required: true, description: "ร้านค้า บริษัท และ หจก. : ผู้รับเหมา และนิติบุคคล" },
    { name: "ร้านค้า", type: "Ref", refTable: TABLES.STORE, refKey: "id_store", refLabel: "ชื่อร้านค้า", required: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ร้านค้า" } },
    { name: "ผู้รับเหมา", type: "Ref", refTable: TABLES.CONTRACT_WORK, refKey: "id_Conwork", refLabel: "ชื่อเล่น", required: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ผู้รับเหมา" }, filterBy: { field: "ID Project", column: "ID Project", openContract: true }, refFill: { "รายละเอียดงาน": "รายละเอียดงาน", "ค่าแรงคงเหลือ": "{ค่าแรงคงเหลือ} จาก {ยอดเงินจ้าง}" } },
    { name: "รายละเอียดงาน", type: "Text", readonly: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ผู้รับเหมา" } },
    { name: "สินค้า", type: "Enum", values: [], dynamicValues: "productCategoryOptions", description: "ดึงจากตั้งค่าหมวดหมู่สินค้า" },
    { name: "ประเภท", type: "Enum", values: [], inputMode: "buttons", required: true, dynamicValues: "billTypeOptions" },
    { name: "รูปถ่ายบิล", type: "Image" },
    { name: "ค่าของ", label: "ค่าใช้จ่าย", type: "Decimal", required: true, showIf: { column: "ประเภท", in: [...PURE_MATERIAL_CATEGORY_OPTIONS, "1.ค่าของ"] } },
    { name: "ชื่อเครื่องมือ", type: "EnumList", values: [], dynamicValues: "fieldOptions", required: true, showIf: { column: "ประเภท", in: ["504 เครื่องมือ", "7.เครื่องมือ"] } },
    { name: "เครื่องมือ", label: "ค่าใช้จ่าย", type: "Decimal", required: true, showIf: { column: "ประเภท", in: ["504 เครื่องมือ", "7.เครื่องมือ"] } },
    { name: "น้ำมัน", label: "ค่าใช้จ่าย", type: "Decimal", required: true, showIf: { column: "ประเภท", in: ["501 น้ำมัน", "4.น้ำมัน"] } },
    { name: "ซ่อมรถ", label: "ค่าใช้จ่าย", type: "Decimal", required: true, showIf: { column: "ประเภท", in: ["502 ซ่อมรถ", "5.ซ่อมรถ"] } },
    { name: "ทะเบียน", type: "Ref", refTable: TABLES.CAR, refKey: "id_car", refLabel: "หมายเลขทะเบียน", required: true, showIf: { column: "ประเภท", in: ["501 น้ำมัน", "502 ซ่อมรถ", "4.น้ำมัน", "5.ซ่อมรถ"] } },
    { name: "เครื่องจักร", label: "ค่าใช้จ่าย", type: "Decimal", required: true, showIf: { column: "ประเภท", in: ["503 เครื่องจักร", "6.เครื่องจักร"] } },
    { name: "statusค่าแรง", type: "Enum", values: ["บุคคลธรรมดา", "บริษัท"], inputMode: "buttons", required: true, dynamicValues: "fieldOptions", showIf: { column: "ประเภท", in: [...ALL_CONTRACTOR_CATEGORIES, "2.ค่าแรง"] } },
    { name: "ค่าแรงคงเหลือ", type: "Text", readonly: true, showIf: { column: "ร้านค้า/ผู้รับเหมา", equals: "ผู้รับเหมา" } },
    { name: "อื่นๆ", label: "ค่าใช้จ่าย", type: "Decimal", required: true, showIf: { column: "ประเภท", in: ["123 ดำเนินการ(อื่นๆ)", "223 ค่าบริการ(อื่นๆ)", "8.อื่นๆ"] } },
    { name: "รายการ", type: "Enum", values: [...SUB_ITEMS_123, ...SUB_ITEMS_223], dynamicValues: "fieldOptions", showIf: { column: "ประเภท", in: ["123 ดำเนินการ(อื่นๆ)", "223 ค่าบริการ(อื่นๆ)", "8.อื่นๆ"] } },
    { name: "vat", type: "Enum", values: ["1", "3", "5", "7", "ระบุเอง"], inputMode: "buttons", dynamicValues: "fieldOptions", showIf: { column: "ประเภท", in: [...ALL_STORE_CATEGORIES, "1.ค่าของ", "4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร", "7.เครื่องมือ", "8.อื่นๆ"] } },
    { name: "เครดิต", type: "Enum", values: ["30", "45", "60", "ระบุเอง"], inputMode: "buttons", dynamicValues: "fieldOptions", showIf: { column: "ประเภท", in: [...ALL_STORE_CATEGORIES, "1.ค่าของ", "4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร", "7.เครื่องมือ", "8.อื่นๆ"] } },
    { name: "วันได้บิล", type: "Date", showIf: { column: "vat", notBlank: true } },
    { name: "วันจ่าย", type: "Date" },
    { name: "ค่าแรง", type: "Decimal", required: true, showIf: { column: "ประเภท", in: [...LABOR_CATEGORY_OPTIONS, "2.ค่าแรง"] } },
    { name: "หัก", type: "Enum", values: ["1", "3", "5", "ระบุเอง"], inputMode: "buttons", dynamicValues: "fieldOptions", description: "เลือกเปอร์เซ็นต์หัก หรือระบุเอง", showIf: { column: "ประเภท", in: [...ALL_CONTRACTOR_CATEGORIES, "123 ดำเนินการ(อื่นๆ)", "223 ค่าบริการ(อื่นๆ)", "2.ค่าแรง", "8.อื่นๆ"] } },
    { name: "จำนวนหัก", type: "Decimal", showIf: { column: "หัก", notBlank: true } },
    { name: "วันออก 3%", type: "Date", showIf: { column: "หัก", notBlank: true } },
    { name: "ชื่อพนักงาน", type: "Ref", refTable: TABLES.PEOPLE, refKey: "รหัสพนักงาน", refLabel: "ชื่อเล่น", required: true, showIf: { column: "ประเภท", in: ["301 พนักงาน", "หมวด 300 พนักงาน", "3.พนักงาน"] } },
    { name: "พนักงาน", label: "จำนวน", type: "Decimal", required: true, showIf: { column: "ประเภท", in: ["301 พนักงาน", "หมวด 300 พนักงาน", "3.พนักงาน"] } },
    { name: "ผู้เบิก", type: "Ref", refTable: TABLES.PEOPLE, refKey: "รหัสพนักงาน", refLabel: "ชื่อเล่น", required: true },
    { name: "ผู้สร้างบิล", type: "Hidden" },
    { name: "ว/ด/ป", type: "Date", initialValue: "today" },
    { name: "สถานะ", type: "Hidden" },
    { name: "ยอดเงิน", type: "Hidden" },
    { name: "ร้าน/บุคคล", type: "Hidden" },
    { name: "สินค้า/ทำงาน", type: "Hidden" },
    { name: "ยอดโอน", type: "Hidden" }
  ],
  [TABLES.PROJECT]: [
    { name: "ID Project", type: "Number", key: true, initialValue: "nextProjectId", required: true },
    { name: "ชื่อ Project", type: "Text", required: true },
    {
      name: "ชื่อลูกค้า",
      type: "Ref",
      refTable: TABLES.CUSTOMER,
      refKey: "id_cus",
      refLabel: "ชื่อลูกค้า",
      refFill: { "สถานที่": "ชื่อลูกค้า" }
    },
    { name: "สถานที่", type: "Text", readonly: true },
    { name: "ยอดงาน", type: "Number", required: true },
    { name: "ยอดรวม vat", type: "Number" },
    { name: "งบไม่เกิน", type: "Number" },
    { name: "วันที่", type: "Date", initialValue: "today" },
    { name: "color", type: "Enum", values: ["Red", "Green", "Black"], inputMode: "buttons", initialValue: "Red" },
    {
      name: "บริษัท",
      type: "Ref",
      refTable: TABLES.COMPANY,
      refKey: "id_Company",
      refLabel: "ชื่อบริษัท"
    },
    { name: "รับผิดชอบ", type: "Enum", values: ["PW1", "PW2", "PW3", "PW4", "PW"], inputMode: "dropdown" },
    {
      name: "คุมงบประเภทงาน",
      type: "Enum",
      values: [
        "คุมงบรายสินค้า (18 หมวด)",
        "คุมงบ 8 หมวดหลัก",
        "รวมจ่ายประเภทงาน1",
        "รวมจ่ายประเภทงาน2",
        "รวมจ่ายเงิน",
        "กำหนดเอง (Custom Matrix)"
      ],
      inputMode: "buttons"
    },
    { name: "งบไม่เกินปูนทรายหิน", type: "Number" },
    { name: "งบไม่เกินเสาเข็ม", type: "Number" },
    { name: "งบไม่เกินเหล็กเส้น", type: "Number" },
    { name: "งบไม่เกินรูปพรรณ", type: "Number" },
    { name: "งบไม่เกินคอนกรีต", type: "Number" },
    { name: "งบไม่เกินไม้แบบ", type: "Number" },
    { name: "งบไม่เกินวัสดุมุง", type: "Number" },
    { name: "งบไม่เกินก่อฉาบ", type: "Number" },
    { name: "งบไม่เกินฝ้าผนัง", type: "Number" },
    { name: "งบไม่เกินปูพื้น", type: "Number" },
    { name: "งบไม่เกินกระจก", type: "Number" },
    { name: "งบไม่เกินไฟฟ้า", type: "Number" },
    { name: "งบไม่เกินประปา", type: "Number" },
    { name: "งบไม่เกินอื่นๆ", type: "Number" },
    { name: "งบไม่เกินสีเคมี", type: "Number" },
    { name: "งบไม่เกินสุขภัณฑ์", type: "Number" },
    { name: "งบไม่เกินบิวอิน", type: "Number" },
    { name: "งบไม่เกินเฟอร์นิเจอร์", type: "Number" },
    { name: "งบไม่เกินภูมิทัศน์", type: "Number" },
    { name: "งบไม่เกินแก้ไขเก็บงาน", type: "Number" },
    { name: "งบไม่เกินตั้งนั่งร้าน", type: "Number" },
    { name: "งบไม่เกินดำเนินการ", type: "Number" },
    { name: "งบไม่เกินแอร์", type: "Number" },
    { name: "งบไม่เกินดิน", type: "Number" },
    { name: "งบไม่เกินหินทราย", type: "Number" },
    { name: "งบไม่เกินเตรียมงาน", type: "Number" },
    { name: "งบไม่เกินค่าของ", type: "Number" },
    { name: "งบไม่เกินค่าแรง", type: "Number" },
    { name: "งบไม่เกินพนักงาน", type: "Number" },
    { name: "งบไม่เกินน้ำมัน", type: "Number" },
    { name: "งบไม่เกินซ่อมรถ", type: "Number" },
    { name: "งบไม่เกินเครื่องจักร", type: "Number" },
    { name: "งบไม่เกินเครื่องมือ", type: "Number" },
    { name: "งบไม่เกินค่าแรง_201", type: "Number" },
    { name: "งบไม่เกินค่าแรง_202", type: "Number" },
    { name: "งบไม่เกินค่าแรง_203", type: "Number" },
    { name: "งบไม่เกินค่าแรง_204", type: "Number" },
    { name: "งบไม่เกินค่าแรง_205", type: "Number" },
    { name: "งบไม่เกินค่าแรง_206", type: "Number" },
    { name: "งบไม่เกินค่าแรง_207", type: "Number" },
    { name: "งบไม่เกินค่าแรง_208", type: "Number" },
    { name: "งบไม่เกินค่าแรง_209", type: "Number" },
    { name: "งบไม่เกินค่าแรง_210", type: "Number" },
    { name: "งบไม่เกินค่าแรง_211", type: "Number" },
    { name: "งบไม่เกินค่าแรง_212", type: "Number" },
    { name: "งบไม่เกินค่าแรง_213", type: "Number" },
    { name: "งบไม่เกินค่าแรง_214", type: "Number" },
    { name: "งบไม่เกินค่าแรง_215", type: "Number" },
    { name: "งบไม่เกินค่าแรง_216", type: "Number" },
    { name: "งบไม่เกินค่าแรง_217", type: "Number" },
    { name: "งบไม่เกินค่าแรง_218", type: "Number" },
    { name: "งบไม่เกินค่าแรง_219", type: "Number" },
    { name: "งบไม่เกินค่าแรง_220", type: "Number" },
    { name: "งบไม่เกินค่าแรง_221", type: "Number" },
    { name: "งบไม่เกินค่าแรง_222", type: "Number" },
    { name: "งบไม่เกินค่าแรง_223", type: "Number" }
  ],
  [TABLES.BANK]: [
    { name: "id_bank", type: "Text", key: true, initialValue: "nextBankId", required: true },
    { name: "ชื่อธนาคาร", type: "Text", required: true },
    { name: "image", type: "Image" }
  ],
  [TABLES.STORE]: [
    { name: "id_store", type: "Text", key: true, initialValue: "nextStoreId", required: true },
    { name: "ชื่อร้านค้า", type: "Text", required: true },
    { name: "ชื่อเต็ม", type: "Text" },
    {
      name: "เครดิตจ่าย",
      type: "Text",
      placeholder: "เช่น วันที่ 16 หรือ 16",
      description: "กำหนดวันตัดรอบจ่ายเงินของร้าน เช่น วันที่ 16 (ซื้อ 1-16 จ่าย 16 เดือนนี้, ซื้อหลัง 16 จ่าย 16 เดือนถัดไป)"
    },
    { name: "เลขบัญชี", type: "Text" },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร" },
    { name: "เบอร์โทร", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่ผู้เสียภาษี", type: "Text" }
  ],
  [TABLES.CONTRACTOR]: [
    { name: "id_Contractor", type: "Text", key: true, initialValue: "nextContractorId", required: true },
    { name: "ชื่อเล่น", type: "Text", required: true },
    { name: "ประเภท", type: "Enum", values: ["บุคคลธรรมดา", "นิติบุคคล"], inputMode: "buttons", initialValue: "บุคคลธรรมดา", required: true },
    { name: "ชื่อ-นามสกุล", type: "Text" },
    { name: "เลขบัญชี", type: "Text" },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร" },
    { name: "บัตรประจำตัวประชาชน", type: "Text" },
    { name: "เบอร์โทรศัพท์", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "จำกัดยอด/ปี", type: "Decimal", initialValue: "1200000" }
  ],
  [TABLES.PEOPLE]: [
    { name: "รหัสพนักงาน", type: "Text", key: true, initialValue: "nextPeopleId", required: true },
    { name: "ชื่อเล่น", type: "Text", required: true },
    { name: "ชื่อ-นามสกุล", type: "Text" },
    { name: "เลขบัญชี", type: "Text" },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร" },
    { name: "เบอร์โทร", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่บัตรประชาชน", type: "Text" },
    { name: "LINE User ID", type: "Text" },
    { name: "สถานะ", type: "Enum", values: ["Active", "Inactive"], inputMode: "buttons", initialValue: "Active" },
    {
      name: "สิทธิ์การใช้งาน",
      type: "EnumList",
      values: [
        "เจ้าของระบบ (Owner)",
        "อนุมัติบิล (Approver)",
        "ฝ่ายการเงิน (Finance)",
        "ลบข้อมูล (Delete)"
      ],
      inputMode: "buttons",
      initialValue: ""
    }
  ],
  [TABLES.CAR]: [
    { name: "id_car", type: "Text", key: true, initialValue: "nextCarId", required: true },
    { name: "หมายเลขทะเบียน", type: "Text", required: true },
    { name: "ยี่ห้อรถ", type: "Enum", values: ["Toyota", "Isuzu", "Ford", "Mitsubishi", "Nissan", "Honda", "MG", "Mazda"], inputMode: "dropdown" },
    { name: "สี", type: "Text" },
    { name: "รับผิดชอบ", type: "Text" },
    { name: "รถของ", type: "Enum", values: ["รถบริษัท", "รถส่วนตัว", "รถเช่า"], inputMode: "buttons" }
  ],
  [TABLES.CUSTOMER]: [
    { name: "id_cus", type: "Text", key: true, initialValue: "nextCustomerId", required: true },
    { name: "ชื่อลูกค้า", type: "Text", required: true },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่ผู้เสียภาษี", type: "Text" }
  ],
  [TABLES.COMPANY]: [
    { name: "id_Company", type: "Text", key: true, initialValue: "nextCompanyId", required: true },
    { name: "ชื่ออังกฤษ", type: "Text" },
    { name: "ชื่อบริษัท", type: "Text", required: true },
    { name: "สำนักงาน", type: "Text" },
    { name: "ที่อยู่", type: "LongText" },
    { name: "เลขที่สียภาษี ", type: "Text" },
    { name: "เบอร์โทร", type: "Text" }
  ],
  [TABLES.LOAN]: [
    { name: "id", type: "Text", key: true, initialValue: "nextLoanId", required: true },
    { name: "ชื่อ", type: "Text", required: true },
    { name: "type", type: "Enum", values: ["ยืม", "คืน"], inputMode: "buttons" },
    { name: "จำนวนเงิน", type: "Decimal", required: true },
    { name: "วันที่", type: "Date", initialValue: "today" }
  ],
  [TABLES.PETTY_CASH]: [
    { name: "id_petty_cash", type: "Text", key: true, initialValue: "nextPettyCashId", required: true },
    {
      name: "ผู้เบิก",
      label: "ผู้ขอเบิกเงินล่วงหน้า",
      type: "Ref",
      refTable: TABLES.PEOPLE,
      refKey: "รหัสพนักงาน",
      refLabel: "ชื่อเล่น",
      required: true,
      refFill: {
        "เลขบัญชี": "เลขบัญชี",
        "ธนาคาร": "ธนาคาร"
      }
    },
    {
      name: "ID Project",
      label: "โครงการ",
      type: "Ref",
      refTable: TABLES.PROJECT,
      refKey: "ID Project",
      refLabel: "ชื่อ Project",
      validIf: "activeProjects",
      required: true,
      refFill: {
        "ชื่อ Project": "ชื่อ Project"
      }
    },
    { name: "ชื่อ Project", type: "Hidden" },
    { name: "จำนวนเงิน", label: "ยอดเงินเบิกล่วงหน้า (บาท)", type: "Decimal", required: true },
    { name: "วัตถุประสงค์", label: "วัตถุประสงค์ / รายละเอียด", type: "Text", required: true },
    { name: "วันที่", label: "วันที่เบิก", type: "Date", initialValue: "today", required: true },
    { name: "กำหนดเคลียร์", label: "กำหนดเคลียร์บิล", type: "Date" },
    { name: "สถานะ", label: "สถานะ", type: "Enum", values: ["รออนุมัติ", "อนุมัติแล้ว", "จ่ายเงินแล้ว", "เคลียร์บิลแล้ว", "ยกเลิก"], initialValue: "รออนุมัติ", inputMode: "dropdown" },
    { name: "เลขบัญชี", label: "เลขบัญชีรับเงิน", type: "Text" },
    {
      name: "ธนาคาร",
      label: "ธนาคาร",
      type: "Ref",
      refTable: TABLES.BANK,
      refKey: "ชื่อธนาคาร",
      refLabel: "ชื่อธนาคาร"
    },
    { name: "ยอดเคลียร์แล้ว", label: "ยอดเคลียร์แล้ว (บาท)", type: "Decimal" },
    { name: "ยอดคงเหลือ", label: "ยอดคงเหลือ (บาท)", type: "Decimal", readonly: true },
    { name: "สลิป", label: "รูปสลิป / เอกสารแนบ", type: "Image" }
  ],
  [TABLES.CONTRACT_WORK]: [
    { name: "id_Conwork", type: "Text", key: true, initialValue: "nextContractWorkId", required: true },
    {
      name: "ID Project",
      type: "Ref",
      refTable: TABLES.PROJECT,
      refKey: "ID Project",
      refLabel: "ชื่อ Project",
      validIf: "activeProjects",
      required: true,
      refFill: {
        "ชื่อ Project": "ชื่อ Project",
        "สถานที่": "สถานที่"
      }
    },
    { name: "ชื่อ Project", type: "Hidden" },
    {
      name: "id_Contractor",
      type: "Ref",
      refTable: TABLES.CONTRACTOR,
      refKey: "id_Contractor",
      refLabel: "ชื่อเล่น",
      required: true,
      initialValue: "",
      refFill: {
        "ชื่อเล่น": "ชื่อเล่น",
        "ชื่อ-นามสกุล": "ชื่อ-นามสกุล",
        "เลขบัญชี": "เลขบัญชี",
        "ธนาคาร": "ธนาคาร",
        "บัตรประจำตัวประชาชน": "บัตรประจำตัวประชาชน",
        "เบอร์โทรศัพท์": "เบอร์โทรศัพท์",
        "ที่อยู่": "ที่อยู่"
      }
    },
    { name: "ชื่อเล่น", type: "Hidden" },
    { name: "ชื่อ-นามสกุล", type: "Text", readonly: true },
    { name: "เลขบัญชี", type: "Text", readonly: true },
    { name: "ธนาคาร", type: "Ref", refTable: TABLES.BANK, refKey: "id_bank", refLabel: "ชื่อธนาคาร", readonly: true },
    { name: "ยอดเงินจ้าง", type: "Decimal", required: true },
    { name: "รายละเอียดงาน", type: "EnumList", values: ["งานหลังคา", "งานผูกเหล็ก"], description: "เลือกได้หลายรายการ หรือพิมพ์เพิ่มเติมได้ คั่นด้วย comma" },
    { name: "สถานที่", type: "Text", readonly: true },
    { name: "วันที่", type: "Date", initialValue: "today" },
    { name: "บัตรประจำตัวประชาชน", type: "Text", readonly: true },
    { name: "เบอร์โทรศัพท์", type: "Text", readonly: true },
    { name: "ที่อยู่", type: "LongText", readonly: true },
    { name: "ยอดเงินจ่าย", type: "Decimal", readonly: true },
    { name: "ค่าแรงคงเหลือ", type: "Decimal", readonly: true }
  ],
  [TABLES.TASKS]: [
    { name: "ลำดับ", type: "Number", key: true, initialValue: "nextTaskId", readonlyOnEdit: true },
    { name: "รายการ", type: "Text", required: true, description: "ชื่องาน หรือ รายละเอียดงาน" },
    { name: "ผู้รับมอบหมาย", type: "Ref", refTable: TABLES.PEOPLE, refKey: "ชื่อเล่น", refLabel: "ชื่อเล่น", required: true },
    { name: "ดู/ทำ", type: "Date", initialValue: "today" },
    { name: "ส่งงาน", type: "Date" },
    { name: "ประเภท", type: "Enum", values: ["1 (เอกสาร)", "2 (แผนงาน)", "3 (PJSA)"], initialValue: "1 (เอกสาร)", inputMode: "buttons" },
    { name: "สถานะ", type: "Enum", values: ["ดำเนินการ", "สำเร็จ"], initialValue: "ดำเนินการ", inputMode: "buttons" }
  ],
  [TABLES.WORKS]: [
    { name: "ลำดับ", type: "Number", key: true, initialValue: "nextWorkId", readonlyOnEdit: true },
    { name: "ทีม", type: "Enum", values: ["PW", "PW1", "PW2", "PW3", "PW4"], initialValue: "PW", inputMode: "buttons" },
    { name: "กิจกรรม", type: "Enum", values: ["เสนอราคา", "ประชุมงาน", "ประมูล"], initialValue: "เสนอราคา", inputMode: "buttons" },
    { name: "เรื่อง", type: "Text", required: true, description: "ชื่องานรับเหมา หรือ หัวข้อกิจกรรม" },
    { name: "PR", type: "Text" },
    { name: "สถานที่", type: "Text" },
    { name: "นัดดู", type: "Text", description: "วันเวลาที่นัดดูหน้างาน เช่น 28/08/26 เวลา 14:00" },
    { name: "นัดเสนอ", type: "Text", description: "วันเวลาที่นัดส่งใบเสนอราคา" },
    { name: "ติดต่อ1", type: "Text" },
    { name: "เบอร์1", type: "Text" },
    { name: "ติดต่อ2", type: "Text" },
    { name: "เบอร์2", type: "Text" },
    { name: "บริษัท", type: "Text" },
    { name: "สถานะ", type: "Enum", values: ["รอดูงาน", "รอเสนอ", "ส่งแล้ว", "ประชุม", "ปิดประชุม", "ประมูล", "ปิดประมูล"], initialValue: "รอดูงาน", inputMode: "dropdown" },
    { name: "หมายเหตุ", type: "LongText" }
  ]
};

export function getFormSchema(tableName: string) {
  if (FORM_SCHEMAS[tableName]) return FORM_SCHEMAS[tableName];
  const normalized = String(tableName || "").trim().toLowerCase().replace(/[-_]/g, "");
  if (normalized === "contractwork" || normalized === "contractworks" || tableName === TABLES.CONTRACT_WORK || tableName === "งานรับเหมา") {
    return FORM_SCHEMAS[TABLES.CONTRACT_WORK] || [];
  }
  if (normalized === "data" || normalized === "bills" || tableName === TABLES.DATA) {
    return FORM_SCHEMAS[TABLES.DATA] || [];
  }
  if (normalized === "project" || normalized === "projects" || tableName === TABLES.PROJECT) {
    return FORM_SCHEMAS[TABLES.PROJECT] || [];
  }
  if (normalized === "pettycash" || normalized === "petty_cash" || tableName === TABLES.PETTY_CASH || tableName === "เปิดเงินสดย่อย") {
    return FORM_SCHEMAS[TABLES.PETTY_CASH] || [];
  }
  return FORM_SCHEMAS[tableName] || [];
}

export function getRefRowColumns(column: FieldSchema) {
  if (column.type !== "Ref" || !column.refFill) return [];
  const columns: string[] = [];
  for (const value of Object.values(column.refFill)) {
    if (value.includes("{")) {
      const matches = value.match(/\{([^}]+)\}/g);
      if (matches) {
        columns.push(...matches.map(m => m.slice(1, -1)));
      }
    } else {
      columns.push(value);
    }
  }
  if (column.filterBy) {
    columns.push(column.filterBy.column);
    if (column.filterBy.openContract) columns.push("ยอดเงินจ้าง", "ยอดเงินจ่าย");
  }
  return Array.from(new Set(columns));
}
