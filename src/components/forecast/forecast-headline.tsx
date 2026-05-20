"use client";

import { formatCurrency } from "@/lib/utils";

/**
 * Recurring-only headline. The big number is what the user should plan on:
 * currentBalance + actualSoFarNet + recurring.net (prorated).
 * One-off averages are displayed BELOW as informational/additive, not added
 * to the headline.
 *
 * Daily chart's final closingBalance equals recurringProjectedMonthEnd.
 */
export interface RecurringHeadlineData {
  currentBalance: number;
  actualSoFar: { income: number; expenses: number; net: number };
  recurring: { income: number; expenses: number; net: number };
  oneOffAvg: { income: number; expenses: number; net: number };
  recurringProjectedMonthEnd: number;
  monthEndDate: string;
  confidence: number;
  monthsUsed: number;
  classificationRule: string;
}

export function ForecastHeadline({ data }: { data: RecurringHeadlineData }) {
  const monthLabel = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const isNegative = data.recurringProjectedMonthEnd < 0;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] text-indigo-600 uppercase tracking-wider font-semibold">
            {monthLabel} — projected month-end (recurring only)
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Statement balance + actuals so far + recurring vendor projection
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
            Confidence
          </div>
          <div className="text-sm font-semibold text-indigo-700">
            {Math.round(data.confidence * 100)}%
          </div>
        </div>
      </div>

      <div
        className={`text-3xl font-bold tabular-nums mb-1 ${
          isNegative ? "text-red-600" : "text-indigo-700"
        }`}
      >
        {formatCurrency(data.recurringProjectedMonthEnd)}
      </div>
      <div className="text-xs text-zinc-500 mb-3">by {data.monthEndDate}</div>

      <div className="border-t border-indigo-100 pt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Statement balance (starting point)</span>
          <span className="font-mono tabular-nums text-zinc-700">
            {formatCurrency(data.currentBalance)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6">
          <div className="flex justify-between">
            <span className="text-zinc-500">Recurring income (projected)</span>
            <span className="font-mono text-emerald-700 tabular-nums">
              +{formatCurrency(data.recurring.income)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Recurring expenses (projected)</span>
            <span className="font-mono text-red-600 tabular-nums">
              -{formatCurrency(data.recurring.expenses)}
            </span>
          </div>
        </div>
        <div className="flex justify-between pt-2 border-t border-indigo-100 font-semibold">
          <span className="text-zinc-700">
            = Projected month-end (recurring only)
          </span>
          <span
            className={`font-mono tabular-nums ${
              isNegative ? "text-red-600" : "text-indigo-700"
            }`}
          >
            {formatCurrency(data.recurringProjectedMonthEnd)}
          </span>
        </div>
        {(data.actualSoFar.income > 0 || data.actualSoFar.expenses > 0) && (
          <div className="pt-2 text-[10px] text-zinc-500">
            <span className="uppercase tracking-wider">
              Already happened this month
            </span>
            <span className="ml-2 normal-case">
              (in: +{formatCurrency(data.actualSoFar.income)}, out: -
              {formatCurrency(data.actualSoFar.expenses)}) — counted in chart
            </span>
          </div>
        )}
      </div>

      {/* One-off avg — informational, NOT added to the headline number. */}
      <div className="mt-3 pt-3 border-t border-indigo-100">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
          Typical one-off activity · last {data.monthsUsed}-mo avg
          <span className="ml-2 text-[10px] text-zinc-400 normal-case">
            (additive, not included above)
          </span>
        </div>
        <div className="grid grid-cols-3 gap-x-4 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Income</span>
            <span className="font-mono text-emerald-700 tabular-nums">
              +{formatCurrency(data.oneOffAvg.income)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Expenses</span>
            <span className="font-mono text-red-600 tabular-nums">
              -{formatCurrency(data.oneOffAvg.expenses)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Net</span>
            <span
              className={`font-mono tabular-nums ${
                data.oneOffAvg.net >= 0 ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {data.oneOffAvg.net >= 0 ? "+" : ""}
              {formatCurrency(data.oneOffAvg.net)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-indigo-100 text-[10px] text-zinc-400 italic">
        Rule: {data.classificationRule}
      </div>
    </div>
  );
}
