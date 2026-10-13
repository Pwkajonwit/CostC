import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getAllTaskAttachments } from "@/lib/tasks/task-attachments";
import { clearCache } from "@/lib/utils/cache";

export const dynamic = "force-dynamic";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function formatThaiMonth(dateStr?: string): { label: string; key: string; yearThai: number; monthIndex: number } {
  if (!dateStr) {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const thaiYear = y + 543;
    return {
      label: `${THAI_MONTHS[m]} ${thaiYear} (${y})`,
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      yearThai: thaiYear,
      monthIndex: m,
    };
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return { label: "ไม่ระบุเดือน", key: "unknown", yearThai: 0, monthIndex: -1 };
    }
    const m = d.getMonth();
    const y = d.getFullYear();
    const thaiYear = y + 543;
    return {
      label: `${THAI_MONTHS[m]} ${thaiYear} (${y})`,
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      yearThai: thaiYear,
      monthIndex: m,
    };
  } catch {
    return { label: "ไม่ระบุเดือน", key: "unknown", yearThai: 0, monthIndex: -1 };
  }
}

// Default category scoring configuration aligned with official types:
// 1. เอกสาร, 2. แผนงาน, 3. PJSA (ไม่มี PW)
const DEFAULT_SCORING_CONFIG = {
  categories: [
    {
      id: "type_1",
      taskType: 1,
      name: "1. เอกสาร",
      color: "blue",
      basePoints: 20,
      description: "งานเอกสาร, สัญญา, รายงานประจำวัน, ใบสำคัญ",
      keywords: ["เอกสาร", "สัญญา", "ใบสำคัญ", "รายงาน"],
    },
    {
      id: "type_2",
      taskType: 2,
      name: "2. แผนงาน",
      color: "emerald",
      basePoints: 25,
      description: "งานแผนงาน, ตารางเวลาดำเนินงาน, แผนก่อสร้าง",
      keywords: ["แผนงาน", "ตารางเวลา", "แผน", "plan"],
    },
    {
      id: "type_3",
      taskType: 3,
      name: "3. PJSA",
      color: "purple",
      basePoints: 30,
      description: "งาน PJSA, วิเคราะห์ความปลอดภัย, ตรวจสอบมาตรฐานหน้างาน",
      keywords: ["pjsa", "ความปลอดภัย", "ตรวจสอบ"],
    },
  ],
  onTimeBonus: 5,           // โบนัสส่งงานตรงเวลา / ก่อนกำหนด
  latePenalty: 5,           // หักคะแนนหากส่งงานเกินกำหนด
  hasAttachmentsBonus: 2,   // โบนัสมีรูปแนบหลักฐาน
};

// Match task to official or dynamic category types
function detectCategory(
  taskTitle: string,
  explicitCategory: string | undefined,
  taskType: number | string | undefined,
  categories: typeof DEFAULT_SCORING_CONFIG.categories
) {
  const typeNum = Number(taskType);
  const typeStr = String(taskType || "").trim();

  // 1. Direct match by taskType number
  if (typeNum) {
    const match = categories.find((c: any) => Number(c.taskType) === typeNum);
    if (match) return match;
  }

  // 2. Direct match by explicitCategory
  if (explicitCategory) {
    const cleanExp = explicitCategory.trim().toLowerCase();
    const match = categories.find((c: any) => {
      const cName = String(c.name || "").toLowerCase();
      return cleanExp.includes(cName) || cName.includes(cleanExp);
    });
    if (match) return match;
  }

  // 3. Match by name or keywords against taskTitle
  const titleUpper = (taskTitle || "").toUpperCase();
  for (const cat of categories as any[]) {
    const cName = String(cat.name || "").toUpperCase();
    const pureName = cName.replace(/^\d+[\.\s\)]*/, "").trim();
    if (pureName && titleUpper.includes(pureName)) {
      return cat;
    }
    if (Array.isArray(cat.keywords)) {
      for (const kw of cat.keywords) {
        const kwStr = String(kw || "").trim().toUpperCase();
        if (kwStr && titleUpper.includes(kwStr)) {
          return cat;
        }
      }
    }
  }

  // Default to 1. เอกสาร or first category
  return categories.find((c: any) => c.taskType === 1) || categories[0];
}

// Check timing: is task on time, late, or indeterminate
function checkDeliveryTiming(doDateStr?: string, sendDateStr?: string, submittedAtStr?: string): {
  isCompleted: boolean;
  isOnTime: boolean;
  isLate: boolean;
  timingNote: string;
} {
  if (!sendDateStr && !submittedAtStr) {
    return { isCompleted: false, isOnTime: false, isLate: false, timingNote: "ยังไม่กำหนดส่ง" };
  }

  const deadline = sendDateStr ? new Date(sendDateStr) : null;
  const actualDone = submittedAtStr ? new Date(submittedAtStr) : doDateStr ? new Date(doDateStr) : null;

  if (deadline && !isNaN(deadline.getTime()) && actualDone && !isNaN(actualDone.getTime())) {
    // Compare dates (day granularity)
    const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime();
    const actualDay = new Date(actualDone.getFullYear(), actualDone.getMonth(), actualDone.getDate()).getTime();

    if (actualDay <= deadlineDay) {
      return { isCompleted: true, isOnTime: true, isLate: false, timingNote: "ส่งงานตรงเวลา" };
    } else {
      const daysLate = Math.round((actualDay - deadlineDay) / (1000 * 60 * 60 * 24));
      return { isCompleted: true, isOnTime: false, isLate: true, timingNote: `ส่งช้ากว่ากำหนด ${daysLate} วัน` };
    }
  }

  return { isCompleted: false, isOnTime: true, isLate: false, timingNote: "ส่งงานตามกำหนด" };
}

// Calculate grade based on score and completion percentage
function computeGrade(score: number, completionRate: number): { grade: "S" | "A" | "B" | "C"; label: string; color: string } {
  if (completionRate >= 90 && score >= 100) {
    return { grade: "S", label: "ยอดเยี่ยม (S)", color: "emerald" };
  }
  if (completionRate >= 75 || score >= 70) {
    return { grade: "A", label: "ดีมาก (A)", color: "sky" };
  }
  if (completionRate >= 50 || score >= 40) {
    return { grade: "B", label: "มาตรฐาน (B)", color: "amber" };
  }
  return { grade: "C", label: "ต้องปรับปรุง (C)", color: "rose" };
}

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch Scoring Rules from system_options
    const { data: scoreOption } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "task_category_scores")
      .maybeSingle();

    let scoringRules = (scoreOption?.data as typeof DEFAULT_SCORING_CONFIG) || DEFAULT_SCORING_CONFIG;
    if (scoringRules?.categories) {
      scoringRules.categories = scoringRules.categories
        .filter((c: any) => !String(c.name || "").includes("งาน PW"))
        .map((c: any) => ({
          ...c,
          keywords: Array.isArray(c.keywords) ? c.keywords : [],
          description: c.description || "",
        }));
      if (scoringRules.categories.length === 0) {
        scoringRules = DEFAULT_SCORING_CONFIG;
      }
    }

    // 2. Fetch Tasks and Attachments
    const { data: rawTasks } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .order("id", { ascending: false });

    const taskAttachments = await getAllTaskAttachments();

    // 3. Assemble and Score each Task (Only Tasks 1, 2, 3 - No PW)
    const processedTasks: any[] = [];
    const monthlyGroups: Record<string, {
      monthKey: string;
      monthLabel: string;
      tasks: any[];
      contractorMap: Record<string, any>;
      stats: {
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        onTimeTasks: number;
        lateTasks: number;
        totalPoints: number;
        avgPoints: number;
        completionRate: number;
        onTimeRate: number;
      };
    }> = {};

    // Process Tasks
    if (rawTasks && rawTasks.length > 0) {
      for (const t of rawTasks) {
        const taskIdStr = String(t.id);
        const attach = taskAttachments[taskIdStr];
        const imgs = Array.isArray(attach?.images) ? attach.images.filter(Boolean) : [];
        if (t.image_url && !imgs.includes(t.image_url)) imgs.push(t.image_url);

        const contractor = (t.assignee_name || attach?.submittedBy || t.data?.assignee || "ไม่ระบุผู้รับเหมา").trim();
        const project = (
          attach?.project ||
          t.data?.project ||
          t.data?.project_name ||
          t.data?.Project ||
          "โครงการทั่วไป"
        ).trim();

        const dateRef = t.send_date || t.do_date || attach?.submittedAt || t.created_at;
        const monthInfo = formatThaiMonth(dateRef);

        const explicitCategory = t.data?.category || t.data?.ประเภทงาน || t.data?.ประเภท;
        const category = detectCategory(t.title || "", explicitCategory, t.task_type, scoringRules.categories);

        // Status
        const isDone = t.status === "สำเร็จ" || t.status === "เสร็จ" || t.status === "ส่งงานแล้ว";
        const timing = checkDeliveryTiming(t.do_date, t.send_date, attach?.submittedAt);

        // Calculate Score Points
        let earnedPoints = 0;
        let bonusPoints = 0;
        let penaltyPoints = 0;

        if (isDone) {
          earnedPoints += category.basePoints;
          if (timing.isOnTime) {
            bonusPoints += scoringRules.onTimeBonus;
          } else if (timing.isLate) {
            penaltyPoints += scoringRules.latePenalty;
          }
          if (imgs.length > 0) {
            bonusPoints += scoringRules.hasAttachmentsBonus;
          }
          earnedPoints = Math.max(0, earnedPoints + bonusPoints - penaltyPoints);
        }

        const taskObj = {
          id: `task_${t.id}`,
          rawId: t.id,
          sourceType: "task",
          title: t.title || `งาน #${t.id}`,
          displayTitle: `[#${t.id}] ${t.title || "งานทั่วไป"}`,
          contractor,
          project,
          monthKey: monthInfo.key,
          monthLabel: monthInfo.label,
          status: t.status || "ดำเนินการ",
          isDone,
          doDate: t.do_date,
          sendDate: t.send_date,
          submittedAt: attach?.submittedAt,
          category: {
            id: category.id,
            name: category.name,
            basePoints: category.basePoints,
          },
          timing,
          points: {
            earned: earnedPoints,
            base: category.basePoints,
            bonus: bonusPoints,
            penalty: penaltyPoints,
          },
          filesCount: imgs.length,
          files: imgs,
          note: attach?.note || t.data?.note || "",
        };

        processedTasks.push(taskObj);

        // Add to monthly group
        if (!monthlyGroups[monthInfo.key]) {
          monthlyGroups[monthInfo.key] = {
            monthKey: monthInfo.key,
            monthLabel: monthInfo.label,
            tasks: [],
            contractorMap: {},
            stats: {
              totalTasks: 0,
              completedTasks: 0,
              pendingTasks: 0,
              onTimeTasks: 0,
              lateTasks: 0,
              totalPoints: 0,
              avgPoints: 0,
              completionRate: 0,
              onTimeRate: 0,
            },
          };
        }

        const mGroup = monthlyGroups[monthInfo.key];
        mGroup.tasks.push(taskObj);
        mGroup.stats.totalTasks++;
        if (isDone) {
          mGroup.stats.completedTasks++;
          mGroup.stats.totalPoints += earnedPoints;
          if (timing.isOnTime) mGroup.stats.onTimeTasks++;
          if (timing.isLate) mGroup.stats.lateTasks++;
        } else {
          mGroup.stats.pendingTasks++;
        }

        // Add to contractor map inside month
        if (!mGroup.contractorMap[contractor]) {
          mGroup.contractorMap[contractor] = {
            contractor,
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            onTimeTasks: 0,
            lateTasks: 0,
            totalPoints: 0,
            categoryStats: {},
            tasks: [],
          };
        }

        const cStat = mGroup.contractorMap[contractor];
        cStat.totalTasks++;
        cStat.tasks.push(taskObj);
        if (isDone) {
          cStat.completedTasks++;
          cStat.totalPoints += earnedPoints;
          if (timing.isOnTime) cStat.onTimeTasks++;
          if (timing.isLate) cStat.lateTasks++;
        } else {
          cStat.pendingTasks++;
        }

        if (!cStat.categoryStats[category.name]) {
          cStat.categoryStats[category.name] = { count: 0, points: 0 };
        }
        cStat.categoryStats[category.name].count++;
        cStat.categoryStats[category.name].points += earnedPoints;
      }
    }

    // 4. Compute rates and sort contractors inside each month
    const monthsResult = Object.values(monthlyGroups)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .map((m) => {
        const stats = m.stats;
        stats.completionRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
        stats.onTimeRate = stats.completedTasks > 0 ? Math.round((stats.onTimeTasks / stats.completedTasks) * 100) : 0;
        stats.avgPoints = stats.completedTasks > 0 ? Math.round(stats.totalPoints / stats.completedTasks) : 0;

        // Sort contractors by totalPoints descending
        const contractors = Object.values(m.contractorMap)
          .sort((a: any, b: any) => b.totalPoints - a.totalPoints)
          .map((c: any, idx: number) => {
            const cCompletionRate = c.totalTasks > 0 ? Math.round((c.completedTasks / c.totalTasks) * 100) : 0;
            const cOnTimeRate = c.completedTasks > 0 ? Math.round((c.onTimeTasks / c.completedTasks) * 100) : 0;
            const gradeInfo = computeGrade(c.totalPoints, cCompletionRate);

            return {
              rank: idx + 1,
              contractor: c.contractor,
              totalTasks: c.totalTasks,
              completedTasks: c.completedTasks,
              pendingTasks: c.pendingTasks,
              onTimeTasks: c.onTimeTasks,
              lateTasks: c.lateTasks,
              totalPoints: c.totalPoints,
              completionRate: cCompletionRate,
              onTimeRate: cOnTimeRate,
              grade: gradeInfo.grade,
              gradeLabel: gradeInfo.label,
              gradeColor: gradeInfo.color,
              categoryStats: c.categoryStats,
            };
          });

        return {
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          stats,
          contractors,
          tasksCount: m.tasks.length,
        };
      });

    return NextResponse.json({
      success: true,
      scoringRules,
      months: monthsResult,
      allTasks: processedTasks,
    });
  } catch (err: any) {
    console.error("Task performance API GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scoringRules } = body;

    if (!scoringRules || !Array.isArray(scoringRules.categories)) {
      return NextResponse.json({ success: false, error: "ข้อมูลเกณฑ์คะแนนไม่ถูกต้อง" }, { status: 400 });
    }

    // Sanitize categories to ensure taskType is present
    const sanitizedCategories = scoringRules.categories.map((c: any, idx: number) => {
      const numMatch = String(c.name || "").match(/^(\d+)[\.\s\)]*/);
      const taskType = Number(c.taskType) || (numMatch ? parseInt(numMatch[1], 10) : idx + 1);
      return {
        ...c,
        taskType
      };
    });
    scoringRules.categories = sanitizedCategories;

    // Save into system_options
    const { error } = await supabaseAdmin
      .from("system_options")
      .upsert({
        id: "task_category_scores",
        data: scoringRules,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw error;
    }

    clearCache("task_categories");

    return NextResponse.json({
      success: true,
      message: "บันทึกเกณฑ์คะแนนตามประเภทงานเรียบร้อยแล้ว",
      scoringRules,
    });
  } catch (err: any) {
    console.error("Task performance API POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
