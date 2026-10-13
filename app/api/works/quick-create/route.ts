import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getLineTargetGroup, sendFlexMessageDetailed } from "@/lib/line/line";
import { createWorkAssignmentFlex } from "@/lib/line/line-tasks-works";
import { uploadFileToSupabaseStorage, getCustomerContactsMap, getCustomerLocationsMap, getCustomerShortNamesMap, resolveCustomerShortName, getNextWorkSequence } from "@/lib/supabase/supabase-db";
import { saveWorkAttachment, getWorkAttachment } from "@/lib/tasks/task-attachments";

export const dynamic = "force-dynamic";

/**
 * GET: Fetch work details by ID (e.g. for pre-filling edit form)
 * and system options (contractors, companies, customers, customer contacts, customer locations) for quick selection
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawId = String(searchParams.get("id") || searchParams.get("work_id") || "").trim();
    const cleanId = parseInt(rawId.replace(/\D/g, ""), 10);

    // Fetch system options (contractors, companies, customers, customer contacts, customer locations, short names) in parallel
    const [contractorsRes, companiesRes, customersRes, customerContacts, customerLocations, customerShortNames] = await Promise.all([
      supabaseAdmin
        .from("contractors")
        .select("id, nickname, full_name, phone")
        .order("nickname", { ascending: true }),
      supabaseAdmin
        .from("companies")
        .select("id, name_th, name_en")
        .order("id", { ascending: true }),
      supabaseAdmin
        .from("customers")
        .select("id, name")
        .order("id", { ascending: true }),
      getCustomerContactsMap(),
      getCustomerLocationsMap(),
      getCustomerShortNamesMap(),
    ]);

    const contractors = contractorsRes.data || [];
    const companies = companiesRes.data || [];
    const rawCustomers = customersRes.data || [];
    const customers = rawCustomers.map(c => ({
      ...c,
      short_name: customerShortNames[c.id] || customerShortNames[c.name] || resolveCustomerShortName(c.name, customerShortNames) || ""
    }));

    // If no work id requested, return just the master data options
    if (!cleanId) {
      return NextResponse.json({
        ok: true,
        contractors,
        companies,
        customers,
        customerContacts,
        customerLocations,
        customerShortNames,
      });
    }

    const { data: work, error } = await supabaseAdmin
      .from("works")
      .select("*")
      .eq("id", cleanId)
      .single();

    if (error || !work) {
      return NextResponse.json({ ok: false, error: "ไม่พบข้อมูลงานรับเหมานี้" }, { status: 404 });
    }

    const attachments = await getWorkAttachment(cleanId);

    return NextResponse.json({
      ok: true,
      work,
      attachments,
      contractors,
      companies,
      customers,
      customerContacts,
      customerLocations,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to load work" }, { status: 500 });
  }
}

/**
 * POST: Create a new work OR update an existing work, save attachments,
 * and dispatch LINE Flex message notification.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let editIdStr = "";
    let team = "PW";
    let activity_type = "เสนอราคา";
    let status = "รอดู";
    let title = "";
    let pr_no = "-";
    let location = "-";
    let date_inspect = "-";
    let date_propose = "-";
    let contact1 = "-";
    let phone1 = "-";
    let company = "-";
    let amount = 0;
    let note = "";
    let creator_name = "";
    let creator_phone = "";
    let creator_emp_id = "";
    let imageUrl = "";
    const uploadedUrls: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      editIdStr = String(formData.get("edit_id") || formData.get("id") || "").trim();
      team = String(formData.get("team") || "PW").trim();
      activity_type = String(formData.get("activity_type") || "รอดูงาน").trim();
      status = String(formData.get("status") || "รอดูงาน").trim();
      title = String(formData.get("title") || "").trim();
      pr_no = String(formData.get("pr_no") || "-").trim();
      location = String(formData.get("location") || "-").trim();
      date_inspect = String(formData.get("date_inspect") || "-").trim();
      date_propose = String(formData.get("date_propose") || "-").trim();
      contact1 = String(formData.get("contact1") || "-").trim();
      phone1 = String(formData.get("phone1") || "-").trim();
      company = String(formData.get("company") || "-").trim();
      amount = Number(formData.get("amount") || 0);
      note = String(formData.get("note") || "").trim();
      creator_name = String(formData.get("creator_name") || formData.get("created_by") || "").trim();
      creator_phone = String(formData.get("creator_phone") || "").trim();
      creator_emp_id = String(formData.get("creator_emp_id") || "").trim();
      const existingImg = String(formData.get("image_url") || "").trim();
      if (existingImg) {
        imageUrl = existingImg;
        existingImg.split(",").forEach(s => {
          const u = s.trim();
          if (u.startsWith("http")) uploadedUrls.push(u);
        });
      }

      // Handle multiple files or single file
      const formFiles = formData.getAll("files") as File[];
      const singleFile = formData.get("file") as File | null;
      const allFiles = formFiles.length > 0 ? formFiles : (singleFile && singleFile.size > 0 ? [singleFile] : []);

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        if (file && file.size > 0) {
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const safeName = `work_${Date.now()}_${i + 1}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
            const url = await uploadFileToSupabaseStorage("repairs", safeName, buffer, file.type || "image/jpeg");
            if (url) {
              uploadedUrls.push(url);
            }
          } catch (uploadErr) {
            console.warn(`Error uploading work photo ${i}:`, uploadErr);
          }
        }
      }
    } else {
      const body = await request.json();
      editIdStr = String(body.edit_id || body.id || "").trim();
      team = String(body.team || "PW").trim();
      activity_type = String(body.activity_type || "รอดูงาน").trim();
      status = String(body.status || "รอดูงาน").trim();
      title = String(body.title || "").trim();
      pr_no = String(body.pr_no || "-").trim();
      location = String(body.location || "-").trim();
      date_inspect = String(body.date_inspect || "-").trim();
      date_propose = String(body.date_propose || "-").trim();
      contact1 = String(body.contact1 || "-").trim();
      phone1 = String(body.phone1 || "-").trim();
      company = String(body.company || "-").trim();
      amount = Number(body.amount || 0);
      note = String(body.note || "").trim();
      creator_name = String(body.creator_name || body.created_by || "").trim();
      creator_phone = String(body.creator_phone || "").trim();
      creator_emp_id = String(body.creator_emp_id || "").trim();
      imageUrl = String(body.image_url || "").trim();
      if (imageUrl) {
        imageUrl.split(",").forEach(s => {
          const u = s.trim();
          if (u.startsWith("http")) uploadedUrls.push(u);
        });
      }
    }

    // Normalize legacy activities and statuses
    if (activity_type === "เสนอราคา") activity_type = "รอดูงาน";
    if (status === "รอดู") status = "รอดูงาน";
    if (status === "รอเสนอ") status = "รอเสนอราคา";
    if (status === "สำเร็จ") status = "เสร็จ";
    if (status === "ประชุมงาน") status = "ประชุม";

    if (!title) {
      return NextResponse.json({ error: "กรุณาระบุชื่องาน / เรื่อง" }, { status: 400 });
    }

    const editId = editIdStr ? parseInt(editIdStr.replace(/\D/g, ""), 10) : 0;
    const isUpdate = editId > 0;

    // Build clean note with amount if present
    let combinedNote = note ? note.trim() : "";
    if (amount > 0) {
      combinedNote = combinedNote
        ? `${combinedNote} (ยอดเสนอ: ฿${amount.toLocaleString("th-TH")})`
        : `ยอดเสนอ: ฿${amount.toLocaleString("th-TH")}`;
    }

    let workIdNum = editId;
    let pwId = `PW-${workIdNum}`;

    if (isUpdate) {
      // 1. Update existing work in Supabase
      const updatePayload: Record<string, any> = {
        team,
        activity_type,
        status: status || "รอดู",
        title,
        pr_no: pr_no || "-",
        location: location || "-",
        date_inspect: date_inspect || "-",
        date_propose: date_propose || "-",
        contact1: contact1 || "-",
        phone1: phone1 || "-",
        company: company || "-",
        note: combinedNote || "-"
      };
      if (creator_name) {
        updatePayload.contact2 = creator_name;
        updatePayload.phone2 = creator_phone || "-";
      }

      const { data: updWork, error: updErr } = await supabaseAdmin
        .from("works")
        .update(updatePayload)
        .eq("id", editId)
        .select()
        .single();

      if (updErr) {
        console.error("Failed to update work in Supabase:", updErr);
        return NextResponse.json({ error: `บันทึกแก้ไขไม่สำเร็จ: ${updErr.message}` }, { status: 500 });
      }

      workIdNum = updWork?.id || editId;
      pwId = `PW-${workIdNum}`;
    } else {
      // 2. Insert new work in Supabase
      const nextWorkId = await getNextWorkSequence();
      const insertPayload: Record<string, any> = {
        id: nextWorkId,
        team,
        activity_type,
        status: status || "รอดู",
        title,
        pr_no: pr_no || "-",
        location: location || "-",
        date_inspect: date_inspect || "-",
        date_propose: date_propose || "-",
        contact1: contact1 || "-",
        phone1: phone1 || "-",
        contact2: creator_name || "-",
        phone2: creator_phone || "-",
        company: company || "-",
        note: combinedNote || "-"
      };

      const { data: insWork, error: insErr } = await supabaseAdmin
        .from("works")
        .insert(insertPayload)
        .select()
        .single();

      if (insErr) {
        console.error("Failed to insert work into Supabase:", insErr);
        return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insErr.message}` }, { status: 500 });
      }

      workIdNum = insWork?.id || 0;
      pwId = `PW-${workIdNum}`;
    }

    // Merge attachments with existing if updating
    let finalImgs = uploadedUrls;
    if (isUpdate) {
      const existing = await getWorkAttachment(workIdNum);
      const existingImgs = Array.isArray(existing?.images) ? existing.images : [];
      finalImgs = Array.from(new Set([...existingImgs, ...uploadedUrls]));
    }

    // Persist attachments in system_options
    const creatorDisplay = creator_name
      ? (creator_phone && creator_phone !== "-" ? `${creator_name} (${creator_phone})` : creator_name)
      : (contact1 !== "-" ? contact1 : (company !== "-" ? company : "ทีมงาน"));

    if (finalImgs.length > 0 || note || creator_name) {
      await saveWorkAttachment({
        workId: workIdNum,
        images: finalImgs,
        note: note || undefined,
        submittedBy: creatorDisplay,
        creatorPhone: creator_phone || undefined,
        creatorEmpId: creator_emp_id || undefined
      });
    }

    // Resolve short name for company/customer
    const shortNamesMap = await getCustomerShortNamesMap();
    const shortCompany = company !== "-" ? (shortNamesMap[company] || resolveCustomerShortName(company, shortNamesMap) || undefined) : undefined;

    // Generate Rich Flex Message Card
    const flex = createWorkAssignmentFlex({
      id: pwId,
      title: title,
      team: team,
      activity_type: activity_type,
      status: status,
      pr_no: pr_no !== "-" ? pr_no : undefined,
      location: location !== "-" ? location : undefined,
      date_inspect: date_inspect !== "-" ? date_inspect : undefined,
      date_propose: date_propose !== "-" ? date_propose : undefined,
      company: company !== "-" ? company : undefined,
      company_short: shortCompany,
      project_name: company !== "-" ? (shortCompany || company) : (team ? `ทีม ${team}` : "งานรับเหมา"),
      contractor_name: contact1 !== "-" ? contact1 : undefined,
      amount: amount > 0 ? amount : 0,
      details: title,
      contact: contact1 !== "-" ? contact1 : undefined,
      phone: phone1 !== "-" ? phone1 : undefined,
      note: note || undefined,
      images: finalImgs,
      image_url: finalImgs.join(", "),
      creator: creator_name || undefined,
      creator_phone: creator_phone || undefined,
      is_update: isUpdate
    });

    // Notify LINE target group for PW
    const teamDisplay = team.toUpperCase().startsWith("PW") ? team.toUpperCase() : `PW${team}`;
    const altText = isUpdate
      ? `[อัปเดตงาน: ${teamDisplay} ลำดับ ${workIdNum}] ${title}`
      : `[เปิดงาน: ${teamDisplay} ลำดับ ${workIdNum}] ${title}`;

    try {
      const pwGroup = await getLineTargetGroup("pw");
      if (pwGroup) {
        await sendFlexMessageDetailed(pwGroup, altText, flex);
      }
    } catch (lineErr) {
      console.warn("LINE notification error for quick work:", lineErr);
    }

    return NextResponse.json({
      ok: true,
      workId: pwId,
      rawId: workIdNum,
      isUpdate,
      title,
      imageUrl: finalImgs.join(", "),
      images: finalImgs,
      flex
    });

  } catch (err: any) {
    console.error("API quick-create work error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
