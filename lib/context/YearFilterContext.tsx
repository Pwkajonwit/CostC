"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { getRowYear, isProjectInYear } from "@/lib/utils/dates";

export type YearOption = {
  value: string;       // "2026" or "all"
  label: string;       // "ปี 2026 (2569)" or "ทุกปี (All Years)"
  thYear: string;      // "2569" or "ทุกปี"
  enYear: string;      // "2026" or "All"
  isCurrent?: boolean;
};

interface YearFilterContextType {
  selectedYear: string; // "2026", "2025", "all", etc.
  setSelectedYear: (year: string) => void;
  availableYears: YearOption[];
  isRowInYear: (row: Record<string, any> | null | undefined, customYear?: string) => boolean;
  filterRowsByYear: <T extends Record<string, any>>(rows: T[], customYear?: string) => T[];
  filterProjectsByYear: <T extends Record<string, any>>(projects: T[], billsInYear?: Record<string, any>[], customYear?: string) => T[];
  activeYearLabel: string;
  isAllYears: boolean;
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

  // Generate dynamic list of years based on actual data years, or fall back to hardcoded range
  const availableYears: YearOption[] = useMemo(() => {
    const list: YearOption[] = [
      {
        value: "all",
        label: "ทุกปี (All Years)",
        thYear: "ทุกปี",
        enYear: "All",
        isCurrent: false,
      }
    ];

    let yearSet: Set<number>;

    if (dataYears && dataYears.length > 0) {
      // Use actual data years + always include the current year
      yearSet = new Set(dataYears);
      yearSet.add(currentEnYear);
    } else {
      // Fallback: Current + 1, Current, and previous 4 years
      yearSet = new Set<number>();
      for (let y = currentEnYear + 1; y >= currentEnYear - 4; y--) {
        yearSet.add(y);
      }
    }

    // Sort descending
    const sortedYears = Array.from(yearSet).sort((a, b) => b - a);

    for (const y of sortedYears) {
      const th = y + 543;
      list.push({
        value: String(y),
        label: `ปี ${y} (พ.ศ. ${th})`,
        thYear: String(th),
        enYear: String(y),
        isCurrent: y === currentEnYear,
      });
    }

    return list;
  }, [currentEnYear, dataYears]);

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
      if (saved && (saved === "all" || /^\d{4}$/.test(saved))) {
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
    const targetYear = customYear !== undefined ? customYear : selectedYear;
    if (!targetYear || targetYear === "all") return true;

    const rowYr = getRowYear(row);
    if (!rowYr) {
      // If row has no date, keep it visible so users don't lose untracked data
      return true;
    }

    return String(rowYr) === String(targetYear);
  }, [selectedYear]);

  const filterRowsByYear = useCallback(<T extends Record<string, any>>(rows: T[], customYear?: string): T[] => {
    const targetYear = customYear !== undefined ? customYear : selectedYear;
    if (!targetYear || targetYear === "all") return rows;
    if (!Array.isArray(rows)) return [];

    return rows.filter((row) => isRowInYear(row, targetYear));
  }, [isRowInYear, selectedYear]);

  const filterProjectsByYear = useCallback(<T extends Record<string, any>>(projects: T[], billsInYear?: Record<string, any>[], customYear?: string): T[] => {
    const targetYear = customYear !== undefined ? customYear : selectedYear;
    if (!targetYear || targetYear === "all") return projects;
    if (!Array.isArray(projects)) return [];

    return projects.filter((p) => isProjectInYear(p, targetYear, billsInYear));
  }, [selectedYear]);

  const activeYearLabel = useMemo(() => {
    const found = availableYears.find((y) => y.value === selectedYear);
    if (found) return found.label;
    if (selectedYear === "all") return "ทุกปี (All Years)";
    const yrNum = parseInt(selectedYear, 10);
    return !isNaN(yrNum) ? `ปี ${yrNum} (พ.ศ. ${yrNum + 543})` : selectedYear;
  }, [availableYears, selectedYear]);

  const isAllYears = selectedYear === "all";

  const contextValue = useMemo(() => ({
    selectedYear,
    setSelectedYear,
    availableYears,
    isRowInYear,
    filterRowsByYear,
    filterProjectsByYear,
    activeYearLabel,
    isAllYears,
  }), [
    selectedYear,
    setSelectedYear,
    availableYears,
    isRowInYear,
    filterRowsByYear,
    filterProjectsByYear,
    activeYearLabel,
    isAllYears
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
        { value: fallbackYear, label: `ปี ${fallbackYear}`, thYear: String(Number(fallbackYear) + 543), enYear: fallbackYear, isCurrent: true },
        { value: "all", label: "ทุกปี", thYear: "ทุกปี", enYear: "All" }
      ],
      isRowInYear: () => true,
      filterRowsByYear: <T extends Record<string, any>>(rows: T[]) => rows,
      filterProjectsByYear: <T extends Record<string, any>>(projects: T[]) => projects,
      activeYearLabel: `ปี ${fallbackYear}`,
      isAllYears: false,
    };
  }
  return context;
}

export { isProjectInYear };


