import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTextMessageDetailed, sendFlexMessageDetailed, createMorningTasksCarouselFlex, getLineTargetIds } from "@/lib/line/line";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 0. Authorization check: Protect against unauthenticated public requests
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const cookieStore = await cookies();
    const isAuthedSession = Boolean(cookieStore.get("auth_employee_id")?.value);

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isAuthedSession) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid CRON_SECRET" }, { status: 401 });
    }

    // 1. Check custom target query parameter ?target=...
    const searchTarget = req.nextUrl.searchParams.get("target")?.trim();

    // 2. Fetch dynamic LINE config & Owner ID from Supabase
    const [{ data: configRow }, { ownerId }] = await Promise.all([
      supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "line_config")
        .maybeSingle(),
      getLineTargetIds()
    ]);

    const config = configRow?.data || {};
    const configuredTime = config.CRON_TIME_MORNING || "07:30";

    // Dynamic resolution of target LINE group & Owner User ID (Owner always receives daily schedule)
    const recipients = new Set<string>();
    if (searchTarget) {
      recipients.add(searchTarget);
    } else {
      if (config.LINE_GROUP_ID_TASK) recipients.add(config.LINE_GROUP_ID_TASK);
      if (config.LINE_GROUP_ID_PW) recipients.add(config.LINE_GROUP_ID_PW);
      if (ownerId) recipients.add(ownerId);
      if (config.LINE_USER_ID_OWN) recipients.add(config.LINE_USER_ID_OWN);
    }

    if (recipients.size === 0) {
      return NextResponse.json(
        { error: "ไม่พบรหัสปลายทาง! กรุณาระบุรหัสกลุ่มไลน์หรือผูก LINE User ID ของเจ้าของระบบ (Owner) ในเมนู 6. ชื่อพนักงาน" },
        { status: 400 }
      );
    }

    // 3. Fetch active tasks, works (PW) & pending bills from Supabase PostgreSQL
    const [tasksRes, worksRes, billsRes] = await Promise.all([
      supabaseAdmin.from("tasks").select("*").neq("status", "สำเร็จ").order("id", { ascending: false }).limit(15),
      supabaseAdmin.from("works").select("*").order("id", { ascending: false }).limit(10),
      supabaseAdmin.from("bills").select("*").or("status.eq.รออนุมัติ,status.eq.รอตรวจสอบ").limit(10)
    ]);

    const tasks = tasksRes.data || [];
    const works = worksRes.data || [];
    const bills = billsRes.data || [];

    const todayStr = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    const activeTasks = tasks.map(t => ({
      id: t.id,
      details: t.title || "งานประจำวัน",
      status: t.status || "กำลังทำ",
      project: t.assignee_name ? `ผู้รับ: ${t.assignee_name}` : "งานทั่วไป"
    }));

    const activeWorks = works.map(w => ({
      id: w.id,
      details: `${w.title || "งานรับเหมา"} (${w.status || "รอดูงาน"})`,
      contractor: w.contact1 || w.company || "-",
      project: w.team || "PW"
    }));

    const pendingBills = bills.map(b => ({
      id: b.id || b["ลำดับ"],
      requester: b["ผู้เบิก"] || b.requester || "-",
      amount: b["ยอดเงิน"] || b.amount || 0
    }));

    // Build 3-Tab Swipable Flex Carousel Card for LINE
    const flexCarousel = createMorningTasksCarouselFlex({
      dateStr: `${todayStr} (เวลาแจ้งเตือน ${configuredTime} น.)`,
      tasks: activeTasks,
      works: activeWorks,
      pendingBills
    });

    const results = [];
    for (const sendTo of recipients) {
      const res = await sendFlexMessageDetailed(
        sendTo,
        `☀️ รายงานสรุปงานเช้า Multi-Tab Carousel (${todayStr})`,
        flexCarousel
      );
      if (!res.success) {
        let textMsg = `☀️ รายงานสรุปงานเช้า (${todayStr} - ${configuredTime} น.)\n\n📋 งานค้างทั้งหมด ${activeTasks.length} รายการ:\n\n`;
        activeTasks.slice(0, 8).forEach((w, i) => {
          textMsg += `${i + 1}. [CW${w.id}] ${w.details}\n`;
        });
        const textRes = await sendTextMessageDetailed(sendTo, textMsg);
        results.push({ target: sendTo, success: textRes.success, fallbackText: true });
      } else {
        results.push({ target: sendTo, success: true });
      }
    }

    return NextResponse.json({
      success: true,
      count: recipients.size,
      recipients: Array.from(recipients),
      results,
      configuredTime,
      todayStr,
      activeCount: activeTasks.length,
      tabs: 3,
    });
  } catch (err: any) {
    console.error("❌ Cron daily tasks error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
