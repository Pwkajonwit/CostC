import { toNumber } from "@/lib/utils/numbers";
import { isCommittedBill } from "@/lib/bills/bill-status";
import type { RowValue, SheetRow } from "@/lib/types";

const AMOUNT_COLUMNS = [
  "ค่าของ",
  "ค่าแรง",
  "พนักงาน",
  "น้ำมัน",
  "ซ่อมรถ",
  "เครื่องจักร",
  "เครื่องมือ",
  "อื่นๆ"
];

export function valueOf(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (hasValue(value)) return value;
  }
  return "";
}

export function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function sumColumns(rows: SheetRow[], columns: string[]) {
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (let j = 0; j < columns.length; j++) {
      const val = row[columns[j]];
      if (val !== null && val !== undefined && val !== "") {
        total += toNumber(val);
      }
    }
  }
  return total;
}

export function hydrateDataRows(rows: SheetRow[]) {
  const result = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const output = { ...row };
    
    if (!hasValue(output["ยอดเงิน"])) {
      let sum = 0;
      for (let j = 0; j < AMOUNT_COLUMNS.length; j++) {
        const val = output[AMOUNT_COLUMNS[j]];
        if (val !== null && val !== undefined && val !== "") {
          sum += toNumber(val);
        }
      }
      output["ยอดเงิน"] = sum;
    }
    
    if (!hasValue(output["ยอดโอน"])) {
      output["ยอดโอน"] = computeTransferAmount(output);
    }
    if (!hasValue(output["ร้าน/บุคคล"])) {
      output["ร้าน/บุคคล"] = output["ร้านค้า"] || output["ผู้รับเหมา"] || output["ร้านค้า/ผู้รับเหมา"] || "";
    }
    if (!hasValue(output["สินค้า/ทำงาน"])) {
      output["สินค้า/ทำงาน"] = output["สินค้า"] || output["รายละเอียดงาน"] || output["รายการ"] || "";
    }
    result[i] = output;
  }
  return result;
}

export function computeBillAmount(row: SheetRow) {
  return sumColumns([row], AMOUNT_COLUMNS);
}

export function computeBillTransferAmount(row: SheetRow) {
  return computeTransferAmount(row);
}

export function rowsForProject(dataRows: SheetRow[], projectId: RowValue | undefined) {
  const id = String(projectId || "").trim();
  return hydrateDataRows(dataRows).filter(row => String(row["ID Project"] || "").trim() === id);
}

export function getCategoryExpense(rows: SheetRow[], cat: string): number {
  return rows.reduce((sum, row) => {
    const directAmt = toNumber(row[cat]);
    if (directAmt > 0) return sum + directAmt;

    const catStr = String(row["ประเภท"] || row["รายการ"] || row["สินค้า/ทำงาน"] || "").trim();
    if (catStr.includes(cat)) {
      return sum + toNumber(row["ยอดเงิน"]);
    }
    return sum;
  }, 0);
}

export function computeGrossProfit(workAmount: number, totalCost: number): number {
  return workAmount - totalCost;
}

export function computeProfitMargin(grossProfit: number, workAmount: number): number {
  if (!workAmount || workAmount <= 0) return 0;
  return Math.round((grossProfit / workAmount) * 1000) / 10;
}

export function getProfitHealthStatus(marginPercent: number): {
  status: "healthy" | "normal" | "low" | "loss";
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  if (marginPercent >= 20) {
    return {
      status: "healthy",
      label: "กำไรดีมาก (Healthy)",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dotClass: "bg-emerald-600",
    };
  }
  if (marginPercent >= 10) {
    return {
      status: "normal",
      label: "กำไรมาตรฐาน (Normal)",
      badgeClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",
      dotClass: "bg-indigo-600",
    };
  }
  if (marginPercent >= 0) {
    return {
      status: "low",
      label: "กำไรบาง (Low Margin)",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
      dotClass: "bg-amber-600",
    };
  }
  return {
    status: "loss",
    label: "ขาดทุน (Loss)",
    badgeClass: "bg-rose-50 text-rose-700 border border-rose-200 font-semibold",
    dotClass: "bg-rose-600",
  };
}

export function getBudgetHealthStatus(budget: number, totalCost: number): {
  status: "safe" | "warning" | "critical" | "over";
  label: string;
  percent: number;
  badgeClass: string;
  barClass: string;
} {
  const percent = budget > 0 ? Math.round((totalCost / budget) * 1000) / 10 : (totalCost > 0 ? 100 : 0);
  if (percent < 75) {
    return {
      status: "safe",
      label: "ปลอดภัย (Safe)",
      percent,
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      barClass: "bg-emerald-600",
    };
  }
  if (percent < 90) {
    return {
      status: "warning",
      label: "เฝ้าระวัง (Warning)",
      percent,
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
      barClass: "bg-amber-500",
    };
  }
  if (percent <= 100) {
    return {
      status: "critical",
      label: "วิกฤต (Critical)",
      percent,
      badgeClass: "bg-orange-50 text-orange-700 border border-orange-200",
      barClass: "bg-orange-600",
    };
  }
  return {
    status: "over",
    label: "เกินงบ (Over Budget)",
    percent,
    badgeClass: "bg-rose-50 text-rose-700 border border-rose-200 font-semibold",
    barClass: "bg-rose-600",
  };
}

export function computeCashFlowBreakdown(dataRows: SheetRow[]): {
  actualPaid: number;
  pendingPayables: number;
  totalCommitted: number;
} {
  let actualPaid = 0;
  let pendingPayables = 0;

  for (const row of dataRows) {
    if (!isCommittedBill(row)) continue;
    const amount = toNumber(row["ยอดเงิน"]) || AMOUNT_COLUMNS.reduce((sum, c) => sum + toNumber(row[c]), 0);
    const st = String(row["สถานะ"] || "").trim().toLowerCase();
    if (st.includes("เบิกแล้ว") || st === "paid" || st === "withdrawn") {
      actualPaid += amount;
    } else {
      pendingPayables += amount;
    }
  }

  return {
    actualPaid,
    pendingPayables,
    totalCommitted: actualPaid + pendingPayables,
  };
}

export function hydrateProjectRowsForList(projectRows: SheetRow[], dataRows: SheetRow[]) {
  const totalsByProject: Record<string, { total: number; paid: number; pending: number }> = {};

  for (const row of dataRows) {
    if (!isCommittedBill(row)) continue;
    const projectId = String(row["ID Project"] || "").trim();
    if (!projectId) continue;
    const amount = toNumber(row["ยอดเงิน"]) || AMOUNT_COLUMNS.reduce((sum, column) => sum + toNumber(row[column]), 0);
    const st = String(row["สถานะ"] || "").trim().toLowerCase();
    const isPaid = st.includes("เบิกแล้ว") || st === "paid" || st === "withdrawn";

    if (!totalsByProject[projectId]) {
      totalsByProject[projectId] = { total: 0, paid: 0, pending: 0 };
    }
    totalsByProject[projectId].total += amount;
    if (isPaid) {
      totalsByProject[projectId].paid += amount;
    } else {
      totalsByProject[projectId].pending += amount;
    }
  }

  return projectRows.map(row => {
    const projectId = String(row["ID Project"] || "").trim();
    const output = { ...row };
    
    const projStats = totalsByProject[projectId] || { total: 0, paid: 0, pending: 0 };
    // Always compute "รวม ALL" dynamically from committed data rows
    output["รวม ALL"] = projStats.total;
    output["เงินจ่ายแล้ว"] = projStats.paid;
    output["หนี้สินรอจ่าย"] = projStats.pending;

    const workAmount = toNumber(output["ยอดงาน"]);
    const vatAmount = toNumber(output["ยอดรวม vat"]);
    if (workAmount > 0 && (!hasValue(output["ยอดรวม vat"]) || vatAmount === 0)) {
      output["ยอดรวม vat"] = Math.round(workAmount * 1.07 * 100) / 100;
    } else if (vatAmount > 0 && (!hasValue(output["ยอดงาน"]) || workAmount === 0)) {
      output["ยอดงาน"] = Math.round((vatAmount / 1.07) * 100) / 100;
    }

    // Calculate overall budget cap "งบไม่เกิน"
    const currentCap = toNumber(output["งบไม่เกิน"]);
    const recalculatedWorkAmount = toNumber(output["ยอดงาน"]);
    const recalculatedVatAmount = toNumber(output["ยอดรวม vat"]);

    const categorySum = Object.keys(output)
      .filter(k => k.startsWith("งบไม่เกิน") && k !== "งบไม่เกิน")
      .reduce((sum, k) => sum + toNumber(output[k]), 0);

    if (categorySum > 0) {
      // Priority 1: Sub-category allocations exist (e.g. 3,000,000 in Category Budget Matrix)
      output["งบไม่เกิน"] = categorySum;
    } else if (
      currentCap === 0 ||
      (recalculatedVatAmount > 0 && currentCap === recalculatedVatAmount && recalculatedWorkAmount > 0 && recalculatedWorkAmount !== recalculatedVatAmount)
    ) {
      // Priority 2: No sub-category allocations, and currentCap is empty/0 or incorrectly set to vatAmount
      if (recalculatedWorkAmount > 0) {
        output["งบไม่เกิน"] = recalculatedWorkAmount;
      } else if (recalculatedVatAmount > 0) {
        output["งบไม่เกิน"] = Math.round(recalculatedVatAmount / 1.07);
      }
    }

    // Standard Cost & Profitability Calculations
    const budgetVal = toNumber(output["งบไม่เกิน"]);
    const costVal = toNumber(output["รวม ALL"]);
    const effectiveRevenue = recalculatedWorkAmount > 0 ? recalculatedWorkAmount : (recalculatedVatAmount > 0 ? Math.round(recalculatedVatAmount / 1.07) : budgetVal);

    const grossProfit = computeGrossProfit(effectiveRevenue, costVal);
    const profitMargin = computeProfitMargin(grossProfit, effectiveRevenue);
    const profitHealth = getProfitHealthStatus(profitMargin);
    const budgetHealth = getBudgetHealthStatus(budgetVal, costVal);

    output["กำไรขั้นต้น"] = grossProfit;
    output["อัตรากำไร"] = profitMargin;
    output["สถานะกำไร"] = profitHealth.status;
    output["profitHealth"] = profitHealth;
    output["budgetHealth"] = budgetHealth;

    return output;
  });
}

export function hydrateProjectSummary(project: SheetRow, projectDataRows: SheetRow[]): {
  project: SheetRow;
  totals: {
    workTotal: number;
    totalVat: number;
    budget: number;
    totalAll: number;
    grossProfit: number;
    profitMargin: number;
    actualPaid: number;
    pendingPayables: number;
    profitHealth: any;
    budgetHealth: any;
    billCount: number;
    remaining: number;
    material: number;
    labor: number;
    staff: number;
    fuel: number;
    carRepair: number;
    machine: number;
    tool: number;
    other: number;
  };
} {
  const committedRows = projectDataRows.filter(isCommittedBill);
  const projectTotal = sumColumns(committedRows, ["ยอดเงิน"]);

  const rawWorkTotal = toNumber(valueOf(project, ["ยอดงาน", "ยอดงาน (ก่อน vat)", "ยอดงานก่อนvat"]));
  const rawTotalVat = toNumber(valueOf(project, ["ยอดรวม vat", "ยอดรวม VAT", "ยอดรวมVat"]));
  const rawBudget = toNumber(valueOf(project, ["งบไม่เกิน"]));

  const totalVat = rawTotalVat > 0 ? rawTotalVat : (rawWorkTotal > 0 ? rawWorkTotal * 1.07 : 0);
  const workTotal = rawWorkTotal > 0 ? rawWorkTotal : (totalVat > 0 ? totalVat / 1.07 : 0);
  const totalAll = hasValue(project["รวม ALL"]) && toNumber(project["รวม ALL"]) > 0 ? toNumber(project["รวม ALL"]) : projectTotal;

  // Check Category Budget Matrix sum for consistency with project-all
  const categorySum = Object.keys(project)
    .filter(k => k.startsWith("งบไม่เกิน") && k !== "งบไม่เกิน")
    .reduce((sum, k) => sum + toNumber(project[k]), 0);

  let budget = rawBudget;
  if (categorySum > 0) {
    budget = categorySum;
  } else if (rawBudget <= 0) {
    budget = workTotal > 0 ? workTotal : (totalVat > 0 ? Math.round(totalVat / 1.07) : totalAll);
  }

  const effectiveRevenue = workTotal > 0 ? workTotal : (totalVat > 0 ? Math.round(totalVat / 1.07) : budget);
  const grossProfit = computeGrossProfit(effectiveRevenue, totalAll);
  const profitMargin = computeProfitMargin(grossProfit, effectiveRevenue);
  const profitHealth = getProfitHealthStatus(profitMargin);
  const budgetHealth = getBudgetHealthStatus(budget, totalAll);
  const cashFlow = computeCashFlowBreakdown(committedRows);

  return {
    project: {
      ...project,
      _raw: { ...project },
      "ยอดงาน": hasValue(project["ยอดงาน"]) && toNumber(project["ยอดงาน"]) > 0 ? project["ยอดงาน"] : workTotal,
      "ยอดรวม vat": hasValue(project["ยอดรวม vat"]) || hasValue(project["ยอดรวม VAT"]) ? (project["ยอดรวม vat"] || project["ยอดรวม VAT"]) : totalVat,
      "งบไม่เกิน": budget,
      "รวม ALL": totalAll,
      "กำไรขั้นต้น": grossProfit,
      "อัตรากำไร": profitMargin,
      "สถานะกำไร": profitHealth.status,
      "เงินจ่ายแล้ว": cashFlow.actualPaid,
      "หนี้สินรอจ่าย": cashFlow.pendingPayables,
      "profitHealth": profitHealth,
      "budgetHealth": budgetHealth,
    },
    totals: {
      workTotal,
      totalVat,
      budget,
      totalAll,
      grossProfit,
      profitMargin,
      actualPaid: cashFlow.actualPaid,
      pendingPayables: cashFlow.pendingPayables,
      profitHealth,
      budgetHealth,
      billCount: committedRows.length,
      remaining: budget - totalAll,
      material: getCategoryExpense(committedRows, "ค่าของ"),
      labor: getCategoryExpense(committedRows, "ค่าแรง"),
      staff: getCategoryExpense(committedRows, "พนักงาน"),
      fuel: getCategoryExpense(committedRows, "น้ำมัน"),
      carRepair: getCategoryExpense(committedRows, "ซ่อมรถ"),
      machine: getCategoryExpense(committedRows, "เครื่องจักร"),
      tool: getCategoryExpense(committedRows, "เครื่องมือ"),
      other: getCategoryExpense(committedRows, "อื่นๆ")
    }
  };
}

export function isVatActive(vatValue: unknown): boolean {
  if (vatValue === null || vatValue === undefined) return false;
  const str = String(vatValue).trim().toLowerCase();
  return str !== "" && str !== "0" && str !== "0.00" && str !== "0%" && str !== "ไม่มี" && str !== "ไม่มี vat" && str !== "false" && str !== "no";
}

export function parseDeductPercent(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (str === "ไม่มี" || str === "0" || str === "0%" || str === "" || str === "false") return 0;
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

export function parseCreditDays(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (str === "เงินสด" || str === "ไม่มี" || str === "0" || str === "" || str === "false") return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function isDeductActive(value: unknown): boolean {
  return parseDeductPercent(value) > 0;
}

export function isCreditActive(value: unknown): boolean {
  return parseCreditDays(value) > 0;
}

function computeTransferAmount(row: SheetRow) {
  const amount = hasValue(row["ยอดเงิน"]) ? toNumber(row["ยอดเงิน"]) : computeBillAmount(row);
  const hasVat = isVatActive(row.vat ?? row["vat"] ?? row["VAT"]);
  const deductRate = parseDeductPercent(row["หัก"] ?? row["หัก ณ ที่จ่าย"] ?? row["หักณที่จ่าย"]);
  const hasDeduct = deductRate > 0;
  const customDeduct = hasValue(row["จำนวนหัก"]) 
    ? toNumber(row["จำนวนหัก"]) 
    : (hasValue(row["3เปอร์เซ็น"]) ? toNumber(row["3เปอร์เซ็น"]) : null);

  if (!hasVat && !hasDeduct) return amount;

  if (hasVat && hasDeduct) {
    if (customDeduct !== null && customDeduct > 0) return amount - customDeduct;
    const deductAmt = (amount / 1.07) * (deductRate / 100);
    return amount - deductAmt;
  }

  if (hasVat) return amount;

  if (hasDeduct) {
    if (customDeduct !== null && customDeduct > 0) return amount - customDeduct;
    const deductAmt = (amount * deductRate) / 100;
    return amount - deductAmt;
  }

  return amount;
}

export function computeBillDeductMultiplier(row: SheetRow) {
  const rate = parseDeductPercent(row["หัก"] ?? row["หัก ณ ที่จ่าย"] ?? row["หักณที่จ่าย"]);
  const hasVat = isVatActive(row.vat ?? row["vat"] ?? row["VAT"]);
  if (rate <= 0) return 1;
  return hasVat ? 1 - (rate / 100 / 1.07) : 1 - (rate / 100);
}

function isCompanyLabor(row: SheetRow) {
  return String(row["statusค่าแรง"] || "").trim() === "บริษัท";
}
