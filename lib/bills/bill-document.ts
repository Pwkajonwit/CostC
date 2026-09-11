import { hydrateBillRows } from "@/lib/formulas";
import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { toNumber } from "@/lib/utils/numbers";
import { parseDeductPercent, isVatActive } from "@/lib/project-summary";
import { formatDateDisplay, getTodayDateIso } from "@/lib/utils/dates";
import type { SheetRow } from "@/lib/types";
import { getSampleDocumentsAsSheetRows } from "@/lib/documents/sample-documents-data";

export interface BillDocumentModel {
  // Metadata & Sequence
  billSequence: string;
  billDate: string;
  status: string;

  // Company Info (ผู้ว่าจ้าง / ผู้มีหน้าที่หักภาษี)
  company: {
    nameThai: string;
    nameEng: string;
    branch: string;
    address: string;
    phone: string;
    fax: string;
    taxId: string;
  };

  // Contractor Info (ผู้รับเหมา / ผู้ถูกหักภาษี)
  contractor: {
    fullName: string;
    nickname: string;
    idCard: string;
    taxId: string;
    address: string;
    phone: string;
    isCorporate: boolean;
  };

  // Project & Job Details
  project: {
    id: string;
    name: string;
    location: string;
  };
  jobDescription: string;
  itemDescription: string;

  // Financial & Tax Calculations
  amounts: {
    laborAndStaff: number;       // ค่าแรง+พนักงาน+อื่นๆ (ก่อนหัก)
    taxPercent: number;          // % หักภาษี ณ ที่จ่าย (เช่น 3)
    withholdingTax: number;      // ยอดเงินภาษีหัก ณ ที่จ่าย
    netPayable: number;          // ยอดคงเหลือสุทธิ (รวมยอดเงิน)
    thaiBahtTextTotal: string;   // ตัวหนังสือยอดเงินสุทธิ
    thaiBahtTextTax: string;     // ตัวหนังสือยอดภาษีหักนำส่ง
  };

  issuer?: string;               // ผู้จ่าย / ผู้จัดทำบิล

  // Original row reference
  rawBill: SheetRow;
}

export function thaiNumberText(value: number): string {
  if (!value || isNaN(value)) return "ศูนย์";
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const million = 1_000_000;

  if (value >= million) {
    const millions = Math.floor(value / million);
    const remainder = value % million;
    return `${thaiNumberText(millions)}ล้าน${remainder ? thaiNumberText(remainder) : ""}`;
  }

  const s = String(Math.floor(value));
  let result = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const pos = s.length - i - 1;
    if (d !== 0) {
      if (pos === 1 && d === 1) {
        result += "สิบ";
      } else if (pos === 1 && d === 2) {
        result += "ยี่สิบ";
      } else if (pos === 0 && d === 1 && s.length > 1) {
        result += "เอ็ด";
      } else {
        result += digits[d] + positions[pos];
      }
    }
  }
  return result || "ศูนย์";
}

export function thaiBahtText(amount: number): string {
  const rounded = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);
  const bahtText = `${thaiNumberText(baht)}บาท`;
  return satang ? `${bahtText}${thaiNumberText(satang)}สตางค์` : `${bahtText}ถ้วน`;
}

export async function getBillDocumentData(
  billOrId: string | SheetRow,
  preloaded?: {
    bills?: SheetRow[];
    projects?: SheetRow[];
    companies?: SheetRow[];
    contractors?: SheetRow[];
    people?: SheetRow[];
  }
): Promise<BillDocumentModel | null> {
  let billRow: SheetRow | undefined;

  if (typeof billOrId === "object" && billOrId !== null) {
    billRow = billOrId;
  } else {
    const rawBills = preloaded?.bills || (await getRows(TABLES.DATA).catch(() => []));
    const bills = preloaded?.bills ? rawBills : await hydrateBillRows(rawBills);
    const targetId = String(billOrId).trim().toLowerCase();
    billRow = bills.find(
      (r) =>
        String(r["ลำดับ"] || "").trim().toLowerCase() === targetId ||
        String(r["ลำดับtest"] || "").trim().toLowerCase() === targetId ||
        String(r._sheetRow || "").trim() === targetId ||
        String(r._RowNumber || "").trim() === targetId ||
        String(r.id || "").trim().toLowerCase() === targetId
    );

    if (!billRow) {
      const sampleRows = getSampleDocumentsAsSheetRows();
      billRow = sampleRows.find(
        (r) =>
          String(r["ลำดับ"] || "").trim().toLowerCase() === targetId ||
          String(r.id || "").trim().toLowerCase() === targetId ||
          String(r._sheetRow || "").trim().toLowerCase() === targetId
      );
    }
  }

  if (!billRow) return null;

  const [projectRows, companyRows, contractorRows, peopleRows] = await Promise.all([
    preloaded?.projects || getRows(TABLES.PROJECT).catch(() => []),
    preloaded?.companies || getRows(TABLES.COMPANY).catch(() => []),
    preloaded?.contractors || getRows(TABLES.CONTRACTOR).catch(() => []),
    preloaded?.people || getRows(TABLES.PEOPLE).catch(() => []),
  ]);

  const peopleMap = new Map<string, string>();
  for (const p of peopleRows) {
    const code = String(p["รหัสพนักงาน"] || p.id || "").trim();
    const nick = String(p["ชื่อเล่น"] || p["ชื่อ-นามสกุล"] || "").trim();
    if (code && nick) peopleMap.set(code, nick);
  }

  const projectId = String(billRow["ID Project"] || billRow.project_id || "").trim();
  const project = projectRows.find((r) => String(r["ID Project"] || r.id || "").trim() === projectId) || {};

  const companyRef = String(project["บริษัท"] || project.company_id || "").trim();
  const company = companyRows.find(
    (r) =>
      String(r["ชื่อบริษัท"] || "").trim() === companyRef ||
      String(r["id_Company"] || "").trim() === companyRef ||
      String(r.id || "").trim() === companyRef
  ) || companyRows[0] || {};

  const contractorRef = String(
    billRow["ชื่อ-นามสกุล"] || billRow["ร้าน/บุคคล"] || billRow["ผู้รับเหมา"] || billRow["ร้านค้า"] || billRow.contractor_id || ""
  ).trim();

  const contractor = contractorRows.find(
    (r) =>
      String(r["ชื่อเล่น"] || "").trim() === contractorRef ||
      String(r["ชื่อ-นามสกุล"] || "").trim() === contractorRef ||
      String(r["id_Contractor"] || "").trim() === contractorRef
  ) || {};

  // Financial calculations
  let laborAndStaff = toNumber(billRow["ค่าแรง+พนักงาน+อื่นๆ"]);
  if (!laborAndStaff) {
    laborAndStaff = toNumber(billRow["ค่าแรง"]) + toNumber(billRow["พนักงาน"]) + toNumber(billRow["อื่นๆ"]);
  }
  if (!laborAndStaff) {
    laborAndStaff = toNumber(billRow["ค่าจ้าง"]) || toNumber(billRow["ยอดเงิน"]);
  }

  // Tax calculation: parse % correctly even if string is "3%", "หัก 3%", etc.
  const rawDeduct = billRow["หัก"] ?? billRow.deduct ?? billRow.withholding_tax;
  let taxPercent = parseDeductPercent(rawDeduct);
  let customWht = toNumber(billRow["3เปอร์เซ็น"] || billRow["3เปอร์"] || billRow["หัก 3%"] || billRow["จำนวนหัก"] || billRow.deduct_amount);

  if (!taxPercent && customWht > 0) {
    taxPercent = laborAndStaff > 0 ? Math.round((customWht / laborAndStaff) * 100) : 3;
  }

  let withholdingTax = customWht;
  if (!withholdingTax && taxPercent > 0) {
    const hasVat = isVatActive(billRow.vat ?? billRow["vat"] ?? billRow.VAT);
    if (hasVat) {
      withholdingTax = Math.round(((laborAndStaff / 1.07) * (taxPercent / 100)) * 100) / 100;
    } else {
      withholdingTax = Math.round((laborAndStaff * (taxPercent / 100)) * 100) / 100;
    }
  } else if (taxPercent === 0) {
    withholdingTax = 0;
  }

  const rawNet = toNumber(billRow["ยอดโอน"] || billRow["คงเหลือ"] || billRow["ยอดเงิน"]);
  const netPayable = rawNet || (laborAndStaff - withholdingTax);

  const isCorporate =
    String(billRow["statusค่าแรง"] || "").includes("บริษัท") ||
    String(billRow["ร้านค้า/ผู้รับเหมา"] || "") === "ร้านค้า" ||
    Boolean(contractor["เลขประจำตัวผู้เสียภาษี"]);

  const contractorFullName =
    String(contractor["ชื่อ-นามสกุล"] || "").trim() ||
    String(billRow["ชื่อ-นามสกุล"] || "").trim() ||
    String(contractor["ชื่อเล่น"] || "").trim() ||
    contractorRef ||
    "ไม่ระบุผู้รับเหมา";

  const contractorIdCard =
    String(contractor["บัตรประจำตัวประชาชน"] || contractor["เลขบัตรประชาชน"] || billRow["บัตรประจำตัวประชาชน"] || "").trim();

  const contractorAddress =
    String(contractor["ที่อยู่"] || billRow["ที่อยู่"] || "-").trim();

  // ผู้ออก คือ ผู้สร้างบิลตั้งเบิก
  const rawIssuer = String(
    billRow["ผู้สร้างบิล"] ||
      billRow["ผู้สร้างบิลตั้งเบิก"] ||
      billRow["ผู้เบิก"] ||
      billRow["ชื่อผู้เบิก"] ||
      billRow.requester ||
      billRow.requester_name ||
      billRow["ผู้ออก"] ||
      billRow["คนทำเอกสาร"] ||
      billRow["ผู้จ่าย"] ||
      billRow["ผู้ดูแล"] ||
      ""
  ).trim();
  const issuer = peopleMap.get(rawIssuer) || rawIssuer || "-";

  return {
    billSequence: String(billRow["ลำดับ"] || billRow["ลำดับtest"] || billRow._sheetRow || "-"),
    billDate: formatDateDisplay(billRow["ว/ด/ป"] || billRow["วันได้บิล"] || getTodayDateIso()),
    status: String(billRow["สถานะ"] || "รออนุมัติ"),

    company: {
      nameThai: String(company["ชื่อบริษัท"] || "บริษัท ไม่ระบุ จำกัด").trim(),
      nameEng: String(company["ชื่ออังกฤษ"] || "").trim(),
      branch: String(company["สำนักงาน"] || "สำนักงานใหญ่").trim(),
      address: String(company["ที่อยู่"] || "-").trim(),
      phone: String(company["เบอร์โทร"] || "-").trim(),
      fax: String(company["แฟกซ์"] || "02-2773023").trim(),
      taxId: String(company["เลขที่สียภาษี "] || company["เลขที่เสียภาษี"] || company["เลขประจำตัวผู้เสียภาษี"] || "").trim(),
    },

    contractor: {
      fullName: contractorFullName,
      nickname: String(contractor["ชื่อเล่น"] || "").trim(),
      idCard: contractorIdCard,
      taxId: String(contractor["เลขประจำตัวผู้เสียภาษี"] || contractor["เลขที่เสียภาษี"] || "").trim(),
      address: contractorAddress,
      phone: String(contractor["เบอร์โทรศัพท์"] || contractor["เบอร์โทร"] || "-").trim(),
      isCorporate,
    },

    project: {
      id: projectId,
      name: String(project["ชื่อ Project"] || billRow["ชื่อ Project"] || "-").trim(),
      location: String(project["สถานที่"] || project["ชื่อ Project"] || billRow["ชื่อ Project"] || "-").trim(),
    },

    jobDescription: String(billRow["รายละเอียดงาน"] || billRow["สินค้า/ทำงาน"] || billRow["สินค้า"] || "-").trim(),
    itemDescription: String(billRow["สินค้า/ทำงาน"] || billRow["สินค้า"] || billRow["รายละเอียดงาน"] || "-").trim(),

    amounts: {
      laborAndStaff,
      taxPercent,
      withholdingTax,
      netPayable,
      thaiBahtTextTotal: thaiBahtText(netPayable),
      thaiBahtTextTax: thaiBahtText(withholdingTax),
    },

    issuer,
    rawBill: billRow,
  };
}

export async function getMultipleBillsDocumentData(
  billIdsOrRows: (string | SheetRow)[],
  preloaded?: {
    bills?: SheetRow[];
    projects?: SheetRow[];
    companies?: SheetRow[];
    contractors?: SheetRow[];
    people?: SheetRow[];
  }
): Promise<BillDocumentModel[]> {
  let [rawBills, projectRows, companyRows, contractorRows, peopleRows] = await Promise.all([
    preloaded?.bills || getRows(TABLES.DATA).catch(() => []),
    preloaded?.projects || getRows(TABLES.PROJECT).catch(() => []),
    preloaded?.companies || getRows(TABLES.COMPANY).catch(() => []),
    preloaded?.contractors || getRows(TABLES.CONTRACTOR).catch(() => []),
    preloaded?.people || getRows(TABLES.PEOPLE).catch(() => []),
  ]);

  if (!rawBills || rawBills.length === 0) {
    rawBills = getSampleDocumentsAsSheetRows();
  }

  const bills = preloaded?.bills ? rawBills : await hydrateBillRows(rawBills);

  const sharedContext = {
    bills,
    projects: projectRows,
    companies: companyRows,
    contractors: contractorRows,
    people: peopleRows,
  };

  const results: BillDocumentModel[] = [];

  for (const item of billIdsOrRows) {
    const doc = await getBillDocumentData(item, sharedContext);
    if (doc) {
      results.push(doc);
    }
  }

  return results;
}
