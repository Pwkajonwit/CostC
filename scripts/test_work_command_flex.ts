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
  const { createMemberTaskTableFlex, createTaskSummaryFlex } = await import("../lib/line/line-tasks-works");
  const { sendFlexMessageDetailed } = await import("../lib/line/line");
  const { supabaseAdmin } = await import("../lib/supabase/supabase-admin");

  const { data: dbTasks } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .neq("status", "สำเร็จ")
    .order("id", { ascending: false })
    .limit(7);

  console.log("DB Tasks found:", dbTasks?.length || 0);

  // 1. Generate All Tasks Flex (คำสั่ง "งาน")
  const allTasksFlex = createMemberTaskTableFlex("ทั้งหมด", dbTasks || []);
  console.log("=== HEADER TITLE FOR 'งาน' ===");
  console.log("Title:", allTasksFlex.body.contents[0].contents[0].contents[0].text);
  console.log("Subtitle:", allTasksFlex.body.contents[0].contents[0].contents[1].text);
  console.log("Col 0 Header:", allTasksFlex.body.contents[2].contents[0].text);
  console.log("Col 4 (Timeline) Header:", allTasksFlex.body.contents[2].contents[6].contents[0].text);

  // Send the actual Flex for "งาน" to the user so they can verify live on their LINE app!
  console.log("\nSending updated 'งาน' Flex to LINE user:", targetUser);
  const res = await sendFlexMessageDetailed(targetUser, "รายการงานทั้งหมด (ตารางไทม์ไลน์ 4 วัน)", allTasksFlex);
  console.log("Send Flex Result:", res);
}

run();
