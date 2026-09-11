import { NextRequest, NextResponse } from "next/server";
import { clearCache } from "@/lib/utils/cache";
import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { isCommittedBill } from "@/lib/bills/bill-status";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const isRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (isRefresh) {
    clearCache("rows:");
    clearCache("dashboard");
  }

  const [dataRows, projectRows] = await Promise.all([
    getRows(TABLES.DATA),
    getRows(TABLES.PROJECT)
  ]);

  const validDataRows = dataRows.filter(isCommittedBill);

  const response = NextResponse.json({
    dataRows: validDataRows,
    projectRows,
    totalRows: validDataRows.length,
    projectRowsCount: projectRows.length
  });

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  response.headers.set("Pragma", "no-cache");

  return response;
}
