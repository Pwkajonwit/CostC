import fs from "fs";

const filePath = "d:/Codex/Project Customer/MAN/Costcontorl/lib/line/line-tasks-works.ts";
let content = fs.readFileSync(filePath, "utf8");

// 1. Replace createTaskSummaryFlex definition to delegate to createMemberTaskTableFlex
const startMarker = "export function createTaskSummaryFlex(";
const endMarker = "/**\n * Single Task Card with Attachments";

const sIdx = content.indexOf(startMarker);
const eIdx = content.indexOf(endMarker);

if (sIdx === -1 || eIdx === -1) {
  console.error("Markers not found!", { sIdx, eIdx });
  process.exit(1);
}

const newCreateTaskSummaryFlex = `export function createTaskSummaryFlex(
  tasks: Array<any>,
  options?: {
    attachmentsMap?: Record<string, any>;
    title?: string;
    subtitle?: string;
    badgeText?: string;
    actionButton?: { label: string; uri: string; color?: string; bgColor?: string };
  }
): Record<string, any> {
  const memberName = options?.title
    ? options.title.replace(/^รายการงาน\\s*\\(.*?\\)\\s*\\|\\s*/, "").replace(/^สรุปงานค้าง\\s*\\(.*?\\)/, "").trim()
    : "ทั้งหมด";
  return createMemberTaskTableFlex(memberName || "ทั้งหมด", tasks, options);
}

`;

content = content.substring(0, sIdx) + newCreateTaskSummaryFlex + content.substring(eIdx);

// 2. In createMemberTaskTableFlex:
// Ensure header text handles "ทั้งหมด" / default cleanly
content = content.replace(
  `text: memberName && memberName !== "ทีมงานทั้งหมด"\n                    ? \`รายการงาน (\${planTasks.length} งาน) | \${memberName}\`\n                    : \`รายการงาน (\${planTasks.length} งาน) | ไทม์ไลน์ 4 วัน - \${monthHeader}\`,`,
  `text: memberName && memberName !== "ทีมงานทั้งหมด" && memberName !== "ทั้งหมด"\n                    ? \`รายการงาน (\${planTasks.length} งาน) | \${memberName}\`\n                    : \`รายการงาน (\${planTasks.length} งาน)\`,`
);

// Ensure subtitle is consistent:
content = content.replace(
  `text: memberName && memberName !== "ทีมงานทั้งหมด"\n                    ? \`ไทม์ไลน์ 4 วัน - \${monthHeader} • (เอกสาร \${docCount} • แผนงาน \${planCount} • PJSA \${pjsaCount})\`\n                    : \`รวม \${planTasks.length} รายการ (เอกสาร \${docCount} • แผนงาน \${planCount} • PJSA \${pjsaCount})\`,`,
  `text: \`ไทม์ไลน์ 4 วัน - \${monthHeader} • (เอกสาร \${docCount} • แผนงาน \${planCount} • PJSA \${pjsaCount})\`,`
);

// Ensure assignee tag in row when memberName is "ทั้งหมด":
content = content.replace(
  `text: \`[#\${taskIdStr}] \${taskTitle}\`,`,
  `text: (!memberName || memberName === "ทั้งหมด" || memberName === "ทีมงานทั้งหมด") && t.assignee_name\n                          ? \`[#\${taskIdStr}] [\${t.assignee_name}] \${taskTitle}\`\n                          : \`[#\${taskIdStr}] \${taskTitle}\`,`
);

// 3. In handleTaskCommands (where "งาน", "งานค้าง", "doo" are called):
// When "doo", "งานค้าง" is called:
content = content.replace(
  `const flex = createTaskSummaryFlex(formattedTasks, { attachmentsMap });\n    await replyFlexMessage(replyToken, \`รายการงานค้างล่าสุด (\${activeTasks.length} รายการ)\`, flex);`,
  `const flex = createMemberTaskTableFlex("ทั้งหมด", formattedTasks, { attachmentsMap });\n    await replyFlexMessage(replyToken, \`รายการงานค้างล่าสุด (\${activeTasks.length} รายการ)\`, flex);`
);

// When "s:", "งานทั้งหมด", "งาน" is called:
content = content.replace(
  `const flex = createTaskSummaryFlex(formattedTasks, { attachmentsMap });\n    await replyFlexMessage(replyToken, \`รายการงาน (\${tasks.length} รายการ)\`, flex);`,
  `const flex = createMemberTaskTableFlex("ทั้งหมด", formattedTasks, { attachmentsMap });\n    await replyFlexMessage(replyToken, \`รายการงาน (\${tasks.length} รายการ)\`, flex);`
);

fs.writeFileSync(filePath, content, "utf8");
console.log("Successfully updated line-tasks-works.ts!");
