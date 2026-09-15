import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export const dynamic = "force-dynamic";

function normalizePhone(p?: string) {
  return String(p || "").replace(/\D/g, "");
}

async function findMatchingMember(input: string) {
  const rawInput = String(input || "").trim();
  if (!rawInput) return null;

  const cleanPhone = normalizePhone(rawInput);
  const rawLower = rawInput.toLowerCase();

  // Fetch all members from master_members
  const { data: members, error } = await supabaseAdmin
    .from("master_members")
    .select("*");

  if (error || !members || !Array.isArray(members)) {
    console.warn("findMatchingMember master_members query failed:", error?.message);
    return null;
  }

  // 1. First priority: match by clean phone digits (handles dashes, spaces, +66, leading zeros)
  if (cleanPhone.length >= 8) {
    const matchedByPhone = members.find((m: any) => {
      const mRawPhone = String(m.phone || m["เบอร์โทร"] || m["เบอร์โทรศัพท์"] || m.data?.phone || m.data?.["เบอร์โทร"] || "");
      const mClean = normalizePhone(mRawPhone);
      if (!mClean || mClean.length < 8) return false;

      // Exact match of digits (e.g. "0933019874" === "0933019874")
      if (mClean === cleanPhone) return true;

      // Match without leading zeros (e.g. "933019874" === "933019874")
      if (mClean.replace(/^0+/, "") === cleanPhone.replace(/^0+/, "")) return true;

      // Match international +66 format
      const mNo66 = mClean.startsWith("66") ? "0" + mClean.slice(2) : mClean;
      const inputNo66 = cleanPhone.startsWith("66") ? "0" + cleanPhone.slice(2) : cleanPhone;
      if (mNo66 === inputNo66) return true;

      return false;
    });

    if (matchedByPhone) return matchedByPhone;
  }

  // 2. Second priority: match by Employee ID, Nickname, or Full Name
  const matchedByIdOrName = members.find((m: any) => {
    const mId = String(m.id || m["รหัสพนักงาน"] || "").trim().toLowerCase();
    const mNickname = String(m.nickname || m["ชื่อเล่น"] || "").trim().toLowerCase();
    const mFullName = String(m.full_name || m["ชื่อ-นามสกุล"] || "").trim().toLowerCase();

    if (mId && mId === rawLower) return true;
    if (mNickname && mNickname === rawLower) return true;
    if (mFullName && mFullName === rawLower) return true;
    if (mFullName && rawLower.length >= 3 && mFullName.includes(rawLower)) return true;

    return false;
  });

  return matchedByIdOrName || null;
}

function parseMemberPermissions(member: any) {
  const d = (member.data && typeof member.data === "object") ? member.data : {};
  const isOwner = (member.is_owner !== undefined && member.is_owner !== null)
    ? Boolean(member.is_owner)
    : Boolean(d.is_owner || d["เจ้าของระบบ"] || member["เจ้าของระบบ"] || member.role === "Owner" || member.system_role === "Owner");

  const canCloseBill = (member.can_close_bill !== undefined && member.can_close_bill !== null)
    ? Boolean(member.can_close_bill)
    : Boolean(d.can_close_bill || d["อนุมัติบิล"] || member["อนุมัติบิล"]);

  const canApprove = (member.can_approve !== undefined && member.can_approve !== null)
    ? Boolean(member.can_approve)
    : Boolean(d.can_approve || d["ฝ่ายการเงิน"] || member["ฝ่ายการเงิน"]);

  const canDelete = (member.can_delete !== undefined && member.can_delete !== null)
    ? Boolean(member.can_delete)
    : Boolean(d.can_delete || d["สิทธิ์ลบข้อมูล"] || member["สิทธิ์ลบข้อมูล"]);

  const userRole = isOwner
    ? "Owner"
    : (canCloseBill ? "Approver" : (canApprove ? "Finance" : (member.system_role || member.role || d.role || "User")));

  const empId = member.id || d.id || "";
  const displayName = member.nickname || d.nickname || member.full_name || d.full_name || empId;

  return {
    id: empId,
    username: empId,
    displayName,
    fullName: member.full_name || d.full_name || "",
    phone: member.phone || d.phone || member["เบอร์โทร"] || d["เบอร์โทร"] || "",
    role: userRole,
    status: member.status || d.status || "Active",
    isOwner,
    canApprove,
    canCloseBill,
    canDelete,
    pictureUrl: member.pictureurl || d.pictureurl || "",
    lineUserId: member.line_user_id || d.line_user_id || "",
  };
}

function setAuthCookies(
  cookieStore: any,
  user: ReturnType<typeof parseMemberPermissions>,
  pictureUrl?: string,
  lineUserId?: string
) {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const isProd = process.env.NODE_ENV === "production";
  const cookieOptions = { expires, path: "/", sameSite: "lax" as const, secure: isProd };

  cookieStore.set("auth_employee_id", user.id, cookieOptions);
  cookieStore.set("auth_name", user.displayName, cookieOptions);
  cookieStore.set("auth_role", user.role, cookieOptions);
  cookieStore.set("auth_can_delete", String(user.canDelete), cookieOptions);

  const finalPic = pictureUrl || user.pictureUrl;
  if (finalPic) cookieStore.set("auth_picture_url", finalPic, cookieOptions);

  const finalLineId = lineUserId || user.lineUserId;
  if (finalLineId) cookieStore.set("auth_line_user_id", finalLineId, cookieOptions);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, lineUserId, pictureUrl, phone, employeeId, identifier } = body;
    const cookieStore = await cookies();

    // ==========================================
    // 1. ACTION: LOGIN WITH LINE USER ID
    // ==========================================
    if (action === "login") {
      if (!lineUserId) {
        return NextResponse.json({ success: false, error: "Missing LINE User ID" }, { status: 400 });
      }

      // Query master_members directly by indexed line_user_id
      let { data: foundMember, error: memberErr } = await supabaseAdmin
        .from("master_members")
        .select("*")
        .eq("line_user_id", lineUserId)
        .maybeSingle();

      if (memberErr) {
        console.warn("⚠️ Query master_members error:", memberErr.message);
      }

      // Fallback: Check inside JSONB data->>line_user_id
      if (!foundMember) {
        const { data: jsonMember } = await supabaseAdmin
          .from("master_members")
          .select("*")
          .filter("data->>line_user_id", "eq", lineUserId)
          .maybeSingle();
        foundMember = jsonMember;
      }

      if (!foundMember) {
        return NextResponse.json({
          success: false,
          error: "ไม่พบบัญชีพนักงานที่ผูกกับ LINE ID นี้ในตาราง 6. ชื่อพนักงาน กรุณายืนยันตัวตนด้วยเบอร์โทรศัพท์ หรือติดต่อผู้ดูแลระบบ"
        }, { status: 404 });
      }

      const parsedUser = parseMemberPermissions(foundMember);

      if (parsedUser.status === "Inactive") {
        return NextResponse.json({ success: false, error: "บัญชีนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ" }, { status: 403 });
      }

      // Update profile picture if updated from LINE
      if (pictureUrl && foundMember.pictureurl !== pictureUrl) {
        await supabaseAdmin
          .from("master_members")
          .update({ pictureurl: pictureUrl })
          .eq("id", foundMember.id);
      }

      setAuthCookies(cookieStore, parsedUser, pictureUrl, lineUserId);

      return NextResponse.json({
        success: true,
        user: parsedUser,
        message: `ยินดีต้อนรับ ${parsedUser.displayName} เข้าสู่ระบบ`
      });
    }

    // ==========================================
    // 2. ACTION: REGISTER / ACCOUNT LINKING VIA PHONE
    // ==========================================
    if (action === "register") {
      if (!lineUserId) {
        return NextResponse.json({ success: false, error: "Missing LINE User ID" }, { status: 400 });
      }
      if (!phone) {
        return NextResponse.json({ success: false, error: "กรุณาระบุเบอร์โทรศัพท์เพื่อยืนยันตัวตน" }, { status: 400 });
      }

      const inputPhoneClean = normalizePhone(phone);
      const matchedMember = await findMatchingMember(phone);

      if (matchedMember) {
        // Update LINE User ID and pictureurl in master_members
        const updatePayload: Record<string, any> = {
          line_user_id: lineUserId,
        };
        if (pictureUrl) updatePayload.pictureurl = pictureUrl;
        if (!matchedMember.phone && inputPhoneClean) updatePayload.phone = phone.trim();

        await supabaseAdmin
          .from("master_members")
          .update(updatePayload)
          .eq("id", matchedMember.id);

        const parsedUser = parseMemberPermissions({ ...matchedMember, line_user_id: lineUserId });

        // Sync LINE Config for notifications if user is Owner / Approver / Finance
        try {
          if (parsedUser.isOwner || parsedUser.canApprove || parsedUser.canCloseBill) {
            const { data: currentLineCfg } = await supabaseAdmin
              .from("system_options")
              .select("data")
              .eq("id", "line_config")
              .maybeSingle();

            const existingCfg = currentLineCfg?.data || {};
            const updatedLineCfg = { ...existingCfg };

            if (parsedUser.isOwner && !existingCfg.LINE_USER_ID_OWN) {
              updatedLineCfg.LINE_USER_ID_OWN = lineUserId;
            }
            if (parsedUser.canApprove) {
              const approvers = String(existingCfg.LINE_USER_ID_APPROVER || "").split(",").map((s: string) => s.trim()).filter(Boolean);
              if (!approvers.includes(lineUserId)) approvers.push(lineUserId);
              updatedLineCfg.LINE_USER_ID_APPROVER = approvers.join(",");
            }
            if (parsedUser.canCloseBill) {
              const closers = String(existingCfg.LINE_USER_ID_CLOSER || "").split(",").map((s: string) => s.trim()).filter(Boolean);
              if (!closers.includes(lineUserId)) closers.push(lineUserId);
              updatedLineCfg.LINE_USER_ID_CLOSER = closers.join(",");
            }

            await supabaseAdmin.from("system_options").upsert({
              id: "line_config",
              data: updatedLineCfg,
              updated_at: new Date().toISOString()
            });
          }
        } catch (syncErr) {
          console.warn("Failed auto-syncing line_config on linking:", syncErr);
        }

        setAuthCookies(cookieStore, parsedUser, pictureUrl, lineUserId);

        return NextResponse.json({
          success: true,
          isLinked: true,
          user: parsedUser,
          message: `ผูกบัญชี LINE กับพนักงาน "${parsedUser.displayName}" (${parsedUser.role}) สำเร็จ!`
        });
      }

      return NextResponse.json({
        success: false,
        error: `ไม่พบข้อมูลเบอร์โทรศัพท์ "${phone}" ในระบบพนักงาน กรุณาระบุเบอร์โทรศัพท์ให้ตรงกับข้อมูลพนักงาน หรือติดต่อผู้ดูแลระบบ`
      }, { status: 404 });
    }

    // ==========================================
    // 3. SECURE IDENTIFIER / PHONE / EMPLOYEE LOGIN
    // ==========================================
    const rawInput = String(identifier || phone || employeeId || "").trim();
    if (!rawInput) {
      return NextResponse.json({ success: false, error: "กรุณาระบุเบอร์โทรศัพท์หรือรหัสพนักงาน" }, { status: 400 });
    }

    const matchedMember = await findMatchingMember(rawInput);

    if (!matchedMember) {
      return NextResponse.json({
        success: false,
        error: `ไม่พบเบอร์โทรศัพท์หรือชื่อผู้ใช้ "${rawInput}" ในระบบพนักงาน กรุณาตรวจสอบหรือติดต่อผู้ดูแลระบบ`
      }, { status: 404 });
    }

    const parsedUser = parseMemberPermissions(matchedMember);

    if (parsedUser.status === "Inactive") {
      return NextResponse.json({ success: false, error: "บัญชีนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ" }, { status: 403 });
    }

    setAuthCookies(cookieStore, parsedUser, pictureUrl);

    return NextResponse.json({
      success: true,
      user: parsedUser,
      message: `ยินดีต้อนรับ ${parsedUser.displayName} เข้าสู่ระบบ`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to authenticate" }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_employee_id");
  cookieStore.delete("auth_name");
  cookieStore.delete("auth_role");
  cookieStore.delete("auth_can_delete");
  cookieStore.delete("auth_picture_url");
  cookieStore.delete("auth_line_user_id");
  return NextResponse.json({ success: true });
}



