"use client";

import { useState } from "react";
import { VendorLearning } from "@/components/dashboard/vendor-learning";
import { InsightDetailPanel } from "@/components/dashboard/insight-detail-panel";
import { formatCurrency } from "@/lib/utils";
import type { InsightDetail } from "@/components/dashboard/insight-detail-panel";

interface IntelligenceTabProps {
  vendors: {
    total: number;
    recurring: Array<{
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
    }>;
    suspicious: Array<{
      canonicalName: string;
      subcategory: string;
      typicalAmount: number;
      appearanceCount: number;
      reason: string;
    }>;
    oneOff: string[];
  };
  crossMonthInsights: Array<{
    vendor: string;
    type: "new_vendor" | "disappeared_vendor" | "amount_change" | "frequency_change" | "became_recurring";
    detail: string;
    previousAmount?: number;
    currentAmount?: number;
  }>;
  patterns: {
    recurringExpenses: Array<{
      merchant: string;
      subcategory: string;
      typicalAmount: number;
      interval: string | null;
      confidence: number;
      nextExpected: string;
      occurrences: number;
      aiReasoning: string;
    }>;
    recurringIncome: Array<{
      merchant: string;
      subcategory: string;
      typicalAmount: number;
      interval: string | null;
      confidence: number;
      nextExpected: string;
      occurrences: number;
      aiReasoning: string;
    }>;
  };
  entities: {
    properties: Array<{
      key: string;
      displayName: string;
      confidence: number;
      matchType: string;
      transactionCount: number;
    }>;
    people: Array<{
      key: string;
      personName: string;
      role: string;
      confidence: number;
      indicators: string[];
      transactionCount: number;
    }>;
  };
  newVendors: Array<{
    merchantRaw: string;
    merchantNormalized: string;
    subcategory: string;
    confidence: number;
    reasoning: string;
  }>;
}

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  new_vendor: "New vendor",
  disappeared_vendor: "Vendor disappeared",
  amount_change: "Amount changed",
  frequency_change: "Frequency changed",
  became_recurring: "Now recurring",
};

export function IntelligenceTab(props: IntelligenceTabProps) {
  const { vendors, crossMonthInsights, patterns, entities, newVendors } = props;
  const [selectedInsight, setSelectedInsight] = useState<InsightDetail | null>(null);

  return (
    <div className="space-y-5">
      {/* Vendor intelligence (reuse existing) */}
      <VendorLearning
        totalVendors={vendors.total}
        recurring={vendors.recurring}
        suspicious={vendors.suspicious}
        oneOff={vendors.oneOff}
        crossMonthInsights={crossMonthInsights}
      />

      {/* Cross-month insights as clickable cards */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">
          Cross-month insights
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {crossMonthInsights.map((insight, i) => (
            <button
              key={i}
              onClick={() => setSelectedInsight({
                title: `${insight.vendor} — ${INSIGHT_TYPE_LABELS[insight.type] || insight.type}`,
                type: insight.type,
                detail: insight.detail,
                vendor: insight.vendor,
                previousAmount: insight.previousAmount,
                currentAmount: insight.currentAmount,
              })}
              className="text-left bg-white border border-zinc-200 rounded-lg p-3 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  insight.type === "new_vendor" ? "bg-emerald-50 text-emerald-700" :
                  insight.type === "disappeared_vendor" ? "bg-zinc-100 text-zinc-600" :
                  "bg-amber-50 text-amber-700"
                }`}>
                  {INSIGHT_TYPE_LABELS[insight.type] || insight.type}
                </span>
                <span className="text-xs font-medium text-zinc-900 capitalize truncate">{insight.vendor}</span>
              </div>
              <p className="text-xs text-zinc-500 line-clamp-2">{insight.detail}</p>
              <div className="mt-2 text-[10px] text-zinc-400 flex items-center gap-1">
                Click for details
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
        {crossMonthInsights.length === 0 && (
          <p className="text-xs text-zinc-400 py-4 text-center">Upload more months to see cross-month patterns.</p>
        )}
      </div>

      {/* Learned patterns */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">
          Learned patterns
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="text-xs font-medium text-zinc-900 mb-2">
              Recurring income ({patterns.recurringIncome.length})
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {patterns.recurringIncome.map((p) => (
                <div key={p.merchant} className="flex justify-between text-xs">
                  <span className="text-zinc-600 capitalize truncate">{p.merchant}</span>
                  <span className="font-mono text-emerald-600">{formatCurrency(p.typicalAmount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <div className="text-xs font-medium text-zinc-900 mb-2">
              Recurring expenses ({patterns.recurringExpenses.length})
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {patterns.recurringExpenses.map((p) => (
                <div key={p.merchant} className="flex justify-between text-xs">
                  <span className="text-zinc-600 capitalize truncate">{p.merchant}</span>
                  <span className="font-mono text-red-500">{formatCurrency(p.typicalAmount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Entities section */}
      {(entities.properties.length > 0 || entities.people.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">Entities</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {entities.properties.map((prop) => (
              <div key={prop.key} className="bg-white border border-zinc-200 rounded-lg p-3">
                <div className="text-xs font-medium text-zinc-900">{prop.displayName}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {prop.matchType} · {prop.transactionCount} txns · {Math.round(prop.confidence * 100)}% confidence
                </div>
              </div>
            ))}
            {entities.people.map((person) => (
              <div key={person.key} className="bg-white border border-zinc-200 rounded-lg p-3">
                <div className="text-xs font-medium text-zinc-900">{person.personName}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {person.role} · {person.transactionCount} txns
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight detail panel */}
      <InsightDetailPanel
        isOpen={selectedInsight !== null}
        onClose={() => setSelectedInsight(null)}
        insight={selectedInsight}
      />
    </div>
  );
}
