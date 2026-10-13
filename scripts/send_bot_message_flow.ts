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
  const { sendFlexMessageDetailed, sendTextMessageDetailed } = await import("../lib/line/line");
  const { setActiveTaskUploadSession } = await import("../lib/tasks/task-attachments");

  console.log("1. Sending Task Table Flex with 'ส่ง' button to:", targetUser);
  const flex = createMemberTaskTableFlex("มายู", [
    {
      id: 2770,
      title: "ทำบันทึกยอดสั่งข้าวโอที",
      assignee_name: "มายู",
      do_date: "2026-10-01",
      send_date: "2026-10-31",
      status: "ดำเนินการ"
    }
  ], {
    subtitle: "รายการงาน (กดปุ่ม ส่ง เพื่อให้ Bot ส่งข้อความพร้อมรับรูปแนบ)"
  });

  const resFlex = await sendFlexMessageDetailed(targetUser, "ตารางงานของ มายู (รหัส 2770)", flex);
  console.log("Send Flex Result:", resFlex);

  // 2. Send the exact message FROM THE BOT for task 2770
  console.log("2. Sending exact message FROM THE BOT to:", targetUser);
  const botMessage = [
    "งานของ: มายู",
    "ลำดับ: 2770",
    "รายการ: ทำบันทึกยอดสั่งข้าวโอที",
    "ดู/ทำ: 01/10/2026",
    "ส่งงาน: 31/10/2026",
    "เอกสาร ,รูปถ่าย ด้านล่างนี้"
  ].join("\n");

  await setActiveTaskUploadSession(targetUser, 2770, "ทำบันทึกยอดสั่งข้าวโอที", "มายู");
  const resBotMsg = await sendTextMessageDetailed(targetUser, botMessage);
  console.log("Send BOT Message Result:", resBotMsg);

  console.log("SUCCESS! The message has been sent FROM THE BOT.");
}

run();
