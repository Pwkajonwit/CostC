import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { ProjectAnalyticsDashboardClient } from "@/components/dashboards/ProjectAnalyticsDashboardClient";

import { cookies } from "next/headers";
import { getRowYear } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectAnalyticsPage() {
  const [dataRows, projectRows, peopleRows, storeRows, contractorRows, contractWorkRows] = await Promise.all([
    getRows(TABLES.DATA),
    getRows(TABLES.PROJECT),
    getRows(TABLES.PEOPLE),
    getRows(TABLES.STORE).catch(() => []),
    getRows(TABLES.CONTRACTOR).catch(() => []),
    getRows(TABLES.CONTRACT_WORK).catch(() => []),
  ]);

  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("costlab_selected_year")?.value;

  const validDataRows = dataRows.filter(isCommittedBill);
  const yearFilteredDataRows = (!selectedYear || selectedYear === "all")
    ? validDataRows
    : validDataRows.filter((r) => {
        const yr = getRowYear(r);
        return !yr || String(yr) === String(selectedYear);
      });

  const lightStoreRows = storeRows.map((s) => ({
    id_store: String(s["id_store"] || s.id || "").trim(),
    "ชื่อร้านค้า": String(s["ชื่อร้านค้า"] || s.name || "").trim(),
    "ชื่อเต็ม": String(s["ชื่อเต็ม"] || s.full_name || "").trim(),
  }));

  const lightContractorRows = contractorRows.map((c) => ({
    id_Contractor: String(c["id_Contractor"] || c.id || "").trim(),
    "ชื่อเล่น": String(c["ชื่อเล่น"] || "").trim(),
    "ชื่อ-นามสกุล": String(c["ชื่อ-นามสกุล"] || c.name || "").trim(),
  }));

  const lightContractWorkRows = contractWorkRows.map((cw) => ({
    id_Conwork: String(cw["id_Conwork"] || cw.id || "").trim(),
    "ผู้รับเหมา": String(cw["ผู้รับเหมา"] || "").trim(),
    "ชื่อเล่น": String(cw["ชื่อเล่น"] || "").trim(),
  }));

  return (
    <ProjectAnalyticsDashboardClient
      initialDataRows={yearFilteredDataRows}
      initialProjectRows={projectRows}
      initialStoreRows={lightStoreRows}
      initialContractorRows={lightContractorRows}
      initialContractWorkRows={lightContractWorkRows}
      initialPeopleRows={peopleRows}
    />
  );
}

