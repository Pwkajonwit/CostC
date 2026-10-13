"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Award,
  Trophy,
  Medal,
  Calendar,
  User,
  Users,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Settings2,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  X,
  ExternalLink,
  FolderOpen,
  ChevronRight,
  Layers,
  Sparkles,
  FileText,
  BarChart3,
  ListOrdered,
  ArrowUpRight,
  Briefcase,
} from "lucide-react";
import { formatDateThai } from "@/lib/utils/dates";

const OFFICIAL_TASK_TYPES = [
  { id: "type_1", taskType: 1, label: "1. เอกสาร", icon: FileText, color: "blue" },
  { id: "type_2", taskType: 2, label: "2. แผนงาน", icon: Calendar, color: "emerald" },
  { id: "type_3", taskType: 3, label: "3. PJSA", icon: Clock, color: "purple" },
];

interface TaskCategory {
  id: string;
  name: string;
  keywords?: string[];
  basePoints: number;
  description?: string;
  color?: string;
  taskType?: number;
}

interface ScoringRules {
  categories: TaskCategory[];
  onTimeBonus: number;
  latePenalty: number;
  hasAttachmentsBonus: number;
}

interface ContractorStat {
  rank: number;
  contractor: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  onTimeTasks: number;
  lateTasks: number;
  totalPoints: number;
  completionRate: number;
  onTimeRate: number;
  grade: "S" | "A" | "B" | "C";
  gradeLabel: string;
  gradeColor: string;
  categoryStats: Record<string, { count: number; points: number }>;
}

interface ProcessedTask {
  id: string;
  rawId: number | string;
  sourceType: "task" | "work";
  title: string;
  displayTitle: string;
  contractor: string;
  project: string;
  monthKey: string;
  monthLabel: string;
  status: string;
  isDone: boolean;
  doDate?: string;
  sendDate?: string;
  submittedAt?: string;
  category: {
    id: string;
    name: string;
    basePoints: number;
  };
  timing: {
    isCompleted: boolean;
    isOnTime: boolean;
    isLate: boolean;
    timingNote: string;
  };
  points: {
    earned: number;
    base: number;
    bonus: number;
    penalty: number;
  };
  filesCount: number;
  files: string[];
  note?: string;
}

interface MonthData {
  monthKey: string;
  monthLabel: string;
  stats: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    onTimeTasks: number;
    lateTasks: number;
    totalPoints: number;
    avgPoints: number;
    completionRate: number;
    onTimeRate: number;
  };
  contractors: ContractorStat[];
  tasksCount: number;
}

export default function TaskPerformancePage() {
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [allTasks, setAllTasks] = useState<ProcessedTask[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRules | null>(null);

  // Filters & State
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"leaderboard" | "tasks" | "analytics">("leaderboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Scoring Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempRules, setTempRules] = useState<ScoringRules | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Fetch Performance Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/task-performance");
      const json = await res.json();
      if (json.success) {
        setMonths(json.months || []);
        setAllTasks(json.allTasks || []);
        const rules = json.scoringRules;
        if (rules && Array.isArray(rules.categories)) {
          rules.categories = rules.categories.map((c: any) => ({
            ...c,
            keywords: Array.isArray(c.keywords) ? c.keywords : [],
            description: c.description || "",
          }));
        }
        setScoringRules(rules || null);
        setTempRules(rules || null);

        // Auto select latest month if not set
        if (json.months && json.months.length > 0 && selectedMonthKey === "all") {
          setSelectedMonthKey(json.months[0].monthKey);
        }
      }
    } catch (err) {
      console.error("Failed to load task performance data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonthKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Current Month Data
  const currentMonthData = useMemo(() => {
    if (selectedMonthKey === "all") return null;
    return months.find((m) => m.monthKey === selectedMonthKey) || null;
  }, [months, selectedMonthKey]);

  // Base tasks in current scope (Month & Category)
  const tasksInScope = useMemo(() => {
    return allTasks.filter((t) => {
      if (selectedMonthKey !== "all" && t.monthKey !== selectedMonthKey) return false;
      if (categoryFilter !== "all" && t.category.id !== categoryFilter) return false;
      return true;
    });
  }, [allTasks, selectedMonthKey, categoryFilter]);

  // Filtered Tasks for table view (filtered by search, contractor, and status)
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return tasksInScope.filter((t) => {
      // Contractor filter
      if (contractorFilter !== "all" && t.contractor !== contractorFilter) return false;
      // Status filter
      if (statusFilter === "done" && !t.isDone) return false;
      if (statusFilter === "pending" && t.isDone) return false;
      if (statusFilter === "ontime" && (!t.isDone || !t.timing.isOnTime)) return false;
      if (statusFilter === "late" && (!t.isDone || !t.timing.isLate)) return false;

      // Text search
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.contractor.toLowerCase().includes(q) ||
        t.project.toLowerCase().includes(q) ||
        t.category.name.toLowerCase().includes(q) ||
        String(t.rawId).includes(q)
      );
    });
  }, [tasksInScope, contractorFilter, statusFilter, searchQuery]);

  // Aggregated Stats for Selected Scope (Month + Category)
  const currentStats = useMemo(() => {
    const totalTasks = tasksInScope.length;
    const completedTasks = tasksInScope.filter((t) => t.isDone).length;
    const pendingTasks = totalTasks - completedTasks;
    const onTimeTasks = tasksInScope.filter((t) => t.isDone && t.timing.isOnTime).length;
    const lateTasks = tasksInScope.filter((t) => t.isDone && t.timing.isLate).length;
    const totalPoints = tasksInScope.reduce((sum, t) => sum + (t.points?.earned || 0), 0);
    const avgPoints = completedTasks > 0 ? Math.round(totalPoints / completedTasks) : 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const onTimeRate = completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      onTimeTasks,
      lateTasks,
      totalPoints,
      avgPoints,
      completionRate,
      onTimeRate,
    };
  }, [tasksInScope]);

  // Contractors List for Leaderboard in Current Scope
  const currentContractors = useMemo(() => {
    const map: Record<string, any> = {};
    for (const t of tasksInScope) {
      const c = t.contractor;
      if (!map[c]) {
        map[c] = {
          contractor: c,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          onTimeTasks: 0,
          lateTasks: 0,
          totalPoints: 0,
          categoryStats: {},
        };
      }
      map[c].totalTasks++;
      if (t.isDone) {
        map[c].completedTasks++;
        map[c].totalPoints += t.points.earned;
        if (t.timing.isOnTime) map[c].onTimeTasks++;
        if (t.timing.isLate) map[c].lateTasks++;
      } else {
        map[c].pendingTasks++;
      }
      if (!map[c].categoryStats[t.category.name]) {
        map[c].categoryStats[t.category.name] = { count: 0, points: 0 };
      }
      map[c].categoryStats[t.category.name].count++;
      map[c].categoryStats[t.category.name].points += t.points.earned;
    }

    return Object.values(map)
      .sort((a: any, b: any) => b.totalPoints - a.totalPoints)
      .map((c: any, idx: number) => {
        const cCompletionRate = c.totalTasks > 0 ? Math.round((c.completedTasks / c.totalTasks) * 100) : 0;
        const cOnTimeRate = c.completedTasks > 0 ? Math.round((c.onTimeTasks / c.completedTasks) * 100) : 0;
        let grade: "S" | "A" | "B" | "C" = "B";
        let gradeLabel = "มาตรฐาน (B)";
        let gradeColor = "amber";

        if (cCompletionRate >= 90 && c.totalPoints >= 100) {
          grade = "S";
          gradeLabel = "ยอดเยี่ยม (S)";
          gradeColor = "emerald";
        } else if (cCompletionRate >= 75 || c.totalPoints >= 70) {
          grade = "A";
          gradeLabel = "ดีมาก (A)";
          gradeColor = "sky";
        } else if (cCompletionRate >= 50 || c.totalPoints >= 40) {
          grade = "B";
          gradeLabel = "มาตรฐาน (B)";
          gradeColor = "amber";
        } else {
          grade = "C";
          gradeLabel = "ต้องปรับปรุง (C)";
          gradeColor = "rose";
        }

        return {
          rank: idx + 1,
          contractor: c.contractor,
          totalTasks: c.totalTasks,
          completedTasks: c.completedTasks,
          pendingTasks: c.pendingTasks,
          onTimeTasks: c.onTimeTasks,
          lateTasks: c.lateTasks,
          totalPoints: c.totalPoints,
          completionRate: cCompletionRate,
          onTimeRate: cOnTimeRate,
          grade,
          gradeLabel,
          gradeColor,
          categoryStats: c.categoryStats,
        };
      });
  }, [tasksInScope]);

  // Unique contractor names for dropdown
  const uniqueContractors = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach((t) => set.add(t.contractor));
    return Array.from(set).sort();
  }, [allTasks]);

  // Category Breakdown Stats
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; count: number; completedCount: number; points: number; basePoints: number }> = {};
    scoringRules?.categories.forEach((cat) => {
      map[cat.id] = {
        name: cat.name,
        count: 0,
        completedCount: 0,
        points: 0,
        basePoints: cat.basePoints,
      };
    });

    const activeTasks = selectedMonthKey === "all" ? allTasks : allTasks.filter((t) => t.monthKey === selectedMonthKey);
    activeTasks.forEach((t) => {
      if (!map[t.category.id]) {
        map[t.category.id] = {
          name: t.category.name,
          count: 0,
          completedCount: 0,
          points: 0,
          basePoints: t.category.basePoints,
        };
      }
      map[t.category.id].count++;
      if (t.isDone) {
        map[t.category.id].completedCount++;
        map[t.category.id].points += t.points.earned;
      }
    });

    return Object.values(map).filter((c) => c.count > 0 || c.points > 0);
  }, [scoringRules, allTasks, selectedMonthKey]);

  // Save Scoring Rules Handler
  const handleSaveScoringRules = async () => {
    if (!tempRules) return;
    try {
      setSavingSettings(true);
      const res = await fetch("/api/task-performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoringRules: tempRules }),
      });
      const data = await res.json();
      if (data.success) {
        setScoringRules(tempRules);
        setSaveSuccessMsg("บันทึกเกณฑ์คะแนนเรียบร้อยแล้ว");
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        setShowSettingsModal(false);
        await fetchData();
      } else {
        alert(data.error || "บันทึกไม่สำเร็จ");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Dynamic Task Types for filter pills
  const dynamicTaskTypes = useMemo(() => {
    if (!scoringRules?.categories || scoringRules.categories.length === 0) {
      return OFFICIAL_TASK_TYPES;
    }
    return scoringRules.categories.map((c, idx) => {
      const numMatch = String(c.name || "").match(/^(\d+)[\.\s\)]*(.*)/);
      const num = Number(c.taskType) || (numMatch ? parseInt(numMatch[1], 10) : idx + 1);
      const label = numMatch && numMatch[2] ? `${num}. ${numMatch[2].trim()}` : (c.name || `${num}. ประเภท ${num}`);
      const icon = num === 1 ? FileText : num === 2 ? Calendar : num === 3 ? Clock : Sparkles;
      return {
        id: c.id || `type_${num}`,
        taskType: num,
        label,
        icon,
        color: c.color || (num === 1 ? "blue" : num === 2 ? "emerald" : num === 3 ? "purple" : "amber"),
      };
    });
  }, [scoringRules]);

  // Add Category Handler in Modal
  const handleAddCategory = () => {
    setTempRules((prev) => {
      const currentCategories = prev?.categories && Array.isArray(prev.categories) ? prev.categories : [];
      const maxType = currentCategories.reduce((max, c) => Math.max(max, Number(c.taskType) || 0), 0);
      const nextNum = Math.max(maxType + 1, currentCategories.length + 1);
      const newId = `type_${nextNum}_${Date.now()}`;
      const newCat: TaskCategory = {
        id: newId,
        taskType: nextNum,
        name: `${nextNum}. ประเภทงานใหม่`,
        keywords: ["ใหม่"],
        basePoints: 1,
        description: "คำอธิบายประเภทงาน",
        color: "amber",
      };

      if (!prev) {
        return {
          categories: [newCat],
          onTimeBonus: 5,
          latePenalty: 5,
          hasAttachmentsBonus: 2,
        };
      }
      return {
        ...prev,
        categories: [...currentCategories, newCat],
      };
    });
  };

  // Remove Category Handler in Modal
  const handleRemoveCategory = (id: string) => {
    setTempRules((prev) => {
      if (!prev) return null;
      const current = prev.categories || [];
      if (current.length <= 1) {
        alert("ต้องมีประเภทงานอย่างน้อย 1 รายการ");
        return prev;
      }
      return {
        ...prev,
        categories: current.filter((c) => c.id !== id),
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased">
      {/* 1. Header Banner - Full Width, Modern & Premium */}
      <header className="border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Left: Brand & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/70 shrink-0 shadow-2xs">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                    สรุปผลงาน & กำหนดคะแนน
                  </h1>
                  <span className="hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0">
                    Monthly Performance & Scoring
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                  ประเมินคะแนนแยกตามประเภทงาน • จัดอันดับผลงานผู้รับเหมาและพนักงานรายเดือน
                </p>
              </div>
            </div>

            {/* Right: Quick Controls & Modal Triggers */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Scoring Rules Settings Button */}
              <button
                onClick={() => {
                  setTempRules(scoringRules ? JSON.parse(JSON.stringify(scoringRules)) : null);
                  setShowSettingsModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 border border-slate-200 transition cursor-pointer shadow-2xs"
                title="ตั้งค่าเกณฑ์คะแนนตามประเภทงาน"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">กำหนดเกณฑ์คะแนน</span>
                <span className="sm:hidden">เกณฑ์คะแนน</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => fetchData()}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-600" : ""}`} />
              </button>

              {/* Link to Folders */}
              <Link
                href="/task-folders"
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                title="ไปยังคลังโฟลเดอร์เอกสารงาน"
              >
                <FolderOpen className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Month Selector & Quick KPI Banner & Task Type Pills */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-16 z-20 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 space-y-2">
          {/* Row 1: Month Selector & KPI Stats */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Month Selector Pills / Dropdown */}
            <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none min-w-0">
              <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>ประจำเดือน:</span>
              </span>

              {/* All Months Option */}
              <button
                onClick={() => setSelectedMonthKey("all")}
                className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer font-medium shrink-0 ${
                  selectedMonthKey === "all"
                    ? "bg-slate-900 text-white font-bold shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                รวมทุกเดือน ({months.length})
              </button>

              {/* Month Pills */}
              {months.map((m) => (
                <button
                  key={m.monthKey}
                  onClick={() => setSelectedMonthKey(m.monthKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer font-medium shrink-0 flex items-center gap-1.5 ${
                    selectedMonthKey === m.monthKey
                      ? "bg-amber-600 text-white font-bold shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  <span>{m.monthLabel}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedMonthKey === m.monthKey
                        ? "bg-amber-700 text-amber-100"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {m.stats.totalPoints} แต้ม
                  </span>
                </button>
              ))}
            </div>

            {/* Quick KPI Stats Summary */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
              {/* Total Points KPI */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-1 text-xs flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-amber-800">คะแนนรวม:</span>
                <span className="font-extrabold text-amber-950 text-sm">{currentStats.totalPoints}</span>
                <span className="text-[10px] text-amber-700">แต้ม</span>
              </div>

              {/* Completed / Total KPI */}
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-1 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-800">งานสำเร็จ:</span>
                <span className="font-extrabold text-emerald-950 text-sm">
                  {currentStats.completedTasks}/{currentStats.totalTasks}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">({currentStats.completionRate}%)</span>
              </div>

              {/* On-Time Rate KPI */}
              <div className="bg-sky-50 border border-sky-200/80 rounded-xl px-3 py-1 text-xs flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-sky-800">ส่งตรงเวลา:</span>
                <span className="font-extrabold text-sky-950 text-sm">{currentStats.onTimeRate}%</span>
              </div>
            </div>
          </div>

          {/* Row 2: Official Task Types Selector matching User Screenshot */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 mr-0.5">ประเภท:</span>

              {/* All option */}
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition cursor-pointer border ${
                  categoryFilter === "all"
                    ? "bg-blue-600 text-white border-blue-600 font-bold shadow-2xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>ทั้งหมด</span>
                <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${categoryFilter === "all" ? "bg-blue-700 text-white" : "text-slate-400"}`}>
                  {allTasks.filter(t => selectedMonthKey === "all" || t.monthKey === selectedMonthKey).length}
                </span>
              </button>

              {/* Dynamic Task Type Pills */}
              {dynamicTaskTypes.map((t) => {
                const Icon = t.icon;
                const isSelected = categoryFilter === t.id;
                const count = allTasks.filter(
                  (task) =>
                    (selectedMonthKey === "all" || task.monthKey === selectedMonthKey) &&
                    task.category.id === t.id
                ).length;

                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setCategoryFilter(isSelected ? "all" : t.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 font-bold shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={12} className={isSelected ? "text-white" : "text-slate-400"} />
                    <span>{t.label}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded font-normal ${
                        isSelected
                          ? "bg-blue-700 text-blue-100"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hint / Active filter status */}
            {categoryFilter !== "all" && (
              <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                <span>กำลังกรอง: <strong>{OFFICIAL_TASK_TYPES.find((t) => t.id === categoryFilter)?.label}</strong></span>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className="text-blue-600 hover:underline cursor-pointer font-bold ml-1"
                >
                  (แสดงทั้งหมด)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Workspace */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">กำลังคำนวณและประมวลผลคะแนนผลงาน...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* View Tabs & Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tab Navigation */}
              <div className="bg-slate-200/80 p-1 rounded-xl flex items-center text-xs font-semibold max-w-fit">
                <button
                  onClick={() => setActiveTab("leaderboard")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "leaderboard"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>จัดอันดับผลงาน ({currentContractors.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "tasks"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                  <span>รายการงาน & คะแนน ({filteredTasks.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "analytics"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>สถิติประเภทงาน</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อผู้รับเหมา, ชื่องาน..."
                    className="pl-7 pr-7 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 transition w-[160px] sm:w-[200px]"
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

                {/* Contractor Filter */}
                <select
                  value={contractorFilter}
                  onChange={(e) => setContractorFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer max-w-[150px]"
                >
                  <option value="all">ผู้รับเหมาทั้งหมด</option>
                  {uniqueContractors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="all">สถานะงานทั้งหมด</option>
                  <option value="done">เฉพาะงานที่สำเร็จ</option>
                  <option value="ontime">ส่งตรงเวลา</option>
                  <option value="late">ส่งงานล่าช้า</option>
                  <option value="pending">อยู่ระหว่างทำ</option>
                </select>
              </div>
            </div>

            {/* TAB 1: LEADERBOARD & CONTRACTOR SCORECARDS */}
            {activeTab === "leaderboard" && (
              <div className="space-y-4">
                {/* Top 3 Compact Highlight Cards */}
                {currentContractors.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Rank 1 (Gold - Highlighted) */}
                    {currentContractors[0] && (
                      <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/60 to-white rounded-xl border border-amber-300/80 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                            1
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {currentContractors[0].contractor}
                              </h4>
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-500 text-white shrink-0">
                                แชมป์
                              </span>
                            </div>
                            <p className="text-[10px] text-amber-900/80 truncate">
                              สำเร็จ {currentContractors[0].completedTasks}/{currentContractors[0].totalTasks} งาน • ตรงเวลา {currentContractors[0].onTimeRate}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1">
                          <div className="text-base sm:text-lg font-black text-amber-900 leading-tight">
                            {currentContractors[0].totalPoints}
                          </div>
                          <span className="text-[9px] font-bold text-amber-700">แต้ม</span>
                        </div>
                      </div>
                    )}

                    {/* Rank 2 (Silver) */}
                    {currentContractors[1] && (
                      <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-extrabold text-sm flex items-center justify-center shrink-0 border border-slate-200">
                            2
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                {currentContractors[1].contractor}
                              </h4>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                                {currentContractors[1].gradeLabel}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">
                              สำเร็จ {currentContractors[1].completedTasks}/{currentContractors[1].totalTasks} งาน • ตรงเวลา {currentContractors[1].onTimeRate}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1">
                          <div className="text-base sm:text-lg font-black text-slate-800 leading-tight">
                            {currentContractors[1].totalPoints}
                          </div>
                          <span className="text-[9px] font-semibold text-slate-400">แต้ม</span>
                        </div>
                      </div>
                    )}

                    {/* Rank 3 (Bronze) */}
                    {currentContractors[2] && (
                      <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-800 font-extrabold text-sm flex items-center justify-center shrink-0 border border-amber-200">
                            3
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                {currentContractors[2].contractor}
                              </h4>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-50 text-slate-600 border border-slate-200 shrink-0">
                                {currentContractors[2].gradeLabel}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">
                              สำเร็จ {currentContractors[2].completedTasks}/{currentContractors[2].totalTasks} งาน • ตรงเวลา {currentContractors[2].onTimeRate}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1">
                          <div className="text-base sm:text-lg font-black text-slate-800 leading-tight">
                            {currentContractors[2].totalPoints}
                          </div>
                          <span className="text-[9px] font-semibold text-slate-400">แต้ม</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Leaderboard Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-600" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        ตารางสรุปคะแนนผลงานผู้รับเหมาและพนักงาน
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      ทั้งหมด {currentContractors.length} รายชื่อ
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-14 text-center">อันดับ</th>
                          <th className="py-2.5 px-3">ผู้รับเหมา / ผู้รับผิดชอบ</th>
                          <th className="py-2.5 px-3 text-center">งานสำเร็จ</th>
                          <th className="py-2.5 px-3 text-center">อัตราสำเร็จ</th>
                          <th className="py-2.5 px-3 text-center">ตรงเวลา</th>
                          <th className="py-2.5 px-3 text-center">ระดับผลงาน</th>
                          <th className="py-2.5 px-3 text-right">คะแนนรวม</th>
                          <th className="py-2.5 px-3 text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentContractors.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400">
                              ไม่พบข้อมูลผลงานในเงื่อนไขที่เลือก
                            </td>
                          </tr>
                        ) : (
                          currentContractors.map((c) => (
                            <tr key={c.contractor} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-3 text-center font-bold">
                                {c.rank === 1 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs">
                                    1
                                  </span>
                                ) : c.rank === 2 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
                                    2
                                  </span>
                                ) : c.rank === 3 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs">
                                    3
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-semibold">{c.rank}</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{c.contractor}</div>
                                <div className="text-[11px] text-slate-400">
                                  รับมอบหมาย {c.totalTasks} งาน • ค้างอยู่ {c.pendingTasks} งาน
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center font-semibold text-slate-800">
                                {c.completedTasks} / {c.totalTasks}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        c.completionRate >= 80 ? "bg-emerald-500" : c.completionRate >= 50 ? "bg-amber-500" : "bg-rose-500"
                                      }`}
                                      style={{ width: `${c.completionRate}%` }}
                                    />
                                  </div>
                                  <span className="font-bold text-slate-700">{c.completionRate}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`font-semibold ${
                                    c.onTimeRate >= 80 ? "text-emerald-700" : c.onTimeRate >= 50 ? "text-amber-700" : "text-rose-600"
                                  }`}
                                >
                                  {c.onTimeRate}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    c.grade === "S"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : c.grade === "A"
                                      ? "bg-sky-100 text-sky-800 border border-sky-300"
                                      : c.grade === "B"
                                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                                      : "bg-rose-100 text-rose-800 border border-rose-300"
                                  }`}
                                >
                                  {c.gradeLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span className="text-sm font-black text-amber-700">{c.totalPoints}</span>
                                <span className="text-[10px] text-slate-400 ml-1">แต้ม</span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setContractorFilter(c.contractor);
                                    setActiveTab("tasks");
                                  }}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                                  title="ดูกระจายงานของคนนี้"
                                >
                                  ดูงาน ({c.totalTasks})
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TASKS BREAKDOWN & POINTS DETAIL */}
            {activeTab === "tasks" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      รายละเอียดงานและคะแนนที่ได้รับแต่ละรายการ
                    </h3>
                  </div>
                  {contractorFilter !== "all" && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">กรองเฉพาะ: <strong className="text-slate-800">{contractorFilter}</strong></span>
                      <button
                        onClick={() => setContractorFilter("all")}
                        className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                      >
                        (ล้างตัวกรอง)
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-16">รหัสงาน</th>
                        <th className="py-2.5 px-3">ชื่องาน</th>
                        <th className="py-2.5 px-3">ผู้รับผิดชอบ</th>
                        <th className="py-2.5 px-3">ประเภทงาน</th>
                        <th className="py-2.5 px-3">กำหนดส่ง</th>
                        <th className="py-2.5 px-3 text-center">สถานะ</th>
                        <th className="py-2.5 px-3 text-center">การส่งมอบ</th>
                        <th className="py-2.5 px-3 text-right">คะแนน</th>
                        <th className="py-2.5 px-3 text-center">เอกสาร</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            ไม่พบรายการงานที่ตรงกับเงื่อนไข
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                              #{t.rawId}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{t.title}</div>
                              <div className="text-[11px] text-slate-400">{t.project}</div>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{t.contractor}</td>
                            <td className="py-2.5 px-3">
                              {t.category.id === "type_1" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                  <FileText size={11} className="text-blue-600" />
                                  <span>1. เอกสาร</span>
                                  <span className="text-[9px] text-blue-500 font-normal">({t.category.basePoints} แต้ม)</span>
                                </span>
                              ) : t.category.id === "type_2" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Calendar size={11} className="text-emerald-600" />
                                  <span>2. แผนงาน</span>
                                  <span className="text-[9px] text-emerald-500 font-normal">({t.category.basePoints} แต้ม)</span>
                                </span>
                              ) : t.category.id === "type_3" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                                  <Clock size={11} className="text-purple-600" />
                                  <span>3. PJSA</span>
                                  <span className="text-[9px] text-purple-500 font-normal">({t.category.basePoints} แต้ม)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                  <FileText size={11} className="text-blue-600" />
                                  <span>{t.category.name}</span>
                                  <span className="text-[9px] text-blue-500 font-normal">({t.category.basePoints} แต้ม)</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                              {t.sendDate ? formatDateThai(t.sendDate) : "-"}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  t.isDone
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {t.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {t.isDone ? (
                                t.timing.isOnTime ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    ตรงเวลา (+{scoringRules?.onTimeBonus || 5})
                                  </span>
                                ) : t.timing.isLate ? (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                    ช้ากว่ากำหนด (-{scoringRules?.latePenalty || 5})
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500">สำเร็จ</span>
                                )
                              ) : (
                                <span className="text-[10px] text-slate-400">อยู่ระหว่างทำ</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`text-sm font-black ${
                                  t.points.earned > 0 ? "text-emerald-700" : "text-slate-400"
                                }`}
                              >
                                {t.points.earned}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">แต้ม</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Link
                                href={`/task-folders`}
                                className="text-slate-400 hover:text-emerald-600 transition inline-flex items-center gap-1 font-medium"
                                title="ดูไฟล์แนบในโฟลเดอร์"
                              >
                                <span>{t.filesCount} ไฟล์</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CATEGORY ANALYTICS */}
            {activeTab === "analytics" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Weight Summary Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        สถิติผลงานแยกตามประเภทงาน
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      {selectedMonthKey === "all" ? "รวมทุกเดือน" : currentMonthData?.monthLabel}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {categoryBreakdown.map((cat) => {
                      const totalCompleted = currentStats.completedTasks || 1;
                      const percent = Math.round((cat.completedCount / totalCompleted) * 100);
                      const isType1 = cat.name.includes("เอกสาร") || cat.name.startsWith("1.");
                      const isType2 = cat.name.includes("แผนงาน") || cat.name.startsWith("2.");
                      const isType3 = cat.name.includes("PJSA") || cat.name.startsWith("3.");
                      const Icon = isType1 ? FileText : isType2 ? Calendar : isType3 ? Clock : Briefcase;
                      const barColor = isType1 ? "bg-blue-600" : isType2 ? "bg-emerald-600" : isType3 ? "bg-purple-600" : "bg-amber-600";
                      const textBadge = isType1 ? "text-blue-700 bg-blue-50" : isType2 ? "text-emerald-700 bg-emerald-50" : isType3 ? "text-purple-700 bg-purple-50" : "text-amber-700 bg-amber-50";

                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span className={`p-1 rounded ${textBadge}`}>
                                <Icon size={12} />
                              </span>
                              <span>{cat.name}</span>
                            </span>
                            <span className="text-slate-500">
                              สำเร็จ {cat.completedCount} งาน • รวม{" "}
                              <strong className="text-amber-800">{cat.points}</strong> แต้ม
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                            <div
                              className={`${barColor} h-full rounded-full transition-all`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scoring Rules Explanation Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        เกณฑ์คะแนนที่ใช้งานอยู่ปัจจุบัน
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setTempRules(scoringRules ? JSON.parse(JSON.stringify(scoringRules)) : null);
                        setShowSettingsModal(true);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                    >
                      แก้ไขเกณฑ์คะแนน
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 space-y-1">
                      <div className="font-bold text-amber-900">โบนัส & บทลงโทษ</div>
                      <div>• ส่งงานตรงเวลาหรือก่อนกำหนด: <strong>+{scoringRules?.onTimeBonus || 5} คะแนน</strong></div>
                      <div>• ส่งงานล่าช้ากว่ากำหนด: <strong>-{scoringRules?.latePenalty || 5} คะแนน</strong></div>
                      <div>• แนบรูปถ่ายหลักฐานหน้างาน: <strong>+{scoringRules?.hasAttachmentsBonus || 2} คะแนน</strong></div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto">
                      {scoringRules?.categories.map((c) => (
                        <div key={c.id} className="py-1.5 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">{c.name}</div>
                            <div className="text-[10px] text-slate-400">{c.description}</div>
                          </div>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                            {c.basePoints} แต้ม
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. Score Configuration Modal */}
      {showSettingsModal && tempRules && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    กำหนดเกณฑ์คะแนนตามประเภทงาน
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    กำหนดคะแนนพื้นฐานต่องาน โบนัสส่งงานตรงเวลา และบทลงโทษ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Bonus / Penalty Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70">
                <div>
                  <label className="font-bold text-amber-950 block mb-1">โบนัสตรงเวลา (+แต้ม)</label>
                  <input
                    type="number"
                    value={tempRules.onTimeBonus}
                    onChange={(e) =>
                      setTempRules({ ...tempRules, onTimeBonus: Number(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-slate-800 text-center"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-950 block mb-1">หักคะแนนส่งช้า (-แต้ม)</label>
                  <input
                    type="number"
                    value={tempRules.latePenalty}
                    onChange={(e) =>
                      setTempRules({ ...tempRules, latePenalty: Number(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-slate-800 text-center"
                  />
                </div>
                <div>
                  <label className="font-bold text-amber-950 block mb-1">โบนัสมีรูปแนบ (+แต้ม)</label>
                  <input
                    type="number"
                    value={tempRules.hasAttachmentsBonus}
                    onChange={(e) =>
                      setTempRules({ ...tempRules, hasAttachmentsBonus: Number(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-slate-800 text-center"
                  />
                </div>
              </div>

              {/* Category Points Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">
                    รายการประเภทงานและคะแนนพื้นฐาน ({tempRules.categories.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center gap-1 border border-emerald-200 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มประเภทงาน</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {tempRules.categories.map((cat, idx) => (
                    <div key={cat.id || idx} className="p-3 bg-white hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTempRules((prev) => {
                              if (!prev) return null;
                              const nextCats = prev.categories.map((c, i) =>
                                i === idx ? { ...c, name: val } : c
                              );
                              return { ...prev, categories: nextCats };
                            });
                          }}
                          placeholder="ชื่อประเภทงาน"
                          className="font-bold text-slate-900 px-2 py-1 rounded border border-slate-200 w-full text-xs"
                        />
                        <input
                          type="text"
                          value={Array.isArray(cat.keywords) && cat.keywords.length > 0 ? cat.keywords.join(", ") : (cat.description || "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTempRules((prev) => {
                              if (!prev) return null;
                              const nextCats = prev.categories.map((c, i) =>
                                i === idx
                                  ? {
                                      ...c,
                                      keywords: val.split(",").map((s) => s.trim()).filter(Boolean),
                                      description: val,
                                    }
                                  : c
                              );
                              return { ...prev, categories: nextCats };
                            });
                          }}
                          placeholder="คำสำคัญหรือคำอธิบายประเภทงาน (คั่นด้วยจุลภาค)"
                          className="text-[11px] text-slate-500 px-2 py-0.5 rounded border border-slate-100 w-full"
                        />
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500">คะแนน:</span>
                          <input
                            type="number"
                            value={cat.basePoints}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setTempRules((prev) => {
                                if (!prev) return null;
                                const nextCats = prev.categories.map((c, i) =>
                                  i === idx ? { ...c, basePoints: val } : c
                                );
                                return { ...prev, categories: nextCats };
                              });
                            }}
                            className="w-16 px-2 py-1 rounded border border-slate-200 font-bold text-center text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="ลบประเภทงานนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (confirm("คุณต้องการรีเซ็ตเกณฑ์คะแนนกลับเป็นค่าเริ่มต้นของระบบหรือไม่?")) {
                    setTempRules(JSON.parse(JSON.stringify(DEFAULT_SCORING_CONFIG)));
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>รีเซ็ตค่าเริ่มต้น</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveScoringRules}
                  disabled={savingSettings}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSettings ? "กำลังบันทึก..." : "บันทึกเกณฑ์คะแนน"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fallback constant for default scoring config aligned with official types
const DEFAULT_SCORING_CONFIG = {
  categories: [
    {
      id: "type_1",
      name: "1. เอกสาร",
      keywords: ["เอกสาร", "สัญญา", "ใบสำคัญ", "รายงาน"],
      basePoints: 20,
      description: "งานเอกสาร, สัญญา, ใบสำคัญ, รายงานประจำวัน",
    },
    {
      id: "type_2",
      name: "2. แผนงาน",
      keywords: ["แผนงาน", "ตารางเวลา", "แผน", "plan"],
      basePoints: 25,
      description: "งานแผนงาน, ตารางเวลาดำเนินงาน, แผนก่อสร้าง",
    },
    {
      id: "type_3",
      name: "3. PJSA",
      keywords: ["pjsa", "ความปลอดภัย", "ตรวจสอบ"],
      basePoints: 30,
      description: "งาน PJSA, วิเคราะห์ความปลอดภัย, มาตรฐานหน้างาน",
    },
  ],
  onTimeBonus: 5,
  latePenalty: 5,
  hasAttachmentsBonus: 2,
};
