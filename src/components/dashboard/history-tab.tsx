"use client";

import { MonthCard, type MonthCardData } from "@/components/dashboard/monthly-summaries";

interface HistoryTabProps {
  monthly: Array<{
    month: string;
    label: string;
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    status: "safe" | "watch" | "risk" | "critical";
    completeness?: "complete" | "partial";
    dataFrom?: string;
    dataTo?: string;
  }>;
  accumulated: {
    dateRange: { from: string; to: string } | null;
  };
  categories: Array<{
    category: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  suspicious: Array<{
    merchant: string;
    reason: string;
    riskLevel: string;
    date: string;
    amount: number;
    description: string;
  }>;
  onViewTransactions: (month: string) => void;
}

export function HistoryTab({ monthly, accumulated, categories, suspicious, onViewTransactions }: HistoryTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
          Monthly history
        </h2>
        <span className="text-xs text-zinc-400">{monthly.length} months</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {monthly.map((m) => {
          const monthSuspicious = suspicious.filter((s) => s.date?.slice(0, 7) === m.month);
          const cardData: MonthCardData = {
            ...m,
            statementPeriod: m.dataFrom && m.dataTo
              ? { from: m.dataFrom, to: m.dataTo }
              : undefined,
            unusualItems: monthSuspicious.length > 0
              ? monthSuspicious.map((s) => ({
                  description: s.merchant || s.description,
                  amount: s.amount,
                }))
              : undefined,
          };
          return (
            <MonthCard
              key={m.month}
              data={cardData}
              onViewTransactions={onViewTransactions}
            />
          );
        })}
      </div>
      {monthly.length === 0 && (
        <p className="text-center text-xs text-zinc-400 py-8">
          Upload statements to see monthly history.
        </p>
      )}
    </div>
  );
}
