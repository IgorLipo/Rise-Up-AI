"use client";

import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/forecast/status-badge";
import type { ForecastStatus } from "@/types";

interface Props {
  currentBalance: number;
  predictedMonthEnd: number;
  status: ForecastStatus;
  confidence: number;
}

export function CashPositionRow({ currentBalance, predictedMonthEnd, status, confidence }: Props) {
  const diff = predictedMonthEnd - currentBalance;
  const isPositive = diff >= 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Today's balance</div>
        <div className="text-2xl font-bold text-zinc-900 tabular-nums">{formatCurrency(currentBalance)}</div>
        <div className="text-xs text-zinc-400 mt-1">Updated from statement</div>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Predicted month-end</div>
        <div className={`text-2xl font-bold tabular-nums ${isPositive ? "text-green-700" : "text-red-600"}`}>
          {formatCurrency(predictedMonthEnd)}
        </div>
        <div className={`text-xs mt-1 ${isPositive ? "text-green-600" : "text-red-500"}`}>
          {isPositive ? "+" : ""}{formatCurrency(diff)} projected
        </div>
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1">Status</div>
        <StatusBadge status={status} className="mb-2" />
        <div className="text-xs text-zinc-400">{Math.round(confidence * 100)}% confidence</div>
      </div>
    </div>
  );
}
