import { NextRequest, NextResponse } from "next/server";
import { clearCache } from "@/lib/utils/cache";
import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { getRowYear } from "@/lib/utils/dates";

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
  const yearParam = request.nextUrl.searchParams.get("year")?.trim() || request.cookies.get("costlab_selected_year")?.value?.trim();
  const yearFilteredRows = (!yearParam || yearParam === "all")
    ? validDataRows
    : validDataRows.filter((r) => {
        const yr = getRowYear(r);
        return !yr || String(yr) === String(yearParam);
      });

  const response = NextResponse.json({
    dataRows: yearFilteredRows,
    projectRows,
    totalRows: yearFilteredRows.length,
    projectRowsCount: projectRows.length
  });

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  response.headers.set("Pragma", "no-cache");

  return response;
}
