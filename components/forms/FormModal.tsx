"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Coins,
  CreditCard,
  FileCheck,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Package,
  HardHat,
  Users,
  Plus,
  Receipt,
  Save,
  Scissors,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import { TABLES } from "@/lib/config";
import type { FieldSchema, RefOption, SheetRow } from "@/lib/types";
import { normalizeDateToIso, parseDateStrict, toInputDateValue, getTodayDateIso } from "@/lib/utils/dates";
import { imagePreviewUrl } from "@/components/bills/BillImageThumbnail";
import { compressImageFiles } from "@/lib/utils/image-compressor";
import { money } from "@/lib/utils/numbers";
import {
  ALL_STORE_CATEGORIES,
  ALL_CONTRACTOR_CATEGORIES,
  ALL_NEW_CATEGORIES,
  LABOR_CATEGORY_OPTIONS,
  STAFF_CATEGORY_OPTIONS,
  SUB_ITEMS_123,
  SUB_ITEMS_223,
  isMaterialCost,
  isLaborCost,
  isStaffCost,
  isFuelCost,
  isRepairCost,
  isMachineCost,
  isToolCost,
  isOtherExpense,
  getExpenseFieldForCategory,
  getCostCodeBadgeStyle,
  isFuelProduct,
  isMachineProduct,
  isCarRepairProduct,
  isOtherExpenseProduct,
  isToolProduct,
  deriveCategoryFromProduct,
  getBudgetControlDisplayLabel,
  getCostCodeBudgetField,
} from "@/lib/cost-codes";

import { ProjectBudgetAllocator } from "@/components/forms/ProjectBudgetAllocator";
import { BillCategoryBudgetGuardrail, MultiItemsBudgetGuardrail } from "@/components/forms/BillCategoryBudgetGuardrail";
import { ContractLaborBudgetGuardrail } from "@/components/forms/ContractLaborBudgetGuardrail";
import { ContractorQuotaGuardrail } from "@/components/forms/ContractorQuotaGuardrail";
import { checkCategoryBudgetCap } from "@/lib/bills/bill-validation";

type FormPayload = {
  tableName: string;
  schema: FieldSchema[];
  initialValues: SheetRow;
  refOptions: Record<string, RefOption[]>;
};

// Global in-memory cache and in-flight request tracker for schemas & refOptions
const formSchemaCache = new Map<string, FormPayload>();
const formSchemaInFlight = new Map<string, Promise<FormPayload | null>>();

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

type FormModalProps = {
  form?: FormPayload | null;
  tableName?: string;
  title?: string;
  buttonLabel?: string;
  relaxed?: boolean;
  submitPath?: string;
  openEventName?: string;
  hideLauncher?: boolean;
  buttonClassName?: string;
  buttonIcon?: React.ReactNode;
};

type OpenFormDetail = {
  row?: SheetRow;
  sheetRow?: string | number;
};

const DATA_FORM_SECTIONS: { id: string; title: string; iconName: string; fields: string[] }[] = [
  {
    id: "basic",
    title: "ข้อมูลหลัก & โครงการ",
    iconName: "ClipboardList",
    fields: ["ลำดับ", "ID Project", "บิล", "ผู้เบิก", "ว/ด/ป", "ผู้สร้างบิล"]
  },
  {
    id: "vendor",
    title: "ประเภทค่าใช้จ่าย & คู่ค้า",
    iconName: "Store",
    fields: ["ร้านค้า/ผู้รับเหมา", "ร้านค้า", "ผู้รับเหมา", "รายละเอียดงาน", "ชื่อพนักงาน", "สินค้า"]
  },
  {
    id: "expense",
    title: "รายการค่าใช้จ่าย & ยอดเงิน",
    iconName: "Coins",
    fields: [
      "ค่าของ", "ค่าแรง", "statusค่าแรง", "ค่าแรงคงเหลือ", "พนักงาน",
      "น้ำมัน", "ซ่อมรถ", "ทะเบียน", "เครื่องจักร", "เครื่องมือ", "ชื่อเครื่องมือ", "อื่นๆ", "รายการ"
    ]
  },
  {
    id: "tax",
    title: "ภาษี & เงื่อนไขการชำระเงิน",
    iconName: "Receipt",
    fields: ["vat", "เครดิต", "วันได้บิล", "วันจ่าย", "หัก", "จำนวนหัก", "วันออก 3%"]
  },
  {
    id: "attachment",
    title: "หลักฐาน & เอกสารแนบ",
    iconName: "FileCheck",
    fields: ["รูปถ่ายบิล"]
  }
];

type MultiLineItem = {
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

function getCategoryBadgeStyle(cat: string): string {
  return getCostCodeBadgeStyle(cat);
}

const MULTI_ITEM_CATEGORY_OPTIONS = ALL_STORE_CATEGORIES.map(c => ({ label: c, value: c }));

function MultiLineItemsBuilder({
  items,
  productOptions,
  vehicleOptions = [],
  toolOptions = [],
  otherItemOptions = [],
  storeOptions = [],
  onAdd,
  onRemove,
  onUpdate,
  onUpdateStoreGroup,
  onRemoveStoreGroup,
  onCancel,
  projectId = "",
  projectRows = [],
  values = {},
  existingBills = [],
}: {
  items: MultiLineItem[];
  productOptions: { label: string; value: string }[];
  vehicleOptions?: { label: string; value: string }[];
  toolOptions?: { label: string; value: string }[];
  otherItemOptions?: { label: string; value: string }[];
  storeOptions?: { label: string; value: string }[];
  onAdd: (defaultStore?: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof MultiLineItem, value: string) => void;
  onUpdateStoreGroup?: (oldStoreName: string, newStoreName: string) => void;
  onRemoveStoreGroup?: (storeName: string) => void;
  onCancel: () => void;
  projectId?: string;
  projectRows?: SheetRow[];
  values?: Record<string, string>;
  existingBills?: SheetRow[];
}) {
  const isContractor = values?.["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
  const isSubBill = !isContractor && String(values?.["บิล"] || "").includes("ย่อย");
  const totalSum = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const [showNoteMap, setShowNoteMap] = useState<Record<string, boolean>>({});

  const matchedProject = useMemo(() => {
    return projectRows.find(p => {
      const projId = String(p["ID Project"] || p.id || "").trim();
      const projName = String(p["ชื่อ Project"] || p.name || "").trim();
      if (!projId && !projName) return false;
      return (
        projId === projectId ||
        projName === projectId ||
        projectId.startsWith(`${projId} `) ||
        projectId.startsWith(`${projId} -`) ||
        projectId === `${projId} - ${projName}` ||
        (projId && projectId.includes(projId))
      );
    });
  }, [projectId, projectRows]);

  // Helper to resolve store ID (e.g. ST101) to store name
  const resolveStoreName = useCallback((token: string) => {
    const t = (token || "").trim();
    if (!t) return "";
    const matched = storeOptions.find(opt => {
      const v = (opt.value || "").trim().toLowerCase();
      const l = (opt.label || "").trim().toLowerCase();
      const h = (((opt as any).hint) || "").trim().toLowerCase();
      const target = t.toLowerCase();
      return v === target || l === target || h === target;
    });
    return matched ? matched.label : t;
  }, [storeOptions]);

  // Group items by store for sub-bills
  const storeGroups = useMemo(() => {
    if (!isSubBill) return [];
    const groups: { name: string; items: MultiLineItem[]; subtotal: number }[] = [];
    const map = new Map<string, { name: string; items: MultiLineItem[]; subtotal: number }>();

    items.forEach(item => {
      const rawStore = (item.storeGroup || "").trim();
      const resolved = resolveStoreName(rawStore);
      const key = resolved || "ร้านที่ 1";
      if (!map.has(key)) {
        const g = { name: key, items: [], subtotal: 0 };
        map.set(key, g);
        groups.push(g);
      }
      const g = map.get(key)!;
      g.items.push(item);
      g.subtotal += Number(item.amount) || 0;
    });

    if (groups.length === 0) {
      groups.push({ name: "ร้านที่ 1", items: [], subtotal: 0 });
    }
    return groups;
  }, [items, isSubBill, resolveStoreName]);

  function renderItemRow(item: MultiLineItem, idx: number, canDelete: boolean) {
    let itemBudget: ReturnType<typeof checkCategoryBudgetCap> | null = null;
    const prod = String(item.category || "").trim();
    if (matchedProject && prod) {
      const type = String(item.categoryType || prod || (isContractor ? "201 เตรียมงาน" : "101 เตรียมงาน")).trim();
      const prodAmtSum = items
        .filter(i => (i.category || "").trim() === prod)
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const amt = String(prodAmtSum > 0 ? prodAmtSum : (item.amount || "0")).trim();

      itemBudget = checkCategoryBudgetCap({
        "ID Project": projectId,
        "ร้านค้า/ผู้รับเหมา": values?.["ร้านค้า/ผู้รับเหมา"] || "",
        "สินค้า": prod,
        "ประเภท": isContractor ? (prod || type) : type,
        "ยอดเงิน": amt,
        "ค่าของ": (!isContractor && isMaterialCost(type)) ? amt : "",
        "ค่าแรง": (isLaborCost(type) || isContractor) ? amt : "",
        "น้ำมัน": isFuelCost(type) ? amt : "",
        "ซ่อมรถ": isRepairCost(type) ? amt : "",
        "เครื่องจักร": isMachineCost(type) ? amt : "",
        "เครื่องมือ": isToolCost(type) ? amt : "",
        "อื่นๆ": isOtherExpense(type) ? amt : "",
      }, matchedProject, existingBills);
    }

    const hasBudgetCap = Boolean(itemBudget?.hasBudgetCap);
    const hasSpecificCap = Boolean(itemBudget?.hasBudgetCap && itemBudget?.isSpecificSubBudget);
    const isOver = Boolean(hasSpecificCap && itemBudget?.isOverBudget);

    return (
      <div
        key={item.id}
        className={`bg-white border rounded-lg p-2 sm:px-2.5 sm:py-2 flex flex-col sm:flex-row items-stretch sm:items-start gap-2 shadow-2xs transition-colors ${
          isOver && Number(item.amount) > 0 ? "border-rose-300 bg-rose-50/20" : "border-slate-200/90 hover:border-slate-300"
        }`}
      >
        <span className="font-mono text-xs text-slate-400 font-semibold w-5 shrink-0 text-center hidden sm:block pt-2">
          {idx + 1}
        </span>

        {/* Product / Labor Category Selector */}
        <div className="w-full sm:w-48 md:w-56 shrink-0">
          <SearchableRefSelect
            name={`product_category_${item.id}`}
            value={item.category}
            options={productOptions}
            readOnly={false}
            placeholder={isContractor ? `เลือกหมวดงานค่าแรง (${idx + 1})...` : `เลือกสินค้า (${idx + 1})...`}
            onChange={(val) => {
              onUpdate(item.id, "category", val);
              if (isContractor) {
                onUpdate(item.id, "categoryType", val);
              }
            }}
            creatable
          />
        </div>

        {/* Detail / Contextual Dropdown or Budget Control / Work Description Input */}
        <div className="flex-1 min-w-0">
          {isFuelCost(item.categoryType) ? (
            <SearchableRefSelect
              name={`item_plate_${item.id}`}
              value={item.vehiclePlate || item.detail || ""}
              options={vehicleOptions}
              readOnly={false}
              placeholder="เลือกทะเบียนรถ (คันที่เติมน้ำมัน)..."
              onChange={(val) => {
                onUpdate(item.id, "vehiclePlate", val);
                onUpdate(item.id, "detail", val);
              }}
            />
          ) : isRepairCost(item.categoryType) ? (
            <SearchableRefSelect
              name={`item_plate_${item.id}`}
              value={item.vehiclePlate || item.detail || ""}
              options={vehicleOptions}
              readOnly={false}
              placeholder="เลือกทะเบียนรถ (คันที่ซ่อม)..."
              onChange={(val) => {
                onUpdate(item.id, "vehiclePlate", val);
                onUpdate(item.id, "detail", val);
              }}
            />
          ) : isToolCost(item.categoryType) ? (
            <SearchableRefSelect
              name={`item_tool_${item.id}`}
              value={item.toolName || item.detail || ""}
              options={toolOptions}
              readOnly={false}
              placeholder="เลือกชื่อเครื่องมือ..."
              onChange={(val) => {
                onUpdate(item.id, "toolName", val);
                onUpdate(item.id, "detail", val);
              }}
              creatable
            />
          ) : isOtherExpense(item.categoryType) ? (
            <SearchableRefSelect
              name={`item_other_${item.id}`}
              value={item.subItem || item.detail || ""}
              options={otherItemOptions}
              readOnly={false}
              placeholder="เลือกหมวดรายการค่าใช้จ่าย..."
              onChange={(val) => {
                onUpdate(item.id, "subItem", val);
                onUpdate(item.id, "detail", val);
              }}
            />
          ) : hasSpecificCap && itemBudget ? (
            <div className="w-full space-y-1">
              <div
                className={`w-full h-10 sm:h-9 px-2.5 rounded-lg border flex items-center justify-between text-xs font-sans shadow-2xs transition-all ${
                  itemBudget.isOverBudget
                    ? "bg-rose-50 border-rose-300 text-rose-950"
                    : itemBudget.isWarning
                    ? "bg-amber-50 border-amber-300 text-amber-950"
                    : "bg-sky-50/90 border-sky-200/90 text-sky-950"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      itemBudget.isOverBudget
                        ? "bg-rose-200 text-rose-900"
                        : itemBudget.isWarning
                        ? "bg-amber-200 text-amber-900"
                        : "bg-sky-200 text-sky-900"
                    }`}
                  >
                    {itemBudget.percentUsedAfterBill}%
                  </span>
                  <span className="text-[11px] text-slate-700 truncate font-medium">
                    {itemBudget.accumulatedAmount > 0
                      ? `เบิกแล้ว ${money(itemBudget.accumulatedAmount)} / งบ ${money(itemBudget.budgetLimit)} ฿`
                      : `งบ ${money(itemBudget.budgetLimit)} ฿`}
                  </span>
                </div>

                <div className="shrink-0 font-semibold text-xs ml-2 flex items-center gap-1.5">
                  {itemBudget.remainingAfterBill < 0 ? (
                    <span className="text-rose-700 font-bold flex items-center gap-1">
                      <AlertCircle size={13} className="text-rose-600 inline shrink-0" />
                      <span>เกินงบ {money(Math.abs(itemBudget.remainingAfterBill))} ฿</span>
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-emerald-600 inline shrink-0" />
                      <span>คงเหลือ {money(itemBudget.remainingAfterBill)} ฿</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const currentShow = showNoteMap[item.id] ?? Boolean(item.detail);
                      setShowNoteMap(prev => ({ ...prev, [item.id]: !currentShow }));
                    }}
                    className={`p-1 rounded hover:bg-black/5 transition cursor-pointer text-[11px] flex items-center gap-0.5 ${
                      item.detail ? "text-slate-800 font-medium" : "text-slate-400 hover:text-slate-600"
                    }`}
                    title={item.detail ? `งวดงาน: ${item.detail}` : "ระบุงวดงาน / รายละเอียดเพิ่มเติม"}
                  >
                    <FileText size={13} />
                    {item.detail ? <span className="max-w-[70px] truncate text-[10px]">({item.detail})</span> : null}
                  </button>
                </div>
              </div>

              {(showNoteMap[item.id] || (item.detail && showNoteMap[item.id] !== false)) ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={item.detail || ""}
                    placeholder="ระบุงวดงาน / รายละเอียดงาน (เช่น งวดที่ 1)..."
                    onChange={(e) => onUpdate(item.id, "detail", e.target.value)}
                    className="w-full h-7.5 bg-white border border-slate-300 text-xs text-slate-800 px-2 rounded-md focus:outline-none focus:border-slate-800 transition"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNoteMap(prev => ({ ...prev, [item.id]: false }))}
                    className="p-1 text-slate-400 hover:text-slate-600 text-xs cursor-pointer shrink-0"
                    title="ซ่อนช่องงวดงาน"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <input
              type="text"
              value={item.detail || ""}
              placeholder={isContractor ? "รายละเอียดงาน / งวดงาน (เช่น งวดที่ 1 เทเสาเข็ม)..." : "รายละเอียดเพิ่มเติม (ถ้ามี)..."}
              onChange={(e) => onUpdate(item.id, "detail", e.target.value)}
              className="w-full h-10 sm:h-9 bg-slate-50 border border-slate-300 text-xs text-slate-800 px-2.5 rounded-lg focus:outline-none focus:bg-white focus:border-slate-800 transition"
            />
          )}
        </div>

        {/* Amount Input */}
        <div className="w-full sm:w-28 md:w-32 shrink-0 relative">
          <input
            type="number"
            step="any"
            value={item.amount}
            onChange={(e) => onUpdate(item.id, "amount", e.target.value)}
            placeholder="0.00"
            className={`w-full h-10 sm:h-9 bg-white border rounded-lg text-xs sm:text-sm px-2.5 py-1.5 focus:outline-none focus:border-slate-800 text-right font-semibold text-slate-900 placeholder:text-slate-400 ${
              isOver && Number(item.amount) > 0 ? "border-rose-400 bg-rose-50/30 text-rose-950" : "border-slate-300"
            }`}
          />
          {isOver && Number(item.amount) > 0 ? (
            <span className="absolute -top-2 right-2 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded shadow-2xs">
              เกินงบ
            </span>
          ) : null}
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={!canDelete}
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed shrink-0 self-end sm:self-start sm:mt-1"
          title="ลบแถวนี้"
        >
          <Trash2 size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-full bg-slate-50/70 border border-slate-200/90 rounded-xl p-3 sm:p-3.5 space-y-3 font-sans shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-4 ring-emerald-100" />
          <span className="font-semibold text-xs text-slate-800">
            {isContractor
              ? "รายการค่าแรง / งานงวดผู้รับเหมา"
              : (isSubBill ? "รายการสินค้า / จัดกลุ่มตามร้านค้า (บิลย่อย)" : "รายการสินค้า / ค่าใช้จ่ายในบิล")}
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800">
            {isSubBill ? `${storeGroups.length} ร้านค้า | ` : ""}{items.length} รายการ
          </span>
        </div>
      </div>

      {/* When isSubBill is TRUE: Render Store Group Cards */}
      {isSubBill ? (
        <div className="space-y-3">
          {storeGroups.map((group, gIdx) => {
            const isUnnamed = group.name.startsWith("ร้านที่ ");
            return (
              <div
                key={group.name + "_" + gIdx}
                className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs"
              >
                {/* Store Header */}
                <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Store size={14} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 shrink-0">
                      ร้านที่ {gIdx + 1}:
                    </span>
                    <div className="flex-1 max-w-xs">
                      <SearchableRefSelect
                        name={`store_select_${gIdx}`}
                        value={isUnnamed ? "" : group.name}
                        options={storeOptions}
                        readOnly={false}
                        placeholder={isUnnamed ? `เลือกร้านค้า (${group.name})...` : "พิมพ์หรือเลือกร้านค้า..."}
                        onChange={(val) => onUpdateStoreGroup?.(group.name, val)}
                        creatable
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 mr-1.5">รวมร้านนี้:</span>
                      <span className="text-xs font-bold text-slate-800 font-sans">
                        ฿{group.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {storeGroups.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveStoreGroup?.(group.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title={`ลบ${group.name} และรายการทั้งหมดในร้าน`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Store Items Rows */}
                <div className="p-2 sm:p-2.5 space-y-2 bg-slate-50/40">
                  <div className="hidden sm:flex items-center gap-2 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <span className="w-5 text-center shrink-0">#</span>
                    <span className="w-48 sm:w-56 shrink-0">สินค้า / หมวด</span>
                    <span className="flex-1 min-w-0">ทะเบียนรถ / รายการ (ถ้ามี)</span>
                    <span className="w-28 sm:w-32 text-right shrink-0 pr-1">ยอดเงิน (฿)</span>
                    <span className="w-8 shrink-0"></span>
                  </div>

                  {group.items.map((item, itemIdx) =>
                    renderItemRow(item, itemIdx, group.items.length > 1 || storeGroups.length > 1)
                  )}

                  {/* Add item in this store */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => onAdd(group.name)}
                      className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-emerald-50 transition-colors border border-dashed border-emerald-300/80 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>เพิ่มรายการในร้านนี้</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Store Button */}
          <button
            type="button"
            onClick={() => onAdd(`ร้านที่ ${storeGroups.length + 1}`)}
            className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <Store size={15} className="text-emerald-600" />
            <span>+ เพิ่มร้านค้าใหม่ (ร้านที่ {storeGroups.length + 1})</span>
          </button>
        </div>
      ) : (
        /* When isSubBill is FALSE: Normal Flat Items List */
        <div className="space-y-2">
          <div className="hidden sm:flex items-center gap-2 px-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            <span className="w-5 text-center shrink-0">#</span>
            <span className="w-48 sm:w-56 shrink-0">{isContractor ? "หมวดงานค่าแรง" : "สินค้า / หมวด"}</span>
            <span className="flex-1 min-w-0">{isContractor ? "สถานะคุมงบประมาณ / งวดงาน" : "ทะเบียนรถ / รายการ (ถ้ามี)"}</span>
            <span className="w-28 sm:w-32 text-right shrink-0 pr-1">ยอดเงิน (฿)</span>
            <span className="w-8 shrink-0"></span>
          </div>

          {items.map((item, idx) => renderItemRow(item, idx, items.length > 1))}

          <div className="pt-1">
            <button
              type="button"
              onClick={() => onAdd()}
              className="h-9 px-3.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors border border-emerald-200/80 shadow-2xs shrink-0"
            >
              <Plus size={14} className="shrink-0 text-emerald-700" />
              <span>{isContractor ? "เพิ่มรายการงานค่าแรง" : "เพิ่มรายการ"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer: สถานะคุมงบประมาณ และ ยอดรวมทั้งหมด */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/90">
        <div className="text-xs text-slate-500 font-medium">
          {isSubBill
            ? `รวมทั้งหมด ${storeGroups.length} ร้านค้า (${items.length} รายการ)`
            : `รวมทั้งหมด ${items.length} รายการ`}
        </div>

        {/* แถบคุมงบประมาณ + รวมยอดเงิน */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 sm:justify-end min-w-0">
          {projectId && projectRows.length > 0 && (
            <div className="min-w-0 flex-1 sm:max-w-xs md:max-w-sm">
              <MultiItemsBudgetGuardrail
                items={items}
                projectId={projectId}
                projectRows={projectRows}
                values={values}
                existingBills={existingBills}
              />
            </div>
          )}

          <div className="flex items-center gap-2 bg-white text-slate-700 px-3.5 h-9 rounded-lg border border-slate-200 text-xs shadow-2xs shrink-0 justify-between sm:justify-start">
            <span className="text-slate-500 font-medium">ยอดรวมเบิกทั้งหมด:</span>
            <span className="font-bold text-sm text-emerald-700 font-sans">
              ฿{totalSum.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeaderIcon({ name }: { name: string }) {
  switch (name) {
    case "ClipboardList": return <ClipboardList size={16} className="text-slate-600" />;
    case "Store": return <Store size={16} className="text-slate-600" />;
    case "Coins": return <Coins size={16} className="text-slate-600" />;
    case "Receipt": return <Receipt size={16} className="text-slate-600" />;
    case "FileCheck": return <FileCheck size={16} className="text-slate-600" />;
    default: return <FileText size={16} className="text-slate-600" />;
  }
}

export function FormModal({
  form,
  tableName,
  title = "เพิ่มข้อมูล",
  buttonLabel = "เพิ่มรายการ",
  relaxed = false,
  submitPath,
  openEventName,
  hideLauncher = false,
  buttonClassName,
  buttonIcon
}: FormModalProps) {
  const router = useRouter();
  const resolvedTableName = tableName || form?.tableName || "Data";

  const [activeForm, setActiveForm] = useState<FormPayload | null>(() => {
    if (form) {
      if (form.tableName) formSchemaCache.set(form.tableName, form);
      return form;
    }
    return formSchemaCache.get(resolvedTableName) || null;
  });
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => activeForm ? getInitialStringValues(activeForm) : {});
  const [editSheetRow, setEditSheetRow] = useState<string | number | null>(null);
  const [enumListSearch, setEnumListSearch] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [attachedFilesByField, setAttachedFilesByField] = useState<Record<string, File[]>>({});
  const isEditing = editSheetRow !== null && editSheetRow !== undefined;
  const isDataForm = resolvedTableName === TABLES.DATA || resolvedTableName === "Data" || resolvedTableName === "bills" || resolvedTableName === "DATA" || resolvedTableName === "กรอกบิล";
  const hasSavedDuringSession = useRef(false);

  function handleClose() {
    setOpen(false);
    setEditSheetRow(null);
    setMultiLineItems([]);
    setIsMultiItemMode(false);
    setSuccessMessage("");
    setError("");
    if (hasSavedDuringSession.current) {
      hasSavedDuringSession.current = false;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bills-data-updated"));
        window.dispatchEvent(new CustomEvent("data-updated", { detail: { tableName: resolvedTableName } }));
      }
      router.refresh();
    }
  }

  // Multi-Line Items State for Multi-category Bill Entry
  const [multiLineItems, setMultiLineItems] = useState<MultiLineItem[]>([]);
  const [isMultiItemMode, setIsMultiItemMode] = useState<boolean>(false);
  const [projectBills, setProjectBills] = useState<SheetRow[]>([]);

  useEffect(() => {
    const projVal = String(values["ID Project"] || "").trim();
    if (!projVal) {
      setProjectBills([]);
      return;
    }
    const cleanId = projVal.split(" - ")[0].trim();
    let active = true;
    fetch(`/api/bills?projectId=${encodeURIComponent(cleanId)}&pageSize=5000`)
      .then(r => r.json())
      .then(data => {
        if (active && Array.isArray(data.rows)) {
          setProjectBills(data.rows);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [values["ID Project"]]);

  const [resetKey, setResetKey] = useState(0);
  const formBodyRef = useRef<HTMLDivElement>(null);

  const productOptions = useMemo(() => {
    const isContractor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
    if (isContractor) {
      return ALL_CONTRACTOR_CATEGORIES.map((c: string) => ({ label: c, value: c }));
    }
    const field = activeForm?.schema.find(f => f.name === "สินค้า");
    const rawList: string[] = Array.isArray(field?.values) ? field.values : [];
    if (rawList.length > 0) return rawList.map((v: string) => ({ label: String(v), value: String(v) }));
    return (activeForm?.refOptions?.["สินค้า"] || []).map(opt => ({ label: String(opt.label || opt.value || ""), value: String(opt.value || "") }));
  }, [activeForm, values["ร้านค้า/ผู้รับเหมา"]]);

  const vehicleOptions = useMemo(() => {
    const fromRef = activeForm?.refOptions?.["ทะเบียน"] || activeForm?.refOptions?.["ทะเบียนรถ"] || [];
    if (fromRef.length > 0) {
      return fromRef.map(opt => ({ label: String(opt.label || opt.value || ""), value: String(opt.value || "") }));
    }
    const field = activeForm?.schema.find(f => f.name === "ทะเบียน" || f.name === "ทะเบียนรถ");
    const rawList: string[] = Array.isArray(field?.values) ? field.values : [];
    return rawList.map((v: string) => ({ label: String(v), value: String(v) }));
  }, [activeForm]);

  const toolOptions = useMemo(() => {
    const fromRef = activeForm?.refOptions?.["ชื่อเครื่องมือ"] || activeForm?.refOptions?.["เครื่องมือ"] || [];
    if (fromRef.length > 0) {
      return fromRef.map(opt => ({ label: String(opt.label || opt.value || ""), value: String(opt.value || "") }));
    }
    const field = activeForm?.schema.find(f => f.name === "ชื่อเครื่องมือ" || f.name === "เครื่องมือ");
    const rawList: string[] = Array.isArray(field?.values) ? field.values : [];
    if (rawList.length > 0) return rawList.map((v: string) => ({ label: String(v), value: String(v) }));
    return [
      "สว่านเจาะเหล็กไฟฟ้า", "สว่านเจาะปูน Rotary", "ลูกหมูขนาด 4\"", "ลูกหมูขนาด 7\"", "ไฟเบอร์ตัดเหล็ก"
    ].map(v => ({ label: v, value: v }));
  }, [activeForm]);

  const otherItemOptions = useMemo(() => {
    const fromRef = activeForm?.refOptions?.["รายการ"] || activeForm?.refOptions?.["รายการค่าใช้จ่าย"] || [];
    if (fromRef.length > 0) {
      return fromRef.map(opt => ({ label: String(opt.label || opt.value || ""), value: String(opt.value || "") }));
    }
    const field = activeForm?.schema.find(f => f.name === "รายการ" || f.name === "รายการค่าใช้จ่าย");
    const rawList: string[] = Array.isArray(field?.values) ? field.values : [];
    if (rawList.length > 0) return rawList.map((v: string) => ({ label: String(v), value: String(v) }));
    return SUB_ITEMS_123.map(v => ({ label: v, value: v }));
  }, [activeForm]);

  const storeOptions = useMemo(() => {
    const fromRef = activeForm?.refOptions?.["ร้านค้า"] || activeForm?.refOptions?.["ร้าน/บุคคล"] || [];
    if (fromRef.length > 0) {
      return fromRef.map(opt => {
        const storeName = String(opt.row?.["ชื่อร้านค้า"] || opt.row?.["ชื่อเต็ม"] || opt.label || opt.value || "").trim();
        const cleanName = storeName.replace(/^[A-Za-z0-9_-]+\s*[-:]\s*/, "").trim() || storeName;
        return {
          label: cleanName,
          value: cleanName,
          hint: String(opt.value || "")
        };
      });
    }
    const field = activeForm?.schema.find(f => f.name === "ร้านค้า" || f.name === "ร้าน/บุคคล");
    const rawList: string[] = Array.isArray(field?.values) ? field.values : [];
    return rawList.map((v: string) => {
      const cleanName = String(v).replace(/^[A-Za-z0-9_-]+\s*[-:]\s*/, "").trim() || String(v);
      return { label: cleanName, value: cleanName };
    });
  }, [activeForm]);

  const resolveStoreName = useCallback((token: string): string => {
    const trimmed = (token || "").trim();
    if (!trimmed) return "";
    const fromRef = activeForm?.refOptions?.["ร้านค้า"] || activeForm?.refOptions?.["ร้าน/บุคคล"] || [];
    const matched = fromRef.find(opt => {
      const v = String(opt.value || "").trim().toLowerCase();
      const l = String(opt.label || "").trim().toLowerCase();
      const sName = String(opt.row?.["ชื่อร้านค้า"] || "").trim().toLowerCase();
      const fName = String(opt.row?.["ชื่อเต็ม"] || "").trim().toLowerCase();
      const t = trimmed.toLowerCase();
      return v === t || l === t || sName === t || fName === t;
    });
    if (matched) {
      const sName = String(matched.row?.["ชื่อร้านค้า"] || matched.row?.["ชื่อเต็ม"] || matched.label || "").trim();
      return sName.replace(/^[A-Za-z0-9_-]+\s*[-:]\s*/, "").trim() || sName;
    }
    return trimmed;
  }, [activeForm]);

  function syncMultiLineItemsToValues(items: MultiLineItem[]) {
    if (items.length === 0) return;
    const isContractorVendor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
    const matSum = items.filter(i => !isContractorVendor && isMaterialCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const laborSum = items.filter(i => isLaborCost(i.categoryType) || isContractorVendor).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const fuelSum = items.filter(i => isFuelCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const repairSum = items.filter(i => isRepairCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const machineSum = items.filter(i => isMachineCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const toolSum = items.filter(i => isToolCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const otherSum = items.filter(i => isOtherExpense(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalSum = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const hasFuelOrRepair = items.some(
      i => isFuelCost(i.categoryType) || isRepairCost(i.categoryType) || isFuelProduct(i.category) || isCarRepairProduct(i.category)
    );

    const plates = items
      .map(i => i.vehiclePlate || ((isFuelCost(i.categoryType) || isRepairCost(i.categoryType)) ? i.detail : ""))
      .filter(Boolean);

    const toolNames = items
      .map(i => i.toolName || (isToolCost(i.categoryType) ? i.detail : ""))
      .filter(Boolean);

    const otherItems = items
      .map(i => i.subItem || (isOtherExpense(i.categoryType) ? i.detail : ""))
      .filter(Boolean);

    const isSub = !isContractorVendor && String(values["บิล"] || "").includes("ย่อย");
    const storeNames = Array.from(new Set(
      items.map(i => resolveStoreName(i.storeGroup || "").trim()).filter(name => Boolean(name) && !name.startsWith("ร้านที่ "))
    ));

    setValues(current => {
      const next = { ...current };
      next["ค่าของ"] = matSum > 0 ? String(matSum) : "";
      next["ค่าแรง"] = laborSum > 0 ? String(laborSum) : "";
      next["น้ำมัน"] = fuelSum > 0 ? String(fuelSum) : "";
      next["ซ่อมรถ"] = repairSum > 0 ? String(repairSum) : "";
      next["เครื่องจักร"] = machineSum > 0 ? String(machineSum) : "";
      next["เครื่องมือ"] = toolSum > 0 ? String(toolSum) : "";
      next["อื่นๆ"] = otherSum > 0 ? String(otherSum) : "";
      next["ยอดเงิน"] = String(totalSum);
      applyBillDeductAmount(next);
      next["has_fuel_or_repair"] = hasFuelOrRepair ? "true" : "";
      if (plates.length > 0) {
        next["ทะเบียน"] = plates[0] || "";
      }
      if (toolNames.length > 0) {
        next["ชื่อเครื่องมือ"] = toolNames.join(", ");
      }
      if (otherItems.length > 0) {
        next["รายการ"] = otherItems[0] || "";
      }
      if (isContractorVendor) {
        const details = items
          .map(i => {
            const d = (i.detail || "").trim();
            const cat = (i.category || "").trim();
            if (cat && d) return `${cat}: ${d}`;
            return cat || d;
          })
          .filter(Boolean);
        if (!current["รายละเอียดงาน"] && details.length > 0) {
          next["รายละเอียดงาน"] = details.join(" | ");
        }
        if (!current["สินค้า/ทำงาน"]) {
          next["สินค้า/ทำงาน"] = next["รายละเอียดงาน"] || details.join(" | ");
        }
        next["ประเภท"] = items[0]?.categoryType || items[0]?.category || current["ประเภท"] || "201 เตรียมงาน";
      } else {
        if (items[0]?.category) next["สินค้า"] = items[0].category;
        next["ประเภท"] = items[0]?.categoryType || current["ประเภท"] || "101 เตรียมงาน";
      }
      if (isSub && storeNames.length > 0) {
        next["ร้านค้า"] = storeNames.join(", ");
        next["ร้าน/บุคคล"] = storeNames.join(", ");
      }
      return next;
    });
  }

  function enableMultiItemMode() {
    setIsMultiItemMode(true);
    const isContractor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
    const primaryType = isContractor
      ? (values["ประเภท"] && !isMaterialCost(values["ประเภท"]) ? values["ประเภท"] : "201 เตรียมงาน")
      : (deriveCategoryFromProduct(values["สินค้า"]) || "101 เตรียมงาน");
    setValues(current => ({
      ...current,
      "ประเภท": primaryType
    }));
    if (multiLineItems.length === 0) {
      const initialAmt = values["ค่าแรง"] || values["ค่าของ"] || values["น้ำมัน"] || values["ซ่อมรถ"] || values["เครื่องจักร"] || values["เครื่องมือ"] || values["อื่นๆ"] || values["ยอดเงิน"] || "";
      const isSub = !isContractor && String(values["บิล"] || "").includes("ย่อย");
      const initialStore = !isContractor ? (resolveStoreName(values["ร้านค้า"] || values["ร้าน/บุคคล"] || "") || (isSub ? "ร้านที่ 1" : "")) : "";
      const initialItems: MultiLineItem[] = [
        {
          id: "1",
          storeGroup: initialStore,
          category: isContractor ? (primaryType || "201 เตรียมงาน") : (values["สินค้า"] || ""),
          categoryType: primaryType,
          detail: isContractor ? "" : (values["รายละเอียดงาน"] || ""),
          vehiclePlate: values["ทะเบียน"] || "",
          toolName: values["ชื่อเครื่องมือ"] || "",
          subItem: values["รายการ"] || "",
          amount: initialAmt,
        },
        {
          id: "2",
          storeGroup: initialStore,
          category: isContractor ? "201 เตรียมงาน" : "",
          categoryType: isContractor ? "201 เตรียมงาน" : "101 เตรียมงาน",
          detail: "",
          vehiclePlate: "",
          toolName: "",
          subItem: "",
          amount: "",
        }
      ];
      setMultiLineItems(initialItems);
      syncMultiLineItemsToValues(initialItems);
    } else if (isContractor) {
      setMultiLineItems(prev => {
        const next = prev.map(it => {
          if (!it.category || isMaterialCost(it.category) || it.category.startsWith("1")) {
            return { ...it, storeGroup: "", category: "201 เตรียมงาน", categoryType: "201 เตรียมงาน" };
          }
          return { ...it, storeGroup: "" };
        });
        syncMultiLineItemsToValues(next);
        return next;
      });
    }
  }

  function disableMultiItemMode() {
    setIsMultiItemMode(false);
    setMultiLineItems([]);
    setValues(current => ({
      ...current,
      has_fuel_or_repair: ""
    }));
  }

  function handleAddLineItem(defaultStore?: string) {
    setMultiLineItems(prev => {
      const isContractor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
      let storeToUse = defaultStore;
      if (storeToUse === undefined) {
        const isSub = !isContractor && String(values["บิล"] || "").includes("ย่อย");
        storeToUse = isSub && prev.length > 0 ? (prev[prev.length - 1]?.storeGroup || "ร้านที่ 1") : "";
      }
      return [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          storeGroup: storeToUse,
          category: "",
          categoryType: isContractor ? "201 เตรียมงาน" : "101 เตรียมงาน",
          detail: "",
          vehiclePlate: "",
          toolName: "",
          subItem: "",
          amount: "",
        }
      ];
    });
  }

  function handleUpdateStoreGroup(oldStoreName: string, newStoreName: string) {
    setMultiLineItems(prev => {
      const next = prev.map(item => {
        const currentStore = (item.storeGroup || "").trim() || "ร้านที่ 1";
        const resolvedCurrent = resolveStoreName(currentStore);
        if (currentStore === oldStoreName || resolvedCurrent === oldStoreName) {
          return { ...item, storeGroup: newStoreName };
        }
        return item;
      });
      syncMultiLineItemsToValues(next);
      return next;
    });
  }

  function handleRemoveStoreGroup(storeName: string) {
    setMultiLineItems(prev => {
      const next = prev.filter(item => {
        const currentStore = (item.storeGroup || "").trim() || "ร้านที่ 1";
        const resolvedCurrent = resolveStoreName(currentStore);
        return currentStore !== storeName && resolvedCurrent !== storeName;
      });
      syncMultiLineItemsToValues(next);
      return next;
    });
  }

  function handleRemoveLineItem(id: string) {
    setMultiLineItems(prev => {
      const next = prev.filter(item => item.id !== id);
      syncMultiLineItemsToValues(next);
      return next;
    });
  }

  function handleUpdateLineItem(id: string, field: keyof MultiLineItem, val: string) {
    setMultiLineItems(prev => {
      const next = prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        if (field === "category") {
          const isContractor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
          updated.categoryType = isContractor ? (val || "201 เตรียมงาน") : deriveCategoryFromProduct(val);
        }
        return updated;
      });
      syncMultiLineItemsToValues(next);
      return next;
    });
  }

  // Sync if prop form changes
  useEffect(() => {
    if (form) {
      setActiveForm(form);
      if (form.tableName) formSchemaCache.set(form.tableName, form);
    }
  }, [form]);

  // Background prefetch schema on mount so form opens instantly with 0ms delay
  useEffect(() => {
    if (resolvedTableName) {
      prefetchFormSchema(resolvedTableName).then(loaded => {
        if (loaded) {
          setActiveForm(loaded);
          setValues(prev => Object.keys(prev).length === 0 ? getInitialStringValues(loaded) : prev);
        }
      });
    }
  }, [resolvedTableName]);

  // Listen to global cache invalidation event (when projects, stores, contractors, staff are added)
  useEffect(() => {
    const handleInvalidate = () => {
      clearFormSchemaCache();
      if (resolvedTableName) {
        prefetchFormSchema(resolvedTableName, true).then(loaded => {
          if (loaded) {
            setActiveForm(loaded);
          }
        });
      }
    };
    window.addEventListener("schema-cache-invalidated", handleInvalidate);
    return () => window.removeEventListener("schema-cache-invalidated", handleInvalidate);
  }, [resolvedTableName]);

  function populateFormValues(targetForm: FormPayload, detail?: OpenFormDetail) {
    const nextValues = detail?.row
      ? getRowStringValues(targetForm, detail.row)
      : getInitialStringValues(targetForm);

    // When creating a new entry, ensure all date fields configured for today (e.g. ว/ด/ป, วันที่) use current Thai local date
    if (!detail?.row) {
      const todayIso = getTodayDateIso();
      targetForm.schema.forEach(field => {
        if (field.initialValue === "today" || (field.type === "Date" && (field.initialValue === "today" || field.name === "ว/ด/ป" || field.name === "วันที่" || field.name === "ดู/ทำ"))) {
          nextValues[field.name] = todayIso;
        }
      });
    }

    if (detail?.row) {
      targetForm.schema.filter(f => f.type === "Ref" && f.refFill).forEach(field => {
        const refVal = nextValues[field.name];
        if (refVal) {
          const options = targetForm.refOptions[field.name] || [];
          const selectedOpt = options.find(opt =>
            String(opt.value) === refVal ||
            String(opt.label) === refVal ||
            (opt.row && (
              String(opt.row.id) === refVal ||
              String(opt.row.id_Contractor) === refVal ||
              String(opt.row.id_store) === refVal
            ))
          );
          if (selectedOpt) {
            Object.entries(field.refFill!).forEach(([targetField, sourceColumn]) => {
              if (!hasValue(nextValues[targetField])) {
                nextValues[targetField] = String(selectedOpt.row?.[sourceColumn] ?? "");
              }
            });
          }
        }
      });
    }
    applyLocalFormulas(nextValues, targetForm.tableName);
    setError("");
    setSuccessMessage("");
    setEnumListSearch({});
    const targetRowKey = detail?.row?.id ?? detail?.row?.["ID Project"] ?? detail?.row?.["รหัสพนักงาน"] ?? detail?.row?.id_store ?? detail?.row?.id_Contractor ?? detail?.row?.id_Conwork ?? detail?.row?.id_bank ?? detail?.row?.id_car ?? detail?.row?.id_cus ?? detail?.row?.id_Company ?? detail?.row?.["ลำดับ"] ?? detail?.sheetRow ?? detail?.row?._sheetRow;
    setEditSheetRow(detail?.row ? (targetRowKey !== undefined && targetRowKey !== null ? (typeof targetRowKey === "number" || typeof targetRowKey === "string" ? targetRowKey : String(targetRowKey)) : 1) : null);

    if (detail?.row) {
      const rawItems = detail.row.items || (detail.row.data as any)?.items;
      let parsedItems: MultiLineItem[] = [];
      if (Array.isArray(rawItems)) {
        parsedItems = rawItems;
      } else if (typeof rawItems === "string") {
        try {
          const parsed = JSON.parse(rawItems);
          if (Array.isArray(parsed)) parsedItems = parsed;
        } catch {}
      }

      if (parsedItems.length > 0) {
        setMultiLineItems(parsedItems);
        setIsMultiItemMode(true);
      } else {
        setMultiLineItems([]);
        setIsMultiItemMode(false);
      }
    } else {
      setMultiLineItems([]);
      setIsMultiItemMode(false);
    }

    setValues(nextValues);
    setResetKey(k => k + 1);
  }

  async function handleOpen(detail?: OpenFormDetail) {
    hasSavedDuringSession.current = false;
    setAttachedFilesByField({});
    setError("");
    setSuccessMessage("");

    // If editing existing row, populate directly
    if (detail?.row && activeForm) {
      populateFormValues(activeForm, detail);
      setOpen(true);
      prefetchFormSchema(resolvedTableName, true).then(fresh => {
        if (fresh) setActiveForm(fresh);
      });
      return;
    }

    // Open modal immediately and fetch fresh real-time sequence from server
    setOpen(true);
    if (activeForm) {
      populateFormValues(activeForm, detail);
    } else {
      setLoadingSchema(true);
    }

    try {
      const fresh = await prefetchFormSchema(resolvedTableName, true);
      if (fresh) {
        setActiveForm(fresh);
        if (!detail?.row) {
          const freshInitial = getInitialStringValues(fresh);
          const todayIso = getTodayDateIso();
          setValues(prev => {
            const next = { ...prev };
            if (freshInitial["ลำดับ"]) next["ลำดับ"] = freshInitial["ลำดับ"];
            if (freshInitial["ID Project"] && !next["ID Project"]) next["ID Project"] = freshInitial["ID Project"];
            if (freshInitial["id_Conwork"] && !next["id_Conwork"]) next["id_Conwork"] = freshInitial["id_Conwork"];
            fresh.schema.forEach(field => {
              if (field.initialValue === "today" || (field.type === "Date" && (field.name === "ว/ด/ป" || field.name === "วันที่" || field.name === "ดู/ทำ"))) {
                if (!next[field.name]) {
                  next[field.name] = todayIso;
                }
              }
            });
            return next;
          });
        } else {
          populateFormValues(fresh, detail);
        }
      }
    } finally {
      setLoadingSchema(false);
    }
  }

  const visibleFields = (activeForm?.schema || []).filter(field => {
    if (field.type === "Hidden") return false;
    if ((resolvedTableName === TABLES.PROJECT || resolvedTableName === "Project") && (field.name.startsWith("งบไม่เกิน") || field.name === "คุมงบประเภทงาน")) {
      return false;
    }
    return isFieldVisible(field, values);
  });

  useEffect(() => {
    if (!openEventName) return;
    const openFromExternalButton = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as OpenFormDetail | undefined : undefined;
      handleOpen(detail);
    };
    window.addEventListener(openEventName, openFromExternalButton as EventListener);
    return () => window.removeEventListener(openEventName, openFromExternalButton as EventListener);
  }, [activeForm, openEventName, resolvedTableName]);

  function handleVendorTypeChangeForLineItems(newVendorType: string) {
    if (newVendorType === "ผู้รับเหมา") {
      setMultiLineItems(prev => {
        if (!prev || prev.length === 0) return prev;
        const updated = prev.map(it => {
          const isMat = !it.category || it.category.startsWith("1") || isMaterialCost(it.category) || isMaterialCost(it.categoryType);
          if (isMat) {
            return {
              ...it,
              storeGroup: "",
              category: "201 เตรียมงาน",
              categoryType: "201 เตรียมงาน"
            };
          }
          return { ...it, storeGroup: "" };
        });
        syncMultiLineItemsToValues(updated);
        return updated;
      });
    } else if (newVendorType === "ร้านค้า") {
      setMultiLineItems(prev => {
        if (!prev || prev.length === 0) return prev;
        const updated = prev.map(it => {
          const isLab = !it.category || it.category.startsWith("2") || isLaborCost(it.category) || isLaborCost(it.categoryType);
          if (isLab) {
            return {
              ...it,
              category: "101 เตรียมงาน",
              categoryType: "101 เตรียมงาน"
            };
          }
          return it;
        });
        syncMultiLineItemsToValues(updated);
        return updated;
      });
    }
  }

  function updateValue(field: FieldSchema, value: string) {
    if (!activeForm) return;
    if (field.name === "ร้านค้า/ผู้รับเหมา") {
      handleVendorTypeChangeForLineItems(value);
    }
    setValues(current => {
      const next = { ...current, [field.name]: value };
      applyRefFill(next, field, activeForm, value);
      normalizeDependentValues(next, field.name, activeForm);
      if (activeForm.tableName === TABLES.DATA && field.name === "จำนวนหัก") return next;
      if (
        (activeForm.tableName === TABLES.PROJECT || activeForm.tableName === "Project" || activeForm.tableName === "1. Project รวม") &&
        field.name === "ยอดรวม vat"
      ) {
        const vatNum = toNumber(value);
        if (vatNum > 0) {
          next["ยอดงาน"] = String(Math.round((vatNum / 1.07) * 100) / 100);
        }
        return next;
      }
      pruneHiddenConditionalValues(next, activeForm);
      applyLocalFormulas(next, activeForm.tableName);
      return next;
    });
  }

  function updateValueByName(fieldName: string, value: string) {
    if (!activeForm) return;
    if (fieldName === "ร้านค้า/ผู้รับเหมา") {
      handleVendorTypeChangeForLineItems(value);
    }
    setValues(current => {
      const next = { ...current, [fieldName]: value };
      const targetField = activeForm.schema.find(f => f.name === fieldName);
      if (targetField) {
        applyRefFill(next, targetField, activeForm, value);
        normalizeDependentValues(next, fieldName, activeForm);
      }
      if (
        (activeForm.tableName === TABLES.PROJECT || activeForm.tableName === "Project" || activeForm.tableName === "1. Project รวม") &&
        fieldName === "ยอดรวม vat"
      ) {
        const vatNum = toNumber(value);
        if (vatNum > 0) {
          next["ยอดงาน"] = String(Math.round((vatNum / 1.07) * 100) / 100);
        }
        return next;
      }
      applyLocalFormulas(next, activeForm.tableName);
      return next;
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submitPath || !activeForm) return;

    const submitValues = sanitizeValuesForSubmit(values, activeForm);
    if (activeForm.tableName === TABLES.DATA || activeForm.tableName === "Data") {
      const loggedInUser = getCookie("auth_name") || getCookie("auth_employee_id");
      if (loggedInUser && !submitValues["ผู้สร้างบิล"]) {
        submitValues["ผู้สร้างบิล"] = loggedInUser;
      }
    }
    const validationError = validateVisibleRequiredFields(submitValues, activeForm);
    if (validationError) {
      setError(validationError);
      formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const formElement = event.currentTarget;
    const body = new FormData();
    body.set("tableName", activeForm.tableName);
    Object.entries(submitValues).forEach(([key, value]) => body.append(key, value));
    if (isEditing && editSheetRow !== null) {
      body.set("id", String(editSheetRow));
      body.set("sheetRow", String(editSheetRow));
    }

    if (isDataForm && isMultiItemMode && multiLineItems.length > 0) {
      const invalidItem = multiLineItems.find(i => !i.amount || (Number(i.amount) || 0) <= 0);
      if (invalidItem) {
        setError("กรุณาระบุยอดเงินสำหรับทุกรายการสินค้าในบิล");
        formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const isContractorVendor = submitValues["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
      const matSum = multiLineItems.filter(i => isMaterialCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const laborSum = multiLineItems.filter(i => isLaborCost(i.categoryType) || isContractorVendor).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const fuelSum = multiLineItems.filter(i => isFuelCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const repairSum = multiLineItems.filter(i => isRepairCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const machineSum = multiLineItems.filter(i => isMachineCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const toolSum = multiLineItems.filter(i => isToolCost(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const otherSum = multiLineItems.filter(i => isOtherExpense(i.categoryType)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const totalSum = multiLineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

      submitValues["ค่าของ"] = matSum > 0 ? String(matSum) : "";
      submitValues["ค่าแรง"] = laborSum > 0 ? String(laborSum) : "";
      submitValues["น้ำมัน"] = fuelSum > 0 ? String(fuelSum) : "";
      submitValues["ซ่อมรถ"] = repairSum > 0 ? String(repairSum) : "";
      submitValues["เครื่องจักร"] = machineSum > 0 ? String(machineSum) : "";
      submitValues["เครื่องมือ"] = toolSum > 0 ? String(toolSum) : "";
      submitValues["อื่นๆ"] = otherSum > 0 ? String(otherSum) : "";
      submitValues["ยอดเงิน"] = String(totalSum);
      applyBillDeductAmount(submitValues);
      submitValues["ประเภท"] = multiLineItems[0]?.categoryType || multiLineItems[0]?.category || submitValues["ประเภท"] || (isContractorVendor ? "201 เตรียมงาน" : "101 เตรียมงาน");
      const prodNames = multiLineItems.map(i => i.category).filter(Boolean);
      submitValues["สินค้า"] = isContractorVendor ? "" : (prodNames.join(", ") || submitValues["สินค้า"] || "");
      submitValues["items"] = JSON.stringify(multiLineItems);

      const isSub = !isContractorVendor && String(submitValues["บิล"] || values["บิล"] || "").includes("ย่อย");
      if (isSub) {
        const storeNames = Array.from(new Set(
          multiLineItems.map(i => resolveStoreName(i.storeGroup || "").trim()).filter(name => Boolean(name) && !name.startsWith("ร้านที่ "))
        ));
        if (storeNames.length > 0) {
          const joinedStores = storeNames.join(", ");
          submitValues["ร้านค้า"] = joinedStores;
          submitValues["ร้าน/บุคคล"] = joinedStores;
          body.set("ร้านค้า", joinedStores);
          body.set("ร้าน/บุคคล", joinedStores);
        }
      }

      const plates = multiLineItems
        .map(i => i.vehiclePlate || ((isFuelCost(i.categoryType) || isRepairCost(i.categoryType)) ? i.detail : ""))
        .filter(Boolean);
      if (plates.length > 0 && plates[0]) {
        submitValues["ทะเบียน"] = String(plates[0]);
        body.set("ทะเบียน", String(plates[0]));
      }

      const toolNames = multiLineItems
        .map(i => i.toolName || (isToolCost(i.categoryType) ? i.detail : ""))
        .filter(Boolean);
      if (toolNames.length > 0) {
        submitValues["ชื่อเครื่องมือ"] = toolNames.join(", ");
        body.set("ชื่อเครื่องมือ", toolNames.join(", "));
      }

      const otherItems = multiLineItems
        .map(i => i.subItem || (isOtherExpense(i.categoryType) ? i.detail : ""))
        .filter(Boolean);
      if (otherItems.length > 0 && otherItems[0] && !submitValues["รายการ"]) {
        submitValues["รายการ"] = otherItems[0];
        body.set("รายการ", otherItems[0]);
      }

      const details = multiLineItems
        .map(i => {
          const d = (i.detail || "").trim();
          const cat = (i.category || "").trim();
          if (cat && d) return `${cat}: ${d}`;
          return cat || d;
        })
        .filter(Boolean);
      if (!submitValues["รายละเอียดงาน"] && details.length > 0) {
        submitValues["รายละเอียดงาน"] = details.join(" | ");
      }
      if (!submitValues["สินค้า/ทำงาน"]) {
        submitValues["สินค้า/ทำงาน"] = submitValues["รายละเอียดงาน"] || details.join(" | ");
      }
      if (submitValues["รายละเอียดงาน"]) {
        body.set("รายละเอียดงาน", submitValues["รายละเอียดงาน"]);
      }
      if (submitValues["สินค้า/ทำงาน"]) {
        body.set("สินค้า/ทำงาน", submitValues["สินค้า/ทำงาน"]);
      }

      body.set("ประเภท", submitValues["ประเภท"]);
      body.set("ค่าของ", submitValues["ค่าของ"]);
      body.set("ค่าแรง", submitValues["ค่าแรง"]);
      body.set("น้ำมัน", submitValues["น้ำมัน"]);
      body.set("ซ่อมรถ", submitValues["ซ่อมรถ"]);
      body.set("เครื่องจักร", submitValues["เครื่องจักร"]);
      body.set("เครื่องมือ", submitValues["เครื่องมือ"]);
      body.set("อื่นๆ", submitValues["อื่นๆ"]);
      body.set("ยอดเงิน", submitValues["ยอดเงิน"]);
      body.set("ยอดโอน", submitValues["ยอดโอน"]);
      if (submitValues["จำนวนหัก"]) body.set("จำนวนหัก", submitValues["จำนวนหัก"]);
      if (submitValues["3เปอร์"]) body.set("3เปอร์", submitValues["3เปอร์"]);
      body.set("สินค้า", submitValues["สินค้า"]);
      body.set("items", JSON.stringify(multiLineItems));
      body.delete("rows");
    }

    let hasFiles = false;

    // 1. Append all attached files from state (with automatic image compression)
    for (const [fieldName, files] of Object.entries(attachedFilesByField)) {
      const compressed = await compressImageFiles(files, 1600, 0.8);
      compressed.forEach(file => {
        if (file && file.size > 0) {
          hasFiles = true;
          body.append(fieldName, file);
        }
      });
    }

    // 2. Also fallback check any native file inputs (with automatic image compression)
    const fileInputs = Array.from(formElement.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    for (const input of fileInputs) {
      if (!attachedFilesByField[input.name]) {
        const rawFiles = Array.from(input.files || []).filter(f => f.size > 0);
        const compressed = await compressImageFiles(rawFiles, 1600, 0.8);
        compressed.forEach(file => {
          hasFiles = true;
          body.append(input.name, file);
        });
      }
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = isEditing
        ? hasFiles
          ? await fetch(submitPath, {
            method: "PATCH",
            body
          })
          : await fetch(submitPath, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tableName: activeForm.tableName, id: editSheetRow, sheetRow: editSheetRow, values: submitValues })
          })
        : await fetch(submitPath, {
          method: "POST",
          body
        });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "บันทึกไม่สำเร็จ");
      
      hasSavedDuringSession.current = true;
      clearFormSchemaCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("schema-cache-invalidated"));
        window.dispatchEvent(new CustomEvent("bills-data-updated", { detail: { row: payload.row, rows: payload.rows } }));
        window.dispatchEvent(new CustomEvent("data-updated", { detail: { tableName: activeForm.tableName, row: payload.row, rows: payload.rows } }));
      }

      setAttachedFilesByField({});

      if (isEditing) {
        setOpen(false);
        setEditSheetRow(null);
        setValues(getInitialStringValues(activeForm));
        setMultiLineItems([]);
        setIsMultiItemMode(false);
        setResetKey(k => k + 1);
        router.refresh();
      } else {
        // Reset form & verify fresh sequence from server for the next entry
        formElement.reset();

        const freshForm = await prefetchFormSchema(activeForm.tableName, true);
        if (freshForm) {
          setActiveForm(freshForm);
        }

        const lastRow = Array.isArray(payload.rows) && payload.rows.length > 0 ? payload.rows[payload.rows.length - 1] : payload.row;
        const prevSeq = String(lastRow?.["ลำดับ"] || lastRow?.["ลำดับtest"] || submitValues["ลำดับ"] || "");
        const prevSeqNum = Number(prevSeq);

        let nextSeq = freshForm?.initialValues?.["ลำดับ"] ? String(freshForm.initialValues["ลำดับ"]) : "";
        if (prevSeqNum > 0 && (!nextSeq || Number(nextSeq) <= prevSeqNum)) {
          nextSeq = String(prevSeqNum + 1);
        }

        const baseValues = freshForm ? getInitialStringValues(freshForm) : getInitialStringValues(activeForm);
        if (nextSeq && (activeForm.tableName === TABLES.DATA || activeForm.tableName === "Data" || activeForm.tableName === "bills")) {
          baseValues["ลำดับ"] = nextSeq;
        }

        setValues(baseValues);
        setMultiLineItems([]);
        setIsMultiItemMode(false);
        setEnumListSearch({});
        setAttachedFilesByField({});
        setError("");
        setSuccessMessage(
          prevSeq
            ? `บันทึกบิลลำดับที่ ${prevSeq} สำเร็จเรียบร้อย! ระบบเตรียมเลขถัดไป (#${nextSeq || Number(prevSeq) + 1}) พร้อมกรอกต่อแล้ว`
            : "บันทึกรายการเรียบร้อยแล้ว สามารถสร้างรายการถัดไปต่อได้เลย"
        );
        setResetKey(k => k + 1);

        // Scroll to the very top smoothly so user sees success alert & top of form
        setTimeout(() => {
          formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }, 50);

        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกไม่สำเร็จ");
      formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  // Pre-calculate contract & balance summary metrics for Data form
  const baseAmt = toNumber(values["ยอดเงิน"]);
  const deductVal = values["หัก"];
  const deductAmt = toNumber(values["จำนวนหัก"] || values["3เปอร์"]);
  const netTransferAmt = toNumber(values["ยอดโอน"] || values["ยอดเงิน"]);

  const isContractorBill = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
  const { originalBalance, hasContract } = parseContractRemainingLabor(values["ค่าแรงคงเหลือ"] || "");
  const currentLaborClaim = toNumber(values["ค่าแรง"]);
  const netBalanceAfter = originalBalance - currentLaborClaim;
  const isOverContract = isContractorBill && hasContract && netBalanceAfter < 0;

  return (
    <>
      {!hideLauncher ? (
        <div className={open ? "hidden" : ""}>
          <button
            type="button"
            className={
              buttonClassName ||
              "px-2.5 py-1.5 border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-2xs"
            }
            onClick={() => handleOpen()}
            onMouseEnter={() => { if (!activeForm && resolvedTableName) prefetchFormSchema(resolvedTableName); }}
            onTouchStart={() => { if (!activeForm && resolvedTableName) prefetchFormSchema(resolvedTableName); }}
          >
            {buttonIcon !== undefined ? buttonIcon : <Plus size={14} className="text-white" />}
            <span>{buttonLabel}</span>
          </button>
        </div>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/65 backdrop-blur-md sm:backdrop-blur-lg animate-in fade-in duration-150" role="presentation">
          <form
            className={`w-full bg-white rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-300 h-[92vh] sm:h-auto sm:max-h-[90vh] transition-all duration-200 ${
              relaxed ? "max-w-4xl" : "max-w-2xl sm:max-w-3xl"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-modal-title"
            aria-busy={saving || loadingSchema}
            onSubmit={submitForm}
          >
            {/* Clean Mobile App Header */}
            <header className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-white border-b border-slate-200 shrink-0">
              <div>
                <h3 id="form-modal-title" className="text-sm font-semibold text-slate-900 m-0 tracking-tight">
                  {isEditing ? title.replace(/^เพิ่ม/, "แก้ไข") : title}
                </h3>
              </div>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="ปิด"
                disabled={saving}
                onClick={handleClose}
              >
                <X size={16} />
              </button>
            </header>

            {/* Sleek Top Progress Loading Indicator when Saving */}
            {saving ? (
              <div className="h-1 w-full bg-emerald-100 overflow-hidden shrink-0">
                <div className="h-full bg-emerald-600 w-full animate-pulse" />
              </div>
            ) : null}

            {/* Form Content */}
            <div ref={formBodyRef} className="p-3 sm:p-4 overflow-y-auto overflow-x-hidden flex-1 space-y-3 bg-slate-50/70 overscroll-contain w-full min-w-0 max-w-full">
              {loadingSchema || !activeForm ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-9 h-9 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
                  <div className="text-sm text-slate-800">กำลังเตรียมฟอร์มข้อมูล...</div>
                  <div className="text-xs text-slate-500">กำลังโหลดตัวเลือกและโครงสร้างฟอร์ม</div>
                </div>
              ) : (
                <>
                  <fieldset className={`w-full min-w-0 max-w-full space-y-3 border-0 p-0 m-0 ${saving ? "pointer-events-none opacity-80" : ""}`} disabled={saving}>
                    {/* Top Notification Alerts */}
                    {successMessage ? (
                      <div className="w-full min-w-0 max-w-full p-2.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-xs flex items-start justify-between gap-2 animate-in fade-in duration-150 font-normal">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span className="break-words leading-relaxed flex-1 min-w-0">{successMessage}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSuccessMessage("")}
                          className="text-emerald-600 hover:text-emerald-800 transition cursor-pointer p-0.5 shrink-0 ml-1"
                          title="ปิดการแจ้งเตือน"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : null}

                    {error ? (
                      <div className="w-full min-w-0 max-w-full p-2.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 text-xs font-normal flex items-start justify-between gap-2 animate-in fade-in duration-150">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                          <span className="break-words leading-relaxed flex-1 min-w-0">{error}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setError("")}
                          className="text-rose-600 hover:text-rose-800 transition cursor-pointer p-0.5 shrink-0 ml-1"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : null}

                    {/* Categorized Fields Rendering for DATA form */}
                    {isDataForm ? (
                      <div className="space-y-3">
                        {DATA_FORM_SECTIONS.map(section => {
                          const isStoreVendor = values["ร้านค้า/ผู้รับเหมา"] === "ร้านค้า" || !values["ร้านค้า/ผู้รับเหมา"];
                          const isContractorVendor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา";
                          const isMultiItemAllowed = isStoreVendor || isContractorVendor;

                          const sectionFields = visibleFields.filter(f => {
                            if (f.name === "ประเภท") return false;
                            if (isMultiItemMode && isStoreVendor && (
                              f.name === "สินค้า" ||
                              f.name === "รายละเอียดงาน" ||
                              f.name === "ค่าของ" ||
                              f.name === "น้ำมัน" ||
                              f.name === "ซ่อมรถ" ||
                              f.name === "ทะเบียน" ||
                              f.name === "เครื่องจักร" ||
                              f.name === "เครื่องมือ" ||
                              f.name === "ชื่อเครื่องมือ" ||
                              f.name === "อื่นๆ" ||
                              f.name === "รายการ"
                            )) {
                              return false;
                            }
                            if (isMultiItemMode && isContractorVendor && (
                              f.name === "สินค้า" ||
                              f.name === "ค่าแรง" ||
                              f.name === "รายการ"
                            )) {
                              return false;
                            }
                            return section.fields.includes(f.name);
                          });
                          if (!sectionFields.length && (section.id !== "vendor" || !isMultiItemAllowed || !isMultiItemMode)) return null;

                          const sectionGridClass =
                            section.id === "basic"
                              ? "grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                              : section.id === "vendor"
                              ? "grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                              : section.id === "expense"
                              ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                              : section.id === "tax"
                              ? "grid grid-cols-2 sm:grid-cols-4 gap-2.5"
                              : "grid grid-cols-1 gap-2.5";

                          return (
                            <div key={section.id} className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100/90">
                                <div className="flex items-center gap-1.5">
                                  <SectionHeaderIcon name={section.iconName} />
                                  <h4 className="text-xs text-slate-800 m-0 font-semibold">{section.title}</h4>
                                </div>
                              </div>
                              <div className={sectionGridClass}>
                                {sectionFields.map(field => {
                                  const customClassName =
                                    section.id === "vendor" && field.name === "ร้านค้า"
                                      ? (isMultiItemMode ? "col-span-1 sm:col-span-2 lg:col-span-2" : "col-span-1")
                                      : section.id === "vendor" && (field.name === "ผู้รับเหมา" || field.name === "รายละเอียดงาน")
                                      ? "col-span-1"
                                      : undefined;

                                  return (
                                    <MemoizedFormField
                                      key={field.name}
                                      field={field}
                                      className={customClassName}
                                      activeForm={activeForm}
                                      value={values[field.name] || ""}
                                      currentValues={values}
                                      isEditing={isEditing}
                                      onValueChange={value => updateValue(field, value)}
                                      enumSearchValue={enumListSearch[field.name] || ""}
                                      onEnumSearchChange={value => setEnumListSearch(current => ({ ...current, [field.name]: value }))}
                                      resetKey={resetKey}
                                      attachedFiles={attachedFilesByField[field.name] || []}
                                      onAttachedFilesChange={files => setAttachedFilesByField(current => ({ ...current, [field.name]: files }))}
                                    />
                                  );
                                })}

                                {section.id === "vendor" && isMultiItemAllowed ? (
                                  <div className="col-span-1 space-y-1 min-w-0 w-full overflow-hidden">
                                    <label className="text-xs font-medium text-slate-700 block">
                                      รูปแบบรายการ
                                    </label>
                                    <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 shadow-2xs w-full h-9 sm:h-9.5">
                                      <button
                                        type="button"
                                        onClick={disableMultiItemMode}
                                        className={`flex-1 h-full px-1.5 sm:px-2 rounded-md text-[11px] sm:text-xs whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1 select-none active:scale-[0.98] ${
                                          !isMultiItemMode
                                            ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-semibold"
                                            : "text-slate-500 hover:text-slate-800 font-medium hover:bg-white/40"
                                        }`}
                                      >
                                        <span className="whitespace-nowrap">รายการเดี่ยว</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={enableMultiItemMode}
                                        className={`flex-1 h-full px-1.5 sm:px-2 rounded-md text-[11px] sm:text-xs whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1 select-none active:scale-[0.98] ${
                                          isMultiItemMode
                                            ? "bg-emerald-600 text-white shadow-2xs font-semibold"
                                            : "text-emerald-800 hover:text-emerald-950 font-medium hover:bg-emerald-50/60"
                                        }`}
                                      >
                                        <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2] shrink-0" />
                                        <span className="whitespace-nowrap">หลายรายการ</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {section.id === "expense" && !isMultiItemMode ? (
                                  <div className="space-y-1 min-w-0 w-full overflow-hidden">
                                    <label className="text-xs font-medium text-slate-500 block">
                                      สถานะคุมงบประมาณ
                                    </label>
                                    <BillCategoryBudgetGuardrail
                                      values={values}
                                      projectRows={(activeForm.refOptions["ID Project"] || activeForm.refOptions["ชื่อ Project"] || []).map(opt => opt.row).filter(Boolean) as SheetRow[]}
                                      existingBills={projectBills}
                                    />
                                  </div>
                                ) : null}

                                {section.id === "vendor" && isMultiItemAllowed && isMultiItemMode ? (
                                  <MultiLineItemsBuilder
                                    items={multiLineItems}
                                    productOptions={productOptions}
                                    vehicleOptions={vehicleOptions}
                                    toolOptions={toolOptions}
                                    otherItemOptions={otherItemOptions}
                                    storeOptions={storeOptions}
                                    onAdd={handleAddLineItem}
                                    onRemove={handleRemoveLineItem}
                                    onUpdate={handleUpdateLineItem}
                                    onUpdateStoreGroup={handleUpdateStoreGroup}
                                    onRemoveStoreGroup={handleRemoveStoreGroup}
                                    onCancel={disableMultiItemMode}
                                    projectId={values["ID Project"] || ""}
                                    projectRows={(activeForm.refOptions["ID Project"] || activeForm.refOptions["ชื่อ Project"] || []).map(opt => opt.row).filter(Boolean) as SheetRow[]}
                                    values={values}
                                    existingBills={projectBills}
                                  />
                                ) : null}
                              </div>
                            </div>
                          );
                        })}

                        {/* Catch-all for any unsectioned fields */}
                        {(() => {
                          const assignedNames = new Set(DATA_FORM_SECTIONS.flatMap(s => s.fields));
                          const unsectionedFields = visibleFields.filter(f => f.name !== "ประเภท" && !assignedNames.has(f.name));
                          if (!unsectionedFields.length) return null;
                          return (
                            <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
                              <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100/90">
                                <FileText size={15} className="text-slate-600" />
                                <h4 className="text-xs text-slate-800 m-0 font-semibold">ข้อมูลเพิ่มเติม</h4>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {unsectionedFields.map(field => (
                                  <MemoizedFormField
                                    key={field.name}
                                    field={field}
                                    activeForm={activeForm}
                                    value={values[field.name] || ""}
                                    currentValues={values}
                                    isEditing={isEditing}
                                    onValueChange={value => updateValue(field, value)}
                                    enumSearchValue={enumListSearch[field.name] || ""}
                                    onEnumSearchChange={value => setEnumListSearch(current => ({ ...current, [field.name]: value }))}
                                    resetKey={resetKey}
                                    attachedFiles={attachedFilesByField[field.name] || []}
                                    onAttachedFilesChange={files => setAttachedFilesByField(current => ({ ...current, [field.name]: files }))}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Standard Grid for Non-Data forms */
                      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-2xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {visibleFields.map(field => {
                            const isContractWorkForm =
                              activeForm.tableName === TABLES.CONTRACT_WORK ||
                              activeForm.tableName === "Contract_work" ||
                              activeForm.tableName === "contract_works" ||
                              activeForm.tableName === "งานรับเหมา";
                            const isHireAmountField = isContractWorkForm && field.name === "ยอดเงินจ้าง";

                            return (
                              <Fragment key={field.name}>
                                <div
                                  className={`${getFieldClassName(field)} min-w-0 w-full overflow-hidden`}
                                >
                                  <MemoizedFormField
                                    field={field}
                                    activeForm={activeForm}
                                    value={values[field.name] || ""}
                                    currentValues={values}
                                    isEditing={isEditing}
                                    onValueChange={value => updateValue(field, value)}
                                    enumSearchValue={enumListSearch[field.name] || ""}
                                    onEnumSearchChange={value => setEnumListSearch(current => ({ ...current, [field.name]: value }))}
                                    resetKey={resetKey}
                                    attachedFiles={attachedFilesByField[field.name] || []}
                                    onAttachedFilesChange={files => setAttachedFilesByField(current => ({ ...current, [field.name]: files }))}
                                  />
                                </div>

                                {isHireAmountField && (
                                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-col gap-2.5">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                                      <ContractLaborBudgetGuardrail
                                        projectId={values["ID Project"]}
                                        currentHireAmount={values["ยอดเงินจ้าง"]}
                                        excludeConworkId={isEditing ? String(editSheetRow || values["id_Conwork"] || "") : undefined}
                                        projectRow={
                                          activeForm.refOptions["ID Project"]?.find(
                                            opt => String(opt.value) === String(values["ID Project"]) || String(opt.label) === String(values["ID Project"])
                                          )?.row
                                        }
                                      />
                                      <ContractorQuotaGuardrail
                                        contractorId={values["id_Contractor"]}
                                        currentHireAmount={values["ยอดเงินจ้าง"]}
                                        excludeConworkId={isEditing ? String(editSheetRow || values["id_Conwork"] || "") : undefined}
                                        contractorRow={
                                          activeForm.refOptions["id_Contractor"]?.find(
                                            opt => String(opt.value) === String(values["id_Contractor"]) || String(opt.label) === String(values["id_Contractor"])
                                          )?.row
                                        }
                                      />
                                    </div>
                                  </div>
                                )}
                              </Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeForm.tableName === TABLES.PROJECT || activeForm.tableName === "Project" || activeForm.tableName === "1. Project รวม" ? (
                      <ProjectBudgetAllocator values={values} onChange={updateValueByName} defaultExpanded={false} />
                    ) : null}
                  </fieldset>
                </>
              )}
            </div>

            {/* Action Footer Bar (Mobile Full-Width Buttons & Summary) */}
            <footer className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 bg-white border-t border-slate-200 shrink-0 shadow-lg sm:shadow-none">
              {isDataForm && baseAmt > 0 ? (
                <div className="flex items-center justify-between sm:justify-start gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-sans w-full sm:w-auto min-w-0 max-w-full overflow-hidden">
                  <span className="text-slate-500 font-medium">ยอดเงิน: <strong className="text-slate-900 font-semibold">{baseAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</strong></span>
                  {deductAmt > 0 ? (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500 font-medium">หัก: <strong className="text-amber-700 font-semibold">-{deductAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</strong></span>
                    </>
                  ) : null}
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-700 font-medium">ยอดโอน: <strong className="text-emerald-700 font-semibold">{netTransferAmt.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</strong></span>
                </div>
              ) : <div />}

              <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleClose}
                  className="w-1/3 sm:w-auto h-9 sm:h-9.5 px-4 rounded-lg text-xs sm:text-sm text-slate-700 hover:bg-slate-100 border border-slate-300 bg-white transition cursor-pointer active:bg-slate-200 flex items-center justify-center font-medium"
                >
                  {hasSavedDuringSession.current ? "ปิดฟอร์ม" : "ยกเลิก"}
                </button>
                <button
                  type={submitPath ? "submit" : "button"}
                  disabled={saving || loadingSchema || !activeForm || !submitPath}
                  className="flex-1 sm:flex-initial h-9 sm:h-9.5 inline-flex items-center justify-center gap-1.5 px-5 rounded-lg text-xs sm:text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-75 transition cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>{isEditing ? "บันทึกการแก้ไข" : (isDataForm ? "บันทึกรายการบิล" : "บันทึกข้อมูล")}</span>
                    </>
                  )}
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  );
}

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
  onAttachedFilesChange: (files: File[]) => void = () => {}
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
  const type = isDateField ? "date" : field.type === "Decimal" || field.type === "Number" ? "number" : "text";
  const inputMode = field.type === "Decimal" ? "decimal" : field.type === "Number" ? "numeric" : undefined;

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
        value={isDateField ? toDateInputValue(value) : value}
        readOnly={readOnly}
        inputMode={inputMode}
        placeholder={field.placeholder}
        lang={isDateField ? "th-TH" : undefined}
        onChange={event => onChange(isDateField ? normalizeBillDateInput(event.target.value) : event.target.value)}
        className="w-full min-w-0 max-w-full block box-border h-10 sm:h-9 px-3 bg-white border border-slate-300 focus:border-slate-800 focus:outline-none rounded-lg text-xs sm:text-sm font-normal text-slate-800 placeholder:text-slate-400 transition-all appearance-none cursor-pointer"
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
  creatable = false
}: {
  name: string;
  value: string;
  options: RefOption[];
  readOnly: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  creatable?: boolean;
}) {
  const selectedOption = value ? options.find(option =>
    String(option.value) === value ||
    String(option.label) === value ||
    (option.row && (
      String(option.row.id) === value ||
      String(option.row.id_store) === value ||
      String(option.row["ชื่อร้านค้า"]) === value ||
      String(option.row.id_Contractor) === value ||
      String(option.row["ชื่อเล่น"]) === value ||
      String(option.row["ชื่อ-นามสกุล"]) === value ||
      Object.values(option.row).some(v => v !== null && v !== undefined && String(v).trim() !== "" && String(v) === value)
    ))
  ) : undefined;

  const rawLabel = selectedOption ? optionLabel(selectedOption, name) : value;
  const selectedLabel = (name === "id_Contractor" || name === "id_contractor" || name === "ผู้รับเหมา" || name === "ช่าง") && rawLabel.includes(" - ")
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
                      <div className="p-8 text-center text-slate-400 text-xs">
                        🔍 ไม่พบข้อมูลที่ตรงกับคำค้นหา
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
                      <div className="p-3 text-center text-slate-400 text-xs font-normal">
                        ไม่พบข้อมูล
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
      </div>
      {isActive ? <Check size={14} className="text-emerald-600 shrink-0 ml-1" /> : null}
    </button>
  );
}

function optionLabel(option: RefOption | undefined, fieldName?: string) {
  if (!option) return "";
  const val = String(option.value || "").trim();
  const rawLabel = String(option.label || option.value || "").trim();

  if (
    fieldName === "id_Contractor" ||
    fieldName === "id_contractor" ||
    fieldName === "ผู้รับเหมา" ||
    fieldName === "ช่าง" ||
    fieldName === "contractor" ||
    fieldName === "id_Contractor_name"
  ) {
    if (option.row) {
      const rowName = String(option.row["ชื่อเล่น"] || option.row["ผู้รับเหมา"] || option.row["ชื่อ-นามสกุล"] || "").trim();
      if (rowName) return rowName;
    }
    let clean = rawLabel;
    if (clean.includes(" - ")) {
      const parts = clean.split(" - ");
      clean = parts.slice(1).join(" - ").trim() || clean;
    }
    if (option.row?.["รายละเอียดงาน"]) {
      const details = String(option.row["รายละเอียดงาน"]).trim();
      if (details && clean.includes(`(${details})`)) {
        clean = clean.replace(`(${details})`, "").trim();
      }
    }
    return clean;
  }

  if (fieldName === "ทะเบียน" || fieldName === "ทะเบียนรถ") {
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    return rawLabel;
  }

  if (fieldName === "ผู้เบิก") {
    const loggedInId = getCookie("auth_employee_id").trim();
    const loggedInName = getCookie("auth_name").trim();
    if (loggedInName && (val === loggedInId || rawLabel.includes(loggedInId) || val === loggedInName)) {
      return loggedInName;
    }
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    return rawLabel;
  }

  if (fieldName === "ธนาคาร" || fieldName === "bank" || fieldName === "bank_name" || fieldName === "id_bank") {
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    const cleanBank = rawLabel.replace(/^Ba\d+\s*[-–—]?\s*/i, "").trim();
    if (cleanBank) return cleanBank;
    if (option.row?.["ชื่อธนาคาร"]) return String(option.row["ชื่อธนาคาร"]).trim();
    if (option.row?.name) return String(option.row.name).trim();
    return rawLabel;
  }

  if (fieldName === "ร้านค้า" || fieldName === "ร้าน/บุคคล" || fieldName?.startsWith("store_select_")) {
    if (option.row?.["ชื่อร้านค้า"]) return String(option.row["ชื่อร้านค้า"]).trim();
    if (option.row?.["ชื่อเต็ม"]) return String(option.row["ชื่อเต็ม"]).trim();
    if (rawLabel.includes(" - ")) {
      const parts = rawLabel.split(" - ");
      return parts.slice(1).join(" - ").trim() || rawLabel;
    }
    const cleanStore = rawLabel.replace(/^[A-Za-z0-9_-]+\s*[-:]\s*/, "").trim();
    if (cleanStore) return cleanStore;
    return rawLabel;
  }

  if (!val) return rawLabel;
  if (!rawLabel || rawLabel === val) return val;
  if (rawLabel.startsWith(val)) return rawLabel;
  return `${val} - ${rawLabel}`;
}

function optionSearchText(option: RefOption, fieldName?: string) {
  const rowDetails = option.row ? Object.values(option.row).filter(v => typeof v === "string" || typeof v === "number").join(" ") : "";
  return `${String(option.value || "")} ${optionLabel(option, fieldName)} ${rowDetails}`.toLowerCase();
}

/** กรองและดึง URL รูปภาพที่ถูกต้อง (HTTP/HTTPS, Data URL) */
function isValidImgUrl(url: string): string {
  return imagePreviewUrl(url);
}

function customChoiceConfig(fieldName: string) {
  if (fieldName === "vat") return { optionValue: "ระบุเอง", placeholder: "กำหนด VAT เอง" };
  if (fieldName === "หัก") return { optionValue: "ระบุเอง", placeholder: "กำหนดเปอร์เซ็นต์หักเอง" };
  if (fieldName === "เครดิต") return { optionValue: "ระบุเอง", placeholder: "กำหนดเครดิตเอง (วัน)" };
  return null;
}

function getFieldOptionLabel(fieldName: string, label: string): string {
  if (fieldName === "color" || fieldName === "COLOR") {
    const val = label.trim().toLowerCase();
    if (val === "red" || val.includes("แดง") || val.includes("ใหญ่")) return "Red (งานใหญ่)";
    if (val === "green" || val.includes("เขียว") || val.includes("เล็ก")) return "Green (งานเล็ก)";
    if (val === "black" || val.includes("ดำ") || val.includes("เสร็จ")) return "Black (งานเสร็จแล้ว)";
  }
  return label;
}

function getOptionButtonStyle(fieldName: string, optionValue: string, checked: boolean): string {
  if (fieldName === "สิทธิ์การใช้งาน") {
    const val = optionValue.trim();
    if (val.includes("เจ้าของ") || val.includes("Owner")) {
      return checked
        ? "bg-amber-500 text-white border-amber-600 shadow-xs font-semibold ring-1 ring-amber-400"
        : "bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100 font-medium";
    }
    if (val.includes("อนุมัติ") || val.includes("Approver")) {
      return checked
        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold ring-1 ring-emerald-400"
        : "bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100 font-medium";
    }
    if (val.includes("การเงิน") || val.includes("Finance") || val.includes("ปิดบิล")) {
      return checked
        ? "bg-blue-600 text-white border-blue-600 shadow-xs font-semibold ring-1 ring-blue-400"
        : "bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100 font-medium";
    }
    if (val.includes("ลบ") || val.includes("Delete")) {
      return checked
        ? "bg-slate-900 text-white border-slate-900 shadow-xs font-semibold ring-1 ring-slate-400"
        : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 font-medium";
    }
  }

  if (fieldName === "color" || fieldName === "COLOR") {
    const val = optionValue.trim().toLowerCase();
    if (val === "red" || val.includes("แดง") || val.includes("ใหญ่")) {
      return checked
        ? "bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-300"
        : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 font-medium";
    }
    if (val === "green" || val.includes("เขียว") || val.includes("เล็ก")) {
      return checked
        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300"
        : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-medium";
    }
    if (val === "black" || val.includes("ดำ") || val.includes("เสร็จ")) {
      return checked
        ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400"
        : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 font-medium";
    }
  }

  return checked
    ? "bg-slate-800 text-white border-slate-800 font-medium"
    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop()!.split(";").shift() || "");
  return "";
}

function getInitialStringValues(form: FormPayload) {
  const todayIso = getTodayDateIso();
  const values = Object.fromEntries(
    form.schema.map(field => {
      if (form.tableName === TABLES.DATA || form.tableName === "Data") {
        if (field.name === "ร้านค้า/ผู้รับเหมา") {
          return [field.name, "ร้านค้า"];
        }
        if (field.name === "ประเภท") {
          return [field.name, "101 เตรียมงาน"];
        }
      }
      if (field.initialValue === "today" || (field.type === "Date" && (field.initialValue === "today" || field.name === "ว/ด/ป" || field.name === "วันที่" || field.name === "ดู/ทำ"))) {
        return [field.name, todayIso];
      }
      return [field.name, String(form.initialValues[field.name] ?? "")];
    })
  );
  if (form.tableName === TABLES.DATA || form.tableName === "Data") {
    const loggedInEmployeeId = getCookie("auth_employee_id");
    const loggedInName = getCookie("auth_name");
    if (loggedInEmployeeId || loggedInName) {
      const requesterOptions = form.refOptions["ผู้เบิก"] || [];

      // 1. Match by logged-in display name first (e.g. "คุณแมน")
      const matchedByName = loggedInName ? requesterOptions.find(opt =>
        String(opt.label).trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
        String(opt.value).trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
        (opt.row && (
          String(opt.row["ชื่อเล่น"] || "").trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
          String(opt.row["ชื่อ-นามสกุล"] || "").trim().toLowerCase() === loggedInName.trim().toLowerCase() ||
          String(opt.row["name"] || "").trim().toLowerCase() === loggedInName.trim().toLowerCase()
        ))
      ) : undefined;

      // 2. Fallback: match by employee ID / username (e.g. "PT101")
      const matchedById = loggedInEmployeeId ? requesterOptions.find(opt =>
        String(opt.value) === loggedInEmployeeId ||
        String(opt.row?.id) === loggedInEmployeeId ||
        String(opt.row?.employee_id) === loggedInEmployeeId ||
        String(opt.row?.user_id) === loggedInEmployeeId ||
        String(opt.row?.username) === loggedInEmployeeId
      ) : undefined;

      const matchedUserOption = matchedByName || matchedById;

      if (matchedUserOption) {
        values["ผู้เบิก"] = String(matchedUserOption.value);
      } else if (loggedInName) {
        values["ผู้เบิก"] = loggedInName;
      } else if (loggedInEmployeeId) {
        values["ผู้เบิก"] = loggedInEmployeeId;
      }

      const loggedInUser = loggedInName || loggedInEmployeeId;
      if (loggedInUser) {
        values["ผู้สร้างบิล"] = loggedInUser;
      }
    }
  }
  return values;
}

function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

function getRowStringValues(form: FormPayload, row: SheetRow) {
  const values: Record<string, string> = {};

  const rawCategory = String(row["ประเภท"] || row.category || "").trim();
  const rawLaborStatus = String(row["statusค่าแรง"] || row.labor_status || "").trim();
  const hasLaborCost = Number(row["ค่าแรง"] || row.labor_cost || 0) > 0;
  const hasStaffCost = Number(row["พนักงาน"] || row.staff_cost || 0) > 0 || Boolean(row["ชื่อพนักงาน"] || row.staff_name);
  const rawVendorType = firstNonEmpty(row["ร้านค้า/ผู้รับเหมา"], row.vendor_type);

  let vendorType = "ร้านค้า";
  if (rawVendorType === "พนักงาน" || rawCategory.startsWith("3.") || rawCategory.includes("พนักงาน") || hasStaffCost) {
    vendorType = "พนักงาน";
  } else if (
    rawVendorType === "ผู้รับเหมา" ||
    Boolean(firstNonEmpty(row["ผู้รับเหมา"], row.contractor_id)) ||
    Boolean(firstNonEmpty(row["id_Conwork"], row["งานรับเหมา"])) ||
    rawCategory.startsWith("2.") ||
    rawCategory.includes("ค่าแรง") ||
    rawCategory.includes("จ้าง") ||
    Boolean(rawLaborStatus) ||
    hasLaborCost
  ) {
    vendorType = "ผู้รับเหมา";
  } else {
    vendorType = "ร้านค้า";
  }

  form.schema.forEach(field => {
    let rawVal = firstNonEmpty(
      row[field.name],
      (field.name === "รหัสพนักงาน" ? row.id : undefined),
      (field.name === "id_store" ? row.id : undefined),
      (field.name === "id_Contractor" ? row.id : undefined),
      (field.name === "id_bank" ? row.id : undefined),
      (field.name === "id_car" ? row.id : undefined),
      (field.name === "id_cus" ? row.id : undefined),
      (field.name === "id_Company" ? row.id : undefined),
      (field.name === "id_Conwork" ? row.id : undefined),
      (field.name === "ID Project" ? (row["ID Project"] || row.id || row.project_id) : undefined),
      form.initialValues[field.name]
    );

    if (form.tableName === TABLES.DATA || form.tableName === "Data") {
      if (field.name === "ร้านค้า/ผู้รับเหมา") {
        rawVal = vendorType;
      } else if (field.name === "ประเภท") {
        if (vendorType === "พนักงาน") {
          rawVal = "301 พนักงาน";
        } else if (vendorType === "ผู้รับเหมา") {
          rawVal = "201 เตรียมงาน";
        } else {
          rawVal = rawCategory || deriveCategoryFromProduct(row["สินค้า"] || row.product) || "101 เตรียมงาน";
        }
      } else if (field.name === "ร้านค้า") {
        rawVal = vendorType === "ร้านค้า" ? firstNonEmpty(row["ร้านค้า"], row.store_id, row["ร้าน/บุคคล"], row.vendor_or_person) : "";
      } else if (field.name === "ผู้รับเหมา") {
        rawVal = vendorType === "ผู้รับเหมา" ? firstNonEmpty(row["ผู้รับเหมา"], row.contractor_id, row["ร้าน/บุคคล"], row.vendor_or_person) : "";
      } else if (field.name === "ชื่อพนักงาน") {
        rawVal = vendorType === "พนักงาน" ? firstNonEmpty(row["ชื่อพนักงาน"], row.staff_name, row["ร้าน/บุคคล"], row.vendor_or_person) : "";
      } else if (field.name === "สินค้า") {
        rawVal = vendorType === "ร้านค้า" ? firstNonEmpty(row["สินค้า"], row.product, row["สินค้า/ทำงาน"], row.description, "101 เตรียมงาน") : (vendorType === "ผู้รับเหมา" ? "201 เตรียมงาน" : "301 พนักงาน");
      } else if (field.name === "รายละเอียดงาน") {
        rawVal = vendorType === "ผู้รับเหมา" ? firstNonEmpty(row["รายละเอียดงาน"], row.work_details, row["สินค้า/ทำงาน"], row.description) : "";
      } else if (field.name === "รายการ") {
        rawVal = firstNonEmpty(row["รายการ"], row.sub_category, row.item_name);
      } else if (field.name === "ชื่อเครื่องมือ") {
        rawVal = firstNonEmpty(row["ชื่อเครื่องมือ"], row.tool_name);
      } else if (field.name === "ทะเบียน") {
        rawVal = firstNonEmpty(row["ทะเบียน"], row.plate_no);
      } else if (field.name === "ชื่อพนักงาน") {
        rawVal = firstNonEmpty(row["ชื่อพนักงาน"], row.staff_name);
      } else if (field.name === "statusค่าแรง") {
        rawVal = firstNonEmpty(row["statusค่าแรง"], row.labor_status);
      } else if (["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"].includes(field.name)) {
        const rowType = String(row["ประเภท"] || row.category || "").toLowerCase();
        const rowAmount = firstNonEmpty(row[field.name], row["ยอดเงิน"], row.amount);
        if (!hasValue(rawVal) && hasValue(rowAmount) && rowType.includes(field.name.toLowerCase())) {
          rawVal = String(rowAmount);
        }
      }
    }

    if (field.name === "สิทธิ์การใช้งาน") {
      const active: string[] = [];
      const permStr = String(row["สิทธิ์การใช้งาน"] || "");
      const d = (row.data && typeof row.data === "object") ? row.data : {};
      const hasOwner = permStr.includes("Owner") || permStr.includes("เจ้าของระบบ") || Boolean(row.is_owner) || Boolean(row["เจ้าของระบบ"]) || Boolean(d.is_owner) || Boolean(d["เจ้าของระบบ"]);
      const hasApprover = permStr.includes("Approver") || permStr.includes("อนุมัติบิล") || Boolean(row.can_close_bill) || Boolean(row["อนุมัติบิล"]) || Boolean(d.can_close_bill) || Boolean(d["อนุมัติบิล"]);
      const hasFinance = permStr.includes("Finance") || permStr.includes("ฝ่ายการเงิน") || permStr.includes("ปิดบิล") || Boolean(row.can_approve) || Boolean(row["ฝ่ายการเงิน"]) || Boolean(d.can_approve) || Boolean(d["ฝ่ายการเงิน"]);
      const hasDelete = permStr.includes("Delete") || permStr.includes("ลบข้อมูล") || Boolean(row.can_delete) || Boolean(row["สิทธิ์ลบข้อมูล"]) || Boolean(d.can_delete) || Boolean(d["สิทธิ์ลบข้อมูล"]);

      if (hasOwner) active.push("เจ้าของระบบ (Owner)");
      if (hasApprover) active.push("อนุมัติบิล (Approver)");
      if (hasFinance) active.push("ฝ่ายการเงิน (Finance)");
      if (hasDelete) active.push("ลบข้อมูล (Delete)");

      rawVal = active.join(", ");
    } else if (field.name === "LINE User ID" || field.name === "LINE") {
      const d = (row.data && typeof row.data === "object") ? row.data : {};
      rawVal = String(row["LINE User ID"] || row["LINE"] || row.line_user_id || d.line_user_id || d["LINE User ID"] || d["LINE"] || "").trim();
    }

    if ((field.name === "vat" || field.name === "หัก" || field.name === "เครดิต") && (rawVal === "0" || rawVal === "0.00" || String(rawVal) === "0")) {
      rawVal = "";
    }

    if (field.type === "Date" && rawVal) {
      values[field.name] = toInputDateValue(rawVal);
    } else if (field.type === "Ref" && rawVal) {
      const options = form.refOptions[field.name] || [];
      const match = options.find(opt =>
        String(opt.value) === rawVal ||
        String(opt.label) === rawVal ||
        (opt.row && (
          String(opt.row.id) === rawVal ||
          String(opt.row.id_store) === rawVal ||
          String(opt.row.id_Conwork) === rawVal ||
          String(opt.row["ชื่อร้านค้า"]) === rawVal ||
          String(opt.row["ชื่อเล่น"]) === rawVal ||
          String(opt.row["ชื่อ-นามสกุล"]) === rawVal ||
          Object.values(opt.row).some(v => String(v) === rawVal)
        ))
      );
      values[field.name] = match ? String(match.value) : rawVal;
    } else if (field.name === "สินค้า" && rawVal) {
      const enumOpts = field.values || [];
      const match = enumOpts.find(opt => opt === rawVal || opt.endsWith(rawVal) || rawVal.endsWith(opt) || opt.includes(rawVal));
      values[field.name] = match || rawVal;
    } else if (field.name === "รายการ" && rawVal) {
      const enumOpts = field.values || [];
      const match = enumOpts.find(opt => opt === rawVal || opt.trim() === rawVal.trim());
      values[field.name] = match || rawVal;
    } else {
      values[field.name] = rawVal;
    }
  });

  // Preserve any extra budget or custom properties from row and row.data
  if (row && typeof row === "object") {
    Object.entries(row).forEach(([k, v]) => {
      if (k.startsWith("งบไม่เกิน") || k === "คุมงบประเภทงาน") {
        if (v !== undefined && v !== null && (values[k] === undefined || values[k] === "")) {
          values[k] = String(v);
        }
      }
    });
    if (row.data && typeof row.data === "object") {
      Object.entries(row.data).forEach(([k, v]) => {
        if (k.startsWith("งบไม่เกิน") || k === "คุมงบประเภทงาน") {
          if (v !== undefined && v !== null && (values[k] === undefined || values[k] === "")) {
            values[k] = String(v);
          }
        }
      });
    }
  }

  return values;
}

function splitEnumListValue(value: string) {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function getFieldOptions(field: FieldSchema, form: FormPayload, values: Record<string, string>) {
  if (field.type === "Ref") {
    return filterRefOptions(field, form.refOptions[field.name] || [], values);
  }

  if (field.name === "สินค้า" || field.dynamicValues === "productCategoryOptions") {
    const vType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
    if (vType === "ผู้รับเหมา") {
      return LABOR_CATEGORY_OPTIONS.map(c => ({ value: c, label: c }));
    }
    if (vType === "พนักงาน") {
      return STAFF_CATEGORY_OPTIONS.map(c => ({ value: c, label: c }));
    }
    return ALL_STORE_CATEGORIES.map(c => ({ value: c, label: c }));
  }

  if (field.name === "รายการ") {
    const isLabor = values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา" || isLaborCost(values["ประเภท"]) || values["สินค้า"]?.startsWith("223");
    const subList = isLabor ? SUB_ITEMS_223 : SUB_ITEMS_123;
    return subList.map(v => ({ value: v, label: v }));
  }

  return getEnumValues(field, values).map(value => ({ value, label: value }));
}

function filterRefOptions(field: FieldSchema, options: RefOption[], values: Record<string, string>) {
  if (!field.filterBy) return options;
  const expectedValue = String(values[field.filterBy.field] || "").trim();
  // หากยังไม่ได้เลือกข้อมูลหลักที่ต้องกรองตาม (เช่น ยังไม่ได้เลือก ID Project) จะไม่แสดงรายชื่อผู้รับเหมา
  if (!expectedValue) return [];

  const currentValue = String(values[field.name] || "").trim();

  return options.filter(option => {
    const rowVal = String(option.row?.[field.filterBy!.column] ?? "").trim();
    if (rowVal !== expectedValue) return false;

    // หากเป็นค่าเดิมที่ถูกเลือกไว้ในบิลปัจจุบัน ให้แสดงเสมอแม้สัญญาจะจ่ายครบแล้ว
    if (currentValue && (String(option.value) === currentValue || String(option.label) === currentValue)) {
      return true;
    }

    if (!field.filterBy!.openContract) return true;
    return toNumber(option.row?.["ยอดเงินจ้าง"]) > toNumber(option.row?.["ยอดเงินจ่าย"]);
  });
}

const ALL_EXPENSE_FIELDS = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];

function transferAmountToCategory(values: Record<string, string>, targetCategory: string) {
  const targetField = getExpenseFieldForCategory(targetCategory);
  if (!targetField) return;

  // หากช่องปลายทางมียอดเงินอยู่แล้ว ไม่ต้องเขียนทับ
  if (hasValue(values[targetField])) return;

  // ค้นหายอดเงินเดิมจากช่องหมวดอื่นๆ เพื่อย้ายมาช่องใหม่
  const sourceField = ALL_EXPENSE_FIELDS.find(f => f !== targetField && hasValue(values[f]));
  if (sourceField) {
    values[targetField] = values[sourceField];
    values[sourceField] = "";
  }
}

function getEnumValues(field: FieldSchema, values: Record<string, string>) {
  const defaultValues = field.values || [];
  if (field.dynamicValues !== "billTypeOptions" || !field.dynamicOptionSets) return defaultValues;

  let dynamicList: string[] = [];
  if (values["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา") {
    dynamicList = field.dynamicOptionSets.contractor || [];
  } else if (isFuelProduct(values["สินค้า"]) || isMachineProduct(values["สินค้า"]) || isCarRepairProduct(values["สินค้า"])) {
    dynamicList = field.dynamicOptionSets.storeDefault || [];
  } else if (isOtherExpenseProduct(values["สินค้า"])) {
    dynamicList = field.dynamicOptionSets.storeWithItem || ALL_STORE_CATEGORIES;
  } else if (hasValue(values["สินค้า"])) {
    dynamicList = field.dynamicOptionSets.storeWithItem || [];
  } else {
    dynamicList = field.dynamicOptionSets.storeDefault || [];
  }

  return dynamicList.length > 0 ? dynamicList : defaultValues;
}

function calculateDueDate(baseDateStr: string, days: number): string {
  const parsed = parseDateStrict(baseDateStr);
  if (!parsed || isNaN(days) || days <= 0) return "";
  const dt = new Date(parsed.year, parsed.month - 1, parsed.day);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseCreditCutoffDay(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (!str || str === "-" || str === "0") return 0;
  const match = str.match(/\d+/);
  if (!match) return 0;
  const day = parseInt(match[0], 10);
  return day >= 1 && day <= 31 ? day : 0;
}

function calculateMonthlyCutoffDueDate(baseDateStr: string, cutoffDay: number): string {
  const parsed = parseDateStrict(baseDateStr);
  if (!parsed || isNaN(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) return "";
  
  let targetYear = parsed.year;
  let targetMonth = parsed.month; // 1-12
  
  // หากวันที่ซื้อ มากกว่า วันตัดรอบจ่าย (เช่น ซื้อวันที่ 20 แต่วันตัดรอบคือ 16) -> จ่ายวันที่ 16 ของเดือนถัดไป
  if (parsed.day > cutoffDay) {
    if (targetMonth === 12) {
      targetYear += 1;
      targetMonth = 1;
    } else {
      targetMonth += 1;
    }
  }
  // หากวันที่ซื้อ น้อยกว่าหรือเท่ากับ วันตัดรอบจ่าย (เช่น ซื้อวันที่ 1 แต่วันตัดรอบคือ 16) -> จ่ายวันที่ 16 ของเดือนเดียวกัน
  
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(cutoffDay, daysInMonth);
  
  const y = targetYear;
  const m = String(targetMonth).padStart(2, "0");
  const d = String(targetDay).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDependentValues(values: Record<string, string>, changedField: string, form: FormPayload) {
  // Contractor Form: เมื่อเปลี่ยนประเภท ให้ auto-set วงเงินจำกัดยอด/ปี
  const isContractorForm = form.tableName === TABLES.CONTRACTOR || form.tableName === "contractors" || form.tableName === "รับเหมา" || form.tableName === "5. รับเหมา";
  if (isContractorForm && changedField === "ประเภท") {
    if (values["ประเภท"] === "นิติบุคคล") {
      const cur = toNumber(values["จำกัดยอด/ปี"]);
      if (cur <= 1_200_000) values["จำกัดยอด/ปี"] = "2000000";
    } else if (values["ประเภท"] === "บุคคลธรรมดา") {
      values["จำกัดยอด/ปี"] = "1200000";
    }
  }

  if (changedField === "ID Project") {
    // เมื่อเปลี่ยนหรือล้าง ID Project ให้รีเซ็ตผู้รับเหมาและรายละเอียดสัญญาเดิม
    values["ผู้รับเหมา"] = "";
    values["รายละเอียดงาน"] = "";
    values["ค่าแรงคงเหลือ"] = "";
  }

  if (changedField === "ร้านค้า/ผู้รับเหมา") {
    const vType = values["ร้านค้า/ผู้รับเหมา"];
    if (vType === "ร้านค้า") {
      values["ผู้รับเหมา"] = "";
      values["รายละเอียดงาน"] = "";
      values["ค่าแรงคงเหลือ"] = "";
      values["ชื่อพนักงาน"] = "";
      values["statusค่าแรง"] = "";
      if (!values["สินค้า"] || !ALL_STORE_CATEGORIES.includes(values["สินค้า"])) {
        values["สินค้า"] = "101 เตรียมงาน";
      }
      const derived = deriveCategoryFromProduct(values["สินค้า"]);
      values["ประเภท"] = derived;
      transferAmountToCategory(values, derived);
    } else if (vType === "พนักงาน") {
      values["ร้านค้า"] = "";
      values["ผู้รับเหมา"] = "";
      values["รายละเอียดงาน"] = "";
      values["ค่าแรงคงเหลือ"] = "";
      values["statusค่าแรง"] = "";
      values["สินค้า"] = "301 พนักงาน";
      values["ประเภท"] = "301 พนักงาน";
      transferAmountToCategory(values, "301 พนักงาน");
    } else if (vType === "ผู้รับเหมา") {
      values["ร้านค้า"] = "";
      values["ชื่อพนักงาน"] = "";
      if (!values["สินค้า"] || !LABOR_CATEGORY_OPTIONS.includes(values["สินค้า"])) {
        values["สินค้า"] = "201 เตรียมงาน";
      }
      values["ประเภท"] = values["สินค้า"] || "201 เตรียมงาน";
      transferAmountToCategory(values, values["ประเภท"]);
    }
  }

  // หากเลือกร้านค้า และร้านค้านั้นมี "เครดิตจ่าย" (วันตัดรอบประจำเดือน เช่น วันที่ 16)
  if (changedField === "ร้านค้า" && hasValue(values["ร้านค้า"])) {
    const storeOption = (form.refOptions?.["ร้านค้า"] || []).find(opt => opt.value === values["ร้านค้า"]);
    const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
    const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
    if (storeCutoffDay > 0) {
      const baseDate = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();
      const cutoffDueDate = calculateMonthlyCutoffDueDate(baseDate, storeCutoffDay);
      if (cutoffDueDate) {
        values["วันจ่าย"] = cutoffDueDate;
      }
    }
  }

  if (changedField === "สินค้า") {
    const selectedProd = String(values["สินค้า"] || "").trim();
    const vType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
    if (vType === "ร้านค้า") {
      const derived = deriveCategoryFromProduct(selectedProd);
      values["ประเภท"] = derived;
      transferAmountToCategory(values, derived);
    } else if (vType === "ผู้รับเหมา") {
      values["ประเภท"] = selectedProd || "201 เตรียมงาน";
      transferAmountToCategory(values, selectedProd || "201 เตรียมงาน");
    } else if (vType === "พนักงาน") {
      values["ประเภท"] = "301 พนักงาน";
      transferAmountToCategory(values, "301 พนักงาน");
    }
  }

  if (changedField === "ประเภท") {
    const selectedCat = String(values["ประเภท"] || "").trim();
    if (selectedCat) {
      transferAmountToCategory(values, selectedCat);
    }

    // ถ้าผู้ใช้กดเลือกหมวด แต่สินค้าเดิมไม่ตรง ให้เคลียร์สินค้าออก
    if (isFuelCost(selectedCat) && hasValue(values["สินค้า"]) && !isFuelProduct(values["สินค้า"])) {
      values["สินค้า"] = "";
    } else if (isRepairCost(selectedCat) && hasValue(values["สินค้า"]) && !isCarRepairProduct(values["สินค้า"])) {
      values["สินค้า"] = "";
    } else if (isMachineCost(selectedCat) && hasValue(values["สินค้า"]) && !isMachineProduct(values["สินค้า"])) {
      values["สินค้า"] = "";
    } else if (isOtherExpense(selectedCat) && hasValue(values["สินค้า"]) && !isOtherExpenseProduct(values["สินค้า"])) {
      if (isFuelProduct(values["สินค้า"]) || isMachineProduct(values["สินค้า"]) || isCarRepairProduct(values["สินค้า"])) {
        values["สินค้า"] = "";
      }
    } else if (
      (isMaterialCost(selectedCat) || isToolCost(selectedCat)) &&
      (isFuelProduct(values["สินค้า"]) || isMachineProduct(values["สินค้า"]) || isCarRepairProduct(values["สินค้า"]) || isOtherExpenseProduct(values["สินค้า"]))
    ) {
      values["สินค้า"] = "";
    }
  }

  if (changedField === "ชื่อเครื่องมือ") {
    if (hasValue(values["ชื่อเครื่องมือ"])) {
      if (!isToolCost(values["ประเภท"])) {
        values["ประเภท"] = "504 เครื่องมือ";
        transferAmountToCategory(values, "504 เครื่องมือ");
      }
    }
  }

  if (changedField === "ผู้รับเหมา") {
    if (hasValue(values["ผู้รับเหมา"])) {
      if (!values["ประเภท"] || isMaterialCost(values["ประเภท"])) {
        values["ประเภท"] = "201 เตรียมงาน";
        transferAmountToCategory(values, "201 เตรียมงาน");
      }
      const conOption = (form.refOptions?.["ผู้รับเหมา"] || []).find(opt => opt.value === values["ผู้รับเหมา"]);
      const conType = String(conOption?.row?.["ประเภท"] || conOption?.row?.["statusค่าแรง"] || "");
      if (conType) {
        if (conType.includes("นิติบุคคล") || conType.includes("บริษัท")) {
          values["statusค่าแรง"] = "บริษัท";
        } else if (conType.includes("บุคคล")) {
          values["statusค่าแรง"] = "บุคคลธรรมดา";
        }
      }
    }
  }

  if (changedField === "vat" && !isVatActive(values["vat"])) {
    values["วันได้บิล"] = "";
    values["เครดิต"] = "";
    values["วันจ่าย"] = "";
  }

  // หากเลือกเครดิต จะเคลียข้อมูลวันที่ได้บิล และคำนวณวันจ่ายจาก ว/ด/ป (หรือ วันที่) + เครดิต
  if (changedField === "เครดิต") {
    const storeOption = (form.refOptions?.["ร้านค้า"] || []).find(opt => opt.value === values["ร้านค้า"]);
    const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
    const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
    const baseDate = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();

    if (storeCutoffDay > 0) {
      values["วันได้บิล"] = "";
      const cutoffDueDate = calculateMonthlyCutoffDueDate(baseDate, storeCutoffDay);
      if (cutoffDueDate) {
        values["วันจ่าย"] = cutoffDueDate;
      }
    } else {
      const creditDays = parseCreditDays(values["เครดิต"]);
      if (creditDays > 0) {
        values["วันได้บิล"] = ""; // เคลียร์ข้อมูลวันที่ได้บิลทันที
        const dueDate = calculateDueDate(baseDate, creditDays);
        if (dueDate) {
          values["วันจ่าย"] = dueDate;
        }
      } else {
        values["วันจ่าย"] = "";
      }
    }
  }

  if (changedField === "หัก" && !hasValue(values["หัก"])) {
    values["จำนวนหัก"] = "";
    values["วันออก 3%"] = "";
  }

  // Auto-calculate "วันจ่าย" from "ว/ด/ป" (หรือ วันที่) + ร้านค้า เครดิตจ่าย หรือ เครดิต (วัน)
  if (changedField === "ว/ด/ป" || changedField === "วันที่") {
    const storeOption = (form.refOptions?.["ร้านค้า"] || []).find(opt => opt.value === values["ร้านค้า"]);
    const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
    const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
    const baseDate = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();

    if (storeCutoffDay > 0) {
      const cutoffDueDate = calculateMonthlyCutoffDueDate(baseDate, storeCutoffDay);
      if (cutoffDueDate) {
        values["วันจ่าย"] = cutoffDueDate;
      }
    } else {
      const creditDays = parseCreditDays(values["เครดิต"]);
      if (creditDays > 0) {
        if (hasValue(baseDate)) {
          const dueDate = calculateDueDate(baseDate, creditDays);
          if (dueDate) {
            values["วันจ่าย"] = dueDate;
          }
        }
      }
    }
  }

  if (form.tableName !== TABLES.DATA && form.tableName !== "Data") {
    const typeField = form.schema.find(field => field.name === "ประเภท");
    if (typeField && values["ประเภท"] && !getEnumValues(typeField, values).includes(values["ประเภท"])) {
      values["ประเภท"] = "";
    }
  }
}

function parseCreditDays(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim();
  if (str === "เงินสด" || str === "ไม่มี" || str === "0" || str === "" || str === "false") return 0;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function parseDeductPercent(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim().toLowerCase();
  if (!str || str === "-" || str === "0" || str === "0%" || str === "false" || str.includes("ไม่มี")) return 0;
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

function isDeductActive(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toLowerCase();
  if (!str || str === "-" || str === "0" || str === "0%" || str === "false" || str.includes("ไม่มี")) return false;
  return parseDeductPercent(value) > 0 || str.includes("หัก");
}

function applyLocalFormulas(values: Record<string, string>, tableName: string) {
  if (tableName === TABLES.PROJECT || tableName === "Project" || tableName === "1. Project รวม") {
    if (hasValue(values["ยอดงาน"])) {
      const workNum = toNumber(values["ยอดงาน"]);
      const vatTotal = Math.round(workNum * 1.07 * 100) / 100;
      values["ยอดรวม vat"] = String(vatTotal);
    }
    return;
  }
  if (tableName === TABLES.DATA) {
    applyBillDeductAmount(values);
    return;
  }
  if (tableName !== TABLES.CONTRACT_WORK) return;
  const hireAmount = toNumber(values["ยอดเงินจ้าง"]);
  const paidAmount = toNumber(values["ยอดเงินจ่าย"]);
  if (hasValue(values["ยอดเงินจ้าง"]) || hasValue(values["ยอดเงินจ่าย"])) {
    values["ยอดเงินจ่าย"] = String(paidAmount);
    values["ค่าแรงคงเหลือ"] = String(hireAmount - paidAmount);
  }
}

function parseContractRemainingLabor(rawVal: string): { originalBalance: number; hasContract: boolean } {
  if (!rawVal) return { originalBalance: 0, hasContract: false };
  const firstPart = rawVal.split("จาก")[0] || rawVal;
  const num = toNumber(firstPart);
  return { originalBalance: num, hasContract: true };
}

function isVatActive(vatValue: unknown): boolean {
  if (vatValue === null || vatValue === undefined) return false;
  const str = String(vatValue).trim().toLowerCase();
  return str !== "" && str !== "0" && str !== "0.00" && str !== "0%" && str !== "ไม่มี" && str !== "ไม่มี vat" && str !== "false" && str !== "no";
}

function applyBillDeductAmount(values: Record<string, string>) {
  // Sum up active expense breakdown categories (EXCLUDE "ค่าแรงคงเหลือ"!)
  const expenseFields = ["ค่าของ", "ค่าแรง", "พนักงาน", "น้ำมัน", "ซ่อมรถ", "เครื่องจักร", "เครื่องมือ", "อื่นๆ"];
  const totalExpense = expenseFields.reduce((sum, field) => sum + toNumber(values[field]), 0);
  const baseAmount = totalExpense > 0 ? totalExpense : toNumber(values["ยอดเงิน"]);

  if (baseAmount > 0) {
    values["ยอดเงิน"] = String(baseAmount);
  }

  const deductValue = values["หัก"];
  const deductPercent = parseDeductPercent(deductValue);
  let deductAmount = 0;

  const hasVat = isVatActive(values["vat"]);
  const hasDeduct = isDeductActive(deductValue) && deductPercent > 0;

  if (!hasDeduct) {
    values["จำนวนหัก"] = "";
    values["3เปอร์"] = "";
    deductAmount = 0;
  } else {
    // If VAT is active (7% included in baseAmount), calculate deduction on pre-VAT amount
    if (hasVat) {
      const preVatAmount = baseAmount / 1.07;
      deductAmount = (preVatAmount * deductPercent) / 100;
    } else {
      // If NO VAT selected, calculate deduction directly on baseAmount (e.g. 3% of baseAmount)
      deductAmount = (baseAmount * deductPercent) / 100;
    }
    values["จำนวนหัก"] = deductAmount > 0 ? formatDecimal(deductAmount) : "";
    values["3เปอร์"] = values["จำนวนหัก"];
  }

  let netTransfer = baseAmount;

  if (hasVat && hasDeduct) {
    netTransfer = baseAmount - deductAmount;
  } else if (hasDeduct) {
    // Withholding Tax without VAT: baseAmount - deductAmount (e.g. 20,000 - 600 = 19,400)
    netTransfer = baseAmount - deductAmount;
  } else {
    netTransfer = baseAmount;
  }

  values["ยอดโอน"] = netTransfer > 0 ? formatDecimal(netTransfer) : (baseAmount > 0 ? String(baseAmount) : "");

  // Auto-calculate "วันจ่าย" from "วันได้บิล" (or "ว/ด/ป") + "เครดิต"
  const creditDays = parseCreditDays(values["เครดิต"]);
  if (creditDays > 0) {
    const baseDate = values["วันได้บิล"] || values["ว/ด/ป"] || values["วันที่"];
    if (hasValue(baseDate)) {
      const dueDate = calculateDueDate(baseDate, creditDays);
      if (dueDate) {
        values["วันจ่าย"] = dueDate;
      }
    }
  }
}

function applyRefFill(values: Record<string, string>, field: FieldSchema, form: FormPayload, value: string) {
  if (field.type !== "Ref" || !field.refFill) return;
  const selectedOption = (form.refOptions[field.name] || []).find(option => String(option.value) === value);
  Object.entries(field.refFill).forEach(([targetField, sourceColumn]) => {
    if (sourceColumn.includes("{")) {
      values[targetField] = selectedOption ? sourceColumn.replace(/\{([^}]+)\}/g, (_, key) => {
        const val = selectedOption.row?.[key];
        if (typeof val === "number") return new Intl.NumberFormat("th-TH").format(val);
        if (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "") return new Intl.NumberFormat("th-TH").format(Number(val));
        return String(val ?? "");
      }) : "";
    } else {
      values[targetField] = selectedOption ? String(selectedOption.row?.[sourceColumn] ?? "") : "";
    }
  });
}

function sanitizeValuesForSubmit(values: Record<string, string>, form: FormPayload) {
  const next = { ...values };
  pruneHiddenConditionalValues(next, form);
  applyLocalFormulas(next, form.tableName);
  if (form.tableName === TABLES.DATA || form.tableName === "Data" || form.tableName === "bills") {
    const vType = String(next["ร้านค้า/ผู้รับเหมา"] || "").trim();
    if (vType === "พนักงาน") {
      next["ประเภท"] = "301 พนักงาน";
      if (next["ชื่อพนักงาน"]) {
        next["ร้าน/บุคคล"] = next["ชื่อพนักงาน"];
      }
      next["ผู้รับเหมา"] = "";
      next["ร้านค้า"] = "";
    } else if (vType === "ผู้รับเหมา") {
      if (!next["ประเภท"] || next["ประเภท"] === "2.ค่าแรง" || !ALL_CONTRACTOR_CATEGORIES.includes(next["ประเภท"])) {
        next["ประเภท"] = "201 เตรียมงาน";
      }
      next["ร้านค้า"] = "";
      next["ชื่อพนักงาน"] = "";
    } else {
      next["ร้านค้า/ผู้รับเหมา"] = "ร้านค้า";
      next["ผู้รับเหมา"] = "";
      next["ชื่อพนักงาน"] = "";
      if (!next["ประเภท"] || next["ประเภท"] === "1.ค่าของ") {
        next["ประเภท"] = deriveCategoryFromProduct(next["สินค้า"]) || "101 เตรียมงาน";
      }
    }
  }
  return next;
}

function isFieldRequired(field: FieldSchema, values: Record<string, string>, tableName?: string): boolean {
  if (!field.required) return false;
  if (field.type === "Hidden" || field.readonly) return false;

  const vendorType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
  if (field.name === "ร้านค้า") {
    return vendorType === "ร้านค้า";
  }
  if (field.name === "ผู้รับเหมา") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "ชื่อพนักงาน") {
    return vendorType === "พนักงาน";
  }
  if (field.name === "ประเภท") {
    return false;
  }

  return true;
}

function validateVisibleRequiredFields(values: Record<string, string>, form: FormPayload) {
  const missingField = form.schema.find(field => {
    if (!isFieldRequired(field, values, form.tableName)) return false;
    if (!isFieldVisible(field, values)) return false;
    return !hasValue(values[field.name]);
  });

  return missingField ? `กรุณากรอก ${getFieldLabel(missingField)}` : "";
}

function pruneHiddenConditionalValues(values: Record<string, string>, form: FormPayload) {
  form.schema.forEach(field => {
    if (field.type === "Hidden" || field.name === "ประเภท" || field.name.startsWith("งบไม่เกิน") || field.name === "คุมงบประเภทงาน") return;
    if (isFieldVisible(field, values)) return;
    values[field.name] = "";
  });
}

function isFieldVisible(field: FieldSchema, values: Record<string, string>) {
  const vendorType = values["ร้านค้า/ผู้รับเหมา"] || "ร้านค้า";
  const cat = values["ประเภท"] || "";

  // 1. Vendor / Contractor / Staff specific fields
  if (field.name === "ร้านค้า") {
    return vendorType === "ร้านค้า";
  }
  if (field.name === "สินค้า") {
    return true;
  }
  if (field.name === "ผู้รับเหมา" || field.name === "รายละเอียดงาน" || field.name === "ค่าแรงคงเหลือ") {
    return vendorType === "ผู้รับเหมา";
  }
  if (field.name === "ชื่อพนักงาน") {
    return vendorType === "พนักงาน" || isStaffCost(cat);
  }

  // 2. Expense amounts & specifics
  if (field.name === "ค่าแรง" || field.name === "statusค่าแรง") {
    return vendorType === "ผู้รับเหมา" || isLaborCost(cat);
  }
  if (field.name === "พนักงาน") {
    return vendorType === "พนักงาน" || isStaffCost(cat);
  }
  if (field.name === "น้ำมัน") {
    return isFuelCost(cat);
  }
  if (field.name === "ซ่อมรถ") {
    return isRepairCost(cat);
  }
  if (field.name === "ทะเบียน") {
    return (
      isFuelCost(cat) ||
      isRepairCost(cat) ||
      values["has_fuel_or_repair"] === "true" ||
      Number(values["น้ำมัน"] || 0) > 0 ||
      Number(values["ซ่อมรถ"] || 0) > 0
    );
  }
  if (field.name === "เครื่องจักร") {
    return isMachineCost(cat);
  }
  if (field.name === "เครื่องมือ" || field.name === "ชื่อเครื่องมือ") {
    return isToolCost(cat);
  }
  if (field.name === "อื่นๆ") {
    return vendorType === "ร้านค้า" && isOtherExpense(cat);
  }
  if (field.name === "รายการ") {
    return isOtherExpense(cat);
  }
  if (field.name === "ค่าของ") {
    return vendorType === "ร้านค้า" && (!cat || isMaterialCost(cat));
  }

  // 3. Tax / Credit
  if (field.name === "วันได้บิล") {
    const hasVat = isVatActive(values["vat"]);
    const hasCredit = parseCreditDays(values["เครดิต"]) > 0;
    return hasVat && !hasCredit;
  }
  if (field.name === "vat") {
    return vendorType === "ร้านค้า" || (vendorType === "ผู้รับเหมา" && values["statusค่าแรง"] === "บริษัท");
  }
  if (field.name === "เครดิต") {
    return vendorType === "ร้านค้า" || isVatActive(values["vat"]) || parseCreditDays(values["เครดิต"]) > 0;
  }
  if (field.name === "วันจ่าย") {
    return Boolean(values["วันจ่าย"] || parseCreditDays(values["เครดิต"]) > 0 || hasValue(values["เครดิต"]));
  }
  if (field.name === "หัก") {
    return vendorType === "ผู้รับเหมา" || isLaborCost(cat) || isOtherExpense(cat);
  }

  if (!field.showIf) return true;
  const actual = values[field.showIf.column] || "";
  if (field.showIf.equals !== undefined) return actual === field.showIf.equals;
  if (field.showIf.in) return field.showIf.in.includes(actual);
  if (field.showIf.notBlank) {
    if (field.showIf.column === "vat") return isVatActive(actual);
    if (field.showIf.column === "หัก") return parseDeductPercent(actual) > 0;
    if (field.showIf.column === "เครดิต") return parseCreditDays(actual) > 0;
    return hasValue(actual);
  }
  return true;
}

function getFieldClassName(field: FieldSchema, values?: Record<string, string>) {
  const vendorType = values?.["ร้านค้า/ผู้รับเหมา"];

  if (field.name === "ผู้รับเหมา" || field.name === "รายละเอียดงาน") {
    // แสดง 1 คอลัมน์ เพื่อให้อยู่ข้างกันในแถวเดียวกับรูปแบบรายการ (1 + 1 + 1 = 3 คอลัมน์)
    return "col-span-1";
  }
  if (
    field.type === "LongText" ||
    field.type === "Image" ||
    field.type === "File" ||
    field.type === "EnumList" ||
    field.name === "ร้านค้า/ผู้รับเหมา"
  ) {
    return "col-span-full";
  }
  if (field.name === "สินค้า" && vendorType === "ผู้รับเหมา") {
    // เมื่อเป็นผู้รับเหมา ให้ช่อง "ประเภทงาน (ผู้รับเหมา)" ขยายเต็มแถว
    return "col-span-full";
  }
  if (
    field.name === "ID Project" ||
    field.name === "ชื่อ Project" ||
    field.name === "ร้านค้า" ||
    field.name === "ชื่อพนักงาน" ||
    field.name === "ประเภท"
  ) {
    return "col-span-1 sm:col-span-2 lg:col-span-2";
  }
  return "col-span-1";
}

function getFieldLabel(field: FieldSchema, values?: Record<string, string>) {
  if (field.label) return field.label;
  if (field.name === "น้ำมัน" || field.name === "ซ่อมรถ" || field.name === "เครื่องจักร" || field.name === "เครื่องมือ" || field.name === "ค่าของ" || field.name === "อื่นๆ") {
    return "ค่าใช้จ่าย";
  }
  if (field.name === "ร้านค้า/ผู้รับเหมา") return "ประเภทค่าใช้จ่าย";
  if (field.name === "สินค้า") {
    const vType = values?.["ร้านค้า/ผู้รับเหมา"];
    if (vType === "ผู้รับเหมา") return "ประเภทงาน (ผู้รับเหมา)";
    if (vType === "พนักงาน") return "ประเภทงาน (พนักงาน)";
    return "ประเภทสินค้า";
  }
  if (field.name === "พนักงาน") return "ยอดเงิน (พนักงาน)";
  if (field.name === "LINE User ID" || field.name === "LINE") return "LINE User ID (ไอดีไลน์สำหรับแจ้งเตือน)";
  if (field.name === "วันออก 3%") return "วันออก";
  if (field.name === "id_Contractor" || field.name === "id_contractor") return "ผู้รับเหมา";
  if (field.name === "id_Conwork" || field.name === "id_conwork") return "รหัสสัญญา";
  if (field.name === "color" || field.name === "COLOR") return "color (ประเภทงาน)";
  return field.name;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toDateInputValue(value: string) {
  return toInputDateValue(value);
}

function normalizeBillDateInput(value: string) {
  return normalizeDateToIso(value);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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
          onAttachedFilesChange
        )}
      </div>
    );
  }

  return (
    <div className={`${className || getFieldClassName(field, currentValues)} space-y-1 min-w-0 w-full overflow-hidden`} key={field.name}>
      <label className="text-xs font-medium text-slate-700 block">
        {getFieldLabel(field, currentValues)}
        {isRequired ? <span className="text-rose-600 font-medium ml-0.5">*</span> : ""}
      </label>
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
        onAttachedFilesChange
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.field === next.field &&
    prev.value === next.value &&
    prev.isEditing === next.isEditing &&
    prev.className === next.className &&
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

