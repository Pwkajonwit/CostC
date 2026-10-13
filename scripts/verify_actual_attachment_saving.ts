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
  const { getDynamicAccessToken } = await import("../lib/line/line");
  const { getActiveTaskUploadSession, appendTaskAttachmentImage, getTaskAttachment } = await import("../lib/tasks/task-attachments");
  const { uploadFileToSupabaseStorage } = await import("../lib/supabase/supabase-db");

  console.log("--- 1. Check Access Token ---");
  const token = await getDynamicAccessToken();
  console.log("Token exists:", Boolean(token), "Token length:", token ? token.length : 0);

  console.log("\n--- 2. Check Active Upload Session for", targetUser, "---");
  const session = await getActiveTaskUploadSession([targetUser]);
  console.log("Session:", session);

  if (!session) {
    console.error("No active session found for targetUser!");
    return;
  }

  console.log("\n--- 3. Test Uploading Dummy Image to Supabase Storage ---");
  // 1x1 transparent PNG buffer
  const sampleBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA",
    "base64"
  );
  const testFileName = `task_${session.taskId}_test_${Date.now()}.png`;
  const uploadedUrl = await uploadFileToSupabaseStorage("repairs", testFileName, sampleBuffer, "image/png");
  console.log("Uploaded Image URL:", uploadedUrl);

  console.log("\n--- 4. Test Appending Image to Task Attachments ---");
  const totalCount = await appendTaskAttachmentImage(session.taskId, uploadedUrl, session.assignee || "มายู");
  console.log("Total attachments count now:", totalCount);

  console.log("\n--- 5. Verify Attachments In Supabase ---");
  const savedAttachments = await getTaskAttachment(session.taskId);
  console.log("Saved Attachments for Task", session.taskId, ":", savedAttachments);
}

run();
