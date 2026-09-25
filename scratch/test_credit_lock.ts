import { getRowCreditDueDateInfo } from "../components/dashboards/WithdrawDashboardClient";

console.log("=== Testing Credit Due Date Locking ===");

const today = "2026-09-19";

// Case 1: Future credit due date (e.g. 2026-10-16)
const rowFuture = {
  id: 1,
  "ยอดเงิน": 1000,
  "เครดิต": "30 วัน",
  "วันจ่าย": "2026-10-16",
  "สถานะ": "รอตั้งเบิก"
} as any;

const infoFuture = getRowCreditDueDateInfo(rowFuture, today);
console.log("Case 1 (Future):", infoFuture);
if (!infoFuture.isLocked || infoFuture.daysRemaining !== 27) {
  throw new Error("Case 1 failed: Expected locked with 27 days remaining");
}

// Case 2: Today credit due date (e.g. 2026-09-19)
const rowToday = {
  id: 2,
  "ยอดเงิน": 2000,
  "เครดิต": "30 วัน",
  "วันจ่าย": "2026-09-19",
  "สถานะ": "รอตั้งเบิก"
} as any;

const infoToday = getRowCreditDueDateInfo(rowToday, today);
console.log("Case 2 (Today):", infoToday);
if (infoToday.isLocked) {
  throw new Error("Case 2 failed: Due date is today, should NOT be locked");
}

// Case 3: Past credit due date (e.g. 2026-09-10)
const rowPast = {
  id: 3,
  "ยอดเงิน": 3000,
  "เครดิต": "30 วัน",
  "วันจ่าย": "2026-09-10",
  "สถานะ": "รอตั้งเบิก"
} as any;

const infoPast = getRowCreditDueDateInfo(rowPast, today);
console.log("Case 3 (Past):", infoPast);
if (infoPast.isLocked) {
  throw new Error("Case 3 failed: Due date in past, should NOT be locked");
}

// Case 4: Credit days without explicit วันจ่าย, calculated from ว/ด/ป
const rowCalc = {
  id: 4,
  "ยอดเงิน": 4000,
  "ว/ด/ป": "2026-09-10",
  "เครดิต": "30 วัน",
  "สถานะ": "รอตั้งเบิก"
} as any;

const infoCalc = getRowCreditDueDateInfo(rowCalc, today);
console.log("Case 4 (Calculated):", infoCalc);
// 2026-09-10 + 30 days = 2026-10-10 -> locked!
if (!infoCalc.isLocked || infoCalc.daysRemaining <= 0) {
  throw new Error("Case 4 failed: Expected calculated due date to be locked");
}

// Case 5: Cash bill (no credit)
const rowCash = {
  id: 5,
  "ยอดเงิน": 500,
  "เครดิต": "เงินสด",
  "สถานะ": "รอตั้งเบิก"
} as any;

const infoCash = getRowCreditDueDateInfo(rowCash, today);
console.log("Case 5 (Cash):", infoCash);
if (infoCash.isLocked || infoCash.isCredit) {
  throw new Error("Case 5 failed: Cash bill should not be credit or locked");
}

console.log("✅ All credit lock tests passed successfully!");
