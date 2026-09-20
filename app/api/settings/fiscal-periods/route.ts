import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { clearCache } from "@/lib/utils/cache";
import {
  type FiscalPeriodConfig,
  type ResolvedFiscalPeriod,
  resolveEffectivePeriodRanges
} from "@/lib/fiscal-periods/fiscal-period-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data: optRow } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "custom_fiscal_periods")
      .maybeSingle();

    const rawPeriods: FiscalPeriodConfig[] = Array.isArray(optRow?.data) ? optRow.data : [];
    const resolvedPeriods = resolveEffectivePeriodRanges(rawPeriods);

    // Optional: compute bill count in each period
    const counts: Record<string, number> = {};
    if (resolvedPeriods.length > 0) {
      try {
        const { data: bills } = await supabaseAdmin
          .from("bills")
          .select("id")
          .limit(10000);

        if (bills && Array.isArray(bills)) {
          for (const p of resolvedPeriods) {
            let count = 0;
            for (const b of bills) {
              const seq = Number(b.id);
              if (Number.isFinite(seq) && seq >= p.startSeq && (p.effectiveEndSeq === null || seq <= p.effectiveEndSeq)) {
                count++;
              }
            }
            counts[p.id] = count;
          }
        }
      } catch (e) {
        console.warn("Failed to compute bill counts for fiscal periods:", e);
      }
    }

    return NextResponse.json({
      success: true,
      periods: resolvedPeriods,
      rawPeriods,
      counts
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
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
    const periods: FiscalPeriodConfig[] = Array.isArray(body.periods) ? body.periods : [];

    // Basic validation & normalization
    for (const p of periods) {
      if (!p.label || !p.label.trim()) {
        p.label = p.customName?.trim() || (p.type === "quarter" ? `ปี ${p.year} Q${p.quarter || 1}` : `ปี ${p.year}`);
      }
      if (!p.id || !p.year || !Number.isFinite(p.startSeq) || p.startSeq < 1) {
        return NextResponse.json({
          success: false,
          error: "ข้อมูลรอบปี/ไตรมาสไม่ถูกต้อง กรุณาระบุปี และเลขเริ่มต้นบิลให้ครบถ้วน"
        }, { status: 400 });
      }
    }

    const resolved = resolveEffectivePeriodRanges(periods);

    await supabaseAdmin
      .from("system_options")
      .upsert({
        id: "custom_fiscal_periods",
        data: periods,
        updated_at: new Date().toISOString()
      });

    clearCache("sys_opt:custom_fiscal_periods");
    clearCache("sys_opt:all");

    return NextResponse.json({
      success: true,
      periods: resolved,
      rawPeriods: periods
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
