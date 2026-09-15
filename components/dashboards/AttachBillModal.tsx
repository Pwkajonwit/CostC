"use client";

import { useState, useEffect, useRef } from "react";
import {
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
  ZoomIn
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import { formatDateDisplay, getTodayDateIso } from "@/lib/utils/dates";
import { isVatActive, parseDeductPercent, parseCreditDays } from "@/lib/project-summary";
import { formatVatDisplay, formatDeductDisplay, formatCreditDisplay } from "@/lib/bills/bill-status";
import { compressImageFiles } from "@/lib/utils/image-compressor";
import { imagePreviewUrl } from "@/components/bills/BillImageThumbnail";
import type { SheetRow } from "@/lib/types";

type AttachBillModalProps = {
  isOpen: boolean;
  onClose: () => void;
  row: SheetRow | null;
  requesterName?: string;
  onSuccess: (updatedRow: SheetRow, message: string) => void;
};

export function AttachBillModal({
  isOpen,
  onClose,
  row,
  requesterName = "",
  onSuccess
}: AttachBillModalProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ file: File; url: string; isPdf: boolean }[]>([]);
  const [markReceived, setMarkReceived] = useState(true);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  // Initialize or reset state when row changes
  useEffect(() => {
    if (!row || !isOpen) {
      setExistingUrls([]);
      setNewFiles([]);
      setFilePreviews([]);
      setError(null);
      setSaving(false);
      setCompressing(false);
      setZoomUrl(null);
      return;
    }

    const rawImage = String(row["รูปถ่ายบิล"] || row.image_url || "").trim();
    const urls = rawImage
      ? rawImage.split(/\s*,\s*|\s*;\s*|\n+/).map((u) => u.trim()).filter(Boolean)
      : [];
    setExistingUrls(urls);
    setNewFiles([]);
    setFilePreviews([]);
    setError(null);

    // Default markReceived to true if not already received
    const isAlreadyReceived = Boolean(row["วันได้บิล"] || row["วันออก 3%"] || row["วันจ่าย"]);
    setMarkReceived(!isAlreadyReceived);
  }, [row, isOpen]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      filePreviews.forEach((p) => {
        if (p.url.startsWith("blob:")) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, [filePreviews]);

  if (!isOpen || !row) return null;

  const billId = String(row["ลำดับ"] || row._sheetRow || "");
  const vendor = String(row["ร้าน/บุคคล"] || "-");
  const project = String(row["ชื่อ Project"] || "-");
  const item = String(row["สินค้า/ทำงาน"] || row["รายการ"] || "-");
  const date = formatDateDisplay(row["ว/ด/ป"]);
  const amount = toNumber(row["ยอดเงิน"]);

  const hasVat = isVatActive(row.vat);
  const hasDeduct = parseDeductPercent(row["หัก"]) > 0;
  const isCompany = String(row["statusค่าแรง"] || "").trim() === "บริษัท";
  const hasCredit = parseCreditDays(row["เครดิต"]) > 0;
  const isAlreadyReceived = Boolean(row["วันได้บิล"] || row["วันออก 3%"] || row["วันจ่าย"]);

  const totalAttachmentsCount = existingUrls.length + newFiles.length;

  async function handleFilesAdded(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (!selectedFiles.length) return;

    setError(null);
    setCompressing(true);

    try {
      // Split images and non-images
      const imageFiles: File[] = [];
      const nonImageFiles: File[] = [];

      selectedFiles.forEach((file) => {
        if (file.type.startsWith("image/")) {
          imageFiles.push(file);
        } else {
          nonImageFiles.push(file);
        }
      });

      // Compress images
      const compressedImages = await compressImageFiles(imageFiles, 1920, 0.82);
      const allNewFiles = [...compressedImages, ...nonImageFiles];

      // Generate preview objects
      const newPreviews = allNewFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isPdf: file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      }));

      setNewFiles((prev) => [...prev, ...allNewFiles]);
      setFilePreviews((prev) => [...prev, ...newPreviews]);
    } catch (err: any) {
      console.warn("File processing error:", err);
      setError("เกิดข้อผิดพลาดในการประมวลผลไฟล์ กรุณาลองใหม่");
    } finally {
      setCompressing(false);
    }
  }

  function handleRemoveExisting(index: number) {
    setExistingUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function handleRemoveNewFile(index: number) {
    const preview = filePreviews[index];
    if (preview && preview.url.startsWith("blob:")) {
      URL.revokeObjectURL(preview.url);
    }
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!row) return;
    const sheetRow = row._sheetRow ?? row.id ?? row["ลำดับ"];
    if (!sheetRow) {
      setError("ไม่พบข้อมูลอ้างอิงของแถวบิลนี้");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const todayStr = getTodayDateIso();
      const formData = new FormData();

      formData.append("tableName", "Data");
      formData.append("sheetRow", String(sheetRow));
      formData.append("ลำดับ", billId);

      // Existing retained image URLs
      const existingString = existingUrls.join(", ");
      formData.append("รูปถ่ายบิล", existingString);

      // Newly attached files (under column "รูปถ่ายบิล")
      newFiles.forEach((file) => {
        formData.append("รูปถ่ายบิล", file);
      });

      // If user chose to mark as received
      if (markReceived) {
        if (hasVat && !row["วันได้บิล"]) {
          formData.append("วันได้บิล", todayStr);
        }
        if (hasDeduct && !row["วันออก 3%"]) {
          formData.append("วันออก 3%", todayStr);
        }
        if (hasCredit && !row["วันจ่าย"]) {
          formData.append("วันจ่าย", todayStr);
        }
        // Fallback if no specific condition was missing
        if (!hasVat && !hasDeduct && !hasCredit) {
          formData.append("วันได้บิล", todayStr);
        }
      }

      const res = await fetch("/api/rows", {
        method: "PATCH",
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถบันทึกเอกสารแนบได้");
      }

      // Dispatch global events for instant reactivity
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("bills-data-updated", {
            detail: { row: data.row }
          })
        );
        window.dispatchEvent(
          new CustomEvent("data-updated", {
            detail: { tableName: "Data", row: data.row }
          })
        );
      }

      const successMsg = markReceived
        ? newFiles.length > 0
          ? `แนบเอกสารและบันทึกได้รับบิล #${billId} เรียบร้อยแล้ว`
          : `บันทึกได้รับบิล #${billId} เรียบร้อยแล้ว`
        : `บันทึกเอกสารแนบบิล #${billId} เรียบร้อยแล้ว`;
      onSuccess(data.row || row, successMsg);
      onClose();
    } catch (err: any) {
      console.error("Failed to attach bill document:", err);
      setError(err?.message || "เกิดข้อผิดพลาดในการบันทึกเอกสารแนบ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="relative w-full max-w-[560px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200 text-slate-800 max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                <Paperclip size={16} />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    บันทึกสถานะได้บิล & แนบเอกสาร
                  </h3>
                  <span className="text-xs bg-slate-900 text-white font-mono px-1.5 py-0.5 rounded">
                    #{billId}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-none mt-0.5">
                  แนบรูปถ่ายใบเสร็จ หรือกดบันทึกอัปเดตสถานะได้บิลแล้วทันที
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
              title="ปิด (Esc)"
            >
              <X size={15} />
            </button>
          </header>

          {/* Hidden Inputs for Direct Camera & File Gallery */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={saving || compressing}
            onChange={handleFilesAdded}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            disabled={saving || compressing}
            onChange={handleFilesAdded}
            className="hidden"
          />

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Bill Summary Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-900 text-sm block">
                    {project}
                  </span>
                  <span className="text-slate-600">
                    ร้านค้า/บุคคล: <strong className="text-slate-800">{vendor}</strong>
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-slate-400 block">ยอดเงินบิล</span>
                  <span className="text-sm font-bold text-slate-900">
                    {money(amount)} <span className="font-normal text-slate-400">฿</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span>ผู้เบิก: <strong className="text-slate-700">{requesterName || row["ผู้เบิก"] || "-"}</strong></span>
                  <span>•</span>
                  <span>วันที่: <strong className="text-slate-700">{date}</strong></span>
                </div>

                {/* Condition tags */}
                <div className="flex flex-wrap items-center gap-1">
                  {hasVat && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-700 border border-sky-200">
                      {formatVatDisplay(row.vat)}
                    </span>
                  )}
                  {hasDeduct && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                      {formatDeductDisplay(row["หัก"])} {isCompany ? "(บ.)" : "(บุคคล)"}
                    </span>
                  )}
                  {hasCredit && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                      {formatCreditDisplay(row["เครดิต"])}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <X size={14} className="shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Compression Indicator */}
            {compressing && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-center gap-2 animate-pulse">
                <Loader2 size={14} className="animate-spin text-emerald-600" />
                <span>กำลังปรับขนาดและบีบอัดรูปภาพให้เหมาะสม...</span>
              </div>
            )}

            {/* Attachments Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-slate-500" />
                  <span>เอกสารที่แนบ ({totalAttachmentsCount})</span>
                </span>
                {totalAttachmentsCount > 0 && (
                  <span className="text-[11px] text-slate-400">
                    รูปเดิม {existingUrls.length} • รูปใหม่ {newFiles.length}
                  </span>
                )}
              </div>

              {/* Grid of Attached Documents */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[120px]">
                {/* 1. Existing Uploaded Files */}
                {existingUrls.map((url, idx) => {
                  const preview = imagePreviewUrl(url);
                  const isPdf = url.toLowerCase().includes(".pdf");

                  return (
                    <div
                      key={`existing-${url}-${idx}`}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-slate-300 bg-white flex flex-col justify-between shadow-2xs"
                    >
                      {isPdf ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-rose-600 bg-rose-50">
                          <FileText size={28} />
                          <span className="text-[10px] text-slate-600 font-medium truncate max-w-full mt-1">
                            เอกสาร PDF
                          </span>
                        </div>
                      ) : (
                        <img
                          src={preview || url}
                          alt={`เอกสารเดิม ${idx + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => setZoomUrl(preview || url)}
                        />
                      )}

                      <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] px-1 py-0.2 rounded font-mono">
                        เดิม #{idx + 1}
                      </div>

                      {/* Action buttons on hover/touch */}
                      <div className="absolute top-1 right-1 flex items-center gap-1">
                        {!isPdf && (
                          <button
                            type="button"
                            onClick={() => setZoomUrl(preview || url)}
                            className="w-5 h-5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full flex items-center justify-center transition cursor-pointer"
                            title="ดูภาพเต็ม"
                          >
                            <ZoomIn size={10} />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRemoveExisting(idx)}
                          className="w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center transition cursor-pointer shadow-xs disabled:opacity-50"
                          title="ลบเอกสารนี้"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 2. Newly Attached Files (Pending Upload) */}
                {filePreviews.map(({ file, url, isPdf }, idx) => (
                  <div
                    key={`new-${file.name}-${idx}`}
                    className="group relative aspect-square rounded-lg overflow-hidden border-2 border-emerald-500 bg-emerald-50/40 flex flex-col justify-between shadow-2xs animate-in zoom-in-95 duration-150"
                  >
                    {isPdf ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-rose-600">
                        <FileText size={28} />
                        <span className="text-[10px] text-slate-600 font-medium truncate max-w-full mt-1">
                          {file.name}
                        </span>
                      </div>
                    ) : (
                      <img
                        src={url}
                        alt={`เอกสารใหม่ ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setZoomUrl(url)}
                      />
                    )}

                    <div className="absolute top-1 left-1 bg-emerald-700 text-white text-[9px] px-1 py-0.2 rounded font-medium">
                      ใหม่ #{idx + 1}
                    </div>

                    <div className="absolute top-1 right-1 flex items-center gap-1">
                      {!isPdf && (
                        <button
                          type="button"
                          onClick={() => setZoomUrl(url)}
                          className="w-5 h-5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full flex items-center justify-center transition cursor-pointer"
                          title="ดูภาพเต็ม"
                        >
                          <ZoomIn size={10} />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleRemoveNewFile(idx)}
                        className="w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center transition cursor-pointer shadow-xs disabled:opacity-50"
                        title="ลบรูปนี้"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Direct Action Add Tiles */}
                <button
                  type="button"
                  disabled={saving || compressing}
                  onClick={() => cameraInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-600 hover:bg-white bg-slate-100/70 flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-emerald-700 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="เปิดกล้องถ่ายรูป"
                >
                  <Camera size={18} />
                  <span className="text-[10px] text-center font-medium leading-tight">ถ่ายรูป</span>
                </button>

                <button
                  type="button"
                  disabled={saving || compressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-600 hover:bg-white bg-slate-100/70 flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-emerald-700 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="เลือกรูปภาพหรือไฟล์ PDF"
                >
                  <Plus size={18} />
                  <span className="text-[10px] text-center font-medium leading-tight">แนบเพิ่ม</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                <span>• รองรับไฟล์รูปภาพ JPG, PNG, HEIC และเอกสาร PDF</span>
                <span>• ปรับขนาดบีบอัดอัตโนมัติ คมชัด รวดเร็ว</span>
              </div>
            </div>

            {/* Option Checkbox: Mark as received */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={markReceived}
                  disabled={saving}
                  onChange={(e) => setMarkReceived(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-emerald-900 block">
                    ทำเครื่องหมายว่า "ได้รับบิล/เอกสารแล้ว" พร้อมกันทันที
                  </span>
                  <p className="text-[11px] text-emerald-700 leading-normal">
                    {isAlreadyReceived
                      ? "บิลนี้เคยได้รับการบันทึกว่าได้รับเอกสารแล้ว (ติ๊กซ้ำเพื่ออัปเดตเป็นวันนี้)"
                      : "ระบบจะบันทึกวันที่ได้รับบิล และย้ายสถานะออกจากรายการค้างติดตาม"}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <footer className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              disabled={saving || compressing}
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>กำลังบันทึกข้อมูล...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>
                    {newFiles.length > 0
                      ? markReceived
                        ? "บันทึกเอกสาร & ได้บิลแล้ว"
                        : "บันทึกเอกสารแนบ"
                      : markReceived
                      ? "อัปเดตได้บิลแล้ว"
                      : "บันทึกการเปลี่ยนแปลง"}
                  </span>
                </>
              )}
            </button>
          </footer>
        </div>
      </div>

      {/* Full Image Zoom Lightbox */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setZoomUrl(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomUrl(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 hover:bg-white text-white hover:text-slate-900 transition"
              title="ปิด"
            >
              <X size={18} />
            </button>
            <img
              src={zoomUrl}
              alt="ดูเอกสารขนาดเต็ม"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
