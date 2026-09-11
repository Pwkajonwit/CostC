"use client";

import React, { useEffect, useState } from "react";
import {
  Key,
  Shield,
  Clock,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Send,
  Save,
  Search,
  ChevronRight,
  Info,
  Terminal,
  Eye,
  EyeOff,
  Zap,
  Users,
  MessageSquare,
  Sparkles,
  Crown,
  ExternalLink,
  CheckCheck
} from "lucide-react";

type LineConfig = {
  LINE_LIFF_ID?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_USER_ID_OWN?: string;
  LINE_USER_ID_APPROVER?: string;
  LINE_GROUP_ID_TASK?: string;
  LINE_GROUP_ID_SUMMARY?: string;
  LINE_GROUP_ID_PW?: string;
  LINE_GROUP_ID_PLAN?: string;
  LINE_GROUP_ID_FINANCE?: string;
  LINE_GROUP_ID_PAID?: string;
  CRON_TIME_MORNING?: string;
  CRON_TIME_EVENING?: string;
};

type DiscoveredGroup = {
  groupId: string;
  firstSeen: string;
  lastSeen: string;
  messageCount: number;
};

type ErrorLog = {
  id: string;
  created_at: string;
  source: string;
  message: string;
  level: string;
  context?: any;
};

type ManualItem = {
  id: string;
  category: "finance" | "task" | "shortcut" | "system";
  categoryName: string;
  keyword: string;
  syntax: string;
  description: string;
  example: string;
  note?: string;
};

const LINE_MANUAL_ITEMS: ManualItem[] = [
  // System Category
  { id: "m1", category: "system", categoryName: "ตรวจสอบระบบ", keyword: "testbot", syntax: "testbot", description: "ทดสอบการเชื่อมต่อเซิร์ฟเวอร์ และสถานะฐานข้อมูล Supabase PostgreSQL", example: "testbot" },
  { id: "m2", category: "system", categoryName: "ตรวจสอบระบบ", keyword: "check", syntax: "check", description: "เช็คสถานะการทำงานของ Webhook Engine (Next.js Serverless)", example: "check" },
  { id: "m3", category: "system", categoryName: "ตรวจสอบระบบ", keyword: "status", syntax: "status", description: "แสดงรายงานสถานะบอทออนไลน์ และข้อมูลกลุ่มที่เชื่อมต่อ", example: "status" },
  { id: "m4", category: "system", categoryName: "ตรวจสอบระบบ", keyword: "getid", syntax: "getid", description: "ดึงข้อมูล ID ของผู้ใช้ปัจจุบัน และ ID ของกลุ่ม LINE ที่พิมพ์คำสั่ง", example: "getid" },
  { id: "m5", category: "system", categoryName: "ตรวจสอบระบบ", keyword: "ช่วยด้วย / เมนู", syntax: "เมนู", description: "เปิดการ์ดคู่มือสรุปคำสั่งที่ใช้งานบ่อยและปุ่มช่วยเหลือด่วน", example: "ช่วยเหลือ" },

  // Finance Category
  { id: "m6", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "สรุป / สรุปบิล", syntax: "สรุป", description: "แสดงการ์ด Flex สรุปภาพรวมยอดเบิกเงินประจำวัน ค่าใช้จ่ายสะสม และบิลค้างจ่าย", example: "สรุป" },
  { id: "m7", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "สรุปวันนี้", syntax: "สรุปวันนี้", description: "เรียกดูสรุปรายการบิลเงินสดและใบตั้งเบิกที่บันทึกเพิ่มในวันนี้เฉพาะกลุ่ม", example: "สรุปวันนี้" },
  { id: "m8", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "รออนุมัติ", syntax: "รออนุมัติ", description: "ดึงตารางรายการบิลที่อยู่ระหว่างรอผู้มีสิทธิ์อนุมัติยอดเงิน (Approver)", example: "รออนุมัติ" },
  { id: "m9", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "บิลหลัก: [ชื่อ]", syntax: "บิลหลัก: [ชื่อโครงการ/บิล]", description: "ค้นหาหรือสร้างกลุ่มบิลหลักสำหรับรวบรวมใบเบิกเงินย่อยตามโครงการ", example: "บิลหลัก: ค่าอุปกรณ์ไซต์ A" },
  { id: "m10", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "บิลย่อย: [ชื่อ]", syntax: "บิลย่อย: [รายการ] - [จำนวนเงิน]", description: "บันทึกบิลค่าใช้จ่ายย่อยเข้าสู่ระบบเพื่อขอตั้งเบิกเงิน", example: "บิลย่อย: ค่าน้ำมันรถกระบะ - 1200" },
  { id: "m11", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "อนุมัติบิลหลักของ:", syntax: "อนุมัติบิลหลักของ: [ชื่อ]", description: "อนุมัติรายการบิลหลักทั้งหมดของโครงการ (เฉพาะสิทธิ์ Admin / Approver)", example: "อนุมัติบิลหลักของ: โครงการบ้านพฤกษา" },
  { id: "m12", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "อนุมัติเงินสดบิลย่อยของ:", syntax: "อนุมัติเงินสดบิลย่อยของ: [ชื่อ]", description: "อนุมัติและจ่ายเงินสดสำหรับบิลย่อยของสมาชิก", example: "อนุมัติเงินสดบิลย่อยของ: สมชาย" },
  { id: "m13", category: "finance", categoryName: "สรุปการเงิน & เบิกเงิน", keyword: "ปิดงานบิลหลักลำดับที่:", syntax: "ปิดงานบิลหลักลำดับที่: [เลขบิล]", description: "เปลี่ยนสถานะบิลหลักเป็นชำระเงินสำเร็จและปิดงานบิล", example: "ปิดงานบิลหลักลำดับที่: 104" },

  // Task & PW Category
  { id: "m14", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "งาน2: [ชื่อ]", syntax: "งาน2: [ชื่อพนักงาน]", description: "เรียกดูตารางงานที่ได้รับมอบหมายและสถานะความคืบหน้าของพนักงานรายคน", example: "งาน2: วิชัย" },
  { id: "m15", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "งาน: [รายละเอียด]", syntax: "งาน: [รายละเอียดงาน] - [ชื่อผู้รับผิดชอบ]", description: "สั่งสร้างรายการงานมอบหมายใหม่เข้าตารางติดตามงานประจำวัน", example: "งาน: ตรวจสอบโครงสร้างเหล็กไซต์ B - ช่างเอก" },
  { id: "m16", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "งานด่วน:", syntax: "งานด่วน: [รายละเอียด]", description: "สร้างงานมอบหมายเร่งด่วน พร้อมติดป้ายเตือนความสำคัญระดับสูงใน LINE", example: "งานด่วน: ซ่อมปั๊มน้ำไซต์ A" },
  { id: "m17", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "ปิดงาน:", syntax: "ปิดงาน: [รหัสงาน]", description: "แจ้งเสร็จสิ้นงานและเปลี่ยนสถานะเป็นรอตรวจรับงาน", example: "ปิดงาน: CW-102" },
  { id: "m18", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "ยืนยันปิดงาน:", syntax: "ยืนยันปิดงาน: [รหัสงาน]", description: "หัวหน้างานตรวจสอบและอนุมัติปิดงานสมบูรณ์", example: "ยืนยันปิดงาน: CW-102" },
  { id: "m19", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "s: [ข้อความ]", syntax: "s: [คีย์เวิร์ดค้นหา]", description: "ค้นหาข้อมูลงาน บิล หรือเอกสารอย่างรวดเร็ว (Quick Search)", example: "s: ท่อ PVC" },
  { id: "m20", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "มอบหมาย:", syntax: "มอบหมาย: [งาน] -> [ผู้รับผิดชอบ]", description: "โอนย้ายหรือมอบหมายงานให้ทีมงานคนอื่นรับช่วงต่อ", example: "มอบหมาย: ทาสีรั้ว -> ช่างน้อย" },
  { id: "m21", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "กิจกรรม:", syntax: "กิจกรรม: [ชื่อกิจกรรม]", description: "บันทึกตารางกิจกรรมนัดหมายหรือการประชุมไซต์งาน", example: "กิจกรรม: ประชุมไซต์งานประจำสัปดาห์" },
  { id: "m22", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "PW:", syntax: "PW: [เรื่อง] / [ผู้รับเหมา]", description: "สร้างใบเปิดจ้างงาน PW (Pay Work) สำหรับผู้รับเหมาย่อย", example: "PW: งานผูกเหล็กฐานราก / ช่างเอก" },
  { id: "m23", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "PW1:work", syntax: "PW1:work", description: "แสดงแม่แบบสร้างใบสั่งจ้าง PW แบบขั้นตอนย่อ 1 บรรทัด", example: "PW1:work" },
  { id: "m24", category: "task", categoryName: "งาน & PW มอบหมาย", keyword: "PWALL:work", syntax: "PWALL:work", description: "ดึงรายการใบสั่งจ้าง PW ทั้งหมดที่กำลังรอดำเนินการ", example: "PWALL:work" },

  // Shortcuts Category
  { id: "m25", category: "shortcut", categoryName: "คำสั่งลัด (Shortcuts)", keyword: "copy / work", syntax: "copy", description: "ส่งแม่แบบข้อความสำหรับสร้างงานทั่วไปเพื่อให้คัดลอกได้ง่าย", example: "copy" },
  { id: "m26", category: "shortcut", categoryName: "คำสั่งลัด (Shortcuts)", keyword: "add1", syntax: "add1", description: "ส่งแม่แบบการสร้างงานแบบหลายบรรทัด (Multiline Task Template)", example: "add1" },
  { id: "m27", category: "shortcut", categoryName: "คำสั่งลัด (Shortcuts)", keyword: "add3", syntax: "add3", description: "ส่งแม่แบบการสร้าง 3 งานย่อยรวดเดียวต่อเนื่องกัน", example: "add3" },
  { id: "m28", category: "shortcut", categoryName: "คำสั่งลัด (Shortcuts)", keyword: "addp", syntax: "addp", description: "ส่งแม่แบบการเปิดจ้าง PW มัลติไลน์พร้อมรายละเอียดเบอร์ติดต่อ", example: "addp" },
  { id: "m29", category: "shortcut", categoryName: "คำสั่งลัด (Shortcuts)", keyword: "doo / doo2", syntax: "doo", description: "ดึงการ์ดสรุปรายการงานค้าง 8 รายการล่าสุดแบบด่วน", example: "doo" },
];

export function LineSystemDashboardClient() {
  const [activeTab, setActiveTab] = useState<"config" | "schedules" | "manual" | "logs">("config");

  // Config States
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [configSource, setConfigSource] = useState<"supabase" | "env">("env");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testTargetId, setTestTargetId] = useState("");
  const [copied, setCopied] = useState(false);

  // Manual States
  const [manualSearch, setManualSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // Discovered Groups
  const [discoveredGroups, setDiscoveredGroups] = useState<DiscoveredGroup[]>([]);

  // System Users for Approver & Owner Sync
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  // Logs States
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Quota & Bot Info States
  const [quotaInfo, setQuotaInfo] = useState<{
    botInfo?: { displayName?: string; basicId?: string; pictureUrl?: string };
    quota?: {
      limit: number;
      totalUsage: number;
      remaining: number;
      usagePercent: number;
      packageName: string;
      packageColor: string;
    };
  } | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);

  async function fetchQuotaInfo() {
    setLoadingQuota(true);
    try {
      const res = await fetch("/api/line/quota");
      const data = await res.json();
      if (res.ok && data.success) {
        setQuotaInfo(data);
      }
    } catch (err) {
      console.error("Failed to fetch quota info:", err);
    } finally {
      setLoadingQuota(false);
    }
  }

  // Form Configuration
  const [formConfig, setFormConfig] = useState<LineConfig>({
    LINE_LIFF_ID: "",
    LINE_CHANNEL_ACCESS_TOKEN: "",
    LINE_CHANNEL_SECRET: "",
    LINE_USER_ID_OWN: "",
    LINE_USER_ID_APPROVER: "",
    LINE_GROUP_ID_TASK: "",
    LINE_GROUP_ID_SUMMARY: "",
    LINE_GROUP_ID_PW: "",
    LINE_GROUP_ID_PLAN: "",
    LINE_GROUP_ID_FINANCE: "",
    LINE_GROUP_ID_PAID: "",
    CRON_TIME_MORNING: "07:30",
    CRON_TIME_EVENING: "17:00",
  });

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/line/webhook`
      : `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://costlab-steel.vercel.app"}/api/line/webhook`;

  useEffect(() => {
    async function loadConfig() {
      setLoadingConfig(true);
      try {
        const res = await fetch("/api/line/config");
        const data = await res.json();
        if (res.ok && data.config) {
          setFormConfig((prev) => ({ ...prev, ...data.config }));
          setConfigSource(data.source || "env");
          if (Array.isArray(data.discoveredGroups)) {
            setDiscoveredGroups(data.discoveredGroups);
          }
          if (data.config.LINE_USER_ID_OWN) {
            setTestTargetId(data.config.LINE_USER_ID_OWN);
          }
        }
      } catch (e) {
        console.error("Failed to load line config:", e);
      } finally {
        setLoadingConfig(false);
      }
    }

    async function fetchSystemUsers() {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (res.ok && Array.isArray(data.users)) {
          setSystemUsers(data.users);
        }
      } catch (err) {
        console.warn("Failed fetching users in line dashboard:", err);
      }
    }

    loadConfig();
    fetchSystemUsers();
    fetchErrorLogs();
    fetchQuotaInfo();
  }, []);

  async function fetchErrorLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/line/logs");
      const json = await res.json();
      if (json.success && Array.isArray(json.logs)) {
        setErrorLogs(json.logs);
      }
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleCreateTestLog() {
    try {
      const res = await fetch("/api/line/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "LINE Dashboard",
          message: `ทดสอบบันทึกระบบ Log เวลา ${new Date().toLocaleTimeString("th-TH")}`,
          level: "INFO",
          context: {
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "browser",
            status: "Healthy Test"
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchErrorLogs();
      }
    } catch (e) {
      console.error("Failed to create test log:", e);
    }
  }

  async function handleClearLogs() {
    if (!confirm("คุณต้องการล้างประวัติข้อผิดพลาด Logs ทั้งหมดใช่หรือไม่?")) return;
    try {
      const res = await fetch("/api/line/logs", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setErrorLogs([]);
      }
    } catch (e) {
      console.error("Failed to clear logs:", e);
    }
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyTextSnippet(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKeyword(text);
    setTimeout(() => setCopiedKeyword(null), 2000);
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/line/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formConfig }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveResult({ success: true, message: "บันทึกการตั้งค่า LINE Bot ลง Supabase เรียบร้อยแล้ว!" });
        setConfigSource("supabase");
      } else {
        setSaveResult({ success: false, message: data.error || "เกิดข้อผิดพลาดในการบันทึก" });
      }
    } catch (err: any) {
      setSaveResult({ success: false, message: err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleTestMessage() {
    if (!testTargetId.trim()) {
      setTestResult({ success: false, message: "กรุณาระบุ User ID หรือ Group ID สำหรับทดสอบ" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/line/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_message",
          targetId: testTargetId.trim(),
          text: `🟢 ทดสอบระบบ LINE Bot Supabase Engine!\n\nเวลา: ${new Date().toLocaleTimeString("th-TH")}\nสถานะ: ส่งข้อความสำเร็จ 100%`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: `ส่งข้อความทดสอบไปยัง ${testTargetId} สำเร็จ!` });
      } else {
        setTestResult({ success: false, message: data.error || "ส่งข้อความล้มเหลว ตรวจสอบ Access Token หรือ ID" });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestMorningTasks() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/cron/daily-tasks?force=true");
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: "ส่งการ์ดสรุปงานช่วงเช้าเข้า LINE กลุ่มงาน เรียบร้อยแล้ว!" });
      } else {
        setTestResult({ success: false, message: data.error || "เกิดข้อผิดพลาดในการยิงสรุปงานเช้า" });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "ไม่สามารถเรียกใช้งาน API ได้" });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestEveningSummary() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/cron/daily-summary?force=true");
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: "ส่งการ์ดสรุปผลงาน & การเงินช่วงเย็นเข้า LINE กลุ่มสรุป เรียบร้อยแล้ว!" });
      } else {
        setTestResult({ success: false, message: data.error || "เกิดข้อผิดพลาดในการยิงสรุปงานเย็น" });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || "ไม่สามารถเรียกใช้งาน API ได้" });
    } finally {
      setTesting(false);
    }
  }

  const filteredManual = LINE_MANUAL_ITEMS.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      manualSearch.trim() === "" ||
      item.keyword.toLowerCase().includes(manualSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(manualSearch.toLowerCase()) ||
      item.example.toLowerCase().includes(manualSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const detectedApprovers = systemUsers.filter(
    (u) => Boolean(u.canCloseBill) || u.role === "Approver" || u.role === "Admin_Approver"
  );

  const detectedClosers = systemUsers.filter(
    (u) => Boolean(u.canApprove) || u.role === "Admin_Closer" || u.role === "Finance"
  );

  const detectedOwners = systemUsers.filter(
    (u) => Boolean(u.isOwner) || u.role === "Owner"
  );

  return (
    <div className="space-y-3 font-sans text-xs text-slate-800 max-w-7xl mx-auto pb-8">
      {/* Top Header */}
      <div className="bg-white p-3 rounded-md border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-medium text-slate-900 tracking-tight">ตั้งค่าระบบ LINE Bot & คู่มือคำสั่ง</h1>
            <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-800 border border-emerald-200">
              V2.0 Active
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            จัดการ Token, LIFF ID, เวลาส่งสรุปงานประจำวัน, คู่มือคำสั่ง 63 คีย์เวิร์ด และตรวจ Error Logs
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">แหล่งข้อมูล:</span>
          <span className={`px-2 py-0.5 rounded border ${configSource === "supabase" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
            {configSource === "supabase" ? "Supabase DB" : "Environment Vars"}
          </span>
        </div>
      </div>

      {/* LINE OA Package & Message Quota Status Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            {quotaInfo?.botInfo?.pictureUrl ? (
              <img
                src={quotaInfo.botInfo.pictureUrl}
                alt="Bot Avatar"
                className="w-10 h-10 rounded-full border border-slate-200 shadow-2xs object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm border border-emerald-200">
                LINE
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm text-slate-900">
                  {quotaInfo?.botInfo?.displayName || "LINE Official Account"}
                </h2>
                {quotaInfo?.botInfo?.basicId && (
                  <span className="font-mono text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                    {quotaInfo.botInfo.basicId}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  เชื่อมต่อสมบูรณ์
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {quotaInfo?.quota?.packageName || "สถานะแพคเกจและโควต้าการส่งข้อความประจำเดือน (LINE Messaging API)"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchQuotaInfo}
            disabled={loadingQuota}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loadingQuota ? "animate-spin text-emerald-600" : "text-slate-600"} />
            <span>{loadingQuota ? "กำลังอัปเดต..." : "รีเฟรชโควต้า"}</span>
          </button>
        </div>

        {/* Quota Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Card 1: Package Type */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between space-y-1">
            <span className="text-xs text-slate-500">แพคเกจ LINE OA ปัจจุบัน</span>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-900">
                {quotaInfo?.quota?.limit === 500
                  ? "Free Package (ฟรี)"
                  : quotaInfo?.quota?.limit === 15000
                  ? "Light Package (ไลท์)"
                  : quotaInfo?.quota?.limit === 35000
                  ? "Pro Package (โปร)"
                  : quotaInfo?.quota?.limit && quotaInfo.quota.limit > 0
                  ? `${quotaInfo.quota.limit.toLocaleString()} ข้อความ/เดือน`
                  : "ไม่จำกัด / ไม่อั้น"}
              </span>
              <span className="text-xs text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {quotaInfo?.quota?.limit && quotaInfo.quota.limit > 0
                  ? `${quotaInfo.quota.limit.toLocaleString()} / ด.`
                  : "Unlimited"}
              </span>
            </div>
          </div>

          {/* Card 2: Used Messages */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between space-y-1">
            <span className="text-xs text-slate-500">ส่งข้อความแล้วเดือนนี้</span>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-mono text-slate-900">
                {quotaInfo?.quota ? quotaInfo.quota.totalUsage.toLocaleString() : "0"}{" "}
                <span className="text-xs font-normal text-slate-500">ข้อความ</span>
              </span>
              <span className="text-xs text-slate-600 font-mono">
                {quotaInfo?.quota?.usagePercent !== undefined
                  ? `${quotaInfo.quota.usagePercent.toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
          </div>

          {/* Card 3: Remaining Quota */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between space-y-1">
            <span className="text-xs text-slate-500">โควต้าคงเหลือเดือนนี้</span>
            <div className="flex items-baseline justify-between">
              <span className={`text-base font-mono ${
                quotaInfo?.quota && quotaInfo.quota.remaining === 0
                  ? "text-rose-600"
                  : quotaInfo?.quota && quotaInfo.quota.remaining < 50
                  ? "text-amber-600"
                  : "text-emerald-700"
              }`}>
                {quotaInfo?.quota
                  ? quotaInfo.quota.remaining === Infinity
                    ? "ไม่จำกัด"
                    : quotaInfo.quota.remaining.toLocaleString()
                  : "0"}{" "}
                <span className="text-xs font-normal text-slate-500">ข้อความ</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-xs border ${
                quotaInfo?.quota && quotaInfo.quota.remaining === 0
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}>
                {quotaInfo?.quota && quotaInfo.quota.remaining === 0 ? "โควต้าหมด" : "พร้อมใช้งาน"}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        {quotaInfo?.quota && quotaInfo.quota.limit > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>สัดส่วนการใช้งานโควต้าข้อความเดือนนี้</span>
              <span>
                {quotaInfo.quota.totalUsage.toLocaleString()} / {quotaInfo.quota.limit.toLocaleString()} ข้อความ
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quotaInfo.quota.usagePercent >= 90
                    ? "bg-rose-600"
                    : quotaInfo.quota.usagePercent >= 75
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.max(quotaInfo.quota.usagePercent, 2)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto bg-white px-2 rounded-t-md border-t border-x">
        <button
          type="button"
          onClick={() => setActiveTab("config")}
          className={`px-3 py-2 text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap rounded-t-sm ${
            activeTab === "config"
              ? "border-emerald-600 text-emerald-800 bg-emerald-50 font-medium"
              : "border-transparent text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/40"
          }`}
        >
          <Key size={13} className={activeTab === "config" ? "text-emerald-600" : "text-emerald-500/70"} />
          <span>1. ตั้งค่า Token & Group IDs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("schedules")}
          className={`px-3 py-2 text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap rounded-t-sm ${
            activeTab === "schedules"
              ? "border-amber-600 text-amber-900 bg-amber-50 font-medium"
              : "border-transparent text-slate-600 hover:text-amber-800 hover:bg-amber-50/40"
          }`}
        >
          <Clock size={13} className={activeTab === "schedules" ? "text-amber-600" : "text-amber-500/70"} />
          <span>2. เวลาส่งสรุปประจำวัน</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={`px-3 py-2 text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap rounded-t-sm ${
            activeTab === "manual"
              ? "border-blue-600 text-blue-900 bg-blue-50 font-medium"
              : "border-transparent text-slate-600 hover:text-blue-800 hover:bg-blue-50/40"
          }`}
        >
          <BookOpen size={13} className={activeTab === "manual" ? "text-blue-600" : "text-blue-500/70"} />
          <span>3. คู่มือคำสั่ง (63 คีย์เวิร์ด)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`px-3 py-2 text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap rounded-t-sm ${
            activeTab === "logs"
              ? "border-rose-600 text-rose-900 bg-rose-50 font-medium"
              : "border-transparent text-slate-600 hover:text-rose-800 hover:bg-rose-50/40"
          }`}
        >
          <AlertTriangle size={13} className={activeTab === "logs" ? "text-rose-600" : "text-rose-500/70"} />
          <span>4. ประวัติ Error Logs</span>
        </button>
      </div>

      {/* Global Result Alerts */}
      {saveResult && (
        <div className={`p-2.5 rounded-md border text-xs flex items-center justify-between gap-2 ${saveResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"}`}>
          <div className="flex items-center gap-1.5">
            {saveResult.success ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={14} className="text-rose-600 shrink-0" />}
            <span>{saveResult.message}</span>
          </div>
          <button type="button" onClick={() => setSaveResult(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
        </div>
      )}

      {testResult && (
        <div className={`p-2.5 rounded-md border text-xs flex items-center justify-between gap-2 ${testResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
          <div className="flex items-center gap-1.5">
            {testResult.success ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <Info size={14} className="text-amber-600 shrink-0" />}
            <span>{testResult.message}</span>
          </div>
          <button type="button" onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
        </div>
      )}

      {/* TAB 1: Config (Token & Group IDs) */}
      {activeTab === "config" && (
        <div className="space-y-3">
          {/* Webhook URL Box */}
          <div className="bg-white p-3 rounded-md border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-800">
                <Terminal size={14} className="text-slate-500" />
                <span className="text-xs">Webhook Endpoint URL (ระบุใน LINE Developers Console):</span>
              </div>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">SSL / HTTPS Ready</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={copyWebhook}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded transition flex items-center gap-1 text-xs shrink-0 cursor-pointer"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? "คัดลอกแล้ว" : "คัดลอก URL"}</span>
              </button>
            </div>
          </div>

          {/* Discovered LINE Groups Card */}
          {discoveredGroups.length > 0 && (
            <div className="bg-white p-3 rounded-md border border-emerald-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-emerald-600" />
                  <span className="text-xs text-slate-900">ตรวจพบกลุ่ม LINE ที่มีการรับส่งข้อความอัตโนมัติ ({discoveredGroups.length} กลุ่ม)</span>
                </div>
                <span className="text-xs text-slate-500">คัดลอก Group ID ด้านล่างไปใส่ในช่องกลุ่มเป้าหมาย</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {discoveredGroups.map((g) => (
                  <div key={g.groupId} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <div className="font-mono text-xs text-slate-800 truncate" title={g.groupId}>{g.groupId}</div>
                      <div className="text-xs text-slate-500">รับแล้ว {g.messageCount} ข้อความ</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyTextSnippet(g.groupId)}
                      className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs cursor-pointer shrink-0"
                    >
                      {copiedKeyword === g.groupId ? "คัดลอกแล้ว" : "คัดลอก ID"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSaveConfig} className="bg-white p-3.5 rounded-md border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-xs font-medium text-slate-900 m-0">กำหนดค่า Token & Group IDs</h2>
                <p className="text-xs text-slate-500 m-0">ระบุการตั้งค่าสำหรับการเชื่อมต่อ LINE Messaging API และ LINE OA LIFF</p>
              </div>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded transition flex items-center gap-1 text-xs cursor-pointer disabled:opacity-50"
              >
                {savingConfig ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                <span>บันทึกการตั้งค่า</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Credentials & LIFF Section */}
              <div className="sm:col-span-2 border-b border-slate-100 pb-1">
                <span className="text-xs text-slate-500 uppercase">🔑 Credentials & LIFF App ID (LINE OA & Bot)</span>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-700 block text-xs">LINE LIFF ID (เช่น 1234567890-AbCdEfGh สำหรับเข้าสู่ระบบผ่าน LINE OA)</label>
                <input
                  type="text"
                  value={formConfig.LINE_LIFF_ID || ""}
                  onChange={(e) => setFormConfig({ ...formConfig, LINE_LIFF_ID: e.target.value })}
                  placeholder="ระบุ LIFF ID จาก LINE Developers Console..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-700 block text-xs">LINE Channel Access Token *</label>
                <div className="relative flex items-center">
                  <input
                    type={showToken ? "text" : "password"}
                    required
                    value={formConfig.LINE_CHANNEL_ACCESS_TOKEN || ""}
                    onChange={(e) => setFormConfig({ ...formConfig, LINE_CHANNEL_ACCESS_TOKEN: e.target.value })}
                    placeholder="วาง Access Token..."
                    className="w-full bg-white border border-slate-300 rounded pl-2.5 pr-8 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-slate-700 block text-xs">LINE Channel Secret</label>
                <div className="relative flex items-center">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={formConfig.LINE_CHANNEL_SECRET || ""}
                    onChange={(e) => setFormConfig({ ...formConfig, LINE_CHANNEL_SECRET: e.target.value })}
                    placeholder="วาง Channel Secret..."
                    className="w-full bg-white border border-slate-300 rounded pl-2.5 pr-8 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Dynamic Target User IDs Section from User Management */}
              <div className="sm:col-span-2 space-y-2.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 mt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#0b3531] text-[#d4f54e] flex items-center justify-center">
                      <Users size={13} />
                    </div>
                    <span className="text-xs font-semibold text-slate-900">
                      สิทธิ์ผู้รับการแจ้งเตือน LINE Bot (ซิงค์อัตโนมัติจาก 6. ชื่อพนักงาน)
                    </span>
                  </div>
                  <a
                    href="/views/people"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0"
                  >
                    <span>⚙️ จัดการสิทธิ์ที่หน้า 6. ชื่อพนักงาน (People)</span>
                    <ExternalLink size={11} />
                  </a>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  ระบบจะดึง LINE User ID ของ <strong>เจ้าของระบบ (Owner)</strong>, <strong>ผู้อนุมัติ (Approvers)</strong>, และ <strong>ผู้ปิดงาน/การเงิน (Closers)</strong> จากตาราง <strong>6. ชื่อพนักงาน (master_members)</strong> โดยอัตโนมัติ
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                  {/* 👑 Box 1: Owner (เจ้าของระบบ) */}
                  <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                        <span>👑</span>
                        <span>1. เจ้าของระบบ (Owner)</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-semibold">
                        {detectedOwners.length} ท่าน
                      </span>
                    </div>
                    {detectedOwners.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {detectedOwners.map((u, i) => (
                          <div key={i} className="text-xs text-slate-800 flex items-center justify-between gap-1.5 p-1.5 bg-white/90 rounded-md border border-amber-200">
                            <div className="flex items-center gap-1 min-w-0 flex-wrap">
                              <span className="truncate font-medium text-slate-900">{u.displayName || u.username}</span>
                              <span className="px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-semibold shrink-0">
                                👑 เจ้าของ
                              </span>
                              {u.canCloseBill && (
                                <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold shrink-0">
                                  ✓ อนุมัติ
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${u.lineUserId ? "text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold" : "text-slate-400 bg-slate-50 border border-slate-200"}`}>
                              {u.lineUserId ? "✓ ผูก LINE แล้ว" : "✕ ยังไม่ผูก LINE"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 py-1">
                        ยังไม่มีผู้ใช้ที่ได้รับสิทธิ์เจ้าของระบบ (Owner)
                      </div>
                    )}
                    <p className="text-[10px] text-amber-800/90 leading-tight">
                      รับสรุปผลงานประจำวัน (เช้า-เย็น) เท่านั้น
                    </p>
                  </div>

                  {/* 🟢 Box 2: Approvers (อนุมัติตั้งเบิก) */}
                  <div className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                        <Check size={12} className="text-emerald-600" />
                        <span>2. ผู้อนุมัติตั้งเบิก (Approvers)</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-semibold">
                        {detectedApprovers.length} ท่าน
                      </span>
                    </div>
                    {detectedApprovers.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {detectedApprovers.map((u, i) => (
                          <div key={i} className="text-xs text-slate-800 flex items-center justify-between gap-1.5 p-1.5 bg-white/90 rounded-md border border-emerald-200">
                            <div className="flex items-center gap-1 min-w-0 flex-wrap">
                              <span className="truncate font-medium text-slate-900">{u.displayName || u.username}</span>
                              <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold shrink-0">
                                ✓ อนุมัติ
                              </span>
                              {u.isOwner && (
                                <span className="px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-semibold shrink-0">
                                  👑 เจ้าของ
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${u.lineUserId ? "text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold" : "text-slate-400 bg-slate-50 border border-slate-200"}`}>
                              {u.lineUserId ? "✓ ผูก LINE แล้ว" : "✕ ยังไม่ผูก LINE"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 py-1">
                        ยังไม่มีผู้ใช้ที่มีสิทธิ์อนุมัติตั้งเบิก (ไปที่ 6. ชื่อพนักงาน เพื่อเปิดสิทธิ์)
                      </div>
                    )}
                    <p className="text-[10px] text-emerald-800/90 leading-tight">
                      รับการ์ด Flex ขออนุมัติและกดอนุมัติตั้งเบิกผ่าน LINE
                    </p>
                  </div>

                  {/* 🔵 Box 3: Closers (ปิดงาน / ปิดบิล) */}
                  <div className="p-2.5 rounded-lg border border-blue-300 bg-blue-50/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1">
                        <CheckCheck size={12} className="text-blue-600" />
                        <span>3. ผู้ปิดงาน / การเงิน (Closers)</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 border border-blue-300 font-mono font-semibold">
                        {detectedClosers.length} ท่าน
                      </span>
                    </div>
                    {detectedClosers.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {detectedClosers.map((u, i) => (
                          <div key={i} className="text-xs text-slate-800 flex items-center justify-between gap-1.5 p-1.5 bg-white/90 rounded-md border border-blue-200">
                            <div className="flex items-center gap-1 min-w-0 flex-wrap">
                              <span className="truncate font-medium text-slate-900">{u.displayName || u.username}</span>
                              <span className="px-1 py-0.2 rounded text-[9px] bg-blue-100 text-blue-900 border border-blue-300 font-semibold shrink-0">
                                ✓ การเงิน
                              </span>
                              {u.isOwner && (
                                <span className="px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-semibold shrink-0">
                                  👑 เจ้าของ
                                </span>
                              )}
                            </div>
                            <span className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${u.lineUserId ? "text-blue-700 bg-blue-50 border border-blue-200 font-semibold" : "text-slate-400 bg-slate-50 border border-slate-200"}`}>
                              {u.lineUserId ? "✓ ผูก LINE แล้ว" : "✕ ยังไม่ผูก LINE"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 py-1">
                        ยังไม่มีผู้ใช้ที่มีสิทธิ์ปิดงานบิล (ไปที่ 6. ชื่อพนักงาน เพื่อเปิดสิทธิ์)
                      </div>
                    )}
                    <p className="text-[10px] text-blue-800/90 leading-tight">
                      รับการ์ด Flex แจ้งเตือนปิดงานและกดยืนยันจ่ายเงินสำเร็จ
                    </p>
                  </div>
                </div>
              </div>

              {/* Group IDs Section */}
              <div className="sm:col-span-2 border-b border-slate-100 pb-1 mt-1">
                <span className="text-xs text-slate-500 uppercase">👥 Group IDs กลุ่ม LINE สำหรับยิงการ์ด Flex</span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 block text-xs">กลุ่มงานประจำวัน (TASK Group ID)</label>
                <input
                  type="text"
                  value={formConfig.LINE_GROUP_ID_TASK || ""}
                  onChange={(e) => setFormConfig({ ...formConfig, LINE_GROUP_ID_TASK: e.target.value })}
                  placeholder="เช่น C1234567890..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 block text-xs">กลุ่มสรุปผลงาน & การเงิน (SUMMARY Group ID)</label>
                <input
                  type="text"
                  value={formConfig.LINE_GROUP_ID_SUMMARY || ""}
                  onChange={(e) => setFormConfig({ ...formConfig, LINE_GROUP_ID_SUMMARY: e.target.value })}
                  placeholder="เช่น C1234567890..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 block text-xs">กลุ่มงานจ้าง PW (PW Group ID)</label>
                <input
                  type="text"
                  value={formConfig.LINE_GROUP_ID_PW || ""}
                  onChange={(e) => setFormConfig({ ...formConfig, LINE_GROUP_ID_PW: e.target.value })}
                  placeholder="เช่น C1234567890..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 block text-xs">กลุ่มแผนงาน (PLAN Group ID)</label>
                <input
                  type="text"
                  value={formConfig.LINE_GROUP_ID_PLAN || ""}
                  onChange={(e) => setFormConfig({ ...formConfig, LINE_GROUP_ID_PLAN: e.target.value })}
                  placeholder="เช่น C1234567890..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 block text-xs">กลุ่มการเงิน & ตั้งเบิก (FINANCE Group ID)</label>
                <input
                  type="text"
                  value={formConfig.LINE_GROUP_ID_FINANCE || ""}
                  onChange={(e) => setFormConfig({ ...formConfig, LINE_GROUP_ID_FINANCE: e.target.value })}
                  placeholder="เช่น C1234567890..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 block text-xs">กลุ่มจ่ายเงินแล้ว (PAID Group ID)</label>
                <input
                  type="text"
                  value={formConfig.LINE_GROUP_ID_PAID || ""}
                  onChange={(e) => setFormConfig({ ...formConfig, LINE_GROUP_ID_PAID: e.target.value })}
                  placeholder="เช่น C1234567890..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded transition flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
              >
                {savingConfig ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                <span>บันทึกการตั้งค่า</span>
              </button>
            </div>
          </form>

          {/* Test Message Box */}
          <div className="bg-white p-3 rounded-md border border-slate-200 shadow-2xs space-y-2">
            <div className="text-xs text-slate-900">🧪 ทดสอบยิงข้อความเข้า LINE (Test Notification)</div>
            <div className="flex flex-col sm:flex-row items-end gap-2">
              <div className="flex-1 w-full space-y-1">
                <label className="text-slate-600 block text-xs">ระบุ User ID หรือ Group ID ที่ต้องการทดสอบยิงข้อความ:</label>
                <input
                  type="text"
                  value={testTargetId}
                  onChange={(e) => setTestTargetId(e.target.value)}
                  placeholder="เช่น U123... หรือ C123..."
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                />
              </div>
              <button
                type="button"
                disabled={testing}
                onClick={handleTestMessage}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded transition flex items-center justify-center gap-1 text-xs cursor-pointer shrink-0 disabled:opacity-50"
              >
                {testing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                <span>ทดสอบยิงข้อความ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Schedules (Morning & Evening Cron) */}
      {activeTab === "schedules" && (
        <div className="space-y-3">
          <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-2xs space-y-3">
            <div>
              <h2 className="text-xs font-medium text-slate-900 m-0">⏰ กำหนดเวลาแจ้งเตือนสรุปผลงานประจำวัน (Daily Schedules)</h2>
              <p className="text-xs text-slate-500 m-0">ระบบ Serverless Cron จะยิงการ์ด Flex สรุปงานเช้าและเย็นตามเวลาที่กำหนด</p>
            </div>

            {/* Owner Recipient Info Badge */}
            {detectedOwners.length > 0 && (
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">👑</span>
                  <div>
                    <span className="font-semibold text-amber-950">
                      ผู้รับการแจ้งเตือนสรุปผลงานประจำวัน (Daily Schedules):
                    </span>{" "}
                    <span className="text-amber-900 font-medium">
                      {detectedOwners.map(o => o.displayName || o.username).join(", ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${detectedOwners.some(o => o.lineUserId) ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {detectedOwners.some(o => o.lineUserId) ? "✓ ผูก LINE รับสรุปเช้า/เย็นแล้ว" : "✕ ยังไม่ผูก LINE User ID"}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Morning Schedule */}
              <div className="p-3 rounded border border-amber-200 bg-amber-50/50 space-y-2">
                <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                  <span className="text-slate-900 text-xs flex items-center gap-1.5">
                    🌅 สรุปงานเช้า (Morning Task Alert)
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 border border-amber-300">
                    กลุ่มงาน TASK
                  </span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  สรุปงานค้าง งานด่วนประจำวัน และรายการงานที่ต้องตรวจรับเข้า LINE กลุ่มงาน
                </p>
                <div className="space-y-1">
                  <label className="text-slate-700 block text-xs">เวลาแจ้งเตือนช่วงเช้า:</label>
                  <input
                    type="text"
                    value={formConfig.CRON_TIME_MORNING || "07:30"}
                    onChange={(e) => setFormConfig({ ...formConfig, CRON_TIME_MORNING: e.target.value })}
                    placeholder="07:30"
                    className="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 font-mono text-amber-950 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={handleTestMorningTasks}
                    className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded transition flex items-center justify-center gap-1 text-xs cursor-pointer disabled:opacity-50"
                  >
                    {testing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                    <span>ทดสอบยิงสรุปงานเช้าเข้า LINE ({formConfig.CRON_TIME_MORNING || "07:30"} น.)</span>
                  </button>
                </div>
              </div>

              {/* Evening Schedule */}
              <div className="p-3 rounded border border-slate-300 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-900 text-xs flex items-center gap-1.5">
                    📊 สรุปผลงานทีม & การเงินช่วงเย็น (Evening Summary)
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-800 border border-slate-300">
                    3 แท็บ Carousel
                  </span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  สรุปยอดเงินรวมรายการบิล, อัตราความสำเร็จผลงานทีม (Success Rate %), และรายการงานค้าง
                </p>
                <div className="space-y-1">
                  <label className="text-slate-700 block text-xs">เวลาแจ้งเตือนช่วงเย็น:</label>
                  <input
                    type="text"
                    value={formConfig.CRON_TIME_EVENING || "17:00"}
                    onChange={(e) => setFormConfig({ ...formConfig, CRON_TIME_EVENING: e.target.value })}
                    placeholder="17:00"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900 text-xs focus:outline-none focus:border-slate-500"
                  />
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={handleTestEveningSummary}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded transition flex items-center justify-center gap-1 text-xs cursor-pointer disabled:opacity-50"
                  >
                    {testing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                    <span>ทดสอบยิงสรุปงานเย็นเข้า LINE ({formConfig.CRON_TIME_EVENING || "17:00"} น.)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Manual (63 Commands) */}
      {activeTab === "manual" && (
        <div className="space-y-3">
          {/* Manual Filter Topbar */}
          <div className="bg-white p-3 rounded-md border border-slate-200 shadow-2xs space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder="ค้นหาคำสั่ง LINE Bot (เช่น สรุป, งาน, PW, testbot)..."
                  className="w-full bg-white border border-slate-300 rounded pl-8 pr-2.5 py-1 text-slate-800 focus:outline-none focus:border-slate-500 text-xs"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`px-2.5 py-1 rounded text-xs transition cursor-pointer whitespace-nowrap ${selectedCategory === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  ทั้งหมด ({LINE_MANUAL_ITEMS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("finance")}
                  className={`px-2.5 py-1 rounded text-xs transition cursor-pointer whitespace-nowrap ${selectedCategory === "finance" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  การเงิน
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("task")}
                  className={`px-2.5 py-1 rounded text-xs transition cursor-pointer whitespace-nowrap ${selectedCategory === "task" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  งาน & PW
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("shortcut")}
                  className={`px-2.5 py-1 rounded text-xs transition cursor-pointer whitespace-nowrap ${selectedCategory === "shortcut" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  คำสั่งลัด
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("system")}
                  className={`px-2.5 py-1 rounded text-xs transition cursor-pointer whitespace-nowrap ${selectedCategory === "system" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  ระบบ
                </button>
              </div>
            </div>
          </div>

          {/* Manual Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredManual.map((item) => (
              <div key={item.id} className="bg-white p-3 rounded-md border border-slate-200 shadow-2xs space-y-2 hover:border-slate-300 transition">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="font-mono text-xs text-emerald-800">{item.keyword}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200">
                    {item.categoryName}
                  </span>
                </div>

                <p className="text-slate-600 text-xs leading-normal">{item.description}</p>

                <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-xs text-slate-500">รูปแบบพิมพ์ใน LINE:</div>
                  <div className="flex items-center justify-between gap-1">
                    <code className="font-mono text-xs text-slate-900 truncate">{item.syntax}</code>
                    <button
                      type="button"
                      onClick={() => copyTextSnippet(item.example)}
                      className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs cursor-pointer shrink-0"
                    >
                      {copiedKeyword === item.example ? "คัดลอกแล้ว" : "คัดลอก"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Error Logs */}
      {activeTab === "logs" && (
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-md border border-slate-200 shadow-2xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-xs font-medium text-slate-900 m-0">🚨 ประวัติข้อผิดพลาดระบบ (System Error Logs)</h2>
                <p className="text-xs text-slate-500 m-0">บันทึกข้อผิดพลาดที่เกิดขึ้นขณะประมวลผลคำสั่ง LINE Webhook และ Cron Jobs</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateTestLog}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition flex items-center gap-1 text-xs cursor-pointer active:scale-95 shadow-2xs"
                  title="ทดสอบสร้าง Error Log ตัวอย่าง"
                >
                  <Terminal size={12} />
                  <span>ทดสอบบันทึก Log</span>
                </button>

                {errorLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition flex items-center gap-1 text-xs cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <span>ล้าง Logs</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={fetchErrorLogs}
                  disabled={loadingLogs}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded transition flex items-center gap-1 text-xs cursor-pointer active:scale-95 shadow-2xs"
                >
                  <RefreshCw size={12} className={loadingLogs ? "animate-spin" : ""} />
                  <span>รีเฟรช</span>
                </button>
              </div>
            </div>

            {loadingLogs ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <RefreshCw size={16} className="animate-spin mx-auto mb-2 text-slate-500" />
                <span>กำลังโหลดประวัติข้อผิดพลาด...</span>
              </div>
            ) : errorLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                <div className="text-slate-800">ไม่พบข้อผิดพลาดในระบบ (System Healthy)</div>
                <p className="text-slate-400 text-xs max-w-md mx-auto">
                  ระบบทำงานปกติและยังไม่มีข้อผิดพลาดเกิดขึ้น ท่านสามารถกดปุ่ม <span className="text-slate-600">"ทดสอบบันทึก Log"</span> ด้านบนเพื่อทดสอบการบันทึกได้ครับ
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {errorLogs.map((log, index) => (
                  <div key={log.id || index} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500 text-xs">
                      <span>{new Date(log.created_at).toLocaleString("th-TH")}</span>
                      <span className={`px-1.5 py-0.5 rounded font-sans text-xs ${
                        log.level === "ERROR" ? "bg-rose-100 text-rose-800" : log.level === "WARN" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                      }`}>
                        {log.level || "ERROR"}
                      </span>
                    </div>
                    <div className="text-slate-900 font-sans text-xs">{log.message}</div>
                    <div className="text-slate-500 text-xs">Source: {log.source}</div>
                    {log.context && (
                      <pre className="p-1.5 bg-white border border-slate-200 rounded text-xs text-slate-700 overflow-x-auto">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
