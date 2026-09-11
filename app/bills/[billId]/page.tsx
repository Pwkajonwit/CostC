import { notFound } from "next/navigation";
import { BillDetailClient } from "@/components/dashboards/BillDetailClient";
import { TABLES } from "@/lib/config";
import { hydrateBillRows, hydrateContractRows, hydrateProjectRows } from "@/lib/formulas";
import { getBillDocumentData } from "@/lib/bills/bill-document";
import { getRows } from "@/lib/db";
import type { SheetRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type BillDetailPageProps = {
  params: Promise<{ billId: string }>;
};

export default async function BillDetailPage({ params }: BillDetailPageProps) {
  const { billId } = await params;
  const decodedBillId = decodeURIComponent(billId).trim();

  const [rawDataRows, rawProjectRows, rawContractRows, peopleRows, storeRows, contractorRows, rawCompanyRows] = await Promise.all([
    getRows(TABLES.DATA).catch(() => []),
    getRows(TABLES.PROJECT).catch(() => []),
    getRows(TABLES.CONTRACT_WORK).catch(() => []),
    getRows(TABLES.PEOPLE).catch(() => []),
    getRows(TABLES.STORE).catch(() => []),
    getRows(TABLES.CONTRACTOR).catch(() => []),
    getRows(TABLES.COMPANY).catch(() => []),
  ]);

  const bill = rawDataRows.find((row) => billKey(row) === decodedBillId || String(row._sheetRow || "") === decodedBillId || String(row.id || "") === decodedBillId);
  if (!bill) notFound();

  const documentData = await getBillDocumentData(bill, {
    projects: rawProjectRows,
    companies: rawCompanyRows,
    contractors: contractorRows,
    bills: [bill],
  });

  const projectId = text(bill["ID Project"]);

  // Hydrate contract rows with real paid amounts, contractor info and calculations
  const hydratedContractRows = await hydrateContractRows(rawContractRows, {
    projects: rawProjectRows,
    contractors: contractorRows,
    dataRows: rawDataRows,
  }).catch(() => rawContractRows);

  const project = rawProjectRows.filter((row) => text(row["ID Project"] || row.id) === projectId);
  const contract = findContractsForBill(bill, hydratedContractRows, contractorRows);
  const matchedContract = contract[0] || null;
  const contractDisplay = matchedContract ? text(matchedContract.id_Conwork || matchedContract.id) : "";
  const contractLink = contractDisplay ? `/contract-open/${encodeURIComponent(contractDisplay)}` : "";

  // Resolve Requester Name & Link
  const rawRequester = text(bill["ผู้เบิก"]);
  const matchedPerson = rawRequester
    ? peopleRows.find((p) => {
        const code = text(p["รหัสพนักงาน"] || p.id).toLowerCase();
        const nickname = text(p["ชื่อเล่น"]).toLowerCase();
        const fullName = text(p["ชื่อ-นามสกุล"]).toLowerCase();
        const reqLower = rawRequester.toLowerCase();
        return code === reqLower || nickname === reqLower || fullName === reqLower;
      })
    : null;

  const personName = matchedPerson ? text(matchedPerson["ชื่อเล่น"] || matchedPerson["ชื่อ-นามสกุล"]) : "";
  const requesterDisplay = rawRequester
    ? personName && !rawRequester.toLowerCase().includes(personName.toLowerCase())
      ? `${rawRequester} - ${personName}`
      : rawRequester
    : "-";

  const requesterKey = matchedPerson
    ? text(matchedPerson["รหัสพนักงาน"] || matchedPerson["ชื่อเล่น"] || matchedPerson.id || rawRequester)
    : rawRequester;
  const requesterLink = rawRequester ? `/views/people/${encodeURIComponent(requesterKey)}` : "";

  // Resolve Vendor / Store / Contractor Name & Link
  const rawVendor = text(bill["ร้านค้า"] || bill["ผู้รับเหมา"] || bill["ร้านค้า/ผู้รับเหมา"] || bill["ร้าน/บุคคล"]);
  const matchedContractor = rawVendor
    ? contractorRows.find((c) => {
        const code = text(c["id_Contractor"] || c.id).toLowerCase();
        const nickname = text(c["ชื่อเล่น"]).toLowerCase();
        const fullName = text(c["ชื่อ-นามสกุล"]).toLowerCase();
        const vLower = rawVendor.toLowerCase();
        return code === vLower || nickname === vLower || fullName === vLower || vLower.includes(nickname);
      })
    : null;

  const matchedStore = !matchedContractor && rawVendor
    ? storeRows.find((s) => {
        const code = text(s["id_store"] || s.id).toLowerCase();
        const name = text(s["ชื่อร้านค้า"] || s["ชื่อเต็ม"]).toLowerCase();
        const vLower = rawVendor.toLowerCase();
        return code === vLower || name === vLower || vLower.includes(name);
      })
    : null;

  const vendorDisplay = rawVendor || "-";
  const contractorKey = matchedContractor
    ? text(matchedContractor["id_Contractor"] || matchedContractor["ชื่อเล่น"] || rawVendor)
    : rawVendor;
  const storeKey = matchedStore
    ? text(matchedStore["id_store"] || matchedStore["ชื่อร้านค้า"] || rawVendor)
    : rawVendor;

  const vendorLink = rawVendor
    ? matchedContractor
      ? `/views/contractors/${encodeURIComponent(contractorKey)}`
      : `/views/stores/${encodeURIComponent(storeKey)}`
    : "";

  // Resolve Creator Name & Link
  const rawCreatedBy = text(bill["ผู้สร้างบิล"] || bill["created_by"] || bill["ผู้บันทึก"]);
  const matchedCreator = rawCreatedBy
    ? peopleRows.find((p) => {
        const code = text(p["รหัสพนักงาน"] || p.id).toLowerCase();
        const nickname = text(p["ชื่อเล่น"]).toLowerCase();
        const fullName = text(p["ชื่อ-นามสกุล"]).toLowerCase();
        const crLower = rawCreatedBy.toLowerCase();
        return code === crLower || nickname === crLower || fullName === crLower;
      })
    : null;

  const creatorName = matchedCreator ? text(matchedCreator["ชื่อเล่น"] || matchedCreator["ชื่อ-นามสกุล"]) : "";
  const createdByDisplay = rawCreatedBy
    ? creatorName && !rawCreatedBy.toLowerCase().includes(creatorName.toLowerCase())
      ? `${rawCreatedBy} - ${creatorName}`
      : rawCreatedBy
    : "-";

  return (
    <BillDetailClient
      bill={bill}
      decodedBillId={decodedBillId}
      project={project}
      contract={contract}
      matchedContract={matchedContract}
      contractDisplay={contractDisplay}
      contractLink={contractLink}
      requesterDisplay={requesterDisplay}
      requesterLink={requesterLink}
      createdByDisplay={createdByDisplay}
      vendorDisplay={vendorDisplay}
      vendorLink={vendorLink}
      documentData={documentData}
    />
  );
}

function findContractsForBill(
  bill: SheetRow,
  contracts: SheetRow[],
  contractors: SheetRow[] = []
): SheetRow[] {
  if (!bill || !contracts || contracts.length === 0) return [];

  const contractorMap = new Map<string, SheetRow>();
  for (const c of contractors) {
    const id = text(c.id_Contractor || c.id).toLowerCase();
    if (id) contractorMap.set(id, c);
  }

  const allRefs = [
    bill._rawContractor,
    bill.conwork_id,
    bill.id_Conwork,
    bill["id_Conwork"],
    bill["_rawContractor"],
    bill["_rawVendor"],
    bill["สัญญา"],
    bill["ผู้รับเหมา"],
    bill["ร้าน/บุคคล"],
    bill.vendor_or_person,
    bill["รายละเอียดงาน"],
    bill["สินค้า/ทำงาน"],
    bill.description
  ].map(r => text(r));

  // 1. Explicit CW contract ID in any reference (e.g. "CW1", "CW1002")
  for (const ref of allRefs) {
    const match = ref.match(/cw\d+/i);
    if (match) {
      const cwId = match[0].toUpperCase();
      const found = contracts.find(c => text(c.id_Conwork || c.id).toUpperCase() === cwId);
      if (found) return [found];
    }
  }

  // 2. Direct exact match on contract ID
  for (const ref of allRefs) {
    if (!ref) continue;
    const refLower = ref.toLowerCase();
    const found = contracts.find(c => text(c.id_Conwork || c.id).toLowerCase() === refLower);
    if (found) return [found];
  }

  // 3. Match by Project ID + Contractor Name / ID
  const bProjectId = text(bill["ID Project"] || bill.project_id).toLowerCase();
  const bContractor = text(bill["ผู้รับเหมา"] || bill["ร้าน/บุคคล"] || bill.vendor_or_person).toLowerCase();

  const isContractorCategory =
    text(bill["ประเภท"] || bill.category).includes("ค่าแรง") ||
    text(bill["ร้านค้า/ผู้รับเหมา"]) === "ผู้รับเหมา" ||
    Boolean(bill["statusค่าแรง"]) ||
    Number(bill["ค่าแรง"] || 0) > 0;

  if (bContractor || isContractorCategory) {
    const matched = contracts.filter(c => {
      const cProjectId = text(c["ID Project"] || c.project_id).toLowerCase();
      if (bProjectId && cProjectId && bProjectId !== cProjectId) return false;

      const cContractorId = text(c.id_Contractor || c.contractor_id).toLowerCase();
      const contractor = contractorMap.get(cContractorId);
      const cNickname = text(c["ชื่อเล่น"] || contractor?.["ชื่อเล่น"]).toLowerCase();
      const cFullName = text(c["ชื่อ-นามสกุล"] || contractor?.["ชื่อ-นามสกุล"]).toLowerCase();
      const cWorkDesc = text(c["รายละเอียดงาน"]).toLowerCase();
      const bWorkDesc = text(bill["รายละเอียดงาน"] || bill["สินค้า/ทำงาน"] || bill.description).toLowerCase();

      const nameMatch = Boolean(
        (cContractorId && (bContractor === cContractorId || bContractor.includes(cContractorId))) ||
        (cNickname && (bContractor === cNickname || bContractor.includes(cNickname) || (cNickname.length >= 3 && bContractor.includes(cNickname)))) ||
        (cFullName && (bContractor === cFullName || bContractor.includes(cFullName)))
      );

      if (nameMatch) {
        return true;
      }

      if (bProjectId && cProjectId === bProjectId && cWorkDesc && bWorkDesc && (cWorkDesc.includes(bWorkDesc) || bWorkDesc.includes(cWorkDesc))) {
        return true;
      }

      return false;
    });

    if (matched.length > 0) {
      return matched;
    }
  }

  return [];
}

function text(value: unknown) {
  return String(value || "").trim();
}

function billKey(row: SheetRow) {
  return text(row["ลำดับ"]) || text(row._sheetRow);
}
