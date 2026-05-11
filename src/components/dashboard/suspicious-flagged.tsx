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

function humanizeReason(reason: string): { label: string; category: "personal_expense" | "unclear" | "needs_review" } {
  const lower = reason.toLowerCase();
  if (lower.includes("personal") || lower.includes("not business")) {
    return { label: "Possible personal expense", category: "personal_expense" };
  }
  if (lower.includes("unclear") || lower.includes("ambiguous") || lower.includes("unknown")) {
    return { label: "Business context unclear", category: "unclear" };
  }
  return { label: "Needs review", category: "needs_review" };
}

interface Props {
  flagged: FlaggedTransaction[];
  onAction?: (item: FlaggedTransaction, action: "mark-business" | "mark-personal" | "exclude" | "apply-rule") => void;
}

export function SuspiciousFlagged({ flagged, onAction }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());
  const [lastAction, setLastAction] = useState<string | null>(null);

  if (flagged.length === 0) return null;

  const highRisk = flagged.filter((f) => f.riskLevel === "high").length;
  const mediumRisk = flagged.filter((f) => f.riskLevel === "medium").length;
  const visibleItems = flagged.filter((_, i) => !resolvedIds.has(i));

  const handleAction = (item: FlaggedTransaction, action: "mark-business" | "mark-personal" | "exclude" | "apply-rule", index: number) => {
    const label =
      action === "mark-business" ? "business" :
      action === "mark-personal" ? "personal" :
      action === "exclude" ? "excluded" : "rule applied";
    setLastAction(`Marked as ${label}`);
    setResolvedIds(new Set([...resolvedIds, index]));
    onAction?.(item, action);
    setTimeout(() => setLastAction(null), 3000);
  };

  return (
    <div>
      {/* Confirmation indicator */}
      {lastAction && (
        <div className="mb-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center justify-between">
          <span>{lastAction}</span>
          <button onClick={() => setLastAction(null)} className="text-emerald-400 hover:text-emerald-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
          {resolvedIds.size > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
              {resolvedIds.size} resolved
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
          {visibleItems.length === 0 ? (
            <p className="text-center text-xs text-zinc-400 py-4">All items reviewed.</p>
          ) : (
            visibleItems.map((f, visibleIdx) => {
              const colors = RISK_COLORS[f.riskLevel];
              const reasonInfo = humanizeReason(f.reason);
              return (
                <div
                  key={visibleIdx}
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
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          reasonInfo.category === "personal_expense" ? "bg-amber-50 text-amber-700" :
                          reasonInfo.category === "unclear" ? "bg-zinc-100 text-zinc-600" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {reasonInfo.label}
                        </span>
                        {f.suggestedCategory && (
                          <span className="text-[10px] text-zinc-400">suggested: {f.suggestedCategory.replace(/-/g, " ")}</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {f.date}
                        {f.shouldExcludeFromBusiness ? " · exclude from business" : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono font-medium text-red-500">
                        -{formatCurrency(f.amount)}
                      </div>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="mt-2 pt-2 border-t border-zinc-100 flex flex-wrap gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(f, "mark-business", visibleIdx);
                      }}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      Business expense
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(f, "mark-personal", visibleIdx);
                      }}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      Personal expense
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(f, "exclude", visibleIdx);
                      }}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                    >
                      Exclude from forecast
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(f, "apply-rule", visibleIdx);
                      }}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                    >
                      Apply rule to similar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
