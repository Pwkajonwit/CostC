import { NextRequest, NextResponse } from "next/server";
import { cleanupOrphanedStorageImages } from "@/lib/supabase/supabase-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const bucket = String(body.bucket || "repairs").trim();
    const dryRun = body.dryRun !== false; // Default to safe dryRun mode unless explicitly false

    const result = await cleanupOrphanedStorageImages(bucket, dryRun);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/maintenance/cleanup-storage error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "repairs";

    // GET is always safe dryRun
    const result = await cleanupOrphanedStorageImages(bucket, true);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/maintenance/cleanup-storage error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
