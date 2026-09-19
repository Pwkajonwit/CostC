import { PettyCashDashboardClient } from "@/components/dashboards/PettyCashDashboardClient";
import { TABLES } from "@/lib/config";
import { getRows } from "@/lib/db";
import { getViewColumns } from "@/lib/views";
import { getFormPayload } from "@/lib/form";
import { cookies } from "next/headers";
import { getRowYear } from "@/lib/utils/dates";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function PettyCashPage() {
  const [rawRows, projectRows, peopleRows, bankRows] = await Promise.all([
    safeRows(TABLES.PETTY_CASH),
    safeRows(TABLES.PROJECT),
    safeRows(TABLES.PEOPLE),
    safeRows(TABLES.BANK),
  ]);

  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("costlab_selected_year")?.value;

  const yearFilteredRawRows = (!selectedYear || selectedYear === "all")
    ? rawRows
    : rawRows.filter((r) => {
        const yr = getRowYear(r);
        return !yr || String(yr) === String(selectedYear);
      });

  const fallback = yearFilteredRawRows[0]
    ? Object.keys(yearFilteredRawRows[0]).filter((column) => !column.startsWith("_"))
    : [
        "id_petty_cash",
        "ผู้เบิก",
        "ID Project",
        "ชื่อ Project",
        "จำนวนเงิน",
        "วัตถุประสงค์",
        "วันที่",
        "กำหนดเคลียร์",
        "สถานะ",
        "เลขบัญชี",
        "ธนาคาร",
        "ยอดเคลียร์แล้ว",
        "ยอดคงเหลือ",
        "สลิป"
      ];
  const columns = getViewColumns("เปิดเงินสดย่อย", fallback);

  const formPayload = await getFormPayload(TABLES.PETTY_CASH, {
    [TABLES.PETTY_CASH]: rawRows,
    [TABLES.PROJECT]: projectRows,
    [TABLES.PEOPLE]: peopleRows,
    [TABLES.BANK]: bankRows,
  }).catch(() => null);

  const projectOptions = projectRows.map((p) => ({
    value: String(p["ID Project"] || p.id || ""),
    label: String(p["ชื่อ Project"] || p.name || p["ID Project"] || "")
  }));

  const peopleOptions = peopleRows.map((u) => ({
    value: String(u["รหัสพนักงาน"] || u.id || ""),
    label: String(u["ชื่อเล่น"] || u["ชื่อ-นามสกุล"] || u["รหัสพนักงาน"] || "")
  }));

  return (
    <PettyCashDashboardClient
      columns={columns}
      initialRows={yearFilteredRawRows}
      form={formPayload}
      projectOptions={projectOptions}
      peopleOptions={peopleOptions}
    />
  );
}

async function safeRows(tableName: string) {
  try {
    return await getRows(tableName);
  } catch {
    return [];
  }
}
