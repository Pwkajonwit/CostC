import { NextResponse } from "next/server";
import { clearCache, revalidateAllBillViews } from "@/lib/utils/cache";

export const dynamic = "force-dynamic";

export async function POST() {
  clearCache();
  revalidateAllBillViews();
  return NextResponse.json({ success: true });
}

