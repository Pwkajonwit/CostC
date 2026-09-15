import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/supabase-db";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { uploadTableImage } from "@/lib/utils/drive";
import { clearCache } from "@/lib/utils/cache";
import type { CompanySettings } from "@/lib/types";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let settings: CompanySettings = { ...DEFAULT_COMPANY_SETTINGS };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "company_settings")
        .maybeSingle();

      if (!error && data && data.data) {
        settings = { ...DEFAULT_COMPANY_SETTINGS, ...data.data };
      }
    }

    return NextResponse.json(
      { success: true, settings },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: true, settings: DEFAULT_COMPANY_SETTINGS, warning: msg });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // 1. Handle File Upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("logoFile") as File | null;
      if (!file || file.size <= 0) {
        return NextResponse.json({ success: false, error: "ไม่พบไฟล์รูปภาพ" }, { status: 400 });
      }

      const uploadedUrl = await uploadTableImage(file, {
        tableName: "company",
        rowKey: "logo",
        columnName: "logoUrl"
      });

      if (!uploadedUrl) {
        return NextResponse.json({ success: false, error: "อัปโหลดไฟล์รูปภาพไม่สำเร็จ" }, { status: 500 });
      }

      // Read current settings and merge new logoUrl
      let currentSettings: CompanySettings = { ...DEFAULT_COMPANY_SETTINGS };
      if (isSupabaseConfigured()) {
        const { data } = await supabaseAdmin
          .from("system_options")
          .select("data")
          .eq("id", "company_settings")
          .maybeSingle();
        if (data && data.data) {
          currentSettings = { ...DEFAULT_COMPANY_SETTINGS, ...data.data };
        }
      }

      const mergedSettings: CompanySettings = {
        ...currentSettings,
        logoUrl: uploadedUrl,
      };

      // Immediately save merged settings into Supabase
      if (isSupabaseConfigured()) {
        const { error } = await supabaseAdmin
          .from("system_options")
          .upsert({
            id: "company_settings",
            data: mergedSettings,
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error("Failed to auto-save uploaded logo to Supabase:", error);
        } else {
          clearCache("sys_opt:");
          clearCache();
        }
      }

      return NextResponse.json({
        success: true,
        logoUrl: uploadedUrl,
        settings: mergedSettings,
        message: "อัปโหลดและบันทึกโลโก้สำเร็จเรียบร้อยแล้ว"
      });
    }

    // 2. Handle Standard JSON Settings Save
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ success: false, error: "ข้อมูลการตั้งค่าไม่ถูกต้อง" }, { status: 400 });
    }

    const logoUrl = String(settings.logoUrl || "").trim();

    const mergedSettings: CompanySettings = {
      companyName: String(settings.companyName || DEFAULT_COMPANY_SETTINGS.companyName).trim(),
      companySubTitle: String(settings.companySubTitle || DEFAULT_COMPANY_SETTINGS.companySubTitle).trim(),
      logoUrl,
      taxId: String(settings.taxId || "").trim(),
      address: String(settings.address || "").trim(),
      phone: String(settings.phone || "").trim(),
      email: String(settings.email || "").trim(),
    };

    if (isSupabaseConfigured()) {
      const { error } = await supabaseAdmin
        .from("system_options")
        .upsert({
          id: "company_settings",
          data: mergedSettings,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("Failed to save company_settings to Supabase:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      clearCache("sys_opt:");
      clearCache();
    }

    return NextResponse.json({
      success: true,
      message: "บันทึกข้อมูลบริษัทและโลโก้เรียบร้อยแล้ว",
      settings: mergedSettings,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
