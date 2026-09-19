"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownUp,
  BriefcaseBusiness,
  Building2,
  Car,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  Database,
  FileText,
  FolderKanban,
  Gauge,
  HandCoins,
  IdCard,
  Layers,
  LayoutGrid,
  MessageSquare,
  Package,
  PieChart,
  ReceiptText,
  Search,
  ShieldCheck,
  Sliders,
  Store,
  Users,
  WalletCards,
} from "lucide-react";
import { PRIMARY_VIEWS } from "@/lib/config";
import { UserSwitcher } from "@/components/auth/UserSwitcher";
import { YearSelector } from "@/components/layout/YearSelector";

type DualSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentUser?: any;
};

const ICONS: Record<string, any> = {
  "dashboard-main": Gauge,
  "bill-entry": ReceiptText,
  "withdraw-request": WalletCards,
  "contract-open": BriefcaseBusiness,
  "petty-cash": Coins,
  "bill-follow": ClipboardList,
  "work-status": FolderKanban,
  documents: FileText,
  reports: PieChart,
  "project-analytics": Package,
  "project-all": FolderKanban,
  banks: WalletCards,
  categories: ClipboardList,
  stores: Store,
  contractors: Users,
  people: IdCard,
  cars: Car,
  customers: Users,
  companies: Building2,
  loans: HandCoins,
  tasks: ClipboardList,
  works: BriefcaseBusiness,
  settings: Database,
  "settings-general": Building2,
};

function hrefFor(viewId: string) {
  if (viewId === "dashboard-main") return "/";
  if (viewId === "bill-entry") return "/bills";
  if (viewId === "withdraw-request") return "/withdraw-request";
  if (viewId === "contract-open") return "/contract-open";
  if (viewId === "petty-cash") return "/petty-cash";
  if (viewId === "bill-follow") return "/bill-follow";
  if (viewId === "work-status") return "/work-status";
  if (viewId === "documents") return "/documents";
  if (viewId === "reports") return "/reports";
  if (viewId === "project-analytics") return "/project-analytics";
  if (viewId === "settings") return "/settings";
  if (viewId === "settings-general") return "/settings/general";
  return `/views/${viewId}`;
}

export function DualSidebar({ collapsed, onToggleCollapse, currentUser }: DualSidebarProps) {
  const pathname = usePathname();
  const [filterSearch, setFilterSearch] = useState("");
  const [companySettings, setCompanySettings] = useState({
    companyName: "CostLab Executive",
    companySubTitle: "ระบบบริหารและติดตามงบประมาณ",
    logoUrl: "",
  });

  const loadCompanySettings = async () => {
    try {
      const cached = localStorage.getItem("costlab_company_settings");
      if (cached) {
        setCompanySettings(JSON.parse(cached));
        return;
      }
      const res = await fetch("/api/company-settings");
      const json = await res.json();
      if (json.success && json.settings) {
        setCompanySettings(json.settings);
        localStorage.setItem("costlab_company_settings", JSON.stringify(json.settings));
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadCompanySettings();

    const handleUpdate = () => {
      loadCompanySettings();
    };

    window.addEventListener("company-settings-updated", handleUpdate);
    return () => {
      window.removeEventListener("company-settings-updated", handleUpdate);
    };
  }, []);

  const getInitialCategory = (path: string): "all" | "main" | "task" | "master" | "system" => {
    if (path.startsWith("/settings") || path.startsWith("/line-system") || path.startsWith("/users")) {
      return "system";
    }
    if (path.startsWith("/views/tasks") || path.startsWith("/views/works") || path === "/tasks" || path === "/works") {
      return "task";
    }
    if (path.startsWith("/views/")) {
      return "master";
    }
    return "main";
  };

  const [activeCategory, setActiveCategory] = useState<"all" | "main" | "task" | "master" | "system">(() => getInitialCategory(pathname));

  useEffect(() => {
    setActiveCategory(getInitialCategory(pathname));
  }, [pathname]);

  const mainViews = PRIMARY_VIEWS.filter((view) => view.position !== "menu" && view.position !== "task");
  const taskViews = PRIMARY_VIEWS.filter((view) => view.position === "task");
  const masterViews = PRIMARY_VIEWS.filter((view) => view.position === "menu");

  const filterText = filterSearch.toLowerCase().trim();

  const filteredMainViews = mainViews.filter((v) => !filterText || v.name.toLowerCase().includes(filterText));
  const filteredTaskViews = taskViews.filter((v) => !filterText || v.name.toLowerCase().includes(filterText));
  const filteredMasterViews = masterViews.filter((v) => !filterText || v.name.toLowerCase().includes(filterText));

  const isSettingsActive = pathname.startsWith("/settings");
  const isGeneralSettingsActive = pathname === "/settings/general";

  const isTaskPath = pathname.startsWith("/views/tasks") || pathname.startsWith("/views/works");
  const isMasterPath = pathname.startsWith("/views/") && !isTaskPath;

  const currentTab = filterText ? "all" : activeCategory;

  return (
    <aside className={`hidden md:flex fixed top-0 bottom-0 left-0 h-screen select-none bg-[#0b3531] text-slate-100 border-r border-[#062e2b] z-30 font-sans font-normal transition-all duration-300 ${collapsed ? "w-[60px]" : "w-[300px]"}`}>
      {/* 1. LEFT SLIM RAIL (60px) */}
      <div className="w-[60px] flex-shrink-0 h-full border-r border-[#0d3f3a] flex flex-col items-center justify-between py-3.5 bg-[#062e2b]">
        {/* Top Brand Logo Box */}
        <div className="flex flex-col items-center gap-3.5">
          <Link
            href="/"
            onClick={() => {
              if (collapsed) onToggleCollapse();
            }}
            className="w-9 h-9 flex items-center justify-center hover:opacity-85 transition shrink-0"
            title={companySettings.companyName || "CostLab Application"}
          >
            {companySettings.logoUrl ? (
              <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-md bg-[#072825] border border-[#144d47] flex items-center justify-center text-[#d4f54e] shadow-2xs hover:border-[#d4f54e]/50 transition">
                <Building2 size={20} />
              </div>
            )}
          </Link>

          {/* Rail Mode Switchers */}
          <nav className="flex flex-col items-center gap-2 mt-1">
            {/* Mode 1: Main Menus */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("main");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                currentTab === "main" || (currentTab === "all" && !isSettingsActive && !pathname.startsWith("/views/"))
                  ? "bg-[#d4f54e] text-[#0b3531] font-bold shadow-xs"
                  : "text-[#a5dad0] hover:text-white hover:bg-white/10"
              }`}
              title="เมนูหลัก (WORKPLACE)"
            >
              <LayoutGrid size={17} />
            </button>

            {/* Mode 2: Tasks & PW Group */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("task");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                currentTab === "task" || (currentTab === "all" && isTaskPath)
                  ? "bg-[#d4f54e] text-[#0b3531] font-bold shadow-xs"
                  : "text-[#a5dad0] hover:text-white hover:bg-white/10"
              }`}
              title="จัดการงาน & PW (TASKS & PW)"
            >
              <CheckSquare size={17} />
            </button>

            {/* Mode 3: Master Submenus */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("master");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                currentTab === "master" || (currentTab === "all" && isMasterPath)
                  ? "bg-[#d4f54e] text-[#0b3531] font-bold shadow-xs"
                  : "text-[#a5dad0] hover:text-white hover:bg-white/10"
              }`}
              title="ข้อมูลมาสเตอร์ (MASTER DATA)"
            >
              <Layers size={17} />
            </button>

            <div className="w-5 h-px bg-[#13443e] my-0.5" />

            {/* Mode 4: System & Settings */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("system");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                isSettingsActive || currentTab === "system"
                  ? "bg-[#d4f54e] text-[#0b3531] font-bold shadow-xs"
                  : "text-[#a5dad0] hover:text-white hover:bg-white/10"
              }`}
              title="ตั้งค่าระบบ (SYSTEM)"
            >
              <Database size={17} />
            </button>
          </nav>
        </div>

        {/* Bottom Rail Dock Tools */}
        <div className="flex flex-col items-center gap-2">
          {/* User Profile Avatar */}
          {collapsed && (
            <UserSwitcher currentUser={currentUser} compact isCollapsed theme="dark" />
          )}

          {/* Toggle Expand/Collapse */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-8 h-8 rounded-md border border-[#144d47] bg-[#0b3531] text-[#b4e3dc] hover:text-white hover:bg-[#13443e] flex items-center justify-center transition cursor-pointer"
            title={collapsed ? "ขยายแถบข้าง" : "ย่อแถบข้าง"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>

      {/* 2. RIGHT SECONDARY DRAWER PANEL (240px) */}
      {!collapsed && (
        <div className="w-[240px] flex-shrink-0 flex flex-col h-full bg-[#0b3531] text-slate-100 overflow-hidden border-r border-[#062e2b] font-sans font-normal">
          {/* Top Brand & Search Overlay Panel */}
          <div className="p-3 border-b border-[#12443e] bg-[#0b3531] sticky top-0 z-10 space-y-2">
            {/* Expanded Company Brand Header */}
            <div className="px-0.5 py-0.5">
              <div className="text-xs text-white leading-snug break-words font-sans font-semibold">
                {companySettings.companyName || "CostLab Executive"}
              </div>
              {companySettings.companySubTitle && (
                <div className="text-xs text-[#a2ccc3] font-medium leading-tight mt-0.5 truncate font-sans">
                  {companySettings.companySubTitle}
                </div>
              )}
            </div>

            {/* Search Input Bar */}
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-[#9ac5be] pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหาเมนู..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                autoComplete="off"
                className="w-full bg-[#062e2b] text-white text-xs pl-8 pr-2.5 py-1.5 rounded-md border border-[#164e48] focus:border-[#d4f54e] focus:outline-none placeholder:text-[#8cb8b0] font-sans font-medium transition"
              />
            </div>

            {/* Year Filter Selector */}
            <div className="pt-0.5">
              <YearSelector theme="dark" className="w-full" />
            </div>
          </div>

          {/* Menu Items Container */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-4 text-xs font-sans font-normal">
            {/* SECTION 1: เมนูหลัก (WORKPLACE) */}
            {(currentTab === "all" || currentTab === "main") && (
              <div className="space-y-1.5">
                <div className="px-1.5 pb-1 flex items-center justify-between text-xs text-[#86cfc2] uppercase font-sans font-semibold tracking-wider">
                  <span>เมนูหลัก (WORKPLACE)</span>
                  <span className="text-xs bg-[#072825] text-[#d4f54e] px-2 py-0.5 rounded-full border border-[#144d47] font-normal">
                    {filteredMainViews.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredMainViews.map((view) => {
                    const href = hrefFor(view.id);
                    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                    const Icon = ICONS[view.id] || Gauge;
                    return (
                      <Link
                        key={view.id}
                        href={href}
                        className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                          active
                            ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                            : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            active
                              ? "bg-[#0b3531] text-[#d4f54e]"
                              : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                          }`}
                        >
                          <Icon size={14} />
                        </span>
                        <span className="truncate">{view.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 2: จัดการงาน & PW (TASKS & PW) */}
            {(currentTab === "all" || currentTab === "task") && (
              <div className="space-y-1.5">
                <div className="px-1.5 pb-1 flex items-center justify-between text-xs text-[#86cfc2] uppercase font-sans font-semibold tracking-wider">
                  <span>จัดการงาน & PW (TASKS & PW)</span>
                  <span className="text-xs bg-[#072825] text-[#d4f54e] px-2 py-0.5 rounded-full border border-[#144d47] font-normal">
                    {filteredTaskViews.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredTaskViews.map((view) => {
                    const href = hrefFor(view.id);
                    const active = pathname.startsWith(href);
                    const Icon = ICONS[view.id] || ClipboardList;
                    return (
                      <Link
                        key={view.id}
                        href={href}
                        className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                          active
                            ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                            : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            active
                              ? "bg-[#0b3531] text-[#d4f54e]"
                              : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                          }`}
                        >
                          <Icon size={14} />
                        </span>
                        <span className="truncate">{view.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 3: ข้อมูลมาสเตอร์ (MASTER DATA) */}
            {(currentTab === "all" || currentTab === "master") && (
              <div className="space-y-1.5">
                <div className="px-1.5 pb-1 flex items-center justify-between text-xs text-[#86cfc2] uppercase font-sans font-semibold tracking-wider">
                  <span>ข้อมูลมาสเตอร์ (MASTER DATA)</span>
                  <span className="text-xs bg-[#072825] text-[#d4f54e] px-2 py-0.5 rounded-full border border-[#144d47] font-normal">
                    {filteredMasterViews.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {filteredMasterViews.map((view) => {
                    const href = hrefFor(view.id);
                    const active = pathname.startsWith(href);
                    const Icon = ICONS[view.id] || Layers;
                    return (
                      <Link
                        key={view.id}
                        href={href}
                        className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                          active
                            ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                            : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            active
                              ? "bg-[#0b3531] text-[#d4f54e]"
                              : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                          }`}
                        >
                          <Icon size={14} />
                        </span>
                        <span className="truncate">{view.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 3: ตั้งค่าระบบ (SYSTEM & ACCOUNT) */}
            {(currentTab === "all" || currentTab === "system") && (
              <div className="space-y-1.5">
                <div className="px-1.5 pb-1 text-xs text-[#86cfc2] uppercase font-sans font-semibold tracking-wider">
                  ตั้งค่าระบบ (SYSTEM & ACCOUNT)
                </div>
                <div className="space-y-1">
                  <Link
                    href="/settings/general"
                    prefetch={false}
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                      isGeneralSettingsActive
                        ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                        : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        isGeneralSettingsActive
                          ? "bg-[#0b3531] text-[#d4f54e]"
                          : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                      }`}
                    >
                      <Building2 size={14} />
                    </span>
                    <span className="truncate">ตั้งค่าทั่วไป & โลโก้</span>
                  </Link>

                  <Link
                    href="/settings"
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                      pathname === "/settings"
                        ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                        : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        pathname === "/settings"
                          ? "bg-[#0b3531] text-[#d4f54e]"
                          : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                      }`}
                    >
                      <Database size={14} />
                    </span>
                    <span className="truncate">สถานะ Supabase</span>
                  </Link>


                  <Link
                    href="/settings/options"
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                      pathname.startsWith("/settings/options")
                        ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                        : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        pathname.startsWith("/settings/options")
                          ? "bg-[#0b3531] text-[#d4f54e]"
                          : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                      }`}
                    >
                      <Sliders size={14} />
                    </span>
                    <span className="truncate">ตั้งค่าตัวเลือกระบบ</span>
                  </Link>

                  <Link
                    href="/settings/line-system"
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                      pathname.startsWith("/settings/line-system") || pathname.startsWith("/line-system")
                        ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                        : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        pathname.startsWith("/settings/line-system") || pathname.startsWith("/line-system")
                          ? "bg-[#0b3531] text-[#d4f54e]"
                          : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                      }`}
                    >
                      <MessageSquare size={14} />
                    </span>
                    <span className="truncate">ระบบ LINE Bot</span>
                  </Link>

                  <Link
                    href="/settings/import-export"
                    className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-xs font-sans ${
                      pathname.startsWith("/settings/import-export")
                        ? "bg-[#d4f54e] text-[#0b3531] font-semibold shadow-xs"
                        : "text-[#d6eee9] hover:text-white hover:bg-[#124d45] font-medium"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        pathname.startsWith("/settings/import-export")
                          ? "bg-[#0b3531] text-[#d4f54e]"
                          : "bg-[#083a34] text-[#a5dad0] border border-[#144d45] group-hover:bg-[#195a52] group-hover:text-white"
                      }`}
                    >
                      <ArrowDownUp size={14} />
                    </span>
                    <span className="truncate">นำเข้า / ส่งออกข้อมูล</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel Footer (User Switcher) */}
          <div className="p-2.5 border-t border-[#12443e] bg-[#062e2b]">
            <UserSwitcher currentUser={currentUser} compact theme="dark" />
          </div>
        </div>
      )}
    </aside>
  );
}
