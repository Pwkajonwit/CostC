import { NextResponse } from "next/server";
import { getLineQuotaInfo } from "@/lib/line/line";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getLineQuotaInfo();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to fetch quota" }, { status: 500 });
  }
}
