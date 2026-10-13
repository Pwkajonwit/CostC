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

  console.log("Testing handleTaskCommands with command: ส่งงาน: 2770 ...");
  // When replyToken is empty or test string, replyTextMessage will fall back or we can verify session
  const cmd = "ส่งงาน: 2770";
  const handled = await handleTaskCommands(cmd, cmd.toLowerCase(), "", targetUser, targetUser);
  console.log("Handled result:", handled);

  // Check upload session
  const session = await getActiveTaskUploadSession([targetUser]);
  console.log("Active Upload Session for targetUser:", session);
}

run();
