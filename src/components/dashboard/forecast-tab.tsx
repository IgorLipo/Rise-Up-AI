"use client";

import type { MonthEndForecast } from "@/lib/forecast";
import { AccumulatedStats } from "@/components/dashboard/accumulated-stats";
import { InsightHeroCard } from "@/components/dashboard/insight-hero-card";
import { DailyForecastChart } from "@/components/charts/daily-forecast-chart";
import { formatCurrency } from "@/lib/utils";

interface ForecastTabProps {
  currentPosition: {
    balance: number | null;
    date: string | null;
    source: "statement" | "catchUp" | "unavailable";
    isEstimated: boolean;
    isStale: boolean;
    statementPeriodEnd: string | null;
  };
  forecast: MonthEndForecast | null;
  accumulated: {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    statementCount: number;
    totalTransactions: number;
    dateRange: { from: string; to: string } | null;
  };
  categories: Array<{
    category: string;
    total: number;
    count: number;
    percentage: number;
    transactions: Array<{ id: string; date: string; description: string; amount: number; type: string }>;
  }>;
  patterns: {
    recurringIncome: Array<{ merchant: string; typicalAmount: number; nextExpected: string }>;
    recurringExpenses: Array<{ merchant: string; typicalAmount: number; nextExpected: string }>;
  } | null;
  totalDocuments: number;
  totalTransactions: number;
}

export function ForecastTab(props: ForecastTabProps) {
  const { currentPosition, forecast, accumulated, categories, patterns, totalDocuments, totalTransactions } = props;

  return (
    <div className="space-y-5">
      <AccumulatedStats
        currentBalance={currentPosition.balance ?? 0}
        predictedMonthEnd={forecast?.predictedMonthEnd ?? 0}
        remainingIncome={forecast?.remainingIncome ?? 0}
        remainingExpenses={forecast?.remainingExpenses ?? 0}
        status={forecast?.status ?? "safe"}
        confidence={forecast?.confidence ?? 0}
        netFlow={accumulated.netFlow}
        totalDocuments={totalDocuments}
        totalTransactions={totalTransactions}
        balanceIsEstimated={currentPosition.isEstimated}
        balanceCatchUpDays={0}
        statementClosingBalance={currentPosition.balance ?? undefined}
        dateFilterActive={false}
        balanceSource={currentPosition.source}
        isStale={currentPosition.isStale}
        statementPeriodEnd={currentPosition.statementPeriodEnd ?? undefined}
      />

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

      {forecast && forecast.dailyForecast.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">
            Daily forecast
          </h2>
          <DailyForecastChart data={forecast.dailyForecast} />
        </div>
      )}
    </div>
  );
}

function buildInsightSummary(
  fc: MonthEndForecast,
  categories: ForecastTabProps["categories"]
): string {
  const parts: string[] = [];
  if (fc.remainingExpenses > 0) {
    const topCats = categories.slice(0, 3).map((c) => c.category.replace(/-/g, " "));
    parts.push(
      `Around ${formatCurrency(fc.remainingExpenses)} expected to leave before month-end` +
      (topCats.length > 0 ? `, mainly ${topCats.join(", ")}` : "")
    );
  }
  if (fc.nextIncomeDate) {
    parts.push(
      `next income expected ${new Date(fc.nextIncomeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    );
  }
  if (fc.dangerWindow) {
    parts.push(
      `balance may drop to ${formatCurrency(fc.dangerWindow.lowestBalance)} between ${fc.dangerWindow.from.slice(5)} and ${fc.dangerWindow.to.slice(5)}`
    );
  }
  if (fc.biggestRisks.length > 0) {
    parts.push(`${fc.biggestRisks[0].description}`);
  }
  return parts.join(". ") + ".";
}
