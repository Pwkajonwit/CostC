import { ContractOpenDashboardClient } from "@/components/dashboards/ContractOpenDashboardClient";
import { TABLES } from "@/lib/config";
import { hydrateContractRows } from "@/lib/formulas";
import { getRows } from "@/lib/db";
import { getViewColumns } from "@/lib/views";
import { getFormPayload } from "@/lib/form";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ContractOpenPage() {
  const [rawRows, projectRows, contractorRows, dataRows] = await Promise.all([
    safeRows(TABLES.CONTRACT_WORK),
    safeRows(TABLES.PROJECT),
    safeRows(TABLES.CONTRACTOR),
    safeRows(TABLES.DATA),
  ]);

  const hydratedRows = await hydrateContractRows(rawRows, { projects: projectRows, contractors: contractorRows, dataRows });

  const fallback = hydratedRows[0] ? Object.keys(hydratedRows[0]).filter((column) => !column.startsWith("_")) : [];
  const columns = getViewColumns("เปิดจ้าง", fallback);

  const formPayload = await getFormPayload(TABLES.CONTRACT_WORK, {
    [TABLES.CONTRACT_WORK]: rawRows,
    [TABLES.PROJECT]: projectRows,
    [TABLES.CONTRACTOR]: contractorRows,
    [TABLES.DATA]: dataRows,
  }).catch(() => null);

  return <ContractOpenDashboardClient columns={columns} initialRows={hydratedRows} form={formPayload} />;
}

async function safeRows(tableName: string) {
  try {
    return await getRows(tableName);
  } catch {
    return [];
  }
}

