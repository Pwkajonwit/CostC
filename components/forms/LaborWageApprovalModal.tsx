"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  Copy,
  Check,
  Plus,
  Minus,
  AlertTriangle,
  FileText,
  Hammer,
  Save,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  Edit2,
  Clock,
  Send
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import { TABLES } from "@/lib/config";
import { normalizeBillStatus } from "@/lib/bills/bill-status";
import type { SheetRow } from "@/lib/types";

export type LaborWageApprovalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  contractRows: SheetRow[];
  contractorRows: SheetRow[];
  existingBills: SheetRow[];
  onBillCreated?: () => void;
  initialTab?: "form" | "history";
};

export function LaborWageApprovalModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  contractRows,
  contractorRows,
  existingBills,
  onBillCreated,
  initialTab = "form",
}: LaborWageApprovalModalProps) {
  // --- Navigation Tab State ---
  const [activeTab, setActiveTab] = useState<"form" | "history">(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // --- History Tab Filter States ---
  const [historyScope, setHistoryScope] = useState<"contract" | "project">("contract");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "pending" | "paid" | "rejected">("all");
  const [historySearch, setHistorySearch] = useState("");

  // --- Contract Selection States ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [isContractPickerExpanded, setIsContractPickerExpanded] = useState(false);
  const [showNewContractForm, setShowNewContractForm] = useState(false);

  // --- Inline New Contract State ---
  const [newContractorId, setNewContractorId] = useState("");
  const [newJobDescription, setNewJobDescription] = useState("");
  const [newTotalHireAmount, setNewTotalHireAmount] = useState<number | string>("");
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);
  const [localContracts, setLocalContracts] = useState<SheetRow[]>(contractRows);

  useEffect(() => {
    setLocalContracts(contractRows);
  }, [contractRows]);

  // --- Filter contracts for this project ---
  const projectContracts = useMemo(() => {
    const pIdClean = String(projectId || "").trim().toLowerCase();
    const pNameClean = String(projectName || "").trim().toLowerCase();

    return localContracts.filter((c) => {
      const cProjId = String(c["ID Project"] || c.project_id || "").trim().toLowerCase();
      const cProjName = String(c["ชื่อ Project"] || c.project_name || "").trim().toLowerCase();
      return (
        cProjId === pIdClean ||
        (pNameClean && cProjName === pNameClean) ||
        (pIdClean && cProjName.includes(pIdClean))
      );
    });
  }, [localContracts, projectId, projectName]);

  // Search filtered list
  const filteredContracts = useMemo(() => {
    if (!searchTerm.trim()) return projectContracts;
    const q = searchTerm.toLowerCase().trim();
    return projectContracts.filter((c) => {
      const id = String(c["id_Conwork"] || c.id || "").toLowerCase();
      const contractor = String(c["ชื่อเล่น"] || c["ผู้รับเหมา"] || c["ชื่อ-นามสกุล"] || "").toLowerCase();
      const job = String(c["รายละเอียดงาน"] || "").toLowerCase();
      return id.includes(q) || contractor.includes(q) || job.includes(q);
    });
  }, [projectContracts, searchTerm]);

  // Auto-select first contract if none selected
  useEffect(() => {
    if (!selectedContractId && projectContracts.length > 0) {
      const firstId = String(projectContracts[0]["id_Conwork"] || projectContracts[0].id || "");
      setSelectedContractId(firstId);
    }
  }, [projectContracts, selectedContractId]);

  // Current selected contract object
  const currentContract = useMemo(() => {
    if (!selectedContractId) return null;
    return (
      localContracts.find(
        (c) => String(c["id_Conwork"] || c.id || "").trim() === selectedContractId.trim()
      ) || null
    );
  }, [localContracts, selectedContractId]);

  // Local bills state
  const [localExistingBills, setLocalExistingBills] = useState<SheetRow[]>(existingBills);
  useEffect(() => {
    setLocalExistingBills(existingBills);
  }, [existingBills]);
  const [updatingBillId, setUpdatingBillId] = useState<string | number | null>(null);

  // Contractor Name Resolution
  const contractorName = useMemo(() => {
    if (!currentContract) return "-";
    const directNick = String(currentContract["ชื่อเล่น"] || "").trim();
    const directVendor = String(currentContract["ผู้รับเหมา"] || "").trim();
    const directFullName = String(currentContract["ชื่อ-นามสกุล"] || "").trim();

    if (directNick && directNick !== "-") return directNick;
    if (directVendor && directVendor !== "-") return directVendor;
    if (directFullName && directFullName !== "-") return directFullName;

    const cId = String(currentContract["id_Contractor"] || currentContract.contractor_id || "").trim();
    if (cId) {
      const found = contractorRows.find(
        (c) => String(c["id_Contractor"] || c.id || "").trim().toLowerCase() === cId.toLowerCase()
      );
      if (found) {
        const foundNick = String(found["ชื่อเล่น"] || "").trim();
        const foundFull = String(found["ชื่อ-นามสกุล"] || found.name || "").trim();
        return foundNick || foundFull || cId;
      }
      return cId;
    }
    return "-";
  }, [currentContract, contractorRows]);

  const contractWorkIdClean = useMemo(() => {
    if (!currentContract) return "";
    const raw = String(currentContract["id_Conwork"] || currentContract.id || "").trim();
    return raw.replace(/^CW/i, "").trim() || raw;
  }, [currentContract]);

  // Accurate Past Bills for THIS specific contract (Fixes cross-contract mixing)
  const contractBills = useMemo(() => {
    if (!selectedContractId && !currentContract) return [];

    const targetCw = String(selectedContractId || currentContract?.["id_Conwork"] || currentContract?.id || "").trim().toUpperCase();
    const cleanCw = targetCw.replace(/^CW/i, "").trim();
    const cProjId = String(projectId || "").trim().toLowerCase();
    const cJob = String(currentContract?.["รายละเอียดงาน"] || "").trim().toLowerCase();

    return localExistingBills.filter((b) => {
      const bConwork = String(b.conwork_id || b.data?.conwork_id || "").trim().toUpperCase();
      const bRef = String(b["ผู้รับเหมา"] || b._rawContractor || "").trim().toUpperCase();
      const bDesc = String(b["สินค้า/ทำงาน"] || b["รายละเอียดงาน"] || b.description || "").trim().toUpperCase();

      if (targetCw && (bConwork === targetCw || bRef === targetCw || bConwork === `CW${cleanCw}` || bRef === `CW${cleanCw}`)) {
        return true;
      }
      if (cleanCw && cleanCw.length >= 2) {
        if (bConwork === cleanCw || bRef === cleanCw || bDesc.includes(`CW${cleanCw}`) || bDesc.includes(`รหัสงาน : ${cleanCw}`) || bDesc.includes(`หรัสงาน : ${cleanCw}`)) {
          return true;
        }
      }

      if ((bConwork && bConwork.startsWith("CW")) || (bRef && bRef.startsWith("CW"))) {
        return false;
      }

      const bProjId = String(b["ID Project"] || b.project_id || "").trim().toLowerCase();
      if (cProjId && bProjId === cProjId && cJob && bDesc.toLowerCase().includes(cJob)) {
        return true;
      }

      return false;
    });
  }, [localExistingBills, selectedContractId, currentContract, projectId]);

  const jobDescription = useMemo(() => {
    return String(currentContract?.["รายละเอียดงาน"] || "-").trim();
  }, [currentContract]);

  const totalContractHire = toNumber(currentContract?.["ยอดเงินจ้าง"]) || 0;

  // Manual override for previous disbursed
  const [manualPrevDisbursed, setManualPrevDisbursed] = useState<number | null>(null);
  const [isEditingPrevDisbursed, setIsEditingPrevDisbursed] = useState(false);

  const autoPrevDisbursedTotal = useMemo(() => {
    const validBills = contractBills.filter((b) => {
      const st = normalizeBillStatus(b["สถานะ"] || b.status);
      return st !== "ไม่อนุมัติ" && st !== "ยกเลิก";
    });
    return validBills.reduce((sum, b) => {
      const amt = toNumber(b["ยอดเงิน"]) || toNumber(b["ค่าแรง"]) || toNumber(b["ยอดโอน"]);
      return sum + amt;
    }, 0);
  }, [contractBills]);

  const prevDisbursedTotal = manualPrevDisbursed !== null ? manualPrevDisbursed : autoPrevDisbursedTotal;

  // --- Scope & History Calculations for Tab 2 ---
  const pendingContractBills = useMemo(() => {
    return contractBills.filter((b) => {
      const st = normalizeBillStatus(b["สถานะ"] || b.status);
      return st === "รออนุมัติ" || st === "ตั้งเบิก" || st === "รอตั้งเบิก";
    });
  }, [contractBills]);

  const allProjectWageBills = useMemo(() => {
    const pIdClean = String(projectId || "").trim().toLowerCase();
    const pNameClean = String(projectName || "").trim().toLowerCase();
    return localExistingBills.filter((b) => {
      const bProjId = String(b["ID Project"] || b.project_id || "").trim().toLowerCase();
      const bProjName = String(b["ชื่อ Project"] || b.project_name || "").trim().toLowerCase();
      const isProj = bProjId === pIdClean || (pNameClean && bProjName === pNameClean) || (pIdClean && bProjName.includes(pIdClean));
      const isWage =
        String(b["ร้านค้า/ผู้รับเหมา"] || "").includes("ผู้รับเหมา") ||
        String(b["ประเภท"] || "").startsWith("2") ||
        toNumber(b["ค่าแรง"]) > 0;
      return isProj && isWage;
    });
  }, [localExistingBills, projectId, projectName]);

  const pendingProjectBills = useMemo(() => {
    return allProjectWageBills.filter((b) => {
      const st = normalizeBillStatus(b["สถานะ"] || b.status);
      return st === "รออนุมัติ" || st === "ตั้งเบิก" || st === "รอตั้งเบิก";
    });
  }, [allProjectWageBills]);

  const activeScopeBills = useMemo(() => {
    return historyScope === "contract" ? contractBills : allProjectWageBills;
  }, [historyScope, contractBills, allProjectWageBills]);

  const filteredHistoryBills = useMemo(() => {
    let list = activeScopeBills;
    if (historyStatusFilter === "pending") {
      list = list.filter((b) => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        return st === "รออนุมัติ" || st === "ตั้งเบิก" || st === "รอตั้งเบิก";
      });
    } else if (historyStatusFilter === "paid") {
      list = list.filter((b) => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        return st === "อนุมัติ" || st === "เบิกแล้ว";
      });
    } else if (historyStatusFilter === "rejected") {
      list = list.filter((b) => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        return st === "ไม่อนุมัติ" || st === "ยกเลิก";
      });
    }

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter((b) => {
        const seq = String(b["ลำดับ"] || b.id || "").toLowerCase();
        const desc = String(b["สินค้า/ทำงาน"] || b["รายละเอียดงาน"] || b.description || "").toLowerCase();
        const date = String(b["ว/ด/ป"] || b["วันที่"] || "").toLowerCase();
        const contractor = String(b["ร้าน/บุคคล"] || b["ผู้รับเหมา"] || "").toLowerCase();
        return seq.includes(q) || desc.includes(q) || date.includes(q) || contractor.includes(q);
      });
    }

    return list;
  }, [activeScopeBills, historyStatusFilter, historySearch]);

  const totalScopeHire = useMemo(() => {
    if (historyScope === "contract") return totalContractHire;
    return projectContracts.reduce((sum, c) => sum + (toNumber(c["ยอดเงินจ้าง"]) || 0), 0);
  }, [historyScope, totalContractHire, projectContracts]);

  const scopePaidAmount = useMemo(() => {
    return activeScopeBills
      .filter((b) => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        return st === "อนุมัติ" || st === "เบิกแล้ว";
      })
      .reduce((sum, b) => sum + (toNumber(b["ยอดเงิน"]) || toNumber(b["ค่าแรง"]) || 0), 0);
  }, [activeScopeBills]);

  const scopePendingAmount = useMemo(() => {
    return activeScopeBills
      .filter((b) => {
        const st = normalizeBillStatus(b["สถานะ"] || b.status);
        return st === "รออนุมัติ" || st === "ตั้งเบิก" || st === "รอตั้งเบิก";
      })
      .reduce((sum, b) => sum + (toNumber(b["ยอดเงิน"]) || toNumber(b["ค่าแรง"]) || 0), 0);
  }, [activeScopeBills]);

  const scopeRemainingAmount = totalScopeHire - scopePaidAmount - scopePendingAmount;

  const getTodayThaiString = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const be2Digits = (now.getFullYear() + 543).toString().slice(-2);
    return `${d}/${m}/${be2Digits}`;
  };

  const nextInstallmentNo = useMemo(() => {
    const validBills = contractBills.filter((b) => {
      const st = normalizeBillStatus(b["สถานะ"] || b.status);
      return st !== "ไม่อนุมัติ" && st !== "ยกเลิก";
    });
    return validBills.length + 1;
  }, [contractBills]);

  // --- Simplified Form Input States ---
  const [installmentNo, setInstallmentNo] = useState<number>(1);
  const [noteOrAreaText, setNoteOrAreaText] = useState("");
  const [dateText] = useState(getTodayThaiString());
  const [installmentAmount, setInstallmentAmount] = useState<number | string>("");
  const [hasDeduct3, setHasDeduct3] = useState(true);
  const [hasVat7, setHasVat7] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  useEffect(() => {
    setInstallmentNo(nextInstallmentNo);
    setInstallmentAmount("");
    setNoteOrAreaText("");
    setManualPrevDisbursed(null);
    setIsEditingPrevDisbursed(false);
    setSaveSuccessMsg("");
  }, [selectedContractId, nextInstallmentNo]);

  // Financial Calculations
  const remainingBeforeThis = Math.max(0, totalContractHire - prevDisbursedTotal);
  const currentInstAmt = toNumber(installmentAmount);
  const newDisbursedTotal = prevDisbursedTotal + currentInstAmt;
  const remainingContractAmount = totalContractHire - newDisbursedTotal;
  const isOverRemaining =
    totalContractHire > 0 && currentInstAmt > totalContractHire - prevDisbursedTotal;

  const deductPercent = hasDeduct3 ? 3 : 0;
  const deductAmount = hasDeduct3 ? Math.round((currentInstAmt * 3) / 100) : 0;
  const vatAmount = hasVat7 ? Math.round((currentInstAmt * 7) / 100) : 0;
  const netTransferAmount = currentInstAmt - deductAmount + vatAmount;

  const fmt = (num: number) => num.toLocaleString("th-TH");

  // Format LINE message
  const generatedMessage = useMemo(() => {
    const areaSuffix = noteOrAreaText.trim() ? ` ${noteOrAreaText.trim()}` : "";
    const lines: string[] = [
      "ขออนุมัติค่าแรง",
      `งวดที่ : ${installmentNo}${areaSuffix}`,
      `ช่าง : ${contractorName || "-"}`,
      `วันที่ : ${dateText || getTodayThaiString()}`,
      `รหัสงาน : ${contractWorkIdClean || selectedContractId || "-"}`,
      `Project : ${projectName || "-"}`,
      `ชื่องาน : ${jobDescription || "-"}`,
      "————————————————",
    ];

    if (noteOrAreaText.trim()) {
      lines.push(noteOrAreaText.trim());
    }

    lines.push(`ยอดรวม      ${fmt(totalContractHire)}      บาท`);
    lines.push(`เบิกงวด ${installmentNo}.     ${fmt(currentInstAmt)}     บาท`);
    lines.push(`รวมยอดเบิก   ${fmt(newDisbursedTotal)}    บาท`);
    lines.push(`ยอดคงเหลือ   ${fmt(remainingContractAmount)}    บาท`);
    lines.push("");
    lines.push(`ยอด.            ${fmt(currentInstAmt)}        บาท`);
    lines.push(`หัก ${deductPercent}%             ${fmt(deductAmount)}         บาท`);
    if (hasVat7) {
      lines.push(`Vat 7%        +   ${fmt(vatAmount)}               บาท`);
    }
    lines.push(`ยอดโอนสุทธิ     ${fmt(netTransferAmount)}   บาท`);

    return lines.join("\n");
  }, [
    installmentNo,
    noteOrAreaText,
    contractorName,
    dateText,
    contractWorkIdClean,
    selectedContractId,
    projectName,
    jobDescription,
    totalContractHire,
    currentInstAmt,
    newDisbursedTotal,
    remainingContractAmount,
    deductPercent,
    deductAmount,
    hasVat7,
    vatAmount,
    netTransferAmount,
  ]);

  // Copy to clipboard
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = generatedMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  // Quick status transition for pending requests (Approve to create bill / Reject)
  const handleUpdateBillStatus = async (bill: SheetRow, nextStatus: "อนุมัติ" | "ไม่อนุมัติ") => {
    const billId = bill.id ?? bill["ลำดับ"] ?? bill._sheetRow;
    const billSeq = bill["ลำดับ"] || bill.id;
    const actionText = nextStatus === "อนุมัติ" ? "อนุมัติสร้างบิล" : "ไม่อนุมัติ";
    const confirmed = window.confirm(`คุณต้องการ '${actionText}' สำหรับคำขอเบิกค่าแรง #${billSeq} ใช่หรือไม่?`);
    if (!confirmed) return;

    setUpdatingBillId(billId);
    try {
      const res = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: TABLES.DATA,
          id: billId,
          sheetRow: bill._sheetRow || billId,
          values: { "สถานะ": nextStatus },
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `${actionText}ไม่สำเร็จ`);

      setLocalExistingBills((prev) =>
        prev.map((b) => {
          const bId = b.id ?? b["ลำดับ"] ?? b._sheetRow;
          if (String(bId) === String(billId)) {
            return { ...b, "สถานะ": nextStatus, status: nextStatus };
          }
          return b;
        })
      );

      setSaveSuccessMsg(`✅ ${actionText} รายการ #${billSeq} สำเร็จเรียบร้อยแล้ว!`);
      window.dispatchEvent(new CustomEvent("bills-data-updated"));
      window.dispatchEvent(new CustomEvent("data-updated"));
      if (onBillCreated) onBillCreated();
      setTimeout(() => setSaveSuccessMsg(""), 5000);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setUpdatingBillId(null);
    }
  };

  // Unified Save + Copy Action
  const handleSaveAndCopy = async () => {
    if (!currentContract) {
      alert("กรุณาเลือกสัญญาจ้างก่อนบันทึก");
      return;
    }
    if (currentInstAmt <= 0) {
      alert("กรุณาระบุยอดเงินเบิกที่มากกว่า 0 บาท");
      return;
    }

    setIsSavingBill(true);
    setSaveSuccessMsg("");

    try {
      const todayIso = new Date().toISOString().split("T")[0];
      const itemTitle = [
        jobDescription,
        `งวดที่ ${installmentNo}`,
        noteOrAreaText.trim() ? `(${noteOrAreaText.trim()})` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const matchedContractor = contractorRows.find(
        (c) =>
          String(c["id_Contractor"] || c.id || "").toLowerCase() ===
          String(currentContract["id_Contractor"] || currentContract.contractor_id || "").toLowerCase()
      );
      const contractorType = String(
        matchedContractor?.["ประเภท"] || matchedContractor?.data?.contractor_type || "บุคคลธรรมดา"
      );

      const newBillRow = {
        "ID Project": projectId,
        "ชื่อ Project": projectName,
        "บิล": "หลัก",
        "ร้านค้า/ผู้รับเหมา": "ผู้รับเหมา",
        "statusค่าแรง": contractorType,
        "ร้าน/บุคคล": contractorName || "ช่าง",
        "ผู้รับเหมา": currentContract["id_Conwork"] || currentContract.id || selectedContractId,
        "conwork_id": currentContract["id_Conwork"] || currentContract.id || selectedContractId,
        "id_Contractor": currentContract["id_Contractor"] || currentContract.contractor_id || "",
        "สินค้า/ทำงาน": itemTitle || "เบิกค่าแรง",
        "รายละเอียดงาน": itemTitle || "เบิกค่าแรง",
        "ยอดเงิน": currentInstAmt,
        "หัก": hasDeduct3 ? "3%" : "0%",
        "vat": hasVat7 ? "7%" : "",
        "ยอดโอน": netTransferAmount,
        "สถานะ": "รออนุมัติ",
        "ว/ด/ป": todayIso,
        "ประเภท": String(currentContract["ประเภท"] || "201 เตรียมงาน"),
        "ค่าแรง": currentInstAmt,
        "ผู้เบิก": "Admin",
      };

      const res = await fetch("/api/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: TABLES.DATA,
          row: newBillRow,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "บันทึกล้มเหลว");
      }

      const savedSeq = json.insertedRow?.["ลำดับ"] || json.row?.["ลำดับ"] || "ใหม่";
      const createdRow = json.insertedRow || json.row || { ...newBillRow, "ลำดับ": savedSeq };
      setLocalExistingBills((prev) => [createdRow, ...prev]);

      await handleCopyMessage();

      setSaveSuccessMsg(`✅ สร้างคำขอ #${savedSeq} (รออนุมัติ) และคัดลอกข้อความ LINE เรียบร้อยแล้ว!`);
      setInstallmentAmount("");
      setNoteOrAreaText("");
      window.dispatchEvent(new CustomEvent("bills-data-updated"));
      window.dispatchEvent(new CustomEvent("data-updated"));
      if (onBillCreated) onBillCreated();

      setTimeout(() => setSaveSuccessMsg(""), 6000);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึกคำขอ: ${err.message}`);
    } finally {
      setIsSavingBill(false);
    }
  };

  // Quick create contract
  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractorId) {
      alert("กรุณาเลือกผู้รับเหมา/ช่าง");
      return;
    }
    if (!newJobDescription.trim()) {
      alert("กรุณาระบุรายละเอียดงาน");
      return;
    }
    if (toNumber(newTotalHireAmount) <= 0) {
      alert("กรุณาระบุยอดเงินจ้างที่ถูกต้อง");
      return;
    }

    setIsSubmittingContract(true);
    try {
      const matchedContractor = contractorRows.find(
        (c) => String(c["id_Contractor"] || c.id || "") === newContractorId
      );
      const nickname = matchedContractor
        ? String(matchedContractor["ชื่อเล่น"] || matchedContractor["ชื่อ-นามสกุล"] || "")
        : "";

      const newCwRow = {
        "ID Project": projectId,
        "ชื่อ Project": projectName,
        "id_Contractor": newContractorId,
        "ชื่อเล่น": nickname,
        "รายละเอียดงาน": newJobDescription.trim(),
        "ยอดเงินจ้าง": toNumber(newTotalHireAmount),
        "ยอดเงินจ่าย": 0,
        "วันที่": new Date().toISOString().split("T")[0],
      };

      const res = await fetch("/api/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: TABLES.CONTRACT_WORK,
          row: newCwRow,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "สร้างสัญญาไม่สำเร็จ");

      const created = json.insertedRow || newCwRow;
      const createdId = String(created["id_Conwork"] || created.id || "");

      setLocalContracts((prev) => [created, ...prev]);
      if (createdId) setSelectedContractId(createdId);
      setShowNewContractForm(false);
      setIsContractPickerExpanded(false);
      setNewJobDescription("");
      setNewTotalHireAmount("");
      window.dispatchEvent(new CustomEvent("data-updated"));
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSubmittingContract(false);
    }
  };

  if (!isOpen) return null;

  const progressPercent = totalContractHire > 0 ? Math.min(100, Math.round((newDisbursedTotal / totalContractHire) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden font-sans text-slate-800">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/90 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <Hammer size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  ขออนุมัติค่าแรงช่าง
                </h2>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 hidden sm:inline-flex items-center gap-1">
                  โครงการ #{projectId}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {projectName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/wage-request?project=${encodeURIComponent(projectId)}&contract=${encodeURIComponent(selectedContractId)}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-semibold transition cursor-pointer"
              title="เปิดหน้าแยกสำหรับมือถือ / LINE LIFF"
            >
              <ExternalLink size={12} />
              <span>เปิดหน้ามือถือ (LIFF)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* TOP TAB SWITCHER */}
        <div className="flex items-center justify-between px-5 bg-slate-50/70 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={`py-2.5 px-3 sm:px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "form"
                  ? "border-emerald-600 text-emerald-800 bg-white shadow-2xs rounded-t-lg -mb-[1px]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg"
              }`}
            >
              <FileText size={14} className={activeTab === "form" ? "text-emerald-600" : "text-slate-400"} />
              <span>1. สร้างคำขอเบิก</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`py-2.5 px-3 sm:px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "history"
                  ? "border-indigo-600 text-indigo-900 bg-white shadow-2xs rounded-t-lg -mb-[1px]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 rounded-t-lg"
              }`}
            >
              <Clock size={14} className={activeTab === "history" ? "text-indigo-600" : "text-slate-400"} />
              <span>2. รออนุมัติ & ประวัติ</span>
              {(pendingContractBills.length > 0 || pendingProjectBills.length > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingContractBills.length > 0 ? pendingContractBills.length : pendingProjectBills.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "form" && pendingContractBills.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 px-2.5 py-0.5 rounded-full transition flex items-center gap-1 cursor-pointer"
            >
              <Clock size={11} />
              <span>รออนุมัติ ({pendingContractBills.length})</span>
              <ArrowRight size={11} />
            </button>
          )}
        </div>

        {/* TAB 1: REQUEST FORM */}
        {activeTab === "form" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-white">
            {/* LEFT COLUMN: 2 SIMPLE STEPS (7 COLS) */}
            <div className="lg:col-span-7 space-y-4">
              {/* STEP 1: เลือกสัญญา / ช่าง */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-slate-900">เลือกสัญญาเปิดจ้าง / ช่าง</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsContractPickerExpanded((v) => !v);
                        setShowNewContractForm(false);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{isContractPickerExpanded ? "ย่อ" : "เปลี่ยนสัญญา"}</span>
                      {isContractPickerExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    <span className="text-slate-300">|</span>

                    <button
                      type="button"
                      onClick={() => {
                        setShowNewContractForm((v) => !v);
                        setIsContractPickerExpanded(false);
                      }}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>เปิดสัญญาใหม่</span>
                    </button>
                  </div>
                </div>

                {/* Collapsed Active Contract Summary with Progress Bar */}
                {currentContract && !isContractPickerExpanded && !showNewContractForm && (
                  <div
                    onClick={() => setIsContractPickerExpanded(true)}
                    className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs cursor-pointer hover:border-emerald-300 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[11px] font-bold">
                            #{contractWorkIdClean || selectedContractId}
                          </span>
                          <span className="font-bold text-sm text-slate-900">
                            ช่าง {contractorName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 truncate">{jobDescription}</p>
                      </div>

                      <span className="shrink-0 px-2.5 py-1 text-[11px] text-indigo-600 bg-slate-50 border border-slate-200 rounded-lg font-semibold">
                        เปลี่ยน
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          วงเงินจ้าง <strong className="text-slate-900 font-mono">{money(totalContractHire)}</strong> ฿
                        </span>
                        <span className="text-slate-500">
                          เบิกแล้ว ({nextInstallmentNo - 1} งวด):{" "}
                          <strong className="text-indigo-700 font-mono">{money(prevDisbursedTotal)}</strong> ฿
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isOverRemaining ? "bg-rose-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">เบิกสะสมรวมงวดนี้ {progressPercent}%</span>
                        <span className="font-semibold text-emerald-700">
                          คงเหลือเบิกได้: <strong className="font-mono text-xs">{money(remainingBeforeThis)}</strong> ฿
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inline Quick Create Form */}
                {showNewContractForm && (
                  <form
                    onSubmit={handleCreateContract}
                    className="bg-white border border-emerald-300/80 rounded-xl p-3 space-y-2.5 shadow-2xs"
                  >
                    <div className="text-xs font-semibold text-emerald-900 border-b border-emerald-100 pb-1 flex items-center gap-1">
                      <Plus size={13} />
                      <span>เปิดสัญญาจ้างใหม่สำหรับโครงการนี้</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] text-slate-600 block mb-1">ช่าง / ผู้รับเหมา *</label>
                        <select
                          value={newContractorId}
                          onChange={(e) => setNewContractorId(e.target.value)}
                          required
                          className="w-full h-8.5 px-2 rounded-lg border border-slate-300 text-xs bg-white"
                        >
                          <option value="">-- เลือกช่าง --</option>
                          {contractorRows.map((c) => {
                            const id = String(c["id_Contractor"] || c.id || "");
                            const name = String(c["ชื่อเล่น"] || c["ชื่อ-นามสกุล"] || id);
                            return (
                              <option key={id} value={id}>
                                {name} ({id})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-600 block mb-1">ยอดเงินจ้างรวม (บาท) *</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="เช่น 24000"
                          value={newTotalHireAmount}
                          onChange={(e) => setNewTotalHireAmount(e.target.value)}
                          required
                          className="w-full h-8.5 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-600 block mb-1">รายละเอียดงาน *</label>
                      <input
                        type="text"
                        placeholder="เช่น เบิกงานทุบ/รื้อ/ขนวัสดุ"
                        value={newJobDescription}
                        onChange={(e) => setNewJobDescription(e.target.value)}
                        required
                        className="w-full h-8.5 px-2.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowNewContractForm(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingContract}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded font-medium disabled:opacity-50"
                      >
                        {isSubmittingContract ? "กำลังบันทึก..." : "บันทึกสัญญาใหม่"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Expanded Contract Search & Picker */}
                {(!currentContract || isContractPickerExpanded) && !showNewContractForm && (
                  <div className="space-y-2 animate-in fade-in duration-100">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="พิมพ์ค้นหา: รหัส 540, ช่างเป็ด, ทุบ/รื้อ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-8.5 pl-8 pr-3 bg-white border border-slate-300 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
                      {filteredContracts.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-3 text-center text-xs text-slate-400">
                          ไม่พบสัญญาในโครงการนี้ กด &apos;+ เปิดสัญญาใหม่&apos; ด้านบนเพื่อเพิ่ม
                        </div>
                      ) : (
                        filteredContracts.map((c) => {
                          const cId = String(c["id_Conwork"] || c.id || "");
                          const isSelected = selectedContractId === cId;
                          const cNick = String(c["ชื่อเล่น"] || c["ผู้รับเหมา"] || "");
                          const cMatch = contractorRows.find(
                            (con) => String(con["id_Contractor"] || con.id || "") === String(c["id_Contractor"] || "")
                          );
                          const cName = cNick || (cMatch ? String(cMatch["ชื่อเล่น"] || cMatch["ชื่อ-นามสกุล"] || "") : "-");
                          const cJob = String(c["รายละเอียดงาน"] || "-");
                          const cHire = toNumber(c["ยอดเงินจ้าง"]);

                          return (
                            <button
                              key={cId}
                              type="button"
                              onClick={() => {
                                setSelectedContractId(cId);
                                setIsContractPickerExpanded(false);
                              }}
                              className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-medium"
                                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/70"
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-slate-800">
                                  #{cId.replace(/^CW/i, "")}
                                </span>{" "}
                                <span className="font-semibold text-slate-900">ช่าง {cName}</span>{" "}
                                <span className="text-slate-500 text-[11px] truncate block sm:inline">· {cJob}</span>
                              </div>
                              <span className="font-mono font-bold text-slate-900 shrink-0">
                                {money(cHire)} ฿
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: ระบุยอดเบิกและงวดงาน */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      ระบุยอดเบิกและงวดงาน
                    </span>
                  </div>

                  {isEditingPrevDisbursed ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-[11px] text-slate-400">เบิกสะสมเดิม:</span>
                      <input
                        type="number"
                        min="0"
                        value={prevDisbursedTotal}
                        onChange={(e) => setManualPrevDisbursed(Number(e.target.value))}
                        className="w-20 h-6 px-1.5 text-xs border border-slate-300 rounded font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setIsEditingPrevDisbursed(false)}
                        className="text-xs text-emerald-700 font-bold"
                      >
                        ตกลง
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingPrevDisbursed(true)}
                      className="text-[11px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={11} />
                      <span>แก้ยอดสะสมเดิม ({money(prevDisbursedTotal)})</span>
                    </button>
                  )}
                </div>

                {/* ยอดเงินเบิกงวดนี้ + ปุ่มลัด */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-bold text-slate-800">
                      จำนวนเงินที่ขอเบิกงวดนี้ (บาท) *
                    </label>
                    {remainingBeforeThis > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInstallmentAmount(Math.round(remainingBeforeThis / 2))}
                          className="px-2 py-0.5 rounded-md bg-white hover:bg-indigo-50 border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-indigo-700 transition cursor-pointer"
                        >
                          ครึ่งหนึ่ง (50%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setInstallmentAmount(remainingBeforeThis)}
                          className="px-2.5 py-0.5 rounded-md bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 text-[11px] font-bold text-emerald-800 transition cursor-pointer"
                        >
                          เบิกเต็มคงเหลือ ({money(remainingBeforeThis)})
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      placeholder="0"
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                      className={`w-full h-11 px-3.5 pr-12 rounded-xl border-2 text-lg font-mono font-bold bg-white focus:outline-none ${
                        isOverRemaining
                          ? "border-rose-400 text-rose-700"
                          : "border-emerald-500/80 text-slate-900 focus:border-emerald-600"
                      }`}
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">บาท</span>
                  </div>

                  {isOverRemaining && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={13} />
                      <span>
                        แจ้งเตือน: ยอดเบิกเกินวงเงินคงเหลือสัญญา ({money(currentInstAmt - remainingBeforeThis)} บาท)
                      </span>
                    </p>
                  )}
                </div>

                {/* งวดที่ & หมายเหตุ/ห้อง */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      เบิกงวดที่
                    </label>
                    <div className="flex items-center h-9 rounded-xl border border-slate-300 overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setInstallmentNo((n) => Math.max(1, n - 1))}
                        className="w-9 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 border-r border-slate-200 cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={installmentNo}
                        onChange={(e) => setInstallmentNo(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full text-center font-mono font-bold text-sm text-slate-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setInstallmentNo((n) => n + 1)}
                        className="w-9 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 border-l border-slate-200 cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      ระบุห้อง / โซน / หมายเหตุเพิ่มเติม (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ห้อง 304, 305 หรือ โซนด้านหลัง (เว้นว่างได้)"
                      value={noteOrAreaText}
                      onChange={(e) => setNoteOrAreaText(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Pill Toggles for Tax */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setHasDeduct3((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                      hasDeduct3
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center ${
                        hasDeduct3 ? "bg-indigo-600 text-white" : "border border-slate-300"
                      }`}
                    >
                      {hasDeduct3 && <Check size={11} />}
                    </div>
                    <span>หัก ณ ที่จ่าย 3%</span>
                    {hasDeduct3 && currentInstAmt > 0 && (
                      <span className="font-mono font-bold text-indigo-700">(-{money(deductAmount)})</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasVat7((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                      hasVat7
                        ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center ${
                        hasVat7 ? "bg-emerald-600 text-white" : "border border-slate-300"
                      }`}
                    >
                      {hasVat7 && <Check size={11} />}
                    </div>
                    <span>บวก VAT 7%</span>
                    {hasVat7 && currentInstAmt > 0 && (
                      <span className="font-mono font-bold text-emerald-700">(+{money(vatAmount)})</span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: NET TRANSFER SUMMARY + LINE PREVIEW + 1-CLICK SUBMIT (5 COLS) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              {/* Net Transfer Highlight Card */}
              <div className="bg-linear-to-r from-emerald-50 via-teal-50/50 to-white border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">ยอดโอนเข้าบัญชีช่างสุทธิ</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    ยอดเบิก {money(currentInstAmt)} {hasDeduct3 ? `- หัก 3% (${money(deductAmount)})` : ""}{" "}
                    {hasVat7 ? `+ VAT (${money(vatAmount)})` : ""}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    คงเหลือสัญญาหลังเบิก:{" "}
                    <strong className={`font-mono ${remainingContractAmount < 0 ? "text-rose-600" : "text-slate-800"}`}>
                      {money(remainingContractAmount)} ฿
                    </strong>
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold font-mono text-emerald-700">{money(netTransferAmount)}</div>
                  <div className="text-[10px] font-semibold text-emerald-600">บาทสุทธิ</div>
                </div>
              </div>

              {/* LINE Chat Preview */}
              <div className="flex-1 bg-slate-50/80 rounded-2xl p-3 border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/70 text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-[#06C755]" />
                    <span>ตัวอย่างข้อความส่ง LINE</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    {copySuccess ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{copySuccess ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                  </button>
                </div>

                <div className="flex-1 bg-white rounded-xl p-3 border border-slate-200/80 overflow-x-auto">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-slate-800 select-all">
                    {generatedMessage}
                  </pre>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl p-2.5 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <Check size={15} className="text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Primary 1-Click Action */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleSaveAndCopy}
                  disabled={isSavingBill || currentInstAmt <= 0}
                  className="w-full h-11 bg-[#06C755] hover:bg-[#05b34c] active:bg-[#049b42] text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send size={15} />
                  <span>
                    {isSavingBill
                      ? "กำลังบันทึกคำขอ..."
                      : "✅ บันทึกคำขออนุมัติ & คัดลอกข้อความส่ง LINE"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copySuccess ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copySuccess ? "คัดลอกข้อความแล้ว!" : "คัดลอกข้อความอย่างเดียว (ยังไม่บันทึกบิล)"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PENDING APPROVALS & HISTORY DASHBOARD */}
        {activeTab === "history" && (
          <div className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col gap-2.5 bg-slate-50/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setHistoryScope("contract")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      historyScope === "contract"
                        ? "bg-white text-indigo-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>สัญญา #{contractWorkIdClean || selectedContractId} ({contractorName})</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 text-slate-700">
                      {contractBills.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryScope("project")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      historyScope === "project"
                        ? "bg-white text-indigo-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>ทุกสัญญาในโครงการ</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200 text-slate-700">
                      {allProjectWageBills.length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setHistoryStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      historyStatusFilter === "all"
                        ? "bg-slate-800 text-white"
                        : "bg-slate-50 border border-slate-200 text-slate-600"
                    }`}
                  >
                    ทั้งหมด ({activeScopeBills.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryStatusFilter("pending")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      historyStatusFilter === "pending"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 border border-amber-200 text-amber-800"
                    }`}
                  >
                    ⏳ รออนุมัติ (
                    {
                      activeScopeBills.filter((b) => {
                        const s = normalizeBillStatus(b["สถานะ"] || b.status);
                        return s === "รออนุมัติ" || s === "ตั้งเบิก" || s === "รอตั้งเบิก";
                      }).length
                    }
                    )
                  </button>

                  <button
                    type="button"
                    onClick={() => setHistoryStatusFilter("paid")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      historyStatusFilter === "paid"
                        ? "bg-emerald-700 text-white"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    }`}
                  >
                    อนุมัติ/จ่ายแล้ว (
                    {
                      activeScopeBills.filter((b) => {
                        const s = normalizeBillStatus(b["สถานะ"] || b.status);
                        return s === "อนุมัติ" || s === "เบิกแล้ว";
                      }).length
                    }
                    )
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-44 sm:w-52">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาในตาราง..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-7 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus size={13} />
                  <span>เบิกงวดใหม่</span>
                </button>
              </div>
            </div>

            {/* Summary Strip */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200/90 text-xs text-slate-600 shadow-2xs overflow-x-auto shrink-0">
              <div className="flex items-center gap-3.5 shrink-0 flex-wrap">
                <span>
                  วงเงินรวม: <strong className="font-mono text-slate-900">{money(totalScopeHire)}</strong> ฿
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  เบิกแล้ว: <strong className="font-mono text-indigo-700">{money(scopePaidAmount)}</strong> ฿
                </span>
                <span className="text-slate-300">|</span>
                <span className={scopePendingAmount > 0 ? "text-amber-800 font-semibold" : ""}>
                  รออนุมัติ: <strong className="font-mono text-amber-700">{money(scopePendingAmount)}</strong> ฿
                </span>
              </div>
              <div className="shrink-0 font-medium">
                คงเหลือสุทธิ:{" "}
                <strong className={`font-mono text-sm ${scopeRemainingAmount < 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}`}>
                  {money(scopeRemainingAmount)}
                </strong>{" "}
                ฿
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col min-h-[300px]">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-14 border-r border-slate-200/70">ลำดับ</th>
                      <th className="py-2.5 px-3 w-24 border-r border-slate-200/70">ว/ด/ป</th>
                      <th className="py-2.5 px-3 w-36 border-r border-slate-200/70">ช่าง / ผู้รับเหมา</th>
                      <th className="py-2.5 px-3 min-w-[200px] border-r border-slate-200/70">รายละเอียดงาน / งวด</th>
                      <th className="py-2.5 px-3 text-right w-28 border-r border-slate-200/70">ยอดเบิก</th>
                      <th className="py-2.5 px-2 text-center w-20 border-r border-slate-200/70">หัก/Vat</th>
                      <th className="py-2.5 px-3 text-right w-28 border-r border-slate-200/70">ยอดโอนสุทธิ</th>
                      <th className="py-2.5 px-3 text-center w-28 border-r border-slate-200/70">สถานะ</th>
                      <th className="py-2.5 px-3 text-center w-36">การอนุมัติ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-normal">
                    {filteredHistoryBills.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400 bg-slate-50/50">
                          <FileText size={28} className="mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">ไม่พบข้อมูลในตาราง</p>
                        </td>
                      </tr>
                    ) : (
                      filteredHistoryBills.map((b, idx) => {
                        const bId = b.id ?? b["ลำดับ"] ?? b._sheetRow;
                        const bSeq = b["ลำดับ"] || b.id || idx + 1;
                        const bDate = b["ว/ด/ป"] || b["วันที่"] || b.bill_date || "-";
                        const bTitle = b["สินค้า/ทำงาน"] || b["รายละเอียดงาน"] || b.description || `เบิกค่างวด #${bSeq}`;
                        const bContractor = b["ร้าน/บุคคล"] || b["ผู้รับเหมา"] || contractorName || "-";
                        const bAmt = toNumber(b["ยอดเงิน"] || b["ค่าแรง"] || 0);
                        const bTransfer = toNumber(b["ยอดโอน"] || bAmt);
                        const bDeduct = b["หัก"] || "";
                        const bVat = b["vat"] || "";
                        const bStatus = normalizeBillStatus(b["สถานะ"] || b.status);
                        const isPending = bStatus === "รออนุมัติ" || bStatus === "ตั้งเบิก" || bStatus === "รอตั้งเบิก";
                        const isApproved = bStatus === "อนุมัติ";
                        const isPaid = bStatus === "เบิกแล้ว";
                        const isRejected = bStatus === "ไม่อนุมัติ";
                        const isUpdating = updatingBillId !== null && String(updatingBillId) === String(bId);

                        return (
                          <tr
                            key={String(bId || idx)}
                            className={`transition hover:bg-slate-50/90 ${
                              isPending ? "bg-amber-50/60 font-medium" : isRejected ? "opacity-60" : "bg-white"
                            }`}
                          >
                            <td className="py-2 px-3 text-center font-mono text-slate-600 font-bold border-r border-slate-200/60">
                              #{bSeq}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600 border-r border-slate-200/60 whitespace-nowrap">
                              {bDate}
                            </td>
                            <td className="py-2 px-3 text-slate-800 font-medium border-r border-slate-200/60 truncate max-w-[140px]">
                              {bContractor}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200/60">
                              <div className="font-medium text-slate-900 leading-snug truncate max-w-[280px]">
                                {bTitle}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800 border-r border-slate-200/60 font-semibold whitespace-nowrap">
                              {money(bAmt)}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-500 border-r border-slate-200/60 whitespace-nowrap">
                              {bDeduct || bVat ? `${bDeduct || "0%"} ${bVat ? `+Vat` : ""}` : "-"}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700 border-r border-slate-200/60 whitespace-nowrap">
                              {money(bTransfer)}
                            </td>
                            <td className="py-2 px-3 text-center border-r border-slate-200/60 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                  isPending
                                    ? "bg-amber-100 text-amber-900 border-amber-300"
                                    : isApproved
                                    ? "bg-sky-100 text-sky-900 border-sky-300"
                                    : isPaid
                                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                    : "bg-rose-100 text-rose-900 border-rose-300"
                                }`}
                              >
                                {isPending ? "⏳ รออนุมัติ" : isApproved ? "อนุมัติแล้ว" : isPaid ? "จ่ายเงินแล้ว" : "ไม่อนุมัติ"}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-center whitespace-nowrap">
                              {isPending ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateBillStatus(b, "อนุมัติ")}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <Check size={12} />
                                    <span>อนุมัติ</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateBillStatus(b, "ไม่อนุมัติ")}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                                  >
                                    <X size={12} />
                                    <span>ไม่อนุมัติ</span>
                                  </button>
                                </div>
                              ) : isPaid ? (
                                <span className="text-[10px] text-emerald-700 font-medium">✓ จ่ายเงินแล้ว</span>
                              ) : isApproved ? (
                                <span className="text-[10px] text-sky-700 font-medium">✓ อนุมัติแล้ว</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
