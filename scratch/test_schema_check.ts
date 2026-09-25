import { getFormPayload } from "../lib/form";
import { TABLES } from "../lib/config";

async function main() {
  const payload = await getFormPayload(TABLES.PETTY_CASH);
  const statusField = payload.schema.find(f => f.name === "สถานะ");
  const bankField = payload.schema.find(f => f.name === "ธนาคาร");
  const bankOptions = payload.refOptions["ธนาคาร"] || [];

  console.log("Status inputMode:", statusField?.inputMode);
  console.log("Bank type:", bankField?.type);
  console.log("Bank refTable:", bankField?.refTable);
  console.log("Bank refKey:", bankField?.refKey);
  console.log("Bank options count:", bankOptions.length);
  console.log("First 3 banks:", bankOptions.slice(0, 3).map(b => ({ value: b.value, label: b.label })));

  // Test refFill resolution of Ba101 to กรุงเทพ
  const requesterOptions = payload.refOptions["ผู้เบิก"] || [];
  const pt104 = requesterOptions.find(o => o.value === "PT104" || o.row?.["รหัสพนักงาน"] === "PT104");
  console.log("PT104 person:", { value: pt104?.value, label: pt104?.label, bank: pt104?.row?.["ธนาคาร"] });

  const rawBank = String(pt104?.row?.["ธนาคาร"] || "");
  const resolvedBank = bankOptions.find(b =>
    String(b.value) === rawBank ||
    String(b.label) === rawBank ||
    String(b.row?.id_bank) === rawBank ||
    String(b.row?.id) === rawBank
  );
  console.log("Resolved bank for Ba101:", resolvedBank?.value, resolvedBank?.label);
}

main().catch(console.error);
