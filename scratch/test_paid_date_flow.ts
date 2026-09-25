import assert from "node:assert";
import { getFormSchema } from "../lib/schemas";
import { TABLES } from "../lib/config";
import { isVatActive, parseCreditDays } from "../lib/project-summary";
import { mapSheetRowToSupabaseRow, mapSupabaseRowToSheetRow } from "../lib/supabase/supabase-db";

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isFieldVisible(field: any, row: any) {
  if (field.name === "วันได้บิล") {
    const hasVat = isVatActive(row["vat"]);
    const hasCredit = parseCreditDays(row["เครดิต"]) > 0;
    return hasVat && !hasCredit;
  }
  if (field.name === "เครดิต") {
    const vendorType = String(row["ร้านค้า/ผู้รับเหมา"] ?? row.vendor_type ?? "").trim();
    return vendorType === "ร้านค้า" || isVatActive(row["vat"]) || parseCreditDays(row["เครดิต"]) > 0 || hasValue(row["เครดิต"]);
  }
  if (field.name === "วันจ่าย") {
    return Boolean(hasValue(row["วันจ่าย"]) || hasValue(row["paid_date"]) || parseCreditDays(row["เครดิต"]) > 0 || hasValue(row["เครดิต"]));
  }
  if (!field.showIf) return true;
  const actual = row[field.showIf.column] || "";
  if (field.showIf.equals !== undefined) return String(actual) === field.showIf.equals;
  if (field.showIf.in) return field.showIf.in.includes(String(actual));
  if (field.showIf.notBlank) {
    if (field.showIf.column === "vat") return isVatActive(actual);
    if (field.showIf.column === "หัก") return false;
    if (field.showIf.column === "เครดิต") return parseCreditDays(actual) > 0 || hasValue(actual);
    return hasValue(actual);
  }
  return true;
}

function sanitizeBySchema(row: any, tableName: string) {
  const schema = getFormSchema(tableName);
  schema.forEach(field => {
    if (field.type === "Hidden") return;
    if (field.name === "วันจ่าย" && (hasValue(row["วันจ่าย"]) || hasValue(row.paid_date))) return;
    if (field.name === "เครดิต" && (hasValue(row["เครดิต"]) || hasValue(row.credit_days))) return;
    if (isFieldVisible(field, row)) return;
    row[field.name] = "";
  });
  return row;
}

function runTests() {
  console.log("=== Testing Paid Date Preservation Flow ===");

  // Test 1: Store bill without VAT but has credit and วันจ่าย
  const billNoVat = {
    "ร้านค้า/ผู้รับเหมา": "ร้านค้า",
    "ร้านค้า": "ไทยพิพัฒน์",
    "ประเภท": "101 เตรียมงาน",
    "vat": "",
    "เครดิต": "30",
    "วันจ่าย": "2026-10-15"
  };
  sanitizeBySchema(billNoVat, TABLES.DATA);
  assert.strictEqual(billNoVat["วันจ่าย"], "2026-10-15", "Test 1 Failed: วันจ่าย was wiped on non-VAT bill!");
  assert.strictEqual(billNoVat["เครดิต"], "30", "Test 1 Failed: เครดิต was wiped on non-VAT bill!");
  console.log("✓ Test 1 Passed: Store bill without VAT preserves เครดิต and วันจ่าย");

  // Test 2: Store bill with store cutoff day (no numeric credit days in เครดิต)
  const billCutoff = {
    "ร้านค้า/ผู้รับเหมา": "ร้านค้า",
    "ร้านค้า": "โฮมโปร",
    "ประเภท": "101 เตรียมงาน",
    "vat": "",
    "เครดิต": "",
    "วันจ่าย": "2026-10-10"
  };
  sanitizeBySchema(billCutoff, TABLES.DATA);
  assert.strictEqual(billCutoff["วันจ่าย"], "2026-10-10", "Test 2 Failed: วันจ่าย was wiped on cutoff bill!");
  console.log("✓ Test 2 Passed: Store bill with store cutoff preserves วันจ่าย");

  // Test 3: PATCH payload with only id and วันจ่าย
  const patchPayload = {
    id: 999,
    "วันจ่าย": "2026-10-20"
  };
  sanitizeBySchema(patchPayload, TABLES.DATA);
  assert.strictEqual(patchPayload["วันจ่าย"], "2026-10-20", "Test 3 Failed: วันจ่าย was wiped in PATCH payload!");
  console.log("✓ Test 3 Passed: PATCH payload preserves วันจ่าย");

  // Test 4: Supabase mapping to DB row
  const dbRow = mapSheetRowToSupabaseRow("bills", {
    "ลำดับ": "123",
    "เครดิต": "45",
    "วันจ่าย": "2026-11-01"
  });
  assert.strictEqual(dbRow.paid_date, "2026-11-01", "Test 4 Failed: paid_date not set in dbRow");
  assert.strictEqual(dbRow.credit_days, 45, "Test 4 Failed: credit_days not set in dbRow");
  assert.strictEqual(dbRow["วันจ่าย"], undefined, "Test 4 Failed: non-column วันจ่าย was not deleted from top level dbRow");
  assert.strictEqual(dbRow.data["วันจ่าย"], "2026-11-01", "Test 4 Failed: data.วันจ่าย not set in dbRow");
  console.log("✓ Test 4 Passed: mapSheetRowToSupabaseRow maps to paid_date and data.วันจ่าย cleanly");

  // Test 5: Supabase mapping back to Sheet row
  const sheetRow = mapSupabaseRowToSheetRow("bills", {
    id: 123,
    paid_date: "2026-11-01",
    credit_days: 45,
    data: { "วันจ่าย": "2026-11-01" }
  }, 0);
  assert.strictEqual(sheetRow["วันจ่าย"], "2026-11-01", "Test 5 Failed: วันจ่าย not restored in sheetRow");
  assert.strictEqual(sheetRow.paid_date, "2026-11-01", "Test 5 Failed: paid_date not in sheetRow");
  assert.strictEqual(sheetRow.due_date, "2026-11-01", "Test 5 Failed: due_date not in sheetRow");
  console.log("✓ Test 5 Passed: mapSupabaseRowToSheetRow restores วันจ่าย, paid_date, and due_date");

  console.log("\nALL 5 TESTS PASSED SUCCESSFULLY! 🎉");
}

runTests();
