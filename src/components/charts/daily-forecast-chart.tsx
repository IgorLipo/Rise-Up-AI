"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { DailyForecast } from "@/lib/forecast";

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
    </div>
  );
}
