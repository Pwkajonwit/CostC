import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { isSupabaseConfigured } from "@/lib/supabase/supabase-db";

export type ImportType =
  | "single_csv"
  | "multi_csv"
  | "restore_json"
  | "restore_zip"
  | "restore_point";

export type ImportStatus = "success" | "partial" | "failed";

export type ImportDetailItem = {
  filename: string;
  tableName: string;
  count: number;
  success: boolean;
  error?: string;
};

export type ImportHistoryItem = {
  id: string;
  createdAt: string; // ISO 8601
  importType: ImportType;
  title: string;
  tableName?: string;
  targetTableId?: string;
  fileName: string;
  fileSize?: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: ImportStatus;
  actor: string;
  details?: ImportDetailItem[];
  notes?: string;
};

const SYSTEM_OPTION_KEY = "import_history";
const MAX_HISTORY_RETENTION = 60;

/**
 * Fetch import history from Supabase system_options table
 */
export async function getImportHistory(): Promise<ImportHistoryItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", SYSTEM_OPTION_KEY)
      .maybeSingle();

    if (error) {
      console.warn("Failed to fetch import_history from system_options:", error);
      return [];
    }

    if (data && Array.isArray(data.data)) {
      return data.data as ImportHistoryItem[];
    }
    return [];
  } catch (err) {
    console.warn("Exception in getImportHistory:", err);
    return [];
  }
}

/**
 * Append an import history entry to system_options with retention rotation
 */
export async function appendImportHistory(
  entry: ImportHistoryItem,
  maxRetention = MAX_HISTORY_RETENTION
): Promise<ImportHistoryItem[]> {
  const current = await getImportHistory();

  // Deduplicate by ID and prepend new entry
  const updatedHistory = [entry, ...current.filter((item) => item.id !== entry.id)].slice(
    0,
    maxRetention
  );

  if (isSupabaseConfigured()) {
    try {
      await supabaseAdmin.from("system_options").upsert({
        id: SYSTEM_OPTION_KEY,
        data: updatedHistory,
        updated_at: new Date().toISOString()
      });

      // Also record in audit_logs for system traceability
      try {
        await supabaseAdmin
          .from("audit_logs")
          .insert({
            action: "IMPORT",
            table_name: entry.tableName || "all",
            actor: entry.actor || "system",
            details: {
              importType: entry.importType,
              fileName: entry.fileName,
              totalRows: entry.totalRows,
              successCount: entry.successCount,
              status: entry.status,
              historyId: entry.id
            }
          });
      } catch (_) {}
    } catch (err) {
      console.warn("Failed to persist import_history:", err);
    }
  }

  return updatedHistory;
}

/**
 * Delete a specific entry or clear all import history
 */
export async function deleteImportHistory(
  entryId?: string,
  clearAll = false
): Promise<ImportHistoryItem[]> {
  let updatedHistory: ImportHistoryItem[] = [];

  if (!clearAll && entryId) {
    const current = await getImportHistory();
    updatedHistory = current.filter((item) => item.id !== entryId);
  }

  if (isSupabaseConfigured()) {
    try {
      await supabaseAdmin.from("system_options").upsert({
        id: SYSTEM_OPTION_KEY,
        data: updatedHistory,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Failed to delete/clear import_history:", err);
    }
  }

  return updatedHistory;
}
