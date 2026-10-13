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
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: t } = await supabase.from("tasks").select("*").eq("id", 2770).maybeSingle();
  console.log("Existing task 2770:", t);

  if (!t) {
    const { data, error } = await supabase.from("tasks").upsert({
      id: 2770,
      title: "ทำบันทึกยอดสั่งข้าวโอที",
      assignee_name: "มายู",
      do_date: "2026-10-01",
      send_date: "2026-10-31",
      status: "ดำเนินการ",
      task_type: 1
    }).select().single();
    console.log("Upserted task 2770:", data, "error:", error);
  }
}

run();
