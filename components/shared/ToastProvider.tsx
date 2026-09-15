"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "warning";
};

type ToastContextType = {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextType | null>(null);

let globalToast: ToastContextType["toast"] = {
  success: (msg) => console.log("Success:", msg),
  error: (msg) => console.error("Error:", msg),
  info: (msg) => console.log("Info:", msg),
  warning: (msg) => console.warn("Warning:", msg),
};

let globalConfirm: ToastContextType["confirm"] = async (opts) => {
  const msg = typeof opts === "string" ? opts : opts.message;
  return typeof window !== "undefined" ? window.confirm(msg) : false;
};

export function showToast(type: ToastType, message: string) {
  if (type === "success") globalToast.success(message);
  else if (type === "error") globalToast.error(message);
  else if (type === "warning") globalToast.warning(message);
  else globalToast.info(message);
}

export function showConfirm(opts: ConfirmOptions | string): Promise<boolean> {
  return globalConfirm(opts);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  function addToast(type: ToastType, message: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function confirm(opts: ConfirmOptions | string): Promise<boolean> {
    const options: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        options: {
          title: options.title || "ยืนยันการดำเนินการ",
          message: options.message,
          confirmText: options.confirmText || "ตกลง",
          cancelText: options.cancelText || "ยกเลิก",
          variant: options.variant || "danger"
        },
        resolve
      });
    });
  }

  const toastHelpers = {
    success: (msg: string) => addToast("success", msg),
    error: (msg: string) => addToast("error", msg),
    info: (msg: string) => addToast("info", msg),
    warning: (msg: string) => addToast("warning", msg)
  };

  useEffect(() => {
    globalToast = toastHelpers;
    globalConfirm = confirm;
  });

  function handleConfirmChoice(choice: boolean) {
    if (confirmState) {
      confirmState.resolve(choice);
      setConfirmState(null);
    }
  }

  return (
    <ToastContext.Provider value={{ toast: toastHelpers, confirm }}>
      {children}

      {/* FLOATING TOASTS CONTAINER */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-3">
        {toasts.map((t) => {
          const isError = t.type === "error";
          const isSuccess = t.type === "success";
          const isWarning = t.type === "warning";

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl border text-xs backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3 duration-200 bg-white ${
                isError
                  ? "border-rose-300 text-slate-900 ring-1 ring-rose-200"
                  : isSuccess
                  ? "border-emerald-300 text-slate-900 ring-1 ring-emerald-200"
                  : isWarning
                  ? "border-amber-300 text-slate-900 ring-1 ring-amber-200"
                  : "border-slate-300 text-slate-900 ring-1 ring-slate-200"
              }`}
            >
              <span className="shrink-0 mt-0.5">
                {isError && <AlertCircle size={17} className="text-rose-600" />}
                {isSuccess && <CheckCircle2 size={17} className="text-emerald-600" />}
                {isWarning && <AlertTriangle size={17} className="text-amber-600" />}
                {!isError && !isSuccess && !isWarning && <Info size={17} className="text-sky-600" />}
              </span>
              <div className="flex-1 leading-relaxed font-medium">{t.message}</div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* CONFIRM MODAL DIALOG */}
      {confirmState && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-100 flex flex-col gap-4 text-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmState.options.variant === "danger"
                    ? "bg-rose-100 text-rose-600"
                    : confirmState.options.variant === "warning"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-indigo-100 text-indigo-600"
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm text-slate-900">{confirmState.options.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-normal">{confirmState.options.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmChoice(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                {confirmState.options.cancelText}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmChoice(true)}
                className={`px-4 py-2 text-xs text-white rounded-xl shadow-xs transition ${
                  confirmState.options.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirmState.options.variant === "warning"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {confirmState.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: globalToast,
      confirm: globalConfirm
    };
  }
  return context;
}
