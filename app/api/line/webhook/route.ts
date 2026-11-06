import { NextRequest, NextResponse } from "next/server";
import { replyTextMessage, recordDiscoveredLineGroup, recordSystemErrorLog } from "@/lib/line/line";
import { handleLineCommand } from "@/lib/line/line-commands";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // 1. Internal Management Actions (Config Update & Test Message from Dashboard)
    if (body.action === "update_config") {
      const config = body.config || {};
      const { error } = await supabaseAdmin.from("system_options").upsert({
        id: "line_config",
        data: config,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("❌ Failed saving line_config to Supabase:", error);
        await recordSystemErrorLog("Webhook Config Save", error.message, "ERROR", { config });
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "บันทึกการตั้งค่า LINE Bot เรียบร้อยแล้ว" });
    }

    if (body.action === "test_message") {
      const { targetId, text } = body;
      const { sendTextMessageDetailed } = await import("@/lib/line");
      const result = await sendTextMessageDetailed(targetId, text);
      return NextResponse.json(result);
    }

    if (body.action === "test_work_summary") {
      const { targetId } = body;
      const { createWorkSummaryFlex } = await import("@/lib/line/line-tasks-works");
      const { sendFlexMessageDetailed, getLineTargetGroup } = await import("@/lib/line/line");
      const { getAllWorkAttachments } = await import("@/lib/tasks/task-attachments");

      const { data: worksList } = await supabaseAdmin
        .from("works")
        .select("*")
        .order("id", { ascending: false })
        .limit(10);

      const attachmentsMap = await getAllWorkAttachments();
      const flex = createWorkSummaryFlex(worksList || [], { teamName: "PW", attachmentsMap });

      const destination = targetId || (await getLineTargetGroup("pw"));
      const result = await sendFlexMessageDetailed(destination, "ทดสอบรายการงานรับเหมา", flex);
      return NextResponse.json({ ...result, destination, totalWorks: worksList?.length || 0 });
    }

    if (body.action === "test_task_summary") {
      const { targetId } = body;
      const { createTaskSummaryFlex } = await import("@/lib/line/line-tasks-works");
      const { sendFlexMessageDetailed, getLineTargetGroup } = await import("@/lib/line/line");
      const { getAllTaskAttachments } = await import("@/lib/tasks/task-attachments");

      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("*")
        .order("id", { ascending: false })
        .limit(10);

      const attachmentsMap = await getAllTaskAttachments();
      const formattedTasks = (tasks || []).map((t: any) => ({
        id: t.id,
        details: t.title || "-",
        status: t.status || "กำลังทำ",
        project: t.assignee_name ? `ผู้รับ: ${t.assignee_name}` : "งานทั่วไป",
      }));

      const flex = createTaskSummaryFlex(formattedTasks, { attachmentsMap });

      const destination = targetId || (await getLineTargetGroup("task"));
      const result = await sendFlexMessageDetailed(destination, "สรุปงานค้างที่ต้องดำเนินการ (Tasks)", flex);
      return NextResponse.json({ ...result, destination, totalTasks: tasks?.length || 0 });
    }

    // 2. Standard LINE Webhook Event Processing (Concurrent batch processing)
    const events = body.events || [];

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ status: "ok", message: "LINE Webhook Verify OK" });
    }

    await Promise.all(
      events.map(async (event: any) => {
        if (!event) return;
        const replyToken = event.replyToken || "";
        const groupId = event.source?.groupId || event.source?.roomId || "";
        const targetId = groupId || event.source?.userId || "";
        const userId = event.source?.userId || "";

        if (groupId) {
          recordDiscoveredLineGroup(groupId).catch(() => undefined);
        }

        // Handle Text Message Commands
        if (event.type === "message" && event.message?.type === "text") {
          const text = String(event.message.text || "")
            .replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, "")
            .trim();

          // Delegate to centralized line-commands processor
          const handled = await handleLineCommand(text, replyToken, targetId, userId);

          if (!handled && replyToken && !replyToken.startsWith("00000000")) {
            // Default Auto Reply
            await replyTextMessage(
              replyToken,
              `ได้รับคำสั่ง "${text}" เรียบร้อยแล้วครับ พิมพ์ "ช่วยเหลือ" หรือ "เมนู" เพื่อดูคำสั่งทั้งหมดที่สามารถใช้งานได้ครับ`
            );
          }
        }

        // Handle Postback Event Actions (from Flex Buttons)
        if (event.type === "postback" && event.postback?.data) {
          const text = String(event.postback.data || "").trim();
          const handled = await handleLineCommand(text, replyToken, targetId, userId);

          if (!handled && replyToken && !replyToken.startsWith("00000000")) {
            await replyTextMessage(
              replyToken,
              `ดำเนินการตามคำสั่ง "${text}" เรียบร้อยแล้วครับ`
            );
          }
        }

        // Handle Image & File Messages (Upload evidence/documents/photos directly to active task)
        if (event.type === "message" && (event.message?.type === "image" || event.message?.type === "file")) {
          const messageId = event.message.id;
          const isFile = event.message.type === "file";
          const originalFileName = isFile
            ? (event.message.fileName || `file_${Date.now()}`)
            : `image_${Date.now()}.jpg`;
          const fileSize = isFile ? event.message.fileSize : undefined;

          const { getActiveTaskUploadSession, appendTaskAttachmentFile, appendTaskAttachmentImage } = await import("@/lib/tasks/task-attachments");
          const { getDynamicAccessToken } = await import("@/lib/line/line");
          const { uploadFileToSupabaseStorage } = await import("@/lib/supabase/supabase-db");

          const session = await getActiveTaskUploadSession([
            `${targetId}_${userId}`,
            targetId,
            userId,
          ]);

          if (session) {
            try {
              const accessToken = await getDynamicAccessToken();
              const contentRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });

              if (contentRes.ok) {
                const buffer = Buffer.from(await contentRes.arrayBuffer());
                const cleanExt = originalFileName.includes(".")
                  ? originalFileName.split(".").pop()
                  : (isFile ? "bin" : "jpg");
                const safeName = `task_${session.taskId}_line_${Date.now()}_${messageId}.${cleanExt}`;
                const contentType = isFile
                  ? (contentRes.headers.get("content-type") || "application/octet-stream")
                  : "image/jpeg";

                const url = await uploadFileToSupabaseStorage("repairs", safeName, buffer, contentType);

                if (url) {
                  if (isFile) {
                    await appendTaskAttachmentFile(
                      session.taskId,
                      {
                        name: originalFileName,
                        url,
                        size: fileSize,
                        type: contentType
                      },
                      session.assignee || "พนักงาน"
                    );
                    // บันทึกไฟล์เรียบร้อยแบบเงียบ ไม่ส่งข้อความตอบกลับเพื่อไม่ให้รบกวนในกลุ่ม
                  } else {
                    await appendTaskAttachmentImage(
                      session.taskId,
                      url,
                      session.assignee || "พนักงาน"
                    );
                    // บันทึกรูปภาพเรียบร้อยแบบเงียบ ไม่ส่งข้อความตอบกลับเพื่อไม่ให้รบกวนในกลุ่ม
                  }
                }
              }
            } catch (attachErr) {
              console.error("Error saving LINE attachment (image/file):", attachErr);
            }
          }
        }
      })
    );

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("❌ LINE Webhook error:", error);
    await recordSystemErrorLog("LINE Webhook", error?.message || "Webhook Exception", "ERROR", {
      error: String(error)
    });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

