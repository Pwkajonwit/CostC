import fs from "fs";

try {
  const envContent = fs.readFileSync(".env.local", "utf8");
  envContent.split("\n").forEach((line) => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.substring(0, idx).trim();
      let v = line.substring(idx + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[k] = v;
    }
  });
} catch (e) {
  console.error("Failed to read .env.local", e);
}

async function run() {
  const targetUser = "U8d286780c70cf7d60a0ff5704dcf2319";
  const { handleTaskCommands } = await import("../lib/line/line-tasks-works");
  const { getActiveTaskUploadSession } = await import("../lib/tasks/task-attachments");
  const { supabaseAdmin } = await import("../lib/supabase/supabase-admin");

  console.log("--- TEST 1: Command 'ปิดงาน: 7' ---");
  const cmd1 = "ปิดงาน: 7";
  const handled1 = await handleTaskCommands(cmd1, cmd1.toLowerCase(), "", targetUser, targetUser);
  console.log("Handled 1 result:", handled1);

  const session1 = await getActiveTaskUploadSession([targetUser]);
  console.log("Active Session 1:", session1);

  const { data: task1 } = await supabaseAdmin.from("tasks").select("*").eq("id", 7).single();
  console.log("Task 7 status after Test 1:", task1?.status, "send_date:", task1?.send_date);

  console.log("\n--- TEST 2: Multi-line User Message ---");
  const multiline = `ปิดงาน

แยกข้อความ

งานของ: ต้อม
ลำดับ: 7
รายการ: ซ่อใ
ดู/ทำ: 10/10/2026
ส่งงาน: 10/10/2026
เอกสาร ,รูปถ่าย ด้านล่างนี้`;

  const handled2 = await handleTaskCommands(multiline, multiline.toLowerCase(), "", targetUser, targetUser);
  console.log("Handled 2 result:", handled2);

  const session2 = await getActiveTaskUploadSession([targetUser]);
  console.log("Active Session 2:", session2);

  const { data: task2 } = await supabaseAdmin.from("tasks").select("*").eq("id", 7).single();
  console.log("Task 7 status after Test 2:", task2?.status, "send_date:", task2?.send_date);
}

run();
