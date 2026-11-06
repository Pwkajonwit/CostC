"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Briefcase,
  Building,
  Building2,
  CheckCircle2,
  DollarSign,
  Download,
  FileCheck,
  FileSpreadsheet,
  FolderKanban,
  HardDrive,
  HardDriveDownload,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  Search,
  Store,
  Truck,
  Upload,
  UserCheck,
  Users,
  X,
  AlertCircle,
  FolderUp,
  ShieldCheck,
  FileJson,
  Sparkles,
  Database,
  Calendar,
  Clock,
  Settings,
  History,
  RotateCcw,
  Shield,
  Bell,
  Check,
  AlertTriangle,
  Play,
  Trash2,
  FileArchive,
  Image as ImageIcon,
} from "lucide-react";
import JSZip from "jszip";
import { extractAllAttachmentUrls } from "@/lib/utils/backup-helpers";
import { showToast } from "@/components/shared/ToastProvider";
import type { BackupConfig, BackupSnapshotSummary } from "@/lib/backup-service";
import { DEFAULT_BACKUP_CONFIG } from "@/lib/backup-service";
import type { ImportHistoryItem } from "@/lib/import-history-service";
import {
  BackupScheduleModal,
  BackupRestoreConfirmModal,
  BackupDeleteConfirmModal,
} from "./BackupModals";
import { ImportHistoryView } from "./ImportHistoryView";

export type TableConfig = {
  id: string;
  name: string;
  tableName: string;
  viewName: string;
  category: "master" | "transaction";
  description: string;
  iconName: string;
  color: string;
  columns: string[];
  sampleRow: Record<string, string>;
};

const TABLES_REGISTRY: TableConfig[] = [
  // 📁 MASTER TABLES
  {
    id: "banks",
    name: "ธนาคาร (Banks)",
    tableName: "ธนาคาร",
    viewName: "2. ธนาคาร",
    category: "master",
    description: "รายชื่อธนาคารและโลโก้สำหรับบัญชีโอนเงิน",
    iconName: "Building2",
    color: "from-blue-500 to-indigo-600",
    columns: ["id_bank", "ชื่อธนาคาร", "image"],
    sampleRow: { id_bank: "Ba116", ชื่อธนาคาร: "ธนาคารตัวอย่าง", image: "" }
  },
  {
    id: "stores",
    name: "ร้านค้า (Stores / Suppliers)",
    tableName: "ร้านค้า",
    viewName: "4. ร้านค้า",
    category: "master",
    description: "รายชื่อร้านค้า ซัพพลายเออร์ เลขบัญชี และเลขประจำตัวผู้เสียภาษี",
    iconName: "Store",
    color: "from-emerald-500 to-teal-600",
    columns: ["id_store", "ชื่อร้านค้า", "ชื่อเต็ม", "เลขบัญชี", "ธนาคาร", "เบอร์โทร", "ที่อยู่", "เลขที่ผู้เสียภาษี"],
    sampleRow: {
      id_store: "St101",
      ชื่อร้านค้า: "โฮมโปร",
      ชื่อเต็ม: "บริษัท โฮม โปรดักส์ เซ็นเตอร์ จำกัด",
      เลขบัญชี: "123-4-56789-0",
      ธนาคาร: "กสิกรไทย",
      เบอร์โทร: "02-123-4567",
      ที่อยู่: "กรุงเทพฯ",
      เลขที่ผู้เสียภาษี: "0107544000036"
    }
  },
  {
    id: "contractors",
    name: "ผู้รับเหมา (Contractors)",
    tableName: "รับเหมา",
    viewName: "5. รับเหมา",
    category: "master",
    description: "รายชื่อช่างและผู้รับเหมา เลขบัตรประชาชน และวงเงินจ้างต่อปี",
    iconName: "Briefcase",
    color: "from-amber-500 to-orange-600",
    columns: ["id_Contractor", "ชื่อเล่น", "ชื่อ-นามสกุล", "เลขบัญชี", "ธนาคาร", "บัตรประจำตัวประชาชน", "เบอร์โทรศัพท์", "ที่อยู่", "จำกัดยอด/ปี"],
    sampleRow: {
      id_Contractor: "Con101",
      ชื่อเล่น: "ช่างเอก",
      "ชื่อ-นามสกุล": "นายเอกชัย ชัยชนะ",
      เลขบัญชี: "987-6-54321-0",
      ธนาคาร: "ไทยพาณิชย์",
      บัตรประจำตัวประชาชน: "1234567890123",
      เบอร์โทรศัพท์: "081-234-5678",
      ที่อยู่: "เชียงใหม่",
      "จำกัดยอด/ปี": "1800000"
    }
  },
  {
    id: "people",
    name: "รายชื่อพนักงาน (Staff & Users)",
    tableName: "รายชื่อ",
    viewName: "6. ชื่อพนักงาน",
    category: "master",
    description: "รายชื่อพนักงาน เบอร์โทรศัพท์ เลขบัญชี และสิทธิ์การใช้งานระบบ",
    iconName: "Users",
    color: "from-violet-500 to-purple-600",
    columns: ["รหัสพนักงาน", "ชื่อเล่น", "ชื่อ-นามสกุล", "เลขบัญชี", "ธนาคาร", "เบอร์โทร", "ที่อยู่", "เลขที่บัตรประชาชน", "สิทธิ์การใช้งาน"],
    sampleRow: {
      รหัสพนักงาน: "U101",
      ชื่อเล่น: "แอดมิน",
      "ชื่อ-นามสกุล": "ผู้ดูแลระบบ",
      เลขบัญชี: "123-0-00000-1",
      ธนาคาร: "กรุงเทพ",
      เบอร์โทร: "0800000000",
      ที่อยู่: "สำนักงานใหญ่",
      เลขที่บัตรประชาชน: "",
      สิทธิ์การใช้งาน: "Admin"
    }
  },
  {
    id: "cars",
    name: "ยานพาหนะ / ทะเบียนรถ (Vehicles)",
    tableName: "ทะเบียน",
    viewName: "7. ทะเบียนรถ",
    category: "master",
    description: "ทะเบียนรถ ยี่ห้อ สี และผู้รับผิดชอบดูแลรถ",
    iconName: "Truck",
    color: "from-cyan-500 to-blue-600",
    columns: ["id_car", "หมายเลขทะเบียน", "ยี่ห้อรถ", "สี", "รับผิดชอบ", "รถของ"],
    sampleRow: {
      id_car: "Car101",
      หมายเลขทะเบียน: "1ฒฒ 1234 กทม",
      ยี่ห้อรถ: "Isuzu D-Max",
      สี: "ขาว",
      รับผิดชอบ: "ช่างเอก",
      รถของ: "บริษัท"
    }
  },
  {
    id: "customers",
    name: "ลูกค้า (Customers / Clients)",
    tableName: "ลูกค้า",
    viewName: "8. ลูกค้า",
    category: "master",
    description: "รายชื่อลูกค้า ที่อยู่ และเลขประจำตัวผู้เสียภาษี",
    iconName: "UserCheck",
    color: "from-rose-500 to-pink-600",
    columns: ["id_cus", "ชื่อลูกค้า", "ที่อยู่", "เลขที่ผู้เสียภาษี"],
    sampleRow: {
      id_cus: "Cus101",
      ชื่อลูกค้า: "คุณสมชาย ปลื้มจิต",
      ที่อยู่: "123/45 ถ.สุขุมวิท กทม.",
      เลขที่ผู้เสียภาษี: ""
    }
  },
  {
    id: "companies",
    name: "บริษัท / นิติบุคคล (Companies)",
    tableName: "บริษัท",
    viewName: "9. บริษัท",
    category: "master",
    description: "ข้อมูลบริษัท สาขา ที่อยู่ และเลขประจำตัวผู้เสียภาษี",
    iconName: "Building",
    color: "from-slate-600 to-slate-800",
    columns: ["id_Company", "ชื่ออังกฤษ", "ชื่อบริษัท", "สำนักงาน", "ที่อยู่", "เลขที่สียภาษี ", "เบอร์โทร"],
    sampleRow: {
      id_Company: "Comp101",
      ชื่ออังกฤษ: "MAN Construction Co., Ltd.",
      ชื่อบริษัท: "บริษัท แมน คอนสตรัคชั่น จำกัด",
      สำนักงาน: "สำนักงานใหญ่",
      ที่อยู่: "กรุงเทพฯ",
      "เลขที่สียภาษี ": "0105550000000",
      เบอร์โทร: "02-999-9999"
    }
  },
  {
    id: "products",
    name: "หมวดสินค้า & รหัสสินค้า (Products)",
    tableName: "สินค้า",
    viewName: "11. ประเภทสินค้า",
    category: "master",
    description: "รหัสสินค้าและหมวดหมู่วัสดุสำหรับการเบิกจ่ายค่าของ",
    iconName: "Package",
    color: "from-teal-500 to-emerald-700",
    columns: ["id_product", "รหัสสินค้า", "ชื่อประเภทสินค้า", "หมายเหตุ"],
    sampleRow: {
      id_product: "101",
      รหัสสินค้า: "101",
      ชื่อประเภทสินค้า: "น้ำมัน",
      หมายเหตุ: ""
    }
  },

  // 💼 TRANSACTION & PROJECT TABLES
  {
    id: "projects",
    name: "โครงการ / หน้างาน (Projects)",
    tableName: "Project",
    viewName: "1. Project รวม",
    category: "transaction",
    description: "รายชื่อโครงการ งบประมาณ ยอดสัญญา และสถานะงาน",
    iconName: "FolderKanban",
    color: "from-emerald-600 to-teal-800",
    columns: ["ID Project", "ชื่อ Project", "ชื่อลูกค้า", "ยอดงาน", "งบไม่เกิน", "ยอดรวม vat", "วันที่", "color", "บริษัท", "รับผิดชอบ"],
    sampleRow: {
      "ID Project": "P101",
      "ชื่อ Project": "งานตกแต่งภายใน คอนโด A",
      ชื่อลูกค้า: "คุณสมชาย",
      ยอดงาน: "500000",
      "งบไม่เกิน": "400000",
      "ยอดรวม vat": "535000",
      วันที่: "2026-08-22",
      color: "Green",
      บริษัท: "Comp101",
      รับผิดชอบ: "ช่างเอก"
    }
  },
  {
    id: "contract_works",
    name: "สัญญาเปิดจ้างรับเหมา (Contract Works)",
    tableName: "งานรับเหมา",
    viewName: "เปิดจ้าง",
    category: "transaction",
    description: "รายการเปิดสัญญาจ้างช่างและผู้รับเหมา ยอดเงินจ้าง และรายละเอียดงาน",
    iconName: "FileCheck",
    color: "from-amber-600 to-yellow-700",
    columns: ["id_Conwork", "id_Contractor", "ID Project", "ชื่อ Project", "ยอดเงินจ้าง", "รายละเอียดงาน", "เบอร์โทรศัพท์", "ยอดเงินจ่าย"],
    sampleRow: {
      id_Conwork: "CW101",
      id_Contractor: "Con101",
      "ID Project": "P101",
      "ชื่อ Project": "งานตกแต่งภายใน คอนโด A",
      ยอดเงินจ้าง: "150000",
      รายละเอียดงาน: "งานปูกระเบื้องและทาสี",
      เบอร์โทรศัพท์: "081-234-5678",
      ยอดเงินจ่าย: "0"
    }
  },
  {
    id: "bills",
    name: "รายการบิล & เบิกเงิน (Bills / Expenses)",
    tableName: "Data",
    viewName: "กรอกบิล",
    category: "transaction",
    description: "รายการบันทึกบิล ค่าของ ค่าแรง ค่าน้ำมัน และรายการเบิกจ่ายทั้งหมด",
    iconName: "Receipt",
    color: "from-lime-600 to-emerald-800",
    columns: [
      "ลำดับ",
      "ID Project",
      "ชื่อ Project",
      "ร้าน/บุคคล",
      "สินค้า/ทำงาน",
      "บิล",
      "ประเภท",
      "ยอดเงิน",
      "vat",
      "หัก",
      "เครดิต",
      "ผู้เบิก",
      "ว/ด/ป",
      "สถานะ",
      "ค่าของ",
      "ค่าแรง",
      "พนักงาน",
      "น้ำมัน",
      "ซ่อมรถ",
      "เครื่องจักร",
      "เครื่องมือ",
      "อื่นๆ"
    ],
    sampleRow: {
      ลำดับ: "1",
      "ID Project": "P101",
      "ชื่อ Project": "งานตกแต่งภายใน คอนโด A",
      "ร้าน/บุคคล": "โฮมโปร",
      "สินค้า/ทำงาน": "ซื้อสีและอุปกรณ์",
      บิล: "INV-001",
      ประเภท: "101 เตรียมงาน",
      ยอดเงิน: "5400",
      vat: "0",
      หัก: "0",
      เครดิต: "0",
      ผู้เบิก: "ช่างเอก",
      "ว/ด/ป": "2026-08-22",
      สถานะ: "จ่ายแล้ว",
      ค่าของ: "5400",
      ค่าแรง: "0",
      พนักงาน: "0",
      น้ำมัน: "0",
      ซ่อมรถ: "0",
      เครื่องจักร: "0",
      เครื่องมือ: "0",
      อื่นๆ: "0"
    }
  },
  {
    id: "loans",
    name: "ยืมเงิน (Loans / Advances)",
    tableName: "ยืมเงิน",
    viewName: "10. ยืมเงิน",
    category: "transaction",
    description: "รายการบันทึกยืมเงินทดรองจ่าย และเงินเบิกล่วงหน้า",
    iconName: "DollarSign",
    color: "from-indigo-600 to-blue-800",
    columns: ["id", "ชื่อ", "type", "จำนวนเงิน", "วันที่"],
    sampleRow: {
      id: "L101",
      ชื่อ: "ช่างเอก",
      type: "ยืมเงินสด",
      จำนวนเงิน: "5000",
      วันที่: "2026-08-22"
    }
  }
];

function getIconComponent(name: string) {
  switch (name) {
    case "Building2": return Building2;
    case "Store": return Store;
    case "Briefcase": return Briefcase;
    case "Users": return Users;
    case "Truck": return Truck;
    case "UserCheck": return UserCheck;
    case "Building": return Building;
    case "Package": return Package;
    case "FolderKanban": return FolderKanban;
    case "FileCheck": return FileCheck;
    case "Receipt": return Receipt;
    case "DollarSign": return DollarSign;
    default: return FileSpreadsheet;
  }
}

type ImportResultItem = {
  filename: string;
  tableName: string;
  count: number;
  success: boolean;
  error?: string;
};

type ImportSummaryData = {
  title: string;
  totalFiles: number;
  successFiles: number;
  totalRows: number;
  details: ImportResultItem[];
};

const DAY_NAMES = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

export function DataHubClient() {
  // Navigation View Tab
  const [activeMainTab, setActiveMainTab] = useState<"standard_backup" | "table_csv" | "import_history">("table_csv");

  // Backup Engine States
  const [backupConfig, setBackupConfig] = useState<BackupConfig>(DEFAULT_BACKUP_CONFIG);
  const [backupHistory, setBackupHistory] = useState<BackupSnapshotSummary[]>([]);
  const [loadingBackupMeta, setLoadingBackupMeta] = useState<boolean>(true);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [selectedRestoreSnapshot, setSelectedRestoreSnapshot] = useState<BackupSnapshotSummary | null>(null);
  const [selectedDeleteSnapshot, setSelectedDeleteSnapshot] = useState<BackupSnapshotSummary | null>(null);
  const [downloadingSnapshotId, setDownloadingSnapshotId] = useState<string | null>(null);

  // Import History States
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [loadingImportHistory, setLoadingImportHistory] = useState<boolean>(true);

  // Table row counts
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState<boolean>(true);

  // CSV Tab States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "master" | "transaction">("all");
  const [activeImportTable, setActiveImportTable] = useState<TableConfig | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; message: string; subMessage?: string } | null>(null);
  const [exportingTableId, setExportingTableId] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState<boolean>(false);
  const [importingAll, setImportingAll] = useState<boolean>(false);
  const [backingUpFull, setBackingUpFull] = useState<boolean>(false);
  const [backingUpZip, setBackingUpZip] = useState<boolean>(false);
  const [restoringFull, setRestoringFull] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);

  function getAuthUserName(): string {
    if (typeof document === "undefined") return "web";
    const match = document.cookie.match(/auth_name=([^;]+)/);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return "web";
  }

  // Load Import History from API
  async function loadImportHistory() {
    setLoadingImportHistory(true);
    try {
      const res = await fetch("/api/import-history");
      if (res.ok) {
        const data = await res.json();
        if (data.history) setImportHistory(data.history);
      }
    } catch (e) {
      console.warn("Failed to fetch import history:", e);
    } finally {
      setLoadingImportHistory(false);
    }
  }

  // Record an import history entry
  async function recordImportEntry(
    entry: Omit<ImportHistoryItem, "id" | "createdAt" | "actor"> & { actor?: string }
  ) {
    const actor = entry.actor || getAuthUserName();
    const newEntry: ImportHistoryItem = {
      ...entry,
      id: `imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      actor
    };

    setImportHistory((prev) => [newEntry, ...prev]);

    try {
      await fetch("/api/import-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: newEntry })
      });
    } catch (e) {
      console.warn("Failed to record import history:", e);
    }
  }

  // Delete a single import history entry
  async function handleDeleteImportEntry(id: string) {
    setImportHistory((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/import-history?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  }

  // Clear all import history
  async function handleClearAllImportHistory() {
    setImportHistory([]);
    await fetch("/api/import-history?all=true", {
      method: "DELETE"
    });
  }

  // Load Backup Config & History from API
  async function loadBackupMetadata() {
    setLoadingBackupMeta(true);
    try {
      const res = await fetch("/api/backup?type=config");
      if (res.ok) {
        const data = await res.json();
        if (data.config) setBackupConfig(data.config);
        if (data.history) setBackupHistory(data.history);
      }
    } catch (e) {
      console.warn("Failed to fetch backup meta:", e);
    } finally {
      setLoadingBackupMeta(false);
    }
  }

  // Load live row counts for all tables
  async function loadTableCounts() {
    setLoadingCounts(true);
    const newCounts: Record<string, number> = {};

    await Promise.all(
      TABLES_REGISTRY.map(async (table) => {
        try {
          const res = await fetch(`/api/rows?tableName=${encodeURIComponent(table.tableName)}&limit=1`);
          if (res.ok) {
            const data = await res.json();
            newCounts[table.id] = data.totalCount ?? (data.rows ? data.rows.length : 0);
          }
        } catch (e) {
          newCounts[table.id] = 0;
        }
      })
    );

    setCounts(newCounts);
    setLoadingCounts(false);
  }

  useEffect(() => {
    loadBackupMetadata();
    loadTableCounts();
    loadImportHistory();
  }, []);

  const totalRowCount = useMemo(() => {
    return Object.values(counts).reduce((sum, n) => sum + (n || 0), 0);
  }, [counts]);

  // 🌟 1. Trigger Immediate Backup & Save Snapshot
  async function handleTriggerBackupNow() {
    setBackingUpFull(true);
    try {
      showToast("info", "กำลังรวบรวมข้อมูลทั้ง 12 ตาราง และบันทึกจุดสำรองข้อมูล...");
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", backupType: "manual" })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "สำรองข้อมูลไม่สำเร็จ");

      if (json.config) setBackupConfig(json.config);
      if (json.history) setBackupHistory(json.history);

      showToast("success", `สำรองข้อมูลสำเร็จ ${json.snapshot.totalRows.toLocaleString()} รายการ (บันทึกลงระบบประวัติเรียบร้อย)`);
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "สำรองข้อมูลไม่สำเร็จ");
    } finally {
      setBackingUpFull(false);
    }
  }

  // 🌟 2. Single-File Full System Backup Download (.json)
  async function handleDownloadFullBackup() {
    setBackingUpFull(true);
    try {
      showToast("info", "กำลังรวบรวมข้อมูลทุกตารางและสร้างไฟล์สำรอง...");
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("ไม่สามารถดาวน์โหลดไฟล์สำรองข้อมูลทั้งระบบได้");
      const backupData = await res.json();

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const dateStr = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CostLab_Backup_Full_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalRows = backupData.summary?.totalRows || 0;
      showToast("success", `สำรองข้อมูลทั้งระบบสำเร็จ (1 ไฟล์ ครบทั้ง 12 ตาราง รวม ${totalRows.toLocaleString()} แถว)`);
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "สำรองข้อมูลไม่สำเร็จ");
    } finally {
      setBackingUpFull(false);
    }
  }

  // 🌟 2.1 Complete Full System Archive (.zip) with All Attached Images
  async function handleDownloadZipBackup() {
    setBackingUpZip(true);
    setImportProgress({
      current: 0,
      total: 100,
      message: "กำลังรวบรวมข้อมูลทุกตารางและสร้างฐานข้อมูล...",
      subMessage: "กำลังเชื่อมต่อ API เพื่อดึงข้อมูลทั้ง 12 ตาราง"
    });

    try {
      // 1. Fetch full database payload
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลสำรองจากเซิร์ฟเวอร์ได้");
      const backupData = await res.json();

      // 2. Extract all attachment URLs
      const attachments = extractAllAttachmentUrls(backupData.tables || {});
      const totalImages = attachments.length;

      setImportProgress({
        current: 5,
        total: 100,
        message: `พบรูปภาพแนบทั้งหมด ${totalImages.toLocaleString()} รูป`,
        subMessage: "กำลังเตรียมบีบอัดเป็นไฟล์ ZIP..."
      });

      const zip = new JSZip();

      // 3. Add database.json
      zip.file("database.json", JSON.stringify(backupData, null, 2));

      // 4. Download images in parallel batches (concurrency = 6)
      const attachmentsFolder = zip.folder("attachments");
      let downloadedCount = 0;
      let failedCount = 0;
      const failedList: string[] = [];
      const manifest: any[] = [];

      const batchSize = 6;
      for (let i = 0; i < totalImages; i += batchSize) {
        const batch = attachments.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            try {
              let blob: Blob | null = null;
              // Try direct fetch first
              try {
                const imgRes = await fetch(item.url);
                if (imgRes.ok) {
                  blob = await imgRes.blob();
                }
              } catch {
                blob = null;
              }

              // If direct fetch fails (e.g. CORS), fallback to proxy
              if (!blob) {
                const proxyRes = await fetch(`/api/backup?type=proxy-image&url=${encodeURIComponent(item.url)}`);
                if (proxyRes.ok) {
                  blob = await proxyRes.blob();
                }
              }

              if (blob) {
                attachmentsFolder?.file(item.cleanFilename, blob);
                manifest.push({
                  originalUrl: item.url,
                  filePath: `attachments/${item.cleanFilename}`,
                  filename: item.cleanFilename,
                  tableName: item.tableName,
                  rowId: item.rowId,
                  field: item.field
                });
              } else {
                failedCount++;
                failedList.push(item.url);
              }
            } catch (e) {
              failedCount++;
              failedList.push(item.url);
            } finally {
              downloadedCount++;
            }
          })
        );

        const percent = Math.min(85, Math.round(5 + (downloadedCount / Math.max(1, totalImages)) * 80));
        setImportProgress({
          current: percent,
          total: 100,
          message: `กำลังดาวน์โหลดรูปภาพบิล (${downloadedCount}/${totalImages} รูป)...`,
          subMessage: failedCount > 0 ? `ดาวน์โหลดไม่สำเร็จ ${failedCount} รูป (จะบันทึกลง log)` : "ระบบกำลังรวบรวมไฟล์รูปภาพต้นฉบับ"
        });
      }

      // 5. Add manifest and README
      zip.file("attachments_manifest.json", JSON.stringify(manifest, null, 2));
      const readmeContent = `COSTLAB ENTERPRISE SYSTEM BACKUP ARCHIVE\n` +
        `========================================\n` +
        `Backup Date: ${new Date().toISOString()}\n` +
        `Total Tables: ${backupData.summary?.totalTables || 12}\n` +
        `Total Rows: ${backupData.summary?.totalRows || 0}\n` +
        `Total Attachments: ${manifest.length} saved (${failedCount} failed)\n\n` +
        `Files in this archive:\n` +
        `- database.json: Complete PostgreSQL records for all 12 tables + system options\n` +
        `- attachments/: Folder containing all attached receipt/bill photos\n` +
        `- attachments_manifest.json: Mapping of original URLs to local attachments\n`;
      zip.file("README.txt", readmeContent);

      if (failedList.length > 0) {
        zip.file("failed_attachments.log", failedList.join("\n"));
      }

      // 6. Generate ZIP file
      setImportProgress({
        current: 90,
        total: 100,
        message: "กำลังบีบอัดและสร้างไฟล์ .ZIP...",
        subMessage: "ขั้นตอนนี้อาจใช้เวลาสักครู่ขึ้นอยู่กับขนาดของรูปภาพ"
      });

      const zipBlob = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        },
        (metadata) => {
          const zipPercent = Math.min(99, Math.round(90 + (metadata.percent / 100) * 9));
          setImportProgress({
            current: zipPercent,
            total: 100,
            message: `กำลังบีบอัดไฟล์ ZIP (${Math.round(metadata.percent)}%)...`,
            subMessage: "กรุณารอสักครู่ ระบบกำลังจัดเตรียมไฟล์ดาวน์โหลด"
          });
        }
      );

      // Trigger download
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CostLab_Backup_Full_With_Images_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalRows = backupData.summary?.totalRows || 0;
      showToast(
        "success",
        `สำรองข้อมูลสมบูรณ์ (.ZIP) สำเร็จ! รวม ${totalRows.toLocaleString()} แถว และรูปภาพ ${manifest.length} รูป`
      );
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "สำรองข้อมูล .ZIP ไม่สำเร็จ");
    } finally {
      setImportProgress(null);
      setBackingUpZip(false);
    }
  }

  // 🌟 3. Single-File Full System Restore Upload (.json or .zip)
  async function handleRestoreFullBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoringFull(true);
    const isZip = file.name.toLowerCase().endsWith(".zip") || file.type.includes("zip");

    setImportProgress({
      current: 10,
      total: 100,
      message: isZip ? "กำลังอ่านและเปิดโครงสร้างไฟล์สำรอง .zip..." : "กำลังอ่านและตรวจสอบไฟล์สำรอง .json...",
      subMessage: file.name
    });

    try {
      let parsedJson: any = null;
      let zipInstance: JSZip | null = null;
      let attachmentFiles: { name: string; file: JSZip.JSZipObject }[] = [];

      if (isZip) {
        zipInstance = await JSZip.loadAsync(file);

        // Find database.json or any .json in root
        let jsonFile = zipInstance.file("database.json");
        if (!jsonFile) {
          const jsonCandidates = Object.keys(zipInstance.files).filter(f => !f.includes("/") && f.endsWith(".json"));
          if (jsonCandidates.length > 0) {
            jsonFile = zipInstance.file(jsonCandidates[0]);
          }
        }

        if (!jsonFile) {
          throw new Error("ไม่พบไฟล์ database.json ภายในไฟล์สำรอง .zip");
        }

        const jsonText = await jsonFile.async("text");
        parsedJson = JSON.parse(jsonText);

        // Find attachment files in attachments/
        attachmentFiles = Object.entries(zipInstance.files)
          .filter(([path, obj]) => !obj.dir && (path.startsWith("attachments/") || path.startsWith("repairs/")))
          .map(([path, fileObj]) => ({
            name: path.split("/").pop() || path,
            file: fileObj
          }));
      } else {
        const text = await readFileText(file);
        parsedJson = JSON.parse(text);
      }

      if (!parsedJson || typeof parsedJson !== "object") {
        throw new Error("โครงสร้างไฟล์สำรองไม่ถูกต้อง");
      }

      // 1. Restore Database tables
      setImportProgress({
        current: isZip && attachmentFiles.length > 0 ? 30 : 50,
        total: 100,
        message: "กำลังกู้คืนข้อมูลทั้ง 12 ตารางและตัวเลือกระบบลง Supabase...",
        subMessage: "ระบบกำลังตรวจสอบข้อมูลซ้ำและบันทึกอัตโนมัติ"
      });

      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedJson)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "กู้คืนข้อมูลไม่สำเร็จ");

      // 2. If ZIP has attachments, restore images to Supabase Storage
      let restoredImagesCount = 0;
      if (isZip && attachmentFiles.length > 0) {
        const totalImages = attachmentFiles.length;
        const batchSize = 5;

        for (let i = 0; i < totalImages; i += batchSize) {
          const batch = attachmentFiles.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (att) => {
              try {
                const base64 = await att.file.async("base64");
                const uploadRes = await fetch("/api/backup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "upload-attachment",
                    filename: att.name,
                    base64
                  })
                });
                if (uploadRes.ok) restoredImagesCount++;
              } catch (e) {
                // ignore single image upload error
              }
            })
          );

          const percent = Math.min(95, Math.round(30 + ((i + batch.length) / totalImages) * 65));
          setImportProgress({
            current: percent,
            total: 100,
            message: `กำลังกู้คืนรูปภาพแนบเข้า Supabase Storage (${restoredImagesCount}/${totalImages} รูป)...`,
            subMessage: "กำลังบันทึกรูปภาพต้นฉบับกลับสู่ระบบ"
          });
        }
      }

      setImportProgress({
        current: 100,
        total: 100,
        message: "กู้คืนข้อมูลทั้งระบบเสร็จสมบูรณ์!",
        subMessage: isZip
          ? `รวม ${result.totalRestored?.toLocaleString() || 0} รายการ และรูปภาพ ${restoredImagesCount} รูป`
          : `รวม ${result.totalRestored?.toLocaleString() || 0} รายการ`
      });

      const details = (result.details || []).map((d: any) => ({
        filename: file.name,
        tableName: d.tableName,
        count: d.count || 0,
        success: d.success,
        error: d.error
      }));

      setImportSummary({
        title: isZip
          ? "ผลการกู้คืนข้อมูลและรูปภาพทั้งระบบ (.ZIP Archive)"
          : "ผลการกู้คืนข้อมูลทั้งระบบ (Full System Restore)",
        totalFiles: 1,
        successFiles: 1,
        totalRows: result.totalRestored || 0,
        details
      });

      showToast(
        "success",
        isZip
          ? `กู้คืนระบบสำเร็จ ${result.totalRestored?.toLocaleString() || 0} รายการ พร้อมรูปภาพ ${restoredImagesCount} รูป`
          : `กู้คืนข้อมูลทั้งระบบสำเร็จ ${result.totalRestored?.toLocaleString() || 0} รายการ`
      );

      // Record in import history
      await recordImportEntry({
        importType: isZip ? "restore_zip" : "restore_json",
        title: isZip
          ? `กู้คืนระบบแบบสมบูรณ์ (.ZIP รวมรูปภาพ ${restoredImagesCount} รูป)`
          : "กู้คืนข้อมูลทั้งระบบ (.JSON 12 ตาราง)",
        fileName: file.name,
        totalRows: result.totalRestored || 0,
        successCount: result.totalRestored || 0,
        failedCount: 0,
        status: "success",
        details
      });

      await loadTableCounts();
      await loadBackupMetadata();
      await loadImportHistory();
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "กู้คืนข้อมูลไม่สำเร็จ");
    } finally {
      setImportProgress(null);
      setRestoringFull(false);
      event.target.value = "";
    }
  }

  // 🌟 4. Execute 1-Click Restore Point from Snapshot History
  async function handleConfirmRestoreFromSnapshot(snapshot: BackupSnapshotSummary) {
    setRestoringFull(true);
    setImportProgress({
      current: 30,
      total: 100,
      message: `กำลังกู้คืนข้อมูลจากจุดสำรอง ${snapshot.id}...`,
      subMessage: "กำลังดึงข้อมูลและบันทึกลงฐานข้อมูล Supabase"
    });

    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore-point", snapshotId: snapshot.id })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "กู้คืนข้อมูลจากจุดสำรองไม่สำเร็จ");

      setImportProgress({
        current: 100,
        total: 100,
        message: "กู้คืนข้อมูลจากจุดสำรองเสร็จสมบูรณ์!",
        subMessage: `รวม ${json.totalRestored?.toLocaleString() || 0} รายการ`
      });

      if (json.history) setBackupHistory(json.history);

      showToast("success", `กู้คืนข้อมูลจากจุดสำรองสำเร็จ รวม ${json.totalRestored?.toLocaleString() || 0} รายการ`);

      // Record in import history
      await recordImportEntry({
        importType: "restore_point",
        title: `กู้คืนข้อมูลจากจุดสำรอง (${snapshot.id})`,
        fileName: snapshot.filename || snapshot.id,
        totalRows: json.totalRestored || snapshot.totalRows,
        successCount: json.totalRestored || snapshot.totalRows,
        failedCount: 0,
        status: "success",
        details: (json.details || []).map((d: any) => ({
          filename: snapshot.filename || snapshot.id,
          tableName: d.tableName,
          count: d.count || 0,
          success: d.success
        }))
      });

      await loadTableCounts();
      await loadImportHistory();
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "กู้คืนข้อมูลไม่สำเร็จ");
    } finally {
      setImportProgress(null);
      setRestoringFull(false);
    }
  }

  // 🌟 5. Download Specific Backup Snapshot File (.json)
  async function handleDownloadSnapshot(snapshot: BackupSnapshotSummary) {
    setDownloadingSnapshotId(snapshot.id);
    try {
      showToast("info", `กำลังดาวน์โหลดไฟล์สำรอง ${snapshot.filename || snapshot.id}...`);
      const res = await fetch(`/api/backup?type=snapshot&id=${encodeURIComponent(snapshot.id)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "ไม่สามารถดาวน์โหลดไฟล์สำรองข้อมูลได้");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = snapshot.filename || `CostLab_Backup_${snapshot.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("success", `ดาวน์โหลดไฟล์ ${snapshot.filename || snapshot.id} เรียบร้อยแล้ว`);
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "ดาวน์โหลดไฟล์สำรองไม่สำเร็จ");
    } finally {
      setDownloadingSnapshotId(null);
    }
  }

  // 🌟 6. Delete Backup Snapshot from History and Storage
  async function handleConfirmDeleteSnapshot(snapshot: BackupSnapshotSummary) {
    try {
      const res = await fetch(`/api/backup?id=${encodeURIComponent(snapshot.id)}`, {
        method: "DELETE"
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ลบจุดสำรองข้อมูลไม่สำเร็จ");

      if (json.history) setBackupHistory(json.history);
      showToast("success", `ลบจุดสำรองข้อมูล ${snapshot.id} และไฟล์สำรองเรียบร้อยแล้ว`);
      await loadBackupMetadata();
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "ลบจุดสำรองข้อมูลไม่สำเร็จ");
      throw err;
    }
  }

  // 📥 5. Download Blank CSV Template
  function downloadTemplateCSV(table: TableConfig) {
    const headers = table.columns;
    const sampleVals = headers.map((col) => {
      const val = table.sampleRow[col] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    });

    const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",");
    const sampleLine = sampleVals.join(",");

    const csvContent = "\uFEFF" + [headerLine, sampleLine].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Template_${table.id}_${table.tableName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("success", `ดาวน์โหลดตัวอย่างเทมเพลต ${table.name} สำเร็จแล้ว`);
  }

  // 📤 6. Export Actual Table Data to CSV
  async function exportTableCSV(table: TableConfig) {
    setExportingTableId(table.id);
    try {
      const res = await fetch(`/api/rows?tableName=${encodeURIComponent(table.tableName)}&limit=10000`);
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลจากตารางได้");
      const json = await res.json();
      const rows: Record<string, any>[] = json.rows || [];

      if (rows.length === 0) {
        showToast("info", `ตาราง ${table.name} ยังไม่มีข้อมูลให้ส่งออก (แนะนำดาวน์โหลดเทมเพลตแทน)`);
        return;
      }

      const headers = table.columns.length > 0 ? table.columns : Object.keys(rows[0]).filter((c) => !c.startsWith("_"));
      const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(",");

      const dataLines = rows.map((row) =>
        headers
          .map((col) => {
            const rawVal = row[col] ?? "";
            const cleanStr = String(rawVal).replace(/"/g, '""');
            return `"${cleanStr}"`;
          })
          .join(",")
      );

      const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `Export_${table.id}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast("success", `ส่งออกข้อมูล ${table.name} (${rows.length} รายการ) สำเร็จแล้ว`);
    } catch (err: any) {
      showToast("error", err instanceof Error ? err.message : "ส่งออกข้อมูลไม่สำเร็จ");
    } finally {
      setExportingTableId(null);
    }
  }

  // 📦 7. Export All Tables as Multiple CSVs
  async function exportAllTablesCSV() {
    setExportingAll(true);
    let totalExported = 0;

    for (const table of TABLES_REGISTRY) {
      try {
        await exportTableCSV(table);
        totalExported++;
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {}
    }

    setExportingAll(false);
    showToast("success", `ส่งออกข้อมูลทั้งหมด ${totalExported} ตารางเรียบร้อยแล้ว`);
  }

  // Helper to match file with appropriate table
  function findMatchingTable(filename: string, firstLine: string): TableConfig | null {
    const cleanName = filename.toLowerCase();

    if (cleanName.includes("bank") || cleanName.includes("ธนาคาร")) return TABLES_REGISTRY.find(t => t.id === "banks") || null;
    if (cleanName.includes("store") || cleanName.includes("ร้านค้า")) return TABLES_REGISTRY.find(t => t.id === "stores") || null;
    if (cleanName.includes("contractor") || cleanName.includes("รับเหมา")) return TABLES_REGISTRY.find(t => t.id === "contractors") || null;
    if (cleanName.includes("people") || cleanName.includes("พนักงาน") || cleanName.includes("รายชื่อ") || cleanName.includes("member")) return TABLES_REGISTRY.find(t => t.id === "people") || null;
    if (cleanName.includes("car") || cleanName.includes("ทะเบียน") || cleanName.includes("รถ")) return TABLES_REGISTRY.find(t => t.id === "cars") || null;
    if (cleanName.includes("customer") || cleanName.includes("ลูกค้า")) return TABLES_REGISTRY.find(t => t.id === "customers") || null;
    if (cleanName.includes("compan") || cleanName.includes("บริษัท")) return TABLES_REGISTRY.find(t => t.id === "companies") || null;
    if (cleanName.includes("product") || cleanName.includes("สินค้า")) return TABLES_REGISTRY.find(t => t.id === "products") || null;
    if (cleanName.includes("contract_work") || cleanName.includes("conwork") || cleanName.includes("เปิดจ้าง") || cleanName.includes("งานรับเหมา")) return TABLES_REGISTRY.find(t => t.id === "contract_works") || null;
    if (cleanName.includes("project") || cleanName.includes("โครงการ")) return TABLES_REGISTRY.find(t => t.id === "projects") || null;
    if (cleanName.includes("bill") || cleanName.includes("data") || cleanName.includes("บิล") || cleanName.includes("เบิกเงิน")) return TABLES_REGISTRY.find(t => t.id === "bills") || null;
    if (cleanName.includes("loan") || cleanName.includes("ยืมเงิน")) return TABLES_REGISTRY.find(t => t.id === "loans") || null;

    // Match by header columns
    const lowerHeader = firstLine.toLowerCase();
    if (lowerHeader.includes("id_bank") || lowerHeader.includes("ชื่อธนาคาร")) return TABLES_REGISTRY.find(t => t.id === "banks") || null;
    if (lowerHeader.includes("id_store") || lowerHeader.includes("ชื่อร้านค้า")) return TABLES_REGISTRY.find(t => t.id === "stores") || null;
    if (lowerHeader.includes("id_contractor") || lowerHeader.includes("จำกัดยอด/ปี")) return TABLES_REGISTRY.find(t => t.id === "contractors") || null;
    if (lowerHeader.includes("id_conwork") || lowerHeader.includes("ยอดเงินจ้าง")) return TABLES_REGISTRY.find(t => t.id === "contract_works") || null;
    if (lowerHeader.includes("id project") && (lowerHeader.includes("งบไม่เกิน") || lowerHeader.includes("ยอดรวม vat"))) return TABLES_REGISTRY.find(t => t.id === "projects") || null;
    if (lowerHeader.includes("รหัสพนักงาน") || (lowerHeader.includes("สิทธิ์การใช้งาน") && lowerHeader.includes("ชื่อเล่น"))) return TABLES_REGISTRY.find(t => t.id === "people") || null;
    if (lowerHeader.includes("id_car") || lowerHeader.includes("หมายเลขทะเบียน")) return TABLES_REGISTRY.find(t => t.id === "cars") || null;
    if (lowerHeader.includes("id_cus") || lowerHeader.includes("ชื่อลูกค้า")) return TABLES_REGISTRY.find(t => t.id === "customers") || null;
    if (lowerHeader.includes("id_company") || lowerHeader.includes("ชื่อบริษัท")) return TABLES_REGISTRY.find(t => t.id === "companies") || null;
    if (lowerHeader.includes("id_product") || lowerHeader.includes("ชื่อประเภทสินค้า")) return TABLES_REGISTRY.find(t => t.id === "products") || null;
    if (lowerHeader.includes("ลำดับ") || lowerHeader.includes("ผู้เบิก") || (lowerHeader.includes("ร้าน/บุคคล") && lowerHeader.includes("ยอดเงิน"))) return TABLES_REGISTRY.find(t => t.id === "bills") || null;
    if (lowerHeader.includes("type") && lowerHeader.includes("จำนวนเงิน") && lowerHeader.includes("ชื่อ")) return TABLES_REGISTRY.find(t => t.id === "loans") || null;

    return null;
  }

  function readFileText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = (err) => reject(err);
      reader.readAsText(file, "UTF-8");
    });
  }

  // 📥 8. Import Single Table CSV
  function handleImportCSV(table: TableConfig, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setActiveImportTable(table);
    setImportProgress({ current: 0, total: 0, message: "กำลังอ่านไฟล์ CSV..." });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("ไฟล์เป็นแผ่นว่างเปล่า");

        const parsedRows = parseCSVText(text, table.columns);
        if (parsedRows.length === 0) throw new Error("ไม่พบข้อมูลที่อ่านได้ในไฟล์ CSV");

        setImportProgress({
          current: Math.floor(parsedRows.length / 2),
          total: parsedRows.length,
          message: `กำลังนำเข้า ${parsedRows.length} รายการ และตรวจสอบข้อมูลซ้ำ...`
        });

        const response = await fetch("/api/rows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableName: table.tableName, rows: parsedRows })
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "บันทึกลงฐานข้อมูลไม่สำเร็จ");
        }

        const successCount = json.count || parsedRows.length;

        setImportProgress({
          current: parsedRows.length,
          total: parsedRows.length,
          message: "นำเข้าและบันทึกข้อมูลเรียบร้อยแล้ว!"
        });

        showToast("success", `นำเข้าข้อมูล ${table.name} สำเร็จ ${successCount} รายการ`);

        // Record in import history
        await recordImportEntry({
          importType: "single_csv",
          title: `นำเข้าไฟล์ CSV ${table.name}`,
          tableName: table.name,
          targetTableId: table.id,
          fileName: file.name,
          totalRows: parsedRows.length,
          successCount: successCount,
          failedCount: Math.max(0, parsedRows.length - successCount),
          status: successCount >= parsedRows.length ? "success" : successCount > 0 ? "partial" : "failed",
          details: [
            {
              filename: file.name,
              tableName: table.name,
              count: successCount,
              success: true
            }
          ]
        });

        await loadTableCounts();
        await loadImportHistory();
      } catch (err: any) {
        showToast("error", err instanceof Error ? err.message : "นำเข้าไฟล์ CSV ไม่สำเร็จ");
      } finally {
        setImportProgress(null);
        setActiveImportTable(null);
        event.target.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  // 📥 9. Bulk Import Multiple CSV Files
  async function handleImportAllFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setImportingAll(true);
    setImportSummary(null);

    const fileList = Array.from(files);
    const results: ImportResultItem[] = [];

    setImportProgress({
      current: 0,
      total: fileList.length,
      message: `กำลังเตรียมนำเข้าทั้งหมด ${fileList.length} ไฟล์...`,
      subMessage: "ระบบกำลังตรวจจับตารางอัตโนมัติ"
    });

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const text = await readFileText(file);
        const firstLine = text.split("\n")[0] || "";
        const matchedTable = findMatchingTable(file.name, firstLine);

        if (!matchedTable) {
          results.push({
            filename: file.name,
            tableName: "ไม่ทราบตาราง",
            count: 0,
            success: false,
            error: "ไม่สามารถจับคู่หัวตารางหรือชื่อไฟล์ได้"
          });
          continue;
        }

        setImportProgress({
          current: i + 1,
          total: fileList.length,
          message: `กำลังนำเข้า [${i + 1}/${fileList.length}] ตาราง ${matchedTable.name}...`,
          subMessage: `ไฟล์: ${file.name}`
        });

        const parsedRows = parseCSVText(text, matchedTable.columns);
        if (parsedRows.length === 0) {
          results.push({
            filename: file.name,
            tableName: matchedTable.name,
            count: 0,
            success: false,
            error: "ไม่มีข้อมูลในไฟล์"
          });
          continue;
        }

        const res = await fetch("/api/rows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableName: matchedTable.tableName, rows: parsedRows })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "นำเข้าไม่สำเร็จ");

        const count = json.count || parsedRows.length;
        results.push({
          filename: file.name,
          tableName: matchedTable.name,
          count,
          success: true
        });
      } catch (err: any) {
        results.push({
          filename: file.name,
          tableName: "เกิดข้อผิดพลาด",
          count: 0,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    setImportProgress(null);
    setImportingAll(false);
    event.target.value = "";

    const successCount = results.filter((r) => r.success).length;
    const totalRowsImported = results.filter((r) => r.success).reduce((sum, r) => sum + r.count, 0);

    setImportSummary({
      title: "ผลการนำเข้าหลายไฟล์ (Multi-CSV Import Summary)",
      totalFiles: fileList.length,
      successFiles: successCount,
      totalRows: totalRowsImported,
      details: results
    });

    showToast(
      successCount > 0 ? "success" : "error",
      `นำเข้าหลายไฟล์เสร็จสิ้น: สำเร็จ ${successCount}/${fileList.length} ไฟล์ (${totalRowsImported.toLocaleString()} รายการ)`
    );

    // Record in import history
    const failedFilesCount = fileList.length - successCount;
    await recordImportEntry({
      importType: "multi_csv",
      title: `นำเข้าหลายไฟล์ CSV (${fileList.length} ไฟล์)`,
      fileName: `${fileList.length} ไฟล์ CSV (${fileList.map((f) => f.name).slice(0, 3).join(", ")}${fileList.length > 3 ? "..." : ""})`,
      totalRows: totalRowsImported,
      successCount: totalRowsImported,
      failedCount: failedFilesCount,
      status: failedFilesCount === 0 ? "success" : successCount > 0 ? "partial" : "failed",
      details: results
    });

    await loadTableCounts();
    await loadImportHistory();
  }

  function detectDelimiter(firstLine: string): string {
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    if (tabCount > commaCount && tabCount > semiCount) return "\t";
    if (semiCount > commaCount) return ";";
    return ",";
  }

  function parseCSVText(text: string, expectedColumns: string[]): Record<string, string>[] {
    const cleanText = text.replace(/^\uFEFF/, "").trim();
    if (!cleanText) return [];

    const firstLineEnd = cleanText.indexOf("\n");
    const firstLine = firstLineEnd !== -1 ? cleanText.slice(0, firstLineEnd) : cleanText;
    const delimiter = detectDelimiter(firstLine);

    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentCell = "";
    let insideQuote = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        currentLine.push(currentCell.trim());
        currentCell = "";
      } else if ((char === "\r" || char === "\n") && !insideQuote) {
        if (char === "\r" && nextChar === "\n") i++;
        currentLine.push(currentCell.trim());
        if (currentLine.some((cell) => cell.length > 0)) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    if (currentCell.length > 0 || currentLine.length > 0) {
      currentLine.push(currentCell.trim());
      if (currentLine.some((cell) => cell.length > 0)) {
        lines.push(currentLine);
      }
    }

    if (lines.length < 2) return [];

    const rawHeaders = lines[0].map((h) => h.replace(/^"+|"+$/g, "").trim());

    const headers = rawHeaders.map((h) => {
      const cleanH = h.trim();
      const matched = expectedColumns.find((c) => c.toLowerCase() === cleanH.toLowerCase() || c === cleanH);
      return matched || cleanH;
    });

    const dataRowsResult: Record<string, string>[] = [];

    for (let r = 1; r < lines.length; r++) {
      const rowValues = lines[r];
      const rowObj: Record<string, string> = {};
      let hasData = false;
      headers.forEach((h, colIdx) => {
        if (h) {
          let val = rowValues[colIdx] ?? "";
          val = val.replace(/^"+|"+$/g, "").trim();
          rowObj[h] = val;
          if (val) hasData = true;
        }
      });
      if (hasData) {
        dataRowsResult.push(rowObj);
      }
    }

    return dataRowsResult;
  }

  const filteredTables = useMemo(() => {
    return TABLES_REGISTRY.filter((t) => {
      const matchCat = selectedCategory === "all" || t.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  const scheduleDescription = useMemo(() => {
    if (!backupConfig.enabled) return "ปิดการใช้งานสำรองอัตโนมัติ";
    if (backupConfig.frequency === "weekly") {
      const dayName = DAY_NAMES[backupConfig.dayOfWeek ?? 0] || "วันอาทิตย์";
      return `ทุกสัปดาห์ (${dayName} เวลา ${backupConfig.time || "02:00"} น.)`;
    }
    if (backupConfig.frequency === "daily") {
      return `ทุกวัน (เวลา ${backupConfig.time || "02:00"} น.)`;
    }
    return `ทุกเดือน (วันที่ 1 เวลา ${backupConfig.time || "02:00"} น.)`;
  }, [backupConfig]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 p-2.5 sm:p-4 font-sans text-slate-800 antialiased pb-12">
      {/* ========================================================================= */}
      {/* 1. TOP COMMAND RIBBON & HEADER                                             */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl px-4 py-3 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#0b3531] text-[#34d399] flex items-center justify-center shrink-0 shadow-2xs border border-emerald-700/50">
              <HardDrive className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                  ศูนย์นำเข้า ส่งออก และสำรองข้อมูล
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0">
                  12 ตารางระบบ
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  ({loadingCounts ? "..." : `${totalRowCount.toLocaleString()} แถว`})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                จัดการไฟล์ CSV แยกตาราง และสำรอง/กู้คืนฐานข้อมูลทั้งระบบ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                loadTableCounts();
                loadBackupMetadata();
                loadImportHistory();
              }}
              disabled={loadingCounts || loadingBackupMeta || loadingImportHistory}
              className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={13} className={loadingCounts || loadingImportHistory ? "animate-spin text-emerald-600" : "text-slate-500"} />
              <span>{loadingCounts || loadingImportHistory ? "กำลังโหลด..." : "รีเฟรช"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. TOP-LEVEL SUB-TABS NAVIGATION PILLS                                    */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setActiveMainTab("table_csv")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs whitespace-nowrap ${
            activeMainTab === "table_csv"
              ? "bg-[#0b3531] text-white border border-[#144d47]"
              : "bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:bg-slate-50"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-[#d4f54e]" />
          <span>นำเข้า & ส่งออก CSV (12 ตาราง)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("standard_backup")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs whitespace-nowrap ${
            activeMainTab === "standard_backup"
              ? "bg-[#0b3531] text-white border border-[#144d47]"
              : "bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:bg-slate-50"
          }`}
        >
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>สำรอง & กู้คืนทั้งระบบ</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 font-mono font-bold">
            {backupHistory.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("import_history")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs whitespace-nowrap ${
            activeMainTab === "import_history"
              ? "bg-[#0b3531] text-white border border-[#144d47]"
              : "bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:bg-slate-50"
          }`}
        >
          <History className="w-4 h-4 text-indigo-600" />
          <span>ประวัติการนำเข้า</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-700 font-mono font-bold">
            {importHistory.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TABLE CSV IMPORT & EXPORT CENTER                                   */}
      {/* ========================================================================= */}
      {activeMainTab === "table_csv" && (
        <div className="space-y-3">
          {/* SEARCH & CATEGORY FILTER TABS + ACTIONS */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Category Tabs */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  selectedCategory === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ทั้งหมด (12)
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("master")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  selectedCategory === "master"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ข้อมูลหลัก (8)
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("transaction")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  selectedCategory === "transaction"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                โครงการ & บิล (4)
              </button>
            </div>

            {/* Search Box & Bulk CSV Buttons */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className="relative flex items-center flex-1 max-w-xs">
                <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาตาราง..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 focus:bg-white placeholder:text-slate-400 transition"
                />
                {searchQuery && (
                  <X
                    size={14}
                    className="absolute right-2 text-slate-400 cursor-pointer hover:text-slate-600"
                    onClick={() => setSearchQuery("")}
                  />
                )}
              </div>

              {/* Multi-CSV Batch Import Button */}
              <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0" title="เลือกไฟล์ CSV หลายๆ ไฟล์พร้อมกัน">
                <Upload size={13} className="text-slate-600" />
                <span>นำเข้าหลายไฟล์</span>
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  onChange={handleImportAllFiles}
                  disabled={importingAll || exportingAll}
                />
              </label>

              {/* Export All CSVs Button */}
              <button
                type="button"
                onClick={exportAllTablesCSV}
                disabled={exportingAll || importingAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
                title="ส่งออกแยกแต่ละตารางเป็นไฟล์ CSV"
              >
                {exportingAll ? (
                  <Loader2 size={13} className="animate-spin text-slate-600" />
                ) : (
                  <Download size={13} className="text-slate-600" />
                )}
                <span>ส่งออกทั้งหมด</span>
              </button>
            </div>
          </div>

          {/* STREAMLINED TABLES LIST */}
          <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                    <th className="py-2.5 px-3.5">ตารางข้อมูล</th>
                    <th className="py-2.5 px-3">หมวดหมู่</th>
                    <th className="py-2.5 px-3">จำนวนข้อมูล</th>
                    <th className="py-2.5 px-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTables.map((table) => {
                    const IconComp = getIconComponent(table.iconName);
                    const rowCount = counts[table.id] ?? 0;
                    const isExporting = exportingTableId === table.id;

                    return (
                      <tr key={table.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${table.color} text-white flex items-center justify-center shrink-0 shadow-2xs`}>
                              <IconComp size={14} />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">
                                {table.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                ตาราง: {table.tableName}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                            table.category === "master"
                              ? "bg-slate-50 text-slate-600 border-slate-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          }`}>
                            {table.category === "master" ? "ข้อมูลหลัก" : "โครงการ & บิล"}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-semibold text-slate-800">
                            {loadingCounts ? "..." : `${rowCount.toLocaleString()} แถว`}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => downloadTemplateCSV(table)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                              title="ดาวน์โหลดตัวอย่างเทมเพลต CSV"
                            >
                              <Download size={11} className="text-slate-400" />
                              <span>เทมเพลต</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => exportTableCSV(table)}
                              disabled={isExporting}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                              title="ส่งออกข้อมูลจริงเป็นไฟล์ CSV"
                            >
                              {isExporting ? (
                                <Loader2 size={11} className="animate-spin text-emerald-600" />
                              ) : (
                                <HardDriveDownload size={11} className="text-emerald-600" />
                              )}
                              <span>ส่งออก</span>
                            </button>

                            <label className="px-2.5 py-1 bg-[#0b3531] hover:bg-[#072724] text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-2xs cursor-pointer">
                              <Upload size={11} className="text-[#d4f54e]" />
                              <span>นำเข้า</span>
                              <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => handleImportCSV(table, e)}
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTables.length === 0 && (
              <div className="p-8 text-center space-y-1">
                <p className="text-xs font-medium text-slate-700">ไม่พบตารางที่ตรงกับคำค้นหา</p>
                <p className="text-[11px] text-slate-400">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่ "ทั้งหมด"</p>
              </div>
            )}
          </div>

          {/* Subtle Link to Import History */}
          {importHistory.length > 0 && (
            <div className="p-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <History size={13} className="text-emerald-600 shrink-0" />
                <span>มีประวัติการนำเข้าทั้งหมด <b>{importHistory.length}</b> รายการ</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                  (นำเข้าล่าสุด: {new Date(importHistory[0].createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMainTab("import_history")}
                className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>ดูประวัติทั้งหมด</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STANDARD BACKUP & RECOVERY SYSTEM                                  */}
      {/* ========================================================================= */}
      {activeMainTab === "standard_backup" && (
        <div className="space-y-4">
          {/* STREAMLINED BACKUP BANNER */}
          <div className="bg-[#0b3531] border border-emerald-800/60 rounded-xl p-4 sm:p-5 text-white shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-white">
                    สำรองและกู้คืนฐานข้อมูลทั้งระบบ
                  </h2>
                  {backupConfig.enabled ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      อัตโนมัติ: {scheduleDescription}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                      ปิดสำรองอัตโนมัติ
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-200/80">
                  ครอบคลุมครบ 12 ตารางฐานข้อมูล ({totalRowCount.toLocaleString()} แถว) และไฟล์รูปภาพแนบทั้งหมด
                </p>
              </div>

              {/* Clean Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {/* 1. Download Full System Archive (.ZIP with all images) */}
                <button
                  type="button"
                  onClick={handleDownloadZipBackup}
                  disabled={backingUpZip || backingUpFull || restoringFull}
                  style={{ backgroundColor: "#d4f54e", color: "#0b3531" }}
                  className="px-3.5 py-2 hover:opacity-90 active:scale-98 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="ดาวน์โหลดทั้ง 12 ตารางฐานข้อมูลพร้อมไฟล์รูปถ่ายบิลต้นฉบับทั้งหมด (.ZIP)"
                >
                  {backingUpZip ? (
                    <Loader2 size={14} className="animate-spin text-[#0b3531]" />
                  ) : (
                    <FileArchive size={14} className="text-[#0b3531]" />
                  )}
                  <span>{backingUpZip ? "กำลังสร้างไฟล์..." : "สำรองข้อมูล (.ZIP รวมรูป)"}</span>
                </button>

                {/* 2. Restore file upload */}
                <label className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm">
                  <FolderUp size={14} className="text-amber-300" />
                  <span>กู้คืนจากไฟล์</span>
                  <input
                    type="file"
                    accept=".json,.zip,application/zip,application/x-zip-compressed"
                    className="hidden"
                    onChange={handleRestoreFullBackup}
                    disabled={backingUpZip || backingUpFull || restoringFull}
                  />
                </label>

                {/* 3. Snapshot Trigger */}
                <button
                  type="button"
                  onClick={handleTriggerBackupNow}
                  disabled={backingUpZip || backingUpFull || restoringFull}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="บันทึกจุดสำรองในระบบทันที"
                >
                  {backingUpFull ? (
                    <Loader2 size={13} className="animate-spin text-emerald-300" />
                  ) : (
                    <Play size={13} className="text-emerald-400 fill-emerald-400" />
                  )}
                  <span>บันทึกจุดสำรอง</span>
                </button>

                {/* 4. Schedule Settings */}
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                  title="ตั้งเวลาสำรองอัตโนมัติ"
                >
                  <Settings size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* BACKUP SNAPSHOTS HISTORY TABLE */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">ประวัติและจุดสำรองข้อมูล (Backup Snapshots)</h3>
                  <p className="text-[11px] text-slate-400">
                    จุดสำรองข้อมูลในระบบ {backupHistory.length} จุด (สามารถดาวน์โหลดหรือกู้คืนได้ทันที)
                  </p>
                </div>
              </div>
            </div>

            {backupHistory.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <p className="text-xs font-medium text-slate-700">ยังไม่มีจุดสำรองข้อมูลในระบบ</p>
                <p className="text-[11px] text-slate-400">กดปุ่ม "บันทึกจุดสำรอง" ด้านบน เพื่อสร้างจุดสำรองแรก</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                      <th className="py-2.5 px-3">วันที่ & เวลา</th>
                      <th className="py-2.5 px-3">ประเภท</th>
                      <th className="py-2.5 px-3">จำนวนข้อมูล</th>
                      <th className="py-2.5 px-3">ขนาด</th>
                      <th className="py-2.5 px-3 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backupHistory.map((snap) => {
                      const dateFormatted = new Date(snap.createdAt).toLocaleString("th-TH", {
                        timeZone: "Asia/Bangkok"
                      });
                      return (
                        <tr key={snap.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{dateFormatted}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{snap.id}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {snap.type === "weekly_auto" ? "อัตโนมัติประจำสัปดาห์" : snap.type === "daily_auto" ? "อัตโนมัติประจำวัน" : "สำรองด้วยตนเอง"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-emerald-700">
                            {snap.totalRows.toLocaleString()} รายการ
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {(snap.sizeBytes / 1024).toFixed(1)} KB
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => handleDownloadSnapshot(snap)}
                                disabled={downloadingSnapshotId === snap.id}
                                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                              >
                                <Download className="w-3 h-3 text-emerald-700" />
                                <span>โหลด</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRestoreSnapshot(snap)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-700" />
                                <span>กู้คืน</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedDeleteSnapshot(snap)}
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: IMPORT HISTORY FULL DASHBOARD & TABLE                              */}
      {/* ========================================================================= */}
      {activeMainTab === "import_history" && (
        <ImportHistoryView
          history={importHistory}
          loading={loadingImportHistory}
          onRefresh={loadImportHistory}
          onDeleteEntry={handleDeleteImportEntry}
          onClearAll={handleClearAllImportHistory}
          onNavigateToImport={() => setActiveMainTab("table_csv")}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. MODALS (SCHEDULE, RESTORE CONFIRM, PROGRESS, SUMMARY)                 */}
      {/* ========================================================================= */}

      {/* A. Backup Schedule Configuration Modal */}
      <BackupScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        config={backupConfig}
        onSave={(updated) => setBackupConfig(updated)}
      />

      {/* B. 1-Click Restore Point Confirmation Modal */}
      <BackupRestoreConfirmModal
        isOpen={!!selectedRestoreSnapshot}
        onClose={() => setSelectedRestoreSnapshot(null)}
        snapshot={selectedRestoreSnapshot}
        onConfirmRestore={handleConfirmRestoreFromSnapshot}
      />

      {/* B2. Delete Backup Snapshot Confirmation Modal */}
      <BackupDeleteConfirmModal
        isOpen={!!selectedDeleteSnapshot}
        onClose={() => setSelectedDeleteSnapshot(null)}
        snapshot={selectedDeleteSnapshot}
        onConfirmDelete={handleConfirmDeleteSnapshot}
      />

      {/* C. Progress Modal Overlay */}
      {importProgress && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-slate-900">
                {restoringFull ? "กำลังกู้คืนข้อมูล..." : importingAll ? "กำลังนำเข้าหลายไฟล์..." : activeImportTable ? `กำลังนำเข้า ${activeImportTable.name}` : "กำลังดำเนินการ..."}
              </h3>
              <p className="text-xs text-slate-700 font-medium">{importProgress.message}</p>
              {importProgress.subMessage && (
                <p className="text-[11px] text-slate-500 font-mono">{importProgress.subMessage}</p>
              )}
            </div>
            {importProgress.total > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.round(
                        (importProgress.current / Math.max(1, importProgress.total)) * 100
                      )}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>
                    {importProgress.current} / {importProgress.total} {importingAll ? "ไฟล์" : "%"}
                  </span>
                  <span>
                    {Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)}%
                  </span>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400">ระบบกำลังป้องกันข้อมูลซ้ำและบันทึกลง Supabase</p>
          </div>
        </div>
      )}

      {/* D. Multi-CSV Import Summary Modal */}
      {importSummary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-xs">{importSummary.title}</h3>
                  <span className="text-[11px] text-slate-500">
                    สำเร็จ {importSummary.successFiles} จาก {importSummary.totalFiles} ไฟล์ ({importSummary.totalRows.toLocaleString()} แถว)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 max-h-72 overflow-y-auto divide-y divide-slate-100">
              {importSummary.details.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.success ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="text-rose-600 font-bold">✕</span>
                      )}
                      <span className="font-medium text-slate-800 truncate">{item.tableName}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{item.filename}</p>
                    {item.error && <p className="text-[10px] text-rose-600">{item.error}</p>}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 ${
                      item.success
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {item.success ? `+${item.count.toLocaleString()} รายการ` : "ล้มเหลว"}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium cursor-pointer transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
