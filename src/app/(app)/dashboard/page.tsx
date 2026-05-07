"use client";

import { useEffect, useState } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import type { StatementData } from "@/types";
import { detectAll } from "@/lib/detection";
import { generateForecast } from "@/lib/forecast";
import type { MonthEndForecast } from "@/lib/forecast";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { CashPositionRow } from "@/components/dashboard/cash-position-row";
import { InsightHeroCard } from "@/components/dashboard/insight-hero-card";
import { DailyForecastChart } from "@/components/charts/daily-forecast-chart";
import { formatCurrency } from "@/lib/utils";

function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="h-3 bg-zinc-100 rounded w-20 mb-2" />
            <div className="h-7 bg-zinc-100 rounded w-24 mb-1" />
            <div className="h-3 bg-zinc-100 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <div className="h-3 bg-zinc-100 rounded w-32 mb-2" />
        <div className="h-4 bg-zinc-100 rounded w-full mb-1" />
        <div className="h-4 bg-zinc-100 rounded w-3/4" />
      </div>
      <div className="bg-zinc-800 rounded-xl p-4 h-48" />
    </div>
  );
}

interface AIInsight {
  headline: string;
  summary: string;
  severity: "info" | "warning" | "critical";
}

export default function DashboardPage() {
  const { companyId } = useActiveCompany();
  const [data, setData] = useState<StatementData | null>(null);
  const [forecast, setForecast] = useState<MonthEndForecast | null>(null);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [docId, setDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    fetch("/api/documents")
      .then((r) => r.json())
      .then((json) => {
        const docs = json.documents ?? [];
        if (docs.length > 0) {
          const id = docs[0].id;
          setDocId(id);
          fetch(`/api/documents/${id}`)
            .then((r) => r.json())
            .then((res) => {
              const stmtData = res.document?.statement_data as StatementData;
              if (stmtData?.transactions) {
                setData(stmtData);
                const patterns = detectAll(stmtData.transactions);
                const fc = generateForecast(patterns, stmtData.summary.netFlow);
                setForecast(fc);
              }
            });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  // Fetch AI insight after forecast is ready
  useEffect(() => {
    if (!docId || !forecast) return;
    fetch(`/api/insights/forecast?docId=${docId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.insight) setAiInsight(json.insight);
      })
      .catch(() => {}); // AI insight is non-critical — silent fallback
  }, [docId, forecast]);

  if (loading) return <DashboardSkeleton />;
  if (!data || !forecast) return <EmptyDashboard />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <CashPositionRow
        currentBalance={forecast.currentBalance}
        predictedMonthEnd={forecast.predictedMonthEnd}
        status={forecast.status}
        confidence={forecast.confidence}
      />

      <InsightHeroCard
        headline={forecast.statusReason}
        summary={buildInsightSummary(forecast)}
        severity={
          forecast.status === "safe"
            ? "info"
            : forecast.status === "watch"
              ? "warning"
              : "critical"
        }
      />

      <DailyForecastChart data={forecast.dailyForecast} />
    </div>
  );
}

function buildInsightSummary(fc: MonthEndForecast): string {
  const parts: string[] = [];
  if (fc.remainingExpenses > 0) {
    parts.push(`${formatCurrency(fc.remainingExpenses)} expected to leave before month-end`);
  }
  if (fc.nextIncomeDate) {
    parts.push(
      `next income expected ${new Date(fc.nextIncomeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    );
  }
  if (fc.dangerWindow) {
    parts.push(`balance may drop to ${formatCurrency(fc.dangerWindow.lowestBalance)}`);
  }
  return parts.join(". ") + ".";
}
