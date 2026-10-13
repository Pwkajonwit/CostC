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
} catch (e) {
  console.error("Failed to read .env.local", e);
}

async function run() {
  const targetUser = "U8d286780c70cf7d60a0ff5704dcf2319";
  console.log(`Sending Task Flex examples to: ${targetUser}`);

  const { createClient } = await import("@supabase/supabase-js");
  const {
    createMemberTaskTableFlex,
    createTaskDetailFlex,
    createOpenTaskFormFlex,
  } = await import("../lib/line/line-tasks-works");
  const { sendFlexMessageDetailed } = await import("../lib/line/line");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { getAllTaskAttachments } = await import("../lib/tasks/task-attachments");
  const allAttachments = await getAllTaskAttachments();

  // Fetch recent tasks from db
  const { data: dbTasks } = await supabase
    .from("tasks")
    .select("*")
    .order("id", { ascending: false })
    .limit(6);

  const sampleTasks = (dbTasks && dbTasks.length > 0)
    ? dbTasks.map(t => {
        const att = allAttachments[String(t.id)];
        return {
          id: t.id,
          title: t.title || "งานประจำวัน",
          details: t.title || "งานประจำวัน",
          assignee_name: t.assignee_name || "ทดสอบ",
          project: att?.project || t.project || "โครงการเดอะพาร์ค (อาคาร B)",
          status: t.status || "ดำเนินการ",
          do_date: t.do_date,
          send_date: t.send_date,
          task_type: t.task_type || 1,
          images: att?.images || []
        };
      })
    : [
        {
          id: 101,
          title: "ตรวจสอบแบบแปลนโครงสร้าง อาคาร B",
          details: "ตรวจสอบแบบแปลนโครงสร้าง อาคาร B",
          assignee_name: "ทดสอบ",
          status: "กำลังดำเนินการ",
          do_date: new Date().toISOString().split("T")[0],
          project: "โครงการเดอะพาร์ค"
        },
        {
          id: 102,
          title: "จัดทำเอกสารส่งมอบงานงวดที่ 2",
          details: "จัดทำเอกสารส่งมอบงานงวดที่ 2",
          assignee_name: "ทดสอบ",
          status: "รอดำเนินการ",
          do_date: new Date().toISOString().split("T")[0],
          project: "สำนักงานใหญ่"
        }
      ];

  // 1. Task Timeline Table Flex (ตารางงาน 4 วัน พร้อมปุ่ม + เปิดงานใหม่ ผ่าน LIFF)
  console.log("1. Generating Task Timeline Table Flex...");
  const tableFlex = createMemberTaskTableFlex("ทดสอบ", sampleTasks, {
    subtitle: `รายการงานประจำวัน (รวม ${sampleTasks.length} งาน)`
  });
  const res1 = await sendFlexMessageDetailed(targetUser, "ตารางสรุปงาน Task", tableFlex);
  console.log("Table Flex Send Result:", res1);

  // 2. Single Task Detail Card (การ์ดงานเดี่ยว พร้อมปุ่ม แนบรูป/งาน, ส่งงาน, ปิดงาน ผ่าน LIFF)
  console.log("2. Generating Single Task Detail Card...");
  const singleTask = sampleTasks[0];
  const singleFlex = createTaskDetailFlex({
    task: singleTask,
    attachments: {
      images: [],
      note: "งานด่วน เร่งส่งมอบงาน",
      submittedBy: singleTask.assignee_name || "ทดสอบ",
      submittedAt: new Date().toISOString()
    }
  });
  const res2 = await sendFlexMessageDetailed(targetUser, `รายละเอียดงาน #${singleTask.id}`, singleFlex);
  console.log("Single Task Card Send Result:", res2);

  // 3. Open Task Form Flex (การ์ดเชิญชวนเปิดงาน Task ผ่าน LIFF)
  console.log("3. Generating Open Task Form Flex...");
  const openTaskFlex = createOpenTaskFormFlex();
  const res3 = await sendFlexMessageDetailed(targetUser, "แบบฟอร์มเปิดงาน Task", openTaskFlex);
  console.log("Open Task Form Flex Send Result:", res3);

  console.log("All Task Flex examples sent successfully!");
}

run().catch(console.error);
