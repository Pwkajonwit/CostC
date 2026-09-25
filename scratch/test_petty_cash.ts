import assert from "node:assert";
import { TABLES, PRIMARY_VIEWS, TABLE_KEYS } from "../lib/config";
import { getFormSchema } from "../lib/schemas";
import { mapSheetRowToSupabaseRow, mapSupabaseRowToSheetRow } from "../lib/supabase/supabase-db";

function runTests() {
  console.log("=== Testing Petty Cash Implementation ===");

  // Test 1: Navigation and config
  assert.strictEqual(TABLES.PETTY_CASH, "เปิดเงินสดย่อย", "TABLES.PETTY_CASH should be 'เปิดเงินสดย่อย'");
  assert.strictEqual(TABLE_KEYS[TABLES.PETTY_CASH], "id_petty_cash", "Key should be id_petty_cash");

  const viewIdx = PRIMARY_VIEWS.findIndex(v => v.id === "petty-cash");
  const contractIdx = PRIMARY_VIEWS.findIndex(v => v.id === "contract-open");
  const followIdx = PRIMARY_VIEWS.findIndex(v => v.id === "bill-follow");

  assert(viewIdx !== -1, "petty-cash view must exist in PRIMARY_VIEWS");
  assert(viewIdx > contractIdx, "petty-cash must be placed AFTER contract-open");
  assert(viewIdx < followIdx, "petty-cash must be placed BEFORE bill-follow");
  console.log("✓ Test 1 Passed: Navigation position is correctly placed after เปิดจ้าง and before ตามบิล");

  // Test 2: Schema definition
  const schema = getFormSchema(TABLES.PETTY_CASH);
  assert(schema && schema.length > 0, "Schema for TABLES.PETTY_CASH must be defined");
  const hasId = schema.some(f => f.name === "id_petty_cash");
  const hasAmount = schema.some(f => f.name === "จำนวนเงิน");
  const hasPurpose = schema.some(f => f.name === "วัตถุประสงค์");
  const hasRequester = schema.some(f => f.name === "ผู้เบิก");
  assert(hasId && hasAmount && hasPurpose && hasRequester, "Schema must have all required fields");
  console.log("✓ Test 2 Passed: Form schema has all required fields");

  // Test 3: Supabase mapping
  const sampleInput = {
    "id_petty_cash": "PC101",
    "ผู้เบิก": "ช่างเอก",
    "ID Project": "26001",
    "ชื่อ Project": "โครงการสร้างสะพาน",
    "จำนวนเงิน": "15000",
    "วัตถุประสงค์": "สำรองจ่ายค่าอุปกรณ์และค่าน้ำมัน",
    "วันที่": "2026-09-19",
    "กำหนดเคลียร์": "2026-09-30",
    "สถานะ": "รออนุมัติ",
    "เลขบัญชี": "123-4-56789-0",
    "ธนาคาร": "กสิกรไทย",
    "ยอดเคลียร์แล้ว": "0",
    "ยอดคงเหลือ": "15000"
  };

  const dbRow = mapSheetRowToSupabaseRow("petty_cash", sampleInput);
  assert.strictEqual(dbRow.id, "PC101");
  assert.strictEqual(dbRow.amount, 15000);
  assert.strictEqual(dbRow.requester, "ช่างเอก");
  assert.strictEqual(dbRow.project_id, "26001");
  console.log("✓ Test 3 Passed: mapSheetRowToSupabaseRow maps correctly");

  const restored = mapSupabaseRowToSheetRow("petty_cash", dbRow, 0);
  assert.strictEqual(restored["id_petty_cash"], "PC101");
  assert.strictEqual(restored["ผู้เบิก"], "ช่างเอก");
  assert.strictEqual(restored["จำนวนเงิน"], 15000);
  assert.strictEqual(restored["ยอดคงเหลือ"], 15000);
  console.log("✓ Test 4 Passed: mapSupabaseRowToSheetRow restores correctly");

  console.log("\nALL PETTY CASH TESTS PASSED SUCCESSFULLY! 🎉");
}

runTests();
