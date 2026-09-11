import { NextResponse } from "next/server";
import { getMultipleBillsDocumentData } from "@/lib/bills/bill-document";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const billIds = body.billIds;

    if (!billIds || !Array.isArray(billIds) || billIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid billIds" },
        { status: 400 }
      );
    }

    const documents = await getMultipleBillsDocumentData(billIds);
    return NextResponse.json({ success: true, documents });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
