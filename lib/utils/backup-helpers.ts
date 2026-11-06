/**
 * Client and Server safe backup utility helpers
 */

export type AttachmentEntry = {
  url: string;
  tableName: string;
  rowId: string;
  field: string;
  cleanFilename: string;
};

export function extractAllAttachmentUrls(tables: Record<string, any[]>): AttachmentEntry[] {
  const seenUrls = new Set<string>();
  const list: AttachmentEntry[] = [];

  function addUrl(rawUrl: any, tableName: string, rowId: string, field: string) {
    if (!rawUrl || typeof rawUrl !== "string") return;
    const parts = rawUrl.split(",").map((s: string) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("http://") || part.startsWith("https://")) {
        if (!seenUrls.has(part)) {
          seenUrls.add(part);
          let baseName = "";
          try {
            const parsed = new URL(part);
            baseName = parsed.pathname.split("/").pop() || `file_${list.length + 1}`;
            baseName = decodeURIComponent(baseName).split("?")[0].split("#")[0];
          } catch {
            baseName = `file_${list.length + 1}.jpg`;
          }
          baseName = baseName.replace(/[<>:"/\\|?*]/g, "_");
          const hasExt = /\.(jpg|jpeg|png|webp|gif|pdf|svg)$/i.test(baseName);
          if (!hasExt) baseName += ".jpg";
          if (baseName.length > 80) {
            baseName = baseName.slice(0, 70) + (baseName.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg");
          }
          const cleanFilename = `${list.length + 1}_${baseName}`;
          list.push({
            url: part,
            tableName,
            rowId: String(rowId || ""),
            field,
            cleanFilename
          });
        }
      }
    }
  }

  for (const [tableName, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const id = row.id ?? row["ลำดับ"] ?? row.id_bank ?? row.id_car ?? row.id_store ?? row.id_Contractor ?? "";
      addUrl(row.image_url, tableName, id, "image_url");
      addUrl(row.image, tableName, id, "image");
      addUrl(row.pictureurl || row.pictureUrl, tableName, id, "pictureurl");
      addUrl(row.slip_url, tableName, id, "slip_url");
      if (row.data && typeof row.data === "object") {
        addUrl(row.data.image_url, tableName, id, "data.image_url");
        addUrl(row.data.slip_url, tableName, id, "data.slip_url");
      }
    }
  }

  return list;
}
