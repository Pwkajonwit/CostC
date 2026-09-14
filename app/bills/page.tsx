import { TABLES } from "@/lib/config";
import { BillsDashboardClient } from "@/components/dashboards/BillsDashboardClient";
import { hydrateBillRows } from "@/lib/formulas";
import { getRows } from "@/lib/db";
import { cookies } from "next/headers";
import { formatBillConditions } from "@/lib/bills/bill-status";
import { extractMemberPermissions, findMemberInPeopleRows } from "@/lib/user-permissions";
import type { SheetRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BillsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const query = await searchParams;
  const search = firstSearchParam(query?.search).trim();
  const page = parsePositiveInt(firstSearchParam(query?.page), 1);
  const pageSize = parsePositiveInt(firstSearchParam(query?.pageSize), 20);
  const sort = parseSort(firstSearchParam(query?.sort));
  const viewName = "กรอกบิล";
  const columns = [
    "ลำดับ",
    "ID Project",
    "ชื่อ Project",
    "รูปถ่ายบิล",
    "ร้าน/บุคคล",
    "สินค้า/ทำงาน",
    "บิล",
    "ประเภท",
    "ยอดเงิน",
    "เงื่อนไข",
    "ผู้เบิก",
    "ว/ด/ป",
    "สถานะ"
  ];

  const cookieStore = await cookies();
  const role = cookieStore.get("auth_role")?.value || "";
  const canDeleteCookie = cookieStore.get("auth_can_delete")?.value;
  const canDelete = canDeleteCookie === "true" || (canDeleteCookie !== "false" && role !== "User" && Boolean(role));
  const authEmpId = cookieStore.get("auth_employee_id")?.value || "";
  const authName = cookieStore.get("auth_name")?.value || "";

  const [allRows, peopleRows, storeRows] = await Promise.all([
    safeRows(TABLES.DATA),
    safeRows(TABLES.PEOPLE),
    safeRows(TABLES.STORE),
  ]);

  const matchedUser = findMemberInPeopleRows(peopleRows, authEmpId);
  const userPerms = matchedUser ? extractMemberPermissions(matchedUser) : null;
  const effectiveRole = userPerms ? userPerms.role : role;
  const effectiveCanDelete = userPerms
    ? (userPerms.canDelete || userPerms.isOwner || effectiveRole === "Owner" || effectiveRole === "Admin")
    : (canDeleteCookie === "true" || (canDeleteCookie !== "false" && role !== "User" && Boolean(role)));

  const sortedRows = sortBillRows(allRows, sort || "latest");
  const rows = nonEmptyRows(sortedRows, columns);

  return (
    <BillsDashboardClient
      columns={columns}
      initialRows={rows}
      isAdmin={effectiveCanDelete}
      peopleRows={peopleRows}
      stores={storeRows}
      authEmpId={authEmpId}
      authName={userPerms?.displayName || authName}
      search={search}
      page={page}
      pageSize={pageSize}
      sort={sort}
    />
  );
}

function BillConditions({ row }: { row: SheetRow }) {
  const text = formatBillConditions(row);
  return text ? (
    <span className="inline-block px-2 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md">{text}</span>
  ) : <span className="text-slate-400 font-mono text-xs">-</span>;
}

function requesterNameMap(peopleRows: SheetRow[]) {
  return peopleRows.reduce<Record<string, string>>((names, row) => {
    const key = String(row["รหัสพนักงาน"] || "").trim();
    const name = String(row["ชื่อเล่น"] || "").trim();
    if (key && name) names[key] = name;
    return names;
  }, {});
}

async function safeRows(tableName: string): Promise<SheetRow[]> {
  try {
    return await getRows(tableName);
  } catch {
    return [];
  }
}

function filterRows(rows: SheetRow[], search: string) {
  if (!search) return rows;
  const query = search.toLowerCase();
  return rows.filter(row => Object.values(row).some(value => String(value || "").toLowerCase().includes(query)));
}

function nonEmptyRows(rows: SheetRow[], columns: string[]) {
  return rows.filter(row => {
    return Object.entries(row).some(([key, value]) => {
      if (key.startsWith("_")) return false;
      return value !== null && value !== undefined && String(value).trim() !== "";
    });
  });
}

function sortBillRows(rows: SheetRow[], sort: SortDirection) {
  return [...rows].sort((left, right) => {
    const diff = latestRowValue(right) - latestRowValue(left);
    return sort === "latest" ? diff : -diff;
  });
}

function latestRowValue(row: SheetRow) {
  const sequence = Number(row["ลำดับ"] || 0);
  if (Number.isFinite(sequence) && sequence > 0) return sequence;
  const sheetRow = Number(row._sheetRow || 0);
  return Number.isFinite(sheetRow) ? sheetRow : 0;
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.trunc(parsed);
}

type SortDirection = "latest" | "oldest";

function parseSort(value: string): SortDirection {
  return value === "oldest" ? "oldest" : "latest";
}

function billsHref(search: string, pageSize: number, sort: SortDirection) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sort === "oldest") params.set("sort", sort);
  params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `/bills?${query}` : "/bills";
}

