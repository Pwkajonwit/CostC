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
  const { supabaseAdmin } = await import("../lib/supabase/supabase-admin");
  const { data: attach } = await supabaseAdmin.from("system_options").select("data").eq("id", "task_attachments").maybeSingle();
  console.log("Task attachments:", JSON.stringify(attach, null, 2));

  const { data: tasks } = await supabaseAdmin.from("tasks").select("*").limit(10);
  console.log("Sample tasks:", JSON.stringify(tasks, null, 2));
}

run();
