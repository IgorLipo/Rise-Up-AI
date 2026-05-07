"use client";

import { useEffect, useState } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import type { StatementData, ForecastStatus } from "@/types";
import type { DailyForecast } from "@/lib/forecast";
import { detectAll } from "@/lib/detection";
import { generateForecast } from "@/lib/forecast";
import { StatusBadge } from "@/components/forecast/status-badge";
import { formatCurrency } from "@/lib/utils";

export default function ForecastPage() {
  const { companyId } = useActiveCompany();
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [status, setStatus] = useState<ForecastStatus>("safe");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    fetch("/api/documents")
      .then((r) => r.json())
      .then((json) => {
        const docs = json.documents ?? [];
        if (docs.length > 0) {
          fetch(`/api/documents/${docs[0].id}`)
            .then((r) => r.json())
            .then((res) => {
              const stmtData = res.document?.statement_data as StatementData;
              if (stmtData?.transactions) {
                const patterns = detectAll(stmtData.transactions);
                const fc = generateForecast(patterns, stmtData.summary.netFlow);
                setDaily(fc.dailyForecast);
                setStatus(fc.status);
              }
            });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="p-6 text-sm text-zinc-500">Loading...</div>;
  if (!daily.length) return (
    <div className="p-6 text-sm text-zinc-500">
      No forecast data. Upload a statement first.
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-zinc-900">Daily Forecast</h1>
        <StatusBadge status={status} />
      </div>
      {daily.map((day) => (
        <div
          key={day.date}
          className={`bg-white border rounded-xl p-3 ${
            day.riskFlag ? "border-amber-300 bg-amber-50" : "border-zinc-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-zinc-900">
              {new Date(day.date).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
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
                      tx.category === "Income" ? "text-green-600" : "text-red-600"
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
          {day.riskFlag && day.riskMessage && (
            <div className="text-xs text-amber-700 mt-1 font-medium">{day.riskMessage}</div>
          )}
        </div>
      ))}
    </div>
  );
}
