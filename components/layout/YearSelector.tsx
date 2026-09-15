"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { useYearFilter } from "@/lib/context/YearFilterContext";
import { useRouter } from "next/navigation";

interface YearSelectorProps {
  theme?: "dark" | "light";
  compact?: boolean;
  className?: string;
  onYearChange?: (year: string) => void;
}

export function YearSelector({
  theme = "dark",
  compact = false,
  className = "",
  onYearChange,
}: YearSelectorProps) {
  const { selectedYear, setSelectedYear, availableYears, isAllYears } = useYearFilter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (yearValue: string) => {
    setSelectedYear(yearValue);
    setIsOpen(false);
    if (onYearChange) {
      onYearChange(yearValue);
    }
    // Refresh Server Components to refetch server data matching the selected year
    router.refresh();
  };

  const activeOption = availableYears.find((y) => y.value === selectedYear) || {
    value: selectedYear,
    label: selectedYear === "all" ? "ทุกปี" : `ปี ${selectedYear}`,
    thYear: selectedYear === "all" ? "ทุกปี" : String(Number(selectedYear) + 543),
    enYear: selectedYear,
  };

  const isDark = theme === "dark";

  return (
    <div ref={dropdownRef} className={`relative inline-block text-xs font-sans ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-medium select-none ${
          isDark
            ? "bg-[#062e2b] text-[#d4f54e] border-[#164e48] hover:border-[#d4f54e]/60 hover:bg-[#093d38] shadow-2xs"
            : "bg-white text-slate-800 border-slate-200 hover:border-emerald-500 hover:bg-slate-50 shadow-2xs"
        } ${compact ? "px-2 py-1 text-[11px]" : ""}`}
        title="เลือกปีสำหรับแสดงผลข้อมูลทั้งระบบ"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar
            size={compact ? 12 : 13}
            className={`shrink-0 ${isDark ? "text-[#a5dad0]" : "text-emerald-600"}`}
          />
          <span className="truncate font-semibold text-left">
            {compact
              ? isAllYears
                ? "ทุกปี"
                : activeOption.enYear
              : isAllYears
              ? "ทุกปี (All Years)"
              : `ปี ${activeOption.enYear} (${activeOption.thYear})`}
          </span>
        </div>
        <ChevronDown
          size={11}
          className={`shrink-0 transition-transform duration-200 ml-1 ${
            isOpen ? "rotate-180" : ""
          } ${isDark ? "text-[#a5dad0]" : "text-slate-400"}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 mt-1 w-52 rounded-lg border shadow-lg py-1 z-50 overflow-hidden ${
            isDark
              ? "bg-[#062e2b] border-[#144d47] text-slate-200"
              : "bg-white border-slate-200 text-slate-800"
          }`}
          role="listbox"
        >
          <div
            className={`px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider border-b ${
              isDark
                ? "text-[#86cfc2] border-[#0d3f3a] bg-[#04201e]"
                : "text-slate-500 border-slate-100 bg-slate-50"
            }`}
          >
            เลือกปีข้อมูล (Fiscal Year)
          </div>

          <div className="max-h-56 overflow-y-auto py-0.5">
            {availableYears.map((option) => {
              const isSelected = option.value === selectedYear;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? isDark
                        ? "bg-[#0d3f3a] text-[#d4f54e] font-bold"
                        : "bg-emerald-50 text-emerald-800 font-bold"
                      : isDark
                      ? "text-slate-300 hover:bg-[#0a3531] hover:text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isSelected
                          ? "bg-[#d4f54e]"
                          : option.isCurrent
                          ? "bg-emerald-500"
                          : "bg-transparent"
                      }`}
                    />
                    <span className="truncate">{option.label}</span>
                  </div>

                  {isSelected && (
                    <Check
                      size={13}
                      className={isDark ? "text-[#d4f54e]" : "text-emerald-600"}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className={`px-2.5 py-1 text-[10px] border-t text-center ${
              isDark
                ? "border-[#0d3f3a] text-[#86cfc2]/70 bg-[#04201e]"
                : "border-slate-100 text-slate-400 bg-slate-50"
            }`}
          >
            กรองข้อมูลบิล สัญญา และรายงานตามปี
          </div>
        </div>
      )}
    </div>
  );
}
