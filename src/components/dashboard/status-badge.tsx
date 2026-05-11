"use client";

import type { ForecastStatus } from "@/types";

const config: Record<
  ForecastStatus,
  { label: string; className: string; dotColor: string; criteria: string }
> = {
  safe: {
    label: "Safe",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotColor: "bg-emerald-500",
    criteria:
      "Balance covers all expected expenses for the rest of the month with a 20%+ buffer.",
  },
  watch: {
    label: "Watch",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dotColor: "bg-amber-500",
    criteria:
      "Balance covers expected expenses but buffer is below 20% — monitor closely.",
  },
  risk: {
    label: "Risk",
    className: "bg-red-50 text-red-700 border-red-200",
    dotColor: "bg-red-500",
    criteria:
      "Balance may drop below zero on some days this month. Review upcoming payments.",
  },
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-800 border-red-300",
    dotColor: "bg-red-500",
    criteria:
      "Balance is already below zero or projected to stay below. Immediate action needed.",
  },
};

interface StatusBadgeProps {
  status: ForecastStatus;
  className?: string;
  showCriteria?: boolean;
}

export function StatusBadge({
  status,
  className = "",
  showCriteria = true,
}: StatusBadgeProps) {
  const c = config[status];

  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${c.className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${c.dotColor}`} />
        {c.label}
        {showCriteria && (
          <span className="ml-1.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-zinc-200 text-zinc-500 text-[9px] font-bold leading-none cursor-help">
            ?
          </span>
        )}
      </span>

      {/* Tooltip */}
      {showCriteria && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-zinc-900 text-white text-xs rounded-lg p-3 shadow-lg z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150">
          <div className="font-semibold mb-1">{c.label}</div>
          <div className="text-zinc-300 leading-relaxed">{c.criteria}</div>
        </div>
      )}
    </span>
  );
}
