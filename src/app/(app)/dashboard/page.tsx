"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import type { StatementData, AIInsights, SpendReviewResult, AnalysisMode, Insight } from "@/types";
import { InsightCard } from "@/components/insight-card";
import { InsightDrawer } from "@/components/insight-drawer";
import { OwnerReviewPack } from "@/components/owner-review-pack";
import { SpendBreakdownDonut } from "@/components/charts/spend-breakdown-donut";
import { DocumentHistoryCard } from "@/components/history/document-history-card";
import { getDocumentHistory, type DocumentHistoryEntry } from "@/lib/history";

export default function DashboardPage() {
  const [data, setData] = useState<StatementData | null>(null);
  const [insights, setInsights] = useState<AIInsights | SpendReviewResult | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("personal");
  const [docHistory, setDocHistory] = useState<DocumentHistoryEntry[]>([]);

  // Drawer state
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [legitimateIds, setLegitimateIds] = useState<Set<string>>(new Set());
  const [followUpIds, setFollowUpIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const raw = sessionStorage.getItem("statementData");
    const rawInsights = sessionStorage.getItem("statementInsights");
    const rawMode = sessionStorage.getItem("analysisMode");
    if (raw) setData(JSON.parse(raw));
    if (rawInsights) setInsights(JSON.parse(rawInsights));
    if (rawMode === "business") setMode("business");
    setDocHistory(getDocumentHistory());
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

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="glass rounded-3xl p-16">
          <h1 className="font-display text-2xl font-bold text-warm-black dark:text-warm-white mb-4">
            No statement data yet
          </h1>
          <p className="text-warm-black/50 dark:text-warm-white/40 mb-6">
            Upload a bank statement to see your dashboard.
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

  const monthlyData = data.monthlyBreakdown.map((m) => ({
    month: formatMonth(m.month),
    Income: Math.round(m.credits),
    Spending: Math.round(m.debits),
    "Net Flow": Math.round(m.netFlow),
  }));

  const pieData = data.categoryBreakdown.slice(0, 8).map((c) => ({
    name: c.category,
    value: Math.round(c.total),
  }));

  const totalSpend = data.summary.totalDebits;
  const unreviewedCount = businessInsights
    ? businessInsights.executive_summary.items_to_review
    : 0;
  const totalAtRisk = businessInsights
    ? businessInsights.insights.reduce((sum, i) => sum + i.amount_at_risk, 0)
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 md:py-10 space-y-6 md:space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-warm-black dark:text-warm-white">
            {isBusiness ? "Business money, decoded" : "Your money, decoded"}
          </h1>
          <p className="mt-1 text-sm text-warm-black/45 dark:text-warm-white/35">
            {isBusiness
              ? "Business spend review with forensic analysis."
              : "Everything extracted from your statement, visualised."}
          </p>
        </div>
        {isBusiness && businessInsights && (
          <span className="hidden sm:inline px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {unreviewedCount} items to review
          </span>
        )}
      </div>

      {/* ── Hero Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 md:p-6 bg-warm-black dark:bg-warm-black border border-warm-black/10">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
                Net Cash Flow
              </span>
              <p className={`mt-1 font-display text-2xl md:text-3xl font-bold ${data.summary.netFlow >= 0 ? "text-sage-400" : "text-red-400"}`}>
                {formatCurrency(data.summary.netFlow)}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                {data.summary.netFlow >= 0 ? "You're earning more than you spend" : "Spending exceeds income"}
              </p>
            </div>
            <div className="shrink-0 px-3 py-1.5 rounded-lg bg-white/5 text-center">
              <span className="text-[10px] text-white/30 font-mono uppercase tracking-wider">Health</span>
              <p className={`text-sm font-bold mt-0.5 ${data.summary.netFlow >= 0 ? "text-sage-400" : "text-red-400"}`}>
                {data.summary.netFlow >= 0 ? "Good" : "Watch"}
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sage-600 to-sage-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(5, (data.summary.netFlow / (data.summary.totalCredits || 1)) * 100))}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl p-5 md:p-6 bg-warm-black dark:bg-warm-black border border-warm-black/10">
          <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
            Needs Your Attention
          </span>
          <p className="mt-1 font-display text-2xl md:text-3xl font-bold text-amber-400">
            {isBusiness ? unreviewedCount : personalInsights?.unusualActivity.length ?? 0}
          </p>
          <p className="text-xs text-white/30 mt-0.5">
            {isBusiness
              ? `${formatCurrency(totalAtRisk)} at risk this month`
              : "unusual transactions detected"}
          </p>
          {isBusiness && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {(() => {
                const critical = businessInsights?.insights.filter((i) => i.severity === "Critical").length ?? 0;
                const high = businessInsights?.insights.filter((i) => i.severity === "High").length ?? 0;
                const medium = businessInsights?.insights.filter((i) => i.severity === "Medium").length ?? 0;
                return (
                  <>
                    {critical > 0 && (
                      <span className="px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/15 text-red-400">
                        {critical} critical
                      </span>
                    )}
                    {high > 0 && (
                      <span className="px-2 py-1 rounded-md text-[10px] font-medium bg-orange-500/15 text-orange-400">
                        {high} high
                      </span>
                    )}
                    {medium > 0 && (
                      <span className="px-2 py-1 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-400">
                        {medium} medium
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {(
          [
            { label: isBusiness ? "Revenue" : "Total Income", value: formatCurrency(data.summary.totalCredits), tone: "neutral" },
            { label: isBusiness ? "Total Spend" : "Total Spending", value: formatCurrency(data.summary.totalDebits), tone: "neutral" },
            { label: "Avg. Transaction", value: formatCurrency(data.summary.averageDebit), tone: "neutral" },
            { label: "Transactions", value: String(data.summary.transactionCount), tone: "neutral" },
          ] as { label: string; value: string; tone: "positive" | "negative" | "neutral" }[]
        ).map((c) => (
          <div key={c.label} className="glass rounded-xl md:rounded-2xl p-4 md:p-5">
            <span className="text-[10px] md:text-xs text-warm-black/35 dark:text-warm-white/25 font-mono uppercase tracking-wider">
              {c.label}
            </span>
            <p className={`mt-1 font-mono text-lg md:text-xl font-medium truncate ${
              c.tone === "positive"
                ? "text-sage-600 dark:text-sage-400"
                : c.tone === "negative"
                  ? "text-red-500"
                  : "text-warm-black dark:text-warm-white"
            }`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <div className="glass rounded-2xl p-5 md:p-6">
          <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white mb-4">
            {isBusiness ? "Spend breakdown" : "Spending breakdown"}
          </h2>
          <SpendBreakdownDonut data={pieData} total={totalSpend} />
        </div>

        <div className="glass rounded-2xl p-5 md:p-6">
          <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white mb-4">
            Monthly cash flow
          </h2>
          <ResponsiveContainer width="100%" height={260} className="md:h-[300px]">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4a6741" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#4a6741" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a853" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#d4a853" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.06} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8b8b7e" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8b8b7e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "12px",
                  fontSize: "13px",
                }}
                formatter={(value) => [`£${Number(value).toLocaleString()}`, undefined]}
              />
              <Area type="monotone" dataKey="Income" stroke="#4a6741" strokeWidth={2} fill="url(#incomeGrad)" />
              <Area type="monotone" dataKey="Spending" stroke="#d4a853" strokeWidth={2} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bar Chart: Revenue vs Spend ── */}
      <div className="glass rounded-2xl p-5 md:p-6">
        <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white mb-4">
          {isBusiness ? "Revenue vs Spend" : "Income vs Spending"}
        </h2>
        <ResponsiveContainer width="100%" height={260} className="md:h-[300px]">
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.06} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8b8b7e" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#8b8b7e" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: "12px",
                fontSize: "13px",
              }}
              formatter={(value) => [`£${Number(value).toLocaleString()}`, undefined]}
            />
            <Bar dataKey="Income" fill="#4a6741" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Spending" fill="#d4a853" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Insight Feed ── */}
      {insights && (
        <>
          {isBusiness && businessInsights ? (
            <div className="space-y-6">
              <div className="glass rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white">
                    Business Spend Review
                  </h2>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {unreviewedCount} items to review
                  </span>
                </div>

                <p className="text-sm text-warm-black/60 dark:text-warm-white/50 leading-relaxed mb-5">
                  {businessInsights.executive_summary.plain_english_summary}
                </p>

                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {businessInsights.insights.slice(0, 6).map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>

                {businessInsights.insights.length > 6 && (
                  <Link
                    href="/insights"
                    className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 font-medium transition-colors"
                  >
                    View all {businessInsights.insights.length} findings →
                  </Link>
                )}
              </div>

              {businessInsights.owner_review_pack.length > 0 && (
                <div>
                  <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white mb-4">
                    Owner Review Pack
                  </h2>
                  <OwnerReviewPack
                    items={businessInsights.owner_review_pack.slice(0, 5)}
                    onItemClick={handleReviewItemClick}
                  />
                </div>
              )}
            </div>
          ) : personalInsights ? (
            <div className="glass rounded-2xl p-5 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white">
                  AI insights
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    personalInsights.cashFlowHealth === "excellent"
                      ? "bg-sage-400/20 text-sage-700 dark:text-sage-400"
                      : personalInsights.cashFlowHealth === "good"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                        : personalInsights.cashFlowHealth === "fair"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-red-100 text-red-700"
                  }`}
                >
                  {personalInsights.cashFlowHealth} health
                </span>
              </div>
              <p className="text-sm text-warm-black/60 dark:text-warm-white/50 leading-relaxed mb-6">
                {personalInsights.monthlyForecast.narrative}
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <h3 className="font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider mb-2">
                    Top recommendations
                  </h3>
                  <ul className="space-y-1.5">
                    {personalInsights.topRecommendations.map((r, i) => (
                      <li key={i} className="text-sm text-warm-black/70 dark:text-warm-white/60 flex gap-2">
                        <span className="text-sage-600 dark:text-sage-400 shrink-0">+</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider mb-2">
                    Spending patterns
                  </h3>
                  <ul className="space-y-1.5">
                    {personalInsights.spendingPatterns.map((p, i) => (
                      <li key={i} className="text-sm text-warm-black/70 dark:text-warm-white/60 flex gap-2">
                        <span className="text-amber-500 shrink-0">-</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider mb-2">
                    Unusual activity
                  </h3>
                  {personalInsights.unusualActivity.length > 0 ? (
                    <ul className="space-y-1.5">
                      {personalInsights.unusualActivity.map((u, i) => (
                        <li key={i} className="text-sm text-warm-black/70 dark:text-warm-white/60 flex gap-2">
                          <span className="text-red-400 shrink-0">!</span>
                          {u}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-warm-black/40 dark:text-warm-white/30">Nothing unusual detected.</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* ── Recent Activity ── */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 md:p-6 pb-4">
          <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white">
            Recent activity
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-gray dark:border-warm-white/5">
                {["Date", "Description", "Category", "Amount"].map((h) => (
                  <th
                    key={h}
                    className={`py-3 px-4 font-mono text-[10px] md:text-xs text-warm-black/30 dark:text-warm-white/20 uppercase tracking-wider ${
                      h === "Amount" ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(-10).reverse().map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-warm-gray/30 dark:border-warm-white/[0.02] hover:bg-warm-gray/20 dark:hover:bg-white/[0.01] transition-colors"
                >
                  <td className="py-2.5 px-4 font-mono text-[11px] md:text-xs text-warm-black/40 dark:text-warm-white/30 whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td className="py-2.5 px-4 text-warm-black/75 dark:text-warm-white/60 max-w-[140px] md:max-w-xs truncate text-xs md:text-sm">
                    {tx.description}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-warm-gray dark:bg-white/5 text-warm-black/40 dark:text-warm-white/30 whitespace-nowrap">
                      {tx.category || "Other"}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono text-xs md:text-sm whitespace-nowrap ${
                      tx.type === "credit" ? "text-sage-600 dark:text-sage-400" : "text-red-500"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Document History ── */}
      {docHistory.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base md:text-lg font-semibold text-warm-black dark:text-warm-white">
              Document history
            </h2>
            <Link
              href="/history"
              className="text-sm text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 font-medium transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {docHistory.slice(0, 3).map((entry) => (
              <DocumentHistoryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* ── Insight Drawer ── */}
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

function formatCurrency(amount: number, currency = "£"): string {
  const formatted = Math.abs(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}
