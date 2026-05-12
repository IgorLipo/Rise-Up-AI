"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface VendorOccurrence {
  date: string;
  amount: number;
  description: string;
}

interface RecurringVendor {
  canonicalName: string;
  subcategory: string;
  category: string;
  typicalAmount: number;
  recurrencePattern: string | null;
  appearanceCount: number;
  monthsSeen: number;
  firstSeen: string;
  lastSeen: string;
  amountRange: { min: number; max: number };
  occurrences?: VendorOccurrence[];
  monthlyFrequency?: string;
  amountTrend?: string;
  isFirstSeen?: boolean;
  direction?: string;
}

interface SuspiciousVendor {
  canonicalName: string;
  subcategory: string;
  typicalAmount: number;
  appearanceCount: number;
  reason: string;
}

interface OneOffVendor {
  canonicalName: string;
  date: string;
  amount: number;
  description: string;
  subcategory: string;
}

interface CrossMonthInsight {
  vendor: string;
  type: "new_vendor" | "disappeared_vendor" | "amount_change" | "frequency_change" | "became_recurring";
  detail: string;
  previousAmount?: number;
  currentAmount?: number;
}

interface Props {
  totalVendors: number;
  recurring: RecurringVendor[];
  suspicious: SuspiciousVendor[];
  oneOff: OneOffVendor[];
  oneOffIncome?: OneOffVendor[];
  oneOffExpenses?: OneOffVendor[];
  crossMonthInsights: CrossMonthInsight[];
  onVendorClick?: (vendor: RecurringVendor | OneOffVendor) => void;
}

const INSIGHT_ICONS: Record<string, string> = {
  new_vendor: "New",
  disappeared_vendor: "Gone",
  amount_change: "Change",
  frequency_change: "Freq",
  became_recurring: "Recur",
};

export function VendorLearning({ totalVendors, recurring, suspicious, oneOff, oneOffIncome, oneOffExpenses, crossMonthInsights, onVendorClick }: Props) {
  const [tab, setTab] = useState<"recurring" | "insights" | "suspicious" | "oneoff">("recurring");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
          Vendor intelligence
        </h2>
        <span className="text-xs text-zinc-400">{totalVendors} vendors learned</span>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-zinc-100 p-0.5 mb-3">
        {(["recurring", "insights", "suspicious", "oneoff"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t === "recurring" ? `Recurring (${recurring.length})`
              : t === "insights" ? `Insights (${crossMonthInsights.length})`
              : t === "suspicious" ? `Flags (${suspicious.length})`
              : `One-off (${oneOff.length})`}
          </button>
        ))}
      </div>

      {/* Recurring vendors */}
      {tab === "recurring" && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {recurring.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">No recurring patterns detected yet. Upload more statements.</p>
          ) : (
            recurring.map((v) => (
              <div
                key={v.canonicalName}
                className={`bg-white border border-zinc-200 rounded-lg p-3 ${onVendorClick ? "cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all" : ""}`}
                onClick={() => onVendorClick?.(v)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 capitalize">{v.canonicalName}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {v.subcategory} · {v.recurrencePattern ?? "irregular"} · {v.appearanceCount}x across {v.monthsSeen} months
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-medium text-zinc-900">{formatCurrency(v.typicalAmount)}</div>
                    <div className="text-xs text-zinc-400">
                      {formatCurrency(v.amountRange.min)}–{formatCurrency(v.amountRange.max)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Cross-month insights */}
      {tab === "insights" && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {crossMonthInsights.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">Upload more months to see cross-month comparisons.</p>
          ) : (
            crossMonthInsights.map((insight, i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    insight.type === "new_vendor" ? "bg-emerald-50 text-emerald-700" :
                    insight.type === "disappeared_vendor" ? "bg-zinc-100 text-zinc-600" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {INSIGHT_ICONS[insight.type]}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 capitalize">{insight.vendor}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">{insight.detail}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Suspicious / flagged */}
      {tab === "suspicious" && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {suspicious.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">No suspicious vendors detected.</p>
          ) : (
            suspicious.map((v) => (
              <div key={v.canonicalName} className="bg-white border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 capitalize">{v.canonicalName}</div>
                    <div className="text-xs text-red-500 mt-0.5">{v.reason}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-zinc-900">{formatCurrency(v.typicalAmount)}</div>
                    <div className="text-xs text-zinc-400">{v.appearanceCount}x</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* One-off vendors */}
      {tab === "oneoff" && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {oneOff.length === 0 ? (
            <p className="text-xs text-zinc-400 py-4 text-center">No one-off vendors found.</p>
          ) : (
            oneOff.map((v) => (
              <div
                key={v.canonicalName}
                className={`bg-white border border-zinc-200 rounded-lg p-3 ${onVendorClick ? "cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all" : ""}`}
                onClick={() => onVendorClick?.(v)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-900 capitalize">{v.canonicalName}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {v.subcategory} · {v.date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-mono ${v.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {v.amount >= 0 ? "+" : "-"}{formatCurrency(Math.abs(v.amount))}
                    </div>
                    <div className="text-xs text-zinc-400 truncate max-w-[150px]">{v.description}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
