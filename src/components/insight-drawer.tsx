"use client";

import { useState, useCallback, useEffect } from "react";
import type { Insight, EnrichedTransaction } from "@/types";
import { formatCurrency } from "@/lib/utils";

const TABS = ["Summary", "Evidence", "Transactions", "Similar Payments", "Action Plan"] as const;
type Tab = (typeof TABS)[number];

const SEVERITY_BADGE: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Low: "bg-sage-100 text-sage-700 dark:bg-sage-900/30 dark:text-sage-400",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Low: "bg-warm-gray text-warm-black/50 dark:bg-white/5 dark:text-zinc-300",
};

interface InsightDrawerProps {
  insight: Insight | null;
  onClose: () => void;
  onMarkReviewed: (insightId: string) => void;
  onMarkLegitimate: (insightId: string) => void;
  onNeedsFollowUp: (insightId: string) => void;
  reviewedIds: Set<string>;
  legitimateIds: Set<string>;
  followUpIds: Set<string>;
}

export function InsightDrawer({
  insight,
  onClose,
  onMarkReviewed,
  onMarkLegitimate,
  onNeedsFollowUp,
  reviewedIds,
  legitimateIds,
  followUpIds,
}: InsightDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Summary");

  // Reset tab when insight changes
  useEffect(() => {
    setActiveTab("Summary");
  }, [insight?.id]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (insight) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [insight]);

  const handleCopyQuestion = useCallback(() => {
    if (insight?.owner_question) {
      navigator.clipboard.writeText(insight.owner_question).catch(() => {});
    }
  }, [insight?.owner_question]);

  const isReviewed = insight ? reviewedIds.has(insight.id) : false;
  const isLegitimate = insight ? legitimateIds.has(insight.id) : false;
  const needsFollowUp = insight ? followUpIds.has(insight.id) : false;

  if (!insight) return null;

  const allTransactions = insight.grouped_transactions?.flatMap((g) => g.transactions) || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-warm-black/30 dark:bg-warm-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-warm-white dark:bg-warm-black border-l border-warm-gray dark:border-warm-white/10 z-50 overflow-hidden flex flex-col animate-drawer-slide-in shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-warm-gray dark:border-warm-white/10 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${SEVERITY_BADGE[insight.severity] || ""}`}>
                {insight.severity}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONFIDENCE_BADGE[insight.confidence] || ""}`}>
                {insight.confidence}
              </span>
              <span className="text-xs text-warm-black/30 dark:text-zinc-500 font-mono">
                {insight.category}
              </span>
            </div>
            <h2 className="font-display text-lg font-bold text-warm-black dark:text-warm-white leading-snug">
              {insight.short_title}
            </h2>
            <p className="text-sm text-warm-black/50 dark:text-zinc-300 mt-1">
              {insight.one_line_summary}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-warm-black/40 dark:text-zinc-400 hover:bg-warm-gray dark:hover:bg-white/5 transition-colors"
            aria-label="Close drawer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-warm-gray dark:border-warm-white/10 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === tab
                  ? "text-amber-600 dark:text-amber-500"
                  : "text-warm-black/40 dark:text-zinc-400 hover:text-warm-black/60 dark:hover:text-warm-white/50"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Tab: Summary */}
          {activeTab === "Summary" && (
            <div className="space-y-5">
              {insight.drilldown_sections?.map((section, i) => (
                <div key={i}>
                  <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                    {section.title}
                  </h3>
                  <p className="text-sm text-warm-black/70 dark:text-zinc-100 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}

              {(!insight.drilldown_sections || insight.drilldown_sections.length === 0) && (
                <>
                  <div>
                    <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      What triggered this?
                    </h3>
                    <p className="text-sm text-warm-black/70 dark:text-zinc-100 leading-relaxed">
                      {insight.why_flagged}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Why this matters
                    </h3>
                    <p className="text-sm text-warm-black/70 dark:text-zinc-100 leading-relaxed">
                      {insight.why_it_matters}
                    </p>
                  </div>
                  {insight.possible_legitimate_explanation && (
                    <div>
                      <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                        Possible legitimate explanation
                      </h3>
                      <p className="text-sm text-warm-black/60 dark:text-zinc-200 leading-relaxed italic border-l-2 border-amber-300 dark:border-amber-700 pl-3">
                        {insight.possible_legitimate_explanation}
                      </p>
                    </div>
                  )}
                  <div>
                    <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                      Recommended action
                    </h3>
                    <p className="text-sm text-warm-black/70 dark:text-zinc-100 leading-relaxed">
                      {insight.recommended_action}
                    </p>
                  </div>
                </>
              )}

              {/* Impact estimates */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider">
                    Amount at risk
                  </span>
                  <p className="font-mono text-lg font-medium text-red-500 mt-0.5">
                    {formatCurrency(insight.amount_at_risk)}
                  </p>
                </div>
                <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider">
                    Est. annual impact
                  </span>
                  <p className="font-mono text-lg font-medium text-sage-600 dark:text-sage-400 mt-0.5">
                    {formatCurrency(insight.estimated_annual_impact)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Evidence */}
          {activeTab === "Evidence" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Merchant names
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {insight.evidence?.merchant_names?.map((m) => (
                    <span key={m} className="px-2 py-1 rounded-md text-xs bg-warm-gray/60 dark:bg-white/5 text-warm-black/60 dark:text-zinc-200">
                      {m}
                    </span>
                  )) || <span className="text-sm text-warm-black/35 dark:text-zinc-500">None listed</span>}
                </div>
              </div>

              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Date pattern
                </h3>
                <p className="text-sm text-warm-black/60 dark:text-zinc-200">
                  {insight.evidence?.date_pattern || "Not specified"}
                </p>
              </div>

              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Frequency
                </h3>
                <p className="text-sm text-warm-black/60 dark:text-zinc-200">
                  {insight.evidence?.frequency || "Not specified"}
                </p>
              </div>

              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Amount pattern
                </h3>
                <p className="text-sm text-warm-black/60 dark:text-zinc-200">
                  {insight.evidence?.amount_pattern || "Not specified"}
                </p>
              </div>

              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Total value
                </h3>
                <p className="font-mono text-lg font-medium text-warm-black dark:text-warm-white">
                  {formatCurrency(insight.evidence?.total_value || insight.amount_at_risk)}
                </p>
              </div>

              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Detection cases
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {insight.detection_case_ids?.map((id) => (
                    <span key={id} className="px-2 py-0.5 rounded-full text-xs font-mono bg-warm-gray/50 dark:bg-white/5 text-warm-black/40 dark:text-zinc-400">
                      Case #{id}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  UI badges
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {insight.ui_badges?.map((badge) => (
                    <span key={badge} className="px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Transactions */}
          {activeTab === "Transactions" && (
            <div>
              {insight.grouped_transactions?.map((group, gi) => (
                <div key={gi} className="mb-6">
                  <h3 className="font-medium text-sm text-warm-black dark:text-warm-white mb-1">
                    {group.group_title}
                  </h3>
                  <p className="text-xs text-warm-black/40 dark:text-zinc-400 mb-3">
                    {group.group_reason} — {group.transaction_count} transaction(s), {formatCurrency(group.total_value)}
                  </p>
                  <div className="bg-warm-gray/20 dark:bg-white/[0.02] rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-warm-gray dark:border-warm-white/5">
                          <th className="text-left py-2 px-3 font-mono text-[10px] text-warm-black/30 dark:text-zinc-600 uppercase">Date</th>
                          <th className="text-left py-2 px-3 font-mono text-[10px] text-warm-black/30 dark:text-zinc-600 uppercase">Merchant</th>
                          <th className="text-left py-2 px-3 font-mono text-[10px] text-warm-black/30 dark:text-zinc-600 uppercase">Description</th>
                          <th className="text-right py-2 px-3 font-mono text-[10px] text-warm-black/30 dark:text-zinc-600 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.transactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-warm-gray/20 dark:border-warm-white/[0.01]">
                            <td className="py-1.5 px-3 font-mono text-warm-black/40 dark:text-zinc-400">{tx.date}</td>
                            <td className="py-1.5 px-3 text-warm-black/60 dark:text-zinc-200 max-w-[100px] truncate">{tx.merchant}</td>
                            <td className="py-1.5 px-3 text-warm-black/45 dark:text-zinc-300 max-w-[120px] truncate">{tx.description}</td>
                            <td className={`py-1.5 px-3 text-right font-mono ${tx.direction === "income" ? "text-sage-600 dark:text-sage-400" : "text-red-500"}`}>
                              {tx.direction === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {(!insight.grouped_transactions || insight.grouped_transactions.length === 0) && (
                <p className="text-sm text-warm-black/40 dark:text-zinc-400 text-center py-8">
                  No grouped transactions available for this insight.
                </p>
              )}
            </div>
          )}

          {/* Tab: Similar Payments */}
          {activeTab === "Similar Payments" && (
            <div className="space-y-4">
              <p className="text-sm text-warm-black/50 dark:text-zinc-300 mb-4">
                Suggested filters to find similar transactions:
              </p>
              {insight.suggested_filters && (
                <div className="space-y-3">
                  {insight.suggested_filters.merchant && (
                    <div className="glass rounded-lg p-3">
                      <span className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider">
                        Same merchant
                      </span>
                      <p className="text-sm text-warm-black/60 dark:text-zinc-200 mt-0.5">
                        {insight.suggested_filters.merchant}
                      </p>
                    </div>
                  )}
                  {insight.suggested_filters.category && (
                    <div className="glass rounded-lg p-3">
                      <span className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider">
                        Same category
                      </span>
                      <p className="text-sm text-warm-black/60 dark:text-zinc-200 mt-0.5">
                        {insight.suggested_filters.category}
                      </p>
                    </div>
                  )}
                  {insight.suggested_filters.cardholder && (
                    <div className="glass rounded-lg p-3">
                      <span className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider">
                        Same cardholder
                      </span>
                      <p className="text-sm text-warm-black/60 dark:text-zinc-200 mt-0.5">
                        {insight.suggested_filters.cardholder}
                      </p>
                    </div>
                  )}
                  {insight.suggested_filters.date_from && insight.suggested_filters.date_to && (
                    <div className="glass rounded-lg p-3">
                      <span className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider">
                        Date range
                      </span>
                      <p className="text-sm text-warm-black/60 dark:text-zinc-200 mt-0.5">
                        {insight.suggested_filters.date_from} — {insight.suggested_filters.date_to}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {(!insight.suggested_filters ||
                (!insight.suggested_filters.merchant &&
                  !insight.suggested_filters.category &&
                  !insight.suggested_filters.cardholder)) && (
                <p className="text-sm text-warm-black/40 dark:text-zinc-400 text-center py-8">
                  No filter suggestions available for this insight.
                </p>
              )}
            </div>
          )}

          {/* Tab: Action Plan */}
          {activeTab === "Action Plan" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Recommended action
                </h3>
                <p className="text-sm text-warm-black/70 dark:text-zinc-100 leading-relaxed">
                  {insight.recommended_action}
                </p>
              </div>

              {/* Owner question */}
              <div>
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Question to ask internally
                </h3>
                <p className="text-sm text-warm-black/60 dark:text-zinc-200 italic leading-relaxed border-l-2 border-amber-300 dark:border-amber-700 pl-3">
                  &ldquo;{insight.owner_question}&rdquo;
                </p>
                <button
                  onClick={handleCopyQuestion}
                  className="mt-2 px-3 py-1.5 rounded-full text-xs font-medium border border-warm-gray dark:border-warm-white/10 text-warm-black/50 dark:text-zinc-300 hover:bg-warm-gray/30 dark:hover:bg-white/5 transition-colors"
                >
                  Copy question
                </button>
              </div>

              {/* Review actions */}
              <div className="space-y-2 pt-3 border-t border-warm-gray dark:border-warm-white/5">
                <h3 className="font-mono text-[10px] text-warm-black/30 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  Review status
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onMarkReviewed(insight.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isReviewed
                        ? "bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400"
                        : "border border-warm-gray dark:border-warm-white/10 text-warm-black/50 dark:text-zinc-300 hover:bg-warm-gray/30 dark:hover:bg-white/5"
                    }`}
                  >
                    {isReviewed ? "✓ Reviewed" : "Mark as reviewed"}
                  </button>
                  <button
                    onClick={() => onMarkLegitimate(insight.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isLegitimate
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "border border-warm-gray dark:border-warm-white/10 text-warm-black/50 dark:text-zinc-300 hover:bg-warm-gray/30 dark:hover:bg-white/5"
                    }`}
                  >
                    {isLegitimate ? "✓ Legitimate" : "Looks legitimate"}
                  </button>
                  <button
                    onClick={() => onNeedsFollowUp(insight.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      needsFollowUp
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        : "border border-warm-gray dark:border-warm-white/10 text-warm-black/50 dark:text-zinc-300 hover:bg-warm-gray/30 dark:hover:bg-white/5"
                    }`}
                  >
                    {needsFollowUp ? "⏳ Follow-up" : "Needs follow-up"}
                  </button>
                </div>
              </div>

              {/* Impact summary */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider">
                    Monthly impact
                  </span>
                  <p className="font-mono text-lg font-medium text-sage-600 dark:text-sage-400 mt-0.5">
                    {formatCurrency(insight.estimated_monthly_impact)}
                  </p>
                </div>
                <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-lg p-3">
                  <span className="text-[10px] text-warm-black/30 dark:text-zinc-500 font-mono uppercase tracking-wider">
                    Annual impact
                  </span>
                  <p className="font-mono text-lg font-medium text-sage-600 dark:text-sage-400 mt-0.5">
                    {formatCurrency(insight.estimated_annual_impact)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
