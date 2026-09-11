import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { recordSystemErrorLog } from "@/lib/line/line";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "system_error_logs")
      .maybeSingle();

    const logs = data?.data?.logs || [];
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const source = body.source || "Dashboard Test";
    const message = body.message || "ทดสอบบันทึก System Error Log จากหน้าตั้งค่าระบบ";
    const level = body.level || "INFO";
    const context = body.context || { timestamp: new Date().toISOString() };

    await recordSystemErrorLog(source, message, level, context);

    return NextResponse.json({ success: true, message: "บันทึก Error Log ทดสอบเรียบร้อยแล้ว" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { error } = await supabaseAdmin
      .from("system_options")
      .upsert({
        id: "system_error_logs",
        data: { logs: [] },
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "ล้างประวัติ Error Logs สำเร็จ!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
