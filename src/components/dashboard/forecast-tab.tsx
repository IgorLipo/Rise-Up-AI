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
}

export function ForecastTab(props: ForecastTabProps) {
  const {
    currentPosition, forecast, accumulated, categories, patterns,
    totalDocuments, totalTransactions, statementInfo, balanceValidation,
  } = props;

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

      {/* Forecast Calculation Audit Trail (criterion 1.3) */}
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
              <span className="text-zinc-500">+ Expected income (HIGH)</span>
              <span className="font-mono text-emerald-600 tabular-nums">
                {formatCurrency(forecast.calculationAudit.highConfidenceIncome)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">&minus; Expected expenses (HIGH)</span>
              <span className="font-mono text-red-500 tabular-nums">
                {formatCurrency(forecast.calculationAudit.highConfidenceExpenses)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">&plusmn; Expected income (MEDIUM)</span>
              <span className="font-mono text-emerald-500 tabular-nums">
                {formatCurrency(forecast.calculationAudit.mediumConfidenceIncome)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">&plusmn; Expected expenses (MEDIUM)</span>
              <span className="font-mono text-red-400 tabular-nums">
                {formatCurrency(forecast.calculationAudit.mediumConfidenceExpenses)}
              </span>
            </div>
            <div className="border-t border-zinc-100 pt-2 mt-1 flex justify-between text-xs">
              <span className="text-zinc-500 font-medium">= Predicted balance</span>
              <span className="font-mono text-zinc-900 font-semibold tabular-nums">
                ~{formatCurrency(forecast.calculationAudit.predictedRangeLow)}&ndash;
                {formatCurrency(forecast.calculationAudit.predictedRangeHigh)}
              </span>
            </div>
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
