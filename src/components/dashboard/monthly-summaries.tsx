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
  completeness?: "complete" | "partial";
  dataFrom?: string;
  dataTo?: string;
}

export interface MonthCardData {
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
  statementPeriod?: { from: string; to: string };
  openingBalance?: number;
  closingBalance?: number;
  topCategories?: Array<{ category: string; total: number }>;
  unusualItems?: Array<{ description: string; amount: number }>;
  forecastAccuracy?: number;
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
                    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                      m.completeness === "partial" ? "bg-amber-400" : statusStyle.dot
                    }`}
                    title={m.completeness === "partial" ? "Partial data" : statusStyle.label}
                  />
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {m.label}
                      {m.completeness === "partial" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Partial
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {m.dataFrom && m.dataTo
                        ? `${m.dataFrom.slice(0, 10)} to ${m.dataTo.slice(0, 10)}`
                        : `${m.transactionCount} transactions`}
                    </div>
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
                  {m.completeness === "partial" && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                      {m.month === new Date().toISOString().slice(0, 7)
                        ? "Upload the next statement to complete this month's actuals."
                        : `Partial data${m.dataFrom ? ` — available from ${m.dataFrom.slice(0, 10)}` : ""}${m.dataTo ? ` to ${m.dataTo.slice(0, 10)}` : ""}`}
                    </div>
                  )}
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

function MetricTile({ label, value, positive, negative }: {
  label: string; value: number; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="bg-zinc-50 rounded-lg p-2.5">
      <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-mono font-medium mt-0.5 ${
        positive ? "text-emerald-600" : negative ? "text-red-500" : "text-zinc-900"
      }`}>
        {formatCurrency(value)}
      </div>
    </div>
  );
}

export function MonthCard({ data, onViewTransactions }: {
  data: MonthCardData;
  onViewTransactions?: (month: string) => void;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{data.label}</h3>
            {data.statementPeriod && (
              <p className="text-xs text-zinc-400 mt-0.5">
                {data.statementPeriod.from.slice(0, 10)} to {data.statementPeriod.to.slice(0, 10)}
              </p>
            )}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
            data.completeness === "partial" ? "bg-amber-50 text-amber-700 border-amber-200" :
            data.status === "safe" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            data.status === "watch" ? "bg-amber-50 text-amber-700 border-amber-200" :
            data.status === "risk" ? "bg-red-50 text-red-700 border-red-200" :
            "bg-red-100 text-red-800 border-red-300"
          }`}>
            {data.completeness === "partial" ? "Partial" : data.status.charAt(0).toUpperCase() + data.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Partial data notice */}
        {data.completeness === "partial" && (
          <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            {data.month === new Date().toISOString().slice(0, 7)
              ? "Upload the next statement to complete this month's actuals."
              : `Partial data${data.dataFrom ? ` — available from ${data.dataFrom.slice(0, 10)}` : ""}${data.dataTo ? ` to ${data.dataTo.slice(0, 10)}` : ""}`}
          </div>
        )}

        {/* Balances (if available) */}
        {data.openingBalance !== undefined && data.closingBalance !== undefined && (
          <div className="grid grid-cols-2 gap-2">
            <MetricTile label="Opening" value={data.openingBalance} />
            <MetricTile label="Closing" value={data.closingBalance} />
          </div>
        )}

        {/* Income / Expenses */}
        <div className="grid grid-cols-2 gap-2">
          <MetricTile label="Income" value={data.totalIncome} positive />
          <MetricTile label="Expenses" value={data.totalExpenses} negative />
        </div>

        {/* Net movement */}
        <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
          <span className="text-xs text-zinc-500">Net movement</span>
          <span className={`text-sm font-mono font-semibold ${data.netFlow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {data.netFlow >= 0 ? "+" : ""}{formatCurrency(data.netFlow)}
          </span>
        </div>

        {/* Transaction count */}
        <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
          <span className="text-xs text-zinc-500">Transactions</span>
          <span className="text-sm font-medium text-zinc-900">{data.transactionCount}</span>
        </div>

        {/* Top categories */}
        {data.topCategories && data.topCategories.length > 0 && (
          <div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-1.5">Top categories</div>
            <div className="space-y-1">
              {data.topCategories.slice(0, 3).map((cat) => (
                <div key={cat.category} className="flex justify-between text-xs">
                  <span className="text-zinc-600 capitalize">{cat.category.replace(/-/g, " ")}</span>
                  <span className="font-mono text-zinc-500">{formatCurrency(cat.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unusual items */}
        {data.unusualItems && data.unusualItems.length > 0 && (
          <div>
            <div className="text-[10px] text-amber-600 uppercase tracking-wider font-medium mb-1">Unusual activity</div>
            {data.unusualItems.map((item, i) => (
              <div key={i} className="text-xs text-zinc-600 flex justify-between">
                <span className="truncate mr-2">{item.description}</span>
                <span className="font-mono text-red-500 flex-shrink-0">-{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Forecast accuracy */}
        {data.forecastAccuracy !== undefined && (
          <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
            <span className="text-xs text-zinc-500">Forecast accuracy</span>
            <span className="text-xs font-medium text-zinc-700">{Math.round(data.forecastAccuracy * 100)}%</span>
          </div>
        )}

        {/* View transactions */}
        <button
          onClick={() => onViewTransactions?.(data.month)}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          View transactions
        </button>
      </div>
    </div>
  );
}
