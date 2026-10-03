import { ProjectDetailClient } from "@/components/dashboards/ProjectDetailClient";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { TABLES } from "@/lib/config";
import { getRows, getSystemOptions } from "@/lib/db";
import { hydrateProjectSummary, rowsForProject, valueOf } from "@/lib/project-summary";
import { calculateProjectBudgetControl } from "@/lib/project-budget-control";
import type { SheetRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

const DETAIL_FIELDS = [
  "ID Project",
  "ชื่อ Project",
  "ชื่อลูกค้า",
  "สถานที่",
  "บริษัท",
  "รับผิดชอบ",
  "วันที่",
  "color",
  "คุมงบประเภทงาน",
  "ยอดงาน",
  "ยอดรวม vat",
  "งบไม่เกิน",
  "รวม ALL"
];

const RELATED_COLUMNS = [
  "ลำดับ",
  "ว/ด/ป",
  "ร้าน/บุคคล",
  "สินค้า/ทำงาน",
  "บิล",
  "ประเภท",
  "ยอดเงิน",
  "ยอดโอน",
  "ผู้เบิก",
  "สถานะ"
];

export default async function ProjectDetailPage({ params, searchParams }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const initialTab = typeof query.tab === "string" ? query.tab : undefined;
  const decodedProjectId = decodeURIComponent(projectId);

  const [projectRows, dataRows, customerRows, companyRows, peopleRows, systemOptions] = await Promise.all([
    getRows(TABLES.PROJECT).catch(() => []),
    getRows(TABLES.DATA).catch(() => []),
    getRows(TABLES.CUSTOMER).catch(() => []),
    getRows(TABLES.COMPANY).catch(() => []),
    getRows(TABLES.PEOPLE).catch(() => []),
    getSystemOptions().catch(() => ({} as Record<string, string[]>)),
  ]);

  const project = projectRows.find((row) => String(row["ID Project"] || "").trim() === decodedProjectId.trim());
  if (!project) notFound();

  const relatedRows = rowsForProject(dataRows, project["ID Project"]);
  const summaryRows = relatedRows.filter(isCommittedBill).map((row) => ({
    ...row,
    "ผู้เบิก": resolveRequesterName(row["ผู้เบิก"], peopleRows)
  }));
  const { project: hydratedProject, totals } = hydrateProjectSummary(project, relatedRows);
  const budgetControl = calculateProjectBudgetControl(hydratedProject, relatedRows);

  const projectName = displayValue(valueOf(hydratedProject, ["ชื่อ Project"])) || `Project ${decodedProjectId}`;

  // Build Customer Display - Name only
  const rawCusId = String(hydratedProject["ชื่อลูกค้า"] || hydratedProject["ลูกค้า"] || "").trim();
  const matchedCus = customerRows.find(
    (c) => String(c["id_cus"] || c["id"] || c["รหัสลูกค้า"] || "").trim().toLowerCase() === rawCusId.toLowerCase()
  );
  const cusName = matchedCus
    ? String(matchedCus["ชื่อลูกค้า"] || matchedCus["ชื่อบริษัท"] || matchedCus["ชื่อ-นามสกุล"] || "").trim()
    : "";
  const customerDisplay = cusName || rawCusId || "-";

  // Build Company Display - Name only
  const rawCompId = String(hydratedProject["บริษัท"] || hydratedProject["บริษัทรับงาน"] || "").trim();
  const matchedComp = companyRows.find(
    (c) => String(c["id_Company"] || c["id"] || c["รหัสบริษัท"] || "").trim().toLowerCase() === rawCompId.toLowerCase()
  );
  const compName = matchedComp
    ? String(matchedComp["ชื่อบริษัท"] || matchedComp["ชื่อย่อ"] || "").trim()
    : "";
  const companyDisplay = compName || rawCompId || "-";

  // Build Master Dropdown Options
  const customerOptions = customerRows
    .map((c) => {
      const id = String(c["id_cus"] || c["id"] || c["รหัสลูกค้า"] || "").trim();
      const name = String(c["ชื่อลูกค้า"] || c["ชื่อบริษัท"] || c["ชื่อ-นามสกุล"] || c["name"] || "").trim();
      return {
        value: id,
        label: name ? `${name} (${id})` : id,
        name: name || id,
      };
    })
    .filter((o) => o.value);

  const companyOptions = companyRows
    .map((c) => {
      const id = String(c["id_Company"] || c["id"] || c["รหัสบริษัท"] || "").trim();
      const name = String(c["ชื่อบริษัท"] || c["ชื่อย่อ"] || c["name"] || "").trim();
      return {
        value: id,
        label: name ? `${name} (${id})` : id,
        name: name || id,
      };
    })
    .filter((o) => o.value);

  // Responsible options from System Options (ผู้รับผิดชอบโครงการ สำหรับ 1.Project รวม)
  const configuredOwners = (systemOptions["รับผิดชอบ"] && systemOptions["รับผิดชอบ"].length > 0)
    ? systemOptions["รับผิดชอบ"]
    : (systemOptions["ผู้รับผิดชอบ"] && systemOptions["ผู้รับผิดชอบ"].length > 0)
    ? systemOptions["ผู้รับผิดชอบ"]
    : ["PW1", "PW2", "PW3", "PW4", "PW"];

  const responsibleOptions = configuredOwners
    .map((item) => {
      const val = String(item).trim();
      return {
        value: val,
        label: val,
        name: val,
      };
    })
    .filter((o) => o.value);

  const rawOwner = String(hydratedProject["รับผิดชอบ"] || "").trim();
  const ownerDisplay = rawOwner || "-";

  return (
    <ProjectDetailClient
      projectId={decodedProjectId}
      projectName={projectName}
      hydratedProject={hydratedProject}
      customerDisplay={customerDisplay}
      companyDisplay={companyDisplay}
      ownerDisplay={ownerDisplay}
      customerOptions={customerOptions}
      companyOptions={companyOptions}
      responsibleOptions={responsibleOptions}
      totals={totals}
      budgetControl={budgetControl}
      summaryRows={summaryRows}
      detailFields={DETAIL_FIELDS}
      relatedColumns={RELATED_COLUMNS}
      initialTab={initialTab}
    />
  );
}

function resolveRequesterName(rawRequester: unknown, peopleRows: SheetRow[]): string {
  const str = String(rawRequester || "").trim();
  if (!str) return "-";

  const strClean = str.toLowerCase().replace(/^pt/i, "").trim();

  const found = peopleRows.find((p) => {
    const pId = String(p["รหัสพนักงาน"] || p["id"] || "").trim().toLowerCase();
    const pIdClean = pId.replace(/^pt/i, "").trim();
    const pPhone = String(p["เบอร์โทร"] || p["เบอร์โทรศัพท์"] || p["phone"] || "").trim();
    const pNickname = String(p["ชื่อเล่น"] || "").trim().toLowerCase();
    const pFullName = String(p["ชื่อ-นามสกุล"] || "").trim().toLowerCase();

    return (
      pId === str.toLowerCase() ||
      (pIdClean && pIdClean === strClean) ||
      (pPhone && pPhone === str) ||
      (pNickname && pNickname === str.toLowerCase()) ||
      (pFullName && pFullName === str.toLowerCase())
    );
  });

  if (found) {
    const nickname = String(found["ชื่อเล่น"] || "").trim();
    const fullName = String(found["ชื่อ-นามสกุล"] || found["name"] || "").trim();
    const id = String(found["รหัสพนักงาน"] || found["id"] || "").trim();
    const display = nickname && fullName ? `${nickname} (${fullName})` : nickname || fullName || str;
    return id ? `${display} [${id}]` : display;
  }

  return str;
}



function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
