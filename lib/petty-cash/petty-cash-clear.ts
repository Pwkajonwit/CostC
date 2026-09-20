import { getRows, updateRow, invalidateTableCache } from "@/lib/db";
import { TABLES } from "@/lib/config";
import { clearCache } from "@/lib/utils/cache";
import { toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";

/**
 * Checks if a bill is a sub-bill (บิลย่อย / เงินสดหน้างาน)
 */
export function isSubBill(row?: SheetRow | Record<string, any> | null): boolean {
  if (!row) return false;
  const billNo = String(row["บิล"] || row.bill_no || row.bill || row.bill_type || "").trim();
  if (billNo === "ย่อย" || billNo.includes("ย่อย")) return true;
  const cat = String(row["ประเภท"] || row.category || "").trim();
  if (cat.includes("ย่อย") || cat.startsWith("2.") || cat.startsWith("3.") || cat.startsWith("8.")) return true;
  return false;
}

/**
 * Automatically clears petty cash records for requesters whose sub-bills are approved or paid.
 * Requirement: "เงินสดย่อย หากมีการอนุมัติบิลย่อยของผู้เบิกแล้ว ให้เคลียบิลไปเลย"
 */
export async function autoClearPettyCashOnSubBillApproval(
  subBills: Array<SheetRow | Record<string, any>>
): Promise<{ updatedCount: number; details: string[] }> {
  const validSubBills = subBills.filter(isSubBill);
  if (validSubBills.length === 0) {
    return { updatedCount: 0, details: [] };
  }

  try {
    // 1. Fetch people/members to build bidirectional requester matching
    const [pettyCashRows, peopleRows] = await Promise.all([
      getRows(TABLES.PETTY_CASH, 0, 1000).catch(() => []),
      getRows("master_members", 60_000, 500).catch(() => [])
    ]);

    if (!Array.isArray(pettyCashRows) || pettyCashRows.length === 0) {
      return { updatedCount: 0, details: [] };
    }

    // Map: ID -> names, Name -> IDs
    const peopleMap = new Map<string, string>();
    const nameToEmpIdMap = new Map<string, string>();
    for (const p of peopleRows) {
      const empId = String(p["รหัสพนักงาน"] || p.id || "").trim();
      const nick = String(p["ชื่อเล่น"] || "").trim();
      const full = String(p["ชื่อ-นามสกุล"] || p.name || "").trim();
      if (empId) {
        if (nick) {
          peopleMap.set(empId.toLowerCase(), nick);
          nameToEmpIdMap.set(nick.toLowerCase(), empId);
        }
        if (full) {
          peopleMap.set(empId.toLowerCase(), full);
          nameToEmpIdMap.set(full.toLowerCase(), empId);
        }
      }
    }

    // Helper to generate all matching keys for a requester string
    const getRequesterKeys = (raw: string): Set<string> => {
      const keys = new Set<string>();
      const trimmed = (raw || "").trim().toLowerCase();
      if (!trimmed) return keys;

      keys.add(trimmed);

      // Strip PT/PE prefixes
      const cleanId = trimmed.replace(/^(pt|pe)[-_]?/i, "").trim();
      if (cleanId) {
        keys.add(cleanId);
        keys.add(`pt${cleanId}`);
        keys.add(`pe${cleanId}`);
      }

      // Lookup by ID -> name
      const name = peopleMap.get(trimmed);
      if (name) {
        keys.add(name.toLowerCase());
      }

      // Lookup by name -> ID
      const id = nameToEmpIdMap.get(trimmed);
      if (id) {
        keys.add(id.toLowerCase());
        const cleanEmpId = id.toLowerCase().replace(/^(pt|pe)[-_]?/i, "").trim();
        if (cleanEmpId) {
          keys.add(cleanEmpId);
          keys.add(`pt${cleanEmpId}`);
          keys.add(`pe${cleanEmpId}`);
        }
      }

      return keys;
    };

    // 2. Aggregate approved sub-bill amounts per requester
    type RequesterBillGroup = {
      keys: Set<string>;
      rawRequester: string;
      totalAmount: number;
      projectIds: Set<string>;
    };

    const requesterGroups = new Map<string, RequesterBillGroup>();

    for (const bill of validSubBills) {
      const rawReq = String(bill["ผู้เบิก"] || bill.requester || "").trim();
      if (!rawReq) continue;

      const keys = getRequesterKeys(rawReq);
      const groupKey = rawReq.toLowerCase();
      const amount = toNumber(bill["ยอดเงิน"] || bill.amount || 0);
      const projId = String(bill["ID Project"] || bill.project_id || "").trim();

      let group = requesterGroups.get(groupKey);
      if (!group) {
        group = {
          keys,
          rawRequester: rawReq,
          totalAmount: 0,
          projectIds: new Set<string>()
        };
        requesterGroups.set(groupKey, group);
      }
      group.totalAmount += amount;
      if (projId) group.projectIds.add(projId);
    }

    let updatedCount = 0;
    const details: string[] = [];

    // 3. For each requester group, find active petty cash records and clear them
    for (const [, group] of requesterGroups) {
      // Find open petty cash records
      const openRecords = pettyCashRows.filter((pc: SheetRow) => {
        const pcStatus = String(pc["สถานะ"] || pc.status || "").trim();
        if (pcStatus === "เคลียร์บิลแล้ว" || pcStatus === "ยกเลิก") return false;

        const pcReq = String(pc["ผู้เบิก"] || pc.requester || "").trim();
        if (!pcReq) return false;

        const pcKeys = getRequesterKeys(pcReq);
        // Check intersection
        for (const k of group.keys) {
          if (pcKeys.has(k)) return true;
        }
        return false;
      });

      if (openRecords.length === 0) continue;

      // Sort open records: matching project first, then oldest first
      openRecords.sort((a, b) => {
        const aProj = String(a["ID Project"] || a.project_id || "").trim();
        const bProj = String(b["ID Project"] || b.project_id || "").trim();
        const aMatch = group.projectIds.has(aProj) ? 1 : 0;
        const bMatch = group.projectIds.has(bProj) ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;

        const dateA = String(a["วันที่"] || a["ว/ด/ป"] || a.date || "");
        const dateB = String(b["วันที่"] || b["ว/ด/ป"] || b.date || "");
        return dateA.localeCompare(dateB);
      });

      let remainingSubBillAmount = group.totalAmount;

      for (const pc of openRecords) {
        const pcId = pc["id_petty_cash"] || pc["id"] || pc["_sheetRow"];
        if (!pcId) continue;

        const pcTotal = toNumber(pc["จำนวนเงิน"] || pc.amount || 0);
        const pcCleared = toNumber(pc["ยอดเคลียร์แล้ว"] || pc.cleared_amount || 0);
        const pcRemaining = Math.max(0, pcTotal - pcCleared);

        // Rule: "เงินสดย่อย หากมีการอนุมัติบิลย่อยของผู้เบิกแล้ว ให้เคลียบิลไปเลย"
        // If sub-bill covers remaining, or covers this record, or user requests full clearance:
        const addedClear = Math.min(pcRemaining > 0 ? pcRemaining : pcTotal, remainingSubBillAmount > 0 ? remainingSubBillAmount : pcTotal);
        const newTotalCleared = pcTotal > 0 ? Math.max(pcTotal, pcCleared + addedClear) : pcCleared + addedClear;
        const newRemaining = 0;
        const newStatus = "เคลียร์บิลแล้ว";

        const updatePayload: Record<string, any> = {
          "ยอดเคลียร์แล้ว": String(newTotalCleared),
          "ยอดคงเหลือ": "0",
          "สถานะ": newStatus,
          status: newStatus,
          cleared_amount: newTotalCleared,
          remaining_amount: newRemaining
        };

        await updateRow(TABLES.PETTY_CASH, pcId, updatePayload);
        updatedCount++;
        details.push(`เคลียร์เปิดเงินสดย่อย #${pcId} (ผู้เบิก: ${group.rawRequester}, ยอด: ฿${pcTotal.toLocaleString()})`);

        remainingSubBillAmount = Math.max(0, remainingSubBillAmount - pcRemaining);
      }
    }

    if (updatedCount > 0) {
      clearCache("rows:เปิดเงินสดย่อย");
      clearCache("rows:petty_cash");
      clearCache("sys_opt:petty_cash_records");
      invalidateTableCache(TABLES.PETTY_CASH);
      invalidateTableCache("เปิดเงินสดย่อย");
      invalidateTableCache("petty_cash");
      console.log(`[Auto-Clear Petty Cash] Cleared ${updatedCount} petty cash record(s):`, details);
    }

    return { updatedCount, details };
  } catch (err) {
    console.error("[Auto-Clear Petty Cash Error]:", err);
    return { updatedCount: 0, details: [] };
  }
}
