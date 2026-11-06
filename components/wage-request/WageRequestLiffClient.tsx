"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Hammer,
  Search,
  Copy,
  Check,
  Plus,
  AlertTriangle,
  FileText,
  Save,
  X,
  Send,
  MessageSquare,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Edit2,
  Clock,
  Minus,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import { TABLES } from "@/lib/config";
import { normalizeBillStatus } from "@/lib/bills/bill-status";
import { closeToLine } from "@/lib/line/line-close";
import type { SheetRow } from "@/lib/types";

export type WageRequestLiffClientProps = {
  initialProjects: SheetRow[];
  initialContracts: SheetRow[];
  initialContractors: SheetRow[];
  initialBills: SheetRow[];
  initialProjectId?: string;
  initialContractId?: string;
  initialTab?: "form" | "history";
};

export function WageRequestLiffClient({
  initialProjects,
  initialContracts,
  initialContractors,
  initialBills,
  initialProjectId = "",
  initialContractId = "",
  initialTab = "form",
}: WageRequestLiffClientProps) {
  // --- Navigation Tab State ---
  const [activeTab, setActiveTab] = useState<"form" | "history">(initialTab);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const t = p.get("tab");
      if (t === "history" || t === "approvals" || t === "pending") {
        setActiveTab("history");
      }
    }
  }, []);

  // --- History Tab Filter States ---
  const [historyScope, setHistoryScope] = useState<"contract" | "project">("contract");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "pending" | "paid" | "rejected">("all");
  const [historySearch, setHistorySearch] = useState("");

  // --- LIFF & Environment Detection ---
  const [isInClient, setIsInClient] = useState(false);
  const [liffProfile, setLiffProfile] = useState<{ displayName?: string; pictureUrl?: string; userId?: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initLiff() {
      if (typeof window === "undefined") return;
      try {
        let liff: any = (window as any).liff;
        if (!liff) {
          const liffModule = await import("@line/liff");
          liff = liffModule.default || (window as any).liff;
        }

        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2011122961-40UXax1L";
        if (liff && typeof liff.init === "function") {
          try {
            await liff.init({ liffId });
          } catch (initErr) {
            console.warn("LIFF init notice:", initErr);
          }
        }

        if (mounted && liff) {
          const inClient = typeof liff.isInClient === "function" ? liff.isInClient() : false;
          setIsInClient(inClient);

          if (typeof liff.isLoggedIn === "function" && liff.isLoggedIn()) {
            try {
              const prof = await liff.getProfile();
              if (mounted) setLiffProfile(prof);
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn("Failed to initialize LIFF in WageRequestLiffClient:", err);
      }
    }

    initLiff();
    return () => {
      mounted = false;
    };
  }, []);

  // --- Unified Project & Contract Selector States ---
  const [localContracts, setLocalContracts] = useState<SheetRow[]>(initialContracts);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [selectedContractId, setSelectedContractId] = useState<string>(initialContractId);
  const [isSelectorExpanded, setIsSelectorExpanded] = useState<boolean>(!initialContractId);
  const [unifiedSearch, setUnifiedSearch] = useState<string>("");
  const [showNewContractForm, setShowNewContractForm] = useState(false);

  // Resolve Contractor Display Name helper
  const resolveContractorNameFromRow = (contractRow: SheetRow | null): string => {
    if (!contractRow) return "-";
    const directNick = String(contractRow["ชื่อเล่น"] || "").trim();
    const directVendor = String(contractRow["ผู้รับเหมา"] || "").trim();
    const directFullName = String(contractRow["ชื่อ-นามสกุล"] || "").trim();

    if (directNick && directNick !== "-") return directNick;
    if (directVendor && directVendor !== "-") return directVendor;
    if (directFullName && directFullName !== "-") return directFullName;

    const cId = String(contractRow["id_Contractor"] || contractRow.contractor_id || "").trim();
    if (cId) {
      const found = initialContractors.find(
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
  };

  // Current selected contract object
  const currentContract = useMemo(() => {
    if (!selectedContractId) return null;
    return (
      localContracts.find(
        (c) => String(c["id_Conwork"] || c.id || "").trim() === selectedContractId.trim()
      ) || null
    );
  }, [localContracts, selectedContractId]);

  // Auto-sync project ID if user selected a contract directly
  useEffect(() => {
    if (currentContract) {
      const cProjId = String(currentContract["ID Project"] || currentContract.project_id || "").trim();
      if (cProjId && cProjId !== selectedProjectId) {
        setSelectedProjectId(cProjId);
      }
    }
  }, [currentContract, selectedProjectId]);

  const currentProject = useMemo(() => {
    if (!selectedProjectId) return null;
    const clean = selectedProjectId.trim().toLowerCase();
    return (
      initialProjects.find(
        (p) =>
          String(p["ID Project"] || p.id || "").trim().toLowerCase() === clean ||
          String(p["ชื่อ Project"] || "").trim().toLowerCase() === clean
      ) || null
    );
  }, [initialProjects, selectedProjectId]);

  const projectNameDisplay = useMemo(() => {
    if (currentProject) {
      return String(currentProject["ชื่อ Project"] || currentProject.name || selectedProjectId);
    }
    if (currentContract) {
      return String(currentContract["ชื่อ Project"] || currentContract.project_name || selectedProjectId || "-");
    }
    return selectedProjectId || "ทั้งหมด";
  }, [currentProject, currentContract, selectedProjectId]);

  // Contracts filtered by project (if selected) and search query (searches contractor, job, contract ID, or project name)
  const filteredContracts = useMemo(() => {
    let baseList = localContracts;

    if (selectedProjectId) {
      const pIdClean = String(currentProject?.["ID Project"] || selectedProjectId).trim().toLowerCase();
      const pNameClean = String(currentProject?.["ชื่อ Project"] || "").trim().toLowerCase();

      baseList = baseList.filter((c) => {
        const cProjId = String(c["ID Project"] || c.project_id || "").trim().toLowerCase();
        const cProjName = String(c["ชื่อ Project"] || c.project_name || "").trim().toLowerCase();
        return (
          cProjId === pIdClean ||
          (pNameClean && cProjName === pNameClean) ||
          (pIdClean && cProjName.includes(pIdClean))
        );
      });
    }

    if (!unifiedSearch.trim()) return baseList;

    const q = unifiedSearch.toLowerCase().trim();
    return baseList.filter((c) => {
      const id = String(c["id_Conwork"] || c.id || "").toLowerCase();
      const contractor = resolveContractorNameFromRow(c).toLowerCase();
      const job = String(c["รายละเอียดงาน"] || "").toLowerCase();
      const projName = String(c["ชื่อ Project"] || c.project_name || "").toLowerCase();
      const projId = String(c["ID Project"] || c.project_id || "").toLowerCase();
      return (
        id.includes(q) ||
        contractor.includes(q) ||
        job.includes(q) ||
        projName.includes(q) ||
        projId.includes(q)
      );
    });
  }, [localContracts, selectedProjectId, currentProject, unifiedSearch, initialContractors]);

  // Auto-select first contract when project is chosen and only 1 contract exists
  useEffect(() => {
    if (selectedProjectId && filteredContracts.length === 1 && !selectedContractId) {
      const firstId = String(filteredContracts[0]["id_Conwork"] || filteredContracts[0].id || "");
      setSelectedContractId(firstId);
      setIsSelectorExpanded(false);
    }
  }, [selectedProjectId, filteredContracts, selectedContractId]);

  // Local bills state
  const [localBills, setLocalBills] = useState<SheetRow[]>(initialBills);
  useEffect(() => {
    setLocalBills(initialBills);
  }, [initialBills]);
  const [updatingBillId, setUpdatingBillId] = useState<string | number | null>(null);

  const contractorName = useMemo(() => resolveContractorNameFromRow(currentContract), [currentContract, initialContractors]);

  const contractWorkIdClean = useMemo(() => {
    if (!currentContract) return "";
    const raw = String(currentContract["id_Conwork"] || currentContract.id || "").trim();
    return raw.replace(/^CW/i, "").trim() || raw;
  }, [currentContract]);

  // Accurate Past Bills for THIS specific contract (Fixed cross-contract mixing bug)
  const contractBills = useMemo(() => {
    if (!selectedContractId && !currentContract) return [];

    const targetCw = String(selectedContractId || currentContract?.["id_Conwork"] || currentContract?.id || "").trim().toUpperCase();
    const cleanCw = targetCw.replace(/^CW/i, "").trim();
    const cProjId = String(currentContract?.["ID Project"] || currentContract?.project_id || selectedProjectId || "").trim().toLowerCase();
    const cJob = String(currentContract?.["รายละเอียดงาน"] || "").trim().toLowerCase();

    return localBills.filter((b) => {
      const bConwork = String(b.conwork_id || b.data?.conwork_id || "").trim().toUpperCase();
      const bRef = String(b["ผู้รับเหมา"] || b._rawContractor || "").trim().toUpperCase();
      const bDesc = String(b["สินค้า/ทำงาน"] || b["รายละเอียดงาน"] || b.description || "").trim().toUpperCase();

      // 1. Explicit Contract ID match (CW540 or 540)
      if (targetCw && (bConwork === targetCw || bRef === targetCw || bConwork === `CW${cleanCw}` || bRef === `CW${cleanCw}`)) {
        return true;
      }
      if (cleanCw && cleanCw.length >= 2) {
        if (bConwork === cleanCw || bRef === cleanCw || bDesc.includes(`CW${cleanCw}`) || bDesc.includes(`รหัสงาน : ${cleanCw}`) || bDesc.includes(`หรัสงาน : ${cleanCw}`)) {
          return true;
        }
      }

      // If the bill explicitly belongs to ANOTHER CW contract, do NOT match it
      if ((bConwork && bConwork.startsWith("CW")) || (bRef && bRef.startsWith("CW"))) {
        return false;
      }

      // 2. Fallback for legacy bills without CW ID: must match BOTH same project AND same contractor + job description
      const bProjId = String(b["ID Project"] || b.project_id || "").trim().toLowerCase();
      if (cProjId && bProjId === cProjId && cJob && bDesc.toLowerCase().includes(cJob)) {
        return true;
      }

      return false;
    });
  }, [localBills, selectedContractId, currentContract, selectedProjectId]);

  const jobDescription = useMemo(() => {
    return String(currentContract?.["รายละเอียดงาน"] || "-").trim();
  }, [currentContract]);

  const totalContractHire = toNumber(currentContract?.["ยอดเงินจ้าง"]) || 0;

  // Previous Disbursed
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
    if (!selectedProjectId) {
      return localBills.filter((b) => {
        return (
          String(b["ร้านค้า/ผู้รับเหมา"] || "").includes("ผู้รับเหมา") ||
          String(b["ประเภท"] || "").startsWith("2") ||
          toNumber(b["ค่าแรง"]) > 0
        );
      });
    }
    const pIdClean = String(selectedProjectId).trim().toLowerCase();
    const pNameClean = String(currentProject?.["ชื่อ Project"] || "").trim().toLowerCase();
    return localBills.filter((b) => {
      const bProjId = String(b["ID Project"] || b.project_id || "").trim().toLowerCase();
      const bProjName = String(b["ชื่อ Project"] || b.project_name || "").trim().toLowerCase();
      const isProj = bProjId === pIdClean || (pNameClean && bProjName === pNameClean) || (pIdClean && bProjName.includes(pIdClean));
      const isWage =
        String(b["ร้านค้า/ผู้รับเหมา"] || "").includes("ผู้รับเหมา") ||
        String(b["ประเภท"] || "").startsWith("2") ||
        toNumber(b["ค่าแรง"]) > 0;
      return isProj && isWage;
    });
  }, [localBills, selectedProjectId, currentProject]);

  const pendingProjectBills = useMemo(() => {
    return allProjectWageBills.filter((b) => {
      const st = normalizeBillStatus(b["สถานะ"] || b.status);
      return st === "รออนุมัติ" || st === "ตั้งเบิก" || st === "รอตั้งเบิก";
    });
  }, [allProjectWageBills]);

  const activeScopeBills = useMemo(() => {
    return historyScope === "contract" && currentContract ? contractBills : allProjectWageBills;
  }, [historyScope, currentContract, contractBills, allProjectWageBills]);

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

  const projectContracts = useMemo(() => {
    if (!selectedProjectId) return localContracts;
    const pIdClean = String(currentProject?.["ID Project"] || selectedProjectId).trim().toLowerCase();
    const pNameClean = String(currentProject?.["ชื่อ Project"] || "").trim().toLowerCase();
    return localContracts.filter((c) => {
      const cProjId = String(c["ID Project"] || c.project_id || "").trim().toLowerCase();
      const cProjName = String(c["ชื่อ Project"] || c.project_name || "").trim().toLowerCase();
      return cProjId === pIdClean || (pNameClean && cProjName === pNameClean);
    });
  }, [localContracts, selectedProjectId, currentProject]);

  const totalScopeHire = useMemo(() => {
    if (historyScope === "contract" && currentContract) return totalContractHire;
    return projectContracts.reduce((sum, c) => sum + (toNumber(c["ยอดเงินจ้าง"]) || 0), 0);
  }, [historyScope, currentContract, totalContractHire, projectContracts]);

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
  const [dateText, setDateText] = useState(getTodayThaiString());
  const [installmentAmount, setInstallmentAmount] = useState<number | string>("");
  const [hasDeduct3, setHasDeduct3] = useState(true);
  const [hasVat7, setHasVat7] = useState(false);
  const [isLinePreviewOpen, setIsLinePreviewOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Sync installment defaults when contract changes
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
  const isOverRemaining = totalContractHire > 0 && currentInstAmt > totalContractHire - prevDisbursedTotal;

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
      `Project : ${projectNameDisplay || "-"}`,
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
    projectNameDisplay,
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

  // Unified 1-Click Action: Save Bill Request ("รออนุมัติ") + Send to LINE (or Copy)
  const handleSaveAndSend = async () => {
    if (!currentContract) {
      alert("กรุณาเลือกสัญญาจ้างก่อนบันทึก");
      return;
    }
    if (currentInstAmt <= 0) {
      alert("กรุณาระบุยอดเงินเบิกที่มากกว่า 0 บาท");
      return;
    }

    setIsSubmittingAll(true);
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

      const matchedContractor = initialContractors.find(
        (c) =>
          String(c["id_Contractor"] || c.id || "").toLowerCase() ===
          String(currentContract["id_Contractor"] || currentContract.contractor_id || "").toLowerCase()
      );
      const contractorType = String(
        matchedContractor?.["ประเภท"] || matchedContractor?.data?.contractor_type || "บุคคลธรรมดา"
      );

      const resolvedProjectId =
        currentProject?.["ID Project"] ||
        currentContract["ID Project"] ||
        currentContract.project_id ||
        selectedProjectId;

      const newBillRow = {
        "ID Project": resolvedProjectId,
        "ชื่อ Project": projectNameDisplay,
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
        "ผู้เบิก": liffProfile?.displayName || "Admin",
      };

      // 1. Save to Database
      const res = await fetch("/api/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: TABLES.DATA,
          row: newBillRow,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "บันทึกล้มเหลว");

      const savedSeq = json.insertedRow?.["ลำดับ"] || json.row?.["ลำดับ"] || "ใหม่";
      const createdRow = json.insertedRow || json.row || { ...newBillRow, "ลำดับ": savedSeq };
      setLocalBills((prev) => [createdRow, ...prev]);

      window.dispatchEvent(new CustomEvent("bills-data-updated"));
      window.dispatchEvent(new CustomEvent("data-updated"));

      // 2. Copy message to clipboard automatically
      await handleCopyMessage();

      // 3. If inside LINE LIFF client, send directly into LINE chat room
      if (isInClient) {
        try {
          let liff: any = (window as any).liff;
          if (!liff) {
            const liffModule = await import("@line/liff");
            liff = liffModule.default || (window as any).liff;
          }
          if (liff && typeof liff.sendMessages === "function") {
            await liff.sendMessages([{ type: "text", text: generatedMessage }]);
            alert(`✅ บันทึกคำขอ #${savedSeq} และส่งเข้าแชต LINE เรียบร้อยแล้ว!`);
            closeToLine();
            return;
          }
        } catch (lineErr) {
          console.warn("LIFF sendMessages fallback:", lineErr);
        }
      }

      setSaveSuccessMsg(`✅ บันทึกคำขอ #${savedSeq} (รออนุมัติ) และคัดลอกข้อความ LINE เรียบร้อยแล้ว!`);
      setInstallmentAmount("");
      setNoteOrAreaText("");
      setTimeout(() => setSaveSuccessMsg(""), 7000);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setIsSubmittingAll(false);
    }
  };

  // Quick status transition for pending requests (Approve / Reject)
  const handleUpdateBillStatus = async (bill: SheetRow, nextStatus: "อนุมัติ" | "ไม่อนุมัติ") => {
    const billId = bill.id ?? bill["ลำดับ"] ?? bill._sheetRow;
    const billSeq = bill["ลำดับ"] || bill.id;
    const actionText = nextStatus === "อนุมัติ" ? "อนุมัติสร้างบิล" : "ไม่อนุมัติ";
    const confirmed = window.confirm(`ยืนยัน '${actionText}' สำหรับคำขอเบิกค่าแรง #${billSeq} ใช่หรือไม่?`);
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

      setLocalBills((prev) =>
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
      setTimeout(() => setSaveSuccessMsg(""), 5000);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setUpdatingBillId(null);
    }
  };

  // Quick create contract
  const [newContractorId, setNewContractorId] = useState("");
  const [newJobDescription, setNewJobDescription] = useState("");
  const [newTotalHireAmount, setNewTotalHireAmount] = useState<number | string>("");
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("กรุณาเลือกโครงการก่อนเปิดสัญญาใหม่");
      return;
    }
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
      const matchedContractor = initialContractors.find(
        (c) => String(c["id_Contractor"] || c.id || "") === newContractorId
      );
      const nickname = matchedContractor
        ? String(matchedContractor["ชื่อเล่น"] || matchedContractor["ชื่อ-นามสกุล"] || "")
        : "";

      const newCwRow = {
        "ID Project": currentProject?.["ID Project"] || selectedProjectId,
        "ชื่อ Project": projectNameDisplay,
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
      setIsSelectorExpanded(false);
      setNewJobDescription("");
      setNewTotalHireAmount("");
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSubmittingContract(false);
    }
  };

  // Progress Bar Percentage
  const progressPercent = useMemo(() => {
    if (totalContractHire <= 0) return 0;
    return Math.min(100, Math.round((newDisbursedTotal / totalContractHire) * 100));
  }, [totalContractHire, newDisbursedTotal]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans text-slate-800">
      {/* 1. COMPACT TOP HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Hammer size={17} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                ขออนุมัติค่าแรงช่าง
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {liffProfile?.displayName ? `ผู้ขอ: ${liffProfile.displayName}` : "คำนวณค่างวด & ส่งอนุมัติในคลิกเดียว"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => closeToLine()}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <X size={15} />
            <span>ปิด</span>
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-2 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "form"
                ? "border-emerald-600 text-emerald-800 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText size={14} />
            <span>1. สร้างคำขอเบิก</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "history"
                ? "border-indigo-600 text-indigo-900 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock size={14} />
            <span>2. รออนุมัติ & ประวัติ</span>
            {(pendingContractBills.length > 0 || pendingProjectBills.length > 0) && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendingContractBills.length > 0 ? pendingContractBills.length : pendingProjectBills.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-3 sm:p-4 space-y-3.5">
        {/* Global Success Banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-3.5 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] shrink-0 cursor-pointer"
            >
              ดูรายการ
            </button>
          </div>
        )}

        {activeTab === "form" && (
          <>
            {/* =========================================================
                STEP 1: เลือกสัญญา / ช่าง (รวมค้นหาโครงการและช่างในที่เดียว)
               ========================================================= */}
            <section className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                    เลือกงานรับเหมา / ช่าง
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {currentContract && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectorExpanded((v) => !v);
                        setShowNewContractForm(false);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{isSelectorExpanded ? "ย่อ" : "เปลี่ยนสัญญา"}</span>
                      {isSelectorExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowNewContractForm((v) => !v);
                      setIsSelectorExpanded(false);
                    }}
                    className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus size={13} />
                    <span>เปิดสัญญาใหม่</span>
                  </button>
                </div>
              </div>

              {/* ACTIVE CONTRACT SUMMARY CARD (When Selected & Collapsed) */}
              {currentContract && !isSelectorExpanded && !showNewContractForm && (
                <div
                  onClick={() => setIsSelectorExpanded(true)}
                  className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-xl p-3 cursor-pointer transition space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[11px] font-bold">
                          #{contractWorkIdClean || selectedContractId}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          ช่าง {contractorName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1">
                        {jobDescription}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Building2 size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{projectNameDisplay}</span>
                      </p>
                    </div>
                    <span className="text-[11px] text-indigo-600 font-semibold shrink-0 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      เปลี่ยน
                    </span>
                  </div>

                  {/* Contract Balance Progress Bar inside Card */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        วงเงินจ้าง <strong className="text-slate-900 font-mono">{money(totalContractHire)}</strong> ฿
                      </span>
                      <span className="text-slate-500">
                        เบิกแล้ว ({ nextInstallmentNo - 1 } งวด):{" "}
                        <strong className="text-indigo-700 font-mono">{money(prevDisbursedTotal)}</strong> ฿
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
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

              {/* INLINE QUICK CREATE CONTRACT FORM */}
              {showNewContractForm && (
                <form
                  onSubmit={handleCreateContract}
                  className="bg-emerald-50/50 border border-emerald-300 rounded-xl p-3.5 space-y-3"
                >
                  <div className="text-xs font-bold text-emerald-950 flex items-center justify-between">
                    <span>+ เปิดสัญญาจ้างใหม่</span>
                    <button
                      type="button"
                      onClick={() => setShowNewContractForm(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">โครงการ *</label>
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        required
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                      >
                        <option value="">-- เลือกโครงการ --</option>
                        {initialProjects.map((p) => {
                          const pId = String(p["ID Project"] || p.id || "");
                          const pName = String(p["ชื่อ Project"] || p.name || pId);
                          return (
                            <option key={pId} value={pId}>
                              #{pId} - {pName}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">ช่าง / ผู้รับเหมา *</label>
                        <select
                          value={newContractorId}
                          onChange={(e) => setNewContractorId(e.target.value)}
                          required
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                        >
                          <option value="">-- เลือกช่าง --</option>
                          {initialContractors.map((c) => {
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
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">ยอดเงินจ้างรวม (บาท) *</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="เช่น 24000"
                          value={newTotalHireAmount}
                          onChange={(e) => setNewTotalHireAmount(e.target.value)}
                          required
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">รายละเอียดงานที่จ้าง *</label>
                      <input
                        type="text"
                        placeholder="เช่น งานทุบ/รื้อ/ขนวัสดุ หรือ งานปูกระเบื้อง"
                        value={newJobDescription}
                        onChange={(e) => setNewJobDescription(e.target.value)}
                        required
                        className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewContractForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingContract}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingContract ? "กำลังบันทึก..." : "บันทึกสัญญาใหม่"}
                    </button>
                  </div>
                </form>
              )}

              {/* EXPANDED UNIFIED PICKER (Project Filter + Smart Search) */}
              {(!currentContract || isSelectorExpanded) && !showNewContractForm && (
                <div className="space-y-2.5 animate-in fade-in duration-100">
                  {/* Optional Project Filter Dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <select
                        value={selectedProjectId}
                        onChange={(e) => {
                          setSelectedProjectId(e.target.value);
                          setSelectedContractId("");
                        }}
                        className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">🏢 ทุกโครงการ ({localContracts.length} สัญญา)</option>
                        {initialProjects.map((p) => {
                          const pId = String(p["ID Project"] || p.id || "");
                          const pName = String(p["ชื่อ Project"] || p.name || pId);
                          return (
                            <option key={pId} value={pId}>
                              #{pId} {pName}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Smart Search Input */}
                    <div className="sm:col-span-7 relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="พิมพ์ชื่อช่าง, รหัสสัญญา (เช่น 540), หรือชื่องาน..."
                        value={unifiedSearch}
                        onChange={(e) => setUnifiedSearch(e.target.value)}
                        className="w-full h-9 pl-8 pr-7 bg-white border border-slate-300 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      {unifiedSearch && (
                        <button
                          type="button"
                          onClick={() => setUnifiedSearch("")}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contract Cards List */}
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
                    {filteredContracts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                        <p>ไม่พบสัญญาเปิดจ้างที่ค้นหา</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewContractForm(true);
                            setIsSelectorExpanded(false);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>เปิดสัญญาจ้างใหม่ทันที</span>
                        </button>
                      </div>
                    ) : (
                      filteredContracts.slice(0, 50).map((c) => {
                        const cId = String(c["id_Conwork"] || c.id || "");
                        const isSelected = selectedContractId === cId;
                        const cName = resolveContractorNameFromRow(c);
                        const cJob = String(c["รายละเอียดงาน"] || "-");
                        const cHire = toNumber(c["ยอดเงินจ้าง"]);
                        const cProjName = String(c["ชื่อ Project"] || c.project_name || c["ID Project"] || "");

                        return (
                          <button
                            key={cId}
                            type="button"
                            onClick={() => {
                              setSelectedContractId(cId);
                              setIsSelectorExpanded(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/30"
                                : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 bg-slate-100 text-slate-800 rounded">
                                  #{cId.replace(/^CW/i, "")}
                                </span>
                                <span className="font-bold text-slate-900">ช่าง {cName}</span>
                                <span className="text-slate-600 truncate">· {cJob}</span>
                              </div>
                              {!selectedProjectId && cProjName && (
                                <div className="text-[10px] text-slate-400 truncate">
                                  โครงการ: {cProjName}
                                </div>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-mono font-bold text-slate-900">{money(cHire)} ฿</div>
                              <div className="text-[10px] text-emerald-600 font-semibold">เลือก →</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* =========================================================
                STEP 2: กรอกยอดเงินขอเบิกงวดนี้ (ง่าย เร็ว มีปุ่มลัด)
               ========================================================= */}
            {currentContract && (
              <section className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                      2
                    </span>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                      ระบุยอดเบิกและงวดงาน
                    </h2>
                  </div>

                  {/* วันที่ & ปรับแก้เบิกสะสมเดิม */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>วันที่ {dateText}</span>
                    {!isEditingPrevDisbursed ? (
                      <button
                        type="button"
                        onClick={() => setIsEditingPrevDisbursed(true)}
                        className="text-slate-400 hover:text-indigo-600 underline flex items-center gap-0.5 cursor-pointer"
                        title="แก้ไขยอดเบิกสะสมเดิม"
                      >
                        <Edit2 size={10} />
                        <span>แก้ยอดสะสมเดิม</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg">
                        <span>สะสมเดิม:</span>
                        <input
                          type="number"
                          min="0"
                          value={prevDisbursedTotal}
                          onChange={(e) => setManualPrevDisbursed(Number(e.target.value))}
                          className="w-20 h-5 px-1 text-[11px] bg-white border border-slate-300 rounded font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setIsEditingPrevDisbursed(false)}
                          className="text-emerald-700 font-bold"
                        >
                          ตกลง
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 1: ยอดเงินเบิกงวดนี้ + ปุ่มลัด */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-bold text-slate-800">
                      จำนวนเงินที่ขอเบิกงวดนี้ (บาท) *
                    </label>

                    {/* Quick Amount Chips */}
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
                          className="px-2 py-0.5 rounded-md bg-emerald-100/80 hover:bg-emerald-200/80 border border-emerald-300 text-[11px] font-bold text-emerald-800 transition cursor-pointer"
                        >
                          เบิกเต็มคงเหลือ ({money(remainingBeforeThis)})
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      placeholder="0"
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                      className={`w-full h-12 px-4 pr-14 rounded-xl border-2 text-xl font-mono font-bold bg-white focus:outline-none transition ${
                        isOverRemaining
                          ? "border-rose-400 text-rose-700 focus:border-rose-500"
                          : "border-emerald-500/80 text-slate-900 focus:border-emerald-600"
                      }`}
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">
                      บาท
                    </span>
                  </div>

                  {isOverRemaining && (
                    <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 font-semibold">
                      <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                      <span>
                        แจ้งเตือน: ยอดเบิกเกินวงเงินคงเหลือสัญญาอยู่ {money(currentInstAmt - remainingBeforeThis)} บาท
                      </span>
                    </div>
                  )}
                </div>

                {/* Row 2: งวดที่ (+/-) และ หมายเหตุ/ห้อง/พื้นที่ (ช่องเดียวจบ) */}
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

                {/* Row 3: ปุ่มเลือกภาษีแบบ Pill Toggle เข้าใจง่าย */}
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
              </section>
            )}

            {/* =========================================================
                STEP 3: สรุปยอดโอนสุทธิ & ปุ่มกดส่งในคลิกเดียว
               ========================================================= */}
            {currentContract && (
              <section className="bg-white border border-emerald-300 rounded-2xl p-4 shadow-sm space-y-3.5 animate-in fade-in duration-150">
                {/* Net Transfer Highlight Box */}
                <div className="bg-linear-to-r from-emerald-50 via-teal-50/60 to-white border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-950">
                      ยอดโอนเข้าบัญชีช่างสุทธิ
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      เบิกงวดที่ {installmentNo}: {money(currentInstAmt)}
                      {hasDeduct3 ? ` - หัก 3% (${money(deductAmount)})` : ""}
                      {hasVat7 ? ` + VAT 7% (${money(vatAmount)})` : ""}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      คงเหลือสัญญาหลังเบิกงวดนี้:{" "}
                      <strong className={`font-mono ${remainingContractAmount < 0 ? "text-rose-600" : "text-slate-800"}`}>
                        {money(remainingContractAmount)} ฿
                      </strong>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700">
                      {money(netTransferAmount)}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600">บาทสุทธิ</div>
                  </div>
                </div>

                {/* Collapsible LINE Message Preview (พับเก็บได้ ไม่รกหน้าจอ) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div
                    onClick={() => setIsLinePreviewOpen((v) => !v)}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-xs cursor-pointer transition"
                  >
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-[#06C755]" />
                      <span>ดูตัวอย่างข้อความที่จะส่งเข้า LINE</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyMessage();
                        }}
                        className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        {copySuccess ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copySuccess ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                      </button>
                      {isLinePreviewOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>

                  {isLinePreviewOpen && (
                    <div className="p-3 bg-white border-t border-slate-200">
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-slate-800 select-all">
                        {generatedMessage}
                      </pre>
                    </div>
                  )}
                </div>

                {/* PRIMARY 1-CLICK ACTION BUTTON */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveAndSend}
                    disabled={isSubmittingAll || currentInstAmt <= 0}
                    className="w-full h-12 bg-[#06C755] hover:bg-[#05b34c] active:bg-[#049b42] text-white rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send size={17} />
                    <span>
                      {isSubmittingAll
                        ? "กำลังบันทึกคำขอ..."
                        : isInClient
                        ? "✅ บันทึกคำขอ & ส่งเข้าแชต LINE ทันที"
                        : "✅ บันทึกคำขออนุมัติ & คัดลอกส่ง LINE"}
                    </span>
                  </button>

                  {/* Secondary helper button: Copy only without saving */}
                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer py-1"
                    >
                      {copySuccess ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copySuccess ? "คัดลอกข้อความสำเร็จแล้ว!" : "คัดลอกข้อความอย่างเดียว (ยังไม่บันทึกบิล)"}</span>
                    </button>

                    {pendingContractBills.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryScope("contract");
                          setHistoryStatusFilter("pending");
                          setActiveTab("history");
                        }}
                        className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer py-1"
                      >
                        <Clock size={12} />
                        <span>รออนุมัติ ({pendingContractBills.length}) →</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* =========================================================
            TAB 2: รออนุมัติ & ประวัติ (Mobile Cards + Desktop Table)
           ========================================================= */}
        {activeTab === "history" && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Scope & Search Controls */}
            <section className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setHistoryScope("contract")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      historyScope === "contract"
                        ? "bg-white text-indigo-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>เฉพาะสัญญานี้ ({contractBills.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryScope("project")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      historyScope === "project"
                        ? "bg-white text-indigo-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>ทั้งโครงการ ({allProjectWageBills.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("form")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>เบิกงวดใหม่</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="ค้นหาเลขที่บิล, ชื่อช่าง, รายละเอียดงวด..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-none"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 cursor-pointer ${
                    historyStatusFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  ทั้งหมด ({activeScopeBills.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("pending")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 cursor-pointer ${
                    historyStatusFilter === "pending"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 border border-amber-300 text-amber-800"
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
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 cursor-pointer ${
                    historyStatusFilter === "paid"
                      ? "bg-emerald-700 text-white"
                      : "bg-emerald-50 border border-emerald-300 text-emerald-800"
                  }`}
                >
                  ✓ อนุมัติแล้ว (
                  {
                    activeScopeBills.filter((b) => {
                      const s = normalizeBillStatus(b["สถานะ"] || b.status);
                      return s === "อนุมัติ" || s === "เบิกแล้ว";
                    }).length
                  }
                  )
                </button>
              </div>
            </section>

            {/* Summary Strip */}
            <div className="grid grid-cols-3 gap-2 bg-white rounded-2xl p-3 border border-slate-200/90 text-center text-xs shadow-2xs">
              <div>
                <span className="text-[10px] text-slate-400 block">วงเงินรวม</span>
                <strong className="font-mono text-slate-900">{money(totalScopeHire)} ฿</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">อนุมัติ/จ่ายแล้ว</span>
                <strong className="font-mono text-indigo-700">{money(scopePaidAmount)} ฿</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">คงเหลือสุทธิ</span>
                <strong className={`font-mono ${scopeRemainingAmount < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                  {money(scopeRemainingAmount)} ฿
                </strong>
              </div>
            </div>

            {/* MOBILE-FRIENDLY CARDS + DESKTOP LIST */}
            <div className="space-y-2">
              {filteredHistoryBills.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl py-10 text-center text-slate-400">
                  <FileText size={28} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">ไม่มีรายการคำขอเบิกค่าแรง</p>
                </div>
              ) : (
                filteredHistoryBills.map((b, idx) => {
                  const bId = b.id ?? b["ลำดับ"] ?? b._sheetRow;
                  const bSeq = b["ลำดับ"] || b.id || idx + 1;
                  const bDate = b["ว/ด/ป"] || b["วันที่"] || b.bill_date || "-";
                  const bTitle = b["สินค้า/ทำงาน"] || b["รายละเอียดงาน"] || b.description || `เบิกค่างวด #${bSeq}`;
                  const bContractor = b["ร้าน/บุคคล"] || b["ผู้รับเหมา"] || contractorName || "-";
                  const bAmt = toNumber(b["ยอดเงิน"] || b["ค่าแรง"] || 0);
                  const bTransfer = toNumber(b["ยอดโอน"] || bAmt);
                  const bStatus = normalizeBillStatus(b["สถานะ"] || b.status);
                  const isPending = bStatus === "รออนุมัติ" || bStatus === "ตั้งเบิก" || bStatus === "รอตั้งเบิก";
                  const isApproved = bStatus === "อนุมัติ";
                  const isPaid = bStatus === "เบิกแล้ว";
                  const isRejected = bStatus === "ไม่อนุมัติ";
                  const isUpdating = updatingBillId !== null && String(updatingBillId) === String(bId);

                  return (
                    <div
                      key={String(bId || idx)}
                      className={`bg-white border rounded-2xl p-3.5 shadow-2xs transition space-y-2.5 ${
                        isPending
                          ? "border-amber-300 bg-amber-50/20"
                          : isRejected
                          ? "border-slate-200 opacity-60"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{bSeq}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              ช่าง {bContractor}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">· {bDate}</span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1 leading-snug">
                            {bTitle}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            isPending
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : isApproved
                              ? "bg-sky-100 text-sky-900 border-sky-300"
                              : isPaid
                              ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                              : "bg-rose-100 text-rose-900 border-rose-300"
                          }`}
                        >
                          {isPending ? "⏳ รออนุมัติ" : isApproved ? "✓ อนุมัติแล้ว" : isPaid ? "💰 จ่ายแล้ว" : "✕ ไม่อนุมัติ"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-500">
                            ยอดเบิก: <strong className="font-mono text-slate-800">{money(bAmt)}</strong>
                          </span>
                          <span className="text-slate-500">
                            โอนสุทธิ: <strong className="font-mono text-indigo-700 text-sm">{money(bTransfer)} ฿</strong>
                          </span>
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleUpdateBillStatus(b, "อนุมัติ")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Check size={13} />
                              <span>อนุมัติ</span>
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleUpdateBillStatus(b, "ไม่อนุมัติ")}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                            >
                              <X size={13} />
                              <span>ไม่อนุมัติ</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-3 text-center text-[11px] text-slate-400 border-t border-slate-200/80 bg-white">
        CostLab Enterprise · ระบบขออนุมัติค่าแรงช่าง
      </footer>
    </div>
  );
}
