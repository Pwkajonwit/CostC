import { supabaseAdmin } from "@/lib/supabase/supabase-admin";
import { getRowsFromSupabase } from "@/lib/supabase/supabase-db";
import { LINE_CONFIG } from "@/lib/line/config";
import { cached } from "@/lib/utils/cache";
import { getCostCodeBudgetField } from "@/lib/cost-codes";

const LINE_API_BASE = "https://api.line.me/v2/bot/message";

export async function getDynamicAccessToken(): Promise<string> {
  return cached("line:access_token", 120_000, async () => {
    try {
      const { data } = await supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "line_config")
        .maybeSingle();

      if (data?.data?.LINE_CHANNEL_ACCESS_TOKEN) {
        const token = String(data.data.LINE_CHANNEL_ACCESS_TOKEN).trim();
        if (token && !token.includes("your-line")) {
          return token;
        }
      }
    } catch (e) {
      // Fall back to process.env or LINE_CONFIG
    }
    return process.env.LINE_CHANNEL_ACCESS_TOKEN || LINE_CONFIG.CHANNEL_ACCESS_TOKEN || "";
  });
}

export async function isLineApproverAuthorized(userId: string, targetId?: string): Promise<boolean> {
  if (!userId) return false;
  const cacheKey = `line:auth_approver:${userId}:${targetId || "none"}`;

  return cached(cacheKey, 10_000, async () => {
    try {
      const { approverIds } = await getLineTargetIds();
      if (approverIds.includes(userId) || (targetId && approverIds.includes(targetId))) {
        return true;
      }
    } catch (e) {
      console.warn("⚠️ Warning checking LINE approver authorization:", e);
    }
    return false;
  });
}

export async function isLineCloserAuthorized(userId: string, targetId?: string): Promise<boolean> {
  if (!userId) return false;
  const cacheKey = `line:auth_closer:${userId}:${targetId || "none"}`;

  return cached(cacheKey, 10_000, async () => {
    try {
      const { closerIds } = await getLineTargetIds();
      if (closerIds.includes(userId) || (targetId && closerIds.includes(targetId))) {
        return true;
      }
    } catch (e) {
      console.warn("⚠️ Warning checking LINE closer/finance authorization:", e);
    }
    return false;
  });
}

export async function getLineTargetGroup(
  category: "task" | "work" | "pw" | "finance" | "summary" | "plan" | "paid"
): Promise<string> {
  try {
    const { data: configRow } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "line_config")
      .maybeSingle();

    const cfg = configRow?.data || {};

    let target = "";
    switch (category) {
      case "task":
        target = cfg.LINE_GROUP_ID_TASK || process.env.LINE_GROUP_ID_TASK;
        break;
      case "work":
      case "pw":
        target = cfg.LINE_GROUP_ID_PW || process.env.LINE_GROUP_ID_PW;
        break;
      case "finance":
        target = cfg.LINE_GROUP_ID_FINANCE || process.env.LINE_GROUP_ID_FINANCE;
        break;
      case "paid":
        target = cfg.LINE_GROUP_ID_PAID || cfg.LINE_GROUP_ID_FINANCE || process.env.LINE_GROUP_ID_PAID;
        break;
      case "summary":
        target = cfg.LINE_GROUP_ID_SUMMARY || process.env.LINE_GROUP_ID_SUMMARY;
        break;
      case "plan":
        target = cfg.LINE_GROUP_ID_PLAN || process.env.LINE_GROUP_ID_PLAN;
        break;
    }

    if (target && String(target).trim()) return String(target).trim();

    return (
      cfg.LINE_USER_ID_OWN ||
      cfg.LINE_USER_ID_APPROVER ||
      process.env.LINE_USER_ID_OWN ||
      process.env.LINE_USER_ID_APPROVER ||
      ""
    );
  } catch (e) {
    console.error("Failed resolving target LINE group:", e);
    return "";
  }
}

export async function recordDiscoveredLineGroup(groupId: string, sourceName?: string): Promise<void> {
  if (!groupId || !groupId.startsWith("C")) return;
  try {
    const { data: existing } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "line_group_activity")
      .maybeSingle();

    const currentGroups = existing?.data?.groups || {};
    currentGroups[groupId] = {
      groupId,
      name: sourceName || currentGroups[groupId]?.name || "LINE Group",
      lastActive: new Date().toISOString()
    };

    await supabaseAdmin.from("system_options").upsert({
      id: "line_group_activity",
      data: { groups: currentGroups },
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn("⚠️ Warning recording discovered LINE group:", e);
  }
}

export async function logSystemError(
  source: string,
  error: any,
  context?: Record<string, any>
): Promise<void> {
  const errMsg = typeof error === "string" ? error : error?.message || String(error);
  console.error(`❌ [System Error Log] (${source}):`, errMsg, context || "");

  try {
    const { data: existing } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "system_error_logs")
      .maybeSingle();

    const logs: any[] = Array.isArray(existing?.data?.logs) ? existing.data.logs : [];

    const newLog = {
      id: `ERR-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source,
      message: errMsg,
      context: context || {}
    };

    const updatedLogs = [newLog, ...logs].slice(0, 50);

    await supabaseAdmin.from("system_options").upsert({
      id: "system_error_logs",
      data: { logs: updatedLogs },
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn("⚠️ Warning logging system error to Supabase:", e);
  }
}

export type LineSendResult = {
  success: boolean;
  error?: string;
};

export async function sendTextMessageDetailed(to: string, text: string): Promise<LineSendResult> {
  const token = await getDynamicAccessToken();
  if (!token || token.includes("your-line")) {
    return {
      success: false,
      error: "ยังไม่ได้ระบุ LINE Channel Access Token หรือ Token ไม่ถูกต้อง (กรุณาบันทึก Token ในระบบ)",
    };
  }
  if (!to) {
    return {
      success: false,
      error: "ยังไม่ได้ระบุปลายทาง (User ID หรือ Group ID)",
    };
  }
  try {
    const res = await fetch(`${LINE_API_BASE}/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const lineMsg = errJson.message || errJson.details?.[0]?.message || `HTTP status ${res.status}`;
      return {
        success: false,
        error: `ส่งข้อความ LINE ไม่สำเร็จ (LINE API: "${lineMsg}")`,
      };
    }
    return { success: true };
  } catch (error: any) {
    console.error("❌ Failed to push text message to LINE:", error.message || error);
    return {
      success: false,
      error: `เกิดข้อผิดพลาดในการเชื่อมต่อ LINE API: ${error.message || String(error)}`,
    };
  }
}

export async function sendTextMessage(to: string, text: string): Promise<boolean> {
  const result = await sendTextMessageDetailed(to, text);
  return result.success;
}

export async function replyTextMessage(replyToken: string, text: string): Promise<boolean> {
  const token = await getDynamicAccessToken();
  if (!token || token.includes("your-line") || !replyToken) return false;
  try {
    const res = await fetch(`${LINE_API_BASE}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });
    return res.ok;
  } catch (error: any) {
    console.error("❌ Failed to reply text message to LINE:", error.message || error);
    return false;
  }
}

export async function sendFlexMessageDetailed(
  to: string,
  altText: string,
  flexContents: Record<string, any>
): Promise<LineSendResult> {
  const token = await getDynamicAccessToken();
  if (!token || token.includes("your-line")) {
    return {
      success: false,
      error: "ยังไม่ได้ระบุ LINE Channel Access Token หรือ Token ไม่ถูกต้อง (กรุณากรอกและบันทึก Access Token ในส่วนตั้งค่า)",
    };
  }
  if (!to) {
    return {
      success: false,
      error: "ยังไม่ได้ระบุปลายทาง (User ID หรือ Group ID)",
    };
  }
  try {
    const res = await fetch(`${LINE_API_BASE}/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [
          {
            type: "flex",
            altText,
            contents: flexContents,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error("❌ LINE Flex Push Error Details:", JSON.stringify(errJson, null, 2));
      console.error("❌ LINE Flex Payload:", JSON.stringify(flexContents, null, 2));
      const lineMsg = errJson.details?.map((d: any) => `${d.property}: ${d.message}`).join(", ") || errJson.message || `HTTP Status ${res.status}`;
      return {
        success: false,
        error: `ส่งข้อความ LINE ไม่สำเร็จ (LINE API ตอบกลับ: "${lineMsg}")`,
      };
    }
    return { success: true };
  } catch (error: any) {
    console.error("❌ Failed to push flex message to LINE:", error.message || error);
    return {
      success: false,
      error: `เกิดข้อผิดพลาดในการเชื่อมต่อ LINE API: ${error.message || String(error)}`,
    };
  }
}

export async function sendFlexMessage(to: string, altText: string, flexContents: Record<string, any>): Promise<boolean> {
  const result = await sendFlexMessageDetailed(to, altText, flexContents);
  return result.success;
}

export async function replyFlexMessage(replyToken: string, altText: string, flexContents: Record<string, any>): Promise<boolean> {
  const token = await getDynamicAccessToken();
  if (!token || token.includes("your-line") || !replyToken) {
    if (replyToken) {
      await replyTextMessage(replyToken, altText);
    }
    return false;
  }
  try {
    const res = await fetch(`${LINE_API_BASE}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [
          {
            type: "flex",
            altText,
            contents: flexContents,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn("⚠️ Flex reply failed, falling back to text reply:", errJson);
      await replyTextMessage(replyToken, `${altText}\n\n(แสดงผลรายละเอียดเพิ่มเติมบนระบบเว็บ)`);
      return true;
    }
    return true;
  } catch (error: any) {
    console.error("❌ Failed to reply flex message to LINE:", error.message || error);
    await replyTextMessage(replyToken, altText);
    return false;
  }
}

/**
 * Helper to determine if a bill record is a sub-bill ("บิลย่อย")
 */
export function isSubBillRecord(b: Record<string, any> | undefined | null): boolean {
  if (!b || typeof b !== "object") return false;
  const billVal = String(
    b["บิล"] ??
    b.bill ??
    b.bill_type ??
    b.billType ??
    b["ประเภทบิล"] ??
    b.data?.["บิล"] ??
    b.data?.bill ??
    b.data?.bill_type ??
    b.data?.["ประเภทบิล"] ??
    ""
  ).trim();

  if (billVal) {
    if (billVal.includes("ย่อย")) return true;
    if (billVal.includes("หลัก")) return false;
  }

  // Fallback check on category / type if "บิล" is not explicitly set
  const cat = String(b["ประเภท"] ?? b.category ?? b.categoryType ?? b.data?.["ประเภท"] ?? "").trim();
  if (cat.includes("สดย่อย") || cat.includes("บิลย่อย")) {
    return true;
  }

  return false;
}

export function extractBillLineItems(b: Record<string, any>): Array<{ category?: string; categoryType?: string; amount?: string | number; name?: string; type?: string; price?: string | number; total?: string | number; detail?: string; subItem?: string; vehiclePlate?: string; toolName?: string; storeGroup?: string }> {
  if (!b) return [];
  const rawItems = b.items || b.data?.items || b["รายการสินค้า"] || b.line_items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    return rawItems.filter(Boolean);
  }
  if (typeof rawItems === "string" && rawItems.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(Boolean);
    } catch {}
  }
  return [];
}

export function getBillFlexGrossAmount(b: Record<string, any>): number {
  if (!b) return 0;
  const items = extractBillLineItems(b);
  if (items.length > 0) {
    const sum = items.reduce((s, i) => s + Number(i.amount ?? i.price ?? i.total ?? 0), 0);
    if (sum > 0) return sum;
  }
  const raw = b["ยอดเงิน"] ?? b.data?.["ยอดเงิน"] ?? b.amount ?? b.data?.amount ?? b.total ?? b.total_amount ?? 0;
  return typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim()) || 0;
}

export function resolveBillDeductionInfo(b: Record<string, any>): { hasDeduct: boolean; deductAmt: number; deductPercent: string } {
  const rawWhtNum = Number(b.withholding_tax ?? b.withholdingTax ?? b["withholding_tax"] ?? b.data?.withholding_tax ?? 0);
  const rawD = String(
    b["หัก"] ||
    b.deduct_percent ||
    b.deduct ||
    (rawWhtNum > 0 ? `หัก ${rawWhtNum}%` : "") ||
    b["หัก ณ ที่จ่าย"] ||
    b.data?.["หัก"] ||
    b.data?.deduct_percent ||
    b.data?.withholding_tax ||
    ""
  ).trim();
  const rawDLower = rawD.toLowerCase();
  const isActive = Boolean(
    rawWhtNum > 0 ||
    (rawD &&
    rawD !== "-" &&
    rawD !== "0" &&
    rawD !== "0%" &&
    rawDLower !== "ไม่มี" &&
    !rawDLower.includes("ไม่มีการหักภาษี") &&
    !rawDLower.includes("ไม่มีหัก") &&
    rawDLower !== "false" &&
    rawDLower !== "no")
  );

  const gross = getBillFlexGrossAmount(b);
  if (!isActive) {
    return { hasDeduct: false, deductAmt: 0, deductPercent: "" };
  }

  const cleanD = rawD.replace(/หัก|\s|%/g, "").trim();
  const numRate = Number(cleanD) || (rawWhtNum > 0 ? rawWhtNum : 0);
  const rawCustom = Number(b["จำนวนหัก"] || b.deduct_amount || b.data?.["จำนวนหัก"] || b.data?.deduct_amount || 0);

  let deductAmt = 0;
  let deductPercent = "";

  // Check if VAT is active
  let hasVat = false;
  const rawVat = b.vat ?? b["vat"] ?? b["VAT"] ?? b["Vat"] ?? b["ภาษี"] ?? b["ภาษีมูลค่าเพิ่ม"] ??
    b.data?.vat ?? b.data?.["vat"] ?? b.data?.["VAT"] ?? b.data?.["Vat"] ?? b.data?.["ภาษี"] ?? b.data?.["ภาษีมูลค่าเพิ่ม"];
  if (rawVat !== null && rawVat !== undefined) {
    const str = String(rawVat).trim().toLowerCase();
    if (str && str !== "-" && str !== "0" && str !== "0%" && str !== "0.00" && str !== "ไม่มี" && !str.includes("ไม่มี") && str !== "false" && str !== "no") {
      hasVat = true;
    }
  }

  if (rawCustom > 0) {
    deductAmt = rawCustom;
    deductPercent = gross > 0 ? String(Math.round((deductAmt / gross) * 100)) : (numRate > 0 ? String(numRate) : "");
  } else if (numRate > 0 && gross > 0) {
    deductPercent = String(numRate);
    deductAmt = hasVat
      ? Math.round(((gross / 1.07) * numRate) / 100 * 100) / 100
      : Math.round((gross * numRate) / 100 * 100) / 100;
  } else {
    const sheet3Percent = Number(b["3เปอร์"] || b.data?.["3เปอร์"] || 0);
    if (sheet3Percent > 0) {
      deductAmt = sheet3Percent;
      deductPercent = gross > 0 ? String(Math.round((deductAmt / gross) * 100)) : "3";
    }
  }

  return {
    hasDeduct: deductAmt > 0 || isActive,
    deductAmt,
    deductPercent
  };
}

export function createBillNotificationFlex(bill: {
  id?: string | number;
  bill_no?: string | number;
  project_name?: string;
  vendor_or_person?: string;
  description?: string;
  amount?: number;
  requester?: string;
  status?: string;
  items?: Array<{
    category?: string;
    categoryType?: string;
    amount?: string | number;
    name?: string;
    type?: string;
    price?: string | number;
    total?: string | number;
  }>;
  bank_account?: string;
  bank_name?: string;
  account_name?: string;
  data?: any;
}, bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>, peopleMap?: Map<string, string> | Record<string, string>, carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>, pettyCashMap?: Map<string, PettyCashLookupInfo> | Record<string, PettyCashLookupInfo>): Record<string, any> {
  const lineItems = extractBillLineItems(bill as any);
  const rawAmount = getBillFlexGrossAmount(bill as any);
  const formattedAmount = Number(rawAmount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const dInfo = resolveBillDeductionInfo(bill as any);
  const rawNet = Number((bill as any)["ยอดโอน"] || (bill as any).net_amount || (bill as any).data?.["ยอดโอน"] || (bill as any).data?.net_amount || 0);
  const netTransferAmt = dInfo.hasDeduct
    ? (dInfo.deductAmt > 0 ? rawAmount - dInfo.deductAmt : (rawNet > 0 ? rawNet : rawAmount))
    : (rawNet > 0 && rawNet !== rawAmount ? rawNet : rawAmount);

  const bankInfo = resolveBankInfo(bill, bankInfoMap);
  const isSubBill = isSubBillRecord(bill);
  const reqBank = resolveRequesterBankInfo(bill, bankInfoMap, peopleMap);

  const billStatus = bill.status || (bill as any)["สถานะ"] || "ตั้งเบิก";
  const projectName = bill.project_name || (bill as any)["ชื่อ Project"] || (bill as any)["โครงการ"] || "-";
  const vendorCandidate = bill.vendor_or_person || (bill as any)["ร้าน/บุคคล"] || (bill as any)["ร้านค้า"] || (bill as any)["ผู้รับเหมา"] || (bill as any).store_name || "-";
  const rawRequester = bill.requester || (bill as any)["ผู้เบิก"] || (bill as any).data?.["ผู้เบิก"] || (bill as any).data?.requester || "-";
  const requesterName = resolveStaffDisplayName(rawRequester, peopleMap) || rawRequester;
  const pettyCashInfo = resolvePettyCashInfo(rawRequester, pettyCashMap, peopleMap);

  const rawPlate = (bill as any)["ทะเบียน"] || (bill as any).plate_no || (bill as any)["id_car"] || (bill as any).id_car;
  const carDisplayName = resolveCarDisplayName(rawPlate, carsMap);

  const rawStaff = (bill as any)["ชื่อพนักงาน"] || (bill as any).staff_name || (bill as any)["รหัสพนักงาน"];
  const staffDisplayName = resolveStaffDisplayName(rawStaff, peopleMap);

  const rawTool = (bill as any)["ชื่อเครื่องมือ"] || (bill as any).tool_name;
  const toolDisplayName = String(rawTool || "").trim();

  const rawOther = (bill as any)["รายการ"] || (bill as any).sub_category;
  const otherDisplayName = String(rawOther || "").trim();

  const rawCategory = String((bill as any)["ประเภท"] || (bill as any).category || "").trim();
  const rawVendorType = String((bill as any)["ร้านค้า/ผู้รับเหมา"] || (bill as any).vendor_type || "").trim();
  const isContractor = rawVendorType === "ผู้รับเหมา" || Boolean((bill as any)["ผู้รับเหมา"]) || Boolean((bill as any).contractor_id) || rawCategory.includes("ค่าแรง") || rawCategory.startsWith("2.");

  let rawBillDescription = bill.description || (bill as any)["รายละเอียดงาน"] || (bill as any).data?.["รายละเอียดงาน"] || (bill as any)["สินค้า/ทำงาน"] || (bill as any)["รายละเอียด"] || "-";
  let billDescription = sanitizeFlexItemDescription(rawBillDescription, carsMap, peopleMap);
  if (carDisplayName && (billDescription === "-" || !billDescription || /^[a-zA-Z]{1,3}[-_]?\d+$/.test(billDescription))) {
    billDescription = rawCategory.includes("ซ่อม") ? `ซ่อมรถ (${carDisplayName})` : `น้ำมัน (${carDisplayName})`;
  } else if (staffDisplayName && (billDescription === "-" || !billDescription || /^[a-zA-Z]{1,3}[-_]?\d+$/.test(billDescription))) {
    billDescription = `พนักงาน (${staffDisplayName})`;
  } else if (toolDisplayName && (billDescription === "-" || !billDescription || /^[a-zA-Z]{1,3}[-_]?\d+$/.test(billDescription))) {
    billDescription = `เครื่องมือ (${toolDisplayName})`;
  } else if (otherDisplayName && (billDescription === "-" || !billDescription || /^[a-zA-Z]{1,3}[-_]?\d+$/.test(billDescription))) {
    billDescription = `อื่นๆ (${otherDisplayName})`;
  }

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: isSubBill ? "#1E293B" : "#0F172A",
      paddingAll: "14px",
      spacing: "xs",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: isSubBill ? "🧾 แจ้งเตือนการเบิกเงิน (บิลย่อย)" : "🧾 รายการแจ้งเตือนการเบิกเงิน",
              weight: "bold",
              color: "#FFFFFF",
              size: "md",
              flex: 8,
            },
            ...(isSubBill ? [
              {
                type: "text",
                text: "บิลย่อย",
                weight: "bold",
                color: "#F59E0B",
                size: "xs",
                align: "end",
                flex: 3,
              }
            ] : [])
          ]
        },
        {
          type: "text",
          text: `สถานะ: ${billStatus}`,
          color: "#94A3B8",
          size: "xs",
        },
        // สำหรับบิลย่อย: แสดงชื่อ เลขบัญชี ธนาคาร ของผู้เบิก ไว้ที่ส่วนหัว
        ...(isSubBill ? [
          {
            type: "box",
            layout: "vertical",
            margin: "sm",
            paddingAll: "8px",
            backgroundColor: "#334155",
            cornerRadius: "6px",
            borderWidth: "1px",
            borderColor: "#F59E0B",
            spacing: "xs",
            contents: [
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "👤 ผู้เบิก:", size: "xs", color: "#FDE68A", flex: 3, weight: "bold" },
                  { type: "text", text: reqBank.accountName || reqBank.requesterName || requesterName, size: "xs", color: "#FFFFFF", weight: "bold", flex: 7, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "🏦 ธนาคาร:", size: "xs", color: "#FDE68A", flex: 3 },
                  { type: "text", text: reqBank.bankName || "-", size: "xs", color: reqBank.bankName ? "#FFFFFF" : "#94A3B8", weight: "bold", flex: 7, wrap: true }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "💳 เลขบัญชี:", size: "xs", color: "#FDE68A", flex: 3 },
                  {
                    type: "text",
                    text: reqBank.accountNo || "ไม่มีเลขบัญชี",
                    size: "xs",
                    color: reqBank.accountNo ? "#34D399" : "#FCA5A5",
                    weight: "bold",
                    flex: 7,
                    wrap: true
                  }
                ]
              },
              ...(pettyCashInfo && pettyCashInfo.remaining > 0 ? [
                {
                  type: "separator",
                  margin: "xs",
                  color: "#475569"
                },
                {
                  type: "box",
                  layout: "horizontal",
                  margin: "xs",
                  paddingAll: "2px",
                  alignItems: "center",
                  contents: [
                    {
                      type: "text",
                      text: "🪙 เบิกไว้ก่อน:",
                      size: "xxs",
                      color: "#FDE68A",
                      weight: "bold",
                      flex: 5
                    },
                    {
                      type: "text",
                      text: `฿${pettyCashInfo.remaining.toLocaleString("th-TH")}`,
                      size: "xs",
                      color: "#FCA5A5",
                      weight: "bold",
                      align: "end",
                      flex: 7
                    }
                  ]
                }
              ] : [])
            ]
          }
        ] : [])
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                { type: "text", text: "โครงการ:", color: "#64748B", size: "xs", flex: 2 },
                { type: "text", text: projectName, weight: "bold", color: "#1E293B", size: "xs", flex: 5, wrap: true },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                { type: "text", text: isSubBill ? "ร้านค้า/บิล:" : (isContractor ? "ผู้รับเหมา:" : "ร้าน/บุคคล:"), color: "#64748B", size: "xs", flex: 2 },
                {
                  type: "text",
                  text: resolveVendorName(vendorCandidate, bankInfoMap, bill as any, peopleMap) || bankInfo?.storeName || bankInfo?.accountName || vendorCandidate,
                  color: "#1E293B",
                  size: "xs",
                  flex: 5,
                  wrap: true
                },
              ],
            },
            // Bank Account Information Box (skip for sub-bills / บิลย่อย)
            ...(!isSubBill && bankInfo && (bankInfo.accountNo || bankInfo.bankName || bankInfo.accountName) ? [
              {
                type: "box",
                layout: "vertical",
                margin: "xs",
                paddingAll: "6px",
                backgroundColor: "#F8FAFC",
                cornerRadius: "6px",
                borderWidth: "1px",
                borderColor: "#E2E8F0",
                spacing: "xs",
                contents: [
                  ...(bankInfo.bankName ? [
                    {
                      type: "box",
                      layout: "baseline",
                      contents: [
                        { type: "text", text: "ธนาคาร:", size: "xxs", color: "#64748B", flex: 3 },
                        { type: "text", text: bankInfo.bankName, size: "xxs", color: "#0F172A", weight: "bold", flex: 7, wrap: true }
                      ]
                    }
                  ] : []),
                  ...(bankInfo.accountName ? [
                    {
                      type: "box",
                      layout: "baseline",
                      contents: [
                        { type: "text", text: "ชื่อบัญชี:", size: "xxs", color: "#64748B", flex: 3 },
                        { type: "text", text: bankInfo.accountName, size: "xxs", color: "#0F172A", weight: "bold", flex: 7, wrap: true }
                      ]
                    }
                  ] : []),
                  ...(bankInfo.accountNo ? [
                    {
                      type: "box",
                      layout: "baseline",
                      contents: [
                        { type: "text", text: "เลขบัญชี:", size: "xxs", color: "#64748B", flex: 3 },
                        {
                          type: "text",
                          text: bankInfo.accountNo,
                          size: "xxs",
                          color: "#059669",
                          weight: "bold",
                          flex: 7,
                          wrap: true
                        }
                      ]
                    }
                  ] : [])
                ]
              }
            ] : []),
            ...(carDisplayName ? [
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "ทะเบียนรถ:", color: "#64748B", size: "xs", flex: 2 },
                  { type: "text", text: carDisplayName, color: "#1E293B", size: "xs", weight: "bold", flex: 5, wrap: true },
                ],
              }
            ] : []),
            ...(staffDisplayName && rawCategory.includes("พนักงาน") ? [
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "ชื่อพนักงาน:", color: "#64748B", size: "xs", flex: 2 },
                  { type: "text", text: staffDisplayName, color: "#1E293B", size: "xs", weight: "bold", flex: 5, wrap: true },
                ],
              }
            ] : []),
            ...(toolDisplayName && rawCategory.includes("เครื่องมือ") ? [
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "เครื่องมือ:", color: "#64748B", size: "xs", flex: 2 },
                  { type: "text", text: toolDisplayName, color: "#1E293B", size: "xs", weight: "bold", flex: 5, wrap: true },
                ],
              }
            ] : []),
            ...(otherDisplayName && rawCategory.includes("อื่นๆ") ? [
              {
                type: "box",
                layout: "baseline",
                contents: [
                  { type: "text", text: "รายการ:", color: "#64748B", size: "xs", flex: 2 },
                  { type: "text", text: otherDisplayName, color: "#1E293B", size: "xs", weight: "bold", flex: 5, wrap: true },
                ],
              }
            ] : []),
            {
              type: "box",
              layout: "baseline",
              contents: [
                { type: "text", text: "ผู้เบิก:", color: "#64748B", size: "xs", flex: 2 },
                { type: "text", text: requesterName, color: "#1E293B", size: "xs", flex: 5 },
              ],
            },
            ...(lineItems.length === 0 && (isContractor || rawCategory || billDescription) ? [
              { type: "separator", margin: "xs" },
              {
                type: "box",
                layout: "vertical",
                margin: "xs",
                paddingAll: "8px",
                backgroundColor: "#F8FAFC",
                cornerRadius: "6px",
                spacing: "xs",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: isContractor ? "👷‍♂️ ประเภทงาน (ผู้รับเหมา):" : "📦 รายการสินค้า / ประเภท:", size: "xs", weight: "bold", color: "#0F172A", flex: 7 },
                      { type: "text", text: "ราคา", size: "xs", weight: "bold", color: "#64748B", flex: 3, align: "end" }
                    ]
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: isContractor ? `• ${rawCategory || (bill as any)["สินค้า"] || "ค่าแรง"}` : `• ${rawCategory || billDescription || "รายการ"}`,
                        size: "xs",
                        color: "#1E293B",
                        weight: "bold",
                        flex: 7,
                        wrap: true
                      },
                      {
                        type: "text",
                        text: `฿${formattedAmount}`,
                        size: "xs",
                        color: "#059669",
                        weight: "bold",
                        align: "end",
                        flex: 3
                      }
                    ]
                  },
                  ...(!isContractor && billDescription && billDescription !== "-" && rawCategory && !rawCategory.includes(billDescription) && !billDescription.includes(rawCategory) ? [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: `  ${billDescription}`,
                          size: "xs",
                          color: "#64748B",
                          wrap: true
                        }
                      ]
                    }
                  ] : [])
                ]
              }
            ] : []),
            ...(lineItems.length > 0 ? [
              { type: "separator", margin: "xs" },
              {
                type: "box",
                layout: "vertical",
                margin: "xs",
                paddingAll: "8px",
                backgroundColor: "#F8FAFC",
                cornerRadius: "6px",
                spacing: "xs",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: isContractor ? `👷‍♂️ รายการค่าแรง / งวดงาน (${lineItems.length} รายการ):` : `📦 รายการสินค้า (${lineItems.length} รายการ):`, size: "xs", weight: "bold", color: "#0F172A", flex: 7 },
                      { type: "text", text: "ราคา", size: "xs", weight: "bold", color: "#64748B", flex: 3, align: "end" }
                    ]
                  },
                  ...lineItems.map((item, idx) => {
                    const itemAmt = Number(item.amount ?? item.price ?? item.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const rawCat = String(item.category || "").trim();
                    const rawName = String(item.name || "").trim();
                    const rawDetail = String(item.detail || "").trim();
                    const cleanCat = rawCat.replace(/^\d+\.?\s*\d*\.?\s*/, "").trim();
                    const cleanName = rawName.replace(/^\d+\.?\s*\d*\.?\s*/, "").trim();

                    let itemTitle = "";
                    if (isContractor) {
                      const catDisplay = rawCat || cleanCat || "ค่าแรง";
                      if (rawDetail && !catDisplay.includes(rawDetail)) {
                        itemTitle = `${catDisplay} - ${rawDetail}`;
                      } else {
                        itemTitle = catDisplay;
                      }
                    } else {
                      if (cleanCat && cleanName && cleanCat !== cleanName) {
                        itemTitle = `${cleanCat} ${cleanName}`;
                      } else {
                        itemTitle = cleanName || cleanCat || `สินค้า ${idx + 1}`;
                      }
                      if (rawDetail && !itemTitle.includes(rawDetail)) {
                        itemTitle = `${itemTitle} (${rawDetail})`;
                      }
                    }

                    const rawType = String(item.categoryType || item.type || "").trim();
                    const cleanType = rawType.replace(/^\d+\.?\s*/, "").trim();
                    const rawSub = String(item.subItem || "").trim();
                    const tagText = rawSub ? (cleanType && !isContractor ? `${cleanType} • ${rawSub}` : rawSub) : (cleanType && !isContractor ? cleanType : "");

                    return {
                      type: "box",
                      layout: "vertical",
                      margin: idx > 0 ? "xs" : "none",
                      spacing: "none",
                      contents: [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            {
                              type: "text",
                              text: `${idx + 1}. ${itemTitle}`,
                              size: "xs",
                              color: "#1E293B",
                              weight: "bold",
                              flex: 7,
                              wrap: true
                            },
                            {
                              type: "text",
                              text: `฿${itemAmt}`,
                              size: "xs",
                              color: "#059669",
                              weight: "bold",
                              align: "end",
                              flex: 3
                            }
                          ]
                        },
                        ...(tagText ? [
                          {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                              {
                                type: "text",
                                text: `   (${tagText})`,
                                size: "xxs",
                                color: "#0284C7",
                                wrap: true
                              }
                            ]
                          }
                        ] : [])
                      ]
                    };
                  })
                ]
              }
            ] : []),
          ],
        },
        { type: "separator" },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "จำนวนเงินรวม:", weight: "bold", color: "#0F172A", size: "sm" },
            { type: "text", text: `฿${formattedAmount}`, weight: "bold", color: "#2563EB", size: "lg", align: "end" },
          ],
        },
        ...(dInfo.hasDeduct && dInfo.deductAmt > 0 ? [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: `หักภาษี (${dInfo.deductPercent ? `${dInfo.deductPercent}%` : "ณ ที่จ่าย"}):`, color: "#D97706", size: "xs", weight: "bold" },
              { type: "text", text: `-฿${dInfo.deductAmt.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#D97706", size: "sm", align: "end", weight: "bold" },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ยอดโอนสุทธิ:", weight: "bold", color: "#059669", size: "sm" },
              { type: "text", text: `฿${netTransferAmt.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, weight: "bold", color: "#059669", size: "lg", align: "end" },
            ],
          }
        ] : []),
        ...(((bill as any)["วันจ่าย"] || (bill as any).due_date) ? [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: `กำหนดชำระ${(bill as any)["เครดิต"] ? ` (เครดิต ${(bill as any)["เครดิต"]})` : ""}:`, color: "#64748B", size: "xs" },
              { type: "text", text: String((bill as any)["วันจ่าย"] || (bill as any).due_date), color: "#0284C7", size: "xs", align: "end", weight: "bold" },
            ],
          }
        ] : []),
      ],
    },
  };
}

export function createDailySummaryFlex(summary: {
  dateStr: string;
  totalBills: number;
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  paidCount?: number;
  globalPendingCount?: number;
  bills?: Array<Record<string, any>>;
  title?: string;
}): Record<string, any> {
  const title = summary.title || "📊 สรุปรายงานการเงินประจำวัน";
  const formattedAmount = Number(summary.totalAmount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const bodyContents: any[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "บิลทั้งหมด", color: "#64748B", size: "sm" },
        { type: "text", text: `${summary.totalBills} รายการ`, weight: "bold", color: "#0F172A", size: "sm", align: "end" },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "⏳ รออนุมัติ", color: "#64748B", size: "sm" },
        { type: "text", text: `${summary.pendingCount} รายการ`, weight: "bold", color: "#D97706", size: "sm", align: "end" },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "✅ อนุมัติแล้ว", color: "#64748B", size: "sm" },
        { type: "text", text: `${summary.approvedCount} รายการ`, weight: "bold", color: "#16A34A", size: "sm", align: "end" },
      ],
    },
  ];

  if (typeof summary.paidCount === "number") {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "💸 ปิดงาน/จ่ายแล้ว", color: "#64748B", size: "sm" },
        { type: "text", text: `${summary.paidCount} รายการ`, weight: "bold", color: "#0284C7", size: "sm", align: "end" },
      ],
    });
  }

  if (typeof summary.globalPendingCount === "number" && summary.globalPendingCount > 0) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: "📌 รออนุมัติสะสมในระบบ", color: "#64748B", size: "xs" },
        { type: "text", text: `${summary.globalPendingCount} รายการ`, weight: "bold", color: "#D97706", size: "xs", align: "end" },
      ],
    });
  }

  bodyContents.push(
    { type: "separator", margin: "md" },
    {
      type: "box",
      layout: "horizontal",
      margin: "md",
      contents: [
        { type: "text", text: "รวมยอดเงินทั้งสิ้น", weight: "bold", color: "#0F172A", size: "sm" },
        { type: "text", text: `฿${formattedAmount}`, weight: "bold", color: "#2563EB", size: "lg", align: "end" },
      ],
    }
  );

  const previewBills = summary.bills || [];
  if (previewBills.length > 0) {
    bodyContents.push(
      { type: "separator", margin: "md" },
      {
        type: "text",
        text: `📝 รายการบิล (${previewBills.length} รายการ):`,
        weight: "bold",
        color: "#475569",
        size: "xs",
        margin: "sm"
      }
    );

    previewBills.slice(0, 5).forEach((b, idx) => {
      const d = (b.data && typeof b.data === "object") ? b.data : {};
      const rawAmt = b["ยอดเงิน"] ?? d["ยอดเงิน"] ?? b.amount ?? d.amount ?? b["ค่าแรง+พนักงาน+อื่นๆ"] ?? d["ค่าแรง+พนักงาน+อื่นๆ"] ?? b["ค่าแรง"] ?? d["ค่าแรง"] ?? b["ค่าจ้าง"] ?? d["ค่าจ้าง"] ?? b["ยอดโอน"] ?? d["ยอดโอน"] ?? 0;
      const bAmt = typeof rawAmt === "number" ? rawAmt : Number(String(rawAmt).replace(/,/g, "").trim()) || 0;
      const payee = String(b["ร้าน/บุคคล"] || b.vendor_or_person || b["ผู้รับเหมา"] || b["ร้านค้า"] || b["ผู้เบิก"] || "-").trim();
      const st = String(b["สถานะ"] || b.status || "-").trim();
      const isPaid = st.includes("เบิกแล้ว") || st.includes("ปิดงาน") || st.includes("จ่ายแล้ว");
      const isApproved = !isPaid && st.includes("อนุมัติ");
      const stColor = isPaid ? "#0284C7" : isApproved ? "#16A34A" : "#D97706";

      bodyContents.push({
        type: "box",
        layout: "horizontal",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: `${idx + 1}. [${b.bill_no || b.id || b["ลำดับ"] || "-"}] ${payee}`,
            size: "xs",
            color: "#334155",
            flex: 7,
            maxLines: 1
          },
          {
            type: "text",
            text: `฿${bAmt.toLocaleString("th-TH")}`,
            size: "xs",
            weight: "bold",
            color: "#0F172A",
            align: "end",
            flex: 4
          }
        ]
      });
    });

    if (previewBills.length > 5) {
      bodyContents.push({
        type: "text",
        text: `...และอีก ${previewBills.length - 5} รายการ`,
        size: "xxs",
        color: "#94A3B8",
        align: "center",
        margin: "xs"
      });
    }
  }

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#0F172A",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: title,
          weight: "bold",
          color: "#FFFFFF",
          size: "md",
        },
        {
          type: "text",
          text: `ประจำวันที่ ${summary.dateStr}`,
          color: "#38BDF8",
          size: "xs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "md",
      contents: bodyContents,
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
          color: "#F1F5F9",
          action: {
            type: "message",
            label: "⏳ บิลรออนุมัติ",
            text: "รออนุมัติ",
          },
        },
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: "#059669",
          action: {
            type: "message",
            label: "💸 ยอดโอนวันนี้",
            text: "ยอดโอนวันนี้",
          },
        },
      ],
    },
  };
}

export function createMorningTasksCarouselFlex(data: {
  dateStr: string;
  tasks: Array<{ id: any; details: string; status?: string; project?: string }>;
  works: Array<{ id: any; details: string; contractor?: string; project?: string }>;
  pendingBills: Array<{ id: any; requester?: string; amount?: number | string }>;
}): Record<string, any> {
  const { dateStr, tasks = [], works = [], pendingBills = [] } = data;

  // Tab 1: 📋 รายการงานค้างประจำวัน (Daily Tasks)
  const tab1 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#0F172A",
      paddingAll: "15px",
      contents: [
        { type: "text", text: "📋 แท็บ 1/3: งานค้างประจำวัน", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: `ประจำวันที่ ${dateStr} (${tasks.length} รายการ)`, color: "#38BDF8", size: "xs", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "xs",
      contents: tasks.length > 0 ? tasks.slice(0, 5).map((t, idx) => ({
        type: "box",
        layout: "vertical",
        margin: idx > 0 ? "xs" : "none",
        paddingAll: "6px",
        backgroundColor: "#F8FAFC",
        cornerRadius: "6px",
        contents: [
          { type: "text", text: `${idx + 1}. [${t.project || "งานทั่วไป"}] ${t.details}`, size: "xs", weight: "bold", color: "#0F172A", wrap: true },
          { type: "text", text: `สถานะ: ${t.status || "กำลังทำ"}`, size: "xxs", color: "#059669" }
        ]
      })) : [
        { type: "text", text: "✅ ไม่มีรายการงานค้างในวันนี้", size: "xs", color: "#059669", align: "center" }
      ]
    }
  };

  // Tab 2: 👷‍♂️ งานรับเหมา & PW มอบหมาย (Contract Works)
  const tab2 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E1B4B",
      paddingAll: "15px",
      contents: [
        { type: "text", text: "👷‍♂️ แท็บ 2/3: งานรับเหมา & PW", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: `รายการเปิดจ้างค้าง (${works.length} รายการ)`, color: "#A5B4FC", size: "xs", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "xs",
      contents: works.length > 0 ? works.slice(0, 5).map((w, idx) => ({
        type: "box",
        layout: "vertical",
        margin: idx > 0 ? "xs" : "none",
        paddingAll: "6px",
        backgroundColor: "#F8FAFC",
        cornerRadius: "6px",
        contents: [
          { type: "text", text: `${idx + 1}. [CW${w.id}] ${w.details}`, size: "xs", weight: "bold", color: "#1E293B", wrap: true },
          { type: "text", text: `ผู้รับเหมา: ${w.contractor || "-"} | โครงการ: ${w.project || "ทั่วไป"}`, size: "xxs", color: "#64748B" }
        ]
      })) : [
        { type: "text", text: "✅ ไม่มีรายการงานรับเหมาค้าง", size: "xs", color: "#059669", align: "center" }
      ]
    }
  };

  // Tab 3: 🧾 บิลตั้งเบิกที่ต้องตรวจสอบ (Pending Bills)
  const tab3 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#065F46",
      paddingAll: "15px",
      contents: [
        { type: "text", text: "🧾 แท็บ 3/3: บิลรอตรวจสอบ/ตั้งเบิก", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: `รายการบิลรออนุมัติ (${pendingBills.length} รายการ)`, color: "#A7F3D0", size: "xs", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "xs",
      contents: pendingBills.length > 0 ? pendingBills.slice(0, 5).map((b, idx) => ({
        type: "box",
        layout: "horizontal",
        margin: idx > 0 ? "xs" : "none",
        paddingAll: "6px",
        backgroundColor: "#F8FAFC",
        cornerRadius: "6px",
        contents: [
          { type: "text", text: `#${b.id} ${b.requester || "-"}`, size: "xs", weight: "bold", color: "#0F172A", flex: 6, wrap: true },
          { type: "text", text: `฿${(getBillFlexGrossAmount(b) || Number(b.amount || 0)).toLocaleString("th-TH")}`, size: "xs", weight: "bold", color: "#059669", flex: 4, align: "end" }
        ]
      })) : [
        { type: "text", text: "✅ ไม่มีรายการบิลรออนุมัติ", size: "xs", color: "#059669", align: "center" }
      ]
    }
  };

  return {
    type: "carousel",
    contents: [tab1, tab2, tab3]
  };
}

export function createEveningSummaryCarouselFlex(summary: {
  dateStr: string;
  totalBills: number;
  totalAmount: number;
  pendingCount: number;
  approvedCount: number;
  paidCount?: number;
  globalPendingCount?: number;
  activeWorksCount: number;
  completedWorksCount: number;
  lateTasks?: Array<{ id: any; details: string; assignee?: string }>;
}): Record<string, any> {
  const formattedAmount = Number(summary.totalAmount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const lateList = summary.lateTasks || [];

  // Tab 1: 📊 สรุปยอดรวมการเงิน & บิล
  const tab1 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#0F172A",
      paddingAll: "15px",
      contents: [
        { type: "text", text: "📊 แท็บ 1/3: สรุปภาพรวมการเงิน & บิล", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: `ประจำวันที่ ${summary.dateStr}`, color: "#38BDF8", size: "xs", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "รายการบิลทั้งหมด", color: "#64748B", size: "sm" },
            { type: "text", text: `${summary.totalBills} รายการ`, weight: "bold", color: "#0F172A", size: "sm", align: "end" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "⏳ รออนุมัติ (วันนี้)", color: "#64748B", size: "sm" },
            { type: "text", text: `${summary.pendingCount} รายการ`, weight: "bold", color: "#D97706", size: "sm", align: "end" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "✅ อนุมัติแล้ว (วันนี้)", color: "#64748B", size: "sm" },
            { type: "text", text: `${summary.approvedCount} รายการ`, weight: "bold", color: "#16A34A", size: "sm", align: "end" },
          ],
        },
        ...(typeof summary.paidCount === "number" ? [{
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "💸 ปิดงาน/จ่ายแล้ว", color: "#64748B", size: "sm" },
            { type: "text", text: `${summary.paidCount} รายการ`, weight: "bold", color: "#0284C7", size: "sm", align: "end" },
          ],
        }] : []),
        ...(typeof summary.globalPendingCount === "number" && summary.globalPendingCount > 0 ? [{
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "📌 รออนุมัติสะสมในระบบ", color: "#94A3B8", size: "xs" },
            { type: "text", text: `${summary.globalPendingCount} รายการ`, weight: "bold", color: "#D97706", size: "xs", align: "end" },
          ],
        }] : []),
        { type: "separator" },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "รวมยอดเงินทั้งสิ้น", weight: "bold", color: "#0F172A", size: "sm" },
            { type: "text", text: `฿${formattedAmount}`, weight: "bold", color: "#2563EB", size: "lg", align: "end" },
          ],
        },
      ]
    }
  };

  // Tab 2: 🎯 สรุปผลงานทีมและการดำเนินการ
  const tab2 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E1B4B",
      paddingAll: "15px",
      contents: [
        { type: "text", text: "🎯 แท็บ 2/3: สรุปผลงานทีม & PW", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: `สรุปความคืบหน้า (${summary.dateStr})`, color: "#A5B4FC", size: "xs", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "งานที่กำลังดำเนินการ", color: "#64748B", size: "sm" },
            { type: "text", text: `${summary.activeWorksCount} รายการ`, weight: "bold", color: "#2563EB", size: "sm", align: "end" },
          ],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "งานที่เสร็จสิ้นแล้ว", color: "#64748B", size: "sm" },
            { type: "text", text: `${summary.completedWorksCount} รายการ`, weight: "bold", color: "#16A34A", size: "sm", align: "end" },
          ],
        },
        { type: "separator" },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "อัตราความสำเร็จ (Success Rate)", color: "#0F172A", size: "xs", weight: "bold" },
            {
              type: "text",
              text: `${summary.activeWorksCount + summary.completedWorksCount > 0
                ? Math.round((summary.completedWorksCount / (summary.activeWorksCount + summary.completedWorksCount)) * 100)
                : 100}%`,
              weight: "bold",
              color: "#4F46E5",
              size: "md",
              align: "end"
            },
          ],
        },
      ]
    }
  };

  // Tab 3: ⏳ รายการงานที่เกินกำหนด/ล่าช้า (Late Tasks Warning)
  const tab3 = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#991B1B",
      paddingAll: "15px",
      contents: [
        { type: "text", text: "⏳ แท็บ 3/3: รายการงานค้าง/ต้องติดตาม", weight: "bold", color: "#FFFFFF", size: "sm" },
        { type: "text", text: `งานค้างที่รอดำเนินการ (${summary.activeWorksCount} รายการ)`, color: "#FCA5A5", size: "xs", margin: "xs" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "xs",
      contents: lateList.length > 0 ? lateList.slice(0, 5).map((l, idx) => ({
        type: "box",
        layout: "vertical",
        margin: idx > 0 ? "xs" : "none",
        paddingAll: "6px",
        backgroundColor: "#FEF2F2",
        cornerRadius: "6px",
        contents: [
          { type: "text", text: `${idx + 1}. [CW${l.id}] ${l.details}`, size: "xs", weight: "bold", color: "#991B1B", wrap: true },
          { type: "text", text: `ผู้รับผิดชอบ: ${l.assignee || "ทีมงาน"}`, size: "xxs", color: "#991B1B" }
        ]
      })) : [
        { type: "text", text: "🎉 ไม่มีรายการงานที่ล่าช้า", size: "xs", color: "#16A34A", align: "center", weight: "bold" }
      ]
    }
  };

  return {
    type: "carousel",
    contents: [tab1, tab2, tab3]
  };
}

export function createBillSearchResultFlex(
  title: string,
  bills: Array<{
    id: any;
    bill_no?: string;
    bill_type?: string;
    project_name?: string;
    vendor_or_person?: string;
    description?: string;
    requester?: string;
    amount?: number | string;
    status?: string;
    image_url?: string;
    image_urls?: string[];
    bank_account?: string;
    bank_name?: string;
    account_name?: string;
    [key: string]: any;
  }>,
  isSub: boolean = false,
  isMain: boolean = false,
  totalCount?: number,
  totalSumAmount?: number,
  filterQuery: string = "",
  peopleMap?: Map<string, string> | Record<string, string>,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>
): Record<string, any> {
  const count = totalCount ?? bills.length;
  const grandTotal = totalSumAmount ?? bills.reduce((sum, b) => sum + (getBillFlexGrossAmount(b) || Number(b.amount || 0)), 0);
  const formattedTotal = grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const batchParam = isSub
    ? (filterQuery ? `ย่อย:${filterQuery}` : "ย่อย")
    : isMain
      ? (filterQuery ? `หลัก:${filterQuery}` : "หลัก")
      : filterQuery;

  const pageSize = 4;
  const maxBubbles = 10; // LINE Flex Carousel supports up to 10 bubbles
  const displayBills = bills.slice(0, pageSize * maxBubbles);
  const totalPages = Math.max(1, Math.ceil(displayBills.length / pageSize));

  function buildBubblePage(pageBills: typeof displayBills, pageIndex: number) {
    const startNum = pageIndex * pageSize + 1;
    const endNum = startNum + pageBills.length - 1;

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0F172A",
        paddingAll: "12px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: title.replace(/^[^\w\s\u0E00-\u0E7F]+/gu, "").trim(),
                weight: "bold",
                color: "#FFFFFF",
                size: "sm",
                flex: 7,
                wrap: true,
              },
              {
                type: "text",
                text: `รวม ฿${formattedTotal}`,
                color: "#38BDF8",
                size: "xs",
                weight: "bold",
                align: "end",
                flex: 5,
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "xs",
            contents: [
              {
                type: "text",
                text: totalPages > 1
                  ? `หน้า ${pageIndex + 1}/${totalPages} (${startNum}-${endNum} จาก ${count} บิล)`
                  : `พบทั้งหมด ${count} รายการ`,
                color: "#94A3B8",
                size: "xxs",
                flex: 1
              }
            ]
          }
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "10px",
        spacing: "sm",
        contents: pageBills.map((b, idx) => {
          const grossAmt = getBillFlexGrossAmount(b) || Number(b.amount || 0);
          const dInfo = resolveBillDeductionInfo(b);
          const rawNet = Number((b as any)["ยอดโอน"] || (b as any).net_amount || (b as any).data?.["ยอดโอน"] || (b as any).data?.net_amount || 0);
          const netTransferAmt = dInfo.hasDeduct
            ? (dInfo.deductAmt > 0 ? grossAmt - dInfo.deductAmt : (rawNet > 0 ? rawNet : grossAmt))
            : (rawNet > 0 && rawNet !== grossAmt ? rawNet : grossAmt);
          const amt = grossAmt.toLocaleString("th-TH");
          const netAmtStr = netTransferAmt.toLocaleString("th-TH");
          const billId = String(b.id || b.bill_no || startNum + idx);
          const rawReq = b.requester || b.vendor_or_person || "-";
          const bankInfo = resolveBankInfo(b, bankInfoMap);
          const itemIsSub = Boolean(isSub) || isSubBillRecord(b);
          const requesterName = resolveVendorName(rawReq, bankInfoMap, b, peopleMap) || resolveRequesterNameFromMap(rawReq, peopleMap) || bankInfo?.storeName || bankInfo?.accountName || rawReq;

          // Parse single or multiple images
          let imgList: string[] = [];
          if (Array.isArray(b.image_urls) && b.image_urls.length > 0) {
            imgList = b.image_urls.flatMap(u => String(u || "").split(",")).map(s => s.trim()).filter(s => s.startsWith("http"));
          }
          if (imgList.length === 0 && b.image_url) {
            imgList = String(b.image_url).split(",").map(s => s.trim()).filter(s => s.startsWith("http"));
          }

          const hasImages = imgList.length > 0;

          const rawCarRef = (b as any)["ทะเบียน"] || (b as any).plate_no || (b as any)["id_car"] || (b as any).id_car;
          const carPlate = resolveCarDisplayName(rawCarRef, carsMap);

          const rawStaffRef = (b as any)["ชื่อพนักงาน"] || (b as any).staff_name || (b as any)["รหัสพนักงาน"];
          const staffName = resolveStaffDisplayName(rawStaffRef, peopleMap);

          const rawVendorType = String((b as any)["ร้านค้า/ผู้รับเหมา"] || (b as any).vendor_type || "").trim();
          const rawCatName = String((b as any)["ประเภท"] || (b as any).category || "").trim();
          const isContractor = rawVendorType === "ผู้รับเหมา" || Boolean((b as any)["ผู้รับเหมา"]) || Boolean((b as any).contractor_id) || rawCatName.includes("ค่าแรง") || rawCatName.startsWith("2.");

          const rawDesc = b.description || (b as any)["รายละเอียดงาน"] || (b as any).data?.["รายละเอียดงาน"] || (b as any)["สินค้า/ทำงาน"] || (b as any)["รายละเอียด"] || "-";
          const cleanDesc = sanitizeFlexItemDescription(rawDesc, carsMap, peopleMap);

          const lineItems = extractBillLineItems(b);

          const textDetailsBox = {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: `#${billId}${b.bill_type ? ` [บิล${b.bill_type}]` : ""} | ${b.project_name || "โครงการทั่วไป"}`, weight: "bold", size: "xs", color: "#0F172A", flex: 7, wrap: true },
                  {
                    type: "box",
                    layout: "vertical",
                    flex: 4,
                    spacing: "none",
                    contents: [
                      { type: "text", text: `฿${dInfo.hasDeduct && dInfo.deductAmt > 0 ? netAmtStr : amt}`, weight: "bold", size: "xs", color: dInfo.hasDeduct ? "#DC2626" : "#059669", align: "end" },
                      ...(dInfo.hasDeduct && dInfo.deductAmt > 0 ? [
                        { type: "text", text: `(หัก ${dInfo.deductPercent || 3}% -฿${dInfo.deductAmt.toLocaleString("th-TH")})`, size: "xxs", color: "#D97706", align: "end", weight: "bold" }
                      ] : [])
                    ]
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: itemIsSub ? "ร้านค้า/บิล:" : (isContractor ? "ผู้รับเหมา:" : "ผู้เบิก/ร้าน:"), size: "xxs", color: "#64748B", flex: 3 },
                  { type: "text", text: requesterName, size: "xxs", color: "#1E293B", flex: 7, wrap: true }
                ]
              },
              ...(() => {
                const dueDate = (b as any)["วันจ่าย"] || (b as any).due_date || (b as any).data?.["วันจ่าย"] || (b as any).data?.due_date;
                const creditVal = (b as any)["เครดิต"] || (b as any).credit || (b as any).data?.["เครดิต"] || (b as any).data?.credit || (b as any)["เครดิตจ่าย"] || (b as any).credit_payment_day;
                if (!dueDate) return [];
                return [
                  {
                    type: "box",
                    layout: "baseline",
                    margin: "xs",
                    contents: [
                      { type: "text", text: "กำหนดชำระ:", size: "xxs", color: "#64748B", flex: 3 },
                      {
                        type: "text",
                        text: `${dueDate}${creditVal ? ` (เครดิต ${creditVal})` : ""}`,
                        size: "xxs",
                        color: "#0284C7",
                        weight: "bold",
                        flex: 7,
                        wrap: true
                      }
                    ]
                  }
                ];
              })(),
              // Bank Account Information Box
              ...(itemIsSub ? (() => {
                const reqBank = resolveRequesterBankInfo(b, bankInfoMap, peopleMap);
                return [
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xs",
                    paddingAll: "4px",
                    backgroundColor: "#FFFBEB",
                    cornerRadius: "4px",
                    borderWidth: "1px",
                    borderColor: "#FDE68A",
                    spacing: "xs",
                    contents: [
                      {
                        type: "box",
                        layout: "baseline",
                        contents: [
                          { type: "text", text: "ผู้เบิก:", size: "xxs", color: "#92400E", flex: 3 },
                          { type: "text", text: reqBank.accountName || reqBank.requesterName || requesterName, size: "xxs", color: "#78350F", weight: "bold", flex: 7, wrap: true }
                        ]
                      },
                      {
                        type: "box",
                        layout: "baseline",
                        contents: [
                          { type: "text", text: "ธนาคาร:", size: "xxs", color: "#92400E", flex: 3 },
                          { type: "text", text: reqBank.bankName || "-", size: "xxs", color: reqBank.bankName ? "#78350F" : "#94A3B8", weight: "bold", flex: 7, wrap: true }
                        ]
                      },
                      {
                        type: "box",
                        layout: "baseline",
                        contents: [
                          { type: "text", text: "เลขบัญชี:", size: "xxs", color: "#92400E", flex: 3 },
                          {
                            type: "text",
                            text: reqBank.accountNo || "ไม่มีเลขบัญชี",
                            size: "xxs",
                            color: reqBank.accountNo ? "#047857" : "#DC2626",
                            weight: "bold",
                            flex: 7,
                            wrap: true
                          }
                        ]
                      }
                    ]
                  }
                ];
              })() : (
                bankInfo && (bankInfo.accountNo || bankInfo.bankName || bankInfo.accountName) ? [
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xs",
                    paddingAll: "4px",
                    backgroundColor: "#F8FAFC",
                    cornerRadius: "4px",
                    borderWidth: "1px",
                    borderColor: "#E2E8F0",
                    spacing: "xs",
                    contents: [
                      {
                        type: "box",
                        layout: "baseline",
                        contents: [
                          { type: "text", text: "ธนาคาร:", size: "xxs", color: "#64748B", flex: 3 },
                          { type: "text", text: bankInfo.bankName || "-", size: "xxs", color: bankInfo.bankName ? "#0F172A" : "#94A3B8", weight: "bold", flex: 7, wrap: true }
                        ]
                      },
                      {
                        type: "box",
                        layout: "baseline",
                        contents: [
                          { type: "text", text: "ชื่อบัญชี:", size: "xxs", color: "#64748B", flex: 3 },
                          { type: "text", text: bankInfo.accountName || "-", size: "xxs", color: bankInfo.accountName ? "#0F172A" : "#94A3B8", weight: "bold", flex: 7, wrap: true }
                        ]
                      },
                      {
                        type: "box",
                        layout: "baseline",
                        contents: [
                          { type: "text", text: "เลขบัญชี:", size: "xxs", color: "#64748B", flex: 3 },
                          {
                            type: "text",
                            text: bankInfo.accountNo || "-",
                            size: "xxs",
                            color: bankInfo.accountNo ? "#059669" : "#94A3B8",
                            weight: "bold",
                            flex: 7,
                            wrap: true
                          }
                        ]
                      }
                    ]
                  }
                ] : [
                  {
                    type: "box",
                    layout: "baseline",
                    margin: "xs",
                    contents: [
                      { type: "text", text: "ธนาคาร:", size: "xxs", color: "#64748B", flex: 3 },
                      { type: "text", text: "-", size: "xxs", color: "#94A3B8", flex: 7 }
                    ]
                  }
                ]
              )),
              ...(carPlate ? [
                {
                  type: "box",
                  layout: "baseline",
                  margin: "xs",
                  contents: [
                    { type: "text", text: "ทะเบียนรถ:", size: "xxs", color: "#64748B", flex: 3 },
                    { type: "text", text: carPlate, size: "xxs", color: "#0F172A", weight: "bold", flex: 7, wrap: true }
                  ]
                }
              ] : []),
              ...(staffName && String((b as any)["ประเภท"] || "").includes("พนักงาน") ? [
                {
                  type: "box",
                  layout: "baseline",
                  margin: "xs",
                  contents: [
                    { type: "text", text: "ชื่อพนักงาน:", size: "xxs", color: "#64748B", flex: 3 },
                    { type: "text", text: staffName, size: "xxs", color: "#0F172A", weight: "bold", flex: 7, wrap: true }
                  ]
                }
              ] : []),
              ...(lineItems.length === 0 ? [
                {
                  type: "box",
                  layout: "vertical",
                  margin: "xs",
                  paddingAll: "4px",
                  backgroundColor: "#F1F5F9",
                  cornerRadius: "4px",
                  spacing: "xs",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: `• ${cleanDesc && cleanDesc !== "-" ? cleanDesc : (rawCatName || (b as any)["สินค้า"] || (b as any)["ประเภท"] || (isContractor ? "ค่าแรง" : "สินค้า"))}`, size: "xxs", color: "#1E293B", weight: "bold", flex: 7, wrap: true },
                        { type: "text", text: `฿${amt}`, size: "xxs", color: "#059669", weight: "bold", align: "end", flex: 3 }
                      ]
                    }
                  ]
                }
              ] : []),
              ...(lineItems.length > 0 ? [
                {
                  type: "box",
                  layout: "vertical",
                  margin: "xs",
                  paddingAll: "4px",
                  backgroundColor: "#F1F5F9",
                  cornerRadius: "4px",
                  spacing: "xs",
                  contents: [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        { type: "text", text: isContractor ? `👷‍♂️ ค่าแรง (${lineItems.length} รายการ):` : `📦 สินค้า (${lineItems.length} รายการ):`, size: "xxs", weight: "bold", color: "#0F172A", flex: 7 },
                        { type: "text", text: "ราคา", size: "xxs", weight: "bold", color: "#64748B", flex: 3, align: "end" }
                      ]
                    },
                    ...lineItems.map((item, iIdx) => {
                      const itemAmt = Number(item.amount ?? item.price ?? item.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      const rawCat = String(item.category || "").trim();
                      const rawName = String(item.name || "").trim();
                      const rawDetail = String(item.detail || "").trim();
                      const cleanCat = rawCat.replace(/^\d+\.?\s*\d*\.?\s*/, "").trim();
                      const cleanName = rawName.replace(/^\d+\.?\s*\d*\.?\s*/, "").trim();

                      let itemTitle = "";
                      if (isContractor) {
                        const catDisplay = rawCat || cleanCat || "ค่าแรง";
                        if (rawDetail && !catDisplay.includes(rawDetail)) {
                          itemTitle = `${catDisplay} - ${rawDetail}`;
                        } else {
                          itemTitle = catDisplay;
                        }
                      } else {
                        if (cleanCat && cleanName && cleanCat !== cleanName) {
                          itemTitle = `${cleanCat} ${cleanName}`;
                        } else {
                          itemTitle = cleanName || cleanCat || `สินค้า ${iIdx + 1}`;
                        }
                        if (rawDetail && !itemTitle.includes(rawDetail)) {
                          itemTitle = `${itemTitle} (${rawDetail})`;
                        }
                      }

                      const rawType = String(item.categoryType || item.type || "").trim();
                      const cleanType = rawType.replace(/^\d+\.?\s*/, "").trim();
                      const rawSub = String(item.subItem || "").trim();
                      const tagText = rawSub ? (cleanType && !isContractor ? `${cleanType} • ${rawSub}` : rawSub) : (cleanType && !isContractor ? cleanType : "");

                      return {
                        type: "box",
                        layout: "vertical",
                        margin: iIdx > 0 ? "xs" : "none",
                        spacing: "none",
                        contents: [
                          {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                              {
                                type: "text",
                                text: `${iIdx + 1}. ${itemTitle}`,
                                size: "xxs",
                                color: "#1E293B",
                                weight: "bold",
                                flex: 7,
                                wrap: true
                              },
                              {
                                type: "text",
                                text: `฿${itemAmt}`,
                                size: "xxs",
                                color: "#059669",
                                weight: "bold",
                                align: "end",
                                flex: 3
                              }
                            ]
                          },
                          ...(tagText ? [
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                {
                                  type: "text",
                                  text: `   (${tagText})`,
                                  size: "xxs",
                                  color: "#0284C7",
                                  wrap: true
                                }
                              ]
                            }
                          ] : [])
                        ]
                      };
                    })
                  ]
                }
              ] : []),
              {
                type: "box",
                layout: "horizontal",
                margin: "xs",
                contents: [
                  { type: "text", text: `สถานะ: ${b.status || "รออนุมัติ"}`, size: "xxs", color: b.status === "อนุมัติแล้ว" || b.status === "เบิกแล้ว" ? "#059669" : "#D97706", weight: "bold", flex: 5 },
                  {
                    type: "text",
                    text: "[อนุมัติ]",
                    size: "xxs",
                    color: "#2563EB",
                    align: "end",
                    weight: "bold",
                    flex: 3,
                    action: {
                      type: "message",
                      label: "อนุมัติ",
                      text: isSub ? `อนุมัติเงินสดบิลย่อยลำดับที่: ${billId}` : `อนุมัติบิลหลักลำดับที่: ${billId}`
                    }
                  },
                  {
                    type: "text",
                    text: "[ปิดงาน]",
                    size: "xxs",
                    color: "#DC2626",
                    align: "end",
                    weight: "bold",
                    flex: 2,
                    action: {
                      type: "message",
                      label: "ปิดงาน",
                      text: isSub ? `ปิดงานเงินสดบิลย่อยลำดับที่: ${billId}` : `ปิดงานบิลหลักลำดับที่: ${billId}`
                    }
                  }
                ]
              }
            ]
          };

          if (hasImages) {
            const displayedImgs = imgList.slice(0, 4);
            const imgColumns: any[] = displayedImgs.map((imgUrl, imgIdx) => ({
              type: "image",
              url: imgUrl,
              aspectRatio: "1:1",
              aspectMode: "cover",
              flex: 1,
              action: {
                type: "uri",
                label: `รูปที่ ${imgIdx + 1}`,
                uri: normalizeUri(imgUrl)
              }
            }));

            // Always pad up to 4 columns using filler components so each column slot takes exactly 25% width
            while (imgColumns.length < 4) {
              imgColumns.push({
                type: "filler"
              });
            }

            const multiImgRow = {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              spacing: "xs",
              contents: imgColumns
            };

            return {
              type: "box",
              layout: "vertical",
              margin: "xs",
              paddingAll: "8px",
              backgroundColor: "#F8FAFC",
              cornerRadius: "6px",
              contents: [
                textDetailsBox,
                {
                  type: "box",
                  layout: "horizontal",
                  margin: "xs",
                  contents: [
                    { type: "text", text: `รูปแนบใบเสร็จ (${imgList.length} รูป - แตะรูปเพื่อดูภาพเต็ม):`, size: "xxs", color: "#475569", weight: "bold" }
                  ]
                },
                multiImgRow
              ]
            };
          }

          return {
            type: "box",
            layout: "vertical",
            margin: "xs",
            paddingAll: "8px",
            backgroundColor: "#F8FAFC",
            cornerRadius: "6px",
            contents: [textDetailsBox]
          };
        })
      },
      footer: count > 0 && batchParam ? {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "10px",
        backgroundColor: "#F1F5F9",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#059669",
            height: "sm",
            flex: 6,
            action: {
              type: "message",
              label: `อนุมัติทั้งหมด (${count})`,
              text: `อนุมัติทั้งหมด:${batchParam}`
            }
          },
          {
            type: "button",
            style: "primary",
            color: "#DC2626",
            height: "sm",
            flex: 6,
            action: {
              type: "message",
              label: `ปิดงานทั้งหมด (${count})`,
              text: `ปิดงานทั้งหมด:${batchParam}`
            }
          }
        ]
      } : undefined
    };
  }

  const bubbles: any[] = [];
  for (let i = 0; i < totalPages; i++) {
    const chunk = displayBills.slice(i * pageSize, (i + 1) * pageSize);
    bubbles.push(buildBubblePage(chunk, i));
  }

  if (bubbles.length === 1) {
    return bubbles[0];
  }

  return {
    type: "carousel",
    contents: bubbles
  };
}

export function createWorkAssignmentFlex(work: {
  id?: string | number;
  title?: string;
  project_name?: string;
  contractor_name?: string;
  amount?: number;
  details?: string;
  contact?: string;
  phone?: string;
}): Record<string, any> {
  const formattedAmount = Number(work.amount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E1B4B",
      paddingAll: "15px",
      contents: [
        {
          type: "text",
          text: "👷‍♂️ รายการมอบหมายงาน (PW)",
          weight: "bold",
          color: "#FFFFFF",
          size: "md",
        },
        {
          type: "text",
          text: `รหัสงาน: ${work.id || "-"}`,
          color: "#A5B4FC",
          size: "xs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                { type: "text", text: "โครงการ:", color: "#64748B", size: "xs", flex: 2 },
                { type: "text", text: work.project_name || "-", weight: "bold", color: "#1E293B", size: "xs", flex: 5, wrap: true },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                { type: "text", text: "ผู้รับเหมา:", color: "#64748B", size: "xs", flex: 2 },
                { type: "text", text: work.contractor_name || "-", color: "#1E293B", size: "xs", flex: 5, wrap: true },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                { type: "text", text: "รายละเอียด:", color: "#64748B", size: "xs", flex: 2 },
                { type: "text", text: work.details || "-", color: "#1E293B", size: "xs", flex: 5, wrap: true },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                { type: "text", text: "ติดต่อ:", color: "#64748B", size: "xs", flex: 2 },
                { type: "text", text: `${work.contact || "-"} (${work.phone || "-"})`, color: "#1E293B", size: "xs", flex: 5, wrap: true },
              ],
            },
          ],
        },
        { type: "separator" },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "ยอดเงินว่าจ้าง", weight: "bold", color: "#0F172A", size: "sm" },
            { type: "text", text: `฿${formattedAmount}`, weight: "bold", color: "#4F46E5", size: "lg", align: "end" },
          ],
        },
      ],
    },
  };
}

export function createTaskSummaryFlex(tasks: Array<{ id: any; details: string; status: string; project: string }>): Record<string, any> {
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#065F46",
      paddingAll: "15px",
      contents: [
        {
          type: "text",
          text: "🎯 สรุปงานค้างที่ต้องดำเนินการ",
          weight: "bold",
          color: "#FFFFFF",
          size: "md",
        },
        {
          type: "text",
          text: `ทั้งหมด ${tasks.length} รายการ`,
          color: "#A7F3D0",
          size: "xs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "sm",
      contents: tasks.slice(0, 5).map((t, idx) => ({
        type: "box",
        layout: "vertical",
        margin: idx > 0 ? "sm" : "none",
        contents: [
          {
            type: "text",
            text: `${idx + 1}. [${t.project || "งานทั่วไป"}] ${t.details}`,
            size: "xs",
            weight: "bold",
            color: "#1E293B",
            wrap: true,
          },
          {
            type: "text",
            text: `สถานะ: ${t.status || "กำลังทำ"}`,
            size: "xxs",
            color: "#059669",
          },
        ],
      })),
    },
  };
}

export function createMemberTaskTableFlex(
  memberName: string,
  tasks: Array<{ id: any; details: string; dateStr?: string; days?: number; status?: string; task_type?: number | string; sendDateStr?: string }>
): Record<string, any> {
  const planTasks = tasks;
  const docCount = tasks.filter(t => Number(t.task_type) === 1 || String(t.task_type).includes("เอกสาร")).length;
  const planCount = tasks.filter(t => Number(t.task_type) === 2 || String(t.task_type).includes("แผนงาน")).length;
  const pjsaCount = tasks.filter(t => Number(t.task_type) === 3 || String(t.task_type).includes("PJSA")).length;

  const todayDateStr = new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const todayDate = new Date();
  const currentMonth = todayDate.getMonth() + 1;
  const d0 = todayDate.getDate();
  const d_minus_1 = new Date(todayDate.getTime() - 86400000).getDate();
  const d_plus_1 = new Date(todayDate.getTime() + 86400000).getDate();
  const d_plus_2 = new Date(todayDate.getTime() + 2 * 86400000).getDate();

  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E293B",
      paddingAll: "15px",
      contents: [
        {
          type: "text",
          text: `งานทั้งหมด : ${memberName} (${tasks.length} รายการ)`,
          weight: "bold",
          color: "#FFFFFF",
          size: "md",
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          contents: [
            { type: "text", text: `เอกสาร ${docCount} งาน`, color: docCount > 0 ? "#38BDF8" : "#94A3B8", size: "xs", weight: "bold" },
            { type: "text", text: `แผนงาน ${planCount} งาน`, color: planCount > 0 ? "#F97316" : "#94A3B8", size: "xs", weight: "bold", align: "center" },
            { type: "text", text: `PJSA ${pjsaCount} งาน`, color: pjsaCount > 0 ? "#A7F3D0" : "#94A3B8", size: "xs", weight: "bold", align: "end" },
          ],
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      spacing: "sm",
      contents: [
        // Category Banner
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F97316",
          paddingAll: "6px",
          cornerRadius: "4px",
          contents: [
            { type: "text", text: `📋 รายการงาน (${tasks.length} งาน) | ไทม์ไลน์ 4 วัน - เดือน ${currentMonth}`, color: "#FFFFFF", weight: "bold", size: "xs" }
          ]
        },
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
            { type: "text", text: "num", size: "xxs", weight: "bold", color: "#6B7280", flex: 1, align: "center" },
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
                    { type: "text", text: `${d_minus_1}`, size: "xxs", align: "center", flex: 1, color: "#6B7280" },
                    { type: "separator", color: "#EF4444" },
                    { type: "text", text: `${d0}`, size: "xxs", align: "center", flex: 1, color: "#EF4444", weight: "bold" },
                    { type: "separator", color: "#EF4444" },
                    { type: "text", text: `${d_plus_1}`, size: "xxs", align: "center", flex: 1, color: "#6B7280" },
                    { type: "separator" },
                    { type: "text", text: `${d_plus_2}`, size: "xxs", align: "center", flex: 1, color: "#6B7280" }
                  ]
                }
              ]
            },
            { type: "separator" },
            { type: "text", text: "สถานะ", size: "xxs", weight: "bold", color: "#6B7280", flex: 2, align: "end" }
          ]
        },
        { type: "separator", margin: "xs" },
        // Table Task Items
        ...planTasks.slice(0, 10).map((t, index) => {
          const taskIdStr = String(t.id || index + 100);
          const displayDate = t.sendDateStr && t.sendDateStr !== "-" ? `${t.dateStr || todayDateStr}\n${t.sendDateStr}` : (t.dateStr || todayDateStr);
          return {
            type: "box",
            layout: "vertical",
            margin: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "xs",
                contents: [
                  {
                    type: "text",
                    text: `[#${taskIdStr}] ${t.details}`,
                    size: "xs",
                    color: "#1F2937",
                    flex: 6,
                    wrap: true,
                    weight: "bold"
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
                    text: "1",
                    size: "xs",
                    color: "#374151",
                    flex: 1,
                    align: "center"
                  },
                  { type: "separator" },
                  // 4-Day Timeline Grid with Red Today Column Border Line
                  {
                    type: "box",
                    layout: "horizontal",
                    flex: 5,
                    contents: [
                      { type: "text", text: index % 3 === 0 ? "🟦" : "⬜", size: "xxs", align: "center", flex: 1 },
                      { type: "separator", color: "#EF4444" },
                      { type: "text", text: "🟦", size: "xxs", align: "center", flex: 1, color: "#EF4444" },
                      { type: "separator", color: "#EF4444" },
                      { type: "text", text: index % 2 === 0 ? "🟦" : "⬜", size: "xxs", align: "center", flex: 1 },
                      { type: "separator" },
                      { type: "text", text: "⬜", size: "xxs", align: "center", flex: 1 }
                    ]
                  },
                  { type: "separator" },
                  {
                    type: "text",
                    text: t.status === "เสร็จ" || t.status === "สำเร็จ" ? "✅" : "Close",
                    size: "xs",
                    color: t.status === "เสร็จ" || t.status === "สำเร็จ" ? "#16A34A" : "#DC2626",
                    flex: 2,
                    align: "end",
                    weight: "bold",
                    action: {
                      type: "message",
                      label: "Close",
                      text: `ปิดงาน: ${taskIdStr}`
                    }
                  }
                ]
              },
              { type: "separator", margin: "xs" }
            ]
          };
        })
      ]
    },
  };
}

function normalizeUri(uri?: string): string {
  let str = (uri || "").trim();
  if (!str) return "https://coscosesuperbase.vercel.app";
  if (!str.startsWith("http://") && !str.startsWith("https://")) {
    str = `https://${str}`;
  }
  return str;
}

export async function getLineUserIdByRequester(requesterKey: string): Promise<string> {
  if (!requesterKey) return "";
  try {
    const rawStr = String(requesterKey).trim();
    if (rawStr.startsWith("U") && rawStr.length === 33) {
      return rawStr;
    }

    const trimmed = rawStr.toLowerCase();
    const normalized = trimmed.replace(/['"`\s\-_()]/g, "");

    // Extract sub-tokens from strings like "PE101 - สมชาย" or "สมชาย (PE101)"
    const tokens = rawStr
      .split(/[-–—()\s]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    // 1. Query users_list in system_options (Primary source from User Management)
    const { data: usersRow } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "users_list")
      .maybeSingle();

    const usersList: any[] = (usersRow?.data && Array.isArray(usersRow.data)) ? usersRow.data : [];

    if (usersList.length > 0) {
      const match = usersList.find((u: any) => {
        const dName = String(u.displayName || u.name || "").trim().toLowerCase();
        const normDName = dName.replace(/['"`\s\-_()]/g, "");
        const uName = String(u.username || "").trim().toLowerCase();
        const normUName = uName.replace(/['"`\s\-_()]/g, "");
        const uId = String(u.id || "").trim().toLowerCase();
        const normUId = uId.replace(/['"`\s\-_()]/g, "");
        const empId = String(u.employeeId || u["รหัสพนักงาน"] || "").trim().toLowerCase();
        const normEmpId = empId.replace(/['"`\s\-_()]/g, "");
        const nickname = String(u.nickname || u["ชื่อเล่น"] || "").trim().toLowerCase();
        const normNick = nickname.replace(/['"`\s\-_()]/g, "");
        const phone = String(u.phone || "").replace(/[^0-9]/g, "");
        const cleanReq = trimmed.replace(/[^0-9]/g, "");

        const tokenMatch = tokens.some(tok => {
          const normTok = tok.replace(/['"`\s\-_()]/g, "");
          return (
            tok === dName ||
            tok === uName ||
            tok === uId ||
            tok === empId ||
            tok === nickname ||
            (normTok && normTok === normNick) ||
            (normTok && normTok === normDName) ||
            (normTok && normTok === normEmpId)
          );
        });

        return (
          tokenMatch ||
          dName === trimmed ||
          normDName === normalized ||
          uName === trimmed ||
          normUName === normalized ||
          uId === trimmed ||
          normUId === normalized ||
          empId === trimmed ||
          normEmpId === normalized ||
          nickname === trimmed ||
          normNick === normalized ||
          (cleanReq && phone && phone === cleanReq) ||
          dName.includes(trimmed) ||
          trimmed.includes(dName) ||
          (normDName && normalized && (normDName.includes(normalized) || normalized.includes(normDName))) ||
          (normNick && normalized && (normNick.includes(normalized) || normalized.includes(normNick)))
        );
      });

      const lineId = String(match?.lineUserId || match?.line_user_id || "").trim();
      if (lineId) return lineId;
    }

    // 2. Query master_members
    const { data: members } = await supabaseAdmin
      .from("master_members")
      .select("*");
    
    if (members && members.length > 0) {
      const match = members.find(m => {
        const d = (m.data && typeof m.data === "object") ? m.data : {};
        const id = String(m.id || m.id_member || d.id || "").trim().toLowerCase();
        const normId = id.replace(/['"`\s\-_()]/g, "");
        const empId = String(m["รหัสพนักงาน"] || d["รหัสพนักงาน"] || m.employee_id || "").trim().toLowerCase();
        const normEmpId = empId.replace(/['"`\s\-_()]/g, "");
        const nickname = String(m["ชื่อเล่น"] || m.nickname || d["ชื่อเล่น"] || d.nickname || "").trim().toLowerCase();
        const normNick = nickname.replace(/['"`\s\-_()]/g, "");
        const fullname = String(m["ชื่อ-นามสกุล"] || m.full_name || d["ชื่อ-นามสกุล"] || d.full_name || "").trim().toLowerCase();
        const normFull = fullname.replace(/['"`\s\-_()]/g, "");
        const name = String(m.name || d.name || "").trim().toLowerCase();

        const tokenMatch = tokens.some(tok => {
          const normTok = tok.replace(/['"`\s\-_()]/g, "");
          return (
            tok === id ||
            tok === empId ||
            tok === nickname ||
            tok === fullname ||
            tok === name ||
            (normTok && normTok === normNick) ||
            (normTok && normTok === normEmpId)
          );
        });

        return (
          tokenMatch ||
          id === trimmed ||
          normId === normalized ||
          empId === trimmed ||
          normEmpId === normalized ||
          nickname === trimmed ||
          normNick === normalized ||
          (normalized === "jame" && normNick === "เจมส์") ||
          (normalized === "james" && normNick === "เจมส์") ||
          fullname === trimmed ||
          name === trimmed ||
          fullname.includes(trimmed) ||
          trimmed.includes(nickname) ||
          (normFull && normalized && (normFull.includes(normalized) || normalized.includes(normFull)))
        );
      });

      if (match) {
        const d = (match.data && typeof match.data === "object") ? match.data : {};
        const memberLineId = String(
          match.line_user_id ||
          match["LINE User ID"] ||
          d.line_user_id ||
          d.lineUserId ||
          d["LINE User ID"] ||
          ""
        ).trim();

        if (memberLineId) return memberLineId;

        // Cross-reference matched member with usersList by member ID / empId
        const matchedMemberId = String(match.id || match["รหัสพนักงาน"] || d["รหัสพนักงาน"] || "").trim().toLowerCase();
        if (matchedMemberId && usersList.length > 0) {
          const linkedUser = usersList.find(u => {
            const uId = String(u.id || "").trim().toLowerCase();
            const uName = String(u.username || "").trim().toLowerCase();
            const uEmp = String(u.employeeId || "").trim().toLowerCase();
            return uId === matchedMemberId || uName === matchedMemberId || uEmp === matchedMemberId;
          });
          if (linkedUser?.lineUserId) return String(linkedUser.lineUserId).trim();
        }
      }
    }

    // 3. Query users table
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("*");
    if (users && users.length > 0) {
      const match = users.find(u => {
        const id = String(u.id || "").trim().toLowerCase();
        const username = String(u.username || "").trim().toLowerCase();
        const name = String(u.name || "").trim().toLowerCase();
        const nickname = String(u.nickname || "").trim().toLowerCase();

        return (
          id === trimmed ||
          username === trimmed ||
          name === trimmed ||
          nickname === trimmed
        );
      });
      if (match?.line_user_id) return String(match.line_user_id).trim();
    }
  } catch (e) {
    console.warn("⚠️ Failed resolving requester LINE user ID:", e);
  }
  return "";
}

export async function getLineTargetIds(): Promise<{
  ownerId: string;
  approverIds: string[];
  closerIds: string[];
  financeIds: string[];
}> {
  return cached("line:target_ids", 2_000, async () => {
    try {
      let ownerId = "";
      const approverSet = new Set<string>();
      const financeSet = new Set<string>();

      // 1. Primary Source: master_members table
      const { data: members } = await supabaseAdmin.from("master_members").select("*");

      if (members && Array.isArray(members)) {
        for (const m of members) {
          if (m.status === "Inactive") continue;
          const lineId = String(m.line_user_id || m["LINE User ID"] || m.data?.line_user_id || m.data?.["LINE User ID"] || "").trim();
          if (!lineId || lineId === "-") continue;

          const d = (m.data && typeof m.data === "object") ? m.data : {};
          const permStr = String(m["สิทธิ์การใช้งาน"] || d["สิทธิ์การใช้งาน"] || "");

          // 1. เจ้าของระบบ (Owner)
          const isOwner = (m.is_owner !== undefined && m.is_owner !== null)
            ? Boolean(m.is_owner)
            : Boolean(
                d.is_owner || d["เจ้าของระบบ"] || m["เจ้าของระบบ"] ||
                m.role === "Owner" || m.system_role === "Owner" ||
                permStr.includes("Owner") || permStr.includes("เจ้าของระบบ")
              );
          if (isOwner) {
            if (!ownerId) ownerId = lineId;
          }

          // 2. ผู้อนุมัติบิล (Approver - ตรวจสอบและกดอนุมัติบิล)
          const isApprover = (m.can_close_bill !== undefined && m.can_close_bill !== null)
            ? Boolean(m.can_close_bill)
            : Boolean(
                d.can_close_bill || d["อนุมัติบิล"] || m["อนุมัติบิล"] ||
                m.system_role === "Admin_Approver" ||
                permStr.includes("Approver") || permStr.includes("อนุมัติบิล")
              );
          if (isApprover) {
            approverSet.add(lineId);
          }

          // 3. ฝ่ายการเงิน (Finance / Closer - ตรวจสอบจ่ายเงินและกดปิดงาน)
          const isFinance = (m.can_approve !== undefined && m.can_approve !== null)
            ? Boolean(m.can_approve)
            : Boolean(
                d.can_approve || d["ฝ่ายการเงิน"] || m["ฝ่ายการเงิน"] ||
                m.system_role === "Admin_Closer" ||
                permStr.includes("Finance") || permStr.includes("ฝ่ายการเงิน") || permStr.includes("ปิดบิล")
              );
          if (isFinance) {
            financeSet.add(lineId);
          }
        }
      }

      // 2. Fallback to line_config in system_options only when no members are assigned
      const { data: configRow } = await supabaseAdmin
        .from("system_options")
        .select("data")
        .eq("id", "line_config")
        .maybeSingle();

      const cfg = configRow?.data || {};
      if (!ownerId) {
        ownerId = String(cfg.LINE_USER_ID_OWN || process.env.LINE_USER_ID_OWN || LINE_CONFIG.USER_ID_OWN || "").trim();
      }

      if (approverSet.size === 0) {
        const rawApprovers = String(cfg.LINE_USER_ID_APPROVER || process.env.LINE_USER_ID_APPROVER || LINE_CONFIG.USER_ID_APPROVER || "").trim();
        if (rawApprovers) {
          rawApprovers.split(",").forEach(id => {
            const clean = id.trim();
            if (clean) approverSet.add(clean);
          });
        }
      }

      if (financeSet.size === 0) {
        const rawClosers = String(cfg.LINE_USER_ID_CLOSER || cfg.LINE_USER_ID_FINANCE || process.env.LINE_USER_ID_CLOSER || "").trim();
        if (rawClosers) {
          rawClosers.split(",").forEach(id => {
            const clean = id.trim();
            if (clean) financeSet.add(clean);
          });
        }
      }

      // เจ้าของระบบ (Owner) มีสิทธิ์แค่รับแจ้งเตือนประจำวันเท่านั้น (ตัดออกจาก approverSet และ financeSet)
      const approverIds = Array.from(approverSet);
      const closerIds = Array.from(financeSet);
      return { ownerId, approverIds, closerIds, financeIds: closerIds };
    } catch (e) {
      console.error("Failed fetching LINE target IDs:", e);
      return { ownerId: "", approverIds: [], closerIds: [], financeIds: [] };
    }
  });
}

export const getLineConfigIds = getLineTargetIds;

export type MultiBillFlexOptions = {
  title: string;
  headerBgColor?: string;
  badgeText?: string;
  themeColor?: string;
  mode?: "requester" | "owner" | "approver" | "search" | "completed";
};

let cachedPeopleMap: Map<string, string> | null = null;
let cachedPeopleMapTime = 0;
const CACHE_TTL_MS = 60_000;

export async function getPeopleMap(forceRefresh = false): Promise<Map<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedPeopleMap && (now - cachedPeopleMapTime < CACHE_TTL_MS)) {
    return cachedPeopleMap;
  }

  const peopleMap = new Map<string, string>();
  try {
    const [membersRes, usersRes, storesRes, contractorsRes, sysUsersRes] = await Promise.all([
      supabaseAdmin.from("master_members").select("*"),
      supabaseAdmin.from("users").select("*"),
      supabaseAdmin.from("stores").select("*"),
      supabaseAdmin.from("contractors").select("*"),
      supabaseAdmin.from("system_options").select("data").eq("id", "users_list").maybeSingle(),
    ]);

    const members = membersRes.data;
    if (members && members.length > 0) {
      for (const m of members) {
        const dataObj = (m.data && typeof m.data === "object") ? m.data : {};
        const empId = String(m.id || m["รหัสพนักงาน"] || dataObj.id || dataObj["รหัสพนักงาน"] || "").trim();
        const nickname = String(m.nickname || m["ชื่อเล่น"] || dataObj.nickname || dataObj["ชื่อเล่น"] || "").trim();
        const fullName = String(m.full_name || m["ชื่อ-นามสกุล"] || m.name || dataObj.full_name || dataObj["ชื่อ-นามสกุล"] || dataObj.name || "").trim();
        const empName = nickname || fullName;

        if (empName) {
          if (empId) {
            peopleMap.set(empId, empName);
            peopleMap.set(empId.toLowerCase(), empName);
            peopleMap.set(empId.toUpperCase(), empName);
            const cleanId = empId.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
            if (cleanId) {
              peopleMap.set(cleanId, empName);
              peopleMap.set(`pt${cleanId}`, empName);
              peopleMap.set(`PT${cleanId}`, empName);
              peopleMap.set(`pe${cleanId}`, empName);
              peopleMap.set(`PE${cleanId}`, empName);
            }
          }
          const lineUserId = String(m.line_user_id || m["LINE User ID"] || dataObj.line_user_id || dataObj["LINE User ID"] || "").trim();
          if (lineUserId) {
            peopleMap.set(lineUserId, empName);
          }
          if (nickname) {
            peopleMap.set(nickname, empName);
            peopleMap.set(nickname.toLowerCase(), empName);
          }
          if (fullName) {
            peopleMap.set(fullName, empName);
            peopleMap.set(fullName.toLowerCase(), empName);
          }
          const phone = String(m.phone || m["เบอร์โทร"] || m["เบอร์โทรศัพท์"] || dataObj.phone || dataObj["เบอร์โทร"] || "").trim();
          if (phone) peopleMap.set(phone, empName);
        }
      }
    }

    const users = usersRes.data;
    if (users && users.length > 0) {
      for (const u of users) {
        const dataObj = (u.data && typeof u.data === "object") ? u.data : {};
        const empId = String(u.id || u.employee_id || u.username || dataObj.id || dataObj.employee_id || "").trim();
        const nickname = String(u.nickname || dataObj.nickname || "").trim();
        const name = String(u.name || dataObj.name || "").trim();
        const empName = nickname || name || u.username;

        if (empName) {
          if (empId) {
            if (!peopleMap.has(empId)) peopleMap.set(empId, empName);
            if (!peopleMap.has(empId.toLowerCase())) peopleMap.set(empId.toLowerCase(), empName);
            if (!peopleMap.has(empId.toUpperCase())) peopleMap.set(empId.toUpperCase(), empName);
            const cleanId = empId.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
            if (cleanId) {
              if (!peopleMap.has(cleanId)) peopleMap.set(cleanId, empName);
              if (!peopleMap.has(`pt${cleanId}`)) peopleMap.set(`pt${cleanId}`, empName);
              if (!peopleMap.has(`PT${cleanId}`)) peopleMap.set(`PT${cleanId}`, empName);
              if (!peopleMap.has(`pe${cleanId}`)) peopleMap.set(`pe${cleanId}`, empName);
              if (!peopleMap.has(`PE${cleanId}`)) peopleMap.set(`PE${cleanId}`, empName);
            }
          }
          const lineUserId = String(u.line_user_id || dataObj.line_user_id || "").trim();
          if (lineUserId && !peopleMap.has(lineUserId)) {
            peopleMap.set(lineUserId, empName);
          }
        }
      }
    }

    // Stores (resolve store IDs like ST101 -> store name)
    const stores = storesRes.data;
    if (stores && stores.length > 0) {
      for (const s of stores) {
        const dataObj = (s.data && typeof s.data === "object") ? s.data : {};
        const id = String(s.id || s.id_store || dataObj.id || dataObj.id_store || "").trim();
        const name = String(s.name || s["ชื่อร้านค้า"] || dataObj.name || dataObj["ชื่อร้านค้า"] || "").trim();
        const fullName = String(s.full_name || s["ชื่อเต็ม"] || dataObj.full_name || dataObj["ชื่อเต็ม"] || "").trim();
        const storeName = name || fullName;
        if (storeName && id) {
          peopleMap.set(id, storeName);
          peopleMap.set(id.toLowerCase(), storeName);
          peopleMap.set(id.toUpperCase(), storeName);
          const cleanId = id.toLowerCase().replace(/^(st)[-_]?/i, "").trim();
          if (cleanId) peopleMap.set(cleanId, storeName);
        }
      }
    }

    // Contractors (resolve contractor IDs like CT101 -> contractor nickname/name)
    const contractors = contractorsRes.data;
    if (contractors && contractors.length > 0) {
      for (const c of contractors) {
        const dataObj = (c.data && typeof c.data === "object") ? c.data : {};
        const id = String(c.id || c.id_Contractor || dataObj.id || dataObj.id_Contractor || "").trim();
        const nickname = String(c.nickname || c["ชื่อเล่น"] || dataObj.nickname || dataObj["ชื่อเล่น"] || "").trim();
        const fullName = String(c.full_name || c["ชื่อ-นามสกุล"] || dataObj.full_name || dataObj["ชื่อ-นามสกุล"] || "").trim();
        const conName = nickname || fullName;
        if (conName && id) {
          peopleMap.set(id, conName);
          peopleMap.set(id.toLowerCase(), conName);
          peopleMap.set(id.toUpperCase(), conName);
          const cleanId = id.toLowerCase().replace(/^(ct)[-_]?/i, "").trim();
          if (cleanId) peopleMap.set(cleanId, conName);
        }
      }
    }

    // Users List from system_options (User Management)
    const sysUsersList = Array.isArray(sysUsersRes?.data?.data) ? sysUsersRes.data.data : [];
    if (sysUsersList.length > 0) {
      for (const u of sysUsersList) {
        const empId = String(u.id || u.employeeId || u.username || "").trim();
        const nickname = String(u.nickname || u.displayName || "").trim();
        const name = String(u.name || u.fullName || "").trim();
        const empName = nickname || name || empId;

        if (empName) {
          if (empId) {
            if (!peopleMap.has(empId)) peopleMap.set(empId, empName);
            if (!peopleMap.has(empId.toLowerCase())) peopleMap.set(empId.toLowerCase(), empName);
            if (!peopleMap.has(empId.toUpperCase())) peopleMap.set(empId.toUpperCase(), empName);
            const cleanId = empId.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
            if (cleanId && !peopleMap.has(cleanId)) peopleMap.set(cleanId, empName);
          }
          const lineUserId = String(u.lineUserId || u.line_user_id || "").trim();
          if (lineUserId && !peopleMap.has(lineUserId)) {
            peopleMap.set(lineUserId, empName);
          }
          if (nickname && !peopleMap.has(nickname)) {
            peopleMap.set(nickname, empName);
            peopleMap.set(nickname.toLowerCase(), empName);
          }
          if (name && !peopleMap.has(name)) {
            peopleMap.set(name, empName);
            peopleMap.set(name.toLowerCase(), empName);
          }
        }
      }
    }

    cachedPeopleMap = peopleMap;
    cachedPeopleMapTime = now;
  } catch (e) {
    console.warn("⚠️ Failed to fetch people map for Flex resolution:", e);
  }

  return peopleMap;
}

export type CarLookupInfo = {
  id: string;
  plateNo: string;
  brand: string;
  color: string;
  responsiblePerson: string;
  owner: string;
  displayName: string;
};

let cachedCarsMap: Map<string, CarLookupInfo> | null = null;
let cachedCarsMapTime = 0;

export async function getCarsMap(forceRefresh = false): Promise<Map<string, CarLookupInfo>> {
  const now = Date.now();
  if (!forceRefresh && cachedCarsMap && (now - cachedCarsMapTime < CACHE_TTL_MS)) {
    return cachedCarsMap;
  }

  const carsMap = new Map<string, CarLookupInfo>();
  try {
    const { data: cars } = await supabaseAdmin.from("cars").select("*");
    if (cars && cars.length > 0) {
      for (const c of cars) {
        const dataObj = (c.data && typeof c.data === "object") ? c.data : {};
        const id = String(c.id || c.id_car || c["id_car"] || dataObj.id || dataObj.id_car || "").trim();
        const plateNo = String(c.plate_no || c["หมายเลขทะเบียน"] || c["ทะเบียน"] || dataObj.plate_no || dataObj["หมายเลขทะเบียน"] || "").trim();
        const brand = String(c.brand || c["ยี่ห้อรถ"] || dataObj.brand || dataObj["ยี่ห้อรถ"] || "").trim();
        const color = String(c.color || c["สี"] || dataObj.color || dataObj["สี"] || "").trim();
        const responsiblePerson = String(c.responsible_person || c["รับผิดชอบ"] || dataObj.responsible_person || dataObj["รับผิดชอบ"] || "").trim();
        const owner = String(c.owner || c["รถของ"] || dataObj.owner || dataObj["รถของ"] || "").trim();

        // Build human-friendly displayName (e.g. "1ฒล3982 (Toyota)" or "1ฒล3982")
        let displayName = plateNo;
        if (brand && !displayName.includes(brand)) {
          displayName = displayName ? `${displayName} (${brand})` : brand;
        }
        if (!displayName) displayName = id;

        const info: CarLookupInfo = {
          id,
          plateNo,
          brand,
          color,
          responsiblePerson,
          owner,
          displayName
        };

        if (id) {
          carsMap.set(id, info);
          carsMap.set(id.toLowerCase(), info);
          carsMap.set(id.toUpperCase(), info);
          const cleanId = id.toLowerCase().replace(/^car[-_]?/i, "").trim();
          if (cleanId) {
            carsMap.set(cleanId, info);
            carsMap.set(`car${cleanId}`, info);
            carsMap.set(`Car${cleanId}`, info);
            carsMap.set(`CAR${cleanId}`, info);
          }
        }
        if (plateNo) {
          carsMap.set(plateNo, info);
          carsMap.set(plateNo.toLowerCase(), info);
          carsMap.set(plateNo.replace(/\s+/g, ""), info);
        }
      }
    }
    cachedCarsMap = carsMap;
    cachedCarsMapTime = now;
  } catch (e) {
    console.warn("⚠️ Failed to fetch cars map for Flex resolution:", e);
  }

  return carsMap;
}

export function resolveCarDisplayName(
  rawCar: unknown,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>
): string {
  const raw = String(rawCar || "").trim();
  if (!raw || raw === "-" || raw === "non") return "";

  const map = carsMap || cachedCarsMap || undefined;
  if (map) {
    if (map instanceof Map) {
      if (map.has(raw)) return map.get(raw)!.displayName;
      if (map.has(raw.toLowerCase())) return map.get(raw.toLowerCase())!.displayName;
      if (map.has(raw.toUpperCase())) return map.get(raw.toUpperCase())!.displayName;
      const clean = raw.toLowerCase().replace(/^car[-_]?/i, "").trim();
      if (clean && map.has(clean)) return map.get(clean)!.displayName;
      if (clean && map.has(`car${clean}`)) return map.get(`car${clean}`)!.displayName;
      if (clean && map.has(`Car${clean}`)) return map.get(`Car${clean}`)!.displayName;
      if (clean && map.has(`CAR${clean}`)) return map.get(`CAR${clean}`)!.displayName;
    } else if (typeof map === "object") {
      if (map[raw]) return map[raw].displayName;
      if (map[raw.toLowerCase()]) return map[raw.toLowerCase()].displayName;
      if (map[raw.toUpperCase()]) return map[raw.toUpperCase()].displayName;
    }
  }

  return raw;
}

export function resolveStaffDisplayName(
  rawStaff: unknown,
  peopleMap?: Map<string, string> | Record<string, string>
): string {
  const raw = String(rawStaff || "").trim();
  if (!raw || raw === "-" || raw === "non") return "";
  return resolveRequesterNameFromMap(raw, peopleMap);
}

export function sanitizeFlexItemDescription(
  desc: string,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>,
  peopleMap?: Map<string, string> | Record<string, string>
): string {
  if (!desc || desc === "-") return desc;
  let result = desc;

  const mapC = carsMap || cachedCarsMap || undefined;
  if (mapC && mapC instanceof Map) {
    for (const [key, info] of mapC.entries()) {
      if (key && key.length >= 3 && /^[a-zA-Z0-9\-_]+$/.test(key) && !/^\d+$/.test(key)) {
        const regex = new RegExp(`\\b${key}\\b`, "gi");
        if (regex.test(result)) {
          result = result.replace(regex, info.displayName);
        }
      }
    }
  }

  const mapP = peopleMap || cachedPeopleMap || undefined;
  if (mapP && mapP instanceof Map) {
    for (const [key, name] of mapP.entries()) {
      if (key && key.length >= 3 && /^pt\d+/i.test(key)) {
        const regex = new RegExp(`\\b${key}\\b`, "gi");
        if (regex.test(result)) {
          result = result.replace(regex, name);
        }
      }
    }
  }

  return result;
}

export interface PettyCashLookupInfo {
  total: number;
  cleared: number;
  remaining: number;
  activeCount: number;
  requesterName?: string;
}

let cachedPettyCashMap: Map<string, PettyCashLookupInfo> | null = null;
let cachedPettyCashMapTime = 0;

export async function getPettyCashSummaryMap(forceRefresh = false): Promise<Map<string, PettyCashLookupInfo>> {
  const now = Date.now();
  if (!forceRefresh && cachedPettyCashMap && (now - cachedPettyCashMapTime < CACHE_TTL_MS)) {
    return cachedPettyCashMap;
  }

  const pettyCashMap = new Map<string, PettyCashLookupInfo>();
  try {
    const [pettyRows, peopleMap] = await Promise.all([
      getRowsFromSupabase("เปิดเงินสดย่อย").catch(() => []),
      getPeopleMap()
    ]);

    for (const r of (pettyRows || [])) {
      const rawReq = String(r["ผู้เบิก"] || r.requester || "").trim();
      if (!rawReq) continue;

      const amount = Number(r["จำนวนเงิน"] || r.amount || 0);
      const cleared = Number(r["ยอดเคลียร์แล้ว"] || r.cleared_amount || 0);
      const status = String(r["สถานะ"] || r.status || "").trim();
      if (status === "ยกเลิก") continue;
      const isFinished = status === "เคลียร์บิลแล้ว";

      // Register variations of key for bidirectional lookup
      const keysToRegister = new Set<string>();
      keysToRegister.add(rawReq);
      keysToRegister.add(rawReq.toLowerCase());

      const cleanId = rawReq.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
      if (cleanId) {
        keysToRegister.add(cleanId);
        keysToRegister.add(`pt${cleanId}`);
        keysToRegister.add(`PT${cleanId}`);
        keysToRegister.add(`pe${cleanId}`);
        keysToRegister.add(`PE${cleanId}`);
      }

      const resolvedName = peopleMap.get(rawReq) || peopleMap.get(rawReq.toLowerCase());
      if (resolvedName) {
        keysToRegister.add(resolvedName);
        keysToRegister.add(resolvedName.toLowerCase());
      }

      const primaryKey = rawReq.toLowerCase();
      let entry = pettyCashMap.get(primaryKey);
      if (!entry) {
        entry = {
          total: 0,
          cleared: 0,
          remaining: 0,
          activeCount: 0,
          requesterName: resolvedName || rawReq
        };
      }

      entry.total += amount;
      entry.cleared += cleared;
      entry.remaining = entry.total - entry.cleared;
      if (!isFinished && entry.remaining > 0) {
        entry.activeCount += 1;
      }

      for (const k of keysToRegister) {
        pettyCashMap.set(k, entry);
      }
    }

    cachedPettyCashMap = pettyCashMap;
    cachedPettyCashMapTime = now;
  } catch (e) {
    console.warn("⚠️ Failed to fetch petty cash map for Flex resolution:", e);
  }

  return pettyCashMap;
}

export function resolvePettyCashInfo(
  rawRequester: unknown,
  pettyCashMap?: Map<string, PettyCashLookupInfo> | Record<string, PettyCashLookupInfo>,
  peopleMap?: Map<string, string> | Record<string, string>
): PettyCashLookupInfo | null {
  const raw = String(rawRequester || "").trim();
  if (!raw || raw === "-" || raw === "non") return null;

  const map = pettyCashMap || cachedPettyCashMap || undefined;
  if (!map) return null;

  if (map instanceof Map) {
    if (map.has(raw)) return map.get(raw)!;
    if (map.has(raw.toLowerCase())) return map.get(raw.toLowerCase())!;
    if (map.has(raw.toUpperCase())) return map.get(raw.toUpperCase())!;
    const cleanId = raw.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
    if (cleanId && map.has(cleanId)) return map.get(cleanId)!;
    if (cleanId && map.has(`pt${cleanId}`)) return map.get(`pt${cleanId}`)!;
    if (cleanId && map.has(`PT${cleanId}`)) return map.get(`PT${cleanId}`)!;

    const pMap = peopleMap || cachedPeopleMap;
    if (pMap && pMap instanceof Map) {
      const name = pMap.get(raw) || pMap.get(raw.toLowerCase());
      if (name && map.has(name)) return map.get(name)!;
      if (name && map.has(name.toLowerCase())) return map.get(name.toLowerCase())!;
    }
  } else if (typeof map === "object") {
    if (map[raw]) return map[raw];
    if (map[raw.toLowerCase()]) return map[raw.toLowerCase()];
    if (map[raw.toUpperCase()]) return map[raw.toUpperCase()];
    const cleanId = raw.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
    if (cleanId && map[cleanId]) return map[cleanId];
  }

  return null;
}

export type BankLookupInfo = {
  accountName?: string;
  accountNo?: string;
  bankName?: string;
  storeName?: string;
  vendorName?: string;
};

export const DEFAULT_THAI_BANKS: Record<string, string> = {
  ba101: "กรุงเทพ",
  ba102: "กสิกรไทย",
  ba103: "ไทยพาณิชย์",
  ba104: "กรุงไทย",
  ba105: "ทหารไทยธนชาต",
  ba106: "ออมสิน",
  ba107: "กรุงศรีอยุธยา",
  ba108: "เกียรตินาคินภัทร",
  ba109: "ธนชาต",
  ba110: "เพื่อการเกษตรและสหกรณ์การเกษตร",
  ba111: "ยูโอบี",
  ba112: "ซีไอเอ็มบีไทย",
  ba113: "ทิสโก้",
  ba114: "อาคารสงเคราะห์",
};

export function inferThaiBankFromAccount(accountNo?: string): string {
  if (!accountNo) return "";
  const raw = String(accountNo).trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length < 8) return "";

  if (digits.length === 12 && digits.startsWith("020")) return "ออมสิน";
  if (raw.startsWith("020-") || raw.startsWith("02-04")) return "ออมสิน";
  if (digits.length === 12 && digits.startsWith("0101")) return "เพื่อการเกษตรและสหกรณ์การเกษตร";

  if (
    digits.startsWith("051") || digits.startsWith("009") || digits.startsWith("024") ||
    digits.startsWith("411") || digits.startsWith("437") || digits.startsWith("984") ||
    digits.startsWith("563") || digits.startsWith("026") || digits.startsWith("052") ||
    digits.startsWith("102") || digits.startsWith("115") || digits.startsWith("120")
  ) {
    return "กรุงไทย";
  }

  if (/^\d{3}[-\s]?\d{6}[-\s]?\d$/.test(raw) || digits.startsWith("503") || digits.startsWith("248") || digits.startsWith("399") || digits.startsWith("071")) {
    return "ไทยพาณิชย์";
  }

  if (/^\d{3}[-\s]?[03][-\s]?\d{5}[-\s]?\d$/.test(raw) || digits.startsWith("114") || digits.startsWith("119") || digits.startsWith("0718")) {
    return "กรุงเทพ";
  }

  if (
    /^\d{3}[-\s]?[1246][-\s]?\d{5}[-\s]?\d$/.test(raw) ||
    digits.startsWith("789") || digits.startsWith("725") || digits.startsWith("017") ||
    digits.startsWith("019") || digits.startsWith("243") || digits.startsWith("322") ||
    digits.startsWith("649") || digits.startsWith("760") || digits.startsWith("441") ||
    digits.startsWith("164") || digits.startsWith("720") || digits.startsWith("139") ||
    digits.startsWith("029") || digits.startsWith("296") || digits.startsWith("334") ||
    digits.startsWith("983")
  ) {
    return "กสิกรไทย";
  }

  return "";
}

let cachedBankInfoMap: Map<string, BankLookupInfo> | null = null;
let cachedBankInfoMapTime = 0;

export async function getBankInfoMap(forceRefresh = false): Promise<Map<string, BankLookupInfo>> {
  const now = Date.now();
  if (!forceRefresh && cachedBankInfoMap && (now - cachedBankInfoMapTime < CACHE_TTL_MS)) {
    return cachedBankInfoMap;
  }

  const bankInfoMap = new Map<string, BankLookupInfo>();

  try {
    const [storesRes, contractorsRes, membersRes, banksRes, sysOptRes] = await Promise.all([
      supabaseAdmin.from("stores").select("*"),
      supabaseAdmin.from("contractors").select("*"),
      supabaseAdmin.from("master_members").select("*"),
      supabaseAdmin.from("banks").select("*"),
      supabaseAdmin.from("system_options").select("*").eq("id", "entity_banks").maybeSingle(),
    ]);

    const entityBanksMap: Record<string, string> = (sysOptRes?.data?.data && typeof sysOptRes.data.data === "object")
      ? sysOptRes.data.data
      : {};

    const bankNameById = new Map<string, string>();
    for (const [k, v] of Object.entries(DEFAULT_THAI_BANKS)) {
      bankNameById.set(k.toLowerCase(), v);
    }
    if (banksRes.data) {
      for (const b of banksRes.data) {
        const id = String(b.id || b.id_bank || "").trim();
        const name = String(b.name || b["ชื่อธนาคาร"] || "").trim();
        if (id && name && name !== "non" && name !== "-") {
          bankNameById.set(id.toLowerCase(), name);
        }
      }
    }

    const cleanBank = (raw?: string) => {
      if (!raw || raw === "non" || raw === "-") {
        return "";
      }
      const trimmed = String(raw).trim();
      const lower = trimmed.toLowerCase();
      const mapped = bankNameById.get(lower);
      if (mapped) return mapped;
      const stripped = trimmed.replace(/^Ba\d+\s*[-–—]?\s*/i, "").replace(/^ธนาคาร\s*/, "").trim();
      if (stripped && stripped !== "non" && stripped !== "-") {
        const strippedMapped = bankNameById.get(stripped.toLowerCase());
        if (strippedMapped) return strippedMapped;
        return stripped;
      }
      return "";
    };

    // 1. Stores
    if (storesRes.data) {
      for (const s of storesRes.data) {
        const dataObj = (s.data && typeof s.data === "object") ? s.data : {};
        const id = String(s.id || s.id_store || dataObj.id || dataObj.id_store || "").trim();
        const name = String(s.name || s["ชื่อร้านค้า"] || dataObj.name || dataObj["ชื่อร้านค้า"] || "").trim();
        const fullName = String(s.full_name || s["ชื่อเต็ม"] || dataObj.full_name || dataObj["ชื่อเต็ม"] || "").trim();
        const accountNo = String(s.bank_account || s["เลขบัญชี"] || dataObj.bank_account || dataObj["เลขบัญชี"] || "").trim();

        const rawBankVal = s.bank_name || s.bank || s["ธนาคาร"] || dataObj.bank_name || dataObj["ธนาคาร"] ||
          entityBanksMap[id] || entityBanksMap[id.toLowerCase()] || entityBanksMap[id.toUpperCase()] ||
          (name ? entityBanksMap[name] : "") || (fullName ? entityBanksMap[fullName] : "");

        const bankName = cleanBank(rawBankVal);
        const storeDisplayName = name || fullName || id;

        const info: BankLookupInfo = {
          accountName: fullName || name,
          accountNo: accountNo && accountNo !== "non" && accountNo !== "-" ? accountNo : undefined,
          bankName: bankName || undefined,
          storeName: storeDisplayName,
          vendorName: storeDisplayName,
        };

        if (id) {
          bankInfoMap.set(id, info);
          bankInfoMap.set(id.toLowerCase(), info);
          bankInfoMap.set(id.toUpperCase(), info);
          const cleanId = id.toLowerCase().replace(/^(st)[-_]?/i, "").trim();
          if (cleanId) bankInfoMap.set(cleanId, info);
        }
        if (name) {
          bankInfoMap.set(name.toLowerCase(), info);
          bankInfoMap.set(name, info);
        }
        if (fullName) {
          bankInfoMap.set(fullName.toLowerCase(), info);
          bankInfoMap.set(fullName, info);
        }
      }
    }

    // 2. Contractors
    if (contractorsRes.data) {
      for (const c of contractorsRes.data) {
        const dataObj = (c.data && typeof c.data === "object") ? c.data : {};
        const id = String(c.id || c.id_Contractor || dataObj.id || dataObj.id_Contractor || "").trim();
        const nickname = String(c.nickname || c["ชื่อเล่น"] || dataObj.nickname || dataObj["ชื่อเล่น"] || "").trim();
        const fullName = String(c.full_name || c["ชื่อ-นามสกุล"] || dataObj.full_name || dataObj["ชื่อ-นามสกุล"] || "").trim();
        const accountNo = String(c.bank_account || c["เลขบัญชี"] || dataObj.bank_account || dataObj["เลขบัญชี"] || "").trim();

        const rawBankVal = c.bank_name || c.bank || c["ธนาคาร"] || dataObj.bank_name || dataObj["ธนาคาร"] ||
          entityBanksMap[id] || entityBanksMap[id.toLowerCase()] || entityBanksMap[id.toUpperCase()] ||
          (nickname ? entityBanksMap[nickname] : "") || (fullName ? entityBanksMap[fullName] : "");

        const bankName = cleanBank(rawBankVal);
        const contractorDisplayName = nickname || fullName || id;

        const info: BankLookupInfo = {
          accountName: fullName || nickname,
          accountNo: accountNo && accountNo !== "non" && accountNo !== "-" ? accountNo : undefined,
          bankName: bankName || undefined,
          storeName: contractorDisplayName,
          vendorName: contractorDisplayName,
        };

        if (id) {
          bankInfoMap.set(id, info);
          bankInfoMap.set(id.toLowerCase(), info);
          bankInfoMap.set(id.toUpperCase(), info);
          const cleanId = id.toLowerCase().replace(/^(ct)[-_]?/i, "").trim();
          if (cleanId) bankInfoMap.set(cleanId, info);
        }
        if (nickname) {
          bankInfoMap.set(nickname.toLowerCase(), info);
          bankInfoMap.set(nickname, info);
        }
        if (fullName) {
          bankInfoMap.set(fullName.toLowerCase(), info);
          bankInfoMap.set(fullName, info);
        }
      }
    }

    // 3. Members / People
    if (membersRes.data) {
      for (const m of membersRes.data) {
        const dataObj = (m.data && typeof m.data === "object") ? m.data : {};
        const id = String(m.id || m["รหัสพนักงาน"] || dataObj.id || dataObj["รหัสพนักงาน"] || "").trim();
        const nickname = String(m.nickname || m["ชื่อเล่น"] || dataObj.nickname || dataObj["ชื่อเล่น"] || "").trim();
        const fullName = String(m.full_name || m["ชื่อ-นามสกุล"] || dataObj.full_name || dataObj["ชื่อ-นามสกุล"] || "").trim();
        const accountNo = String(m.bank_account || m["เลขบัญชี"] || dataObj.bank_account || dataObj["เลขบัญชี"] || "").trim();

        const rawBankVal = m.bank_name || m.bank || m["ธนาคาร"] || dataObj.bank_name || dataObj["ธนาคาร"] ||
          entityBanksMap[id] || entityBanksMap[id.toLowerCase()] || entityBanksMap[id.toUpperCase()] ||
          (nickname ? entityBanksMap[nickname] : "") || (fullName ? entityBanksMap[fullName] : "");

        const bankName = cleanBank(rawBankVal);
        const memberDisplayName = nickname || fullName || id;

        const info: BankLookupInfo = {
          accountName: fullName || nickname,
          accountNo: accountNo && accountNo !== "non" && accountNo !== "-" ? accountNo : undefined,
          bankName: bankName || undefined,
          storeName: memberDisplayName,
          vendorName: memberDisplayName,
        };

        if (id) {
          bankInfoMap.set(id, info);
          bankInfoMap.set(id.toLowerCase(), info);
          bankInfoMap.set(id.toUpperCase(), info);
          const cleanId = id.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
          if (cleanId) bankInfoMap.set(cleanId, info);
        }
        if (nickname) {
          bankInfoMap.set(nickname.toLowerCase(), info);
          bankInfoMap.set(nickname, info);
        }
        if (fullName) {
          bankInfoMap.set(fullName.toLowerCase(), info);
          bankInfoMap.set(fullName, info);
        }
      }
    }

    cachedBankInfoMap = bankInfoMap;
    cachedBankInfoMapTime = now;
  } catch (e) {
    console.warn("⚠️ Failed to load bank info map for Flex:", e);
  }

  return bankInfoMap;
}

let cachedContractMap: Map<string, any> | null = null;
let cachedContractMapTime = 0;

export async function getContractWorkMap(forceRefresh = false): Promise<Map<string, any>> {
  const now = Date.now();
  if (!forceRefresh && cachedContractMap && (now - cachedContractMapTime < CACHE_TTL_MS)) {
    return cachedContractMap;
  }

  const contractMap = new Map<string, any>();
  try {
    const { data: contracts } = await supabaseAdmin.from("contract_works").select("*");
    if (contracts && contracts.length > 0) {
      const projectContractTotals = new Map<string, number>();

      for (const c of contracts) {
        const id = String(c.id || c.id_Conwork || "").trim();
        const pId = String(c.project_id || c["ID Project"] || "").trim();
        const pName = String(c.project_name || c["ชื่อ Project"] || "").trim();
        const cId = String(c.contractor_id || c.id_Contractor || "").trim();
        const cName = String(c.contractor_name || c["ชื่อเล่น"] || c["ผู้รับเหมา"] || c["ชื่อ-นามสกุล"] || "").trim();
        const amt = Number(c.total_contract_amount || c["ยอดเงินจ้าง"] || c.amount || 0);

        if (pId && amt > 0) {
          projectContractTotals.set(pId, (projectContractTotals.get(pId) || 0) + amt);
          if (pId.toLowerCase() !== pId) {
            projectContractTotals.set(pId.toLowerCase(), (projectContractTotals.get(pId.toLowerCase()) || 0) + amt);
          }
        }
        if (pName && amt > 0) {
          projectContractTotals.set(pName, (projectContractTotals.get(pName) || 0) + amt);
          if (pName.toLowerCase() !== pName) {
            projectContractTotals.set(pName.toLowerCase(), (projectContractTotals.get(pName.toLowerCase()) || 0) + amt);
          }
        }

        if (id) {
          contractMap.set(id, c);
          contractMap.set(id.toLowerCase(), c);
          contractMap.set(id.toUpperCase(), c);
        }
        if (pId && cId) {
          contractMap.set(`${pId}_${cId}`, c);
          contractMap.set(`${pId}_${cId.toLowerCase()}`, c);
          contractMap.set(`${pId}_${cId.toUpperCase()}`, c);
        }
        if (pId && cName) {
          contractMap.set(`${pId}_${cName}`, c);
        }
        if (cName) {
          contractMap.set(cName, c);
        }
        if (cId) {
          contractMap.set(cId, c);
        }
      }

      for (const [key, sumAmt] of projectContractTotals.entries()) {
        contractMap.set(`__total_contracted_${key}`, sumAmt);
      }
    }
    cachedContractMap = contractMap;
    cachedContractMapTime = now;
  } catch (err) {
    console.warn("⚠️ Failed to fetch contract_works map:", err);
  }

  return contractMap;
}

export type ProjectBudgetLookupInfo = {
  budget: number;
  spent: number;
  paidSpent: number;
  name: string;
  catBudgets?: Record<string, number>;
  catSpent?: Record<string, number>;
  catPaidSpent?: Record<string, number>;
  allBudgets?: Record<string, number>;
  productSpent?: Record<string, number>;
  productPaidSpent?: Record<string, number>;
  paidBillIds?: Set<string>;
};

export const PRODUCT_BUDGET_FIELD_MAP: Record<string, string> = {
  // 100 Material Cost Codes (101-123)
  "101": "งบไม่เกินเตรียมงาน",
  "101 เตรียมงาน": "งบไม่เกินเตรียมงาน",
  "101. เตรียมงาน": "งบไม่เกินเตรียมงาน",
  "เตรียมงาน": "งบไม่เกินเตรียมงาน",

  "102": "งบไม่เกินหินทราย",
  "102 ดิน/ทราย/หิน": "งบไม่เกินหินทราย",
  "102. ดิน/ทราย/หิน": "งบไม่เกินหินทราย",
  "ดิน/ทราย/หิน": "งบไม่เกินหินทราย",
  "หินทราย": "งบไม่เกินหินทราย",
  "ดิน": "งบไม่เกินดิน",

  "103": "งบไม่เกินเสาเข็ม",
  "103 เสาเข็ม": "งบไม่เกินเสาเข็ม",
  "103. เสาเข็ม": "งบไม่เกินเสาเข็ม",
  "เสาเข็ม": "งบไม่เกินเสาเข็ม",
  "เข็มเจาะ": "งบไม่เกินเสาเข็ม",
  "เข็มตอก": "งบไม่เกินเสาเข็ม",

  "104": "งบไม่เกินเหล็กเส้น",
  "104 เหล็กเส้น": "งบไม่เกินเหล็กเส้น",
  "104. เหล็กเส้น": "งบไม่เกินเหล็กเส้น",
  "เหล็กเส้น": "งบไม่เกินเหล็กเส้น",
  "เหล็กเส้น/รูปพรรณ": "งบไม่เกินเหล็กเส้น",

  "105": "งบไม่เกินไม้แบบ",
  "105 ไม้แบบค้ำยัน": "งบไม่เกินไม้แบบ",
  "105. ไม้แบบค้ำยัน": "งบไม่เกินไม้แบบ",
  "ไม้แบบค้ำยัน": "งบไม่เกินไม้แบบ",
  "ไม้แบบ": "งบไม่เกินไม้แบบ",
  "ไม้อัด": "งบไม่เกินไม้แบบ",
  "ไม้แบบ/ไม้อัด": "งบไม่เกินไม้แบบ",

  "106": "งบไม่เกินคอนกรีต",
  "106 คอนกรีตผสมเสร็จ": "งบไม่เกินคอนกรีต",
  "106. คอนกรีตผสมเสร็จ": "งบไม่เกินคอนกรีต",
  "คอนกรีตผสมเสร็จ": "งบไม่เกินคอนกรีต",
  "คอนกรีต": "งบไม่เกินคอนกรีต",

  "107": "งบไม่เกินรูปพรรณ",
  "107 เหล็กรูปพรรณ": "งบไม่เกินรูปพรรณ",
  "107. เหล็กรูปพรรณ": "งบไม่เกินรูปพรรณ",
  "เหล็กรูปพรรณ": "งบไม่เกินรูปพรรณ",
  "รูปพรรณ": "งบไม่เกินรูปพรรณ",

  "108": "งบไม่เกินวัสดุมุง",
  "108 วัสดุหลังคา": "งบไม่เกินวัสดุมุง",
  "108. วัสดุหลังคา": "งบไม่เกินวัสดุมุง",
  "วัสดุหลังคา": "งบไม่เกินวัสดุมุง",
  "วัสดุมุง": "งบไม่เกินวัสดุมุง",
  "หลังคา": "งบไม่เกินวัสดุมุง",

  "109": "งบไม่เกินก่อฉาบ",
  "109 ก่อฉาบ": "งบไม่เกินก่อฉาบ",
  "109. ก่อฉาบ": "งบไม่เกินก่อฉาบ",
  "ก่อฉาบ": "งบไม่เกินก่อฉาบ",
  "ปูน/ทราย/หิน": "งบไม่เกินปูนทรายหิน",
  "ปูนทรายหิน": "งบไม่เกินปูนทรายหิน",

  "110": "งบไม่เกินฝ้าผนัง",
  "110 ฝ้าเพดาน": "งบไม่เกินฝ้าผนัง",
  "110. ฝ้าเพดาน": "งบไม่เกินฝ้าผนัง",
  "ฝ้าเพดาน": "งบไม่เกินฝ้าผนัง",
  "ฝ้าผนัง": "งบไม่เกินฝ้าผนัง",

  "111": "งบไม่เกินปูพื้น",
  "111 ผิวพื้นผนัง": "งบไม่เกินปูพื้น",
  "111. ผิวพื้นผนัง": "งบไม่เกินปูพื้น",
  "ผิวพื้นผนัง": "งบไม่เกินปูพื้น",
  "ปูพื้น": "งบไม่เกินปูพื้น",

  "112": "งบไม่เกินกระจก",
  "112 ประตูหน้าต่าง": "งบไม่เกินกระจก",
  "112. ประตูหน้าต่าง": "งบไม่เกินกระจก",
  "ประตูหน้าต่าง": "งบไม่เกินกระจก",
  "กระจก": "งบไม่เกินกระจก",

  "113": "งบไม่เกินสีเคมี",
  "113 ทาสี": "งบไม่เกินสีเคมี",
  "113. ทาสี": "งบไม่เกินสีเคมี",
  "ทาสี": "งบไม่เกินสีเคมี",
  "สีเคมี": "งบไม่เกินสีเคมี",

  "114": "งบไม่เกินสุขภัณฑ์",
  "114 สุขภัณฑ์": "งบไม่เกินสุขภัณฑ์",
  "114. สุขภัณฑ์": "งบไม่เกินสุขภัณฑ์",
  "สุขภัณฑ์": "งบไม่เกินสุขภัณฑ์",

  "115": "งบไม่เกินประปา",
  "115 ระบบประปา": "งบไม่เกินประปา",
  "115. ระบบประปา": "งบไม่เกินประปา",
  "ระบบประปา": "งบไม่เกินประปา",
  "ประปา": "งบไม่เกินประปา",

  "116": "งบไม่เกินไฟฟ้า",
  "116 ระบบไฟฟ้า": "งบไม่เกินไฟฟ้า",
  "116. ระบบไฟฟ้า": "งบไม่เกินไฟฟ้า",
  "ระบบไฟฟ้า": "งบไม่เกินไฟฟ้า",
  "ไฟฟ้า": "งบไม่เกินไฟฟ้า",

  "117": "งบไม่เกินแอร์",
  "117 ระบบปรับอากาศ": "งบไม่เกินแอร์",
  "117. ระบบปรับอากาศ": "งบไม่เกินแอร์",
  "ระบบปรับอากาศ": "งบไม่เกินแอร์",
  "แอร์": "งบไม่เกินแอร์",

  "118": "งบไม่เกินบิวอิน",
  "118 ตบแต่งภายใน": "งบไม่เกินบิวอิน",
  "118. ตบแต่งภายใน": "งบไม่เกินบิวอิน",
  "ตบแต่งภายใน": "งบไม่เกินบิวอิน",
  "บิวอิน": "งบไม่เกินบิวอิน",

  "119": "งบไม่เกินเฟอร์นิเจอร์",
  "119 เฟอร์นิเจอร์": "งบไม่เกินเฟอร์นิเจอร์",
  "119. เฟอร์นิเจอร์": "งบไม่เกินเฟอร์นิเจอร์",
  "เฟอร์นิเจอร์": "งบไม่เกินเฟอร์นิเจอร์",

  "120": "งบไม่เกินภูมิทัศน์",
  "120 ภูมิทัศน์": "งบไม่เกินภูมิทัศน์",
  "120. ภูมิทัศน์": "งบไม่เกินภูมิทัศน์",
  "ภูมิทัศน์": "งบไม่เกินภูมิทัศน์",

  "121": "งบไม่เกินแก้ไขเก็บงาน",
  "121 แก้ไขเก็บงาน": "งบไม่เกินแก้ไขเก็บงาน",
  "121. แก้ไขเก็บงาน": "งบไม่เกินแก้ไขเก็บงาน",
  "แก้ไขเก็บงาน": "งบไม่เกินแก้ไขเก็บงาน",

  "122": "งบไม่เกินตั้งนั่งร้าน",
  "122 ตั้งนั่งร้าน": "งบไม่เกินตั้งนั่งร้าน",
  "122. ตั้งนั่งร้าน": "งบไม่เกินตั้งนั่งร้าน",
  "ตั้งนั่งร้าน": "งบไม่เกินตั้งนั่งร้าน",

  "123": "งบไม่เกินดำเนินการ",
  "123 ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",
  "123. ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",
  "200 ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",
  "ดำเนินการ(อื่นๆ)": "งบไม่เกินดำเนินการ",
  "ดำเนินการ": "งบไม่เกินดำเนินการ",
  "อื่นๆ(วัสดุ)": "งบไม่เกินวัสดุอื่นๆ",
  "วัสดุอื่นๆ": "งบไม่เกินวัสดุอื่นๆ",

  // 500 Equipment / Vehicle Cost Codes
  "501": "งบไม่เกินน้ำมัน",
  "501 น้ำมัน": "งบไม่เกินน้ำมัน",
  "501. น้ำมัน": "งบไม่เกินน้ำมัน",
  "น้ำมัน": "งบไม่เกินน้ำมัน",

  "502": "งบไม่เกินซ่อมรถ",
  "502 ซ่อมรถ": "งบไม่เกินซ่อมรถ",
  "502. ซ่อมรถ": "งบไม่เกินซ่อมรถ",
  "ซ่อมรถ": "งบไม่เกินซ่อมรถ",

  "503": "งบไม่เกินเครื่องจักร",
  "503 เครื่องจักร": "งบไม่เกินเครื่องจักร",
  "503. เครื่องจักร": "งบไม่เกินเครื่องจักร",
  "เครื่องจักร": "งบไม่เกินเครื่องจักร",

  "504": "งบไม่เกินเครื่องมือ",
  "504 เครื่องมือ": "งบไม่เกินเครื่องมือ",
  "504. เครื่องมือ": "งบไม่เกินเครื่องมือ",
  "เครื่องมือ": "งบไม่เกินเครื่องมือ",

  // Legacy format
  "1 ปูน/ทราย/หิน": "งบไม่เกินปูนทรายหิน",
  "2 เหล็กเส้น/รูปพรรณ": "งบไม่เกินเหล็กเส้น",
  "3 คอนกรีตผสมเสร็จ": "งบไม่เกินคอนกรีต",
  "4 ไม้แบบ/ไม้อัด": "งบไม่เกินไม้แบบ",
  "5 วัสดุมุง": "งบไม่เกินวัสดุมุง",
  "6 ฝ้าผนัง": "งบไม่เกินฝ้าผนัง",
  "7 ปูพื้น": "งบไม่เกินปูพื้น",
  "8 กระจก": "งบไม่เกินกระจก",
  "9 ไฟฟ้า": "งบไม่เกินไฟฟ้า",
  "10 ประปา": "งบไม่เกินประปา",
  "11 อื่นๆ(วัสดุ)": "งบไม่เกินวัสดุอื่นๆ",
  "12 สีเคมี": "งบไม่เกินสีเคมี",
  "13 สุขภัณฑ์": "งบไม่เกินสุขภัณฑ์",
  "14 บิวอิน": "งบไม่เกินบิวอิน",
  "15 แอร์": "งบไม่เกินแอร์",
  "16 ดิน": "งบไม่เกินดิน",
  "17 หินทราย": "งบไม่เกินหินทราย",
  "18 เตรียมงาน": "งบไม่เกินเตรียมงาน",
  "102 ค่าขนส่ง": "งบไม่เกินค่าขนส่ง",
  "ค่าขนส่ง": "งบไม่เกินค่าขนส่ง",
};

export function resolveProductBudgetField(raw: string): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (PRODUCT_BUDGET_FIELD_MAP[trimmed]) return PRODUCT_BUDGET_FIELD_MAP[trimmed];

  const cleaned = trimmed.replace(/^\d+[\.\s\-]+/, "").trim();
  if (PRODUCT_BUDGET_FIELD_MAP[cleaned]) return PRODUCT_BUDGET_FIELD_MAP[cleaned];

  // Try cost-code helper
  const fromCostCode = getCostCodeBudgetField(trimmed) || getCostCodeBudgetField(cleaned);
  if (fromCostCode && fromCostCode !== "งบไม่เกินค่าของ") return fromCostCode;

  // Keyword matching
  if (trimmed.includes("เสาเข็ม") || trimmed.includes("เข็ม")) return "งบไม่เกินเสาเข็ม";
  if (trimmed.includes("เหล็กเส้น")) return "งบไม่เกินเหล็กเส้น";
  if (trimmed.includes("รูปพรรณ")) return "งบไม่เกินรูปพรรณ";
  if (trimmed.includes("คอนกรีต")) return "งบไม่เกินคอนกรีต";
  if (trimmed.includes("หินทราย")) return "งบไม่เกินหินทราย";
  if (trimmed.includes("ปูน") || trimmed.includes("ทราย") || trimmed.includes("หิน")) return "งบไม่เกินปูนทรายหิน";
  if (trimmed.includes("ไม้แบบ") || trimmed.includes("ไม้อัด") || trimmed.includes("ค้ำยัน")) return "งบไม่เกินไม้แบบ";
  if (trimmed.includes("วัสดุมุง") || trimmed.includes("หลังคา")) return "งบไม่เกินวัสดุมุง";
  if (trimmed.includes("ฝ้า") || trimmed.includes("ผนัง") || trimmed.includes("เพดาน")) return "งบไม่เกินฝ้าผนัง";
  if (trimmed.includes("ปูพื้น") || trimmed.includes("กระเบื้อง") || trimmed.includes("ผิวพื้น")) return "งบไม่เกินปูพื้น";
  if (trimmed.includes("กระจก") || trimmed.includes("อลูมิเนียม") || trimmed.includes("ประตู") || trimmed.includes("หน้าต่าง")) return "งบไม่เกินกระจก";
  if (trimmed.includes("ไฟฟ้า")) return "งบไม่เกินไฟฟ้า";
  if (trimmed.includes("ประปา")) return "งบไม่เกินประปา";
  if (trimmed.includes("สี") || trimmed.includes("เคมี")) return "งบไม่เกินสีเคมี";
  if (trimmed.includes("สุขภัณฑ์")) return "งบไม่เกินสุขภัณฑ์";
  if (trimmed.includes("บิวอิน") || trimmed.includes("บิ้วอิน") || trimmed.includes("ตบแต่ง")) return "งบไม่เกินบิวอิน";
  if (trimmed.includes("เฟอร์นิเจอร์")) return "งบไม่เกินเฟอร์นิเจอร์";
  if (trimmed.includes("ภูมิทัศน์")) return "งบไม่เกินภูมิทัศน์";
  if (trimmed.includes("แก้ไขเก็บงาน") || trimmed.includes("เก็บงาน")) return "งบไม่เกินแก้ไขเก็บงาน";
  if (trimmed.includes("ตั้งนั่งร้าน") || trimmed.includes("นั่งร้าน")) return "งบไม่เกินตั้งนั่งร้าน";
  if (trimmed.includes("แอร์") || trimmed.includes("ปรับอากาศ")) return "งบไม่เกินแอร์";
  if (trimmed.includes("ดิน")) return "งบไม่เกินดิน";
  if (trimmed.includes("เตรียมงาน")) return "งบไม่เกินเตรียมงาน";
  if (trimmed.includes("น้ำมัน")) return "งบไม่เกินน้ำมัน";
  if (trimmed.includes("ซ่อมรถ")) return "งบไม่เกินซ่อมรถ";
  if (trimmed.includes("ขนส่ง")) return "งบไม่เกินค่าขนส่ง";
  if (trimmed.includes("เครื่องจักร")) return "งบไม่เกินเครื่องจักร";
  if (trimmed.includes("เครื่องมือ")) return "งบไม่เกินเครื่องมือ";
  if (trimmed.includes("ดำเนินการ")) return "งบไม่เกินดำเนินการ";
  if (trimmed.includes("วัสดุ")) return "งบไม่เกินวัสดุอื่นๆ";

  return "";
}

export function getBudgetCapForField(field: string, allBudgets?: Record<string, number>): { cap: number; actualField: string } {
  if (!field || !allBudgets) return { cap: 0, actualField: "" };
  if (Number(allBudgets[field] || 0) > 0) return { cap: Number(allBudgets[field]), actualField: field };

  // Compatibility aliases
  if (field === "งบไม่เกินเสาเข็ม" && Number(allBudgets["งบไม่เกินปูนทรายหิน"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินปูนทรายหิน"]), actualField: "งบไม่เกินปูนทรายหิน" };
  }
  if (field === "งบไม่เกินก่อฉาบ" && Number(allBudgets["งบไม่เกินปูนทรายหิน"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินปูนทรายหิน"]), actualField: "งบไม่เกินปูนทรายหิน" };
  }
  if (field === "งบไม่เกินหินทราย" && Number(allBudgets["งบไม่เกินดิน"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินดิน"]), actualField: "งบไม่เกินดิน" };
  }
  if (field === "งบไม่เกินรูปพรรณ" && Number(allBudgets["งบไม่เกินเหล็กเส้น"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินเหล็กเส้น"]), actualField: "งบไม่เกินเหล็กเส้น" };
  }
  if (field === "งบไม่เกินเหล็กเส้น" && Number(allBudgets["งบไม่เกินรูปพรรณ"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินรูปพรรณ"]), actualField: "งบไม่เกินรูปพรรณ" };
  }
  if (field === "งบไม่เกินกระจก" && Number(allBudgets["งบไม่เกินประตูหน้าต่าง"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินประตูหน้าต่าง"]), actualField: "งบไม่เกินประตูหน้าต่าง" };
  }
  if (field === "งบไม่เกินบิวอิน" && Number(allBudgets["งบไม่เกินเฟอร์นิเจอร์"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินเฟอร์นิเจอร์"]), actualField: "งบไม่เกินเฟอร์นิเจอร์" };
  }
  if (field === "งบไม่เกินเฟอร์นิเจอร์" && Number(allBudgets["งบไม่เกินบิวอิน"] || 0) > 0) {
    return { cap: Number(allBudgets["งบไม่เกินบิวอิน"]), actualField: "งบไม่เกินบิวอิน" };
  }
  return { cap: 0, actualField: field };
}

const EXPENSE_CATEGORIES_LIST = [
  "ค่าของ",
  "ค่าแรง",
  "พนักงาน",
  "น้ำมัน",
  "ซ่อมรถ",
  "เครื่องจักร",
  "เครื่องมือ",
  "อื่นๆ"
];

export function resolveBillExpenseCategory(b: Record<string, any>): string {
  const rawCat = String(b["ประเภท"] || b.category || b.data?.["ประเภท"] || "").trim();
  for (const cat of EXPENSE_CATEGORIES_LIST) {
    if (rawCat.includes(cat)) return cat;
  }

  const rawItems = b.items || b.data?.items;
  let lineItems: any[] = [];
  if (Array.isArray(rawItems)) {
    lineItems = rawItems;
  } else if (typeof rawItems === "string" && rawItems.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rawItems);
      if (Array.isArray(parsed)) lineItems = parsed;
    } catch {}
  }

  for (const it of lineItems) {
    const itCat = String(it.categoryType || it.category || "").trim();
    for (const cat of EXPENSE_CATEGORIES_LIST) {
      if (itCat.includes(cat)) return cat;
    }
  }

  for (const cat of EXPENSE_CATEGORIES_LIST) {
    if (Number(b[cat] || b.data?.[cat] || 0) > 0) return cat;
  }

  return "";
}

let cachedProjectBudgetMap: Map<string, ProjectBudgetLookupInfo> | null = null;
let cachedProjectBudgetMapTime = 0;

export async function getProjectBudgetMap(forceRefresh = false): Promise<Map<string, ProjectBudgetLookupInfo>> {
  const now = Date.now();
  if (!forceRefresh && cachedProjectBudgetMap && (now - cachedProjectBudgetMapTime < CACHE_TTL_MS)) {
    return cachedProjectBudgetMap;
  }

  const pMap = new Map<string, ProjectBudgetLookupInfo>();
  try {
    const [{ data: projects }, { data: bills }, { data: allocOpt }] = await Promise.all([
      supabaseAdmin.from("projects").select("id, name, budget, data"),
      supabaseAdmin.from("bills").select("id, project_id, project_name, amount, status, data"),
      supabaseAdmin.from("system_options").select("data").eq("id", "project_budget_allocations").maybeSingle()
    ]);

    const budgetAllocations: Record<string, Record<string, any>> = (allocOpt?.data && typeof allocOpt.data === "object") ? allocOpt.data : {};

    const spentByProject = new Map<string, number>();
    const paidByProject = new Map<string, number>();
    const catSpentByProject = new Map<string, Record<string, number>>();
    const catPaidByProject = new Map<string, Record<string, number>>();
    const productSpentByProject = new Map<string, Record<string, number>>();
    const productPaidByProject = new Map<string, Record<string, number>>();
    const paidBillIdsByProject = new Map<string, Set<string>>();

    if (bills && bills.length > 0) {
      for (const b of bills) {
        const d = (b.data && typeof b.data === "object") ? b.data : {};
        const innerData = (d.data && typeof d.data === "object") ? d.data : {};
        const st = String(b.status || d.status || d["สถานะ"] || innerData["สถานะ"] || "").trim().toLowerCase();
        if (st === "ยกเลิก" || st === "ไม่อนุมัติ") continue;

        const isPaid = st.includes("เบิกแล้ว") || st.includes("ปิดงาน") || st.includes("จ่ายแล้ว") || st === "paid" || st === "withdrawn";

        const pId = String(b.project_id || d.project_id || d["ID Project"] || innerData["ID Project"] || "").trim();
        const pName = String(b.project_name || d.project_name || d["ชื่อ Project"] || innerData["ชื่อ Project"] || "").trim();
        const amt = Number(b.amount || d.amount || d["ยอดเงิน"] || innerData["ยอดเงิน"] || 0);

        const primaryKey = pId || pName;
        if (!primaryKey) continue;

        const billKey = String(b.id || d.id || d["ลำดับ"] || innerData["ลำดับ"] || "").trim();
        const targetKeys = Array.from(new Set([pId, pName].filter(Boolean)));

        for (const k of targetKeys) {
          spentByProject.set(k, (spentByProject.get(k) || 0) + amt);
          if (isPaid) {
            paidByProject.set(k, (paidByProject.get(k) || 0) + amt);
            if (!paidBillIdsByProject.has(k)) {
              paidBillIdsByProject.set(k, new Set<string>());
            }
            if (billKey) paidBillIdsByProject.get(k)!.add(billKey);
          }

          if (!catSpentByProject.has(k)) {
            catSpentByProject.set(k, { ค่าของ: 0, ค่าแรง: 0, พนักงาน: 0, น้ำมัน: 0, ซ่อมรถ: 0, เครื่องจักร: 0, เครื่องมือ: 0, อื่นๆ: 0 });
          }
          if (!catPaidByProject.has(k)) {
            catPaidByProject.set(k, { ค่าของ: 0, ค่าแรง: 0, พนักงาน: 0, น้ำมัน: 0, ซ่อมรถ: 0, เครื่องจักร: 0, เครื่องมือ: 0, อื่นๆ: 0 });
          }
          const cs = catSpentByProject.get(k)!;
          const cp = catPaidByProject.get(k)!;

          for (const cat of EXPENSE_CATEGORIES_LIST) {
            const directAmt = Number((b as any)[cat] || d[cat] || innerData[cat] || 0);
            if (directAmt > 0) {
              cs[cat] += directAmt;
              if (isPaid) cp[cat] += directAmt;
            } else {
              const rawCat = String((b as any).category || d["ประเภท"] || innerData["ประเภท"] || "").trim();
              if (rawCat.includes(cat)) {
                cs[cat] += amt;
                if (isPaid) cp[cat] += amt;
              }
            }
          }
        }

        // Sub-category / Product item level spending tracking
        const rawItems = (b as any).items || d.items || innerData.items;
        let bLineItems: any[] = [];
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          bLineItems = rawItems;
        } else if (typeof rawItems === "string" && rawItems.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(rawItems);
            if (Array.isArray(parsed)) bLineItems = parsed;
          } catch {}
        }

        if (bLineItems.length > 0) {
          for (const it of bLineItems) {
            const itAmt = Number(it.amount ?? it.price ?? it.total ?? 0);
            if (itAmt > 0) {
              const itName = String(it.category || it.name || "").trim();
              const fld = resolveProductBudgetField(itName);
              if (fld) {
                for (const k of targetKeys) {
                  if (!productSpentByProject.has(k)) productSpentByProject.set(k, {});
                  if (!productPaidByProject.has(k)) productPaidByProject.set(k, {});
                  const ps = productSpentByProject.get(k)!;
                  const pp = productPaidByProject.get(k)!;
                  ps[fld] = (ps[fld] || 0) + itAmt;
                  if (isPaid) {
                    pp[fld] = (pp[fld] || 0) + itAmt;
                  }
                }
              }
            }
          }
        } else {
          // Single product bill
          const bProd = String((b as any).product || d["สินค้า"] || d.product || innerData["สินค้า"] || "").trim();
          const fld = resolveProductBudgetField(bProd);
          if (fld && amt > 0) {
            for (const k of targetKeys) {
              if (!productSpentByProject.has(k)) productSpentByProject.set(k, {});
              if (!productPaidByProject.has(k)) productPaidByProject.set(k, {});
              const ps = productSpentByProject.get(k)!;
              const pp = productPaidByProject.get(k)!;
              ps[fld] = (ps[fld] || 0) + amt;
              if (isPaid) {
                pp[fld] = (pp[fld] || 0) + amt;
              }
            }
          }
        }
      }
    }

    if (projects && projects.length > 0) {
      for (const p of projects) {
        const id = String(p.id).trim();
        const name = String(p.name).trim();
        const alloc = (budgetAllocations && (budgetAllocations[id] || budgetAllocations[name])) || {};
        const d = { ...(p.data || {}), ...alloc };

        // 1. Calculate 8 category budgets
        const catBudgets: Record<string, number> = {};
        for (const cat of EXPENSE_CATEGORIES_LIST) {
          const budgetKey = `งบไม่เกิน${cat}`;
          let bVal = Number(d[budgetKey] || (p as any)[budgetKey] || 0);
          if (cat === "ค่าของ" && bVal === 0) {
            const productSum = Object.keys(d)
              .filter(k => k.startsWith("งบไม่เกิน") && k !== "งบไม่เกิน" && k !== "งบไม่เกินค่าของ" && k !== "งบไม่เกินค่าแรง")
              .reduce((sum, k) => sum + Number(d[k] || 0), 0);
            if (productSum > 0) bVal = productSum;
          }
          catBudgets[cat] = bVal;
        }

        // 2. Extract all sub-category budgets (งบไม่เกิน...)
        const allBudgets: Record<string, number> = {};
        for (const k of Object.keys(d)) {
          if (k.startsWith("งบไม่เกิน")) {
            const num = Number(d[k] || 0);
            if (num > 0) {
              allBudgets[k] = num;
            }
          }
        }

        const totalCatBudgetSum = Object.values(catBudgets).reduce((sum, v) => sum + v, 0);
        let budget = Number(p.budget ?? d.budget ?? d["งบไม่เกิน"] ?? 0);
        if (budget <= 0 && totalCatBudgetSum > 0) {
          budget = totalCatBudgetSum;
        }
        if (budget <= 0 && Number(d["ยอดงาน"] || (p as any).work_amount || 0) > 0) {
          budget = Number(d["ยอดงาน"] || (p as any).work_amount || 0);
        }

        const spent = (id ? spentByProject.get(id) : 0) || (name ? spentByProject.get(name) : 0) || 0;
        const paidSpent = (id ? paidByProject.get(id) : 0) || (name ? paidByProject.get(name) : 0) || 0;
        const catSpent = (id ? catSpentByProject.get(id) : null) || (name ? catSpentByProject.get(name) : null) || { ค่าของ: 0, ค่าแรง: 0, พนักงาน: 0, น้ำมัน: 0, ซ่อมรถ: 0, เครื่องจักร: 0, เครื่องมือ: 0, อื่นๆ: 0 };
        const catPaidSpent = (id ? catPaidByProject.get(id) : null) || (name ? catPaidByProject.get(name) : null) || { ค่าของ: 0, ค่าแรง: 0, พนักงาน: 0, น้ำมัน: 0, ซ่อมรถ: 0, เครื่องจักร: 0, เครื่องมือ: 0, อื่นๆ: 0 };
        const productSpent = (id ? productSpentByProject.get(id) : null) || (name ? productSpentByProject.get(name) : null) || {};
        const productPaidSpent = (id ? productPaidByProject.get(id) : null) || (name ? productPaidByProject.get(name) : null) || {};
        const paidBillIds = (id ? paidBillIdsByProject.get(id) : null) || (name ? paidBillIdsByProject.get(name) : null) || new Set<string>();

        const info: ProjectBudgetLookupInfo = {
          budget,
          spent,
          paidSpent,
          name,
          catBudgets,
          catSpent,
          catPaidSpent,
          allBudgets,
          productSpent,
          productPaidSpent,
          paidBillIds
        };
        if (id) {
          pMap.set(id, info);
          pMap.set(id.toLowerCase(), info);
        }
        if (name) {
          pMap.set(name, info);
          pMap.set(name.toLowerCase(), info);
        }
      }
    }
    cachedProjectBudgetMap = pMap;
    cachedProjectBudgetMapTime = now;
  } catch (err) {
    console.warn("⚠️ Failed to build project budget map:", err);
  }

  return pMap;
}

export function resolveBankInfo(
  bill: any,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>
): BankLookupInfo | null {
  const getFromMap = (key: string): BankLookupInfo | undefined => {
    if (!key) return undefined;
    const cleanKey = key.trim();
    const mapsToCheck: Array<Map<string, BankLookupInfo> | Record<string, BankLookupInfo> | undefined> = [
      bankInfoMap,
      cachedBankInfoMap || undefined
    ];

    for (const map of mapsToCheck) {
      if (!map) continue;
      if (map instanceof Map) {
        if (map.has(cleanKey)) return map.get(cleanKey);
        if (map.has(cleanKey.toLowerCase())) return map.get(cleanKey.toLowerCase());
        if (map.has(cleanKey.toUpperCase())) return map.get(cleanKey.toUpperCase());
      } else if (typeof map === "object") {
        if (map[cleanKey]) return map[cleanKey];
        if (map[cleanKey.toLowerCase()]) return map[cleanKey.toLowerCase()];
        if (map[cleanKey.toUpperCase()]) return map[cleanKey.toUpperCase()];
      }
    }
    return undefined;
  };

  const cleanBankVal = (raw?: string) => {
    if (!raw || raw === "non" || raw === "-") {
      return "";
    }
    const trimmed = String(raw).trim();
    const lower = trimmed.toLowerCase();
    const mapped = DEFAULT_THAI_BANKS[lower];
    if (mapped) return mapped;
    const stripped = trimmed.replace(/^Ba\d+\s*[-–—]?\s*/i, "").replace(/^ธนาคาร\s*/, "").trim();
    if (stripped && stripped !== "non" && stripped !== "-") {
      const strippedMapped = DEFAULT_THAI_BANKS[stripped.toLowerCase()];
      if (strippedMapped) return strippedMapped;
      return stripped;
    }
    return "";
  };

  const rawStore = String(bill["ร้านค้า"] || bill.store_id || bill.data?.["ร้านค้า"] || bill.data?.data?.["ร้านค้า"] || "").trim();
  const rawContractor = String(bill["ผู้รับเหมา"] || bill.contractor_id || bill.data?.["ผู้รับเหมา"] || bill.data?.data?.["ผู้รับเหมา"] || "").trim();
  const rawVendor = String(bill["ร้าน/บุคคล"] || bill["ร้านค้า/ผู้รับเหมา"] || bill.vendor_or_person || bill.data?.["ร้าน/บุคคล"] || bill.data?.data?.["ร้าน/บุคคล"] || "").trim();
  const rawRequester = String(bill["ผู้เบิก"] || bill.requester || bill.data?.["ผู้เบิก"] || bill.data?.data?.["ผู้เบิก"] || "").trim();

  let vendorInfo = getFromMap(rawStore) || getFromMap(rawContractor) || getFromMap(rawVendor);
  if (!vendorInfo && rawVendor.includes(" - ")) {
    const parts = rawVendor.split(" - ");
    vendorInfo = getFromMap(parts[0]) || getFromMap(parts[1]);
  }
  if (!vendorInfo && rawVendor.includes("/")) {
    const parts = rawVendor.split("/");
    vendorInfo = getFromMap(parts[0].trim()) || getFromMap(parts[1].trim());
  }

  let requesterInfo = getFromMap(rawRequester);
  if (!requesterInfo && rawRequester.includes(" - ")) {
    const parts = rawRequester.split(" - ");
    requesterInfo = getFromMap(parts[0]) || getFromMap(parts[1]);
  }

  const fallbackInfo = vendorInfo || requesterInfo;

  const directAccountNo = String(bill["เลขบัญชี"] || bill.bank_account || bill.data?.["เลขบัญชี"] || bill.data?.bank_account || bill.data?.data?.["เลขบัญชี"] || "").trim();
  const rawDirectBank = String(bill["ธนาคาร"] || bill.bank_name || bill.bank || bill.data?.["ธนาคาร"] || bill.data?.bank_name || bill.data?.data?.["ธนาคาร"] || "").trim();
  const directAccountName = String(bill["ชื่อบัญชี"] || bill.account_name || bill.data?.["ชื่อบัญชี"] || bill.data?.account_name || bill.data?.data?.["ชื่อบัญชี"] || "").trim();

  const accountNo = directAccountNo || fallbackInfo?.accountNo || "";
  const accountName = directAccountName || fallbackInfo?.accountName || "";
  const bankName = cleanBankVal(rawDirectBank || fallbackInfo?.bankName);

  if (!accountNo && !bankName && !accountName) return null;

  return {
    accountName: accountName || undefined,
    accountNo: accountNo || undefined,
    bankName: bankName || undefined,
  };
}

/**
 * Resolve requester's personal bank account information for sub-bills ("บิลย่อย")
 */
export function resolveRequesterBankInfo(
  bill: any,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  peopleMap?: Map<string, string> | Record<string, string>
): {
  requesterName: string;
  accountName?: string;
  accountNo?: string;
  bankName?: string;
} {
  const getFromMap = (key: string): BankLookupInfo | undefined => {
    if (!key) return undefined;
    const cleanKey = key.trim();
    const mapsToCheck: Array<Map<string, BankLookupInfo> | Record<string, BankLookupInfo> | undefined> = [
      bankInfoMap,
      cachedBankInfoMap || undefined
    ];

    for (const map of mapsToCheck) {
      if (!map) continue;
      if (map instanceof Map) {
        if (map.has(cleanKey)) return map.get(cleanKey);
        if (map.has(cleanKey.toLowerCase())) return map.get(cleanKey.toLowerCase());
        if (map.has(cleanKey.toUpperCase())) return map.get(cleanKey.toUpperCase());
        const cleanId = cleanKey.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
        if (cleanId && map.has(cleanId)) return map.get(cleanId);
      } else if (typeof map === "object") {
        if (map[cleanKey]) return map[cleanKey];
        if (map[cleanKey.toLowerCase()]) return map[cleanKey.toLowerCase()];
        if (map[cleanKey.toUpperCase()]) return map[cleanKey.toUpperCase()];
        const cleanId = cleanKey.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
        if (cleanId && map[cleanId]) return map[cleanId];
      }
    }
    return undefined;
  };

  const cleanBankVal = (raw?: string) => {
    if (!raw || raw === "non" || raw === "-") return "";
    const trimmed = String(raw).trim();
    const lower = trimmed.toLowerCase();
    const mapped = DEFAULT_THAI_BANKS[lower];
    if (mapped) return mapped;
    const stripped = trimmed.replace(/^Ba\d+\s*[-–—]?\s*/i, "").replace(/^ธนาคาร\s*/, "").trim();
    if (stripped && stripped !== "non" && stripped !== "-") {
      const strippedMapped = DEFAULT_THAI_BANKS[stripped.toLowerCase()];
      if (strippedMapped) return strippedMapped;
      return stripped;
    }
    return "";
  };

  const rawRequester = String(
    bill["ผู้เบิก"] ||
    bill.requester ||
    bill.data?.["ผู้เบิก"] ||
    bill.data?.requester ||
    bill.data?.data?.["ผู้เบิก"] ||
    ""
  ).trim();

  let requesterInfo = getFromMap(rawRequester);
  if (!requesterInfo && rawRequester.includes(" - ")) {
    const parts = rawRequester.split(" - ");
    requesterInfo = getFromMap(parts[0].trim()) || getFromMap(parts[1].trim());
  }
  if (!requesterInfo && rawRequester.includes("/")) {
    const parts = rawRequester.split("/");
    requesterInfo = getFromMap(parts[0].trim()) || getFromMap(parts[1].trim());
  }

  // Resolve display name for requester
  let displayName = resolveRequesterNameFromMap(rawRequester, peopleMap);
  if (!displayName || displayName === "-" || displayName === rawRequester) {
    displayName = requesterInfo?.accountName || requesterInfo?.storeName || rawRequester || "-";
  }

  const directAccountNo = String(bill["เลขบัญชี"] || bill.bank_account || bill.data?.["เลขบัญชี"] || bill.data?.bank_account || bill.data?.data?.["เลขบัญชี"] || "").trim();
  const rawDirectBank = String(bill["ธนาคาร"] || bill.bank_name || bill.bank || bill.data?.["ธนาคาร"] || bill.data?.bank_name || bill.data?.data?.["ธนาคาร"] || "").trim();
  const directAccountName = String(bill["ชื่อบัญชี"] || bill.account_name || bill.data?.["ชื่อบัญชี"] || bill.data?.account_name || bill.data?.data?.["ชื่อบัญชี"] || "").trim();

  const accountNo = (directAccountNo && directAccountNo !== "non" && directAccountNo !== "-") ? directAccountNo : (requesterInfo?.accountNo || "");
  const accountName = directAccountName || requesterInfo?.accountName || displayName || "";
  const bankName = cleanBankVal(rawDirectBank || requesterInfo?.bankName);

  return {
    requesterName: displayName,
    accountName: accountName || undefined,
    accountNo: (accountNo && accountNo !== "non" && accountNo !== "-") ? accountNo : undefined,
    bankName: bankName || undefined,
  };
}

export async function getOperatorDisplayName(userId?: string, fallbackRole = "เจ้าของโครงการ"): Promise<string> {
  if (!userId) return "ระบบ Web Dashboard";
  const pMap = await getPeopleMap();
  const resolved = resolveRequesterNameFromMap(userId, pMap);
  if (resolved && resolved !== userId && resolved !== "-") {
    return resolved;
  }
  return fallbackRole;
}

export async function getRecipientDisplayNames(
  ids: string[],
  defaultRole = "ท่าน"
): Promise<string> {
  if (!ids || ids.length === 0) return `0 ${defaultRole}`;
  const pMap = await getPeopleMap();
  const names: string[] = [];

  for (const id of ids) {
    if (!id) continue;
    if (id.startsWith("C") || id.startsWith("R")) {
      names.push("กลุ่ม LINE");
      continue;
    }
    const resolved = resolveRequesterNameFromMap(id, pMap);
    if (resolved && resolved !== id && resolved !== "-") {
      names.push(resolved);
    }
  }

  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length === 0) {
    return `${ids.length} ${defaultRole}`;
  }
  if (unique.length === 1 && ids.length === 1) {
    return unique[0];
  }
  return `${unique.join(", ")} - ${ids.length} ${defaultRole}`;
}

export function resolveRequesterNameFromMap(
  rawRequester: unknown,
  peopleMap?: Map<string, string> | Record<string, string>
): string {
  const str = String(rawRequester || "").trim();
  if (!str) return "-";

  const lookupToken = (key: string): string | null => {
    if (!key) return null;
    const kLower = key.toLowerCase();
    const kUpper = key.toUpperCase();
    const clean = kLower.replace(/^(pt|pe)[-_]?/i, "").trim();

    const mapsToCheck: Array<Map<string, string> | Record<string, string> | undefined> = [
      peopleMap,
      cachedPeopleMap || undefined
    ];

    for (const map of mapsToCheck) {
      if (!map) continue;
      if (map instanceof Map) {
        if (map.has(key)) return map.get(key)!;
        if (map.has(kLower)) return map.get(kLower)!;
        if (map.has(kUpper)) return map.get(kUpper)!;
        if (clean && map.has(clean)) return map.get(clean)!;
        if (clean && map.has(`pt${clean}`)) return map.get(`pt${clean}`)!;
        if (clean && map.has(`PT${clean}`)) return map.get(`PT${clean}`)!;
        if (clean && map.has(`pe${clean}`)) return map.get(`pe${clean}`)!;
        if (clean && map.has(`PE${clean}`)) return map.get(`PE${clean}`)!;
      } else if (typeof map === "object") {
        if (map[key]) return map[key];
        if (map[kLower]) return map[kLower];
        if (map[kUpper]) return map[kUpper];
        if (clean && map[clean]) return map[clean];
        if (clean && map[`pt${clean}`]) return map[`pt${clean}`];
        if (clean && map[`PT${clean}`]) return map[`PT${clean}`];
        if (clean && map[`pe${clean}`]) return map[`pe${clean}`];
        if (clean && map[`PE${clean}`]) return map[`PE${clean}`];
      }
    }
    return null;
  };

  // 1. Direct lookup
  const directMatch = lookupToken(str);
  if (directMatch) return directMatch;

  // 2. Composite token splitting (e.g., "PT104 / CW1" or "PT104 CW1")
  const parts = str.split(/(\s*[\/\,\s]\s*)/);
  if (parts.length > 1) {
    let resolvedAny = false;
    const resolvedParts = parts.map(part => {
      const trimmed = part.trim();
      const match = lookupToken(trimmed);
      if (match) {
        resolvedAny = true;
        return match;
      }
      return part;
    });
    if (resolvedAny) {
      return resolvedParts.join("");
    }
  }

  return str;
}

export function resolveVendorName(
  rawVendor: unknown,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  bill?: Record<string, any>,
  peopleMap?: Map<string, string> | Record<string, string>
): string {
  const getFromBankMap = (k: string): BankLookupInfo | undefined => {
    if (!k) return undefined;
    const cleanK = k.trim();
    const mapsToCheck: Array<Map<string, BankLookupInfo> | Record<string, BankLookupInfo> | undefined> = [
      bankInfoMap,
      cachedBankInfoMap || undefined
    ];
    for (const map of mapsToCheck) {
      if (!map) continue;
      if (map instanceof Map) {
        if (map.has(cleanK)) return map.get(cleanK);
        if (map.has(cleanK.toLowerCase())) return map.get(cleanK.toLowerCase());
        if (map.has(cleanK.toUpperCase())) return map.get(cleanK.toUpperCase());
      } else if (typeof map === "object") {
        if (map[cleanK]) return map[cleanK];
        if (map[cleanK.toLowerCase()]) return map[cleanK.toLowerCase()];
        if (map[cleanK.toUpperCase()]) return map[cleanK.toUpperCase()];
      }
    }
    return undefined;
  };

  const isIdCode = (t: string): boolean => {
    return /^[a-zA-Z]{1,3}[-_]?\d+$/i.test((t || "").trim());
  };

  const hasUnresolvedCodes = (str: string): boolean => {
    if (!str) return false;
    const tokens = str.split(/[,/]/).map(t => t.trim()).filter(Boolean);
    return tokens.some(t => isIdCode(t));
  };

  const resolveSingleToken = (token: string): string => {
    const t = token.trim();
    if (!t || t === "-" || t === "non") return "";

    // 1. Direct ID match in bankInfoMap
    const info = getFromBankMap(t);
    if (info && (info.storeName || info.vendorName || info.accountName)) {
      return info.storeName || info.vendorName || info.accountName!;
    }

    // 2. Prefix stripped match (e.g. "st101" -> "101" or "ct101" -> "101")
    if (/^(st|ct|pe|pt)[-_]?\d+/i.test(t)) {
      const clean = t.toLowerCase().replace(/^(st|ct|pe|pt)[-_]?/i, "").trim();
      const infoClean = getFromBankMap(clean);
      if (infoClean && (infoClean.storeName || infoClean.vendorName || infoClean.accountName)) {
        return infoClean.storeName || infoClean.vendorName || infoClean.accountName!;
      }
    }

    // 3. Check peopleMap (which indexes stores and contractors too)
    const fromPeople = resolveRequesterNameFromMap(t, peopleMap);
    if (fromPeople && fromPeople !== t && fromPeople !== "-") {
      return fromPeople;
    }

    // 4. Composite format with dash (e.g. "ST101 - ปัญญาสตีล")
    if (t.includes(" - ")) {
      const parts = t.split(" - ");
      const info0 = getFromBankMap(parts[0].trim());
      if (info0 && (info0.storeName || info0.vendorName)) return info0.storeName || info0.vendorName!;
      if (parts[1] && !isIdCode(parts[1].trim())) return parts[1].trim();
    }

    // 5. Composite format with space (e.g. "ST101 ปัญญาสตีล")
    if (/^[a-zA-Z]{1,3}[-_]?\d+\s+/.test(t)) {
      const match = t.match(/^([a-zA-Z]{1,3}[-_]?\d+)\s+(.+)$/);
      if (match) {
        const codeInfo = getFromBankMap(match[1]);
        if (codeInfo && (codeInfo.storeName || codeInfo.vendorName)) {
          return codeInfo.storeName || codeInfo.vendorName!;
        }
        if (match[2] && !isIdCode(match[2])) {
          return match[2].trim();
        }
      }
    }

    return t;
  };

  const resolveTokenList = (input: string): string => {
    const trimmed = (input || "").trim();
    if (!trimmed || trimmed === "-" || trimmed === "non") return "-";

    if (trimmed.includes(",") || (trimmed.includes("/") && !trimmed.startsWith("http"))) {
      const separator = trimmed.includes(",") ? "," : "/";
      const tokens = trimmed.split(separator).map(s => s.trim()).filter(Boolean);
      if (tokens.length > 1 && tokens.some(t => isIdCode(t) || getFromBankMap(t))) {
        const resolved = tokens.map(tok => resolveSingleToken(tok)).filter(Boolean);
        const unique = Array.from(new Set(resolved));
        return unique.join(", ") || trimmed;
      }
    }

    return resolveSingleToken(trimmed);
  };

  if (bill) {
    const explicit = String(
      bill["ชื่อร้านค้า"] ||
      bill.store_name ||
      bill.storeName ||
      bill["ชื่อผู้รับเหมา"] ||
      bill.contractor_name ||
      bill.contractorName ||
      ""
    ).trim();
    if (explicit && explicit !== "-" && explicit !== "non") {
      if (!hasUnresolvedCodes(explicit)) {
        return explicit;
      }
      const resolvedExplicit = resolveTokenList(explicit);
      if (resolvedExplicit && resolvedExplicit !== "-" && !hasUnresolvedCodes(resolvedExplicit)) {
        return resolvedExplicit;
      }
    }

    const vendorOrPerson = String(
      bill["ร้าน/บุคคล"] ||
      bill.vendor_or_person ||
      bill.data?.["ร้าน/บุคคล"] ||
      bill.data?.vendor_or_person ||
      bill.data?.data?.["ร้าน/บุคคล"] ||
      bill.data?.data?.vendor_or_person ||
      ""
    ).trim();
    if (vendorOrPerson && vendorOrPerson !== "-" && vendorOrPerson !== "non") {
      if (!hasUnresolvedCodes(vendorOrPerson)) {
        return vendorOrPerson;
      }
      const resolvedVop = resolveTokenList(vendorOrPerson);
      if (resolvedVop && resolvedVop !== "-" && !hasUnresolvedCodes(resolvedVop)) {
        return resolvedVop;
      }
    }

    const storeId = String(
      bill["ร้านค้า"] ||
      bill.store_id ||
      bill.data?.["ร้านค้า"] ||
      bill.data?.store_id ||
      ""
    ).trim();
    if (storeId && storeId !== "-" && storeId !== "non") {
      const resolvedStoreId = resolveTokenList(storeId);
      if (resolvedStoreId && resolvedStoreId !== "-" && !hasUnresolvedCodes(resolvedStoreId)) {
        return resolvedStoreId;
      }
    }

    // Check items in bill for multi-store sub-bills
    const rawItems = bill.items || bill.data?.items || bill["รายการสินค้า"] || bill.line_items;
    let lineItems: any[] = [];
    if (Array.isArray(rawItems)) {
      lineItems = rawItems;
    } else if (typeof rawItems === "string" && rawItems.trim().startsWith("[")) {
      try { lineItems = JSON.parse(rawItems); } catch {}
    }
    if (lineItems.length > 0) {
      const itemStores = Array.from(new Set(
        lineItems.map(it => {
          const s = String(it.storeGroup || it.store_name || it.store || it.store_id || "").trim();
          if (!s || s.startsWith("ร้านที่ ")) return "";
          return resolveSingleToken(s);
        }).filter(name => Boolean(name) && !hasUnresolvedCodes(name))
      ));
      if (itemStores.length > 0) {
        return itemStores.join(", ");
      }
    }
  }

  const raw = String(rawVendor || "").trim();
  if (!raw || raw === "-" || raw === "non") return "-";

  const resolved = resolveTokenList(raw);
  if (resolved && resolved !== "-" && (!hasUnresolvedCodes(resolved) || !bill)) {
    return resolved;
  }

  // 5. Fallback: if bill has bankInfo already resolved and raw is an ID code
  if (bill) {
    const bInfo = resolveBankInfo(bill, bankInfoMap);
    if (bInfo && (bInfo.storeName || bInfo.accountName) && hasUnresolvedCodes(raw)) {
      return bInfo.storeName || bInfo.accountName!;
    }
  }

  return resolved || raw;
}

export function createMultiBillFlex(
  billsInput: Record<string, any> | Array<Record<string, any>>,
  options: MultiBillFlexOptions,
  peopleMap?: Map<string, string> | Record<string, string>,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  contractMap?: Map<string, any> | Record<string, any>,
  projectBudgetMap?: Map<string, any> | Record<string, any>,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>,
  pettyCashMap?: Map<string, PettyCashLookupInfo> | Record<string, PettyCashLookupInfo>
): Record<string, any> {
  const bills = Array.isArray(billsInput) ? billsInput : [billsInput];
  if (bills.length === 0) {
    return {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: "ไม่พบข้อมูลบิล" }]
      }
    };
  }

  function getRequesterDisplayName(b: Record<string, any>): string {
    if (b.requester_name || b["ชื่อผู้เบิก"] || b.requesterName) {
      return String(b.requester_name || b["ชื่อผู้เบิก"] || b.requesterName);
    }
    const raw = String(
      b["ผู้เบิก"] ||
      b.requester ||
      b.data?.["ผู้เบิก"] ||
      b.data?.requester ||
      b.data?.["ชื่อผู้เบิก"] ||
      ""
    ).trim();
    if (!raw) return "-";
    return resolveRequesterNameFromMap(raw, peopleMap);
  }

  function getCreatorDisplayName(b: Record<string, any>): string {
    const raw = String(
      b["ผู้สร้างบิล"] ||
      b.created_by ||
      b["ผู้บันทึก"] ||
      b["ผู้สร้างบิลตั้งเบิก"] ||
      b.creator ||
      b.data?.["ผู้สร้างบิล"] ||
      b.data?.created_by ||
      b.data?.["ผู้บันทึก"] ||
      b.data?.["ผู้สร้างบิลตั้งเบิก"] ||
      ""
    ).trim();
    if (!raw) return "";
    return resolveRequesterNameFromMap(raw, peopleMap);
  }

  const mode = options.mode || "search";

  const totalGrossAmount = bills.reduce((sum, b) => sum + getBillFlexGrossAmount(b), 0);
  const totalNetTransfer = bills.reduce((sum, b) => {
    const gross = getBillFlexGrossAmount(b);
    const dInfo = resolveBillDeductionInfo(b);
    const rawNet = Number(b["ยอดโอน"] || b.net_amount || b.data?.["ยอดโอน"] || b.data?.net_amount || 0);
    const items = extractBillLineItems(b);
    if (dInfo.hasDeduct && dInfo.deductAmt > 0) {
      return sum + (gross - dInfo.deductAmt);
    }
    if (items.length > 0 || !rawNet) {
      return sum + gross;
    }
    return sum + (rawNet > 0 ? rawNet : gross);
  }, 0);

  const hasAnyDeduction = bills.some(b => {
    const dInfo = resolveBillDeductionInfo(b);
    return dInfo.hasDeduct && dInfo.deductAmt > 0;
  });

  const formattedGrossTotal = totalGrossAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedNetTotal = totalNetTransfer.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const firstBill = bills[0];
  const firstReq = getRequesterDisplayName(firstBill);
  const firstCreator = getCreatorDisplayName(firstBill);
  const firstRawReq = firstBill["ผู้เบิก"] || firstBill.requester || firstBill.data?.["ผู้เบิก"] || firstBill.data?.requester;
  const firstPettyCash = resolvePettyCashInfo(firstRawReq, pettyCashMap, peopleMap);
  const hasSubBills = bills.some(b => isSubBillRecord(b));

  const allBillTypes = Array.from(new Set(bills.map(b => {
    const bt = String(b["บิล"] || b.bill || b.bill_type || "").trim();
    if (bt.includes("ย่อย")) return "บิลย่อย";
    if (bt.includes("หลัก")) return "บิลหลัก";
    return bt ? (bt.includes("บิล") ? bt : `บิล${bt}`) : "";
  }).filter(Boolean)));
  const firstBillTypeTag = allBillTypes.length === 1
    ? `[${allBillTypes[0]}]`
    : (allBillTypes.length > 1 ? "[บิลหลัก+ย่อย]" : "");
  const sheetRowIds = bills.map(b => String(b.id || b["ลำดับ"] || b._sheetRow || b.bill_no || "").trim()).filter(Boolean);
  const sheetRowStr = sheetRowIds.join(",");

  // Helper to extract image URLs from a bill object
  function getBillImages(b: Record<string, any>): string[] {
    const rawVal = b["รูปถ่ายบิล"] || b.bill_image || b.file_url || b.attachment || b.image || b.image_url || b.pictures || "";
    if (Array.isArray(rawVal)) {
      return rawVal.map(v => normalizeUri(String(v))).filter(v => v.startsWith("http"));
    }
    if (Array.isArray(b.image_urls) && b.image_urls.length > 0) {
      return b.image_urls.map((v: any) => normalizeUri(String(v))).filter((v: string) => v.startsWith("http"));
    }
    if (typeof rawVal === "string" && rawVal.trim()) {
      return rawVal.split(",").map(v => normalizeUri(v.trim())).filter(v => v.startsWith("http"));
    }
    return [];
  }

  const pageSize = 5;
  const maxBubbles = 10; // LINE Carousel supports up to 10 bubbles

  // Sort bills: group all sub-bills together by requester/bank account so they stay in a single box, followed by main bills
  const sortedBills = [...bills].sort((a, b) => {
    const isSubA = isSubBillRecord(a);
    const isSubB = isSubBillRecord(b);

    // Sub-bills grouped first, then main bills
    if (isSubA && !isSubB) return -1;
    if (!isSubA && isSubB) return 1;

    if (isSubA && isSubB) {
      const bankA = resolveRequesterBankInfo(a, bankInfoMap, peopleMap);
      const bankB = resolveRequesterBankInfo(b, bankInfoMap, peopleMap);
      const reqA = `${bankA.accountNo || ""}_${bankA.accountName || bankA.requesterName || getRequesterDisplayName(a)}`.trim();
      const reqB = `${bankB.accountNo || ""}_${bankB.accountName || bankB.requesterName || getRequesterDisplayName(b)}`.trim();
      const comp = reqA.localeCompare(reqB, "th");
      if (comp !== 0) return comp;
      const idA = Number(a.id || a["ลำดับ"] || a._sheetRow || 0);
      const idB = Number(b.id || b["ลำดับ"] || b._sheetRow || 0);
      return idA - idB;
    }

    // Both are main bills: sort by bill ID
    const idA = Number(a.id || a["ลำดับ"] || a._sheetRow || 0);
    const idB = Number(b.id || b["ลำดับ"] || b._sheetRow || 0);
    return idA - idB;
  });

  const displayBills = sortedBills.slice(0, pageSize * maxBubbles);
  const totalPages = Math.max(1, Math.ceil(displayBills.length / pageSize));

  function buildBubblePage(pageBills: typeof displayBills, pageIndex: number) {
    const startNum = pageIndex * pageSize + 1;
    const endNum = startNum + pageBills.length - 1;

    // 1. Top Summary Banner (Compact Header with Bill Type & Total)
    const topSummaryBanner = {
      type: "box",
      layout: "horizontal",
      paddingAll: "8px",
      backgroundColor: "#ECFDF5",
      cornerRadius: "6px",
      margin: "none",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 8,
          contents: [
            {
              type: "text",
              text: options.title,
              weight: "bold",
              color: "#065F46",
              size: "xs"
            },
            {
              type: "text",
              text: totalPages > 1
                ? `หน้า ${pageIndex + 1}/${totalPages} • ${firstBillTypeTag} ${bills.length} รายการ${firstReq && firstReq !== "-" ? ` | ผู้เบิก: ${firstReq}` : ""}`
                : `${firstBillTypeTag} ${bills.length} รายการ${firstReq && firstReq !== "-" ? ` | ผู้เบิก: ${firstReq}` : ""}`,
              color: "#047857",
              size: "xxs"
            }
          ]
        },
        {
          type: "text",
          text: `฿${hasAnyDeduction ? formattedNetTotal : formattedGrossTotal}`,
          weight: "bold",
          color: "#059669",
          size: "sm",
          align: "end",
          gravity: "center",
          flex: 4
        }
      ]
    };

    // 2. Bill Items List (Grouped by requester for sub-bills)
    const groupedCards: any[] = [];
    let currentSubGroup: {
      requesterKey: string;
      headerBox: any;
      billItems: any[];
    } | null = null;

    for (let idx = 0; idx < pageBills.length; idx++) {
      const b = pageBills[idx];
      const bId = String(b.id || b["ลำดับ"] || b._sheetRow || startNum + idx);
      const grossAmt = getBillFlexGrossAmount(b);
      const dInfo = resolveBillDeductionInfo(b);
      const deductAmt = dInfo.deductAmt;
      const hasDeduct = dInfo.hasDeduct;
      const rawNet = Number(b["ยอดโอน"] || b.net_amount || b.data?.["ยอดโอน"] || b.data?.net_amount || 0);
      const lineItems = extractBillLineItems(b);
      let netTransferAmt = hasDeduct
        ? (deductAmt > 0 ? grossAmt - deductAmt : (rawNet > 0 && rawNet <= grossAmt ? rawNet : grossAmt))
        : (lineItems.length > 0 || !rawNet ? grossAmt : (rawNet > 0 ? rawNet : grossAmt));

      const rawVatVal = b.vat ?? b["vat"] ?? b["VAT"] ?? b["Vat"] ?? b["ภาษี"] ?? b.data?.vat ?? b.data?.["vat"];
      const hasVatFlag = (rawVatVal !== null && rawVatVal !== undefined && String(rawVatVal).trim() !== "" && String(rawVatVal).trim() !== "-" && String(rawVatVal).trim() !== "0" && String(rawVatVal).toLowerCase() !== "ไม่มี" && String(rawVatVal).toLowerCase() !== "false") || Number(b.vat_amount || 0) > 0;
      if (!hasVatFlag && grossAmt > 0 && netTransferAmt > grossAmt) {
        netTransferAmt = hasDeduct && deductAmt > 0 ? grossAmt - deductAmt : grossAmt;
      }

      const cleanPercent = dInfo.deductPercent;
      const percentLabel = cleanPercent ? `หัก ${cleanPercent}%` : "หัก ณ ที่จ่าย";

      const requesterName = getRequesterDisplayName(b);
      const creatorName = getCreatorDisplayName(b);

      const rawCatName = String(b["ประเภท"] || b.category || b.data?.["ประเภท"] || "").trim();
      const rawStaffRef = b["ชื่อพนักงาน"] || b.staff_name || b["รหัสพนักงาน"] || b.data?.["ชื่อพนักงาน"] || b.data?.staff_name;
      const staffName = resolveStaffDisplayName(rawStaffRef, peopleMap);
      const isStaffBill = rawCatName.includes("พนักงาน") || rawCatName.startsWith("3.") || Boolean(rawStaffRef && !b["ผู้รับเหมา"]);

      const rawVendorType = String(b["ร้านค้า/ผู้รับเหมา"] || b.vendor_type || "").trim();
      const isContractor = !isStaffBill && (rawVendorType === "ผู้รับเหมา" || Boolean(b["ผู้รับเหมา"]) || Boolean(b.contractor_id));
      const vendorLabel = isStaffBill ? "พนักงาน" : (isContractor ? "ผู้รับเหมา" : "ร้าน");
      let rawVendorCandidate = "";
      if (isStaffBill) {
        rawVendorCandidate = staffName || rawStaffRef || "พนักงาน";
      } else if (isContractor) {
        rawVendorCandidate = b["ชื่อผู้รับเหมา"] || b.contractor_name || b["ผู้รับเหมา"] || b.contractor_id || b["ร้าน/บุคคล"] || b.vendor_or_person || "-";
      } else {
        const namedVendor = String(b["ชื่อร้านค้า"] || b.store_name || b["ร้าน/บุคคล"] || b.vendor_or_person || b.data?.["ร้าน/บุคคล"] || b.data?.vendor_or_person || "").trim();
        const idStore = String(b["ร้านค้า"] || b.store_id || b.data?.["ร้านค้า"] || "").trim();
        if (namedVendor && namedVendor !== "-" && namedVendor !== "non") {
          rawVendorCandidate = namedVendor;
        } else if (idStore) {
          rawVendorCandidate = idStore;
        } else {
          rawVendorCandidate = "-";
        }
      }
      const bankInfo = resolveBankInfo(b, bankInfoMap);
      const isSubBill = isSubBillRecord(b);
      const reqBank = resolveRequesterBankInfo(b, bankInfoMap, peopleMap);
      const rawReqKey = b["ผู้เบิก"] || b.requester || b.data?.["ผู้เบิก"] || b.data?.requester;
      const itemPettyCash = resolvePettyCashInfo(rawReqKey, pettyCashMap, peopleMap);
      let vendorName = isStaffBill ? (staffName || rawVendorCandidate) : resolveVendorName(rawVendorCandidate, bankInfoMap, b, peopleMap);
      if ((!vendorName || vendorName === "-" || /^[a-zA-Z]{1,3}[-_]?\d+$/i.test(vendorName) || /^[a-zA-Z]{1,3}[-_]?\d+(\s*,\s*[a-zA-Z]{1,3}[-_]?\d+)+$/i.test(vendorName)) && bankInfo) {
        vendorName = bankInfo.storeName || bankInfo.accountName || vendorName;
      }
      const projName = b["ชื่อ Project"] || b.project_name || b["โครงการ"] || b.project || b.data?.["ชื่อ Project"] || b.data?.["โครงการ"] || "โครงการทั่วไป";
      const desc = b["สินค้า/ทำงาน"] || b.description || b["รายละเอียดงาน"] || "-";
      const remainingLabor = String(b["ค่าแรงคงเหลือ"] || b.remaining_labor || "").trim();
      const laborStatus = String(b["statusค่าแรง"] || b.labor_status || "").trim();

      // Resolve contract details for contractor bills
      let matchedContract: any = null;
      const activeContractMap = contractMap || cachedContractMap;
      if (activeContractMap) {
        const rawContractor = String(b["_rawContractor"] || b.data?.["_rawContractor"] || b.conwork_id || b.contractor_id || b["ผู้รับเหมา"] || b.vendor_or_person || "").trim();
        const pId = String(b["ID Project"] || b.project_id || "").trim();
        const vendor = String(b["ผู้รับเหมา"] || b.vendor_or_person || b["ร้าน/บุคคล"] || "").trim();

        if (activeContractMap instanceof Map) {
          matchedContract = activeContractMap.get(rawContractor) ||
                            (pId && rawContractor ? activeContractMap.get(`${pId}_${rawContractor}`) : null) ||
                            (pId && vendor ? activeContractMap.get(`${pId}_${vendor}`) : null) ||
                            (vendor ? activeContractMap.get(vendor) : null) ||
                            (rawContractor ? activeContractMap.get(rawContractor.toLowerCase()) : null);
        } else if (typeof activeContractMap === "object") {
          matchedContract = activeContractMap[rawContractor] ||
                            (pId && rawContractor ? activeContractMap[`${pId}_${rawContractor}`] : null) ||
                            (pId && vendor ? activeContractMap[`${pId}_${vendor}`] : null) ||
                            (vendor ? activeContractMap[vendor] : null);
        }
      }

      const contractTotal = Number(
        matchedContract?.total_contract_amount ||
        matchedContract?.["ยอดเงินจ้าง"] ||
        b["ยอดเงินจ้าง"] ||
        b.total_contract_amount ||
        0
      );

      let paidNum = 0;
      if (b["ยอดเงินจ่าย"] && !isNaN(Number(b["ยอดเงินจ่าย"]))) {
        paidNum = Number(b["ยอดเงินจ่าย"]);
      } else if (remainingLabor.includes("จาก")) {
        const parts = remainingLabor.split("จาก").map(p => p.trim());
        const remNum = Number(parts[0].replace(/,/g, ""));
        const totalNum = Number(parts[1].replace(/,/g, ""));
        if (!isNaN(remNum) && !isNaN(totalNum) && totalNum > remNum) {
          paidNum = totalNum - remNum;
        }
      } else if (contractTotal > 0 && remainingLabor !== "") {
        const remNum = Number(remainingLabor.replace(/,/g, ""));
        if (!isNaN(remNum) && contractTotal >= remNum) {
          paidNum = contractTotal - remNum;
        }
      } else if (matchedContract && Number(matchedContract.paid_amount || matchedContract["ยอดเงินจ่าย"] || 0) > 0) {
        paidNum = Number(matchedContract.paid_amount || matchedContract["ยอดเงินจ่าย"]);
      }

      let derivedContractTotal = contractTotal;
      if (derivedContractTotal <= 0 && remainingLabor.includes("จาก")) {
        const parts = remainingLabor.split("จาก").map(p => p.trim());
        const totalNum = Number(parts[1].replace(/,/g, ""));
        if (!isNaN(totalNum) && totalNum > 0) {
          derivedContractTotal = totalNum;
        }
      }

      // Resolve project budget info for all bills
      const activeProjectMap = projectBudgetMap || cachedProjectBudgetMap;
      let projInfo: ProjectBudgetLookupInfo | null = null;
      if (activeProjectMap) {
        const pId = String(b["ID Project"] || b.project_id || b.data?.project_id || b.data?.["ID Project"] || "").trim();
        const pName = String(b["ชื่อ Project"] || b.project_name || b["โครงการ"] || b.project || b.data?.project_name || b.data?.["ชื่อ Project"] || b.data?.["โครงการ"] || "").trim();

        projInfo = (activeProjectMap instanceof Map)
          ? (activeProjectMap.get(pId) || activeProjectMap.get(pId.toLowerCase()) || activeProjectMap.get(pName) || activeProjectMap.get(pName.toLowerCase()))
          : (activeProjectMap[pId] || activeProjectMap[pName]);
      }

      const bStatus = String(b["สถานะ"] || b.status || b.data?.["สถานะ"] || b.data?.status || "").trim().toLowerCase();
      const isBillPaid = mode === "completed" || bStatus.includes("เบิกแล้ว") || bStatus.includes("ปิดงาน") || bStatus.includes("จ่ายแล้ว") || bStatus === "paid" || bStatus === "withdrawn";
      const billKey = String(b.id || b._sheetRow || b["ลำดับ"] || b.data?.id || b.data?.["ลำดับ"] || "").trim();
      const alreadyCountedInPaid = Boolean(billKey && projInfo?.paidBillIds && projInfo.paidBillIds.has(billKey));

      const isLaborBill = !isStaffBill && (isContractor || rawCatName.includes("ค่าแรง") || rawCatName.startsWith("2.") || Boolean(matchedContract) || derivedContractTotal > 0);
      const isIndividualLabor = isLaborBill && (!laborStatus || laborStatus.includes("บุคคลธรรมดา") || Number(b.vat_amount || 0) === 0);

      // Detect VAT tag (แสดงเฉพาะบิลที่มีการระบุ VAT จริงเท่านั้น และไม่รวมค่าแรงผู้รับเหมาบุคคลธรรมดา)
      let vatTag = "";
      const rawVat = b.vat ?? b["vat"] ?? b["VAT"] ?? b["Vat"] ?? b["ภาษี"] ?? b["ภาษีมูลค่าเพิ่ม"] ??
        b.data?.vat ?? b.data?.["vat"] ?? b.data?.["VAT"] ?? b.data?.["Vat"] ?? b.data?.["ภาษี"] ?? b.data?.["ภาษีมูลค่าเพิ่ม"];
      if (!isIndividualLabor && rawVat !== null && rawVat !== undefined) {
        const str = String(rawVat).trim();
        const lower = str.toLowerCase();
        if (str && str !== "-" && str !== "0" && str !== "0%" && str !== "0.00" && lower !== "ไม่มี" && lower !== "ไม่มี vat" && lower !== "false" && lower !== "no") {
          const numMatch = str.match(/\d+(\.\d+)?/);
          if (numMatch && Number(numMatch[0]) > 0) {
            vatTag = `(VAT ${numMatch[0]}%)`;
          } else {
            vatTag = "(VAT 7%)";
          }
        }
      }
      if (!vatTag && !isIndividualLabor) {
        const rawVatTotal = b["ยอดรวม vat"] ?? b["ยอดรวม VAT"] ?? b.data?.["ยอดรวม vat"] ?? b.data?.["ยอดรวม VAT"];
        if (rawVatTotal !== null && rawVatTotal !== undefined && String(rawVatTotal).trim() !== "" && String(rawVatTotal).trim() !== "-") {
          const num = Number(String(rawVatTotal).replace(/,/g, ""));
          if (!isNaN(num) && grossAmt > 0 && num > grossAmt * 1.01) {
            vatTag = "(VAT 7%)";
          }
        }
      }
      if (isIndividualLabor) {
        vatTag = "";
      }

      // Deduction tag (only when deduction is actually active)
      const deductTag = dInfo.hasDeduct
        ? (dInfo.deductPercent ? `(หัก ${dInfo.deductPercent}%${dInfo.deductAmt > 0 ? ` -฿${dInfo.deductAmt.toLocaleString("th-TH")}` : ""})` : "(หัก)")
        : "";

      // Combined Sub-tag under price
      const priceSubTag = [vatTag, deductTag].filter(Boolean).join(" ");

      let laborLine1 = "";
      let laborLine2 = "";
      let laborLine3 = "";
      let budgetSummaryText = "";
      let percentUsed = 0;

      if (isLaborBill) {
        // Line 1: Overall Project Labor Budget (e.g. งบค่าแรงทั้งหมด 100,000 | 50,000 (50%))
        const openHireBudget = Number(b["งบไม่เกินค่าแรง"] || b.data?.["งบไม่เกินค่าแรง"] || projInfo?.catBudgets?.["ค่าแรง"] || 0);
        const staffLaborBudget = Number(b["งบไม่เกินพนักงาน"] || b.data?.["งบไม่เกินพนักงาน"] || projInfo?.catBudgets?.["พนักงาน"] || 0);
        const totalLaborBudget = (openHireBudget + staffLaborBudget) > 0 ? (openHireBudget + staffLaborBudget) : openHireBudget;

        let projectLaborSpent = Number(projInfo?.catSpent?.["ค่าแรง"] || projInfo?.catPaidSpent?.["ค่าแรง"] || 0);
        if (projectLaborSpent === 0 && grossAmt > 0) {
          projectLaborSpent = grossAmt;
        } else if (!alreadyCountedInPaid && isBillPaid) {
          projectLaborSpent += grossAmt;
        }
        const laborPercent = totalLaborBudget > 0 ? Math.round((projectLaborSpent / totalLaborBudget) * 100) : 0;
        laborLine1 = totalLaborBudget > 0
          ? `งบค่าแรงทั้งหมด ${totalLaborBudget.toLocaleString("th-TH")} | ${projectLaborSpent.toLocaleString("th-TH")} (${laborPercent}%)`
          : (projectLaborSpent > 0 ? `งบค่าแรงทั้งหมด: ไม่ได้ตั้ง | ${projectLaborSpent.toLocaleString("th-TH")}` : `งบค่าแรงทั้งหมด: -`);

        // Line 2: งบเปิดจ้าง [ยอดงบเปิดจ้าง] | จ่ายแล้ว [ยอดจ่ายสะสมของสัญญา] ([%])
        const hireBudgetCap = derivedContractTotal > 0 ? derivedContractTotal : openHireBudget;

        if (hireBudgetCap > 0 || paidNum > 0) {
          if (derivedContractTotal > 0) {
            const paidPercent = Math.round((paidNum / derivedContractTotal) * 100);
            laborLine2 = `งบเปิดจ้าง ${hireBudgetCap.toLocaleString("th-TH")} | จ่ายแล้ว ${paidNum.toLocaleString("th-TH")} (${paidPercent}%)`;
          } else if (hireBudgetCap > 0) {
            laborLine2 = paidNum > 0
              ? `งบเปิดจ้าง ${hireBudgetCap.toLocaleString("th-TH")} | จ่ายแล้ว ${paidNum.toLocaleString("th-TH")}`
              : `งบเปิดจ้าง ${hireBudgetCap.toLocaleString("th-TH")} | จ่ายแล้ว 0 (0%)`;
          } else {
            laborLine2 = `จ่ายแล้ว ${paidNum.toLocaleString("th-TH")}`;
          }
        }

        // Line 3: เบิก [ยอดขอเบิกบิลนี้]
        if (grossAmt > 0) {
          laborLine3 = `เบิก ${grossAmt.toLocaleString("th-TH")}`;
        }
      } else if (isStaffBill) {
        // Staff Expense / Advance -> Staff Budget Control ("งบพนักงาน" หรือ "งบค่าแรงทั้งหมด" หากไม่ได้ตั้งค่าแรงพนักงาน)
        const staffBudget = Number(
          b["งบไม่เกินพนักงาน"] ||
          b.data?.["งบไม่เกินพนักงาน"] ||
          projInfo?.catBudgets?.["พนักงาน"] ||
          projInfo?.allBudgets?.["งบไม่เกินพนักงาน"] ||
          0
        );
        const staffPaid = Number(projInfo?.catPaidSpent?.["พนักงาน"] || 0) + (isBillPaid && !alreadyCountedInPaid ? grossAmt : 0);

        if (staffBudget > 0) {
          percentUsed = Math.round((staffPaid / staffBudget) * 100);
          budgetSummaryText = `งบพนักงาน   ฿${staffBudget.toLocaleString("th-TH")} / เบิกแล้ว ฿${staffPaid.toLocaleString("th-TH")} (${percentUsed}%)`;
        } else {
          // หากไม่ได้ตั้งค่าแรงพนักงาน -> ดึงควบคุมค่าแรงทั้งหมดของโครงการมาแสดง
          const openHireBudget = Number(
            b["งบไม่เกินค่าแรง"] ||
            b.data?.["งบไม่เกินค่าแรง"] ||
            projInfo?.catBudgets?.["ค่าแรง"] ||
            projInfo?.allBudgets?.["งบไม่เกินค่าแรง"] ||
            0
          );
          const totalLaborBudget = openHireBudget > 0 ? openHireBudget : Number(projInfo?.budget || 0);

          let totalLaborPaid = Number(projInfo?.catPaidSpent?.["ค่าแรง"] || 0) + Number(projInfo?.catPaidSpent?.["พนักงาน"] || 0);
          if (totalLaborPaid === 0) {
            const spentSum = Number(projInfo?.catSpent?.["ค่าแรง"] || 0) + Number(projInfo?.catSpent?.["พนักงาน"] || 0);
            if (spentSum > 0) {
              totalLaborPaid = spentSum;
            }
          }
          if (isBillPaid && !alreadyCountedInPaid) {
            totalLaborPaid += grossAmt;
          }

          if (totalLaborBudget > 0) {
            percentUsed = Math.round((totalLaborPaid / totalLaborBudget) * 100);
            budgetSummaryText = `งบค่าแรงทั้งหมด   ฿${totalLaborBudget.toLocaleString("th-TH")} / เบิกแล้ว ฿${totalLaborPaid.toLocaleString("th-TH")} (${percentUsed}%)`;
          } else if (totalLaborPaid > 0) {
            budgetSummaryText = `งบค่าแรงทั้งหมด   เบิกแล้ว ฿${totalLaborPaid.toLocaleString("th-TH")}`;
          }
        }
      } else {
        // General Store Bill / Non-labor Bill -> Material Budget Control ("งบค่าของ")
        if (projInfo) {
          // 1. คำนวณงบค่าของ (Material Budget):
          // ดึงจาก catBudgets["ค่าของ"] หรือ allBudgets["งบไม่เกินค่าของ"]
          let materialBudget = Number(projInfo.catBudgets?.["ค่าของ"] || projInfo.allBudgets?.["งบไม่เกินค่าของ"] || 0);

          // หักลบงบค่าแรงทั้งหมดกรณีระบุแค่งบโครงการรวม
          const laborDirectBudget = Number(projInfo.catBudgets?.["ค่าแรง"] || projInfo.allBudgets?.["งบไม่เกินค่าแรง"] || 0);
          const staffLaborBudget = Number(projInfo.catBudgets?.["พนักงาน"] || projInfo.allBudgets?.["งบไม่เกินพนักงาน"] || 0);
          const totalLaborBudget = laborDirectBudget + staffLaborBudget;

          if (materialBudget <= 0 && Number(projInfo.budget) > 0) {
            materialBudget = Math.max(0, Number(projInfo.budget) - totalLaborBudget);
            if (materialBudget <= 0) {
              materialBudget = Number(projInfo.budget);
            }
          }

          // 2. คำนวณยอดเบิกจ่ายจริงของหมวดค่าของ (Material Paid/Spent):
          // รวมยอดเบิกจ่ายทุกหมวดที่ไม่ใช่ค่าแรง (ค่าของ, เครื่องจักร, น้ำมัน, ซ่อมรถ, เครื่องมือ, อื่นๆ, ฯลฯ)
          const totalLaborPaid = Number(projInfo.catPaidSpent?.["ค่าแรง"] || 0) + Number(projInfo.catPaidSpent?.["พนักงาน"] || 0);
          const nonLaborCatPaid = Object.entries(projInfo.catPaidSpent || {})
            .filter(([cat]) => cat !== "ค่าแรง" && cat !== "พนักงาน")
            .reduce((sum, [, val]) => sum + Number(val || 0), 0);

          let materialPaid = Math.max(
            Number(projInfo.catPaidSpent?.["ค่าของ"] || 0),
            nonLaborCatPaid,
            Math.max(0, Number(projInfo.paidSpent || 0) - totalLaborPaid)
          );

          if (isBillPaid && !alreadyCountedInPaid) {
            materialPaid += grossAmt;
          }

          percentUsed = materialBudget > 0 ? Math.round((materialPaid / materialBudget) * 100) : 0;

          if (materialBudget > 0) {
            budgetSummaryText = `งบค่าของ   ฿${materialBudget.toLocaleString("th-TH")} / เบิกแล้ว ฿${materialPaid.toLocaleString("th-TH")} (${percentUsed}%)`;
          } else if (materialPaid > 0) {
            budgetSummaryText = `งบค่าของ   เบิกแล้ว ฿${materialPaid.toLocaleString("th-TH")}`;
          }
        }
      }

      const imgList = getBillImages(b);
      const hasImages = imgList.length > 0;

      const isFuelBill = rawCatName.includes("น้ำมัน") || rawCatName.startsWith("4.");
      const isRepairBill = rawCatName.includes("ซ่อมรถ") || rawCatName.startsWith("5.");
      const isToolBill = rawCatName.includes("เครื่องมือ") || rawCatName.startsWith("7.");
      const isOtherBill = rawCatName.includes("อื่นๆ") || rawCatName.startsWith("8.");

      const rawCarRef = b["ทะเบียน"] || b.plate_no || b["id_car"] || b.id_car;
      const carPlate = resolveCarDisplayName(rawCarRef, carsMap);

      const toolName = String(b["ชื่อเครื่องมือ"] || b.tool_name || "").trim();
      const otherName = String(b["รายการ"] || b.sub_category || "").trim();

      const productName = b["สินค้า"] || b.product || "";
      const categoryName = b["ประเภท"] || b.category || "";

      const rawWorkDesc = String(
        b["รายละเอียดงาน"] ||
        b.data?.["รายละเอียดงาน"] ||
        b["สินค้า/ทำงาน"] ||
        b.data?.["สินค้า/ทำงาน"] ||
        b.description ||
        b.data?.description ||
        ""
      ).trim();
      const cleanWorkDesc = sanitizeFlexItemDescription(rawWorkDesc, carsMap, peopleMap);

      const textDetailsBox: Record<string, any> = {
        type: "box",
        layout: "vertical",
        spacing: "none",
        contents: [
          // Row 1: Title & Net Transfer Amount (with VAT / Deduct tags underneath price)
          {
            type: "box",
            layout: "horizontal",
            margin: "none",
            contents: [
              { type: "text", text: `#${bId}${isSubBill ? " [บิลย่อย]" : ""} | ${projName}`, weight: "bold", size: "xs", color: "#0F172A", flex: 7, wrap: true },
              {
                type: "box",
                layout: "vertical",
                flex: 5,
                spacing: "none",
                contents: [
                  {
                    type: "text",
                    text: `฿${netTransferAmt.toLocaleString("th-TH")}`,
                    weight: "bold",
                    size: "xs",
                    color: "#DC2626",
                    align: "end"
                  },
                  ...(priceSubTag ? [
                    {
                      type: "text",
                      text: priceSubTag,
                      weight: "bold",
                      size: "xxs",
                      color: "#DC2626",
                      align: "end",
                      wrap: true
                    }
                  ] : [])
                ]
              }
            ]
          },
          // Row 2: Vendor/Contractor (Omit for staff bills to avoid duplication with item line)
          ...(!isStaffBill && vendorName && vendorName !== "-" ? [
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                { type: "text", text: `${vendorLabel}: ${vendorName}`, size: "xxs", color: "#1E293B", weight: "bold", wrap: true }
              ]
            }
          ] : []),
          // Row 2.2: Payment Due Date (กำหนดชำระเฉพาะบิลเครดิต เอาวันที่บิลออกทั้งหมดตามที่ผู้ใช้ร้องขอ)
          ...(() => {
            const rawDueDate = b["วันจ่าย"] || b.due_date || b.data?.["วันจ่าย"] || b.data?.due_date;
            const rawCredit = b["เครดิต"] || b.credit || b.data?.["เครดิต"] || b.data?.credit || b["เครดิตจ่าย"] || b.credit_payment_day;

            if (!rawDueDate) return [];
            return [
              {
                type: "box",
                layout: "baseline",
                margin: "xs",
                contents: [
                  { type: "text", text: "กำหนดชำระ:", size: "xxs", color: "#64748B", flex: 3 },
                  {
                    type: "text",
                    text: `${rawDueDate}${rawCredit ? ` (เครดิต ${rawCredit})` : ""}`,
                    size: "xxs",
                    color: "#0284C7",
                    weight: "bold",
                    flex: 9,
                    wrap: true
                  }
                ]
              }
            ];
          })(),
          // Row 3: Labor Breakdown (3 Clean Lines as requested by user)
          ...(isLaborBill ? [
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              spacing: "none",
              contents: [
                {
                  type: "text",
                  text: laborLine1,
                  size: "xxs",
                  color: "#B45309",
                  weight: "bold",
                  wrap: true
                },
                ...(laborLine2 ? [
                  {
                    type: "text",
                    text: laborLine2,
                    size: "xxs",
                    color: "#D97706",
                    weight: "bold",
                    wrap: true
                  }
                ] : []),
                ...(laborLine3 ? [
                  {
                    type: "text",
                    text: laborLine3,
                    size: "xxs",
                    color: "#059669",
                    weight: "bold",
                    wrap: true
                  }
                ] : [])
              ]
            }
          ] : [
            // Row 3 (Store / Other Bills): Budget Summary if present
            ...(budgetSummaryText ? [
              {
                type: "box",
                layout: "horizontal",
                margin: "none",
                contents: [
                  {
                    type: "text",
                    text: budgetSummaryText,
                    size: "xxs",
                    color: percentUsed > 100 ? "#DC2626" : "#D97706",
                    weight: "bold",
                    wrap: true
                  }
                ]
              }
            ] : [])
          ]),
          // Row 6: Bank Account Information (2 Clean Lines - skip for sub-bills / บิลย่อย)
          ...(!isSubBill && bankInfo && (bankInfo.accountNo || bankInfo.bankName || bankInfo.accountName) ? [
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              paddingAll: "5px",
              backgroundColor: "#F0F9FF",
              cornerRadius: "4px",
              spacing: "none",
              contents: [
                ...(bankInfo.accountName ? [
                  {
                    type: "text",
                    text: `ชื่อ: ${bankInfo.accountName}`,
                    size: "xxs",
                    color: "#1E293B",
                    weight: "bold",
                    wrap: false,
                    maxLines: 1
                  }
                ] : []),
                {
                  type: "box",
                  layout: "horizontal",
                  alignItems: "center",
                  contents: [
                    {
                      type: "text",
                      text: `เลข: ${bankInfo.accountNo || "-"}`,
                      size: "xs",
                      color: "#059669",
                      weight: "bold",
                      flex: 7
                    },
                    {
                      type: "text",
                      text: `ธนาคาร: ${bankInfo.bankName || "-"}`,
                      size: "xxs",
                      color: "#475569",
                      align: "end",
                      flex: 5,
                      wrap: false,
                      maxLines: 1
                    }
                  ]
                }
              ]
            }
          ] : []),
          // Row 7 (Store & Contractor): Single Product / Work Category Row
          ...((productName || categoryName || isContractor || isFuelBill || isRepairBill || isStaffBill || isToolBill || isOtherBill) && lineItems.length === 0 ? (() => {
            let resolvedTitle = productName;
            if (isContractor) {
              resolvedTitle = categoryName || productName || String((b as any)["ประเภท"] || (b as any).category || (b as any)["สินค้า"] || (b as any).product || (b as any).data?.["ประเภท"] || (b as any).data?.["สินค้า"] || "ค่าแรง").trim();
            } else if (isFuelBill) {
              resolvedTitle = carPlate ? `น้ำมัน (${carPlate})` : (productName || "น้ำมัน");
            } else if (isRepairBill) {
              resolvedTitle = carPlate ? `ซ่อมรถ (${carPlate})` : (productName || "ซ่อมรถ");
            } else if (isStaffBill) {
              resolvedTitle = staffName ? `พนักงาน (${staffName})` : (productName || "พนักงาน");
            } else if (isToolBill) {
              resolvedTitle = toolName ? `เครื่องมือ (${toolName})` : (productName || "เครื่องมือ");
            } else if (isOtherBill) {
              resolvedTitle = otherName ? `อื่นๆ (${otherName})` : (productName || "อื่นๆ");
            } else {
              resolvedTitle = sanitizeFlexItemDescription(productName, carsMap, peopleMap);
            }

            if (!resolvedTitle || resolvedTitle === "-") return [];

            const cleanProdName = isContractor ? resolvedTitle : (resolvedTitle.replace(/^\d+[\.\s\-]+/, "").trim() || resolvedTitle);
            const singleBudgetField = resolveProductBudgetField(resolvedTitle) || resolveProductBudgetField(resolvedTitle.replace(/^\d+[\.\s\-]+/, "").trim()) || resolveProductBudgetField(categoryName);
            const { cap: singleCap, actualField } = getBudgetCapForField(singleBudgetField, projInfo?.allBudgets);
            let singleTag = "";
            let singleIsOver = false;
            if (singleCap > 0 && actualField) {
              const singlePaid = Number(projInfo?.productPaidSpent?.[actualField] || 0);
              // หากยังไม่ได้ปิดงาน (เช่น ตั้งเบิก, ดำเนินการ, รออนุมัติ) อย่าเพิ่งลบยอดบิลนี้ออกจากงบคงเหลือ
              const singleRemaining = (isBillPaid && alreadyCountedInPaid)
                ? (singleCap - singlePaid)
                : isBillPaid
                  ? (singleCap - (singlePaid + grossAmt))
                  : (singleCap - singlePaid);
              singleIsOver = singleRemaining < 0;
              const remTag = singleRemaining < 0
                ? `⚠️ เกิน ${Math.abs(singleRemaining).toLocaleString("th-TH")}`
                : `เหลือ ${singleRemaining.toLocaleString("th-TH")}`;
              singleTag = `(${remTag} | งบ ${singleCap.toLocaleString("th-TH")})`;
            } else if (categoryName && !isContractor) {
              const cleanType = categoryName.replace(/^\d+[\.\s\-]+/, "").trim();
              if (cleanType && !cleanProdName.includes(cleanType)) singleTag = `(${cleanType})`;
            }
            return [
              {
                type: "box",
                layout: "vertical",
                margin: "xs",
                paddingAll: "4px",
                backgroundColor: "#F8FAFC",
                cornerRadius: "4px",
                spacing: "xs",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: `• ${cleanProdName}`, size: "xxs", color: "#1E293B", weight: "bold", wrap: true, flex: 7 },
                      { type: "text", text: `฿${grossAmt.toLocaleString("th-TH")}`, size: "xxs", color: "#059669", weight: "bold", align: "end", flex: 5 }
                    ]
                  },
                  ...(singleTag ? [
                    {
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "text",
                          text: `  ${singleTag}`,
                          size: "xxs",
                          color: singleIsOver ? "#DC2626" : singleCap > 0 ? "#0284C7" : "#64748B",
                          weight: singleIsOver ? "bold" : "regular",
                          wrap: true
                        }
                      ]
                    }
                  ] : [])
                ]
              }
            ];
          })() : []),
          // Row 8: Itemized Multi-Line Products
          ...(lineItems.length > 0 ? (() => {
            const billRunningProductSpent: Record<string, number> = {};
            return [
              {
                type: "box",
                layout: "vertical",
                margin: "xs",
                paddingAll: "4px",
                backgroundColor: "#F8FAFC",
                cornerRadius: "4px",
                spacing: "xs",
                contents: lineItems.map((item, iIdx) => {
                  const itemAmtNum = Number(item.amount ?? item.price ?? item.total ?? 0);
                  const itemAmt = itemAmtNum.toLocaleString("th-TH");
                  const rawCat = String(item.category || "").trim();
                  const rawName = String(item.name || "").trim();
                  const rawDetail = String(item.detail || "").trim();
                  const cleanCat = rawCat.replace(/^\d+\.?\s*\d*\.?\s*/, "").trim();
                  const cleanName = rawName.replace(/^\d+\.?\s*\d*\.?\s*/, "").trim();

                  let itemTitle = "";
                  if (isContractor || isLaborBill) {
                    const catDisplay = rawCat || cleanCat || "ค่าแรง";
                    if (rawDetail && !catDisplay.includes(rawDetail)) {
                      itemTitle = `${catDisplay} - ${rawDetail}`;
                    } else {
                      itemTitle = catDisplay;
                    }
                  } else {
                    if (cleanCat && cleanName && cleanCat !== cleanName) {
                      itemTitle = `${cleanCat} ${cleanName}`;
                    } else {
                      itemTitle = cleanName || cleanCat || `สินค้า ${iIdx + 1}`;
                    }
                    if (rawDetail && !itemTitle.includes(rawDetail)) {
                      itemTitle = `${itemTitle} (${rawDetail})`;
                    }
                  }
                  itemTitle = sanitizeFlexItemDescription(itemTitle, carsMap, peopleMap);

                  const budgetField = resolveProductBudgetField(rawCat) || resolveProductBudgetField(cleanCat) || resolveProductBudgetField(rawName);
                  const { cap: budgetCap, actualField } = getBudgetCapForField(budgetField, projInfo?.allBudgets);

                  let budgetTag = "";
                  let isOver = false;
                  if (budgetCap > 0 && actualField) {
                    const paidSpent = Number(projInfo?.productPaidSpent?.[actualField] || 0);
                    const priorInThisBill = billRunningProductSpent[actualField] || 0;
                    // หากยังไม่ได้ปิดงาน (เช่น ตั้งเบิก, ดำเนินการ, รออนุมัติ) อย่าเพิ่งลบยอดบิลนี้ออกจากงบคงเหลือ
                    const remaining = (isBillPaid && alreadyCountedInPaid)
                      ? (budgetCap - (paidSpent + priorInThisBill))
                      : isBillPaid
                        ? (budgetCap - (paidSpent + priorInThisBill + itemAmtNum))
                        : (budgetCap - (paidSpent + priorInThisBill));
                    if (isBillPaid) {
                      billRunningProductSpent[actualField] = priorInThisBill + itemAmtNum;
                    }

                    isOver = remaining < 0;
                    const remTag = remaining < 0
                      ? `⚠️เกิน ${Math.abs(remaining).toLocaleString("th-TH")}`
                      : `เหลือ ${remaining.toLocaleString("th-TH")}`;
                    budgetTag = `(${remTag} | งบ ${budgetCap.toLocaleString("th-TH")})`;
                  } else {
                    const rawType = String(item.categoryType || item.type || "").trim();
                    const cleanType = rawType.replace(/^\d+\.?\s*/, "").trim();
                    const rawSub = String(item.subItem || "").trim();
                    if (rawSub) {
                      budgetTag = `(${rawSub})`;
                    } else if (cleanType && !itemTitle.includes(cleanType) && !isContractor) {
                      budgetTag = `(${cleanType})`;
                    }
                  }

                  return {
                    type: "box",
                    layout: "vertical",
                    margin: iIdx > 0 ? "xs" : "none",
                    spacing: "none",
                    contents: [
                      {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          {
                            type: "text",
                            text: `• ${itemTitle}`,
                            size: "xxs",
                            color: "#1E293B",
                            weight: "bold",
                            flex: 7,
                            wrap: true
                          },
                          {
                            type: "text",
                            text: `฿${itemAmt}`,
                            size: "xxs",
                            color: "#059669",
                            weight: "bold",
                            align: "end",
                            flex: 5
                          }
                        ]
                      },
                      ...(budgetTag ? [
                        {
                          type: "box",
                          layout: "horizontal",
                          contents: [
                            {
                              type: "text",
                              text: `  ${budgetTag}`,
                              size: "xxs",
                              color: isOver ? "#DC2626" : budgetCap > 0 ? "#0284C7" : "#64748B",
                              weight: isOver ? "bold" : "regular",
                              wrap: true
                            }
                          ]
                        }
                      ] : [])
                    ]
                  };
                })
              }
            ];
          })() : [])
        ]
      };

      let multiImgRow: any = null;
      if (hasImages) {
        const displayedImgs = imgList.slice(0, 4);
        const imgColumns: any[] = displayedImgs.map((imgUrl, imgIdx) => ({
          type: "image",
          url: imgUrl,
          aspectRatio: "3:2",
          aspectMode: "cover",
          flex: 1,
          action: {
            type: "uri",
            label: `รูปที่ ${imgIdx + 1}`,
            uri: normalizeUri(imgUrl)
          }
        }));

        while (imgColumns.length < 4) {
          imgColumns.push({ type: "filler" });
        }

        multiImgRow = {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          spacing: "xs",
          contents: imgColumns
        };
      }

      const singleBillContents = [
        textDetailsBox,
        ...(multiImgRow ? [multiImgRow] : [])
      ];

      if (isSubBill) {
        const reqKey = `${reqBank.accountNo || ""}_${reqBank.accountName || reqBank.requesterName || requesterName}`.trim();

        if (currentSubGroup && currentSubGroup.requesterKey === reqKey) {
          // Same requester & bank account: append to existing card with separator
          currentSubGroup.billItems.push({
            type: "separator",
            margin: "sm",
            color: "#CBD5E1"
          });
          currentSubGroup.billItems.push({
            type: "box",
            layout: "vertical",
            margin: "xs",
            contents: singleBillContents
          });
        } else {
          // Different requester or first sub-bill: finalize previous group if exists
          if (currentSubGroup) {
            groupedCards.push({
              type: "box",
              layout: "vertical",
              margin: "xs",
              paddingAll: "6px",
              backgroundColor: "#F8FAFC",
              cornerRadius: "6px",
              contents: [
                currentSubGroup.headerBox,
                ...currentSubGroup.billItems
              ]
            });
          }

          // Build prominent requester bank account header (shown once per group)
          const bankHeaderBox = {
            type: "box",
            layout: "vertical",
            margin: "none",
            paddingAll: "6px",
            backgroundColor: "#FEF3C7",
            cornerRadius: "6px",
            borderWidth: "1px",
            borderColor: "#F59E0B",
            spacing: "none",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: `👤 ผู้เบิก: ${reqBank.accountName || reqBank.requesterName || requesterName}`,
                    size: "xxs",
                    color: "#92400E",
                    weight: "bold",
                    flex: 1,
                    wrap: true
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "xs",
                alignItems: "center",
                contents: [
                  {
                    type: "text",
                    text: `เลข: ${reqBank.accountNo || "ไม่มีเลขบัญชี"}`,
                    size: "xs",
                    color: reqBank.accountNo ? "#047857" : "#DC2626",
                    weight: "bold",
                    flex: 7
                  },
                  {
                    type: "text",
                    text: `ธ.${reqBank.bankName || "-"}`,
                    size: "xxs",
                    color: "#78350F",
                    align: "end",
                    flex: 5,
                    wrap: false,
                    maxLines: 1
                  }
                ]
              },
              ...(itemPettyCash && itemPettyCash.remaining > 0 ? [
                {
                  type: "separator",
                  margin: "xs",
                  color: "#FCD34D"
                },
                {
                  type: "box",
                  layout: "horizontal",
                  margin: "xs",
                  paddingAll: "2px",
                  alignItems: "center",
                  contents: [
                    {
                      type: "text",
                      text: "🪙 เบิกไว้ก่อน:",
                      size: "xxs",
                      color: "#92400E",
                      weight: "bold",
                      flex: 5
                    },
                    {
                      type: "text",
                      text: `฿${itemPettyCash.remaining.toLocaleString("th-TH")}`,
                      size: "xs",
                      color: "#DC2626",
                      weight: "bold",
                      align: "end",
                      flex: 7
                    }
                  ]
                }
              ] : [])
            ]
          };

          currentSubGroup = {
            requesterKey: reqKey,
            headerBox: bankHeaderBox,
            billItems: [
              {
                type: "box",
                layout: "vertical",
                margin: "xs",
                contents: singleBillContents
              }
            ]
          };
        }
      } else {
        // Non sub-bill (บิลหลัก)
        if (currentSubGroup) {
          groupedCards.push({
            type: "box",
            layout: "vertical",
            margin: "xs",
            paddingAll: "6px",
            backgroundColor: "#F8FAFC",
            cornerRadius: "6px",
            contents: [
              currentSubGroup.headerBox,
              ...currentSubGroup.billItems
            ]
          });
          currentSubGroup = null;
        }

        groupedCards.push({
          type: "box",
          layout: "vertical",
          margin: "xs",
          paddingAll: "6px",
          backgroundColor: "#F8FAFC",
          cornerRadius: "6px",
          contents: singleBillContents
        });
      }
    }

    if (currentSubGroup) {
      groupedCards.push({
        type: "box",
        layout: "vertical",
        margin: "xs",
        paddingAll: "6px",
        backgroundColor: "#F8FAFC",
        cornerRadius: "6px",
        contents: [
          currentSubGroup.headerBox,
          ...currentSubGroup.billItems
        ]
      });
      currentSubGroup = null;
    }

    const itemsContents = groupedCards;

    // 3. Bottom Total Sum Box (Only when multiple bills)
    const bottomTotalSumBox = bills.length > 1 ? {
      type: "box",
      layout: "horizontal",
      margin: "xs",
      paddingAll: "6px",
      backgroundColor: "#ECFDF5",
      cornerRadius: "6px",
      contents: [
        {
          type: "text",
          text: hasAnyDeduction ? `รวมโอนสุทธิ (${bills.length} รายการ)` : `รวมทั้งสิ้น (${bills.length} รายการ)`,
          weight: "bold",
          color: "#065F46",
          size: "xxs",
          flex: 6,
          gravity: "center"
        },
        {
          type: "text",
          text: `฿${hasAnyDeduction ? formattedNetTotal : formattedGrossTotal}`,
          weight: "bold",
          color: "#059669",
          size: "xs",
          flex: 6,
          align: "end",
          gravity: "center"
        }
      ]
    } : null;

    // 4. Footer Action Buttons (Compact Height)
    let footerButtons: any[] = [];
    if (mode === "requester") {
      footerButtons = [
        {
          type: "button",
          style: "primary",
          color: "#059669",
          height: "sm",
          action: {
            type: "message",
            label: bills.length > 1 ? `ส่งไปเพื่ออนุมัติ (${bills.length} รายการ)` : `ส่งไปเพื่ออนุมัติ (#${sheetRowStr})`,
            text: bills.length === 1 ? `ส่งไปเพื่ออนุมัติบิลลำดับที่: ${sheetRowStr}` : `ส่งไปเพื่ออนุมัติ:${sheetRowStr}`
          }
        }
      ];
    } else if (mode === "owner") {
      footerButtons = [
        {
          type: "button",
          style: "primary",
          color: "#059669",
          height: "sm",
          flex: 6,
          action: {
            type: "message",
            label: `อนุมัติทั้งหมด (${bills.length} รายการ)`,
            text: bills.length === 1 ? `อนุมัติบิลลำดับที่: ${sheetRowStr}` : `อนุมัติบิลลำดับที่: ${sheetRowStr}`
          }
        },
        {
          type: "button",
          style: "primary",
          color: "#DC2626",
          height: "sm",
          flex: 6,
          action: {
            type: "message",
            label: `ไม่อนุมัติ (${bills.length} รายการ)`,
            text: bills.length === 1 ? `ไม่อนุมัติบิลลำดับที่: ${sheetRowStr}` : `ไม่อนุมัติบิลลำดับที่: ${sheetRowStr}`
          }
        }
      ];
    } else if (mode === "approver") {
      footerButtons = [
        {
          type: "button",
          style: "primary",
          color: "#DC2626",
          height: "sm",
          action: {
            type: "message",
            label: `ปิดงานทั้งหมด (${bills.length} รายการ)`,
            text: bills.length === 1 ? `ปิดงานบิลลำดับที่: ${sheetRowStr}` : `ปิดงานบิลลำดับที่: ${sheetRowStr}`
          }
        }
      ];
      const approvableBills = displayBills.filter(b => {
        const st = String(b["สถานะ"] || b.status || "").trim();
        return st === "ตั้งเบิก" || st === "รออนุมัติ" || st === "รอตรวจสอบ" || st === "รอดำเนินการ" || st === "รอเบิก";
      });
      const closableBills = displayBills.filter(b => {
        const st = String(b["สถานะ"] || b.status || "").trim();
        return st === "อนุมัติ";
      });

      footerButtons = [];
      if (approvableBills.length > 0) {
        const approvableIds = approvableBills.map(b => b.id || b["ลำดับ"] || b._sheetRow).filter(Boolean).join(", ");
        footerButtons.push({
          type: "button",
          style: "primary",
          color: "#059669",
          height: "sm",
          flex: 6,
          action: {
            type: "message",
            label: `อนุมัติ (${approvableBills.length})`,
            text: `อนุมัติบิลลำดับที่: ${approvableIds}`
          }
        });
      }
      if (closableBills.length > 0) {
        const closableIds = closableBills.map(b => b.id || b["ลำดับ"] || b._sheetRow).filter(Boolean).join(", ");
        footerButtons.push({
          type: "button",
          style: "primary",
          color: "#DC2626",
          height: "sm",
          flex: 6,
          action: {
            type: "message",
            label: `ปิดงาน (${closableBills.length})`,
            text: `ปิดงานบิลลำดับที่: ${closableIds}`
          }
        });
      }
    }

    const bodyContents = [
      topSummaryBanner,
      ...itemsContents
    ];
    if (bottomTotalSumBox) {
      bodyContents.push(bottomTotalSumBox);
    }

    return {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "10px",
        spacing: "xs",
        contents: bodyContents
      },
      footer: footerButtons.length > 0 ? {
        type: "box",
        layout: "horizontal",
        spacing: "xs",
        paddingAll: "8px",
        backgroundColor: "#F8FAFC",
        contents: footerButtons
      } : undefined
    };
  }

  const bubbles: any[] = [];
  for (let i = 0; i < totalPages; i++) {
    const chunk = displayBills.slice(i * pageSize, (i + 1) * pageSize);
    bubbles.push(buildBubblePage(chunk, i));
  }

  if (bubbles.length === 1) {
    return bubbles[0];
  }

  return {
    type: "carousel",
    contents: bubbles
  };
}

export function createWithdrawRequesterFlex(
  billsInput: Record<string, any> | Array<Record<string, any>>,
  peopleMap?: Map<string, string> | Record<string, string>,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  contractMap?: Map<string, any> | Record<string, any>,
  projectBudgetMap?: Map<string, any> | Record<string, any>,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>,
  pettyCashMap?: Map<string, PettyCashLookupInfo> | Record<string, PettyCashLookupInfo>
): Record<string, any> {
  const bills = (Array.isArray(billsInput) ? billsInput : [billsInput]).map(b => ({
    ...b,
    "สถานะ": b["สถานะ"] || b.status || "ตั้งเบิก",
    status: b.status || b["สถานะ"] || "ตั้งเบิก"
  }));
  return createMultiBillFlex(bills, {
    title: "📄 แจ้งเตือนรายการตั้งเบิกเงิน",
    mode: "requester"
  }, peopleMap, bankInfoMap, contractMap, projectBudgetMap, carsMap, pettyCashMap);
}

export function createWithdrawOwnerFlex(
  billsInput: Record<string, any> | Array<Record<string, any>>,
  peopleMap?: Map<string, string> | Record<string, string>,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  contractMap?: Map<string, any> | Record<string, any>,
  projectBudgetMap?: Map<string, any> | Record<string, any>,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>,
  pettyCashMap?: Map<string, PettyCashLookupInfo> | Record<string, PettyCashLookupInfo>
): Record<string, any> {
  const bills = (Array.isArray(billsInput) ? billsInput : [billsInput]).map(b => ({
    ...b,
    "สถานะ": b["สถานะ"] || b.status || "รออนุมัติ",
    status: b.status || b["สถานะ"] || "รออนุมัติ"
  }));
  return createMultiBillFlex(bills, {
    title: "📋 คำขออนุมัติเบิกเงิน (ส่งจากผู้เบิก)",
    mode: "owner"
  }, peopleMap, bankInfoMap, contractMap, projectBudgetMap, carsMap, pettyCashMap);
}

export function createWithdrawApproverFlex(
  billsInput: Record<string, any> | Array<Record<string, any>>,
  peopleMap?: Map<string, string> | Record<string, string>,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  contractMap?: Map<string, any> | Record<string, any>,
  projectBudgetMap?: Map<string, any> | Record<string, any>,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>,
  pettyCashMap?: Map<string, PettyCashLookupInfo> | Record<string, PettyCashLookupInfo>
): Record<string, any> {
  const bills = (Array.isArray(billsInput) ? billsInput : [billsInput]).map(b => ({
    ...b,
    "สถานะ": !b["สถานะ"] || b["สถานะ"] === "ตั้งเบิก" || b["สถานะ"] === "รออนุมัติ" ? "อนุมัติ" : b["สถานะ"],
    status: !b.status || b.status === "ตั้งเบิก" || b.status === "รออนุมัติ" ? "อนุมัติ" : b.status
  }));
  return createMultiBillFlex(bills, {
    title: "✅ รายการอนุมัติสำเร็จ (รอปิดงาน)",
    mode: "approver"
  }, peopleMap, bankInfoMap, contractMap, projectBudgetMap, carsMap, pettyCashMap);
}

export function createWithdrawCompletedRequesterFlex(
  billsInput: Record<string, any> | Array<Record<string, any>>,
  peopleMap?: Map<string, string> | Record<string, string>,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>,
  contractMap?: Map<string, any> | Record<string, any>,
  projectBudgetMap?: Map<string, any> | Record<string, any>,
  carsMap?: Map<string, CarLookupInfo> | Record<string, CarLookupInfo>,
  pettyCashMap?: Map<string, PettyCashLookupInfo> | Record<string, PettyCashLookupInfo>
): Record<string, any> {
  const bills = (Array.isArray(billsInput) ? billsInput : [billsInput]).map(b => ({
    ...b,
    "สถานะ": "เบิกแล้ว",
    status: "เบิกแล้ว"
  }));
  return createMultiBillFlex(bills, {
    title: "🎉 รายการเบิกเงินสำเร็จเรียบร้อย (ปิดงาน)",
    mode: "completed"
  }, peopleMap, bankInfoMap, contractMap, projectBudgetMap, carsMap, pettyCashMap);
}

export interface DailyTransferGroup {
  groupKey: string;
  payeeName: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  totalAmount: number;
  category: "main" | "sub";
  bills: Array<{
    id: string;
    billNo: string;
    projectName: string;
    amount: number;
    description: string;
    isSubBill: boolean;
  }>;
}

export function createDailyTransferSummaryFlex(
  billsInput: Record<string, any> | Array<Record<string, any>>,
  options?: {
    title?: string;
    dateStr?: string;
  },
  peopleMap?: Map<string, string> | Record<string, string>,
  bankInfoMap?: Map<string, BankLookupInfo> | Record<string, BankLookupInfo>
): Record<string, any> {
  const rawBills = (Array.isArray(billsInput) ? billsInput : [billsInput]).filter(Boolean);
  const title = options?.title || "💸 ยอดโอนวันนี้ (ปิดงานแล้ว)";

  // Format today's date in Thai format (e.g. 12 ก.ย. 2569)
  let displayDate = options?.dateStr || "";
  if (!displayDate) {
    try {
      displayDate = new Date().toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      displayDate = new Date().toLocaleDateString("th-TH");
    }
  }

  if (rawBills.length === 0) {
    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0F172A",
        paddingAll: "12px",
        contents: [
          { type: "text", text: title, weight: "bold", color: "#FFFFFF", size: "sm" },
          { type: "text", text: `วันที่ ${displayDate}`, color: "#94A3B8", size: "xxs", margin: "xs" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "ℹ️ ไม่พบรายการบิลที่ปิดงาน/โอนเงินในวันนี้", size: "xs", color: "#64748B", align: "center" }
        ]
      }
    };
  }

  // Partition bills into Main Bills and Sub-bills
  const mainBills = rawBills.filter(b => !isSubBillRecord(b));
  const subBills = rawBills.filter(b => isSubBillRecord(b));

  function groupBills(bills: Array<Record<string, any>>, category: "main" | "sub"): DailyTransferGroup[] {
    const map = new Map<string, DailyTransferGroup>();

    for (const b of bills) {
      const grossAmt = getBillFlexGrossAmount(b);
      const dInfo = resolveBillDeductionInfo(b);
      const lineItems = extractBillLineItems(b);
      const rawNet = Number(b["ยอดโอน"] || b.net_amount || b.data?.["ยอดโอน"] || b.data?.net_amount || 0);
      const netTransferAmt = dInfo.hasDeduct
        ? (dInfo.deductAmt > 0 ? grossAmt - dInfo.deductAmt : (rawNet > 0 ? rawNet : grossAmt))
        : (lineItems.length > 0 || !rawNet ? grossAmt : (rawNet > 0 ? rawNet : grossAmt));

      let payeeName = "";
      let bankName = "";
      let accountNo = "";
      let accountName = "";

      if (category === "sub") {
        // Sub-bill: transfer goes to the requester (ผู้เบิก)
        const reqBank = resolveRequesterBankInfo(b, bankInfoMap, peopleMap);
        payeeName = reqBank.accountName || reqBank.requesterName || String(b["ผู้เบิก"] || b.requester || "ผู้เบิก").trim();
        bankName = reqBank.bankName || "";
        accountNo = reqBank.accountNo || "";
        accountName = reqBank.accountName || "";
      } else {
        // Main bill: transfer goes to store / contractor
        const rawVendorType = String(b["ร้านค้า/ผู้รับเหมา"] || b.vendor_type || "").trim();
        const isContractor = rawVendorType === "ผู้รับเหมา" || Boolean(b["ผู้รับเหมา"]) || Boolean(b.contractor_id);
        let rawVendorCandidate = "";
        if (isContractor) {
          rawVendorCandidate = b["ชื่อผู้รับเหมา"] || b.contractor_name || b["ผู้รับเหมา"] || b.contractor_id || b["ร้าน/บุคคล"] || b.vendor_or_person || "-";
        } else {
          const namedVendor = String(b["ชื่อร้านค้า"] || b.store_name || b["ร้าน/บุคคล"] || b.vendor_or_person || b.data?.["ร้าน/บุคคล"] || b.data?.vendor_or_person || "").trim();
          const idStore = String(b["ร้านค้า"] || b.store_id || b.data?.["ร้านค้า"] || "").trim();
          if (namedVendor && namedVendor !== "-" && namedVendor !== "non") {
            rawVendorCandidate = namedVendor;
          } else if (idStore) {
            rawVendorCandidate = idStore;
          } else {
            rawVendorCandidate = "-";
          }
        }

        const bankInfo = resolveBankInfo(b, bankInfoMap);
        payeeName = resolveVendorName(rawVendorCandidate, bankInfoMap, b, peopleMap);
        if ((!payeeName || payeeName === "-" || /^[a-zA-Z]{1,3}[-_]?\d+$/i.test(payeeName) || /^[a-zA-Z]{1,3}[-_]?\d+(\s*,\s*[a-zA-Z]{1,3}[-_]?\d+)+$/i.test(payeeName)) && bankInfo) {
          payeeName = bankInfo.storeName || bankInfo.accountName || payeeName;
        }
        if (!payeeName || payeeName === "-") {
          payeeName = String(b["ผู้เบิก"] || b.requester || "ผู้รับเงิน").trim();
        }
        payeeName = payeeName.replace(/^\d+[\.\s\-]+/, "").trim() || payeeName;

        bankName = String(bankInfo?.bankName || b["ธนาคาร"] || b.bank_name || "").trim();
        accountNo = String(bankInfo?.accountNo || b["เลขบัญชี"] || b.bank_account || "").trim();
        accountName = String(bankInfo?.accountName || b["ชื่อบัญชี"] || b.account_name || "").trim();
      }

      const cleanAccDigits = accountNo.replace(/\D/g, "");
      const groupKey = cleanAccDigits.length >= 6
        ? `${category.toUpperCase()}_ACC_${cleanAccDigits}`
        : (accountNo && accountNo !== "-" ? `${category.toUpperCase()}_ACC_${accountNo}_${bankName}` : `${category.toUpperCase()}_NAME_${payeeName.toLowerCase()}`);

      const bId = String(b.id || b["ลำดับ"] || b._sheetRow || "-").trim();
      const pName = String(b["ชื่อ Project"] || b.project_name || "").trim();
      const bDesc = String(b["สินค้า/ทำงาน"] || b.description || "").trim();

      const billItem = {
        id: bId,
        billNo: bId,
        projectName: pName,
        amount: netTransferAmt,
        description: bDesc,
        isSubBill: category === "sub"
      };

      if (map.has(groupKey)) {
        const existing = map.get(groupKey)!;
        existing.totalAmount += netTransferAmt;
        existing.bills.push(billItem);
        if (!existing.accountNo && accountNo) existing.accountNo = accountNo;
        if (!existing.bankName && bankName) existing.bankName = bankName;
        if (!existing.accountName && accountName) existing.accountName = accountName;
      } else {
        map.set(groupKey, {
          groupKey,
          payeeName,
          bankName,
          accountNo,
          accountName,
          totalAmount: netTransferAmt,
          category,
          bills: [billItem]
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  const mainGroups = groupBills(mainBills, "main");
  const subGroups = groupBills(subBills, "sub");

  const mainTotal = mainGroups.reduce((sum, g) => sum + g.totalAmount, 0);
  const subTotal = subGroups.reduce((sum, g) => sum + g.totalAmount, 0);
  const grandTotal = mainTotal + subTotal;
  const totalBillsCount = rawBills.length;
  const hasBothCategories = mainBills.length > 0 && subBills.length > 0;

  function buildCategoryBubblePage(
    pageGroups: DailyTransferGroup[],
    pageIndex: number,
    totalPagesForCategory: number,
    category: "main" | "sub",
    categoryTotal: number,
    categoryBillsCount: number
  ) {
    const isSub = category === "sub";
    const categoryLabel = isSub ? "หมวดบิลย่อย (โอนคืนผู้เบิก)" : "หมวดบิลหลัก (ร้านค้า/ผู้รับเหมา)";
    const categoryBadge = isSub ? "👤 บิลย่อย" : "🏛️ บิลหลัก";
    const headerBg = isSub ? "#1E293B" : "#0F172A";
    const headerBadgeColor = isSub ? "#F59E0B" : "#38BDF8";

    return {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerBg,
        paddingAll: "12px",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            color: "#FFFFFF",
            size: "sm",
            wrap: true
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "xs",
            contents: [
              {
                type: "text",
                text: `${categoryLabel}${totalPagesForCategory > 1 ? ` • หน้า ${pageIndex + 1}/${totalPagesForCategory}` : ""}`,
                color: headerBadgeColor,
                size: "xxs",
                weight: "bold",
                flex: 8,
                wrap: true
              },
              {
                type: "text",
                text: `${categoryBillsCount} บิล`,
                color: "#94A3B8",
                size: "xxs",
                align: "end",
                flex: 2
              }
            ]
          },
          {
            type: "text",
            text: `วันที่ ${displayDate} • (${pageGroups.length} ผู้รับ)`,
            color: "#64748B",
            size: "xxs",
            margin: "none"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "8px",
        spacing: "xs",
        contents: pageGroups.map((g, idx) => {
          const formattedAmt = g.totalAmount.toLocaleString("th-TH");
          const billTags = g.bills.map(b => `#${b.billNo}`).join(", ");
          const isMulti = g.bills.length > 1;

          return {
            type: "box",
            layout: "vertical",
            backgroundColor: isSub ? "#FFFBEB" : "#F8FAFC",
            cornerRadius: "8px",
            borderWidth: "1px",
            borderColor: isSub ? "#FDE68A" : "#E2E8F0",
            paddingAll: "8px",
            margin: idx > 0 ? "xs" : "none",
            contents: [
              // Row 1: Payee Name & Net Amount to Transfer
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: isSub ? `👤 ผู้เบิก: ${g.payeeName}` : `🏪 ${g.payeeName}`,
                    weight: "bold",
                    color: isSub ? "#92400E" : "#0F172A",
                    size: "xs",
                    flex: 7,
                    wrap: true
                  },
                  {
                    type: "text",
                    text: `฿${formattedAmt}`,
                    weight: "bold",
                    color: isSub ? "#D97706" : "#059669",
                    size: "xs",
                    align: "end",
                    flex: 5
                  }
                ]
              },
              // Row 2: Bank & Account No
              {
                type: "box",
                layout: "horizontal",
                margin: "xs",
                alignItems: "center",
                contents: [
                  {
                    type: "text",
                    text: g.accountNo ? `เลข: ${g.accountNo}` : "ไม่มีเลขบัญชี",
                    color: g.accountNo ? (isSub ? "#047857" : "#0284C7") : "#DC2626",
                    size: "xs",
                    weight: "bold",
                    flex: 7
                  },
                  {
                    type: "text",
                    text: g.bankName ? `ธ.${g.bankName}` : "-",
                    color: isSub ? "#78350F" : "#475569",
                    size: "xxs",
                    align: "end",
                    flex: 5
                  }
                ]
              },
              // Optional: Account Name if specified and distinct
              ...(g.accountName && g.accountName !== g.payeeName ? [
                {
                  type: "box",
                  layout: "horizontal",
                  margin: "none",
                  contents: [
                    {
                      type: "text",
                      text: `ชื่อบัญชี: ${g.accountName}`,
                      color: isSub ? "#78350F" : "#64748B",
                      size: "xxs",
                      wrap: true
                    }
                  ]
                }
              ] : []),
              // Row 3: Combined Bills Tag
              {
                type: "box",
                layout: "horizontal",
                margin: "xs",
                contents: [
                  {
                    type: "text",
                    text: isSub
                      ? `🧾 ${isMulti ? `รวม ${g.bills.length} บิลย่อย:` : "บิลย่อย:"} ${billTags}`
                      : `📦 ${isMulti ? `รวม ${g.bills.length} บิล:` : "บิล:"} ${billTags}`,
                    color: isSub ? "#B45309" : (isMulti ? "#2563EB" : "#64748B"),
                    size: "xxs",
                    weight: isMulti ? "bold" : "regular",
                    wrap: true
                  }
                ]
              }
            ]
          };
        })
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "10px",
        backgroundColor: isSub ? "#FEF3C7" : "#ECFDF5",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            alignItems: "center",
            contents: [
              {
                type: "text",
                text: hasBothCategories
                  ? (isSub ? "👤 ยอดโอนบิลย่อย" : "🏛️ ยอดโอนบิลหลัก")
                  : "💰 ยอดโอนรวมทั้งหมด",
                weight: "bold",
                color: isSub ? "#92400E" : "#065F46",
                size: "xs",
                flex: 6
              },
              {
                type: "text",
                text: `฿${categoryTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                weight: "bold",
                color: isSub ? "#D97706" : "#059669",
                size: "md",
                align: "end",
                flex: 6
              }
            ]
          },
          ...(hasBothCategories ? [
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                {
                  type: "text",
                  text: "💰 รวมทั้งหมด (หลัก+ย่อย):",
                  color: isSub ? "#78350F" : "#047857",
                  size: "xxs",
                  weight: "bold",
                  flex: 6
                },
                {
                  type: "text",
                  text: `฿${grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  color: isSub ? "#78350F" : "#047857",
                  size: "xxs",
                  weight: "bold",
                  align: "end",
                  flex: 6
                }
              ]
            }
          ] : []),
          {
            type: "text",
            text: hasBothCategories
              ? `${categoryBadge}: ${categoryBillsCount} บิล • โอน ${pageGroups.length} รายการ (รวมทั้งวัน ${totalBillsCount} บิล)`
              : `ปิดงานแล้วทั้งหมด ${totalBillsCount} บิล • รวม ${pageGroups.length} รายการโอน`,
            color: isSub ? "#92400E" : "#047857",
            size: "xxs",
            margin: "xs"
          }
        ]
      }
    };
  }

  const bubbles: any[] = [];
  const pageSize = 5;

  if (mainGroups.length > 0) {
    const totalMainPages = Math.ceil(mainGroups.length / pageSize);
    for (let i = 0; i < totalMainPages && bubbles.length < 9; i++) {
      const chunk = mainGroups.slice(i * pageSize, (i + 1) * pageSize);
      bubbles.push(buildCategoryBubblePage(
        chunk,
        i,
        totalMainPages,
        "main",
        mainTotal,
        mainBills.length
      ));
    }
  }

  if (subGroups.length > 0) {
    const totalSubPages = Math.ceil(subGroups.length / pageSize);
    for (let i = 0; i < totalSubPages && bubbles.length < 10; i++) {
      const chunk = subGroups.slice(i * pageSize, (i + 1) * pageSize);
      bubbles.push(buildCategoryBubblePage(
        chunk,
        i,
        totalSubPages,
        "sub",
        subTotal,
        subBills.length
      ));
    }
  }

  if (bubbles.length === 1) {
    return bubbles[0];
  }

  return {
    type: "carousel",
    contents: bubbles
  };
}

export async function getLineQuotaInfo() {
  const token = await getDynamicAccessToken();
  if (!token) {
    return {
      success: false,
      error: "ยังไม่ได้ตั้งค่า LINE Channel Access Token"
    };
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };

    const [botRes, quotaRes, usageRes] = await Promise.all([
      fetch("https://api.line.me/v2/bot/info", { headers }).catch(() => null),
      fetch("https://api.line.me/v2/bot/message/quota", { headers }).catch(() => null),
      fetch("https://api.line.me/v2/bot/message/quota/consumption", { headers }).catch(() => null)
    ]);

    const botInfo = botRes && botRes.ok ? await botRes.json() : null;
    const quotaData = quotaRes && quotaRes.ok ? await quotaRes.json() : null;
    const usageData = usageRes && usageRes.ok ? await usageRes.json() : null;

    const limit = quotaData?.type === "limited" ? Number(quotaData.value) : (quotaData?.type === "none" ? -1 : 500);
    const totalUsage = Number(usageData?.totalUsage ?? 0);
    const remaining = limit > 0 ? Math.max(0, limit - totalUsage) : (limit === -1 ? Infinity : 0);
    const usagePercent = limit > 0 ? Math.min(100, (totalUsage / limit) * 100) : 0;

    let packageName = "Free Package (ฟรี)";
    let packageColor = "emerald";
    if (limit === 500) {
      packageName = "Free Package (ฟรี 500 ข้อความ/เดือน)";
      packageColor = "emerald";
    } else if (limit === 15000) {
      packageName = "Light Package (ไลท์ 15,000 ข้อความ/เดือน)";
      packageColor = "blue";
    } else if (limit === 35000) {
      packageName = "Pro Package (โปร 35,000 ข้อความ/เดือน)";
      packageColor = "purple";
    } else if (limit > 500) {
      packageName = `Custom Package (${limit.toLocaleString()} ข้อความ/เดือน)`;
      packageColor = "indigo";
    }

    return {
      success: true,
      botInfo,
      quota: {
        type: quotaData?.type || "limited",
        limit,
        totalUsage,
        remaining,
        usagePercent,
        packageName,
        packageColor
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "ไม่สามารถดึงข้อมูลโควต้า LINE OA ได้"
    };
  }
}

export async function recordSystemErrorLog(
  source: string,
  message: string,
  level: "ERROR" | "WARN" | "INFO" = "ERROR",
  context?: any
) {
  try {
    const { data } = await supabaseAdmin
      .from("system_options")
      .select("data")
      .eq("id", "system_error_logs")
      .maybeSingle();

    const existingLogs: any[] = Array.isArray(data?.data?.logs) ? [...data.data.logs] : [];

    const newLog = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      source,
      message: String(message || "Unknown error"),
      level,
      context: context ? (typeof context === "object" ? context : { value: context }) : undefined
    };

    // Keep up to 100 recent error logs (FIFO)
    const updatedLogs = [newLog, ...existingLogs].slice(0, 100);

    await supabaseAdmin.from("system_options").upsert({
      id: "system_error_logs",
      data: { logs: updatedLogs },
      updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Failed to record system error log:", e);
  }
}


