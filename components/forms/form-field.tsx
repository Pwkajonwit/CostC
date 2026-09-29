"use client";

import {
  memo,
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  Fragment,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  HardHat,
  Image as ImageIcon,
  ImagePlus,
  Package,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { TABLES } from "@/lib/config";
import type { FieldSchema, RefOption, SheetRow } from "@/lib/types";
import type { FormPayload } from "./form-types";
import { compressImageFiles } from "@/lib/utils/image-compressor";
import { imagePreviewUrl } from "@/components/bills/BillImageThumbnail";
import { getTodayDateIso } from "@/lib/utils/dates";
import {
  splitEnumListValue,
  getFieldOptions,
  getOptionButtonStyle,
  getFieldOptionLabel,
  customChoiceConfig,
  toDateInputValue,
  normalizeBillDateInput,
  toNumber,
  isFieldRequired,
  getFieldClassName,
  getFieldLabel,
  isValidImgUrl,
  optionLabel,
  optionSearchText,
  isCitizenOrTaxIdField,
  isBankAccountField,
  isPhoneField,
  formatCitizenOrTaxId,
  formatBankAccount,
  formatPhoneNumber,
} from "./form-helpers";

function ImageFileFieldInput({
  field,
  value,
  readOnly,
  onChange,
  attachedFiles = [],
  onAttachedFilesChange,
  resetKey = 0
}: {
  field: FieldSchema;
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  attachedFiles?: File[];
  onAttachedFilesChange: (files: File[]) => void;
  resetKey?: number;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Existing image URLs from database (comma-separated string)
  const existingUrls = value
    ? value
        .split(/\s*,\s*|\s*;\s*|\n+/)
        .map(u => u.trim())
        .filter(Boolean)
    : [];

  // Local object URLs for previewing newly attached files
  const [filePreviews, setFilePreviews] = useState<Array<{ file: File; url: string }>>([]);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    const previews = attachedFiles.map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));
    setFilePreviews(previews);

    return () => {
      previews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [attachedFiles, resetKey]);

  const handleFilesAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []);
    if (!rawFiles.length) return;
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    setCompressing(true);
    try {
      const compressed = await compressImageFiles(rawFiles, 1920, 0.82);
      onAttachedFilesChange([...attachedFiles, ...compressed]);
    } catch (err) {
      console.warn("Image compression failed, using original:", err);
      onAttachedFilesChange([...attachedFiles, ...rawFiles]);
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveExisting = (indexToRemove: number) => {
    const updated = existingUrls.filter((_, idx) => idx !== indexToRemove);
    onChange(updated.join(", "));
  };

  const handleRemoveNewFile = (indexToRemove: number) => {
    const updated = attachedFiles.filter((_, idx) => idx !== indexToRemove);
    onAttachedFilesChange(updated);
  };

  const totalImageCount = existingUrls.length + attachedFiles.length;

  return (
    <div className="space-y-2.5">
      {/* 1. Direct Native Camera Input (Opens Camera on Android & iOS) */}
      <input
        ref={cameraInputRef}
        type="file"
        name={`${field.name}_camera`}
        accept="image/*"
        capture="environment"
        disabled={readOnly || compressing}
        onChange={handleFilesAdded}
        className="hidden"
      />

      {/* 2. Media / Photo Gallery Input (Allows multi-image picking) */}
      <input
        ref={galleryInputRef}
        type="file"
        name={`${field.name}_gallery`}
        accept="image/*"
        multiple
        disabled={readOnly || compressing}
        onChange={handleFilesAdded}
        className="hidden"
      />

      {compressing ? (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-center gap-2 animate-pulse">
          <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
          <span>กำลังปรับขนาดและบีบอัดรูปภาพให้เหมาะสม...</span>
        </div>
      ) : null}

      {/* Grid of All Photos (Existing + Newly Attached) */}
      {totalImageCount > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 font-normal">
            <span className="flex items-center gap-1.5">
              <Camera size={14} className="text-slate-500" />
              <span>รูปภาพที่แนบทั้งหมด ({totalImageCount} รูป)</span>
            </span>
            {existingUrls.length > 0 && attachedFiles.length > 0 ? (
              <span className="text-[11px] text-slate-400 font-normal">
                (รูปเดิม {existingUrls.length} รูป + รูปใหม่ {attachedFiles.length} รูป)
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
            {/* 1. Existing Uploaded Images */}
            {existingUrls.map((url, idx) => {
              const preview = imagePreviewUrl(url);
              return (
                <div
                  key={`existing-img-${url}-${idx}`}
                  className="group relative aspect-square rounded-md overflow-hidden border border-slate-300 bg-slate-100 flex flex-col justify-between"
                >
                  <img
                    src={preview || url}
                    alt={`รูปเดิม ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] px-1 py-0.2 rounded font-mono">
                    เดิม #{idx + 1}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExisting(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center transition cursor-pointer active:scale-90"
                      title="ลบรูปนี้"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* 2. Newly Attached Files (Pending Upload) */}
            {filePreviews.map(({ file, url }, idx) => (
              <div
                key={`new-file-${file.name}-${idx}`}
                className="group relative aspect-square rounded-md overflow-hidden border border-sky-400 bg-sky-50 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-100"
              >
                <img
                  src={url}
                  alt={`รูปใหม่ ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1 bg-sky-700 text-white text-[9px] px-1 py-0.2 rounded font-normal">
                  ใหม่ #{idx + 1}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveNewFile(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center transition cursor-pointer active:scale-90"
                    title="ลบรูปนี้"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}

            {/* Quick Action Tiles inside the grid */}
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="aspect-square rounded-md border-2 border-dashed border-slate-300 hover:border-slate-800 hover:bg-white bg-slate-100/60 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-900 transition cursor-pointer active:scale-95"
                  title="ถ่ายรูปจากกล้อง"
                >
                  <Camera size={16} />
                  <span className="text-[10px] text-center leading-tight font-normal">ถ่ายรูป</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="aspect-square rounded-md border-2 border-dashed border-slate-300 hover:border-slate-800 hover:bg-white bg-slate-100/60 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-900 transition cursor-pointer active:scale-95"
                  title="เลือกรูปเพิ่มจากเครื่อง"
                >
                  <Plus size={16} />
                  <span className="text-[10px] text-center leading-tight font-normal">แนบเพิ่ม</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Main Upload Buttons (Shown when no images attached yet) */}
      {!readOnly && totalImageCount === 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 text-slate-800 shadow-2xs group"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors">
              <Camera size={18} />
            </div>
            <span className="text-xs font-normal">ถ่ายรูปจากกล้อง</span>
            <span className="text-[10px] text-slate-400 font-normal">เปิดกล้องถ่ายสด</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 text-slate-800 shadow-2xs group"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors">
              <ImagePlus size={18} />
            </div>
            <span className="text-xs font-normal">เลือกรูปจากเครื่อง</span>
            <span className="text-[10px] text-slate-400 font-normal">เลือกรูปเดี่ยว/หลายรูป</span>
          </button>
        </div>
      )}
    </div>
  );
}

type EnumListFieldInputProps = {
  field: FieldSchema;
  value: string;
  options: RefOption[];
  readOnly: boolean;
  onChange: (value: string) => void;
  enumSearchValue: string;
  onEnumSearchChange: (value: string) => void;
};

function EnumListFieldInput({
  field,
  value,
  options,
  readOnly,
  onChange,
  enumSearchValue,
  onEnumSearchChange,
}: EnumListFieldInputProps) {
  const [draftInput, setDraftInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedValues = useMemo(() => splitEnumListValue(value), [value]);
  const optionValues = useMemo(() => new Set(options.map(option => String(option.value))), [options]);

  const normalizedSearch = enumSearchValue.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    return normalizedSearch
      ? options.filter(option => `${String(option.value)} ${String(option.label)}`.toLowerCase().includes(normalizedSearch))
      : options;
  }, [options, normalizedSearch]);

  const commitTags = useCallback((rawText: string) => {
    if (!rawText) return;
    const tokens = rawText
      .split(/[,，;|\n\r]+/)
      .map(t => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) return;

    // Deduplicate against existing selectedValues
    const existing = new Set(selectedValues);
    const toAdd = tokens.filter(t => !existing.has(t));
    if (toAdd.length > 0) {
      onChange([...selectedValues, ...toAdd].join(", "));
    }
  }, [selectedValues, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // When user types or pastes comma, full-width comma, semicolon, pipe, or newline
    if (/[,，;|\n\r]/.test(val)) {
      commitTags(val);
      setDraftInput("");
    } else {
      setDraftInput(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      e.stopPropagation();
      if (draftInput.trim()) {
        commitTags(draftInput);
        setDraftInput("");
      }
    }
  };

  const handleBlur = () => {
    if (draftInput.trim()) {
      commitTags(draftInput);
      setDraftInput("");
    }
  };

  const handleAddClick = () => {
    if (draftInput.trim()) {
      commitTags(draftInput);
      setDraftInput("");
      inputRef.current?.focus();
    }
  };

  const handleToggleOption = (optValue: string, checked: boolean) => {
    let next: string[];
    if (checked) {
      next = selectedValues.includes(optValue) ? selectedValues : [...selectedValues, optValue];
    } else {
      next = selectedValues.filter(item => item !== optValue);
    }
    onChange(next.join(", "));
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const next = selectedValues.filter(item => item !== tagToRemove);
    onChange(next.join(", "));
  };

  const handleClearAll = () => {
    onChange("");
    setDraftInput("");
  };

  return (
    <div className="space-y-2.5 border border-slate-300 rounded-xl p-3.5 bg-slate-50/70">
      <input type="hidden" name={field.name} value={value} />

      {/* Selected Tags Chips Header */}
      <div className="space-y-1.5 pb-2 border-b border-slate-200/80">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 font-medium flex items-center gap-1.5">
            <span>รายการที่เลือก</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
              {selectedValues.length} {options.length > 0 ? `/ ${options.length}` : "รายการ"}
            </span>
          </span>
          {!readOnly && selectedValues.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] text-slate-400 hover:text-rose-600 transition cursor-pointer"
              title="ล้างรายการที่เลือกทั้งหมด"
            >
              ล้างทั้งหมด
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center" aria-live="polite">
          {selectedValues.length ? (
            selectedValues.map((selectedValue, index) => {
              const isCustom = !optionValues.has(selectedValue);
              return (
                <span
                  key={`${selectedValue}-${index}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all select-none ${
                    isCustom
                      ? "bg-amber-50 text-amber-950 border-amber-300/80 shadow-2xs"
                      : "bg-white text-slate-800 border-slate-300 shadow-2xs"
                  }`}
                >
                  <span>{selectedValue}</span>
                  {isCustom && (
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1 py-0.2 rounded font-normal leading-none">
                      ระบุเอง
                    </span>
                  )}
                  {!readOnly ? (
                    <button
                      type="button"
                      className="hover:text-rose-600 text-slate-400 hover:bg-slate-100 rounded p-0.5 transition cursor-pointer ml-0.5"
                      aria-label={`ลบ ${selectedValue}`}
                      onClick={() => handleRemoveTag(selectedValue)}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </span>
              );
            })
          ) : (
            <span className="text-slate-400 font-normal italic text-xs">ยังไม่ได้เลือกรายการ</span>
          )}
        </div>
      </div>

      {/* Predefined Options Search */}
      <div className="relative">
        <input
          type="text"
          className="w-full h-8.5 pl-8 pr-7 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none rounded-lg text-xs font-normal text-slate-800 placeholder:text-slate-400 transition-all"
          value={enumSearchValue}
          readOnly={readOnly}
          placeholder="ค้นหาตัวเลือกในรายการ..."
          onChange={event => onEnumSearchChange(event.target.value)}
        />
        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
        {enumSearchValue ? (
          <button
            type="button"
            onClick={() => onEnumSearchChange("")}
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
            title="ล้างคำค้นหา"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      {/* Predefined Options Checkbox List */}
      <div
        className="max-h-44 overflow-y-auto space-y-0.5 bg-white p-2 border border-slate-300 rounded-lg"
        role="group"
        aria-label={field.name}
      >
        {filteredOptions.map((option, index) => {
          const optionValue = String(option.value);
          const checked = selectedValues.includes(optionValue);
          return (
            <label
              key={`${optionValue}-${index}`}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition select-none ${
                checked
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "hover:bg-slate-50 text-slate-700 font-normal"
              }`}
            >
              <input
                type="checkbox"
                value={optionValue}
                checked={checked}
                disabled={readOnly}
                className="w-4 h-4 rounded border-slate-300 accent-slate-800 cursor-pointer"
                onChange={event => handleToggleOption(optionValue, event.target.checked)}
              />
              <span className="flex-1 truncate">{String(option.label || option.value)}</span>
            </label>
          );
        })}
        {!filteredOptions.length ? (
          <div className="p-3 text-center text-slate-400 text-xs font-normal">
            ไม่พบตัวเลือกที่ตรงกับคำค้นหา
          </div>
        ) : null}
      </div>

      {/* Add Custom / Multiple Tags Input */}
      {!readOnly && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                className="w-full h-8.5 px-3 bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 focus:outline-none rounded-lg text-xs font-normal text-slate-800 placeholder:text-slate-400 transition-all"
                value={draftInput}
                placeholder="พิมพ์เพิ่มงานอื่น แล้วกด Enter หรือพิมพ์ comma (,) หรือวางหลายรายการ..."
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
              />
              {draftInput ? (
                <button
                  type="button"
                  onClick={() => setDraftInput("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="ล้างข้อความ"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={!draftInput.trim()}
              onClick={handleAddClick}
              className="h-8.5 px-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 active:scale-95 shadow-2xs"
              title="เพิ่มแท็ก"
            >
              <Plus size={14} />
              <span>เพิ่มแท็ก</span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span>💡</span>
              <span>กด <b>Enter</b> หรือพิมพ์ <b>,</b> (comma) เพื่อสร้างแท็กทันที หรือวางหลายรายการคั่นด้วย comma</span>
            </span>
            {draftInput.trim() && (
              <span className="text-emerald-700 font-medium shrink-0">
                พร้อมเพิ่ม: &quot;{draftInput.trim()}&quot;
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VendorExpenseSelector({
  value,
  onChange,
  readOnly,
  isRequired = true,
}: {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  isRequired?: boolean;
}) {
  const current = value === "ผู้รับเหมา" ? "ผู้รับเหมา" : value === "พนักงาน" ? "พนักงาน" : "ร้านค้า";

  return (
    <div className="w-full col-span-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* หมวดค่าของ (1 col) */}
        <div className="col-span-1 space-y-1">
          <div className="flex items-center justify-between min-h-[18px]">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
              หมวดค่าของ {isRequired ? <span className="text-rose-600 font-medium ml-0.5">*</span> : null}
            </label>
            {current === "ร้านค้า" && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70 leading-none">
                เลือกอยู่
              </span>
            )}
          </div>
          <div className="p-1 bg-slate-100/90 rounded-xl border border-slate-200/90 shadow-2xs">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onChange("ร้านค้า")}
              className={`w-full h-9 sm:h-9.5 rounded-lg px-2 text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-[0.98] ${
                current === "ร้านค้า"
                  ? "bg-white text-emerald-950 font-semibold shadow-2xs border border-emerald-600/30 ring-1 ring-emerald-600/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent"
              }`}
            >
              <Package className={`w-4 h-4 stroke-[2] shrink-0 ${current === "ร้านค้า" ? "text-emerald-700" : "text-slate-400"}`} />
              <span className="truncate">ค่าของ</span>
            </button>
          </div>
        </div>

        {/* หมวดค่าแรง (2 cols) */}
        <div className="col-span-1 sm:col-span-2 space-y-1">
          <div className="flex items-center justify-between min-h-[18px]">
            <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <span>หมวดค่าแรง</span>
              <span className="text-slate-400 font-normal text-[11px]">(ผู้รับเหมา / พนักงาน)</span>
            </label>
            {(current === "ผู้รับเหมา" || current === "พนักงาน") && (
              <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200/70 leading-none">
                เลือกอยู่
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200/90 gap-1 sm:gap-1.5 shadow-2xs">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onChange("ผู้รับเหมา")}
              className={`h-9 sm:h-9.5 rounded-lg px-2 text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-[0.98] ${
                current === "ผู้รับเหมา"
                  ? "bg-white text-sky-950 font-semibold shadow-2xs border border-sky-600/30 ring-1 ring-sky-600/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent"
              }`}
            >
              <HardHat className={`w-4 h-4 stroke-[2] shrink-0 ${current === "ผู้รับเหมา" ? "text-sky-700" : "text-slate-400"}`} />
              <span className="truncate">ผู้รับเหมา</span>
            </button>

            <button
              type="button"
              disabled={readOnly}
              onClick={() => onChange("พนักงาน")}
              className={`h-9 sm:h-9.5 rounded-lg px-2 text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-[0.98] ${
                current === "พนักงาน"
                  ? "bg-white text-sky-950 font-semibold shadow-2xs border border-sky-600/30 ring-1 ring-sky-600/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent"
              }`}
            >
              <Users className={`w-4 h-4 stroke-[2] shrink-0 ${current === "พนักงาน" ? "text-sky-700" : "text-slate-400"}`} />
              <span className="truncate">พนักงาน</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderField(
  field: FieldSchema,
  form: FormPayload,
  value: string,
  currentValues: Record<string, string>,
  isEditing: boolean,
  onChange: (value: string) => void,
  enumSearchValue = "",
  onEnumSearchChange: (value: string) => void = () => {},
  resetKey = 0,
  attachedFiles: File[] = [],
  onAttachedFilesChange: (files: File[]) => void = () => {},
  onAddNew?: () => void,
  addNewLabel?: string
) {
  const readOnly = Boolean(field.readonly || (isEditing && field.readonlyOnEdit));
  if (field.type === "Image" || field.type === "File") {
    return (
      <ImageFileFieldInput
        field={field}
        value={value}
        readOnly={readOnly}
        onChange={onChange}
        attachedFiles={attachedFiles}
        onAttachedFilesChange={onAttachedFilesChange}
        resetKey={resetKey}
      />
    );
  }

  if (field.type === "Ref" || field.type === "Enum" || field.type === "EnumList") {
    const options = getFieldOptions(field, form, currentValues);
    if (field.name === "ร้านค้า/ผู้รับเหมา") {
      return (
        <VendorExpenseSelector
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          isRequired={isFieldRequired(field, currentValues, form?.tableName)}
        />
      );
    }
    if (field.type === "Ref" && field.name === "ร้านค้า") {
      return (
        <SearchableRefSelect
          name={field.name}
          value={value}
          options={options}
          readOnly={readOnly}
          placeholder="พิมพ์ชื่อร้านค้า หรือรหัสร้านค้า"
          onChange={onChange}
          onAddNew={onAddNew}
          addNewLabel={addNewLabel}
        />
      );
    }

    if (field.type === "EnumList" && field.inputMode === "buttons") {
      const selectedValues = splitEnumListValue(value);

      function toggleOption(optionValue: string) {
        if (readOnly) return;
        const exists = selectedValues.includes(optionValue);
        const next = exists
          ? selectedValues.filter(v => v !== optionValue)
          : [...selectedValues, optionValue];
        onChange(next.join(", "));
      }

      return (
        <div className="space-y-2">
          <input type="hidden" name={field.name} value={value} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={field.name}>
            {options.map((option, index) => {
              const optionValue = String(option.value);
              const checked = selectedValues.includes(optionValue);
              const buttonStyle = getOptionButtonStyle(field.name, optionValue, checked);
              return (
                <button
                  type="button"
                  key={`${optionValue}-${index}`}
                  disabled={readOnly}
                  onClick={() => toggleOption(optionValue)}
                  className={`h-10 sm:h-9 px-3 sm:px-3.5 rounded-lg border text-xs sm:text-sm font-medium cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 select-none ${buttonStyle}`}
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] shrink-0 border transition-all ${
                    checked
                      ? "bg-white/20 border-white text-white font-bold"
                      : "bg-slate-50 border-slate-300 text-transparent"
                  }`}>
                    ✓
                  </span>
                  <span>{getFieldOptionLabel(field.name, String(option.label || option.value))}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === "EnumList") {
      return (
        <EnumListFieldInput
          field={field}
          value={value}
          options={options}
          readOnly={readOnly}
          onChange={onChange}
          enumSearchValue={enumSearchValue}
          onEnumSearchChange={onEnumSearchChange}
        />
      );
    }

  if (field.inputMode === "buttons") {
    const optionValues = new Set(options.map(option => String(option.value)));
    const customChoice = customChoiceConfig(field.name);
    
    const strVal = String(value ?? "").trim();
    const isZeroOrEmpty = strVal === "" || strVal === "0" || strVal === "0.00";

    const customValue = customChoice && !isZeroOrEmpty && strVal !== customChoice.optionValue && !optionValues.has(strVal) ? strVal : "";
    const choiceValue = customChoice ? (customValue ? customChoice.optionValue : (isZeroOrEmpty ? "" : strVal)) : strVal;
      const isColorField = field.name === "color" || field.name === "COLOR";
      return (
        <div className="space-y-2">
          <div
            className={
              isColorField
                ? "grid grid-cols-3 gap-1.5 w-full"
                : "flex flex-wrap gap-1.5"
            }
            role="radiogroup"
            aria-label={field.name}
          >
            {options.map((option, index) => {
              const optionValue = String(option.value);
              const checked = choiceValue === optionValue;
              const buttonStyle = getOptionButtonStyle(field.name, optionValue, checked);
              return (
                <label
                  className={`${
                    isColorField
                      ? "min-h-[42px] sm:min-h-[38px] px-1 py-1 text-center w-full"
                      : "h-10 sm:h-9 px-3 sm:px-3.5 text-xs sm:text-sm font-medium"
                  } rounded-lg border cursor-pointer transition-all inline-flex items-center justify-center select-none ${buttonStyle}`}
                  key={`${optionValue}-${index}`}
                  title={getFieldOptionLabel(field.name, String(option.label || option.value))}
                  onClick={(e) => {
                    if (readOnly) return;
                    if (checked && !field.required) {
                      e.preventDefault();
                      onChange("");
                    }
                  }}
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={optionValue}
                    checked={checked}
                    disabled={readOnly}
                    className="sr-only"
                    onChange={event => {
                      if (customChoice && event.target.value === customChoice.optionValue) {
                        onChange(customValue || customChoice.optionValue);
                        return;
                      }
                      onChange(event.target.value);
                    }}
                  />
                  {isColorField ? (
                    <div className="flex flex-col items-center justify-center leading-tight min-w-0 w-full">
                      <div className="flex items-center gap-1 justify-center">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          checked
                            ? "bg-white shadow-xs"
                            : optionValue.toLowerCase() === "red"
                              ? "bg-rose-500"
                              : optionValue.toLowerCase() === "green"
                                ? "bg-emerald-500"
                                : "bg-slate-900"
                        }`} />
                        <span className="font-bold text-[11px] sm:text-xs">
                          {optionValue.toLowerCase() === "red" ? "Red" : optionValue.toLowerCase() === "green" ? "Green" : "Black"}
                        </span>
                      </div>
                      <span className={`text-[10px] leading-none mt-0.5 ${checked ? "text-white/90" : "opacity-75"}`}>
                        {optionValue.toLowerCase() === "red" ? "งานใหญ่" : optionValue.toLowerCase() === "green" ? "งานเล็ก" : "เสร็จแล้ว"}
                      </span>
                    </div>
                  ) : (
                    <span>
                      {getFieldOptionLabel(field.name, String(option.label || option.value))}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {customChoice && choiceValue === customChoice.optionValue ? (
            <input
              type="number"
              className="w-full h-10 sm:h-9 px-3 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none rounded-lg text-xs sm:text-sm font-normal text-slate-800 placeholder:text-slate-400"
              value={customValue}
              readOnly={readOnly}
              placeholder={customChoice.placeholder}
              onChange={event => onChange(event.target.value)}
            />
          ) : null}
        </div>
      );
    }

    if (field.type === "Enum") {
      let customPlaceholder = `เลือก${field.name}...`;
      if (field.name === "สินค้า") {
        const vType = currentValues["ร้านค้า/ผู้รับเหมา"];
        if (vType === "ผู้รับเหมา") customPlaceholder = "เลือกประเภทงาน (ผู้รับเหมา)...";
        else if (vType === "พนักงาน") customPlaceholder = "เลือกประเภทงาน (พนักงาน)...";
        else customPlaceholder = "เลือกประเภทสินค้า...";
      }
      return (
        <SearchableRefSelect
          name={field.name}
          value={value}
          options={options}
          readOnly={readOnly}
          placeholder={customPlaceholder}
          onChange={onChange}
          creatable={field.name === "ชื่อเครื่องมือ"}
          onAddNew={onAddNew}
          addNewLabel={addNewLabel}
        />
      );
    }

    const hasFilterParent = Boolean(field.filterBy);
    const filterParentValue = field.filterBy ? String(currentValues[field.filterBy.field] || "").trim() : null;
    const isWaitingForParent = hasFilterParent && !filterParentValue;
    const placeholderText = isWaitingForParent
      ? `กรุณาเลือก ${field.filterBy!.field} ก่อน`
      : `เลือก${field.name}...`;

    return (
      <SearchableRefSelect
        name={field.name}
        value={value}
        options={options}
        readOnly={readOnly || isWaitingForParent}
        placeholder={placeholderText}
        onChange={onChange}
        onAddNew={onAddNew}
        addNewLabel={addNewLabel}
      />
    );
  }

  if (field.type === "LongText") {
    return (
      <textarea
        name={field.name}
        value={value}
        readOnly={readOnly}
        rows={3}
        onChange={event => onChange(event.target.value)}
        className="w-full min-w-0 max-w-full box-border p-3 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none rounded-lg text-xs sm:text-sm font-normal text-slate-800 placeholder:text-slate-400 transition-all resize-y"
      />
    );
  }

  const isDateField = field.type === "Date";
  const isCitizenOrTax = isCitizenOrTaxIdField(field.name);
  const isBankAcc = isBankAccountField(field.name);
  const isPhone = isPhoneField(field.name, field.type);

  const type = isDateField
    ? "date"
    : field.type === "Decimal" || field.type === "Number"
    ? "number"
    : isPhone
    ? "tel"
    : "text";

  const inputMode = isDateField
    ? undefined
    : field.type === "Decimal"
    ? "decimal"
    : field.type === "Number"
    ? "numeric"
    : undefined;

  let placeholder = field.placeholder;

  if (isCitizenOrTax) {
    placeholder = field.placeholder || "X-XXXX-XXXXX-XX-X";
  } else if (isBankAcc) {
    placeholder = field.placeholder || "XXX-X-XXXXX-X";
  } else if (isPhone) {
    placeholder = field.placeholder || "XXX-XXXXXXX";
  }

  // Auto-format value for display if matching formatted field
  let displayValue = value;
  if (isCitizenOrTax) {
    displayValue = formatCitizenOrTaxId(value);
  } else if (isBankAcc) {
    displayValue = formatBankAccount(value);
  } else if (isPhone) {
    displayValue = formatPhoneNumber(value);
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (isDateField) {
      onChange(normalizeBillDateInput(raw));
    } else if (isCitizenOrTax) {
      onChange(formatCitizenOrTaxId(raw));
    } else if (isBankAcc) {
      onChange(formatBankAccount(raw));
    } else if (isPhone) {
      onChange(formatPhoneNumber(raw));
    } else {
      onChange(raw);
    }
  };

  const isProjectTable = form.tableName === TABLES.PROJECT || form.tableName === "Project" || form.tableName === "1. Project รวม";
  const isProjectVatTotal = isProjectTable && field.name === "ยอดรวม vat";
  const workAmount = isProjectTable ? toNumber(currentValues["ยอดงาน"]) : 0;
  const totalVatNum = isProjectTable ? toNumber(value || (workAmount ? workAmount * 1.07 : 0)) : 0;
  const vatAmount = workAmount > 0 ? Math.max(0, Math.round((totalVatNum - workAmount) * 100) / 100) : 0;

  return (
    <div className="space-y-1 w-full min-w-0 max-w-full">
      <input
        type={type}
        name={field.name}
        value={isDateField ? toDateInputValue(value) : displayValue}
        readOnly={readOnly}
        inputMode={inputMode}
        placeholder={placeholder}
        lang={isDateField ? "th-TH" : undefined}
        onChange={handleInputChange}
        className={`w-full min-w-0 max-w-full block box-border h-10 sm:h-9 px-3 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none rounded-lg text-xs sm:text-sm font-normal text-slate-800 placeholder:text-slate-400 transition-all appearance-none cursor-pointer ${
          isCitizenOrTax || isBankAcc ? "font-mono tracking-wide" : ""
        }`}
      />
      {field.name === "เครดิตจ่าย" ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-2xs text-slate-500 font-medium">ปุ่มลัดวันตัดรอบ:</span>
          {[1, 5, 10, 15, 16, 20, 25, 30].map(day => {
            const isSelected = parseInt(String(value || "").replace(/\D/g, ""), 10) === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onChange(String(day))}
                className={`px-2 py-0.5 text-2xs rounded border transition cursor-pointer ${
                  isSelected
                    ? "bg-amber-600 text-white border-amber-700 font-semibold shadow-2xs"
                    : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                }`}
              >
                {day === 30 ? "สิ้นเดือน (30)" : `วันที่ ${day}`}
              </button>
            );
          })}
        </div>
      ) : null}
      {isProjectVatTotal && workAmount > 0 ? (
        <div className="flex items-center justify-between text-[11px] bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
          <span>ภาษี VAT 7%: <strong className="font-semibold text-emerald-700">฿{vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
          <span className="text-slate-500 text-[10px]">(ยอดงาน ฿{workAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} + VAT ฿{vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })})</span>
        </div>
      ) : null}
      {field.name === "จำกัดยอด/ปี" ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-2xs text-slate-500 font-medium">ปุ่มลัดโควตา:</span>
          {currentValues["ประเภท"] === "นิติบุคคล" ? (
            <>
              {[2_000_000, 3_000_000, 5_000_000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => onChange(String(amt))}
                  className={`px-2 py-0.5 text-2xs rounded border transition cursor-pointer ${
                    toNumber(value) === amt
                      ? "bg-purple-600 text-white border-purple-700 font-semibold shadow-2xs"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  {(amt / 1_000_000)} ล้าน
                </button>
              ))}
            </>
          ) : (
            <>
              {[1_200_000, 1_500_000, 1_800_000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => onChange(String(amt))}
                  className={`px-2 py-0.5 text-2xs rounded border transition cursor-pointer ${
                    toNumber(value) === amt
                      ? "bg-blue-600 text-white border-blue-700 font-semibold shadow-2xs"
                      : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  {(amt / 1_000_000)} ล้าน
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchableRefSelect({
  name,
  value,
  options,
  readOnly,
  placeholder,
  onChange,
  creatable = false,
  onAddNew,
  addNewLabel
}: {
  name: string;
  value: string;
  options: RefOption[];
  readOnly: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  creatable?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
}) {
  const selectedOption = value ? options.find(option =>
    String(option.value) === value ||
    String(option.label) === value ||
    (option.row && (
      String(option.row.id) === value ||
      String(option.row.id_Conwork) === value ||
      String(option.row.id_store) === value ||
      String(option.row["ชื่อร้านค้า"]) === value ||
      String(option.row.id_Contractor) === value ||
      String(option.row.id_bank) === value ||
      String(option.row["ชื่อธนาคาร"]) === value ||
      String(option.row.name) === value ||
      String(option.row["ชื่อเล่น"]) === value ||
      String(option.row["ผู้รับเหมา"]) === value ||
      String(option.row["ชื่อ-นามสกุล"]) === value ||
      Object.values(option.row).some(v => v !== null && v !== undefined && String(v).trim() !== "" && String(v) === value)
    ))
  ) : undefined;

  const rawLabel = selectedOption ? optionLabel(selectedOption, name) : value;
  const selectedLabel = (name === "id_Contractor" || name === "id_contractor" || name === "ช่าง") && rawLabel.includes(" - ")
    ? rawLabel.split(" - ").slice(1).join(" - ").trim() || rawLabel
    : rawLabel;
  const selectedImgUrl = (selectedOption?.row?.image || selectedOption?.row?.image_url || "") as string;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [brokenImg, setBrokenImg] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile screen width (< 640px)
  useEffect(() => {
    function checkMobile() {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 640);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setBrokenImg(false);
  }, [selectedImgUrl]);

  // Filter options based on search text
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter(option => optionSearchText(option, name).includes(normalizedSearch))
    : options;

  function handleOpen() {
    if (readOnly) return;
    setSearch("");
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const fitsBelow = window.innerHeight - rect.bottom >= 220;
      setMenuPos({
        top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - 248),
        left: rect.left,
        width: rect.width,
      });
    }
    setOpen(true);
  }

  function handleSelect(option: RefOption) {
    onChange(String(option.value));
    setOpen(false);
    setSearch("");
  }

  function handleCreateCustom() {
    const trimmed = search.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false);
    setSearch("");
  }

  // Check if search text exactly matches any existing option
  const searchMatchesExisting = normalizedSearch
    ? options.some(opt => optionSearchText(opt, name).includes(normalizedSearch) && (
        String(opt.value).toLowerCase() === normalizedSearch ||
        String(opt.label || "").toLowerCase() === normalizedSearch
      ))
    : true;
  const showCreateOption = creatable && normalizedSearch && !searchMatchesExisting;

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setSearch("");
  }

  const showSelectedImg = isValidImgUrl(selectedImgUrl) && !brokenImg;
  const hasValue = Boolean(value && selectedLabel);

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <input type="hidden" name={name} value={value} />

      {/* Standardized Trigger Box */}
      <div
        ref={triggerRef}
        onClick={handleOpen}
        className={`w-full min-w-0 max-w-full box-border h-10 sm:h-9 px-3 bg-white border rounded-lg text-xs sm:text-sm font-normal flex items-center justify-between gap-2 transition-all select-none ${
          readOnly
            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
            : open
            ? "border-slate-800 ring-2 ring-slate-800/10 cursor-pointer"
            : "border-slate-300 hover:border-slate-400 text-slate-800 cursor-pointer active:bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {showSelectedImg ? (
            <img
              src={selectedImgUrl}
              alt=""
              className="w-5 h-5 rounded object-cover border border-slate-200 shrink-0"
              onError={() => setBrokenImg(true)}
            />
          ) : null}
          <span className={`truncate ${hasValue ? "text-slate-800 font-normal" : "text-slate-400 font-normal"}`}>
            {hasValue ? selectedLabel : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {!readOnly && hasValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="w-5 h-5 rounded-full hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              title="ล้างค่า"
            >
              <X size={12} />
            </button>
          ) : null}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${open ? "rotate-180 text-slate-700" : "text-slate-400"}`}
          />
        </div>
      </div>

      {/* Overlay & Dropdown / Bottom Sheet Menu */}
      {open && !readOnly && typeof document !== "undefined"
        ? createPortal(
            isMobile ? (
              /* MOBILE BOTTOM SHEET */
              <div
                className="fixed inset-0 z-[99999] bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
                onClick={() => setOpen(false)}
              >
                <div
                  className="bg-white rounded-t-2xl max-h-[82vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Top drag handle */}
                  <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1" />

                  {/* Mobile Header */}
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-800">
                      {placeholder.replace(/\.\.\.$/, "") || `เลือก${name}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Search bar inside sheet (if > 3 options) */}
                  {options.length > 3 ? (
                    <div className="px-3 pt-2.5 pb-1">
                      <div className="relative">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder={`พิมพ์ค้นหา${placeholder.replace(/^เลือก/, "").replace(/\.\.\.$/, "")}...`}
                          className="w-full h-10 pl-9 pr-8 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 focus:outline-none transition-all"
                        />
                        <Search size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                        {search ? (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2.5 top-2.5 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition"
                          >
                            <X size={11} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Quick Add Button if provided */}
                  {onAddNew ? (
                    <div className="px-3 pt-1 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onAddNew();
                        }}
                        className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-[0.98]"
                      >
                        <Plus size={14} className="stroke-[2.5]" />
                        <span>{addNewLabel || "เพิ่มข้อมูลใหม่"}</span>
                      </button>
                    </div>
                  ) : null}

                  {/* Scrollable list */}
                  <div className="flex-1 overflow-y-auto px-2 py-2 divide-y divide-slate-100 space-y-0.5">
                    {filteredOptions.length ? (
                      filteredOptions.map((option, index) => {
                        const optionValue = String(option.value);
                        const rawImg = option.row?.image || option.row?.image_url || "";
                        const imgUrl = isValidImgUrl(typeof rawImg === "string" ? rawImg.trim() : "");
                        const isActive = optionValue === value;
                        const label = optionLabel(option, name);
                        return (
                          <button
                            key={`${optionValue}-${index}`}
                            type="button"
                            onClick={() => handleSelect(option)}
                            className={`w-full min-h-[46px] py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99] ${
                              isActive
                                ? "bg-slate-100 text-slate-900 font-semibold"
                                : "hover:bg-slate-50 text-slate-800 font-normal"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : null}
                              <span className="text-xs sm:text-sm truncate">{label}</span>
                            </div>
                            {isActive ? (
                              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                                <Check size={12} />
                                <span>เลือกอยู่</span>
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    ) : !showCreateOption ? (
                      <div className="p-6 text-center text-slate-400 text-xs space-y-2">
                        <div>🔍 ไม่พบข้อมูลที่ตรงกับคำค้นหา</div>
                        {onAddNew ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onAddNew();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer shadow-2xs"
                          >
                            <Plus size={13} className="stroke-[2.5]" />
                            <span>{addNewLabel || "เพิ่มข้อมูลใหม่"}</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {showCreateOption ? (
                      <button
                        type="button"
                        onClick={handleCreateCustom}
                        className="w-full min-h-[46px] py-2.5 px-3 rounded-xl flex items-center gap-2.5 text-left transition cursor-pointer active:scale-[0.99] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-200 mt-1"
                      >
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 text-sm">＋</span>
                        <span className="text-xs sm:text-sm truncate">ใช้ &quot;{search.trim()}&quot;</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              /* DESKTOP FLOATING DROPDOWN */
              <div
                className="fixed inset-0 z-[9999]"
                onClick={() => setOpen(false)}
              >
                <div
                  className="bg-white border border-slate-300 rounded-xl shadow-2xl max-h-64 overflow-y-auto p-1.5 font-sans animate-in fade-in zoom-in-95 duration-100 flex flex-col"
                  style={{
                    position: "fixed",
                    top: menuPos?.top ?? 0,
                    left: menuPos?.left ?? 0,
                    width: menuPos?.width ?? 280,
                    zIndex: 99999,
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {options.length > 5 ? (
                    <div className="p-1 pb-1.5 border-b border-slate-100">
                      <div className="relative">
                        <input
                          ref={searchInputRef}
                          autoFocus
                          type="text"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="พิมพ์ค้นหา..."
                          className="w-full h-8 pl-7 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-slate-800 focus:outline-none transition-all"
                        />
                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                        {search ? (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                          >
                            <X size={12} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {onAddNew ? (
                    <div className="p-1 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onAddNew();
                        }}
                        className="w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-[0.98]"
                      >
                        <Plus size={13} className="stroke-[2.5]" />
                        <span>{addNewLabel || "เพิ่มข้อมูลใหม่"}</span>
                      </button>
                    </div>
                  ) : null}

                  <div className="overflow-y-auto max-h-52 space-y-0.5 pt-1">
                    {filteredOptions.length ? (
                      filteredOptions.map((option, index) => {
                        const optionValue = String(option.value);
                        const rawImg = option.row?.image || option.row?.image_url || "";
                        const imgUrl = isValidImgUrl(typeof rawImg === "string" ? rawImg.trim() : "");
                        const isActive = optionValue === value;
                        return (
                          <DropdownOption
                            key={`${optionValue}-${index}`}
                            option={option}
                            fieldName={name}
                            optionValue={optionValue}
                            imgUrl={imgUrl}
                            isActive={isActive}
                            onSelect={handleSelect}
                          />
                        );
                      })
                    ) : !showCreateOption ? (
                      <div className="p-3 text-center text-slate-400 text-xs font-normal space-y-2">
                        <div>ไม่พบข้อมูล</div>
                        {onAddNew ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onAddNew();
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer shadow-2xs"
                          >
                            <Plus size={12} className="stroke-[2.5]" />
                            <span>{addNewLabel || "เพิ่มข้อมูลใหม่"}</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {showCreateOption ? (
                      <button
                        type="button"
                        onClick={handleCreateCustom}
                        className="w-full px-2.5 py-2 text-left text-xs font-medium flex items-center gap-2 rounded-lg cursor-pointer transition-colors bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 mt-1"
                      >
                        <span className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 text-[11px]">＋</span>
                        <span className="truncate">ใช้ &quot;{search.trim()}&quot;</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ),
            document.body
          )
        : null}
    </div>
  );
}

function DropdownOption({
  option, fieldName, optionValue, imgUrl, isActive, onSelect
}: {
  option: RefOption;
  fieldName: string;
  optionValue: string;
  imgUrl: string;
  isActive: boolean;
  onSelect: (o: RefOption) => void;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = imgUrl && !broken;
  return (
    <button
      type="button"
      className={`w-full px-2.5 py-1.5 text-left text-xs font-normal flex items-center justify-between rounded-md cursor-pointer transition-colors ${
        isActive
          ? "bg-slate-100 text-slate-900 font-medium"
          : "text-slate-700 hover:bg-slate-100/70 hover:text-slate-900"
      }`}
      role="option"
      aria-selected={isActive}
      onClick={() => onSelect(option)}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showImg ? (
          <img
            src={imgUrl}
            alt=""
            className="w-5 h-5 rounded object-cover border border-slate-200 shrink-0"
            onError={() => setBroken(true)}
          />
        ) : null}
        <span className="truncate text-slate-800 font-normal">{optionLabel(option, fieldName)}</span>
        {fieldName === "ผู้รับเหมา" && option.row && toNumber(option.row["ยอดเงินจ้าง"]) > 0 && (toNumber(option.row["ยอดเงินจ้าง"]) <= toNumber(option.row["ยอดเงินจ่าย"])) ? (
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0 font-medium">ครบสัญญา</span>
        ) : null}
      </div>
      {isActive ? <Check size={14} className="text-emerald-600 shrink-0 ml-1" /> : null}
    </button>
  );
}

type MemoizedFormFieldProps = {
  field: FieldSchema;
  activeForm: FormPayload;
  value: string;
  currentValues: Record<string, string>;
  isEditing: boolean;
  onValueChange: (value: string) => void;
  enumSearchValue?: string;
  onEnumSearchChange?: (value: string) => void;
  resetKey?: number;
  attachedFiles?: File[];
  onAttachedFilesChange?: (files: File[]) => void;
  className?: string;
  labelRight?: React.ReactNode;
  onAddNew?: () => void;
  addNewLabel?: string;
};

const MemoizedFormField = memo(function MemoizedFormField({
  field,
  activeForm,
  value,
  currentValues,
  isEditing,
  onValueChange,
  enumSearchValue = "",
  onEnumSearchChange = () => {},
  resetKey = 0,
  attachedFiles = [],
  onAttachedFilesChange = () => {},
  className,
  labelRight,
  onAddNew,
  addNewLabel,
}: MemoizedFormFieldProps) {
  const isRequired = isFieldRequired(field, currentValues, activeForm?.tableName);

  if (field.name === "ร้านค้า/ผู้รับเหมา") {
    return (
      <div className="col-span-full" key={field.name}>
        {renderField(
          field,
          activeForm,
          value,
          currentValues,
          isEditing,
          onValueChange,
          enumSearchValue,
          onEnumSearchChange,
          resetKey,
          attachedFiles,
          onAttachedFilesChange,
          onAddNew,
          addNewLabel
        )}
      </div>
    );
  }

  return (
    <div className={`${className || getFieldClassName(field, currentValues)} space-y-1 min-w-0 w-full overflow-hidden`} key={field.name}>
      <div className="flex items-center justify-between gap-1">
        <label className="text-xs font-medium text-slate-700 block">
          {getFieldLabel(field, currentValues)}
          {isRequired ? <span className="text-rose-600 font-medium ml-0.5">*</span> : ""}
        </label>
        {labelRight}
      </div>
      {renderField(
        field,
        activeForm,
        value,
        currentValues,
        isEditing,
        onValueChange,
        enumSearchValue,
        onEnumSearchChange,
        resetKey,
        attachedFiles,
        onAttachedFilesChange,
        onAddNew,
        addNewLabel
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.field === next.field &&
    prev.value === next.value &&
    prev.isEditing === next.isEditing &&
    prev.className === next.className &&
    prev.labelRight === next.labelRight &&
    prev.onAddNew === next.onAddNew &&
    prev.addNewLabel === next.addNewLabel &&
    prev.enumSearchValue === next.enumSearchValue &&
    prev.resetKey === next.resetKey &&
    prev.attachedFiles === next.attachedFiles &&
    isFieldRequired(prev.field, prev.currentValues, prev.activeForm?.tableName) ===
      isFieldRequired(next.field, next.currentValues, next.activeForm?.tableName) &&
    prev.currentValues["ร้านค้า/ผู้รับเหมา"] === next.currentValues["ร้านค้า/ผู้รับเหมา"] &&
    prev.currentValues[prev.field.showIf?.column || ""] === next.currentValues[next.field.showIf?.column || ""] &&
    prev.currentValues[prev.field.filterBy?.column || ""] === next.currentValues[next.field.filterBy?.column || ""]
  );
});



export {
  MemoizedFormField,
  renderField,
  SearchableRefSelect,
  DropdownOption,
  VendorExpenseSelector,
  EnumListFieldInput,
  ImageFileFieldInput,
};
export type { MemoizedFormFieldProps };
