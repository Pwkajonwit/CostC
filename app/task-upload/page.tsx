"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Send,
  Trash2,
  User,
  AlertCircle,
  UploadCloud,
  X,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  Phone,
  Calendar,
  Hash,
  Tag,
  Edit3
} from "lucide-react";
import { compressImage } from "@/lib/utils/image-compressor";
import { closeToLine } from "@/lib/line/line-close";
import { formatDateThai } from "@/lib/utils/dates";

function TaskUploadContent() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get("id") || "";
  const typeParam = searchParams.get("type") || (rawId.toUpperCase().startsWith("PW") ? "work" : "task");
  const cleanId = rawId.replace(/\D/g, "");
  const [isWork, setIsWork] = useState(typeParam === "work");

  const [loadingTask, setLoadingTask] = useState(true);
  const [taskData, setTaskData] = useState<{
    id: number;
    title: string;
    assignee_name?: string;
    status: string;
    team?: string;
    activity_type?: string;
    company?: string;
    contractor_name?: string;
    location?: string;
    pr_no?: string;
    date_inspect?: string;
    date_propose?: string;
    contact1?: string;
    phone1?: string;
    contact2?: string;
    phone2?: string;
    note?: string;
    created_at?: string;
    amount?: number | string;
    creator?: string;
    creator_emp_id?: string;
    creator_phone?: string;
    do_date?: string;
    send_date?: string;
    task_type?: number | string;
    assignee_id?: string;
    image_url?: string;
  } | null>(null);

  // Existing attachments from database
  const [existingAttachments, setExistingAttachments] = useState<{
    images?: string[];
    note?: string;
    submittedBy?: string;
    submittedAt?: string;
  } | null>(null);

  // Lightbox Viewer state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxRotate, setLightboxRotate] = useState(0);

  const [submittedBy, setSubmittedBy] = useState("");
  const [note, setNote] = useState("");

  // Attached files
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load task / work info & existing attachments
  useEffect(() => {
    if (!cleanId) {
      setLoadingTask(false);
      return;
    }

    fetch(`/api/tasks/submit?id=${rawId || cleanId}&type=${typeParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.task) {
          setTaskData(data.task);
          if (data.isWork !== undefined) setIsWork(Boolean(data.isWork));
          setSubmittedBy(data.task.assignee_name || "");
          if (data.attachments) {
            setExistingAttachments(data.attachments);
          }
        } else {
          setErrorMsg(data.error || "ไม่พบข้อมูลงานรหัสนี้");
        }
      })
      .catch(() => {
        setErrorMsg("ไม่สามารถโหลดข้อมูลงานได้");
      })
      .finally(() => {
        setLoadingTask(false);
      });
  }, [cleanId, rawId, typeParam]);

  // Smooth scroll to upload form if #upload hash is present
  useEffect(() => {
    if (!loadingTask && typeof window !== "undefined" && window.location.hash === "#upload") {
      setTimeout(() => {
        const el = document.getElementById("upload");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 250);
    }
  }, [loadingTask]);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setCompressing(true);
    setErrorMsg(null);

    const newFiles: File[] = [];
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file.type.startsWith("image/")) {
          try {
            const compressed = await compressImage(file, 1400, 0.78);
            newFiles.push(compressed);
            newUrls.push(URL.createObjectURL(compressed));
          } catch {
            newFiles.push(file);
            newUrls.push(URL.createObjectURL(file));
          }
        } else {
          newFiles.push(file);
          newUrls.push(URL.createObjectURL(file));
        }
      }

      setFiles((prev) => [...prev, ...newFiles]);
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    } catch (err) {
      console.error("Error processing files:", err);
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanId) {
      setErrorMsg("ไม่พบรหัสงาน");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("task_id", rawId || cleanId);
      formData.append("type", isWork ? "work" : "task");
      formData.append("note", note.trim());
      formData.append("submitted_by", submittedBy.trim());

      // Attempt to obtain active LIFF context (group/room/user) to deliver reply directly
      try {
        const liff = (window as any).liff;
        if (liff && typeof liff.getContext === "function") {
          const ctx = liff.getContext();
          if (ctx) {
            const target = ctx.groupId || ctx.roomId || ctx.userId || "";
            if (target) formData.append("target_id", target);
          }
        }
      } catch (_) {}

      files.forEach((file) => {
        formData.append("files", file, file.name || "attachment_photo.jpg");
      });

      const res = await fetch("/api/tasks/submit", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการบันทึก");
      }

      // If server returned flex message, reply directly into the active LINE chat via LIFF
      if (data.flex) {
        try {
          let liff = (window as any).liff;
          if (!liff) {
            const liffModule = await import("@line/liff");
            liff = liffModule.default || (window as any).liff;
          }
          const activeLiffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID || "";
          if (liff && typeof liff.init === "function") {
            try {
              await liff.init({ liffId: activeLiffId });
            } catch (_) {}
          }
          if (liff && typeof liff.isInClient === "function" && liff.isInClient()) {
            const altText = isWork
              ? `[แนบเอกสารงาน: PW-${cleanId}] ${taskData?.title || "งานรับเหมา"}`
              : `[ส่งงาน: #${cleanId}] ${taskData?.title || "งานทั่วไป"}`;
            await liff.sendMessages([
              {
                type: "flex",
                altText,
                contents: data.flex,
              },
            ]);
          }
        } catch (liffErr) {
          console.warn("liff.sendMessages notice/fallback:", liffErr);
        }
      }

      // Clear upload inputs immediately and stay on same page
      setFiles([]);
      setPreviewUrls([]);
      setNote("");
      setErrorMsg(null);

      // Refresh existing attachments with newly uploaded images
      if (Array.isArray(data.images) && data.images.length > 0) {
        setExistingAttachments((prev) => ({
          ...prev,
          images: data.images,
          submittedBy: submittedBy || prev?.submittedBy,
          submittedAt: new Date().toISOString(),
          note: note.trim() || prev?.note,
        }));
      }

      // Update in-page task status badge to "ส่งงานแล้ว"
      if (!isWork) {
        setTaskData((prev) => (prev ? { ...prev, status: "ส่งงานแล้ว" } : prev));
      }

      setSuccessMsg(
        isWork
          ? `🎉 แนบเอกสารงานรับเหมาเรียบร้อยแล้ว! (รหัส PW-${cleanId}) บันทึกและส่งข้อความตอบกลับ Flex เข้า LINE แล้ว`
          : `🎉 ส่งงานและแนบเอกสารเรียบร้อยแล้ว! (รหัส #${cleanId}) บันทึกและส่งข้อความตอบกลับ Flex เข้า LINE แล้ว`
      );

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "ส่งงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === "เสร็จสิ้น" || status === "สำเร็จ") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (status === "ส่งงานแล้ว") {
      return "bg-sky-50 text-sky-700 border-sky-200";
    }
    if (status === "รอเสนอ" || status === "สั่งจ้าง") {
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  // Deduplicate dates for task so same date is not printed 3 times
  const taskDateLabel = (() => {
    if (taskData?.send_date && taskData?.do_date && taskData.send_date !== taskData.do_date) {
      return `เริ่ม: ${formatDateThai(taskData.do_date)} • ส่ง: ${formatDateThai(taskData.send_date)}`;
    }
    const d = taskData?.send_date || taskData?.do_date || taskData?.created_at;
    return d ? formatDateThai(d) : null;
  })();

  if (loadingTask) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
        <Loader2 size={30} className="animate-spin text-[#0b3531]" />
        <span className="text-xs font-medium">กำลังโหลดข้อมูลงาน...</span>
      </div>
    );
  }

  const allExistingImages = [
    ...(existingAttachments?.images || []),
    ...(taskData?.image_url ? String(taskData.image_url).split(",") : [])
  ]
    .map((s) => String(s || "").trim())
    .filter((s) => s.startsWith("http"));
  const uniqueExistingImages = Array.from(new Set(allExistingImages));

  return (
    <div className="space-y-3 sm:space-y-3.5 pb-24">
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start justify-between gap-2.5 shadow-2xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">บันทึกเรียบร้อยแล้ว!</p>
              <p className="text-emerald-700 mt-0.5 leading-relaxed">{successMsg}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-800 p-0.5 rounded transition"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 1. Job Summary Card (Compact, Non-redundant, with Inline Close Button) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
        {/* Top Header: ID & Badges on Left, Close on Right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-[#0b3531] text-[#d4f54e] font-mono font-bold text-xs shadow-2xs">
              {isWork ? `PW-${cleanId}` : `#${cleanId}`}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getStatusBadgeClass(taskData?.status || "")}`}>
              {taskData?.status || "รอดำเนินการ"}
            </span>
            {taskData?.team && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                ทีม {taskData.team}
              </span>
            )}
            {taskData?.activity_type && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px]">
                {taskData.activity_type}
              </span>
            )}
          </div>

          {/* Minimal Inline Close Button */}
          <button
            type="button"
            onClick={() => closeToLine("/")}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-medium transition cursor-pointer active:scale-95"
            title="ปิดหน้าต่างกลับ LINE"
          >
            <X size={13} />
            <span>ปิด</span>
          </button>
        </div>

        {/* Job Title */}
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
            {taskData?.title || "ไม่มีชื่องาน"}
          </h1>
        </div>

        {/* Key Job Metadata (Concise, Deduplicated) */}
        {taskData && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600">
            {/* Task Info */}
            {!isWork ? (
              <>
                {taskData.assignee_name && (
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="text-slate-400">ผู้รับผิดชอบ:</span>
                    <span className="font-medium text-slate-800">{taskData.assignee_name}</span>
                  </div>
                )}
                {taskDateLabel && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400 shrink-0" />
                    <span className="text-slate-400">วันที่:</span>
                    <span className="font-medium text-slate-800">{taskDateLabel}</span>
                  </div>
                )}
              </>
            ) : (
              /* Work (PW) Info */
              <>
                {taskData.location && taskData.location !== "-" && (
                  <div className="flex items-start gap-1.5">
                    <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="font-medium text-slate-800">{taskData.location}</span>
                  </div>
                )}
                {taskData.pr_no && taskData.pr_no !== "-" && (
                  <div className="flex items-center gap-1.5">
                    <Hash size={13} className="text-slate-400 shrink-0" />
                    <span className="text-slate-400">PR:</span>
                    <span className="font-mono font-medium text-slate-800">{taskData.pr_no}</span>
                  </div>
                )}
                {(taskData.contractor_name || (taskData.company && taskData.company !== "-") || taskData.contact1) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Building2 size={13} className="text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800">
                      {taskData.contractor_name || taskData.company || taskData.contact1}
                    </span>
                    {taskData.phone1 && taskData.phone1 !== "-" && (
                      <a href={`tel:${taskData.phone1}`} className="text-emerald-700 font-semibold hover:underline flex items-center gap-0.5">
                        <Phone size={11} />
                        <span>{taskData.phone1}</span>
                      </a>
                    )}
                  </div>
                )}
                {taskData.date_inspect && taskData.date_inspect !== "-" && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400 shrink-0" />
                    <span className="text-slate-400">นัดดู:</span>
                    <span className="font-medium text-slate-800">{taskData.date_inspect}</span>
                  </div>
                )}
                {taskData.date_propose && taskData.date_propose !== "-" && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400 shrink-0" />
                    <span className="text-slate-400">นัดเสนอ:</span>
                    <span className="font-medium text-slate-800">{taskData.date_propose}</span>
                  </div>
                )}
                {((taskData.contact2 && taskData.contact2 !== "-") || taskData.creator) && (
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <span className="text-slate-400">ผู้เปิด:</span>
                    <span className="font-medium text-slate-800">
                      {taskData.contact2 || taskData.creator}
                      {taskData.phone2 && taskData.phone2 !== "-" ? ` (${taskData.phone2})` : ""}
                    </span>
                  </div>
                )}
                {taskData.note && taskData.note !== "-" && (
                  <div className="sm:col-span-2 text-slate-500 pt-0.5">
                    <span>หมายเหตุ: </span>
                    <span className="text-slate-700">{taskData.note}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {isWork ? (
        /* Work (PW) Mode: No document uploads, prompt to update work directly */
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs space-y-4 text-center animate-in fade-in">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Edit3 size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">
              งานรับเหมา (PW-{cleanId}) ไม่ต้องอัปโหลดเอกสาร
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              การเลื่อนสถานะหรือแก้ไขรายละเอียดงาน ให้ดำเนินการผ่านแบบฟอร์มอัพเดทข้อมูลงาน
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
            <a
              href={`/quick-work?id=PW-${cleanId}`}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition active:scale-95 inline-flex items-center justify-center gap-1.5"
            >
              <Edit3 size={14} />
              <span>เปิดฟอร์มอัพเดทข้อมูล & เลื่อนสถานะ</span>
            </a>
          </div>
        </div>
      ) : (
        /* 2. Unified Attachments & Upload Form Card */
        <form
        onSubmit={handleSubmit}
        id="upload"
        className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3"
      >
        {/* Hidden File Inputs */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          className="hidden"
          onChange={handleFilesSelected}
        />
        <input
          type="file"
          accept="image/*"
          multiple
          ref={galleryInputRef}
          className="hidden"
          onChange={handleFilesSelected}
        />

        {/* Card Header: Title on Left, Upload Action Buttons on Right */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <ImageIcon size={15} />
            </div>
            <h3 className="text-xs font-bold text-slate-800">
              เอกสารแนบ {uniqueExistingImages.length > 0 ? `(${uniqueExistingImages.length} รูป)` : ""}
            </h3>
          </div>

          {/* Action Buttons: Moved to header as requested */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-lg text-xs transition cursor-pointer shadow-2xs"
              title="ถ่ายรูปจากกล้อง"
            >
              <Camera size={13} />
              <span>ถ่ายรูป</span>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200/80 font-medium rounded-lg text-xs transition cursor-pointer"
              title="เลือกรูปจากคลังภาพ"
            >
              <ImageIcon size={13} className="text-slate-500" />
              <span>เลือกจากคลัง</span>
            </button>
          </div>
        </div>

        {/* Existing Photos Grid (if any) */}
        {uniqueExistingImages.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {uniqueExistingImages.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setLightboxIndex(idx);
                    setLightboxZoom(1);
                    setLightboxRotate(0);
                  }}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition active:scale-[0.98]"
                >
                  <img
                    src={imgUrl}
                    alt={`เอกสารแนบ ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 bg-black/60 text-white rounded-full p-1.5 transition-opacity">
                      <Eye size={15} />
                    </div>
                  </div>
                  <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-medium">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Existing attachment date / note caption */}
            {(existingAttachments?.submittedAt || existingAttachments?.note) && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-slate-400 shrink-0" />
                  <span>
                    {existingAttachments.submittedAt && `แนบเมื่อ: ${formatDateThai(existingAttachments.submittedAt)}`}
                    {existingAttachments.submittedBy && existingAttachments.submittedBy !== taskData?.assignee_name && ` โดย ${existingAttachments.submittedBy}`}
                  </span>
                </div>
                {existingAttachments.note && (
                  <span className="text-slate-700 font-medium truncate max-w-[180px]" title={existingAttachments.note}>
                    {existingAttachments.note}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          previewUrls.length === 0 && (
            <div
              onClick={() => galleryInputRef.current?.click()}
              className="border border-dashed border-slate-200 hover:border-emerald-300 rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition flex flex-col items-center justify-center gap-1.5"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UploadCloud size={16} />
              </div>
              <div className="text-xs font-semibold text-slate-700">ยังไม่มีรูปภาพแนบในงานนี้</div>
              <div className="text-[11px] text-slate-400">กดปุ่ม "ถ่ายรูป" หรือ "เลือกจากคลัง" ด้านบนเพื่อเพิ่มรูป</div>
            </div>
          )
        )}

        {/* Compressing indicator */}
        {compressing && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-emerald-700 font-medium">
            <Loader2 size={14} className="animate-spin" />
            <span>กำลังบีบอัดรูปภาพ...</span>
          </div>
        )}

        {/* Newly Selected Previews */}
        {previewUrls.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between pb-1.5 text-[11px] text-slate-600 font-medium">
              <span className="flex items-center gap-1 text-emerald-800">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>รูปที่เลือกใหม่:</span>
              </span>
              <span className="font-semibold text-emerald-700">{previewUrls.length} รูป</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {previewUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-emerald-400 group bg-slate-50 shadow-2xs"
                >
                  <img
                    src={url}
                    alt={`new-${idx}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600/90 hover:bg-rose-700 text-white flex items-center justify-center text-xs shadow-xs cursor-pointer transition active:scale-90"
                    title="ลบรูปนี้"
                  >
                    <X size={12} />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[8px] px-1 py-0.2 rounded font-medium">
                    ใหม่ #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inputs (Author & Note) */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-700">
              ชื่อผู้แนบ / ผู้ส่งงาน <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                required
                placeholder="เช่น ช่างเอก, วิศวกรสมชาย"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
                className="w-full h-8.5 pl-8 pr-2.5 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-700">
              หมายเหตุประกอบ (ถ้ามี)
            </label>
            <input
              type="text"
              placeholder="ระบุข้อความหรือรายละเอียดประกอบ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-8.5 px-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition"
            />
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-700 p-0.5">
              <X size={14} />
            </button>
          </div>
        )}
      </form>
      )}

      {/* 4. Sticky Bottom Submit Button (Tasks only) */}
      {!isWork && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-20 shadow-md">
          <div className="max-w-lg mx-auto">
            <button
              type="submit"
              form="upload"
              disabled={submitting || compressing}
              className="w-full py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-xs sm:text-sm tracking-wide transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>กำลังส่งงานและอัปโหลดหลักฐาน...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>{files.length > 0 ? `บันทึกรูปแนบ (${files.length} รูป) & ส่งเข้า LINE` : "บันทึก & ส่งเข้า LINE"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && uniqueExistingImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-md font-mono">
                {lightboxIndex + 1} / {uniqueExistingImages.length}
              </span>
              <span className="text-xs text-slate-300">
                {taskData?.title ? `${taskData.title.slice(0, 30)}...` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={uniqueExistingImages[lightboxIndex]}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition cursor-pointer"
                title="เปิดภาพขนาดเต็ม"
              >
                <Download size={16} />
              </a>
              <button
                type="button"
                onClick={() => setLightboxRotate((r) => (r + 90) % 360)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition cursor-pointer"
                title="หมุนรูป"
              >
                <RotateCw size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.min(z + 0.5, 3))}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition cursor-pointer"
                title="ขยาย"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => Math.max(z - 0.5, 0.75))}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition cursor-pointer"
                title="ย่อ"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 bg-white/30 hover:bg-white/40 rounded-full text-white transition cursor-pointer ml-1"
                title="ปิด"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Image Center */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden my-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={uniqueExistingImages[lightboxIndex]}
              alt="ภาพขยาย"
              className="max-h-[80vh] max-w-full object-contain transition-transform duration-200 select-none"
              style={{
                transform: `scale(${lightboxZoom}) rotate(${lightboxRotate}deg)`
              }}
            />
          </div>

          {/* Bottom Navigation */}
          <div
            className="flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={lightboxIndex === 0}
              onClick={() => {
                setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1));
                setLightboxZoom(1);
                setLightboxRotate(0);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition"
            >
              <ChevronLeft size={16} />
              <span>ก่อนหน้า</span>
            </button>

            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium cursor-pointer transition"
            >
              แตะเพื่อปิด
            </button>

            <button
              type="button"
              disabled={lightboxIndex === uniqueExistingImages.length - 1}
              onClick={() => {
                setLightboxIndex((i) => Math.min(uniqueExistingImages.length - 1, (i ?? 0) + 1));
                setLightboxZoom(1);
                setLightboxRotate(0);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition"
            >
              <span>ถัดไป</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskUploadPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans text-xs selection:bg-emerald-100 selection:text-emerald-900">
      <main className="w-full max-w-lg mx-auto px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-24">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Loader2 size={28} className="animate-spin text-[#0b3531]" />
            </div>
          }
        >
          <TaskUploadContent />
        </Suspense>
      </main>
    </div>
  );
}
