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

import { getRowsFromSupabase } from "../lib/supabase/supabase-db";

async function main() {
  const rows = await getRowsFromSupabase("เปิดเงินสดย่อย");
  console.log("Petty Cash Rows count:", rows?.length);
  if (rows && rows.length > 0) {
    console.log("Sample Petty Cash:", JSON.stringify(rows[0], null, 2));
    console.log("All Requesters:", rows.map(r => ({ requester: r["ผู้เบิก"], amount: r["จำนวนเงิน"], cleared: r["ยอดเคลียร์แล้ว"], status: r["สถานะ"] })));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
