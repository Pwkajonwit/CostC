import { NextRequest, NextResponse } from "next/server";
import { sendFlexMessage, createBillNotificationFlex, getBankInfoMap, getPeopleMap, getCarsMap, getBillFlexGrossAmount, getPettyCashSummaryMap } from "@/lib/line/line";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bill, targetGroup: requestedGroup } = body;

    if (!bill) {
      return NextResponse.json({ error: "Missing bill object" }, { status: 400 });
    }

    const { getLineTargetGroup } = await import("@/lib/line");
    const fallbackFinanceGroup = await getLineTargetGroup("finance");
    const targetGroup =
      requestedGroup ||
      fallbackFinanceGroup ||
      process.env.LINE_GROUP_ID_FINANCE ||
      process.env.LINE_GROUP_ID_SUMMARY ||
      "";

    if (!targetGroup) {
      return NextResponse.json({ error: "Missing LINE group ID configuration" }, { status: 400 });
    }

    const [bankInfoMap, peopleMap, carsMap, pettyCashMap] = await Promise.all([
      getBankInfoMap(),
      getPeopleMap(),
      getCarsMap(),
      getPettyCashSummaryMap()
    ]);
    const billGross = getBillFlexGrossAmount(bill);
    const flex = createBillNotificationFlex(bill, bankInfoMap, peopleMap, carsMap, pettyCashMap);
    const success = await sendFlexMessage(
      targetGroup,
      `🧾 รายการแจ้งเตือนการเบิกเงิน: ฿${billGross.toLocaleString("th-TH")}`,
      flex
    );

    return NextResponse.json({ success });
  } catch (err: any) {
    console.error("❌ Notify bill error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

