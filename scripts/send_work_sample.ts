import fs from "fs";

// Load .env.local synchronously before any dynamic imports
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
  console.log("Loaded .env.local successfully. Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "OK" : "Missing");
} catch (e) {
  console.error("Failed to read .env.local", e);
}

async function run() {
  const targetUser = "U8d286780c70cf7d60a0ff5704dcf2319";
  console.log(`Sending Work Flex examples to: ${targetUser}`);

  // Dynamic import so environment variables are already populated
  const { createClient } = await import("@supabase/supabase-js");
  const { createWorkAssignmentFlex, createWorkSummaryFlex } = await import("../lib/line/line-tasks-works");
  const { sendFlexMessageDetailed } = await import("../lib/line/line");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch recent work from db if available
  const { data: dbWorks } = await supabase
    .from("works")
    .select("*")
    .order("id", { ascending: false })
    .limit(8);

  // Sample works showcasing different teams and all 4 pipeline stages
  const worksForSummary = [
    {
      id: 5,
      title: "งานซ่อมติดตั้งระบบท่อ",
      team: "PW2",
      activity_type: "รอเสนอ",
      status: "รอเสนอ",
      location: "โรงงาน est",
      company: "tes",
      contact1: "0623733306",
      date_inspect: "06/10/26 เวลา 10:00 น"
    },
    {
      id: 7,
      title: "งานประชุมวางระบบไฟฟ้า",
      team: "PW1",
      activity_type: "ประชุม",
      status: "ประชุม",
      location: "ไซต์งาน A",
      company: "SCG",
      contact1: "Tets",
      date_inspect: "07/10/26 เวลา 10:00 น"
    },
    {
      id: 8,
      title: "งานซ่อมบำรุงโครงสร้างหลังคา",
      team: "PW3",
      activity_type: "รอดูงาน",
      status: "รอดูงาน",
      location: "คลังสินค้า B",
      company: "CPAC",
      contact1: "สมชาย",
      date_inspect: "08/10/26 เวลา 13:30 น"
    },
    {
      id: 9,
      title: "งานประมูลโครงการปรับปรุงอาคาร",
      team: "PW4",
      activity_type: "ประมูล",
      status: "ประมูล",
      location: "อาคาร 2",
      company: "Insee",
      contact1: "วิชัย",
      date_inspect: "09/10/26 เวลา 09:00 น"
    }
  ];

  console.log("1. Generating Work Summary Flex (Style 1 with Team Badges)...");
  const summaryFlex = createWorkSummaryFlex(worksForSummary);

  const res1 = await sendFlexMessageDetailed(
    targetUser,
    `[รายการงานรับเหมา (ทุกทีม)] ตัวอย่างแบบที่ 1 พร้อมป้ายทีม`,
    summaryFlex
  );
  console.log("Summary Flex Send Result:", res1);

  console.log("2. Generating Single Work Flex Card...");
  const singleWorkFlex = createWorkAssignmentFlex({
    id: "PW-5",
    title: "งานซ่อมติดตั้งระบบท่อ",
    team: "PW2",
    activity_type: "รอดูงาน",
    status: "รอดูงาน",
    is_update: true,
    location: "โรงงาน est",
    company: "tes",
    pr_no: "PR-2026-001",
    date_inspect: "06/10/26 เวลา 10:00",
    date_propose: "08/10/26",
    contractor_name: "ช่างสมศักดิ์",
    phone: "086-1983352",
    creator: "คุณฮัน",
    creator_phone: "081-2345678"
  });

  const res2 = await sendFlexMessageDetailed(
    targetUser,
    `[ใบงานรับเหมา: PW-5] ตัวอย่างป้ายครบถ้วน + ปุ่มปิด`,
    singleWorkFlex
  );
  console.log("Single Work Flex Send Result:", res2);

  return { res1, res2 };
}

run()
  .then((res) => {
    console.log("Done!", JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
