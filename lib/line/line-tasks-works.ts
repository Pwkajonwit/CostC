import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import {
  replyFlexMessage,
  replyMultipleFlexMessages,
  replyTextMessage,
  replyMultipleTextMessages,
  sendTextMessage,
  sendMultipleTextMessages,
  sendFlexMessageDetailed,
  sendMultipleFlexMessagesDetailed,
  getLineTargetGroup,
} from "./line";
import { normalizeDateToIso, getTodayDateIso, formatDateDisplay, formatDateThai } from "@/lib/utils/dates";
import { getTaskAttachment, getAllTaskAttachments, getAllWorkAttachments, getWorkAttachment, setActiveTaskUploadSession } from "@/lib/tasks/task-attachments";

// ==========================================
// 1. Data Models & Interfaces
// ==========================================

export type WorkCategory = "task" | "pw_work";

export interface UnifiedWorkItem {
  id: string | number;
  category: WorkCategory;
  title: string;
  subDetails?: string;
  assignee: string;
  phone?: string;
  project?: string;
  status: string;
  dateStr: string;
  amount?: number;
  note?: string;
}

export function normalizeTaskItem(t: any): UnifiedWorkItem {
  return {
    id: t.id,
    category: "task",
    title: t.title || "งานประจำวัน",
    assignee: t.assignee_name || "ทีมงาน",
    status: t.status || "กำลังดำเนินการ",
    dateStr: t.do_date
      ? new Date(t.do_date).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })
      : new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" }),
    project: t.project || "งานทั่วไป"
  };
}

export function normalizeWorkItem(w: any): UnifiedWorkItem {
  return {
    id: w.id ? `PW${w.id}` : "PW",
    category: "pw_work",
    title: w.title || "งานรับเหมา",
    subDetails: w.location ? `สถานที่: ${w.location}` : undefined,
    assignee: w.contact1 || "ช่างรับเหมา",
    phone: w.phone1 && w.phone1 !== "-" ? w.phone1 : undefined,
    project: w.company && w.company !== "-" ? w.company : (w.team ? `ทีม ${w.team}` : "งานรับเหมา"),
    status: w.status || "รอดูงาน",
    dateStr: w.date_inspect || w.date_propose || "-",
    amount: w.amount ? Number(w.amount) : undefined,
    note: w.note || undefined
  };
}

// ==========================================
// 2. Flex Message Generators
// ==========================================

/**
 * Single Card: Work Assignment (ใบมอบหมายงาน PW)
 * ออกแบบใหม่: ไม่มีส่วน Header, ไม่มี Emoji, ข้อมูลกระชับ และสบายตา
 */
export function createWorkAssignmentFlex(work: {
  id?: string | number;
  title?: string;
  project_name?: string;
  contractor_name?: string;
  amount?: number;
  details?: string;
  contact?: string;
  phone?: string;
  team?: string;
  activity_type?: string;
  status?: string;
  pr_no?: string;
  location?: string;
  date_inspect?: string;
  date_propose?: string;
  company?: string;
  note?: string;
  image_url?: string;
  images?: string[];
  creator?: string;
  creator_phone?: string;
  is_update?: boolean;
}): Record<string, any> {
  const formattedAmount = Number(work.amount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const displayTitle = work.title || work.details || "งานรับเหมา";
  const rawId = work.id ? String(work.id) : "-";
  const cleanId = rawId.replace(/\D/g, "") || rawId;
  const formattedId = rawId.startsWith("PW-")
    ? rawId
    : rawId.startsWith("PW")
    ? `PW-${rawId.replace(/^PW/i, "")}`
    : cleanId !== "-"
    ? `PW-${cleanId}`
    : rawId;

  const teamLabel = work.team ? (work.team.startsWith("PW") ? work.team : `PW${work.team}`) : "PW";

  const statusRaw = String(work.status || work.activity_type || "รอดูงาน").trim();
  let statusDisplay = statusRaw === "เสนอราคา" ? "รอดูงาน" : statusRaw;
  if (!statusDisplay || statusDisplay === "-") statusDisplay = "รอดูงาน";

  const getStatusBadgeStyle = (st: string) => {
    if (st.includes("รอเสนอ") || st === "เสนอราคา") {
      return { bg: "#F3E8FF", border: "#E9D5FF", text: "#7E22CE" }; // Purple
    }
    if (st.includes("ประชุม")) {
      return { bg: "#DCFCE7", border: "#86EFAC", text: "#15803D" }; // Green
    }
    if (st.includes("ประมูล")) {
      return { bg: "#E0F2FE", border: "#BAE6FD", text: "#0369A1" }; // Blue
    }
    if (st.includes("เสร็จ") || st.includes("สำเร็จ")) {
      return { bg: "#F1F5F9", border: "#CBD5E1", text: "#475569" }; // Gray
    }
    // รอดูงาน / Default
    return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" }; // Yellow/Cream
  };
  const statusStyle = getStatusBadgeStyle(statusDisplay);

  const rows: any[] = [];

  const addRow = (label: string, value?: string, isPhone = false) => {
    if (!value || value === "-" || value.trim() === "") return;
    const cleanVal = value.trim();
    const phoneDigits = cleanVal.replace(/\D/g, "");
    const canCall = isPhone && phoneDigits.length >= 9;

    rows.push({
      type: "box",
      layout: "baseline",
      contents: [
        {
          type: "text",
          text: label,
          color: "#64748B",
          size: "xs",
          flex: 3,
        },
        canCall ? {
          type: "text",
          text: cleanVal,
          color: "#059669",
          size: "xs",
          flex: 7,
          weight: "bold",
          action: {
            type: "uri",
            label: "โทร",
            uri: `tel:${phoneDigits}`,
          },
        } : {
          type: "text",
          text: cleanVal,
          color: "#1E293B",
          size: "xs",
          flex: 7,
          wrap: true,
        },
      ],
    });
  };

  const companyOrProject = (work.company && work.company !== "-")
    ? work.company
    : (work.project_name && work.project_name !== "-" && !work.project_name.startsWith("ทีม") ? work.project_name : undefined);

  addRow("สถานที่", work.location);
  addRow("บริษัท", companyOrProject);
  addRow("เลขที่ PR", work.pr_no);
  let inspectDisplay = work.date_inspect;
  if (inspectDisplay && inspectDisplay !== "-" && !inspectDisplay.includes(":")) {
    inspectDisplay = `${inspectDisplay} เวลา 10:00 น.`;
  }
  addRow("นัดดูหน้างาน", inspectDisplay);
  let proposeDisplay = work.date_propose;
  if (proposeDisplay && proposeDisplay !== "-" && !proposeDisplay.includes(":")) {
    proposeDisplay = `${proposeDisplay} เวลา 10:00 น.`;
  }
  addRow("นัดส่งเสนอ", proposeDisplay);
  addRow("ผู้รับเหมา", work.contractor_name || work.contact);
  addRow("เบอร์โทร", work.phone, true);
  if (work.creator) {
    const creatorDisplay = work.creator_phone && work.creator_phone !== "-"
      ? `${work.creator} (${work.creator_phone})`
      : work.creator;
    addRow("ผู้เปิดงาน", creatorDisplay);
  }
  if (work.details && work.details !== displayTitle && !work.details.startsWith(displayTitle)) {
    addRow("รายละเอียด", work.details);
  }
  addRow("หมายเหตุ", work.note);

  const topBadges: any[] = [
    {
      type: "box",
      layout: "horizontal",
      flex: 0,
      backgroundColor: "#ECFDF5",
      borderColor: "#A7F3D0",
      borderWidth: "1px",
      cornerRadius: "4px",
      paddingStart: "7px",
      paddingEnd: "7px",
      paddingTop: "2px",
      paddingBottom: "2px",
      alignItems: "center",
      contents: [
        {
          type: "text",
          text: teamLabel,
          color: "#047857",
          size: "xxs",
          weight: "bold",
          wrap: false,
        },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      flex: 0,
      backgroundColor: statusStyle.bg,
      borderColor: statusStyle.border,
      borderWidth: "1px",
      cornerRadius: "4px",
      paddingStart: "7px",
      paddingEnd: "7px",
      paddingTop: "2px",
      paddingBottom: "2px",
      alignItems: "center",
      contents: [
        {
          type: "text",
          text: statusDisplay,
          color: statusStyle.text,
          size: "xxs",
          weight: "bold",
          wrap: false,
        },
      ],
    },
  ];

  if (work.is_update) {
    topBadges.push({
      type: "box",
      layout: "horizontal",
      flex: 0,
      backgroundColor: "#EFF6FF",
      borderColor: "#BFDBFE",
      borderWidth: "1px",
      cornerRadius: "4px",
      paddingStart: "7px",
      paddingEnd: "7px",
      paddingTop: "2px",
      paddingBottom: "2px",
      alignItems: "center",
      contents: [
        {
          type: "text",
          text: "อัปเดต",
          color: "#2563EB",
          size: "xxs",
          weight: "bold",
          wrap: false,
        },
      ],
    });
  }

  const bodyContents: any[] = [
    // 1. Top Badges Row (Team, Activity/Status, Update badge, ID)
    {
      type: "box",
      layout: "horizontal",
      alignItems: "center",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "xs",
          flex: 1,
          contents: topBadges,
        },
        {
          type: "box",
          layout: "horizontal",
          flex: 0,
          backgroundColor: "#F8FAFC",
          borderColor: "#E2E8F0",
          borderWidth: "1px",
          cornerRadius: "4px",
          paddingStart: "8px",
          paddingEnd: "8px",
          paddingTop: "2px",
          paddingBottom: "2px",
          contents: [
            {
              type: "text",
              text: formattedId,
              size: "xs",
              color: "#0F172A",
              weight: "bold",
              wrap: false,
            },
          ],
        },
      ],
    },
    // 2. Title
    {
      type: "text",
      text: displayTitle,
      weight: "bold",
      size: "md",
      color: "#0F172A",
      wrap: true,
      margin: "md",
    },
  ];

  // 3. Key-Value Rows
  if (rows.length > 0) {
    bodyContents.push({
      type: "separator",
      margin: "md",
      color: "#F1F5F9",
    });
    bodyContents.push({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      margin: "md",
      contents: rows,
    });
  }

  // 4. Amount (if any)
  if (work.amount && work.amount > 0) {
    bodyContents.push({
      type: "separator",
      margin: "md",
      color: "#F1F5F9",
    });
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      alignItems: "center",
      contents: [
        {
          type: "text",
          text: "ยอดประมาณการ",
          color: "#64748B",
          size: "xs",
        },
        {
          type: "text",
          text: `฿${formattedAmount}`,
          weight: "bold",
          color: "#047857",
          size: "md",
          align: "end",
        },
      ],
    });
  }

  const bubble: Record<string, any> = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      contents: bodyContents,
    },
  };

  // Action Buttons: "อัพเดทข้อมูล" & "ปิด"
  const editUrl = cleanId && cleanId !== "-" ? getLiffUrl(`/quick-work?id=PW-${cleanId}`) : getLiffUrl("/quick-work");

  bodyContents.push({
    type: "separator",
    margin: "md",
    color: "#F1F5F9",
  });

  const actionButtons: any[] = [
    {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#EFF6FF",
      borderColor: "#BFDBFE",
      borderWidth: "1px",
      cornerRadius: "6px",
      paddingStart: "8px",
      paddingEnd: "8px",
      paddingTop: "6px",
      paddingBottom: "6px",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      action: {
        type: "uri",
        label: "อัพเดท",
        uri: editUrl,
      },
      contents: [
        {
          type: "text",
          text: "อัพเดทข้อมูล",
          size: "xs",
          color: "#2563EB",
          weight: "bold",
          align: "center",
        },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#FEF2F2",
      borderColor: "#FECACA",
      borderWidth: "1px",
      cornerRadius: "6px",
      paddingStart: "8px",
      paddingEnd: "8px",
      paddingTop: "6px",
      paddingBottom: "6px",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      action: {
        type: "message",
        label: "ปิด",
        text: `ปิดpw: ${cleanId}`,
      },
      contents: [
        {
          type: "text",
          text: "ปิด",
          size: "xs",
          color: "#DC2626",
          weight: "bold",
          align: "center",
        },
      ],
    },
  ];

  bodyContents.push({
    type: "box",
    layout: "horizontal",
    margin: "md",
    spacing: "xs",
    contents: actionButtons,
  });

  return bubble;
}

let _cachedProjectCodeMap: Record<string, string> | null = null;
let _cachedProjectCodeExpiry = 0;

export async function fetchProjectCodeMap(): Promise<Record<string, string>> {
  if (_cachedProjectCodeMap && Date.now() < _cachedProjectCodeExpiry) {
    return _cachedProjectCodeMap;
  }
  try {
    const { data } = await supabaseAdmin.from("projects").select("id, name");
    const map: Record<string, string> = {};
    if (data) {
      for (const row of data) {
        const id = String(row.id || "").trim();
        const name = String(row.name || "").trim();
        if (name && id) {
          map[name] = id;
          map[name.toLowerCase()] = id;
        }
      }
    }
    _cachedProjectCodeMap = map;
    _cachedProjectCodeExpiry = Date.now() + 5 * 60 * 1000;
    return map;
  } catch {
    return _cachedProjectCodeMap || {};
  }
}

/**
 * Summary List Bubble: Task Summary (สรุปงานค้างที่ต้องดำเนินการ)
 */
export function createTaskSummaryFlex(
  tasks: Array<{
    id: any;
    details: string;
    status: string;
    project?: string;
    project_id?: string;
    projectId?: string;
    assignee_name?: string;
    creator_name?: string;
    note?: string;
    do_date?: string;
    send_date?: string;
    dateStr?: string;
    sendDateStr?: string;
    days?: number;
    task_type?: number | string;
    imageUrl?: string;
    image_url?: string;
    images?: string[];
    title?: string;
  }>,
  options?: {
    attachmentsMap?: Record<string, any>;
    projectCodeMap?: Record<string, string>;
    title?: string;
    subtitle?: string;
    badgeText?: string;
    actionButton?: { label: string; uri: string; color?: string; bgColor?: string };
  }
): Record<string, any> {
  const baseUrl = getAppBaseUrl();
  const summaryTitle = options?.title || (tasks.length > 0 ? `สรุปงานค้าง (${tasks.length} งาน)` : "สรุปงานค้างที่ต้องดำเนินการ");
  const todayIso = getTodayDateIso();

  const docCount = tasks.filter(t => Number(t.task_type) === 1 || String(t.task_type || "").includes("เอกสาร")).length;
  const planCount = tasks.filter(t => Number(t.task_type) === 2 || String(t.task_type || "").includes("แผนงาน")).length;
  const pjsaCount = tasks.filter(t => Number(t.task_type) === 3 || String(t.task_type || "").includes("PJSA")).length;

  const defaultSubtitle = (docCount > 0 || planCount > 0 || pjsaCount > 0)
    ? `รวม ${tasks.length} รายการ (เอกสาร ${docCount} • แผนงาน ${planCount} • PJSA ${pjsaCount})`
    : `ทั้งหมด ${tasks.length} รายการ`;
  const subtitle = options?.subtitle || defaultSubtitle;

  const formatShortDisplay = (isoStr: string, fallbackStr?: string) => {
    if (!isoStr) {
      if (fallbackStr && fallbackStr.includes("/2026")) {
        return fallbackStr.replace("/2026", "/69");
      }
      return fallbackStr || "-";
    }
    const parts = isoStr.split("-");
    if (parts.length === 3) {
      const thYear = String(Number(parts[0]) + 543).slice(-2);
      return `${parts[2]}/${parts[1]}/${thYear}`;
    }
    return fallbackStr || isoStr;
  };

  return {
    type: "bubble",
    size: "giga",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "sm",
      contents: [
        // Top Header Row
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
                  type: "text",
                  text: summaryTitle,
                  weight: "bold",
                  color: "#0F172A",
                  size: "xs",
                  wrap: true,
                },
                {
                  type: "text",
                  text: subtitle,
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: options?.actionButton?.bgColor || "#2563EB",
              cornerRadius: "6px",
              width: "88px",
              paddingTop: "5px",
              paddingBottom: "5px",
              alignItems: "center",
              justifyContent: "center",
              flex: 0,
              action: {
                type: "uri",
                label: options?.actionButton?.label || "เปิดงานใหม่",
                uri: options?.actionButton?.uri || getLiffUrl("/quick-task"),
              },
              contents: [
                {
                  type: "text",
                  text: options?.actionButton?.label ? options.actionButton.label : "+ เปิดงานใหม่",
                  size: "xxs",
                  weight: "bold",
                  color: options?.actionButton?.color || "#FFFFFF",
                  align: "center",
                  wrap: false,
                },
              ],
            },
          ],
        },
        { type: "separator", margin: "xs", color: "#E2E8F0" },
        // Table Column Header Row (ไม่มีไทม์ไลน์)
        {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          contents: [
            { type: "text", text: "รายการทั้งหมด", size: "xxs", weight: "bold", color: "#6B7280", flex: 6 },
            { type: "separator" },
            { type: "text", text: "เริ่ม/เสร็จ", size: "xxs", weight: "bold", color: "#6B7280", flex: 3, align: "center" },
            { type: "separator" },
            { type: "text", text: "วัน", size: "xxs", weight: "bold", color: "#6B7280", flex: 1, align: "center" },
            { type: "separator" },
            { type: "text", text: "สถานะ", size: "xxs", weight: "bold", color: "#6B7280", flex: 3, align: "center" },
          ],
        },
        { type: "separator", margin: "xs" },
        // Table Task Items (Empty Notice or Task Rows)
        ...(tasks.length === 0
          ? [
            {
              type: "box",
              layout: "vertical",
              paddingAll: "16px",
              alignItems: "center",
              contents: [
                {
                  type: "text",
                  text: "ไม่มีรายการงานค้าง ทุกงานดำเนินการเสร็จเรียบร้อยแล้ว",
                  size: "xs",
                  color: "#16A34A",
                  weight: "bold",
                  align: "center",
                },
              ],
            },
          ]
          : tasks.slice(0, 15).map((t, index) => {
            const taskIdStr = String(t.id || index + 100);
            const cleanId = taskIdStr.replace(/\D/g, "") || taskIdStr;

            // 1. Resolve attachments
            const taskAtt = options?.attachmentsMap?.[cleanId] || options?.attachmentsMap?.[taskIdStr];
            const rawImgs = (taskAtt?.images && taskAtt.images.length > 0)
              ? taskAtt.images
              : ((t.images && t.images.length > 0)
                ? t.images
                : (t.imageUrl || t.image_url ? [t.imageUrl || t.image_url] : []));
            const taskImages: string[] = (Array.isArray(rawImgs) ? rawImgs : [rawImgs])
              .filter((s: any) => typeof s === "string" && s.startsWith("http"));

            const uploadUrl = `${baseUrl}/task-upload?id=${cleanId}`;

            // 2. Resolve dates
            let taskStartIso = "";
            if (t.do_date) taskStartIso = normalizeDateToIso(t.do_date);
            else if (t.dateStr) taskStartIso = normalizeDateToIso(t.dateStr);

            let taskEndIso = "";
            if (t.send_date) taskEndIso = normalizeDateToIso(t.send_date);
            else if (t.sendDateStr && t.sendDateStr !== "-") taskEndIso = normalizeDateToIso(t.sendDateStr);

            if (!taskStartIso && taskEndIso) taskStartIso = taskEndIso;
            else if (taskStartIso && !taskEndIso) {
              if (t.days && t.days > 1) {
                const [sy, sm, sd] = taskStartIso.split("-").map(Number);
                const endD = new Date(Date.UTC(sy, sm - 1, sd + (t.days - 1)));
                taskEndIso = `${endD.getUTCFullYear()}-${String(endD.getUTCMonth() + 1).padStart(2, "0")}-${String(endD.getUTCDate()).padStart(2, "0")}`;
              } else {
                taskEndIso = taskStartIso;
              }
            }

            let durationDays = t.days || 1;
            if (taskStartIso && taskEndIso) {
              const startMs = new Date(taskStartIso).getTime();
              const endMs = new Date(taskEndIso).getTime();
              const diff = Math.round((endMs - startMs) / 86400000) + 1;
              if (diff > 0) durationDays = diff;
            }

            const startDisplay = formatShortDisplay(taskStartIso, t.dateStr || "");
            const endDisplay = taskEndIso && taskEndIso !== taskStartIso
              ? formatShortDisplay(taskEndIso, t.sendDateStr || "")
              : (t.sendDateStr && t.sendDateStr !== "-" ? formatShortDisplay("", t.sendDateStr) : "");

            const displayDate = endDisplay ? `${startDisplay}\n${endDisplay}` : (startDisplay || "-");

            const st = String(t.status || "").trim();
            const isDone = st === "เสร็จ" || st === "สำเร็จ" || st === "ปิดงาน";
            const isSent = st === "ส่งงานแล้ว" || st === "ส่งแล้ว" || st === "รอตรวจ";
            const isOverdue = !isDone && Boolean(taskEndIso && taskEndIso < todayIso);

            // Resolve Contractor / Assignee name for the title bracket (ใช้ชื่อผู้รับเหมาเหมือนเดิม)
            const rawAssignee = t.assignee_name || (taskAtt?.submittedBy ? taskAtt.submittedBy.replace(/\s*\(.*\)/, "").trim() : "");
            const taskTitleText = t.details || t.title || "งานประจำวัน";
            const displayTitle = rawAssignee
              ? `[#${cleanId}] [${rawAssignee}] ${taskTitleText}`
              : `[#${cleanId}] ${taskTitleText}`;

            // Resolve Project Code & Name (เอารหัสชื่อโครงการมาอยู่บรรทัดล่างแทน ผู้เปิด)
            const pIdFromTask = String((t as any).project_id || (t as any).projectId || "").trim();
            const pIdFromAtt = String(taskAtt?.project_id || taskAtt?.projectId || "").trim();
            let projectCode = pIdFromTask || pIdFromAtt || "";

            const rawProj = (taskAtt?.project && !taskAtt.project.startsWith("ผู้รับ:"))
              ? taskAtt.project
              : (t.project && !t.project.startsWith("ผู้รับ:") ? t.project : "");
            const projectName = String(rawProj || "").trim();

            if ((!projectCode || projectCode === "0") && projectName && !projectName.includes("ทั่วไป")) {
              const codeMap = options?.projectCodeMap || _cachedProjectCodeMap;
              if (codeMap) {
                projectCode = codeMap[projectName.toLowerCase()] || codeMap[projectName] || "";
              }
              if (!projectCode && !projectName.includes(" ")) {
                projectCode = projectName.replace(/^ผู้รับ:\s*/, "").trim();
              }
            }

            let projectDisplay = "";
            if (projectCode && projectCode !== "0" && !projectCode.includes("ทั่วไป")) {
              projectDisplay = (projectName && projectName !== projectCode)
                ? `[${projectCode}] ${projectName}`
                : `[${projectCode}]`;
            } else if (projectName) {
              projectDisplay = projectName;
            }

            return {
              type: "box",
              layout: "vertical",
              backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
              borderColor: isOverdue ? "#FECACA" : "#E2E8F0",
              borderWidth: "1px",
              cornerRadius: "6px",
              paddingStart: "4px",
              paddingEnd: "4px",
              paddingTop: "6px",
              paddingBottom: "6px",
              margin: "xs",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  spacing: "xs",
                  alignItems: "center",
                  contents: [
                    // Column 1: Task Title + Project Code & Name below
                    {
                      type: "box",
                      layout: "vertical",
                      flex: 6,
                      spacing: "xs",
                      contents: [
                        {
                          type: "text",
                          text: displayTitle,
                          size: "xs",
                          color: "#1F2937",
                          wrap: true,
                          weight: "bold",
                        },
                        ...(projectDisplay ? [
                          {
                            type: "text",
                            text: `โครงการ: ${projectDisplay}`,
                            size: "xxs",
                            color: "#64748B",
                            wrap: true
                          }
                        ] : []),
                        ...(t.note ? [
                          {
                            type: "text",
                            text: `หมายเหตุ: ${t.note}`,
                            size: "xxs",
                            color: "#475569",
                            wrap: true
                          }
                        ] : []),
                        {
                          type: "box",
                          layout: "horizontal",
                          margin: "xs",
                          contents: [
                            {
                              type: "box",
                              layout: "horizontal",
                              backgroundColor: "#F8FAFC",
                              borderColor: "#E2E8F0",
                              borderWidth: "1px",
                              cornerRadius: "4px",
                              paddingStart: "6px",
                              paddingEnd: "6px",
                              paddingTop: "2px",
                              paddingBottom: "2px",
                              alignItems: "center",
                              action: {
                                type: "uri",
                                label: "ถ่ายรูป/แนบ",
                                uri: uploadUrl,
                              },
                              contents: [
                                {
                                  type: "text",
                                  text: taskImages.length > 0 ? `ถ่ายรูป/แนบ (${taskImages.length})` : "ถ่ายรูป/แนบ",
                                  size: "xxs",
                                  color: "#64748B",
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    { type: "separator" },
                    // Column 2: Date
                    {
                      type: "text",
                      text: displayDate,
                      size: "xxs",
                      color: "#6B7280",
                      flex: 3,
                      align: "center",
                      wrap: true,
                    },
                    { type: "separator" },
                    // Column 3: Duration Days
                    {
                      type: "text",
                      text: String(durationDays),
                      size: "xs",
                      color: "#374151",
                      flex: 1,
                      align: "center",
                    },
                    { type: "separator" },
                    // Column 4: Status / Action buttons
                    isDone
                      ? {
                        type: "text",
                        text: "เสร็จ",
                        size: "xxs",
                        color: "#16A34A",
                        flex: 3,
                        align: "center",
                        weight: "bold",
                      }
                      : {
                        type: "box",
                        layout: "horizontal",
                        flex: 3,
                        alignItems: "center",
                        justifyContent: "center",
                        spacing: "xs",
                        contents: [
                          {
                            type: "box",
                            layout: "horizontal",
                            backgroundColor: isSent ? "#F0F9FF" : "#EFF6FF",
                            borderColor: isSent ? "#BAE6FD" : "#BFDBFE",
                            borderWidth: "1px",
                            cornerRadius: "4px",
                            paddingTop: "6px",
                            paddingBottom: "6px",
                            paddingStart: "2px",
                            paddingEnd: "2px",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            action: {
                              type: "message",
                              label: "ส่ง",
                              text: `ส่งงาน: ${cleanId}`,
                            },
                            contents: [
                              {
                                type: "text",
                                text: "ส่ง",
                                size: "xxs",
                                color: isSent ? "#0284C7" : "#2563EB",
                                align: "center",
                                weight: "bold",
                              },
                            ],
                          },
                          {
                            type: "box",
                            layout: "horizontal",
                            backgroundColor: "#ECFDF5",
                            borderColor: "#A7F3D0",
                            borderWidth: "1px",
                            cornerRadius: "4px",
                            paddingTop: "6px",
                            paddingBottom: "6px",
                            paddingStart: "2px",
                            paddingEnd: "2px",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            action: {
                              type: "message",
                              label: "ปิด",
                              text: `ปิดงาน: ${cleanId}`,
                            },
                            contents: [
                              {
                                type: "text",
                                text: "ปิด",
                                size: "xxs",
                                color: "#059669",
                                align: "center",
                                weight: "bold",
                              },
                            ],
                          },
                        ],
                      },
                  ],
                },
              ],
            };
          })),
        { type: "separator", margin: "xs", color: "#E2E8F0" },
        {
          type: "text",
          text: "สถานะ: กด ส่งงาน (อัปโหลดรูป) / ปิดงาน (เสร็จสิ้นงาน)",
          size: "xxs",
          color: "#94A3B8",
          align: "center",
          margin: "xs",
        },
        ...(tasks.length > 15
          ? [
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: "#F1F5F9",
              cornerRadius: "6px",
              paddingTop: "6px",
              paddingBottom: "6px",
              margin: "sm",
              alignItems: "center",
              justifyContent: "center",
              action: {
                type: "uri",
                label: "ดูงานทั้งหมด",
                uri: `${baseUrl}/views/tasks`,
              },
              contents: [
                {
                  type: "text",
                  text: `ดูรายการงานทั้งหมดในระบบ (${tasks.length} รายการ)`,
                  size: "xxs",
                  color: "#475569",
                  align: "center",
                  weight: "bold",
                },
              ],
            },
          ]
          : []),
      ],
    },
  };
}

/**
 * Single Task Card with Attachments (การ์ดแสดงรายละเอียดงานพร้อมรูปภาพและเอกสารแนบ)
 */
export function createTaskDetailFlex(params: {
  task: {
    id: number | string;
    title: string;
    assignee_name?: string;
    status?: string;
    do_date?: string;
    send_date?: string;
    task_type?: number | string;
  };
  attachments?: {
    images?: string[];
    note?: string;
    submittedBy?: string;
    submittedAt?: string;
  } | null;
}): Record<string, any> {
  const { task, attachments } = params;
  const taskId = task.id;
  const status = task.status || "ดำเนินการ";
  const isDone = status === "เสร็จ" || status === "สำเร็จ";
  const isSent = status === "ส่งงานแล้ว" || status === "ส่งแล้ว";
  const images = (attachments?.images || []).filter(url => Boolean(url && url.trim()));
  const note = attachments?.note || "";
  const submittedBy = attachments?.submittedBy || task.assignee_name || "ทีมงาน";

  const statusColor = isDone ? "#16A34A" : isSent ? "#0284C7" : "#F59E0B";

  const bodyContents: any[] = [];

  // Hero Preview Image (First image)
  if (images.length > 0) {
    const mainImg = images[0];
    bodyContents.push({
      type: "image",
      url: mainImg,
      size: "full",
      aspectRatio: "16:9",
      aspectMode: "cover",
      cornerRadius: "8px",
      action: {
        type: "uri",
        label: "ดูรูปขยาย",
        uri: mainImg
      }
    });
  }

  // Gallery of additional images (if more than 1 image)
  if (images.length > 1) {
    const extraThumbs = images.slice(1, 4).map(imgUrl => ({
      type: "image",
      url: imgUrl,
      size: "full",
      aspectRatio: "1:1",
      aspectMode: "cover",
      cornerRadius: "6px",
      flex: 1,
      action: {
        type: "uri",
        label: "ดูรูป",
        uri: imgUrl
      }
    }));

    bodyContents.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "xs",
      contents: extraThumbs
    });

    if (images.length > 4) {
      bodyContents.push({
        type: "text",
        text: `และอีก ${images.length - 4} รูป (แตะเพื่อดูทั้งหมด)`,
        size: "xxs",
        color: "#64748B",
        action: {
          type: "uri",
          label: "ดูรูปทั้งหมด",
          uri: getLiffUrl(`/task-upload?id=${taskId}`)
        }
      });
    }
  }

  // Title
  bodyContents.push({
    type: "text",
    text: task.title,
    weight: "bold",
    size: "sm",
    color: "#0F172A",
    wrap: true,
    margin: "md"
  });

  // Note Box if any
  if (note) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      backgroundColor: "#F8FAFC",
      paddingAll: "8px",
      cornerRadius: "6px",
      margin: "sm",
      contents: [
        {
          type: "text",
          text: `หมายเหตุ: ${note}`,
          size: "xxs",
          color: "#475569",
          wrap: true
        }
      ]
    });
  }

  // Meta Rows (Assignee, Dates, Attachments count)
  const metaRows: any[] = [
    {
      type: "box",
      layout: "baseline",
      contents: [
        { type: "text", text: "ผู้รับผิดชอบ", color: "#64748B", size: "xxs", flex: 4 },
        { type: "text", text: task.assignee_name || "ทีมงาน", color: "#1E293B", size: "xxs", flex: 6, weight: "bold" }
      ]
    }
  ];

  if (task.do_date) {
    metaRows.push({
      type: "box",
      layout: "baseline",
      contents: [
        { type: "text", text: "วันที่เริ่ม/ทำ", color: "#64748B", size: "xxs", flex: 4 },
        { type: "text", text: formatDateDisplay(task.do_date), color: "#1E293B", size: "xxs", flex: 6 }
      ]
    });
  }

  if (task.send_date) {
    metaRows.push({
      type: "box",
      layout: "baseline",
      contents: [
        { type: "text", text: "วันที่ส่งงาน", color: "#64748B", size: "xxs", flex: 4 },
        { type: "text", text: formatDateDisplay(task.send_date), color: "#0284C7", size: "xxs", flex: 6, weight: "bold" }
      ]
    });
  }

  if (images.length > 0) {
    metaRows.push({
      type: "box",
      layout: "baseline",
      contents: [
        { type: "text", text: "เอกสาร/รูปแนบ", color: "#64748B", size: "xxs", flex: 4 },
        { type: "text", text: `แนบแล้ว ${images.length} รายการ`, color: "#059669", size: "xxs", flex: 6, weight: "bold" }
      ]
    });
  }

  bodyContents.push({
    type: "box",
    layout: "vertical",
    spacing: "xs",
    margin: "sm",
    contents: metaRows
  });

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#0b3531",
      paddingAll: "12px",
      alignItems: "center",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 8,
          contents: [
            {
              type: "text",
              text: `งาน [#${taskId}]`,
              weight: "bold",
              color: "#FFFFFF",
              size: "sm"
            },
            {
              type: "text",
              text: submittedBy ? `โดย ${submittedBy}` : "ทีมงาน",
              color: "#d4f54e",
              size: "xxs",
              margin: "xs"
            }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: isDone ? "#DCFCE7" : isSent ? "#E0F2FE" : "#FEF3C7",
          cornerRadius: "4px",
          paddingStart: "8px",
          paddingEnd: "8px",
          paddingTop: "2px",
          paddingBottom: "2px",
          contents: [
            {
              type: "text",
              text: status,
              size: "xxs",
              weight: "bold",
              color: statusColor
            }
          ]
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "xs",
      contents: bodyContents
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "secondary",
          height: "sm",
          flex: 1,
          action: {
            type: "message",
            label: "ส่งงาน/แนบไฟล์",
            text: `ส่งงาน: ${taskId}`
          }
        },
        !isDone ? {
          type: "button",
          style: "primary",
          color: "#059669",
          height: "sm",
          flex: 1,
          action: {
            type: "message",
            label: "ปิดงาน",
            text: `ปิดงาน: ${taskId}`
          }
        } : null
      ].filter(Boolean)
    }
  };
}

/**
 * Summary List Bubble: Works / PW & PM Summary (สรุปรายการงานรับเหมา PW/PM)
 */
export function createWorkSummaryFlex(
  works: Array<UnifiedWorkItem | any>,
  options?: { title?: string; teamName?: string; attachmentsMap?: Record<string, any> }
): Record<string, any> {
  const isAllTeams = !options?.teamName || options.teamName === "ทั้งหมด";
  const defaultTitle = isAllTeams ? "รายการงานรับเหมา (ทุกทีม)" : `รายการงาน ${options?.teamName}`;
  // Remove any emojis from title if passed in
  const rawTitle = options?.title || defaultTitle;
  const title = rawTitle.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();

  const getTeamBadgeStyle = (teamStr: string) => {
    const t = teamStr.toUpperCase();
    if (t.includes("1")) return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" }; // Green (PW1)
    if (t.includes("2")) return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" }; // Blue (PW2)
    if (t.includes("3")) return { bg: "#FAF5FF", border: "#E9D5FF", text: "#7E22CE" }; // Purple (PW3)
    if (t.includes("4")) return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" }; // Amber (PW4)
    if (t.includes("5")) return { bg: "#FFF1F2", border: "#FECDD3", text: "#E11D48" }; // Rose/Red (PW5)
    return { bg: "#F8FAFC", border: "#CBD5E1", text: "#334155" }; // Slate (PW)
  };

  // Helper to format date & time as in Image 1: "วันนัดดู 10/10/26 เวลา 10:00 น" หรือ "วันนัดเสนอ 10/10/26 เวลา 10:00 น"
  const formatInspectForCard = (rawDate?: string, sectionName?: string) => {
    let label = "วันนัดดู";
    if (sectionName === "รอเสนอ") label = "วันนัดเสนอ";
    else if (sectionName === "ประชุม") label = "วันนัดประชุม";
    else if (sectionName === "ประมูล") label = "วันนัดประมูล";

    if (!rawDate || rawDate === "-" || rawDate === "null") return `${label}  -`;
    let timeStr = "";
    const timeMatch = rawDate.match(/(?:เวลา\s*)?(\d{1,2}:\d{2})/);
    if (timeMatch) {
      timeStr = `  เวลา  ${timeMatch[1]} น`;
    } else {
      timeStr = `  เวลา  10:00 น`;
    }
    let datePart = "";
    const dmyMatch = rawDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, "0");
      const m = dmyMatch[2].padStart(2, "0");
      let y = dmyMatch[3];
      if (y.length === 4) {
        let yrNum = Number(y);
        if (yrNum > 2500) yrNum -= 543;
        y = String(yrNum).slice(-2);
      }
      datePart = `${d}/${m}/${y}`;
    } else {
      const isoMatch = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        datePart = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1].slice(-2)}`;
      }
    }
    if (datePart) {
      return `${label}  ${datePart}${timeStr}`;
    }
    return `${label}  ${rawDate}${rawDate.includes(":") ? "" : "  เวลา  10:00 น"}`;
  };

  // Categorize works into 4 active pipeline sections matching Image 1
  const sectionsOrder = ["รอดูงาน", "รอเสนอ", "ประชุม", "ประมูล"] as const;
  const groupedWorks: Record<string, any[]> = {
    "รอดูงาน": [],
    "รอเสนอ": [],
    "ประชุม": [],
    "ประมูล": []
  };

  for (const rawW of works) {
    const st = String(rawW.status || "").trim();
    const act = String(rawW.activity_type || "").trim();

    // Completed works are omitted from pending list
    if (st === "เสร็จ" || st === "สำเร็จ" || st === "ปิดงาน") {
      continue;
    }

    let targetSection = "รอดูงาน";
    if (st.includes("รอเสนอ") || st === "เสนอราคา" || (st === "" && act.includes("เสนอ"))) {
      targetSection = "รอเสนอ";
    } else if (st.includes("ประชุม") || act.includes("ประชุม")) {
      targetSection = "ประชุม";
    } else if (st.includes("ประมูล") || act.includes("ประมูล")) {
      targetSection = "ประมูล";
    } else if (st.includes("รอดู") || act.includes("รอดู") || act.includes("ดูงาน")) {
      targetSection = "รอดูงาน";
    } else {
      if (act.includes("ประมูล")) targetSection = "ประมูล";
      else if (act.includes("ประชุม")) targetSection = "ประชุม";
      else if (act.includes("เสนอ")) targetSection = "รอเสนอ";
      else targetSection = "รอดูงาน";
    }
    groupedWorks[targetSection].push(rawW);
  }

  let totalItemsCount = 0;
  for (const sectionName of sectionsOrder) {
    totalItemsCount += (groupedWorks[sectionName] || []).length;
  }

  const bodyContents: any[] = [];

  // 1. Top Card Header (inside body - no header block) with Top-Right Action Button
  bodyContents.push({
    type: "box",
    layout: "horizontal",
    alignItems: "center",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "sm",
            color: "#0F172A"
          },
          {
            type: "text",
            text: isAllTeams
              ? `พบ ${totalItemsCount} รายการล่าสุด (รวมทุกทีม)`
              : `พบ ${totalItemsCount} รายการล่าสุด (ทีม ${options?.teamName})`,
            size: "xxs",
            color: "#64748B",
            margin: "xs"
          }
        ]
      },
      {
        type: "box",
        layout: "horizontal",
        backgroundColor: "#2563EB",
        cornerRadius: "6px",
        width: "88px",
        paddingTop: "5px",
        paddingBottom: "5px",
        alignItems: "center",
        justifyContent: "center",
        flex: 0,
        action: {
          type: "uri",
          label: "เปิดงานใหม่",
          uri: getLiffUrl("/quick-work")
        },
        contents: [
          {
            type: "text",
            text: "+ เปิดงานใหม่",
            size: "xxs",
            weight: "bold",
            color: "#FFFFFF",
            align: "center",
            wrap: false
          }
        ]
      }
    ]
  });

  bodyContents.push({
    type: "separator",
    margin: "sm",
    color: "#E2E8F0"
  });

  // 2. Sections and Items (Card List View matching Image 1 mockup)
  for (const sectionName of sectionsOrder) {
    const list = groupedWorks[sectionName] || [];
    if (list.length === 0) continue;

    const getSectionStyle = (name: string) => {
      if (name === "รอดูงาน") {
        return {
          bannerBg: "#FEF3C7", // Yellow / cream
          bannerBorder: "#FDE68A",
          bannerText: "#92400E"
        };
      }
      if (name === "รอเสนอ") {
        return {
          bannerBg: "#F3E8FF", // Light purple
          bannerBorder: "#E9D5FF",
          bannerText: "#7E22CE"
        };
      }
      if (name === "ประชุม") {
        return {
          bannerBg: "#DCFCE7", // Light green
          bannerBorder: "#86EFAC",
          bannerText: "#15803D"
        };
      }
      // ประมูล
      return {
        bannerBg: "#E0F2FE", // Light cyan
        bannerBorder: "#BAE6FD",
        bannerText: "#0369A1"
      };
    };
    const sMeta = getSectionStyle(sectionName);

    // Section Banner Header (e.g. รอดูงาน / รอเสนอ / ประชุม / ประมูล)
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      backgroundColor: sMeta.bannerBg,
      borderColor: sMeta.bannerBorder,
      borderWidth: "1px",
      paddingStart: "10px",
      paddingEnd: "10px",
      paddingTop: "5px",
      paddingBottom: "5px",
      margin: "md",
      cornerRadius: "4px",
      alignItems: "center",
      contents: [
        {
          type: "text",
          text: sectionName,
          weight: "bold",
          color: sMeta.bannerText,
          size: "xs"
        }
      ]
    });

    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      const idStr = String(w.id || "").replace(/\D/g, "");
      const dateRaw = sectionName === "รอเสนอ"
        ? String(w.date_propose && w.date_propose !== "-" ? w.date_propose : (w.date_inspect || "-"))
        : String(w.date_inspect || w.date_propose || "-");
      const locationStr = w.location && w.location !== "-" ? String(w.location) : "-";
      const companyStr = w.company && w.company !== "-" ? String(w.company) : "-";
      const detailStr = w.note && w.note !== "-" ? String(w.note) : (w.contact1 && w.contact1 !== "-" ? `ช่าง${w.contact1}` : (w.pr_no && w.pr_no !== "-" ? `PR:${w.pr_no}` : "-"));

      const dateInspectFormatted = formatInspectForCard(dateRaw, sectionName);
      const workEditUrl = getLiffUrl(`/quick-work?id=PW-${idStr || w.id}`);

      const itemTeam = w.team ? (String(w.team).toUpperCase().startsWith("PW") || String(w.team).toUpperCase().startsWith("PM") ? String(w.team).toUpperCase() : `PW${w.team}`) : "PW";
      const teamBadgeStyle = getTeamBadgeStyle(itemTeam);

      bodyContents.push({
        type: "box",
        layout: "vertical",
        paddingTop: "8px",
        paddingBottom: "8px",
        paddingStart: "4px",
        paddingEnd: "4px",
        spacing: "xs",
        contents: [
          // Line 1: [PW1] [ #5 ] ชื่องาน | สถานที่ แพร่ | ที่โรงงาน บริษัท
          {
            type: "box",
            layout: "horizontal",
            alignItems: "center",
            contents: [
              {
                type: "text",
                flex: 4,
                wrap: false,
                size: "xs",
                contents: [
                  {
                    type: "span",
                    text: `[${itemTeam}] `,
                    color: teamBadgeStyle.text,
                    weight: "bold"
                  },
                  {
                    type: "span",
                    text: `[ #${idStr || w.id} ]  `,
                    color: "#0F172A",
                    weight: "bold"
                  },
                  {
                    type: "span",
                    text: String(w.title || "ชื่องาน"),
                    color: "#0F172A",
                    weight: "bold"
                  }
                ]
              },
              {
                type: "text",
                text: `สถานที่  ${locationStr}`,
                size: "xxs",
                color: "#334155",
                flex: 3,
                wrap: false
              },
              {
                type: "text",
                text: detailStr,
                size: "xxs",
                color: "#475569",
                flex: 3,
                align: "end",
                wrap: false
              }
            ]
          },
          // Line 2: วันนัดดู 10/10/26 เวลา 10:00 น | บริษัท Insee | [ อัพเดท ] [ ปิด ]
          {
            type: "box",
            layout: "horizontal",
            alignItems: "center",
            contents: [
              {
                type: "text",
                text: dateInspectFormatted,
                size: "xxs",
                color: "#475569",
                flex: 4,
                wrap: false
              },
              {
                type: "text",
                text: `บริษัท  ${companyStr}`,
                size: "xxs",
                color: "#0F172A",
                weight: "bold",
                flex: 3,
                wrap: false
              },
              {
                type: "box",
                layout: "horizontal",
                flex: 3,
                justifyContent: "flex-end",
                spacing: "xs",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    backgroundColor: "#65A30D",
                    cornerRadius: "4px",
                    paddingTop: "3px",
                    paddingBottom: "3px",
                    paddingStart: "8px",
                    paddingEnd: "8px",
                    alignItems: "center",
                    justifyContent: "center",
                    action: {
                      type: "uri",
                      label: "อัพเดท",
                      uri: workEditUrl
                    },
                    contents: [
                      {
                        type: "text",
                        text: "อัพเดท",
                        size: "xxs",
                        weight: "bold",
                        color: "#FFFFFF",
                        align: "center"
                      }
                    ]
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    backgroundColor: "#DC2626",
                    cornerRadius: "4px",
                    paddingTop: "3px",
                    paddingBottom: "3px",
                    paddingStart: "8px",
                    paddingEnd: "8px",
                    alignItems: "center",
                    justifyContent: "center",
                    action: {
                      type: "message",
                      label: "ปิด",
                      text: `ปิดpw: ${idStr || w.id}`
                    },
                    contents: [
                      {
                        type: "text",
                        text: "ปิด",
                        size: "xxs",
                        weight: "bold",
                        color: "#FFFFFF",
                        align: "center"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      });

      // เส้นล่างเพื่อแยกแต่ละรายการ
      bodyContents.push({
        type: "separator",
        color: "#E2E8F0"
      });
    }
  }

  if (totalItemsCount === 0) {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      alignItems: "center",
      contents: [
        {
          type: "text",
          text: options?.teamName
            ? `ไม่พบรายการงานค้างของทีม ${options.teamName} ในขณะนี้`
            : "ไม่พบรายการงานค้างในขณะนี้",
          size: "xs",
          color: "#94A3B8"
        }
      ]
    });
  }

  return {
    type: "bubble",
    size: "giga",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      contents: bodyContents
    }
  };
}

/**
 * Status Picker Bubble: Change Status of PW Work
 */
export function createWorkStatusPickerFlex(workId: number | string): Record<string, any> {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 8,
              contents: [
                {
                  type: "text",
                  text: `อัปเดตสถานะงาน [PW-${workId}]`,
                  weight: "bold",
                  color: "#0F172A",
                  size: "sm"
                },
                {
                  type: "text",
                  text: "แตะเลือกสถานะใหม่เพื่ออัปเดตทันที",
                  color: "#64748B",
                  size: "xxs",
                  margin: "xs"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: "#F1F5F9",
              cornerRadius: "6px",
              paddingStart: "8px",
              paddingEnd: "8px",
              paddingTop: "3px",
              paddingBottom: "3px",
              contents: [
                {
                  type: "text",
                  text: "สถานะ",
                  size: "xxs",
                  weight: "bold",
                  color: "#334155"
                }
              ]
            }
          ]
        },
        { type: "separator", margin: "xs", color: "#E2E8F0" },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          margin: "sm",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "รอดูงาน", text: `สถานะ: ${workId} รอดูงาน` }
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "รอเสนอราคา", text: `สถานะ: ${workId} รอเสนอ` }
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "ประชุมงาน", text: `สถานะ: ${workId} ประชุม` }
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "ประมูลงาน", text: `สถานะ: ${workId} ประมูล` }
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "ส่งข้อเสนอแล้ว", text: `สถานะ: ${workId} ส่งแล้ว` }
            },
            {
              type: "button",
              style: "primary",
              color: "#059669",
              height: "sm",
              action: { type: "message", label: "ได้งาน (เปิดจ้าง)", text: `สถานะ: ${workId} ได้งาน` }
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: { type: "message", label: "แพ้ประมูล / ไม่ได้งาน", text: `สถานะ: ${workId} ไม่ได้งาน` }
            },
            {
              type: "button",
              style: "primary",
              color: "#0F172A",
              height: "sm",
              action: { type: "message", label: "สำเร็จ (ปิดงาน)", text: `ปิดpw: ${workId}` }
            }
          ]
        }
      ]
    }
  };

}

export function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://costcontorl.vercel.app";
  return url.replace(/\/$/, "");
}

export function getLiffUrl(path: string): string {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || process.env.LINE_LIFF_ID || "2011122961-40UXax1L";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (liffId) {
    return `https://liff.line.me/${liffId}${cleanPath}`;
  }
  return `${getAppBaseUrl()}${cleanPath}`;
}

/**
 * Mobile Form Invitation Bubble: Open Work in Mobile
 */
export function createOpenWorkFormFlex(baseUrl?: string): Record<string, any> {
  const formUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/quick-work` : getLiffUrl("/quick-work");
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 8,
              contents: [
                {
                  type: "text",
                  text: "เปิดงานรับเหมา (PW)",
                  weight: "bold",
                  color: "#0F172A",
                  size: "sm"
                },
                {
                  type: "text",
                  text: "แบบฟอร์มเปิดงานสำหรับมือถือ",
                  color: "#64748B",
                  size: "xxs",
                  margin: "xs"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: "#ECFDF5",
              cornerRadius: "6px",
              paddingStart: "8px",
              paddingEnd: "8px",
              paddingTop: "3px",
              paddingBottom: "3px",
              contents: [
                {
                  type: "text",
                  text: "Online Form",
                  size: "xxs",
                  weight: "bold",
                  color: "#059669"
                }
              ]
            }
          ]
        },
        { type: "separator", margin: "xs", color: "#E2E8F0" },
        {
          type: "text",
          text: "เปิดแบบฟอร์มบันทึกงานผ่านมือถือ สะดวก รวดเร็ว พร้อมเลือกวันนัดหมายและแนบภาพถ่ายหน้างานได้ทันที",
          color: "#475569",
          size: "xs",
          wrap: true,
          margin: "sm"
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F8FAFC",
          cornerRadius: "6px",
          borderWidth: "1px",
          borderColor: "#E2E8F0",
          paddingAll: "10px",
          spacing: "xs",
          margin: "sm",
          contents: [
            { type: "text", text: "• เลือกทีม PW1 - PW4 ง่ายในคลิกเดียว", size: "xxs", color: "#475569" },
            { type: "text", text: "• มีปฏิทินเลือกวันและเวลานัดดูหน้างาน", size: "xxs", color: "#475569" },
            { type: "text", text: "• ถ่ายรูปหน้างานและแนบภาพได้ทันที", size: "xxs", color: "#475569" },
            { type: "text", text: "• บันทึกแล้วแจ้งเตือนเข้ากลุ่มงานทันที", size: "xxs", color: "#475569" }
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#0F172A",
          height: "sm",
          action: {
            type: "uri",
            label: "เปิดแบบฟอร์มบันทึกงาน",
            uri: formUrl
          }
        }
      ]
    }
  };
}

/**
 * Mobile Form Invitation Bubble: Open Task in Mobile (เปิดงานแผนงาน/ทั่วไป)
 */
export function createOpenTaskFormFlex(baseUrl?: string): Record<string, any> {
  const formUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/quick-task` : getLiffUrl("/quick-task");
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 8,
              contents: [
                {
                  type: "text",
                  text: "เปิดงานใหม่ (Task / แผนงาน)",
                  weight: "bold",
                  color: "#0F172A",
                  size: "sm"
                },
                {
                  type: "text",
                  text: "แบบฟอร์มเปิดงานประจำวันและแผนงานทีม",
                  color: "#64748B",
                  size: "xxs",
                  margin: "xs"
                }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: "#EFF6FF",
              cornerRadius: "6px",
              paddingStart: "8px",
              paddingEnd: "8px",
              paddingTop: "3px",
              paddingBottom: "3px",
              contents: [
                {
                  type: "text",
                  text: "Task Form",
                  size: "xxs",
                  weight: "bold",
                  color: "#2563EB"
                }
              ]
            }
          ]
        },
        { type: "separator", margin: "xs", color: "#E2E8F0" },
        {
          type: "text",
          text: "แบบฟอร์มเปิดงานภายในทีมงาน แยกเฉพาะสำหรับงานแผนงาน เอกสาร และ PJSA พร้อมกำหนดวันเริ่ม-ส่งงาน",
          color: "#475569",
          size: "xs",
          wrap: true,
          margin: "sm"
        },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F8FAFC",
          cornerRadius: "6px",
          borderWidth: "1px",
          borderColor: "#E2E8F0",
          paddingAll: "10px",
          spacing: "xs",
          margin: "sm",
          contents: [
            { type: "text", text: "• เลือกประเภทงาน: 1.เอกสาร 2.แผนงาน 3.PJSA", size: "xxs", color: "#475569" },
            { type: "text", text: "• ระบุผู้รับผิดชอบ และกำหนดส่งงานได้ชัดเจน", size: "xxs", color: "#475569" },
            { type: "text", text: "• มีปุ่มสวิตช์ [งานด่วน ] ติดแท็กอัตโนมัติ", size: "xxs", color: "#475569" },
            { type: "text", text: "• แนบรูปภาพประกอบ และแจ้งเตือนเข้ากลุ่มทันที", size: "xxs", color: "#475569" }
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      paddingAll: "12px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#2563EB",
          height: "sm",
          action: {
            type: "uri",
            label: "เปิดแบบฟอร์มบันทึก Task",
            uri: formUrl
          }
        }
      ]
    }
  };
}

/**
 * Chooser Bubble: Choose between Work (PW) and Task Form
 */
export function createOpenWorkOrTaskChooserFlex(baseUrl?: string): Record<string, any> {
  const workUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/quick-work` : getLiffUrl("/quick-work");
  const taskUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/quick-task` : getLiffUrl("/quick-task");

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#0F172A",
      paddingAll: "14px",
      contents: [
        {
          type: "text",
          text: "เลือกประเภทการเปิดงาน",
          weight: "bold",
          color: "#FFFFFF",
          size: "sm"
        },
        {
          type: "text",
          text: "กรุณาเลือกแบบฟอร์มให้ตรงกับประเภทงานของคุณ",
          color: "#94A3B8",
          size: "xxs",
          margin: "xs"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "md",
      contents: [
        // Option 1: Work (PW)
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F8FAFC",
          cornerRadius: "8px",
          paddingAll: "12px",
          borderWidth: "1px",
          borderColor: "#E2E8F0",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              alignItems: "center",
              contents: [
                { type: "text", text: "งานรับเหมา (Work / PW)", weight: "bold", size: "xs", color: "#0F172A", flex: 8 },
                {
                  type: "box",
                  layout: "horizontal",
                  backgroundColor: "#ECFDF5",
                  cornerRadius: "4px",
                  paddingStart: "6px",
                  paddingEnd: "6px",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                  contents: [{ type: "text", text: "PW", size: "xxs", color: "#059669", weight: "bold" }]
                }
              ]
            },
            {
              type: "text",
              text: "สำหรับงานรับเหมา, ช่าง, ทีม PW1-PW4, นัดดูหน้างาน, เสนอราคา, ประมูลงาน",
              size: "xxs",
              color: "#64748B",
              wrap: true,
              margin: "xs"
            },
            {
              type: "button",
              style: "primary",
              color: "#0F172A",
              height: "sm",
              margin: "sm",
              action: {
                type: "uri",
                label: "เปิดงานรับเหมา (PW)",
                uri: workUrl
              }
            }
          ]
        },
        // Option 2: Task
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F8FAFC",
          cornerRadius: "8px",
          paddingAll: "12px",
          borderWidth: "1px",
          borderColor: "#E2E8F0",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              alignItems: "center",
              contents: [
                { type: "text", text: "แผนงาน / ภายใน (Task)", weight: "bold", size: "xs", color: "#0F172A", flex: 8 },
                {
                  type: "box",
                  layout: "horizontal",
                  backgroundColor: "#EFF6FF",
                  cornerRadius: "4px",
                  paddingStart: "6px",
                  paddingEnd: "6px",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                  contents: [{ type: "text", text: "Task", size: "xxs", color: "#2563EB", weight: "bold" }]
                }
              ]
            },
            {
              type: "text",
              text: "สำหรับงานภายในทีม, แผนงานประจำวัน, งานเอกสาร, PJSA และกำหนดวันส่งงาน",
              size: "xxs",
              color: "#64748B",
              wrap: true,
              margin: "xs"
            },
            {
              type: "button",
              style: "primary",
              color: "#2563EB",
              height: "sm",
              margin: "sm",
              action: {
                type: "uri",
                label: "เปิดงานแผนงาน (Task)",
                uri: taskUrl
              }
            }
          ]
        }
      ]
    }
  };
}

export interface MemberTaskTableItem {
  id: any;
  title?: string;
  details?: string;
  project?: string;
  project_name?: string;
  dateStr?: string;
  days?: number;
  status?: string;
  task_type?: number | string;
  sendDateStr?: string;
  do_date?: string;
  send_date?: string;
  imageUrl?: string;
  images?: string[];
}

/**
 * Grid Table View: Member Task Table (ตารางงานตามสมาชิก)
 */
export function createMemberTaskTableFlex(
  memberName: string,
  tasks: Array<MemberTaskTableItem | any>,
  options?: {
    subtitle?: string;
    attachmentsMap?: Record<string, any>;
  }
): Record<string, any> {
  // กรองงานที่เสร็จแล้ว/สำเร็จแล้วออก ไม่ต้องแสดงใน Flex ตามที่ผู้ใช้ระบุ
  const planTasks = tasks.filter(t => {
    const st = String(t.status || "").trim();
    return st !== "เสร็จ" && st !== "สำเร็จ" && st !== "ปิดงาน" && !st.includes("เสร็จ") && !st.includes("สำเร็จ");
  });

  const docCount = planTasks.filter(t => Number(t.task_type) === 1 || String(t.task_type).includes("เอกสาร")).length;
  const planCount = planTasks.filter(t => Number(t.task_type) === 2 || String(t.task_type).includes("แผนงาน")).length;
  const pjsaCount = planTasks.filter(t => Number(t.task_type) === 3 || String(t.task_type).includes("PJSA")).length;

  // 1. Calculate 4-day timeline in Bangkok timezone (UTC+7): D-1, D0 (Today), D+1, D+2
  const todayIso = getTodayDateIso(); // "YYYY-MM-DD" in Thailand time
  const [ty, tm, td] = todayIso.split("-").map(Number);

  const getTimelineDay = (offsetDays: number) => {
    const utcDate = new Date(Date.UTC(ty, tm - 1, td + offsetDays));
    const year = utcDate.getUTCFullYear();
    const month = utcDate.getUTCMonth() + 1;
    const day = utcDate.getUTCDate();
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const displayDay = String(day);
    const displayDmy = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year + 543).slice(-2)}`;
    return { iso, year, month, day, displayDay, displayDmy };
  };

  const dayMinus1 = getTimelineDay(-1); // D-1 (Yesterday)
  const day0 = getTimelineDay(0);       // D0 (Today)
  const dayPlus1 = getTimelineDay(1);   // D+1 (Tomorrow)
  const dayPlus2 = getTimelineDay(2);   // D+2 (+2 days)

  const monthHeader = dayMinus1.month === dayPlus2.month
    ? `เดือน ${day0.month}`
    : `เดือน ${dayMinus1.month}-${dayPlus2.month}`;

  return {
    type: "bubble",
    size: "giga",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "sm",
      contents: [
        // Top Header: Left is Flex Title, Right is Small Action Button
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
                  type: "text",
                  text: memberName && memberName !== "ทีมงานทั้งหมด"
                    ? `รายการงาน (${planTasks.length} งาน) | ${memberName}`
                    : `รายการงาน (${planTasks.length} งาน) | ไทม์ไลน์ 4 วัน - ${monthHeader}`,
                  weight: "bold",
                  color: "#0F172A",
                  size: "xs",
                  wrap: true,
                },
                {
                  type: "text",
                  text: memberName && memberName !== "ทีมงานทั้งหมด"
                    ? `ไทม์ไลน์ 4 วัน - ${monthHeader} • (เอกสาร ${docCount} • แผนงาน ${planCount} • PJSA ${pjsaCount})`
                    : `รวม ${planTasks.length} รายการ (เอกสาร ${docCount} • แผนงาน ${planCount} • PJSA ${pjsaCount})`,
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: "#2563EB",
              cornerRadius: "6px",
              width: "88px",
              paddingTop: "5px",
              paddingBottom: "5px",
              alignItems: "center",
              justifyContent: "center",
              flex: 0,
              action: {
                type: "uri",
                label: "เปิดงานใหม่",
                uri: getLiffUrl("/quick-task"),
              },
              contents: [
                {
                  type: "text",
                  text: "+ เปิดงานใหม่",
                  size: "xxs",
                  weight: "bold",
                  color: "#FFFFFF",
                  align: "center",
                  wrap: false,
                },
              ],
            },
          ],
        },
        { type: "separator", margin: "xs", color: "#E2E8F0" },
        // Table Column Header Row
        {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          contents: [
            { type: "text", text: "รายการทั้งหมด", size: "xxs", weight: "bold", color: "#6B7280", flex: 6 },
            { type: "separator" },
            { type: "text", text: "เริ่ม/เสร็จ", size: "xxs", weight: "bold", color: "#6B7280", flex: 3, align: "center" },
            { type: "separator" },
            { type: "text", text: "วัน", size: "xxs", weight: "bold", color: "#6B7280", flex: 1, align: "center" },
            { type: "separator" },
            {
              type: "box",
              layout: "vertical",
              flex: 5,
              contents: [
                { type: "text", text: "ไทม์ไลน์ 4 วัน", size: "xxs", weight: "bold", color: "#6B7280", align: "center" },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: `${dayMinus1.displayDay}`, size: "xxs", align: "center", flex: 1, color: "#6B7280" },
                    { type: "separator", color: "#EF4444" },
                    { type: "text", text: `${day0.displayDay}`, size: "xxs", align: "center", flex: 1, color: "#EF4444", weight: "bold" },
                    { type: "separator", color: "#EF4444" },
                    { type: "text", text: `${dayPlus1.displayDay}`, size: "xxs", align: "center", flex: 1, color: "#6B7280" },
                    { type: "separator" },
                    { type: "text", text: `${dayPlus2.displayDay}`, size: "xxs", align: "center", flex: 1, color: "#6B7280" }
                  ]
                }
              ]
            },
            { type: "separator" },
            { type: "text", text: "สถานะ", size: "xxs", weight: "bold", color: "#6B7280", flex: 3, align: "center" }
          ]
        },
        { type: "separator", margin: "xs" },
        // Table Task Items (Empty Notice or Task Rows)
        ...(planTasks.length === 0
          ? [
            {
              type: "box",
              layout: "vertical",
              paddingAll: "16px",
              alignItems: "center",
              contents: [
                {
                  type: "text",
                  text: "ไม่มีรายการงานค้าง ทุกงานดำเนินการเสร็จเรียบร้อยแล้ว",
                  size: "xs",
                  color: "#16A34A",
                  weight: "bold",
                  align: "center"
                }
              ]
            }
          ]
          : planTasks.slice(0, 10).map((t, index) => {
            const taskIdStr = String(t.id || index + 100);
            const att = options?.attachmentsMap ? options.attachmentsMap[taskIdStr] : null;
            const taskTitle = t.title || t.details || "งานประจำวัน";
            const projectStr = (t.project || t.project_name || att?.project || "").trim();
            const taskImages: string[] = (t.images && t.images.length > 0) ? t.images : (t.imageUrl ? [t.imageUrl] : (att?.images || []));

            // 1. Resolve Task Start and End ISO Dates
            let taskStartIso = "";
            if (t.do_date) {
              taskStartIso = normalizeDateToIso(t.do_date);
            } else if (t.dateStr) {
              taskStartIso = normalizeDateToIso(t.dateStr);
            }

            let taskEndIso = "";
            if (t.send_date) {
              taskEndIso = normalizeDateToIso(t.send_date);
            } else if (t.sendDateStr && t.sendDateStr !== "-") {
              taskEndIso = normalizeDateToIso(t.sendDateStr);
            }

            if (!taskStartIso && taskEndIso) {
              taskStartIso = taskEndIso;
            } else if (taskStartIso && !taskEndIso) {
              if (t.days && t.days > 1) {
                const [sy, sm, sd] = taskStartIso.split("-").map(Number);
                const endD = new Date(Date.UTC(sy, sm - 1, sd + (t.days - 1)));
                taskEndIso = `${endD.getUTCFullYear()}-${String(endD.getUTCMonth() + 1).padStart(2, "0")}-${String(endD.getUTCDate()).padStart(2, "0")}`;
              } else {
                taskEndIso = taskStartIso;
              }
            }

            // 2. Task Duration in Days
            let durationDays = t.days || 1;
            if (taskStartIso && taskEndIso) {
              const startMs = new Date(taskStartIso).getTime();
              const endMs = new Date(taskEndIso).getTime();
              const diff = Math.round((endMs - startMs) / 86400000) + 1;
              if (diff > 0) durationDays = diff;
            }

            // 3. Format Display Dates for "เริ่ม/เสร็จ"
            const formatShortDisplay = (isoStr: string, fallbackStr?: string) => {
              if (!isoStr) {
                if (fallbackStr && fallbackStr.includes("/2026")) {
                  return fallbackStr.replace("/2026", "/69");
                }
                return fallbackStr || "-";
              }
              const parts = isoStr.split("-");
              if (parts.length === 3) {
                const thYear = String(Number(parts[0]) + 543).slice(-2);
                return `${parts[2]}/${parts[1]}/${thYear}`;
              }
              return fallbackStr || isoStr;
            };

            const startDisplay = formatShortDisplay(taskStartIso, t.dateStr || day0.displayDmy);
            const endDisplay = taskEndIso && taskEndIso !== taskStartIso
              ? formatShortDisplay(taskEndIso, t.sendDateStr)
              : (t.sendDateStr && t.sendDateStr !== "-" ? formatShortDisplay("", t.sendDateStr) : "");

            const displayDate = endDisplay ? `${startDisplay}\n${endDisplay}` : startDisplay;

            // 4. Compute Dynamic Timeline Symbols
            const isDone = t.status === "เสร็จ" || t.status === "สำเร็จ";
            const isSent = t.status === "ส่งงานแล้ว" || t.status === "ส่งแล้ว" || t.status === "รอตรวจ";
            const isOverdue = !isDone && Boolean(taskEndIso && taskEndIso < todayIso);

            const getSymbol = (dayIso: string, isTodayCol: boolean) => {
              if (!taskStartIso && !taskEndIso) {
                return "⬜";
              }
              const inRange = dayIso >= taskStartIso && dayIso <= taskEndIso;
              if (inRange) {
                if (isDone) return "🟩";
                if (dayIso < todayIso) return "🟥"; // Overdue past work
                return "🟦"; // Active / scheduled
              }
              // If overdue in the past, flag today column with 🟥
              if (isTodayCol && isOverdue && dayIso > taskEndIso) {
                return "🟥";
              }
              return "⬜";
            };

            const symMinus1 = getSymbol(dayMinus1.iso, false);
            const sym0 = getSymbol(day0.iso, true);
            const symPlus1 = getSymbol(dayPlus1.iso, false);
            const symPlus2 = getSymbol(dayPlus2.iso, false);

            // Distinct card box per task row for clear separation
            return {
              type: "box",
              layout: "vertical",
              backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
              borderColor: isOverdue ? "#FECACA" : "#E2E8F0",
              borderWidth: "1px",
              cornerRadius: "6px",
              paddingStart: "4px",
              paddingEnd: "4px",
              paddingTop: "6px",
              paddingBottom: "6px",
              margin: "xs",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  spacing: "xs",
                  alignItems: "center",
                  contents: [
                    // Column 1: Task Title + Document Thumbnails below
                    {
                      type: "box",
                      layout: "vertical",
                      flex: 6,
                      spacing: "xs",
                      contents: [
                        {
                          type: "text",
                          text: `[#${taskIdStr}] ${taskTitle}`,
                          size: "xs",
                          color: "#1F2937",
                          wrap: true,
                          weight: "bold"
                        },
                        ...(projectStr && projectStr !== "-"
                          ? [
                            {
                              type: "text",
                              text: projectStr,
                              size: "xxs",
                              color: "#64748B",
                              wrap: true
                            }
                          ]
                          : [])
                      ]
                    },
                    { type: "separator" },
                    {
                      type: "text",
                      text: displayDate,
                      size: "xxs",
                      color: "#6B7280",
                      flex: 3,
                      align: "center",
                      wrap: true
                    },
                    { type: "separator" },
                    {
                      type: "text",
                      text: String(durationDays),
                      size: "xs",
                      color: "#374151",
                      flex: 1,
                      align: "center"
                    },
                    { type: "separator" },
                    // 4-Day Timeline Grid with Red Today Column Separator
                    {
                      type: "box",
                      layout: "horizontal",
                      flex: 5,
                      contents: [
                        { type: "text", text: symMinus1, size: "xxs", align: "center", flex: 1 },
                        { type: "separator", color: "#EF4444" },
                        { type: "text", text: sym0, size: "xxs", align: "center", flex: 1 },
                        { type: "separator", color: "#EF4444" },
                        { type: "text", text: symPlus1, size: "xxs", align: "center", flex: 1 },
                        { type: "separator" },
                        { type: "text", text: symPlus2, size: "xxs", align: "center", flex: 1 }
                      ]
                    },
                    { type: "separator" },
                    // Status & Action Column: Send (ส่งงาน) and Close (ปิดงาน)
                    isDone
                      ? {
                        type: "text",
                        text: "เสร็จ",
                        size: "xxs",
                        color: "#16A34A",
                        flex: 3,
                        align: "center",
                        weight: "bold"
                      }
                      : {
                        type: "box",
                        layout: "horizontal",
                        flex: 3,
                        alignItems: "center",
                        justifyContent: "center",
                        spacing: "xs",
                        contents: [
                          {
                            type: "box",
                            layout: "horizontal",
                            backgroundColor: isSent ? "#F0F9FF" : "#EFF6FF",
                            borderColor: isSent ? "#BAE6FD" : "#BFDBFE",
                            borderWidth: "1px",
                            cornerRadius: "4px",
                            paddingTop: "6px",
                            paddingBottom: "6px",
                            paddingStart: "2px",
                            paddingEnd: "2px",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            action: {
                              type: "message",
                              label: "ส่ง",
                              text: `ส่งงาน: ${taskIdStr}`
                            },
                            contents: [
                              {
                                type: "text",
                                text: "ส่ง",
                                size: "xxs",
                                color: isSent ? "#0284C7" : "#2563EB",
                                align: "center",
                                weight: "bold"
                              }
                            ]
                          },
                          {
                            type: "box",
                            layout: "horizontal",
                            backgroundColor: "#ECFDF5",
                            borderColor: "#A7F3D0",
                            borderWidth: "1px",
                            cornerRadius: "4px",
                            paddingTop: "6px",
                            paddingBottom: "6px",
                            paddingStart: "2px",
                            paddingEnd: "2px",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: 1,
                            action: {
                              type: "message",
                              label: "ปิด",
                              text: `ปิดงาน: ${taskIdStr}`
                            },
                            contents: [
                              {
                                type: "text",
                                text: "ปิด",
                                size: "xxs",
                                color: "#059669",
                                align: "center",
                                weight: "bold"
                              }
                            ]
                          }
                        ]
                      }

                  ]
                }
              ]
            };
          })),
        // Timeline & Status Legend
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "ไทม์ไลน์: ■ กำลังทำ (น้ำเงิน)  ■ เสร็จ (เขียว)  ■ เกินกำหนด (แดง)  □ ไม่มีงาน",
              size: "xxs",
              color: "#94A3B8"
            },
            {
              type: "text",
              text: "สถานะ: ส่ง (ส่งงาน/แนบรูป) • ปิด (ตรวจรับ/ปิดงาน)",
              size: "xxs",
              color: "#94A3B8"
            }
          ]
        }
      ]
    }
  };
}

// ==========================================
// 3. Command Handlers
// ==========================================

/**
 * Handle all Task-related commands ("งาน:", "งานค้าง", "ปิดงาน:", etc.)
 */
export async function handleTaskCommands(
  rawText: string,
  lowerText: string,
  replyToken: string,
  targetId: string,
  userId: string
): Promise<boolean> {
  // 0. Open Task Form ("addt", "เปิดงานtask", "สร้างงานtask", "ฟอร์มtask", "เปิดtask", "สร้างtask")
  if (
    lowerText === "addt" ||
    lowerText === "เปิดงานtask" ||
    lowerText === "สร้างงานtask" ||
    lowerText === "ฟอร์มtask" ||
    lowerText === "เปิดtask" ||
    lowerText === "สร้างtask"
  ) {
    const flex = createOpenTaskFormFlex();
    const sent = await replyFlexMessage(replyToken, "แบบฟอร์มเปิดงาน Task", flex);
    if (!sent && replyToken) {
      await replyTextMessage(replyToken, `เปิดงานใหม่ (Task / แผนงาน) ผ่านมือถือ:\n${getLiffUrl("/quick-task")}`);
    }
    return true;
  }

  // 1. Quick Task Summary ("doo", "doo2", "งานค้าง", "สรุปงาน", "สรุปงานค้าง")
  if (
    lowerText === "doo" ||
    lowerText === "doo2" ||
    lowerText === "งานค้าง" ||
    lowerText === "สรุปงาน" ||
    lowerText === "สรุปงานค้าง"
  ) {
    const { data: activeTasks } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .neq("status", "สำเร็จ")
      .neq("status", "เสร็จ")
      .neq("status", "ปิดงาน")
      .order("id", { ascending: false })
      .limit(15);

    if (!activeTasks || activeTasks.length === 0) {
      await replyTextMessage(replyToken, `ไม่พบรายการงานค้างในขณะนี้`);
      return true;
    }

    const formattedTasks = activeTasks.map(t => ({
      id: t.id,
      details: t.title || "งานประจำวัน",
      status: t.status || "กำลังทำ",
      project: t.assignee_name ? `ผู้รับ: ${t.assignee_name}` : "งานทั่วไป",
      assignee_name: t.assignee_name,
      do_date: t.do_date,
      send_date: t.send_date,
      days: t.days,
      task_type: t.task_type,
      image_url: t.image_url,
      images: t.images
    }));

    const [attachmentsMap, projectCodeMap] = await Promise.all([
      getAllTaskAttachments(),
      fetchProjectCodeMap()
    ]);
    const flex = createTaskSummaryFlex(formattedTasks, { attachmentsMap, projectCodeMap });
    await replyFlexMessage(replyToken, `รายการงานค้างล่าสุด (${activeTasks.length} รายการ)`, flex);
    return true;
  }

  // 1.1 Single Task Inspection by ID ("ดูงาน: 101", "ดูงาน 101", "งาน: 101", "งาน #101", "รูปงาน: 101", "รูป 101")
  const singleTaskMatch =
    rawText.match(/^ดูงาน[:\s]*#?(\d+)$/i) ||
    rawText.match(/^รูป(?:งาน)?[:\s]*#?(\d+)$/i) ||
    rawText.match(/^งาน[:\s]*#?(\d+)$/i) ||
    (rawText.startsWith("งาน:") && /^\d+$/.test(rawText.replace(/^งาน:/, "").trim()) ? rawText.match(/^งาน:\s*(\d+)$/) : null);

  if (singleTaskMatch) {
    const taskIdNum = parseInt(singleTaskMatch[1], 10);
    const { data: foundTask } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", taskIdNum)
      .single();

    if (!foundTask) {
      await replyTextMessage(replyToken, `ไม่พบข้อมูลงานรหัส [#${taskIdNum}] ในระบบ`);
      return true;
    }

    const attachments = await getTaskAttachment(taskIdNum);
    const flex = createTaskDetailFlex({
      task: foundTask,
      attachments
    });

    const sent = await replyFlexMessage(replyToken, `รายละเอียดงาน [#${taskIdNum}]`, flex);
    if (!sent && replyToken) {
      const imgCount = attachments?.images?.length || 0;
      await replyTextMessage(
        replyToken,
        `รายละเอียดงาน [#${taskIdNum}]\n\nเรื่อง: ${foundTask.title}\nผู้รับผิดชอบ: ${foundTask.assignee_name || "-"}\nสถานะ: ${foundTask.status}\nแนบรูป: ${imgCount} รายการ\nดูรายละเอียด/รูปแนบ: ${getLiffUrl(`/task-upload?id=${taskIdNum}`)}`
      );
    }
    return true;
  }

  // 2. Member Task Query ("งาน 2", "งาน2", "งาน2:เคน", "งาน:เคน", "งาน: เคน", "งาน:[เคน]", "งาน: [เคน]", "งาน เคน", "งาน [เคน]") vs Create Task ("งาน: ซื้อสี...")
  const trimmedRaw = rawText.trim();
  const isWork2Query = /^งาน\s*2(?::|\s|$)/i.test(trimmedRaw);

  // Check if it's "งาน: [ชื่อ]" or "งาน:[ชื่อ]" (bracketed single target with no task title preceding it)
  const colonBracketMatch = trimmedRaw.match(/^งาน\s*:\s*\[([^\[\]]+)\]$/i);
  // Check if it's "งาน [ชื่อ]"
  const spaceBracketMatch = trimmedRaw.match(/^งาน\s+\[([^\[\]]+)\]$/i);
  // Check if it's "งาน:ชื่อ" or "งาน: ชื่อ" (where the part after "งาน:" is a single name or single token without other instructions)
  const colonPlainMatch = trimmedRaw.match(/^งาน\s*:\s*([^\s:\[\]]+)$/i);
  // Check if it's "งาน ชื่อ" (single token after "งาน")
  const spacePlainMatch = trimmedRaw.match(/^งาน\s+([^\s:\[\]]+)$/i);

  const isMemberNameQuery = Boolean(colonBracketMatch || spaceBracketMatch || colonPlainMatch || spacePlainMatch);
  const isWorkGridQuery = isWork2Query || isMemberNameQuery;

  if (isWorkGridQuery || rawText.startsWith("งาน:") || rawText.startsWith("งานด่วน:") || rawText.startsWith("งานใหม่:")) {
    let content = "";
    if (colonBracketMatch) {
      content = colonBracketMatch[1].trim();
    } else if (spaceBracketMatch) {
      content = spaceBracketMatch[1].trim();
    } else if (colonPlainMatch) {
      content = colonPlainMatch[1].trim();
    } else if (spacePlainMatch) {
      content = spacePlainMatch[1].trim();
    } else if (isWork2Query) {
      content = trimmedRaw.replace(/^งาน\s*2\s*:?/, "").replace(/^\[|\]$/g, "").trim();
    } else {
      content = rawText.replace(/^งานด่วน:|^งานใหม่:|^งาน:/, "").trim();
    }

    // A) Query Member Task Table Grid (Gantt timeline table - รูปที่ 2)
    if (isWorkGridQuery) {
      const isAllTeam = !content || content === "ทั้งหมด" || content === "ทีมงาน";
      const memberDisplayName = isAllTeam ? "ทีมงานทั้งหมด" : content;

      let tasksList: any[] = [];
      if (!isAllTeam) {
        const altName = content.startsWith("ช่าง") ? content.replace(/^ช่าง/, "").trim() : `ช่าง${content}`;
        const assigneeFilter = altName && altName !== content
          ? `assignee_name.ilike.%${content}%,assignee_id.ilike.%${content}%,assignee_name.ilike.%${altName}%,assignee_id.ilike.%${altName}%`
          : `assignee_name.ilike.%${content}%,assignee_id.ilike.%${content}%`;

        // ค้นหาตามชื่อผู้รับผิดชอบก่อนเป็นอันดับแรก เพื่อไม่ให้ติดงานคนอื่นที่มีคำนี้ในชื่องาน
        const { data: byAssignee } = await supabaseAdmin
          .from("tasks")
          .select("*")
          .or(assigneeFilter)
          .order("id", { ascending: false })
          .limit(20);

        if (byAssignee && byAssignee.length > 0) {
          tasksList = byAssignee;
        } else {
          // ถ้าไม่มีผู้รับผิดชอบชื่อนี้ ค่อยค้นหาจากชื่องาน
          const { data: byTitle } = await supabaseAdmin
            .from("tasks")
            .select("*")
            .ilike("title", `%${content}%`)
            .order("id", { ascending: false })
            .limit(20);
          tasksList = byTitle || [];
        }
      } else {
        const { data: allTasks } = await supabaseAdmin
          .from("tasks")
          .select("*")
          .order("id", { ascending: false })
          .limit(20);
        tasksList = allTasks || [];
      }

      const allFoundTasks = tasksList || [];

      // Sort: active/in-progress tasks first, then completed/closed tasks
      const activeTasks = allFoundTasks.filter(t => {
        const st = String(t.status || "").trim();
        return st !== "สำเร็จ" && st !== "เสร็จ" && st !== "ปิดงาน" && !st.includes("เสร็จ") && !st.includes("สำเร็จ");
      });
      const completedTasks = allFoundTasks.filter(t => {
        const st = String(t.status || "").trim();
        return st === "สำเร็จ" || st === "เสร็จ" || st === "ปิดงาน" || st.includes("เสร็จ") || st.includes("สำเร็จ");
      });

      // Prioritize active tasks, but include completed tasks up to 10 total
      const displayTasks = [...activeTasks, ...completedTasks].slice(0, 10);

      if (displayTasks.length > 0) {
        const allAttachments = await getAllTaskAttachments();

        const dbTasks = displayTasks.map(t => {
          const att = allAttachments[String(t.id)];
          const taskImgs = (att?.images && att.images.length > 0) ? att.images : (t.image_url ? [t.image_url] : []);
          const firstImg = taskImgs[0] || undefined;
          return {
            id: t.id,
            title: t.title || "งานประจำวัน",
            details: t.title || "งานประจำวัน",
            project: att?.project || t.project || t.project_name || undefined,
            do_date: t.do_date || undefined,
            send_date: t.send_date || undefined,
            dateStr: t.do_date ? formatDateDisplay(t.do_date) : getTodayDateIso(),
            sendDateStr: t.send_date ? formatDateDisplay(t.send_date) : undefined,
            status: t.status || "ดำเนินการ",
            task_type: t.task_type || 1,
            imageUrl: firstImg,
            images: taskImgs
          };
        });

        // ใช้ createMemberTaskTableFlex (ตารางไทม์ไลน์ 4 วัน พร้อมปุ่มเปิดงานใหม่ - รูปที่ 2) เสมอ
        const flex = createMemberTaskTableFlex(memberDisplayName, dbTasks, { attachmentsMap: allAttachments });
        const sent = await replyFlexMessage(replyToken, `รายการงานของ ${memberDisplayName} (${displayTasks.length} รายการ)`, flex);

        if (!sent && replyToken) {
          let textSummary = `งานของ : ${memberDisplayName} (${displayTasks.length} รายการ)\n\n`;
          dbTasks.forEach((t, i) => {
            textSummary += `${i + 1}. [#${t.id}] ${t.details} (${t.dateStr}) - ${t.status}\n`;
          });
          await replyTextMessage(replyToken, textSummary);
        }
        return true;
      }

      // Fallback: Check if this name/keyword exists in PW works
      if (!isAllTeam && content) {
        const { data: worksList } = await supabaseAdmin
          .from("works")
          .select("*")
          .or(`team.ilike.%${content}%,contact1.ilike.%${content}%,contact2.ilike.%${content}%,company.ilike.%${content}%,title.ilike.%${content}%`)
          .order("id", { ascending: false })
          .limit(10);

        if (worksList && worksList.length > 0) {
          const allAttachments = await getAllWorkAttachments();
          const flex = createWorkSummaryFlex(worksList, { teamName: memberDisplayName, attachmentsMap: allAttachments });
          await replyFlexMessage(replyToken, `รายการงาน PW ของ ${memberDisplayName} (${worksList.length} รายการ)`, flex);
          return true;
        }
      }

      const notFoundMsg = isAllTeam
        ? `ไม่พบรายการงานในระบบในขณะนี้\n\nสามารถเพิ่มงานใหม่ได้ผ่านคำสั่ง "งานใหม่: รายละเอียด [ชื่อผู้รับ]"`
        : `ไม่พบข้อมูลงานของ "${memberDisplayName}" ในระบบครับ\n\nสามารถเพิ่มงานใหม่ได้ผ่านคำสั่ง "งาน: รายละเอียด [${memberDisplayName}]"`;
      await replyTextMessage(replyToken, notFoundMsg);
      return true;
    }

    // B) Create Task in `tasks` table
    const isUrgent = rawText.startsWith("งานด่วน:");
    let assignee = "ทีมงาน";
    let details = content;
    const match = content.match(/\[(.*?)\]$/) || content.match(/-(.*?)$/);
    if (match) {
      assignee = match[1].trim();
      details = content.replace(match[0], "").trim();
    }

    const todayIso = getTodayDateIso();
    const { data: inserted } = await supabaseAdmin
      .from("tasks")
      .insert({
        title: `${isUrgent ? "[ด่วน] " : ""}${details}`,
        assignee_name: assignee,
        status: "ดำเนินการ",
        task_type: isUrgent ? 1 : 1,
        do_date: todayIso
      })
      .select()
      .single();

    const createdId = inserted?.id ? `#${inserted.id}` : "ใหม่";
    const notifyMsg = `บันทึกงานเรียบร้อยแล้ว!\n\nรหัสงาน: ${createdId}\nรายละเอียด: ${details}\nผู้รับผิดชอบ: ${assignee}\nสถานะ: กำลังดำเนินการ`;
    await replyTextMessage(replyToken, notifyMsg);

    // Multi-Group Routing: Push to Task Group if configured and different from source
    const taskGroup = await getLineTargetGroup("task");
    if (taskGroup && taskGroup !== targetId) {
      await sendTextMessage(taskGroup, `[แจ้งเตือนงานใหม่]\n${notifyMsg}`);
    }

    return true;
  }

  // 3. Send Task & Keyword Submit for Line Attachments
  // Template:
  // งานของ: มายู
  // ลำดับ: 2770
  // รายการ: ทำบันทึกยอดสั่งข้าวโอที
  // ดู/ทำ: 01/10/2026
  // ส่งงาน: 31/10/2026
  // เอกสาร ,รูปถ่าย ด้านล่างนี้
  // 3. Send Task & Close Task with Keyword Submit & Photo/Document Attachments
  // Template:
  // งานของ: ต้อม
  // ลำดับ: 7
  // รายการ: ซ่อใ
  // ดู/ทำ: 10/10/2026
  // ส่งงาน: 10/10/2026
  // เอกสาร ,รูปถ่าย ด้านล่างนี้
  const isKeywordTemplateQuery =
    lowerText === "คีเวิด" ||
    lowerText === "คีย์เวิร์ด" ||
    lowerText === "keyword" ||
    lowerText === "แม่แบบส่งงาน" ||
    lowerText === "แบบส่งงาน" ||
    lowerText === "แม่แบบปิดงาน" ||
    lowerText === "แบบปิดงาน";

  if (isKeywordTemplateQuery) {
    const isClose = lowerText.includes("ปิด");
    const templateMsg = [
      isClose ? `แม่แบบคีย์เวิร์ดปิดงานและแนบไฟล์ผ่าน LINE:` : `แม่แบบคีย์เวิร์ดส่งงานและแนบไฟล์ผ่าน LINE:`,
      ``,
      `งานของ: [ชื่อผู้รับผิดชอบ]`,
      `ลำดับ: [รหัสงาน เช่น 7]`,
      `รายการ: [ชื่องาน]`,
      `ดู/ทำ: [วว/ดด/ปปปป]`,
      `ส่งงาน: [วว/ดด/ปปปป]`,
      `เอกสาร ,รูปถ่าย ด้านล่างนี้`,
      ``,
      isClose
        ? `(เมื่อส่งข้อความนี้ สถานะจะปิดงานเป็น 'สำเร็จ' ทันที และสามารถส่งรูปถ่าย/ไฟล์เอกสารลงในแชทนี้ได้เลย ระบบจะบันทึกเป็นไฟล์แนบให้อัตโนมัติครับ)`
        : `(เมื่อส่งข้อความนี้แล้ว สามารถส่งรูปถ่าย หรือ ไฟล์เอกสาร PDF, Excel, Word ลงในแชทนี้ได้ทันที ระบบจะบันทึกเป็นไฟล์แนบให้อัตโนมัติครับ)`
    ].join("\n");
    await replyTextMessage(replyToken, templateMsg);
    return true;
  }

  const isSubmitKeywordMessage =
    (rawText.includes("งานของ:") && (rawText.includes("ลำดับ:") || rawText.includes("ลำดับที่:") || rawText.includes("รหัส:"))) ||
    (rawText.includes("เอกสาร") && rawText.includes("รูปถ่าย ด้านล่างนี้")) ||
    (rawText.includes("ส่งงาน:") && rawText.includes("รายการ:")) ||
    (rawText.includes("ปิดงาน:") && rawText.includes("รายการ:"));

  const isShortSendCommand =
    rawText.startsWith("ส่งงาน:") ||
    rawText.startsWith("ยืนยันส่งงาน:") ||
    (rawText.startsWith("ส่ง:") && !rawText.includes("\n") && /^\d+$/.test(rawText.replace(/^ส่ง:/, "").trim())) ||
    (rawText.startsWith("ส่งงาน ") && /^\d+$/.test(rawText.replace(/^ส่งงาน\s+/, "").trim())) ||
    (rawText.startsWith("ส่ง ") && !rawText.includes("\n") && /^\d+$/.test(rawText.replace(/^ส่ง\s+/, "").trim()));

  const isShortCloseCommand =
    rawText.startsWith("ปิดงาน:") ||
    rawText.startsWith("ยืนยันปิดงาน:") ||
    (rawText.startsWith("ปิด:") && !rawText.includes("\n") && /^\d+$/.test(rawText.replace(/^ปิด:/, "").trim())) ||
    (rawText.startsWith("ปิดงาน ") && /^\d+$/.test(rawText.replace(/^ปิดงาน\s+/, "").trim())) ||
    (rawText.startsWith("ปิด ") && !rawText.includes("\n") && /^\d+$/.test(rawText.replace(/^ปิด\s+/, "").trim())) ||
    lowerText === "ปิดงาน" ||
    lowerText === "ปิด";

  if (isSubmitKeywordMessage || isShortSendCommand || isShortCloseCommand) {
    let numId = 0;
    let extractedAssignee = "";
    let extractedTitle = "";
    let extractedDoDate = "";
    let extractedSendDate = "";

    // Determine if this action closes the task (ปิดงาน -> สถานะ: สำเร็จ)
    const isClosing =
      isShortCloseCommand ||
      rawText.includes("ปิดงาน") ||
      rawText.includes("ปิดสถานะ") ||
      rawText.startsWith("ปิด");
    const targetStatus = isClosing ? "สำเร็จ" : "ส่งงานแล้ว";

    if (isSubmitKeywordMessage) {
      const idMatch = rawText.match(/(?:(?:ลำดับ(?:ที่|งาน)?|รหัส(?:งาน)?|หมายเลข|id)[:\s]*#?|#)(\d+)/i);
      if (idMatch) numId = parseInt(idMatch[1], 10);
      const assigneeMatch = rawText.match(/งานของ:(?:|\s*)([^\n]+)/);
      if (assigneeMatch) extractedAssignee = assigneeMatch[1].trim();
      const titleMatch = rawText.match(/รายการ:(?:|\s*)([^\n]+)/);
      if (titleMatch) extractedTitle = titleMatch[1].trim();
      const doMatch = rawText.match(/ดู\/ทำ:(?:|\s*)([^\n]+)/);
      if (doMatch) extractedDoDate = doMatch[1].trim();
      const sendMatch = rawText.match(/ส่งงาน:(?:|\s*)([^\n]+)/);
      if (sendMatch) extractedSendDate = sendMatch[1].trim();
    } else {
      const rawTaskId = rawText.replace(/^ปิดงาน:|^ยืนยันปิดงาน:|^ปิด:|^ปิดงาน\s+|^ปิด\s+|^ส่งงาน:|^ยืนยันส่งงาน:|^ส่ง:|^ส่งงาน\s+|^ส่ง\s+/, "").trim();
      numId = parseInt(rawTaskId.replace(/\D/g, ""), 10);
    }

    if (!numId) {
      const exampleId = isClosing ? "7" : "2770";
      const exampleName = isClosing ? "ต้อม" : "มายู";
      const exampleTitle = isClosing ? "ซ่อใ" : "ทำบันทึกยอดสั่งข้าวโอที";
      await replyTextMessage(
        replyToken,
        `กรุณาระบุรหัสงาน เช่น\nงานของ: ${exampleName}\nลำดับ: ${exampleId}\nรายการ: ${exampleTitle}\nดู/ทำ: ${new Date().toLocaleDateString("th-TH")}\nส่งงาน: ${new Date().toLocaleDateString("th-TH")}\nเอกสาร ,รูปถ่าย ด้านล่างนี้`
      );
      return true;
    }

    const { data: foundTask } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", numId)
      .maybeSingle();

    const todayIso = getTodayDateIso();
    let assignee = extractedAssignee || foundTask?.assignee_name || "ทีมงาน";
    let taskTitle = extractedTitle || foundTask?.title || "งานประจำวัน";

    if (foundTask) {
      await supabaseAdmin
        .from("tasks")
        .update({
          status: targetStatus,
          send_date: foundTask.send_date || todayIso
        })
        .eq("id", numId);
    } else {
      // Upsert so manual IDs are guaranteed to exist in database
      await supabaseAdmin
        .from("tasks")
        .upsert({
          id: numId,
          title: taskTitle,
          assignee_name: assignee,
          status: targetStatus,
          do_date: todayIso,
          send_date: todayIso,
          task_type: 1
        });
    }

    const doDateStr = extractedDoDate || formatDateDisplay(foundTask?.do_date || todayIso);
    const sendDateStr = extractedSendDate || formatDateDisplay(foundTask?.send_date || todayIso);

    // Save active upload session for this user/chat/group so dropped images/files automatically attach to this task!
    const sessionKeys = [targetId, userId, `${targetId}_${userId}`].filter(Boolean);
    for (const key of sessionKeys) {
      await setActiveTaskUploadSession(key, numId, taskTitle, assignee);
    }

    if (isSubmitKeywordMessage) {
      // User PASTED the template into the group -> acknowledge cleanly and invite file/photo drop
      const statusTitle = isClosing ? "ปิดงาน (สำเร็จ)" : "ส่งงาน";
      const confirmMsg = [
        `รับข้อมูล${statusTitle} [#${numId}] เรียบร้อยแล้วครับ`,
        `ผู้รับผิดชอบ: ${assignee}`,
        `รายการ: ${taskTitle}`,
        `ส่งรูปถ่าย หรือ แนบไฟล์เอกสาร (PDF, Excel, Word) ลงในกลุ่มนี้ต่อได้ทันทีครับ (ระบบจะบันทึกเข้างานให้อัตโนมัติ)`
      ].join("\n");

      await replyTextMessage(replyToken, confirmMsg);
      return true;
    }

    // Short Command (e.g. "ส่งงาน: 2770" or "ปิดงาน: 7") -> Provide template for employee to copy to group
    const actionNotice = isClosing ? `ปิดงาน ${numId}` : `ส่งงาน ${numId}`;
    const detailTemplateMsg = [
      `งานของ: ${assignee}`,
      `ลำดับ: ${numId}`,
      `รายการ: ${taskTitle}`,
      `ดู/ทำ: ${doDateStr}`,
      `ส่งงาน: ${sendDateStr}`,
      `เอกสาร ,รูปถ่าย ด้านล่างนี้`
    ].join("\n");

    const messagesToSend = [actionNotice, detailTemplateMsg];
    await replyMultipleTextMessages(replyToken, messagesToSend);

    const taskGroup = await getLineTargetGroup("task");
    if (taskGroup && taskGroup !== targetId) {
      await sendMultipleTextMessages(taskGroup, messagesToSend);
    }
    return true;
  }

  // 4. Search Task ("s:", "งานทั้งหมด", ":งานที่ทำ", ":งานที่เสร็จ")
  if (rawText.startsWith("s:") || lowerText === "งานทั้งหมด" || lowerText === "งาน" || lowerText.includes(":งานที่ทำ") || lowerText.includes(":งานที่เสร็จ")) {
    const searchTerm = rawText.replace(/^s:/, "").replace(/^งาน:/, "").trim();
    let query = supabaseAdmin.from("tasks").select("*");
    if (searchTerm && searchTerm !== "งานทั้งหมด" && searchTerm !== "งาน") {
      query = query.or(`title.ilike.%${searchTerm}%,assignee_name.ilike.%${searchTerm}%`);
    }
    if (lowerText.includes(":งานที่เสร็จ")) {
      query = query.eq("status", "สำเร็จ");
    } else {
      query = query.neq("status", "สำเร็จ");
    }
    const { data: tasks } = await query.order("id", { ascending: false }).limit(15);

    if (!tasks || tasks.length === 0) {
      const noTaskMsg = searchTerm
        ? `ไม่พบงานที่ตรงกับ "${searchTerm}"\n\nลองค้นหาคำอื่น หรือสร้างงานใหม่ด้วยคำสั่ง "งานใหม่: รายละเอียด" ครับ`
        : `ไม่พบรายการงานค้างในระบบขณะนี้`;
      await replyTextMessage(replyToken, noTaskMsg);
      return true;
    }

    const formattedTasks = tasks.map(t => ({
      id: t.id,
      details: t.title || "-",
      status: t.status || "กำลังทำ",
      project: t.assignee_name ? `ผู้รับ: ${t.assignee_name}` : "งานทั่วไป",
      assignee_name: t.assignee_name,
      do_date: t.do_date,
      send_date: t.send_date,
      days: t.days,
      task_type: t.task_type,
      image_url: t.image_url,
      images: t.images
    }));

    const [attachmentsMap, projectCodeMap] = await Promise.all([
      getAllTaskAttachments(),
      fetchProjectCodeMap()
    ]);
    const flex = createTaskSummaryFlex(formattedTasks, { attachmentsMap, projectCodeMap });
    await replyFlexMessage(replyToken, `รายการงาน (${tasks.length} รายการ)`, flex);
    return true;
  }

  // 5. Multi-Subtask Creation Command ("ส่ง:")
  if (rawText.startsWith("ส่ง:")) {
    const lines = rawText.replace(/^ส่ง:/, "").trim().split("\n");
    const mainTitle = lines[0]?.trim() || "งานทั่วไป";
    const receiver = lines[1]?.replace(/^ผู้รับ:|^ถึง:|^ผู้รับผิดชอบ:/, "").trim() || "ทีมงาน";
    const head = lines[2]?.replace(/^หัวหน้า:|^อนุมัติโดย:/, "").trim() || "หัวหน้า";

    const todayIso = getTodayDateIso();
    const { data: insRows } = await supabaseAdmin
      .from("tasks")
      .insert([
        { title: mainTitle, assignee_name: receiver, status: "ดำเนินการ", task_type: 1, do_date: todayIso },
        { title: `${mainTitle} (ส่ง หัวหน้า)`, assignee_name: head, status: "ดำเนินการ", task_type: 1, do_date: todayIso },
        { title: `${mainTitle} (ส่ง ${receiver})`, assignee_name: receiver, status: "ดำเนินการ", task_type: 1, do_date: todayIso },
      ])
      .select();

    const id1 = insRows?.[0]?.id ? `#${insRows[0].id}` : "1";
    const id2 = insRows?.[1]?.id ? `#${insRows[1].id}` : "2";
    const id3 = insRows?.[2]?.id ? `#${insRows[2].id}` : "3";

    const createdMsg = `สร้าง 3 งานย่อยเรียบร้อยแล้ว!\n\n1. [${id1}] ${mainTitle}\n   ผู้รับผิดชอบ: ${receiver}\n2. [${id2}] ${mainTitle} (ส่ง หัวหน้า)\n   ผู้รับผิดชอบ: ${head}\n3. [${id3}] ${mainTitle} (ส่ง ${receiver})\n   ผู้รับผิดชอบ: ${receiver}`;

    await replyTextMessage(replyToken, createdMsg);

    const taskGroup = await getLineTargetGroup("task");
    if (taskGroup && taskGroup !== targetId) {
      await sendTextMessage(taskGroup, `[สร้าง 3 งานย่อยใหม่]\n${createdMsg}`);
    }
    return true;
  }

  // 6. Multi-line Task Edit / Creation Parser ("ลำดับ:", "รายการ:", "ดู/ทำ:")
  if (rawText.includes("รายการ:") && (rawText.includes("ดู/ทำ:") || rawText.includes("ส่งงาน:") || rawText.includes("ลำดับ:"))) {
    const getVal = (key: string) => {
      const regex = new RegExp(`${key}[:\\s]*(.*?)(?=\\n[a-zA-Zก-๙]+:|$)`, "s");
      const match = rawText.match(regex);
      return match ? match[1].trim() : "";
    };

    const rawTaskId = getVal("ลำดับ");
    const numTaskId = rawTaskId ? parseInt(rawTaskId.replace(/\D/g, ""), 10) : 0;
    const listName = getVal("รายการ");
    const doWork = getVal("ดู/ทำ") || getVal("ทำ");
    const sendWork = getVal("ส่งงาน") || getVal("ส่ง");
    const typeNumStr = getVal("ประเภท");
    const typeNum = typeNumStr === "2" ? 2 : typeNumStr === "3" ? 3 : 1;
    const receiver = getVal("ผู้รับ") || getVal("ผู้รับมอบหมาย") || "ทีมงาน";

    const typeLabel = typeNum === 2 ? "แผนงาน" : typeNum === 3 ? "PJSA" : "เอกสาร";

    if (numTaskId > 0) {
      await supabaseAdmin
        .from("tasks")
        .update({
          title: listName,
          assignee_name: receiver,
          task_type: typeNum,
          do_date: doWork && doWork !== "-" ? normalizeDateToIso(doWork) : null,
          send_date: sendWork && sendWork !== "-" ? normalizeDateToIso(sendWork) : null,
        })
        .eq("id", numTaskId);

      await replyTextMessage(replyToken, `อัปเดตงานลำดับ [#${numTaskId}] เรียบร้อยแล้ว! (${typeLabel})`);
    } else {
      const { data: insTask } = await supabaseAdmin
        .from("tasks")
        .insert({
          title: listName,
          assignee_name: receiver,
          task_type: typeNum,
          status: "ดำเนินการ",
          do_date: doWork && doWork !== "-" ? normalizeDateToIso(doWork) : getTodayDateIso(),
          send_date: sendWork && sendWork !== "-" ? normalizeDateToIso(sendWork) : null,
        })
        .select()
        .single();

      const newId = insTask?.id ? `#${insTask.id}` : "ใหม่";
      await replyTextMessage(replyToken, `สร้างงานใหม่ [${newId}] เรียบร้อยแล้ว! (${typeLabel})`);
    }
    return true;
  }

  return false;
}

/**
 * Handle all Works / PW-related commands ("addp", "PW1:work", "มอบหมาย:", etc.)
 */
export async function handleWorkCommands(
  rawText: string,
  lowerText: string,
  replyToken: string,
  targetId: string,
  userId: string,
  cleanCmd?: string
): Promise<boolean> {
  const normalizedCmd = cleanCmd || lowerText;

  // 1. Template Helper or Open Form (แยก Task กับ Work ชัดเจน)
  const isWorkFormCmd =
    lowerText === "addp" ||
    lowerText === "เปิดงานpw" ||
    lowerText === "สร้างงานpw" ||
    lowerText === "ฟอร์มpw" ||
    lowerText === "ฟอร์มpm" ||
    lowerText === "เปิดงานpm" ||
    lowerText === "สร้างงานpm";

  const isTaskFormCmd =
    lowerText === "addt" ||
    lowerText === "เปิดงานtask" ||
    lowerText === "สร้างงานtask" ||
    lowerText === "ฟอร์มtask" ||
    lowerText === "เปิดtask" ||
    lowerText === "สร้างtask";

  const isGeneralOpenCmd =
    lowerText === "เปิดงาน" ||
    lowerText === "สร้างงาน" ||
    lowerText === "ฟอร์มงาน" ||
    normalizedCmd === "เปิดงาน" ||
    normalizedCmd === "สร้างงาน";

  if (isTaskFormCmd) {
    const flex = createOpenTaskFormFlex();
    const sent = await replyFlexMessage(replyToken, "แบบฟอร์มเปิดงาน Task", flex);
    if (!sent && replyToken) {
      await replyTextMessage(replyToken, `เปิดงานใหม่ (Task / แผนงาน) ผ่านมือถือ:\n${getLiffUrl("/quick-task")}`);
    }
    return true;
  }

  if (isWorkFormCmd) {
    const flex = createOpenWorkFormFlex();
    const sent = await replyFlexMessage(replyToken, "แบบฟอร์มเปิดงานรับเหมา (PW)", flex);
    if (!sent && replyToken) {
      const formUrl = getLiffUrl("/quick-work");
      const addpTemplate = `เปิดงานรับเหมา ผ่านมือถือ:\n${formUrl}\n\nหรือคัดลอกแม่แบบมัลติไลน์ด้านล่าง:\n\nเรื่อง: งานผูกเหล็กและเทคอนกรีตฐานราก\nPR: PR-2026-0801\nสถานที่: ไซต์งาน อาคาร B\nนัดดู: ${new Date().toLocaleDateString("th-TH")}\nนัดเสนอ: -\nติดต่อ1: ช่างเอก\nเบอร์1: 081-234-5678\nบริษัท: บริษัท คอสท์แล็บ จำกัด`;
      await replyTextMessage(replyToken, addpTemplate);
    }
    return true;
  }

  if (isGeneralOpenCmd) {
    const flex = createOpenWorkOrTaskChooserFlex();
    const sent = await replyFlexMessage(replyToken, "เลือกแบบฟอร์มเปิดงาน", flex);
    if (!sent && replyToken) {
      const msg = `เลือกแบบฟอร์มเปิดงาน:\n\n1. งานรับเหมา (Work/PW):\n${getLiffUrl("/quick-work")}\n\n2. แผนงาน / งานทั่วไป (Task):\n${getLiffUrl("/quick-task")}`;
      await replyTextMessage(replyToken, msg);
    }
    return true;
  }

  // 2. Multiline PW Assignment ("เรื่อง:", "PR:", etc.)
  if (rawText.includes("เรื่อง:") && (rawText.includes("PR:") || rawText.includes("สถานที่:") || rawText.includes("ติดต่อ1:"))) {
    const getPWVal = (k: string) => {
      const regex = new RegExp(`(?:^|\\n)${k}[:\\s]*(.*?)(?=\\n|$)`, "i");
      const m = rawText.match(regex);
      return m ? m[1].trim() : "";
    };

    const topic = getPWVal("เรื่อง") || "งานรับเหมา";
    const prNo = getPWVal("PR") || "-";
    const location = getPWVal("สถานที่") || "-";
    const inspectDate = getPWVal("นัดดู") || "-";
    const offerDate = getPWVal("นัดเสนอ") || "-";
    const contact1 = getPWVal("ติดต่อ1") || getPWVal("ติดต่อ") || "-";
    const phone1 = getPWVal("เบอร์1") || getPWVal("เบอร์") || "-";
    const company = getPWVal("บริษัท") || "-";
    const note = getPWVal("หมายเหตุ") || "-";

    const { data: insWork } = await supabaseAdmin
      .from("works")
      .insert({
        team: "PW",
        activity_type: "เสนอราคา",
        title: topic,
        pr_no: prNo,
        location: location,
        date_inspect: inspectDate,
        date_propose: offerDate,
        contact1: contact1,
        phone1: phone1,
        company: company,
        status: "รอดูงาน",
        note: note
      })
      .select()
      .single();

    const pwId = insWork?.id ? `PW-${insWork.id}` : `PW-${Date.now().toString().slice(-4)}`;
    const fullDetails = `${topic} (PR: ${prNo}, สถานที่: ${location}, นัดดู: ${inspectDate}, นัดเสนอ: ${offerDate})`;

    const flex = createWorkAssignmentFlex({
      id: pwId,
      project_name: company !== "-" ? company : "งานรับเหมา",
      contractor_name: contact1,
      amount: 0,
      details: fullDetails,
      contact: contact1,
      phone: phone1
    });

    await replyFlexMessage(replyToken, `บันทึกงานรับเหมา [${pwId}] เรียบร้อยแล้ว`, flex);

    const pwGroup = await getLineTargetGroup("pw");
    if (pwGroup && pwGroup !== targetId) {
      await sendFlexMessageDetailed(pwGroup, `[แจ้งเตือนมอบหมายงาน PW: ${pwId}]`, flex);
    }
    return true;
  }

  // 3. Query Works / PW & PM ("pwall", "pw1", "pw2", "pw3", "pw4", "pw5", "pw", "work", etc.)
  const cleanTrimmed = rawText.trim().toLowerCase();
  const norm = normalizedCmd.trim().toLowerCase();

  const isPwAllQuery =
    norm === "pwall" ||
    norm === "pmall" ||
    norm === "pwall:work" ||
    norm === "pmall:work" ||
    norm === "pw:all" ||
    norm === "pm:all" ||
    cleanTrimmed === "pwall" ||
    cleanTrimmed === "pmall" ||
    cleanTrimmed === "pwall:work" ||
    cleanTrimmed === "pmall:work" ||
    cleanTrimmed === "pw all" ||
    cleanTrimmed === "pm all" ||
    cleanTrimmed === "งาน pwall" ||
    cleanTrimmed === "งานpw all" ||
    cleanTrimmed === "งานpm all" ||
    norm === "work" ||
    norm === "works" ||
    norm === "work:all" ||
    norm === "งานรับเหมา" ||
    cleanTrimmed === "work" ||
    cleanTrimmed === "works" ||
    cleanTrimmed === "งานรับเหมา";

  const isSpecificPwTeamQuery =
    /^(?:pw|pm)[1-5]$/i.test(norm) ||
    /^(?:pw|pm)[1-5]$/i.test(cleanTrimmed) ||
    /^(?:pw|pm)[1-5]:work$/i.test(cleanTrimmed) ||
    /^(?:pw|pm)\s*[1-5]$/i.test(cleanTrimmed) ||
    /^งาน(?:pw|pm)[1-5]$/i.test(cleanTrimmed) ||
    /^งาน\s*(?:pw|pm)[1-5]$/i.test(cleanTrimmed);

  const isBasePwQuery =
    norm === "pw" ||
    norm === "pm" ||
    cleanTrimmed === "pw" ||
    cleanTrimmed === "pm" ||
    cleanTrimmed === "pw:work" ||
    cleanTrimmed === "pm:work" ||
    cleanTrimmed === "งานpw" ||
    cleanTrimmed === "งานpm";

  // CASE A: PWALL -> แสดงแยก 5 Flex (PW1, PW2, PW3, PW4, PW5) ไม่ปนกันใน Flex เดียว
  if (isPwAllQuery) {
    const { data: allActiveWorks, error: fetchErr } = await supabaseAdmin
      .from("works")
      .select("*")
      .not("status", "in", '("เสร็จ","สำเร็จ","ปิดงาน")')
      .order("id", { ascending: false });

    if (fetchErr) {
      console.error("❌ Error fetching works for pwall:", fetchErr);
    }

    const attachmentsMap = await getAllWorkAttachments();
    const pwTeams = ["PW1", "PW2", "PW3", "PW4", "PW5"] as const;

    const flexList: Array<{ altText: string; contents: Record<string, any> }> = [];

    for (const teamName of pwTeams) {
      const teamNum = teamName.replace(/\D/g, ""); // "1", "2", "3", "4", "5"
      const pmName = `PM${teamNum}`;

      // Filter works strictly for this team - no mixing!
      const teamWorks = (allActiveWorks || []).filter((w) => {
        const t = String(w.team || "").trim().toUpperCase();
        return t === teamName || t === pmName || t === teamNum;
      });

      const flex = createWorkSummaryFlex(teamWorks, {
        teamName,
        attachmentsMap,
      });

      flexList.push({
        altText: `รายการงาน ${teamName} (${teamWorks.length} รายการ)`,
        contents: flex,
      });
    }

    const sent = await replyMultipleFlexMessages(replyToken, flexList);
    if (!sent && targetId) {
      await sendMultipleFlexMessagesDetailed(targetId, flexList);
    }
    return true;
  }

  // CASE B: Specific PW team (PW1, PW2, PW3, PW4, PW5) -> แยกเฉพาะทีมนั้น 1 Flex ไม่ปนทีมอื่น
  if (isSpecificPwTeamQuery) {
    const match = (cleanTrimmed + " " + norm).match(/(?:pw|pm)\s*([1-5])/i);
    const num = match ? match[1] : "1";
    const teamFilter = `PW${num}`;
    const pmFilter = `PM${num}`;

    const { data: teamWorks } = await supabaseAdmin
      .from("works")
      .select("*")
      .or(`team.eq.${teamFilter},team.eq.${pmFilter},team.eq.${num}`)
      .not("status", "in", '("เสร็จ","สำเร็จ","ปิดงาน")')
      .order("id", { ascending: false })
      .limit(20);

    const attachmentsMap = await getAllWorkAttachments();
    const flex = createWorkSummaryFlex(teamWorks || [], {
      teamName: teamFilter,
      attachmentsMap,
    });
    const altText = `รายการงาน ${teamFilter} (${teamWorks?.length || 0} รายการ)`;

    const sent = await replyFlexMessage(replyToken, altText, flex, targetId);
    if (!sent && replyToken) {
      let textSummary = `รายการงาน ${teamFilter} (${teamWorks?.length || 0} รายการ):\n\n`;
      (teamWorks || []).forEach((w, i) => {
        textSummary += `${i + 1}. [PW-${w.id}] ${w.title || "งานรับเหมา"}\n   - สถานะ: ${w.status || "รอดูงาน"}\n   - นัดดู: ${w.date_inspect || "-"}\n   - ติดต่อ: ${w.contact1 || "-"} (${w.phone1 || "-"})\n\n`;
      });
      await replyTextMessage(replyToken, textSummary.trim() || `ไม่มีงานค้าง (${teamFilter})`);
    }
    return true;
  }

  // CASE C: Base PW (งานทีม PW กลาง ไม่รวม PW1..PW5) -> แยกเฉพาะ 1 Flex
  if (isBasePwQuery) {
    const teamFilter = "PW";

    const { data: rawWorks } = await supabaseAdmin
      .from("works")
      .select("*")
      .or("team.eq.PW,team.eq.PM,team.is.null,team.eq.''")
      .not("status", "in", '("เสร็จ","สำเร็จ","ปิดงาน")')
      .order("id", { ascending: false })
      .limit(20);

    const filteredWorks = (rawWorks || []).filter((w) => {
      const t = String(w.team || "").trim().toUpperCase();
      return !/^(?:PW|PM)[1-5]$/i.test(t) && !/^[1-5]$/.test(t);
    });

    const attachmentsMap = await getAllWorkAttachments();
    const flex = createWorkSummaryFlex(filteredWorks, {
      teamName: "PW",
      attachmentsMap,
    });
    const altText = `รายการงาน PW (${filteredWorks.length} รายการ)`;

    const sent = await replyFlexMessage(replyToken, altText, flex, targetId);
    if (!sent && replyToken) {
      let textSummary = `รายการงาน PW (${filteredWorks.length} รายการ):\n\n`;
      filteredWorks.forEach((w, i) => {
        textSummary += `${i + 1}. [PW-${w.id}] ${w.title || "งานรับเหมา"}\n   - สถานะ: ${w.status || "รอดูงาน"}\n   - นัดดู: ${w.date_inspect || "-"}\n   - ติดต่อ: ${w.contact1 || "-"} (${w.phone1 || "-"})\n\n`;
      });
      await replyTextMessage(replyToken, textSummary.trim() || "ไม่มีงานค้าง (PW)");
    }
    return true;
  }

  // 4. Quick PW Assignment ("มอบหมาย:", "กิจกรรม:", "PW:")
  if (rawText.startsWith("มอบหมาย:") || rawText.startsWith("กิจกรรม:") || rawText.startsWith("PW:")) {
    const content = rawText.replace(/^มอบหมาย:|^กิจกรรม:|^PW:/, "").trim();
    if (!content) {
      await replyTextMessage(replyToken, `กรุณาระบุรายละเอียดการมอบหมายงาน\nเช่น มอบหมาย: งานผูกเหล็กและเทคอนกรีต [ช่างเอก] ฿250,000`);
      return true;
    }

    const amountMatch = content.match(/฿([\d,]+)/);
    const contractorMatch = content.match(/\[([^\]]+)\]/);
    const phoneMatch = content.match(/(?:โทร|tel|phone)[:\s]*([\d\-]+)/i);

    const parsedAmount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : 0;
    const parsedContractor = contractorMatch ? contractorMatch[1].trim() : "-";
    const parsedPhone = phoneMatch ? phoneMatch[1].trim() : "-";
    const parsedDetails = content
      .replace(/฿[\d,]+/, "")
      .replace(/\[[^\]]+\]/, "")
      .replace(/(?:โทร|tel|phone)[:\s]*[\d\-]+/i, "")
      .trim() || content;

    const { data: insWork } = await supabaseAdmin
      .from("works")
      .insert({
        team: "PW",
        activity_type: "เสนอราคา",
        title: parsedDetails,
        contact1: parsedContractor,
        phone1: parsedPhone,
        status: "รอดูงาน",
        note: parsedAmount > 0 ? `ยอดเสนอ: ฿${parsedAmount.toLocaleString("th-TH")}` : ""
      })
      .select()
      .single();

    const pwId = insWork?.id ? `PW-${insWork.id}` : `PW-${Date.now().toString().slice(-4)}`;

    const flex = createWorkAssignmentFlex({
      id: pwId,
      project_name: "งานรับเหมา",
      contractor_name: parsedContractor,
      amount: parsedAmount,
      details: parsedDetails,
      contact: parsedContractor,
      phone: parsedPhone
    });

    await replyFlexMessage(replyToken, `มอบหมายงาน [${pwId}] เรียบร้อยแล้ว`, flex);

    const pwGroup = await getLineTargetGroup("pw");
    if (pwGroup && pwGroup !== targetId) {
      await sendFlexMessageDetailed(pwGroup, `[แจ้งเตือนมอบหมายงาน PW: ${pwId}]`, flex);
    }
    return true;
  }

  // 5. One-Tap Status Auto-Advance ("เลื่อน: 1", "เลื่อน 1", "อัพเดท: 1", "อัพเดท 1", "อัปเดต 1", "update 1")
  const isAdvanceMatch =
    /^(?:เลื่อน|อัพเดท|อัปเดต|update)(?:pw|pm)?(?::|\s+)?/i.test(rawText.trim());

  if (isAdvanceMatch) {
    const rawWorkId = rawText.replace(/^(?:เลื่อน|อัพเดท|อัปเดต|update)(?:pw|pm)?(?::|\s+)?\s*(?:pw-?|pm-?)?/i, "").trim();
    const numId = parseInt(rawWorkId.replace(/\D/g, ""), 10);
    if (!numId) {
      await replyTextMessage(replyToken, `กรุณาระบุรหัสงานที่ต้องการเลื่อนสถานะ\nเช่น "เลื่อน: 6" หรือกดปุ่ม "เลื่อน" ในรายการงาน`);
      return true;
    }

    // 1. Fetch current work data
    const { data: workItem, error: fetchErr } = await supabaseAdmin
      .from("works")
      .select("*")
      .eq("id", numId)
      .single();

    if (fetchErr || !workItem) {
      await replyTextMessage(replyToken, `ไม่พบรายการงาน PW รหัส [${numId}] ในระบบ`);
      return true;
    }

    // 2. Automatically advance to next status in pipeline: รอดู -> รอเสนอ/ประชุม/ประมูล -> ส่งแล้ว -> สำเร็จ
    const currentStatus = String(workItem.status || "รอดู").trim();
    const act = String(workItem.activity_type || "").trim();

    let nextStatus = "รอเสนอ";
    if (currentStatus.includes("รอดู") || currentStatus === "รอดูงาน" || !currentStatus || currentStatus === "-") {
      if (act.includes("ประชุม")) {
        nextStatus = "ประชุม";
      } else if (act.includes("ประมูล")) {
        nextStatus = "ประมูล";
      } else {
        nextStatus = "รอเสนอ";
      }
    } else if (currentStatus.includes("รอเสนอ") || currentStatus === "เสนอราคา") {
      nextStatus = "ส่งแล้ว";
    } else if (currentStatus.includes("ประชุม")) {
      nextStatus = "ปิดประชุม";
    } else if (currentStatus.includes("ประมูล")) {
      nextStatus = "ปิดประมูล";
    } else if (currentStatus.includes("ส่งแล้ว") || currentStatus.includes("ปิดประชุม") || currentStatus.includes("ปิดประมูล")) {
      nextStatus = "ได้งาน";
    } else if (currentStatus.includes("ได้งาน")) {
      nextStatus = "สำเร็จ";
    } else if (currentStatus.includes("สำเร็จ") || currentStatus === "เสร็จ") {
      nextStatus = "รอดูงาน";
    } else {
      nextStatus = "รอเสนอ";
    }

    // 3. Update Supabase DB
    const { error: updateErr } = await supabaseAdmin
      .from("works")
      .update({ status: nextStatus })
      .eq("id", numId);


    if (updateErr) {
      await replyTextMessage(replyToken, `เลื่อนสถานะงาน [PW-${numId}] ไม่สำเร็จ: ${updateErr.message}`);
      return true;
    }

    // 4. Query latest works to re-render updated Flex Table immediately (strictly per team, no mixing)
    const rawTeam = String(workItem.team || "PW").trim().toUpperCase();
    const teamNum = rawTeam.replace(/\D/g, "");
    const teamFilter = teamNum ? `PW${teamNum}` : "PW";

    let query = supabaseAdmin.from("works").select("*").not("status", "in", '("เสร็จ","สำเร็จ","ปิดงาน")');
    if (teamNum) {
      const pmFilter = `PM${teamNum}`;
      query = query.or(`team.eq.${teamFilter},team.eq.${pmFilter},team.eq.${teamNum}`);
    } else {
      query = query.or("team.eq.PW,team.eq.PM,team.is.null,team.eq.''");
    }
    const { data: latestWorks } = await query.order("id", { ascending: false }).limit(15);

    const updateNotice = `เลื่อนสถานะงาน [PW-${numId}]: ${currentStatus} -> ${nextStatus}`;
    const attachmentsMap = await getAllWorkAttachments();
    const flex = createWorkSummaryFlex(latestWorks || [], { teamName: teamFilter, attachmentsMap });
    await replyFlexMessage(replyToken, updateNotice, flex, targetId);

    const pwGroup = await getLineTargetGroup("pw");
    if (pwGroup && pwGroup !== targetId) {
      await sendTextMessage(pwGroup, `[อัปเดตสถานะงาน PW]\n${updateNotice}`);
    }
    return true;
  }

  // 6. Set Status Directly ("สถานะ:", "สถานะpw:", "สถานะpm:", "สถานะ 6 รอเสนอ")
  const isDirectStatus =
    /^(?:สถานะ|status)(?:pw|pm)?(?::|\s+)?/i.test(rawText.trim());

  if (isDirectStatus) {
    const rawVal = rawText.replace(/^(?:สถานะ|status)(?:pw|pm)?(?::|\s+)?\s*(?:pw-?|pm-?)?/i, "").trim();
    const parts = rawVal.split(/\s+/);
    const numId = parseInt(parts[0].replace(/\D/g, ""), 10);
    const newStatus = parts[1] || "";
    if (!numId || !newStatus) {
      await replyTextMessage(replyToken, `กรุณาระบุรหัสงานและสถานะ เช่น สถานะ: 6 รอเสนอ`);
      return true;
    }

    // Fetch work to know team
    const { data: workItem } = await supabaseAdmin
      .from("works")
      .select("*")
      .eq("id", numId)
      .single();

    const { error } = await supabaseAdmin
      .from("works")
      .update({ status: newStatus })
      .eq("id", numId);

    if (error) {
      await replyTextMessage(replyToken, `อัพเดทสถานะงาน [PW-${numId}] ไม่สำเร็จ: ${error.message}`);
    } else {
      const updateMsg = `อัปเดตงาน PW [${numId}] เป็นสถานะ "${newStatus}" เรียบร้อยแล้ว`;

      // Query latest works strictly for this work's team
      const rawTeam = String(workItem?.team || "PW").trim().toUpperCase();
      const teamNum = rawTeam.replace(/\D/g, "");
      const teamFilter = teamNum ? `PW${teamNum}` : "PW";

      let query = supabaseAdmin.from("works").select("*").not("status", "in", '("เสร็จ","สำเร็จ","ปิดงาน")');
      if (teamNum) {
        const pmFilter = `PM${teamNum}`;
        query = query.or(`team.eq.${teamFilter},team.eq.${pmFilter},team.eq.${teamNum}`);
      } else {
        query = query.or("team.eq.PW,team.eq.PM,team.is.null,team.eq.''");
      }
      const { data: latestWorks } = await query.order("id", { ascending: false }).limit(15);
      const attachmentsMap = await getAllWorkAttachments();
      const flex = createWorkSummaryFlex(latestWorks || [], { teamName: teamFilter, attachmentsMap });
      await replyFlexMessage(replyToken, updateMsg, flex, targetId);

      const pwGroup = await getLineTargetGroup("pw");
      if (pwGroup && pwGroup !== targetId) {
        await sendTextMessage(pwGroup, `[อัปเดตสถานะงาน PW]\n${updateMsg}`);
      }
    }
    return true;
  }

  // 7. Close PW/PM Work ("ปิดpw:", "ปิดงานpw:", "ปิดpm:", "ปิดงานpm:", "ปิด: pw-", "ปิดงาน: pw-")
  if (
    rawText.startsWith("ปิดpw:") ||
    rawText.startsWith("ปิดงานpw:") ||
    rawText.startsWith("ปิดpm:") ||
    rawText.startsWith("ปิดงานpm:") ||
    /^ปิด(?:งาน)?(?:pw|pm)?[:\s]+(?:pw-|pm-)?\d+/i.test(rawText.trim())
  ) {
    const rawWorkId = rawText.replace(/^ปิดpw:|^ปิดงานpw:|^ปิดpm:|^ปิดงานpm:|^ปิดงาน:|^ปิด:/i, "").trim();
    const numId = parseInt(rawWorkId.replace(/\D/g, ""), 10);
    if (!numId) {
      await replyTextMessage(replyToken, `กรุณาระบุรหัสงาน PW/PM ที่ต้องการปิด\nเช่น ปิดpw: 45`);
      return true;
    }

    const { data: workItem } = await supabaseAdmin
      .from("works")
      .select("team")
      .eq("id", numId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("works")
      .update({ status: "เสร็จ" })
      .eq("id", numId);

    if (error) {
      await replyTextMessage(replyToken, `ปิดงาน PW รหัส [${numId}] ไม่สำเร็จ: ${error.message}`);
    } else {
      const closeMsg = `ปิดงาน PW รหัส [${numId}] เรียบร้อยแล้ว (สถานะ: เสร็จ)`;

      // Query latest remaining works strictly for this work's team
      const rawTeam = String(workItem?.team || "PW").trim().toUpperCase();
      const teamNum = rawTeam.replace(/\D/g, "");
      const teamFilter = teamNum ? `PW${teamNum}` : "PW";

      let query = supabaseAdmin.from("works").select("*").not("status", "in", '("เสร็จ","สำเร็จ","ปิดงาน")');
      if (teamNum) {
        const pmFilter = `PM${teamNum}`;
        query = query.or(`team.eq.${teamFilter},team.eq.${pmFilter},team.eq.${teamNum}`);
      } else {
        query = query.or("team.eq.PW,team.eq.PM,team.is.null,team.eq.''");
      }
      const { data: latestWorks } = await query.order("id", { ascending: false }).limit(15);
      const attachmentsMap = await getAllWorkAttachments();
      const flex = createWorkSummaryFlex(latestWorks || [], { teamName: teamFilter, attachmentsMap });
      await replyFlexMessage(replyToken, closeMsg, flex, targetId);

      const pwGroup = await getLineTargetGroup("pw");
      if (pwGroup && pwGroup !== targetId) {
        await sendTextMessage(pwGroup, `[อัปเดตงาน PW]\n${closeMsg}`);
      }
    }
    return true;
  }

  return false;
}
