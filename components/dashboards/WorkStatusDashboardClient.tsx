"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FolderKanban,
  LayoutGrid,
  List,
  Search,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { money, toNumber } from "@/lib/utils/numbers";
import type { SheetRow } from "@/lib/types";

type WorkStatusDashboardClientProps = {
  projects: SheetRow[];
};

export function getProjectColorInfo(colorVal: unknown) {
  const c = String(colorVal || "").toLowerCase().trim();
  if (c === "red" || c.includes("แดง") || c.includes("ใหญ่")) {
    return {
      key: "red" as const,
      label: "🔴 (งานใหญ่)",
      badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
      dotClass: "bg-rose-600",
    };
  }
  if (c === "black" || c.includes("ดำ") || c.includes("เสร็จ") || c === "completed") {
    return {
      key: "black" as const,
      label: "⚫ (เสร็จแล้ว)",
      badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
      dotClass: "bg-slate-700",
    };
  }
  return {
    key: "green" as const,
    label: "🟢 (งานเล็ก)",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dotClass: "bg-emerald-600",
  };
}

export function WorkStatusDashboardClient({ projects }: WorkStatusDashboardClientProps) {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";

  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [filterTab, setFilterTab] = useState<"all" | "red" | "green" | "complete">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((p) =>
        Object.values(p).some((val) => String(val || "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [projects, searchTerm]);

  const redProjects = useMemo(() => {
    return filteredProjects.filter((p) => getProjectColorInfo(p.color).key === "red");
  }, [filteredProjects]);

  const greenProjects = useMemo(() => {
    return filteredProjects.filter((p) => getProjectColorInfo(p.color).key === "green");
  }, [filteredProjects]);

  const completeProjects = useMemo(() => {
    return filteredProjects.filter((p) => getProjectColorInfo(p.color).key === "black");
  }, [filteredProjects]);

  const displayList = useMemo(() => {
    if (filterTab === "red") return redProjects;
    if (filterTab === "green") return greenProjects;
    if (filterTab === "complete") return completeProjects;
    return filteredProjects;
  }, [filterTab, redProjects, greenProjects, completeProjects, filteredProjects]);

  // Overall financial statistics
  const totalBudget = useMemo(() => {
    return projects.reduce((sum, p) => sum + toNumber(p["งบไม่เกิน"]), 0);
  }, [projects]);

  const totalPaid = useMemo(() => {
    return projects.reduce((sum, p) => sum + toNumber(p["เงินจ่ายแล้ว"]), 0);
  }, [projects]);

  const totalPending = useMemo(() => {
    return projects.reduce((sum, p) => sum + toNumber(p["หนี้สินรอจ่าย"]), 0);
  }, [projects]);

  const totalSpent = useMemo(() => {
    return projects.reduce((sum, p) => sum + toNumber(p["รวม ALL"]), 0);
  }, [projects]);

  const allRedCount = useMemo(() => projects.filter((p) => getProjectColorInfo(p.color).key === "red").length, [projects]);
  const allGreenCount = useMemo(() => projects.filter((p) => getProjectColorInfo(p.color).key === "green").length, [projects]);
  const allCompleteCount = useMemo(() => projects.filter((p) => getProjectColorInfo(p.color).key === "black").length, [projects]);

  return (
    <div className="w-full flex flex-col gap-5 p-4 sm:p-6 max-w-[1600px] mx-auto font-sans">
      {/* 1. EXECUTIVE SUMMARY STRIP (Responsive grid) */}
      <div className="bg-white rounded-xl md:rounded-lg p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 items-center justify-between gap-3 text-xs">
          {/* Total Projects */}
          <div className="flex items-center gap-2 pr-2 sm:pr-4 border-r border-slate-100 sm:border-slate-200">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FolderKanban size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 truncate">โครงการทั้งหมด</div>
              <div className="text-sm sm:text-base text-slate-900">{projects.length} <span className="text-xs font-normal text-slate-400">งาน</span></div>
            </div>
          </div>

          {/* Red: Large Projects */}
          <div className="flex items-center gap-2 pr-2 sm:pr-4 border-r border-slate-100 sm:border-slate-200">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-rose-600 truncate">🔴 (งานใหญ่)</div>
              <div className="text-sm sm:text-base text-rose-700">{allRedCount} <span className="text-xs font-normal text-rose-400">งาน</span></div>
            </div>
          </div>

          {/* Green: Small Projects */}
          <div className="flex items-center gap-2 pr-0 sm:pr-4 lg:border-r border-slate-200">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-emerald-600 truncate">🟢 (งานเล็ก)</div>
              <div className="text-sm sm:text-base text-emerald-700">{allGreenCount} <span className="text-xs font-normal text-emerald-400">งาน</span></div>
            </div>
          </div>

          {/* Black: Completed Projects */}
          <div className="flex items-center gap-2 pr-2 sm:pr-4 border-r border-slate-100 sm:border-slate-200 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 truncate">⚫ (เสร็จแล้ว)</div>
              <div className="text-sm sm:text-base text-slate-700">{allCompleteCount} <span className="text-xs font-normal text-slate-400">งาน</span></div>
            </div>
          </div>

          {/* Total Paid vs Budget */}
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2 pt-2 lg:pt-0 border-t sm:border-t-0 border-slate-100">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Wallet size={15} />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-indigo-600 truncate">ยอดเบิกจ่ายจริง</div>
              <div className="text-sm sm:text-base text-slate-900 truncate">
                {money(totalPaid)} <span className="text-xs font-normal text-slate-400">/ {money(totalBudget)}</span>
              </div>
              {totalPending > 0 && (
                <div className="text-[10px] text-amber-600 truncate">
                  (รอเบิก {money(totalPending)})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER TABS & SEARCH TOOLBAR */}
      <div className="bg-white rounded-xl md:rounded-lg p-2 sm:p-3 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Status Filter Tabs (Scrollable on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
              filterTab === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 bg-slate-50 border border-slate-200/60"
            }`}
          >
            ทั้งหมด ({filteredProjects.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("red")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1.5 ${
              filterTab === "red"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-rose-700 hover:bg-rose-50 bg-rose-50/50 border border-rose-200/60"
            }`}
          >
            <span>🔴 (งานใหญ่) ({redProjects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("green")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1.5 ${
              filterTab === "green"
                ? "bg-emerald-700 text-white shadow-2xs"
                : "text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 border border-emerald-200/60"
            }`}
          >
            <span>🟢 (งานเล็ก) ({greenProjects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("complete")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap active:scale-95 cursor-pointer flex items-center gap-1.5 ${
              filterTab === "complete"
                ? "bg-slate-800 text-white shadow-2xs"
                : "text-slate-700 hover:bg-slate-100 bg-slate-50 border border-slate-200/60"
            }`}
          >
            <span>⚫ (เสร็จแล้ว) ({completeProjects.length})</span>
          </button>
        </div>

        {/* Live Search Input Box */}
        <div className="relative flex items-center flex-1 sm:max-w-xs min-w-0">
          <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ Project, ID, ลูกค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 md:bg-white text-slate-800 text-xs pl-8 pr-7 py-1.5 rounded-lg md:rounded-md border border-slate-200 md:border-slate-300 focus:outline-none focus:bg-white focus:border-slate-400 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 3. MAIN WORKFLOW CONTENT (MOBILE CARD FEED & DESKTOP TABLE/GRID) */}
      {/* MOBILE HIGH-DENSITY PROJECT CARDS FEED */}
      <div className="block md:hidden space-y-2">
        {!displayList.length ? (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 border border-slate-200 text-xs font-medium">
            ไม่พบโครงการที่ค้นหา
          </div>
        ) : (
          displayList.map((p) => {
            const id = String(p["ID Project"] || p.id || "-");
            const name = String(p["ชื่อ Project"] || p.name || "-");
            const customer = String(p["ชื่อลูกค้า"] || p.customer_name || "-");
            const company = String(p["บริษัท"] || p.company || "-");
            const owner = String(p["รับผิดชอบ"] || p.responsible_person || "-");

            const paid = toNumber(p["เงินจ่ายแล้ว"]);
            const pending = toNumber(p["หนี้สินรอจ่าย"]);
            const budget = toNumber(p["งบไม่เกิน"]);
            const remaining = budget - paid;
            const revenue = toNumber(p["ยอดงาน"]) || budget;
            const profit = toNumber(p["กำไรขั้นต้น"]) || (revenue - paid);
            const margin = toNumber(p["อัตรากำไร"]) || (revenue > 0 ? (profit / revenue) * 100 : 0);
            const percentUsed = budget > 0 ? Math.min(100, Math.round((paid / budget) * 100)) : 0;

            const colorInfo = getProjectColorInfo(p.color);

            return (
              <Link
                key={`mob-project-${id}`}
                href={`/work-status/${encodeURIComponent(id)}`}
                className="block bg-white rounded-xl p-3 border border-slate-200 shadow-2xs space-y-2 hover:border-slate-300 active:scale-98 transition cursor-pointer"
              >
                {/* Header: Project ID + Status Tag */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs bg-slate-900 text-white px-1.5 py-0.2 rounded shrink-0">
                      #{id}
                    </span>
                    <span className="text-xs text-slate-900 truncate">
                      {name}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs shrink-0 ${colorInfo.badgeClass}`}
                  >
                    <span>{colorInfo.label}</span>
                  </span>
                </div>

                {/* Subtitle: Customer • Company • Owner */}
                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span className="truncate">{customer} {company !== "-" ? `(${company})` : ""}</span>
                  <span className="text-slate-400 shrink-0 ml-2 font-medium">{owner}</span>
                </div>

                {/* Financial Progress Strip */}
                <div className="bg-slate-50 p-2 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      เบิกแล้ว: <strong className="text-slate-900">{money(paid)}</strong>
                      {pending > 0 && (
                        <span className="text-[10px] text-amber-600 font-normal ml-1">
                          (รอเบิก {money(pending)})
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400">งบ: <strong>{money(budget)}</strong></span>
                  </div>
                  {budget > 0 && (
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percentUsed > 90 ? "bg-rose-500" : percentUsed > 75 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Footer: Remaining & Detail Link */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="text-slate-500">
                    คงเหลือ:{" "}
                    <span className={`${remaining < 0 ? "text-rose-600 font-medium" : "text-emerald-700 font-medium"}`}>
                      {money(remaining)} ฿
                    </span>
                  </div>

                  <span className="text-slate-600 text-xs flex items-center gap-0.5 group-hover:text-slate-900">
                    <span>ดูรายละเอียด</span>
                    <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* DESKTOP CONTENT (TABLE OR GRID) */}
      <div className="hidden md:block">
        {viewMode === "table" ? (
          /* PROFESSIONAL HIGH-DENSITY WORK TABLE */
          <div className="bg-white rounded-lg border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-xs">
                    <th className="py-3 px-3.5 w-24">รหัส (ID)</th>
                    <th className="py-3 px-3.5 min-w-[220px]">ชื่อโครงการ (Project)</th>
                    <th className="py-3 px-3.5">ลูกค้า</th>
                    <th className="py-3 px-3.5">บริษัท</th>
                    <th className="py-3 px-3.5">ผู้รับผิดชอบ</th>
                    <th className="py-3 px-3.5 w-36 text-center">สถานะ (Color)</th>
                    <th className="py-3 px-3.5 text-right">ยอดเบิกจ่ายจริง</th>
                    <th className="py-3 px-3.5 text-right">งบไม่เกิน</th>
                    <th className="py-3 px-3.5 text-right">คงเหลือ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayList.map((p) => {
                    const id = String(p["ID Project"] || p.id || "-");
                    const name = String(p["ชื่อ Project"] || p.name || "-");
                    const customer = String(p["ชื่อลูกค้า"] || p.customer_name || "-");
                    const company = String(p["บริษัท"] || p.company || "-");
                    const owner = String(p["รับผิดชอบ"] || p.responsible_person || "-");

                    const paid = toNumber(p["เงินจ่ายแล้ว"]);
                    const pending = toNumber(p["หนี้สินรอจ่าย"]);
                    const budget = toNumber(p["งบไม่เกิน"]);
                    const remaining = budget - paid;

                    const colorInfo = getProjectColorInfo(p.color);

                    return (
                      <tr key={id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Project ID */}
                        <td className="py-2.5 px-3.5 font-mono text-slate-800">
                          #{id}
                        </td>

                        {/* Project Name */}
                        <td className="py-2.5 px-3.5 text-slate-900 group-hover:text-indigo-600 transition-colors">
                          <Link href={`/work-status/${encodeURIComponent(id)}`} className="hover:underline">
                            {name}
                          </Link>
                        </td>

                        {/* Customer */}
                        <td className="py-2.5 px-3.5 text-slate-600">{customer}</td>

                        {/* Company */}
                        <td className="py-2.5 px-3.5 text-slate-600">{company}</td>

                        {/* Owner */}
                        <td className="py-2.5 px-3.5 text-slate-600">{owner}</td>

                        {/* Status Tag */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs ${colorInfo.badgeClass}`}
                          >
                            <span>{colorInfo.label}</span>
                          </span>
                        </td>

                        {/* Paid Amount */}
                        <td className="py-2.5 px-3.5 text-right text-slate-900">
                          <div>{money(paid)}</div>
                          {pending > 0 && (
                            <div className="text-[10px] text-amber-600 font-normal">
                              (รอเบิก {money(pending)})
                            </div>
                          )}
                        </td>

                        {/* Budget */}
                        <td className="py-2.5 px-3.5 text-right font-medium text-slate-500">
                          {money(budget)}
                        </td>

                        {/* Remaining */}
                        <td
                          className={`py-2.5 px-3.5 text-right font-medium ${
                            remaining < 0 ? "text-rose-600 " : "text-emerald-700"
                          }`}
                        >
                          {money(remaining)}
                        </td>
                      </tr>
                    );
                  })}

                  {!displayList.length && (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        ไม่พบโครงการที่ค้นหา
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
        /* COMPACT CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayList.map((p) => {
            const id = String(p["ID Project"] || p.id || "-");
            const name = String(p["ชื่อ Project"] || p.name || "-");
            const customer = String(p["ชื่อลูกค้า"] || p.customer_name || "-");
            const company = String(p["บริษัท"] || p.company || "-");
            const owner = String(p["รับผิดชอบ"] || p.responsible_person || "-");

            const paid = toNumber(p["เงินจ่ายแล้ว"]);
            const pending = toNumber(p["หนี้สินรอจ่าย"]);
            const budget = toNumber(p["งบไม่เกิน"]);

            const colorInfo = getProjectColorInfo(p.color);

            return (
              <Link
                key={id}
                href={`/work-status/${encodeURIComponent(id)}`}
                className="bg-white rounded-lg p-4 border border-slate-200/90 hover:border-indigo-400 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs ${colorInfo.badgeClass}`}
                  >
                    <span>{colorInfo.label}</span>
                  </span>
                  <span className="font-mono text-xs text-slate-400">#{id}</span>
                </div>

                <h3 className="text-slate-900 text-xs group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {name}
                </h3>

                <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ลูกค้า/บริษัท</span>
                    <span className="text-slate-800 truncate max-w-[140px]">{customer} ({company})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ผู้รับผิดชอบ</span>
                    <span className="text-slate-800">{owner}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-400 text-xs">เบิกจ่ายจริง</span>
                  <div className="text-right">
                    <span className="text-slate-900 font-semibold">{money(paid)}</span>
                    {pending > 0 && (
                      <span className="block text-[10px] text-amber-600 font-normal">
                        (รอเบิก {money(pending)})
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
          {!displayList.length && (
            <div className="col-span-full bg-white rounded-lg p-8 text-center text-slate-400 border border-slate-200/80 text-xs">
              ไม่พบโครงการที่ค้นหา
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

