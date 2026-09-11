import Link from "next/link";
import { ArrowLeft, Building2, Store, User, Briefcase, Truck, Users, Building, FileText, ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { BillFollowDashboard, MainDashboard, WithdrawDashboard, WorkStatusDashboard } from "@/components/dashboards/DashboardsServer";
import { DataTable } from "@/components/tables/DataTable";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { FormModal } from "@/components/forms/FormModal";
import { ManageTableClient } from "@/components/views/ManageTableClient";
import { TABLE_KEYS, TABLES } from "@/lib/config";
import { hydrateContractRows } from "@/lib/formulas";
import { hydrateContractorsWithYearlySpend } from "@/lib/contractors/contractor-limits";
import { money, toNumber } from "@/lib/utils/numbers";
import { getHeaders, getRows } from "@/lib/db";
import { getViewById, getViewColumns } from "@/lib/views";
import { CategoryManagementClient } from "@/components/forms/CategoryManagementClient";
import { getSystemOptionsFromSupabase } from "@/lib/supabase/supabase-db";
import { hydrateProjectRowsForList } from "@/lib/project-summary";
import { DetailEditTrigger } from "@/components/forms/DetailEditTrigger";
import { getFormPayload } from "@/lib/form";
import type { SheetRow } from "@/lib/types";

export async function renderViewForId(id: string, query?: Record<string, string | string[] | undefined>) {
  const search = firstSearchParam(query?.search).trim();
  const view = getViewById(id);
  if (!view) notFound();
  const displayName = getDisplayViewName(view.id, view.name);

  return await renderView(view, search, query, displayName);
}

function getEntityIcon(viewId: string) {
  switch (viewId) {
    case "stores":
      return <Store size={18} className="text-emerald-600 shrink-0" />;
    case "banks":
      return <Building2 size={18} className="text-emerald-600 shrink-0" />;
    case "people":
      return <User size={18} className="text-emerald-600 shrink-0" />;
    case "contractors":
      return <Briefcase size={18} className="text-emerald-600 shrink-0" />;
    case "cars":
      return <Truck size={18} className="text-emerald-600 shrink-0" />;
    case "customers":
      return <Users size={18} className="text-emerald-600 shrink-0" />;
    case "companies":
      return <Building size={18} className="text-emerald-600 shrink-0" />;
    case "tasks":
      return <ClipboardList size={18} className="text-emerald-600 shrink-0" />;
    case "works":
      return <Briefcase size={18} className="text-emerald-600 shrink-0" />;
    default:
      return <FileText size={18} className="text-emerald-600 shrink-0" />;
  }
}

export async function renderRowDetailPage(id: string, rowKey: string) {
  const view = getViewById(id);
  if (!view || view.type !== "table" || !view.table) notFound();
  if (id === "project-all" || id === "contract-open") notFound();

  const keyColumn = tableKeyColumn(id, view.table);
  const decodedKey = decodeURIComponent(rowKey).trim();
  const rows = await getRows(view.table).catch(() => []);
  const row = rows.find(item => {
    const idVal = String(item.id || "").trim();
    const kVal = String(item[keyColumn] || "").trim();
    const sRow = String(item._sheetRow || "").trim();
    const nameVal = String(item["ชื่อร้าน"] || item["ชื่อร้านค้า"] || item["ชื่อ-นามสกุล"] || item["ชื่อเล่น"] || item["ชื่อบริษัท"] || item["ชื่อลูกค้า"] || "").trim();
    return idVal === decodedKey || kVal === decodedKey || sRow === decodedKey || nameVal === decodedKey || kVal.toLowerCase() === decodedKey.toLowerCase() || idVal.toLowerCase() === decodedKey.toLowerCase();
  });
  if (!row) notFound();

  const bankRows = await safeRows(TABLES.BANK);
  const peopleRows = await safeRows(TABLES.PEOPLE);
  const bLookup = bankLookup(bankRows);
  const pLookup = peopleLookup(peopleRows);

  const columns = getViewColumns(view.name, Object.keys(row).filter(column => !column.startsWith("_")));
  const relatedSections = await getRelatedSections(id, row, { banks: bLookup, people: pLookup });
  const title = detailTitle(id, row, decodedKey);
  const primaryCode = String(row[keyColumn] || "").trim();
  const isSchemaForm = usesSchemaForm(id);
  const displayName = getDisplayViewName(view.id, view.name);
  const schemaEditEventName = isSchemaForm ? `open-${id}-detail-edit-form` : undefined;
  const initialForm = isSchemaForm ? await getFormPayload(view.table).catch(() => null) : null;

  return (
    <div className="w-full flex flex-col gap-3 font-sans text-xs">
      {/* COMPACT PAGE HEADER */}
      <header className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition cursor-pointer"
            href={`/views/${id}`}
          >
            <ArrowLeft size={14} />
            <span>กลับ</span>
          </Link>

          <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

          <div className="flex items-center gap-2">
            <h1 className="text-base text-slate-900 tracking-tight">{title}</h1>
            {primaryCode && primaryCode !== title ? (
              <span className="font-mono text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                {primaryCode}
              </span>
            ) : null}
            <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
              {view.name}
            </span>
          </div>
        </div>

        {isSchemaForm ? (
          <div className="flex items-center gap-2">
            <DetailEditTrigger eventName={schemaEditEventName} row={row} label="แก้ไขข้อมูล" />
          </div>
        ) : null}
      </header>

      <section className="p-3 sm:p-4 max-w-[1600px] w-full mx-auto space-y-4">
        {/* MAIN INFO CARD */}
        <article className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <header className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-slate-600 shrink-0" />
              <h2 className="text-xs text-slate-800 tracking-tight m-0">ข้อมูลหลัก</h2>
            </div>
            <span className="text-xs text-slate-500">{columns.length} ฟิลด์</span>
          </header>

          <div className="p-3 sm:p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {columns.map(column => {
                const val = row[column];
                const isEmpty = val === null || val === undefined || String(val).trim() === "" || String(val).trim().toLowerCase() === "non";
                const isAmount = amountField(column);
                const isCode = column.toLowerCase().includes("id") || column.includes("รหัส") || column.includes("เลข");

                return (
                  <div key={column} className="bg-white p-2.5 rounded border border-slate-200 flex flex-col justify-between">
                    <dt className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                      {column}
                    </dt>
                    <dd className="mt-0.5">
                      {isEmpty ? (
                        <span className="text-slate-400 font-normal text-xs">-</span>
                      ) : isAmount ? (
                        <span className="text-xs font-mono text-slate-900">
                          {formatDetailValue(column, val, { banks: bLookup, people: pLookup })}
                        </span>
                      ) : isCode ? (
                        <span className="text-xs font-mono text-slate-900">
                          {formatDetailValue(column, val, { banks: bLookup, people: pLookup })}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-800 break-words">
                          {formatDetailValue(column, val, { banks: bLookup, people: pLookup })}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </article>

        {/* RELATED TRANSACTION SECTIONS */}
        {relatedSections.map(section => (
          <section key={section.title} className="space-y-3">
            <DataTable
              columns={section.columns}
              rows={section.rows}
              title={section.title}
              subtitle={section.subtitle}
              rowLabel="รายการ"
              limit={100}
              detailBasePath="/views/project-all"
              detailKeyColumn="ID Project"
            />
          </section>
        ))}
      </section>

      {isSchemaForm ? (
        <FormModal
          tableName={view.table}
          form={initialForm}
          title={`แก้ไข ${displayName}`}
          buttonLabel={`แก้ไข ${displayName}`}
          relaxed
          submitPath="/api/rows"
          openEventName={schemaEditEventName}
          hideLauncher
        />
      ) : null}
    </div>
  );
}

type RelatedSection = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: SheetRow[];
};

async function getRelatedSections(id: string, row: SheetRow, lookups?: { banks?: Record<string, string>; people?: Record<string, string> }): Promise<RelatedSection[]> {
  const sections: RelatedSection[] = [];
  const keyColumn = tableKeyColumn(id, "");
  const keyValue = String(row[keyColumn] || "").trim();
  const storeId = String(row["id_store"] || row["id_bank"] || row["id_Contractor"] || row["รหัสพนักงาน"] || keyValue).trim();
  const storeName = String(row["ชื่อร้าน"] || row["ชื่อร้านค้า"] || row["ร้าน/บุคคล"] || row["ชื่อธนาคาร"] || row["ชื่อ-นามสกุล"] || row["ชื่อเล่น"] || "").trim();

  const pLookup = lookups?.people || peopleLookup(await safeRows(TABLES.PEOPLE));
  const bLookup = lookups?.banks || bankLookup(await safeRows(TABLES.BANK));

  if (id === "stores") {
    const dataRows = await safeRows(TABLES.DATA);
    const related = dataRows.filter(item => {
      if (!isCommittedBill(item)) return false;
      const vendor = String(item["ร้าน/บุคคล"] || item["ร้านค้า"] || "").trim();
      if (!vendor) return false;
      return (
        (storeId && vendor === storeId) ||
        (storeName && vendor === storeName) ||
        (storeId && vendor.toLowerCase().includes(storeId.toLowerCase())) ||
        (storeName && vendor.toLowerCase().includes(storeName.toLowerCase()))
      );
    });

    const mappedRelated = related.map(item => {
      const req = String(item["ผู้เบิก"] || "").trim();
      return {
        ...item,
        "ผู้เบิก": pLookup[req] || req
      };
    });

    sections.push({
      title: `รายการบิลจากร้านค้า ${storeName || storeId}`,
      subtitle: mappedRelated.length ? `${mappedRelated.length} รายการบิลและค่าใช้จ่ายจาก Data` : `ยังไม่มีรายการบันทึกบิลจากร้านนี้`,
      columns: ["ลำดับ", "ID Project", "ชื่อ Project", "ผู้เบิก", "ร้าน/บุคคล", "สินค้า/ทำงาน", "บิล", "ยอดเงิน", "ยอดโอน", "ว/ด/ป", "สถานะ"],
      rows: mappedRelated
    });
  }

  if (id === "people" || id === "contractors") {
    const dataRows = await safeRows(TABLES.DATA);
    const code = String(row["รหัสพนักงาน"] || row["id_Contractor"] || "").trim();
    const name = String(row["ชื่อเล่น"] || row["ชื่อ-นามสกุล"] || "").trim();
    const related = dataRows.filter(item => {
      if (!isCommittedBill(item)) return false;
      const requester = String(item["ผู้เบิก"] || "").trim();
      const vendor = String(item["ร้าน/บุคคล"] || "").trim();
      return (code && (requester === code || vendor === code)) || (name && (requester === name || vendor === name));
    });

    const mappedRelated = related.map(item => {
      const req = String(item["ผู้เบิก"] || "").trim();
      const resolvedName = pLookup[req] || (code && req === code ? (name || req) : req);
      return {
        ...item,
        "ผู้เบิก": resolvedName
      };
    });

    sections.push({
      title: `รายการบิลเบิกจ่ายที่เกี่ยวข้อง`,
      subtitle: mappedRelated.length ? `${mappedRelated.length} รายการจาก Data` : `ยังไม่มีรายการเบิกจ่าย`,
      columns: ["ลำดับ", "ID Project", "ชื่อ Project", "ผู้เบิก", "ร้าน/บุคคล", "สินค้า/ทำงาน", "ยอดเงิน", "ยอดโอน", "ว/ด/ป", "สถานะ"],
      rows: mappedRelated
    });
  }

  if (id === "banks") {
    const dataRows = await safeRows(TABLES.DATA);
    const bankId = String(row["id_bank"] || row["id"] || "").trim();
    const bankName = String(row["ชื่อธนาคาร"] || "").trim();
    const related = dataRows.filter(item => {
      if (!isCommittedBill(item)) return false;
      const bankVal = String(item["ธนาคาร"] || "").trim();
      return (bankId && bankVal === bankId) || (bankName && bankVal === bankName);
    });

    const mappedRelated = related.map(item => {
      const req = String(item["ผู้เบิก"] || "").trim();
      const bankVal = String(item["ธนาคาร"] || "").trim();
      return {
        ...item,
        "ผู้เบิก": pLookup[req] || req,
        "ธนาคาร": bLookup[bankVal] || bankVal
      };
    });

    sections.push({
      title: `รายการโอนผ่านธนาคารนี้`,
      subtitle: mappedRelated.length ? `${mappedRelated.length} รายการจาก Data` : `ยังไม่มีรายการโอนผ่านธนาคารนี้`,
      columns: ["ลำดับ", "ID Project", "ชื่อ Project", "ผู้เบิก", "ร้าน/บุคคล", "ยอดโอน", "ธนาคาร", "ว/ด/ป", "สถานะ"],
      rows: mappedRelated
    });
  }

  return sections;
}

function detailTitle(id: string, row: SheetRow, fallback: string) {
  if (id === "stores") return String(row["ชื่อร้าน"] || row["ร้าน/บุคคล"] || fallback);
  if (id === "people") return String(row["ชื่อเล่น"] || row["ชื่อ-นามสกุล"] || fallback);
  if (id === "contractors") return String(row["ชื่อเล่น"] || row["ชื่อ-นามสกุล"] || fallback);
  if (id === "customers") return String(row["ชื่อลูกค้า"] || row["ลูกค้า"] || fallback);
  if (id === "companies") return String(row["ชื่อบริษัท"] || row["บริษัท"] || fallback);
  if (id === "cars") return String(row["ทะเบียน"] || row["ทะเบียนรถ"] || fallback);
  if (id === "tasks") return String(row["รายการ"] || row.title || fallback);
  if (id === "works") return String(row["เรื่อง"] || row.title || fallback);
  return String(row["ชื่อ"] || row.name || fallback);
}

function amountField(field: string) {
  return /ยอด|เงิน|ราคา|vat|หัก|เครดิต|ค่าแรง|รวม|คงเหลือ|โอน|งบ/.test(field);
}

function formatDetailValue(field: string, value: unknown, lookups?: { banks?: Record<string, string>; people?: Record<string, string> }) {
  if (value === null || value === undefined || value === "") return "-";
  if (amountField(field) && typeof value === "number") return money(value);
  const strVal = String(value).trim();
  if (field === "ธนาคาร" || field === "bank" || field === "bank_name") {
    if (lookups?.banks && lookups.banks[strVal]) {
      return lookups.banks[strVal];
    }
    return strVal.replace(/^Ba\d+\s*[-–—]?\s*/i, "").trim() || strVal;
  }
  if (field === "ผู้เบิก" || field === "requester") {
    if (lookups?.people && lookups.people[strVal]) {
      return lookups.people[strVal];
    }
    return strVal;
  }
  if (field === "LINE" || field === "LINE User ID") {
    if (strVal && strVal.length > 5 && strVal !== "-") {
      return "เชื่อมต่อแล้ว";
    }
    return "ยังไม่ผูก";
  }
  return strVal;
}

async function renderView(
  view: NonNullable<ReturnType<typeof getViewById>>,
  search: string,
  query?: Record<string, string | string[] | undefined>,
  displayName = view.name,
  initialForm?: any
) {
  if (view.id === "dashboard-main") return <MainDashboard />;
  if (view.id === "withdraw-request") {
    return (
      <WithdrawDashboard
        filters={{
          requester: query?.requester ? firstSearchParam(query.requester).trim() : undefined,
          date: query?.date ? firstSearchParam(query.date).trim() : undefined,
          bill: query?.bill ? firstSearchParam(query.bill).trim() : undefined,
          search: query?.search ? firstSearchParam(query.search).trim() : undefined
        }}
      />
    );
  }
  if (view.id === "bill-follow") return <BillFollowDashboard />;
  if (view.id === "work-status") return <WorkStatusDashboard />;
  if (view.id === "categories") {
    const options = await getSystemOptionsFromSupabase();
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <CategoryManagementClient initialOptions={options} />
      </section>
    );
  }

  if (view.type === "table" && view.table) {
    const page = parsePositiveInt(firstSearchParam(query?.page), 1);
    const pageSize = parsePositiveInt(firstSearchParam(query?.pageSize), 80);
    const sort = parseSort(firstSearchParam(query?.sort));
    const [rawRows, projectDataRows, companyRows, bankRows, projectRows, contractorRows, customerRows] = await Promise.all([
      safeRows(view.table),
      (view.id === "project-all" || view.id === "contract-open" || view.id === "contractors") ? safeRows(TABLES.DATA) : Promise.resolve([]),
      view.id === "project-all" ? safeRows(TABLES.COMPANY) : Promise.resolve([]),
      (view.id === "stores" || view.id === "contractors" || view.id === "people" || view.id === "bill-entry") ? safeRows(TABLES.BANK) : Promise.resolve([]),
      view.id === "contract-open" ? safeRows(TABLES.PROJECT) : Promise.resolve([]),
      view.id === "contract-open" ? safeRows(TABLES.CONTRACTOR) : Promise.resolve([]),
      view.id === "project-all" ? safeRows(TABLES.CUSTOMER) : Promise.resolve([])
    ]);

    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]).filter(col => !col.startsWith("_")) : [];
    const isSchemaForm = usesSchemaForm(view.id);

    const hydratedRows = view.id === "contract-open"
      ? await hydrateContractRows(rawRows, { projects: projectRows, contractors: contractorRows, dataRows: projectDataRows })
      : view.id === "project-all"
        ? hydrateProjectRowsForList(rawRows, projectDataRows)
        : view.id === "contractors"
          ? hydrateContractorsWithYearlySpend(rawRows, projectDataRows)
          : rawRows;
    const rows = view.id === "contract-open" ? hydratedRows : filterRows(hydratedRows, search);
    const fallback = rows[0] ? Object.keys(rows[0]).filter(column => !column.startsWith("_")) : [];
    const columns = getViewColumns(view.name, fallback);
    if (view.position === "menu" || view.position === "task") {
      const keyColumn = tableKeyColumn(view.id, view.table);
      const schemaAddEventName = isSchemaForm ? `open-${view.id}-form` : undefined;
      const schemaEditEventName = isSchemaForm ? `open-${view.id}-edit-form` : undefined;
      const initialForm = isSchemaForm ? await getFormPayload(view.table).catch(() => null) : null;
      return (
        <section className="p-3 sm:p-5 max-w-[1600px] mx-auto space-y-3 font-sans text-xs">
          <ManageTableClient
            tableName={view.table}
            viewName={view.name}
            columns={columns}
            formColumns={getManageFormColumns(columns, headers, keyColumn)}
            rows={rows}
            keyColumn={keyColumn}
            search={search}
            rowLabel="รายการ"
            detailBasePath={detailBasePathForView(view.id)}
            addOpenEventName={schemaAddEventName}
            editOpenEventName={schemaEditEventName}
            displayLookups={{
              ...(view.id === "project-all" ? {
                "บริษัท": companyLookup(companyRows),
                "ชื่อลูกค้า": customerLookup(customerRows)
              } : {}),
              ...(bankRows.length ? { "ธนาคาร": bankLookup(bankRows) } : {})
            }}
          />
          {isSchemaForm ? (
            <>
              <FormModal
                tableName={view.table}
                form={initialForm}
                title={`เพิ่ม ${displayName}`}
                buttonLabel={`เพิ่ม ${displayName}`}
                relaxed
                submitPath="/api/rows"
                openEventName={schemaAddEventName}
                hideLauncher
              />
              <FormModal
                tableName={view.table}
                form={initialForm}
                title={`แก้ไข ${displayName}`}
                buttonLabel={`แก้ไข ${displayName}`}
                relaxed
                submitPath="/api/rows"
                openEventName={schemaEditEventName}
                hideLauncher
              />
            </>
          ) : null}
        </section>
      );
    }

    return (
      <section className="p-3 sm:p-5 max-w-[1600px] mx-auto space-y-3 font-sans text-xs">
        {view.id === "contract-open" ? null : (
          isSchemaForm ? <FormModal tableName={view.table} form={initialForm} relaxed={view.id === "contract-open"} openEventName={view.id === "contract-open" ? "open-contract-form" : undefined} /> : null
        )}
        <DataTable
          columns={columns}
          rows={rows}
          title={view.name}
          rowLabel="รายการ"
          showSearch={view.id === "contract-open"}
          initialSearch={search}
          pagination={view.id === "contract-open" ? {
            page,
            pageSize,
            basePath: `/views/${view.id}`,
            query: { sort: sort === "oldest" ? sort : undefined },
            pageSizeOptions: [50, 100]
          } : undefined}
          sortToggle={view.id === "contract-open" ? {
            href: contractHref(view.id, search, pageSize, sort === "latest" ? "oldest" : "latest"),
            label: sort === "latest" ? "ล่าสุดก่อน" : "เก่าสุดก่อน",
            direction: sort
          } : undefined}
          detailBasePath={view.id === "contract-open" ? "/views/contract-open" : undefined}
          detailKeyColumn={view.id === "contract-open" ? "id_Conwork" : undefined}
        />
      </section>
    );
  }

  return <section className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-lg m-4 sm:m-6">ยังไม่ได้ตั้งค่าหน้านี้</section>;
}

async function safeRows(tableName: string, search = "") {
  try {
    const rows = await getRows(tableName);
    return filterRows(rows, search);
  } catch {
    return [];
  }
}

function filterRows(rows: Awaited<ReturnType<typeof getRows>>, search = "") {
  if (!search) return rows;
  const query = search.toLowerCase();
  return rows.filter(row => Object.values(row).some(value => String(value || "").toLowerCase().includes(query)));
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

function contractHref(viewId: string, search: string, pageSize: number, sort: SortDirection) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sort === "oldest") params.set("sort", sort);
  params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `/views/${viewId}?${query}` : `/views/${viewId}`;
}

function getDisplayViewName(viewId: string, fallback: string) {
  if (viewId === "work-status") return "สถานะงาน";
  return fallback;
}

function getManageFormColumns(columns: string[], headers: string[], keyColumn: string) {
  const available = headers.length ? headers : columns;
  const candidates = [keyColumn, ...columns];
  return [...new Set(candidates)].filter(column => {
    if (!column || column === "_sheetRow" || column === "_RowNumber") return false;
    return available.includes(column);
  });
}

function usesSchemaForm(viewId: string) {
  return ["contract-open", "project-all", "banks", "stores", "contractors", "people", "cars", "customers", "companies", "loans", "tasks", "works"].includes(viewId);
}

function detailBasePathForView(viewId: string) {
  if (viewId === "project-all") {
    return "/work-status";
  }
  if (["stores", "contractors", "people", "banks", "cars", "customers", "companies", "tasks", "works"].includes(viewId)) {
    return `/views/${viewId}`;
  }
  return undefined;
}

function tableKeyColumn(viewId: string, tableName: string) {
  const keyByView: Record<string, string> = {
    "project-all": "ID Project",
    banks: "id_bank",
    stores: "id_store",
    contractors: "id_Contractor",
    people: "รหัสพนักงาน",
    cars: "id_car",
    customers: "id_cus",
    companies: "id_Company",
    loans: "id",
    tasks: "ลำดับ",
    works: "ลำดับ"
  };
  return keyByView[viewId] || TABLE_KEYS[tableName] || "_RowNumber";
}

const PROJECT_TOTAL_COLUMNS = [
  "ยอดเงิน",
  "ค่าของ",
  "ค่าแรง",
  "พนักงาน",
  "น้ำมัน",
  "ซ่อมรถ",
  "เครื่องจักร",
  "เครื่องมือ",
  "อื่นๆ"
];

function hasRowValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function companyLookup(companyRows: Awaited<ReturnType<typeof getRows>>) {
  return companyRows.reduce<Record<string, string>>((lookup, row) => {
    const key = String(row.id_Company || row["id_Company"] || "").trim();
    const name = String(row["ชื่อบริษัท"] || row["บริษัท"] || "").trim();
    if (key) {
      lookup[key] = name || key;
      if (name) lookup[name] = name;
    }
    return lookup;
  }, {});
}

function customerLookup(customerRows: Awaited<ReturnType<typeof getRows>>) {
  return customerRows.reduce<Record<string, string>>((lookup, row) => {
    const key = String(row.id_cus || row.id || row["id_cus"] || "").trim();
    const name = String(row["ชื่อลูกค้า"] || row["ชื่อบริษัท"] || row["ชื่อ-นามสกุล"] || row.name || "").trim();
    if (key) {
      lookup[key] = name || key;
      if (name) lookup[name] = name;
    }
    return lookup;
  }, {});
}

function bankLookup(bankRows: Awaited<ReturnType<typeof getRows>>) {
  return bankRows.reduce<Record<string, string>>((lookup, row) => {
    const key = String(row.id_bank || row.id || row["id_bank"] || "").trim();
    const name = String(row["ชื่อธนาคาร"] || row.name || "").trim();
    const displayVal = name || key;
    if (key) {
      lookup[key] = displayVal;
      lookup[displayVal] = displayVal;
      if (name && key !== name) lookup[`${key} - ${name}`] = displayVal;
    }
    return lookup;
  }, {});
}

function peopleLookup(peopleRows: Awaited<ReturnType<typeof getRows>>) {
  return peopleRows.reduce<Record<string, string>>((lookup, row) => {
    const key = String(row["รหัสพนักงาน"] || row.id || "").trim();
    const nickname = String(row["ชื่อเล่น"] || row.nickname || "").trim();
    const fullName = String(row["ชื่อ-นามสกุล"] || row.full_name || "").trim();
    const displayName = nickname || fullName || key;
    if (key) {
      lookup[key] = displayName;
      lookup[key.toLowerCase()] = displayName;
    }
    if (fullName) lookup[fullName] = displayName;
    if (nickname) lookup[nickname] = displayName;
    return lookup;
  }, {});
}
