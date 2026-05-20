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
    examples?: {
      actualSoFarIncome: Array<{ description: string; amount: number; date?: string; subcategory?: string }>;
      actualSoFarExpenses: Array<{ description: string; amount: number; date?: string; subcategory?: string }>;
      recurringIncome: Array<{ description: string; amount: number; date?: string; subcategory?: string }>;
      recurringExpenses: Array<{ description: string; amount: number; date?: string; subcategory?: string }>;
      oneOffIncome: Array<{ description: string; amount: number; date?: string; subcategory?: string }>;
      oneOffExpenses: Array<{ description: string; amount: number; date?: string; subcategory?: string }>;
    };
  } | null;
  propertyAwareForecast?: {
    property: { income: number; expenses: number; net: number };
    nonProperty: { income: number; expenses: number; net: number };
    actualSoFar: { income: number; expenses: number; net: number };
    totalProjectedNet: number;
    predictedMonthEnd: number;
    monthBreakdown: Array<{
      month: string;
      propertyIncome: number;
      propertyExpense: number;
      nonPropertyIncome: number;
      nonPropertyExpense: number;
    }>;
    monthsUsed: number;
    daysRemaining: number;
    daysInMonth: number;
    asOfDate: string;
    monthEndDate: string;
    confidence: number;
  } | null;
  monthlyOneOffExpenseAvg?: number;
  monthlyOneOffIncomeAvg?: number;
  oneOffHistoryMonths?: number;
}

function ExampleList({
  title,
  items,
  color,
}: {
  title: string;
  items: Array<{ description: string; amount: number; date?: string; subcategory?: string }>;
  color: "emerald" | "red";
}) {
  if (!items || items.length === 0) return null;
  const amountClass = color === "emerald" ? "text-emerald-700" : "text-red-600";
  const sign = color === "emerald" ? "+" : "-";
  return (
    <details className="mb-2 rounded border border-zinc-100 bg-zinc-50/50">
      <summary className="cursor-pointer px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100">
        ▸ {title} ({items.length})
      </summary>
      <div className="px-2 py-1 space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between items-baseline gap-2 text-[11px]">
            <div className="min-w-0 flex-1">
              <div className="text-zinc-700 truncate" title={it.description}>
                {it.description}
              </div>
              {it.date && (
                <div className="text-zinc-400 text-[10px]">
                  {it.date}
                  {it.subcategory && it.subcategory !== "uncategorized" && (
                    <> · {it.subcategory.replace(/-/g, " ")}</>
                  )}
                </div>
              )}
            </div>
            <span className={`font-mono tabular-nums whitespace-nowrap ${amountClass}`}>
              {sign}{formatCurrency(it.amount)}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

export function ForecastTab(props: ForecastTabProps) {
  const { forecast, statementInfo, historicalForecast, hybridForecast, propertyAwareForecast } = props;

  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Headline: Property-aware forecast.
            Splits cashflow into property (recurring, CV 9-17% — predict by
            per-vendor avg) and non-property (CV 9-97% — predict by simple
            3-mo avg of totals). Validated on Jan-Apr 2026: property = 89% of
            income & 68% of expenses. Each component forecast with the method
            that fits its volatility. */}
      {propertyAwareForecast && (
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[10px] text-indigo-600 uppercase tracking-wider font-semibold">
                {monthLabel} — projected month-end
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Property recurring + non-property {propertyAwareForecast.monthsUsed}-mo avg
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Confidence</div>
              <div className="text-sm font-semibold text-indigo-700">
                {Math.round(propertyAwareForecast.confidence * 100)}%
              </div>
            </div>
          </div>

          <div
            className={`text-3xl font-bold tabular-nums mb-1 ${
              propertyAwareForecast.predictedMonthEnd >= 0 ? "text-indigo-700" : "text-red-600"
            }`}
          >
            {formatCurrency(propertyAwareForecast.predictedMonthEnd)}
          </div>
          <div className="text-xs text-zinc-500 mb-3">
            by {propertyAwareForecast.monthEndDate}
          </div>

          <div className="border-t border-indigo-100 pt-3 space-y-3 text-xs">
            {/* Property — high confidence */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-700 font-medium">
                  Property cashflow
                  <span className="ml-1.5 text-[10px] text-emerald-600 font-medium">
                    high confidence
                  </span>
                </span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    propertyAwareForecast.property.net >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {propertyAwareForecast.property.net >= 0 ? "+" : ""}
                  {formatCurrency(propertyAwareForecast.property.net)}/mo
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 text-zinc-500">
                <div className="flex justify-between">
                  <span>Income</span>
                  <span className="font-mono text-emerald-700">+{formatCurrency(propertyAwareForecast.property.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses</span>
                  <span className="font-mono text-red-600">-{formatCurrency(propertyAwareForecast.property.expenses)}</span>
                </div>
              </div>
            </div>

            {/* Non-property — variable */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-700 font-medium">
                  Non-property cashflow
                  <span className="ml-1.5 text-[10px] text-amber-600 font-medium">
                    variable
                  </span>
                </span>
                <span
                  className={`font-mono font-semibold tabular-nums ${
                    propertyAwareForecast.nonProperty.net >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {propertyAwareForecast.nonProperty.net >= 0 ? "+" : ""}
                  {formatCurrency(propertyAwareForecast.nonProperty.net)}/mo
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 text-zinc-500">
                <div className="flex justify-between">
                  <span>Income</span>
                  <span className="font-mono text-emerald-700">+{formatCurrency(propertyAwareForecast.nonProperty.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Expenses</span>
                  <span className="font-mono text-red-600">-{formatCurrency(propertyAwareForecast.nonProperty.expenses)}</span>
                </div>
              </div>
            </div>

            {/* Already this month */}
            {(propertyAwareForecast.actualSoFar.income > 0 || propertyAwareForecast.actualSoFar.expenses > 0) && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-700 font-medium">Already this month</span>
                  <span
                    className={`font-mono tabular-nums ${
                      propertyAwareForecast.actualSoFar.net >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {propertyAwareForecast.actualSoFar.net >= 0 ? "+" : ""}
                    {formatCurrency(propertyAwareForecast.actualSoFar.net)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 text-zinc-500">
                  <div className="flex justify-between">
                    <span>Income received</span>
                    <span className="font-mono text-emerald-700">+{formatCurrency(propertyAwareForecast.actualSoFar.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expenses paid</span>
                    <span className="font-mono text-red-600">-{formatCurrency(propertyAwareForecast.actualSoFar.expenses)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Net for month */}
            <div className="pt-2 border-t border-indigo-100 flex justify-between font-semibold">
              <span className="text-zinc-900">Combined avg monthly net</span>
              <span
                className={`font-mono tabular-nums ${
                  propertyAwareForecast.property.net + propertyAwareForecast.nonProperty.net >= 0
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
              >
                {propertyAwareForecast.property.net + propertyAwareForecast.nonProperty.net >= 0 ? "+" : ""}
                {formatCurrency(propertyAwareForecast.property.net + propertyAwareForecast.nonProperty.net)}/mo
              </span>
            </div>
          </div>

          {/* Per-month transparency */}
          <details className="mt-3 pt-3 border-t border-indigo-100">
            <summary className="cursor-pointer text-[10px] text-zinc-400 uppercase tracking-wider hover:text-zinc-600">
              View {propertyAwareForecast.monthBreakdown.length} months used
            </summary>
            <div className="mt-2 space-y-1 text-xs">
              {propertyAwareForecast.monthBreakdown.map((m) => {
                const propNet = m.propertyIncome - m.propertyExpense;
                const nonNet = m.nonPropertyIncome - m.nonPropertyExpense;
                return (
                  <div key={m.month} className="grid grid-cols-4 gap-2 text-zinc-500">
                    <span className="font-mono">{m.month}</span>
                    <span className="font-mono text-right">
                      Prop: <span className={propNet >= 0 ? "text-emerald-700" : "text-red-600"}>
                        {propNet >= 0 ? "+" : ""}{formatCurrency(propNet)}
                      </span>
                    </span>
                    <span className="font-mono text-right">
                      Non: <span className={nonNet >= 0 ? "text-emerald-700" : "text-red-600"}>
                        {nonNet >= 0 ? "+" : ""}{formatCurrency(nonNet)}
                      </span>
                    </span>
                    <span className="font-mono text-right text-zinc-700">
                      = {propNet + nonNet >= 0 ? "+" : ""}{formatCurrency(propNet + nonNet)}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      )}

      {/* Legacy headline: trailing-3 avg. Kept as a secondary check while
          property-aware is new. */}
      {!propertyAwareForecast && historicalForecast && (
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
          <div className="px-4 pb-4 space-y-4 text-xs border-t border-zinc-100 pt-3">

            {/* === Already this month === */}
            <div>
              <div className="text-zinc-700 mb-0.5 font-semibold text-sm">
                Already this month
              </div>
              <div className="text-zinc-400 mb-2 italic text-[11px]">
                Real transactions on your statement for the current calendar month.
              </div>
              <div className="grid grid-cols-2 gap-x-6 mb-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Income received</span>
                  <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(hybridForecast.actualSoFar.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Expenses paid</span>
                  <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(hybridForecast.actualSoFar.expenses)}</span>
                </div>
              </div>
              <ExampleList
                title="Income transactions"
                items={hybridForecast.examples?.actualSoFarIncome ?? []}
                color="emerald"
              />
              <ExampleList
                title="Expense transactions"
                items={hybridForecast.examples?.actualSoFarExpenses ?? []}
                color="red"
              />
            </div>

            {/* === Detected recurring patterns === */}
            <div className="pt-3 border-t border-zinc-100">
              <div className="text-zinc-700 mb-0.5 font-semibold text-sm">
                Detected recurring patterns
              </div>
              <div className="text-zinc-400 mb-2 italic text-[11px]">
                Vendors that paid you or were paid in at least 2 of the last 3 months.
                Examples: rent from tenants, monthly utilities, software subscriptions,
                regular contractors.
              </div>
              <div className="grid grid-cols-2 gap-x-6 mb-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Recurring income</span>
                  <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(hybridForecast.recurring.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Recurring expenses</span>
                  <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(hybridForecast.recurring.expenses)}</span>
                </div>
              </div>
              <ExampleList
                title="Income transactions (top 10 from last complete month)"
                items={hybridForecast.examples?.recurringIncome ?? []}
                color="emerald"
              />
              <ExampleList
                title="Expense transactions (top 10 from last complete month)"
                items={hybridForecast.examples?.recurringExpenses ?? []}
                color="red"
              />
            </div>

            {/* === Typical non-recurring activity === */}
            <div className="pt-3 border-t border-zinc-100">
              <div className="text-zinc-700 mb-0.5 font-semibold text-sm">
                Typical non-recurring activity (one-off avg)
              </div>
              <div className="text-zinc-400 mb-2 italic text-[11px]">
                Vendors that appeared in 0 or 1 of the last 3 months. Examples:
                ad-hoc supplier invoices, one-time refunds, irregular contractor
                payments, occasional purchases. Averaged across the last 3 months
                because individual occurrences can&apos;t be predicted.
              </div>
              <div className="grid grid-cols-2 gap-x-6 mb-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">One-off income avg/mo</span>
                  <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(hybridForecast.oneOffAvg.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">One-off expenses avg/mo</span>
                  <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(hybridForecast.oneOffAvg.expenses)}</span>
                </div>
              </div>
              <ExampleList
                title="Income transactions (top 10 from last complete month)"
                items={hybridForecast.examples?.oneOffIncome ?? []}
                color="emerald"
              />
              <ExampleList
                title="Expense transactions (top 10 from last complete month)"
                items={hybridForecast.examples?.oneOffExpenses ?? []}
                color="red"
              />
            </div>

            {hybridForecast.reconciliationWarning && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                ⚠️ Recurring + one-off model net = {formatCurrency(hybridForecast.totalProjected.net)}.
                Trailing avg net = {formatCurrency(historicalForecast.avgMonthlyNet)}.
                Headline uses the trailing avg because it&apos;s more accurate.
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
