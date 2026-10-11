"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  FileText,
  Flame,
  Loader2,
  Send,
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  X,
  Plus,
  Trash2,
  ClipboardList,
  Sparkles,
  Layers
} from "lucide-react";
import { QuickCreatorBar, type QuickCreator } from "@/components/auth/QuickCreatorBar";

interface ProjectOption {
  id: string;
  name: string;
  customer?: string;
}

interface TaskItemInput {
  id: string;
  title: string;
  taskType: number;
  isUrgent: boolean;
  doDate: string;
  sendDate: string;
}

const TASK_TYPES = [
  { id: 1, label: "เอกสาร", icon: FileText, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { id: 2, label: "แผนงาน", icon: Calendar, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { id: 3, label: "PJSA", icon: Clock, color: "text-purple-600 bg-purple-50 border-purple-200" }
];

function addDaysIso(isoDate: string, days = 1): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-").map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + days);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const da = String(date.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function getTodayIso(): string {
  const today = new Date();
  const yr = today.getFullYear();
  const mo = String(today.getMonth() + 1).padStart(2, "0");
  const da = String(today.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function createEmptyTask(taskType = 1, isUrgent = false, defaultDo = "", defaultSend = ""): TaskItemInput {
  const dDate = defaultDo || getTodayIso();
  const sDate = defaultSend || addDaysIso(dDate, 1);
  return {
    id: Math.random().toString(36).substring(2, 9),
    title: "",
    taskType,
    isUrgent,
    doDate: dDate,
    sendDate: sDate
  };
}

export default function QuickTaskPage() {
  const [creator, setCreator] = useState<QuickCreator | null>(null);
  const [project, setProject] = useState("งานทั่วไป");
  const [projectId, setProjectId] = useState("0");

  const todayIso = getTodayIso();
  const defaultSendIso = addDaysIso(todayIso, 1);
  const [note, setNote] = useState("");

  // Multiple tasks list
  const [tasks, setTasks] = useState<TaskItemInput[]>([
    createEmptyTask(1, false, todayIso, defaultSendIso)
  ]);

  // Projects from /views/project-all (Table: Project)
  const [projects, setProjects] = useState<ProjectOption[]>([
    { id: "0", name: "งานทั่วไป" }
  ]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // Submit states
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch projects from /views/project-all (API: /api/rows?tableName=Project)
  useEffect(() => {
    let isMounted = true;
    async function loadProjects() {
      try {
        const res = await fetch("/api/rows?tableName=Project");
        if (res.ok) {
          const data = await res.json();
          const list: ProjectOption[] = [
            { id: "0", name: "งานทั่วไป" }
          ];
          const seen = new Set<string>(["งานทั่วไป"]);

          for (const r of data.rows || []) {
            const pName = String(r["ชื่อ Project"] || r.name || "").trim();
            const pId = String(r["ID Project"] || r.id || "").trim();
            const pCus = String(r["ชื่อลูกค้า"] || r.customer_name || "").trim();
            if (pName && !seen.has(pName.toLowerCase())) {
              seen.add(pName.toLowerCase());
              list.push({ id: pId, name: pName, customer: pCus });
            }
          }

          if (isMounted) {
            setProjects(list);
            setLoadingProjects(false);
          }
        } else {
          if (isMounted) setLoadingProjects(false);
        }
      } catch {
        if (isMounted) setLoadingProjects(false);
      }
    }
    loadProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProjects = useMemo(() => {
    if (!projectFilter.trim()) return projects;
    const q = projectFilter.trim().toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.customer && p.customer.toLowerCase().includes(q))
    );
  }, [projects, projectFilter]);

  // Task item operations
  const handleAddTask = () => {
    const today = getTodayIso();
    const tomorrow = addDaysIso(today, 1);
    setTasks((prev) => [...prev, createEmptyTask(1, false, today, tomorrow)]);
  };

  const handleUpdateTask = (id: string, updates: Partial<TaskItemInput>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleRemoveTask = (id: string) => {
    if (tasks.length <= 1) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const validTasksCount = tasks.filter((t) => t.title.trim().length > 0).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creator || !creator.name) {
      setErrorMsg("กรุณาระบุตัวตนผู้เปิดงาน (กรอกเบอร์โทรด้านบน) ก่อนทำการบันทึก");
      return;
    }

    const validTasks = tasks
      .map((t) => ({
        ...t,
        title: t.title.trim()
      }))
      .filter((t) => t.title.length > 0);

    if (validTasks.length === 0) {
      setErrorMsg("กรุณาระบุชื่องาน / รายการที่ต้องทำอย่างน้อย 1 รายการ");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        creator_name: creator.name.trim(),
        creator_phone: creator.phone || "-",
        creator_emp_id: creator.employeeId || "",
        assignee_name: creator.name.trim(),
        assignee_id: creator.employeeId || null,
        project: project.trim() || "งานทั่วไป",
        project_id: projectId && projectId !== "0" ? projectId : undefined,
        projectId: projectId && projectId !== "0" ? projectId : undefined,
        do_date: validTasks[0]?.doDate || todayIso,
        send_date: validTasks[0]?.sendDate || null,
        note: note.trim() || null,
        tasks: validTasks.map((t) => ({
          title: t.title,
          task_type: t.taskType,
          is_urgent: t.isUrgent,
          do_date: t.doDate || todayIso,
          send_date: t.sendDate || addDaysIso(t.doDate || todayIso, 1)
        }))
      };

      const res = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึกงาน");
      }

      // Clear form immediately and stay on same page
      const currentToday = getTodayIso();
      const currentTomorrow = addDaysIso(currentToday, 1);
      setTasks([createEmptyTask(1, false, currentToday, currentTomorrow)]);
      setProject("งานทั่วไป");
      setProjectId("0");
      setProjectFilter("");
      setNote("");
      setErrorMsg(null);

      const taskListText = Array.isArray(data.taskIds)
        ? data.taskIds.map((id: any) => `#${id}`).join(", ")
        : `#${data.taskId}`;

      setSuccessMsg(`เปิดงานสำเร็จ (${taskListText})`);

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between font-sans text-xs selection:bg-blue-100 selection:text-blue-900">
      {/* Main Content */}
      <main className="flex-1 w-full max-w-lg mx-auto px-3.5 sm:px-4 pt-3.5 sm:pt-5 pb-36 space-y-3.5">
        {/* Creator Identity Bar (Remembered across sessions) */}
        <QuickCreatorBar
          creator={creator}
          onCreatorChange={setCreator}
          accentColor="blue"
        />

        {successMsg && (
          <div className="p-2.5 px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between gap-2 shadow-2xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span className="font-semibold text-emerald-900 truncate">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-500 hover:text-emerald-800 p-0.5 rounded transition cursor-pointer shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-1.5">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-400 hover:text-rose-700 p-0.5 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Card 1: Project / สังกัดโครงการ & วันที่ร่วมกัน */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-4.5 space-y-3.5 shadow-2xs">
            {/* Project / Category */}
            <div ref={projectDropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-slate-700">
                  โครงการ / สังกัด <span className="text-[10px] text-slate-400 font-normal">(ใช้ร่วมกันทุกงานในชุดนี้)</span>
                </label>
                {project && project !== "งานทั่วไป" && (
                  <button
                    type="button"
                    onClick={() => {
                      setProject("งานทั่วไป");
                      setProjectId("0");
                      setProjectFilter("");
                    }}
                    className="text-[10px] text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    รีเซ็ตเป็นงานทั่วไป
                  </button>
                )}
              </div>

              <div className="relative">
                <Briefcase size={15} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="เลือกโครงการ หรือพิมพ์ค้นหา..."
                  value={project}
                  onFocus={() => {
                    setIsProjectDropdownOpen(true);
                    setProjectFilter(project === "งานทั่วไป" ? "" : project);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProject(val);
                    setProjectFilter(val);
                    setIsProjectDropdownOpen(true);
                    const matched = projects.find(
                      (p) => p.name.toLowerCase() === val.trim().toLowerCase() || p.id === val.trim()
                    );
                    if (matched) {
                      setProjectId(matched.id);
                    } else {
                      setProjectId("");
                    }
                  }}
                  className="w-full pl-8.5 pr-8 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                />
                {loadingProjects ? (
                  <Loader2 size={14} className="absolute right-3 top-3 text-slate-400 animate-spin" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsProjectDropdownOpen((prev) => !prev)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <ChevronDown
                      size={15}
                      className={`transition-transform duration-200 ${
                        isProjectDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Dropdown Options from /views/project-all */}
              {isProjectDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                  {filteredProjects.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      ไม่พบโครงการ &quot;{projectFilter}&quot; (สามารถใช้ชื่อที่พิมพ์ได้)
                    </div>
                  ) : (
                    filteredProjects.map((pOpt) => {
                      const isSelected = project === pOpt.name;
                      return (
                        <button
                          key={`${pOpt.id}-${pOpt.name}`}
                          type="button"
                          onClick={() => {
                            setProject(pOpt.name);
                            setProjectId(pOpt.id);
                            setProjectFilter("");
                            setIsProjectDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-blue-50/70 transition cursor-pointer ${
                            isSelected ? "bg-blue-50 font-bold text-blue-700" : "text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="font-medium text-slate-900">{pOpt.name}</span>
                            {pOpt.customer && (
                              <span className="text-[10px] text-slate-400 truncate">({pOpt.customer})</span>
                            )}
                          </div>
                          {pOpt.id !== "0" && (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono bg-slate-100 text-slate-600">
                              #{pOpt.id}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Quick suggestion chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400 mr-0.5">เลือกเร็ว:</span>
                {projects.slice(0, 6).map((pOpt) => {
                  const isSelected = project === pOpt.name;
                  return (
                    <button
                      type="button"
                      key={pOpt.name}
                      onClick={() => {
                        setProject(pOpt.name);
                        setProjectId(pOpt.id);
                        setProjectFilter("");
                        setIsProjectDropdownOpen(false);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-md transition cursor-pointer border ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 font-bold shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200/60"
                      }`}
                    >
                      {pOpt.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                หมายเหตุรวม (ใช้ร่วมกันทุกงาน)
              </label>
              <textarea
                rows={2}
                placeholder="ระบุสิ่งที่ต้องระวัง หรือจุดตรวจเช็ครวม..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Card 2: Tasks List Section (สร้างทีละหลายๆ งาน) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 sm:p-4.5 space-y-3.5 shadow-2xs">
            {/* Header with Title */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-blue-600" />
                <h2 className="text-xs font-bold text-slate-800">
                  รายการงานที่ต้องการเปิด
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {tasks.length} งาน
                </span>
              </div>
            </div>

            {/* Dynamic Task Rows List */}
            <div className="space-y-3">
              {tasks.map((task, index) => {
                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-xl border transition-all ${
                      task.isUrgent
                        ? "bg-rose-50/40 border-rose-200"
                        : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Row Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center font-mono">
                          {index + 1}
                        </span>
                        <span className="text-[11px] font-medium text-slate-700">
                          งานที่ {index + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Urgent Toggle per item */}
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateTask(task.id, { isUrgent: !task.isUrgent })
                          }
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer border ${
                            task.isUrgent
                              ? "bg-red-500 text-white border-red-500 shadow-2xs"
                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <Flame size={12} className={task.isUrgent ? "text-white" : "text-slate-400"} />
                          <span>{task.isUrgent ? "ด่วน" : "ปกติ"}</span>
                        </button>

                        {/* Remove item button (disabled if only 1 item) */}
                        {tasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTask(task.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="ลบงานนี้"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Task Title Input */}
                    <div className="mb-2">
                      <input
                        type="text"
                        required
                        placeholder={`ชื่องาน เช่น ซ่อมไฟ, เตรียมเอกสารเบิกงวด`}
                        value={task.title}
                        onChange={(e) =>
                          handleUpdateTask(task.id, { title: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (index === tasks.length - 1 && task.title.trim()) {
                              handleAddTask();
                            }
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                      />
                    </div>

                    {/* Task Type & Individual Dates */}
                    <div className="space-y-2 pt-1 border-t border-slate-200/60">
                      {/* Task Type selector pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 mr-0.5">ประเภท:</span>
                        {TASK_TYPES.map((t) => {
                          const Icon = t.icon;
                          const isSelected = task.taskType === t.id;
                          return (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() =>
                                handleUpdateTask(task.id, { taskType: t.id })
                              }
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer border ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-600 font-bold shadow-2xs"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <Icon size={11} className={isSelected ? "text-white" : "text-slate-400"} />
                              <span>{t.id}. {t.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Individual Task Dates: วันเริ่ม และ วันกำหนดส่งของงานนี้ */}
                      <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-slate-200/80">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                            <Calendar size={11} className="text-blue-500" />
                            <span>วันเริ่มทำ</span>
                          </label>
                          <input
                            type="date"
                            value={task.doDate}
                            onChange={(e) => {
                              const newDo = e.target.value;
                              const newSend = addDaysIso(newDo, 1);
                              handleUpdateTask(task.id, {
                                doDate: newDo,
                                sendDate: newSend
                              });
                            }}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-slate-600 mb-1 flex items-center gap-1">
                            <Clock size={11} className="text-purple-500" />
                            <span>กำหนดส่งงาน</span>
                            <span className="text-[9px] text-purple-600 font-semibold">(เริ่ม +1 วัน)</span>
                          </label>
                          <input
                            type="date"
                            value={task.sendDate}
                            onChange={(e) =>
                              handleUpdateTask(task.id, { sendDate: e.target.value })
                            }
                            className="w-full px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500/30 focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Task Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddTask}
                className="w-full py-2 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 rounded-xl text-blue-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.99]"
              >
                <Plus size={15} />
                <span>+ เพิ่มงานอีกรายการ</span>
              </button>
            </div>
          </div>

          {/* Sticky Bottom Submit Button */}
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-20 shadow-md">
            <div className="max-w-lg mx-auto flex items-center gap-2.5">
              <div className="shrink-0 text-center px-2 py-1 bg-slate-100 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-400 leading-none">จำนวนงาน</div>
                <div className="text-sm font-bold text-slate-800 leading-tight">
                  {validTasksCount || tasks.length}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium text-xs sm:text-sm tracking-wide transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>กำลังบันทึกและส่งเข้า LINE...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>
                      บันทึกเปิดงาน {validTasksCount > 1 ? `${validTasksCount} รายการ ` : ""}& ส่งเข้า LINE
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="py-3 text-center text-[11px] text-slate-400 border-t border-slate-200 bg-white">
        <span>CostLab • GIS Pharma</span>
      </footer>
    </div>
  );
}
