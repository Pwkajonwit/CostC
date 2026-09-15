import { NextRequest, NextResponse } from "next/server";
import { getRows } from "@/lib/db";
import { TABLES } from "@/lib/config";
import { calculateContractorQuotaDetail } from "@/lib/contractors/contractor-limits";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractorId = String(searchParams.get("contractorId") || "").trim();
  const excludeConworkId = String(searchParams.get("excludeConworkId") || "").trim();
  const targetYearStr = String(searchParams.get("year") || "").trim();
  const targetYear = targetYearStr ? parseInt(targetYearStr, 10) : new Date().getFullYear();

  if (!contractorId) {
    return NextResponse.json({
      success: false,
      hasContractor: false,
      annualLimit: 0,
      totalUsedSoFar: 0,
      remainingBefore: 0,
      paidBillsThisYear: 0,
      pendingContractsThisYear: 0,
      contractsSummary: []
    });
  }

  try {
    const [contractorRows, contractRows, billRows] = await Promise.all([
      getRows(TABLES.CONTRACTOR, 60_000).catch(() => []),
      getRows(TABLES.CONTRACT_WORK, 30_000).catch(() => []),
      getRows(TABLES.DATA, 30_000, 3_000).catch(() => [])
    ]);

    const cleanId = contractorId.split(" - ")[0].trim();
    const cleanNick = contractorId.includes(" - ") ? contractorId.split(" - ").slice(1).join(" - ").trim() : "";

    const contractor = contractorRows.find(c => {
      const cId = String(c["id_Contractor"] || c.id || "").trim();
      const cNick = String(c["ชื่อเล่น"] || c.nickname || "").trim();
      const cFull = String(c["ชื่อ-นามสกุล"] || c.full_name || "").trim();

      return (
        cId === contractorId ||
        cId === cleanId ||
        (cNick && (cNick === contractorId || cNick === cleanNick)) ||
        (cFull && (cFull === contractorId || cFull === cleanNick)) ||
        `${cId} - ${cNick}` === contractorId ||
        `${cId} - ${cFull}` === contractorId
      );
    });

    if (!contractor) {
      return NextResponse.json({
        success: false,
        hasContractor: false,
        annualLimit: 0,
        totalUsedSoFar: 0,
        remainingBefore: 0,
        paidBillsThisYear: 0,
        pendingContractsThisYear: 0,
        contractsSummary: []
      });
    }

    const quotaDetail = calculateContractorQuotaDetail(contractor, contractRows, billRows, {
      excludeConworkId,
      targetYear
    });

    return NextResponse.json({
      success: true,
      hasContractor: true,
      ...quotaDetail
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    });
  } catch (error) {
    console.error("Error fetching contractor annual quota:", error);
    return NextResponse.json({
      success: false,
      error: String(error),
      hasContractor: false,
      annualLimit: 0,
      totalUsedSoFar: 0,
      remainingBefore: 0,
      paidBillsThisYear: 0,
      pendingContractsThisYear: 0,
      contractsSummary: []
    }, { status: 500 });
  }
}
