"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ArrowLeft,
  Search,
  Grid,
  List,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Calendar,
  User,
  Layers,
  FileSpreadsheet,
  File,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Columns4,
} from "lucide-react";
import { formatDateThai } from "@/lib/utils/dates";

interface FolderFile {
  url: string;
  name: string;
  type: "image" | "pdf" | "excel" | "word" | "other";
  uploadedAt: string;
  submittedBy?: string;
  note?: string;
  taskId: number | string;
  taskType: "task" | "work";
  taskTitle: string;
  contractor: string;
  project: string;
  month: string;
  status?: string;
}

interface TaskItem {
  id: string;
  rawId: number | string;
  type: "task" | "work";
  title: string;
  displayTitle: string;
  contractor: string;
  project: string;
  month: string;
  monthKey: string;
  status: string;
  doDate?: string;
  sendDate?: string;
  createdAt?: string;
  submittedAt?: string;
  submittedBy?: string;
  note?: string;
  files: FolderFile[];
  fileCount: number;
}

export default function TaskFoldersPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContractors: 0,
    totalProjects: 0,
    totalTasks: 0,
    totalFiles: 0,
  });
  const [tree, setTree] = useState<Record<string, any>>({});
  const [allItems, setAllItems] = useState<TaskItem[]>([]);
  const [flatFiles, setFlatFiles] = useState<FolderFile[]>([]);

  // Navigation path: [contractor, project, month, taskId]
  const [currentPath, setCurrentPath] = useState<{
    contractor?: string;
    project?: string;
    month?: string;
    taskId?: string; // e.g. "task_7"
  }>({});

  // View mode: "columns" (4 คอลัมน์) | "hierarchy" (เจาะโฟลเดอร์) | "gallery" (รวมไฟล์)
  const [viewMode, setViewMode] = useState<"columns" | "hierarchy" | "gallery">("columns");
  // Layout mode: "grid" | "list"
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Lightbox / File Viewer
  const [previewFile, setPreviewFile] = useState<FolderFile | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Upload modal / in-folder upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/task-folders");
      const json = await res.json();
      if (json.success) {
        setStats(json.stats || { totalContractors: 0, totalProjects: 0, totalTasks: 0, totalFiles: 0 });
        setTree(json.tree || {});
        setAllItems(json.items || []);
        setFlatFiles(json.flatFiles || []);
      }
    } catch (err) {
      console.error("Failed to load task folders data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Copy Link Handler
  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Upload handler for current/selected task
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const target = (currentPath.taskId ? allItems.find((it) => it.id === currentPath.taskId) : null) || activeTaskItem || currentTaskItem;
    if (!files || files.length === 0 || !target) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("taskId", String(target.rawId || ""));
      formData.append("submittedBy", target.contractor || "ผู้ดูแลระบบ");

      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const res = await fetch("/api/task-folders", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      } else {
        alert(data.error || "อัปโหลดไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการอัปโหลด: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete file handler
  const handleDeleteFile = async (file: FolderFile) => {
    if (!confirm(`คุณต้องการลบไฟล์ "${file.name}" หรือไม่?`)) return;

    try {
      const res = await fetch(
        `/api/task-folders?taskId=${encodeURIComponent(String(file.taskId))}&fileUrl=${encodeURIComponent(file.url)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        if (previewFile?.url === file.url) setPreviewFile(null);
        await fetchData();
      } else {
        alert(data.error || "ลบไฟล์ไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  // Delete all files in current/selected task folder
  const handleDeleteAllInTask = async () => {
    const target = (currentPath.taskId ? allItems.find((it) => it.id === currentPath.taskId) : null) || activeTaskItem || currentTaskItem;
    const count = target?.files?.length || 0;
    if (!target || count === 0) return;

    if (
      !confirm(
        `⚠️ คุณแน่ใจหรือไม่ว่าต้องการ "ลบรูปทั้งหมด" (${count} ไฟล์) ในโฟลเดอร์ "${target.displayTitle}"?\n\nไฟล์ทั้งหมดจะถูกลบออกจากงานนี้และคลังอย่างถาวร`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/task-folders?taskId=${encodeURIComponent(String(target.rawId))}&deleteAll=true`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setPreviewFile(null);
        await fetchData();
      } else {
        alert(data.error || "ลบไฟล์ทั้งหมดไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  // Current folder level calculation
  const currentLevel = useMemo(() => {
    if (currentPath.taskId) return "task";
    if (currentPath.month) return "month";
    if (currentPath.project) return "project";
    if (currentPath.contractor) return "contractor";
    return "root";
  }, [currentPath]);

  // Data to display at current level
  const displayedFolders: Array<{
    key: string;
    title: string;
    subTitle: string;
    badge: string;
    type: "contractor" | "project" | "month" | "task";
    status?: string;
    onClick: () => void;
  }> = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (currentLevel === "root") {
      // List of Contractors
      const contractors = Object.values(tree) as any[];
      return contractors
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .map((c) => ({
          key: c.name,
          title: c.name,
          subTitle: `${Object.keys(c.projects).length} โครงการ • ${c.totalTasks} งาน`,
          badge: `${c.totalFiles} ไฟล์`,
          type: "contractor" as const,
          onClick: () => setCurrentPath({ contractor: c.name }),
        }));
    }

    if (currentLevel === "contractor") {
      // List of Projects for selected contractor
      const contractorNode = tree[currentPath.contractor || ""];
      if (!contractorNode) return [];
      const projects = Object.values(contractorNode.projects) as any[];
      return projects
        .filter((p) => !q || p.name.toLowerCase().includes(q))
        .map((p) => ({
          key: p.name,
          title: p.name,
          subTitle: `${Object.keys(p.months).length} เดือน • ${p.totalTasks} งาน`,
          badge: `${p.totalFiles} ไฟล์`,
          type: "project" as const,
          onClick: () => setCurrentPath((prev) => ({ ...prev, project: p.name })),
        }));
    }

    if (currentLevel === "project") {
      // List of Months for selected contractor + project
      const contractorNode = tree[currentPath.contractor || ""];
      const projectNode = contractorNode?.projects[currentPath.project || ""];
      if (!projectNode) return [];
      const months = Object.values(projectNode.months) as any[];
      return months
        .filter((m) => !q || m.name.toLowerCase().includes(q))
        .map((m) => ({
          key: m.name,
          title: m.name,
          subTitle: `${m.tasks.length} รายการงาน`,
          badge: `${m.totalFiles} ไฟล์`,
          type: "month" as const,
          onClick: () => setCurrentPath((prev) => ({ ...prev, month: m.name })),
        }));
    }

    if (currentLevel === "month") {
      // List of Tasks for selected contractor + project + month
      const contractorNode = tree[currentPath.contractor || ""];
      const projectNode = contractorNode?.projects[currentPath.project || ""];
      const monthNode = projectNode?.months[currentPath.month || ""];
      if (!monthNode) return [];
      const tasks = (monthNode.tasks || []) as TaskItem[];
      return tasks
        .filter((t) => {
          const matchQ = !q || t.displayTitle.toLowerCase().includes(q) || (t.submittedBy || "").toLowerCase().includes(q);
          const matchStatus =
            statusFilter === "all" ||
            (statusFilter === "done" && (t.status === "สำเร็จ" || t.status === "เสร็จ")) ||
            (statusFilter === "sent" && t.status === "ส่งงานแล้ว") ||
            (statusFilter === "pending" && t.status !== "สำเร็จ" && t.status !== "เสร็จ" && t.status !== "ส่งงานแล้ว");
          return matchQ && matchStatus;
        })
        .map((t) => ({
          key: t.id,
          title: t.displayTitle,
          subTitle: `สถานะ: ${t.status || "กำลังทำ"} • ${t.sendDate || t.doDate || "-"}`,
          badge: `${t.fileCount} ไฟล์`,
          status: t.status,
          type: "task" as const,
          onClick: () => setCurrentPath((prev) => ({ ...prev, taskId: t.id })),
        }));
    }

    return [];
  }, [tree, currentPath, currentLevel, searchQuery, statusFilter]);

  // Current task item when inside task level
  const currentTaskItem = useMemo(() => {
    if (!currentPath.taskId) return null;
    return allItems.find((it) => it.id === currentPath.taskId) || null;
  }, [allItems, currentPath.taskId]);

  // Filtered files in current task folder
  const currentTaskFiles = useMemo(() => {
    if (!currentTaskItem) return [];
    const q = searchQuery.toLowerCase().trim();
    return currentTaskItem.files.filter(
      (f) => !q || f.name.toLowerCase().includes(q) || (f.note || "").toLowerCase().includes(q)
    );
  }, [currentTaskItem, searchQuery]);

  // ==============================================================
  // 4-COLUMN MILLER COLUMNS VIEW DATA
  // ==============================================================
  // 1. Column 1: Contractors List
  const contractorsList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const contractors = Object.values(tree) as any[];
    return contractors.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [tree, searchQuery]);

  // 2. Column 2: Projects List for selected contractor
  const selectedContractorNode = useMemo(() => {
    if (!currentPath.contractor) return null;
    return tree[currentPath.contractor] || null;
  }, [tree, currentPath.contractor]);

  const projectsList = useMemo(() => {
    if (!selectedContractorNode) return [];
    const q = searchQuery.toLowerCase().trim();
    const projects = Object.values(selectedContractorNode.projects || {}) as any[];
    return projects.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [selectedContractorNode, searchQuery]);

  // 3. Column 3: Months List for selected project
  const selectedProjectNode = useMemo(() => {
    if (!selectedContractorNode || !currentPath.project) return null;
    return selectedContractorNode.projects?.[currentPath.project] || null;
  }, [selectedContractorNode, currentPath.project]);

  const monthsList = useMemo(() => {
    if (!selectedProjectNode) return [];
    const q = searchQuery.toLowerCase().trim();
    const months = Object.values(selectedProjectNode.months || {}) as any[];
    return months.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [selectedProjectNode, searchQuery]);

  // 4. Column 4: Tasks List for selected month
  const selectedMonthNode = useMemo(() => {
    if (!selectedProjectNode || !currentPath.month) return null;
    return selectedProjectNode.months?.[currentPath.month] || null;
  }, [selectedProjectNode, currentPath.month]);

  const monthTasksList = useMemo(() => {
    if (!selectedMonthNode) return [];
    const q = searchQuery.toLowerCase().trim();
    const tasks = (selectedMonthNode.tasks || []) as TaskItem[];
    return tasks.filter((t) => {
      const matchQ =
        !q ||
        t.displayTitle.toLowerCase().includes(q) ||
        (t.submittedBy || "").toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "done" && (t.status === "สำเร็จ" || t.status === "เสร็จ")) ||
        (statusFilter === "sent" && t.status === "ส่งงานแล้ว") ||
        (statusFilter === "pending" &&
          t.status !== "สำเร็จ" &&
          t.status !== "เสร็จ" &&
          t.status !== "ส่งงานแล้ว");
      return matchQ && matchStatus;
    });
  }, [selectedMonthNode, searchQuery, statusFilter]);

  // Active Task in Column 4 (defaults to clicked task or first task in selected month)
  const activeTaskItem = useMemo(() => {
    if (currentPath.taskId) {
      return allItems.find((it) => it.id === currentPath.taskId) || null;
    }
    if (monthTasksList.length > 0) {
      return monthTasksList[0];
    }
    return null;
  }, [currentPath.taskId, allItems, monthTasksList]);

  // Files of active task in Column 4
  const activeTaskFiles = useMemo(() => {
    if (!activeTaskItem) return [];
    const q = searchQuery.toLowerCase().trim();
    return activeTaskItem.files.filter(
      (f) => !q || f.name.toLowerCase().includes(q) || (f.note || "").toLowerCase().includes(q)
    );
  }, [activeTaskItem, searchQuery]);

  // Gallery view files
  const galleryFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return flatFiles.filter((f) => {
      const matchQ =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.contractor.toLowerCase().includes(q) ||
        f.project.toLowerCase().includes(q) ||
        f.taskTitle.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "done" && (f.status === "สำเร็จ" || f.status === "เสร็จ")) ||
        (statusFilter === "sent" && f.status === "ส่งงานแล้ว") ||
        (statusFilter === "pending" && f.status !== "สำเร็จ" && f.status !== "เสร็จ" && f.status !== "ส่งงานแล้ว");
      return matchQ && matchStatus;
    });
  }, [flatFiles, searchQuery, statusFilter]);

  // Navigate Up one level
  const handleNavigateUp = () => {
    if (currentPath.taskId) {
      setCurrentPath((prev) => ({ ...prev, taskId: undefined }));
    } else if (currentPath.month) {
      setCurrentPath((prev) => ({ ...prev, month: undefined }));
    } else if (currentPath.project) {
      setCurrentPath((prev) => ({ ...prev, project: undefined }));
    } else if (currentPath.contractor) {
      setCurrentPath({});
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased">
      {/* 1. Header Banner - Compact, Clean & Easy on the Eyes */}
      <header className="border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Left: Brand & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/"
                className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition border border-emerald-200/60 shrink-0"
                title="กลับหน้าหลัก"
              >
                <FolderOpen className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                    คลังโฟลเดอร์เอกสารงาน
                  </h1>
                  <span className="hidden md:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                    Task Folders
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                  ผู้รับผิดชอบ &gt; โครงการ &gt; เดือน &gt; ชื่องาน
                </p>
              </div>
            </div>

            {/* Right: Quick Stats & Refresh Button */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Segmented Stats Pill */}
              <div className="hidden lg:flex items-center bg-slate-100/80 border border-slate-200/80 rounded-xl px-2 py-1 text-xs gap-3">
                <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-slate-500">ผู้รับผิดชอบ:</span>
                  <span className="font-bold text-slate-900">{stats.totalContractors}</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-500" />
                  <span className="text-slate-500">โครงการ:</span>
                  <span className="font-bold text-slate-900">{stats.totalProjects}</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-500">งาน:</span>
                  <span className="font-bold text-slate-900">{stats.totalTasks}</span>
                </div>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5 px-1.5 py-0.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-500">ไฟล์:</span>
                  <span className="font-bold text-emerald-700">{stats.totalFiles}</span>
                </div>
              </div>

              {/* Mobile Stats Summary */}
              <div className="lg:hidden text-xs bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 font-medium">
                <span className="text-emerald-700 font-bold">{stats.totalFiles}</span> ไฟล์ /{" "}
                <span className="font-bold text-slate-800">{stats.totalTasks}</span> งาน
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => fetchData()}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Explorer Navigation & Filter Toolbar (Compact Apple Finder Style) */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-16 z-20 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Breadcrumb Path Navigator */}
            <div className="flex items-center gap-1.5 text-xs overflow-x-auto py-1 scrollbar-none min-w-0">
              {currentLevel !== "root" && (
                <button
                  onClick={handleNavigateUp}
                  className="mr-1 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center cursor-pointer border border-slate-200 shrink-0"
                  title="ย้อนกลับหนึ่งระดับ"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Root Crumb */}
              <button
                onClick={() => setCurrentPath({})}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0 font-medium ${
                  currentLevel === "root"
                    ? "bg-slate-900 text-white font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>คลังทั้งหมด</span>
              </button>

              {/* Contractor Crumb */}
              {currentPath.contractor && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() => setCurrentPath({ contractor: currentPath.contractor })}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0 max-w-[150px] truncate ${
                      currentLevel === "contractor"
                        ? "bg-indigo-600 text-white font-bold shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
                    }`}
                    title={currentPath.contractor}
                  >
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentPath.contractor}</span>
                  </button>
                </>
              )}

              {/* Project Crumb */}
              {currentPath.project && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() =>
                      setCurrentPath({ contractor: currentPath.contractor, project: currentPath.project })
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0 max-w-[160px] truncate ${
                      currentLevel === "project"
                        ? "bg-sky-600 text-white font-bold shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
                    }`}
                    title={currentPath.project}
                  >
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentPath.project}</span>
                  </button>
                </>
              )}

              {/* Month Crumb */}
              {currentPath.month && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    onClick={() =>
                      setCurrentPath({
                        contractor: currentPath.contractor,
                        project: currentPath.project,
                        month: currentPath.month,
                      })
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0 max-w-[150px] truncate ${
                      currentLevel === "month"
                        ? "bg-amber-600 text-white font-bold shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
                    }`}
                    title={currentPath.month}
                  >
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentPath.month}</span>
                  </button>
                </>
              )}

              {/* Task Crumb */}
              {currentTaskItem && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold shadow-xs max-w-[200px] truncate shrink-0"
                    title={currentTaskItem.displayTitle}
                  >
                    <FolderOpen className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentTaskItem.displayTitle}</span>
                  </div>
                </>
              )}
            </div>

            {/* Right Toolbar Controls (Search + View Toggles + Actions) */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    currentLevel === "task"
                      ? "ค้นหาชื่อไฟล์..."
                      : currentLevel === "month"
                      ? "ค้นหาชื่องาน..."
                      : "ค้นหาโฟลเดอร์..."
                  }
                  className="pl-7 pr-7 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition w-[140px] sm:w-[170px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status Filter (When in Month or Task or Gallery level) */}
              {(currentLevel === "month" || viewMode === "gallery") && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] border border-slate-200">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2 py-1 rounded-md transition cursor-pointer font-medium ${
                      statusFilter === "all" ? "bg-white text-slate-900 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    onClick={() => setStatusFilter("done")}
                    className={`px-2 py-1 rounded-md transition cursor-pointer font-medium ${
                      statusFilter === "done" ? "bg-white text-emerald-700 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    สำเร็จ
                  </button>
                  <button
                    onClick={() => setStatusFilter("sent")}
                    className={`px-2 py-1 rounded-md transition cursor-pointer font-medium ${
                      statusFilter === "sent" ? "bg-white text-sky-700 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ส่งงานแล้ว
                  </button>
                </div>
              )}

              {/* View Mode: 4 Columns vs Folder Hierarchy vs All Files Gallery */}
              <div className="bg-slate-100 border border-slate-200 p-0.5 rounded-lg flex items-center text-xs">
                <button
                  onClick={() => setViewMode("columns")}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                    viewMode === "columns"
                      ? "bg-white text-emerald-800 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                  title="มุมมองแบบ 4 คอลัมน์ (Miller Columns)"
                >
                  <Columns4 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>4 คอลัมน์</span>
                </button>
                <button
                  onClick={() => setViewMode("hierarchy")}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                    viewMode === "hierarchy"
                      ? "bg-white text-slate-900 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                  title="มุมมองตามลำดับแฟ้มโฟลเดอร์"
                >
                  <Folder className="w-3 h-3" />
                  <span>โฟลเดอร์</span>
                </button>
                <button
                  onClick={() => setViewMode("gallery")}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                    viewMode === "gallery"
                      ? "bg-white text-slate-900 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                  title="ดูรวมไฟล์ทั้งหมดในคลัง"
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>แกลเลอรี</span>
                </button>
              </div>

              {/* Grid / List Layout Toggle */}
              {viewMode !== "columns" && (
                <div className="bg-slate-100 border border-slate-200 p-0.5 rounded-lg flex items-center text-xs">
                  <button
                    onClick={() => setLayoutMode("grid")}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      layoutMode === "grid" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="แสดงแบบตารางการ์ด (Grid)"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setLayoutMode("list")}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      layoutMode === "list" ? "bg-white text-emerald-600 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="แสดงแบบรายการ (List)"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Global Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.xlsx,.docx"
                onChange={handleUploadFiles}
                className="hidden"
              />

              {/* Upload Button (In task level of hierarchy mode) */}
              {currentLevel === "task" && viewMode === "hierarchy" && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{uploading ? "กำลังอัปโหลด..." : "+ อัปโหลดไฟล์"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content Workspace */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-3">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">กำลังโหลดคลังโฟลเดอร์เอกสาร...</p>
          </div>
        ) : viewMode === "columns" ? (
          /* ===================================================
           * VIEW MODE 1: 4-COLUMN MILLER COLUMNS VIEW
           * =================================================== */
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-190px)] min-h-[620px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 overflow-x-auto">
            {/* ------------------------------------------------
             * COLUMN 1: ผู้รับผิดชอบ (Assignees)
             * ------------------------------------------------ */}
            <div className="w-full lg:w-1/4 flex flex-col h-full min-w-[220px] bg-slate-50/40">
              {/* Header */}
              <div className="p-3 border-b border-slate-200/80 bg-indigo-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">ผู้รับผิดชอบ</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200/70 shadow-2xs">
                  {contractorsList.length} คน
                </span>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {contractorsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">ไม่พบรายชื่อผู้รับผิดชอบ</div>
                ) : (
                  contractorsList.map((c) => {
                    const isSelected = currentPath.contractor === c.name;
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          setCurrentPath({
                            contractor: c.name,
                            project: undefined,
                            month: undefined,
                            taskId: undefined,
                          });
                        }}
                        className={`w-full text-left p-3 transition flex items-center justify-between gap-2.5 cursor-pointer group ${
                          isSelected
                            ? "bg-indigo-50/90 text-indigo-950 font-semibold border-r-3 border-indigo-600 shadow-2xs"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition ${
                              isSelected
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                            }`}
                          >
                            {c.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate group-hover:text-indigo-600 transition">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {Object.keys(c.projects || {}).length} โครงการ • {c.totalTasks} งาน
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                              isSelected
                                ? "bg-indigo-100 text-indigo-800 font-bold"
                                : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                            }`}
                          >
                            {c.totalFiles} ไฟล์
                          </span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition ${
                              isSelected
                                ? "text-indigo-600 translate-x-0.5"
                                : "text-slate-300 group-hover:text-slate-500"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ------------------------------------------------
             * COLUMN 2: โครงการ (Projects)
             * ------------------------------------------------ */}
            <div className="w-full lg:w-1/4 flex flex-col h-full min-w-[220px] bg-white">
              {/* Header */}
              <div className="p-3 border-b border-slate-200/80 bg-sky-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">โครงการ</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-sky-700 border border-sky-200/70 shadow-2xs">
                  {currentPath.contractor ? `${projectsList.length} โครงการ` : "-"}
                </span>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {!currentPath.contractor ? (
                  <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-600">เลือกผู้รับผิดชอบ</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">คลิกรายชื่อในคอลัมน์แรกเพื่อดูโครงการ</p>
                  </div>
                ) : projectsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">ไม่พบโครงการของผู้รับผิดชอบนี้</div>
                ) : (
                  projectsList.map((p) => {
                    const isSelected = currentPath.project === p.name;
                    return (
                      <button
                        key={p.name}
                        onClick={() => {
                          setCurrentPath((prev) => ({
                            ...prev,
                            project: p.name,
                            month: undefined,
                            taskId: undefined,
                          }));
                        }}
                        className={`w-full text-left p-3 transition flex items-center justify-between gap-2.5 cursor-pointer group ${
                          isSelected
                            ? "bg-sky-50/90 text-sky-950 font-semibold border-r-3 border-sky-600 shadow-2xs"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? "bg-sky-600 text-white shadow-xs"
                                : "bg-sky-50 text-sky-600 group-hover:bg-sky-100"
                            }`}
                          >
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate group-hover:text-sky-600 transition">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {Object.keys(p.months || {}).length} เดือน • {p.totalTasks} งาน
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                              isSelected
                                ? "bg-sky-100 text-sky-800 font-bold"
                                : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                            }`}
                          >
                            {p.totalFiles} ไฟล์
                          </span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition ${
                              isSelected
                                ? "text-sky-600 translate-x-0.5"
                                : "text-slate-300 group-hover:text-slate-500"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ------------------------------------------------
             * COLUMN 3: เดือน (Months)
             * ------------------------------------------------ */}
            <div className="w-full lg:w-1/4 flex flex-col h-full min-w-[200px] bg-slate-50/40">
              {/* Header */}
              <div className="p-3 border-b border-slate-200/80 bg-amber-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">เดือน</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-amber-700 border border-amber-200/70 shadow-2xs">
                  {currentPath.project ? `${monthsList.length} เดือน` : "-"}
                </span>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {!currentPath.project ? (
                  <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-600">เลือกโครงการ</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">คลิกโครงการในคอลัมน์ที่ 2 เพื่อดูเดือน</p>
                  </div>
                ) : monthsList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">ไม่พบเดือนในโครงการนี้</div>
                ) : (
                  monthsList.map((m) => {
                    const isSelected = currentPath.month === m.name;
                    return (
                      <button
                        key={m.name}
                        onClick={() => {
                          setCurrentPath((prev) => ({
                            ...prev,
                            month: m.name,
                            taskId: undefined,
                          }));
                        }}
                        className={`w-full text-left p-3 transition flex items-center justify-between gap-2.5 cursor-pointer group ${
                          isSelected
                            ? "bg-amber-50/90 text-amber-950 font-semibold border-r-3 border-amber-600 shadow-2xs"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? "bg-amber-600 text-white shadow-xs"
                                : "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                            }`}
                          >
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate group-hover:text-amber-600 transition">
                              {m.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {m.tasks.length} รายการงาน
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                              isSelected
                                ? "bg-amber-100 text-amber-800 font-bold"
                                : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                            }`}
                          >
                            {m.totalFiles} ไฟล์
                          </span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition ${
                              isSelected
                                ? "text-amber-600 translate-x-0.5"
                                : "text-slate-300 group-hover:text-slate-500"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ------------------------------------------------
             * COLUMN 4: งาน & ไฟล์แนบ (Tasks & Attachments)
             * ------------------------------------------------ */}
            <div className="w-full lg:w-1/4 flex flex-col h-full min-w-[280px] bg-white">
              {/* Header */}
              <div className="p-3 border-b border-slate-200/80 bg-emerald-50/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">งาน & ไฟล์แนบ</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200/70 shadow-2xs">
                  {currentPath.month ? `${monthTasksList.length} งาน` : "-"}
                </span>
              </div>

              {/* Content */}
              {!currentPath.month ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                    <Layers className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">เลือกเดือน</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">คลิกเดือนในคอลัมน์ที่ 3 เพื่อดูงานและไฟล์แนบ</p>
                </div>
              ) : monthTasksList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">ไม่พบงานในเดือนนี้ที่ตรงกับเงื่อนไข</div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 divide-y divide-slate-200/80">
                  {/* Top: Tasks in this Month */}
                  <div className="h-[210px] overflow-y-auto divide-y divide-slate-100 shrink-0 bg-white">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between text-[11px] sticky top-0 z-10">
                      <span className="font-semibold text-slate-600">รายการงาน ({monthTasksList.length})</span>
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          onClick={() => setStatusFilter("all")}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${statusFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          ทั้งหมด
                        </button>
                        <button
                          onClick={() => setStatusFilter("done")}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${statusFilter === "done" ? "bg-emerald-600 text-white font-bold" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          สำเร็จ
                        </button>
                        <button
                          onClick={() => setStatusFilter("sent")}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${statusFilter === "sent" ? "bg-sky-600 text-white font-bold" : "text-slate-500 hover:text-slate-800"}`}
                        >
                          ส่งงาน
                        </button>
                      </div>
                    </div>

                    {monthTasksList.map((t) => {
                      const isSelected = activeTaskItem?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setCurrentPath((prev) => ({ ...prev, taskId: t.id }));
                          }}
                          className={`w-full text-left p-2.5 transition flex items-center justify-between gap-2 cursor-pointer group ${
                            isSelected
                              ? "bg-emerald-50/90 text-emerald-950 font-semibold border-l-3 border-emerald-600 shadow-2xs"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                  t.status === "สำเร็จ" || t.status === "เสร็จ"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : t.status === "ส่งงานแล้ว"
                                    ? "bg-sky-100 text-sky-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {t.status || "กำลังทำ"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">#{t.rawId}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition truncate">
                              {t.displayTitle}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {t.sendDate ? `ส่ง: ${t.sendDate}` : t.doDate ? `ทำ: ${t.doDate}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                isSelected
                                  ? "bg-emerald-100 text-emerald-800 font-bold"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {t.fileCount} ไฟล์
                            </span>
                            <ChevronRight
                              className={`w-3.5 h-3.5 transition ${
                                isSelected
                                  ? "text-emerald-600 translate-x-0.5"
                                  : "text-slate-300 group-hover:text-slate-500"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottom: Files of Selected Task */}
                  <div className="flex-1 overflow-y-auto p-3 bg-slate-50/40 flex flex-col">
                    {activeTaskItem && (
                      <div className="mb-2.5 flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 shrink-0">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            ไฟล์ของงาน #{activeTaskItem.rawId}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {activeTaskFiles.length} ไฟล์แนบ
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <UploadCloud className="w-3 h-3" />
                            <span>{uploading ? "..." : "+ แนบไฟล์"}</span>
                          </button>
                          {activeTaskFiles.length > 0 && (
                            <button
                              onClick={handleDeleteAllInTask}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70 transition cursor-pointer"
                              title="ลบไฟล์ทั้งหมดในงานนี้"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTaskFiles.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white/70">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
                          <UploadCloud className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">ยังไม่มีไฟล์ในงานนี้</p>
                        <p className="text-[10px] text-slate-400 mb-2.5">
                          สามารถกดแนบรูปถ่ายหรือเอกสารได้ทันที
                        </p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <UploadCloud className="w-3 h-3" />
                          <span>เลือกไฟล์</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {activeTaskFiles.map((file, idx) => (
                          <FileCard
                            key={`${file.url}_${idx}`}
                            file={file}
                            onPreview={() => setPreviewFile(file)}
                            onCopyLink={() => handleCopyLink(file.url)}
                            onDelete={() => handleDeleteFile(file)}
                            copiedUrl={copiedUrl}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === "gallery" ? (
          /* ===================================================
           * VIEW MODE 2: FLAT ALL FILES GALLERY
           * =================================================== */
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  ไฟล์ทั้งหมดในคลัง
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {galleryFiles.length} รายการ
                </span>
              </div>
            </div>

            {galleryFiles.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
                <ImageIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">ไม่พบไฟล์ที่ตรงกับเงื่อนไขการค้นหา</p>
              </div>
            ) : layoutMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {galleryFiles.map((file, idx) => (
                  <FileCard
                    key={`${file.url}_${idx}`}
                    file={file}
                    onPreview={() => setPreviewFile(file)}
                    onCopyLink={() => handleCopyLink(file.url)}
                    onDelete={() => handleDeleteFile(file)}
                    copiedUrl={copiedUrl}
                  />
                ))}
              </div>
            ) : (
              <FileListView
                files={galleryFiles}
                onPreview={(f) => setPreviewFile(f)}
                onCopyLink={(f) => handleCopyLink(f.url)}
                onDelete={(f) => handleDeleteFile(f)}
                copiedUrl={copiedUrl}
              />
            )}
          </div>
        ) : currentLevel === "task" ? (
          /* ===================================================
           * LEVEL 5: INSIDE TASK FOLDER (FILES VIEW)
           * =================================================== */
          <div>
            {/* Sleek Task Summary Info Card */}
            {currentTaskItem && (
              <div className="mb-5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        currentTaskItem.status === "สำเร็จ" || currentTaskItem.status === "เสร็จ"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : currentTaskItem.status === "ส่งงานแล้ว"
                          ? "bg-sky-50 text-sky-700 border border-sky-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {currentTaskItem.status || "กำลังทำ"}
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                      {currentTaskItem.displayTitle}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span>ผู้รับผิดชอบ: <strong className="text-slate-800">{currentTaskItem.contractor}</strong></span>
                    <span>•</span>
                    <span>โครงการ: <strong className="text-slate-800">{currentTaskItem.project}</strong></span>
                    <span>•</span>
                    <span>เดือน: <strong className="text-slate-800">{currentTaskItem.month}</strong></span>
                    {currentTaskItem.sendDate && (
                      <>
                        <span>•</span>
                        <span>ส่งงาน: <strong className="text-sky-700">{currentTaskItem.sendDate}</strong></span>
                      </>
                    )}
                  </div>

                  {currentTaskItem.note && (
                    <p className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/70 inline-block">
                      หมายเหตุ: &ldquo;{currentTaskItem.note}&rdquo;
                    </p>
                  )}
                </div>

                {/* Task Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {currentTaskFiles.length > 0 && (
                    <button
                      onClick={handleDeleteAllInTask}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-600 transition border border-rose-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="ลบไฟล์ทั้งหมดในโฟลเดอร์นี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบทั้งหมด ({currentTaskFiles.length})</span>
                    </button>
                  )}
                  <Link
                    href={`/task-upload?id=${currentTaskItem.rawId}&type=${currentTaskItem.type}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition border border-slate-200 flex items-center gap-1.5 shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>แบบฟอร์ม LIFF</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Files Grid or List */}
            {currentTaskFiles.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200/60">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">ยังไม่มีไฟล์ในโฟลเดอร์นี้</h3>
                <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
                  สามารถอัปโหลดรูปถ่ายหรือไฟล์เอกสารเข้ามาเก็บไว้ในโฟลเดอร์ของงานนี้ได้ทันที
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer inline-flex items-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>เลือกไฟล์เพื่ออัปโหลด</span>
                </button>
              </div>
            ) : layoutMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {currentTaskFiles.map((file, idx) => (
                  <FileCard
                    key={`${file.url}_${idx}`}
                    file={file}
                    onPreview={() => setPreviewFile(file)}
                    onCopyLink={() => handleCopyLink(file.url)}
                    onDelete={() => handleDeleteFile(file)}
                    copiedUrl={copiedUrl}
                  />
                ))}
              </div>
            ) : (
              <FileListView
                files={currentTaskFiles}
                onPreview={(f) => setPreviewFile(f)}
                onCopyLink={(f) => handleCopyLink(f.url)}
                onDelete={(f) => handleDeleteFile(f)}
                copiedUrl={copiedUrl}
              />
            )}
          </div>
        ) : (
          /* ===================================================
           * LEVEL 1 - 4: FOLDERS HIERARCHY EXPLORER
           * =================================================== */
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">
                  {currentLevel === "root" && "โฟลเดอร์ผู้รับผิดชอบ"}
                  {currentLevel === "contractor" && `โครงการของ ${currentPath.contractor}`}
                  {currentLevel === "project" && `เดือนของ ${currentPath.project}`}
                  {currentLevel === "month" && `งานในเดือน ${currentPath.month}`}
                </span>
                <span className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                  {displayedFolders.length} โฟลเดอร์
                </span>
              </div>
            </div>

            {displayedFolders.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
                <Folder className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">ไม่พบโฟลเดอร์ในระดับนี้</p>
              </div>
            ) : layoutMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {displayedFolders.map((fld) => (
                  <FolderCard
                    key={fld.key}
                    title={fld.title}
                    subTitle={fld.subTitle}
                    badge={fld.badge}
                    type={fld.type}
                    status={fld.status}
                    onClick={fld.onClick}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs">
                {displayedFolders.map((fld) => (
                  <div
                    key={fld.key}
                    onClick={fld.onClick}
                    className="p-3 sm:p-3.5 hover:bg-slate-50/90 transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                          fld.type === "contractor"
                            ? "bg-indigo-50 text-indigo-600 border border-indigo-200/80 group-hover:bg-indigo-600 group-hover:text-white"
                            : fld.type === "project"
                            ? "bg-sky-50 text-sky-600 border border-sky-200/80 group-hover:bg-sky-600 group-hover:text-white"
                            : fld.type === "month"
                            ? "bg-amber-50 text-amber-600 border border-amber-200/80 group-hover:bg-amber-600 group-hover:text-white"
                            : "bg-emerald-50 text-emerald-600 border border-emerald-200/80 group-hover:bg-emerald-600 group-hover:text-white"
                        }`}
                      >
                        {fld.type === "contractor" && <User className="w-4 h-4" />}
                        {fld.type === "project" && <Building2 className="w-4 h-4" />}
                        {fld.type === "month" && <Calendar className="w-4 h-4" />}
                        {fld.type === "task" && <Folder className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition truncate">
                          {fld.title}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{fld.subTitle}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fld.status && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fld.status === "สำเร็จ" || fld.status === "เสร็จ"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : fld.status === "ส่งงานแล้ว"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {fld.status}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200">
                        {fld.badge}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. Full-Featured Lightbox Viewer Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col justify-between p-4 md:p-6 select-none animate-in fade-in duration-200">
          {/* Top Lightbox Bar */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-white/10">
            <div className="space-y-0.5 min-w-0 pr-4">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                <span className="text-emerald-400 shrink-0">[{previewFile.taskTitle}]</span>
                <span className="truncate">{previewFile.name}</span>
              </h3>
              <p className="text-[11px] text-white/70 truncate">
                {previewFile.contractor} • {previewFile.project} • {formatDateThai(previewFile.uploadedAt)}
              </p>
            </div>

            {/* Actions in Lightbox */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="ซูมเข้า"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="ซูมออก"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="หมุน 90 องศา"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <a
                href={previewFile.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="ดาวน์โหลดไฟล์"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => handleCopyLink(previewFile.url)}
                className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="คัดลอกลิงก์"
              >
                {copiedUrl === previewFile.url ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => {
                  setPreviewFile(null);
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="p-1.5 sm:p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition cursor-pointer ml-1"
                title="ปิด (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image / File Canvas */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
            {previewFile.type === "image" ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: "transform 0.15s ease",
                }}
                className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
            ) : previewFile.type === "pdf" ? (
              <iframe src={previewFile.url} className="w-full h-[80vh] rounded-xl border border-white/20" />
            ) : (
              <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 max-w-md">
                <FileText className="w-14 h-14 mx-auto text-amber-400 mb-3" />
                <h4 className="text-sm font-semibold text-white mb-2">{previewFile.name}</h4>
                <p className="text-xs text-white/70 mb-4">
                  ไฟล์ประเภทนี้ไม่สามารถแสดงตัวอย่างได้โดยตรง สามารถดาวน์โหลดได้ทันที
                </p>
                <a
                  href={previewFile.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>ดาวน์โหลดไฟล์</span>
                </a>
              </div>
            )}
          </div>

          {/* Bottom Info Footer */}
          <div className="text-center text-[11px] text-white/60 pt-2 border-t border-white/10 flex items-center justify-between">
            <span>
              ซูม: {Math.round(zoomLevel * 100)}% • การหมุน: {rotation}°
            </span>
            <span>กดปุ่ม ESC หรือกากบาทด้านบนเพื่อปิด</span>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: Folder Card (Clean, Compact, Easy on the Eyes)
// -------------------------------------------------------------
function FolderCard({
  title,
  subTitle,
  badge,
  type,
  status,
  onClick,
}: {
  title: string;
  subTitle: string;
  badge: string;
  type: "contractor" | "project" | "month" | "task";
  status?: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-white hover:bg-slate-50/70 border border-slate-200/80 hover:border-emerald-500/50 rounded-2xl p-3.5 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between select-none"
    >
      <div>
        {/* Top Icon & Badges */}
        <div className="flex items-center justify-between mb-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs ${
              type === "contractor"
                ? "bg-indigo-50 text-indigo-600 border border-indigo-200/80"
                : type === "project"
                ? "bg-sky-50 text-sky-600 border border-sky-200/80"
                : type === "month"
                ? "bg-amber-50 text-amber-600 border border-amber-200/80"
                : "bg-emerald-50 text-emerald-600 border border-emerald-200/80"
            }`}
          >
            {type === "contractor" && <User className="w-4 h-4" />}
            {type === "project" && <Building2 className="w-4 h-4" />}
            {type === "month" && <Calendar className="w-4 h-4" />}
            {type === "task" && <Folder className="w-4 h-4" />}
          </div>

          <div className="flex items-center gap-1.5">
            {status && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  status === "สำเร็จ" || status === "เสร็จ"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : status === "ส่งงานแล้ว"
                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {status}
              </span>
            )}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
              {badge}
            </span>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition line-clamp-1 mb-0.5">
          {title}
        </h4>
        <p className="text-[11px] text-slate-500 line-clamp-1">{subTitle}</p>
      </div>

      {/* Bottom Subtle Indicator */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-emerald-700 transition">
        <span>เปิดโฟลเดอร์</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: File Card (Clean, Compact Thumbnail Asset)
// -------------------------------------------------------------
function FileCard({
  file,
  onPreview,
  onCopyLink,
  onDelete,
  copiedUrl,
}: {
  file: FolderFile;
  onPreview: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
  copiedUrl: string | null;
}) {
  return (
    <div className="group bg-white hover:bg-slate-50/70 border border-slate-200/80 hover:border-emerald-500/50 rounded-xl overflow-hidden transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between">
      {/* File Preview Thumbnail */}
      <div
        onClick={onPreview}
        className="relative aspect-4/3 w-full bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
      >
        {file.type === "image" ? (
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : file.type === "pdf" ? (
          <FileText className="w-10 h-10 text-rose-500" />
        ) : file.type === "excel" ? (
          <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
        ) : (
          <File className="w-10 h-10 text-amber-500" />
        )}

        {/* Hover Overlay with View Icon */}
        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white/95 text-slate-800 flex items-center justify-center shadow-md">
            <Eye className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Extension Badge */}
        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900/70 backdrop-blur-xs text-white uppercase">
          {file.type}
        </span>
      </div>

      {/* File Info */}
      <div className="p-2 sm:p-2.5">
        <div className="text-xs font-semibold text-slate-800 truncate mb-0.5" title={file.name}>
          {file.name}
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {file.taskTitle ? `${file.taskTitle} • ` : ""}{formatDateThai(file.uploadedAt)}
        </div>

        {/* Action Buttons */}
        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onCopyLink}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="คัดลอกลิงก์ไฟล์"
          >
            {copiedUrl === file.url ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            download
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="ดาวน์โหลด"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onDelete}
            className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
            title="ลบไฟล์"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: File List View (Clean Compact Rows)
// -------------------------------------------------------------
function FileListView({
  files,
  onPreview,
  onCopyLink,
  onDelete,
  copiedUrl,
}: {
  files: FolderFile[];
  onPreview: (file: FolderFile) => void;
  onCopyLink: (file: FolderFile) => void;
  onDelete: (file: FolderFile) => void;
  copiedUrl: string | null;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-xs">
      {files.map((file, idx) => (
        <div
          key={`${file.url}_${idx}`}
          className="p-2.5 sm:p-3 hover:bg-slate-50 transition flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => onPreview(file)}>
            <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
              {file.type === "image" ? (
                <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
              ) : file.type === "pdf" ? (
                <FileText className="w-4 h-4 text-rose-500" />
              ) : file.type === "excel" ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              ) : (
                <File className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700 transition truncate">
                {file.name}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {file.taskTitle} • {file.contractor} • {file.project}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {formatDateThai(file.uploadedAt)}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onPreview(file)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="ดูตัวอย่าง"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onCopyLink(file)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="คัดลอกลิงก์"
              >
                {copiedUrl === file.url ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="ดาวน์โหลด"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => onDelete(file)}
                className="p-1 rounded-md hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                title="ลบ"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
