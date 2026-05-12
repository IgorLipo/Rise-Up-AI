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
  "one-off": "Uncategorized",
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

export function TransactionsTab({ categories }: TransactionsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewAll, setViewAll] = useState(false);

  const allTransactions = useMemo(() => {
    const all = categories.flatMap((cat) =>
      cat.transactions.map((tx) => ({
        ...tx,
        primaryCategory: cat.category,
      }))
    );
    // Deduplicate by id
    const seen = new Set<string>();
    const unique = all.filter((tx) => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
    // Apply filters
    let filtered = unique;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.description.toLowerCase().includes(q) ||
          categoryLabel(tx.primaryCategory).toLowerCase().includes(q) ||
          tx.primaryCategory.toLowerCase().includes(q) ||
          formatCurrency(tx.amount).includes(q)
      );
    }
    if (activeCategory) {
      filtered = filtered.filter((tx) => tx.primaryCategory === activeCategory);
    }
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return filtered;
  }, [categories, searchQuery, activeCategory]);

  const displayedTransactions = viewAll
    ? allTransactions
    : allTransactions.slice(0, 20);

  const totalTransactions = allTransactions.length;

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search by description, merchant, category, or amount..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 select-text"
        />
      </div>

      {/* Category filter badge */}
      {activeCategory && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-zinc-500">Filtered by:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-white">
            {categoryLabel(activeCategory)}
            <button
              onClick={() => setActiveCategory(null)}
              className="ml-1.5 hover:text-zinc-300"
            >
              &times;
            </button>
          </span>
        </div>
      )}

      {/* Category breakdown with clickable categories */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-5">
        <CategoryBreakdown
          categories={categories}
          onCategoryClick={(cat) => setActiveCategory(cat)}
          activeCategory={activeCategory}
        />
      </div>

      {/* Transaction list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
            {searchQuery || activeCategory ? "Filtered transactions" : "All transactions"}
          </h2>
          <span className="text-xs text-zinc-400">{totalTransactions} total</span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          {displayedTransactions.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {displayedTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-0 select-text"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono text-zinc-400 w-24 flex-shrink-0">
                      {formatDate(tx.date)}
                    </span>
                    <span className="text-xs text-zinc-700 truncate max-w-[200px]">
                      {tx.description}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 flex-shrink-0">
                      {categoryLabel(tx.primaryCategory)}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-mono ml-3 flex-shrink-0 tabular-nums ${
                      tx.type === "credit" ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {tx.type === "credit" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center py-6">
              {searchQuery || activeCategory
                ? "No transactions match your search."
                : "No transactions yet."}
            </p>
          )}
        </div>

        {/* View all toggle */}
        {allTransactions.length > 20 && (
          <button
            onClick={() => setViewAll(!viewAll)}
            className="w-full mt-2 py-2 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            {viewAll
              ? "Show less"
              : `View all ${allTransactions.length} transactions`}
          </button>
        )}
      </div>
    </div>
  );
}
