import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

export interface TaskAttachmentRecord {
  taskId: number | string;
  images: string[];
  note?: string;
  project?: string;
  projectId?: string;
  project_id?: string;
  submittedBy?: string;
  submittedAt?: string;
  creatorPhone?: string;
  creatorEmpId?: string;
}

export interface WorkAttachmentRecord {
  workId: number | string;
  images: string[];
  note?: string;
  submittedBy?: string;
  submittedAt?: string;
  creatorPhone?: string;
  creatorEmpId?: string;
}

/**
 * Fetch all task attachments map from system_options
 */
export async function getAllTaskAttachments(): Promise<Record<string, TaskAttachmentRecord>> {
  try {
    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "task_attachments")
      .single();

    return (data?.data as Record<string, TaskAttachmentRecord>) || {};
  } catch {
    return {};
  }
}

/**
 * Fetch attachments for a specific task ID
 */
export async function getTaskAttachment(taskId: number | string): Promise<TaskAttachmentRecord | null> {
  const all = await getAllTaskAttachments();
  return all[String(taskId)] || null;
}

/**
 * Save attachments for a task ID
 */
export async function saveTaskAttachment(record: TaskAttachmentRecord): Promise<boolean> {
  try {
    const all = await getAllTaskAttachments();
    const existing = all[String(record.taskId)] || {};
    all[String(record.taskId)] = {
      ...existing,
      ...record,
      images: record.images !== undefined ? record.images : (existing.images || []),
      project: record.project !== undefined ? record.project : existing.project,
      note: record.note !== undefined ? record.note : existing.note,
      submittedAt: record.submittedAt || existing.submittedAt || new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from("system_options")
      .upsert({
        id: "task_attachments",
        data: all,
        updated_at: new Date().toISOString()
      });

    return !error;
  } catch (err) {
    console.error("Error saving task attachment:", err);
    return false;
  }
}

/**
 * Save attachments for multiple task IDs in a single batch read-and-upsert
 */
export async function saveBatchTaskAttachments(records: TaskAttachmentRecord[]): Promise<boolean> {
  if (!records || records.length === 0) return true;
  try {
    const all = await getAllTaskAttachments();
    for (const record of records) {
      all[String(record.taskId)] = {
        ...record,
        submittedAt: record.submittedAt || new Date().toISOString()
      };
    }

    const { error } = await supabaseAdmin
      .from("system_options")
      .upsert({
        id: "task_attachments",
        data: all,
        updated_at: new Date().toISOString()
      });

    return !error;
  } catch (err) {
    console.error("Error saving batch task attachments:", err);
    return false;
  }
}


/**
 * Fetch all work attachments map from system_options
 */
export async function getAllWorkAttachments(): Promise<Record<string, WorkAttachmentRecord>> {
  try {
    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "work_attachments")
      .single();

    return (data?.data as Record<string, WorkAttachmentRecord>) || {};
  } catch {
    return {};
  }
}

/**
 * Fetch attachments for a specific work ID
 */
export async function getWorkAttachment(workId: number | string): Promise<WorkAttachmentRecord | null> {
  const all = await getAllWorkAttachments();
  return all[String(workId)] || null;
}

/**
 * Save attachments for a work ID
 */
export async function saveWorkAttachment(record: WorkAttachmentRecord): Promise<boolean> {
  try {
    const all = await getAllWorkAttachments();
    all[String(record.workId)] = {
      ...record,
      submittedAt: record.submittedAt || new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from("system_options")
      .upsert({
        id: "work_attachments",
        data: all,
        updated_at: new Date().toISOString()
      });

    return !error;
  } catch (err) {
    console.error("Error saving work attachment:", err);
    return false;
  }
}

/**
 * Append a single uploaded image to task attachments
 */
export async function appendTaskAttachmentImage(
  taskId: number | string,
  imageUrl: string,
  submittedBy?: string
): Promise<number> {
  try {
    const all = await getAllTaskAttachments();
    const existing = all[String(taskId)] || { taskId, images: [] };
    const currentImgs = Array.isArray(existing.images) ? [...existing.images] : [];
    if (!currentImgs.includes(imageUrl)) {
      currentImgs.push(imageUrl);
    }
    all[String(taskId)] = {
      ...existing,
      images: currentImgs,
      submittedBy: submittedBy || existing.submittedBy,
      submittedAt: new Date().toISOString()
    };

    await supabaseAdmin.from("system_options").upsert({
      id: "task_attachments",
      data: all,
      updated_at: new Date().toISOString()
    });

    return currentImgs.length;
  } catch (err) {
    console.error("Error appending task attachment image:", err);
    return 0;
  }
}

export interface TaskFileItem {
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
}

/**
 * Append a file (PDF, Word, Excel, Image, etc.) to task attachments
 */
export async function appendTaskAttachmentFile(
  taskId: number | string,
  file: TaskFileItem,
  submittedBy?: string
): Promise<{ totalFiles: number; totalImages: number }> {
  try {
    const all = await getAllTaskAttachments();
    const existing: any = all[String(taskId)] || { taskId, images: [], files: [] };
    const currentImgs: string[] = Array.isArray(existing.images) ? [...existing.images] : [];
    const currentFiles: TaskFileItem[] = Array.isArray(existing.files) ? [...existing.files] : [];

    const isImg = file.type?.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(file.name);
    if (isImg && !currentImgs.includes(file.url)) {
      currentImgs.push(file.url);
    }

    if (!currentFiles.some(f => f.url === file.url)) {
      currentFiles.push({
        ...file,
        uploadedAt: file.uploadedAt || new Date().toISOString()
      });
    }

    all[String(taskId)] = {
      ...existing,
      images: currentImgs,
      files: currentFiles,
      submittedBy: submittedBy || existing.submittedBy,
      submittedAt: new Date().toISOString()
    };

    await supabaseAdmin.from("system_options").upsert({
      id: "task_attachments",
      data: all,
      updated_at: new Date().toISOString()
    });

    return { totalFiles: currentFiles.length, totalImages: currentImgs.length };
  } catch (err) {
    console.error("Error appending task attachment file:", err);
    return { totalFiles: 0, totalImages: 0 };
  }
}

export interface ActiveTaskUploadSession {
  taskId: number | string;
  taskTitle?: string;
  assignee?: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Save active task upload session for LINE user or chat group
 */
export async function setActiveTaskUploadSession(
  sessionKey: string,
  taskId: number | string,
  taskTitle?: string,
  assignee?: string
): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "line_task_upload_sessions")
      .maybeSingle();

    const sessions = (data?.data as Record<string, ActiveTaskUploadSession>) || {};
    sessions[sessionKey] = {
      taskId,
      taskTitle,
      assignee,
      createdAt: Date.now(),
      expiresAt: Date.now() + 2 * 60 * 60 * 1000 // Valid for 2 hours
    };

    await supabaseAdmin.from("system_options").upsert({
      id: "line_task_upload_sessions",
      data: sessions,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error setting task upload session:", err);
  }
}

/**
 * Find active task upload session by session keys
 */
export async function getActiveTaskUploadSession(
  sessionKeys: string[]
): Promise<ActiveTaskUploadSession | null> {
  try {
    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "line_task_upload_sessions")
      .maybeSingle();

    const sessions = (data?.data as Record<string, ActiveTaskUploadSession>) || {};
    const now = Date.now();
    for (const key of sessionKeys) {
      if (!key) continue;
      const s = sessions[key];
      if (s && s.expiresAt > now) {
        return s;
      }
    }
    return null;
  } catch {
    return null;
  }
}


