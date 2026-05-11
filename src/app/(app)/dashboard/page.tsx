"use client";

import { useEffect, useState } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import type { MonthEndForecast } from "@/lib/forecast";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { AccumulatedStats } from "@/components/dashboard/accumulated-stats";
import { MonthlySummaries } from "@/components/dashboard/monthly-summaries";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { VendorLearning } from "@/components/dashboard/vendor-learning";
import { SuspiciousFlagged } from "@/components/dashboard/suspicious-flagged";
import { DailyForecastChart } from "@/components/charts/daily-forecast-chart";
import { InsightHeroCard } from "@/components/dashboard/insight-hero-card";
import { DateRangeSelector, type DateRangePreset } from "@/components/dashboard/date-range-selector";

interface AggregateResponse {
  hasData: boolean;
  totalDocuments: number;
  totalTransactions: number;
  currentPosition: {
    balance: number | null;
    date: string | null;
    source: "statement" | "catchUp" | "unavailable";
    isEstimated: boolean;
    isStale: boolean;
    statementPeriodEnd: string | null;
  };
  balanceValidation: {
    valid: boolean;
    message: string;
  } | null;
  accumulated: {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    statementCount: number;
    totalTransactions: number;
    dateRange: { from: string; to: string } | null;
  };
  forecast: MonthEndForecast | null;
  monthly: Array<{
    month: string;
    label: string;
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    status: "safe" | "watch" | "risk" | "critical";
  }>;
  categories: Array<{
    category: string;
    total: number;
    count: number;
    percentage: number;
    transactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      type: string;
    }>;
  }>;
  patterns: {
    recurringExpenses: Array<{
      merchant: string;
      subcategory: string;
      typicalAmount: number;
      interval: string | null;
      confidence: number;
      nextExpected: string;
      occurrences: number;
      aiReasoning: string;
    }>;
    recurringIncome: Array<{
      merchant: string;
      subcategory: string;
      typicalAmount: number;
      interval: string | null;
      confidence: number;
      nextExpected: string;
      occurrences: number;
      aiReasoning: string;
    }>;
    oneOffExpenses: number;
    oneOffIncome: number;
  };
  newVendors: Array<{
    merchantRaw: string;
    merchantNormalized: string;
    subcategory: string;
    confidence: number;
    reasoning: string;
  }>;
  entities: {
    properties: Array<{
      key: string;
      displayName: string;
      confidence: number;
      matchType: string;
      transactionCount: number;
    }>;
    people: Array<{
      key: string;
      personName: string;
      role: string;
      confidence: number;
      indicators: string[];
      transactionCount: number;
    }>;
  };
  vendors: {
    total: number;
    recurring: Array<{
      canonicalName: string;
      subcategory: string;
      category: string;
      typicalAmount: number;
      recurrencePattern: string | null;
      appearanceCount: number;
      monthsSeen: number;
      firstSeen: string;
      lastSeen: string;
      amountRange: { min: number; max: number };
    }>;
    suspicious: Array<{
      canonicalName: string;
      subcategory: string;
      typicalAmount: number;
      appearanceCount: number;
      reason: string;
    }>;
    oneOff: string[];
  };
  crossMonthInsights: Array<{
    vendor: string;
    type: "new_vendor" | "disappeared_vendor" | "amount_change" | "frequency_change" | "became_recurring";
    detail: string;
    previousAmount?: number;
    currentAmount?: number;
  }>;
  suspicious: Array<{
    merchant: string;
    reason: string;
    riskLevel: "low" | "medium" | "high";
    suggestedCategory: string;
    shouldExcludeFromBusiness: boolean;
    date: string;
    amount: number;
    description: string;
  }>;
}

function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="h-3 bg-zinc-100 rounded w-20 mb-2" />
            <div className="h-7 bg-zinc-100 rounded w-24 mb-1" />
            <div className="h-3 bg-zinc-100 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 h-48" />
        <div className="bg-white border border-zinc-200 rounded-xl p-4 h-48" />
      </div>
      <div className="bg-zinc-100 rounded-xl h-48" />
    </div>
  );
}

export default function DashboardPage() {
  const { companyId } = useActiveCompany();
  const router = useRouter();
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ preset: DateRangePreset; from?: string; to?: string }>({
    preset: "all",
  });

  useEffect(() => {
    if (!companyId) return;

    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    const qs = params.toString();
    const url = `/api/documents/aggregate${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((json) => {
        if (json.hasData) {
          setData(json);
        } else if (dateRange.preset !== "all") {
          // If filtering returned no data, keep previous data but show a note
          setData(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [companyId, dateRange]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <EmptyDashboard />;
  if (!data || !data.hasData) return <EmptyDashboard />;

  const { currentPosition, forecast, accumulated, monthly, categories, vendors, crossMonthInsights, suspicious } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Cashflow</h1>
          {accumulated.dateRange && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {accumulated.dateRange.from?.slice(0, 10)} — {accumulated.dateRange.to?.slice(0, 10)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          <button
            onClick={() => router.push("/upload")}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Upload statement
          </button>
        </div>
      </div>

      {/* Cash position + status */}
      <AccumulatedStats
        currentBalance={currentPosition.balance ?? 0}
        predictedMonthEnd={forecast?.predictedMonthEnd ?? 0}
        remainingIncome={forecast?.remainingIncome ?? 0}
        remainingExpenses={forecast?.remainingExpenses ?? 0}
        status={forecast?.status ?? "safe"}
        confidence={forecast?.confidence ?? 0}
        netFlow={accumulated.netFlow}
        totalDocuments={data.totalDocuments}
        totalTransactions={data.totalTransactions}
        balanceIsEstimated={currentPosition.isEstimated}
        balanceCatchUpDays={0}
        statementClosingBalance={currentPosition.balance ?? undefined}
        dateFilterActive={false}
        balanceSource={currentPosition.source}
        isStale={currentPosition.isStale}
        statementPeriodEnd={currentPosition.statementPeriodEnd ?? undefined}
      />

      {/* Insight hero */}
      {forecast && (
        <InsightHeroCard
          headline={forecast.statusReason}
          summary={buildInsightSummary(forecast, categories)}
          severity={
            forecast.status === "safe" ? "info"
              : forecast.status === "watch" ? "warning"
              : "critical"
          }
        />
      )}

      {/* Daily forecast chart */}
      {forecast && forecast.dailyForecast.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">
            Daily forecast
          </h2>
          <DailyForecastChart data={forecast.dailyForecast} />
        </div>
      )}

      {/* Two-column layout for breakdowns */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Category breakdown */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <CategoryBreakdown categories={categories} />
        </div>

        {/* Monthly summaries */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <MonthlySummaries
            monthly={monthly}
            onSelectMonth={(month) => router.push(`/transactions?month=${month}`)}
          />
        </div>
      </div>

      {/* Vendor learning */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <VendorLearning
          totalVendors={vendors.total}
          recurring={vendors.recurring}
          suspicious={vendors.suspicious}
          oneOff={vendors.oneOff}
          crossMonthInsights={crossMonthInsights}
        />
      </div>

      {/* Suspicious / flagged transactions */}
      <SuspiciousFlagged flagged={suspicious} />

      {/* Quick links */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/forecast")}
          className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          View full forecast →
        </button>
        <button
          onClick={() => router.push("/transactions")}
          className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Browse all transactions →
        </button>
      </div>
    </div>
  );
}

function buildInsightSummary(
  fc: MonthEndForecast,
  categories: AggregateResponse["categories"]
): string {
  const parts: string[] = [];

  if (fc.remainingExpenses > 0) {
    // Find top 3 expense categories
    const topCats = categories.slice(0, 3).map((c) => c.category.replace(/-/g, " "));
    parts.push(
      `Around ${formatCurrencyStatic(fc.remainingExpenses)} expected to leave before month-end` +
      (topCats.length > 0 ? `, mainly ${topCats.join(", ")}` : "")
    );
  }

  if (fc.nextIncomeDate) {
    parts.push(
      `next income expected ${new Date(fc.nextIncomeDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })}`
    );
  }

  if (fc.dangerWindow) {
    parts.push(
      `balance may drop to ${formatCurrencyStatic(fc.dangerWindow.lowestBalance)} between ${fc.dangerWindow.from.slice(5)} and ${fc.dangerWindow.to.slice(5)}`
    );
  }

  if (fc.biggestRisks.length > 0) {
    parts.push(`${fc.biggestRisks[0].description}`);
  }

  return parts.join(". ") + ".";
}

function formatCurrencyStatic(amount: number): string {
  return `£${Math.abs(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
