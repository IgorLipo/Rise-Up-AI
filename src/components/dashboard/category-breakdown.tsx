"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface CategoryTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
  transactions: CategoryTransaction[];
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

interface Props {
  categories: CategorySummary[];
}

export function CategoryBreakdown({ categories }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  if (categories.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">
          Spending by category
        </h2>
        <span className="text-xs text-zinc-400">{categories.length} categories</span>
      </div>
      <div className="space-y-1.5">
        {categories.map((cat) => {
          const isExpanded = expandedCategory === cat.category;
          return (
            <div key={cat.category}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left"
              >
                <span className="w-32 text-xs text-zinc-600 truncate">
                  {categoryLabel(cat.category)}
                </span>
                <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-800 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(cat.percentage, 1)}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-zinc-600 w-20 text-right">
                  {formatCurrency(cat.total)}
                </span>
                <span className="font-mono text-xs text-zinc-400 w-10 text-right">
                  {cat.percentage.toFixed(0)}%
                </span>
                <svg
                  className={`w-3 h-3 text-zinc-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && cat.transactions.length > 0 && (
                <div className="ml-4 mr-2 mb-2 bg-zinc-50 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="text-left py-2 px-3 text-zinc-400 font-medium">Date</th>
                        <th className="text-left py-2 px-3 text-zinc-400 font-medium">Description</th>
                        <th className="text-right py-2 px-3 text-zinc-400 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-zinc-100 last:border-0">
                          <td className="py-1.5 px-3 font-mono text-zinc-500">{tx.date}</td>
                          <td className="py-1.5 px-3 text-zinc-700 max-w-[200px] truncate">{tx.description}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-red-500">
                            -{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cat.count > 20 && (
                    <div className="p-2 text-center text-xs text-zinc-400">
                      +{cat.count - 20} more transactions
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
