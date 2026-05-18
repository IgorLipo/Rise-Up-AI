"use client";

import type { MonthEndForecast } from "@/lib/forecast";
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
  statementInfo: {
    openingBalance: number | null;
    totalIncome: number | null;
    totalExpenses: number | null;
    closingBalance: number | null;
    periodFrom: string | null;
    periodTo: string | null;
    bankName: string | null;
  } | null;
  balanceValidation: {
    valid: boolean;
    differencePence: number;
    message: string;
  } | null;
  historicalForecast?: {
    predictedMonthEnd: number;
    expectedIncome: number;
    expectedExpenses: number;
    expectedNetFlow: number;
    daysRemaining: number;
    daysInMonth: number;
    monthsUsed: number;
    avgMonthlyIncome: number;
    avgMonthlyExpenses: number;
    avgMonthlyNet: number;
    confidence: number;
    method: string;
    asOfDate: string;
    monthEndDate: string;
  } | null;
  monthlyOneOffExpenseAvg?: number;
  monthlyOneOffIncomeAvg?: number;
  oneOffHistoryMonths?: number;
}

export function ForecastTab(props: ForecastTabProps) {
  const { forecast, statementInfo, historicalForecast } = props;

  // Derive whole-month actuals + projection from the daily forecast (which
  // now spans 1st → last of the current calendar month, with actuals for
  // past days and recurring projections for future days).
  const today = new Date().toISOString().split("T")[0];
  const daily = forecast?.dailyForecast ?? [];
  const pastDays = daily.filter((d) => d.date < today);
  const futureDays = daily.filter((d) => d.date >= today);
  const incomeSoFar = pastDays.reduce((s, d) => s + d.expectedIncome, 0);
  const expensesSoFar = pastDays.reduce((s, d) => s + d.expectedExpenses, 0);
  const incomeProjected = futureDays.reduce((s, d) => s + d.expectedIncome, 0);
  const expensesProjected = futureDays.reduce((s, d) => s + d.expectedExpenses, 0);
  const totalMonthIncome = incomeSoFar + incomeProjected;
  const totalMonthExpenses = expensesSoFar + expensesProjected;
  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Whole-month forecast headline — actuals so far + projected to end. */}
      {historicalForecast && (
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[10px] text-indigo-600 uppercase tracking-wider font-semibold">
                {monthLabel} — projected month-end
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {historicalForecast.method} · projecting through {historicalForecast.monthEndDate}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Confidence</div>
              <div className="text-sm font-semibold text-indigo-700">
                {Math.round(historicalForecast.confidence * 100)}%
              </div>
            </div>
          </div>

          <div className="text-3xl font-bold tabular-nums text-indigo-700 mb-3">
            {formatCurrency(historicalForecast.predictedMonthEnd)}
          </div>

          <div className="border-t border-indigo-100 pt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Income so far</span>
              <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(incomeSoFar)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Expenses so far</span>
              <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(expensesSoFar)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Income expected</span>
              <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(incomeProjected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Expenses expected</span>
              <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(expensesProjected)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-indigo-100 col-span-2 mt-1">
              <span className="text-zinc-700">Month total</span>
              <span className="font-mono tabular-nums">
                <span className="text-emerald-700">+{formatCurrency(totalMonthIncome)}</span>
                {" "}
                <span className="text-red-600">-{formatCurrency(totalMonthExpenses)}</span>
                {" = "}
                <span className={totalMonthIncome - totalMonthExpenses >= 0 ? "text-emerald-700" : "text-red-600"}>
                  {totalMonthIncome - totalMonthExpenses >= 0 ? "+" : ""}
                  {formatCurrency(totalMonthIncome - totalMonthExpenses)}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-indigo-100 text-xs text-zinc-500">
            Based on {historicalForecast.monthsUsed} complete months of history:
            avg income +{formatCurrency(historicalForecast.avgMonthlyIncome)}/mo,
            expenses -{formatCurrency(historicalForecast.avgMonthlyExpenses)}/mo,
            net{" "}
            <span className={historicalForecast.avgMonthlyNet >= 0 ? "text-emerald-700" : "text-red-600"}>
              {historicalForecast.avgMonthlyNet >= 0 ? "+" : ""}{formatCurrency(historicalForecast.avgMonthlyNet)}/mo
            </span>.
          </div>
        </div>
      )}

      {/* Statement Source-of-Truth Block — anchored facts, kept */}
      {statementInfo && statementInfo.closingBalance != null && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
              Statement balance
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600">
              {statementInfo.bankName ?? "Statement"}
            </span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            {formatCurrency(statementInfo.closingBalance)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            as of{" "}
            {statementInfo.periodFrom && statementInfo.periodTo
              ? `${statementInfo.periodFrom} to ${statementInfo.periodTo}`
              : statementInfo.periodTo ?? ""}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
            <span>Opening: {formatCurrency(statementInfo.openingBalance ?? 0)}</span>
            <span>In: {formatCurrency(statementInfo.totalIncome ?? 0)}</span>
            <span>Out: {formatCurrency(statementInfo.totalExpenses ?? 0)}</span>
            <span>Closing: {formatCurrency(statementInfo.closingBalance)}</span>
          </div>
        </div>
      )}


      {/* Low-Confidence Forecast Notice (criterion 1.7) */}
      {forecast?.forecastMode?.isLowConfidence === true && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <div className="font-semibold mb-1">Low-confidence forecast</div>
          <div>{forecast?.forecastMode?.reason}</div>
        </div>
      )}

      {/* Daily forecast section (criterion 1.5 — opening+closing per row) */}
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
