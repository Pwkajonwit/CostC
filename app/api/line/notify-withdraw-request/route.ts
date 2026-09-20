import { NextRequest, NextResponse } from "next/server";
import {
  sendFlexMessageDetailed,
  getLineUserIdByRequester,
  getLineTargetGroup,
  getLineConfigIds,
  getPeopleMap,
  getBankInfoMap,
  getContractWorkMap,
  getProjectBudgetMap,
  getCarsMap,
  createWithdrawRequesterFlex,
  createWithdrawOwnerFlex,
  createWithdrawApproverFlex,
  createWithdrawCompletedRequesterFlex,
  createDailyTransferSummaryFlex,
  getBillFlexGrossAmount,
  getPettyCashSummaryMap
} from "@/lib/line/line";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getTodayDateIso, normalizeDateToIso } from "@/lib/utils/dates";
import { isCreditActive, parseCreditDays } from "@/lib/project-summary";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bills = body.rows && Array.isArray(body.rows) && body.rows.length > 0 
      ? body.rows 
      : body.row 
        ? [body.row] 
        : [];

    if (bills.length === 0) {
      return NextResponse.json({ error: "Missing row or rows data" }, { status: 400 });
    }

    // Enforce same bill type in withdrawal notification batch
    if (bills.length > 1) {
      const billTypes = new Set(
        bills.map((b: any) => {
          const raw = String(b["บิล"] || b.bill || b.bill_type || "").trim();
          if (raw === "ย่อย" || raw.includes("ย่อย")) return "ย่อย";
          if (raw === "หลัก" || raw.includes("หลัก")) return "หลัก";
          return raw || "หลัก";
        })
      );
      if (billTypes.size > 1) {
        return NextResponse.json({
          error: "การแจ้งตั้งเบิกจะต้องเป็นประเภทบิลเดียวกันเท่านั้น (ไม่สามารถส่งบิลหลักและบิลย่อยปนกันในชุดเดียวกันได้)"
        }, { status: 400 });
      }
    }

    // Safety guard: Cannot submit withdrawal request for bills with future credit due date
    const targetRoleCheck = body.targetRole || "requester";
    if (targetRoleCheck === "requester") {
      const todayIso = getTodayDateIso();
      const lockedBills = bills.filter((b: any) => {
        const rawDueDate = b["วันจ่าย"] || b.due_date || b.paid_date || b.data?.["วันจ่าย"] || b.data?.due_date;
        let dueDateIso = normalizeDateToIso(rawDueDate);
        const hasCreditTerm = isCreditActive(b["เครดิต"]) || b.data?.["เครดิต"];
        if (!dueDateIso && hasCreditTerm) {
          const cDays = parseCreditDays(b["เครดิต"] || b.data?.["เครดิต"]);
          const billDateIso = normalizeDateToIso(b["ว/ด/ป"] || b["วันที่"] || b.bill_date);
          if (billDateIso && cDays > 0) {
            const bDate = new Date(billDateIso);
            bDate.setDate(bDate.getDate() + cDays);
            dueDateIso = getTodayDateIso(bDate);
          }
        }
        return Boolean(dueDateIso && dueDateIso > todayIso);
      });

      if (lockedBills.length > 0) {
        const lockedIds = lockedBills.map((b: any) => `#${b.id || b["ลำดับ"] || b._sheetRow}`).join(", ");
        return NextResponse.json({
          error: `ไม่สามารถส่งตั้งเบิกรายการที่มีเครดิตและยังไม่ถึงกำหนดวันจ่ายได้ (${lockedIds}) โปรดรอจนถึงวันจ่ายตามเงื่อนไขเครดิต`
        }, { status: 400 });
      }
    }

    const [peopleMap, bankInfoMap, contractsMap, projectBudgetMap, carsMap, pettyCashMap] = await Promise.all([
      getPeopleMap(),
      getBankInfoMap(),
      getContractWorkMap(),
      getProjectBudgetMap(),
      getCarsMap(),
      getPettyCashSummaryMap()
    ]);
    const targetRole = body.targetRole || "requester";
    const totalAmount = bills.reduce((sum: number, b: any) => sum + getBillFlexGrossAmount(b), 0);
    const amountStr = totalAmount.toLocaleString("th-TH");

    if (targetRole === "transfer_summary") {
      const { closerIds, financeIds, ownerId } = await getLineConfigIds();
      const rawFinanceList = Array.from(new Set([...(closerIds || []), ...(financeIds || []), ownerId].filter(Boolean)));
      const fallbackFinanceGroup = await getLineTargetGroup("finance");
      const validFinanceGroup = fallbackFinanceGroup && fallbackFinanceGroup.startsWith("C") ? fallbackFinanceGroup : "";

      const targetList = rawFinanceList.length > 0
        ? rawFinanceList
        : (validFinanceGroup ? [validFinanceGroup] : []);

      if (targetList.length === 0) {
        return NextResponse.json({ error: "ไม่พบ LINE User ID ของฝ่ายการเงิน หรือกลุ่มการเงินในระบบ" }, { status: 400 });
      }

      const flex = createDailyTransferSummaryFlex(bills, { title: body.title, dateStr: body.dateStr }, peopleMap, bankInfoMap);
      const altText = `💸 ยอดโอนประจำวัน (${bills.length} บิลปิดงานแล้ว)`;

      const results = await Promise.all(
        targetList.map(targetId => sendFlexMessageDetailed(targetId, altText, flex))
      );

      return NextResponse.json({ success: true, count: targetList.length, results });
    }

    if (targetRole === "approver" || targetRole === "finance" || targetRole === "closer") {
      const { closerIds, financeIds } = await getLineConfigIds();
      const rawFinanceList = Array.from(new Set([...(closerIds || []), ...(financeIds || [])].filter(Boolean)));
      const fallbackFinanceGroup = await getLineTargetGroup("finance");
      const validFinanceGroup = fallbackFinanceGroup && fallbackFinanceGroup.startsWith("C") ? fallbackFinanceGroup : "";

      const targetFinanceList = rawFinanceList.length > 0 
        ? rawFinanceList 
        : (validFinanceGroup ? [validFinanceGroup] : []);

      if (targetFinanceList.length === 0) {
        return NextResponse.json({ error: "ไม่พบ LINE User ID ของฝ่ายการเงิน หรือกลุ่มการเงินในระบบ" }, { status: 400 });
      }

      const flex = createWithdrawApproverFlex(bills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap, carsMap, pettyCashMap);
      const altText = bills.length === 1
        ? `✅ รายการอนุมัติสำเร็จ (รอปิดงาน) #${bills[0]._sheetRow || bills[0].id || bills[0]["ลำดับ"] || ""} (฿${amountStr})`
        : `✅ รายการอนุมัติสำเร็จ ${bills.length} รายการ (รวม ฿${amountStr})`;

      const results = await Promise.all(
        targetFinanceList.map(financeId => sendFlexMessageDetailed(financeId, altText, flex))
      );

      return NextResponse.json({ success: true, count: targetFinanceList.length, results });
    }

    if (targetRole === "owner" || targetRole === "request_approval") {
      const { approverIds } = await getLineConfigIds();
      const targetApprovers = (approverIds && approverIds.length > 0) ? approverIds : [];
      if (targetApprovers.length === 0) {
        return NextResponse.json({ error: "ยังไม่ได้ระบุผู้อนุมัติตั้งเบิก (Approvers) ในระบบ (โปรดตั้งค่าสิทธิ์อนุมัติบิลในหน้าพนักงาน)" }, { status: 400 });
      }

      const flex = createWithdrawOwnerFlex(bills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap, carsMap, pettyCashMap);
      const altText = bills.length === 1
        ? `📋 คำขออนุมัติเบิกเงิน #${bills[0]._sheetRow || bills[0].id || bills[0]["ลำดับ"] || ""} (฿${amountStr})`
        : `📋 คำขออนุมัติเบิกเงิน ${bills.length} รายการ (รวม ฿${amountStr})`;

      const results = await Promise.all(
        targetApprovers.map(approverId => sendFlexMessageDetailed(approverId, altText, flex))
      );
      return NextResponse.json({ success: true, count: targetApprovers.length, results });
    }

    // 1. Target: Completed / Closed
    if (targetRole === "completed" || targetRole === "closed") {
      const requestActor = String(body.actor || body.creator || body.createdBy || "").trim();
      const cookieEmpId = String(req.cookies.get("auth_employee_id")?.value || "").trim();
      const cookieName = String(req.cookies.get("auth_name")?.value || "").trim();
      const sessionLineUserId = String(req.cookies.get("auth_line_user_id")?.value || "").trim();

      const billIds = bills
        .map((b: any) => Number(b.id ?? b["ลำดับ"] ?? b._sheetRow))
        .filter((n: number) => Number.isFinite(n) && n > 0);

      const dbBillMap = new Map<number, any>();
      if (billIds.length > 0) {
        try {
          const { data: dbBills } = await supabaseAdmin
            .from("bills")
            .select("id, requester, created_by, data")
            .in("id", billIds);
          if (dbBills && dbBills.length > 0) {
            dbBills.forEach(dbB => {
              dbBillMap.set(Number(dbB.id), dbB);
            });
          }
        } catch (e) {
          console.warn("Could not query bills table for creator/requester lookup:", e);
        }
      }

      const requesterKeys: string[] = Array.from(new Set<string>(
        bills.flatMap((b: any) => {
          const bId = Number(b.id ?? b["ลำดับ"] ?? b._sheetRow);
          const dbB = dbBillMap.get(bId);
          return [
            b["ผู้เบิก"],
            b.requester,
            b.requester_name,
            b["ชื่อผู้เบิก"],
            b.data?.["ผู้เบิก"],
            b.data?.requester,
            b.data?.["ชื่อผู้เบิก"],
            dbB?.requester,
            dbB?.data?.["ผู้เบิก"],
            dbB?.data?.requester
          ];
        }).map((k: any) => String(k || "").trim()).filter(Boolean)
      ));

      const creatorKeys: string[] = Array.from(new Set<string>(
        [
          ...bills.flatMap((b: any) => {
            const bId = Number(b.id ?? b["ลำดับ"] ?? b._sheetRow);
            const dbB = dbBillMap.get(bId);
            return [
              b["ผู้สร้างบิล"],
              b.created_by,
              b["ผู้บันทึก"],
              b["ผู้สร้างบิลตั้งเบิก"],
              b.creator,
              b.data?.["ผู้สร้างบิล"],
              b.data?.created_by,
              b.data?.["ผู้บันทึก"],
              b.data?.["ผู้สร้างบิลตั้งเบิก"],
              dbB?.created_by,
              dbB?.data?.["ผู้สร้างบิล"],
              dbB?.data?.created_by,
              dbB?.data?.["ผู้บันทึก"]
            ];
          }),
          requestActor,
          cookieEmpId,
          cookieName
        ].map((k: any) => String(k || "").trim()).filter(Boolean)
      ));

      const [resolvedRequesters, resolvedCreators, fallbackGroup] = await Promise.all([
        Promise.all(requesterKeys.map(k => getLineUserIdByRequester(k))),
        Promise.all(creatorKeys.map(k => getLineUserIdByRequester(k))),
        getLineTargetGroup("finance")
      ]);

      const validGroup = fallbackGroup && fallbackGroup.startsWith("C") ? fallbackGroup : "";
      const recipients = new Set<string>();
      resolvedRequesters.forEach(id => { if (id && id.startsWith("U")) recipients.add(id); });
      resolvedCreators.forEach(id => { if (id && id.startsWith("U")) recipients.add(id); });
      if (sessionLineUserId && sessionLineUserId.startsWith("U")) recipients.add(sessionLineUserId);
      if (recipients.size === 0 && validGroup) recipients.add(validGroup);

      if (recipients.size === 0) {
        return NextResponse.json({
          error: `ไม่พบบัญชี LINE ของผู้เบิก (${requesterKeys.join(", ") || "-"}) หรือผู้สร้างบิล (${creatorKeys.join(", ") || "-"}) ในระบบ`
        }, { status: 400 });
      }

      const enrichedBills = bills.map((b: any) => {
        const bId = Number(b.id ?? b["ลำดับ"] ?? b._sheetRow);
        const dbB = dbBillMap.get(bId);
        const creator = String(
          dbB?.created_by ||
          dbB?.data?.["ผู้สร้างบิล"] ||
          dbB?.data?.created_by ||
          dbB?.data?.["ผู้บันทึก"] ||
          b["ผู้สร้างบิล"] ||
          b.created_by ||
          b["ผู้บันทึก"] ||
          requestActor ||
          cookieName ||
          cookieEmpId ||
          ""
        ).trim();
        return {
          ...b,
          "ผู้สร้างบิล": creator || b["ผู้สร้างบิล"] || b.created_by,
          created_by: creator || b.created_by || b["ผู้สร้างบิล"]
        };
      });

      const flex = createWithdrawCompletedRequesterFlex(enrichedBills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap, carsMap, pettyCashMap);
      const altText = bills.length === 1
        ? `🎉 รายการเบิกเงินสำเร็จเรียบร้อย #${bills[0]._sheetRow || bills[0].id || bills[0]["ลำดับ"] || ""} (฿${amountStr})`
        : `🎉 รายการเบิกเงินสำเร็จเรียบร้อย ${bills.length} รายการ (รวม ฿${amountStr})`;

      const results = [];
      for (const sendTo of recipients) {
        const res = await sendFlexMessageDetailed(sendTo, altText, flex);
        results.push(res);
      }

      return NextResponse.json({ success: true, count: recipients.size, targets: Array.from(recipients), results });
    }

    // 2. Default: Withdraw Request ("ตั้งเบิก") -> Send to BOTH Creator & Requester
    const requestActor = String(body.actor || body.creator || body.createdBy || "").trim();
    const cookieEmpId = String(req.cookies.get("auth_employee_id")?.value || "").trim();
    const cookieName = String(req.cookies.get("auth_name")?.value || "").trim();
    const sessionLineUserId = String(req.cookies.get("auth_line_user_id")?.value || "").trim();

    const billIds = bills
      .map((b: any) => Number(b.id ?? b["ลำดับ"] ?? b._sheetRow))
      .filter((n: number) => Number.isFinite(n) && n > 0);

    const dbBillMap = new Map<number, any>();
    if (billIds.length > 0) {
      try {
        const { data: dbBills } = await supabaseAdmin
          .from("bills")
          .select("id, requester, created_by, data")
          .in("id", billIds);
        if (dbBills && dbBills.length > 0) {
          dbBills.forEach(dbB => {
            dbBillMap.set(Number(dbB.id), dbB);
          });
        }
      } catch (e) {
        console.warn("Could not query bills table for creator/requester lookup:", e);
      }
    }

    const requesterKeys: string[] = Array.from(new Set<string>(
      bills.flatMap((b: any) => {
        const bId = Number(b.id ?? b["ลำดับ"] ?? b._sheetRow);
        const dbB = dbBillMap.get(bId);
        return [
          b["ผู้เบิก"],
          b.requester,
          b.requester_name,
          b["ชื่อผู้เบิก"],
          b.data?.["ผู้เบิก"],
          b.data?.requester,
          b.data?.["ชื่อผู้เบิก"],
          dbB?.requester,
          dbB?.data?.["ผู้เบิก"],
          dbB?.data?.requester
        ];
      }).map((k: any) => String(k || "").trim()).filter(Boolean)
    ));

    const creatorKeys: string[] = Array.from(new Set<string>(
      [
        ...bills.flatMap((b: any) => {
          const bId = Number(b.id ?? b["ลำดับ"] ?? b._sheetRow);
          const dbB = dbBillMap.get(bId);
          return [
            b["ผู้สร้างบิล"],
            b.created_by,
            b["ผู้บันทึก"],
            b["ผู้สร้างบิลตั้งเบิก"],
            b.creator,
            b.data?.["ผู้สร้างบิล"],
            b.data?.created_by,
            b.data?.["ผู้บันทึก"],
            b.data?.["ผู้สร้างบิลตั้งเบิก"],
            dbB?.created_by,
            dbB?.data?.["ผู้สร้างบิล"],
            dbB?.data?.created_by,
            dbB?.data?.["ผู้บันทึก"]
          ];
        }),
        requestActor,
        cookieEmpId,
        cookieName
      ].map((k: any) => String(k || "").trim()).filter(Boolean)
    ));

    const [resolvedRequesters, resolvedCreators, fallbackGroup] = await Promise.all([
      Promise.all(requesterKeys.map(k => getLineUserIdByRequester(k))),
      Promise.all(creatorKeys.map(k => getLineUserIdByRequester(k))),
      getLineTargetGroup("finance")
    ]);

    const validGroup = fallbackGroup && fallbackGroup.startsWith("C") ? fallbackGroup : "";
    const recipients = new Set<string>();
    resolvedRequesters.forEach(id => { if (id && id.startsWith("U")) recipients.add(id); });
    resolvedCreators.forEach(id => { if (id && id.startsWith("U")) recipients.add(id); });
    if (sessionLineUserId && sessionLineUserId.startsWith("U")) recipients.add(sessionLineUserId);
    if (recipients.size === 0 && validGroup) recipients.add(validGroup);

    if (recipients.size === 0) {
      return NextResponse.json({
        error: `ไม่พบบัญชี LINE ของผู้เบิก (${requesterKeys.join(", ") || "-"}) หรือผู้สร้างบิล (${creatorKeys.join(", ") || "-"}) ในระบบ`
      }, { status: 400 });
    }

    const enrichedBills = bills.map((b: any) => {
      const bId = Number(b.id ?? b["ลำดับ"] ?? b._sheetRow);
      const dbB = dbBillMap.get(bId);
      const creator = String(
        dbB?.created_by ||
        dbB?.data?.["ผู้สร้างบิล"] ||
        dbB?.data?.created_by ||
        dbB?.data?.["ผู้บันทึก"] ||
        b["ผู้สร้างบิล"] ||
        b.created_by ||
        b["ผู้บันทึก"] ||
        requestActor ||
        cookieName ||
        cookieEmpId ||
        ""
      ).trim();
      return {
        ...b,
        "ผู้สร้างบิล": creator || b["ผู้สร้างบิล"] || b.created_by,
        created_by: creator || b.created_by || b["ผู้สร้างบิล"]
      };
    });

    const flex = createWithdrawRequesterFlex(enrichedBills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap, carsMap, pettyCashMap);
    const altText = bills.length === 1
      ? `📄 แจ้งเตือนรายการตั้งเบิกเงิน #${bills[0]._sheetRow || bills[0].id || bills[0]["ลำดับ"] || ""} (฿${amountStr})`
      : `📄 แจ้งเตือนรายการตั้งเบิกเงิน ${bills.length} รายการ (รวม ฿${amountStr})`;

    const results = [];
    for (const sendTo of recipients) {
      const res = await sendFlexMessageDetailed(sendTo, altText, flex);
      results.push(res);
    }

    return NextResponse.json({ success: true, count: recipients.size, targets: Array.from(recipients), results });
  } catch (err: any) {
    console.error("❌ Withdraw notification error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
