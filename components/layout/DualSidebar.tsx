"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownUp,
  Award,
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
  FolderOpen,
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
  Sliders,
  Store,
  Users,
  WalletCards,
  X,
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
  "task-folders": FolderOpen,
  "task-performance": Award,
  settings: Database,
  "settings-general": Building2,
};

const CORE_FINANCE_IDS = new Set([
  "dashboard-main",
  "bill-entry",
  "withdraw-request",
  "contract-open",
  "petty-cash",
]);

const OPERATIONS_DOCS_IDS = new Set([
  "bill-follow",
  "work-status",
  "documents",
]);

const EXECUTIVE_REPORTS_IDS = new Set([
  "reports",
  "project-analytics",
]);

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
  if (viewId === "task-folders") return "/task-folders";
  if (viewId === "task-performance") return "/task-performance";
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
    if (
      path.startsWith("/views/tasks") ||
      path.startsWith("/views/works") ||
      path === "/tasks" ||
      path === "/works" ||
      path.startsWith("/task-folders") ||
      path.startsWith("/task-performance") ||
      path.startsWith("/quick-task") ||
      path.startsWith("/quick-work")
    ) {
      return "task";
    }
    if (path.startsWith("/views/")) {
      return "master";
    }
    return "main";
  };

  const [activeCategory, setActiveCategory] = useState<"all" | "main" | "task" | "master" | "system">(() =>
    getInitialCategory(pathname)
  );

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

  const coreFinanceViews = filteredMainViews.filter((v) => CORE_FINANCE_IDS.has(v.id));
  const operationsDocsViews = filteredMainViews.filter((v) => OPERATIONS_DOCS_IDS.has(v.id));
  const executiveReportsViews = filteredMainViews.filter((v) => EXECUTIVE_REPORTS_IDS.has(v.id));

  const isSettingsActive = pathname.startsWith("/settings");
  const isGeneralSettingsActive = pathname === "/settings/general";

  const isTaskPath =
    pathname.startsWith("/views/tasks") ||
    pathname.startsWith("/views/works") ||
    pathname === "/tasks" ||
    pathname === "/works" ||
    pathname.startsWith("/task-folders") ||
    pathname.startsWith("/task-performance") ||
    pathname.startsWith("/quick-task") ||
    pathname.startsWith("/quick-work");
  const isMasterPath = pathname.startsWith("/views/") && !isTaskPath;

  const currentTab = filterText ? "all" : activeCategory;

  const isMainRailActive =
    currentTab === "main" || (currentTab === "all" && !isSettingsActive && !pathname.startsWith("/views/"));
  const isTaskRailActive = currentTab === "task" || (currentTab === "all" && isTaskPath);
  const isMasterRailActive = currentTab === "master" || (currentTab === "all" && isMasterPath);
  const isSystemRailActive = isSettingsActive || currentTab === "system";

  const renderEnterpriseNavItem = (view: { id: string; name: string }) => {
    const href = hrefFor(view.id);
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    const Icon = ICONS[view.id] || Gauge;

    return (
      <Link
        key={view.id}
        href={href}
        className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 ${
          active
            ? "bg-[#16564f] text-white font-semibold border border-[#2c7d73] shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
            : "text-[#cde5e0] hover:text-white hover:bg-[#11403b] font-medium border border-transparent"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#d4f54e]" />
        )}
        <span
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
            active
              ? "bg-[#d4f54e] text-[#052320] shadow-2xs"
              : "bg-[#0d3632] text-[#89c9be] border border-[#19524b] group-hover:border-[#287067] group-hover:text-white"
          }`}
        >
          <Icon size={14} strokeWidth={active ? 2.3 : 1.9} />
        </span>
        <span className="truncate">{view.name}</span>
      </Link>
    );
  };

  return (
    <aside
      className={`dual-sidebar-nav hidden md:flex fixed top-0 bottom-0 left-0 h-screen select-none z-30 font-sans transition-all duration-300 border-r border-[#041a17] shadow-[4px_0_16px_rgba(5,25,23,0.18)] ${
        collapsed ? "w-[60px]" : "w-[300px]"
      }`}
    >
      {/* =====================================================================
          1. LEFT PRIMARY RAIL (60px) — Deep Obsidian Teal (#041a17)
             Stepped darker layer to separate primary modules from sub-menus
         ===================================================================== */}
      <div className="w-[60px] flex-shrink-0 h-full bg-[#041a17] border-r border-[#164a43] shadow-[3px_0_10px_rgba(0,0,0,0.28)] flex flex-col items-center justify-between py-3.5 z-20">
        <div className="flex flex-col items-center gap-3.5 w-full">
          {/* Brand Logo */}
          <Link
            href="/"
            onClick={() => {
              if (collapsed) onToggleCollapse();
            }}
            className="w-9 h-9 flex items-center justify-center hover:opacity-90 transition shrink-0"
            title={companySettings.companyName || "CostLab Executive"}
          >
            {companySettings.logoUrl ? (
              <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#0b3531] border border-[#22665d] flex items-center justify-center text-[#d4f54e] shadow-sm">
                <Building2 size={19} />
              </div>
            )}
          </Link>

          <div className="w-6 h-px bg-[#164a43]" />

          {/* Module Switchers */}
          <nav className="flex flex-col items-center gap-2 w-full px-2">
            {/* Module 1: Workplace */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("main");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isMainRailActive
                  ? "bg-[#124943] text-[#d4f54e] ring-1 ring-[#2c7d73] shadow-sm"
                  : "text-[#7fb5ac] hover:text-white hover:bg-[#0b3531]"
              }`}
              title="ระบบงานหลัก (Workplace)"
            >
              {isMainRailActive && (
                <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-[#d4f54e]" />
              )}
              <LayoutGrid size={18} strokeWidth={isMainRailActive ? 2.2 : 1.8} />
            </button>

            {/* Module 2: Tasks & PW */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("task");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isTaskRailActive
                  ? "bg-[#124943] text-[#d4f54e] ring-1 ring-[#2c7d73] shadow-sm"
                  : "text-[#7fb5ac] hover:text-white hover:bg-[#0b3531]"
              }`}
              title="บริหารงาน & PW (Tasks & Operations)"
            >
              {isTaskRailActive && (
                <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-[#d4f54e]" />
              )}
              <CheckSquare size={18} strokeWidth={isTaskRailActive ? 2.2 : 1.8} />
            </button>

            {/* Module 3: Master Data */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("master");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isMasterRailActive
                  ? "bg-[#124943] text-[#d4f54e] ring-1 ring-[#2c7d73] shadow-sm"
                  : "text-[#7fb5ac] hover:text-white hover:bg-[#0b3531]"
              }`}
              title="ทะเบียนข้อมูลหลัก (Master Data)"
            >
              {isMasterRailActive && (
                <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-[#d4f54e]" />
              )}
              <Layers size={18} strokeWidth={isMasterRailActive ? 2.2 : 1.8} />
            </button>

            <div className="w-6 h-px bg-[#164a43] my-0.5" />

            {/* Module 4: System Settings */}
            <button
              type="button"
              onClick={() => {
                setActiveCategory("system");
                setFilterSearch("");
                if (collapsed) onToggleCollapse();
              }}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isSystemRailActive
                  ? "bg-[#124943] text-[#d4f54e] ring-1 ring-[#2c7d73] shadow-sm"
                  : "text-[#7fb5ac] hover:text-white hover:bg-[#0b3531]"
              }`}
              title="ตั้งค่าระบบ (System Configuration)"
            >
              {isSystemRailActive && (
                <span className="absolute -left-2 top-2 bottom-2 w-[3px] rounded-r-full bg-[#d4f54e]" />
              )}
              <Database size={18} strokeWidth={isSystemRailActive ? 2.2 : 1.8} />
            </button>
          </nav>
        </div>

        {/* Bottom Dock */}
        <div className="flex flex-col items-center gap-2">
          {collapsed && (
            <UserSwitcher currentUser={currentUser} compact isCollapsed theme="dark" />
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-8 h-8 rounded-lg border border-[#19524b] bg-[#0b3531] text-[#9ad4ca] hover:text-white hover:bg-[#144d47] flex items-center justify-center transition cursor-pointer"
            title={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. RIGHT SECONDARY PANEL (240px) — Executive Forest Teal (#0b3531)
             Layered with Darker Control Decks (#072421) & Recessed Group Cards
         ===================================================================== */}
      {!collapsed && (
        <div className="w-[240px] flex-shrink-0 flex flex-col h-full bg-[#0b3531] text-white overflow-hidden">
          {/* Layer A: Recessed Top Control Deck (#072421) */}
          <div className="p-3 bg-[#072421] border-b border-[#164a43] sticky top-0 z-10 space-y-2.5 shadow-xs">
            <div className="px-0.5">
              <div className="text-xs font-bold text-white leading-snug tracking-wide truncate">
                {companySettings.companyName || "CostLab Executive"}
              </div>
              {companySettings.companySubTitle && (
                <div className="text-[11px] text-[#84bfb4] font-medium leading-tight mt-0.5 truncate">
                  {companySettings.companySubTitle}
                </div>
              )}
            </div>

            {/* Recessed Search Input */}
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-[#6daaa0] pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหาเมนู..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                autoComplete="off"
                className="w-full bg-[#041816] text-white text-xs pl-8 pr-7 py-1.5 rounded-lg border border-[#174d46] focus:border-[#d4f54e]/70 focus:outline-none placeholder:text-[#639c93] font-medium transition shadow-inner"
              />
              {filterSearch && (
                <button
                  type="button"
                  onClick={() => setFilterSearch("")}
                  className="absolute right-2 text-[#7fb5ac] hover:text-white cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Year Filter */}
            <div>
              <YearSelector theme="dark" className="w-full" />
            </div>
          </div>

          {/* Layer B: Segmented Navigation Body */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3 text-xs">
            {/* SECTION 1: WORKPLACE */}
            {(currentTab === "all" || currentTab === "main") && (
              <div className="space-y-3">
                {coreFinanceViews.length > 0 && (
                  <div className="rounded-xl bg-[#072623]/90 border border-[#154842] p-1.5 space-y-1 shadow-inner">
                    <div className="px-2 py-1 flex items-center justify-between border-b border-[#123f3a] mb-1">
                      <span className="text-[10px] font-bold text-[#8fd1c6] uppercase tracking-wider">
                        การเงินและเบิกจ่าย
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#0f3b36] text-[#9ad4ca] border border-[#1b564f]">
                        {coreFinanceViews.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {coreFinanceViews.map((view) => renderEnterpriseNavItem(view))}
                    </div>
                  </div>
                )}

                {operationsDocsViews.length > 0 && (
                  <div className="rounded-xl bg-[#072623]/90 border border-[#154842] p-1.5 space-y-1 shadow-inner">
                    <div className="px-2 py-1 flex items-center justify-between border-b border-[#123f3a] mb-1">
                      <span className="text-[10px] font-bold text-[#8fd1c6] uppercase tracking-wider">
                        ติดตามโครงการและเอกสาร
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#0f3b36] text-[#9ad4ca] border border-[#1b564f]">
                        {operationsDocsViews.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {operationsDocsViews.map((view) => renderEnterpriseNavItem(view))}
                    </div>
                  </div>
                )}

                {executiveReportsViews.length > 0 && (
                  <div className="rounded-xl bg-[#072623]/90 border border-[#154842] p-1.5 space-y-1 shadow-inner">
                    <div className="px-2 py-1 flex items-center justify-between border-b border-[#123f3a] mb-1">
                      <span className="text-[10px] font-bold text-[#8fd1c6] uppercase tracking-wider">
                        รายงานและวิเคราะห์งบ
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#0f3b36] text-[#9ad4ca] border border-[#1b564f]">
                        {executiveReportsViews.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {executiveReportsViews.map((view) => renderEnterpriseNavItem(view))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: TASKS & PW */}
            {(currentTab === "all" || currentTab === "task") && (
              <div className="rounded-xl bg-[#072623]/90 border border-[#154842] p-1.5 space-y-1 shadow-inner">
                <div className="px-2 py-1 flex items-center justify-between border-b border-[#123f3a] mb-1">
                  <span className="text-[10px] font-bold text-[#8fd1c6] uppercase tracking-wider">
                    บริหารงาน & ทีม PW
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#0f3b36] text-[#9ad4ca] border border-[#1b564f]">
                    {filteredTaskViews.length}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {filteredTaskViews.map((view) => renderEnterpriseNavItem(view))}
                </div>
              </div>
            )}

            {/* SECTION 3: MASTER DATA */}
            {(currentTab === "all" || currentTab === "master") && (
              <div className="rounded-xl bg-[#072623]/90 border border-[#154842] p-1.5 space-y-1 shadow-inner">
                <div className="px-2 py-1 flex items-center justify-between border-b border-[#123f3a] mb-1">
                  <span className="text-[10px] font-bold text-[#8fd1c6] uppercase tracking-wider">
                    ทะเบียนข้อมูลมาสเตอร์
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#0f3b36] text-[#9ad4ca] border border-[#1b564f]">
                    {filteredMasterViews.length}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {filteredMasterViews.map((view) => renderEnterpriseNavItem(view))}
                </div>
              </div>
            )}

            {/* SECTION 4: SYSTEM & ACCOUNT */}
            {(currentTab === "all" || currentTab === "system") && (
              <div className="rounded-xl bg-[#072623]/90 border border-[#154842] p-1.5 space-y-1 shadow-inner">
                <div className="px-2 py-1 flex items-center justify-between border-b border-[#123f3a] mb-1">
                  <span className="text-[10px] font-bold text-[#8fd1c6] uppercase tracking-wider">
                    ตั้งค่าระบบ (System)
                  </span>
                </div>
                <div className="space-y-0.5">
                  {[
                    {
                      href: "/settings/general",
                      label: "ตั้งค่าทั่วไป & โลโก้",
                      icon: Building2,
                      active: isGeneralSettingsActive,
                    },
                    {
                      href: "/settings",
                      label: "สถานะฐานข้อมูล Supabase",
                      icon: Database,
                      active: pathname === "/settings",
                    },
                    {
                      href: "/settings/options",
                      label: "ตั้งค่าตัวเลือกระบบ",
                      icon: Sliders,
                      active: pathname.startsWith("/settings/options"),
                    },
                    {
                      href: "/settings/line-system",
                      label: "ระบบเชื่อมต่อ LINE Bot",
                      icon: MessageSquare,
                      active:
                        pathname.startsWith("/settings/line-system") ||
                        pathname.startsWith("/line-system"),
                    },
                    {
                      href: "/settings/import-export",
                      label: "สำรอง / นำเข้า-ส่งออกข้อมูล",
                      icon: ArrowDownUp,
                      active: pathname.startsWith("/settings/import-export"),
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 ${
                          item.active
                            ? "bg-[#16564f] text-white font-semibold border border-[#2c7d73] shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
                            : "text-[#cde5e0] hover:text-white hover:bg-[#11403b] font-medium border border-transparent"
                        }`}
                      >
                        {item.active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#d4f54e]" />
                        )}
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            item.active
                              ? "bg-[#d4f54e] text-[#052320] shadow-2xs"
                              : "bg-[#0d3632] text-[#89c9be] border border-[#19524b] group-hover:border-[#287067] group-hover:text-white"
                          }`}
                        >
                          <Icon size={14} strokeWidth={item.active ? 2.3 : 1.9} />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Layer C: Recessed Bottom User Profile Bar (#072421) */}
          <div className="p-2.5 border-t border-[#164a43] bg-[#072421]">
            <UserSwitcher currentUser={currentUser} compact theme="dark" />
          </div>
        </div>
      )}
    </aside>
  );
}
