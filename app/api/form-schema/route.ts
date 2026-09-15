import { NextRequest, NextResponse } from "next/server";
import { getFormPayload } from "@/lib/form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get("tableName");
  if (!tableName) return NextResponse.json({ error: "Missing tableName" }, { status: 400 });
  
  const payload = await getFormPayload(tableName);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    }
  });
}


