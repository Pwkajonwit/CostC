import { NextRequest, NextResponse } from "next/server";
import { getRows } from "@/lib/db";
import { TABLES } from "@/lib/config";
import { toNumber } from "@/lib/utils/numbers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = String(searchParams.get("projectId") || "").trim();
  const excludeConworkId = String(searchParams.get("excludeConworkId") || "").trim();

  if (!projectId) {
    return NextResponse.json({
      success: false,
      hasLaborBudget: false,
      laborBudgetCap: 0,
      totalContractedSoFar: 0,
      contractCount: 0,
      remainingBefore: 0,
      contractsSummary: []
    });
  }

  try {
    const [projectRows, contractRows] = await Promise.all([
      getRows(TABLES.PROJECT, 60_000).catch(() => []),
      getRows(TABLES.CONTRACT_WORK, 30_000).catch(() => [])
    ]);

    const cleanId = projectId.split(" - ")[0].trim();
    const cleanName = projectId.includes(" - ") ? projectId.split(" - ").slice(1).join(" - ").trim() : "";

    const project = projectRows.find(p => {
      const pId = String(p["ID Project"] || p.id || "").trim();
      const pName = String(p["ชื่อ Project"] || p.name || "").trim();
      return (
        pId === projectId ||
        pId === cleanId ||
        (cleanName && pName === cleanName) ||
        `${pId} - ${pName}` === projectId ||
        pName === projectId
      );
    });

    if (!project) {
      return NextResponse.json({
        success: false,
        hasLaborBudget: false,
        laborBudgetCap: 0,
        totalContractedSoFar: 0,
        contractCount: 0,
        remainingBefore: 0,
        contractsSummary: []
      });
    }

    const laborBudgetCap = toNumber(
      project["งบไม่เกินค่าแรง"] ||
      project["2.ค่าแรง"] ||
      project["2. ค่าแรง"] ||
      project["ค่าแรง"] ||
      (project.data && typeof project.data === "object" ? (
        project.data["งบไม่เกินค่าแรง"] ||
        project.data["2.ค่าแรง"] ||
        project.data["2. ค่าแรง"] ||
        project.data["ค่าแรง"]
      ) : 0) ||
      (project.budget_caps && typeof project.budget_caps === "object" ? (
        project.budget_caps["งบไม่เกินค่าแรง"] ||
        project.budget_caps["2.ค่าแรง"] ||
        project.budget_caps["2. ค่าแรง"] ||
        project.budget_caps["ค่าแรง"]
      ) : 0)
    );

    const projectWorkAmount = toNumber(project["ยอดงาน"]);
    const projectGeneralBudget = toNumber(project["งบไม่เกิน"]);
    const projectName = String(project["ชื่อ Project"] || project.name || cleanName || projectId);

    const canonicalProjId = String(project["ID Project"] || project.id || "").trim();

    const otherContracts = contractRows.filter(c => {
      const cProjId = String(c["ID Project"] || c.project_id || "").trim();
      const isMatch = cProjId === canonicalProjId || cProjId === cleanId || cProjId === projectId;
      if (!isMatch) return false;

      if (excludeConworkId) {
        const cId = String(c.id_Conwork || c.id || c._sheetRow || "").trim();
        if (cId === excludeConworkId) return false;
      }
      return true;
    });

    let totalContractedSoFar = 0;
    const contractsSummary = otherContracts.map(c => {
      const amt = toNumber(c["ยอดเงินจ้าง"] || c.total_contract_amount || c.amount || 0);
      totalContractedSoFar += amt;
      return {
        id: String(c.id_Conwork || c.id || ""),
        contractor: String(c["ชื่อเล่น"] || c["ผู้รับเหมา"] || c["ชื่อ-นามสกุล"] || c.id_Contractor || ""),
        amount: amt,
        details: String(c["รายละเอียดงาน"] || c.work_details || "")
      };
    });

    const hasLaborBudget = laborBudgetCap > 0;
    const remainingBefore = laborBudgetCap - totalContractedSoFar;

    return NextResponse.json({
      success: true,
      hasLaborBudget,
      laborBudgetCap,
      projectWorkAmount,
      projectGeneralBudget,
      projectName,
      totalContractedSoFar,
      contractCount: otherContracts.length,
      remainingBefore,
      contractsSummary
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    });
  } catch (error) {
    console.error("Error fetching project labor budget:", error);
    return NextResponse.json({
      success: false,
      error: String(error),
      hasLaborBudget: false,
      laborBudgetCap: 0,
      totalContractedSoFar: 0,
      contractCount: 0,
      remainingBefore: 0,
      contractsSummary: []
    }, { status: 500 });
  }
}
