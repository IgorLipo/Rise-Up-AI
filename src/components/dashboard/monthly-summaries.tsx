"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface MonthlySummary {
  month: string;
  label: string;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
  status: "safe" | "watch" | "risk" | "critical";
}

interface Props {
  monthly: MonthlySummary[];
  onSelectMonth?: (month: string) => void;
}

const STATUS_COLORS: Record<MonthlySummary["status"], { dot: string; label: string }> = {
  safe: { dot: "bg-emerald-500", label: "Safe" },
  watch: { dot: "bg-amber-400", label: "Watch" },
  risk: { dot: "bg-orange-500", label: "Risk" },
  critical: { dot: "bg-red-500", label: "Critical" },
};

export function MonthlySummaries({ monthly, onSelectMonth }: Props) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  if (monthly.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
          Monthly breakdown
        </h2>
        <span className="text-xs text-zinc-400">{monthly.length} months</span>
      </div>
      <div className="space-y-2">
        {monthly.map((m) => {
          const isExpanded = expandedMonth === m.month;
          const statusStyle = STATUS_COLORS[m.status];
          return (
            <div
              key={m.month}
              className="bg-white border border-zinc-200 rounded-xl overflow-hidden transition-all"
            >
              <button
                onClick={() => {
                  setExpandedMonth(isExpanded ? null : m.month);
                  onSelectMonth?.(m.month);
                }}
                className="w-full p-4 text-left hover:bg-zinc-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {/* Status indicator dot */}
                  <span
                    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`}
                    title={statusStyle.label}
                  />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{m.label}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{m.transactionCount} transactions</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-sm font-mono font-medium ${
                      m.netFlow >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {m.netFlow >= 0 ? "+" : ""}{formatCurrency(m.netFlow)}
                    </div>
                    <div className="text-xs text-zinc-400">
                      in {formatCurrency(m.totalIncome)} / out {formatCurrency(m.totalExpenses)}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-zinc-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-zinc-100">
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-zinc-50 rounded-lg p-2.5">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Income</div>
                      <div className="text-sm font-mono font-medium text-emerald-600 mt-0.5">
                        {formatCurrency(m.totalIncome)}
                      </div>
                    </div>
                    <div className="bg-zinc-50 rounded-lg p-2.5">
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Expenses</div>
                      <div className="text-sm font-mono font-medium text-red-500 mt-0.5">
                        {formatCurrency(m.totalExpenses)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectMonth?.(m.month)}
                    className="mt-3 w-full px-3 py-2 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    View transactions for {m.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
