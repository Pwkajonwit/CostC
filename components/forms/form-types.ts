import type { ReactNode } from "react";
import type { FieldSchema, RefOption, SheetRow } from "@/lib/types";

export type FormPayload = {
  tableName: string;
  schema: FieldSchema[];
  initialValues: SheetRow;
  refOptions: Record<string, RefOption[]>;
  submitPath?: string;
};

export type FormModalProps = {
  form?: FormPayload | null;
  tableName?: string;
  title?: string;
  buttonLabel?: string;
  relaxed?: boolean;
  submitPath?: string;
  openEventName?: string;
  hideLauncher?: boolean;
  buttonClassName?: string;
  buttonIcon?: ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (createdRow: SheetRow) => void;
  zIndex?: string;
};

export type OpenFormDetail = {
  row?: SheetRow;
  sheetRow?: string | number;
  isNew?: boolean;
};

export type MultiLineItem = {
  id: string;
  storeGroup?: string;    // e.g. "ไทวัสดุ" (สำหรับบิลย่อยที่มีหลายร้าน)
  category: string;       // e.g. "104 ซ่อมรถ", "105 เครื่องมือ"
  categoryType: string;   // e.g. "1.ค่าของ" | "4.น้ำมัน" | "5.ซ่อมรถ" | "7.เครื่องมือ" | "8.อื่นๆ" ...
  detail?: string;        // e.g. "เปลี่ยนถ่ายน้ำมันเครื่อง", "ปูนเสือ 20 ถุง", สเปกเครื่องมือ
  vehiclePlate?: string;  // e.g. "8กข-1234" (สำหรับ 4.น้ำมัน และ 5.ซ่อมรถ)
  toolName?: string;      // e.g. "สว่านเจาะปูน Rotary" (สำหรับ 7.เครื่องมือ)
  subItem?: string;       // e.g. "ค่าที่พัก" (สำหรับ 8.อื่นๆ)
  amount: string;         // e.g. "5000"
};

// Global in-memory cache and in-flight request tracker for schemas & refOptions
export const formSchemaCache = new Map<string, FormPayload>();
export const formSchemaInFlight = new Map<string, Promise<FormPayload | null>>();

export function clearFormSchemaCache(tableName?: string) {
  if (tableName) {
    const normalized = tableName.trim();
    formSchemaCache.delete(normalized);
  } else {
    formSchemaCache.clear();
  }
}

export async function prefetchFormSchema(tableName: string, forceRefresh = false): Promise<FormPayload | null> {
  if (!tableName) return null;
  const normalized = tableName.trim();
  if (!forceRefresh && formSchemaCache.has(normalized)) {
    return formSchemaCache.get(normalized)!;
  }
  if (formSchemaInFlight.has(normalized)) {
    return formSchemaInFlight.get(normalized)!;
  }

  const promise = fetch(`/api/form-schema?tableName=${encodeURIComponent(normalized)}&_t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" }
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Failed to load form schema");
      const data = (await res.json()) as FormPayload;
      if (data && data.schema) {
        formSchemaCache.set(normalized, data);
        return data;
      }
      return null;
    })
    .catch((err) => {
      console.warn(`Could not prefetch form schema for ${normalized}:`, err);
      return null;
    })
    .finally(() => {
      formSchemaInFlight.delete(normalized);
    });

  formSchemaInFlight.set(normalized, promise);
  return promise;
}
