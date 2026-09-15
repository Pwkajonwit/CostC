import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { ProjectAnalyticsDashboardClient } from "@/components/dashboards/ProjectAnalyticsDashboardClient";

import { cookies } from "next/headers";
import { getRowYear } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectAnalyticsPage() {
  const [dataRows, projectRows, peopleRows] = await Promise.all([
    getRows(TABLES.DATA),
    getRows(TABLES.PROJECT),
    getRows(TABLES.PEOPLE),
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

  return (
    <ProjectAnalyticsDashboardClient
      initialDataRows={yearFilteredDataRows}
      initialProjectRows={projectRows}
      initialPeopleRows={peopleRows}
    />
  );
}

