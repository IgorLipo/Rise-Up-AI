"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { StatementData, ParseResult, AIInsights, SpendReviewResult, AnalysisMode, Insight } from "@/types";
import { InsightCard } from "@/components/insight-card";
import { InsightDrawer } from "@/components/insight-drawer";
import { OwnerReviewPack } from "@/components/owner-review-pack";
import { addDocumentHistory } from "@/lib/history";

export default function UploadPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>("personal");
  const [result, setResult] = useState<StatementData | null>(null);
  const [insights, setInsights] = useState<AIInsights | SpendReviewResult | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drawer state
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [legitimateIds, setLegitimateIds] = useState<Set<string>>(new Set());
  const [followUpIds, setFollowUpIds] = useState<Set<string>>(new Set());

  const isBusiness = mode === "business";
  const businessInsights = isBusiness ? (insights as SpendReviewResult | null) : null;
  const personalInsights = !isBusiness ? (insights as AIInsights | null) : null;

  const processFile = useCallback(async (file: File) => {
    const isPDF = file.name.endsWith(".pdf") || file.type === "application/pdf";
    const isCSV = file.name.endsWith(".csv") || file.type.includes("csv");

    if (!isPDF && !isCSV) {
      toast.error("Please upload a PDF or CSV bank statement");
      return;
    }

    setParsing(true);
    setResult(null);
    setInsights(null);
    setSelectedInsight(null);

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = isPDF ? "/api/parse-pdf" : "/api/parse-csv";

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const json: ParseResult = await res.json();

      if (!json.success || !json.data) {
        toast.error(json.error || "Failed to parse statement");
        return;
      }

      setResult(json.data);
      toast.success(`Parsed ${json.data.transactions.length} transactions from ${file.name}`);

      setGeneratingInsights(true);
      try {
        const insightRes = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: json.data, mode }),
        });
        const insightJson = await insightRes.json();
        if (insightJson.success) {
          setInsights(insightJson.insights);
          sessionStorage.setItem("statementInsights", JSON.stringify(insightJson.insights));
          sessionStorage.setItem("analysisMode", mode);

          const bizInsights = mode === "business" ? insightJson.insights as SpendReviewResult : null;
          const personal = mode === "personal" ? insightJson.insights as AIInsights : null;
          addDocumentHistory({
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            filename: file.name,
            uploadedAt: new Date().toISOString(),
            mode,
            insightCount: bizInsights ? bizInsights.insights.length : personal ? personal.topRecommendations.length : 0,
            topFinding: bizInsights
              ? bizInsights.insights[0]?.short_title ?? ""
              : personal?.topRecommendations[0] ?? "",
            cashFlowHealth: bizInsights
              ? (bizInsights.executive_summary.estimated_monthly_savings.amount > 0 ? "good" : "fair")
              : personal?.cashFlowHealth ?? "fair",
            netFlow: json.data.summary.netFlow,
          });
        }
      } catch {
        // Insights fail silently — not critical
      } finally {
        setGeneratingInsights(false);
      }

      sessionStorage.setItem("statementData", JSON.stringify(json.data));
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setParsing(false);
    }
  }, [mode]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-warm-black dark:text-warm-white">
            Upload a bank statement
          </h1>
          <p className="mt-2 text-warm-black/50 dark:text-warm-white/40">
            PDF or CSV. All major UK banks supported. Your data never leaves this session.
          </p>
        </div>

        {!result && (
          <div className="flex rounded-full bg-warm-gray/50 dark:bg-white/5 p-0.5">
            {(["personal", "business"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-white dark:bg-white/15 text-warm-black dark:text-warm-white shadow-sm"
                    : "text-warm-black/40 dark:text-warm-white/30 hover:text-warm-black/60 dark:hover:text-warm-white/50"
                }`}
              >
                {m === "personal" ? "Personal" : "Business"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Drop zone */}
      {!result && (
        <label
          className={`mt-10 border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer block ${
            dragOver
              ? "border-amber-500 bg-amber-50/50 dark:bg-amber-900/10"
              : "border-warm-gray dark:border-warm-white/10 hover:border-amber-400 dark:hover:border-amber-600"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="font-mono text-sm text-amber-600 dark:text-amber-500">Parsing your statement...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <span className="font-medium text-warm-black dark:text-warm-white">
                Drop your {isBusiness ? "business " : ""}bank statement here
              </span>
              <span className="text-sm text-warm-black/35 dark:text-warm-white/25">
                or click to browse — PDF, CSV
              </span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv"
            className="sr-only"
            onChange={handleChange}
          />
        </label>
      )}

      {/* Results */}
      {result && (
        <div className="mt-10 space-y-10">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Net Flow", value: formatCurrency(result.summary.netFlow), tone: result.summary.netFlow >= 0 ? "positive" : "negative" },
              { label: isBusiness ? "Revenue" : "Total In", value: formatCurrency(result.summary.totalCredits), tone: "neutral" },
              { label: isBusiness ? "Spend" : "Total Out", value: formatCurrency(result.summary.totalDebits), tone: "neutral" },
              { label: "Transactions", value: String(result.summary.transactionCount), tone: "neutral" },
            ].map((card) => (
              <div key={card.label} className="glass rounded-xl p-4">
                <span className="text-xs text-warm-black/40 dark:text-warm-white/30 font-mono uppercase tracking-wider">
                  {card.label}
                </span>
                <p
                  className={`mt-1 font-mono text-xl font-medium ${
                    card.tone === "positive"
                      ? "text-sage-600 dark:text-sage-400"
                      : card.tone === "negative"
                        ? "text-red-500"
                        : "text-warm-black dark:text-warm-white"
                  }`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div>
            <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
              Spending by category
            </h2>
            <div className="space-y-2">
              {result.categoryBreakdown.slice(0, 8).map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-warm-black/60 dark:text-warm-white/40 truncate">
                    {cat.category}
                  </span>
                  <div className="flex-1 h-2 bg-warm-gray dark:bg-warm-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-700"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-warm-black/50 dark:text-warm-white/30 w-16 text-right">
                    {formatCurrency(cat.total)}
                  </span>
                  <span className="font-mono text-xs text-warm-black/30 dark:text-warm-white/20 w-10 text-right">
                    {cat.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          {(insights || generatingInsights) && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white">
                  {isBusiness ? "Business Spend Review" : "AI Insights"}
                </h2>
                {!generatingInsights && insights && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    {isBusiness ? "DeepSeek Analysis" : "AI-Powered"}
                  </span>
                )}
              </div>

              {generatingInsights ? (
                <div className="glass rounded-xl p-8 text-center">
                  <span className="font-mono text-sm text-amber-600 dark:text-amber-500">
                    {isBusiness ? "Analysing business spend patterns..." : "Analysing your spending patterns..."}
                  </span>
                </div>
              ) : isBusiness && businessInsights ? (
                <BusinessSpendReviewView
                  insights={businessInsights}
                  onCardClick={handleCardClick}
                  reviewedIds={reviewedIds}
                />
              ) : personalInsights ? (
                <PersonalInsightsView insights={personalInsights} />
              ) : null}
            </div>
          )}

          {/* Owner Review Pack */}
          {isBusiness && businessInsights && businessInsights.owner_review_pack.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
                Owner Review Pack
              </h2>
              <OwnerReviewPack
                items={businessInsights.owner_review_pack}
                onItemClick={handleReviewItemClick}
              />
            </div>
          )}

          {/* Missing data */}
          {isBusiness && businessInsights && businessInsights.missing_data.length > 0 && (
            <div className="glass rounded-xl p-6 border border-dashed border-warm-gray dark:border-warm-white/10">
              <h3 className="font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider mb-3">
                To Improve This Analysis
              </h3>
              <ul className="space-y-1.5">
                {businessInsights.missing_data.map((d, i) => (
                  <li key={i} className="text-xs text-warm-black/45 dark:text-warm-white/35 flex gap-2">
                    <span className="text-warm-black/20 dark:text-warm-white/15 shrink-0">-</span>
                    <span className="font-medium">{d.field}:</span> {d.why_it_would_help}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent transactions */}
          <div>
            <h2 className="font-display text-xl font-semibold text-warm-black dark:text-warm-white mb-4">
              Recent transactions
            </h2>
            <div className="glass rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-warm-gray dark:border-warm-white/5">
                      <th className="text-left py-3 px-4 font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider">Description</th>
                      <th className="text-left py-3 px-4 font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider">Category</th>
                      <th className="text-right py-3 px-4 font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactions.slice(-30).reverse().map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-warm-gray/50 dark:border-warm-white/[0.03] hover:bg-warm-gray/30 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono text-xs text-warm-black/45 dark:text-warm-white/35">{tx.date}</td>
                        <td className="py-2.5 px-4 text-warm-black/80 dark:text-warm-white/70 max-w-xs truncate">{tx.description}</td>
                        <td className="py-2.5 px-4">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-warm-gray dark:bg-white/5 text-warm-black/45 dark:text-warm-white/35">
                            {tx.category || "Other"}
                          </span>
                        </td>
                        <td className={`py-2.5 px-4 text-right font-mono text-sm ${tx.type === "credit" ? "text-sage-600 dark:text-sage-400" : "text-red-500"}`}>
                          {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setResult(null);
                setInsights(null);
                setSelectedInsight(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="px-6 py-2.5 rounded-full border border-warm-gray dark:border-warm-white/10 text-sm font-medium text-warm-black/60 dark:text-warm-white/40 hover:bg-warm-gray/50 dark:hover:bg-white/5 transition-colors"
            >
              Upload another statement
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-2.5 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              View dashboard
            </button>
          </div>
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

// ── Personal Insights Sub-Component ──

function PersonalInsightsView({ insights }: { insights: AIInsights }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="glass rounded-xl p-6 sm:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-warm-black/40 dark:text-warm-white/30 font-mono uppercase tracking-wider">
            Cash Flow Health
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              insights.cashFlowHealth === "excellent"
                ? "bg-sage-400/20 text-sage-700 dark:text-sage-400"
                : insights.cashFlowHealth === "good"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                  : insights.cashFlowHealth === "fair"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-red-100 text-red-700"
            }`}
          >
            {insights.cashFlowHealth}
          </span>
        </div>
        <p className="mt-3 text-sm text-warm-black/60 dark:text-warm-white/50 leading-relaxed">
          {insights.monthlyForecast.narrative}
        </p>
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="font-mono text-xs text-warm-black/40 dark:text-warm-white/30 uppercase tracking-wider mb-3">
          Spending Patterns
        </h3>
        <ul className="space-y-2">
          {insights.spendingPatterns.map((p, i) => (
            <li key={i} className="text-sm text-warm-black/70 dark:text-warm-white/60 flex gap-2">
              <span className="text-amber-500 mt-0.5 shrink-0">-</span>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass rounded-xl p-6">
        <h3 className="font-mono text-xs text-warm-black/40 dark:text-warm-white/30 uppercase tracking-wider mb-3">
          Savings Opportunities
        </h3>
        <ul className="space-y-2">
          {insights.savingsOpportunities.map((s, i) => (
            <li key={i} className="text-sm text-warm-black/70 dark:text-warm-white/60 flex gap-2">
              <span className="text-sage-600 dark:text-sage-400 mt-0.5 shrink-0">+</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Business Spend Review Sub-Component ──

function BusinessSpendReviewView({
  insights,
  onCardClick,
  reviewedIds,
}: {
  insights: SpendReviewResult;
  onCardClick: (insight: Insight) => void;
  reviewedIds: Set<string>;
}) {
  const { executive_summary, insights: items } = insights;

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="glass rounded-xl p-6 border-l-4 border-amber-500">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-xs text-amber-600 dark:text-amber-500 uppercase tracking-wider">
            Executive Summary
          </span>
        </div>
        <p className="text-sm text-warm-black/70 dark:text-warm-white/60 leading-relaxed mb-4">
          {executive_summary.plain_english_summary}
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-lg p-3 text-center">
            <p className="text-xs text-warm-black/35 dark:text-warm-white/25 font-mono uppercase tracking-wider">Items to Review</p>
            <p className="text-xl font-display font-bold text-warm-black dark:text-warm-white mt-1">{executive_summary.items_to_review}</p>
          </div>
          <div className="bg-warm-gray/30 dark:bg-white/[0.02] rounded-lg p-3 text-center">
            <p className="text-xs text-warm-black/35 dark:text-warm-white/25 font-mono uppercase tracking-wider">Insights Found</p>
            <p className="text-xl font-display font-bold text-warm-black dark:text-warm-white mt-1">{items.length}</p>
          </div>
          <div className="bg-sage-100/50 dark:bg-sage-900/10 rounded-lg p-3 text-center">
            <p className="text-xs text-warm-black/35 dark:text-warm-white/25 font-mono uppercase tracking-wider">Est. Monthly Savings</p>
            <p className="text-xl font-display font-bold text-sage-700 dark:text-sage-400 mt-1">{formatCurrency(executive_summary.estimated_monthly_savings.amount)}</p>
          </div>
        </div>
        {executive_summary.top_3_findings.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs text-warm-black/35 dark:text-warm-white/25 font-mono uppercase tracking-wider">Top Findings</p>
            <ol className="list-decimal list-inside text-sm text-warm-black/60 dark:text-warm-white/50 space-y-0.5">
              {executive_summary.top_3_findings.map((f, i) => (
                <li key={i}>{f.title}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {insights.quick_actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insights.quick_actions.map((action, i) => (
            <span
              key={i}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-warm-gray/50 dark:bg-white/5 text-warm-black/50 dark:text-warm-white/40"
            >
              {action.label}
            </span>
          ))}
        </div>
      )}

      {/* Insight cards */}
      {items.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-sm text-warm-black/40 dark:text-warm-white/30">
            No significant spending patterns detected. Your business finances appear well-controlled.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="font-mono text-xs text-warm-black/35 dark:text-warm-white/25 uppercase tracking-wider mb-3">
            Detailed Findings ({items.length})
          </h3>
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
                  onClick={onCardClick}
                />
              </div>
            ))}
          </div>
        </div>
      )}
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
