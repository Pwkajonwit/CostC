"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { getRowYear, isProjectInYear } from "@/lib/utils/dates";
import {
  type ResolvedFiscalPeriod,
  isBillInFiscalPeriod,
  resolveEffectivePeriodRanges,
  isRowMatchingYearOrPeriod,
  extractTargetYear
} from "@/lib/fiscal-periods/fiscal-period-types";

export type YearOption = {
  value: string;       // "2026", "all", "period_2026", "period_2026_q1", etc.
  label: string;       // "ปี 2026 (2569)" or "ทุกปี (All Years)"
  thYear: string;      // "2569" or "ทุกปี"
  enYear: string;      // "2026" or "All"
  isCurrent?: boolean;
  isCustomPeriod?: boolean;
  rangeBadge?: string; // e.g. "บิล #1 - #499"
  periodConfig?: ResolvedFiscalPeriod;
  type?: "year" | "quarter" | "all";
};

interface YearFilterContextType {
  selectedYear: string; // "2026", "2025", "all", etc.
  setSelectedYear: (year: string) => void;
  availableYears: YearOption[];
  fiscalPeriods: ResolvedFiscalPeriod[];
  isRowInYear: (row: Record<string, any> | null | undefined, customYear?: string) => boolean;
  filterRowsByYear: <T extends Record<string, any>>(rows: T[], customYear?: string) => T[];
  filterProjectsByYear: <T extends Record<string, any>>(projects: T[], billsInYear?: Record<string, any>[], customYear?: string) => T[];
  activeYearLabel: string;
  isAllYears: boolean;
  refreshFiscalPeriods: () => Promise<void>;
}

const YearFilterContext = createContext<YearFilterContextType | null>(null);

const STORAGE_KEY = "costlab_selected_year";
const COOKIE_NAME = "costlab_selected_year";

export function YearFilterProvider({
  children,
  initialYear,
  dataYears,
}: {
  children: React.ReactNode;
  initialYear?: string;
  /** Array of CE years (e.g. [2025, 2026]) extracted from actual project/bill data */
  dataYears?: number[];
}) {
  const currentEnYear = new Date().getFullYear(); // e.g. 2026
  const [fiscalPeriods, setFiscalPeriods] = useState<ResolvedFiscalPeriod[]>([]);

  // Function to load custom fiscal periods from API
  const refreshFiscalPeriods = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/fiscal-periods");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.periods)) {
          setFiscalPeriods(json.periods);
        }
      }
    } catch {
      // Ignore background load error
    }
  }, []);

  useEffect(() => {
    refreshFiscalPeriods();
    const handleUpdate = () => refreshFiscalPeriods();
    window.addEventListener("fiscal-periods-updated", handleUpdate);
    return () => window.removeEventListener("fiscal-periods-updated", handleUpdate);
  }, [refreshFiscalPeriods]);

  // Generate dynamic list of years & periods
  const availableYears: YearOption[] = useMemo(() => {
    const list: YearOption[] = [
      {
        value: "all",
        label: "ทุกปี (All Years)",
        thYear: "ทุกปี",
        enYear: "All",
        isCurrent: false,
        type: "all"
      }
    ];

    // If custom fiscal periods are configured, add them
    if (fiscalPeriods.length > 0) {
      // Sort: years descending, then startSeq ascending
      const sortedPeriods = [...fiscalPeriods].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.startSeq - b.startSeq;
      });

      // Count how many periods exist per year
      const yearCounts: Record<number, number> = {};
      for (const p of sortedPeriods) {
        if (p.type === "year") {
          yearCounts[p.year] = (yearCounts[p.year] || 0) + 1;
        }
      }

      for (const p of sortedPeriods) {
        const isYearCurrent = p.year === currentEnYear;
        const hasMultipleInYear = p.type === "year" && (yearCounts[p.year] || 0) > 1;

        const baseTitle = p.type === "year" 
          ? `ปี ${p.year}` 
          : `ปี ${p.year} Q${p.quarter || 1}`;

        // Custom name entered by user
        let customName: string | undefined = undefined;
        if (p.customName && p.customName.trim()) {
          customName = p.customName.trim();
        } else if (
          p.label && 
          p.label.trim() && 
          p.label.trim() !== String(p.year) && 
          p.label.trim() !== `ปี ${p.year}` &&
          p.label.trim() !== `ปี ${p.year} (พ.ศ. ${p.year + 543})`
        ) {
          customName = p.label.trim();
        }

        // If user gave a custom name, use it.
        // If not, BUT there are multiple periods in the same year, show the rangeLabel so they can be distinguished!
        const badge = customName || (hasMultipleInYear ? p.rangeLabel : undefined);

        // Always use p.id as unique value so multiple periods in the same year don't collide
        const periodValue = p.id;

        list.push({
          value: periodValue,
          label: baseTitle,
          thYear: String(p.year + 543),
          enYear: String(p.year),
          isCurrent: isYearCurrent,
          isCustomPeriod: true,
          rangeBadge: badge,
          periodConfig: p,
          type: p.type
        });
      }
    }

    // If NO custom periods are configured at all, fallback to standard calendar years
    if (fiscalPeriods.length === 0) {
      let yearSet: Set<number>;
      if (dataYears && dataYears.length > 0) {
        yearSet = new Set(dataYears);
        yearSet.add(currentEnYear);
      } else {
        yearSet = new Set<number>();
        for (let y = currentEnYear + 1; y >= currentEnYear - 4; y--) {
          yearSet.add(y);
        }
      }

      const sortedYears = Array.from(yearSet).sort((a, b) => b - a);

      for (const y of sortedYears) {
        const th = y + 543;
        list.push({
          value: String(y),
          label: `ปี ${y} (พ.ศ. ${th})`,
          thYear: String(th),
          enYear: String(y),
          isCurrent: y === currentEnYear,
          type: "year"
        });
      }
    }

    return list;
  }, [currentEnYear, dataYears, fiscalPeriods]);

  // Determine initial selected year
  const defaultYear = String(currentEnYear);
  const [selectedYear, setSelectedYearState] = useState<string>(() => {
    if (initialYear && initialYear.trim()) return initialYear.trim();
    return defaultYear;
  });

  // Client-side initial load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === "all" || saved.length > 0)) {
        setSelectedYearState(saved);
        // Sync cookie for Next.js SSR
        document.cookie = `${COOKIE_NAME}=${saved}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      }
    } catch {}
  }, []);

  const setSelectedYear = useCallback((newYear: string) => {
    setSelectedYearState(newYear);
    try {
      localStorage.setItem(STORAGE_KEY, newYear);
      document.cookie = `${COOKIE_NAME}=${newYear}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent("costlab-year-changed", { detail: { year: newYear } }));
    } catch {}
  }, []);

  const isRowInYear = useCallback((row: Record<string, any> | null | undefined, customYear?: string): boolean => {
    const target = customYear !== undefined ? customYear : selectedYear;
    return isRowMatchingYearOrPeriod(row, target, fiscalPeriods);
  }, [fiscalPeriods, selectedYear]);

  const filterRowsByYear = useCallback(<T extends Record<string, any>>(rows: T[], customYear?: string): T[] => {
    const target = customYear !== undefined ? customYear : selectedYear;
    if (!target || target === "all") return rows;
    if (!Array.isArray(rows)) return [];

    return rows.filter((row) => isRowMatchingYearOrPeriod(row, target, fiscalPeriods));
  }, [fiscalPeriods, selectedYear]);

  const filterProjectsByYear = useCallback(<T extends Record<string, any>>(projects: T[], billsInYear?: Record<string, any>[], customYear?: string): T[] => {
    const target = customYear !== undefined ? customYear : selectedYear;
    if (!target || target === "all") return projects;
    if (!Array.isArray(projects)) return [];

    const targetCalYear = extractTargetYear(target);

    // If billsInYear is provided, filter projects that have bills in this period
    if (Array.isArray(billsInYear) && billsInYear.length > 0) {
      const activeProjIds = new Set<string>();
      for (const b of billsInYear) {
        if (isRowMatchingYearOrPeriod(b, target, fiscalPeriods)) {
          const pId = String(b.project_id || b["ID Project"] || "").trim();
          if (pId) activeProjIds.add(pId);
        }
      }
      return projects.filter(p => {
        const id = String(p.id || p["ID Project"] || "").trim();
        if (activeProjIds.has(id)) return true;
        return isProjectInYear(p, targetCalYear);
      });
    }

    return projects.filter((p) => isProjectInYear(p, targetCalYear));
  }, [fiscalPeriods, selectedYear]);

  const activeYearLabel = useMemo(() => {
    const found = availableYears.find((y) => 
      y.value === selectedYear || 
      y.periodConfig?.id === selectedYear || 
      y.enYear === selectedYear
    );
    if (found) {
      if (found.rangeBadge) {
        return `${found.label} (${found.rangeBadge})`;
      }
      return found.label;
    }
    if (selectedYear === "all") return "ทุกปี (All Years)";
    const yrNum = parseInt(selectedYear, 10);
    return !isNaN(yrNum) ? `ปี ${yrNum} (พ.ศ. ${yrNum + 543})` : selectedYear;
  }, [availableYears, selectedYear]);

  const isAllYears = selectedYear === "all";

  const contextValue = useMemo(() => ({
    selectedYear,
    setSelectedYear,
    availableYears,
    fiscalPeriods,
    isRowInYear,
    filterRowsByYear,
    filterProjectsByYear,
    activeYearLabel,
    isAllYears,
    refreshFiscalPeriods
  }), [
    selectedYear,
    setSelectedYear,
    availableYears,
    fiscalPeriods,
    isRowInYear,
    filterRowsByYear,
    filterProjectsByYear,
    activeYearLabel,
    isAllYears,
    refreshFiscalPeriods
  ]);

  return (
    <YearFilterContext.Provider value={contextValue}>
      {children}
    </YearFilterContext.Provider>
  );
}

export function useYearFilter() {
  const context = useContext(YearFilterContext);
  if (!context) {
    // Fallback safe values if used outside provider
    const fallbackYear = String(new Date().getFullYear());
    return {
      selectedYear: fallbackYear,
      setSelectedYear: () => {},
      availableYears: [
        { value: fallbackYear, label: `ปี ${fallbackYear}`, thYear: String(Number(fallbackYear) + 543), enYear: fallbackYear, isCurrent: true, type: "year" as const },
        { value: "all", label: "ทุกปี", thYear: "ทุกปี", enYear: "All", type: "all" as const }
      ],
      fiscalPeriods: [],
      isRowInYear: () => true,
      filterRowsByYear: <T extends Record<string, any>>(rows: T[]) => rows,
      filterProjectsByYear: <T extends Record<string, any>>(projects: T[]) => projects,
      activeYearLabel: `ปี ${fallbackYear}`,
      isAllYears: false,
      refreshFiscalPeriods: async () => {}
    };
  }
  return context;
}

export { isProjectInYear };
