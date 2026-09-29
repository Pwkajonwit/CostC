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

export type { FormPayload, FormModalProps, OpenFormDetail, MultiLineItem } from "./form-types";
export { clearFormSchemaCache, prefetchFormSchema, formSchemaCache, formSchemaInFlight } from "./form-types";
export * from "./form-helpers";
export * from "./form-field";
export { PettyCashFormModal } from "./PettyCashFormModal";
import { MemoizedFormField, renderField, SearchableRefSelect, DropdownOption, VendorExpenseSelector, EnumListFieldInput, ImageFileFieldInput } from "./form-field";
import type { FormPayload, FormModalProps, OpenFormDetail, MultiLineItem } from "./form-types";
import { clearFormSchemaCache, prefetchFormSchema, formSchemaCache } from "./form-types";
import {
  optionLabel,
  optionSearchText,
  isValidImgUrl,
  customChoiceConfig,
  getFieldOptionLabel,
  getOptionButtonStyle,
  getCookie,
  getInitialStringValues,
  firstNonEmpty,
  getRowStringValues,
  splitEnumListValue,
  getFieldOptions,
  filterRefOptions,
  ALL_EXPENSE_FIELDS,
  transferAmountToCategory,
  getEnumValues,
  calculateDueDate,
  parseCreditCutoffDay,
  findMatchingStoreOption,
  calculateMonthlyCutoffDueDate,
  normalizeDependentValues,
  parseCreditDays,
  parseDeductPercent,
  isDeductActive,
  applyLocalFormulas,
  parseContractRemainingLabor,
  isVatActive,
  applyBillDeductAmount,
  applyRefFill,
  sanitizeValuesForSubmit,
  isFieldRequired,
  validateVisibleRequiredFields,
  pruneHiddenConditionalValues,
  isFieldVisible,
  getFieldClassName,
  getFieldLabel,
  hasValue,
  toDateInputValue,
  normalizeBillDateInput,
  toNumber,
  formatDecimal,
} from "./form-helpers";

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
              } else {
                onUpdate(item.id, "categoryType", deriveCategoryFromProduct(val) || val);
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

          {/* ซ่อนปุ่มเพิ่มร้านค้าใหม่ (ร้านที่ 2+) ไว้ชั่วคราวตามที่ร้องขอ ยังไม่เปิดใช้งาน */}
          {/*
          <button
            type="button"
            onClick={() => onAdd(`ร้านที่ ${storeGroups.length + 1}`)}
            className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <Store size={15} className="text-emerald-600" />
            <span>+ เพิ่มร้านค้าใหม่ (ร้านที่ {storeGroups.length + 1})</span>
          </button>
          */}
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
  buttonIcon,
  isOpen,
  onClose,
  onSuccess,
  zIndex,
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
  const [open, setOpen] = useState(() => isOpen ?? false);
  const [quickContractorOpen, setQuickContractorOpen] = useState(false);
  const [quickStoreOpen, setQuickStoreOpen] = useState(false);
  const [showPCProject, setShowPCProject] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => activeForm ? getInitialStringValues(activeForm) : {});
  const [editSheetRow, setEditSheetRow] = useState<string | number | null>(null);
  const [enumListSearch, setEnumListSearch] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [attachedFilesByField, setAttachedFilesByField] = useState<Record<string, File[]>>({});
  const isEditing = editSheetRow !== null && editSheetRow !== undefined;
  const isDataForm = resolvedTableName === TABLES.DATA || resolvedTableName === "Data" || resolvedTableName === "bills" || resolvedTableName === "DATA" || resolvedTableName === "กรอกบิล";
  const isContractModal = resolvedTableName === TABLES.CONTRACT_WORK || resolvedTableName === "งานรับเหมา" || resolvedTableName === "Contract_work" || openEventName === "open-contract-form";
  const isContractorModal = resolvedTableName === TABLES.CONTRACTOR || resolvedTableName === "contractors" || resolvedTableName === "รับเหมา" || resolvedTableName === "5. รับเหมา" || openEventName === "open-contractor-form";
  const isStoreModal = resolvedTableName === TABLES.STORE || resolvedTableName === "stores" || resolvedTableName === "ร้านค้า" || resolvedTableName === "4. ร้านค้า" || openEventName === "open-store-form";
  const isSubModal = isContractorModal || isStoreModal;
  const modalZIndex = zIndex || (isSubModal ? "z-[70]" : isContractModal ? "z-[60]" : "z-50");
  const modalBackdropClass = (isSubModal || isContractModal) ? "bg-slate-950/45 backdrop-blur-sm" : "bg-slate-900/65 backdrop-blur-md sm:backdrop-blur-lg";
  const hasSavedDuringSession = useRef(false);
  const effectiveSubmitPath = submitPath || activeForm?.submitPath || "/api/sheets/update";

  useEffect(() => {
    if (isOpen !== undefined) {
      if (isOpen) {
        handleOpen();
      } else {
        setOpen(false);
      }
    }
  }, [isOpen]);

  const handleQuickOpenContract = useCallback(() => {
    const projectVal = values["ID Project"] || "";
    const contractorVal = values["ผู้รับเหมา"] || "";
    const projectNameVal = values["ชื่อ Project"] || "";
    const dateVal = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();

    const opt = activeForm?.refOptions?.["ผู้รับเหมา"]?.find(o => String(o.value) === contractorVal || String(o.label) === contractorVal);
    const resolvedContractorId = opt?.row?.id_Contractor || (contractorVal.startsWith("CW") ? "" : contractorVal);

    window.dispatchEvent(new CustomEvent("open-contract-form", {
      detail: {
        isNew: true,
        row: {
          "ID Project": projectVal,
          "id_Contractor": resolvedContractorId,
          "ชื่อ Project": projectNameVal,
          "วันที่": dateVal
        }
      }
    }));
  }, [values, activeForm]);

  function handleClose() {
    setOpen(false);
    onClose?.();
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
      if (!isContractorModal && !isStoreModal) {
        router.refresh();
      }
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
    const isStaff = values["ร้านค้า/ผู้รับเหมา"] === "พนักงาน";
    if (isStaff) {
      return STAFF_CATEGORY_OPTIONS.map((c: string) => ({ label: c, value: c }));
    }
    return ALL_STORE_CATEGORIES.map((c: string) => ({ label: c, value: c }));
  }, [values["ร้านค้า/ผู้รับเหมา"]]);

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

  // Listen for contract work created via "+ เปิดจ้างงานรับเหมา" to immediately update parent bill form
  useEffect(() => {
    if (!isDataForm) return;

    const handleContractCreated = (e: Event) => {
      const detail = e instanceof CustomEvent ? e.detail : undefined;
      const createdRow = detail?.row;
      if (!createdRow) return;

      const conworkId = String(createdRow.id_Conwork || createdRow.id || "").trim();
      const projId = String(createdRow["ID Project"] || createdRow.project_id || "").trim();
      const projName = String(createdRow["ชื่อ Project"] || createdRow.project_name || "").trim();
      const contractorId = String(createdRow.id_Contractor || createdRow.contractor_id || "").trim();
      const contractorName = String(createdRow["ชื่อเล่น"] || createdRow["ผู้รับเหมา"] || createdRow["ชื่อ-นามสกุล"] || "").trim();
      const totalAmount = createdRow["ยอดเงินจ้าง"] || createdRow.total_contract_amount || "";
      const paidAmount = createdRow["ยอดเงินจ่าย"] || createdRow.paid_amount || "0";
      const details = createdRow["รายละเอียดงาน"] || createdRow.work_details || "";

      const label = contractorName
        ? (contractorName.startsWith(conworkId) ? contractorName : `${conworkId}-${contractorName}`)
        : conworkId;

      // 1. Immediately inject the new contract into activeForm.refOptions["ผู้รับเหมา"]
      setActiveForm(prev => {
        if (!prev) return prev;
        const currentList = prev.refOptions?.["ผู้รับเหมา"] || [];
        const filteredList = currentList.filter(opt => String(opt.value) !== conworkId);

        const newOpt: RefOption = {
          value: conworkId,
          label,
          row: {
            id_Conwork: conworkId,
            id_Contractor: contractorId,
            "ชื่อเล่น": contractorName,
            "ผู้รับเหมา": contractorName,
            "รายละเอียดงาน": details,
            "ค่าแรงคงเหลือ": toNumber(totalAmount) - toNumber(paidAmount),
            "ยอดเงินจ้าง": toNumber(totalAmount),
            "ยอดเงินจ่าย": toNumber(paidAmount),
            "ID Project": projId
          }
        };
        return {
          ...prev,
          refOptions: {
            ...prev.refOptions,
            "ผู้รับเหมา": [newOpt, ...filteredList]
          }
        };
      });

      // 2. Auto-fill the bill form with the contract's project, contractor, and remaining labor!
      setValues(prev => {
        const next = { ...prev };
        if (projId) {
          next["ID Project"] = projId;
          if (projName) next["ชื่อ Project"] = projName;
        }
        next["ร้านค้า/ผู้รับเหมา"] = "ผู้รับเหมา";
        next["ผู้รับเหมา"] = conworkId;
        if (details) next["รายละเอียดงาน"] = details;
        if (totalAmount) {
          const remain = toNumber(totalAmount) - toNumber(paidAmount);
          next["ค่าแรงคงเหลือ"] = `${new Intl.NumberFormat("th-TH").format(remain)} จาก ${new Intl.NumberFormat("th-TH").format(toNumber(totalAmount))}`;
        }
        applyLocalFormulas(next, resolvedTableName);
        return next;
      });
    };

    window.addEventListener("contract-work-created", handleContractCreated);
    return () => window.removeEventListener("contract-work-created", handleContractCreated);
  }, [isDataForm, resolvedTableName]);

  // Handle contractor saved - update contract form immediately
  const handleContractorSaved = useCallback((createdRow: SheetRow) => {
    const contractorId = String(createdRow.id_Contractor || createdRow.id || "").trim();
    const contractorNick = String(createdRow["ชื่อเล่น"] || createdRow.nickname || "").trim();
    const contractorFullName = String(createdRow["ชื่อ-นามสกุล"] || createdRow.fullname || "").trim();
    const phone = String(createdRow["เบอร์โทรศัพท์"] || createdRow.phone || "").trim();
    let bank = String(createdRow["ธนาคาร"] || createdRow.bank || "").trim();
    const bankAccount = String(createdRow["เลขบัญชี"] || createdRow.bank_account || "").trim();
    const idCard = String(createdRow["บัตรประจำตัวประชาชน"] || createdRow.id_card || "").trim();
    const address = String(createdRow["ที่อยู่"] || createdRow.address || "").trim();

    // Map bank if activeForm has bank options
    const bankOptions = activeForm?.refOptions?.["ธนาคาร"] || [];
    if (bank && bankOptions.length > 0) {
      const bOpt = bankOptions.find(b =>
        String(b.value) === bank ||
        String(b.label) === bank ||
        String(b.row?.id_bank) === bank ||
        String(b.row?.["ชื่อธนาคาร"]) === bank
      );
      if (bOpt) {
        bank = String(bOpt.value || bOpt.row?.["ชื่อธนาคาร"] || bOpt.label);
      }
    }

    const label = contractorNick
      ? (contractorFullName ? `${contractorNick} (${contractorFullName})` : contractorNick)
      : (contractorFullName || contractorId);

    // 1. Immediately inject new contractor option into activeForm.refOptions
    setActiveForm(prev => {
      if (!prev) return prev;
      const currentList = prev.refOptions?.["id_Contractor"] || [];
      const filteredList = currentList.filter(opt => String(opt.value) !== contractorId);

      const newOpt: RefOption = {
        value: contractorId,
        label: contractorNick || label,
        row: {
          ...createdRow,
          id: contractorId,
          id_Contractor: contractorId,
          "ชื่อเล่น": contractorNick,
          "ชื่อ-นามสกุล": contractorFullName,
          "เลขบัญชี": bankAccount,
          "ธนาคาร": bank,
          "บัตรประจำตัวประชาชน": idCard,
          "เบอร์โทรศัพท์": phone,
          "ที่อยู่": address,
        }
      };

      const currentVendors = prev.refOptions?.["ผู้รับเหมา"] || [];
      const filteredVendors = currentVendors.filter(opt => String(opt.value) !== contractorId);

      return {
        ...prev,
        refOptions: {
          ...prev.refOptions,
          "id_Contractor": [newOpt, ...filteredList],
          "ผู้รับเหมา": [newOpt, ...filteredVendors]
        }
      };
    });

    // 2. Auto-fill the contract open form fields immediately!
    setValues(prev => {
      const next = { ...prev };
      next["id_Contractor"] = contractorId;
      if (next["ผู้รับเหมา"] !== undefined) next["ผู้รับเหมา"] = contractorId;
      if (contractorNick) next["ชื่อเล่น"] = contractorNick;
      if (contractorFullName) next["ชื่อ-นามสกุล"] = contractorFullName;
      if (bankAccount) next["เลขบัญชี"] = bankAccount;
      if (bank) next["ธนาคาร"] = bank;
      if (idCard) next["บัตรประจำตัวประชาชน"] = idCard;
      if (phone) next["เบอร์โทรศัพท์"] = phone;
      if (address) next["ที่อยู่"] = address;
      applyLocalFormulas(next, resolvedTableName);
      return next;
    });
  }, [activeForm, resolvedTableName]);

  // Listen for contractor created via quick add to immediately update active contract work form
  useEffect(() => {
    if (!isContractModal) return;

    const handleContractorCreated = (e: Event) => {
      const detail = e instanceof CustomEvent ? e.detail : undefined;
      const createdRow = detail?.row;
      if (createdRow) {
        handleContractorSaved(createdRow);
      }
    };

    window.addEventListener("contractor-created", handleContractorCreated);
    return () => window.removeEventListener("contractor-created", handleContractorCreated);
  }, [isContractModal, handleContractorSaved]);

  // Handle store saved - update bill form immediately
  const handleStoreSaved = useCallback((createdRow: SheetRow) => {
    const storeId = String(createdRow.id_store || createdRow.id || "").trim();
    const storeName = String(createdRow["ชื่อร้านค้า"] || createdRow.name || createdRow.title || storeId).trim();
    const creditPaymentDay = String(createdRow["เครดิตจ่าย"] || createdRow.credit_payment_day || "").trim();
    const bankAccount = String(createdRow["เลขบัญชี"] || createdRow.bank_account || "").trim();
    const bank = String(createdRow["ธนาคาร"] || createdRow.bank || "").trim();
    const fullName = String(createdRow["ชื่อเต็ม"] || "").trim();

    const newOpt: RefOption = {
      value: storeId,
      label: storeName,
      row: {
        ...createdRow,
        id: storeId,
        id_store: storeId,
        "ชื่อร้านค้า": storeName,
        "ชื่อเต็ม": fullName,
        "เครดิตจ่าย": creditPaymentDay,
        credit_payment_day: creditPaymentDay,
        "เลขบัญชี": bankAccount,
        "ธนาคาร": bank,
      }
    };

    // 1. Immediately inject new store option into activeForm.refOptions
    setActiveForm(prev => {
      if (!prev) return prev;
      const currentStores = prev.refOptions?.["ร้านค้า"] || [];
      const filteredStores = currentStores.filter(opt => String(opt.value) !== storeId);
      return {
        ...prev,
        refOptions: {
          ...prev.refOptions,
          "ร้านค้า": [newOpt, ...filteredStores]
        }
      };
    });

    // 2. Auto-fill the store field in the active bill form immediately!
    setValues(prev => {
      const next = { ...prev };
      next["ร้านค้า"] = storeId;
      if (creditPaymentDay) {
        next["เครดิต"] = creditPaymentDay;
      }
      applyLocalFormulas(next, resolvedTableName);
      return next;
    });

    // 3. Update multiLineItems if needed
    setMultiLineItems(prev => {
      if (!prev.length) return prev;
      return prev.map((item, idx) => {
        if (!item.storeGroup || item.storeGroup === "ร้านที่ 1" || idx === 0) {
          return { ...item, storeGroup: storeName };
        }
        return item;
      });
    });

    // 4. Invalidate global table caches
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bills-data-updated"));
      window.dispatchEvent(new CustomEvent("data-updated", { detail: { tableName: TABLES.STORE } }));
    }
  }, [resolvedTableName]);

  // Listen for store created via quick add to immediately update active bill form
  useEffect(() => {
    if (!isDataForm) return;

    const handleStoreCreated = (e: Event) => {
      const detail = e instanceof CustomEvent ? e.detail : undefined;
      const createdRow = detail?.row;
      if (createdRow) {
        handleStoreSaved(createdRow);
      }
    };

    window.addEventListener("store-created", handleStoreCreated);
    return () => window.removeEventListener("store-created", handleStoreCreated);
  }, [isDataForm, handleStoreSaved]);

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
                let fillVal = String(selectedOpt.row?.[sourceColumn] ?? "");
                if (targetField === "ธนาคาร" && fillVal && (targetForm.refOptions["ธนาคาร"] || []).length > 0) {
                  const bOpt = targetForm.refOptions["ธนาคาร"].find(b =>
                    String(b.value) === fillVal ||
                    String(b.label) === fillVal ||
                    String(b.row?.id_bank) === fillVal ||
                    String(b.row?.id) === fillVal
                  );
                  if (bOpt) fillVal = String(bOpt.row?.["ชื่อธนาคาร"] || bOpt.label || bOpt.value);
                }
                nextValues[targetField] = fillVal;
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
    const isExplicitNew = Boolean(detail?.isNew);
    const targetRowKey = isExplicitNew
      ? null
      : (targetForm.tableName === TABLES.CONTRACT_WORK || targetForm.tableName === "งานรับเหมา" || targetForm.tableName === "Contract_work")
        ? (detail?.row?.id_Conwork ?? detail?.row?.id ?? detail?.sheetRow)
        : (targetForm.tableName === TABLES.DATA || targetForm.tableName === "Data" || targetForm.tableName === "bills")
          ? (detail?.row?.["ลำดับ"] ?? detail?.row?.id ?? detail?.sheetRow)
          : (detail?.row?.id ?? detail?.row?.id_petty_cash ?? detail?.row?.["ID Project"] ?? detail?.row?.["รหัสพนักงาน"] ?? detail?.row?.id_store ?? detail?.row?.id_Contractor ?? detail?.row?.id_Conwork ?? detail?.row?.id_bank ?? detail?.row?.id_car ?? detail?.row?.id_cus ?? detail?.row?.id_Company ?? detail?.row?.["ลำดับ"] ?? detail?.sheetRow ?? detail?.row?._sheetRow);
    setEditSheetRow(!isExplicitNew && detail?.row ? (targetRowKey !== undefined && targetRowKey !== null ? (typeof targetRowKey === "number" || typeof targetRowKey === "string" ? targetRowKey : String(targetRowKey)) : 1) : null);

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

    // Reset petty cash project toggle — auto-show if editing a row that already has a project
    const isPettyCashForm = resolvedTableName === "petty_cash" || resolvedTableName === "เปิดเงินสดย่อย";
    const editRowHasProject = !!(detail?.row?.["ID Project"] || detail?.row?.["id_project"]);
    setShowPCProject(isPettyCashForm ? editRowHasProject : false);

    // If editing existing row, populate directly
    if (detail?.row && !detail?.isNew && activeForm) {
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
        if (!detail?.row || detail?.isNew) {
          const freshInitial = getInitialStringValues(fresh);
          const todayIso = getTodayDateIso();
          setValues(prev => {
            const next = { ...prev };
            if (detail?.row) {
              Object.entries(detail.row).forEach(([k, v]) => {
                if (v !== undefined && v !== null && String(v) !== "") {
                  next[k] = String(v);
                }
              });
            }
            if (freshInitial["ลำดับ"]) next["ลำดับ"] = freshInitial["ลำดับ"];
            if (freshInitial["ID Project"] && !next["ID Project"]) next["ID Project"] = freshInitial["ID Project"];
            if (freshInitial["id_Conwork"] && !next["id_Conwork"]) next["id_Conwork"] = freshInitial["id_Conwork"];
            if (freshInitial["id_petty_cash"] && !next["id_petty_cash"]) next["id_petty_cash"] = freshInitial["id_petty_cash"];
            if (freshInitial["id_Contractor"] && !next["id_Contractor"]) next["id_Contractor"] = freshInitial["id_Contractor"];
            Object.entries(freshInitial).forEach(([k, v]) => {
              if (v && !next[k]) {
                next[k] = v;
              }
            });
            fresh.schema.forEach(field => {
              if (field.initialValue === "today" || (field.type === "Date" && (field.name === "ว/ด/ป" || field.name === "วันที่" || field.name === "ดู/ทำ"))) {
                if (!next[field.name]) {
                  next[field.name] = todayIso;
                }
              }
            });
            applyLocalFormulas(next, fresh.tableName);
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

  const isPettyCashForm = resolvedTableName === "petty_cash" || resolvedTableName === "เปิดเงินสดย่อย";
  const visibleFields = (activeForm?.schema || []).filter(field => {
    if (field.type === "Hidden") return false;
    if ((resolvedTableName === TABLES.PROJECT || resolvedTableName === "Project") && (field.name.startsWith("งบไม่เกิน") || field.name === "คุมงบประเภทงาน")) {
      return false;
    }
    // ซ่อนฟิลด์โครงการในฟอร์มเปิดเงินสดย่อย จนกว่าจะกดแสดง
    if (isPettyCashForm && (field.name === "ID Project" || field.name === "ชื่อ Project")) {
      return showPCProject;
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
    if (!effectiveSubmitPath || !activeForm) return;

    const submitValues = sanitizeValuesForSubmit(values, activeForm);
    if (activeForm.tableName === TABLES.DATA || activeForm.tableName === "Data") {
      const loggedInUser = getCookie("auth_name") || getCookie("auth_employee_id");
      if (loggedInUser && !submitValues["ผู้สร้างบิล"]) {
        submitValues["ผู้สร้างบิล"] = loggedInUser;
      }
    }
    if (isDataForm && isMultiItemMode) {
      if (multiLineItems.length === 0) {
        setError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
        formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const missingCategory = multiLineItems.find(i => !i.category || !i.category.trim());
      if (missingCategory) {
        setError("กรุณาเลือกประเภทสินค้าให้ครบทุกรายการ");
        formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const invalidItem = multiLineItems.find(i => !i.amount || (Number(i.amount) || 0) <= 0);
      if (invalidItem) {
        setError("กรุณาระบุยอดเงินสำหรับทุกรายการสินค้าในบิล");
        formBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      submitValues["_is_multi_item"] = "true";
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
          ? await fetch(effectiveSubmitPath, {
            method: "PATCH",
            body
          })
          : await fetch(effectiveSubmitPath, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tableName: activeForm.tableName, id: editSheetRow, sheetRow: editSheetRow, values: submitValues })
          })
        : await fetch(effectiveSubmitPath, {
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
        if (isContractModal) {
          window.dispatchEvent(new CustomEvent("contract-work-created", {
            detail: {
              row: {
                ...(payload.row || {}),
                ...submitValues,
                id_Conwork: payload.row?.id_Conwork || payload.row?.id || submitValues["id_Conwork"] || submitValues.id
              }
            }
          }));
        }
        if (isContractorModal) {
          const contractorRow = {
            ...(payload.row || {}),
            ...submitValues,
            id_Contractor: payload.row?.id_Contractor || payload.row?.id || submitValues["id_Contractor"] || submitValues.id
          };
          window.dispatchEvent(new CustomEvent("contractor-created", {
            detail: { row: contractorRow }
          }));
          onSuccess?.(contractorRow);
        }
        if (isStoreModal) {
          const storeRow = {
            ...(payload.row || {}),
            ...submitValues,
            id_store: payload.row?.id_store || payload.row?.id || submitValues["id_store"] || submitValues.id
          };
          window.dispatchEvent(new CustomEvent("store-created", {
            detail: { row: storeRow }
          }));
          onSuccess?.(storeRow);
        }
      }

      setAttachedFilesByField({});

      if (isEditing || isContractModal || isContractorModal || isStoreModal) {
        setOpen(false);
        onClose?.();
        setEditSheetRow(null);
        setValues(getInitialStringValues(activeForm));
        setMultiLineItems([]);
        setIsMultiItemMode(false);
        setResetKey(k => k + 1);
        if (!isContractorModal && !isStoreModal) {
          router.refresh();
        }
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
        if (nextSeq && isDataForm) {
          baseValues["ลำดับ"] = nextSeq;
        }

        // ✅ คงค่า โครงการ, บิล, ผู้เบิก, และ วันที่ ไว้เมื่อบันทึกแล้วและยังไม่ปิดฟอร์ม เพื่อกรอกบิลต่อเนื่องได้ทันที
        if (isDataForm) {
          if (submitValues["ID Project"]) {
            baseValues["ID Project"] = submitValues["ID Project"];
            if (submitValues["ชื่อ Project"]) baseValues["ชื่อ Project"] = submitValues["ชื่อ Project"];
          }
          if (submitValues["บิล"]) {
            baseValues["บิล"] = submitValues["บิล"];
          }
          if (submitValues["ผู้เบิก"]) {
            baseValues["ผู้เบิก"] = submitValues["ผู้เบิก"];
          }
          if (submitValues["ว/ด/ป"]) {
            baseValues["ว/ด/ป"] = submitValues["ว/ด/ป"];
          } else if (submitValues["วันที่"]) {
            baseValues["วันที่"] = submitValues["วันที่"];
          }
          applyLocalFormulas(baseValues, activeForm.tableName);
        }

        setValues(baseValues);
        setMultiLineItems([]);
        setIsMultiItemMode(false);
        setEnumListSearch({});
        setAttachedFilesByField({});
        setError("");
        setSuccessMessage(
          prevSeq
            ? `บันทึกบิลลำดับที่ ${prevSeq} สำเร็จเรียบร้อย! ระบบเตรียมเลขถัดไป (#${nextSeq || Number(prevSeq) + 1}) และคงโครงการ/ประเภทบิลไว้พร้อมกรอกต่อแล้ว`
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
        <div className={`fixed inset-0 ${modalZIndex} flex items-end sm:items-center justify-center p-0 sm:p-4 ${modalBackdropClass} animate-in fade-in duration-150`} role="presentation">
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
                                {section.id === "vendor" && isContractorVendor && (
                                  <button
                                    type="button"
                                    onClick={handleQuickOpenContract}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-300 transition cursor-pointer shadow-2xs active:scale-[0.98]"
                                    title="เปิดฟอร์มสร้างสัญญาจ้างงานรับเหมา (ส่งข้อมูลโครงการและผู้รับเหมาให้อัตโนมัติ)"
                                  >
                                    <FileText size={12} className="shrink-0" />
                                    <span>+ เปิดจ้างงานรับเหมา</span>
                                  </button>
                                )}
                                {section.id === "vendor" && isStoreVendor && (
                                  <button
                                    type="button"
                                    onClick={() => setQuickStoreOpen(true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-300 transition cursor-pointer shadow-2xs active:scale-[0.98]"
                                    title="เปิดฟอร์มสร้างร้านค้าใหม่"
                                  >
                                    <Plus size={12} className="shrink-0 stroke-[2.5]" />
                                    <span>สร้างร้านค้าใหม่</span>
                                  </button>
                                )}
                                {section.id === "tax" && (() => {
                                  const storeVal = values["ร้านค้า"] || values["ร้าน/บุคคล"] || "";
                                  const storeOptions = activeForm?.refOptions?.["ร้านค้า"] || activeForm?.refOptions?.["ร้าน/บุคคล"] || [];
                                  const storeOption = findMatchingStoreOption(storeOptions, storeVal);
                                  const storeCutoffRaw = storeOption?.row?.["เครดิตจ่าย"] || storeOption?.row?.["credit_payment_day"];
                                  const storeCutoffDay = parseCreditCutoffDay(storeCutoffRaw);
                                  const hasStoreCredit = storeCutoffDay > 0 || (hasValue(storeCutoffRaw) && storeCutoffRaw !== "-" && storeCutoffRaw !== "0");

                                  if (hasStoreCredit) {
                                    return (
                                      <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 flex items-center gap-1">
                                        <span>💳 เครดิตร้านค้า (รอบจ่ายวันที่ {storeCutoffDay})</span>
                                      </span>
                                    );
                                  }
                                  if (!values["วันจ่าย"]) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const base = values["ว/ด/ป"] || values["วันที่"] || getTodayDateIso();
                                          const nextDueDate = calculateMonthlyCutoffDueDate(base, 15) || calculateDueDate(base, 15);
                                          updateValue({ name: "วันจ่าย" } as FieldSchema, nextDueDate);
                                        }}
                                        className="text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 transition cursor-pointer"
                                        title="ระบุวันจ่ายสำหรับบิลนี้เป็นกรณีพิเศษ"
                                      >
                                        + กำหนดวันจ่ายเอง
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateValue({ name: "วันจ่าย" } as FieldSchema, "");
                                        updateValue({ name: "เครดิต" } as FieldSchema, "");
                                      }}
                                      className="text-[10px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded transition cursor-pointer"
                                      title="ยกเลิกวันจ่าย (ชำระเงินสดทันที)"
                                    >
                                      ยกเลิกวันจ่าย (จ่ายสด)
                                    </button>
                                  );
                                })()}
                              </div>
                              <div className={sectionGridClass}>
                                {sectionFields.map(field => {
                                  const customClassName =
                                    section.id === "vendor" && field.name === "ร้านค้า"
                                      ? (isMultiItemMode ? "col-span-1 sm:col-span-2 lg:col-span-2" : "col-span-1")
                                      : section.id === "vendor" && field.name === "ผู้รับเหมา"
                                      ? (isMultiItemMode ? "col-span-1 sm:col-span-2" : "col-span-1")
                                      : section.id === "vendor" && field.name === "สินค้า" && isContractorVendor
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
                        {/* Petty Cash: toggle โครงการ */}
                        {isPettyCashForm && (
                          <div className="mb-3">
                            {showPCProject ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPCProject(false);
                                  // ล้างค่าโครงการเมื่อซ่อน
                                  setValues(prev => ({ ...prev, "ID Project": "", "ชื่อ Project": "" }));
                                }}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-300 bg-slate-50 hover:bg-rose-50 px-2.5 py-1 rounded-md transition cursor-pointer"
                              >
                                <X size={12} /> ซ่อนโครงการ
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowPCProject(true)}
                                className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 border border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 px-2.5 py-1 rounded-md transition cursor-pointer"
                              >
                                <Plus size={12} /> กำหนดโครงการ (ถ้ามี)
                              </button>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {visibleFields.map(field => {
                            const isContractWorkForm =
                              activeForm.tableName === TABLES.CONTRACT_WORK ||
                              activeForm.tableName === "Contract_work" ||
                              activeForm.tableName === "contract_works" ||
                              activeForm.tableName === "งานรับเหมา";
                            const isHireAmountField = isContractWorkForm && field.name === "ยอดเงินจ้าง";
                            const isContractorField = isContractWorkForm && (
                              field.name === "id_Contractor" ||
                              field.name === "id_contractor" ||
                              field.refTable === TABLES.CONTRACTOR ||
                              field.refTable === "รับเหมา" ||
                              field.refTable === "contractors"
                            );

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
                                    labelRight={
                                      isContractorField ? (
                                        <button
                                          type="button"
                                          onClick={() => setQuickContractorOpen(true)}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-300 transition cursor-pointer shadow-2xs active:scale-[0.98]"
                                          title="เปิดฟอร์มเพิ่มข้อมูลผู้รับเหมาใหม่"
                                        >
                                          <Plus size={11} className="stroke-[2.5]" />
                                          <span>เพิ่มผู้รับเหมา</span>
                                        </button>
                                      ) : undefined
                                    }
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
                  type={effectiveSubmitPath ? "submit" : "button"}
                  disabled={saving || loadingSchema || !activeForm || !effectiveSubmitPath}
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

      {open && isContractModal && quickContractorOpen ? (
        <FormModal
          tableName={TABLES.CONTRACTOR}
          title="เพิ่ม 5. รับเหมา"
          buttonLabel="เพิ่มผู้รับเหมา"
          submitPath="/api/rows"
          isOpen={true}
          onClose={() => setQuickContractorOpen(false)}
          zIndex="z-[70]"
          onSuccess={(savedContractor) => {
            setQuickContractorOpen(false);
            handleContractorSaved(savedContractor);
          }}
        />
      ) : null}

      {open && isDataForm && quickStoreOpen ? (
        <FormModal
          tableName={TABLES.STORE}
          title="เพิ่ม 4. ร้านค้า"
          buttonLabel="เพิ่มร้านค้า"
          submitPath="/api/rows"
          isOpen={true}
          onClose={() => setQuickStoreOpen(false)}
          zIndex="z-[70]"
          onSuccess={(savedStore) => {
            setQuickStoreOpen(false);
            handleStoreSaved(savedStore);
          }}
        />
      ) : null}
    </>
  );
}
