"use client";

import { useEffect, useState } from "react";
import { useActiveCompany } from "@/lib/auth/client";
import { useRouter, useSearchParams } from "next/navigation";
import type { MonthEndForecast } from "@/lib/forecast";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { DateRangeSelector, type DateRangePreset } from "@/components/dashboard/date-range-selector";
import { TabNavigation } from "@/components/dashboard/tab-navigation";
import { ForecastTab } from "@/components/dashboard/forecast-tab";
import { HistoryTab } from "@/components/dashboard/history-tab";
import { IntelligenceTab } from "@/components/dashboard/intelligence-tab";
import { TransactionsTab } from "@/components/dashboard/transactions-tab";
import { ReviewTab } from "@/components/dashboard/review-tab";
import { RecommendedActions } from "@/components/dashboard/recommended-actions";

interface AggregateResponse {
  hasData: boolean;
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
  }) | null;
  monthly: Array<{
    month: string;
    label: string;
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    transactionCount: number;
    status: "safe" | "watch" | "risk" | "critical";
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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="h-3 bg-zinc-100 rounded w-20 mb-2" />
            <div className="h-7 bg-zinc-100 rounded w-24 mb-1" />
            <div className="h-3 bg-zinc-100 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 h-48" />
        <div className="bg-white border border-zinc-200 rounded-xl p-4 h-48" />
      </div>
      <div className="bg-zinc-100 rounded-xl h-48" />
    </div>
  );
}

export default function DashboardPage() {
  const { companyId } = useActiveCompany();
  const router = useRouter();
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ preset: DateRangePreset; from?: string; to?: string }>({
    preset: "all",
  });

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
        } else if (dateRange.preset !== "all") {
          // If filtering returned no data, keep previous data but show a note
          setData(null);
        }
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

  const TABS = [
    { id: "forecast", label: "Current Forecast" },
    { id: "history", label: "Monthly History" },
    { id: "intelligence", label: "Accumulated Intelligence" },
    { id: "transactions", label: "Transactions" },
    { id: "review", label: "Review Queue" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Cashflow</h1>
          {accumulated.dateRange && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {accumulated.dateRange.from?.slice(0, 10)} — {accumulated.dateRange.to?.slice(0, 10)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
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
          />
          <RecommendedActions
            forecast={data.forecast}
            currentBalance={currentPosition.balance}
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

      {activeTab === "intelligence" && (
        <div className="mt-5">
          <IntelligenceTab
            vendors={data.vendors}
            crossMonthInsights={data.crossMonthInsights}
            patterns={data.patterns}
            entities={data.entities}
            newVendors={data.newVendors}
          />
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="mt-5">
          <TransactionsTab categories={data.categories} />
        </div>
      )}

      {activeTab === "review" && (
        <div className="mt-5">
          <ReviewTab suspicious={data.suspicious} />
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
          />
          <RecommendedActions
            forecast={data.forecast}
            currentBalance={currentPosition.balance}
          />
        </div>
      )}
    </div>
  );
}
