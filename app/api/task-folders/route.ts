import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getAllTaskAttachments, getAllWorkAttachments, saveTaskAttachment, saveWorkAttachment } from "@/lib/tasks/task-attachments";
import { uploadFileToSupabaseStorage } from "@/lib/supabase/supabase-db";

export const dynamic = "force-dynamic";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function formatThaiMonth(dateStr?: string): { label: string; key: string } {
  if (!dateStr) {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const thaiYear = y + 543;
    return { label: `${THAI_MONTHS[m]} ${thaiYear} (${y})`, key: `${y}-${String(m + 1).padStart(2, "0")}` };
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return { label: "ไม่ระบุเดือน", key: "unknown" };
    }
    const m = d.getMonth();
    const y = d.getFullYear();
    const thaiYear = y + 543;
    return { label: `${THAI_MONTHS[m]} ${thaiYear} (${y})`, key: `${y}-${String(m + 1).padStart(2, "0")}` };
  } catch {
    return { label: "ไม่ระบุเดือน", key: "unknown" };
  }
}

function getFileType(url: string): "image" | "pdf" | "excel" | "word" | "other" {
  const lower = url.toLowerCase();
  if (lower.match(/\.(jpeg|jpg|png|gif|webp|svg)/i)) return "image";
  if (lower.match(/\.pdf/i)) return "pdf";
  if (lower.match(/\.(xlsx|xls|csv)/i)) return "excel";
  if (lower.match(/\.(docx|doc)/i)) return "word";
  return "other";
}

function extractFileName(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split("/");
    const last = pathParts[pathParts.length - 1];
    return decodeURIComponent(last) || fallback;
  } catch {
    const parts = url.split("/");
    return parts[parts.length - 1] || fallback;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch tasks
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .order("id", { ascending: false });

    // 2. Fetch task attachments from system_options
    const taskAttachments = await getAllTaskAttachments();

    // 3. Fetch works and work attachments
    const { data: works } = await supabaseAdmin
      .from("works")
      .select("*")
      .order("id", { ascending: false });
    const workAttachments = await getAllWorkAttachments();

    // 4. Assemble items
    const itemsMap: Record<string, any> = {};

    // Process Tasks
    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        const taskIdStr = String(t.id);
        const attach = taskAttachments[taskIdStr];
        const imgs = Array.isArray(attach?.images) ? attach.images.filter(Boolean) : [];
        if (t.image_url && !imgs.includes(t.image_url)) imgs.push(t.image_url);

        const contractor = (t.assignee_name || attach?.submittedBy || "ไม่ระบุผู้รับเหมา").trim();
        const project = (
          attach?.project ||
          t.data?.project ||
          t.data?.project_name ||
          t.data?.Project ||
          "โครงการทั่วไป"
        ).trim();

        const dateRef = t.send_date || t.do_date || attach?.submittedAt || t.created_at;
        const monthInfo = formatThaiMonth(dateRef);

        const files = imgs.map((url: string, idx: number) => ({
          url,
          name: extractFileName(url, `ไฟล์_${idx + 1}`),
          type: getFileType(url),
          uploadedAt: attach?.submittedAt || t.created_at || new Date().toISOString(),
          submittedBy: attach?.submittedBy || t.assignee_name || "ระบบ",
          note: attach?.note || "",
          taskId: t.id,
          taskType: "task",
          taskTitle: t.title || `งาน #${t.id}`,
          contractor,
          project,
          month: monthInfo.label,
          status: t.status || "ดำเนินการ"
        }));

        itemsMap[`task_${t.id}`] = {
          id: `task_${t.id}`,
          rawId: t.id,
          type: "task",
          title: t.title || `งาน #${t.id}`,
          displayTitle: `[#${t.id}] ${t.title || "งานทั่วไป"}`,
          contractor,
          project,
          month: monthInfo.label,
          monthKey: monthInfo.key,
          status: t.status || "ดำเนินการ",
          doDate: t.do_date,
          sendDate: t.send_date,
          createdAt: t.created_at,
          submittedAt: attach?.submittedAt,
          submittedBy: attach?.submittedBy || t.assignee_name,
          note: attach?.note,
          files,
          fileCount: files.length
        };
      }
    }

    // Process Works (PW)
    if (works && works.length > 0) {
      for (const w of works) {
        const workIdStr = String(w.id);
        const attach = workAttachments[workIdStr];
        const imgs = Array.isArray(attach?.images) ? attach.images.filter(Boolean) : [];
        if (w.image_url && !imgs.includes(w.image_url)) imgs.push(w.image_url);

        const contractor = (w.contact1 || w.company || attach?.submittedBy || `ทีม ${w.team || "PW"}`).trim();
        const project = (w.location || (attach as any)?.project || "งานโครงการ PW").trim();
        const dateRef = w.date_inspect || w.date_propose || attach?.submittedAt || w.created_at;
        const monthInfo = formatThaiMonth(dateRef);

        const files = imgs.map((url: string, idx: number) => ({
          url,
          name: extractFileName(url, `ไฟล์_PW_${idx + 1}`),
          type: getFileType(url),
          uploadedAt: attach?.submittedAt || w.created_at || new Date().toISOString(),
          submittedBy: attach?.submittedBy || contractor,
          note: attach?.note || w.note || "",
          taskId: `PW-${w.id}`,
          taskType: "work",
          taskTitle: w.title || `งาน PW #${w.id}`,
          contractor,
          project,
          month: monthInfo.label,
          status: w.status || "รอดูงาน"
        }));

        itemsMap[`work_${w.id}`] = {
          id: `work_${w.id}`,
          rawId: `PW-${w.id}`,
          type: "work",
          title: w.title || `งาน PW #${w.id}`,
          displayTitle: `[PW-${w.id}] ${w.title || "งานรับเหมา"}`,
          contractor,
          project,
          month: monthInfo.label,
          monthKey: monthInfo.key,
          status: w.status || "รอดูงาน",
          createdAt: w.created_at,
          submittedAt: attach?.submittedAt,
          submittedBy: attach?.submittedBy || contractor,
          note: attach?.note || w.note,
          files,
          fileCount: files.length
        };
      }
    }

    // 5. Build Hierarchy Tree: Contractor > Project > Month > Task > Files
    const tree: Record<string, any> = {};
    const flatFiles: any[] = [];

    for (const itemKey of Object.keys(itemsMap)) {
      const item = itemsMap[itemKey];
      const { contractor, project, month, files } = item;

      // Add to flat files
      if (files && files.length > 0) {
        flatFiles.push(...files);
      }

      // 1. Contractor Level
      if (!tree[contractor]) {
        tree[contractor] = {
          name: contractor,
          type: "contractor",
          projects: {},
          totalTasks: 0,
          totalFiles: 0
        };
      }
      tree[contractor].totalTasks += 1;
      tree[contractor].totalFiles += files.length;

      // 2. Project Level
      if (!tree[contractor].projects[project]) {
        tree[contractor].projects[project] = {
          name: project,
          contractor,
          type: "project",
          months: {},
          totalTasks: 0,
          totalFiles: 0
        };
      }
      tree[contractor].projects[project].totalTasks += 1;
      tree[contractor].projects[project].totalFiles += files.length;

      // 3. Month Level
      if (!tree[contractor].projects[project].months[month]) {
        tree[contractor].projects[project].months[month] = {
          name: month,
          monthKey: item.monthKey,
          project,
          contractor,
          type: "month",
          tasks: [],
          totalFiles: 0
        };
      }
      tree[contractor].projects[project].months[month].tasks.push(item);
      tree[contractor].projects[project].months[month].totalFiles += files.length;
    }

    // Stats
    const totalContractors = Object.keys(tree).length;
    let totalProjectsCount = 0;
    Object.values(tree).forEach((c: any) => {
      totalProjectsCount += Object.keys(c.projects).length;
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalContractors,
        totalProjects: totalProjectsCount,
        totalTasks: Object.keys(itemsMap).length,
        totalFiles: flatFiles.length
      },
      tree,
      items: Object.values(itemsMap),
      flatFiles
    });
  } catch (err: any) {
    console.error("Error building task folders:", err);
    return NextResponse.json({ error: err.message || "Failed to load task folders" }, { status: 500 });
  }
}

// POST: Upload a file into a specific task folder
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const taskIdStr = String(formData.get("taskId") || formData.get("id") || "").trim();
    const isWork = taskIdStr.toUpperCase().startsWith("PW");
    const cleanId = parseInt(taskIdStr.replace(/\D/g, ""), 10);
    const submittedBy = String(formData.get("submittedBy") || "").trim() || "ผู้ดูแลระบบ";
    const note = String(formData.get("note") || "").trim();

    if (!cleanId) {
      return NextResponse.json({ error: "Missing task ID" }, { status: 400 });
    }

    const files = formData.getAll("files") as File[];
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const safeName = isWork
          ? `work_${cleanId}_folder_${Date.now()}_${i + 1}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
          : `task_${cleanId}_folder_${Date.now()}_${i + 1}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

        const url = await uploadFileToSupabaseStorage("repairs", safeName, buffer, file.type || "application/octet-stream");
        if (url) uploadedUrls.push(url);
      }
    }

    if (isWork) {
      const existing = await getAllWorkAttachments();
      const rec = existing[String(cleanId)] || { workId: cleanId, images: [] };
      const currentImgs = Array.isArray(rec.images) ? rec.images : [];
      rec.images = Array.from(new Set([...currentImgs, ...uploadedUrls]));
      rec.submittedBy = submittedBy || rec.submittedBy;
      rec.submittedAt = new Date().toISOString();
      if (note) rec.note = note;
      await saveWorkAttachment(rec);
    } else {
      const existing = await getAllTaskAttachments();
      const rec = existing[String(cleanId)] || { taskId: cleanId, images: [] };
      const currentImgs = Array.isArray(rec.images) ? rec.images : [];
      rec.images = Array.from(new Set([...currentImgs, ...uploadedUrls]));
      rec.submittedBy = submittedBy || rec.submittedBy;
      rec.submittedAt = new Date().toISOString();
      if (note) rec.note = note;
      await saveTaskAttachment(rec);
    }

    return NextResponse.json({
      success: true,
      uploadedUrls,
      message: `อัปโหลดสำเร็จ ${uploadedUrls.length} ไฟล์`
    });
  } catch (err: any) {
    console.error("Error uploading to task folder:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}

function extractStorageKey(url: string, bucket = "repairs"): string | null {
  try {
    const u = new URL(url);
    const marker = `/${bucket}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(u.pathname.substring(idx + marker.length));
    }
    const parts = u.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

// DELETE: Remove a file URL or all files from task attachments and Supabase storage
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskIdStr = String(searchParams.get("taskId") || "").trim();
    const fileUrl = String(searchParams.get("fileUrl") || "").trim();
    const deleteAll = searchParams.get("deleteAll") === "true";
    const isWork = taskIdStr.toUpperCase().startsWith("PW");
    const cleanId = parseInt(taskIdStr.replace(/\D/g, ""), 10);

    if (!cleanId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    if (!deleteAll && !fileUrl) {
      return NextResponse.json({ error: "Missing fileUrl" }, { status: 400 });
    }

    const filesToDeleteFromStorage: string[] = [];

    if (isWork) {
      const existing = await getAllWorkAttachments();
      const rec = existing[String(cleanId)];
      if (rec && Array.isArray(rec.images)) {
        if (deleteAll) {
          rec.images.forEach((url) => {
            const key = extractStorageKey(url, "repairs");
            if (key) filesToDeleteFromStorage.push(key);
          });
          rec.images = [];
        } else {
          const key = extractStorageKey(fileUrl, "repairs");
          if (key) filesToDeleteFromStorage.push(key);
          rec.images = rec.images.filter((img) => img !== fileUrl);
        }
        await saveWorkAttachment(rec);
      }

      // Also clear work image_url in works table if matched
      if (deleteAll) {
        await supabaseAdmin.from("works").update({ image_url: null }).eq("id", cleanId);
      } else {
        const { data: currentWork } = await supabaseAdmin.from("works").select("image_url").eq("id", cleanId).single();
        if (currentWork?.image_url === fileUrl) {
          await supabaseAdmin.from("works").update({ image_url: null }).eq("id", cleanId);
        }
      }
    } else {
      const existing = await getAllTaskAttachments();
      const rec = existing[String(cleanId)];
      if (rec && Array.isArray(rec.images)) {
        if (deleteAll) {
          rec.images.forEach((url) => {
            const key = extractStorageKey(url, "repairs");
            if (key) filesToDeleteFromStorage.push(key);
          });
          rec.images = [];
        } else {
          const key = extractStorageKey(fileUrl, "repairs");
          if (key) filesToDeleteFromStorage.push(key);
          rec.images = rec.images.filter((img) => img !== fileUrl);
        }
        await saveTaskAttachment(rec);
      }

      // Also clear task image_url in tasks table if matched
      if (deleteAll) {
        await supabaseAdmin.from("tasks").update({ image_url: null }).eq("id", cleanId);
      } else {
        const { data: currentTask } = await supabaseAdmin.from("tasks").select("image_url").eq("id", cleanId).single();
        if (currentTask?.image_url === fileUrl) {
          await supabaseAdmin.from("tasks").update({ image_url: null }).eq("id", cleanId);
        }
      }
    }

    // Physically delete files from Supabase Storage bucket
    if (filesToDeleteFromStorage.length > 0) {
      try {
        await supabaseAdmin.storage.from("repairs").remove(filesToDeleteFromStorage);
      } catch (storageErr) {
        console.warn("Could not delete from storage bucket:", storageErr);
      }
    }

    const msg = deleteAll ? "ลบไฟล์ทั้งหมดในโฟลเดอร์นี้เรียบร้อยแล้ว" : "ลบไฟล์ออกจากระบบเรียบร้อยแล้ว";
    return NextResponse.json({ success: true, message: msg });
  } catch (err: any) {
    console.error("Error deleting file:", err);
    return NextResponse.json({ error: err.message || "Delete failed" }, { status: 500 });
  }
}
