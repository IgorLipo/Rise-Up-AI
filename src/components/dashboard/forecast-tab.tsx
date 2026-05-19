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
  hybridForecast?: {
    recurring: { income: number; expenses: number; net: number };
    oneOffAvg: { income: number; expenses: number; net: number };
    totalProjected: { income: number; expenses: number; net: number };
    actualSoFar: { income: number; expenses: number; net: number };
    predictedMonthEnd: number;
    confidence: number;
    variancePct: number;
    reconciliationWarning: boolean;
    monthsUsed: number;
    daysRemaining: number;
    daysInMonth: number;
    asOfDate: string;
    monthEndDate: string;
  } | null;
  monthlyOneOffExpenseAvg?: number;
  monthlyOneOffIncomeAvg?: number;
  oneOffHistoryMonths?: number;
}

export function ForecastTab(props: ForecastTabProps) {
  const { forecast, statementInfo, historicalForecast, hybridForecast } = props;

  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Headline: trailing 3-month historical average. This is the most
            credible single forecast on the user's data — backtested MAE ~£7k
            vs the recurring-only / hybrid methods which over-predict by £20k+
            because the recurring detector under-counts expenses more than
            income. The hybrid breakdown is kept below for transparency. */}
      {historicalForecast && (
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[10px] text-indigo-600 uppercase tracking-wider font-semibold">
                {monthLabel} — projected month-end
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {historicalForecast.method} of net flow
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Confidence</div>
              <div className="text-sm font-semibold text-indigo-700">
                {Math.round(historicalForecast.confidence * 100)}%
              </div>
            </div>
          </div>

          <div
            className={`text-3xl font-bold tabular-nums mb-1 ${
              historicalForecast.predictedMonthEnd >= 0 ? "text-indigo-700" : "text-red-600"
            }`}
          >
            {formatCurrency(historicalForecast.predictedMonthEnd)}
          </div>
          <div className="text-xs text-zinc-500 mb-3">
            by {historicalForecast.monthEndDate}
          </div>

          <div className="border-t border-indigo-100 pt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Avg monthly income (last {historicalForecast.monthsUsed})</span>
              <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(historicalForecast.avgMonthlyIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Avg monthly expenses (last {historicalForecast.monthsUsed})</span>
              <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(historicalForecast.avgMonthlyExpenses)}</span>
            </div>
            <div className="flex justify-between col-span-2 pt-1 mt-1 border-t border-indigo-100 font-semibold">
              <span className="text-zinc-700">Avg monthly net</span>
              <span
                className={`font-mono tabular-nums ${historicalForecast.avgMonthlyNet >= 0 ? "text-emerald-700" : "text-red-600"}`}
              >
                {historicalForecast.avgMonthlyNet >= 0 ? "+" : ""}{formatCurrency(historicalForecast.avgMonthlyNet)}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-indigo-100 text-[10px] text-zinc-400">
            Starts from latest statement balance, projects forward at the
            trailing-{historicalForecast.monthsUsed}-month avg pace.
          </div>
        </div>
      )}

      {/* Diagnostic detail — recurring-pattern view + one-off avg breakdown.
            Kept for transparency but visually demoted. If the warning fires
            the two methods disagree → the recurring detector is missing
            activity. */}
      {hybridForecast && historicalForecast && (
        <details className="bg-white border border-zinc-200 rounded-xl">
          <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-medium hover:bg-zinc-50">
            Diagnostic detail · recurring + one-off breakdown
            {hybridForecast.reconciliationWarning && (
              <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">
                ⚠️ disagrees with trailing avg
              </span>
            )}
          </summary>
          <div className="px-4 pb-4 space-y-3 text-xs border-t border-zinc-100 pt-3">
            <div>
              <div className="text-zinc-500 mb-1 font-medium">Already this month</div>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Income received</span>
                  <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(hybridForecast.actualSoFar.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Expenses paid</span>
                  <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(hybridForecast.actualSoFar.expenses)}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1 font-medium">Detected recurring patterns</div>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Recurring income</span>
                  <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(hybridForecast.recurring.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Recurring expenses</span>
                  <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(hybridForecast.recurring.expenses)}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1 font-medium">
                Typical non-recurring activity (one-off avg)
              </div>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="flex justify-between">
                  <span className="text-zinc-500">One-off income</span>
                  <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(hybridForecast.oneOffAvg.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">One-off expenses</span>
                  <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(hybridForecast.oneOffAvg.expenses)}</span>
                </div>
              </div>
            </div>
            {hybridForecast.reconciliationWarning && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                ⚠️ Recurring + one-off model net = {formatCurrency(hybridForecast.totalProjected.net)}.
                Trailing avg net = {formatCurrency(historicalForecast.avgMonthlyNet)}.
                Headline uses the trailing avg because it's more accurate.
              </div>
            )}
          </div>
        </details>
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
