import { getRows, bulkAppendRows, getSystemOptions } from "@/lib/db";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/supabase-db";
import { clearCache } from "@/lib/utils/cache";
import { sendTextMessageDetailed } from "@/lib/line/line";

export type BackupConfig = {
  enabled: boolean;
  frequency: "weekly" | "daily" | "monthly";
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  time: string; // "HH:mm" e.g. "02:00"
  retentionSnapshots: number; // e.g. 10 snapshots
  notifyLine: boolean;
  targetLineGroup?: string;
  lastBackupAt?: string | null;
  lastBackupStatus?: "success" | "failed" | null;
  lastBackupMessage?: string | null;
  nextBackupAt?: string | null;
};

export type BackupSnapshotSummary = {
  id: string;
  filename: string;
  createdAt: string;
  type: "weekly_auto" | "daily_auto" | "monthly_auto" | "manual";
  totalTables: number;
  totalRows: number;
  sizeBytes: number;
  status: "success" | "failed";
  error?: string;
  tablesSummary: Record<string, number>;
  storagePath?: string;
};

export const ALL_SYSTEM_TABLES = [
  { id: "banks", tableName: "ธนาคาร", name: "ธนาคาร (Banks)" },
  { id: "stores", tableName: "ร้านค้า", name: "ร้านค้า (Stores / Suppliers)" },
  { id: "contractors", tableName: "รับเหมา", name: "ผู้รับเหมา (Contractors)" },
  { id: "people", tableName: "รายชื่อ", name: "รายชื่อพนักงาน (Staff & Users)" },
  { id: "cars", tableName: "ทะเบียน", name: "ทะเบียนรถ (Vehicles)" },
  { id: "customers", tableName: "ลูกค้า", name: "ลูกค้า (Customers)" },
  { id: "companies", tableName: "บริษัท", name: "บริษัท (Companies)" },
  { id: "products", tableName: "สินค้า", name: "สินค้า (Products)" },
  { id: "projects", tableName: "Project", name: "โครงการ (Projects)" },
  { id: "contract_works", tableName: "งานรับเหมา", name: "งานรับเหมา (Contract Works)" },
  { id: "bills", tableName: "Data", name: "รายการบิล (Bills / Expenses)" },
  { id: "loans", tableName: "ยืมเงิน", name: "ยืมเงิน (Loans / Advances)" }
];

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  frequency: "weekly",
  dayOfWeek: 0, // Every Sunday
  time: "02:00",
  retentionSnapshots: 12, // Keep 12 weeks of backups
  notifyLine: true,
  lastBackupAt: null,
  lastBackupStatus: null,
  nextBackupAt: null
};

// Calculate the next scheduled backup ISO timestamp
export function calculateNextBackupTime(config: BackupConfig): string {
  const now = new Date();
  const [targetHour, targetMinute] = (config.time || "02:00").split(":").map(Number);

  const next = new Date(now);
  next.setHours(targetHour || 2, targetMinute || 0, 0, 0);

  if (config.frequency === "daily") {
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (config.frequency === "weekly") {
    const currentDay = now.getDay();
    const targetDay = Number(config.dayOfWeek ?? 0);
    let diffDays = targetDay - currentDay;

    if (diffDays < 0 || (diffDays === 0 && next <= now)) {
      diffDays += 7;
    }
    next.setDate(next.getDate() + diffDays);
  } else if (config.frequency === "monthly") {
    next.setDate(1);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next.toISOString();
}

// 1. Fetch current Backup Configuration
export async function getBackupConfig(): Promise<BackupConfig> {
  if (!isSupabaseConfigured()) return DEFAULT_BACKUP_CONFIG;

  try {
    const { data, error } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "backup_config")
      .maybeSingle();

    if (error || !data || !data.data) {
      return {
        ...DEFAULT_BACKUP_CONFIG,
        nextBackupAt: calculateNextBackupTime(DEFAULT_BACKUP_CONFIG)
      };
    }

    const config = { ...DEFAULT_BACKUP_CONFIG, ...data.data };
    if (!config.nextBackupAt) {
      config.nextBackupAt = calculateNextBackupTime(config);
    }
    return config;
  } catch (err) {
    console.warn("Failed to read backup_config:", err);
    return DEFAULT_BACKUP_CONFIG;
  }
}

// 2. Save Backup Configuration
export async function saveBackupConfig(config: Partial<BackupConfig>): Promise<BackupConfig> {
  const current = await getBackupConfig();
  const updated: BackupConfig = {
    ...current,
    ...config
  };
  updated.nextBackupAt = calculateNextBackupTime(updated);

  if (isSupabaseConfigured()) {
    await supabaseAdmin.from("system_options").upsert({
      id: "backup_config",
      data: updated,
      updated_at: new Date().toISOString()
    });
  }

  return updated;
}

// 3. Fetch Backup History Log
export async function getBackupHistory(): Promise<BackupSnapshotSummary[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "backup_history")
      .maybeSingle();

    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  } catch (err) {
    console.warn("Failed to read backup_history:", err);
    return [];
  }
}

// 4. Save to Backup History Log (with retention rotation)
export async function appendBackupHistory(snapshot: BackupSnapshotSummary, maxRetention = 12): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const history = await getBackupHistory();
    // Prepend new snapshot
    const updatedHistory = [snapshot, ...history.filter(h => h.id !== snapshot.id)].slice(0, maxRetention);

    await supabaseAdmin.from("system_options").upsert({
      id: "backup_history",
      data: updatedHistory,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn("Failed to append backup_history:", err);
  }
}

// 5. Generate Full Database Backup Payload
export async function generateFullBackupPayload(backupType: "weekly_auto" | "daily_auto" | "monthly_auto" | "manual" = "manual") {
  const backupData: Record<string, any[]> = {};
  let totalRows = 0;
  const tablesSummary: Record<string, number> = {};

  for (const item of ALL_SYSTEM_TABLES) {
    try {
      const rows = await getRows(item.tableName, 0, 50000);
      const cleanRows = (rows || []).map((r) => {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          if (!k.startsWith("_") && v !== undefined && v !== null) {
            clean[k] = v;
          }
        }
        return clean;
      });
      backupData[item.tableName] = cleanRows;
      tablesSummary[item.tableName] = cleanRows.length;
      totalRows += cleanRows.length;
    } catch (err) {
      backupData[item.tableName] = [];
      tablesSummary[item.tableName] = 0;
    }
  }

  // Backup system options
  let systemOptionsData: any = [];
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabaseAdmin.from("system_options").select("*");
      systemOptionsData = data || [];
    } catch (e) {
      systemOptionsData = await getSystemOptions();
    }
  } else {
    systemOptionsData = await getSystemOptions();
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toISOString();
  const snapshotId = `bk_${Date.now()}`;

  const payload = {
    version: "2.0",
    id: snapshotId,
    type: "COSTLAB_ENTERPRISE_BACKUP",
    backupCategory: backupType,
    appName: "CostLab",
    exportedAt: timestamp,
    summary: {
      totalTables: ALL_SYSTEM_TABLES.length,
      totalRows,
      tablesSummary
    },
    tables: backupData,
    system_options: systemOptionsData
  };

  return {
    payload,
    snapshotId,
    totalRows,
    tablesSummary,
    dateStr
  };
}

// 6. Execute Full Backup and Save Snapshot (to Supabase Storage & History)
export async function executeAndSaveSnapshot(backupType: "weekly_auto" | "daily_auto" | "monthly_auto" | "manual" = "manual"): Promise<BackupSnapshotSummary> {
  const { payload, snapshotId, totalRows, tablesSummary, dateStr } = await generateFullBackupPayload(backupType);

  const jsonString = JSON.stringify(payload, null, 2);
  const sizeBytes = Buffer.byteLength(jsonString, "utf8");
  const filename = `CostLab_Backup_${backupType}_${dateStr}_${snapshotId}.json`;
  let storagePath = "";

  if (isSupabaseConfigured()) {
    try {
      // Ensure 'backups' bucket exists
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const hasBackupsBucket = (buckets || []).some(b => b.name === "backups");
      if (!hasBackupsBucket) {
        await supabaseAdmin.storage.createBucket("backups", { public: false });
      }

      // Upload backup file
      const uploadRes = await supabaseAdmin.storage
        .from("backups")
        .upload(filename, Buffer.from(jsonString), {
          contentType: "application/json",
          upsert: true
        });

      if (!uploadRes.error) {
        storagePath = uploadRes.data?.path || filename;
      }
    } catch (e) {
      console.warn("Storage upload warning (will save in database history):", e);
    }
  }

  const snapshot: BackupSnapshotSummary = {
    id: snapshotId,
    filename,
    createdAt: new Date().toISOString(),
    type: backupType,
    totalTables: ALL_SYSTEM_TABLES.length,
    totalRows,
    sizeBytes,
    status: "success",
    tablesSummary,
    storagePath
  };

  // Update backup history and config
  const config = await getBackupConfig();
  await appendBackupHistory(snapshot, config.retentionSnapshots || 12);
  await saveBackupConfig({
    lastBackupAt: snapshot.createdAt,
    lastBackupStatus: "success",
    lastBackupMessage: `สำรองข้อมูลสำเร็จ ${totalRows.toLocaleString()} แถว (${(sizeBytes / 1024).toFixed(1)} KB)`
  });

  return snapshot;
}

// 7. Restore Database from JSON Payload
export async function restoreFromPayload(body: any): Promise<{
  success: boolean;
  totalRestored: number;
  details: { tableName: string; count: number; success: boolean; error?: string }[];
  message: string;
}> {
  if (!body || typeof body !== "object") {
    throw new Error("โครงสร้างไฟล์ JSON สำรองข้อมูลไม่ถูกต้อง");
  }

  const tablesData = body.tables || body.data || body;
  const restoredSummary: { tableName: string; count: number; success: boolean; error?: string }[] = [];
  let totalRestored = 0;

  for (const item of ALL_SYSTEM_TABLES) {
    const rows =
      tablesData[item.tableName] ||
      tablesData[item.id] ||
      (tablesData[item.tableName.toLowerCase()] ? tablesData[item.tableName.toLowerCase()] : []);

    if (Array.isArray(rows) && rows.length > 0) {
      try {
        const inserted = await bulkAppendRows(item.tableName, rows);
        const count = inserted && Array.isArray(inserted) ? inserted.length : rows.length;
        totalRestored += count;
        restoredSummary.push({
          tableName: item.tableName,
          count,
          success: true
        });
      } catch (err: any) {
        restoredSummary.push({
          tableName: item.tableName,
          count: 0,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  // Restore system options if present
  if (body.system_options && isSupabaseConfigured()) {
    try {
      if (Array.isArray(body.system_options)) {
        for (const opt of body.system_options) {
          if (opt.id && opt.id !== "backup_config" && opt.id !== "backup_history") {
            await supabaseAdmin.from("system_options").upsert({
              id: opt.id,
              data: opt.data || opt.value || opt,
              updated_at: new Date().toISOString()
            });
          }
        }
      } else if (typeof body.system_options === "object") {
        for (const [optId, optVal] of Object.entries(body.system_options)) {
          if (optId !== "backup_config" && optId !== "backup_history") {
            await supabaseAdmin.from("system_options").upsert({
              id: optId,
              data: optVal,
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      console.warn("Failed to restore system_options:", e);
    }
  }

  clearCache();

  return {
    success: true,
    totalRestored,
    details: restoredSummary,
    message: `กู้คืนข้อมูลทั้งระบบสำเร็จ รวม ${totalRestored.toLocaleString()} รายการ`
  };
}

// 8. Restore from Snapshot ID (from Supabase Storage)
export async function restoreFromSnapshotId(snapshotId: string): Promise<{
  success: boolean;
  totalRestored: number;
  details: { tableName: string; count: number; success: boolean; error?: string }[];
  message: string;
}> {
  const history = await getBackupHistory();
  const snapshot = history.find(h => h.id === snapshotId);
  if (!snapshot) {
    throw new Error(`ไม่พบจุดสำรองข้อมูลรหัส ${snapshotId}`);
  }

  if (!snapshot.filename && !snapshot.storagePath) {
    throw new Error("ไม่มีไฟล์สำรองในระบบจัดเก็บ");
  }

  const filename = snapshot.storagePath || snapshot.filename;
  const { data, error } = await supabaseAdmin.storage.from("backups").download(filename);

  if (error || !data) {
    throw new Error(`ไม่สามารถดาวน์โหลดไฟล์สำรอง ${filename} จาก Storage ได้: ${error?.message || ""}`);
  }

  const text = await data.text();
  const parsedJson = JSON.parse(text);

  return await restoreFromPayload(parsedJson);
}

// 9. Download Backup Snapshot File from Supabase Storage
export async function getBackupSnapshotFile(snapshotId: string): Promise<{
  filename: string;
  data: Blob;
  sizeBytes: number;
}> {
  const history = await getBackupHistory();
  const snapshot = history.find(h => h.id === snapshotId);
  if (!snapshot) {
    throw new Error(`ไม่พบจุดสำรองข้อมูลรหัส ${snapshotId}`);
  }

  if (!snapshot.filename && !snapshot.storagePath) {
    throw new Error("ไม่มีไฟล์สำรองในระบบจัดเก็บ");
  }

  const filename = snapshot.storagePath || snapshot.filename;
  const { data, error } = await supabaseAdmin.storage.from("backups").download(filename);

  if (error || !data) {
    throw new Error(`ไม่สามารถดาวน์โหลดไฟล์สำรอง ${filename} จาก Storage ได้: ${error?.message || ""}`);
  }

  return {
    filename: snapshot.filename || filename,
    data,
    sizeBytes: snapshot.sizeBytes
  };
}

// 10. Delete Backup Snapshot (File from Storage and Record from History)
export async function deleteBackupSnapshot(snapshotId: string): Promise<{
  success: boolean;
  message: string;
  history: BackupSnapshotSummary[];
}> {
  if (!isSupabaseConfigured()) {
    throw new Error("ระบบฐานข้อมูล Supabase ยังไม่ได้เชื่อมต่อ");
  }

  const history = await getBackupHistory();
  const snapshot = history.find(h => h.id === snapshotId);
  if (!snapshot) {
    throw new Error(`ไม่พบจุดสำรองข้อมูลรหัส ${snapshotId}`);
  }

  const filename = snapshot.storagePath || snapshot.filename;
  if (filename) {
    try {
      await supabaseAdmin.storage.from("backups").remove([filename]);
    } catch (e) {
      console.warn(`Failed to remove file ${filename} from storage:`, e);
    }
  }

  const updatedHistory = history.filter(h => h.id !== snapshotId);

  await supabaseAdmin.from("system_options").upsert({
    id: "backup_history",
    data: updatedHistory,
    updated_at: new Date().toISOString()
  });

  // If the deleted snapshot was the latest, update config
  try {
    const config = await getBackupConfig();
    if (config.lastBackupAt === snapshot.createdAt) {
      const latest = updatedHistory[0];
      await saveBackupConfig({
        lastBackupAt: latest ? latest.createdAt : null,
        lastBackupStatus: latest ? latest.status : null,
        lastBackupMessage: latest ? `สำรองข้อมูลล่าสุด (${latest.totalRows.toLocaleString()} แถว)` : null
      });
    }
  } catch (e) {
    console.warn("Failed to update lastBackupAt in config after deletion:", e);
  }

  return {
    success: true,
    message: `ลบจุดสำรองข้อมูล ${snapshotId} เรียบร้อยแล้ว`,
    history: updatedHistory
  };
}

// 11. Centralized LINE Alert Notification for Backups
export async function sendBackupLineNotification(
  snapshot: BackupSnapshotSummary,
  config: BackupConfig,
  isCron = false
): Promise<void> {
  if (!config.notifyLine) return;
  try {
    const { data: lineOpt } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "line_config")
      .maybeSingle();

    const lineConfig = lineOpt?.data || {};
    const target = config.targetLineGroup || lineConfig.LINE_GROUP_ID_PW || lineConfig.LINE_USER_ID_OWN;

    if (target) {
      const typeLabel =
        snapshot.type === "weekly_auto" ? "ประจำสัปดาห์ (Weekly)" :
        snapshot.type === "daily_auto" ? "ประจำวัน (Daily)" :
        snapshot.type === "monthly_auto" ? "ประจำเดือน (Monthly)" : "ด้วยตนเอง (Manual)";
      const sizeKb = (snapshot.sizeBytes / 1024).toFixed(1);
      const dateFormatted = new Date(snapshot.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
      const prefix = isCron ? "🛡️ [อัตโนมัติ] สำรองข้อมูลระบบ" : "🛡️ บันทึกสำรองข้อมูลระบบสำเร็จ";

      const msg = `${prefix} (${typeLabel})\n` +
        `📅 วันที่: ${dateFormatted}\n` +
        `📦 ข้อมูลทั้งหมด: ${snapshot.totalTables} ตาราง (${snapshot.totalRows.toLocaleString()} รายการ)\n` +
        `💾 ขนาดไฟล์: ${sizeKb} KB\n` +
        `📁 รหัสสำรอง: ${snapshot.id}\n` +
        `✅ สถานะ: ${isCron ? "ปลอดภัย พร้อมกู้คืนในระบบ" : "สำรองข้อมูลสมบูรณ์พร้อมกู้คืน"}`;

      await sendTextMessageDetailed(target, msg);
    }
  } catch (lineErr) {
    console.warn("LINE backup alert skipped:", lineErr);
  }
}
