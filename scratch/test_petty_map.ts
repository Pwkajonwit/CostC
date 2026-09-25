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
import { getPeopleMap } from "../lib/line/line";

async function testMap() {
  const [pettyRows, peopleMap] = await Promise.all([
    getRowsFromSupabase("เปิดเงินสดย่อย"),
    getPeopleMap()
  ]);

  console.log("Petty rows count:", pettyRows.length);
  console.log("PeopleMap size:", peopleMap.size);

  const pcMap = new Map<string, { total: number; cleared: number; remaining: number; count: number }>();

  for (const r of pettyRows) {
    const rawReq = String(r["ผู้เบิก"] || r.requester || "").trim();
    if (!rawReq) continue;

    const amount = Number(r["จำนวนเงิน"] || r.amount || 0);
    const cleared = Number(r["ยอดเคลียร์แล้ว"] || r.cleared_amount || 0);
    const status = String(r["สถานะ"] || r.status || "").trim();
    const isFinished = status === "เคลียร์บิลแล้ว" || status === "ยกเลิก";

    // canonical key
    const keysToRegister = new Set<string>();
    keysToRegister.add(rawReq);
    keysToRegister.add(rawReq.toLowerCase());

    // Clean PT/PE
    const cleanId = rawReq.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
    if (cleanId) {
      keysToRegister.add(cleanId);
      keysToRegister.add(`pt${cleanId}`);
      keysToRegister.add(`PT${cleanId}`);
      keysToRegister.add(`pe${cleanId}`);
      keysToRegister.add(`PE${cleanId}`);
    }

    // Lookup name from peopleMap
    const resolvedName = peopleMap.get(rawReq) || peopleMap.get(rawReq.toLowerCase());
    if (resolvedName) {
      keysToRegister.add(resolvedName);
      keysToRegister.add(resolvedName.toLowerCase());
    }

    // Accumulate
    const primaryKey = rawReq.toLowerCase();
    let entry = pcMap.get(primaryKey);
    if (!entry) {
      entry = { total: 0, cleared: 0, remaining: 0, count: 0 };
    }
    entry.total += amount;
    entry.cleared += cleared;
    entry.remaining = entry.total - entry.cleared;
    if (!isFinished && entry.remaining > 0) {
      entry.count += 1;
    }

    for (const k of keysToRegister) {
      pcMap.set(k, entry);
    }
  }

  console.log("Lookup 'PT104':", pcMap.get("PT104"));
  console.log("Lookup 'pt104':", pcMap.get("pt104"));
  console.log("Lookup '104':", pcMap.get("104"));
  console.log("Lookup 'ทดสอบระบบ':", pcMap.get("ทดสอบระบบ"));

  const pt104Name = peopleMap.get("PT104");
  console.log("PT104 resolved name:", pt104Name);
  if (pt104Name) {
    console.log(`Lookup by name '${pt104Name}':`, pcMap.get(pt104Name));
  }
}

testMap().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
