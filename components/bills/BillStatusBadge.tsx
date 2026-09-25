import React from "react";
import { getBillStatusConfig } from "@/lib/bills/bill-status";

interface BillStatusBadgeProps {
  status: unknown;
  className?: string;
  showDot?: boolean;
}

export function BillStatusBadge({ status, className = "", showDot = true }: BillStatusBadgeProps) {
  const rawStatus = String(status || "").trim();
  const config = getBillStatusConfig(rawStatus || "รออนุมัติ");
  const displayLabel = rawStatus || config.label;

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border transition-colors shadow-2xs whitespace-nowrap ${config.badge} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />}
      <span>{displayLabel}</span>
    </span>
  );
}
