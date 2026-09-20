import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { ReportsDashboardClient } from "@/components/dashboards/ReportsDashboardClient";

import { cookies } from "next/headers";
import { getRowYear } from "@/lib/utils/dates";
import { isRowMatchingYearOrPeriod } from "@/lib/fiscal-periods/fiscal-period-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReportsPage() {
  const [dataRows, projectRows, storeRows, contractorRows, contractWorkRows, peopleRows] = await Promise.all([
    getRows(TABLES.DATA),
    getRows(TABLES.PROJECT),
    getRows(TABLES.STORE),
    getRows(TABLES.CONTRACTOR),
    getRows(TABLES.CONTRACT_WORK),
    getRows(TABLES.PEOPLE),
  ]);

  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("costlab_selected_year")?.value;

  const validDataRows = dataRows.filter(isCommittedBill);
  const yearFilteredDataRows = (!selectedYear || selectedYear === "all")
    ? validDataRows
    : validDataRows.filter((r) => isRowMatchingYearOrPeriod(r, selectedYear));

  const yearFilteredContractWorks = (!selectedYear || selectedYear === "all")
    ? contractWorkRows
    : contractWorkRows.filter((r) => isRowMatchingYearOrPeriod(r, selectedYear));

  // Trim storeRows and contractorRows to only fields needed for dropdowns and name resolution
  // to avoid serializing 1,100 full rows of metadata into the HTML payload
  const lightStoreRows = storeRows
    .map((s) => ({
      id_store: String(s["id_store"] || s.id || "").trim(),
      "ชื่อร้านค้า": String(s["ชื่อร้านค้า"] || s.name || "").trim(),
      "ชื่อเต็ม": String(s["ชื่อเต็ม"] || s.full_name || "").trim(),
    }))
    .filter((s) => s["ชื่อร้านค้า"] || s.id_store);

  const lightContractorRows = contractorRows.map((c) => ({
    "id_Contractor": String(c["id_Contractor"] || c.id || c["รหัส"] || c["ID"] || "").trim(),
    "ชื่อเล่น": String(c["ชื่อเล่น"] || "").trim(),
    "ชื่อ-นามสกุล": String(c["ชื่อ-นามสกุล"] || "").trim(),
    "รายละเอียดงาน": String(c["รายละเอียดงาน"] || "").trim(),
  }));

  return (
    <ReportsDashboardClient
      initialDataRows={yearFilteredDataRows}
      initialProjectRows={projectRows}
      initialStoreRows={lightStoreRows}
      initialContractorRows={lightContractorRows}
      initialContractWorkRows={yearFilteredContractWorks}
      initialPeopleRows={peopleRows}
    />
  );
}

