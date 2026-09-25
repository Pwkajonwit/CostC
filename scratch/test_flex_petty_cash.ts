import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || "").trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    });
  }
} catch (e) {}

import {
  getPeopleMap,
  getBankInfoMap,
  getContractWorkMap,
  getProjectBudgetMap,
  getCarsMap,
  getPettyCashSummaryMap,
  createWithdrawRequesterFlex,
  createBillNotificationFlex
} from "../lib/line/line";

async function verify() {
  console.log("=== Testing Petty Cash in LINE Flex Message ===");

  const [peopleMap, bankInfoMap, contractMap, projectBudgetMap, carsMap, pettyCashMap] = await Promise.all([
    getPeopleMap(),
    getBankInfoMap(),
    getContractWorkMap(),
    getProjectBudgetMap(),
    getCarsMap(),
    getPettyCashSummaryMap()
  ]);

  console.log("PettyCashMap size:", pettyCashMap.size);
  console.log("PT104 info:", pettyCashMap.get("PT104"));

  // 1. Test Single Sub-Bill with PT104 as requester
  const sampleSubBill = {
    id: 999,
    _sheetRow: 999,
    "บิล": "ย่อย",
    bill: "ย่อย",
    "ผู้เบิก": "ช่างรับเหมา 1",
    requester: "ช่างรับเหมา 1",
    "ยอดเงิน": 1500,
    amount: 1500,
    "ชื่อ Project": "โครงการก่อสร้าง A",
    "สินค้า/ทำงาน": "ซื้ออุปกรณ์ซ่อมแซมเร่งด่วน",
    "สถานะ": "ตั้งเบิก"
  };

  const withdrawFlex = createWithdrawRequesterFlex(
    [sampleSubBill],
    peopleMap,
    bankInfoMap,
    contractMap,
    projectBudgetMap,
    carsMap,
    pettyCashMap
  );

  const withdrawFlexStr = JSON.stringify(withdrawFlex, null, 2);
  const hasPettyInWithdraw = withdrawFlexStr.includes("เบิกไว้ก่อน");
  console.log("\n1. Withdraw Flex contains 'เบิกไว้ก่อน':", hasPettyInWithdraw);
  if (!hasPettyInWithdraw) {
    console.error("FAIL: Withdraw Flex missing 'เบิกไว้ก่อน' information!");
  } else {
    const lines = withdrawFlexStr.split("\n").filter(l => l.includes("เบิกไว้ก่อน"));
    console.log("   Matched lines in Withdraw Flex:\n  ", lines.map(l => l.trim()).join("\n   "));
  }

  // 2. Test Notification Bill Flex
  const billNotifFlex = createBillNotificationFlex(
    sampleSubBill,
    bankInfoMap,
    peopleMap,
    carsMap,
    pettyCashMap
  );
  const billNotifStr = JSON.stringify(billNotifFlex, null, 2);
  const hasPettyInNotif = billNotifStr.includes("เบิกไว้ก่อน");
  console.log("\n2. Bill Notification Flex contains 'เบิกไว้ก่อน':", hasPettyInNotif);
  if (!hasPettyInNotif) {
    console.error("FAIL: Bill Notification Flex missing 'เบิกไว้ก่อน' information!");
  } else {
    const lines = billNotifStr.split("\n").filter(l => l.includes("เบิกไว้ก่อน"));
    console.log("   Matched lines in Notification Flex:\n  ", lines.map(l => l.trim()).join("\n   "));
  }

  // 3. Test Non-Sub Bill (Main Bill) -> Should NOT show petty cash box
  const sampleMainBill = {
    id: 1000,
    "บิล": "หลัก",
    bill: "หลัก",
    "ผู้เบิก": "PT104",
    requester: "PT104",
    "ยอดเงิน": 50000,
    amount: 50000,
    "ชื่อ Project": "โครงการก่อสร้าง A",
    "สินค้า/ทำงาน": "ค่าวัสดุก่อสร้างบิลหลัก",
    "สถานะ": "ตั้งเบิก"
  };
  const mainWithdrawFlex = createWithdrawRequesterFlex(
    [sampleMainBill],
    peopleMap,
    bankInfoMap,
    contractMap,
    projectBudgetMap,
    carsMap,
    pettyCashMap
  );
  const mainFlexStr = JSON.stringify(mainWithdrawFlex);
  const mainHasPetty = mainFlexStr.includes("เบิกไว้ก่อน");
  console.log("\n3. Main Bill Flex contains 'เบิกไว้ก่อน':", mainHasPetty, "(Expect false)");

  console.log("\n--- Preview Sub-bill Box in Withdraw Flex ---");
  const bubble = withdrawFlex.type === "bubble" ? withdrawFlex : withdrawFlex.contents[0];
  console.log(JSON.stringify(bubble.body.contents[1].contents[0], null, 2));

  if (hasPettyInWithdraw && hasPettyInNotif && !mainHasPetty) {
    console.log("\n>>> ALL TESTS PASSED! <<<");
  } else {
    console.log("\n>>> SOME TESTS FAILED <<<");
  }
}

verify().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
