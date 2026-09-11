import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContractDetailEditButton } from "@/components/forms/ContractDetailEditButton";
import { DataTable } from "@/components/tables/DataTable";
import { isCommittedBill } from "@/lib/bills/bill-status";
import { TABLES } from "@/lib/config";
import { hydrateBillRows, hydrateContractRows } from "@/lib/formulas";
import { getRows } from "@/lib/db";
import { getFormPayload } from "@/lib/form";
import { money } from "@/lib/utils/numbers";
import { formatDateDisplay } from "@/lib/utils/dates";
import type { SheetRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type ContractDetailPageProps = {
  params: Promise<{ contractId: string }>;
};

const DETAIL_FIELDS = [
  "ชื่อเล่น",
  "id_Conwork",
  "ID Project",
  "ชื่อ Project",
  "id_Contractor",
  "ชื่อ-นามสกุล",
  "เลขบัญชี",
  "ธนาคาร",
  "ยอดเงินจ้าง",
  "ยอดเงินจ่าย",
  "ค่าแรงคงเหลือ",
  "รายละเอียดงาน",
  "สถานที่",
  "วันที่",
  "เบอร์โทรศัพท์",
  "ที่อยู่"
];

const RELATED_COLUMNS = [
  "ลำดับ",
  "ID Project",
  "ชื่อ Project",
  "ร้าน/บุคคล",
  "สินค้า/ทำงาน",
  "บิล",
  "ประเภท",
  "ยอดเงิน",
  "ผู้เบิก",
  "ว/ด/ป",
  "สถานะ"
];

export default async function ContractDetailPage({ params }: ContractDetailPageProps) {
  const { contractId } = await params;
  const decodedContractId = decodeURIComponent(contractId).trim();

  const [contractRows, rawDataRows, contractorRows, peopleRows, projectRows] = await Promise.all([
    getRows(TABLES.CONTRACT_WORK, 15_000).then(rows => hydrateContractRows(rows)).catch(() => []),
    getRows(TABLES.DATA, 15_000).catch(() => []),
    getRows(TABLES.CONTRACTOR, 15_000).catch(() => []),
    getRows(TABLES.PEOPLE, 15_000).catch(() => []),
    getRows(TABLES.PROJECT, 15_000).catch(() => [])
  ]);

  const formPayload = await getFormPayload(TABLES.CONTRACT_WORK, {
    [TABLES.CONTRACT_WORK]: contractRows,
    [TABLES.PROJECT]: projectRows,
    [TABLES.CONTRACTOR]: contractorRows,
    [TABLES.DATA]: rawDataRows
  }).catch(() => null);

  const dataRows = await hydrateBillRows(rawDataRows);
  const rawContract = contractRows.find(row => String(row.id_Conwork || "").trim() === decodedContractId);
  if (!rawContract) notFound();

  // Merge contractor details if available
  const contractor = contractorRows.find(c => String(c.id_Contractor || "").trim() === String(rawContract.id_Contractor || "").trim());
  const contract: SheetRow = {
    ...rawContract,
    "ชื่อเล่น": rawContract["ชื่อเล่น"] || contractor?.["ชื่อเล่น"] || "",
    "ชื่อ-นามสกุล": rawContract["ชื่อ-นามสกุล"] || contractor?.["ชื่อ-นามสกุล"] || "",
    "เลขบัญชี": rawContract["เลขบัญชี"] || contractor?.["เลขบัญชี"] || "",
    "ธนาคาร": rawContract["ธนาคาร"] || contractor?.["ธนาคาร"] || "",
    "บัตรประจำตัวประชาชน": rawContract["บัตรประจำตัวประชาชน"] || contractor?.["บัตรประจำตัวประชาชน"] || "",
    "เบอร์โทรศัพท์": rawContract["เบอร์โทรศัพท์"] || contractor?.["เบอร์โทรศัพท์"] || "",
    "ที่อยู่": rawContract["ที่อยู่"] || contractor?.["ที่อยู่"] || "",
  };

  const relatedRows: SheetRow[] = dataRows
    .filter(row => relatedToContract(row, decodedContractId, contract) && isCommittedBill(row))
    .map(row => ({
      ...row,
      "ผู้รับเหมา": row["ผู้รับเหมา"] || contract["ชื่อเล่น"] || contract["ชื่อ-นามสกุล"] || row["ร้าน/บุคคล"] || "-",
      "ผู้เบิก": resolveRequesterName(row["ผู้เบิก"], peopleRows)
    }));
  const displayName = valueOf(contract, ["ชื่อเล่น", "ชื่อ-นามสกุล", "id_Contractor"]) || decodedContractId;
  const projectName = valueOf(contract, ["ชื่อ Project", "ID Project"]) || "-";
  const paidBills = relatedRows.filter(r => {
    const st = String(r["สถานะ"] || r.status || "").trim().toLowerCase();
    return st.includes("เบิกแล้ว") || st === "paid" || st === "withdrawn" || Boolean(r.paid_date) || Boolean(r.paid_at);
  });
  const pendingBills = relatedRows.filter(r => !paidBills.includes(r));
  const calculatedPaid = paidBills.reduce((sum, r) => sum + (toAmount(r["ค่าแรง"]) || toAmount(r["ยอดเงิน"]) || toAmount(r["ยอดโอน"])), 0);
  const pendingAmount = pendingBills.reduce((sum, r) => sum + (toAmount(r["ค่าแรง"]) || toAmount(r["ยอดเงิน"]) || toAmount(r["ยอดโอน"])), 0);

  const total = toAmount(valueOf(contract, ["ยอดเงินจ้าง"]));
  const paid = calculatedPaid;
  const remaining = total - paid;
  const payPercent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  // Sync to contract fields for left-hand detail table
  contract["ยอดเงินจ่าย"] = paid;
  contract["ค่าแรงคงเหลือ"] = remaining;

  return (
    <div className="w-full flex flex-col gap-4 p-4 sm:p-5 max-w-[1400px] mx-auto font-sans text-sm text-slate-800">

      {/* HEADER ROW */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/contract-open"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft size={14} />
            <span>รายการเปิดจ้าง</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-700">{decodedContractId}</span>
        </div>
        <ContractDetailEditButton row={contract} form={formPayload} />
      </div>

      {/* TITLE & META */}
      <div>
        <h1 className="text-lg text-slate-900">{displayName}</h1>
        <p className="text-xs text-slate-500 mt-0.5">โครงการ: <span className="text-slate-700">{projectName}</span></p>
      </div>

      {/* FINANCIAL SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="border border-slate-200 rounded-xl md:rounded-md p-3 sm:p-4 bg-white shadow-2xs">
          <div className="text-xs text-slate-400 font-medium mb-0.5">ยอดเงินจ้างรวม</div>
          <div className="text-base sm:text-lg text-slate-900">{money(total)}</div>
        </div>

        <div className="border border-slate-200 rounded-xl md:rounded-md p-3 sm:p-4 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-0.5">
            <span>ยอดจ่ายแล้ว</span>
            <span className="text-emerald-700 font-medium">{payPercent}%</span>
          </div>
          <div className="text-base sm:text-lg text-emerald-700">{money(paid)}</div>
          <div className="mt-1.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${payPercent}%` }} />
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl md:rounded-md p-3 sm:p-4 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-0.5">
            <span>ค่าแรงคงเหลือ</span>
            {pendingAmount > 0 && (
              <span className="text-amber-600 font-normal">รอจ่าย {money(pendingAmount)}</span>
            )}
          </div>
          <div className={`text-base sm:text-lg ${remaining < 0 ? "text-rose-600" : "text-amber-700"}`}>
            {money(remaining)}
            {remaining < 0 && <span className="text-xs text-rose-500 ml-1">จ่ายเกิน</span>}
          </div>
        </div>
      </div>

      {/* DETAIL + RELATED BILLS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Left: Contract Info Table */}
        <div className="lg:col-span-4 border border-slate-200 rounded-md bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xs text-slate-700">ข้อมูลสัญญาและผู้รับเหมา</h2>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {DETAIL_FIELDS.map(field => {
                const val = contract[field];
                const isAmount = amountField(field);
                return (
                  <tr key={field}>
                    <td className="px-3 py-2 text-slate-500 font-medium whitespace-nowrap w-[38%]">{field}</td>
                    <td className={`px-3 py-2 ${isAmount ? "text-indigo-700" : "text-slate-800"}`}>
                      {formatDetailValue(field, val)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right: Related Bills */}
        <div className="lg:col-span-8">
          <DataTable
            columns={RELATED_COLUMNS}
            rows={relatedRows}
            title="รายการบิลเบิกจ่ายที่เกี่ยวข้อง"
            subtitle={`ประวัติบิลเบิกจ่ายภายใต้สัญญา ${decodedContractId}`}
            rowLabel="รายการ"
            limit={50}
          />
        </div>
      </div>
    </div>
  );
}

function relatedToContract(row: SheetRow, contractId: string, contract?: SheetRow) {
  const cId = contractId.trim().toLowerCase();
  if (!cId) return false;

  const rawContractorRef = String(
    row["_rawContractor"] || row["_rawVendor"] || row["id_Conwork"] || row.conwork_id || row["ผู้รับเหมา"] || row["ร้าน/บุคคล"] || ""
  ).trim().toLowerCase();

  const vendorOrPerson = String(row["ร้าน/บุคคล"] || row.vendor_or_person || "").trim().toLowerCase();
  const contractorField = String(row["ผู้รับเหมา"] || row.contractor_id || "").trim().toLowerCase();
  const conworkField = String(row["id_Conwork"] || row.conwork_id || "").trim().toLowerCase();
  const detailsField = String(row["รายละเอียดงาน"] || row["สินค้า/ทำงาน"] || row.description || "").trim().toLowerCase();

  // If this bill explicitly specifies a DIFFERENT CW contract ID (e.g. CW940969 while viewing CW940967), exclude it!
  const allRefs = [rawContractorRef, contractorField, vendorOrPerson, conworkField, detailsField];
  const explicitCwRef = allRefs.map(r => r.match(/cw\d+/i)?.[0]?.toLowerCase()).find(Boolean);

  if (explicitCwRef) {
    return explicitCwRef === cId;
  }

  // If no explicit CW... ID, match by exact contract ID
  if (
    vendorOrPerson === cId ||
    contractorField === cId ||
    conworkField === cId ||
    (cId.length >= 4 && detailsField.includes(cId))
  ) {
    return true;
  }

  // Match by contractor name & project ONLY if no explicit contract ID is present
  if (contract) {
    const contractorId = String(contract["id_Contractor"] || contract.id_Contractor || "").trim().toLowerCase();
    const nickname = String(contract["ชื่อเล่น"] || "").trim().toLowerCase();
    const fullName = String(contract["ชื่อ-นามสกุล"] || "").trim().toLowerCase();
    const projectId = String(contract["ID Project"] || contract.project_id || "").trim().toLowerCase();
    const rowProjId = String(row["ID Project"] || row.project_id || "").trim().toLowerCase();

    const matchesContractor = Boolean(
      (contractorId && (vendorOrPerson === contractorId || contractorField === contractorId)) ||
      (nickname && (vendorOrPerson === nickname || contractorField === nickname || (nickname.length >= 3 && detailsField.includes(nickname)))) ||
      (fullName && (vendorOrPerson === fullName || contractorField === fullName))
    );

    const matchesProject = Boolean(!projectId || !rowProjId || rowProjId === projectId);

    if (matchesContractor && matchesProject) {
      return true;
    }
  }

  return false;
}

function valueOf(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function toAmount(value: string) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountField(field: string) {
  return /ยอด|เงิน|ค่าแรง/.test(field);
}

function formatDetailValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (field === "วันที่" || field === "ว/ด/ป" || field === "date") return formatDateDisplay(value);
  if (amountField(field)) return money(toAmount(String(value)));
  return String(value);
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
    return nickname || fullName || str;
  }

  return str;
}
