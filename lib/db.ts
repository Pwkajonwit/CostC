import { cached, clearCache } from "@/lib/utils/cache";
import { TABLE_KEYS, TABLES } from "@/lib/config";
import type { RefOption, TableRow, SheetRow } from "@/lib/types";
import {
  bulkInsertRowsToSupabase,
  deleteRowFromSupabase,
  deleteRowsFromSupabase,
  deleteStorageFilesFromSupabase,
  getDbTableName,
  getRowsFromSupabase,
  getWithdrawBillsFromSupabase,
  getBillFollowRowsFromSupabase,
  getDashboardFinancialSummaryFromSupabase,
  getSystemOptionsFromSupabase,
  insertAuditLogToSupabase,
  insertRowToSupabase,
  isSupabaseConfigured,
  updateRowInSupabase,
} from "@/lib/supabase/supabase-db";

export type AuditEntry = {
  action: string;
  tableName: string;
  key?: string;
  sheetRow?: number;
  actor?: string;
  details?: Record<string, unknown>;
};

const MASTER_TABLES = new Set([
  "stores", "ร้านค้า",
  "contractors", "รับเหมา",
  "banks", "ธนาคาร",
  "categories", "ประเภท",
  "companies", "บริษัท",
  "customers", "ลูกค้า",
  "cars", "ทะเบียน",
  "products", "สินค้า",
  "master_members", "รายชื่อ", "PEOPLE", "people",
  "system_options", "ตัวเลือกระบบ"
]);

function getTableDefaultTtl(tableName: string): number {
  if (MASTER_TABLES.has(tableName) || MASTER_TABLES.has(tableName.toLowerCase())) {
    return 2_000; // 2 seconds for master data to guarantee instant freshness across all Vercel lambdas
  }
  if (tableName === "Project" || tableName === "projects" || tableName === "PROJECT") {
    return 2_000; // 2 seconds for projects
  }
  return 1_000; // 1 second for transactions (bills, contracts, tasks)
}

export function invalidateTableCache(tableName: string) {
  if (!tableName) return;
  const normalized = tableName.trim();
  const canonical = getDbTableName(normalized) || normalized.toLowerCase();

  clearCache(`rows:${normalized}`);
  clearCache(`headers:${normalized}`);
  if (canonical && canonical !== normalized) {
    clearCache(`rows:${canonical}`);
    clearCache(`headers:${canonical}`);
  }

  // Clear global aliases and derivative view caches
  if (canonical === "bills" || normalized === "Data" || normalized === "DATA" || normalized === "bills" || normalized === "data") {
    clearCache("rows:bills");
    clearCache("rows:Data");
    clearCache("rows:DATA");
    clearCache("rows:data");
    clearCache("bills:withdraw");
    clearCache("bills:bill_follow");
    clearCache("headers:bills");
    clearCache("headers:Data");
    clearCache("dashboard");
    clearCache("summary");
    clearCache("sys_opt:bill_follow_dates");
  } else if (canonical === "projects" || normalized === "Project" || normalized === "PROJECT" || normalized === "projects") {
    clearCache("rows:projects");
    clearCache("rows:Project");
    clearCache("rows:PROJECT");
    clearCache("headers:projects");
    clearCache("headers:Project");
    clearCache("dashboard");
    clearCache("summary");
    clearCache("sys_opt:project_budget_allocations");
  } else if (canonical === "contract_works" || normalized === "งานรับเหมา" || normalized === "Contract_work" || normalized === "contract_works") {
    clearCache("rows:contract_works");
    clearCache("rows:งานรับเหมา");
    clearCache("rows:Contract_work");
    clearCache("headers:contract_works");
  } else if (canonical === "stores" || normalized === "ร้านค้า" || normalized === "stores") {
    clearCache("rows:stores");
    clearCache("rows:ร้านค้า");
    clearCache("headers:stores");
    clearCache("sys_opt:entity_banks");
  } else if (canonical === "contractors" || normalized === "รับเหมา" || normalized === "contractors") {
    clearCache("rows:contractors");
    clearCache("rows:รับเหมา");
    clearCache("headers:contractors");
    clearCache("sys_opt:entity_banks");
  } else if (canonical === "master_members" || normalized === "รายชื่อ" || normalized === "PEOPLE" || normalized === "people") {
    clearCache("rows:master_members");
    clearCache("rows:รายชื่อ");
    clearCache("rows:PEOPLE");
    clearCache("rows:people");
    clearCache("headers:master_members");
    clearCache("sys_opt:entity_banks");
    clearCache("sys_opt:users_list");
    clearCache("line:");
    clearCache("line:target_ids");
  } else if (canonical === "banks" || normalized === "ธนาคาร" || normalized === "banks" || normalized === "BANK") {
    clearCache("rows:banks");
    clearCache("rows:ธนาคาร");
    clearCache("rows:BANK");
    clearCache("headers:banks");
  } else if (canonical === "cars" || normalized === "ทะเบียน" || normalized === "cars" || normalized === "CAR") {
    clearCache("rows:cars");
    clearCache("rows:ทะเบียน");
    clearCache("rows:CAR");
    clearCache("headers:cars");
  } else if (canonical === "categories" || normalized === "ประเภท" || normalized === "categories") {
    clearCache("rows:categories");
    clearCache("rows:ประเภท");
    clearCache("headers:categories");
    clearCache("sys_opt:all");
  } else if (canonical === "customers" || normalized === "ลูกค้า" || normalized === "customers") {
    clearCache("rows:customers");
    clearCache("rows:ลูกค้า");
    clearCache("headers:customers");
  } else if (canonical === "companies" || normalized === "บริษัท" || normalized === "companies") {
    clearCache("rows:companies");
    clearCache("rows:บริษัท");
    clearCache("headers:companies");
  } else if (canonical === "loans" || normalized === "ยืมเงิน" || normalized === "loans") {
    clearCache("rows:loans");
    clearCache("rows:ยืมเงิน");
    clearCache("headers:loans");
  } else if (canonical === "products" || normalized === "สินค้า" || normalized === "products") {
    clearCache("rows:products");
    clearCache("rows:สินค้า");
    clearCache("headers:products");
  }
}

/**
 * Fetch rows from Supabase PostgreSQL database with tiered memory cache
 */
export async function getRows(tableName: string, _ttlMs?: number, maxRows = 10_000): Promise<TableRow[]> {
  const ttl = _ttlMs !== undefined ? _ttlMs : getTableDefaultTtl(tableName);
  const cacheKey = `rows:${tableName}:${maxRows}`;

  return cached(cacheKey, ttl, async () => {
    try {
      const rows = await getRowsFromSupabase(tableName, maxRows);
      if (rows !== null && rows !== undefined) return rows;
      return [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`Supabase fetch failed for ${tableName}: ${msg}`);
      return [];
    }
  });
}

export const fetchTableRows = getRows;

/**
 * Fetch bills with active withdraw status directly using database index
 */
export async function getWithdrawBills(maxRows = 3_000): Promise<TableRow[]> {
  return cached(`bills:withdraw:${maxRows}`, 1_000, async () => {
    try {
      const rows = await getWithdrawBillsFromSupabase(maxRows);
      return rows || [];
    } catch (e) {
      console.warn("getWithdrawBills failed, falling back to full table:", e);
      const allRows = await getRows("Data", 1_000, maxRows);
      return allRows;
    }
  });
}

/**
 * Fetch bills with active VAT, withholding tax, or credit directly using database index
 */
export async function getBillFollowBills(maxRows = 3_000): Promise<TableRow[]> {
  return cached(`bills:bill_follow:${maxRows}`, 1_000, async () => {
    try {
      const rows = await getBillFollowRowsFromSupabase(maxRows);
      return rows || [];
    } catch (e) {
      console.warn("getBillFollowBills failed, falling back to full table:", e);
      const allRows = await getRows("Data", 1_000, maxRows);
      return allRows;
    }
  });
}

/**
 * Fetch high-speed financial aggregation directly from PostgreSQL RPC
 */
export async function getDashboardFinancialSummary(startDate?: string, endDate?: string, projectId?: string) {
  const cacheKey = `summary:fin:${startDate || "all"}:${endDate || "all"}:${projectId || "all"}`;
  return cached(cacheKey, 2_000, async () => {
    return getDashboardFinancialSummaryFromSupabase(startDate, endDate, projectId);
  });
}

/**
 * Get columns/headers for a Supabase table
 */
export async function getHeaders(tableName: string): Promise<string[]> {
  try {
    const data = await getRows(tableName);
    if (data.length) {
      return Object.keys(data[0]).filter(col => !col.startsWith("_"));
    }
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Generate reference options for dropdowns from Supabase rows
 */
export async function listRefOptions(tableName: string, options: {
  keyColumn?: string;
  labelColumn?: string;
  validIf?: string;
  rowColumns?: string[];
  rows?: TableRow[];
} = {}): Promise<RefOption[]> {
  let rows = options.rows ? options.rows : await getRows(tableName, 60_000);
  if (options.validIf === "activeProjects") {
    rows = rows.filter(row => {
      const color = String(row.color || row.COLOR || "").trim().toLowerCase();
      const status = String(row["สถานะ"] || row.status || "").trim().toLowerCase();
      if (status.includes("เสร็จ") || status.includes("ปิด") || status.includes("close") || status.includes("done")) {
        return false;
      }
      if (color === "gray" || color === "grey" || color === "black" || color === "closed") {
        return false;
      }
      return true;
    });
  }

  const keyColumn = options.keyColumn || TABLE_KEYS[tableName] || "id";
  const labelColumn = options.labelColumn || keyColumn;
  const isProjectTable = tableName === TABLES.PROJECT || tableName === "Project" || tableName === "projects";
  const isStoreTable = tableName === TABLES.STORE || tableName === "stores" || tableName === "ร้านค้า";
  const projectExtraCols = isProjectTable ? ["งบไม่เกินค่าแรง", "งบไม่เกิน", "ยอดงาน", "คุมงบประเภทงาน", "งบไม่เกินค่าของ"] : [];
  const storeExtraCols = isStoreTable ? ["เครดิตจ่าย", "credit_payment_day", "ชื่อเต็ม", "เลขบัญชี", "ธนาคาร"] : [];
  const bankExtraCols = (tableName === TABLES.BANK || tableName === "BANK" || tableName === "ธนาคาร" || tableName === "banks") ? ["id_bank", "ชื่อธนาคาร", "name"] : [];
  const rowColumns = unique([keyColumn, labelColumn, "image", "image_url", ...projectExtraCols, ...storeExtraCols, ...bankExtraCols, ...(options.rowColumns || [])]);

  return rows
    .filter(row => row[keyColumn] !== "" && row[keyColumn] !== undefined && row[keyColumn] !== null)
    .slice(0, 1000)
    .map(row => ({
      value: row[keyColumn],
      label: (tableName === TABLES.BANK || tableName === "BANK" || tableName === "ธนาคาร" || tableName === "banks")
        ? String(row["ชื่อธนาคาร"] || row.name || row[labelColumn] || row[keyColumn])
        : row[labelColumn] ? String(row[labelColumn]) : String(row[keyColumn]),
      row: isProjectTable || isStoreTable ? row : pick(row, rowColumns)
    }));
}

/**
 * Get system options from Supabase
 */
export async function getSystemOptions(): Promise<Record<string, string[]>> {
  try {
    const options = await getSystemOptionsFromSupabase();
    return options || {};
  } catch (e) {
    console.warn("Failed to fetch system options from Supabase", e);
    return {};
  }
}

/**
 * Insert new row into Supabase
 */
export async function appendRow(tableName: string, row: TableRow) {
  let result: any = null;
  try {
    result = await insertRowToSupabase(tableName, row);
  } catch (e) {
    console.warn(`Supabase appendRow failed for ${tableName}:`, e);
    throw e;
  }
  invalidateTableCache(tableName);
  return result;
}

export const createTableRow = appendRow;

/**
 * Bulk insert new rows into Supabase in a single batch query
 */
export async function bulkAppendRows(tableName: string, rows: TableRow[]) {
  try {
    const inserted = await bulkInsertRowsToSupabase(tableName, rows);
    invalidateTableCache(tableName);
    return inserted;
  } catch (e) {
    console.warn(`Supabase bulkAppendRows failed for ${tableName}:`, e);
    throw e;
  }
}

/**
 * Update an existing row in Supabase by primary key / ID
 */
export async function updateRow(tableName: string, sheetRow: number | string, patch: TableRow) {
  const keyColumn = TABLE_KEYS[tableName] || "id";
  const rawTarget = (sheetRow !== 0 && sheetRow !== undefined && sheetRow !== null && String(sheetRow).trim() !== "" && String(sheetRow) !== "0")
    ? sheetRow
    : (patch[keyColumn] || patch.id || patch._sheetRow || sheetRow);
  const keyValue = rawTarget;

  try {
    await updateRowInSupabase(tableName, keyColumn, keyValue, patch);
  } catch (e) {
    console.warn(`Supabase updateRow failed for ${tableName}:`, e);
  }

  invalidateTableCache(tableName);
  return patch;
}

export const updateTableRow = updateRow;

/**
 * Delete rows from Supabase in a single batch query
 */
export async function deleteRows(tableName: string, targetKeys: (number | string)[], targetRows?: TableRow[]) {
  const keys = [...new Set(targetKeys.map(r => String(r).trim()))];
  if (!keys.length) throw new Error("No items selected for deletion.");

  try {
    const keyColumn = TABLE_KEYS[tableName] || "id";
    const allRows = targetRows && targetRows.length ? targetRows : (await getRows(tableName).catch(() => []));
    const idsToDelete = new Set<string | number>();

    const imageUrls: string[] = [];

    for (const itemKey of keys) {
      const foundRow = allRows.find(r =>
        String(r._sheetRow) === itemKey ||
        String(r[keyColumn]) === itemKey ||
        String(r["ลำดับ"]) === itemKey ||
        String(r.id) === itemKey ||
        String(r.id_Conwork) === itemKey ||
        String(r.id_store) === itemKey ||
        String(r.id_bank) === itemKey ||
        String(r.id_Contractor) === itemKey ||
        String(r.id_car) === itemKey ||
        String(r.id_cus) === itemKey ||
        String(r.id_Company) === itemKey
      );
      if (foundRow) {
        const imgField = foundRow["รูปถ่ายบิล"] || foundRow["รูปถ่าย"] || foundRow["รูปภาพ"] || foundRow.image || foundRow.image_url;
        if (typeof imgField === "string" && imgField.trim()) {
          imageUrls.push(imgField.trim());
        }
      }
      const targetVal = foundRow?.id ?? foundRow?.[keyColumn] ?? foundRow?.id_Conwork ?? foundRow?.id_bank ?? foundRow?.id_store ?? foundRow?.id_Contractor ?? foundRow?.id_cus ?? foundRow?.id_Company ?? foundRow?.id_car ?? itemKey;
      if (typeof targetVal === "string" || typeof targetVal === "number") {
        if (String(targetVal).trim() !== "") {
          idsToDelete.add(targetVal);
        }
      }
    }

    if (imageUrls.length > 0) {
      await deleteStorageFilesFromSupabase(imageUrls).catch(err => {
        console.warn("Storage files cleanup warning:", err);
      });
    }

    if (idsToDelete.size > 0) {
      await deleteRowsFromSupabase(tableName, Array.from(idsToDelete));
    }
  } catch (e) {
    console.warn(`Supabase deleteRows failed for ${tableName}:`, e);
  }

  invalidateTableCache(tableName);
}

export const deleteTableRows = deleteRows;

/**
 * Append audit log entry into Supabase audit_logs table
 */
export async function appendAuditLog(entry: AuditEntry) {
  await insertAuditLogToSupabase(entry).catch(() => undefined);
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function pick(row: TableRow, columns: string[]) {
  const output: TableRow = {};
  columns.forEach(col => {
    if (col in row) output[col] = row[col];
  });
  return output;
}
