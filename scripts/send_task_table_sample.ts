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

  console.log("Sending updated Task Flex Table with submit keyword to:", targetUser);
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
    subtitle: "รายการงาน (กดปุ่ม ส่ง เพื่อส่งคีย์เวิร์ดแนบไฟล์ผ่าน LINE)"
  });

  const res = await sendFlexMessageDetailed(targetUser, "ตารางงานของ มายู (รหัส 2770)", flex);
  console.log("Send Flex Result:", res);
}

run();
