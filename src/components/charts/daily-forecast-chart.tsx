"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { DailyForecast } from "@/lib/forecast";

function DailyForecastRow({ day }: { day: DailyForecast }) {
  const [expanded, setExpanded] = useState(false);

  // Combine HIGH and MEDIUM confidence transactions, sort by amount descending
  const combined = [...day.transactions, ...day.possibleUpcoming]
    .sort((a, b) => Math.abs(b.expectedAmount) - Math.abs(a.expectedAmount));
  const topItems = combined.slice(0, 5);
  const remaining = combined.length - 5;

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      {/* Day header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-900">
            {new Date(day.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          {day.riskFlag && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">Risk</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {day.expectedIncome > 0 && (
            <span className="text-emerald-600 font-mono">+{formatCurrency(day.expectedIncome)}</span>
          )}
          {day.expectedExpenses > 0 && (
            <span className="text-red-500 font-mono">-{formatCurrency(day.expectedExpenses)}</span>
          )}
          <span className={`font-mono font-medium ${day.closingBalance >= 0 ? "text-zinc-700" : "text-red-600"}`}>
            {formatCurrency(day.closingBalance)}
          </span>
        </div>
      </div>

      {/* Top 5 items */}
      <div className="divide-y divide-zinc-100">
        {topItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.confidenceTier === "high" ? "bg-emerald-500" : "bg-amber-400"}`} title={item.confidenceTier} />
              <span className="text-xs text-zinc-700 truncate capitalize">{item.merchant}</span>
              <span className="text-[10px] text-zinc-400 capitalize">{item.subcategory}</span>
            </div>
            <span className={`text-xs font-mono ml-2 flex-shrink-0 ${item.expectedAmount > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {item.expectedAmount > 0 ? "+" : ""}{formatCurrency(item.expectedAmount)}
            </span>
          </div>
        ))}
      </div>

      {/* "+X more" expandable section */}
      {remaining > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 transition-colors text-left"
          >
            {expanded ? "Show less" : `+${remaining} more items`}
          </button>
          {expanded && (
            <div className="divide-y divide-zinc-100 border-t border-zinc-100">
              {combined.slice(5).map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.confidenceTier === "high" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span className="text-xs text-zinc-700 truncate capitalize">{item.merchant}</span>
                    <span className="text-[10px] text-zinc-400 capitalize">{item.subcategory}</span>
                  </div>
                  <span className={`text-xs font-mono ml-2 flex-shrink-0 ${item.expectedAmount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {item.expectedAmount > 0 ? "+" : ""}{formatCurrency(item.expectedAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state for days with no transactions */}
      {combined.length === 0 && (
        <div className="px-3 py-3 text-xs text-zinc-400 text-center">No transactions expected</div>
      )}
    </div>
  );
}

interface Props {
  data: DailyForecast[];
}

export function DailyForecastChart({ data }: Props) {
  if (!data.length) return null;

  const chartData = data.map((d) => ({
    date: new Date(d.date).getDate(),
    balance: d.closingBalance,
    income: d.expectedIncome > 0 ? d.closingBalance : 0,
    expense: d.expectedExpenses > 0 ? d.closingBalance : 0,
    risk: d.riskFlag ? d.closingBalance : 0,
    full: d,
  }));

  return (
    <div className="chart-dark p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Daily cashflow forecast</div>
        <div className="text-[10px] text-zinc-500">
          {new Date(data[0].date).toLocaleDateString("en-GB", { month: "short" })} →{" "}
          {new Date(data[data.length - 1].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: "#27272a",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#fafafa",
            }}
            formatter={(value) => [formatCurrency(Number(value ?? 0)), "Balance"]}
            labelFormatter={(day) => `Day ${day}`}
          />
          <Bar dataKey="balance" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.full.riskFlag ? "#fbbf24" : entry.full.expectedExpenses > 0 ? "#ef4444" : "#22c55e"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
        <span>█ Income days</span>
        <span>█ Expense days</span>
        <span>█ Risk flags</span>
      </div>

      {/* Grouped daily breakdown */}
      {data.length > 0 && (
        <div className="mt-4 space-y-3">
          {data.map((day) => (
            <DailyForecastRow key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
