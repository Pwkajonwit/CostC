import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { ReportsDashboardClient } from "@/components/dashboards/ReportsDashboardClient";

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

  const validDataRows = dataRows.filter(isCommittedBill);

  return (
    <ReportsDashboardClient
      initialDataRows={validDataRows}
      initialProjectRows={projectRows}
      initialStoreRows={storeRows}
      initialContractorRows={contractorRows}
      initialContractWorkRows={contractWorkRows}
      initialPeopleRows={peopleRows}
    />
  );
}

