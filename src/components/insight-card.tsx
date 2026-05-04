"use client";

import type { Insight } from "@/types";
import { formatCurrency } from "@/lib/utils";

const SEVERITY_BORDER: Record<string, string> = {
  Critical: "border-l-red-500",
  High: "border-l-orange-500",
  Medium: "border-l-amber-500",
  Low: "border-l-sage-400",
};

const SEVERITY_BADGE: Record<string, string> = {
  Critical: "bg-red-500/10 text-red-400 border border-red-500/20",
  High: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  Medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  Low: "bg-sage-500/10 text-sage-400 border border-sage-500/20",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  Medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  Low: "bg-white/5 text-zinc-500 border border-white/5",
};

interface InsightCardProps {
  insight: Insight;
  onClick: (insight: Insight) => void;
  isSelected?: boolean;
}

export function InsightCard({ insight, onClick, isSelected }: InsightCardProps) {
  const merchantNames = insight.evidence?.merchant_names?.slice(0, 4) || [];
  const hasMoreMerchants = (insight.evidence?.merchant_names?.length || 0) > 4;
  const transactionCount = insight.transaction_ids?.length || 0;

  return (
    <button
      type="button"
      onClick={() => onClick(insight)}
      className={`w-full text-left glass rounded-xl border-l-4 ${SEVERITY_BORDER[insight.severity] || "border-l-amber-500"} insight-card-hover focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
        isSelected ? "ring-2 ring-amber-500 shadow-lg" : ""
      }`}
    >
      <div className="p-5">
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${SEVERITY_BADGE[insight.severity] || ""}`}>
            {insight.severity}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONFIDENCE_BADGE[insight.confidence] || ""}`}>
            {insight.confidence}
          </span>
          {insight.ui_badges?.slice(0, 2).map((badge) => (
            <span
              key={badge}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-zinc-500"
            >
              {badge}
            </span>
          ))}
          {insight.detection_case_ids?.slice(0, 1).map((caseId) => (
            <span
              key={caseId}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-white/5 text-zinc-500"
            >
              Case #{caseId}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="font-display text-base font-semibold text-white leading-snug mb-1.5">
          {insight.short_title}
        </h3>

        {/* One-line summary */}
        <p className="text-sm text-warm-black/55 dark:text-zinc-300 leading-relaxed mb-3">
          {insight.one_line_summary}
        </p>

        {/* Key metrics */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider">
              At risk
            </span>
            <span className="font-mono text-sm font-medium text-red-500">
              {formatCurrency(insight.amount_at_risk)}
            </span>
          </div>
          {transactionCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider">
                Txn
              </span>
              <span className="font-mono text-sm font-medium text-warm-black dark:text-warm-white">
                {transactionCount}
              </span>
            </div>
          )}
          {insight.estimated_monthly_impact > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider">
                /mo
              </span>
              <span className="font-mono text-sm font-medium text-sage-600 dark:text-sage-400">
                {formatCurrency(insight.estimated_monthly_impact)}
              </span>
            </div>
          )}
        </div>

        {/* Merchant tags */}
        {merchantNames.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider shrink-0">
              Merchants:
            </span>
            {merchantNames.map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 rounded-md text-xs bg-warm-gray/60 dark:bg-white/5 text-warm-black/50 dark:text-zinc-300 truncate max-w-[160px]"
                title={name}
              >
                {name}
              </span>
            ))}
            {hasMoreMerchants && (
              <span className="text-xs text-warm-black/30 dark:text-zinc-500">
                +{insight.evidence.merchant_names.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
