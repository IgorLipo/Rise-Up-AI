"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";
import { useActiveCompany } from "@/lib/auth/client";
import type { DailyForecast, ForecastStatus } from "@/lib/forecast";
import { StatusBadge } from "@/components/forecast/status-badge";
import { formatCurrency } from "@/lib/utils";

interface AggregateResponse {
  hasData: boolean;
  currentBalance: number;
  statementClosingBalance?: number;
  balanceIsEstimated?: boolean;
  balanceCatchUpDays?: number;
  lastStatementDate?: string;
  forecast: {
    currentBalance: number;
    predictedMonthEnd: number;
    remainingIncome: number;
    remainingExpenses: number;
    status: ForecastStatus;
    statusReason: string;
    confidence: number;
    dailyForecast: DailyForecast[];
    nextIncomeDate: string | null;
    dangerWindow: { from: string; to: string; lowestBalance: number } | null;
    biggestRisks: Array<{ title: string; description: string; severity: string }>;
    generatedAt: string;
  };
}

export default function ForecastPage() {
  const { companyId } = useActiveCompany();
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    fetch("/api/documents/aggregate")
      .then((r) => r.json())
      .then((json) => {
        if (json.hasData) setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="p-6 text-sm text-zinc-500">Loading...</div>;
  if (!data) return (
    <div className="p-6 text-sm text-zinc-500">
      No forecast data. Upload a statement first.
    </div>
  );

  const { forecast } = data;
  const daily = forecast.dailyForecast;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">
            {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} forecast
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Full month · {daily.length} days · actuals through today, projections to month-end
            {data.balanceIsEstimated && (
              <span className="text-amber-600 ml-1">
                · Balance estimated from {data.balanceCatchUpDays} days of catch-up
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={forecast.status} />
      </div>

      {/* Balance staleness warning */}
      {data.balanceIsEstimated && data.statementClosingBalance && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          Last known balance was {formatCurrency(data.statementClosingBalance)} on {data.lastStatementDate ? new Date(data.lastStatementDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "unknown"}. Current balance is estimated by projecting {data.balanceCatchUpDays} days of expected transactions. Upload a recent statement for a more accurate forecast.
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Month-end</div>
          <div className={`text-sm font-bold tabular-nums mt-0.5 ${
            forecast.predictedMonthEnd < 0 ? "text-red-600" : "text-zinc-900"
          }`}>
            {formatCurrency(forecast.predictedMonthEnd)}
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Remaining in</div>
          <div className="text-sm font-bold tabular-nums mt-0.5 text-emerald-600">
            {formatCurrency(forecast.remainingIncome)}
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-3">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Remaining out</div>
          <div className="text-sm font-bold tabular-nums mt-0.5 text-red-500">
            {formatCurrency(forecast.remainingExpenses)}
          </div>
        </div>
      </div>

      {daily.length === 0 ? (
        <div className="text-sm text-zinc-400 text-center py-8">
          No daily forecast data available.
        </div>
      ) : (
        <>
          {/* Risk summary at top */}
          {(() => {
            const riskDays = daily.filter((d) => d.riskFlag);
            if (riskDays.length === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <span className="font-semibold">{riskDays.length} day{riskDays.length !== 1 ? "s" : ""} with low balance risk:</span>
                {" "}
                {riskDays.map((d, i) => (
                  <span key={d.date}>
                    {i > 0 && i < riskDays.length - 1 ? ", " : ""}
                    {i > 0 && i === riskDays.length - 1 ? " and " : ""}
                    {new Date(d.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                ))}
                {" — "}
                {riskDays.some((d) => d.riskMessage?.includes("overdraft"))
                  ? "Possible overdraft risk. Review upcoming expenses."
                  : riskDays.some((d) => d.closingBalance < 0)
                    ? "Balance may go negative. Consider deferring non-essential payments."
                    : "Balance may run low. Monitor closely."}
              </div>
            );
          })()}

          {daily.map((day) => (
            <div
              key={day.date}
              className={`bg-white border rounded-xl p-3 ${
                day.riskFlag ? "border-amber-300 bg-amber-50" : "border-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-zinc-900">
                    {new Date(day.date).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                  {day.riskFlag && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                      Risk
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold tabular-nums text-zinc-900">
                  {formatCurrency(day.closingBalance)}
                </div>
              </div>
              {day.transactions.length > 0 ? (
                <div className="space-y-1">
                  {day.transactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600 truncate flex-1 mr-2">{tx.merchant}</span>
                      <span
                        className={`font-mono tabular-nums ${
                          tx.category === "Income" ? "text-emerald-600" : "text-red-500"
                        }`}
                      >
                        {tx.category === "Income" ? "+" : "-"}
                        {formatCurrency(tx.expectedAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-400">No expected transactions</div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
