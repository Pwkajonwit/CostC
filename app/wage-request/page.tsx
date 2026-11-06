import { WageRequestLiffClient } from "@/components/wage-request/WageRequestLiffClient";
import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "ขออนุมัติค่าแรงช่าง - LINE LIFF",
  description: "ระบบขออนุมัติค่าแรงและสร้างข้อความส่ง LINE สำหรับพนักงาน",
};

type WageRequestPageProps = {
  searchParams?: Promise<{
    project?: string;
    contract?: string;
    tab?: string;
  }>;
};

export default async function WageRequestPage({ searchParams }: WageRequestPageProps) {
  const query = searchParams ? await searchParams : {};
  const initialProjectId = query.project ? decodeURIComponent(query.project) : "";
  const initialContractId = query.contract ? decodeURIComponent(query.contract) : "";
  const rawTab = query.tab ? decodeURIComponent(query.tab) : "";
  const initialTab: "form" | "history" | undefined =
    rawTab === "history" || rawTab === "approvals" || rawTab === "pending"
      ? "history"
      : rawTab === "form"
      ? "form"
      : undefined;

  const [projectRows, contractRows, contractorRows, dataRows] = await Promise.all([
    getRows(TABLES.PROJECT, 15_000).catch(() => []),
    getRows(TABLES.CONTRACT_WORK, 15_000).catch(() => []),
    getRows(TABLES.CONTRACTOR, 15_000).catch(() => []),
    getRows(TABLES.DATA, 20_000).catch(() => []),
  ]);

  return (
    <WageRequestLiffClient
      initialProjects={projectRows}
      initialContracts={contractRows}
      initialContractors={contractorRows}
      initialBills={dataRows}
      initialProjectId={initialProjectId}
      initialContractId={initialContractId}
      initialTab={initialTab}
    />
  );
}
