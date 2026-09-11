import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.LINE_LIFF_ID || "";

    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "line_config")
      .maybeSingle();

    const config = data?.data || {};

    if (config?.LINE_LIFF_ID) {
      const configLiffId = String(config.LINE_LIFF_ID).trim();
      if (configLiffId) {
        liffId = configLiffId;
      }
    }

    return NextResponse.json({ success: true, liffId, config });
  } catch (error: any) {
    return NextResponse.json({ success: false, liffId: "", config: {}, error: error?.message || "Failed to fetch LINE config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const config = body.config || body;

    if (!config || typeof config !== "object") {
      return NextResponse.json({ success: false, error: "Missing config object" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("system_options").upsert({
      id: "line_config",
      data: config,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "บันทึกการตั้งค่า LINE System เรียบร้อยแล้ว" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to update LINE config" }, { status: 500 });
  }
}
