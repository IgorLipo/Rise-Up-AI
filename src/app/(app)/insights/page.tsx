"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AIInsights, SpendReviewResult, AnalysisMode, Insight } from "@/types";
import { InsightCard } from "@/components/insight-card";
import { InsightDrawer } from "@/components/insight-drawer";
import { OwnerReviewPack } from "@/components/owner-review-pack";

export default function InsightsPage() {
  const [insights, setInsights] = useState<AIInsights | SpendReviewResult | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("personal");

  // Drawer state
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [legitimateIds, setLegitimateIds] = useState<Set<string>>(new Set());
  const [followUpIds, setFollowUpIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const raw = sessionStorage.getItem("statementInsights");
    const rawMode = sessionStorage.getItem("analysisMode");
    if (raw) setInsights(JSON.parse(raw));
    if (rawMode === "business") setMode("business");
  }, []);

  const isBusiness = mode === "business";
  const businessInsights = isBusiness ? (insights as SpendReviewResult | null) : null;
  const personalInsights = !isBusiness ? (insights as AIInsights | null) : null;

  const handleCardClick = useCallback((insight: Insight) => {
    setSelectedInsight(insight);
  }, []);

  const handleMarkReviewed = useCallback((insightId: string) => {
    setReviewedIds((prev) => {
      const next = new Set(prev);
      if (next.has(insightId)) next.delete(insightId);
      else next.add(insightId);
      return next;
    });
  }, []);

  const handleMarkLegitimate = useCallback((insightId: string) => {
    setLegitimateIds((prev) => {
      const next = new Set(prev);
      if (next.has(insightId)) next.delete(insightId);
      else next.add(insightId);
      return next;
    });
  }, []);

  const handleNeedsFollowUp = useCallback((insightId: string) => {
    setFollowUpIds((prev) => {
      const next = new Set(prev);
      if (next.has(insightId)) next.delete(insightId);
      else next.add(insightId);
      return next;
    });
  }, []);

  const handleReviewItemClick = useCallback((insightId: string) => {
    const insight = businessInsights?.insights.find((i) => i.id === insightId);
    if (insight) setSelectedInsight(insight);
  }, [businessInsights]);

  if (!insights) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="glass rounded-3xl p-16">
          <h1 className="font-display text-2xl font-bold text-warm-black dark:text-warm-white mb-4">
            No insights yet
          </h1>
          <p className="text-warm-black/50 dark:text-zinc-300 mb-6">
            Upload a statement to get AI-powered financial insights.
          </p>
          <Link
            href="/upload"
            className="inline-flex px-6 py-2.5 rounded-full bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
          >
            Upload a statement
          </Link>
        </div>
      </div>
    );
  }

  // ── Business Insights View ──

  if (isBusiness && businessInsights) {
    const { executive_summary, insights: items, quick_actions } = businessInsights;

    return (
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h1 className="font-display text-3xl font-bold text-warm-black dark:text-warm-white">
            Business Spend Review
          </h1>
          <p className="mt-1 text-warm-black/45 dark:text-zinc-400">
            Forensic analysis of your business bank statement.
          </p>
        </div>

        {/* Executive Summary */}
        <div className="glass rounded-2xl p-8 border-l-4 border-amber-500">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-mono text-xs text-amber-600 dark:text-amber-500 uppercase tracking-wider">
              Executive Summary
            </span>
          </div>
          <p className="text-sm text-warm-black/70 dark:text-zinc-100 leading-relaxed mb-6">
            {executive_summary.plain_english_summary}
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-xl p-4 text-center">
              <p className="text-xs text-warm-black/35 dark:text-zinc-500 font-mono uppercase tracking-wider">Items to Review</p>
              <p className="text-3xl font-display font-bold text-warm-black dark:text-warm-white mt-2">{executive_summary.items_to_review}</p>
            </div>
            <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-xl p-4 text-center">
              <p className="text-xs text-warm-black/35 dark:text-zinc-500 font-mono uppercase tracking-wider">Insights Found</p>
              <p className="text-3xl font-display font-bold text-warm-black dark:text-warm-white mt-2">{items.length}</p>
            </div>
            <div className="bg-sage-100/50 dark:bg-sage-900/10 rounded-xl p-4 text-center">
              <p className="text-xs text-warm-black/35 dark:text-zinc-500 font-mono uppercase tracking-wider">Est. Monthly Savings</p>
              <p className="text-3xl font-display font-bold text-sage-700 dark:text-sage-400 mt-2">{formatCurrency(executive_summary.estimated_monthly_savings.amount)}</p>
            </div>
          </div>
          {executive_summary.top_3_findings.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-xs text-warm-black/35 dark:text-zinc-500 font-mono uppercase tracking-wider mb-3">Top 3 Findings</p>
              {executive_summary.top_3_findings.map((f, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="font-display font-bold text-amber-500 shrink-0">{i + 1}.</span>
                  <div>
                    <p className="text-warm-black/70 dark:text-zinc-100 font-medium">{f.title}</p>
                    <p className="text-xs text-warm-black/40 dark:text-zinc-400 mt-0.5">
                      {f.why_it_matters} — {formatCurrency(f.amount_at_risk)} at risk
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        {quick_actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quick_actions.map((action, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-warm-gray/50 dark:bg-white/5 text-warm-black/50 dark:text-zinc-300"
              >
                {action.label}
              </span>
            ))}
          </div>
        )}

        {/* All insights */}
        <div>
          <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-6">
            Detailed Findings ({items.length})
          </h2>
          {items.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <p className="text-sm text-warm-black/40 dark:text-zinc-400">
                No significant spending patterns detected. Your business finances appear well-controlled.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((insight) => (
                <div key={insight.id} className="relative">
                  {reviewedIds.has(insight.id) && (
                    <span className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400">
                      Reviewed
                    </span>
                  )}
                  <InsightCard
                    insight={insight}
                    onClick={handleCardClick}
                    isSelected={selectedInsight?.id === insight.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Owner Review Pack */}
        {businessInsights.owner_review_pack.length > 0 && (
          <div>
            <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-6">
              Owner Review Pack
            </h2>
            <OwnerReviewPack
              items={businessInsights.owner_review_pack}
              onItemClick={handleReviewItemClick}
            />
          </div>
        )}

        {/* Missing data */}
        {businessInsights.missing_data.length > 0 && (
          <div className="glass rounded-2xl p-8 border-2 border-dashed border-warm-gray dark:border-warm-white/10">
            <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
              To Improve This Analysis
            </h2>
            <ul className="space-y-2">
              {businessInsights.missing_data.map((d, i) => (
                <li key={i} className="text-sm text-warm-black/45 dark:text-zinc-400 flex gap-2">
                  <span className="text-warm-black/20 dark:text-warm-white/15 shrink-0">-</span>
                  <span className="font-medium">{d.field}:</span> {d.why_it_would_help}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Insight Drawer */}
        <InsightDrawer
          insight={selectedInsight}
          onClose={() => setSelectedInsight(null)}
          onMarkReviewed={handleMarkReviewed}
          onMarkLegitimate={handleMarkLegitimate}
          onNeedsFollowUp={handleNeedsFollowUp}
          reviewedIds={reviewedIds}
          legitimateIds={legitimateIds}
          followUpIds={followUpIds}
        />
      </div>
    );
  }

  // ── Personal Insights View ──

  if (!personalInsights) return null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-warm-black dark:text-warm-white">
          AI-powered insights
        </h1>
        <p className="mt-1 text-warm-black/45 dark:text-zinc-400">
          Automated analysis of your financial patterns.
        </p>
      </div>

      {/* Health score */}
      <div className="glass rounded-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-xs text-warm-black/35 dark:text-zinc-500 uppercase tracking-wider">
              Cash Flow Health
            </span>
            <p className="font-display text-4xl font-bold mt-2 text-warm-black dark:text-warm-white capitalize">
              {personalInsights.cashFlowHealth}
            </p>
          </div>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center ${
              personalInsights.cashFlowHealth === "excellent"
                ? "bg-sage-400/20"
                : personalInsights.cashFlowHealth === "good"
                  ? "bg-amber-100 dark:bg-amber-900/20"
                  : personalInsights.cashFlowHealth === "fair"
                    ? "bg-orange-100"
                    : "bg-red-100"
            }`}
          >
            <span
              className={`text-3xl ${
                personalInsights.cashFlowHealth === "excellent"
                  ? "text-sage-600 dark:text-sage-400"
                  : personalInsights.cashFlowHealth === "good"
                    ? "text-amber-600 dark:text-amber-400"
                    : personalInsights.cashFlowHealth === "fair"
                      ? "text-orange-600"
                      : "text-red-500"
              }`}
            >
              {personalInsights.cashFlowHealth === "excellent" ? "↑" : personalInsights.cashFlowHealth === "good" ? "↗" : personalInsights.cashFlowHealth === "fair" ? "→" : "↓"}
            </span>
          </div>
        </div>
      </div>

      {/* Forecast */}
      <div className="glass rounded-2xl p-8">
        <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
          Monthly forecast
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 mb-6">
          {[
            { label: "Projected Income", value: formatCurrency(personalInsights.monthlyForecast.projectedIncome), tone: "positive" },
            { label: "Projected Expenses", value: formatCurrency(personalInsights.monthlyForecast.projectedExpenses), tone: "negative" },
            { label: "Projected Balance", value: formatCurrency(personalInsights.monthlyForecast.projectedBalance), tone: personalInsights.monthlyForecast.projectedBalance >= 0 ? "positive" : "negative" },
          ].map((m) => (
            <div key={m.label} className="text-center p-4 rounded-xl bg-warm-gray/30 dark:bg-white/[0.02]">
              <span className="text-xs text-warm-black/35 dark:text-zinc-500 font-mono uppercase tracking-wider">
                {m.label}
              </span>
              <p
                className={`mt-1 font-mono text-xl font-medium ${
                  m.tone === "positive" ? "text-sage-600 dark:text-sage-400" : "text-red-500"
                }`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-warm-black/35 dark:text-zinc-500 font-mono uppercase tracking-wider">
            Confidence
          </span>
          <div className="flex-1 h-1.5 bg-warm-gray dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${(personalInsights.monthlyForecast.confidence * 100).toFixed(0)}%` }}
            />
          </div>
          <span className="font-mono text-xs text-warm-black/45 dark:text-zinc-400">
            {(personalInsights.monthlyForecast.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <p className="mt-4 text-sm text-warm-black/60 dark:text-zinc-200 leading-relaxed">
          {personalInsights.monthlyForecast.narrative}
        </p>
      </div>

      {/* Spending patterns */}
      <div className="glass rounded-2xl p-8">
        <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
          Spending patterns
        </h2>
        <ul className="space-y-3">
          {personalInsights.spendingPatterns.map((p, i) => (
            <li key={i} className="flex gap-3 text-sm text-warm-black/70 dark:text-zinc-100">
              <span className="text-amber-500 shrink-0 mt-0.5">-</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Unusual activity */}
      <div className="glass rounded-2xl p-8">
        <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
          Unusual activity
        </h2>
        {personalInsights.unusualActivity.length > 0 ? (
          <ul className="space-y-3">
            {personalInsights.unusualActivity.map((u, i) => (
              <li key={i} className="flex gap-3 text-sm text-warm-black/70 dark:text-zinc-100">
                <span className="text-red-400 shrink-0 mt-0.5">!</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-warm-black/40 dark:text-zinc-400">
            No unusual activity detected in your statements.
          </p>
        )}
      </div>

      {/* Savings opportunities */}
      <div className="glass rounded-2xl p-8">
        <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
          Savings opportunities
        </h2>
        <ul className="space-y-3">
          {personalInsights.savingsOpportunities.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-warm-black/70 dark:text-zinc-100">
              <span className="text-sage-600 dark:text-sage-400 shrink-0 mt-0.5">+</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Top recommendations */}
      <div className="glass rounded-2xl p-8 bg-amber-50/30 dark:bg-amber-900/5 border border-amber-200/50 dark:border-amber-800/20">
        <h2 className="font-display text-xl font-semibold text-amber-800 dark:text-amber-400 mb-4">
          Your top priorities
        </h2>
        <ol className="space-y-4">
          {personalInsights.topRecommendations.map((r, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-display text-2xl font-bold text-amber-300 dark:text-amber-600 shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-warm-black/70 dark:text-zinc-100 pt-1">{r}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function formatCurrency(amount: number, currency = "£"): string {
  const formatted = Math.abs(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}
