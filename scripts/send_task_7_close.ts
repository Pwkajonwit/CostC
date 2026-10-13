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
  const { sendMultipleTextMessages } = await import("../lib/line/line");
  const { setActiveTaskUploadSession } = await import("../lib/tasks/task-attachments");
  const { supabaseAdmin } = await import("../lib/supabase/supabase-admin");

  const msg1 = "ปิดงาน 7";
  const msg2 = [
    "งานของ: ต้อม",
    "ลำดับ: 7",
    "รายการ: ซ่อใ",
    "ดู/ทำ: 10/10/2026",
    "ส่งงาน: 10/10/2026",
    "เอกสาร ,รูปถ่าย ด้านล่างนี้"
  ].join("\n");

  // Ensure task 7 is closed/completed
  await supabaseAdmin
    .from("tasks")
    .update({ status: "สำเร็จ", send_date: "2026-10-10" })
    .eq("id", 7);

  // Set active upload session
  await setActiveTaskUploadSession(targetUser, 7, "ซ่อใ", "ต้อม");

  console.log("Sending 2 separate messages for task 7 to LINE user:", targetUser);
  const res = await sendMultipleTextMessages(targetUser, [msg1, msg2]);
  console.log("Send result (2 messages):", res);
}

run();
