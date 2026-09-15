import type { SheetRow } from "@/lib/types";

/**
 * Escapes a cell value for standard CSV format (RFC 4180)
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val).trim();
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Client-side Data Export Utility for Excel / CSV
 * Generates properly encoded CSV files with UTF-8 BOM (\uFEFF)
 * ensuring Thai characters display correctly in Microsoft Excel on Windows.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  if (typeof window === "undefined") return;

  const headerLine = headers.map(escapeCsvValue).join(",");
  const rowLines = rows.map((row) => row.map(escapeCsvValue).join(","));
  const csvContent = [headerLine, ...rowLines].join("\r\n");

  // \uFEFF is the UTF-8 Byte Order Mark (BOM) needed by Excel to detect UTF-8 encoding
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  const finalFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.setAttribute("download", finalFilename);
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 150);
}

export type CsvColumnConfig = {
  header: string;
  key: string;
  format?: (value: any, row: SheetRow) => string;
};

export const DEFAULT_BILL_EXPORT_COLUMNS: CsvColumnConfig[] = [
  { header: "ลำดับ", key: "ลำดับ" },
  { header: "ว/ด/ป", key: "ว/ด/ป" },
  { header: "สถานะ", key: "สถานะ" },
  { header: "ชื่อ Project", key: "ชื่อ Project" },
  { header: "ร้าน/บุคคล", key: "ร้าน/บุคคล" },
  { header: "ร้านค้า/ผู้รับเหมา", key: "ร้านค้า/ผู้รับเหมา" },
  { header: "ประเภท", key: "ประเภท" },
  { header: "รายการ", key: "รายการ" },
  { header: "สินค้า/ทำงาน", key: "สินค้า/ทำงาน" },
  { header: "ยอดเงิน", key: "ยอดเงิน" },
  { header: "ยอดโอน", key: "ยอดโอน" },
  { header: "ค่าของ", key: "ค่าของ" },
  { header: "ค่าแรง", key: "ค่าแรง" },
  { header: "พนักงาน", key: "พนักงาน" },
  { header: "น้ำมัน", key: "น้ำมัน" },
  { header: "ซ่อมรถ", key: "ซ่อมรถ" },
  { header: "เครื่องจักร", key: "เครื่องจักร" },
  { header: "เครื่องมือ", key: "เครื่องมือ" },
  { header: "อื่นๆ", key: "อื่นๆ" },
  { header: "Vat 7%", key: "Vat 7%" },
  { header: "หัก ณ ที่จ่าย 3%", key: "หัก ณ ที่จ่าย 3%" },
  { header: "ผู้เบิก", key: "ผู้เบิก" },
  { header: "ผู้สร้างบิล", key: "ผู้สร้างบิล" },
  { header: "วันได้บิล", key: "วันได้บิล" },
  { header: "วันออก 3%", key: "วันออก 3%" },
  { header: "วันจ่าย", key: "วันจ่าย" },
  { header: "หมายเหตุ", key: "หมายเหตุ" },
];

/**
 * Generates and downloads a CSV file with Thai UTF-8 BOM encoding asynchronously
 */
export async function exportBillsToCsvAsync(
  rows: SheetRow[],
  filename = "รายงานบิล.csv",
  columns: CsvColumnConfig[] = DEFAULT_BILL_EXPORT_COLUMNS,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  if (typeof window === "undefined" || !rows || rows.length === 0) return false;

  return new Promise((resolve) => {
    const chunkSize = 200;
    const totalRows = rows.length;
    let currentRowIdx = 0;
    const csvLines: string[] = [];

    const headerLine = columns.map(col => escapeCsvValue(col.header)).join(",");
    csvLines.push(headerLine);

    function processChunk() {
      const endIdx = Math.min(currentRowIdx + chunkSize, totalRows);

      for (let i = currentRowIdx; i < endIdx; i++) {
        const row = rows[i];
        const line = columns.map(col => {
          const rawVal = row[col.key] ?? (row as any)[col.key.toLowerCase()] ?? "";
          if (col.format) {
            return escapeCsvValue(col.format(rawVal, row));
          }
          return escapeCsvValue(rawVal);
        }).join(",");
        csvLines.push(line);
      }

      currentRowIdx = endIdx;
      if (onProgress) {
        onProgress(Math.round((currentRowIdx / totalRows) * 100));
      }

      if (currentRowIdx < totalRows) {
        requestAnimationFrame(processChunk);
      } else {
        const csvContent = "\uFEFF" + csvLines.join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        resolve(true);
      }
    }

    processChunk();
  });
}
