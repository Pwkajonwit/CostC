import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { hydrateBillRows } from "@/lib/formulas";
import { DocumentsManagerClient } from "@/components/documents/DocumentsManagerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentsPage() {
  const [rawBills, rawProjects, rawContractors, rawCompanies, rawStores, rawPeople] = await Promise.all([
    getRows(TABLES.DATA).catch(() => []),
    getRows(TABLES.PROJECT).catch(() => []),
    getRows(TABLES.CONTRACTOR).catch(() => []),
    getRows(TABLES.COMPANY).catch(() => []),
    getRows(TABLES.STORE).catch(() => []),
    getRows(TABLES.PEOPLE).catch(() => []),
  ]);

  const hydratedBills = await hydrateBillRows(rawBills, {
    projects: rawProjects,
    stores: rawStores,
    contractors: rawContractors,
  });

  // Sort latest bills first
  const sortedBills = [...hydratedBills].sort((a, b) => {
    const seqA = Number(a["ลำดับ"] || a._sheetRow || a.id || 0);
    const seqB = Number(b["ลำดับ"] || b._sheetRow || b.id || 0);
    return seqB - seqA;
  });

  return (
    <DocumentsManagerClient
      bills={sortedBills}
      projects={rawProjects}
      contractors={rawContractors}
      companies={rawCompanies}
      people={rawPeople}
    />
  );
}
