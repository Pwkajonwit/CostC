"use client";

import type { ComponentType, FormEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  HandCoins,
  IdCard,
  Menu,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Store,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { PRIMARY_VIEWS } from "@/lib/config";
import { DualSidebar } from "@/components/layout/DualSidebar";
import { UserSwitcher } from "@/components/auth/UserSwitcher";
import { YearSelector } from "@/components/layout/YearSelector";
import type { SheetRow } from "@/lib/types";

const ICONS: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  "dashboard-main": Gauge,
  "bill-entry": ReceiptText,
  "withdraw-request": WalletCards,
  "contract-open": BriefcaseBusiness,
  "bill-follow": ClipboardList,
  "work-status": FolderKanban,
  documents: FileText,
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
  works: BriefcaseBusiness
};

const MOBILE_VIEW_IDS = ["dashboard-main", "bill-entry", "withdraw-request", "contract-open", "bill-follow", "work-status"];

function hrefFor(view: (typeof PRIMARY_VIEWS)[number]) {
  if (view.id === "dashboard-main") return "/";
  if (view.id === "bill-entry") return "/bills";
  if (view.id === "withdraw-request") return "/withdraw-request";
  if (view.id === "contract-open") return "/contract-open";
  if (view.id === "bill-follow") return "/bill-follow";
  if (view.id === "work-status") return "/work-status";
  if (view.id === "documents") return "/documents";
  if (view.id === "reports") return "/reports";
  if (view.id === "project-analytics") return "/project-analytics";
  return `/views/${view.id}`;
}

export function AppShell({ children, peopleRows = [], currentUser = null }: { children: ReactNode, peopleRows?: SheetRow[], currentUser?: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const mobileViews = PRIMARY_VIEWS.filter(view => MOBILE_VIEW_IDS.includes(view.id));
  const mobileTaskViews = PRIMARY_VIEWS.filter(view => view.position === "task");
  const mobileMenuViews = PRIMARY_VIEWS.filter(view => view.position === "menu");
  const activeView = PRIMARY_VIEWS.find(view => {
    const href = hrefFor(view);
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }) || PRIMARY_VIEWS[0];

  const [companySettings, setCompanySettings] = useState({
    companyName: "CostLab App",
    companySubTitle: "Executive Management",
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get("search") || "";
    setMobileSearch(search);
    setMobileSearchOpen(Boolean(search));
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("overflow-hidden");
    };
  }, [mobileMenuOpen]);

  function pushSearch(value: string) {
    const params = new URLSearchParams(window.location.search);
    const query = value.trim();
    if (query) params.set("search", query);
    else params.delete("search");
    const nextQuery = params.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function handleMobileSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushSearch(mobileSearch);
  }

  function closeMobileSearch() {
    setMobileSearch("");
    setMobileSearchOpen(false);
    pushSearch("");
  }

  async function handleGlobalRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/cache", { method: "POST" });
      router.refresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }

  const mobileAddEvent =
    pathname === "/bills"
      ? "open-bill-form"
      : pathname === "/contract-open"
        ? "open-contract-form"
        : "";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-200 text-slate-800 antialiased">
      {/* Mobile Navigation Header & Drawer (Hidden on Desktop) */}
      <div className="md:hidden block">
        {/* Topbar - Fixed at top with Deep Forest Teal Background */}
        <header className="h-14 bg-[#0b3531] border-b border-[#062e2b] px-4 flex items-center justify-between fixed top-0 inset-x-0 z-30 shadow-md text-white">
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-[#9eb5b0] hover:text-white hover:bg-[#13443e] transition-colors"
            aria-label="เปิดเมนู"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={22} />
          </button>
          {mobileSearchOpen ? (
            <form className="flex-1 mx-3 flex items-center gap-2" onSubmit={handleMobileSearchSubmit}>
              <input
                ref={mobileSearchInputRef}
                type="search"
                className="w-full h-9 px-3 text-sm bg-[#062e2b] border border-[#164e48] text-white placeholder:text-[#6e8e88] rounded-xl focus:outline-none focus:border-[#d4f54e]"
                aria-label="ค้นหา"
                placeholder="ค้นหา..."
                enterKeyHint="search"
                value={mobileSearch}
                onChange={event => setMobileSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    pushSearch(mobileSearch);
                  }
                  if (event.key === "Escape") closeMobileSearch();
                }}
              />
              <button type="submit" className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#d4f54e] text-[#0b3531] shrink-0" aria-label="ค้นหา">
                <Search size={16} />
              </button>
            </form>
          ) : (
            <span className="text-white truncate max-w-[200px] text-center text-sm">{activeView.name}</span>
          )}
          <div className="flex items-center gap-1.5">
            <YearSelector theme="dark" compact />
            {mobileSearchOpen ? (
              <button type="button" className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-300 hover:bg-[#13443e]" aria-label="ปิดค้นหา" onClick={closeMobileSearch}><X size={20} /></button>
            ) : (
              mobileAddEvent ? (
                <button
                  type="button"
                  className="h-9 px-3.5 sm:px-4 flex items-center justify-center gap-1.5 rounded-xl bg-[#d4f54e] text-[#0b3531] hover:bg-[#c2e438] shadow-sm cursor-pointer active:scale-95 transition text-xs"
                  aria-label="เพิ่มข้อมูล"
                  onClick={() => window.dispatchEvent(new CustomEvent(mobileAddEvent))}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  <span>เพิ่ม</span>
                </button>
              ) : null
            )}
          </div>
        </header>

        {/* Drawer Backdrop */}
        <div
          className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity duration-300 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Drawer Slide-over Panel */}
        <aside className={`fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="เมนูเพิ่มเติม">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#0b3531] text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 overflow-hidden">
                {companySettings.logoUrl ? (
                  <img src={companySettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center text-[#d4f54e] bg-[#062e2b] border border-[#144d47] rounded-md shadow-2xs">
                    <Building2 size={18} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <strong className="block text-sm leading-none truncate text-white">
                  {companySettings.companyName || "CostLab App"}
                </strong>
                <span className="text-xs text-[#9eb5b0] truncate block mt-0.5">
                  {companySettings.companySubTitle || "Executive Management"}
                </span>
              </div>
            </div>
            <button type="button" className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9eb5b0] hover:text-white hover:bg-[#13443e]" aria-label="ปิดเมนู" onClick={() => setMobileMenuOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Year Filter inside Drawer */}
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">เลือกปีแสดงผล</div>
            <YearSelector theme="light" className="w-full" />
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-3">
            {mobileTaskViews.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-[#86cfc2] uppercase tracking-wider">
                  จัดการงาน & PW
                </div>
                {mobileTaskViews.map(view => {
                  const href = hrefFor(view);
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  const Icon = ICONS[view.id];
                  return (
                    <Link
                      key={view.id}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        active ? "bg-[#d4f54e] text-[#0b3531] shadow-xs font-semibold" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-[#0b3531] text-[#d4f54e]" : "bg-slate-100 text-slate-500"}`}>
                        {Icon ? <Icon size={16} strokeWidth={2.1} /> : view.name.slice(0, 1)}
                      </span>
                      <span className="truncate">{view.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="space-y-1">
              <div className="px-2 py-1 text-xs font-semibold text-[#86cfc2] uppercase tracking-wider">
                ข้อมูลมาสเตอร์
              </div>
              {mobileMenuViews.map(view => {
                const href = hrefFor(view);
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                const Icon = ICONS[view.id];
                return (
                  <Link
                    key={view.id}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      active ? "bg-[#d4f54e] text-[#0b3531] shadow-xs font-semibold" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-[#0b3531] text-[#d4f54e]" : "bg-slate-100 text-slate-500"}`}>
                      {Icon ? <Icon size={16} strokeWidth={2.1} /> : view.name.slice(0, 1)}
                    </span>
                    <span className="truncate">{view.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
          <div className="p-3 border-t border-slate-100 bg-slate-50">
            <UserSwitcher currentUser={currentUser} theme="light" />
          </div>
        </aside>

        {/* Mobile Bottom Navigation Bar - Fixed at bottom with Deep Forest Teal Background & Safe Area Padding */}
        <nav className="fixed bottom-0 inset-x-0 bg-[#0b3531] border-t border-[#062e2b] flex items-center justify-around z-30 shadow-2xl px-1 pt-1.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] text-white md:hidden">
          {mobileViews.map(view => {
            const href = hrefFor(view);
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const Icon = ICONS[view.id];
            return (
              <Link
                key={view.id}
                href={href}
                className={`flex flex-col items-center justify-center w-full py-1 text-xs font-medium transition-colors ${active ? "text-[#d4f54e] " : "text-[#9eb5b0] hover:text-slate-200"
                  }`}
              >
                <span className={`p-1 rounded-xl transition-all ${active ? "bg-[#d4f54e] text-[#0b3531] shadow-xs" : ""}`}>
                  {Icon ? <Icon size={20} strokeWidth={active ? 2.3 : 1.8} /> : null}
                </span>
                <small className="mt-1 text-[11px] leading-tight truncate max-w-[64px] font-medium">{view.name}</small>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <DualSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        currentUser={currentUser}
      />

      {/* Main Workspace Area (With padding for fixed Mobile Header & Footer) */}
      <main className={`flex-1 min-w-0 min-h-screen pt-14 pb-24 md:pt-0 md:pb-0 relative transition-all duration-300 ${collapsed ? "md:pl-[60px]" : "md:pl-[300px]"}`}>
        {children}
      </main>
    </div>
  );
}
