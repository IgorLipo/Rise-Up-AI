"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface FlaggedTransaction {
  merchant: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  suggestedCategory: string;
  shouldExcludeFromBusiness: boolean;
  date: string;
  amount: number;
  description: string;
}

const RISK_COLORS = {
  high: { border: "border-l-red-500", bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-700" },
  medium: { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  low: { border: "border-l-zinc-300", bg: "bg-zinc-50", text: "text-zinc-600", badge: "bg-zinc-100 text-zinc-600" },
};

interface Props {
  flagged: FlaggedTransaction[];
}

export function SuspiciousFlagged({ flagged }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (flagged.length === 0) return null;

  const highRisk = flagged.filter((f) => f.riskLevel === "high").length;
  const mediumRisk = flagged.filter((f) => f.riskLevel === "medium").length;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
            Needs review
          </h2>
          {highRisk > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
              {highRisk} high
            </span>
          )}
          {mediumRisk > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
              {mediumRisk} medium
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-400">{flagged.length} flagged</span>
          <svg
            className={`w-4 h-4 text-zinc-300 transition-transform ${collapsed ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {flagged.map((f, i) => {
            const colors = RISK_COLORS[f.riskLevel];
            return (
              <div
                key={i}
                className={`bg-white border border-zinc-200 rounded-lg p-3 border-l-3 ${colors.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.badge}`}>
                        {f.riskLevel}
                      </span>
                      <span className="text-sm font-medium text-zinc-900 truncate">
                        {f.merchant || f.description.slice(0, 40)}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{f.reason}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {f.date} · {f.suggestedCategory}
                      {f.shouldExcludeFromBusiness ? " · exclude from business" : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-medium text-red-500">
                      -{formatCurrency(f.amount)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
