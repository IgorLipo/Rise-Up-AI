"use client";

import type { MonthEndForecast } from "@/lib/forecast";
import { AccumulatedStats } from "@/components/dashboard/accumulated-stats";
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
  const {
    currentPosition, forecast, accumulated, categories, patterns,
    totalDocuments, totalTransactions, statementInfo, balanceValidation,
    historicalForecast,
    monthlyOneOffExpenseAvg, monthlyOneOffIncomeAvg, oneOffHistoryMonths,
  } = props;

  return (
    <div className="space-y-5">
      {/* Headline credibility card — trailing-N-month historical baseline */}
      {historicalForecast && currentPosition.balance != null && (
        <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-[10px] text-indigo-600 uppercase tracking-wider font-semibold">
                Where you&apos;ll likely end the month
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {historicalForecast.method} · {historicalForecast.daysRemaining} day{historicalForecast.daysRemaining !== 1 ? "s" : ""} remaining in current month
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Confidence</div>
              <div className="text-sm font-semibold text-indigo-700">
                {Math.round(historicalForecast.confidence * 100)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current balance</div>
              <div className="text-xl font-bold text-zinc-900 tabular-nums">
                {formatCurrency(currentPosition.balance)}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                as of {historicalForecast.asOfDate}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Expected net flow</div>
              <div className={`text-xl font-bold tabular-nums ${
                historicalForecast.expectedNetFlow >= 0 ? "text-emerald-600" : "text-red-500"
              }`}>
                {historicalForecast.expectedNetFlow >= 0 ? "+" : ""}
                {formatCurrency(historicalForecast.expectedNetFlow)}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                between now and month-end
              </div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Projected month-end</div>
              <div className={`text-xl font-bold tabular-nums ${
                historicalForecast.predictedMonthEnd >= 0 ? "text-indigo-700" : "text-red-600"
              }`}>
                {formatCurrency(historicalForecast.predictedMonthEnd)}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                by {historicalForecast.monthEndDate}
              </div>
            </div>
          </div>

          <div className="border-t border-indigo-100 pt-3 text-xs text-zinc-600 space-y-1">
            <div className="font-medium text-zinc-700">Based on the last {historicalForecast.monthsUsed} complete months:</div>
            <div className="flex justify-between">
              <span>Avg monthly income</span>
              <span className="font-mono text-emerald-700 tabular-nums">+{formatCurrency(historicalForecast.avgMonthlyIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg monthly expenses</span>
              <span className="font-mono text-red-600 tabular-nums">-{formatCurrency(historicalForecast.avgMonthlyExpenses)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Avg monthly net</span>
              <span className={`font-mono tabular-nums ${historicalForecast.avgMonthlyNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {historicalForecast.avgMonthlyNet >= 0 ? "+" : ""}{formatCurrency(historicalForecast.avgMonthlyNet)}
              </span>
            </div>
          </div>
        </div>
      )}

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
        statementInfo={statementInfo}
        balanceValidation={balanceValidation}
      />

      {/* Statement Source-of-Truth Block (criterion 1.1) */}
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

      {/* Forecast Calculation Audit Trail */}
      {forecast?.calculationAudit && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-3">
            How this was calculated
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Latest statement balance</span>
              <span className="font-mono text-zinc-900 tabular-nums">
                {formatCurrency(forecast.calculationAudit.latestStatementBalance)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">+ Expected recurring income</span>
              <span className="font-mono text-emerald-600 tabular-nums">
                {formatCurrency(forecast.calculationAudit.highConfidenceIncome)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">&minus; Expected recurring expenses</span>
              <span className="font-mono text-red-500 tabular-nums">
                {formatCurrency(forecast.calculationAudit.highConfidenceExpenses)}
              </span>
            </div>
            <div className="border-t border-zinc-100 pt-2 mt-1 flex justify-between text-sm">
              <span className="text-zinc-700 font-semibold">Predicted month-end balance</span>
              <span className={`font-mono font-bold tabular-nums ${
                forecast.calculationAudit.predictedBalance >= 0 ? "text-emerald-600" : "text-red-500"
              }`}>
                {formatCurrency(forecast.calculationAudit.predictedBalance)}
              </span>
            </div>
          </div>
          {(forecast.calculationAudit.mediumConfidenceIncome > 0 || forecast.calculationAudit.mediumConfidenceExpenses > 0) && (
            <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-400">
              You may also have up to {formatCurrency(forecast.calculationAudit.mediumConfidenceIncome)} in additional
              income and {formatCurrency(forecast.calculationAudit.mediumConfidenceExpenses)} in additional
              expenses from less consistent patterns — these are shown in the daily forecast
              but not counted toward the predicted balance.
            </div>
          )}
        </div>
      )}

      {/* Monthly one-off buffer */}
      {monthlyOneOffExpenseAvg !== undefined && monthlyOneOffExpenseAvg > 0 && oneOffHistoryMonths !== undefined && oneOffHistoryMonths > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-xs text-blue-500 uppercase tracking-wider font-medium mb-2">
            Monthly one-off buffer
          </div>
          <div className="text-sm text-blue-800 mb-2">
            Based on {oneOffHistoryMonths} month{oneOffHistoryMonths !== 1 ? "s" : ""} of history, you typically have{" "}
            <span className="font-semibold">{formatCurrency(monthlyOneOffExpenseAvg)}</span> in one-off
            expenses each month that aren&apos;t included in the daily forecast.
          </div>
          {monthlyOneOffIncomeAvg !== undefined && monthlyOneOffIncomeAvg > 0 && (
            <div className="text-xs text-blue-600">
              One-off income averages {formatCurrency(monthlyOneOffIncomeAvg)}/month.
            </div>
          )}
          <div className="text-xs text-blue-400 mt-2 italic">
            These are real expenses from your history that don&apos;t repeat — keep them in mind
            when planning your cashflow.
          </div>
        </div>
      )}

      {/* Catch-Up Estimate (criterion 1.6) */}
      {forecast?.catchUpEstimate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-semibold text-amber-800 mb-2">
            {forecast.catchUpEstimate.daysSinceStatement} days since statement
          </div>
          <div className="text-xs text-amber-700 mb-2">Based on detected patterns:</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-amber-600">~{formatCurrency(forecast.catchUpEstimate.likelySpent)} likely already spent</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-600">~{formatCurrency(forecast.catchUpEstimate.likelyReceived)} likely received</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-amber-800">Estimated current balance</span>
              <span className="text-amber-900 font-mono">
                ~{formatCurrency(forecast.catchUpEstimate.estimatedBalance)}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[10px] text-amber-600 mb-1">
              Confidence: {Math.round(forecast.catchUpEstimate.confidence * 100)}%
            </div>
            <div className="h-1.5 bg-amber-200 rounded-full">
              <div
                style={{ width: `${forecast.catchUpEstimate.confidence * 100}%` }}
                className="h-full bg-amber-500 rounded-full"
              />
            </div>
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
