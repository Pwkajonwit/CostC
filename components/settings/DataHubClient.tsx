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
  Trash2
} from "lucide-react";
import { showToast } from "@/components/shared/ToastProvider";
import type { BackupConfig, BackupSnapshotSummary } from "@/lib/backup-service";
import { DEFAULT_BACKUP_CONFIG } from "@/lib/backup-service";
import {
  BackupScheduleModal,
  BackupRestoreConfirmModal,
  BackupDeleteConfirmModal,
} from "./BackupModals";

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
  const [activeMainTab, setActiveMainTab] = useState<"standard_backup" | "table_csv">("standard_backup");

  // Backup Engine States
  const [backupConfig, setBackupConfig] = useState<BackupConfig>(DEFAULT_BACKUP_CONFIG);
  const [backupHistory, setBackupHistory] = useState<BackupSnapshotSummary[]>([]);
  const [loadingBackupMeta, setLoadingBackupMeta] = useState<boolean>(true);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [selectedRestoreSnapshot, setSelectedRestoreSnapshot] = useState<BackupSnapshotSummary | null>(null);
  const [selectedDeleteSnapshot, setSelectedDeleteSnapshot] = useState<BackupSnapshotSummary | null>(null);
  const [downloadingSnapshotId, setDownloadingSnapshotId] = useState<string | null>(null);

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
  const [restoringFull, setRestoringFull] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);

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

  // 🌟 2. Single-File Full System Backup Download
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

  // 🌟 3. Single-File Full System Restore Upload
  function handleRestoreFullBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoringFull(true);
    setImportProgress({
      current: 0,
      total: 100,
      message: "กำลังอ่านและตรวจสอบไฟล์สำรอง .json...",
      subMessage: file.name
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("ไฟล์สำรองไม่มีข้อมูล");

        const parsedJson = JSON.parse(text);
        if (!parsedJson || typeof parsedJson !== "object") {
          throw new Error("โครงสร้างไฟล์ JSON ไม่ถูกต้อง");
        }

        setImportProgress({
          current: 50,
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

        setImportProgress({
          current: 100,
          total: 100,
          message: "กู้คืนข้อมูลทั้งระบบเสร็จสมบูรณ์!",
          subMessage: `รวม ${result.totalRestored?.toLocaleString() || 0} รายการ`
        });

        const details = (result.details || []).map((d: any) => ({
          filename: file.name,
          tableName: d.tableName,
          count: d.count || 0,
          success: d.success,
          error: d.error
        }));

        setImportSummary({
          title: "ผลการกู้คืนข้อมูลทั้งระบบ (Full System Restore)",
          totalFiles: 1,
          successFiles: 1,
          totalRows: result.totalRestored || 0,
          details
        });

        showToast("success", `กู้คืนข้อมูลทั้งระบบสำเร็จ ${result.totalRestored?.toLocaleString() || 0} รายการ`);
        await loadTableCounts();
        await loadBackupMetadata();
      } catch (err: any) {
        showToast("error", err instanceof Error ? err.message : "กู้คืนข้อมูลไม่สำเร็จ");
      } finally {
        setImportProgress(null);
        setRestoringFull(false);
        event.target.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
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
      await loadTableCounts();
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
        await loadTableCounts();
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

    await loadTableCounts();
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
      <section className="bg-white rounded-xl px-3.5 py-3 sm:px-4 sm:py-3.5 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Badges */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#0b3531] text-[#34d399] flex items-center justify-center shrink-0 shadow-2xs border border-emerald-700/50">
              <HardDrive className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-1.5">
                  ศูนย์จัดการข้อมูล & ระบบสำรองข้อมูลมาตรฐาน
                  <span className="text-[11px] font-bold text-slate-400 tracking-normal hidden sm:inline">
                    / DATA HUB & ENTERPRISE BACKUP
                  </span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#0b3531] text-[#d4f54e] border border-[#144d47] shrink-0 shadow-2xs">
                  <Database className="w-3 h-3 text-[#d4f54e]" />
                  <span>12 ตารางระบบ</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>พร้อมใช้งาน</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                ตั้งเวลาสำรองข้อมูลอัตโนมัติประจำสัปดาห์ บันทึกประวัติ Snapshots กู้คืนระบบแบบ 1-คลิก และนำเข้า/ส่งออกไฟล์ CSV
              </p>
            </div>
          </div>

          {/* Global Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => {
                loadTableCounts();
                loadBackupMetadata();
              }}
              disabled={loadingCounts || loadingBackupMeta}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={13} className={loadingCounts ? "animate-spin text-emerald-600" : "text-slate-500"} />
              <span>{loadingCounts ? "กำลังนับ..." : "รีเฟรชข้อมูล"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. TOP-LEVEL SUB-TABS NAVIGATION PILLS                                    */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveMainTab("standard_backup")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs whitespace-nowrap ${
            activeMainTab === "standard_backup"
              ? "bg-[#0b3531] text-white border border-[#144d47]"
              : "bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:bg-slate-50"
          }`}
        >
          <Shield className="w-4 h-4 text-[#d4f54e]" />
          <span>ระบบสำรองข้อมูลมาตรฐาน (Standard Backup & Recovery)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold">
            {backupHistory.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("table_csv")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs whitespace-nowrap ${
            activeMainTab === "table_csv"
              ? "bg-[#0b3531] text-white border border-[#144d47]"
              : "bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:bg-slate-50"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>นำเข้าและส่งออก CSV แยกตาราง (12 Tables)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STANDARD BACKUP & RECOVERY SYSTEM                                  */}
      {/* ========================================================================= */}
      {activeMainTab === "standard_backup" && (
        <div className="space-y-4">
          {/* 🌟 1. HERO BACKUP STATUS CARD */}
          <div
            style={{ backgroundColor: "#0b3531", borderColor: "#1b5e56" }}
            className="text-white rounded-2xl p-5 sm:p-6 shadow-md border relative overflow-hidden"
          >
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Status Details */}
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    style={{ backgroundColor: "#d4f54e", color: "#0b3531" }}
                    className="p-2 rounded-xl flex items-center justify-center font-bold shadow-sm"
                  >
                    <Database size={20} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white tracking-tight">
                        ระบบสำรองและกู้คืนข้อมูลมาตรฐานทั้งระบบ
                      </h2>
                      {backupConfig.enabled ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          เปิดทำงานอัตโนมัติ
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                          ปิดอยู่
                        </span>
                      )}
                    </div>
                    <p style={{ color: "#b8d9d4" }} className="text-xs mt-0.5">
                      สำรองครบทั้ง 12 ตารางฐานข้อมูล ({totalRowCount.toLocaleString()} แถว) และการตั้งค่าระบบลง Supabase Cloud Storage
                    </p>
                  </div>
                </div>

                {/* Schedule Info Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-black/20 border border-white/10 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">รอบเวลาสำรองอัตโนมัติ</div>
                      <div className="text-xs font-semibold text-white mt-0.5">{scheduleDescription}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/20 border border-white/10 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-300">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">สำรองล่าสุด (Last Backup)</div>
                      <div className="text-xs font-semibold text-white mt-0.5">
                        {backupConfig.lastBackupAt
                          ? new Date(backupConfig.lastBackupAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
                          : "ยังไม่มีประวัติ"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 justify-center">
                {/* 1. Trigger Backup Now */}
                <button
                  type="button"
                  onClick={handleTriggerBackupNow}
                  disabled={backingUpFull || restoringFull}
                  style={{ backgroundColor: "#d4f54e", color: "#0b3531" }}
                  className="px-4 py-2.5 hover:opacity-90 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {backingUpFull ? (
                    <Loader2 size={15} className="animate-spin text-[#0b3531]" />
                  ) : (
                    <Play size={15} className="text-[#0b3531] fill-[#0b3531]" />
                  )}
                  <span>{backingUpFull ? "กำลังสำรองข้อมูล..." : "สำรองข้อมูลทันที (Backup Now)"}</span>
                </button>

                {/* 2. Schedule Settings Modal Button */}
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Settings size={15} className="text-emerald-300" />
                  <span>ตั้งค่าตารางเวลาสำรอง (Schedule)</span>
                </button>

                {/* 3. Download Full JSON file */}
                <button
                  type="button"
                  onClick={handleDownloadFullBackup}
                  disabled={backingUpFull || restoringFull}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <HardDriveDownload size={15} className="text-emerald-400" />
                  <span>ดาวน์โหลดไฟล์ .json ลงเครื่อง</span>
                </button>

                {/* 4. Restore from JSON file upload */}
                <label className="px-4 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-700/60 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer">
                  <FolderUp size={14} className="text-amber-400" />
                  <span>กู้คืนจากไฟล์ JSON นอกระบบ</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleRestoreFullBackup}
                    disabled={backingUpFull || restoringFull}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 🌟 2. BACKUP SNAPSHOTS HISTORY TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">ประวัติและจุดสำรองข้อมูล (Backup Snapshots History)</h3>
                  <p className="text-xs text-slate-500">
                    เก็บประวัติสำรองข้อมูลล่าสุด {backupHistory.length} จุด (สามารถดาวน์โหลด หรือกู้คืนข้อมูลได้ใน 1 คลิก)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  หมุนเวียนเก็บสูงสุด {backupConfig.retentionSnapshots || 12} จุด
                </span>
              </div>
            </div>

            {backupHistory.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-800">ยังไม่มีประวัติการสำรองข้อมูลในระบบ</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    กดปุ่ม <b>"สำรองข้อมูลทันที"</b> ด้านบน เพื่อสร้างจุดสำรองข้อมูลแรกของระบบ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerBackupNow}
                  disabled={backingUpFull}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-2 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>สร้างจุดสำรองข้อมูลตอนนี้</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                      <th className="py-2.5 px-3 rounded-l-lg">วันที่ & เวลาสำรอง</th>
                      <th className="py-2.5 px-3">ประเภท</th>
                      <th className="py-2.5 px-3">จำนวนตาราง & แถว</th>
                      <th className="py-2.5 px-3">ขนาดไฟล์</th>
                      <th className="py-2.5 px-3">สถานะ</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backupHistory.map((snap) => {
                      const dateFormatted = new Date(snap.createdAt).toLocaleString("th-TH", {
                        timeZone: "Asia/Bangkok"
                      });
                      const typeBadge =
                        snap.type === "weekly_auto"
                          ? { label: "อัตโนมัติประจำสัปดาห์", color: "bg-blue-50 text-blue-700 border-blue-200" }
                          : snap.type === "daily_auto"
                          ? { label: "อัตโนมัติประจำวัน", color: "bg-cyan-50 text-cyan-700 border-cyan-200" }
                          : { label: "สำรองด้วยตนเอง", color: "bg-purple-50 text-purple-700 border-purple-200" };

                      const sizeKb = (snap.sizeBytes / 1024).toFixed(1);

                      return (
                        <tr key={snap.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{dateFormatted}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{snap.id}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${typeBadge.color}`}>
                              {typeBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className="font-semibold text-emerald-700">
                              {snap.totalRows.toLocaleString()} รายการ
                            </span>
                            <span className="text-slate-400 text-[10px] ml-1">
                              ({snap.totalTables || 12} ตาราง)
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">{sizeKb} KB</td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>สมบูรณ์</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {/* 1. Download Snapshot File */}
                              <button
                                type="button"
                                onClick={() => handleDownloadSnapshot(snap)}
                                disabled={downloadingSnapshotId === snap.id}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                                title="ดาวน์โหลดไฟล์สำรอง .json นี้ลงเครื่อง"
                              >
                                {downloadingSnapshotId === snap.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                                ) : (
                                  <Download className="w-3 h-3 text-emerald-700" />
                                )}
                                <span>โหลดไฟล์</span>
                              </button>

                              {/* 2. Restore Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedRestoreSnapshot(snap)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                title="กู้คืนข้อมูลระบบจากจุดสำรองนี้"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-700" />
                                <span>กู้คืน</span>
                              </button>

                              {/* 3. Delete Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedDeleteSnapshot(snap)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                title="ลบจุดสำรองข้อมูลและไฟล์นี้ออกจากระบบ"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>ลบ</span>
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
      {/* TAB 2: TABLE CSV IMPORT & EXPORT CENTER                                   */}
      {/* ========================================================================= */}
      {activeMainTab === "table_csv" && (
        <div className="space-y-4">
          {/* STATS & QUICK FILTER BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-500">ตารางข้อมูลทั้งหมด</span>
                <div className="text-sm font-semibold text-slate-900">12 ตาราง</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <HardDrive size={16} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-500">จำนวนข้อมูลรวมทั้งระบบ</span>
                <div className="text-sm font-semibold text-emerald-700 font-mono">
                  {loadingCounts ? "กำลังโหลด..." : `${totalRowCount.toLocaleString()} แถว`}
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-2xs flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-500">ระบบป้องกันข้อมูลซ้ำ</span>
                <div className="text-sm font-semibold text-indigo-700">เปิดใช้งาน (Active)</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <FileCheck size={16} />
              </div>
            </div>
          </div>

          {/* SEARCH & CATEGORY FILTER TABS + MULTI-CSV ACTIONS */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
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
                📁 ข้อมูลหลัก (8)
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
                💼 โครงการ & บิล (4)
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
                <span>นำเข้าหลายไฟล์ CSV</span>
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
                <span>ส่งออกทุก CSV</span>
              </button>
            </div>
          </div>

          {/* TABLE CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredTables.map((table) => {
              const IconComp = getIconComponent(table.iconName);
              const rowCount = counts[table.id] ?? 0;
              const isExporting = exportingTableId === table.id;

              return (
                <div
                  key={table.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${table.color} text-white flex items-center justify-center shadow-xs shrink-0`}
                        >
                          <IconComp size={16} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 text-xs tracking-tight group-hover:text-emerald-700 transition">
                            {table.name}
                          </h3>
                          <span className="text-[10px] font-mono text-slate-400">table: {table.tableName}</span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                        {loadingCounts ? "..." : `${rowCount.toLocaleString()} แถว`}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[32px]">
                      {table.description}
                    </p>

                    {/* Column Badges preview */}
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400 font-medium mr-1">คอลัมน์:</span>
                      {table.columns.slice(0, 4).map((col) => (
                        <span
                          key={col}
                          className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 text-[10px] border border-slate-200/60 font-mono truncate max-w-[100px]"
                        >
                          {col}
                        </span>
                      ))}
                      {table.columns.length > 4 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          +{table.columns.length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Action Buttons Toolbar */}
                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    {/* 1. Download Template */}
                    <button
                      type="button"
                      onClick={() => downloadTemplateCSV(table)}
                      className="flex-1 py-1 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                      title="ดาวน์โหลดตัวอย่างเทมเพลต CSV"
                    >
                      <Download size={12} className="text-slate-500 shrink-0" />
                      <span>เทมเพลต</span>
                    </button>

                    {/* 2. Export Actual Data */}
                    <button
                      type="button"
                      onClick={() => exportTableCSV(table)}
                      disabled={isExporting}
                      className="flex-1 py-1 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50"
                      title="ส่งออกข้อมูลจริงเป็นไฟล์ CSV"
                    >
                      {isExporting ? (
                        <Loader2 size={12} className="animate-spin text-emerald-600 shrink-0" />
                      ) : (
                        <HardDriveDownload size={12} className="text-emerald-600 shrink-0" />
                      )}
                      <span>ส่งออก</span>
                    </button>

                    {/* 3. Import CSV */}
                    <label className="flex-1 py-1 px-2 bg-[#0b3531] hover:bg-[#072724] text-white rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer">
                      <Upload size={12} className="text-[#d4f54e] shrink-0" />
                      <span>นำเข้า</span>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleImportCSV(table, e)}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTables.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
              <AlertCircle size={28} className="mx-auto text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700">ไม่พบตารางที่ตรงกับคำค้นหา</h3>
              <p className="text-xs text-slate-400">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่ "ทั้งหมด"</p>
            </div>
          )}
        </div>
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
