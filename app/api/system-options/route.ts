import { NextResponse } from "next/server";
import { getSystemOptionsFromSupabase, isSupabaseConfigured } from "@/lib/supabase/supabase-db";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { FORM_SCHEMAS } from "@/lib/schemas";
import { ALL_STORE_CATEGORIES, ALL_CONTRACTOR_CATEGORIES, ALL_NEW_CATEGORIES } from "@/lib/cost-codes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let options: Record<string, string[]> = {};
    
    if (isSupabaseConfigured()) {
      const fromDb = await getSystemOptionsFromSupabase();
      if (fromDb && Object.keys(fromDb).length > 0) {
        options = fromDb;
      }
    }

    // Default schema options fallback if empty
    if (Object.keys(options).length === 0) {
      options = {
        "ประเภท (ผู้รับเหมา)": ALL_CONTRACTOR_CATEGORIES,
        "ประเภท (ร้านค้า)": ALL_STORE_CATEGORIES,
        "ประเภท (ร้านค้า+เลือกสินค้า)": ALL_STORE_CATEGORIES,
        "รายการประเภททั้งหมด": ALL_NEW_CATEGORIES,
        "ประเภทบิล": ["หลัก", "ย่อย"],
        "statusค่าแรง": ["บริษัท", "บุคคลธรรมดา"],
        "สถานะโครงการ": ["กำลังทำอยู่", "เสร็จสิ้นแล้ว", "เร่งด่วน"],
        "สิทธิ์การใช้งาน": ["Admin", "Manager", "User"],
      };
    }

    return NextResponse.json({ success: true, options });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

import { clearCache } from "@/lib/utils/cache";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { options } = body;

    if (!options || typeof options !== "object") {
      return NextResponse.json({ success: false, error: "Invalid options payload" }, { status: 400 });
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabaseAdmin
        .from("system_options")
        .upsert({
          id: "system_options",
          data: options,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error("Failed to save system_options to Supabase:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      clearCache("sys_opt:all_options");
      clearCache("sys_opt:all");
    }

    return NextResponse.json({ success: true, message: "บันทึกตัวเลือกระบบสำเร็จ" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

