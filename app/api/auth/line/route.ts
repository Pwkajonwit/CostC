import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export const dynamic = "force-dynamic";

function normalizePhone(p?: string) {
  return String(p || "").replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, lineUserId, displayName, pictureUrl, phone } = body;

    if (!lineUserId) {
      return NextResponse.json({ success: false, error: "Missing LINE User ID" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // ==========================================
    // 1. ACTION: LOGIN WITH LINE USER ID
    // ==========================================
    if (action === "login") {
      const { data: member } = await supabaseAdmin
        .from("master_members")
        .select("*")
        .eq("line_user_id", lineUserId)
        .maybeSingle();

      if (!member) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      if (member.status === "Inactive") {
        return NextResponse.json({ success: false, error: "บัญชีนี้ถูกระงับการใช้งานชั่วคราว" }, { status: 403 });
      }

      // Update profile picture if updated on LINE
      if (pictureUrl && member.pictureurl !== pictureUrl) {
        await supabaseAdmin
          .from("master_members")
          .update({ pictureurl: pictureUrl })
          .eq("id", member.id);
      }

      const empId = member.id;
      const name = member.nickname || member.full_name || empId;
      const role = member.system_role || member.role || "User";
      const canDelete = Boolean(member.can_delete);
      const finalPic = pictureUrl || member.pictureurl || "";

      cookieStore.set("auth_employee_id", empId, { expires, path: "/" });
      cookieStore.set("auth_name", name, { expires, path: "/" });
      cookieStore.set("auth_role", role, { expires, path: "/" });
      cookieStore.set("auth_can_delete", String(canDelete), { expires, path: "/" });
      if (finalPic) cookieStore.set("auth_picture_url", finalPic, { expires, path: "/" });
      cookieStore.set("auth_line_user_id", lineUserId, { expires, path: "/" });

      return NextResponse.json({
        success: true,
        user: member,
        message: `ยินดีต้อนรับ ${name} เข้าสู่ระบบ`
      });
    }

    // ==========================================
    // 2. ACTION: REGISTER / ACCOUNT LINKING VIA PHONE
    // ==========================================
    if (action === "register") {
      if (!phone) {
        return NextResponse.json({ success: false, error: "กรุณาระบุเบอร์โทรศัพท์เพื่อยืนยันตัวตน" }, { status: 400 });
      }

      const inputPhoneClean = normalizePhone(phone);
      const rawInputTrimmed = String(phone).trim().toLowerCase();

      // Find if phone exists in master_members
      const { data: members } = await supabaseAdmin
        .from("master_members")
        .select("*");

      let matchedMember: any = null;

      if (members && Array.isArray(members)) {
        matchedMember = members.find((m: any) => {
          const mPhoneClean = normalizePhone(m.phone || m["เบอร์โทร"] || m["เบอร์โทรศัพท์"]);
          const mIdClean = String(m.id || m["รหัสพนักงาน"] || "").trim().toLowerCase();
          const mNicknameClean = String(m.nickname || m["ชื่อเล่น"] || "").trim().toLowerCase();
          const mFullNameClean = String(m.full_name || m["ชื่อ-นามสกุล"] || "").trim().toLowerCase();

          return (
            (inputPhoneClean && inputPhoneClean.length >= 8 && mPhoneClean && mPhoneClean === inputPhoneClean) ||
            mIdClean === rawInputTrimmed ||
            mNicknameClean === rawInputTrimmed ||
            mFullNameClean === rawInputTrimmed
          );
        });
      }

      if (matchedMember) {
        // Link with master_members
        const updatePayload: Record<string, any> = {
          line_user_id: lineUserId,
        };
        if (pictureUrl) updatePayload.pictureurl = pictureUrl;
        if (!matchedMember.phone && inputPhoneClean) updatePayload.phone = phone.trim();

        await supabaseAdmin
          .from("master_members")
          .update(updatePayload)
          .eq("id", matchedMember.id);

        const empId = matchedMember.id;
        const name = matchedMember.nickname || matchedMember.full_name || empId;
        const role = matchedMember.system_role || matchedMember.role || "User";
        const canDelete = Boolean(matchedMember.can_delete);
        const finalPic = pictureUrl || matchedMember.pictureurl || "";

        cookieStore.set("auth_employee_id", empId, { expires, path: "/" });
        cookieStore.set("auth_name", name, { expires, path: "/" });
        cookieStore.set("auth_role", role, { expires, path: "/" });
        cookieStore.set("auth_can_delete", String(canDelete), { expires, path: "/" });
        if (finalPic) cookieStore.set("auth_picture_url", finalPic, { expires, path: "/" });
        cookieStore.set("auth_line_user_id", lineUserId, { expires, path: "/" });

        return NextResponse.json({
          success: true,
          isLinked: true,
          user: matchedMember,
          message: `ผูกบัญชี LINE กับผู้ใช้งาน "${name}" สำเร็จ!`
        });
      }

      return NextResponse.json({
        success: false,
        error: `ไม่พบข้อมูลเบอร์โทรศัพท์ "${phone}" ในระบบ กรุณาตรวจสอบข้อมูลพนักงานหรือติดต่อผู้ดูแลระบบ`
      }, { status: 404 });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("LINE Auth Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to process LINE authentication" }, { status: 500 });
  }
}

