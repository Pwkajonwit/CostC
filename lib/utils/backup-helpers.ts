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

export function extractAllAttachmentUrls(
  tables: Record<string, any[]>,
  systemOptions?: any
): AttachmentEntry[] {
  const seenUrls = new Set<string>();
  const list: AttachmentEntry[] = [];

  function addUrl(rawUrl: any, tableName: string, rowId: string, field: string) {
    if (!rawUrl) return;
    if (Array.isArray(rawUrl)) {
      for (const item of rawUrl) {
        if (typeof item === "string") {
          addUrl(item, tableName, rowId, field);
        } else if (item && typeof item === "object" && typeof item.url === "string") {
          addUrl(item.url, tableName, rowId, field);
        }
      }
      return;
    }
    if (typeof rawUrl !== "string") return;
    const parts = rawUrl.split(/\s*,\s*|\s*;\s*|\n+/).map((s: string) => s.trim()).filter(Boolean);
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
          const hasExt = /\.(jpg|jpeg|png|webp|gif|pdf|svg|doc|docx|xls|xlsx)$/i.test(baseName);
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
      addUrl(row["รูปถ่ายบิล"], tableName, id, "รูปถ่ายบิล");
      addUrl(row["รูปภาพ"], tableName, id, "รูปภาพ");
      addUrl(row["เอกสาร"], tableName, id, "เอกสาร");
      addUrl(row["ไฟล์แนบ"], tableName, id, "ไฟล์แนบ");
      if (row.data && typeof row.data === "object") {
        addUrl(row.data.image_url, tableName, id, "data.image_url");
        addUrl(row.data.slip_url, tableName, id, "data.slip_url");
        addUrl(row.data["รูปถ่ายบิล"], tableName, id, "data.รูปถ่ายบิล");
        addUrl(row.data["รูปภาพ"], tableName, id, "data.รูปภาพ");
        addUrl(row.data["เอกสาร"], tableName, id, "data.เอกสาร");
        addUrl(row.data["ไฟล์แนบ"], tableName, id, "data.ไฟล์แนบ");
      }
    }
  }

  // Also scan task_attachments and work_attachments inside system_options
  if (systemOptions) {
    const optList = Array.isArray(systemOptions)
      ? systemOptions
      : typeof systemOptions === "object"
      ? Object.entries(systemOptions).map(([id, data]) => ({ id, data }))
      : [];

    for (const opt of optList) {
      const optId = opt?.id;
      const optData = opt?.data ?? opt?.value;
      if ((optId === "task_attachments" || optId === "work_attachments") && optData && typeof optData === "object") {
        const label = optId === "task_attachments" ? "Tasks" : "Works";
        for (const [recordId, rec] of Object.entries(optData as Record<string, any>)) {
          if (!rec || typeof rec !== "object") continue;
          addUrl(rec.images, label, recordId, `${optId}.images`);
          addUrl(rec.files, label, recordId, `${optId}.files`);
        }
      }
    }
  }

  return list;
}
