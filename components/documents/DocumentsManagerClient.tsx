"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Printer,
  Search,
  CheckCircle2,
  FileCheck2,
  Receipt,
  Users,
  Building2,
  ExternalLink,
  Eye,
  CheckSquare,
  ShieldCheck,
  Percent,
  X,
  Calendar,
  CalendarDays,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Database,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import { parseDeductPercent, isVatActive } from "@/lib/project-summary";
import { formatDateDisplay, normalizeDateToIso } from "@/lib/utils/dates";
import type { SheetRow } from "@/lib/types";
import { BillDocumentModal } from "@/components/documents/BillDocumentModal";
import { DocumentIndexModal } from "@/components/documents/DocumentIndexModal";
import type { BillDocumentModel } from "@/lib/bills/bill-document";

function getBillWhtInfo(b: SheetRow) {
  const percent = parseDeductPercent(b["หัก"] ?? b.deduct ?? b.withholding_tax);
  const wage = toNumber(
    b["ค่าแรง+พนักงาน+อื่นๆ"] ||
      b["ค่าแรง+พนักงาน+อื่น"] ||
      b["ค่าแรง"] ||
      b["ค่าจ้าง"] ||
      b["ยอดเงิน"]
  );
  let amount = toNumber(b["3เปอร์เซ็น"] || b["3เปอร์"] || b["จำนวนหัก"] || b.deduct_amount);

  // In the CSV, column "หัก 3%" often contains the net payable (e.g. 5,820 when wage is 6,000).
  // If raw "หัก 3%" is greater than half the wage, it is the net paid amount, so the tax amount is wage - net.
  const rawWhtCol = toNumber(b["หัก 3%"]);
  if (amount <= 0 && rawWhtCol > 0) {
    if (wage > 0 && rawWhtCol > wage * 0.5) {
      amount = Math.max(0, Math.round((wage - rawWhtCol) * 100) / 100);
    } else {
      amount = rawWhtCol;
    }
  }

  if (amount <= 0 && percent > 0) {
    const hasVat = isVatActive(b.vat ?? b["vat"] ?? b.VAT);
    if (hasVat) {
      amount = Math.round(((wage / 1.07) * (percent / 100)) * 100) / 100;
    } else {
      amount = Math.round((wage * (percent / 100)) * 100) / 100;
    }
  }
  return { percent, amount, hasWht: percent > 0 || amount > 0 };
}

function parseBillMonthKey(dateStr: string): { key: string; label: string; year: number; month: number } | null {
  if (!dateStr) return null;
  const parts = String(dateStr).trim().split(/[-/]/);
  if (parts.length === 3) {
    let month = 1;
    let year = 2026;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = Number(parts[0]);
      month = Number(parts[1]);
    } else {
      // D/M/YYYY or DD/MM/YYYY
      month = Number(parts[1]);
      year = Number(parts[2]);
    }
    const thaiYear = year > 2500 ? year : year + 543;
    const monthNames = [
      "",
      "มกราคม",
      "กุมภาพันธ์",
      "มีนาคม",
      "เมษายน",
      "พฤษภาคม",
      "มิถุนายน",
      "กรกฎาคม",
      "สิงหาคม",
      "กันยายน",
      "ตุลาคม",
      "พฤศจิกายน",
      "ธันวาคม",
    ];
    const label = `${monthNames[month] || "เดือน " + month} ${thaiYear}`;
    const key = `${thaiYear}-${String(month).padStart(2, "0")}`;
    return { key, label, year: thaiYear, month };
  }
  return null;
}

function isLaborBill(b: SheetRow): boolean {
  const laborAmt =
    toNumber(b["ค่าแรง"]) ||
    toNumber(b["ค่าแรง+พนักงาน+อื่นๆ"]) ||
    toNumber(b["ค่าจ้าง"]);
  if (laborAmt > 0) return true;
  if (b["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา") return true;
  const category = String(b["ประเภท"] || "").trim();
  if (category.includes("ค่าแรง") || category.includes("จ้างเหมา") || category.includes("รับเหมา")) return true;
  const statusLabor = String(b["Statusค่าแรง"] || b["statusค่าแรง"] || "").trim();
  if (statusLabor.includes("บุคคล") || statusLabor.includes("ค่าแรง")) return true;
  return false;
}

type DocumentsManagerClientProps = {
  bills: SheetRow[];
  projects: SheetRow[];
  contractors: SheetRow[];
  companies: SheetRow[];
  people?: SheetRow[];
};

export function DocumentsManagerClient({
  bills,
  projects,
  contractors,
  companies,
  people = [],
}: DocumentsManagerClientProps) {
  const activeBills = useMemo(() => bills || [], [bills]);

  const peopleMap = useMemo(() => {
    const map = new Map<string, string>();
    (people || []).forEach((p) => {
      const code = String(p["รหัสพนักงาน"] || p.id || "").trim();
      const nick = String(p["ชื่อเล่น"] || p["ชื่อ-นามสกุล"] || "").trim();
      if (code && nick) map.set(code, nick);
    });
    return map;
  }, [people]);

  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedContractor, setSelectedContractor] = useState<string>("all");
  // เริ่มต้นให้กรองเฉพาะค่าแรงตามคำขอของผู้ใช้
  const [filterTab, setFilterTab] = useState<"all" | "tax50twi" | "labor" | "approved">("labor");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Single Preview Modal State
  const [previewDocData, setPreviewDocData] = useState<BillDocumentModel | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Table of Contents Cover Sheet Modal State
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [indexModalDocs, setIndexModalDocs] = useState<BillDocumentModel[]>([]);
  const [indexModalMonthLabel, setIndexModalMonthLabel] = useState("");

  // Unique deduplicated project options for dropdown
  const uniqueProjectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    projects.forEach((p) => {
      const id = String(p["ID Project"] || p.id || "").trim();
      const name = String(p["ชื่อ Project"] || "").trim();
      if (id && !map.has(id)) {
        map.set(id, { id, name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [projects]);

  // Unique deduplicated contractor options for dropdown
  const uniqueContractorOptions = useMemo(() => {
    const set = new Set<string>();
    contractors.forEach((c) => {
      const name = String(c["ชื่อเล่น"] || c["ชื่อ-นามสกุล"] || c["id_Contractor"] || "").trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [contractors]);

  // Available Months with aggregated metrics
  const availableMonths = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        count: number;
        totalLabor: number;
        totalWht: number;
        totalNet: number;
        pnd3Count: number;
        pnd53Count: number;
      }
    >();

    activeBills.forEach((b) => {
      const info = parseBillMonthKey(String(b["ว/ด/ป"] || b["วันที่"] || ""));
      if (info) {
        const labor = toNumber(
          b["ค่าแรง+พนักงาน+อื่นๆ"] || b["ค่าแรง"] || b["ค่าจ้าง"] || b["ยอดเงิน"]
        );
        const wht = getBillWhtInfo(b).amount;
        const net =
          toNumber(b["ยอดโอน"] || b["คงเหลือ"] || b["ยอดเงิน"]) || Math.max(0, labor - wht);
        const isCorp =
          String(b["Statusค่าแรง"] || b["statusค่าแรง"] || "").includes("บริษัท") ||
          String(b["ร้านค้า/ผู้รับเหมา"] || "") === "ร้านค้า";

        const existing = map.get(info.key);
        if (existing) {
          existing.count++;
          existing.totalLabor += labor;
          existing.totalWht += wht;
          existing.totalNet += net;
          if (isCorp) existing.pnd53Count++;
          else existing.pnd3Count++;
        } else {
          map.set(info.key, {
            key: info.key,
            label: info.label,
            count: 1,
            totalLabor: labor,
            totalWht: wht,
            totalNet: net,
            pnd3Count: isCorp ? 0 : 1,
            pnd53Count: isCorp ? 1 : 0,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [activeBills]);

  // Current Month Summary for display ribbon
  const currentMonthSummary = useMemo(() => {
    if (startDate || endDate) {
      const rangeBills = activeBills.filter((b) => {
        const rowIso = normalizeDateToIso(b["วันที่"] || b["ว/ด/ป"] || b["วันได้บิล"]);
        if (!rowIso) return false;
        if (startDate && rowIso < startDate) return false;
        if (endDate && rowIso > endDate) return false;
        return true;
      });
      const totalLabor = rangeBills.reduce(
        (s, b) =>
          s +
          toNumber(
            b["ค่าแรง+พนักงาน+อื่นๆ"] || b["ค่าแรง"] || b["ค่าจ้าง"] || b["ยอดเงิน"]
          ),
        0
      );
      const totalWht = rangeBills.reduce((s, b) => s + getBillWhtInfo(b).amount, 0);
      const totalNet = rangeBills.reduce(
        (s, b) =>
          s +
          (toNumber(b["จ่าย"] || b["ยอดโอน"] || b["คงเหลือ"] || b["ยอดเงิน"]) ||
            Math.max(
              0,
              toNumber(
                b["ค่าแรง+พนักงาน+อื่นๆ"] || b["ค่าแรง"] || b["ค่าจ้าง"] || b["ยอดเงิน"]
              ) - getBillWhtInfo(b).amount
            )),
        0
      );
      const pnd3Count = rangeBills.filter(
        (b) =>
          !String(b["Statusค่าแรง"] || b["statusค่าแรง"] || "").includes("บริษัท") &&
          String(b["ร้านค้า/ผู้รับเหมา"] || "") !== "ร้านค้า"
      ).length;
      const pnd53Count = rangeBills.length - pnd3Count;

      let rangeLabel = "ช่วงวันที่กำหนดเอง";
      if (startDate && endDate) {
        rangeLabel = `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
      } else if (startDate) {
        rangeLabel = `ตั้งแต่ ${formatDateDisplay(startDate)}`;
      } else if (endDate) {
        rangeLabel = `ถึง ${formatDateDisplay(endDate)}`;
      }

      return {
        label: rangeLabel,
        count: rangeBills.length,
        totalLabor,
        totalWht,
        totalNet,
        pnd3Count,
        pnd53Count,
      };
    }

    if (selectedMonth === "all") {
      const totalLabor = activeBills.reduce(
        (s, b) =>
          s +
          toNumber(
            b["ค่าแรง+พนักงาน+อื่นๆ"] || b["ค่าแรง"] || b["ค่าจ้าง"] || b["ยอดเงิน"]
          ),
        0
      );
      const totalWht = activeBills.reduce((s, b) => s + getBillWhtInfo(b).amount, 0);
      const totalNet = activeBills.reduce(
        (s, b) =>
          s +
          (toNumber(b["ยอดโอน"] || b["คงเหลือ"] || b["ยอดเงิน"]) ||
            Math.max(
              0,
              toNumber(
                b["ค่าแรง+พนักงาน+อื่นๆ"] || b["ค่าแรง"] || b["ค่าจ้าง"] || b["ยอดเงิน"]
              ) - getBillWhtInfo(b).amount
            )),
        0
      );
      const pnd3Count = activeBills.filter(
        (b) =>
          !String(b["Statusค่าแรง"] || b["statusค่าแรง"] || "").includes("บริษัท") &&
          String(b["ร้านค้า/ผู้รับเหมา"] || "") !== "ร้านค้า"
      ).length;
      const pnd53Count = activeBills.length - pnd3Count;

      return {
        label: "ทุกช่วงเวลา / ทุกงวดเอกสาร",
        count: activeBills.length,
        totalLabor,
        totalWht,
        totalNet,
        pnd3Count,
        pnd53Count,
      };
    }

    const found = availableMonths.find((m) => m.key === selectedMonth);
    return (
      found || {
        label: "",
        count: 0,
        totalLabor: 0,
        totalWht: 0,
        totalNet: 0,
        pnd3Count: 0,
        pnd53Count: 0,
      }
    );
  }, [activeBills, selectedMonth, availableMonths, startDate, endDate]);

  // Filter bills based on search, month, project, contractor, and filter tab
  const filteredBills = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return activeBills.filter((b) => {
      const billSeq = String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || "").trim();
      const projId = String(b["ID Project"] || "").trim();
      const projName = String(b["ชื่อ Project"] || "").trim();
      const contractorName = String(
        b["ชื่อ-นามสกุล"] || b["ร้าน/บุคคล"] || b["ผู้รับเหมา"] || b["ร้านค้า"] || ""
      ).trim();
      const jobDesc = String(
        b["สินค้า/ทำงาน"] || b["รายละเอียดงาน"] || b["ชื่องาน หรือ หมายเหตุ"] || ""
      ).trim();
      const whtInfo = getBillWhtInfo(b);
      const laborAmt =
        toNumber(b["ค่าแรง"]) ||
        toNumber(b["ค่าแรง+พนักงาน+อื่นๆ"]) ||
        toNumber(b["ค่าจ้าง"]);
      const status = String(b["สถานะ"] || "");

      // Month filter
      if (selectedMonth !== "all" && !startDate && !endDate) {
        const mInfo = parseBillMonthKey(String(b["ว/ด/ป"] || b["วันที่"] || ""));
        if (!mInfo || mInfo.key !== selectedMonth) return false;
      }

      // Date range filter (จากวันที่ - ถึงวันที่)
      if (startDate || endDate) {
        const rowIso = normalizeDateToIso(b["วันที่"] || b["ว/ด/ป"] || b["วันได้บิล"]);
        if (rowIso) {
          if (startDate && rowIso < startDate) return false;
          if (endDate && rowIso > endDate) return false;
        } else {
          return false;
        }
      }

      // Tab filter
      if (filterTab === "tax50twi" && !whtInfo.hasWht) {
        return false;
      }
      if (filterTab === "labor" && !isLaborBill(b)) {
        return false;
      }
      if (
        filterTab === "approved" &&
        !status.includes("อนุมัติ") &&
        !status.includes("จ่ายแล้ว") &&
        !status.includes("เสร็จ") &&
        !status.includes("เรียบร้อย")
      ) {
        return false;
      }

      // Project filter
      if (selectedProject !== "all" && projId !== selectedProject) {
        return false;
      }

      // Contractor filter
      if (selectedContractor !== "all" && contractorName !== selectedContractor) {
        return false;
      }

      // Search term filter
      if (term) {
        const issuer = String(b["ผู้จ่าย"] || b["ผู้ออก"] || "");
        const match =
          billSeq.toLowerCase().includes(term) ||
          projId.toLowerCase().includes(term) ||
          projName.toLowerCase().includes(term) ||
          contractorName.toLowerCase().includes(term) ||
          jobDesc.toLowerCase().includes(term) ||
          issuer.toLowerCase().includes(term) ||
          status.toLowerCase().includes(term);
        if (!match) return false;
      }

      return true;
    });
  }, [
    activeBills,
    searchTerm,
    startDate,
    endDate,
    selectedMonth,
    filterTab,
    selectedProject,
    selectedContractor,
  ]);

  // Key metrics
  const totalBillsCount = activeBills.length;
  const taxBillsCount = useMemo(
    () => activeBills.filter((b) => getBillWhtInfo(b).hasWht).length,
    [activeBills]
  );
  const laborBillsCount = useMemo(
    () => activeBills.filter(isLaborBill).length,
    [activeBills]
  );

  // Selected totals
  const selectedBills = useMemo(() => {
    const idSet = new Set(selectedIds);
    return activeBills.filter((b) =>
      idSet.has(String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || ""))
    );
  }, [activeBills, selectedIds]);

  const selectedTotalAmount = useMemo(
    () =>
      selectedBills.reduce(
        (sum, b) =>
          sum +
          toNumber(b["ค่าแรง+พนักงาน+อื่นๆ"] || b["ค่าแรง"] || b["ค่าจ้าง"] || b["ยอดเงิน"]),
        0
      ),
    [selectedBills]
  );

  const selectedTotalWht = useMemo(
    () => selectedBills.reduce((sum, b) => sum + getBillWhtInfo(b).amount, 0),
    [selectedBills]
  );

  // Master checkbox selection
  const allFilteredSelected =
    filteredBills.length > 0 &&
    filteredBills.every((b) =>
      selectedIds.includes(String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || ""))
    );

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const filteredSeqSet = new Set(
        filteredBills.map((b) => String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || ""))
      );
      setSelectedIds((prev) => prev.filter((id) => !filteredSeqSet.has(id)));
    } else {
      const newIds = new Set(selectedIds);
      filteredBills.forEach((b) => {
        const id = String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || "");
        if (id) newIds.add(id);
      });
      setSelectedIds(Array.from(newIds));
    }
  }

  function toggleSelectRow(seq: string) {
    setSelectedIds((prev) =>
      prev.includes(seq) ? prev.filter((id) => id !== seq) : [...prev, seq]
    );
  }

  // Select all in current month
  function selectAllInCurrentMonth() {
    const monthBillIds = filteredBills.map((b) =>
      String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || "")
    );
    setSelectedIds(Array.from(new Set([...selectedIds, ...monthBillIds])));
  }

  // Quick Single Preview Modal
  async function handleOpenSinglePreview(bill: SheetRow) {
    const seq = String(bill.id || bill["ลำดับ"] || bill["ลำดับtest"] || bill._sheetRow || "");
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/documents/batch-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: [seq], bills: [bill] }),
      });
      const json = await res.json();
      if (json.success && json.documents && json.documents[0]) {
        setPreviewDocData(json.documents[0]);
        setPreviewModalOpen(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Open Document Index Modal (Table of Contents cover sheet)
  async function handleOpenIndexModal(targetIds?: string[], labelOverride?: string) {
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedIds;
    if (ids.length === 0) return;
    setLoadingPreview(true);
    try {
      const targetRows = activeBills.filter((b) =>
        ids.includes(String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || ""))
      );
      const res = await fetch("/api/documents/batch-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: ids, bills: targetRows }),
      });
      const json = await res.json();
      if (json.success && json.documents) {
        setIndexModalDocs(json.documents);
        const derivedLabel =
          labelOverride ||
          (startDate || endDate
            ? currentMonthSummary.label
            : selectedMonth !== "all"
            ? availableMonths.find((m) => m.key === selectedMonth)?.label || selectedMonth
            : "สรุปรายการที่เลือก");
        setIndexModalMonthLabel(derivedLabel);
        setIndexModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  }

  // Batch Print Navigation
  function handleBatchPrint(mode: "all" | "tax50twi" | "contract" | "voucher" | "index" | "all_with_index") {
    if (selectedIds.length === 0) return;
    const monthParam =
      selectedMonth !== "all"
        ? `&month=${encodeURIComponent(
            availableMonths.find((m) => m.key === selectedMonth)?.label || selectedMonth
          )}`
        : "";
    const url = `/documents/print?ids=${encodeURIComponent(selectedIds.join(","))}&mode=${mode}${monthParam}`;
    window.open(url, "_blank");
  }

  return (
    <div className="min-h-screen bg-slate-100/70 p-3 sm:p-6 lg:p-8 space-y-5 pb-28 font-sans font-normal text-slate-800 text-[11px] sm:text-xs">
      {/* 1. TOP UNIFIED HEADER WITH INTEGRATED KPI STATS */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Title & Subtitle */}
          <div className="shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                  ศูนย์จัดการพิมพ์เอกสาร & สารบัญ 50 ทวิ
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  พิมพ์สัญญาจ้างเหมา, ใบสำคัญจ่าย, หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ), และจัดทำใบปะหน้าสารบัญ
                </p>
              </div>
            </div>
          </div>

          {/* Middle: 4 KPI Cards moved UP into the top header! */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xl:mx-3 flex-1">
            {/* KPI 1: All Bills */}
            <div className="bg-slate-50/90 hover:bg-slate-100/80 px-3 py-2 rounded-lg border border-slate-200 flex items-center gap-2.5 transition">
              <div className="w-7 h-7 rounded-md bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
                <Receipt size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 block leading-tight font-medium">เอกสารบิลทั้งหมด</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 leading-none">
                  {totalBillsCount} <span className="text-[11px] font-normal text-slate-500">รายการ</span>
                </span>
              </div>
            </div>

            {/* KPI 2: Tax WHT Bills */}
            <div className="bg-emerald-50/80 hover:bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200/80 flex items-center gap-2.5 transition">
              <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileCheck2 size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-emerald-800 block leading-tight font-medium">หัก ณ ที่จ่าย (50 ทวิ)</span>
                <span className="text-sm sm:text-base font-bold text-emerald-700 leading-none">
                  {taxBillsCount} <span className="text-[11px] font-normal text-emerald-600">รายการ</span>
                </span>
              </div>
            </div>

            {/* KPI 3: Labor Bills */}
            <div className="bg-indigo-50/80 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200/80 flex items-center gap-2.5 transition">
              <div className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Users size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-indigo-800 block leading-tight font-medium">บิลค่าแรง / จ้างเหมา</span>
                <span className="text-sm sm:text-base font-bold text-indigo-700 leading-none">
                  {laborBillsCount} <span className="text-[11px] font-normal text-indigo-600">รายการ</span>
                </span>
              </div>
            </div>

            {/* KPI 4: Currently Selected */}
            <div className="bg-emerald-500/10 hover:bg-emerald-500/15 px-3 py-2 rounded-lg border border-emerald-300 flex items-center gap-2.5 transition">
              <div className="w-7 h-7 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Printer size={15} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-emerald-800 block leading-tight font-medium">เลือกพิมพ์อยู่ขณะนี้</span>
                <div className="text-sm sm:text-base font-bold text-emerald-900 leading-none truncate">
                  {selectedIds.length} <span className="text-[11px] font-normal text-emerald-700">รายการ</span>
                  {selectedTotalAmount > 0 && (
                    <span className="text-[11px] text-emerald-800 font-medium ml-1">
                      ({money(selectedTotalAmount)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MONTHLY MANAGEMENT RIBBON (การจัดการ รายเดือน) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-indigo-600" />
            <span className="font-bold text-slate-900 text-xs sm:text-sm">การจัดการรายเดือน / งวดภาษี</span>
            <span className="text-[11px] text-slate-500">เลือกเดือนเพื่อสรุปยอดและออกสารบัญประจำงวด</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSelectedMonth("all");
                setStartDate("");
                setEndDate("");
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                selectedMonth === "all" && !startDate && !endDate
                  ? "bg-slate-900 text-white shadow-2xs font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ทั้งหมด ({activeBills.length})
            </button>

            {availableMonths.map((m) => (
              <button
                key={`month-btn-${m.key}`}
                type="button"
                onClick={() => {
                  setSelectedMonth(m.key);
                  setStartDate("");
                  setEndDate("");
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                  selectedMonth === m.key && !startDate && !endDate
                    ? "bg-indigo-600 text-white shadow-2xs font-semibold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{m.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    selectedMonth === m.key && !startDate && !endDate ? "bg-indigo-700 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {m.count}
                </span>
              </button>
            ))}

            {(startDate || endDate) && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-700 text-white shadow-2xs animate-in fade-in">
                <Calendar size={13} />
                <span>
                  {startDate && endDate
                    ? `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`
                    : startDate
                    ? `ตั้งแต่ ${formatDateDisplay(startDate)}`
                    : `ถึง ${formatDateDisplay(endDate)}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="p-0.5 hover:bg-emerald-800 rounded transition cursor-pointer"
                  title="ล้างช่วงวันที่"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MONTHLY KPI SUMMARY BAR WITH ACTIONS */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/90 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div>
              <span className="text-slate-500 block text-[11px]">งวด/เดือน</span>
              <span className="text-xs sm:text-sm font-bold text-indigo-700">{currentMonthSummary.label}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                จำนวน {currentMonthSummary.count} บิล
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">ยอดค่าจ้างรวม</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                ฿{currentMonthSummary.totalLabor.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">ก่อนหักภาษี</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">หัก ณ ที่จ่าย 3%</span>
              <span className="text-xs sm:text-sm font-bold text-rose-600">
                ฿{currentMonthSummary.totalWht.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">นำส่งสรรพากร</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">คงเหลือจ่ายสุทธิ</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-700">
                ฿{currentMonthSummary.totalNet.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">ยอดจ่ายผู้รับเหมา</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
            <button
              type="button"
              onClick={selectAllInCurrentMonth}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
            >
              <CheckSquare size={13} />
              <span>เลือกทั้งเดือน ({filteredBills.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const ids = filteredBills.map((b) =>
                  String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || "")
                );
                handleOpenIndexModal(ids, currentMonthSummary.label);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-xs"
            >
              <FileSpreadsheet size={13} />
              <span>📑 พิมพ์สารบัญประจำเดือน ({filteredBills.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const ids = filteredBills.map((b) =>
                  String(b.id || b["ลำดับ"] || b["ลำดับtest"] || b._sheetRow || "")
                );
                if (ids.length === 0) return;
                const url = `/documents/print?ids=${encodeURIComponent(ids.join(","))}&mode=all_with_index&month=${encodeURIComponent(currentMonthSummary.label)}`;
                window.open(url, "_blank");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition cursor-pointer shadow-xs"
            >
              <Layers size={13} />
              <span>🖨️ พิมพ์ทั้งเดือนพร้อมสารบัญ</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. FILTER TABS & SEARCH CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 sm:p-4 space-y-3">
        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                filterTab === "all"
                  ? "bg-slate-900 text-white shadow-2xs font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              บิลทั้งหมด ({activeBills.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("tax50twi")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                filterTab === "tax50twi"
                  ? "bg-emerald-700 text-white shadow-2xs font-semibold"
                  : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
              }`}
            >
              <FileCheck2 size={13} />
              <span>มีหักภาษี 50 ทวิ ({taxBillsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("labor")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                filterTab === "labor"
                  ? "bg-indigo-700 text-white shadow-2xs font-semibold"
                  : "text-indigo-800 bg-indigo-50 hover:bg-indigo-100"
              }`}
            >
              <Users size={13} />
              <span>ค่าแรง/จ้างเหมา ({laborBillsCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("approved")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer font-medium ${
                filterTab === "approved"
                  ? "bg-slate-800 text-white shadow-2xs font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ShieldCheck size={13} />
              <span>อนุมัติแล้ว</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              แสดง {filteredBills.length} จาก {activeBills.length} บิล
            </span>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer shadow-2xs"
            >
              <X size={13} />
              <span>ล้าง</span>
            </button>

            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              <CheckSquare size={13} />
              <span>{allFilteredSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมดที่แสดง"}</span>
            </button>
          </div>
        </div>

        {/* Search & Select dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลขบิล, ชื่อผู้รับเหมา, รายละเอียดงาน, ผู้จ่าย..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-lg text-xs transition outline-hidden"
            />
          </div>

          {/* Date Range: วันที่ถึงวันที่ */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 focus-within:border-slate-800 focus-within:bg-white transition min-w-0">
            <Calendar size={14} className="text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-500 shrink-0">จาก:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (selectedMonth !== "all") setSelectedMonth("all");
              }}
              className="bg-transparent text-slate-800 text-xs outline-hidden cursor-pointer flex-1 min-w-[105px]"
            />
            <span className="text-[11px] font-medium text-slate-500 shrink-0">ถึง:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (selectedMonth !== "all") setSelectedMonth("all");
              }}
              className="bg-transparent text-slate-800 text-xs outline-hidden cursor-pointer flex-1 min-w-[105px]"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                title="ล้างช่วงวันที่"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-200/70 rounded transition cursor-pointer shrink-0"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Project Filter */}
          <div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-lg text-xs transition outline-hidden cursor-pointer"
            >
              <option value="all">ทุกโครงการ ({uniqueProjectOptions.length})</option>
              {uniqueProjectOptions.map((p) => (
                <option key={`proj-opt-${p.id}`} value={p.id}>
                  {p.id ? `[${p.id}] ` : ""}{p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contractor Filter */}
          <div>
            <select
              value={selectedContractor}
              onChange={(e) => setSelectedContractor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-lg text-xs transition outline-hidden cursor-pointer"
            >
              <option value="all">ทุกผู้รับเหมา/ร้านค้า ({uniqueContractorOptions.length})</option>
              {uniqueContractorOptions.map((name) => (
                <option key={`contractor-opt-${name}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. MULTI-SELECT BILLS DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 select-none">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 w-16 text-center">id</th>
                <th className="py-2.5 px-3 w-20 text-center">วันที่</th>
                <th className="py-2.5 px-3 min-w-[140px]">ชื่อ-นามสกุล</th>
                <th className="py-2.5 px-3 w-28 text-center">เลขประจำตัวประชาชน</th>
                <th className="py-2.5 px-3 min-w-[150px]">ที่อยู่</th>
                <th className="py-2.5 px-3 text-right w-24">ค่าจ้าง</th>
                <th className="py-2.5 px-3 text-right w-24">หัก 3%</th>
                <th className="py-2.5 px-3 text-right w-24">จ่าย</th>
                <th className="py-2.5 px-3 text-center w-16">ผู้ออก</th>
                <th className="py-2.5 px-3 min-w-[150px]">ชื่องาน หรือ หมายเหตุ</th>
                <th className="py-2.5 px-3 text-center w-24">Statusค่าแรง</th>
                <th className="py-2.5 px-3 text-center w-16">พิมพ์</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 text-xs">
                    ไม่พบรายการบิลที่ตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredBills.map((row, rowIdx) => {
                  const seq = String(row.id || row["ลำดับ"] || row["ลำดับtest"] || row._sheetRow || rowIdx);
                  const isSelected = selectedIds.includes(seq);
                  const contractorName =
                    String(
                      row["ชื่อ-นามสกุล"] ||
                        row["ร้าน/บุคคล"] ||
                        row["ผู้รับเหมา"] ||
                        row["ร้านค้า"] ||
                        "-"
                    ).trim() || "-";
                  const idCard = String(
                    row["เลขประจำตัวประชาชน"] ||
                      row["บัตรประจำตัวประชาชน"] ||
                      row["เลขประจำตัวผู้เสียภาษี"] ||
                      "-"
                  ).trim();
                  const address = String(row["ที่อยู่"] || "-").trim();
                  const dateStr = formatDateDisplay(row["วันที่"] || row["ว/ด/ป"] || row["วันได้บิล"] || "-");
                  const wageAmt = toNumber(
                    row["ค่าแรง+พนักงาน+อื่นๆ"] ||
                      row["ค่าแรง"] ||
                      row["ค่าจ้าง"] ||
                      row["ยอดเงิน"]
                  );
                  const rawNetPayable = toNumber(row["จ่าย"] || row["ยอดโอน"] || row["คงเหลือ"]);
                  const rawWht3 = toNumber(row["หัก 3%"]);
                  const whtInfo = getBillWhtInfo(row);

                  // In accounting sheets / CSV, column "หัก 3%" often contains the net payable after 3% deduction
                  const netAmt =
                    rawNetPayable > 0
                      ? rawNetPayable
                      : rawWht3 > wageAmt * 0.5
                      ? rawWht3
                      : wageAmt > 0
                      ? Math.max(0, wageAmt - (whtInfo.amount || 0))
                      : 0;

                  // 3% withholding deduction amount
                  const wht3Amt =
                    whtInfo.amount > 0 && whtInfo.amount < wageAmt
                      ? whtInfo.amount
                      : wageAmt > netAmt && netAmt > 0
                      ? Math.round((wageAmt - netAmt) * 100) / 100
                      : rawWht3 > 0 && rawWht3 < wageAmt * 0.5
                      ? rawWht3
                      : 0;

                  // ผู้ออก คือ ผู้สร้างบิลตั้งเบิก
                  const rawIssuer = String(
                    row["ผู้สร้างบิล"] ||
                      row["ผู้สร้างบิลตั้งเบิก"] ||
                      row["ผู้เบิก"] ||
                      row["ชื่อผู้เบิก"] ||
                      row.requester ||
                      row.requester_name ||
                      row["ผู้ออก"] ||
                      row["คนทำเอกสาร"] ||
                      row["ผู้จ่าย"] ||
                      "-"
                  ).trim();
                  const issuer = peopleMap.get(rawIssuer) || (rawIssuer !== "" ? rawIssuer : "-");

                  const jobDesc = String(
                    row["ชื่องาน หรือ หมายเหตุ"] ||
                      row["รายละเอียดงาน"] ||
                      row["สินค้า/ทำงาน"] ||
                      "-"
                  ).trim();
                  const isCorporate =
                    String(row["Statusค่าแรง"] || row["statusค่าแรง"] || "").includes("บริษัท") ||
                    String(row["ร้านค้า/ผู้รับเหมา"] || "") === "ร้านค้า";
                  const statusLabor = String(
                    row["Statusค่าแรง"] ||
                      row["statusค่าแรง"] ||
                      (isCorporate ? "บริษัท" : "บุคคลธรรมดา")
                  );

                  return (
                    <tr
                      key={`doc-bill-row-${seq}-${rowIdx}`}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected ? "bg-indigo-50/50" : ""
                      }`}
                      onClick={() => toggleSelectRow(seq)}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(seq)}
                          className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-center font-medium text-slate-800 text-[11px]">
                        {seq}
                      </td>

                      <td className="py-2.5 px-3 text-center text-slate-600 whitespace-nowrap text-[11px]">
                        {dateStr}
                      </td>

                      <td className="py-2.5 px-3 font-medium text-slate-900 text-xs">
                        <div className="truncate max-w-[150px]" title={contractorName}>{contractorName}</div>
                      </td>

                      <td className="py-2.5 px-3 text-center text-[11px] text-slate-600 whitespace-nowrap">
                        {idCard}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        <div className="truncate max-w-[160px]" title={address}>{address}</div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium text-slate-900 text-[11px]">
                        {money(wageAmt)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium text-amber-700 text-[11px]">
                        {money(wht3Amt)}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 text-[11px]">
                        {money(netAmt)}
                      </td>

                      <td className="py-2.5 px-3 text-center text-slate-600 text-[11px]">
                        {issuer}
                      </td>

                      <td className="py-2.5 px-3 text-slate-700 text-[11px]">
                        <div className="truncate max-w-[160px]" title={jobDesc}>{jobDesc}</div>
                      </td>

                      <td className="py-2.5 px-3 text-center text-[11px]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            isCorporate
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {statusLabor}
                        </span>
                      </td>


                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenSinglePreview(row)}
                            title="ดูตัวอย่างเอกสาร"
                            className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              window.open(
                                `/documents/print?ids=${encodeURIComponent(seq)}&mode=all`,
                                "_blank"
                              );
                            }}
                            title="เปิดพิมพ์บิลนี้ในแท็บใหม่"
                            className="p-1 rounded-md text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. FLOATING BOTTOM BATCH ACTION BAR (Active when items selected) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-white/95 backdrop-blur-md text-slate-800 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-slate-200/90 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left: Summary Count */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {selectedIds.length}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    เลือกแล้ว {selectedIds.length} รายการ
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ยอดรวม <span className="font-semibold text-slate-800">{money(selectedTotalAmount)}</span> {selectedTotalWht > 0 && <span className="text-amber-700 font-medium">(หัก 3%: {money(selectedTotalWht)})</span>}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-slate-400 hover:text-rose-600 underline transition cursor-pointer sm:ml-2"
              >
                ยกเลิกทั้งหมด
              </button>
            </div>

            {/* Right: Print & Index Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
              <button
                type="button"
                onClick={() => handleOpenIndexModal()}
                disabled={loadingPreview}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              >
                <FileSpreadsheet size={14} />
                <span>ดูสารบัญ ({selectedIds.length} ฉบับ)</span>
              </button>

              <button
                type="button"
                onClick={() => handleBatchPrint("tax50twi")}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer shadow-xs active:scale-95"
              >
                <FileCheck2 size={14} />
                <span>พิมพ์ 50 ทวิ</span>
              </button>

              <button
                type="button"
                onClick={() => handleBatchPrint("all")}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 transition cursor-pointer shadow-xs active:scale-95"
              >
                <Printer size={14} />
                <span>พิมพ์ชุด 3 หน้า</span>
              </button>

              <button
                type="button"
                onClick={() => handleBatchPrint("all_with_index")}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white border border-amber-500 transition cursor-pointer shadow-xs active:scale-95"
                title="พิมพ์ทั้งชุดเอกสารพร้อมหน้าสารบัญปะหน้า"
              >
                <Layers size={14} />
                <span>ทั้งชุด + สารบัญ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE BILL PREVIEW MODAL */}
      {previewModalOpen && previewDocData && (
        <BillDocumentModal
          data={previewDocData}
          isOpen={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewDocData(null);
          }}
        />
      )}

      {/* TABLE OF CONTENTS INDEX MODAL */}
      {indexModalOpen && (
        <DocumentIndexModal
          isOpen={indexModalOpen}
          onClose={() => {
            setIndexModalOpen(false);
            setIndexModalDocs([]);
          }}
          documents={indexModalDocs}
          monthLabel={indexModalMonthLabel}
        />
      )}
    </div>
  );
}
