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

    // 1. Check custom target query parameter ?target=... & force flag
    const searchTarget = req.nextUrl.searchParams.get("target")?.trim();
    const isForce = req.nextUrl.searchParams.get("force") === "true";

    // Bangkok timezone date
    const nowBangkok = new Date();
    const todayYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(nowBangkok);

    // 2. Fetch dynamic LINE config & Owner ID & last sent record from Supabase
    const [{ data: configRow }, { ownerId }, { data: lastSentRow }] = await Promise.all([
      supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "line_config")
        .maybeSingle(),
      getLineTargetIds(),
      supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "cron_last_sent")
        .maybeSingle()
    ]);

    const lastSentData = (lastSentRow?.data && typeof lastSentRow.data === "object") ? lastSentRow.data : {};

    // 🔒 Idempotency Guard: Prevent duplicate morning notifications on the same day
    if (!isForce && !searchTarget && lastSentData.daily_tasks_date === todayYmd) {
      const alreadySentTime = lastSentData.daily_tasks_time || "ช่วงเช้า";
      console.log(`[Cron daily-tasks] Already sent today (${todayYmd}) at ${alreadySentTime}. Skipping to prevent duplicate.`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: `ระบบได้ทำการส่งแจ้งเตือนสรุปงานเช้าของวันนี้ (${todayYmd}) เรียบร้อยแล้วเมื่อเวลา ${alreadySentTime} (ระบบป้องกันการส่งซ้ำอัตโนมัติ)`,
        alreadySentAt: lastSentData.daily_tasks_at
      });
    }

    const config = configRow?.data || {};
    const configuredTime = config.CRON_TIME_MORNING || "07:30";

    // Dynamic resolution of target LINE group & Owner User ID (Owner always receives daily schedule)
    const recipients = new Set<string>();
    if (searchTarget) {
      recipients.add(searchTarget);
    } else {
      if (config.LINE_GROUP_ID_TASK) recipients.add(String(config.LINE_GROUP_ID_TASK).trim());
      if (config.LINE_GROUP_ID_PW) recipients.add(String(config.LINE_GROUP_ID_PW).trim());
      if (ownerId) recipients.add(String(ownerId).trim());
      if (config.LINE_USER_ID_OWN) recipients.add(String(config.LINE_USER_ID_OWN).trim());
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

    const todayStr = nowBangkok.toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
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

    // Send in parallel to all recipients for fast non-blocking delivery
    const results = await Promise.all(
      Array.from(recipients).map(async sendTo => {
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
          return { target: sendTo, success: textRes.success, fallbackText: true };
        }
        return { target: sendTo, success: true };
      })
    );

    // 💾 Record that today's morning alert has been sent successfully (Prevents duplicates)
    const hasSuccessfulSend = results.some(r => r.success);
    if (hasSuccessfulSend && !searchTarget) {
      const nowTimeStr = nowBangkok.toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit"
      });
      try {
        await supabaseAdmin.from("system_options").upsert({
          id: "cron_last_sent",
          data: {
            ...lastSentData,
            daily_tasks_date: todayYmd,
            daily_tasks_at: nowBangkok.toISOString(),
            daily_tasks_time: nowTimeStr,
          },
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Failed recording cron_last_sent:", err);
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
