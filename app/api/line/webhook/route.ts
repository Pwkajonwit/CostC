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
          const text = String(event.message.text || "").trim();

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

