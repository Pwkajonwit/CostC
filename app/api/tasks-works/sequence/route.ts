import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import {
  getNextTaskSequence,
  getNextWorkSequence,
  getSystemOptionsFromSupabase,
  isSupabaseConfigured
} from "@/lib/supabase/supabase-db";
import { clearCache } from "@/lib/utils/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [
      maxTaskRecord,
      countTaskResult,
      maxWorkRecord,
      countWorkResult,
      options
    ] = await Promise.all([
      supabaseAdmin.from("tasks").select("id").order("id", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("works").select("id").order("id", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("works").select("id", { count: "exact", head: true }),
      getSystemOptionsFromSupabase().catch(() => ({} as Record<string, any>))
    ]);

    const maxTaskId = Number(maxTaskRecord?.data?.id || 0);
    const totalTasks = countTaskResult.count || 0;
    const configuredTaskStart = Number(
      (options as any)?.["task_start_sequence"] ||
      (options as any)?.["ลำดับงานเริ่มต้น"] ||
      1
    );
    const nextTaskSequence = await getNextTaskSequence(configuredTaskStart);

    const maxWorkId = Number(maxWorkRecord?.data?.id || 0);
    const totalWorks = countWorkResult.count || 0;
    const configuredWorkStart = Number(
      (options as any)?.["work_start_sequence"] ||
      (options as any)?.["ลำดับงานรับเหมาเริ่มต้น"] ||
      1
    );
    const nextWorkSequence = await getNextWorkSequence(configuredWorkStart);

    return NextResponse.json({
      success: true,
      tasks: {
        total: totalTasks,
        maxId: maxTaskId,
        configuredStart: configuredTaskStart,
        nextSequence: nextTaskSequence
      },
      works: {
        total: totalWorks,
        maxId: maxWorkId,
        configuredStart: configuredWorkStart,
        nextSequence: nextWorkSequence
      }
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, taskStartSequence, workStartSequence } = body;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: "Supabase is not configured" }, { status: 500 });
    }

    const { data: currentOptRow } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "system_options")
      .maybeSingle();

    const currentData = (currentOptRow?.data && typeof currentOptRow.data === "object") ? { ...currentOptRow.data } : {};

    let updatedTasks = false;
    let updatedWorks = false;

    if (taskStartSequence !== undefined && taskStartSequence !== null) {
      const taskSeqNum = Number(taskStartSequence);
      if (!Number.isFinite(taskSeqNum) || taskSeqNum < 1) {
        return NextResponse.json({ success: false, error: "เลขเริ่มต้น Task ต้องเป็นตัวเลขมากกว่า 0" }, { status: 400 });
      }
      currentData["task_start_sequence"] = taskSeqNum;
      currentData["ลำดับงานเริ่มต้น"] = taskSeqNum;
      updatedTasks = true;
    }

    if (workStartSequence !== undefined && workStartSequence !== null) {
      const workSeqNum = Number(workStartSequence);
      if (!Number.isFinite(workSeqNum) || workSeqNum < 1) {
        return NextResponse.json({ success: false, error: "เลขเริ่มต้น Work ต้องเป็นตัวเลขมากกว่า 0" }, { status: 400 });
      }
      currentData["work_start_sequence"] = workSeqNum;
      currentData["ลำดับงานรับเหมาเริ่มต้น"] = workSeqNum;
      updatedWorks = true;
    }

    await supabaseAdmin
      .from("system_options")
      .upsert({
        id: "system_options",
        data: currentData,
        updated_at: new Date().toISOString()
      });

    clearCache();

    const nextTask = await getNextTaskSequence();
    const nextWork = await getNextWorkSequence();

    return NextResponse.json({
      success: true,
      message: "บันทึกการตั้งค่าเลขเริ่มต้นเรียบร้อยแล้ว",
      updatedTasks,
      updatedWorks,
      nextTaskSequence: nextTask,
      nextWorkSequence: nextWork
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
