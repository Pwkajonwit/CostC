import { TABLE_KEYS, TABLES } from "@/lib/config";
import { hydrateContractRows } from "@/lib/formulas";
import { getRows, getSystemOptions, listRefOptions } from "@/lib/db";
import { getFormSchema, getRefRowColumns } from "@/lib/schemas";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getNextBillSequence } from "@/lib/supabase/supabase-db";
import type { FieldSchema, RefOption, SheetRow } from "@/lib/types";
import { getTodayDateIso } from "@/lib/utils/dates";

export async function getFormPayload(tableName: string, preloadedRows?: Record<string, SheetRow[]>) {
  const schema = await getFormSchemaWithSheetOptions(tableName);
  const refEntries = await Promise.all(
    schema
      .filter(column => column.type === "Ref" && column.refTable)
      .map(async column => [
        column.name,
        await getRefOptions(column, preloadedRows)
      ] as const)
  );

  return {
    tableName,
    schema,
    initialValues: await getInitialValues(tableName),
    refOptions: Object.fromEntries(refEntries)
  };
}

async function getRefOptions(column: FieldSchema, preloadedRows?: Record<string, SheetRow[]>) {
  const tableRows = preloadedRows?.[column.refTable!];
  if (column.refTable === TABLES.CONTRACT_WORK && column.filterBy?.openContract) {
    return listHydratedContractOptions(column, preloadedRows);
  }

  return listRefOptions(column.refTable!, {
    keyColumn: column.refKey,
    labelColumn: column.refLabel,
    validIf: column.validIf,
    rowColumns: getRefRowColumns(column),
    rows: tableRows
  });
}

async function listHydratedContractOptions(column: FieldSchema, preloadedRows?: Record<string, SheetRow[]>): Promise<RefOption[]> {
  const [contractRows, contractorRows] = await Promise.all([
    preloadedRows?.[TABLES.CONTRACT_WORK]
      ? hydrateContractRows(preloadedRows[TABLES.CONTRACT_WORK], {
          projects: preloadedRows[TABLES.PROJECT],
          contractors: preloadedRows[TABLES.CONTRACTOR],
          dataRows: preloadedRows[TABLES.DATA],
        })
      : hydrateContractRows(await getRows(TABLES.CONTRACT_WORK, 30_000)),
    preloadedRows?.[TABLES.CONTRACTOR]
      ? Promise.resolve(preloadedRows[TABLES.CONTRACTOR])
      : getRows(TABLES.CONTRACTOR, 180_000).catch(() => [])
  ]);

  const contractorMap = new Map<string, string>();
  for (const c of contractorRows) {
    const id = String(c["id_Contractor"] || c.id || "").trim();
    const name = String(c["ชื่อเล่น"] || c["ชื่อ-นามสกุล"] || c["ชื่อผู้รับเหมา"] || c.name || "").trim();
    if (id && name) contractorMap.set(id, name);
  }

  const keyColumn = column.refKey || TABLE_KEYS[TABLES.CONTRACT_WORK] || "_RowNumber";
  const rowColumns = unique([keyColumn, "id_Contractor", "ชื่อเล่น", "ผู้รับเหมา", "รายละเอียดงาน", ...getRefRowColumns(column)]);

  return contractRows
    .filter(row => row[keyColumn] !== "" && row[keyColumn] !== undefined && row[keyColumn] !== null)
    .slice(0, 1000)
    .map(row => {
      const idVal = String(row[keyColumn]);
      const contractorId = String(row["id_Contractor"] || "").trim();
      const contractorName = contractorMap.get(contractorId) ||
                             String(row["ชื่อเล่น"] || row["ผู้รับเหมา"] || row["ชื่อ-นามสกุล"] || "").trim();
      const details = String(row["รายละเอียดงาน"] || "").trim();

      let displayLabel = idVal;
      if (contractorName && details) {
        displayLabel = `${contractorName} (${details})`;
      } else if (contractorName) {
        displayLabel = contractorName;
      } else if (details) {
        displayLabel = details;
      }

      const rowData = pick(row, rowColumns);
      if (contractorName) {
        rowData["ชื่อเล่น"] = contractorName;
        rowData["ผู้รับเหมา"] = contractorName;
      }

      return {
        value: idVal,
        label: displayLabel,
        row: rowData
      };
    });
}

async function getFormSchemaWithSheetOptions(tableName: string): Promise<FieldSchema[]> {
  const schema = getFormSchema(tableName);
  const enumListFields = schema.filter(field => field.type === "EnumList");
  const hasBillTypeOptions = schema.some(field => field.dynamicValues === "billTypeOptions");

  const [rows, categoryRows, systemOptions] = await Promise.all([
    enumListFields.length ? getRows(tableName, 120_000).catch(() => []) : Promise.resolve([]),
    hasBillTypeOptions ? getRows(TABLES.CATEGORY, 120_000).catch(() => []) : Promise.resolve([]),
    getSystemOptions().catch(() => ({} as Record<string, string[]>))
  ]);

  const billTypeOptionSets = hasBillTypeOptions ? getBillTypeOptionSets(categoryRows, systemOptions) : undefined;

  const DEFAULT_SYSTEM_OPTIONS: Record<string, string[]> = {
    "ชื่อเครื่องมือ": ["สว่านเจาะเหล็กไฟฟ้า", "สว่านเจาะปูน Rotary", "ลูกหมูขนาด 4\"", "ลูกหมูขนาด 7\"", "ไฟเบอร์ตัดเหล็ก"],
    "สินค้า": [
      "1 เหล็กเส้น", "2 เหล็กรูปพรรณ", "3 คอนกรีต", "4 ไม้แบบ", "5 วัสดุมุง", "6 ฝ้าผนัง",
      "7 ปูพื้น", "8 กระจก", "9 ไฟฟ้า", "10 ประปา", "11 อื่นๆ(วัสดุ)", "12 สีเคมี",
      "13 สุขภัณฑ์", "14 บิวอิน", "15 แอร์", "16 ดิน", "17 หินทราย", "18 เตรียมงาน",
      "101 น้ำมัน", "102 ค่าขนส่ง", "103 เครื่องจักร", "200 ดำเนินการ(อื่นๆ)", "non"
    ],
    "vat": ["1", "3", "5", "7", "ระบุเอง"],
    "หัก": ["1", "3", "5", "ระบุเอง"],
    "เครดิต": ["30", "45", "60", "ระบุเอง"],
    "ประเภทบิล": ["หลัก", "ย่อย"],
    "statusค่าแรง": ["บุคคลธรรมดา", "บริษัท"],
    "รายการ": ["ค่าที่พัก", "ห้องรายเดือน", "เงินพิเศษ", "ค่าน้ำ/ค่าไฟ", "ค่าส่งเอกสาร", "ค่าธรรมเนียม", "ค่าประกันภัย"],
    "รับผิดชอบ": ["PW1", "PW2", "PW3", "PW4", "PW"],
    "รถของ": ["รถบริษัท", "รถส่วนตัว", "รถเช่า"],
    "ยี่ห้อรถ": ["Toyota", "Isuzu", "Ford", "Mitsubishi", "Nissan", "Honda", "MG", "Mazda"]
  };

  const fieldKeyAliases: Record<string, string[]> = {
    "บิล": ["บิล", "ประเภทบิล"],
    "ยี่ห้อ": ["ยี่ห้อ", "ยี่ห้อรถ"],
    "ยี่ห้อรถ": ["ยี่ห้อรถ", "ยี่ห้อ"],
    "รถของ": ["รถของ", "ความเป็นเจ้าของรถ"],
    "รับผิดชอบ": ["รับผิดชอบ", "ผู้รับผิดชอบ"],
    "รายการ": ["รายการ", "รายการค่าใช้จ่าย"],
    "ชื่อเครื่องมือ": ["ชื่อเครื่องมือ", "เครื่องมือ"],
    "สินค้า": ["สินค้า", "ประเภทสินค้า"],
    "รายละเอียดงาน": ["รายละเอียดงาน", "งาน"],
  };

  return schema.map(field => {
    let fieldValues = field.values ? [...field.values] : [];

    // Inject dynamic options from system_options database first, fallback to default
    const keysToTry = fieldKeyAliases[field.name] || [field.name];
    let customFromSystem: string[] | undefined;
    for (const k of keysToTry) {
      if (systemOptions[k] && Array.isArray(systemOptions[k]) && systemOptions[k].length > 0) {
        customFromSystem = systemOptions[k];
        break;
      }
    }

    if (customFromSystem && customFromSystem.length > 0) {
      fieldValues = customFromSystem;
    } else if (fieldValues.length === 0) {
      for (const k of keysToTry) {
        if (DEFAULT_SYSTEM_OPTIONS[k]) {
          fieldValues = DEFAULT_SYSTEM_OPTIONS[k];
          break;
        }
      }
    }

    if (field.dynamicValues === "billTypeOptions") {
      const customOptions = systemOptions[field.name] || systemOptions["ประเภท"] || systemOptions["ประเภทค่าใช้จ่าย"];
      const baseValues = customOptions && customOptions.length > 0 ? customOptions : fieldValues;
      const combinedValues = unique([
        ...baseValues,
        ...(billTypeOptionSets?.contractor || []),
        ...(billTypeOptionSets?.storeDefault || []),
        ...(billTypeOptionSets?.storeWithItem || [])
      ]);

      return {
        ...field,
        values: combinedValues.length > 0 ? combinedValues : baseValues,
        dynamicOptionSets: billTypeOptionSets
      };
    }

    if (field.dynamicValues === "productCategoryOptions") {
      let masterProducts: string[] = [];
      const masterData = (systemOptions as any)["PRODUCT_MASTER_DATA"];
      if (Array.isArray(masterData) && masterData.length > 0) {
        masterProducts = masterData
          .filter((item: any) => item && item.active !== false)
          .map((item: any) => {
            const code = String(item.code || item.id || "").trim();
            const name = String(item.name || "").trim();
            return code ? `${code} ${name}` : name;
          })
          .filter(Boolean);
      }

      const productOptions = (Array.isArray(systemOptions["สินค้า"]) && systemOptions["สินค้า"].length > 1) 
        ? systemOptions["สินค้า"] 
        : undefined;

      const defaultProducts = DEFAULT_SYSTEM_OPTIONS["สินค้า"] || [];
      const finalProducts = masterProducts.length > 0
        ? masterProducts
        : (productOptions && productOptions.length > 0 ? productOptions : defaultProducts);

      return {
        ...field,
        values: unique(finalProducts)
      };
    }

    if (field.name === "รายละเอียดงาน") {
      const customOptions = systemOptions["รายละเอียดงาน"];
      const defaultWorkDetails = [
        "งานฐานราก/เสาเข็ม",
        "งานโครงสร้าง/ผูกเหล็ก/เข้าแบบ",
        "งานเทคอนกรีต",
        "งานมุงหลังคา/กันสาด",
        "งานก่ออิฐ/ฉาบปูน",
        "งานปูกระเบื้อง/พื้น",
        "งานระบบไฟฟ้า",
        "งานระบบประปา/สุขาภิบาล",
        "งานสีและเคมี",
        "งานประตู/หน้าต่าง/กระจก",
        "งานบิวท์อิน/ตกแต่ง"
      ];
      const baseValues = customOptions && customOptions.length > 0 ? customOptions : defaultWorkDetails;
      return {
        ...field,
        values: unique([...baseValues, ...extractEnumListValues(rows, field.name)])
      };
    }

    if (field.type === "EnumList") {
      return {
        ...field,
        values: unique([...fieldValues, ...extractEnumListValues(rows, field.name)])
      };
    }

    return {
      ...field,
      values: fieldValues
    };
  });
}

function extractEnumListValues(rows: SheetRow[], columnName: string) {
  return rows.flatMap(row => splitEnumListValue(String(row[columnName] || "")));
}

function splitEnumListValue(value: string) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function getBillTypeOptionSets(rows: SheetRow[], systemOptions?: Record<string, string[]>) {
  const sysContractor = systemOptions?.["ประเภท (ผู้รับเหมา)"] || systemOptions?.["ประเภท_ผู้รับเหมา"];
  const sysStoreDefault = systemOptions?.["ประเภท (ร้านค้า)"] || systemOptions?.["ประเภท_ร้านค้า"];
  const sysStoreWithItem = systemOptions?.["ประเภท (ร้านค้า+เลือกสินค้า)"] || systemOptions?.["ประเภท_ร้านค้า_สินค้า"];

  const contractor = sysContractor && sysContractor.length > 0
    ? sysContractor
    : unique(rows.map(row => String(row["ประเภท Name1"] || "")));

  const storeDefault = sysStoreDefault && sysStoreDefault.length > 0
    ? sysStoreDefault
    : unique(rows.map(row => String(row["ประเภท Name2"] || "")));

  const storeWithItem = sysStoreWithItem && sysStoreWithItem.length > 0
    ? sysStoreWithItem
    : unique(rows.map(row => String(row["ประเภท Name3"] || "")));

  return {
    contractor: contractor.length > 0 ? contractor : ["2.ค่าแรง", "3.พนักงาน", "8.อื่นๆ"],
    storeDefault: storeDefault.length > 0 ? storeDefault : ["4.น้ำมัน", "5.ซ่อมรถ", "6.เครื่องจักร"],
    storeWithItem: storeWithItem.length > 0 ? storeWithItem : ["1.ค่าของ", "7.เครื่องมือ", "8.อื่นๆ"]
  };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function pick(row: SheetRow, columns: string[]) {
  return Object.fromEntries(columns.map(column => [column, row[column] ?? ""]));
}

export async function getInitialValues(tableName: string): Promise<SheetRow> {
  const values: SheetRow = {};
  for (const column of getFormSchema(tableName)) {
    if (!column.initialValue) continue;
    if (column.initialValue === "today") values[column.name] = getTodayDateIso();
    if (column.initialValue === "nextDataSequence") values[column.name] = String(await nextDataSequence());
    if (column.initialValue === "nextProjectId") values[column.name] = String(await nextProjectId());
    if (column.initialValue === "nextContractWorkId") values[column.name] = await nextContractWorkId();
    if (column.initialValue === "nextBankId") values[column.name] = await nextBankId();
    if (column.initialValue === "nextStoreId") values[column.name] = await nextPrefixedId(TABLES.STORE, "id_store", "ST", 100);
    if (column.initialValue === "nextContractorId") values[column.name] = await nextPrefixedId(TABLES.CONTRACTOR, "id_Contractor", "CT", 100);
    if (column.initialValue === "nextPeopleId") values[column.name] = await nextPeopleId();
    if (column.initialValue === "nextCarId") values[column.name] = await nextPrefixedId(TABLES.CAR, "id_car", "CAR", 100);
    if (column.initialValue === "nextCustomerId") values[column.name] = await nextPrefixedId(TABLES.CUSTOMER, "id_cus", "C", 100);
    if (column.initialValue === "nextCompanyId") values[column.name] = await nextPrefixedId(TABLES.COMPANY, "id_Company", "CO", 100);
    if (column.initialValue === "nextLoanId") values[column.name] = await nextPrefixedId(TABLES.LOAN, "id", "L", 100);
    if (column.initialValue === "nextTaskId") values[column.name] = String(await nextTaskId());
    if (column.initialValue === "nextWorkId") values[column.name] = String(await nextWorkId());
    if (!values[column.name]) values[column.name] = column.initialValue;
  }
  return values;
}

async function nextPeopleId() {
  const rows = await getRows(TABLES.PEOPLE, 15_000).catch(() => []);
  const maxNum = rows.reduce((max, row) => {
    const idStr = String(row["รหัสพนักงาน"] || row["id"] || "");
    const match = idStr.match(/^P(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      return Number.isFinite(num) ? Math.max(max, num) : max;
    }
    return max;
  }, 0);

  const nextNum = maxNum + 1;
  return `P${String(nextNum).padStart(3, "0")}`;
}

async function nextDataSequence() {
  return await getNextBillSequence();
}

async function nextTaskId() {
  const rows = await getRows(TABLES.TASKS, 15_000).catch(() => []);
  return rows.reduce((max, row) => {
    const value = Number(row["ลำดับ"] || row["id"] || 0);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

async function nextWorkId() {
  const rows = await getRows(TABLES.WORKS, 15_000).catch(() => []);
  return rows.reduce((max, row) => {
    const value = Number(row["ลำดับ"] || row["id"] || 0);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

async function nextContractWorkId() {
  const rows = await getRows(TABLES.CONTRACT_WORK, 15_000);
  const next = rows.reduce((max, row) => {
    const value = String(row.id_Conwork || "");
    const match = value.match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0) + 1;
  return `CW${next}`;
}

async function nextProjectId() {
  const rows = await getRows(TABLES.PROJECT, 15_000);
  return rows.reduce((max, row) => {
    const value = Number(row["ID Project"] || 0);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

async function nextBankId() {
  return nextPrefixedId(TABLES.BANK, "id_bank", "Ba", 100);
}

async function nextPrefixedId(tableName: string, columnName: string, prefix: string, minimum = 0) {
  const rows = await getRows(tableName, 15_000);
  const next = rows.reduce((max, row) => {
    const value = String(row[columnName] || "");
    const match = value.match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, minimum) + 1;
  return `${prefix}${next}`;
}

async function legacyNextBankId() {
  const rows = await getRows(TABLES.BANK, 15_000);
  const next = rows.reduce((max, row) => {
    const value = String(row.id_bank || "");
    const match = value.match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 100) + 1;
  return `Ba${next}`;
}

function formatSheetDate(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}
