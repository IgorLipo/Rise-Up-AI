"use client";

import { formatCurrency } from "@/lib/utils";
import type { MonthEndForecast } from "@/lib/forecast";

interface KeyDriversProps {
  forecast: MonthEndForecast;
  patterns: {
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
  };
}

function isFutureDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return date > today;
}

export function KeyDrivers({ patterns }: KeyDriversProps) {
  const topIncome = patterns.recurringIncome
    .filter((item) => isFutureDate(item.nextExpected))
    .sort((a, b) => b.typicalAmount - a.typicalAmount)
    .slice(0, 3);

  const topExpenses = patterns.recurringExpenses
    .filter((item) => isFutureDate(item.nextExpected))
    .sort((a, b) => b.typicalAmount - a.typicalAmount)
    .slice(0, 3);

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Biggest expected income still to arrive */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-3">
            Biggest expected income still to arrive
          </div>
          {topIncome.length === 0 ? (
            <p className="text-xs text-zinc-400">No significant income expected</p>
          ) : (
            <div className="space-y-2">
              {topIncome.map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-zinc-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-zinc-900 capitalize">
                      {item.merchant}
                    </span>
                    <span className="font-mono text-emerald-600 text-sm tabular-nums">
                      +{formatCurrency(item.typicalAmount)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Expected {new Date(item.nextExpected).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Biggest expected expenses still to leave */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-medium mb-3">
            Biggest expected expenses still to leave
          </div>
          {topExpenses.length === 0 ? (
            <p className="text-xs text-zinc-400">No significant expenses expected</p>
          ) : (
            <div className="space-y-2">
              {topExpenses.map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-zinc-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-zinc-900 capitalize">
                      {item.merchant}
                    </span>
                    <span className="font-mono text-red-500 text-sm tabular-nums">
                      -{formatCurrency(item.typicalAmount)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Expected {new Date(item.nextExpected).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
