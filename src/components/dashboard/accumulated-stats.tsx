"use client";

import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { KeyDrivers } from "@/components/dashboard/key-drivers";
import type { ForecastStatus } from "@/types";
import type { MonthEndForecast } from "@/lib/forecast";

interface Props {
  currentBalance: number;
  predictedMonthEnd: number;
  remainingIncome: number;
  remainingExpenses: number;
  status: ForecastStatus;
  confidence: number;
  netFlow: number;
  totalDocuments: number;
  totalTransactions: number;
  balanceIsEstimated?: boolean;
  balanceCatchUpDays?: number;
  statementClosingBalance?: number;
  dateFilterActive?: boolean;
  balanceSource?: "statement" | "catchUp" | "unavailable";
  isStale?: boolean;
  statementPeriodEnd?: string;
  forecast?: MonthEndForecast | null;
  patterns?: {
    recurringIncome: Array<{
      merchant: string;
      typicalAmount: number;
      nextExpected: string;
    }>;
    recurringExpenses: Array<{
      merchant: string;
      typicalAmount: number;
      nextExpected: string;
    }>;
  } | null;
}

export function AccumulatedStats({
  currentBalance,
  predictedMonthEnd,
  remainingIncome,
  remainingExpenses,
  status,
  confidence,
  netFlow,
  totalDocuments,
  totalTransactions,
  balanceIsEstimated,
  balanceCatchUpDays,
  statementClosingBalance,
  dateFilterActive,
  balanceSource,
  isStale,
  statementPeriodEnd,
  forecast,
  patterns,
}: Props) {
  // Determine the balance subtitle based on context
  let balanceSubtitle: string;
  if (balanceSource === "unavailable") {
    balanceSubtitle = "Upload a statement to see balance";
  } else if (isStale) {
    balanceSubtitle = `Last statement ended ${statementPeriodEnd ?? "unknown"}`;
  } else if (dateFilterActive) {
    balanceSubtitle = "Filtered period net";
  } else if (balanceIsEstimated) {
    balanceSubtitle = `Estimated (${balanceCatchUpDays}d projection)`;
  } else {
    balanceSubtitle = "Latest statement";
  }

  const showBalanceUnavailable = balanceSource === "unavailable";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">
            Current balance
          </div>
          <div className="text-2xl font-bold text-zinc-900 tabular-nums">
            {showBalanceUnavailable ? "—" : formatCurrency(currentBalance)}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {balanceSubtitle}
          </div>
          {balanceIsEstimated && statementClosingBalance !== undefined && (
            <div className="text-[10px] text-amber-600 mt-1">
              Last known: {formatCurrency(statementClosingBalance)}
            </div>
          )}
          {isStale && (
            <div className="text-[10px] text-amber-600 mt-1">
              Balance may be stale — upload a newer statement
            </div>
          )}
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">
            Month-end forecast
          </div>
          <div className={`text-2xl font-bold tabular-nums ${
            predictedMonthEnd >= currentBalance ? "text-emerald-700" : "text-red-600"
          }`}>
            {formatCurrency(predictedMonthEnd)}
          </div>
          <div className={`text-xs mt-1 ${
            predictedMonthEnd >= currentBalance ? "text-emerald-600" : "text-red-500"
          }`}>
            {predictedMonthEnd >= currentBalance ? "+" : ""}
            {formatCurrency(predictedMonthEnd - currentBalance)} projected
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">
            Remaining month
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Income</span>
              <span className="font-mono text-emerald-600">{formatCurrency(remainingIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Expenses</span>
              <span className="font-mono text-red-500">{formatCurrency(remainingExpenses)}</span>
            </div>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1">
            Status
          </div>
          <StatusBadge status={status} className="mb-2" showCriteria={true} />
          <div className="text-xs text-zinc-400">
            {Math.round(confidence * 100)}% confidence
          </div>
        </div>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
            Statements
          </div>
          <div className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5">{totalDocuments}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
            Transactions
          </div>
          <div className="text-lg font-bold text-zinc-900 tabular-nums mt-0.5">{totalTransactions}</div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-3 text-center">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium">
            All-Time Net Flow
          </div>
          <div className={`text-lg font-bold tabular-nums mt-0.5 ${
            netFlow >= 0 ? "text-emerald-700" : "text-red-600"
          }`}>
            {netFlow >= 0 ? "+" : ""}{formatCurrency(netFlow)}
          </div>
        </div>
      </div>

      {/* Key drivers */}
      {forecast && patterns && (
        <KeyDrivers forecast={forecast} patterns={patterns} />
      )}
    </div>
  );
}
