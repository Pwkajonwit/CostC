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
  const { sendTextMessageDetailed } = await import("../lib/line/line");
  const { setActiveTaskUploadSession } = await import("../lib/tasks/task-attachments");

  const msg = [
    "งานของ: มายู",
    "ลำดับ: 2770",
    "รายการ: ทำบันทึกยอดสั่งข้าวโอที",
    "ดู/ทำ: 01/10/2026",
    "ส่งงาน: 31/10/2026",
    "เอกสาร ,รูปถ่าย ด้านล่างนี้"
  ].join("\n");

  await setActiveTaskUploadSession(targetUser, 2770, "ทำบันทึกยอดสั่งข้าวโอที", "มายู");
  const res = await sendTextMessageDetailed(targetUser, msg);
  console.log("Send direct LINE message result:", res);
}

run();
