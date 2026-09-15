import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { BillDetailClient } from "@/components/dashboards/BillDetailClient";
import { TABLES } from "@/lib/config";
import { hydrateBillRows, hydrateContractRows, hydrateProjectRows } from "@/lib/formulas";
import { getBillDocumentData } from "@/lib/bills/bill-document";
import { getRows } from "@/lib/db";
import { extractMemberPermissions, findMemberInPeopleRows, type UserPermissions } from "@/lib/user-permissions";
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
  const storeIdFromBill = text(bill["ร้านค้า"] || bill["id_store"] || bill.store_id);
  const storeNameFromBill = text(bill["ชื่อร้านค้า"] || bill.store_name);
  const contractorIdFromBill = text(bill["ผู้รับเหมา"] || bill["id_Contractor"] || bill.contractor_id);
  const contractorNameFromBill = text(bill["ชื่อผู้รับเหมา"] || bill.contractor_name);
  const vendorOrPerson = text(bill["ร้าน/บุคคล"] || bill.vendor_or_person);
  const rawCat = text(bill["ประเภท"] || bill.category);
  const rawVendorType = text(bill["ร้านค้า/ผู้รับเหมา"]);

  const isContractorBill =
    rawVendorType === "ผู้รับเหมา" ||
    Boolean(contractorIdFromBill) ||
    Boolean(contractorNameFromBill) ||
    rawCat.startsWith("2.") ||
    rawCat.includes("ค่าแรง") ||
    Number(bill["ค่าแรง"] || 0) > 0 ||
    Boolean(text(bill["statusค่าแรง"]));

  const rawVendor = isContractorBill
    ? (contractorIdFromBill || contractorNameFromBill || vendorOrPerson || "")
    : (storeIdFromBill || storeNameFromBill || vendorOrPerson || "");

  const matchedContractor = isContractorBill && rawVendor
    ? contractorRows.find((c) => {
        const code = text(c["id_Contractor"] || c.id).toLowerCase();
        const nickname = text(c["ชื่อเล่น"]).toLowerCase();
        const fullName = text(c["ชื่อ-นามสกุล"]).toLowerCase();
        const cand1 = (contractorIdFromBill || rawVendor).toLowerCase();
        const cand2 = contractorNameFromBill.toLowerCase();
        const cand3 = vendorOrPerson.toLowerCase();
        return (
          (code && (code === cand1 || code === cand3)) ||
          (nickname && (nickname === cand1 || nickname === cand2 || nickname === cand3 || cand3.includes(nickname))) ||
          (fullName && (fullName === cand1 || fullName === cand2 || fullName === cand3 || cand3.includes(fullName)))
        );
      })
    : null;

  const resolveStoreName = (idOrName: string): string => {
    const token = idOrName.trim();
    if (!token) return "";
    const found = storeRows.find((s) => {
      const code = text(s["id_store"] || s.id).toLowerCase();
      const shortName = text(s["ชื่อร้านค้า"]).toLowerCase();
      const fullName = text(s["ชื่อเต็ม"]).toLowerCase();
      const target = token.toLowerCase();
      return code === target || shortName === target || fullName === target;
    });
    if (found) {
      return text(found["ชื่อร้านค้า"] || found["ชื่อเต็ม"] || found.name) || token;
    }
    return token;
  };

  let vendorDisplay = rawVendor || "-";
  let vendorSubText = "";
  let matchedStore: SheetRow | undefined = undefined;

  if (!isContractorBill && rawVendor) {
    if (rawVendor.includes(",")) {
      vendorDisplay = rawVendor
        .split(",")
        .map((t) => resolveStoreName(t))
        .filter(Boolean)
        .join(", ");
    } else {
      vendorDisplay = resolveStoreName(rawVendor);
    }

    matchedStore = storeRows.find((s) => {
      const code = text(s["id_store"] || s.id).toLowerCase();
      const shortName = text(s["ชื่อร้านค้า"]).toLowerCase();
      const target = rawVendor.trim().toLowerCase();
      return code === target || shortName === target;
    });
    if (matchedStore) {
      const fullName = text(matchedStore["ชื่อเต็ม"]);
      if (fullName && fullName !== vendorDisplay) {
        vendorSubText = fullName;
      }
    }
  } else if (matchedContractor) {
    const code = text(matchedContractor["id_Contractor"] || matchedContractor.id || contractorIdFromBill);
    const nickname = text(matchedContractor["ชื่อเล่น"] || contractorNameFromBill || matchedContractor.name);
    const fullName = text(matchedContractor["ชื่อ-นามสกุล"]);

    vendorDisplay = nickname || fullName || code || rawVendor;
    if (fullName && fullName !== nickname) {
      vendorSubText = fullName;
    }
  } else if (isContractorBill && contractorNameFromBill) {
    if (contractorIdFromBill && contractorIdFromBill.toLowerCase() !== contractorNameFromBill.toLowerCase()) {
      vendorDisplay = `${contractorIdFromBill} - ${contractorNameFromBill}`;
    } else {
      vendorDisplay = contractorNameFromBill;
    }
  }

  const contractorKey = matchedContractor
    ? text(matchedContractor["id_Contractor"] || matchedContractor.id || matchedContractor["ชื่อเล่น"] || rawVendor)
    : rawVendor;
  const storeKey = matchedStore
    ? text(matchedStore["id_store"] || matchedStore.id || matchedStore["ชื่อร้านค้า"] || rawVendor)
    : rawVendor;

  const vendorLink = rawVendor && !rawVendor.includes(",")
    ? (matchedContractor || isContractorBill)
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

  // Resolve current user permissions for action authorization
  const cookieStore = await cookies();
  const authEmpId = cookieStore.get("auth_employee_id")?.value || "";
  const authRole = cookieStore.get("auth_role")?.value || "";

  let userPermissions: UserPermissions | null = null;
  if (authEmpId) {
    const matched = findMemberInPeopleRows(peopleRows, authEmpId);
    if (matched) {
      userPermissions = extractMemberPermissions(matched);
    } else {
      const isOwner = authRole === "Owner" || authRole === "Admin";
      userPermissions = {
        id: authEmpId,
        displayName: cookieStore.get("auth_name")?.value || authEmpId,
        role: authRole || "User",
        isOwner,
        canApprove: isOwner || authRole === "Finance",
        canCloseBill: isOwner || authRole === "Approver",
        canDelete: isOwner || cookieStore.get("auth_can_delete")?.value === "true",
      };
    }
  }

  return (
    <BillDetailClient
      bill={bill}
      decodedBillId={decodedBillId}
      project={project}
      contract={contract}
      stores={storeRows}
      matchedContract={matchedContract}
      contractDisplay={contractDisplay}
      contractLink={contractLink}
      requesterDisplay={requesterDisplay}
      requesterLink={requesterLink}
      createdByDisplay={createdByDisplay}
      vendorDisplay={vendorDisplay}
      vendorSubText={vendorSubText}
      vendorLink={vendorLink}
      documentData={documentData}
      userPermissions={userPermissions}
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
