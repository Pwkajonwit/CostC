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
  const { data, error } = await supabaseAdmin.from("tasks").select("*").eq("id", 7).maybeSingle();
  console.log("Task 7 in DB:", JSON.stringify(data, null, 2));
}

run();
