import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { uploadFileToSupabaseStorage } from "@/lib/supabase/supabase-db";
import {
  saveTaskAttachment,
  getTaskAttachment,
  saveWorkAttachment,
  getWorkAttachment
} from "@/lib/tasks/task-attachments";
import { getTodayDateIso } from "@/lib/utils/dates";
import { sendFlexMessageDetailed, getLineTargetGroup, sendTextMessage } from "@/lib/line/line";
import { createWorkAssignmentFlex, createTaskSummaryFlex, getAppBaseUrl } from "@/lib/line/line-tasks-works";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawId = String(searchParams.get("id") || "").trim();
    const type = searchParams.get("type") || (rawId.toUpperCase().startsWith("PW") ? "work" : "task");
    const cleanId = parseInt(rawId.replace(/\D/g, ""), 10);

    if (!cleanId) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }

    if (type === "work") {
      const { data: work, error } = await supabaseAdmin
        .from("works")
        .select("*")
        .eq("id", cleanId)
        .single();

      if (error || !work) {
        return NextResponse.json({ error: "ไม่พบข้อมูลงานรับเหมานี้" }, { status: 404 });
      }

      const attachments = await getWorkAttachment(cleanId);

      return NextResponse.json({
        success: true,
        isWork: true,
        task: {
          ...work,
          assignee_name: work.contact1 && work.contact1 !== "-" ? work.contact1 : (work.company && work.company !== "-" ? work.company : `ทีม ${work.team || "PW"}`),
        },
        attachments
      });
    }

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", cleanId)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const attachments = await getTaskAttachment(task.id);

    return NextResponse.json({
      success: true,
      isWork: false,
      task: {
        ...task,
      },
      attachments
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch task" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const taskIdStr = String(formData.get("task_id") || formData.get("id") || "").trim();
    const isWork = taskIdStr.toUpperCase().startsWith("PW") || formData.get("type") === "work" || formData.get("is_work") === "true";
    const cleanId = parseInt(taskIdStr.replace(/\D/g, ""), 10);
    const note = String(formData.get("note") || "").trim();
    const submittedBy = String(formData.get("submitted_by") || "").trim();

    if (!cleanId) {
      return NextResponse.json({ error: "กรุณาระบุรหัสงาน" }, { status: 400 });
    }

    // Branch 1: Work (PW) Attachment Submission
    if (isWork) {
      const { data: work, error: workErr } = await supabaseAdmin
        .from("works")
        .select("*")
        .eq("id", cleanId)
        .single();

      if (workErr || !work) {
        return NextResponse.json({ error: "ไม่พบรหัสงานรับเหมานี้ในระบบ" }, { status: 404 });
      }

      const files = formData.getAll("files") as File[];
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file && file.size > 0) {
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const safeName = `work_${cleanId}_${Date.now()}_${i + 1}.jpg`;
            const url = await uploadFileToSupabaseStorage("repairs", safeName, buffer, file.type || "image/jpeg");
            if (url) uploadedUrls.push(url);
          } catch (uploadErr) {
            console.warn(`Error uploading work file ${i}:`, uploadErr);
          }
        }
      }

      const existing = await getWorkAttachment(cleanId);
      const existingImgs = Array.isArray(existing?.images) ? existing.images : [];
      const mergedUrls = Array.from(new Set([...existingImgs, ...uploadedUrls]));

      if (mergedUrls.length > 0 || note) {
        await saveWorkAttachment({
          workId: cleanId,
          images: mergedUrls,
          note: note || existing?.note || undefined,
          submittedBy: submittedBy || existing?.submittedBy || work.contact1 || "ทีมงาน",
          submittedAt: new Date().toISOString()
        });
      }

      // Notify PW Group with rich Flex card
      let workFlex: Record<string, any> | undefined;
      const pwGroup = await getLineTargetGroup("pw");
      const title = work.title || "งานรับเหมา";
      try {
        workFlex = createWorkAssignmentFlex({
          id: `PW-${cleanId}`,
          title: title,
          team: work.team || "PW",
          activity_type: work.activity_type || "เสนอราคา",
          company: work.company && work.company !== "-" ? work.company : undefined,
          location: work.location && work.location !== "-" ? work.location : undefined,
          date_inspect: work.date_inspect && work.date_inspect !== "-" ? work.date_inspect : undefined,
          date_propose: work.date_propose && work.date_propose !== "-" ? work.date_propose : undefined,
          contact: work.contact1 && work.contact1 !== "-" ? work.contact1 : undefined,
          phone: work.phone1 && work.phone1 !== "-" ? work.phone1 : undefined,
          image_url: mergedUrls.join(", "),
          images: mergedUrls,
          note: note || work.note || undefined,
          creator: submittedBy || undefined
        });
        if (pwGroup && workFlex) {
          await sendFlexMessageDetailed(pwGroup, `[แนบเอกสารงาน: PW-${cleanId}] ${title}`, workFlex);
        }
        const clientTarget = String(formData.get("target_id") || formData.get("line_user_id") || formData.get("line_group_id") || "").trim();
        if (clientTarget && clientTarget !== pwGroup && workFlex) {
          try {
            await sendFlexMessageDetailed(clientTarget, `[แนบเอกสารงาน: PW-${cleanId}] ${title}`, workFlex);
          } catch (_) {}
        }
      } catch (flexErr) {
        console.warn("Error sending work flex notification, fallback to text:", flexErr);
        if (pwGroup) {
          await sendTextMessage(pwGroup, `มีการแนบเอกสาร/รูปภาพใหม่ ในงาน [PW-${cleanId}] ${title}\nโดย: ${submittedBy || "ทีมงาน"}\nจำนวนรูปภาพ: ${mergedUrls.length} ภาพ`);
        }
      }

      return NextResponse.json({
        success: true,
        isWork: true,
        workId: cleanId,
        images: mergedUrls,
        flex: workFlex
      });
    }

    const taskId = cleanId;

    // 1. Fetch task
    const { data: task, error: fetchErr } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      return NextResponse.json({ error: "ไม่พบรหัสงานนี้ในระบบ" }, { status: 404 });
    }

    // 2. Upload files to Supabase Storage
    const files = formData.getAll("files") as File[];
    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && file.size > 0) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const safeName = `task_${taskId}_${Date.now()}_${i + 1}.jpg`;
          const url = await uploadFileToSupabaseStorage("repairs", safeName, buffer, file.type || "image/jpeg");
          if (url) uploadedUrls.push(url);
        } catch (uploadErr) {
          console.warn(`Error uploading task file ${i}:`, uploadErr);
        }
      }
    }

    // Also check for any existing image URLs
    const existingUrl = String(formData.get("image_url") || "").trim();
    if (existingUrl && !uploadedUrls.includes(existingUrl)) {
      uploadedUrls.push(existingUrl);
    }

    // 3. Merge with existing attachments and save to system_options
    const existing = await getTaskAttachment(taskId);
    const existingImgs = Array.isArray(existing?.images) ? existing.images : [];
    const mergedUrls = Array.from(new Set([...existingImgs, ...uploadedUrls]));

    if (mergedUrls.length > 0 || note) {
      await saveTaskAttachment({
        taskId,
        images: mergedUrls,
        note: note || existing?.note || undefined,
        submittedBy: submittedBy || existing?.submittedBy || task.assignee_name || "ทีมงาน",
        submittedAt: new Date().toISOString()
      });
    }

    // 4. Update task status to "ส่งงานแล้ว"
    const todayIso = getTodayDateIso();
    await supabaseAdmin
      .from("tasks")
      .update({
        status: "ส่งงานแล้ว",
        send_date: todayIso
      })
      .eq("id", taskId);

    // 5. Build rich LINE Flex message using the standardized table card format (แบบที่ 3 ไม่มีไทม์ไลน์)
    const baseUrl = getAppBaseUrl();
    const taskTitle = task.title || "งานประจำวัน";
    const assignee = submittedBy || task.assignee_name || "ทีมงาน";

    const taskItem = {
      id: taskId,
      details: taskTitle,
      title: taskTitle,
      status: "ส่งงานแล้ว",
      assignee_name: assignee,
      creator_name: task.creator || task.creator_name || undefined,
      note: note || existing?.note || undefined,
      do_date: task.do_date,
      send_date: todayIso,
      task_type: task.task_type,
      images: mergedUrls,
      imageUrl: mergedUrls[0]
    };

    const attachmentsMap = {
      [String(taskId)]: {
        taskId,
        images: mergedUrls,
        note: note || existing?.note || undefined,
        submittedBy: assignee
      }
    };

    const flexBubble = createTaskSummaryFlex([taskItem], {
      title: `📋 ส่งงานเรียบร้อยแล้ว [#${taskId}] • ผู้ส่ง: ${assignee}`,
      subtitle: `วันที่ส่ง: ${todayIso} • แนบรูป ${mergedUrls.length} ภาพ`,
      actionButton: {
        label: "ตรวจผลงาน",
        uri: `${baseUrl}/task-upload?id=${taskId}`
      },
      attachmentsMap
    });

    // 6. Push notification to task group and client target if available
    const taskGroup = await getLineTargetGroup("task");
    if (taskGroup) {
      try {
        await sendFlexMessageDetailed(taskGroup, `[ส่งงาน: #${taskId}] ${taskTitle}`, flexBubble);
      } catch (flexErr) {
        console.warn("Error sending task flex notification, fallback to text:", flexErr);
        await sendTextMessage(taskGroup, `ส่งงานเรียบร้อยแล้ว [#${taskId}] ${taskTitle}\nผู้ส่ง: ${assignee}\nจำนวนรูปภาพ: ${mergedUrls.length} ภาพ`);
      }
    }

    const clientTarget = String(formData.get("target_id") || formData.get("line_user_id") || formData.get("line_group_id") || "").trim();
    if (clientTarget && clientTarget !== taskGroup) {
      try {
        await sendFlexMessageDetailed(clientTarget, `[ส่งงาน: #${taskId}] ${taskTitle}`, flexBubble);
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      taskId: taskId,
      task_id: taskId,
      images: mergedUrls,
      image_urls: mergedUrls,
      flex: flexBubble,
      status: "ส่งงานแล้ว"
    });
  } catch (err: any) {
    console.error("API task submit error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit task" }, { status: 500 });
  }
}
