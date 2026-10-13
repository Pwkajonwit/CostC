import fs from "fs";

const filePath = "d:/Codex/Project Customer/MAN/Costcontorl/lib/line/line-tasks-works.ts";
let content = fs.readFileSync(filePath, "utf8");

// 1. Update createMemberTaskTableFlex signature and showTimeline logic
const targetFuncStart = "export function createMemberTaskTableFlex(";
const targetFuncEnd = "// ==========================================\n// 3. Command Handlers";

const sIdx = content.indexOf(targetFuncStart);
const eIdx = content.indexOf(targetFuncEnd);

if (sIdx === -1 || eIdx === -1) {
  console.error("Function bounds not found!", { sIdx, eIdx });
  process.exit(1);
}

const newFunctionCode = `export function createMemberTaskTableFlex(
  memberName: string,
  tasks: Array<MemberTaskTableItem | any>,
  options?: {
    subtitle?: string;
    attachmentsMap?: Record<string, any>;
    showTimeline?: boolean;
  }
): Record<string, any> {
  // กรองงานที่เสร็จแล้ว/สำเร็จแล้วออก ไม่ต้องแสดงใน Flex ตามที่ผู้ใช้ระบุ
  const planTasks = tasks.filter(t => {
    const st = String(t.status || "").trim();
    return st !== "เสร็จ" && st !== "สำเร็จ" && st !== "ปิดงาน" && !st.includes("เสร็จ") && !st.includes("สำเร็จ");
  });

  const isAllTasks = !memberName || memberName === "ทั้งหมด" || memberName === "งานทั้งหมด" || memberName === "ทีมงานทั้งหมด";
  // "งาน", "งานทั้งหมด" ไม่ต้องแสดงไทม์ไลน์ ตามที่ผู้ใช้ระบุ
  const showTimeline = options?.showTimeline !== undefined ? options.showTimeline : !isAllTasks;

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
    const iso = \`\${year}-\${String(month).padStart(2, "0")}-\${String(day).padStart(2, "0")}\`;
    const displayDay = String(day);
    const displayDmy = \`\${String(day).padStart(2, "0")}/\${String(month).padStart(2, "0")}/\${String(year + 543).slice(-2)}\`;
    return { iso, year, month, day, displayDay, displayDmy };
  };

  const dayMinus1 = getTimelineDay(-1); // D-1 (Yesterday)
  const day0 = getTimelineDay(0);       // D0 (Today)
  const dayPlus1 = getTimelineDay(1);   // D+1 (Tomorrow)
  const dayPlus2 = getTimelineDay(2);   // D+2 (+2 days)

  const monthHeader = dayMinus1.month === dayPlus2.month
    ? \`เดือน \${day0.month}\`
    : \`เดือน \${dayMinus1.month}-\${dayPlus2.month}\`;

  const headerTitle = !isAllTasks
    ? \`รายการงาน (\${planTasks.length} งาน) | \${memberName}\`
    : \`รายการงาน (\${planTasks.length} งาน)\`;

  const defaultSubtitle = showTimeline
    ? \`ไทม์ไลน์ 4 วัน - \${monthHeader} • (เอกสาร \${docCount} • แผนงาน \${planCount} • PJSA \${pjsaCount})\`
    : \`รวม \${planTasks.length} รายการ (เอกสาร \${docCount} • แผนงาน \${planCount} • PJSA \${pjsaCount})\`;

  const subtitle = options?.subtitle || defaultSubtitle;

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
                  text: headerTitle,
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
            ...(showTimeline
              ? [
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
                          { type: "text", text: \`\${dayMinus1.displayDay}\`, size: "xxs", align: "center", flex: 1, color: "#6B7280" },
                          { type: "separator", color: "#EF4444" },
                          { type: "text", text: \`\${day0.displayDay}\`, size: "xxs", align: "center", flex: 1, color: "#EF4444", weight: "bold" },
                          { type: "separator", color: "#EF4444" },
                          { type: "text", text: \`\${dayPlus1.displayDay}\`, size: "xxs", align: "center", flex: 1, color: "#6B7280" },
                          { type: "separator" },
                          { type: "text", text: \`\${dayPlus2.displayDay}\`, size: "xxs", align: "center", flex: 1, color: "#6B7280" }
                        ]
                      }
                    ]
                  }
                ]
              : []),
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
              taskEndIso = \`\${endD.getUTCFullYear()}-\${String(endD.getUTCMonth() + 1).padStart(2, "0")}-\${String(endD.getUTCDate()).padStart(2, "0")}\`;
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
              return \`\${parts[2]}/\${parts[1]}/\${thYear}\`;
            }
            return fallbackStr || isoStr;
          };

          const startDisplay = formatShortDisplay(taskStartIso, t.dateStr || day0.displayDmy);
          const endDisplay = taskEndIso && taskEndIso !== taskStartIso
            ? formatShortDisplay(taskEndIso, t.sendDateStr)
            : (t.sendDateStr && t.sendDateStr !== "-" ? formatShortDisplay("", t.sendDateStr) : "");

          const displayDate = endDisplay ? \`\${startDisplay}\\n\${endDisplay}\` : startDisplay;

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
                  // Column 1: Task Title + Project below
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 6,
                    spacing: "xs",
                    contents: [
                      {
                        type: "text",
                        text: isAllTasks && t.assignee_name
                          ? \`[#\${taskIdStr}] [\${t.assignee_name}] \${taskTitle}\`
                          : \`[#\${taskIdStr}] \${taskTitle}\`,
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
                  ...(showTimeline
                    ? [
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
                        }
                      ]
                    : []),
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
                              text: \`ส่งงาน: \${taskIdStr}\`
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
                              text: \`ปิดงาน: \${taskIdStr}\`
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
        // Timeline & Status Legend Footer
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "xs",
          contents: [
            ...(showTimeline
              ? [
                  {
                    type: "text",
                    text: "ไทม์ไลน์: ■ กำลังทำ (น้ำเงิน)  ■ เสร็จ (เขียว)  ■ เกินกำหนด (แดง)  □ ไม่มีงาน",
                    size: "xxs",
                    color: "#94A3B8"
                  }
                ]
              : []),
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

`;

content = content.substring(0, sIdx) + newFunctionCode + content.substring(eIdx);

fs.writeFileSync(filePath, content, "utf8");
console.log("Successfully updated createMemberTaskTableFlex!");
