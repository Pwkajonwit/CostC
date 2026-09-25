import { insertRowToSupabase, getRowsFromSupabase } from "../lib/supabase/supabase-db";

async function main() {
  console.log("Testing insertRowToSupabase with petty_cash...");
  try {
    const res = await insertRowToSupabase("เปิดเงินสดย่อย", {
      id_petty_cash: "PC999",
      "ผู้เบิก": "ทดสอบระบบ",
      "ID Project": "1",
      "จำนวนเงิน": 500,
      "วัตถุประสงค์": "ทดสอบบันทึก",
      "สถานะ": "รออนุมัติ",
      "ยอดคงเหลือ": 500
    });
    console.log("Insert result:", res);

    const rows = await getRowsFromSupabase("เปิดเงินสดย่อย");
    console.log("Rows fetched:", rows.length);
  } catch (err: any) {
    console.error("Catch error:", err.message);
  }
}

main();
