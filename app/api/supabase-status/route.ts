import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
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

  // Count rows in major tables
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

  let tableStats: Array<{ name: string; table: string; count: number | null; status: string }> = [];
  if (connectionOk) {
    tableStats = await Promise.all(
      targetTables.map(async (t) => {
        try {
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

  // Storage Bucket Check
  let billsBucketStatus = "ไม่ได้ตั้งค่า DB";
  if (connectionOk) {
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const hasBills = buckets?.some(b => b.name === "bills");
      billsBucketStatus = hasBills ? "พร้อมใช้งาน (Public Bucket)" : "ยังไม่ได้สร้าง Bucket 'bills'";
    } catch {
      billsBucketStatus = "ตรวจสอบไม่สำเร็จ";
    }
  }

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
  });
}

