import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendFlexMessageDetailed, sendTextMessageDetailed, createEveningSummaryCarouselFlex, getLineTargetIds } from "@/lib/line/line";
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
    const configuredTime = config.CRON_TIME_EVENING || "17:00";

    // Dynamic resolution of target LINE group & Owner User ID (Owner always receives daily summary)
    const recipients = new Set<string>();
    if (searchTarget) {
      recipients.add(searchTarget);
    } else {
      if (config.LINE_GROUP_ID_SUMMARY) recipients.add(config.LINE_GROUP_ID_SUMMARY);
      if (config.LINE_GROUP_ID_FINANCE) recipients.add(config.LINE_GROUP_ID_FINANCE);
      if (ownerId) recipients.add(ownerId);
      if (config.LINE_USER_ID_OWN) recipients.add(config.LINE_USER_ID_OWN);
    }

    if (recipients.size === 0) {
      return NextResponse.json(
        { error: "ไม่พบรหัสปลายทาง! กรุณาระบุรหัสกลุ่มไลน์หรือผูก LINE User ID ของเจ้าของระบบ (Owner) ในเมนู 6. ชื่อพนักงาน" },
        { status: 400 }
      );
    }

    // 3. Fetch summary statistics from Supabase PostgreSQL (Bills, Tasks & Works)
    const [billsRes, tasksRes, worksRes] = await Promise.all([
      supabaseAdmin.from("bills").select("id, amount, status, data, created_at, paid_at, paid_date, approved_at"),
      supabaseAdmin.from("tasks").select("*"),
      supabaseAdmin.from("works").select("*")
    ]);

    const bills = billsRes.data || [];
    const tasks = tasksRes.data || [];
    const works = worksRes.data || [];

    // Bangkok timezone dates for today
    const nowBangkok = new Date();
    const todayYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(nowBangkok);
    const todayDmy = nowBangkok.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });

    // Filter today's bills (created, approved, or paid today)
    const todayBills = bills.filter(rawB => {
      const b = rawB as any;
      const d = (b.data && typeof b.data === "object") ? b.data : {};
      const dateField = String(b["ว/ด/ป"] || d["ว/ด/ป"] || b.paid_date || d.paid_date || b["วันจ่าย"] || d["วันจ่าย"] || "").trim();
      if (dateField && (dateField.startsWith(todayYmd) || dateField.includes(todayYmd) || (todayDmy && dateField.includes(todayDmy)))) {
        return true;
      }
      for (const isoField of [b.created_at, b.paid_at, b.approved_at]) {
        if (isoField) {
          try {
            const bkk = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(isoField));
            if (bkk === todayYmd) return true;
          } catch {}
        }
      }
      return false;
    });

    const totalBills = todayBills.length;
    const totalAmount = todayBills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
    const pendingCount = bills.filter((b) => b.status === "รอตรวจสอบ" || b.status === "รออนุมัติ" || b.status === "รอตั้งเบิก" || b.status === "ตั้งเบิก").length;
    const approvedCount = todayBills.filter((b) => b.status === "อนุมัติแล้ว" || b.status === "จ่ายแล้ว" || b.status === "เบิกแล้ว" || b.status === "อนุมัติ").length;

    const activeTasks = tasks.filter(t => t.status !== "สำเร็จ");
    const activeWorksCount = activeTasks.length;
    const completedWorksCount = tasks.filter(t => t.status === "สำเร็จ").length;

    const lateTasks = activeTasks.slice(0, 5).map(t => ({
      id: t.id,
      details: t.title || "งานค้าง",
      assignee: t.assignee_name || "ทีมงาน"
    }));

    const todayStr = new Date().toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    // Build 3-Tab Swipable Flex Carousel Card for LINE Evening Summary
    const flexCarousel = createEveningSummaryCarouselFlex({
      dateStr: `${todayStr} (${configuredTime} น.)`,
      totalBills,
      totalAmount,
      pendingCount,
      approvedCount,
      activeWorksCount,
      completedWorksCount,
      lateTasks
    });

    const results = [];
    for (const sendTo of recipients) {
      const res = await sendFlexMessageDetailed(
        sendTo,
        `📊 สรุปรายงานเย็น Multi-Tab Carousel (${todayStr})`,
        flexCarousel
      );
      if (!res.success) {
        let teamSummaryText = `📊 สรุปภาพรวมการเงิน & ผลงานทีม (${todayStr} - ${configuredTime} น.)\n\n`;
        teamSummaryText += `🧾 รายการบิล: ${totalBills} รายการ (รออนุมัติ: ${pendingCount}, อนุมัติแล้ว: ${approvedCount})\n`;
        teamSummaryText += `💰 ยอดเงินรวม: ฿${totalAmount.toLocaleString("th-TH")}\n`;
        teamSummaryText += `👷‍♂️ งานรับเหมา/PW: กำลังทำ ${activeWorksCount} รายการ, เสร็จแล้ว ${completedWorksCount} รายการ`;

        const textRes = await sendTextMessageDetailed(sendTo, teamSummaryText);
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
      summary: { dateStr: todayStr, totalBills, totalAmount, pendingCount, approvedCount, activeWorksCount, completedWorksCount },
      tabs: 3,
    });
  } catch (err: any) {
    console.error("❌ Cron daily summary error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
