import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { ProjectAnalyticsDashboardClient } from "@/components/dashboards/ProjectAnalyticsDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectAnalyticsPage() {
  const [dataRows, projectRows, storeRows, contractorRows, peopleRows] = await Promise.all([
    getRows(TABLES.DATA),
    getRows(TABLES.PROJECT),
    getRows(TABLES.STORE),
    getRows(TABLES.CONTRACTOR),
    getRows(TABLES.PEOPLE),
  ]);

  const validDataRows = dataRows.filter(isCommittedBill);

  return (
    <ProjectAnalyticsDashboardClient
      initialDataRows={validDataRows}
      initialProjectRows={projectRows}
      initialStoreRows={storeRows}
      initialContractorRows={contractorRows}
      initialPeopleRows={peopleRows}
    />
  );
}

