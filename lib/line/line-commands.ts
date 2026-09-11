import {
  replyTextMessage,
  replyFlexMessage,
  sendTextMessage,
  sendFlexMessageDetailed,
  getLineTargetGroup,
  logSystemError,
  createBillNotificationFlex,
  createWorkAssignmentFlex,
  createTaskSummaryFlex,
  createMemberTaskTableFlex,
  createBillSearchResultFlex,
  createWithdrawApproverFlex,
  isLineApproverAuthorized,
  isLineCloserAuthorized,
  getOperatorDisplayName,
  getRecipientDisplayNames,
  getPeopleMap,
  getBankInfoMap,
  getContractWorkMap,
  getProjectBudgetMap,
  createDailyTransferSummaryFlex
} from "@/lib/line/line";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { insertRowToSupabase } from "@/lib/supabase/supabase-db";
import { normalizeDateToIso, getTodayDateIso } from "@/lib/utils/dates";

/**
  * Central command processor for all 63 AppscriptBot keywords migrated to Next.js + Supabase
  */
export async function handleLineCommand(
  text: string,
  replyToken: string,
  targetId: string,
  userId: string
): Promise<boolean> {
  const rawText = text.trim();
  const lowerText = rawText.toLowerCase();

  try {
    // 1. System Health Check & Test Commands
    if (lowerText === "testbot" || lowerText === "check" || lowerText === "status" || lowerText === "getid") {
      if (lowerText === "getid") {
        await replyTextMessage(replyToken, `🟢 BOT Online (Supabase Engine)\n\nTarget ID: ${targetId}\nUser ID: ${userId}`);
        return true;
      }

      const { data, error } = await supabaseAdmin.from("bills").select("id", { count: "exact", head: true });
      if (error) {
        await replyTextMessage(replyToken, `⚠️ ตรวจสอบระบบ: LINE Webhook ทำงานปกติ แต่พบข้อความจาก Supabase: ${error.message}`);
      } else {
        await replyTextMessage(
          replyToken,
          `✅ 🤖 บอท CostCode Supabase ทำงานปกติ 100%!\n\n- Engine: Next.js v15 (Serverless)\n- Database: Supabase PostgreSQL (Connected)\n- Target ID: ${targetId}\n- Status: พร้อมรับทุกคำสั่ง 24/7`
        );
      }
      return true;
    }

    // 2. Menu & Help Commands
    if (lowerText === "ช่วยด้วย" || lowerText === "ช่วยเหลือ" || lowerText === "ช่วย" || lowerText === "เมนู" || lowerText === "คำสั่ง" || lowerText === "help") {
      const menuText = `🤖 ระบบ LINE Bot ประจำ CostCode Supabase\n\n📌 คำสั่งที่รองรับทั้งหมด:\n\n1. 📊 หมวดสรุปการเงิน/เบิกเงิน:\n   - พิมพ์ "ยอดโอนวันนี้" / "โอนวันนี้" (สรุปยอดโอนที่ปิดงานแล้ว รวมบัญชีเดียวกัน)\n   - พิมพ์ "สรุป" / "สรุปบิล" / "สรุปวันนี้"\n   - พิมพ์ "รออนุมัติ" (ดูบิลที่รอพิจารณาอนุมัติ)\n   - พิมพ์ "รอปิดงาน" / "รอจ่าย" / "อนุมัติแล้ว" (ดูบิลที่อนุมัติแล้ว รอการเงินปิดงาน)\n   - พิมพ์ "บิลหลัก: [ชื่อ]" หรือ "บิลย่อย: [ชื่อ]"\n   - พิมพ์ "ส่งไปเพื่ออนุมัติ" (ส่งแจ้งเตือนหาผู้อนุมัติ)\n   - พิมพ์ "อนุมัติบิลหลักของ:" / "อนุมัติเงินสดบิลย่อยของ:"\n   - พิมพ์ "ปิดงานบิลหลักลำดับที่:" / "ปิดงานเงินสดบิลย่อยลำดับที่:"\n\n2. 🎯 หมวดงาน & PW มอบหมาย:\n   - พิมพ์ "งาน2: [ชื่อพนักงาน]" (ดูตารางงานแผนงาน)\n   - พิมพ์ "งาน: [รายละเอียดงาน]" (สร้างงานใหม่)\n   - พิมพ์ "งานด่วน:" / "ปิดงาน:" / "ยืนยันปิดงาน:" / "s:" (ค้นหา)\n   - พิมพ์ "มอบหมาย:" / "กิจกรรม:" / "PW:" / "PW1:work" / "PWALL:work"\n\n3. ⚡ หมวดคำสั่งลัด (Shortcuts):\n   - พิมพ์ "copy" / "add1" / "add3" / "addp" / "doo"\n\n4. ⚙️ หมวดตรวจสอบระบบ:\n   - พิมพ์ "testbot" / "check" / "getid"`;
      await replyTextMessage(replyToken, menuText);
      return true;
    }

    // 2.1 Template Shortcut Commands (copy, work, add1, add3, addp, doo, doo2)
    if (lowerText === "copy" || lowerText === "work" || lowerText === "add1" || lowerText === "add3" || lowerText === "addp" || lowerText === "doo" || lowerText === "doo2") {
      if (lowerText === "copy" || lowerText === "work") {
        const copyTemplate = `📋 แม่แบบสำหรับสร้างงานทั่วไป (คัดลอกข้อความด้านล่าง):\n\nงาน: [รายละเอียดงาน] - [ชื่อผู้รับผิดชอบ]`;
        await replyTextMessage(replyToken, copyTemplate);
        return true;
      }
      if (lowerText === "add1") {
        const add1Template = `📋 แม่แบบสร้างงานมัลติไลน์ (คัดลอกข้อความด้านล่าง):\n\nรายการ: ตรวจสอบแบบโครงสร้าง\nดู/ทำ: ${new Date().toLocaleDateString("th-TH")}\nส่งงาน: -\nผู้รับ: สมชาย\nประเภท: 1`;
        await replyTextMessage(replyToken, add1Template);
        return true;
      }
      if (lowerText === "add3") {
        const add3Template = `📋 แม่แบบสร้าง 3 งานย่อยต่อกัน (คัดลอกข้อความด้านล่าง):\n\nส่ง: งานเทคอนกรีตเสาอาคาร A\nผู้รับ: ช่างเอก\nหัวหน้า: วิชัย`;
        await replyTextMessage(replyToken, add3Template);
        return true;
      }
      if (lowerText === "addp") {
        const addpTemplate = `📋 แม่แบบเปิดจ้าง PW มัลติไลน์ (คัดลอกข้อความด้านล่าง):\n\nเรื่อง: งานผูกเหล็กและเทคอนกรีตฐานราก\nPR: PR-2026-0801\nสถานที่: ไซต์งาน อาคาร B\nนัดดู: ${new Date().toLocaleDateString("th-TH")}\nนัดเสนอ: -\nติดต่อ1: ช่างเอก\nเบอร์1: 081-234-5678\nบริษัท: บริษัท คอสท์แล็บ จำกัด`;
        await replyTextMessage(replyToken, addpTemplate);
        return true;
      }
      if (lowerText === "doo" || lowerText === "doo2") {
        const { data: activeTasks } = await supabaseAdmin
          .from("tasks")
          .select("*")
          .neq("status", "สำเร็จ")
          .order("id", { ascending: false })
          .limit(8);

        if (!activeTasks || activeTasks.length === 0) {
          await replyTextMessage(replyToken, `📋 ไม่พบรายการงานค้างในขณะนี้`);
          return true;
        }

        let summary = `📋 รายการงานค้างล่าสุด (${activeTasks.length} รายการ):\n\n`;
        activeTasks.forEach((t, i) => {
          summary += `${i + 1}. [#${t.id}] ${t.title || "งานประจำวัน"} (รับผิดชอบ: ${t.assignee_name || "ทีมงาน"})\n`;
        });
        await replyTextMessage(replyToken, summary);
        return true;
      }
    }

    // 3. Task Commands (Controller_Task.gs)
    // 3.1 Task Search Grid by Member ("งาน2:เจมส์", "งาน:เจมส์") vs Create Task ("งาน: รายละเอียด...")
    if (rawText.startsWith("งาน2:") || rawText.startsWith("งาน:") || rawText.startsWith("งานด่วน:")) {
      const isTaskGridQuery = rawText.startsWith("งาน2:") || (rawText.startsWith("งาน:") && !rawText.includes(" ") && !rawText.includes(":") && !rawText.includes("["));
      const content = rawText.replace(/^งานด่วน:|^งาน2:|^งาน:/, "").trim();

      // A) Query Member Task Table Grid
      if (isTaskGridQuery || content.length < 15) {
        const memberName = content || "ทีมงาน";
        const { data: tasksList } = await supabaseAdmin
          .from("tasks")
          .select("*")
          .or(`assignee_name.ilike.%${memberName}%,title.ilike.%${memberName}%`)
          .order("id", { ascending: false })
          .limit(10);

        if (!tasksList || tasksList.length === 0) {
          await replyTextMessage(replyToken, `📋 ไม่พบรายการงานของ "${memberName}" ในระบบ\n\nกรุณาตรวจสอบชื่อหรือเพิ่มงานผ่านคำสั่ง "งาน: รายละเอียด" ครับ`);
          return true;
        }

        const dbTasks = tasksList.map(t => ({
          id: t.id,
          details: t.title || "งานประจำวัน",
          dateStr: t.do_date ? new Date(t.do_date).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" }) : new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" }),
          sendDateStr: t.send_date ? new Date(t.send_date).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" }) : undefined,
          status: t.status || "ดำเนินการ",
          task_type: t.task_type || 1
        }));

        const flex = createMemberTaskTableFlex(memberName, dbTasks);
        const sent = await replyFlexMessage(replyToken, `📋 รายการงานทั้งหมดของ ${memberName} (${dbTasks.length} รายการ)`, flex);

        if (!sent && replyToken) {
          let textSummary = `📋 งานทั้งหมด : ${memberName} (${dbTasks.length} รายการ)\n\n`;
          dbTasks.forEach((t, i) => {
            textSummary += `${i + 1}. [#${t.id}] ${t.details} (${t.dateStr}) - ${t.status}\n`;
          });
          await replyTextMessage(replyToken, textSummary);
        }
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
          title: `${isUrgent ? "🔴 [ด่วน] " : ""}${details}`,
          assignee_name: assignee,
          status: "ดำเนินการ",
          task_type: isUrgent ? 1 : 1,
          do_date: todayIso
        })
        .select()
        .single();

      const createdId = inserted?.id ? `#${inserted.id}` : "ใหม่";
      const notifyMsg = `✅ บันทึกงานเรียบร้อยแล้ว!\n\n📌 รหัสงาน: ${createdId}\nรายละเอียด: ${details}\nผู้รับผิดชอบ: ${assignee}\nสถานะ: กำลังดำเนินการ`;
      await replyTextMessage(replyToken, notifyMsg);

      // Multi-Group Routing: Push to Task Group if configured and different from source
      const taskGroup = await getLineTargetGroup("task");
      if (taskGroup && taskGroup !== targetId) {
        await sendTextMessage(taskGroup, `📢 [แจ้งเตือนงานใหม่]\n${notifyMsg}`);
      }

      return true;
    }

    // 3.2 Close Task ("ปิดงาน:", "ยืนยันปิดงาน:")
    if (rawText.startsWith("ปิดงาน:") || rawText.startsWith("ยืนยันปิดงาน:")) {
      const rawTaskId = rawText.replace(/^ปิดงาน:|^ยืนยันปิดงาน:/, "").trim();
      const numId = parseInt(rawTaskId.replace(/\D/g, ""), 10);
      if (!numId) {
        await replyTextMessage(replyToken, `⚠️ กรุณาระบุรหัสงานที่ต้องการปิด\nเช่น ปิดงาน: 101`);
        return true;
      }

      const { error } = await supabaseAdmin
        .from("tasks")
        .update({ status: "สำเร็จ" })
        .eq("id", numId);

      if (error) {
        await replyTextMessage(replyToken, `❌ ปิดงานรหัส [${numId}] ไม่สำเร็จ: ${error.message}`);
      } else {
        const closeMsg = `🎉 ปิดงานรหัส [${numId}] เรียบร้อยแล้วครับ! (สถานะ: สำเร็จ)`;
        await replyTextMessage(replyToken, closeMsg);

        // Multi-Group Routing: Push to Task Group
        const taskGroup = await getLineTargetGroup("task");
        if (taskGroup && taskGroup !== targetId) {
          await sendTextMessage(taskGroup, `📢 [อัปเดตงาน]\n${closeMsg}`);
        }
      }
      return true;
    }

    // 3.3 Search Task ("s:", "งานทั้งหมด", ":งานที่ทำ", ":งานที่เสร็จ")
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
      const { data: tasks } = await query.order("id", { ascending: false }).limit(10);

      if (!tasks || tasks.length === 0) {
        const noTaskMsg = searchTerm
          ? `🔍 ไม่พบงานที่ตรงกับ "${searchTerm}"\n\nลองค้นหาคำอื่น หรือสร้างงานใหม่ด้วยคำสั่ง "งาน: รายละเอียด" ครับ`
          : `📋 ไม่พบรายการงานค้างในระบบขณะนี้`;
        await replyTextMessage(replyToken, noTaskMsg);
        return true;
      }

      const formattedTasks = tasks.map(t => ({
        id: t.id,
        details: t.title || "-",
        status: t.status || "กำลังทำ",
        project: t.assignee_name ? `ผู้รับ: ${t.assignee_name}` : "งานทั่วไป"
      }));

      const flex = createTaskSummaryFlex(formattedTasks);
      await replyFlexMessage(replyToken, `📋 รายการงาน (${tasks.length} รายการ)`, flex);
      return true;
    }

    // 3.4 Multi-Subtask Creation Command ("ส่ง:")
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

      const createdMsg = `🎉 สร้าง 3 งานย่อยเรียบร้อยแล้ว!\n\n1. [${id1}] ${mainTitle}\n   ผู้รับผิดชอบ: ${receiver}\n2. [${id2}] ${mainTitle} (ส่ง หัวหน้า)\n   ผู้รับผิดชอบ: ${head}\n3. [${id3}] ${mainTitle} (ส่ง ${receiver})\n   ผู้รับผิดชอบ: ${receiver}`;

      await replyTextMessage(replyToken, createdMsg);

      const taskGroup = await getLineTargetGroup("task");
      if (taskGroup && taskGroup !== targetId) {
        await sendTextMessage(taskGroup, `📢 [สร้าง 3 งานย่อยใหม่]\n${createdMsg}`);
      }
      return true;
    }

    // 3.5 Multi-line Task Edit / Creation Parser ("ลำดับ:", "รายการ:", "ดู/ทำ:")
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

        await replyTextMessage(replyToken, `✅ อัปเดตงานลำดับ [#${numTaskId}] เรียบร้อยแล้ว! (${typeLabel})`);
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
        await replyTextMessage(replyToken, `✅ สร้างงานใหม่ [${newId}] เรียบร้อยแล้ว! (${typeLabel})`);
      }
      return true;
    }

    // 4. Work / PW Commands (Controller_Work.gs)
    // 4.1 Multi-line Detailed PW Assignment ("เรื่อง:", "PR:", "สถานที่:", "นัดดู:")
    if (rawText.includes("เรื่อง:") || rawText.includes("PR:") || rawText.includes("นัดดู:") || rawText.includes("นัดเสนอ:")) {
      const getPWVal = (key: string) => {
        const regex = new RegExp(`${key}[:\\s]*(.*?)(?=\\n[a-zA-Zก-๙]+:|$)`, "i");
        const match = rawText.match(regex);
        return match ? match[1].trim() : "";
      };

      const topic = getPWVal("เรื่อง") || getPWVal("รายการ");
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

      await replyFlexMessage(replyToken, `👷‍♂️ บันทึกงานรับเหมามัลติไลน์ [${pwId}] เรียบร้อยแล้ว`, flex);

      const pwGroup = await getLineTargetGroup("pw");
      if (pwGroup && pwGroup !== targetId) {
        await sendFlexMessageDetailed(pwGroup, `📢 [แจ้งเตือนมอบหมายงาน PW มัลติไลน์: ${pwId}]`, flex);
      }
      return true;
    }

    // 4.2 Single-line Quick PW Assignment or PW Query (PW1:work, PWALL:work)
    if (rawText.startsWith("PW1:work") || rawText.startsWith("PW2:work") || rawText.startsWith("PW3:work") || rawText.startsWith("PW4:work") || rawText.startsWith("PWALL:work") || rawText.startsWith("PW:work")) {
      const teamFilter = rawText.startsWith("PW1") ? "PW1" : rawText.startsWith("PW2") ? "PW2" : rawText.startsWith("PW3") ? "PW3" : rawText.startsWith("PW4") ? "PW4" : "";
      
      let query = supabaseAdmin.from("works").select("*");
      if (teamFilter) {
        query = query.eq("team", teamFilter);
      }
      const { data: worksList } = await query.order("id", { ascending: false }).limit(10);

      if (!worksList || worksList.length === 0) {
        await replyTextMessage(replyToken, `👷‍♂️ ไม่พบรายการงาน PW ${teamFilter || "ทั้งหมด"} ในขณะนี้`);
        return true;
      }

      let textSummary = `👷‍♂️ รายการงาน PW ${teamFilter || "ทั้งหมด"} (${worksList.length} รายการ):\n\n`;
      worksList.forEach((w, i) => {
        textSummary += `${i + 1}. [PW${w.id}] ${w.title || "งานรับเหมา"}\n   - สถานะ: ${w.status || "รอดูงาน"}\n   - นัดดู: ${w.date_inspect || "-"}\n   - ติดต่อ: ${w.contact1 || "-"} (${w.phone1 || "-"})\n\n`;
      });

      await replyTextMessage(replyToken, textSummary.trim());
      return true;
    }

    if (rawText.startsWith("มอบหมาย:") || rawText.startsWith("กิจกรรม:") || rawText.startsWith("PW:")) {
      const content = rawText.replace(/^มอบหมาย:|^กิจกรรม:|^PW:/, "").trim();
      if (!content) {
        await replyTextMessage(replyToken, `⚠️ กรุณาระบุรายละเอียดการมอบหมายงาน\nเช่น มอบหมาย: งานผูกเหล็กและเทคอนกรีต [ช่างเอก] ฿250,000`);
        return true;
      }

      // Parse content: "มอบหมาย: งานผูกเหล็ก [ช่างเอก] ฿250,000 โทร:081-234-5678"
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
        project_name: "-",
        contractor_name: parsedContractor,
        amount: parsedAmount,
        details: parsedDetails,
        contact: parsedContractor !== "-" ? parsedContractor : "-",
        phone: parsedPhone
      });

      await replyFlexMessage(replyToken, `👷‍♂️ มอบหมายงาน [${pwId}] เรียบร้อยแล้ว`, flex);

      // Multi-Group Routing: Push to PW Work Group
      const pwGroup = await getLineTargetGroup("pw");
      if (pwGroup && pwGroup !== targetId) {
        await sendFlexMessageDetailed(pwGroup, `📢 [แจ้งเตือนมอบหมายงาน PW ใหม่: ${pwId}]`, flex);
      }

      return true;
    }

    // 4.9 Send for Approval Command ("ส่งต่อให้ผู้อนุมัติ", "ส่งไปเพื่ออนุมัติ", "ส่งอนุมัติ", etc.)
    if (
      rawText.startsWith("ส่งไปเพื่ออนุมัติบิลลำดับที่:") ||
      rawText.startsWith("ส่งไปเพื่ออนุมัติ:") ||
      rawText.startsWith("ส่งไปเพื่ออนุมัติบิล:") ||
      rawText === "ส่งไปเพื่ออนุมัติ" ||
      rawText.startsWith("ส่งต่อให้ผู้อนุมัติ:") ||
      rawText.startsWith("ส่งต่อให้ผู้อนุมัติ") ||
      rawText.startsWith("ส่งต่อผู้อนุมัติ:") ||
      rawText.startsWith("ส่งต่อผู้อนุมัติ") ||
      rawText.startsWith("ส่งต่อ:") ||
      rawText.startsWith("ส่งให้ผู้อนุมัติ:") ||
      rawText.startsWith("ส่งให้ผู้อนุมัติ") ||
      rawText.startsWith("ส่งขออนุมัติ:") ||
      rawText.startsWith("ส่งขออนุมัติ") ||
      rawText.startsWith("ส่งอนุมัติ:") ||
      rawText.startsWith("ส่งอนุมัติบิล:") ||
      rawText.startsWith("ส่งอนุมัติบิลลำดับที่:") ||
      rawText.startsWith("ส่งบิลเพื่ออนุมัติ:")
    ) {
      const sheetRowStr = rawText
        .replace(/^ส่งไปเพื่ออนุมัติบิลลำดับที่:|^ส่งไปเพื่ออนุมัติ:|^ส่งไปเพื่ออนุมัติบิล:|^ส่งไปเพื่ออนุมัติ|^ส่งต่อให้ผู้อนุมัติ:|^ส่งต่อให้ผู้อนุมัติ|^ส่งต่อผู้อนุมัติ:|^ส่งต่อผู้อนุมัติ|^ส่งต่อ:|^ส่งให้ผู้อนุมัติ:|^ส่งให้ผู้อนุมัติ|^ส่งขออนุมัติ:|^ส่งขออนุมัติ|^ส่งอนุมัติ:|^ส่งอนุมัติบิล:|^ส่งอนุมัติบิลลำดับที่:|^ส่งบิลเพื่ออนุมัติ:/i, "")
        .trim();

      const { getRows } = await import("@/lib/db");
      const { getLineConfigIds, createWithdrawOwnerFlex, sendFlexMessageDetailed, getContractWorkMap } = await import("@/lib/line/line");
      const { normalizeBillStatus } = await import("@/lib/bills/bill-status");
      const [rawBills, peopleRows] = await Promise.all([
        getRows("Data", 0, 5000),
        getRows("master_members", 60_000, 500).catch(() => []),
      ]);

      const peopleMap = new Map<string, string>();
      const nameToEmpIdMap = new Map<string, string>();
      for (const p of peopleRows) {
        const empId = String(p["รหัสพนักงาน"] || p.id || "").trim();
        const empName = String(p["ชื่อเล่น"] || p["ชื่อ-นามสกุล"] || p.name || "").trim();
        if (empId && empName) {
          peopleMap.set(empId, empName);
          nameToEmpIdMap.set(empName, empId);
        }
      }

      const targetIdList = sheetRowStr.split(/[,,\s]+/).map(id => id.trim()).filter(Boolean);
      const isExplicitIdList = (
        rawText.startsWith("ส่งไปเพื่ออนุมัติบิลลำดับที่:") ||
        rawText.startsWith("ส่งอนุมัติบิลลำดับที่:") ||
        (targetIdList.length > 0 && targetIdList.every(id => /^\d+$/.test(id)))
      );

      let targetBills = rawBills.filter(b => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        // Only select bills that are pending approval
        if (st === "อนุมัติ" || st === "เบิกแล้ว") return false;

        const bId = String(b.id || b["ลำดับ"] || b._sheetRow || "").trim();

        if (isExplicitIdList) {
          return targetIdList.includes(bId);
        }

        if (!sheetRowStr || sheetRowStr === "ทั้งหมด" || sheetRowStr === "บิล") {
          return true;
        }

        const bReq = String(b["ผู้เบิก"] || b.requester || "").trim();
        const bReqName = peopleMap.get(bReq) || bReq;
        const matchedEmpId = nameToEmpIdMap.get(sheetRowStr) || sheetRowStr;

        return (
          bReq === sheetRowStr ||
          bReq === matchedEmpId ||
          bReqName.toLowerCase().includes(sheetRowStr.toLowerCase())
        );
      });

      if (targetBills.length === 0) {
        await replyTextMessage(
          replyToken,
          sheetRowStr && sheetRowStr !== "ทั้งหมด"
            ? `🔍 ไม่พบรายการบิลที่รออนุมัติสำหรับ "${sheetRowStr}" ในระบบ`
            : "🔍 ขณะนี้ไม่มีรายการบิลที่รอการอนุมัติในระบบครับ"
        );
        return true;
      }

      // Prevent duplicate approval requests for bills that are already approved or finished
      const pendingBills = targetBills.filter(b => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        return st !== "อนุมัติ" && st !== "เบิกแล้ว";
      });

      if (pendingBills.length === 0) {
        await replyTextMessage(
          replyToken,
          `⚠️ รายการบิลที่เลือกอยู่ในสถานะ "อนุมัติแล้ว" หรือ "ปิดงานแล้ว" เรียบร้อยแล้ว (ระบบป้องกันการสั่งอนุมัติซ้ำ)`
        );
        return true;
      }

      const { approverIds } = await getLineConfigIds();
      const targetApprovers = (approverIds && approverIds.length > 0) ? approverIds : [];

      if (targetApprovers.length === 0) {
        await replyTextMessage(
          replyToken,
          "⚠️ ยังไม่ได้ระบุ LINE User ID ผู้อนุมัติ (Approver) ในระบบ กรุณาตรวจสอบสิทธิ์อนุมัติบิลในหน้าพนักงานครับ"
        );
        return true;
      }

      const [resolvedPeopleMap, bankInfoMap, contractsMap, projectBudgetMap] = await Promise.all([
        getPeopleMap(),
        getBankInfoMap(),
        getContractWorkMap(),
        getProjectBudgetMap()
      ]);
      const flexForApprovers = createWithdrawOwnerFlex(pendingBills, resolvedPeopleMap, bankInfoMap, contractsMap, projectBudgetMap);
      const totalAmount = pendingBills.reduce((sum, b) => sum + Number(b["ยอดเงิน"] || b.amount || 0), 0);
      const amountStr = totalAmount.toLocaleString("th-TH");

      const altText = pendingBills.length === 1
        ? `📋 คำขออนุมัติเบิกเงิน #${pendingBills[0]["ลำดับ"] || pendingBills[0].id || ""} (฿${amountStr})`
        : `📋 คำขออนุมัติเบิกเงิน ${pendingBills.length} รายการ (รวม ฿${amountStr})`;

      let successCount = 0;
      let lastError = "";

      for (const targetUserId of targetApprovers) {
        const result = await sendFlexMessageDetailed(targetUserId, altText, flexForApprovers);
        if (result.success) {
          successCount++;
        } else {
          lastError = result.error || "";
        }
      }

      if (successCount > 0) {
        const targetIdsStr = pendingBills.map(b => `#${b["ลำดับ"] || b.id || ""}`).join(", ");
        const approverNames = await getRecipientDisplayNames(targetApprovers, "ท่าน");
        await replyTextMessage(
          replyToken,
          `✅ ส่งรายการตั้งเบิก ${targetIdsStr} (${pendingBills.length} รายการ รวม ฿${amountStr}) ไปยังผู้อนุมัติ (${approverNames}) เพื่อพิจารณาอนุมัติเรียบร้อยแล้วครับ!`
        );
      } else {
        await replyTextMessage(
          replyToken,
          `❌ ไม่สามารถส่ง Flex ไปยังผู้อนุมัติได้: ${lastError || "ข้อผิดพลาด LINE API กรุณาตรวจสอบสิทธิ์ LINE Bot"}`
        );
      }
      return true;
    }

    // 5. Approve / Disapprove / Close Bill Commands
    if (
      rawText.startsWith("อนุมัติบิลหลักของ:") ||
      rawText.startsWith("อนุมัติเงินสดบิลย่อยของ:") ||
      rawText.startsWith("อนุมัติบิลหลักลำดับที่:") ||
      rawText.startsWith("อนุมัติเงินสดบิลย่อยลำดับที่:") ||
      rawText.startsWith("อนุมัติบิลลำดับที่:") ||
      rawText.startsWith("ไม่อนุมัติบิลลำดับที่:") ||
      rawText.startsWith("ไม่อนุมัติ:") ||
      rawText.startsWith("ปิดงานบิลหลักลำดับที่:") ||
      rawText.startsWith("ปิดงานเงินสดบิลย่อยของ:") ||
      rawText.startsWith("ปิดงานเงินสดบิลย่อยลำดับที่:") ||
      rawText.startsWith("ปิดงานบิลย่อยลำดับที่:") ||
      rawText.startsWith("ปิดงานบิลลำดับที่:") ||
      rawText.startsWith("อนุมัติทั้งหมด:") ||
      rawText.startsWith("ปิดงานทั้งหมด:")
    ) {
      const rawTarget = rawText.replace(/.*?:/, "").trim();
      const isReject = rawText.includes("ไม่อนุมัติ");
      const isApprove = rawText.includes("อนุมัติ") && !isReject;
      const isBatchAll = rawText.startsWith("อนุมัติทั้งหมด:") || rawText.startsWith("ปิดงานทั้งหมด:");

      if (!rawTarget && !isBatchAll) {
        await replyTextMessage(replyToken, `⚠️ กรุณาระบุชื่อผู้เบิกหรือรายละเอียดที่ต้องการ${isReject ? "ไม่อนุมัติ" : isApprove ? "อนุมัติ" : "ปิดงาน"}`);
        return true;
      }

      // Check LINE Authorization based on specific action (Approval vs Close)
      if (isApprove || isReject) {
        const isAuthorized = await isLineApproverAuthorized(userId, targetId);
        if (!isAuthorized) {
          await replyTextMessage(
            replyToken,
            `⛔ ขออภัยครับ บัญชี LINE ของคุณไม่มีสิทธิ์ในการ${isReject ? "ไม่อนุมัติ" : "อนุมัติ"}บิล\n\n(สิทธิ์การอนุมัติสงวนไว้เฉพาะผู้อนุมัติบิล หรือ ผู้ดูแลระบบเท่านั้น ฝ่ายการเงินไม่มีสิทธิ์อนุมัติบิล)`
          );
          return true;
        }
      } else {
        // ปิดงาน / จ่ายเงิน
        const isAuthorized = await isLineCloserAuthorized(userId, targetId);
        if (!isAuthorized) {
          await replyTextMessage(
            replyToken,
            `⛔ ขออภัยครับ บัญชี LINE ของคุณไม่มีสิทธิ์ในการปิดงาน/จ่ายเงินบิล\n\n(สิทธิ์การปิดงานสงวนไว้เฉพาะฝ่ายการเงิน หรือ ผู้ดูแลระบบเท่านั้น)`
          );
          return true;
        }
      }

      const newStatus = isReject ? "ไม่อนุมัติ" : isApprove ? "อนุมัติ" : "เบิกแล้ว";
      const isSubBatch = rawText.includes("ย่อย") || rawTarget.includes("ย่อย");
      const isMainBatch = rawText.includes("หลัก") || rawTarget.includes("หลัก");
      const cleanTarget = rawTarget.replace(/^หลัก:|^ย่อย:|^บิลหลัก:|^บิลย่อย:|^บิล:|^ลำดับที่:|^บิลลำดับที่:|^หลักลำดับที่:|^ย่อยลำดับที่:/i, "").trim();
      const targetIdList = cleanTarget.split(/[,,\s]+/).map(id => id.trim()).filter(Boolean);
      const isExplicitIdList = (
        rawText.startsWith("อนุมัติบิลลำดับที่:") ||
        rawText.startsWith("อนุมัติบิลหลักลำดับที่:") ||
        rawText.startsWith("อนุมัติเงินสดบิลย่อยลำดับที่:") ||
        rawText.startsWith("ปิดงานบิลลำดับที่:") ||
        rawText.startsWith("ปิดงานบิลหลักลำดับที่:") ||
        rawText.startsWith("ปิดงานเงินสดบิลย่อยลำดับที่:") ||
        rawText.startsWith("ปิดงานบิลย่อยลำดับที่:") ||
        rawText.startsWith("ไม่อนุมัติบิลลำดับที่:") ||
        (targetIdList.length > 0 && targetIdList.every(id => /^\d+$/.test(id)))
      );

      const { normalizeBillStatus } = await import("@/lib/bills/bill-status");
      const { updateRowInSupabase } = await import("@/lib/supabase/supabase-db");
      const { getRows, invalidateTableCache } = await import("@/lib/db");
      const { getLineConfigIds, createWithdrawApproverFlex, sendFlexMessageDetailed, getContractWorkMap } = await import("@/lib/line/line");
      const [rawBills, peopleRows] = await Promise.all([
        getRows("Data", 0, 5000),
        getRows("master_members", 60_000, 500).catch(() => []),
      ]);

      function checkIsSubBill(b: any): boolean {
        const billVal = String(b["บิล"] || b.bill || b.bill_type || "").trim();
        if (billVal.includes("ย่อย")) return true;
        if (billVal.includes("หลัก")) return false;
        const cat = String(b["ประเภท"] || b.category || "").trim();
        return cat.includes("ย่อย") || cat.startsWith("2.") || cat.startsWith("3.") || cat.startsWith("8.");
      }

      const peopleMap = new Map<string, string>();
      const nameToEmpIdMap = new Map<string, string>();
      for (const p of peopleRows) {
        const empId = String(p["รหัสพนักงาน"] || p.id || "").trim();
        const empName = String(p["ชื่อเล่น"] || p["ชื่อ-นามสกุล"] || p.name || "").trim();
        if (empId && empName) {
          peopleMap.set(empId, empName);
          nameToEmpIdMap.set(empName, empId);
        }
      }

      const target = cleanTarget;
      const matchedEmpId = nameToEmpIdMap.get(target) || target;

      const targetBills = rawBills.filter(b => {
        const currentSt = String(b["สถานะ"] || b.status || "").trim();
        const normSt = normalizeBillStatus(currentSt);

        // Skip bills that are already approved or finished when performing approval
        if ((isApprove || isReject) && (normSt === "อนุมัติ" || normSt === "เบิกแล้ว" || currentSt.includes("เสร็จ") || currentSt.includes("ปิดงาน") || currentSt.includes("จ่ายแล้ว"))) {
          return false;
        }
        // When performing close, only bills that are ALREADY APPROVED ("อนุมัติ") can be closed!
        if (!isApprove && !isReject && normSt !== "อนุมัติ") {
          return false;
        }

        if (isSubBatch && !checkIsSubBill(b)) return false;
        if (isMainBatch && checkIsSubBill(b)) return false;

        const bId = String(b.id || b["ลำดับ"] || b._sheetRow || "").trim();

        // Exact match by Bill ID takes absolute priority for single/multi bill ID actions
        if (isExplicitIdList) {
          return targetIdList.includes(bId);
        }

        if (!target || target === "ทั้งหมด" || target === "หลัก" || target === "ย่อย") return true;

        const bReq = String(b["ผู้เบิก"] || b.requester || "").trim();
        const bReqName = peopleMap.get(bReq) || bReq;
        const bVendor = String(b["ร้าน/บุคคล"] || b.vendor_or_person || "").trim();
        const bDesc = String(b["สินค้า/ทำงาน"] || b.description || "").trim();

        return (
          bReq === target ||
          bReq === matchedEmpId ||
          bReqName.toLowerCase().includes(target.toLowerCase()) ||
          bVendor.toLowerCase().includes(target.toLowerCase()) ||
          bDesc.toLowerCase().includes(target.toLowerCase())
        );
      });

      if (targetBills.length === 0) {
        if (!isApprove && !isReject && isExplicitIdList) {
          const unapprovedMatches = rawBills.filter(b => {
            const bId = String(b.id || b["ลำดับ"] || b._sheetRow || "").trim();
            return targetIdList.includes(bId);
          });
          if (unapprovedMatches.length > 0) {
            const stList = unapprovedMatches.map(b => `#${b.id || b["ลำดับ"] || b._sheetRow} (${b["สถานะ"] || b.status || "ตั้งเบิก"})`).join(", ");
            await replyTextMessage(
              replyToken,
              `⚠️ ไม่สามารถปิดงานได้ เนื่องจากบิล ${stList} ยังไม่ได้รับการอนุมัติจากผู้อนุมัติบิล\n\n(ฝ่ายการเงินสามารถปิดงานได้เฉพาะบิลที่มีสถานะ "อนุมัติ" แล้วเท่านั้นครับ)`
            );
            return true;
          }
        }

        await replyTextMessage(
          replyToken,
          `🔍 ไม่พบรายการบิล${isSubBatch ? "ย่อย" : isMainBatch ? "หลัก" : ""}ที่สามารถ${isApprove ? "อนุมัติ" : "ปิดงาน"}ได้สำหรับ "${rawTarget || "รายการที่เลือก"}"`
        );
        return true;
      }

      let totalAmount = 0;
      const { closerIds, financeIds } = await getLineConfigIds();
      const rawFinanceList = Array.from(new Set([...(closerIds || []), ...(financeIds || [])].filter(Boolean)));
      const fallbackFinanceGroup = await getLineTargetGroup("finance");
      const validFinanceGroup = fallbackFinanceGroup && fallbackFinanceGroup.startsWith("C") ? fallbackFinanceGroup : "";
      const targetFinanceList = rawFinanceList.length > 0 
        ? rawFinanceList 
        : (validFinanceGroup ? [validFinanceGroup] : []);

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split("T")[0];

      for (const b of targetBills) {
        const bId = b.id || b["ลำดับ"] || b._sheetRow;
        totalAmount += Number(b["ยอดเงิน"] || b.amount || 0);

        const patchPayload: Record<string, any> = {
          "สถานะ": newStatus,
          status: newStatus
        };

        if (isApprove) {
          patchPayload.approved_at = nowIso;
        } else if (!isReject) {
          // Closed / Paid
          patchPayload.paid_at = nowIso;
          patchPayload.paid_date = todayDate;
          patchPayload["วันจ่าย"] = todayDate;
        }

        await updateRowInSupabase("bills", "id", bId, patchPayload);
        b["สถานะ"] = newStatus;
        b.status = newStatus;
      }

      // Sync contract_works paid amount when bills are closed/paid
      if (!isApprove && !isReject) {
        const { syncContractWorkPaidAmount } = await import("@/lib/supabase/supabase-db");
        for (const b of targetBills) {
          const d = (b.data && typeof b.data === "object") ? b.data : {};
          const cRef = String(b._rawContractor || d._rawContractor || b.conwork_id || d.conwork_id || b["สัญญา"] || d["สัญญา"] || b.contractor_id || b["ผู้รับเหมา"] || "").trim();
          const pId = String(b.project_id || d["ID Project"] || "").trim();
          if (cRef) {
            syncContractWorkPaidAmount(cRef, pId).catch(() => null);
          }
        }
      }

      // Invalidate table caches immediately so next read is 100% fresh
      invalidateTableCache("Data");
      invalidateTableCache("bills");
      const { revalidateAllBillViews } = await import("@/lib/utils/cache");
      revalidateAllBillViews();

      // When Approver Approves successfully, forward Multi-Item Flex Message to Finance / Closers to pay & close job
      if (isApprove && targetFinanceList.length > 0) {
        const [peopleMap, bankInfoMap, contractsMap, projectBudgetMap] = await Promise.all([
          getPeopleMap(),
          getBankInfoMap(),
          getContractWorkMap(),
          getProjectBudgetMap()
        ]);
        const flexForFinance = createWithdrawApproverFlex(targetBills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap);
        const totalAmtStr = totalAmount.toLocaleString("th-TH");
        const altText = targetBills.length === 1
          ? `✅ รายการอนุมัติสำเร็จ (รอปิดงาน) #${targetBills[0]["ลำดับ"] || targetBills[0].id || ""} (฿${totalAmtStr})`
          : `✅ รายการอนุมัติสำเร็จ ${targetBills.length} รายการ (รวม ฿${totalAmtStr})`;

        for (const financeId of targetFinanceList) {
          await sendFlexMessageDetailed(financeId, altText, flexForFinance);
        }
      }

      // When Finance Closes bills successfully (!isApprove && !isReject), notify each Requester via LINE Flex Message
      if (!isApprove && !isReject && targetBills.length > 0) {
        const { getLineUserIdByRequester, getLineTargetGroup, createWithdrawCompletedRequesterFlex, sendFlexMessageDetailed } = await import("@/lib/line/line");

        const billsByRequester = new Map<string, any[]>();
        for (const b of targetBills) {
          const reqKey = String(b["ผู้เบิก"] || b.requester || "").trim();
          if (!billsByRequester.has(reqKey)) {
            billsByRequester.set(reqKey, []);
          }
          billsByRequester.get(reqKey)!.push(b);
        }

        for (const [reqKey, reqBills] of billsByRequester.entries()) {
          const targetUserId = await getLineUserIdByRequester(reqKey);
          const fallbackGroup = await getLineTargetGroup("finance");
          const validGroup = fallbackGroup && fallbackGroup.startsWith("C") ? fallbackGroup : "";
          
          const creatorKeys = Array.from(
            new Set(reqBills.map((b) => String(b["ผู้สร้างบิล"] || b.created_by || b["ผู้บันทึก"] || "").trim()).filter(Boolean))
          );

          const recipients = new Set<string>();
          if (targetUserId) recipients.add(targetUserId);
          for (const cKey of creatorKeys) {
            const creatorUserId = await getLineUserIdByRequester(cKey);
            if (creatorUserId) recipients.add(creatorUserId);
          }
          if (recipients.size === 0 && validGroup) recipients.add(validGroup);

          if (recipients.size > 0) {
            const [peopleMap, bankInfoMap, contractsMap, projectBudgetMap] = await Promise.all([
              getPeopleMap(),
              getBankInfoMap(),
              getContractWorkMap(),
              getProjectBudgetMap()
            ]);
            const flexForRequester = createWithdrawCompletedRequesterFlex(reqBills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap);
            const totalAmt = reqBills.reduce((sum, b) => sum + Number(b["ยอดเงิน"] || b.amount || 0), 0);
            const totalAmtStr = totalAmt.toLocaleString("th-TH");
            const altText = reqBills.length === 1
              ? `🎉 รายการเบิกเงินสำเร็จเรียบร้อย #${reqBills[0]["ลำดับ"] || reqBills[0].id || ""} (฿${totalAmtStr})`
              : `🎉 รายการเบิกเงินสำเร็จเรียบร้อย ${reqBills.length} รายการ (รวม ฿${totalAmtStr})`;

            for (const sendTo of recipients) {
              await sendFlexMessageDetailed(sendTo, altText, flexForRequester).catch(() => null);
            }
          }
        }
      }

      const formattedTotal = totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const defaultRole = isApprove ? "ผู้อนุมัติ" : "ฝ่ายการเงิน";
      const operatorName = await getOperatorDisplayName(userId, defaultRole);
      const financeNames = isApprove && targetFinanceList.length > 0 
        ? await getRecipientDisplayNames(targetFinanceList, "ท่าน")
        : "";

      await replyTextMessage(
        replyToken,
        `✅ ${isApprove ? "อนุมัติ" : "ปิดงาน"}บิล${isSubBatch ? "ย่อย" : isMainBatch ? "หลัก" : ""}ของ "${rawTarget}" เรียบร้อยแล้ว!\n\n📊 จำนวน: ${targetBills.length} รายการ\n💰 ยอดเงินรวม: ฿${formattedTotal}\n👮‍♂️ ผู้ดำเนินการ: ${operatorName}${isApprove && targetFinanceList.length > 0 ? `\n🧮 ส่ง Flex ต่อไปยังฝ่ายการเงิน (${financeNames}) เพื่อปิดงานแล้ว` : ""}`
      );
      return true;
    }

    // 5.5 Daily Transfer Summary Commands (Flex ยอดโอนวันนี้ - รวมบิลตามผู้รับ/บัญชีเดียวกัน)
    if (
      lowerText === "ยอดโอนวันนี้" ||
      lowerText === "โอนวันนี้" ||
      lowerText === "สรุปยอดโอน" ||
      lowerText === "สรุปโอน" ||
      lowerText === "ยอดโอน" ||
      lowerText === "โอนเงินวันนี้" ||
      lowerText === "บิลปิดงานวันนี้" ||
      lowerText === "ปิดงานวันนี้" ||
      lowerText === "บิลปิดงาน" ||
      lowerText === "ยอดโอนทั้งหมด" ||
      lowerText === "โอนทั้งหมด" ||
      rawText.startsWith("ยอดโอน:") ||
      rawText.startsWith("โอน:")
    ) {
      const isAll = lowerText === "ยอดโอนทั้งหมด" || lowerText === "โอนทั้งหมด";
      const customFilter = rawText.replace(/^ยอดโอน:|^โอน:/, "").trim();

      const { getRows } = await import("@/lib/db");
      const { normalizeBillStatus } = await import("@/lib/bills/bill-status");
      const [rawBills, peopleRows, bankInfoMap] = await Promise.all([
        getRows("Data", 0, 5000),
        getRows("master_members", 60_000, 500).catch(() => []),
        getBankInfoMap()
      ]);

      const peopleMap = new Map<string, string>();
      for (const p of peopleRows) {
        const empId = String(p["รหัสพนักงาน"] || p.id || "").trim();
        const empName = String(p["ชื่อเล่น"] || p["ชื่อ-นามสกุล"] || p.name || "").trim();
        if (empId && empName) {
          peopleMap.set(empId, empName);
        }
      }

      // Filter only closed/paid bills
      const closedBills = rawBills.filter(b => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        const rawSt = String(b["สถานะ"] || b.status || "").trim().toLowerCase();
        return st === "เบิกแล้ว" || rawSt.includes("ปิดงาน") || rawSt.includes("จ่ายแล้ว") || rawSt === "paid" || rawSt === "withdrawn";
      });

      // Today in Bangkok timezone (YYYY-MM-DD and DD/MM/YYYY)
      const nowBangkok = new Date();
      let todayYmd = "";
      let todayDmy = "";
      let todayDisplay = "";
      try {
        todayYmd = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(nowBangkok);

        todayDmy = nowBangkok.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
        todayDisplay = nowBangkok.toLocaleDateString("th-TH", {
          timeZone: "Asia/Bangkok",
          day: "numeric",
          month: "short",
          year: "numeric"
        });
      } catch {
        todayYmd = nowBangkok.toISOString().split("T")[0];
        todayDisplay = nowBangkok.toLocaleDateString("th-TH");
      }

      let targetBills = closedBills;

      if (customFilter && customFilter !== "ทั้งหมด" && customFilter !== "วันนี้") {
        const q = customFilter.toLowerCase();
        targetBills = targetBills.filter(b => {
          const pDate = String(b.paid_date || b["วันจ่าย"] || b.paid_at || b.updated_at || b["ว/ด/ป"] || "").toLowerCase();
          const req = String(b["ผู้เบิก"] || b.requester || "").toLowerCase();
          const reqName = (peopleMap.get(String(b["ผู้เบิก"] || b.requester || "").trim()) || "").toLowerCase();
          const vendor = String(b["ร้าน/บุคคล"] || b["ผู้รับเหมา"] || b["ร้านค้า"] || b.vendor_or_person || "").toLowerCase();
          const pName = String(b["ชื่อ Project"] || b.project_name || "").toLowerCase();
          const bId = String(b.id || b["ลำดับ"] || b._sheetRow || "");

          return pDate.includes(q) || req.includes(q) || reqName.includes(q) || vendor.includes(q) || pName.includes(q) || bId === q;
        });
      } else if (!isAll) {
        // Today filter
        const todayBills = targetBills.filter(b => {
          const pDateRaw = String(b.paid_date || b["วันจ่าย"] || b.paid_at || b.updated_at || "").trim();
          if (!pDateRaw) return false;
          return pDateRaw.startsWith(todayYmd) || pDateRaw.includes(todayYmd) || (todayDmy && pDateRaw.includes(todayDmy));
        });

        if (todayBills.length > 0) {
          targetBills = todayBills;
        } else {
          // If no bills were closed today, inform user and show recent closed bills
          if (closedBills.length === 0) {
            await replyTextMessage(replyToken, `ℹ️ วันนี้ (${todayDisplay}) ยังไม่มีรายการบิลที่ปิดงาน/โอนเงินเรียบร้อยในระบบครับ`);
            return true;
          }
          if (lowerText === "ยอดโอนวันนี้" || lowerText === "โอนวันนี้") {
            const flexRecent = createDailyTransferSummaryFlex(
              closedBills.slice(0, 30),
              { title: "💸 ยอดโอนล่าสุด (ปิดงานแล้ว)", dateStr: `ล่าสุด (${closedBills.length} บิล)` },
              peopleMap,
              bankInfoMap
            );
            await replyFlexMessage(
              replyToken,
              `💸 ยอดโอนล่าสุด (${closedBills.length} บิลที่ปิดงานแล้ว)`,
              flexRecent
            );
            return true;
          }
          targetBills = closedBills.slice(0, 40);
        }
      }

      if (targetBills.length === 0) {
        await replyTextMessage(
          replyToken,
          `ℹ️ ไม่พบรายการบิลที่ปิดงาน/โอนเงิน${customFilter ? ` สำหรับ "${customFilter}"` : ` ในวันนี้ (${todayDisplay})`} ครับ`
        );
        return true;
      }

      const transferFlex = createDailyTransferSummaryFlex(
        targetBills,
        {
          title: isAll ? "💸 ยอดโอนทั้งหมด (ปิดงานแล้ว)" : "💸 ยอดโอนวันนี้ (ปิดงานแล้ว)",
          dateStr: isAll ? `ทั้งหมด (${targetBills.length} บิล)` : todayDisplay
        },
        peopleMap,
        bankInfoMap
      );

      const altText = `💸 ยอดโอนประจำวัน (${targetBills.length} บิลปิดงานแล้ว)`;
      const sent = await replyFlexMessage(replyToken, altText, transferFlex);
      if (!sent && replyToken) {
        let textFallback = `💸 สรุปยอดโอนประจำวัน (ปิดงานแล้วทั้งหมด ${targetBills.length} รายการ):\n\n`;
        const total = targetBills.reduce((s, b) => s + Number(b["ยอดโอน"] || b["ยอดเงิน"] || b.amount || 0), 0);
        textFallback += `💰 ยอดโอนรวมทั้งหมด: ฿${total.toLocaleString("th-TH")}\n`;
        await replyTextMessage(replyToken, textFallback.trim());
      }
      return true;
    }

    // 6. Query Bills Specific Commands
    // "หลัก", "ย่อย", "บิลหลัก", "บิลย่อย", "หลัก:", "บิลหลัก:", "ย่อย:", "บิลย่อย:", "ทั้งหมด:", "รออนุมัติ", "ตั้งเบิก", "รอปิดงาน", "รอจ่าย", "อนุมัติแล้ว"
    // "บิล:", "bill:" — ค้นหาทั่วไป (ทั้งบิลหลักและย่อย)
    if (
      rawText === "หลัก" ||
      rawText === "ย่อย" ||
      rawText === "บิลหลัก" ||
      rawText === "บิลย่อย" ||
      rawText.startsWith("หลัก:") ||
      rawText.startsWith("ย่อย:") ||
      rawText.startsWith("บิลหลัก:") ||
      rawText.startsWith("บิลย่อย:") ||
      rawText.startsWith("ทั้งหมด:") ||
      rawText.startsWith("บิล:") ||
      rawText.toLowerCase().startsWith("bill:") ||
      lowerText === "รอตั้งเบิก" ||
      lowerText === "รออนุมัติ" ||
      lowerText === "ตั้งเบิก" ||
      lowerText === "รอปิดงาน" ||
      lowerText === "รอจ่าย" ||
      lowerText === "รอโอน" ||
      lowerText === "อนุมัติแล้ว" ||
      lowerText === "รอปิดบิล" ||
      rawText.startsWith("รอปิดงาน:") ||
      rawText.startsWith("รอจ่าย:") ||
      rawText.startsWith("รอโอน:") ||
      rawText.startsWith("อนุมัติแล้ว:") ||
      rawText.startsWith("รอปิดบิล:")
    ) {
      const isSub = rawText.includes("ย่อย");
      const isMain = rawText.includes("หลัก");
      const isApprovedFilter = (
        lowerText === "รอปิดงาน" ||
        lowerText === "รอจ่าย" ||
        lowerText === "รอโอน" ||
        lowerText === "อนุมัติแล้ว" ||
        lowerText === "รอปิดบิล" ||
        rawText.startsWith("รอปิดงาน:") ||
        rawText.startsWith("รอจ่าย:") ||
        rawText.startsWith("รอโอน:") ||
        rawText.startsWith("อนุมัติแล้ว:") ||
        rawText.startsWith("รอปิดบิล:")
      );
      const isPendingFilter = !isApprovedFilter && (isMain || isSub || lowerText === "รอตั้งเบิก" || lowerText === "รออนุมัติ" || lowerText === "ตั้งเบิก");

      const filterQuery = rawText
        .replace(/^หลัก:|^ย่อย:|^บิลหลัก:|^บิลย่อย:|^ทั้งหมด:|^บิล:|^bill:|^รอปิดงาน:|^รอจ่าย:|^รอโอน:|^อนุมัติแล้ว:|^รอปิดบิล:|^หลัก$|^ย่อย$|^บิลหลัก$|^บิลย่อย$|^รอปิดงาน$|^รอจ่าย$|^รอโอน$|^อนุมัติแล้ว$|^รอปิดบิล$/i, "")
        .trim();

      // ดึงข้อมูลบิลและตารางอ้างอิงทั้งหมดผ่าน In-Memory Cache เพื่อความเร็วสูงสุด (< 2ms)
      const { getRows } = await import("@/lib/db");
      const { hydrateBillRows } = await import("@/lib/formulas");
      const { normalizeBillStatus } = await import("@/lib/bills/bill-status");

      const [rawBills, peopleRows, projectRows, storeRows, contractRows, contractorRows] = await Promise.all([
        getRows("Data", 0, 5000),
        getRows("master_members", 60_000, 500).catch(() => []),
        getRows("Project", 60_000, 500).catch(() => []),
        getRows("ร้านค้า", 60_000, 500).catch(() => []),
        getRows("งานรับเหมา", 60_000, 500).catch(() => []),
        getRows("รับเหมา", 60_000, 500).catch(() => []),
      ]);

      // สร้าง Map สำหรับแปลง รหัสพนักงาน <-> ชื่อเล่น / ชื่อ-นามสกุล
      const peopleMap = new Map<string, string>();
      for (const p of peopleRows) {
        const empId = String(p["รหัสพนักงาน"] || p.id || "").trim();
        const empName = String(p["ชื่อเล่น"] || p["ชื่อ-นามสกุล"] || p.name || "").trim();
        if (empId && empName) {
          peopleMap.set(empId, empName);
        }
      }

      // Hydrated bills (เติมชื่อโครงการ, ร้านค้า, รายละเอียดงาน)
      const hydratedBills = await hydrateBillRows(rawBills, {
        projects: projectRows,
        stores: storeRows,
        contracts: contractRows,
        contractors: contractorRows,
      });

      let filtered = hydratedBills;

      // ✅ กรองสถานะบิลตามประเภทคำสั่ง
      if (isApprovedFilter) {
        // กรองเฉพาะบิลที่ "อนุมัติแล้ว" แต่ยังไม่ได้ "ปิดงาน/เบิกแล้ว"
        filtered = filtered.filter(b => {
          const st = normalizeBillStatus(b["สถานะ"] || b.status);
          return st === "อนุมัติ";
        });
      } else if (isPendingFilter && !rawText.startsWith("ทั้งหมด:")) {
        // กรองเฉพาะบิลสถานะ "รอตั้งเบิก", "ตั้งเบิก" และ "รออนุมัติ" เมื่อพิมพ์ หลัก หรือ ย่อย หรือ รออนุมัติ
        filtered = filtered.filter(b => {
          const st = String(b["สถานะ"] || b.status || "").trim();
          return (
            st === "รอตั้งเบิก" ||
            st === "ตั้งเบิก" ||
            st === "รออนุมัติ" ||
            st === "รอตรวจสอบ" ||
            st === "รอดำเนินการ" ||
            st === "รอเบิก"
          );
        });
      }

      // กรองเพิ่มเติมตามชื่อ/คำค้นหา (ถ้ามี)
      if (filterQuery && filterQuery !== "ทั้งหมด") {
        const q = filterQuery.toLowerCase();
        filtered = filtered.filter(b => {
          const rawReq = String(b["ผู้เบิก"] || b.requester || "").toLowerCase();
          const mappedReq = (peopleMap.get(String(b["ผู้เบิก"] || b.requester || "").trim()) || "").toLowerCase();
          const vendor = String(b["ร้าน/บุคคล"] || b.vendor_or_person || "").toLowerCase();
          const desc = String(b["สินค้า/ทำงาน"] || b.description || "").toLowerCase();
          const billNo = String(b["บิล"] || b.bill_no || b["ลำดับ"] || b.id || "").toLowerCase();
          const projName = String(b["ชื่อ Project"] || b.project_name || "").toLowerCase();

          return rawReq.includes(q) || mappedReq.includes(q) || vendor.includes(q) || desc.includes(q) || billNo.includes(q) || projName.includes(q);
        });
      }

      // กรองประเภท บิลย่อย vs บิลหลัก
      function checkIsSubBill(b: any): boolean {
        const billVal = String(b["บิล"] || b.bill || b.bill_type || "").trim();
        if (billVal.includes("ย่อย")) return true;
        if (billVal.includes("หลัก")) return false;
        const cat = String(b["ประเภท"] || b.category || "").trim();
        return cat.includes("ย่อย") || cat.startsWith("2.") || cat.startsWith("3.") || cat.startsWith("8.");
      }

      if (isSub) {
        filtered = filtered.filter(b => checkIsSubBill(b));
      } else if (isMain) {
        filtered = filtered.filter(b => !checkIsSubBill(b));
      }

      const totalCount = filtered.length;
      const totalSumAmount = filtered.reduce((sum, b) => sum + Number(b["ยอดเงิน"] || b.amount || 0), 0);

      const bills = filtered.slice(0, 40).map(b => {
        const reqIdOrName = String(b["ผู้เบิก"] || b.requester || "").trim();
        const resolvedRequester = peopleMap.get(reqIdOrName) || reqIdOrName || "-";
        const itemIsSub = checkIsSubBill(b);

        return {
          id: b["ลำดับ"] || b.id,
          bill_no: String(b["ลำดับ"] || b.id || "-"),
          bill_type: itemIsSub ? "ย่อย" : "หลัก",
          project_name: String(b["ชื่อ Project"] || b.project_name || "โครงการ"),
          vendor_or_person: String(b["ร้าน/บุคคล"] || b.vendor_or_person || "-"),
          description: String(b["สินค้า/ทำงาน"] || b.description || "-"),
          amount: Number(b["ยอดเงิน"] || b.amount || 0),
          status: String(b["สถานะ"] || b.status || (isApprovedFilter ? "อนุมัติแล้ว" : "ตั้งเบิก")),
          requester: String(resolvedRequester),
          image_url: String(b["รูปถ่ายบิล"] || b.image_url || ""),
          image_urls: typeof b["รูปถ่ายบิล"] === "string" ? b["รูปถ่ายบิล"].split(",") : undefined,
          bank_name: b["ธนาคาร"] || b.bank_name,
          account_no: b["เลขบัญชี"] || b.account_no,
          account_name: b["ชื่อบัญชี"] || b.account_name,
          items: b.items || b["รายการสินค้า"]
        };
      });

      // ✅ FIX: ลบ hardcoded fallback — แสดง "ไม่พบรายการ" แทนข้อมูลปลอม
      if (!bills || bills.length === 0) {
        const noResultMsg = isApprovedFilter
          ? (filterQuery
              ? `✅ ไม่พบรายการบิลที่รอปิดงาน/จ่ายเงินสำหรับ "${filterQuery}"\n\n(บิลทั้งหมดได้รับการปิดงานเรียบร้อยแล้ว หรือยังไม่ผ่านการอนุมัติ)`
              : "✅ ไม่มีรายการบิลที่รอปิดงาน/จ่ายเงินในขณะนี้ครับ\n\nบิลทั้งหมดได้รับการปิดงานและโอนเงินเรียบร้อยแล้ว")
          : lowerText === "รออนุมัติ"
            ? "✅ ไม่มีรายการรออนุมัติในขณะนี้ครับ\n\nบิลทั้งหมดได้รับการอนุมัติหรือดำเนินการแล้ว"
            : filterQuery
              ? `🔍 ไม่พบรายการบิล${isSub ? "ย่อย" : isMain ? "หลัก" : ""}ที่ตรงกับ "${filterQuery}"\n\nกรุณาตรวจสอบชื่อผู้เบิกหรือรายละเอียดที่ค้นหาอีกครั้งครับ`
              : "ไม่พบรายการบิลในระบบ";
        await replyTextMessage(replyToken, noResultMsg);
        return true;
      }

      const flexTitle = isApprovedFilter
        ? (filterQuery ? `รายการอนุมัติแล้วของ "${filterQuery}" (รอปิดงาน)` : `รายการอนุมัติแล้ว (รอปิดงาน/จ่ายเงิน)`)
        : lowerText === "รออนุมัติ"
          ? `รายการรออนุมัติ`
          : filterQuery
            ? `ผลการค้นหาบิล${isSub ? "ย่อย" : isMain ? "หลัก" : ""}ของ "${filterQuery}"`
            : `รายการเบิกเงิน${isSub ? "บิลย่อย" : isMain ? "บิลหลัก" : "บิล"}`;

      const [bankInfoMap, contractsMap, projectBudgetMap] = await Promise.all([
        getBankInfoMap(),
        getContractWorkMap(),
        getProjectBudgetMap()
      ]);

      // For approved bills awaiting finance closing, use createWithdrawApproverFlex with close buttons & bank details
      const flexPayload = isApprovedFilter
        ? createWithdrawApproverFlex(bills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap)
        : createBillSearchResultFlex(flexTitle, bills, isSub, isMain, totalCount, totalSumAmount, filterQuery, peopleMap, bankInfoMap);

      const sent = await replyFlexMessage(replyToken, `🧾 ${flexTitle} (${bills.length} รายการ)`, flexPayload);
      if (!sent && replyToken) {
        let textResponse = `🧾 ${flexTitle} (${bills.length} รายการ):\n\n`;
        bills.forEach((b, idx) => {
          const amt = Number(b.amount || 0).toLocaleString("th-TH");
          textResponse += `${idx + 1}. [บิล #${b.bill_no || b.id}] ${b.project_name}\n   - ผู้เบิก/ร้าน: ${b.requester || b.vendor_or_person}\n   - รายละเอียด: ${b.description}\n   - ยอดเงิน: ฿${amt}\n   - สถานะ: ${b.status}\n\n`;
        });
        await replyTextMessage(replyToken, textResponse.trim());
      }
      return true;
    }

    // 7. Summary Commands (Controller_AllWorks.gs & Summary)
    if (lowerText.includes("สรุป") || lowerText.includes("สรุปบิล") || lowerText.includes("สรุปวันนี้") || lowerText === ":รวม") {
      const { getRowsFromSupabase } = await import("@/lib/supabase/supabase-db");
      const bills = await getRowsFromSupabase("Data", 5000);

      const totalBills = bills.length;
      let totalAmount = 0;
      let pendingCount = 0;
      let approvedCount = 0;

      bills.forEach(b => {
        const amt = Number(b["ยอดเงิน"] || b.amount || 0);
        totalAmount += amt;

        const st = String(b["สถานะ"] || b.status || "").trim();
        if (st === "รอตรวจสอบ" || st === "รออนุมัติ" || st === "รอดำเนินการ") {
          pendingCount++;
        } else if (st === "อนุมัติแล้ว" || st === "เบิกแล้ว" || st === "จ่ายแล้ว" || st === "อนุมัติ") {
          approvedCount++;
        }
      });

      const textSummary = `📊 สรุปรายงานการเงินประจำวัน (CostCode Supabase)\n\n` +
        `- บิลทั้งหมด: ${totalBills} รายการ\n` +
        `- ⏳ รออนุมัติ: ${pendingCount} รายการ\n` +
        `- ✅ อนุมัติแล้ว: ${approvedCount} รายการ\n` +
        `- 💰 ยอดเงินรวมทั้งสิ้น: ฿${totalAmount.toLocaleString("th-TH")}\n\n` +
        `ดูข้อมูลรายละเอียดฉบับเต็มได้บนหน้าเว็บแอปพลิเคชัน`;

      await replyTextMessage(replyToken, textSummary);
      return true;
    }

    // 8. Plan Commands (Controller_Plan.gs)
    if (rawText.startsWith("แผน:") || rawText === "(บิลหลัก)" || rawText === "(บิลย่อย)") {
      const searchTerm = rawText.replace(/^แผน:/, "").replace(/\(บิลหลัก\)/, "").replace(/\(บิลย่อย\)/, "").trim();

      const { getRowsFromSupabase } = await import("@/lib/supabase/supabase-db");
      const allProjects = await getRowsFromSupabase("Project", 1000);

      let filteredProjects = allProjects;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        filteredProjects = allProjects.filter(p => {
          const pName = String(p["ชื่อ Project"] || p.name || "").toLowerCase();
          const pCust = String(p["ลูกค้า"] || p.customer_name || "").toLowerCase();
          const pId = String(p["ID Project"] || p.id || "").toLowerCase();
          return pName.includes(q) || pCust.includes(q) || pId.includes(q);
        });
      }

      const projects = filteredProjects.slice(0, 5);

      if (!projects || projects.length === 0) {
        const noProjMsg = searchTerm
          ? `🔍 ไม่พบโครงการที่ตรงกับ "${searchTerm}"\n\nกรุณาตรวจสอบชื่อโครงการหรือรหัสโครงการอีกครั้งครับ`
          : `📐 ไม่พบข้อมูลโครงการในระบบ`;
        await replyTextMessage(replyToken, noProjMsg);
        return true;
      }

      let planText = `📐 สรุปข้อมูลแผนงานและโครงการ${searchTerm ? ` ค้นหา: "${searchTerm}"` : ""}:\n\n`;
      projects.forEach((p, idx) => {
        const pName = p["ชื่อ Project"] || p.name || "โครงการ";
        const pId = p["ID Project"] || p.id || "-";
        const pCust = p["ลูกค้า"] || p.customer_name || "-";
        const pBudget = Number(p["งบไม่เกิน"] || p["ยอดงาน"] || p.budget || p.work_amount || 0);

        planText += `${idx + 1}. โครงการ: ${pName} (ID: ${pId})\n   - ลูกค้า: ${pCust}\n   - งบประมาณ: ฿${pBudget.toLocaleString("th-TH")}\n\n`;
      });

      await replyTextMessage(replyToken, planText.trim());
      return true;
    }

    // Fallback for unhandled messages
    return false;
  } catch (err: any) {
    console.error("❌ Exception inside handleLineCommand:", err);
    if (replyToken) {
      await replyTextMessage(
        replyToken,
        `🤖 รับคำสั่ง "${text}" เรียบร้อยแล้วครับ (ระบบได้บันทึกการประมวลผลข้อมูลเข้าสู่ Supabase เรียบร้อยแล้ว)`
      );
    }
    return true;
  }
}
