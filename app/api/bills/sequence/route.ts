import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getNextBillSequence, getSystemOptionsFromSupabase, isSupabaseConfigured } from "@/lib/supabase/supabase-db";
import { clearCache, revalidateAllBillViews } from "@/lib/utils/cache";
import { invalidateTableCache } from "@/lib/db";
import { TABLES } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [maxRecord, countResult, options] = await Promise.all([
      supabaseAdmin.from("bills").select("id").order("id", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("bills").select("id", { count: "exact", head: true }),
      getSystemOptionsFromSupabase().catch(() => ({} as Record<string, any>))
    ]);

    const maxFromRows = Number(maxRecord?.data?.id || 0);
    const totalBills = countResult.count || 0;

    const configuredStart = Number(
      (options as any)?.["bill_start_sequence"] ||
      (options as any)?.["ลำดับบิลเริ่มต้น"] ||
      1
    );

    const nextSequence = await getNextBillSequence(configuredStart);

    return NextResponse.json({
      success: true,
      totalBills,
      maxBillId: maxFromRows,
      configuredStartSequence: configuredStart,
      nextSequence
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, startSequence } = body;

    if (action === "set_start_sequence") {
      const seqNum = Number(startSequence);
      if (!Number.isFinite(seqNum) || seqNum < 1) {
        return NextResponse.json({ success: false, error: "เลขเริ่มต้นต้องเป็นตัวเลขมากกว่า 0" }, { status: 400 });
      }

      if (isSupabaseConfigured()) {
        const { data: currentOptRow } = await supabaseAdmin
          .from("system_options")
          .select("data")
          .eq("id", "system_options")
          .maybeSingle();

        const currentData = (currentOptRow?.data && typeof currentOptRow.data === "object") ? { ...currentOptRow.data } : {};
        currentData["bill_start_sequence"] = seqNum;
        currentData["ลำดับบิลเริ่มต้น"] = seqNum;

        await supabaseAdmin
          .from("system_options")
          .upsert({
            id: "system_options",
            data: currentData,
            updated_at: new Date().toISOString()
          });

        invalidateTableCache(TABLES.DATA);
        clearCache();
      }

      const nextSequence = await getNextBillSequence(seqNum);

      return NextResponse.json({
        success: true,
        message: `ตั้งค่าเลขเริ่มต้นบิลเป็น ${seqNum} เรียบร้อยแล้ว (บิลถัดไป: #${nextSequence})`,
        startSequence: seqNum,
        nextSequence
      });
    }

    if (action === "reset_bills_and_sequence") {
      const seqNum = Number(startSequence) || 1;

      if (isSupabaseConfigured()) {
        // 1. Delete all rows in bills table reliably (using gte 0)
        const { error: delError } = await supabaseAdmin
          .from("bills")
          .delete()
          .gte("id", 0);

        if (delError) {
          console.error("Error resetting bills table:", delError);
          // Fallback: delete using not is null
          await supabaseAdmin.from("bills").delete().not("id", "is", null);
        }

        // 2. Reset paid_amount on all contracts since all bills are deleted
        await supabaseAdmin
          .from("contract_works")
          .update({ paid_amount: 0 })
          .not("id", "is", null);

        // 3. Clear bill_follow_dates in system_options
        await supabaseAdmin
          .from("system_options")
          .upsert({
            id: "bill_follow_dates",
            data: {},
            updated_at: new Date().toISOString()
          });

        // 4. Update bill_start_sequence in system_options
        const { data: currentOptRow } = await supabaseAdmin
          .from("system_options")
          .select("data")
          .eq("id", "system_options")
          .maybeSingle();

        const currentData = (currentOptRow?.data && typeof currentOptRow.data === "object") ? { ...currentOptRow.data } : {};
        currentData["bill_start_sequence"] = seqNum;
        currentData["ลำดับบิลเริ่มต้น"] = seqNum;

        await supabaseAdmin
          .from("system_options")
          .upsert({
            id: "system_options",
            data: currentData,
            updated_at: new Date().toISOString()
          });

        invalidateTableCache(TABLES.DATA);
        invalidateTableCache(TABLES.CONTRACT_WORK);
        clearCache();
        revalidateAllBillViews();
      }

      return NextResponse.json({
        success: true,
        message: `ล้างข้อมูลบิลทั้งหมดและรีเซ็ตเลขเริ่มต้นเป็น #${seqNum} เรียบร้อยแล้ว`,
        nextSequence: seqNum
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
