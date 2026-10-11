import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { uploadFileToSupabaseStorage } from "@/lib/supabase/supabase-db";
import { saveBatchTaskAttachments, TaskAttachmentRecord } from "@/lib/tasks/task-attachments";
import { getTodayDateIso, normalizeDateToIso } from "@/lib/utils/dates";
import { sendFlexMessageDetailed, getLineTargetGroup } from "@/lib/line/line";
import { createTaskSummaryFlex, fetchProjectCodeMap } from "@/lib/line/line-tasks-works";

export const dynamic = "force-dynamic";

interface TaskItemInput {
  title: string;
  task_type?: number;
  is_urgent?: boolean;
  do_date?: string;
  send_date?: string;
  note?: string;
  project?: string;
  project_id?: string;
  projectId?: string;
}

export async function POST(req: NextRequest) {
  try {
    let items: TaskItemInput[] = [];
    let creatorName = "";
    let creatorPhone = "";
    let creatorEmpId = "";
    let assigneeName = "";
    let assigneeId: string | null = null;
    let defaultTaskTypeVal = 1;
    let defaultIsUrgent = false;
    let defaultDoDateRaw = "";
    let defaultSendDateRaw = "";
    let defaultProject = "งานทั่วไป";
    let defaultProjectId = "";
    let defaultNote = "";
    const uploadedUrls: string[] = [];

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      creatorName = String(body.creator_name || body.created_by || "").trim();
      creatorPhone = String(body.creator_phone || "").trim();
      creatorEmpId = String(body.creator_emp_id || "").trim();
      assigneeName = String(body.assignee_name || "").trim();
      assigneeId = String(body.assignee_id || "").trim() || null;
      defaultTaskTypeVal = parseInt(String(body.task_type || "1"), 10);
      defaultIsUrgent = body.is_urgent === true || body.is_urgent === "true";
      defaultDoDateRaw = String(body.do_date || "").trim();
      defaultSendDateRaw = String(body.send_date || "").trim();
      defaultProject = String(body.project || "").trim() || "งานทั่วไป";
      defaultProjectId = String(body.project_id || body.projectId || "").trim();
      defaultNote = String(body.note || "").trim();

      if (Array.isArray(body.tasks) && body.tasks.length > 0) {
        items = body.tasks;
      } else if (Array.isArray(body.items) && body.items.length > 0) {
        items = body.items;
      } else if (body.title) {
        items = [{
          title: String(body.title).trim(),
          task_type: defaultTaskTypeVal,
          is_urgent: defaultIsUrgent,
          do_date: defaultDoDateRaw,
          send_date: defaultSendDateRaw,
          project: defaultProject,
          project_id: defaultProjectId || undefined,
          note: defaultNote
        }];
      }
    } else {
      const formData = await req.formData();
      creatorName = String(formData.get("creator_name") || formData.get("created_by") || "").trim();
      creatorPhone = String(formData.get("creator_phone") || "").trim();
      creatorEmpId = String(formData.get("creator_emp_id") || "").trim();
      assigneeName = String(formData.get("assignee_name") || "").trim();
      assigneeId = String(formData.get("assignee_id") || "").trim() || null;
      defaultTaskTypeVal = parseInt(String(formData.get("task_type") || "1"), 10);
      defaultIsUrgent = formData.get("is_urgent") === "true";
      defaultDoDateRaw = String(formData.get("do_date") || "").trim();
      defaultSendDateRaw = String(formData.get("send_date") || "").trim();
      defaultProject = String(formData.get("project") || "").trim() || "งานทั่วไป";
      defaultProjectId = String(formData.get("project_id") || formData.get("projectId") || "").trim();
      defaultNote = String(formData.get("note") || "").trim();

      const tasksRaw = formData.get("tasks") || formData.get("items");
      if (tasksRaw) {
        try {
          items = JSON.parse(String(tasksRaw));
        } catch {
          items = [];
        }
      }

      if (items.length === 0) {
        const title = String(formData.get("title") || "").trim();
        if (title) {
          items = [{
            title,
            task_type: defaultTaskTypeVal,
            is_urgent: defaultIsUrgent,
            do_date: defaultDoDateRaw,
            send_date: defaultSendDateRaw,
            project: defaultProject,
            project_id: defaultProjectId || undefined,
            note: defaultNote
          }];
        }
      }

      // Handle any initial uploaded files
      const files = formData.getAll("files") as File[];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file && file.size > 0) {
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const safeName = `task_batch_${Date.now()}_${i + 1}.jpg`;
            const url = await uploadFileToSupabaseStorage("repairs", safeName, buffer, file.type || "image/jpeg");
            if (url) uploadedUrls.push(url);
          } catch (uploadErr) {
            console.warn(`Error uploading task file ${i}:`, uploadErr);
          }
        }
      }
    }

    // Filter out items without title
    const validItems = items
      .map(item => ({
        ...item,
        title: String(item.title || "").trim()
      }))
      .filter(item => item.title.length > 0);

    if (validItems.length === 0) {
      return NextResponse.json({ error: "กรุณาระบุชื่องาน / รายการที่ต้องทำอย่างน้อย 1 รายการ" }, { status: 400 });
    }

    const todayIso = getTodayDateIso();
    const finalAssigneeName = assigneeName || creatorName || "ทีมงาน";

    // Query max id to prevent duplicate key sequence violation
    const { data: maxRow } = await supabaseAdmin
      .from("tasks")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startId = (maxRow?.id ? Number(maxRow.id) : 0) + 1;

    // Prepare rows for batch insert
    const rowsToInsert = validItems.map((item, idx) => {
      const taskId = startId + idx;
      const isUrgent = item.is_urgent !== undefined ? Boolean(item.is_urgent) : defaultIsUrgent;
      const fullTitle = isUrgent && !item.title.startsWith("🔴") ? `🔴 [ด่วน] ${item.title}` : item.title;
      const doDate = item.do_date ? normalizeDateToIso(item.do_date) : (defaultDoDateRaw ? normalizeDateToIso(defaultDoDateRaw) : todayIso);
      const sendDate = item.send_date ? normalizeDateToIso(item.send_date) : (defaultSendDateRaw ? normalizeDateToIso(defaultSendDateRaw) : null);
      const taskTypeVal = item.task_type || defaultTaskTypeVal || 1;

      return {
        id: taskId,
        title: fullTitle,
        assignee_name: finalAssigneeName,
        assignee_id: assigneeId,
        task_type: taskTypeVal,
        status: "ดำเนินการ",
        do_date: doDate,
        send_date: sendDate
      };
    });

    const { data: insertedList, error: insertErr } = await supabaseAdmin
      .from("tasks")
      .insert(rowsToInsert)
      .select();

    if (insertErr || !insertedList || insertedList.length === 0) {
      return NextResponse.json({ error: insertErr?.message || "ไม่สามารถบันทึกงานได้" }, { status: 500 });
    }

    const creatorDisplay = creatorName
      ? (creatorPhone && creatorPhone !== "-" ? `${creatorName} (${creatorPhone})` : creatorName)
      : finalAssigneeName;

    // Fetch project code map
    const projectCodeMap = await fetchProjectCodeMap();
    if ((!defaultProjectId || defaultProjectId === "0") && defaultProject && defaultProject !== "งานทั่วไป") {
      defaultProjectId = projectCodeMap[defaultProject.toLowerCase()] || projectCodeMap[defaultProject] || "";
    }

    // Save batch attachments/notes to system_options
    const attachmentRecords: TaskAttachmentRecord[] = insertedList.map((taskRow, idx) => {
      const originItem = validItems[idx];
      const taskProject = (originItem?.project || defaultProject).trim() || "งานทั่วไป";
      const taskNote = (originItem?.note || defaultNote).trim();
      const taskProjectId = originItem?.project_id || originItem?.projectId || defaultProjectId || projectCodeMap[taskProject.toLowerCase()] || projectCodeMap[taskProject] || "";
      return {
        taskId: taskRow.id,
        images: uploadedUrls,
        note: taskNote,
        project: taskProject !== "งานทั่วไป" ? taskProject : undefined,
        projectId: taskProjectId && taskProjectId !== "0" ? taskProjectId : undefined,
        project_id: taskProjectId && taskProjectId !== "0" ? taskProjectId : undefined,
        submittedBy: creatorDisplay,
        creatorPhone: creatorPhone || undefined,
        creatorEmpId: creatorEmpId || undefined,
        submittedAt: new Date().toISOString()
      };
    });

    await saveBatchTaskAttachments(attachmentRecords);

    // Send LINE Notification
    const taskGroup = await getLineTargetGroup("task");
    if (taskGroup) {
      const flexTasks = insertedList.map((taskRow, idx) => {
        const originItem = validItems[idx];
        const taskProject = (originItem?.project || defaultProject).trim() || "งานทั่วไป";
        const taskNote = (originItem?.note || defaultNote).trim();
        const taskProjectId = originItem?.project_id || originItem?.projectId || defaultProjectId || projectCodeMap[taskProject.toLowerCase()] || projectCodeMap[taskProject] || "";
        return {
          id: taskRow.id,
          details: originItem?.title || taskRow.title,
          title: originItem?.title || taskRow.title,
          status: "ดำเนินการ",
          project: taskProject !== "งานทั่วไป" ? taskProject : undefined,
          project_id: taskProjectId && taskProjectId !== "0" ? taskProjectId : undefined,
          projectId: taskProjectId && taskProjectId !== "0" ? taskProjectId : undefined,
          assignee_name: finalAssigneeName,
          creator_name: creatorDisplay,
          note: taskNote || undefined,
          do_date: taskRow.do_date,
          send_date: taskRow.send_date || undefined,
          task_type: taskRow.task_type,
          images: uploadedUrls,
          imageUrl: uploadedUrls[0]
        };
      });

      const attachmentsMap: Record<string, any> = {};
      flexTasks.forEach(t => {
        attachmentsMap[String(t.id)] = {
          taskId: t.id,
          images: uploadedUrls,
          note: t.note,
          project: t.project,
          project_id: t.project_id,
          projectId: t.projectId,
          submittedBy: creatorName
        };
      });

      const anyUrgent = validItems.some(it => it.is_urgent || defaultIsUrgent);
      const flexTitle = flexTasks.length === 1
        ? (anyUrgent ? `🔴 เปิดงานใหม่ [ด่วน] • [#${flexTasks[0].id}]` : `📋 เปิดงานใหม่ (Task) • [#${flexTasks[0].id}]`)
        : (anyUrgent ? `🔴 เปิดงานใหม่ ${flexTasks.length} รายการ [ด่วน]` : `📋 เปิดงานใหม่ ${flexTasks.length} รายการ (Tasks)`);

      const flexBubble = createTaskSummaryFlex(flexTasks, {
        title: flexTitle,
        attachmentsMap,
        projectCodeMap
      });

      const lineAltText = flexTasks.length === 1
        ? `📋 แจ้งเตือนเปิดงานใหม่ [#${flexTasks[0].id}]: ${flexTasks[0].title}`
        : `📋 แจ้งเตือนเปิดงานใหม่ ${flexTasks.length} รายการ [${flexTasks.map(t => `#${t.id}`).join(", ")}]`;

      await sendFlexMessageDetailed(taskGroup, lineAltText, flexBubble);
    }

    return NextResponse.json({
      success: true,
      count: insertedList.length,
      taskId: insertedList[0]?.id,
      taskIds: insertedList.map(t => t.id),
      tasks: insertedList
    });
  } catch (err: any) {
    console.error("Error creating tasks:", err);
    return NextResponse.json({ error: err.message || "Failed to create task" }, { status: 500 });
  }
}
