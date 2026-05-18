"use client";

import { useState, useMemo } from "react";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { formatCurrency } from "@/lib/utils";

interface TransactionsTabProps {
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
  monthly: Array<{
    month: string;
    label: string;
    totalIncome: number;
    totalExpenses: number;
    netFlow: number;
    status: string;
  }>;
  totalTransactions: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  "car-expenses": "Car & Transport",
  "food-dining": "Food & Dining",
  software: "Software/Tools",
  loans: "Loan Repayments",
  salary: "Salaries & Wages",
  taxes: "Taxes",
  rent: "Rent & Property",
  "supplier-payments": "Suppliers & Services",
  utilities: "Utilities",
  "bank-fees": "Bank Fees",
  insurance: "Insurance",
  marketing: "Marketing",
  travel: "Travel",
  "office-supplies": "Office Supplies",
  "professional-services": "Professional Services",
  "property-management": "Rent & Property",
  "director-loans": "Director Loans",
  supplies: "Shopping",
  subscriptions: "Subscriptions",
  "property-income": "Other Income",
  "one-off": "One-off",
  "uncategorized": "Uncategorized",
};

function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TransactionsTab({ categories, monthly, totalTransactions }: TransactionsTabProps) {
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const monthsNewest = useMemo(() => {
    return [...monthly].sort((a, b) => b.month.localeCompare(a.month));
  }, [monthly]);

  const monthCount = monthly.length || 1;

  const computedCategories = useMemo(() => {
    if (monthFilter === null) {
      return categories
        .map((cat) => ({
          category: cat.category,
          total: cat.total / monthCount,
          count: Math.round(cat.count / monthCount),
          percentage: cat.percentage,
          transactions: cat.transactions,
        }))
        .filter((cat) => cat.count > 0);
    }

    return categories
      .map((cat) => {
        const monthTxs = cat.transactions.filter((tx) => tx.date.startsWith(monthFilter));
        const total = monthTxs.reduce((s, tx) => s + tx.amount, 0);
        return {
          category: cat.category,
          total,
          count: monthTxs.length,
          percentage: 0,
          transactions: monthTxs,
        };
      })
      .filter((cat) => cat.count > 0)
      .map((cat, _, arr) => {
        const grandTotal = arr.reduce((s, c) => s + c.total, 0);
        return { ...cat, percentage: grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0 };
      });
  }, [categories, monthFilter, monthCount]);

  const monthTotals = useMemo(() => {
    if (!monthFilter) return null;
    return monthly.find((m) => m.month === monthFilter) ?? null;
  }, [monthly, monthFilter]);

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={monthFilter ?? ""}
          onChange={(e) => {
            setMonthFilter(e.target.value || null);
            setActiveCategory(null);
          }}
          className="text-xs border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-zinc-400 font-medium text-zinc-700"
        >
          <option value="">All months (average)</option>
          {monthsNewest.map((m) => (
            <option key={m.month} value={m.month}>
              {m.label}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-zinc-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Context line */}
      <p className="text-xs text-zinc-400 mb-3">
        {monthFilter === null
          ? `Monthly averages based on ${monthCount} month${monthCount !== 1 ? "s" : ""} · ${totalTransactions.toLocaleString()} transactions total`
          : monthTotals
            ? `${computedCategories.reduce((s, c) => s + c.count, 0)} transactions for ${monthTotals.label}`
            : `${computedCategories.reduce((s, c) => s + c.count, 0)} transactions`}
      </p>

      {/* Month totals when specific month selected */}
      {monthTotals && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Income</div>
            <div className="text-sm font-mono font-medium text-emerald-600 mt-0.5 tabular-nums">
              {formatCurrency(monthTotals.totalIncome)}
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Expenses</div>
            <div className="text-sm font-mono font-medium text-red-500 mt-0.5 tabular-nums">
              {formatCurrency(monthTotals.totalExpenses)}
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Net Flow</div>
            <div className={`text-sm font-mono font-medium mt-0.5 tabular-nums ${
              monthTotals.netFlow >= 0 ? "text-emerald-600" : "text-red-500"
            }`}>
              {monthTotals.netFlow >= 0 ? "+" : ""}{formatCurrency(monthTotals.netFlow)}
            </div>
          </div>
        </div>
      )}

      {/* Active category filter badge */}
      {activeCategory && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-zinc-500">Filtered by:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-white">
            {categoryLabel(activeCategory)}
            <button onClick={() => setActiveCategory(null)} className="ml-1.5 hover:text-zinc-300">
              &times;
            </button>
          </span>
        </div>
      )}

      {/* Category breakdown */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-5">
        <CategoryBreakdown
          categories={computedCategories}
          onCategoryClick={(cat) => setActiveCategory(cat)}
          activeCategory={activeCategory}
        />
      </div>

    </div>
  );
}
