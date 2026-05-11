"use client";

import { useMemo } from "react";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { formatCurrency } from "@/lib/utils";

interface TransactionsTabProps {
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
  totalTransactions: number;
  onViewAllTransactions: () => void;
}

export function TransactionsTab({ categories, totalTransactions, onViewAllTransactions }: TransactionsTabProps) {
  const recentTransactions = useMemo(() => {
    return categories
      .flatMap((cat) =>
        cat.transactions.map((tx) => ({ ...tx, category: cat.category }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [categories]);

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
            Spending overview
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">{totalTransactions} total transactions</p>
        </div>
        <button
          onClick={onViewAllTransactions}
          className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          View all transactions &rarr;
        </button>
      </div>

      {/* Category breakdown */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-5">
        <CategoryBreakdown categories={categories} />
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-2">Recent activity</h3>
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {recentTransactions.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-700 truncate max-w-[240px]">{tx.description}</div>
                    <div className="text-[10px] text-zinc-400">{tx.date} &middot; {tx.category.replace(/-/g, " ")}</div>
                  </div>
                  <span className={`text-xs font-mono ml-3 flex-shrink-0 ${tx.type === "credit" ? "text-emerald-600" : "text-red-500"}`}>
                    {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center py-6">No transactions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
