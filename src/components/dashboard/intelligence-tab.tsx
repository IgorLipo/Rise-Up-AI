"use client";

import { useState } from "react";
import { VendorLearning } from "@/components/dashboard/vendor-learning";
import { InsightDetailPanel } from "@/components/dashboard/insight-detail-panel";
import { formatCurrency } from "@/lib/utils";
import type { InsightDetail } from "@/components/dashboard/insight-detail-panel";

interface VendorOccurrence {
  date: string;
  amount: number;
  description: string;
}

interface VendorWithOccurrences {
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

interface OneOffVendor {
  canonicalName: string;
  date: string;
  amount: number;
  description: string;
  subcategory: string;
}

interface IntelligenceTabProps {
  vendors: {
    total: number;
    recurring: VendorWithOccurrences[];
    suspicious: Array<{
      canonicalName: string;
      subcategory: string;
      typicalAmount: number;
      appearanceCount: number;
      reason: string;
    }>;
    oneOff: OneOffVendor[];
    oneOffIncome?: OneOffVendor[];
    oneOffExpenses?: OneOffVendor[];
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

function categoryLabel(subcategory: string): string {
  return subcategory.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function IntelligenceTab(props: IntelligenceTabProps) {
  const { vendors, crossMonthInsights, patterns, entities, newVendors } = props;
  const [selectedInsight, setSelectedInsight] = useState<InsightDetail | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorWithOccurrences | OneOffVendor | null>(null);

  return (
    <div className="space-y-5">
      {/* Vendor intelligence (reuse existing) */}
      <VendorLearning
        totalVendors={vendors.total}
        recurring={vendors.recurring}
        suspicious={vendors.suspicious}
        oneOff={vendors.oneOff}
        oneOffIncome={vendors.oneOffIncome}
        oneOffExpenses={vendors.oneOffExpenses}
        crossMonthInsights={crossMonthInsights}
        onVendorClick={(vendor) => setSelectedVendor(vendor)}
      />

      {/* Vendor drill-down panel */}
      {selectedVendor && (
        <div className="mt-5 bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 capitalize">
                {selectedVendor.canonicalName}
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600">
                {categoryLabel(selectedVendor.subcategory)}
              </span>
              {"isFirstSeen" in selectedVendor && selectedVendor.isFirstSeen && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                  New vendor
                </span>
              )}
            </div>
            <button onClick={() => setSelectedVendor(null)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">&times;</button>
          </div>

          {/* First-seen banner */}
          {"isFirstSeen" in selectedVendor && selectedVendor.isFirstSeen && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              New vendor — classification uncertain. Will refine as more statements are processed.
            </div>
          )}

          {/* Stats grid */}
          {"firstSeen" in selectedVendor ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-xs text-zinc-500">First seen <span className="block font-mono text-zinc-900 mt-0.5">{selectedVendor.firstSeen}</span></div>
              <div className="text-xs text-zinc-500">Last seen <span className="block font-mono text-zinc-900 mt-0.5">{selectedVendor.lastSeen}</span></div>
              <div className="text-xs text-zinc-500">Appearances <span className="block font-mono text-zinc-900 mt-0.5">{selectedVendor.appearanceCount} ({selectedVendor.monthsSeen} months)</span></div>
              <div className="text-xs text-zinc-500">Frequency <span className="block font-mono text-zinc-900 mt-0.5">{selectedVendor.monthlyFrequency ?? "0"}/month</span></div>
              <div className="text-xs text-zinc-500">Trend <span className="block font-mono text-zinc-900 mt-0.5">{selectedVendor.amountTrend ?? "N/A"}</span></div>
              <div className="text-xs text-zinc-500">Direction <span className="block font-mono text-zinc-900 mt-0.5">{selectedVendor.direction ?? "N/A"}</span></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="text-xs text-zinc-500">Date <span className="block font-mono text-zinc-900 mt-0.5">{"date" in selectedVendor ? selectedVendor.date : "N/A"}</span></div>
              <div className="text-xs text-zinc-500">Amount <span className={`block font-mono mt-0.5 ${"amount" in selectedVendor && selectedVendor.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatCurrency(Math.abs("amount" in selectedVendor ? selectedVendor.amount : 0))}</span></div>
            </div>
          )}

          {/* Occurrence table (for recurring vendors) */}
          {"occurrences" in selectedVendor && selectedVendor.occurrences && selectedVendor.occurrences.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-2">All occurrences</h4>
              <div className="max-h-64 overflow-y-auto border border-zinc-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3 text-zinc-400 font-medium">Date</th>
                      <th className="text-left py-2 px-3 text-zinc-400 font-medium">Description</th>
                      <th className="text-right py-2 px-3 text-zinc-400 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedVendor.occurrences.map((occ, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="py-1.5 px-3 font-mono text-zinc-500">{occ.date}</td>
                        <td className="py-1.5 px-3 text-zinc-700 max-w-[200px] truncate">{occ.description}</td>
                        <td className={`py-1.5 px-3 font-mono text-right ${occ.amount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {occ.amount >= 0 ? "+" : "-"}{formatCurrency(Math.abs(occ.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
