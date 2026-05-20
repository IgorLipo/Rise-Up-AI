"use client";

import type { MonthEndForecast } from "@/lib/forecast";
import { DailyForecastChart } from "@/components/charts/daily-forecast-chart";
import { ForecastHeadline, type RecurringHeadlineData } from "@/components/forecast/forecast-headline";
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
      actualSoFarIncome: Array<ExampleItem>;
      actualSoFarExpenses: Array<ExampleItem>;
      recurringIncome: Array<ExampleItem>;
      recurringExpenses: Array<ExampleItem>;
      oneOffIncome: Array<ExampleItem>;
      oneOffExpenses: Array<ExampleItem>;
    };
  } | null;
  recurringHeadline?: RecurringHeadlineData | null;
  monthlyOneOffExpenseAvg?: number;
  monthlyOneOffIncomeAvg?: number;
  oneOffHistoryMonths?: number;
}

interface ExampleItem {
  description: string;
  amount: number;
  date?: string;
  subcategory?: string;
  hitCount?: number;
  direction?: string;
}

function ExampleList({
  title,
  items,
  color,
}: {
  title: string;
  items: Array<ExampleItem>;
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
              {(it.date || it.hitCount != null) && (
                <div className="text-zinc-400 text-[10px]">
                  {it.date}
                  {it.subcategory && it.subcategory !== "uncategorized" && (
                    <> · {it.subcategory.replace(/-/g, " ")}</>
                  )}
                  {it.hitCount != null && (
                    <> · fired {it.hitCount}/3 mo</>
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
  const { forecast, statementInfo, historicalForecast, hybridForecast, recurringHeadline } = props;

  return (
    <div className="space-y-5">
      {/* Recurring-only headline. Same component used by /forecast page. */}
      {recurringHeadline && <ForecastHeadline data={recurringHeadline} />}


      {/* Diagnostic detail — recurring-pattern view + one-off avg breakdown.
            Kept for transparency but visually demoted. If the warning fires
            the two methods disagree → the recurring detector is missing
            activity. */}
      {hybridForecast && (
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

            {/* Classification rule — one-liner up top */}
            <div className="rounded bg-zinc-50 border border-zinc-200 px-3 py-2 text-[11px] text-zinc-600">
              <span className="font-semibold text-zinc-700">Rule: </span>
              Vendor (canonical-firm key) fired in ≥2 of the last 3 complete
              months → <span className="text-emerald-700 font-medium">recurring</span>;
              else → <span className="text-amber-700 font-medium">one-off</span>.
              Each vendor below tagged with its hit count (fired N/3 mo).
            </div>

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
                  <span className="text-zinc-500">Recurring income /mo</span>
                  <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(hybridForecast.recurring.income)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Recurring expenses /mo</span>
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

            {hybridForecast.reconciliationWarning && historicalForecast && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                ⚠️ Recurring + one-off model net = {formatCurrency(hybridForecast.totalProjected.net)}.
                Trailing avg net = {formatCurrency(historicalForecast.avgMonthlyNet)}.
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
