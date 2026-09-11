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
  createWithdrawRequesterFlex,
  createWithdrawOwnerFlex,
  createWithdrawApproverFlex,
  createWithdrawCompletedRequesterFlex,
  createDailyTransferSummaryFlex
} from "@/lib/line/line";

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

    const [peopleMap, bankInfoMap, contractsMap, projectBudgetMap] = await Promise.all([
      getPeopleMap(),
      getBankInfoMap(),
      getContractWorkMap(),
      getProjectBudgetMap()
    ]);
    const targetRole = body.targetRole || "requester";
    const totalAmount = bills.reduce((sum: number, b: any) => sum + Number(b["ยอดเงิน"] || b.amount || 0), 0);
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

      const flex = createWithdrawApproverFlex(bills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap);
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

      const flex = createWithdrawOwnerFlex(bills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap);
      const altText = bills.length === 1
        ? `📋 คำขออนุมัติเบิกเงิน #${bills[0]._sheetRow || bills[0].id || bills[0]["ลำดับ"] || ""} (฿${amountStr})`
        : `📋 คำขออนุมัติเบิกเงิน ${bills.length} รายการ (รวม ฿${amountStr})`;

      const results = await Promise.all(
        targetApprovers.map(approverId => sendFlexMessageDetailed(approverId, altText, flex))
      );
      return NextResponse.json({ success: true, count: targetApprovers.length, results });
    }

    if (targetRole === "completed" || targetRole === "closed") {
      const requesterKeys: string[] = Array.from(new Set<string>(
        bills.map((b: any) => String(b["ผู้เบิก"] || b.requester || "").trim()).filter(Boolean)
      ));
      const creatorKeys: string[] = Array.from(new Set<string>(
        bills.map((b: any) => String(b["ผู้สร้างบิล"] || b.created_by || b["ผู้บันทึก"] || "").trim()).filter(Boolean)
      ));

      const [resolvedRequesters, resolvedCreators, fallbackGroup] = await Promise.all([
        Promise.all(requesterKeys.map(k => getLineUserIdByRequester(k))),
        Promise.all(creatorKeys.map(k => getLineUserIdByRequester(k))),
        getLineTargetGroup("finance")
      ]);

      const validGroup = fallbackGroup && fallbackGroup.startsWith("C") ? fallbackGroup : "";
      const recipients = new Set<string>();
      resolvedRequesters.forEach(id => { if (id) recipients.add(id); });
      resolvedCreators.forEach(id => { if (id) recipients.add(id); });
      if (recipients.size === 0 && validGroup) recipients.add(validGroup);

      if (recipients.size === 0) {
        return NextResponse.json({
          error: `ไม่พบบัญชี LINE ของผู้เบิก (${requesterKeys.join(", ") || "-"}) หรือผู้สร้างบิล (${creatorKeys.join(", ") || "-"}) ในระบบ`
        }, { status: 400 });
      }

      const flex = createWithdrawCompletedRequesterFlex(bills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap);
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

    // Default: requester & creator
    const requesterKeys: string[] = Array.from(new Set<string>(
      bills.map((b: any) => String(b["ผู้เบิก"] || b.requester || "").trim()).filter(Boolean)
    ));
    const creatorKeys: string[] = Array.from(new Set<string>(
      bills.map((b: any) => String(b["ผู้สร้างบิล"] || b.created_by || b["ผู้บันทึก"] || "").trim()).filter(Boolean)
    ));

    const [resolvedRequesters, resolvedCreators, fallbackGroup] = await Promise.all([
      Promise.all(requesterKeys.map(k => getLineUserIdByRequester(k))),
      Promise.all(creatorKeys.map(k => getLineUserIdByRequester(k))),
      getLineTargetGroup("finance")
    ]);

    const validGroup = fallbackGroup && fallbackGroup.startsWith("C") ? fallbackGroup : "";
    const sessionLineUserId = req.cookies.get("auth_line_user_id")?.value;

    const recipients = new Set<string>();
    resolvedRequesters.forEach(id => { if (id) recipients.add(id); });
    resolvedCreators.forEach(id => { if (id) recipients.add(id); });
    if (sessionLineUserId && sessionLineUserId.startsWith("U")) recipients.add(sessionLineUserId);
    if (recipients.size === 0 && validGroup) recipients.add(validGroup);

    if (recipients.size === 0) {
      return NextResponse.json({
        error: `ไม่พบบัญชี LINE ของผู้เบิก (${requesterKeys.join(", ") || "-"}) หรือผู้สร้างบิล (${creatorKeys.join(", ") || "-"}) ในระบบ`
      }, { status: 400 });
    }

    const flex = createWithdrawRequesterFlex(bills, peopleMap, bankInfoMap, contractsMap, projectBudgetMap);
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
