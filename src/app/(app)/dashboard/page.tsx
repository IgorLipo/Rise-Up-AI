"use client";

import { Suspense, useEffect, useState } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import { useRouter, useSearchParams } from "next/navigation";
import type { MonthEndForecast } from "@/lib/forecast";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { DateRangeSelector, type DateRangePreset } from "@/components/dashboard/date-range-selector";
import { TabNavigation } from "@/components/dashboard/tab-navigation";
import { ForecastTab } from "@/components/dashboard/forecast-tab";
import { HistoryTab } from "@/components/dashboard/history-tab";

interface AggregateResponse {
  hasData: boolean;
  _cached?: boolean;
  _lastCalculatedAt?: string;
  totalDocuments: number;
  totalTransactions: number;
  currentPosition: {
    balance: number | null;
    date: string | null;
    source: "statement" | "catchUp" | "unavailable";
    isEstimated: boolean;
    isStale: boolean;
    statementPeriodEnd: string | null;
  };
  statementInfo: {
    openingBalance: number | null;
    totalIncome: number | null;
    totalExpenses: number | null;
    closingBalance: number | null;
    periodFrom: string | null;
    periodTo: string | null;
    bankName: string | null;
  } | null;
  balanceValidation: {
    valid: boolean;
    differencePence: number;
    message: string;
  } | null;
  accumulated: {
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    statementCount: number;
    totalTransactions: number;
    dateRange: { from: string; to: string } | null;
  };
  forecast: (MonthEndForecast & {
    forecastMode?: { isLowConfidence: boolean; reason: string | null };
    monthlyOneOffExpenseAvg?: number;
    monthlyOneOffIncomeAvg?: number;
    oneOffHistoryMonths?: number;
  }) | null;
  forecastError?: string | null;
  historicalForecast: {
    predictedMonthEnd: number;
    expectedIncome: number;
    expectedExpenses: number;
    expectedNetFlow: number;
    daysRemaining: number;
    daysInMonth: number;
    monthsUsed: number;
    avgMonthlyIncome: number;
    avgMonthlyExpenses: number;
    avgMonthlyNet: number;
    confidence: number;
    method: string;
    asOfDate: string;
    monthEndDate: string;
  } | null;
  monthly: Array<{
    month: string;
    label: string;
    openingBalance: number;
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    status: "safe" | "watch" | "risk" | "critical";
    completeness?: "complete" | "partial";
    dataFrom?: string;
    dataTo?: string;
  }>;
  categories: Array<{
    category: string;
    total: number;
    count: number;
    percentage: number;
    transactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      type: string;
    }>;
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
    oneOffExpenses: number;
    oneOffIncome: number;
  };
  newVendors: Array<{
    merchantRaw: string;
    merchantNormalized: string;
    subcategory: string;
    confidence: number;
    reasoning: string;
  }>;
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
      occurrences?: Array<{ date: string; amount: number; description: string }>;
      monthlyFrequency?: string;
      amountTrend?: string;
      isFirstSeen?: boolean;
      direction?: string;
    }>;
    suspicious: Array<{
      canonicalName: string;
      subcategory: string;
      typicalAmount: number;
      appearanceCount: number;
      reason: string;
    }>;
    oneOff: Array<{
      canonicalName: string;
      date: string;
      amount: number;
      description: string;
      subcategory: string;
    }>;
    oneOffIncome?: Array<{
      canonicalName: string;
      date: string;
      amount: number;
      description: string;
      subcategory: string;
    }>;
    oneOffExpenses?: Array<{
      canonicalName: string;
      date: string;
      amount: number;
      description: string;
      subcategory: string;
    }>;
  };
  crossMonthInsights: Array<{
    vendor: string;
    type: "new_vendor" | "disappeared_vendor" | "amount_change" | "frequency_change" | "became_recurring";
    detail: string;
    previousAmount?: number;
    currentAmount?: number;
  }>;
  suspicious: Array<{
    merchant: string;
    reason: string;
    riskLevel: "low" | "medium" | "high";
    suggestedCategory: string;
    shouldExcludeFromBusiness: boolean;
    date: string;
    amount: number;
    description: string;
  }>;
}

function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 bg-zinc-100 rounded w-28 mb-1" />
          <div className="h-3 bg-zinc-100 rounded w-64" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-zinc-100 rounded-lg w-28" />
          <div className="h-9 bg-zinc-100 rounded-lg w-36" />
        </div>
      </div>
      {/* Tab navigation skeleton */}
      <div className="flex gap-1 border-b border-zinc-200 pb-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-zinc-100 rounded-t-lg w-32" />
        ))}
      </div>
      {/* Top stat cards — 3 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="h-2.5 bg-zinc-100 rounded w-24 mb-2" />
            <div className="h-7 bg-zinc-100 rounded w-28 mb-1" />
            <div className="h-3 bg-zinc-100 rounded w-20" />
          </div>
        ))}
      </div>
      {/* Secondary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-3">
            <div className="h-2.5 bg-zinc-100 rounded w-16 mb-2 mx-auto" />
            <div className="h-6 bg-zinc-100 rounded w-12 mx-auto" />
          </div>
        ))}
      </div>
      {/* Content area */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 h-64" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { companyId } = useActiveCompany();
  const router = useRouter();
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ preset: DateRangePreset; from?: string; to?: string }>({
    preset: "all",
  });
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    const qs = params.toString();
    const url = `/api/documents/aggregate${qs ? `?${qs}` : ""}`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((json) => {
        if (json.hasData) {
          setData(json);
        }
        // If a date filter returns no data, keep the existing `data` in memory
        // (don't drop to empty state) so the user can simply reset the filter
        // without losing context.
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [companyId, dateRange]);

  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "forecast";

  if (loading) return <DashboardSkeleton />;
  if (error) return <EmptyDashboard />;
  if (!data || !data.hasData) return <EmptyDashboard />;

  const { currentPosition, accumulated } = data;

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  const handleRecalculate = async () => {
    if (!companyId) return;
    setRecalculating(true);
    try {
      // 1. Re-classify every stored transaction with the latest classifier
      //    (writes subcategory back into documents.statement_data).
      // 2. Invalidate aggregate cache.
      // 3. Fetch fresh aggregate.
      await fetch("/api/documents/reclassify", { method: "POST" });
      await fetch(`/api/documents/recalculate?companyId=${companyId}`, { method: "POST" });
      const r = await fetch(`/api/documents/aggregate?recalculate=true`);
      if (r.ok) {
        const json = await r.json();
        if (json.hasData) setData(json);
      }
    } finally {
      setRecalculating(false);
    }
  };

  // Tabs: Forecast + History. Transactions has its own dedicated page at
  // /transactions — having it as a tab here too was a duplicate UI surface.
  const TABS = [
    { id: "forecast", label: "Current Forecast" },
    { id: "history", label: "Monthly History" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Cashflow</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {accumulated.dateRange && (
              <p className="text-xs text-zinc-400">
                {accumulated.dateRange.from?.slice(0, 10)} — {accumulated.dateRange.to?.slice(0, 10)}
              </p>
            )}
            {data._lastCalculatedAt && (
              <p className="text-xs text-zinc-400">
                &middot; Updated {new Date(data._lastCalculatedAt).toLocaleString()}
                {(() => {
                  const ageMs = Date.now() - new Date(data._lastCalculatedAt).getTime();
                  if (ageMs > 60 * 60 * 1000) {
                    const hours = Math.round(ageMs / (60 * 60 * 1000));
                    return (
                      <span className="text-amber-600 ml-0.5">
                        &middot; {hours}h old — data may be stale
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 text-sm font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {recalculating ? "Recalculating…" : "Recalculate"}
          </button>
          <button
            onClick={() => router.push("/upload")}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Upload statement
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab content */}
      {activeTab === "forecast" && (
        <div className="mt-5 space-y-5">
          <ForecastTab
            currentPosition={currentPosition}
            forecast={data.forecast}
            accumulated={accumulated}
            categories={data.categories}
            patterns={data.patterns}
            totalDocuments={data.totalDocuments}
            totalTransactions={data.totalTransactions}
            statementInfo={data.statementInfo}
            balanceValidation={data.balanceValidation}
            historicalForecast={data.historicalForecast}
            monthlyOneOffExpenseAvg={data.forecast?.monthlyOneOffExpenseAvg}
            monthlyOneOffIncomeAvg={data.forecast?.monthlyOneOffIncomeAvg}
            oneOffHistoryMonths={data.forecast?.oneOffHistoryMonths}
          />
        </div>
      )}

      {activeTab === "history" && (
        <div className="mt-5">
          <HistoryTab
            monthly={data.monthly}
            accumulated={accumulated}
            categories={data.categories}
            suspicious={data.suspicious}
            onViewTransactions={(month) => router.push(`/transactions?month=${month}`)}
          />
        </div>
      )}

      {!TABS.some((t) => t.id === activeTab) && (
        <div className="mt-5 space-y-5">
          <ForecastTab
            currentPosition={currentPosition}
            forecast={data.forecast}
            accumulated={accumulated}
            categories={data.categories}
            patterns={data.patterns}
            totalDocuments={data.totalDocuments}
            totalTransactions={data.totalTransactions}
            statementInfo={data.statementInfo}
            balanceValidation={data.balanceValidation}
            historicalForecast={data.historicalForecast}
            monthlyOneOffExpenseAvg={data.forecast?.monthlyOneOffExpenseAvg}
            monthlyOneOffIncomeAvg={data.forecast?.monthlyOneOffIncomeAvg}
            oneOffHistoryMonths={data.forecast?.oneOffHistoryMonths}
          />
        </div>
      )}
    </div>
  );
}
