import { TABLES } from "@/lib/config";
import { MainDashboardClient } from "@/components/dashboards/MainDashboardClient";
import { isCommittedBill, normalizeBillStatus } from "@/lib/bills/bill-status";
import { computeBillTransferAmount, hydrateProjectRowsForList, isCreditActive, isDeductActive, isVatActive } from "@/lib/project-summary";
import { WithdrawDashboardClient, type WithdrawFilters } from "@/components/dashboards/WithdrawDashboardClient";
import { WorkStatusDashboardClient } from "@/components/dashboards/WorkStatusDashboardClient";
import { BillFollowDashboardClient } from "@/components/dashboards/BillFollowDashboardClient";
import { toNumber } from "@/lib/utils/numbers";
import { getRows, getWithdrawBills, getBillFollowBills } from "@/lib/db";
import { getUsersListFromSupabase } from "@/lib/supabase/supabase-db";
import { cookies } from "next/headers";
import { extractMemberPermissions, findMemberInPeopleRows } from "@/lib/user-permissions";
import { getRowYear, isProjectInYear } from "@/lib/utils/dates";
import type { SheetRow } from "@/lib/types";

function filterRowsByCookieYear(rows: SheetRow[], year?: string): SheetRow[] {
  if (!year || year === "all") return rows;
  return rows.filter((r) => {
    const yr = getRowYear(r);
    return !yr || String(yr) === String(year);
  });
}

function filterProjectsByCookieYear(projects: SheetRow[], billsInYear: SheetRow[], year?: string): SheetRow[] {
  const list = (!year || year === "all") ? projects : projects.filter((p) => isProjectInYear(p, year, billsInYear));
  const seen = new Set<string>();
  return list.filter((p) => {
    const id = String(p["ID Project"] || p.id || "").trim();
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function MainDashboard() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("costlab_selected_year")?.value;
  const [dataRows, projectRows] = await Promise.all([safeRows(TABLES.DATA), safeRows(TABLES.PROJECT)]);
  const validDataRows = dataRows.filter(isCommittedBill);
  const yearFilteredData = filterRowsByCookieYear(validDataRows, selectedYear);
  const yearFilteredProjects = filterProjectsByCookieYear(projectRows, yearFilteredData, selectedYear);
  return <MainDashboardClient initialDataRows={yearFilteredData} initialProjectRows={yearFilteredProjects} />;
}

export async function WithdrawDashboard({ filters = {} }: { filters?: WithdrawFilters }) {
  const [dataRows, peopleRows, usersList, storeRows] = await Promise.all([
    getWithdrawBills(),
    safeRows(TABLES.PEOPLE),
    getUsersListFromSupabase(),
    safeRows(TABLES.STORE),
  ]);
  const cookieStore = await cookies();
  const authEmpId = cookieStore.get("auth_employee_id")?.value || "";
  const authName = cookieStore.get("auth_name")?.value || "";

  const matchedUser = findMemberInPeopleRows(peopleRows, authEmpId) || (Array.isArray(usersList) ? usersList.find((u: any) => u.id === authEmpId || u.username === authEmpId) : null);
  const userPerms = matchedUser ? extractMemberPermissions(matchedUser) : null;
  const effectiveRole = userPerms ? userPerms.role : (cookieStore.get("auth_role")?.value || "");
  const isAdmin = Boolean(userPerms?.isOwner || effectiveRole === "Owner" || effectiveRole === "Admin");

  // If requester is not explicitly provided, default to the logged-in user ONLY for regular employees (admins see all)
  let effectiveFilters = { ...filters };
  if (!isAdmin && !effectiveFilters.requester && (authEmpId || authName)) {
    const defaultRequester = findMatchingRequesterKey(peopleRows, authEmpId, authName, usersList);
    if (defaultRequester) {
      effectiveFilters.requester = defaultRequester;
    }
  }
  
  const rows = hydrateDataRows(dataRows).filter(row => {
    // แสดงบิลสถานะ "รอตั้งเบิก", "ตั้งเบิก" และ "อนุมัติ"
    const status = normalizeBillStatus(row["สถานะ"]);
    if (status !== "รอตั้งเบิก" && status !== "ตั้งเบิก" && status !== "รออนุมัติ" && status !== "อนุมัติ") return false;
    return hasValue(row["ลำดับ"]) || hasValue(row["ID Project"]) || hasValue(row["ร้าน/บุคคล"]) || hasValue(row["สินค้า/ทำงาน"]);
  });
  const selectedYear = cookieStore.get("costlab_selected_year")?.value;
  const yearFilteredRows = filterRowsByCookieYear(rows, selectedYear);

  // Lightweight projection of stores for name resolution without serializing unnecessary columns
  const lightStoreRows = storeRows.map((s) => ({
    id_store: String(s["id_store"] || s.id || "").trim(),
    "ชื่อร้านค้า": String(s["ชื่อร้านค้า"] || s.name || "").trim(),
    "ชื่อเต็ม": String(s["ชื่อเต็ม"] || "").trim(),
  }));

  return <WithdrawDashboardClient rows={yearFilteredRows} peopleRows={peopleRows} usersList={usersList} stores={lightStoreRows} initialFilters={effectiveFilters} isAdmin={isAdmin} />;
}

export async function BillFollowDashboard() {
  const [dataRows, peopleRows, usersList] = await Promise.all([
    getBillFollowBills(),
    safeRows(TABLES.PEOPLE),
    getUsersListFromSupabase()
  ]);
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("costlab_selected_year")?.value;
  const authEmpId = cookieStore.get("auth_employee_id")?.value || "";
  const authName = cookieStore.get("auth_name")?.value || "";

  const matchedUser = findMemberInPeopleRows(peopleRows, authEmpId) || (Array.isArray(usersList) ? usersList.find((u: any) => u.id === authEmpId || u.username === authEmpId) : null);
  const userPerms = matchedUser ? extractMemberPermissions(matchedUser) : null;
  const effectiveRole = userPerms ? userPerms.role : (cookieStore.get("auth_role")?.value || "");
  const isAdmin = Boolean(userPerms?.isOwner || effectiveRole === "Owner" || effectiveRole === "Admin");

  let defaultRequester = "";
  if (!isAdmin && (authEmpId || authName)) {
    defaultRequester = findMatchingRequesterKey(peopleRows, authEmpId, authName, usersList);
  }

  const rawRows = hydrateDataRows(dataRows).filter(isCommittedBill);
  const yearFilteredRawRows = filterRowsByCookieYear(rawRows, selectedYear);
  const requesterNames = requesterNameMap(peopleRows);
  
  // Sort rows latest first
  const rows = [...yearFilteredRawRows].sort((left, right) => {
    const leftSeq = Number(left.id || left["ลำดับ"] || left._sheetRow || 0);
    const rightSeq = Number(right.id || right["ลำดับ"] || right._sheetRow || 0);
    return rightSeq - leftSeq;
  });

  // ตามบิล จะแสดงเฉพาะบิลที่มี VAT ที่ค้างส่งใบกำกับภาษี/ใบเสร็จ (หัก ณ ที่จ่าย จะไม่แสดงในหน้านี้)
  const vatRows = rows.filter(row => isVatActive(row.vat) && !hasValue(row["วันได้บิล"]));
  const naturalDeductRows: SheetRow[] = [];
  const companyDeductRows: SheetRow[] = [];
  const creditRows = rows.filter(row => isVatActive(row.vat) && isCreditActive(row["เครดิต"]) && !hasValue(row["วันจ่าย"]));

  return (
    <BillFollowDashboardClient
      vatRows={vatRows}
      naturalDeductRows={naturalDeductRows}
      companyDeductRows={companyDeductRows}
      creditRows={creditRows}
      requesterNames={requesterNames}
      peopleRows={peopleRows}
      initialRequester={defaultRequester}
      authEmpId={authEmpId}
      authName={authName}
    />
  );
}

export async function WorkStatusDashboard() {
  const [projectRows, dataRows, customerRows, companyRows] = await Promise.all([
    safeRows(TABLES.PROJECT),
    safeRows(TABLES.DATA),
    safeRows(TABLES.CUSTOMER),
    safeRows(TABLES.COMPANY),
  ]);

  const customerMap = customerRows.reduce<Record<string, string>>((acc, row) => {
    const id = String(row["id_cus"] || row["id"] || row["รหัสลูกค้า"] || "").trim();
    const name = String(row["ชื่อลูกค้า"] || row["ชื่อบริษัท"] || row["ชื่อ-นามสกุล"] || row["name"] || "").trim();
    if (id) acc[id.toLowerCase()] = name || id;
    return acc;
  }, {});

  const companyMap = companyRows.reduce<Record<string, string>>((acc, row) => {
    const id = String(row["id_Company"] || row["id"] || row["รหัสบริษัท"] || "").trim();
    const name = String(row["ชื่อบริษัท"] || row["บริษัท"] || row["ชื่อย่อ"] || "").trim();
    if (id) acc[id.toLowerCase()] = name || id;
    return acc;
  }, {});

  // Hydrate projects with exact same budget logic as project-all (views/project-all)
  const hydratedProjects = hydrateProjectRowsForList(projectRows, dataRows);

  const rawRows: SheetRow[] = hydratedProjects.map((row) => {
    const rawCus = String(row["ชื่อลูกค้า"] || row["ลูกค้า"] || "").trim();
    const cusName = customerMap[rawCus.toLowerCase()] || rawCus;

    const rawComp = String(row["บริษัท"] || row["บริษัทรับงาน"] || "").trim();
    const compName = companyMap[rawComp.toLowerCase()] || rawComp;

    return {
      ...row,
      "ชื่อลูกค้า": cusName,
      "บริษัท": compName,
    };
  });

  // Sort projects by ID or sheet sequence
  const rows = [...rawRows].sort((left, right) => {
    const leftId = Number(String(left.id || left["ID Project"] || "").replace(/\D/g, "") || left._sheetRow || 0);
    const rightId = Number(String(right.id || right["ID Project"] || "").replace(/\D/g, "") || right._sheetRow || 0);
    return rightId - leftId;
  });

  return <WorkStatusDashboardClient projects={rows} />;
}


function requesterNameMap(peopleRows: SheetRow[]) {
  return peopleRows.reduce<Record<string, string>>((names, row) => {
    const key = String(row["รหัสพนักงาน"] || "").trim();
    const name = String(row["ชื่อเล่น"] || "").trim();
    if (key && name) names[key] = name;
    return names;
  }, {});
}

function requesterName(value: unknown, requesterNames: Record<string, string>) {
  const key = String(value || "").trim();
  return requesterNames[key] || key;
}

function isCompanyLaborStatus(value: unknown) {
  const text = String(value || "").trim();
  return text === "บริษัท";
}

export function findMatchingRequesterKey(
  peopleRows: SheetRow[],
  authEmpId?: string,
  authName?: string,
  usersList: any[] = []
): string {
  const cleanEmpId = String(authEmpId || "").trim().toLowerCase();
  const cleanName = String(authName || "").trim().toLowerCase();
  if (!cleanEmpId && !cleanName) return "";

  // 1. Cross-reference with users_list to find canonical employee ID / username
  let targetEmpId = cleanEmpId;
  if (usersList && usersList.length > 0) {
    const matchedUser = usersList.find(u => {
      const uId = String(u.id || "").trim().toLowerCase();
      const uUser = String(u.username || "").trim().toLowerCase();
      const uDisplay = String(u.displayName || "").trim().toLowerCase();
      const uName = String(u.name || "").trim().toLowerCase();
      return (
        (cleanEmpId && (uId === cleanEmpId || uUser === cleanEmpId)) ||
        (cleanName && (uDisplay === cleanName || uName === cleanName || uId === cleanName || uUser === cleanName))
      );
    });
    if (matchedUser) {
      targetEmpId = String(matchedUser.username || matchedUser.id || "").trim().toLowerCase();
    }
  }

  // 2. Match by Employee Code (รหัสพนักงาน) in peopleRows
  if (targetEmpId) {
    const matched = peopleRows.find(row => {
      const rowId = String(row["รหัสพนักงาน"] || row["id"] || row["employee_id"] || "").trim().toLowerCase();
      return rowId && rowId === targetEmpId;
    });
    if (matched) {
      return String(matched["รหัสพนักงาน"] || matched["ชื่อเล่น"] || "");
    }
  }

  // 3. Match by Nickname (ชื่อเล่น) or Full name (ชื่อ-นามสกุล)
  if (cleanName) {
    const matched = peopleRows.find(row => {
      const nickname = String(row["ชื่อเล่น"] || "").trim().toLowerCase();
      const fullName = String(row["ชื่อ-นามสกุล"] || row["name"] || "").trim().toLowerCase();
      return (nickname && nickname === cleanName) || (fullName && fullName.includes(cleanName));
    });
    if (matched) {
      return String(matched["รหัสพนักงาน"] || matched["ชื่อเล่น"] || "");
    }
  }

  return targetEmpId || authEmpId || authName || "";
}



function sumColumns(rows: SheetRow[], columns: string[]) {
  return rows.reduce((sum, row) => sum + columns.reduce((inner, column) => inner + toNumber(row[column]), 0), 0);
}

function hydrateDataRows(rows: SheetRow[]) {
  const amountColumns = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];
  return rows.map(row => {
    const output = { ...row };
    if (!hasValue(output["ยอดเงิน"])) output["ยอดเงิน"] = sumColumns([output], amountColumns);
    output["ยอดโอน"] = computeBillTransferAmount(output);
    if (!hasValue(output["ร้าน/บุคคล"])) output["ร้าน/บุคคล"] = firstValue(output, ["ร้านค้า", "ผู้รับเหมา", "ร้านค้า/ผู้รับเหมา"]);
    if (!hasValue(output["สินค้า/ทำงาน"])) output["สินค้า/ทำงาน"] = firstValue(output, ["สินค้า", "รายละเอียดงาน", "รายการ"]);
    return output;
  });
}

function firstValue(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    if (hasValue(row[column])) return row[column];
  }
  return "";
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}



async function safeRows(tableName: string): Promise<SheetRow[]> {
  try {
    return await getRows(tableName);
  } catch {
    return [];
  }
}

