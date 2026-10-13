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
  const { createMemberTaskTableFlex, handleTaskCommands } = await import("../lib/line/line-tasks-works");
  const { getActiveTaskUploadSession } = await import("../lib/tasks/task-attachments");

  // 1. Check Table Flex Action Text for Send Button
  const flex = createMemberTaskTableFlex("มายู", [
    {
      id: 2770,
      title: "ทำบันทึกยอดสั่งข้าวโอที",
      assignee_name: "มายู",
      do_date: "2026-10-01",
      send_date: "2026-10-31",
      status: "ดำเนินการ"
    }
  ]);

  const taskRow = flex.body.contents[4]; // first task row
  console.log("=== TASK ROW STRUCTURE ===");
  console.log(JSON.stringify(taskRow, null, 2));

  // 2. Test Processing the Keyword Message
  const keywordInput = [
    "งานของ: มายู",
    "ลำดับ: 2770",
    "รายการ: ทำบันทึกยอดสั่งข้าวโอที",
    "ดู/ทำ: 01/10/2026",
    "ส่งงาน: 31/10/2026",
    "เอกสาร ,รูปถ่าย ด้านล่างนี้"
  ].join("\n");

  console.log("\n=== TESTING HANDLE KEYWORD SUBMIT ===");
  const handled = await handleTaskCommands(keywordInput, keywordInput.toLowerCase(), "", targetUser, targetUser);
  console.log("Handled result:", handled);

  // 3. Verify Active Upload Session
  const session = await getActiveTaskUploadSession([targetUser]);
  console.log("Active Upload Session for targetUser:", session);
}

run();
