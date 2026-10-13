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
  const { createMemberTaskTableFlex } = await import("../lib/line/line-tasks-works");
  const { sendFlexMessageDetailed } = await import("../lib/line/line");
  const { supabaseAdmin } = await import("../lib/supabase/supabase-admin");

  const { data: dbTasks } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .neq("status", "สำเร็จ")
    .order("id", { ascending: false })
    .limit(7);

  console.log("DB Tasks found:", dbTasks?.length || 0);

  // 1. Generate All Tasks Flex for "งาน" (WITHOUT TIMELINE)
  console.log("--- 1. Testing 'งาน' / 'งานทั้งหมด' (No Timeline) ---");
  const allTasksNoTimeline = createMemberTaskTableFlex("ทั้งหมด", dbTasks || []);
  const headerCols = allTasksNoTimeline.body.contents[2].contents;
  console.log("Header Columns Count:", headerCols.length);
  headerCols.forEach((c: any, i: number) => {
    if (c.text) console.log(`  Col ${i}:`, c.text);
    if (c.contents && c.contents[0]?.text) console.log(`  Col ${i} Box:`, c.contents[0].text);
  });

  // 2. Generate Specific Member Flex for "งาน:หมึก" (WITH TIMELINE)
  console.log("\n--- 2. Testing 'งาน:หมึก' (With Timeline) ---");
  const memberTasksWithTimeline = createMemberTaskTableFlex("หมึก", (dbTasks || []).slice(0, 2));
  const memberHeaderCols = memberTasksWithTimeline.body.contents[2].contents;
  console.log("Member Header Columns Count:", memberHeaderCols.length);
  memberHeaderCols.forEach((c: any, i: number) => {
    if (c.text) console.log(`  Col ${i}:`, c.text);
    if (c.contents && c.contents[0]?.text) console.log(`  Col ${i} Box:`, c.contents[0].text);
  });

  // 3. Send updated "งาน" (No timeline) to LINE user
  console.log("\n--- 3. Sending updated 'งาน' (No timeline) to LINE user: ---", targetUser);
  const res = await sendFlexMessageDetailed(targetUser, "รายการงานทั้งหมด (ไม่แสดงไทม์ไลน์)", allTasksNoTimeline);
  console.log("Send Result:", res);
}

run();
