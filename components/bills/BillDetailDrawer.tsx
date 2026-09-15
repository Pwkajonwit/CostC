"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  X,
  ExternalLink,
  ArrowRight,
  FolderKanban,
  Receipt,
  Building2,
  Calendar,
  User,
  CreditCard,
  Tag,
  DollarSign,
  FileText,
  Store
} from "lucide-react";
import { BillImageThumbnail } from "@/components/bills/BillImageThumbnail";
import { formatDateDisplay } from "@/lib/utils/dates";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";
import { getCostCodeBadgeStyle } from "@/lib/cost-codes";

type BillDetailDrawerProps = {
  bill: SheetRow | null;
  onClose: () => void;
  onEdit?: (bill: SheetRow) => void;
  onDelete?: (bill: SheetRow) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  stores?: SheetRow[];
};

type ProjectDetail = {
  id: string;
  name: string;
  customer_name?: string;
  contract_amount?: number;
  total_vat_amount?: number;
  budget?: number;
  date?: string;
  color?: string;
  total_materials?: number;
  total_all?: number;
};

let cachedStores: SheetRow[] | null = null;

export function BillDetailDrawer({
  bill,
  onClose,
  onEdit,
  onDelete,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  stores,
}: BillDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"bill" | "project">("bill");
  const [projectData, setProjectData] = useState<ProjectDetail | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [loadedStores, setLoadedStores] = useState<SheetRow[]>(stores || cachedStores || []);

  const projectId = String(bill?.["ID Project"] || bill?.project_id || "").trim();

  useEffect(() => {
    if (stores && stores.length > 0) {
      setLoadedStores(stores);
      cachedStores = stores;
      return;
    }
    if (!cachedStores) {
      fetch("/api/rows?tableName=Store&limit=1000")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          const rows = data?.rows || data || [];
          if (Array.isArray(rows) && rows.length > 0) {
            cachedStores = rows;
            setLoadedStores(rows);
          }
        })
        .catch(() => {});
    }
  }, [stores]);

  const resolveStoreName = (token: string): string => {
    const trimmed = (token || "").trim();
    if (!trimmed) return "";
    const list = stores || loadedStores || cachedStores || [];
    const found = list.find((s) => {
      const code = String(s["id_store"] || s.id || "").trim().toLowerCase();
      const shortName = String(s["ชื่อร้านค้า"] || "").trim().toLowerCase();
      const fullName = String(s["ชื่อเต็ม"] || "").trim().toLowerCase();
      const target = trimmed.toLowerCase();
      return code === target || shortName === target || fullName === target;
    });
    if (found) {
      return String(found["ชื่อร้านค้า"] || found["ชื่อเต็ม"] || found.name || "") || trimmed;
    }
    return trimmed;
  };

  useEffect(() => {
    setActiveTab("bill");
    setProjectData(null);
  }, [bill]);

  async function fetchProjectDetail(pId: string) {
    if (!pId) return;
    setLoadingProject(true);
    setActiveTab("project");
    try {
      const res = await fetch(`/api/rows?tableName=Project&search=${encodeURIComponent(pId)}`);
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.rows && data.rows.length > 0) {
          const row = data.rows.find(
            (r: any) => String(r["ID Project"] || r.id).trim() === pId
          ) || data.rows[0];

          setProjectData({
            id: String(row["ID Project"] || row.id || pId),
            name: String(row["ชื่อ Project"] || row.name || "-"),
            customer_name: String(row["ชื่อลูกค้า"] || row.customer_name || "-"),
            contract_amount: Number(row["ยอดงาน"] || row.contract_amount || 0),
            total_vat_amount: Number(row["ยอดรวม vat"] || row.total_vat_amount || 0),
            budget: Number(row["งบไม่เกิน"] || row.budget || 0),
            date: String(row["วันที่"] || row.date || "-"),
            color: String(row["color"] || "green"),
            total_materials: Number(row["รวมค่าของ"] || 0),
            total_all: Number(row["รวม ALL"] || 0),
          });
          return;
        }
      }
      setProjectData({
        id: pId,
        name: String(bill?.["ชื่อ Project"] || "โครงการ " + pId),
      });
    } catch (e) {
      console.error("Failed to fetch project detail:", e);
      setProjectData({
        id: pId,
        name: String(bill?.["ชื่อ Project"] || "โครงการ " + pId),
      });
    } finally {
      setLoadingProject(false);
    }
  }

  const lineItems = useMemo<Array<{ category?: string; categoryType?: string; amount?: string | number; price?: string | number; total?: string | number; name?: string; type?: string; storeGroup?: string }>>(() => {
    if (!bill) return [];
    const raw = bill.items || (bill.data as any)?.items || (bill as any)["รายการสินค้า"] || (bill as any).line_items;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    if (typeof raw === "string" && raw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  }, [bill]);

  const lineItemsTotal = useMemo(() => {
    return lineItems.reduce((s, i) => s + toNumber(i.amount ?? i.price ?? i.total), 0);
  }, [lineItems]);

  if (!bill) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm sm:backdrop-blur-md flex justify-end transition-opacity">
      {/* Slide-over Panel */}
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right-full duration-300">
        {/* Top Action Bar */}
        <div className="p-4 bg-white text-slate-900 flex items-center justify-between border-b border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-xs shrink-0">
              {activeTab === "bill" ? <Receipt size={16} /> : <FolderKanban size={16} />}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[200px] sm:max-w-[240px]">
                {activeTab === "bill"
                  ? String(bill["ชื่อ Project"] || "รายละเอียดบิล")
                  : `โครงการ ${projectId}`}
              </h3>
              <span className="text-xs text-slate-500">
                {activeTab === "bill" ? `ลำดับ #${bill["ลำดับ"] || bill.id || "-"}` : projectData?.name || "-"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {bill && (
              <a
                href={`/bills/${encodeURIComponent(String(bill.id || bill["ลำดับ"] || bill._sheetRow || ""))}/document`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition border border-slate-200 font-medium"
                title="พิมพ์สัญญาจ้าง / ใบสำคัญจ่าย / 50 ทวิ"
              >
                <FileText size={14} className="text-emerald-600" />
                <span className="hidden sm:inline">พิมพ์เอกสาร</span>
              </a>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(bill)}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs transition font-medium shadow-2xs cursor-pointer"
                title="แก้ไข"
              >
                <Edit size={14} />
                <span>Edit</span>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(bill)}
                className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition cursor-pointer"
                title="ลบบิล"
              >
                <Trash2 size={14} />
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {hasPrev && onPrev && (
              <button
                type="button"
                onClick={onPrev}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                title="ก่อนหน้า"
              >
                <ChevronLeft size={15} />
              </button>
            )}

            {hasNext && onNext && (
              <button
                type="button"
                onClick={onNext}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                title="ถัดไป"
              >
                <ChevronRight size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer ml-0.5"
              title="ปิด"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs ">
          <button
            type="button"
            onClick={() => setActiveTab("bill")}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              activeTab === "bill"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📋 รายละเอียดบิล
          </button>
          <button
            type="button"
            onClick={() => fetchProjectDetail(projectId)}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              activeTab === "project"
                ? "border-indigo-600 text-indigo-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            🏗️ สรุปโครงการ (ID: {projectId || "-"})
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "bill" ? (
            <div className="space-y-4 text-xs text-slate-700">
              {/* ID Project Clickable Banner */}
              <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-indigo-500">ID Project</div>
                  <div className="text-base text-indigo-900 mt-0.5">{projectId || "-"}</div>
                </div>

                {projectId && (
                  <button
                    type="button"
                    onClick={() => fetchProjectDetail(projectId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs transition shadow-2xs"
                  >
                    <span>ดูรายละเอียดโครงการ</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>

              {/* Main Fields Grid */}
              <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
                <div>
                  <span className="text-xs text-slate-400 block">ชื่อ Project:</span>
                  <span className="text-slate-900 block mt-0.5">{String(bill["ชื่อ Project"] || "-")}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">ร้าน/บุคคล:</span>
                  <span className="text-slate-800 block mt-0.5">
                    {(() => {
                      const raw = String(bill["ร้าน/บุคคล"] || bill["ร้านค้า"] || bill["ผู้รับเหมา"] || "-");
                      if (raw === "-") return "-";
                      if (raw.includes(",")) {
                        return raw.split(",").map(t => resolveStoreName(t)).filter(Boolean).join(", ");
                      }
                      return resolveStoreName(raw);
                    })()}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">สินค้า/ทำงาน:</span>
                  <span className="font-medium text-slate-700 block mt-0.5">{String(bill["สินค้า/ทำงาน"] || "-")}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">บิล:</span>
                  <span className="text-indigo-600 block mt-0.5">{String(bill["บิล"] || "-")}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">ประเภท:</span>
                  {bill["ประเภท"] ? (
                    <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded text-xs font-medium border ${getCostCodeBadgeStyle(String(bill["ประเภท"]))}`}>
                      {String(bill["ประเภท"])}
                    </span>
                  ) : (
                    <span className="text-slate-400 block mt-0.5">-</span>
                  )}
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">รายการ:</span>
                  <span className="text-slate-800 block mt-0.5">{String(bill["รายการ"] || "-")}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">ยอดเงิน:</span>
                  <span className="text-indigo-600 text-sm block mt-0.5">{money(lineItemsTotal > 0 ? lineItemsTotal : bill["ยอดเงิน"])}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">ผู้เบิก:</span>
                  <span className="text-slate-800 block mt-0.5">{String(bill["ผู้เบิก"] || "-")}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">ว/ด/ป:</span>
                  <span className="font-medium text-slate-700 block mt-0.5">{formatDateDisplay(bill["ว/ด/ป"])}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">สถานะ:</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {String(bill["สถานะ"] || "รออนุมัติ")}
                  </span>
                </div>
              </div>

              {/* Line Items Breakdown Table if present */}
              {lineItems.length > 0 && (() => {
                const hasStoreGroups = lineItems.some(i => i.storeGroup && !i.storeGroup.startsWith("ร้านที่ "));
                if (hasStoreGroups) {
                  const groups: { storeName: string; items: typeof lineItems; total: number }[] = [];
                  const groupMap = new Map<string, { storeName: string; items: typeof lineItems; total: number }>();
                  lineItems.forEach(item => {
                    const rawStore = (item.storeGroup || "").trim();
                    const sName = resolveStoreName(rawStore) || "ร้านค้าทั่วไป";
                    if (!groupMap.has(sName)) {
                      const g = { storeName: sName, items: [], total: 0 };
                      groupMap.set(sName, g);
                      groups.push(g);
                    }
                    const g = groupMap.get(sName)!;
                    g.items.push(item);
                    g.total += toNumber(item.amount);
                  });

                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                          <Store size={14} className="text-emerald-600" />
                          <span>รายการสินค้าแยกตามร้านค้า ({groups.length} ร้าน, {lineItems.length} รายการ)</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-900">{money(bill["ยอดเงิน"])}</span>
                      </div>
                      {groups.map((group, gIdx) => (
                        <div key={gIdx} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                              <Store size={13} className="text-slate-500" />
                              <span>{group.storeName}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-600">
                                {group.items.length} รายการ
                              </span>
                            </span>
                            <span className="text-xs font-mono font-semibold text-slate-700">
                              {money(group.total)}
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-[11px]">
                                <tr>
                                  <th className="px-3 py-1.5 text-left w-8">#</th>
                                  <th className="px-3 py-1.5 text-left">สินค้า / หมวดงาน</th>
                                  <th className="px-3 py-1.5 text-left w-24">ประเภท</th>
                                  <th className="px-3 py-1.5 text-right w-28">จำนวนเงิน</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="px-3 py-2 font-medium text-slate-900">{item.category || item.name || "-"}</td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {(() => {
                                        const cat = String(item.categoryType || item.type || item.category || "101 เตรียมงาน").trim();
                                        return (
                                          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${getCostCodeBadgeStyle(cat)}`}>
                                            {cat}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                                      {money(toNumber(item.amount))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                        <Receipt size={14} className="text-emerald-600" />
                        <span>รายการสินค้าในบิล ({lineItems.length} รายการ)</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900">{money(bill["ยอดเงิน"])}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-[11px]">
                          <tr>
                            <th className="px-3 py-1.5 text-left w-8">#</th>
                            <th className="px-3 py-1.5 text-left">สินค้า / หมวดงาน</th>
                            <th className="px-3 py-1.5 text-left w-24">ประเภท</th>
                            <th className="px-3 py-1.5 text-right w-28">จำนวนเงิน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lineItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium text-slate-900">{item.category || item.name || "-"}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {(() => {
                                  const cat = String(item.categoryType || item.type || item.category || "101 เตรียมงาน").trim();
                                  return (
                                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${getCostCodeBadgeStyle(cat)}`}>
                                      {cat}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                                {money(toNumber(item.amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Image Preview Box */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">รูปถ่ายเอกสาร / บิล:</span>
                </div>
                <div className="w-full flex items-center justify-start bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                  <BillImageThumbnail value={bill["รูปถ่ายบิล"]} />
                </div>
              </div>
            </div>
          ) : (
            /* Project Detail View */
            <div className="space-y-4 text-xs text-slate-700">
              {loadingProject ? (
                <div className="py-12 text-center text-slate-400 font-medium">
                  <span className="animate-pulse">กำลังโหลดข้อมูลโครงการ {projectId}...</span>
                </div>
              ) : projectData ? (
                <>
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-1">
                    <div className="text-xs uppercase tracking-wider text-indigo-400">ID Project: {projectData.id}</div>
                    <div className="text-base ">{projectData.name}</div>
                    <div className="text-xs text-slate-300">ลูกค้า: {projectData.customer_name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-xs text-slate-400 block">ยอดงาน (รวม):</span>
                      <span className="text-slate-900 text-sm block mt-0.5">{money(projectData.contract_amount)}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-xs text-slate-400 block">ยอดรวม VAT:</span>
                      <span className="text-indigo-600 text-sm block mt-0.5">{money(projectData.total_vat_amount)}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-xs text-slate-400 block">งบไม่เกิน:</span>
                      <span className="text-emerald-600 text-sm block mt-0.5">{money(projectData.budget)}</span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-xs text-slate-400 block">วันที่:</span>
                      <span className="text-slate-800 block mt-0.5">{projectData.date}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="text-slate-700">รวมค่าของ:</span>
                      <span className="text-slate-900 text-sm">{money(projectData.total_materials)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-700">รวม ALL:</span>
                      <span className="text-indigo-600 text-base">{money(projectData.total_all)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-slate-400">ไม่พบข้อมูลโครงการ</div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">กด Esc หรือคลิกภายนอกเพื่อปิด</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

