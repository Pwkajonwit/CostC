import { supabaseAdmin } from "../lib/supabase/supabase-admin";
import { getRowsFromSupabase, getWithdrawBillsFromSupabase, getBillFollowRowsFromSupabase } from "../lib/supabase/supabase-db";
import { TABLES } from "../lib/config";
import { getRowCreditDueDateInfo } from "../components/dashboards/WithdrawDashboardClient";
import { getTodayDateIso } from "../lib/utils/dates";

async function runAudit() {
  console.log("==================================================");
  console.log("🔍 STARTING FULL SYSTEM AUDIT & ANALYSIS");
  console.log("==================================================");

  const startTime = Date.now();

  // 1. Check Supabase Connectivity
  console.log("\n[1] 📡 CHECKING SUPABASE CONNECTIVITY & LATENCY...");
  const pingStart = Date.now();
  const { data: pingData, error: pingErr } = await supabaseAdmin.from("projects").select("id").limit(1);
  const pingLatency = Date.now() - pingStart;
  if (pingErr) {
    console.error("❌ Supabase Connection Failed:", pingErr.message);
  } else {
    console.log(`✅ Supabase Connected! Latency: ${pingLatency}ms`);
  }

  // 2. Table Counts & Inspection
  console.log("\n[2] 📊 CHECKING TABLE ROW COUNTS & STRUCTURE...");
  const tables = [
    "bills",
    "projects",
    "stores",
    "contractors",
    "contract_works",
    "master_members",
    "banks",
    "cars",
    "categories",
    "customers",
    "companies",
    "petty_cash",
    "system_options",
    "audit_logs"
  ];

  for (const tbl of tables) {
    try {
      const t0 = Date.now();
      const { count, error } = await supabaseAdmin.from(tbl).select("*", { count: "exact", head: true });
      const elapsed = Date.now() - t0;
      if (error) {
        console.log(`❌ Table '${tbl}': Error (${error.message}) [${elapsed}ms]`);
      } else {
        console.log(`📦 Table '${tbl}': ${count ?? 0} rows [${elapsed}ms]`);
      }
    } catch (e: any) {
      console.log(`❌ Table '${tbl}': Exception (${e.message})`);
    }
  }

  // 3. System Options & LINE Config Check
  console.log("\n[3] ⚙️ CHECKING SYSTEM_OPTIONS & LINE BOT CONFIG...");
  try {
    const { data: sysOpts, error: sysErr } = await supabaseAdmin.from("system_options").select("id, updated_at");
    if (sysErr) {
      console.error("❌ system_options query error:", sysErr.message);
    } else {
      console.log("System option keys present:", sysOpts?.map(o => o.id));
    }

    const { data: lineOpt } = await supabaseAdmin.from("system_options").select("data").eq("id", "line_config").maybeSingle();
    if (lineOpt?.data) {
      const d = lineOpt.data;
      console.log("LINE Config status in DB:");
      console.log("- Has Channel Access Token:", Boolean(d.LINE_CHANNEL_ACCESS_TOKEN && !d.LINE_CHANNEL_ACCESS_TOKEN.includes("your-line")));
      console.log("- Has Channel Secret:", Boolean(d.LINE_CHANNEL_SECRET));
      console.log("- Has LIFF ID:", Boolean(d.NEXT_PUBLIC_LIFF_ID));
      console.log("- Approver count:", Array.isArray(d.LINE_APPROVER_USER_IDS) ? d.LINE_APPROVER_USER_IDS.length : (d.LINE_APPROVER_USER_IDS ? 1 : 0));
      console.log("- Closer/Finance count:", Array.isArray(d.LINE_CLOSER_USER_IDS) ? d.LINE_CLOSER_USER_IDS.length : (d.LINE_CLOSER_USER_IDS ? 1 : 0));
      console.log("- Group summary:", d.LINE_GROUP_ID_SUMMARY ? "Configured" : "None");
      console.log("- Group finance:", d.LINE_GROUP_ID_FINANCE ? "Configured" : "None");
      console.log("- Group task:", d.LINE_GROUP_ID_TASK ? "Configured" : "None");
      console.log("- Group work:", d.LINE_GROUP_ID_WORK ? "Configured" : "None");
    } else {
      console.log("⚠️ No 'line_config' entry found in system_options!");
    }
  } catch (e: any) {
    console.error("Exception checking system_options:", e.message);
  }

  // 4. Bills Data Integrity & Status Distribution
  console.log("\n[4] 🧾 CHECKING BILLS (TRANSACTIONS) DATA INTEGRITY...");
  try {
    const bStart = Date.now();
    const bills = await getRowsFromSupabase("bills");
    const bElapsed = Date.now() - bStart;
    console.log(`Total bills loaded: ${bills.length} in ${bElapsed}ms`);

    const statusCounts: Record<string, number> = {};
    let missingProject = 0;
    let missingVendor = 0;
    let creditBillsCount = 0;
    let lockedCreditBills = 0;
    const todayIso = getTodayDateIso();

    for (const b of bills) {
      const st = String(b["สถานะ"] || b.status || "ว่าง").trim();
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      if (!b["ID Project"] && !b.project_id) missingProject++;
      if (!b["ร้าน/บุคคล"] && !b.vendor_or_person && !b["ร้านค้า"] && !b["ผู้รับเหมา"]) missingVendor++;

      const credInfo = getRowCreditDueDateInfo(b, todayIso);
      if (credInfo.isCredit) {
        creditBillsCount++;
        if (credInfo.isLocked) lockedCreditBills++;
      }
    }

    console.log("Status distribution:", statusCounts);
    console.log(`- Bills with missing Project ID: ${missingProject}`);
    console.log(`- Bills with missing Vendor/Person: ${missingVendor}`);
    console.log(`- Credit bills total: ${creditBillsCount} (Locked until due date: ${lockedCreditBills})`);
  } catch (e: any) {
    console.error("Exception checking bills:", e.message);
  }

  // 5. Check Withdraw & Bill-Follow Queries
  console.log("\n[5] ⚡ CHECKING SPECIALIZED DASHBOARD QUERIES SPEED...");
  try {
    const tW = Date.now();
    const withdrawBills = await getWithdrawBillsFromSupabase();
    console.log(`Withdraw bills query: ${withdrawBills.length} rows loaded in ${Date.now() - tW}ms`);

    const tF = Date.now();
    const followBills = await getBillFollowRowsFromSupabase();
    console.log(`Bill follow rows query: ${followBills.length} rows loaded in ${Date.now() - tF}ms`);
  } catch (e: any) {
    console.error("Exception checking specialized queries:", e.message);
  }

  // 6. Check Members & Permissions
  console.log("\n[6] 👥 CHECKING MASTER MEMBERS & ROLES...");
  try {
    const members = await getRowsFromSupabase("master_members");
    console.log(`Total members: ${members.length}`);
    const roles: Record<string, number> = {};
    let lineLinkedCount = 0;
    for (const m of members) {
      const role = String(m["สิทธิ์"] || m.role || m["สิทธิ์การใช้งาน"] || "None").trim();
      roles[role] = (roles[role] || 0) + 1;
      const lineId = m["LINE User ID"] || m.line_user_id || m["LINE"];
      if (lineId) lineLinkedCount++;
    }
    console.log("Roles breakdown:", roles);
    console.log(`Members with linked LINE ID: ${lineLinkedCount}/${members.length}`);
  } catch (e: any) {
    console.error("Exception checking members:", e.message);
  }

  // 7. Check Petty Cash
  console.log("\n[7] 💰 CHECKING PETTY CASH STATUS...");
  try {
    const pettyList = await getRowsFromSupabase("petty_cash");
    console.log(`Total petty cash records: ${pettyList.length}`);
    let activePetty = 0;
    let totalBal = 0;
    for (const pc of pettyList) {
      const st = String(pc["สถานะ"] || pc.status || "").trim();
      if (st === "อนุมัติ" || st === "ใช้งาน") {
        activePetty++;
        totalBal += Number(pc["ยอดคงเหลือ"] || pc.remaining_amount || 0);
      }
    }
    console.log(`Active petty cash accounts: ${activePetty}, Total remaining balance: ฿${totalBal.toLocaleString("th-TH")}`);
  } catch (e: any) {
    console.error("Exception checking petty cash:", e.message);
  }

  const totalTime = Date.now() - startTime;
  console.log("\n==================================================");
  console.log(`🏁 AUDIT COMPLETED IN ${totalTime}ms`);
  console.log("==================================================");
}

runAudit().catch(console.error);
