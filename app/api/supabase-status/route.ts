import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isRefresh = searchParams.get("refresh") === "1";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const isConfigured = Boolean(supabaseUrl && !supabaseUrl.includes("placeholder"));
  const isAnonKeySet = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("placeholder"));
  const isServiceKeySet = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder"));

  const maskedUrl = isConfigured
    ? supabaseUrl.replace(/^(https?:\/\/[^.]+)\..*$/, "$1.supabase.co")
    : "ยังไม่ได้ตั้งค่า (.env.local)";

  let connectionOk = false;
  let latencyMs = 0;
  let connectionMessage = "ไม่ได้ตั้งค่า URL";

  if (isConfigured) {
    const startTime = Date.now();
    try {
      const { error } = await supabaseAdmin.from("projects").select("id", { count: "exact", head: true });
      latencyMs = Date.now() - startTime;
      if (!error) {
        connectionOk = true;
        connectionMessage = "เชื่อมต่อ Supabase PostgreSQL สำเร็จ";
      } else {
        connectionMessage = `เชื่อมต่อล้มเหลว: ${error.message}`;
      }
    } catch (err: any) {
      connectionMessage = `Error: ${err.message}`;
    }
  }

  // 1. Check RPC get_system_stats()
  let rpcStats: any = null;
  let rpcInstalled = false;
  if (connectionOk) {
    try {
      const { data, error } = await supabaseAdmin.rpc("get_system_stats");
      if (!error && data) {
        rpcStats = data;
        rpcInstalled = true;
      }
    } catch {}
  }

  // 2. Storage Buckets Check & File Calculation
  let bucketsList: Array<{
    name: string;
    public: boolean;
    fileCount: number;
    totalBytes: number;
    sizePretty: string;
    description: string;
  }> = [];

  let totalStorageBytes = 0;
  let totalStorageFiles = 0;

  if (connectionOk) {
    if (rpcStats?.storage && Array.isArray(rpcStats.storage) && rpcStats.storage.length > 0) {
      // Use fast RPC data from Postgres
      bucketsList = rpcStats.storage.map((b: any) => {
        const bytes = Number(b.total_bytes || 0);
        const count = Number(b.file_count || 0);
        totalStorageBytes += bytes;
        totalStorageFiles += count;
        return {
          name: String(b.name || b.id),
          public: Boolean(b.public),
          fileCount: count,
          totalBytes: bytes,
          sizePretty: b.size_pretty || formatBytes(bytes),
          description: b.name === "repairs" ? "รูปถ่ายบิล & เอกสารแนบ" : b.name === "backups" ? "ไฟล์สำรองข้อมูล JSON" : "ไฟล์ทั่วไป",
        };
      });
    } else {
      // Fallback: list buckets via Storage API
      try {
        const { data: buckets } = await supabaseAdmin.storage.listBuckets();
        if (buckets && buckets.length > 0) {
          for (const b of buckets) {
            let bFiles = 0;
            let bBytes = 0;

            // List files in bucket (up to 500 files per bucket scan)
            try {
              let offset = 0;
              const limit = 100;
              while (offset < 1000) {
                const { data: files, error } = await supabaseAdmin.storage.from(b.name).list("", {
                  limit,
                  offset,
                  sortBy: { column: "created_at", order: "desc" },
                });
                if (error || !files || files.length === 0) break;
                bFiles += files.length;
                for (const f of files) {
                  if (f.metadata?.size) {
                    bBytes += Number(f.metadata.size);
                  }
                }
                if (files.length < limit) break;
                offset += limit;
              }
            } catch {}

            totalStorageBytes += bBytes;
            totalStorageFiles += bFiles;

            bucketsList.push({
              name: b.name,
              public: Boolean(b.public),
              fileCount: bFiles,
              totalBytes: bBytes,
              sizePretty: formatBytes(bBytes),
              description: b.name === "repairs" ? "รูปถ่ายบิล & เอกสารแนบ" : b.name === "backups" ? "ไฟล์สำรองข้อมูล JSON" : "ไฟล์ทั่วไป",
            });
          }
        }
      } catch {}
    }
  }

  // Storage Quota (Supabase Free tier = 1 GB)
  const storageQuotaBytes = 1024 * 1024 * 1024;
  const storageQuotaPercent = Math.min(100, (totalStorageBytes / storageQuotaBytes) * 100);

  // Database Quota (Supabase Free tier = 500 MB)
  const dbQuotaBytes = 500 * 1024 * 1024;
  const dbSizeBytes = rpcStats?.db_size_bytes ? Number(rpcStats.db_size_bytes) : null;
  const dbSizePretty = rpcStats?.db_size_pretty || (dbSizeBytes ? formatBytes(dbSizeBytes) : null);
  const dbQuotaPercent = dbSizeBytes ? Math.min(100, (dbSizeBytes / dbQuotaBytes) * 100) : null;

  // 3. Table stats
  const targetTables = [
    { name: "โครงการ (projects)", table: "projects" },
    { name: "กรอกบิล (bills)", table: "bills" },
    { name: "ร้านค้า (stores)", table: "stores" },
    { name: "รับเหมา (contractors)", table: "contractors" },
    { name: "งานรับเหมา (contract_works)", table: "contract_works" },
    { name: "งานทั่วไป (tasks)", table: "tasks" },
    { name: "งาน PW (works)", table: "works" },
    { name: "แผนงาน (plans)", table: "plans" },
    { name: "รายชื่อพนักงาน (master_members)", table: "master_members" },
    { name: "ตัวเลือกระบบ (system_options)", table: "system_options" },
  ];

  let tableStats: Array<{
    name: string;
    table: string;
    count: number | null;
    status: string;
    sizePretty?: string;
  }> = [];

  if (connectionOk) {
    const rpcTableMap = new Map<string, { rowCount: number; sizePretty: string }>();
    if (rpcStats?.tables && Array.isArray(rpcStats.tables)) {
      for (const t of rpcStats.tables) {
        rpcTableMap.set(t.table_name, {
          rowCount: Number(t.row_count || 0),
          sizePretty: t.size_pretty,
        });
      }
    }

    tableStats = await Promise.all(
      targetTables.map(async (t) => {
        try {
          const rpcItem = rpcTableMap.get(t.table);
          if (rpcItem) {
            return {
              name: t.name,
              table: t.table,
              count: rpcItem.rowCount,
              status: "พร้อมใช้งาน",
              sizePretty: rpcItem.sizePretty,
            };
          }

          const { count, error } = await supabaseAdmin.from(t.table).select("*", { count: "exact", head: true });
          return {
            name: t.name,
            table: t.table,
            count: error ? null : (count ?? 0),
            status: error ? "ตารางยังไม่ได้สร้าง" : "พร้อมใช้งาน",
          };
        } catch {
          return { name: t.name, table: t.table, count: null, status: "Error" };
        }
      })
    );
  } else {
    tableStats = targetTables.map((t) => ({
      name: t.name,
      table: t.table,
      count: null,
      status: "รอการเชื่อมต่อ DB",
    }));
  }

  // Summary status for bills bucket
  const repairsBucket = bucketsList.find((b) => b.name === "repairs");
  const billsBucketStatus = repairsBucket
    ? `พร้อมใช้งาน (${repairsBucket.fileCount.toLocaleString()} รูป · ${repairsBucket.sizePretty})`
    : "ยังไม่ได้สร้าง Bucket 'repairs'";

  return NextResponse.json({
    isConfigured,
    maskedUrl,
    isAnonKeySet,
    isServiceKeySet,
    connectionOk,
    latencyMs,
    connectionMessage,
    billsBucketStatus,
    tableStats,
    rpcInstalled,
    storageStats: {
      totalFiles: totalStorageFiles,
      totalBytes: totalStorageBytes,
      totalPretty: formatBytes(totalStorageBytes),
      quotaBytes: storageQuotaBytes,
      quotaPretty: "1 GB",
      quotaPercent: storageQuotaPercent,
      buckets: bucketsList,
    },
    databaseStats: {
      dbSizeBytes,
      dbSizePretty,
      quotaBytes: dbQuotaBytes,
      quotaPretty: "500 MB",
      quotaPercent: dbQuotaPercent,
    },
  });
}
