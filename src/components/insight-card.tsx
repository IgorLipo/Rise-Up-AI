"use client";

import type { Insight } from "@/types";
import { formatCurrency } from "@/lib/utils";

const SEVERITY_BORDER: Record<string, string> = {
  Critical: "border-l-red-500",
  High: "border-l-orange-500",
  Medium: "border-l-amber-500",
  Low: "border-l-emerald-400",
};

const SEVERITY_BADGE: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border border-red-200",
  High: "bg-orange-50 text-orange-700 border border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-zinc-100 text-zinc-500 border border-zinc-200",
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
      className={`w-full text-left bg-white border border-zinc-200 rounded-xl border-l-4 ${SEVERITY_BORDER[insight.severity] || "border-l-amber-500"} hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-900/20 transition-shadow ${
        isSelected ? "ring-2 ring-zinc-900 shadow-lg" : ""
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
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-500"
            >
              {badge}
            </span>
          ))}
          {insight.detection_case_ids?.slice(0, 1).map((caseId) => (
            <span
              key={caseId}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-100 text-zinc-500"
            >
              Case #{caseId}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="font-display text-base font-semibold text-zinc-900 leading-snug mb-1.5">
          {insight.short_title}
        </h3>

        {/* One-line summary */}
        <p className="text-sm text-zinc-500 leading-relaxed mb-3">
          {insight.one_line_summary}
        </p>

        {/* Key metrics */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
              At risk
            </span>
            <span className="font-mono text-sm font-medium text-red-600">
              {formatCurrency(insight.amount_at_risk)}
            </span>
          </div>
          {transactionCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                Txn
              </span>
              <span className="font-mono text-sm font-medium text-zinc-900">
                {transactionCount}
              </span>
            </div>
          )}
          {insight.estimated_monthly_impact > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
                /mo
              </span>
              <span className="font-mono text-sm font-medium text-emerald-600">
                {formatCurrency(insight.estimated_monthly_impact)}
              </span>
            </div>
          )}
        </div>

        {/* Merchant tags */}
        {merchantNames.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider shrink-0">
              Merchants:
            </span>
            {merchantNames.map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 rounded-md text-xs bg-zinc-100 text-zinc-600 truncate max-w-[160px]"
                title={name}
              >
                {name}
              </span>
            ))}
            {hasMoreMerchants && (
              <span className="text-xs text-zinc-400">
                +{insight.evidence.merchant_names.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
