import { uploadFileToSupabaseStorage } from "@/lib/supabase/supabase-db";
import { getTodayDateIso } from "@/lib/utils/dates";

type UploadBillImageContext = {
  sequence?: string;
  projectId?: string;
  billDate?: string;
};

type UploadTableImageContext = {
  tableName: string;
  rowKey?: string;
  columnName?: string;
};

function buildBillFileName(originalName: string, context: UploadBillImageContext = {}): string {
  const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const dateStr = context.billDate || getTodayDateIso();
  const seq = context.sequence ? `_seq${context.sequence}` : "";
  const proj = context.projectId ? `_${context.projectId}` : "";
  const rand = Math.floor(Math.random() * 10000);
  return `bill_${dateStr}${proj}${seq}_${rand}.${ext}`;
}

function buildTableFileName(originalName: string, context: UploadTableImageContext): string {
  const extMatch = originalName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const table = (context.tableName || "table").toLowerCase();
  const rand = Math.floor(Math.random() * 10000);
  return `${table}_${Date.now()}_${rand}.${ext}`;
}

/**
 * Uploads bill image file 100% to Supabase Storage ("repairs" bucket)
 */
export async function uploadBillImage(file: File, context: UploadBillImageContext = {}): Promise<string> {
  const fileName = buildBillFileName(file.name, context);
  return await uploadFileToSupabaseStorage("repairs", fileName, file);
}

/**
 * Uploads table attachment image file 100% to Supabase Storage ("repairs" bucket)
 */
export async function uploadTableImage(file: File, context: UploadTableImageContext): Promise<string> {
  const fileName = buildTableFileName(file.name, context);
  return await uploadFileToSupabaseStorage("repairs", fileName, file);
}

