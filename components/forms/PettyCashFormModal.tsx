"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Save,
  Wallet,
  X
} from "lucide-react";
import { TABLES } from "@/lib/config";
import type { FieldSchema, SheetRow } from "@/lib/types";
import type { FormModalProps, FormPayload, OpenFormDetail } from "./form-types";
import { prefetchFormSchema, clearFormSchemaCache } from "./form-types";
import { MemoizedFormField } from "./form-field";
import { compressImageFiles } from "@/lib/utils/image-compressor";
import {
  applyLocalFormulas,
  applyRefFill,
  getFieldClassName,
  getInitialStringValues,
  getRowStringValues,
  isFieldVisible,
  sanitizeValuesForSubmit,
  validateVisibleRequiredFields
} from "./form-helpers";

export function PettyCashFormModal({
  form,
  tableName = TABLES.PETTY_CASH,
  title = "เปิดเงินสดย่อย (เบิกเงินล่วงหน้า)",
  buttonLabel = "เปิดเงินสดย่อย",
  submitPath = "/api/rows",
  openEventName = "open-petty-cash-form",
  hideLauncher = false,
  buttonClassName,
  buttonIcon,
}: FormModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<FormPayload | null>(form || null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [attachedFilesByField, setAttachedFilesByField] = useState<Record<string, File[]>>({});
  const [editSheetRow, setEditSheetRow] = useState<string | number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showPCProject, setShowPCProject] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const resolvedTableName = activeForm?.tableName || tableName || TABLES.PETTY_CASH;
  const isEditing = editSheetRow !== null && editSheetRow !== undefined;

  // Prefetch schema on mount
  useEffect(() => {
    if (!activeForm && resolvedTableName) {
      prefetchFormSchema(resolvedTableName).then(loaded => {
        if (loaded) setActiveForm(loaded);
      });
    }
  }, [activeForm, resolvedTableName]);

  // Sync prop form updates
  useEffect(() => {
    if (form) {
      setActiveForm(form);
    }
  }, [form]);

  // Populate form values from detail
  function populateFormValues(targetForm: FormPayload, detail?: OpenFormDetail) {
    const nextValues = detail?.row
      ? getRowStringValues(targetForm, detail.row)
      : getInitialStringValues(targetForm);

    targetForm.schema.filter(f => f.type === "Ref" && f.refFill).forEach(field => {
      const refVal = nextValues[field.name];
      if (refVal) {
        applyRefFill(nextValues, field, targetForm, refVal);
      }
    });

    applyLocalFormulas(nextValues, targetForm.tableName);
    setError("");
    setSuccessMessage("");

    const isExplicitNew = Boolean(detail?.isNew);
    const targetRowKey = isExplicitNew
      ? null
      : (detail?.row?.id_petty_cash ?? detail?.row?.id ?? detail?.sheetRow ?? detail?.row?._sheetRow);

    setEditSheetRow(!isExplicitNew && detail?.row ? (targetRowKey ?? 1) : null);
    setValues(nextValues);
    setAttachedFilesByField({});
    setResetKey(k => k + 1);
  }

  function handleOpen(detail?: OpenFormDetail) {
    setError("");
    setSuccessMessage("");

    // Auto-show project field if editing a row that already has project
    const editRowHasProject = !!(detail?.row?.["ID Project"] || detail?.row?.["id_project"]);
    setShowPCProject(editRowHasProject);

    if (detail?.row && !detail?.isNew && activeForm) {
      populateFormValues(activeForm, detail);
      setOpen(true);
      prefetchFormSchema(resolvedTableName, true).then(fresh => {
        if (fresh) setActiveForm(fresh);
      });
      return;
    }

    setOpen(true);
    if (activeForm) {
      populateFormValues(activeForm, detail);
    } else {
      setLoadingSchema(true);
    }

    prefetchFormSchema(resolvedTableName, true).then(loaded => {
      setLoadingSchema(false);
      if (loaded) {
        setActiveForm(loaded);
        if (!detail?.row || detail?.isNew) {
          populateFormValues(loaded, detail);
        }
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setError("");
    setSuccessMessage("");
  }

  // Listen to open CustomEvent
  useEffect(() => {
    if (!openEventName) return;
    const handleEvent = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as OpenFormDetail) : undefined;
      handleOpen(detail);
    };
    window.addEventListener(openEventName, handleEvent);
    return () => window.removeEventListener(openEventName, handleEvent);
  }, [openEventName, activeForm, resolvedTableName]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving]);

  function updateValue(field: FieldSchema, nextValue: string) {
    setValues(prev => {
      const next = { ...prev, [field.name]: nextValue };
      if (activeForm) {
        applyRefFill(next, field, activeForm, nextValue);
      }
      applyLocalFormulas(next, resolvedTableName);
      return next;
    });
  }

  // Visible fields calculation
  const visibleFields = useMemo(() => {
    if (!activeForm?.schema) return [];
    return activeForm.schema.filter(field => {
      if (field.type === "Hidden") return false;
      // ซ่อนฟิลด์โครงการจนกว่าจะกด toggle แสดง
      if (!showPCProject && (field.name === "ID Project" || field.name === "ชื่อ Project")) {
        return false;
      }
      // ตอนสร้างเริ่มต้น (!isEditing) แสดงเฉพาะฟิลด์ที่จำเป็น (ซ่อนยอดเคลียร์แล้ว, ยอดคงเหลือ, สถานะ)
      if (!isEditing) {
        if (field.name === "ยอดเคลียร์แล้ว" || field.name === "ยอดคงเหลือ" || field.name === "สถานะ") {
          return false;
        }
      }
      return isFieldVisible(field, values, activeForm);
    });
  }, [activeForm, values, showPCProject, isEditing]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeForm) return;

    const validationError = validateVisibleRequiredFields(values, activeForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    const submitValues = sanitizeValuesForSubmit(values, activeForm);
    if (!submitValues["สถานะ"]) {
      submitValues["สถานะ"] = "เปิดแล้ว";
    }
    if (!submitValues["ยอดเคลียร์แล้ว"]) {
      submitValues["ยอดเคลียร์แล้ว"] = "0";
    }
    if (!submitValues["ยอดคงเหลือ"] && submitValues["จำนวนเงิน"]) {
      submitValues["ยอดคงเหลือ"] = submitValues["จำนวนเงิน"];
    }
    if (editSheetRow !== null && editSheetRow !== undefined) {
      submitValues.id = String(editSheetRow);
      submitValues.sheetRow = String(editSheetRow);
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const hasFiles = Object.values(attachedFilesByField).some(files => files.length > 0);
      let response: Response;

      if (hasFiles) {
        const formData = new FormData();
        formData.set("tableName", resolvedTableName);
        if (editSheetRow !== null && editSheetRow !== undefined) {
          formData.set("id", String(editSheetRow));
          formData.set("sheetRow", String(editSheetRow));
        }
        Object.entries(submitValues).forEach(([k, v]) => {
          if (v !== undefined && v !== null) formData.set(k, String(v));
        });
        for (const [fieldName, files] of Object.entries(attachedFilesByField)) {
          const compressed = await compressImageFiles(files, 1600, 0.8);
          compressed.forEach(file => {
            if (file && file.size > 0) formData.append(fieldName, file);
          });
        }
        response = await fetch(submitPath, {
          method: isEditing ? "PATCH" : "POST",
          body: formData,
        });
      } else {
        response = await fetch(submitPath, {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: resolvedTableName,
            row: submitValues,
            values: submitValues,
            sheetRow: editSheetRow ?? undefined,
          }),
        });
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      clearFormSchemaCache();
      setSuccessMessage(isEditing ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "เปิดเงินสดย่อยเรียบร้อยแล้ว");

      window.dispatchEvent(new CustomEvent("schema-cache-invalidated", { detail: { tableName: resolvedTableName } }));
      window.dispatchEvent(new CustomEvent("refresh-data", { detail: { tableName: resolvedTableName } }));
      window.dispatchEvent(new CustomEvent(isEditing ? "petty-cash-updated" : "petty-cash-created", { detail: result.row || submitValues }));

      router.refresh();

      setTimeout(() => {
        setOpen(false);
      }, 700);
    } catch (err: unknown) {
      console.error("Petty cash save error:", err);
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {!hideLauncher && (
        <button
          type="button"
          onClick={() => handleOpen()}
          className={buttonClassName || "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition cursor-pointer"}
        >
          {buttonIcon || <Wallet size={15} />}
          <span>{buttonLabel}</span>
        </button>
      )}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
              aria-labelledby="petty-cash-modal-title"
            >
              <div
                className="fixed inset-0"
                onClick={saving ? undefined : handleClose}
              />

              <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Wallet size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 id="petty-cash-modal-title" className="text-sm font-bold text-slate-900 truncate">
                        {isEditing ? `แก้ไข: ${title}` : title}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-normal">
                        {isEditing ? "แก้ไขข้อมูลรายการเงินสดย่อย" : "กรอกข้อมูลเพื่อขอเบิกเงินสดย่อยล่วงหน้า"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleClose}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </header>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Alerts */}
                    {error && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                        <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                        <span className="flex-1 font-medium">{error}</span>
                      </div>
                    )}
                    {successMessage && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span className="flex-1 font-medium">{successMessage}</span>
                      </div>
                    )}

                    {loadingSchema || !activeForm ? (
                      <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                        <span>กำลังโหลดแบบฟอร์ม...</span>
                      </div>
                    ) : (
                      <fieldset disabled={saving} className="space-y-4">
                        {/* Toggle โครงการ */}
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="text-xs font-semibold text-slate-700">ข้อมูลเงินสดย่อย</span>
                          {showPCProject ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowPCProject(false);
                                setValues(prev => ({ ...prev, "ID Project": "", "ชื่อ Project": "" }));
                              }}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-300 bg-slate-50 hover:bg-rose-50 px-2 py-0.5 rounded-md transition cursor-pointer"
                            >
                              <X size={11} /> ซ่อนโครงการ
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowPCProject(true)}
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 border border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 px-2 py-0.5 rounded-md transition cursor-pointer"
                            >
                              <Plus size={11} /> กำหนดโครงการ (ถ้ามี)
                            </button>
                          )}
                        </div>

                        {/* Fields Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {visibleFields.map(field => (
                            <div
                              key={field.name}
                              className={`${getFieldClassName(field, values)} min-w-0 w-full overflow-hidden`}
                            >
                              <MemoizedFormField
                                field={field}
                                activeForm={activeForm}
                                value={values[field.name] || ""}
                                currentValues={values}
                                isEditing={isEditing}
                                onValueChange={val => updateValue(field, val)}
                                resetKey={resetKey}
                                attachedFiles={attachedFilesByField[field.name] || []}
                                onAttachedFilesChange={files => setAttachedFilesByField(prev => ({ ...prev, [field.name]: files }))}
                              />
                            </div>
                          ))}
                        </div>
                      </fieldset>
                    )}
                  </div>

                  {/* Footer */}
                  <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50/70 shrink-0">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleClose}
                      className="h-9 px-4 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/60 border border-slate-300 bg-white transition cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={saving || loadingSchema || !activeForm}
                      className="h-9 inline-flex items-center justify-center gap-1.5 px-5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 transition cursor-pointer shadow-xs active:scale-[0.99]"
                    >
                      {saving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          <span>{isEditing ? "บันทึกการแก้ไข" : "บันทึกรายการ"}</span>
                        </>
                      )}
                    </button>
                  </footer>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

// Default export alias
export default PettyCashFormModal;
