"use client";

import { useMemo } from "react";
import type { Transaction } from "@/types";
import { formatCurrency, deriveMerchant } from "@/lib/utils";

interface CategoryDetail {
  category: string;
  total: number;
  count: number;
  percentage: number;
  transactions: Transaction[];
  averageAmount: number;
  largestTransaction: Transaction | null;
  topMerchants: { name: string; total: number; count: number }[];
  // insights
  summary: string;
  patterns: string[];
  recommendations: string[];
}

interface Props {
  category: { name: string; value: number } | null;
  transactions: Transaction[];
  totalSpend: number;
  onClose: () => void;
}

export function CategoryDetailDrawer({
  category,
  transactions,
  totalSpend,
  onClose,
}: Props) {
  const detail = useMemo<CategoryDetail | null>(() => {
    if (!category) return null;

    const txs = transactions.filter((t) => t.category === category.name);
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const pct = totalSpend > 0 ? (total / totalSpend) * 100 : 0;

    const merchants = new Map<string, { total: number; count: number }>();
    for (const t of txs) {
      const m = t.merchant || deriveMerchant(t.description);
      const entry = merchants.get(m) || { total: 0, count: 0 };
      entry.total += t.amount;
      entry.count++;
      merchants.set(m, entry);
    }
    const topMerchants = Array.from(merchants.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const largest = txs.reduce<T | null>(
      (max, t) => (!max || t.amount > max.amount ? t : max),
      null
    );
    const avg = txs.length ? total / txs.length : 0;

    const { summary, patterns, recommendations } = generateInsights(
      category.name,
      txs,
      total,
      pct,
      topMerchants,
      avg
    );

    return {
      category: category.name,
      total,
      count: txs.length,
      percentage: pct,
      transactions: txs,
      averageAmount: avg,
      largestTransaction: largest,
      topMerchants,
      summary,
      patterns,
      recommendations,
    };
  }, [category, transactions, totalSpend]);

  // Lock body scroll
  if (category && detail) {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
  } else {
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }
    return null;
  }

  const handleClose = () => {
    document.body.style.overflow = "";
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-warm-black/30 backdrop-blur-sm z-40 backdrop-fade-in"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] z-50 animate-drawer-slide-in flex flex-col bg-warm-black border-l border-white/[0.06] shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                Category breakdown
              </span>
              <h2 className="mt-1 font-display text-xl font-bold text-warm-white">
                {detail.category}
              </h2>
              <p className="mt-1 text-sm text-zinc-300">{detail.summary}</p>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 ml-4 w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                Total spent
              </span>
              <p className="mt-0.5 font-mono text-base font-semibold text-warm-white">
                {formatCurrency(detail.total)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                % of spend
              </span>
              <p className="mt-0.5 font-mono text-base font-semibold text-warm-white">
                {detail.percentage.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                Transactions
              </span>
              <p className="mt-0.5 font-mono text-base font-semibold text-warm-white">
                {detail.count}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                Average
              </span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-warm-white">
                {formatCurrency(detail.averageAmount)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                Largest
              </span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-warm-white truncate">
                {detail.largestTransaction
                  ? formatCurrency(detail.largestTransaction.amount)
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 drawer-content space-y-5">
          {/* Top merchants */}
          {detail.topMerchants.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
                Top recipients
              </h3>
              <div className="space-y-1.5">
                {detail.topMerchants.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm text-zinc-200 truncate">{m.name}</p>
                      <p className="text-[10px] text-zinc-500">
                        {m.count} transaction{m.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-warm-white shrink-0">
                      {formatCurrency(m.total)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Patterns */}
          {detail.patterns.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
                Patterns
              </h3>
              <ul className="space-y-2">
                {detail.patterns.map((p, i) => (
                  <li key={i} className="text-sm text-zinc-200 flex gap-2">
                    <span className="text-amber-500 shrink-0 mt-0.5">-</span>
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recommendations */}
          {detail.recommendations.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
                Recommendations
              </h3>
              <ul className="space-y-2">
                {detail.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-zinc-200 flex gap-2">
                    <span className="text-sage-400 shrink-0 mt-0.5">+</span>
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Transaction list */}
          <section>
            <h3 className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
              Transactions ({detail.count})
            </h3>
            <div className="space-y-1">
              {detail.transactions
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 50)
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-xs text-zinc-200 truncate">
                        {tx.description}
                      </p>
                      <p className="text-[10px] text-zinc-500">{tx.date}</p>
                    </div>
                    <span className="font-mono text-xs text-red-400 shrink-0">
                      -{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              {detail.count > 50 && (
                <p className="text-xs text-zinc-500 text-center pt-2">
                  + {detail.count - 50} more transactions
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// ── Per-category insight generation ──

type T = Transaction;

function generateInsights(
  category: string,
  txs: T[],
  total: number,
  pct: number,
  merchants: { name: string; total: number; count: number }[],
  avg: number
): { summary: string; patterns: string[]; recommendations: string[] } {
  const patterns: string[] = [];
  const recommendations: string[] = [];
  let summary = "";

  switch (category) {
    case "Rent & Housing": {
      const uniqueMerchants = merchants.length;
      const monthly = groupMonthly(txs);
      const avgMonthly = monthly.reduce((s, m) => s + m.total, 0) / (monthly.length || 1);
      summary = `${txs.length} payments across ${uniqueMerchants} merchant${uniqueMerchants !== 1 ? "s" : ""}. Average monthly outlay: ${formatCurrency(avgMonthly)}.`;
      if (uniqueMerchants > 2) {
        patterns.push(
          `Payments spread across ${uniqueMerchants} different recipients — this may indicate multiple properties or landlords.`
        );
      }
      patterns.push(
        `Housing represents ${pct.toFixed(1)}% of total spending. Financial advisors recommend keeping housing below 30% of income.`
      );
      if (monthly.length > 0) {
        const max = Math.max(...monthly.map((m) => m.total));
        const min = Math.min(...monthly.map((m) => m.total));
        if (max > min * 1.3) {
          patterns.push(
            `Monthly housing costs vary significantly — from ${formatCurrency(min)} to ${formatCurrency(max)}.`
          );
        }
      }
      recommendations.push(
        "If managing multiple properties, verify each payment has a corresponding rental income stream."
      );
      recommendations.push(
        "Review whether any housing costs can be consolidated or renegotiated."
      );
      break;
    }

    case "Utilities": {
      const providers = new Set(merchants.map((m) => m.name));
      const frequent = txs.filter((t) => {
        const desc = t.description.toUpperCase();
        return desc.includes("OVO") || desc.includes("OCTOPUS") || desc.includes("E.ON") || desc.includes("SCOTTISHPOWER");
      });
      summary = `${txs.length} payments to ${providers.size} provider${providers.size !== 1 ? "s" : ""}. Average bill: ${formatCurrency(avg)}.`;
      if (providers.size > 3) {
        patterns.push(
          `${providers.size} different energy providers detected — multiple active accounts may indicate duplicate billing or overlapping contracts.`
        );
      }
      if (frequent.length > 4) {
        patterns.push(
          `${frequent.length} energy payments found. Consolidating to a single provider could reduce standing charges.`
        );
      }
      const sameDay = findSameDayClusters(txs);
      if (sameDay.length > 1) {
        patterns.push(
          `${sameDay.length} payments on the same day (${sameDay.map((t) => t.description.split(" ").slice(0, 2).join(" ")).join(", ")}) — check for duplicate charges.`
        );
      }
      recommendations.push(
        "Audit all active utility accounts and close any unused ones to eliminate standing charges."
      );
      recommendations.push(
        "Consider switching to a single energy provider and negotiating a fixed-rate tariff."
      );
      break;
    }

    case "Groceries": {
      const stores = merchants.map((m) => m.name);
      const tripsPerWeek = txs.length / Math.max(1, weeksBetween(txs));
      summary = `${txs.length} grocery trips across ${stores.length} store${stores.length !== 1 ? "s" : ""}. Average spend per trip: ${formatCurrency(avg)}.`;
      if (tripsPerWeek > 4) {
        patterns.push(`~${tripsPerWeek.toFixed(1)} trips per week — frequent small trips can add up. Consider fewer, planned shops.`);
      }
      patterns.push(
        `Top store: ${merchants[0]?.name || "N/A"} (${formatCurrency(merchants[0]?.total || 0)}, ${merchants[0]?.count || 0} visits).`
      );
      recommendations.push(
        "Plan weekly meals and shop with a list to reduce impulse purchases."
      );
      recommendations.push(
        "Compare prices across stores — loyalty cards and bulk buying can reduce costs."
      );
      break;
    }

    case "Eating Out": {
      const restaurants = merchants.map((m) => m.name);
      const avgMeal = avg;
      summary = `${txs.length} meals out across ${restaurants.length} place${restaurants.length !== 1 ? "s" : ""}. Average meal: ${formatCurrency(avgMeal)}.`;
      if (txs.length > 8) {
        patterns.push(
          `${txs.length} meals out — that's roughly ${(txs.length / Math.max(1, weeksBetween(txs))).toFixed(1)} per week.`
        );
      }
      if (merchants[0] && merchants[0].count > 3) {
        patterns.push(
          `Most frequented: ${merchants[0].name} (${merchants[0].count} visits, ${formatCurrency(merchants[0].total)}).`
        );
      }
      recommendations.push(
        "Set a monthly eating-out budget and track it weekly to avoid overspend."
      );
      recommendations.push(
        "Consider meal prepping or packing lunch to reduce workday food costs."
      );
      break;
    }

    case "Shopping": {
      const storeCount = merchants.length;
      const largest = txs.reduce((max, t) => (t.amount > max.amount ? t : max), txs[0]);
      summary = `${txs.length} purchases across ${storeCount} store${storeCount !== 1 ? "s" : ""}. Average: ${formatCurrency(avg)}.`;
      if (largest) {
        patterns.push(
          `Largest purchase: ${formatCurrency(largest.amount)} — ${largest.description.slice(0, 40)}.`
        );
      }
      if (merchants[0] && merchants[0].count > 3) {
        patterns.push(`Most frequented store: ${merchants[0].name} (${merchants[0].count} visits).`);
      }
      recommendations.push(
        "Review large one-off purchases — can any be delayed, discounted, or avoided?"
      );
      break;
    }

    case "Software & SaaS": {
      const subs = merchants;
      const recurring = txs.filter((t) => {
        const desc = t.description.toUpperCase();
        return desc.includes("SUB") || desc.includes("MONTHLY") || desc.includes("ANNUAL");
      });
      summary = `${txs.length} payments across ${subs.length} service${subs.length !== 1 ? "s" : ""}. Total: ${formatCurrency(total)}.`;
      if (subs.length > 5) {
        patterns.push(
          `${subs.length} different software/services — you may have unused or overlapping subscriptions.`
        );
      }
      if (recurring.length > 0) {
        patterns.push(
          `${recurring.length} recurring subscription payments detected. Annual billing can save 15-20% vs monthly.`
        );
      }
      patterns.push(
        `Monthly software spend averages ${formatCurrency(total / Math.max(1, monthsBetween(txs)))}.`
      );
      recommendations.push(
        "Audit all subscriptions — cancel any unused services immediately."
      );
      recommendations.push(
        "Switch recurring subscriptions from monthly to annual billing where cash flow allows."
      );
      break;
    }

    case "Insurance": {
      const policies = merchants;
      summary = `${txs.length} insurance payments across ${policies.length} polic${policies.length !== 1 ? "ies" : "y"}. Total: ${formatCurrency(total)}.`;
      if (policies.length > 0) {
        patterns.push(
          `Insurance policies: ${policies.map((m) => m.name).join(", ")}.`
        );
      }
      recommendations.push(
        "Compare quotes annually — loyalty doesn't always pay with insurance."
      );
      recommendations.push(
        "Consider bundling policies with one provider for multi-policy discounts."
      );
      break;
    }

    case "Income": {
      const sources = merchants;
      const creditTxs = txs.filter((t) => t.type === "credit");
      summary = `${creditTxs.length} deposits from ${sources.length} source${sources.length !== 1 ? "s" : ""}. Total: ${formatCurrency(total)}.`;
      if (sources.length > 0) {
        patterns.push(
          `Income from: ${sources.map((m) => m.name).join(", ")}.`
        );
      }
      const monthly = groupMonthly(creditTxs);
      if (monthly.length > 1) {
        const amounts = monthly.map((m) => m.total);
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        if (max > min * 1.5) {
          patterns.push(
            `Income is highly variable — monthly deposits range from ${formatCurrency(min)} to ${formatCurrency(max)}.`
          );
        }
      }
      if (avg > 0) {
        patterns.push(`Average deposit: ${formatCurrency(avg)}.`);
      }
      recommendations.push(
        "If income is irregular, build a cash buffer of 3-6 months of expenses."
      );
      recommendations.push(
        "Diversify income sources to reduce reliance on any single stream."
      );
      break;
    }

    default: {
      // "Other" or uncategorized
      summary = `${txs.length} uncategorized transactions — ${pct.toFixed(1)}% of total spending. These need review.`;
      if (txs.length > 10) {
        patterns.push(
          `${txs.length} transactions are uncategorized — this is ${pct.toFixed(1)}% of spending that's invisible to your budget.`
        );
      }
      const byMerchant = merchants.slice(0, 5);
      if (byMerchant.length > 0) {
        patterns.push(
          `Top uncategorized payees: ${byMerchant.map((m) => m.name).join(", ")}.`
        );
      }
      if (pct > 30) {
        patterns.push(
          `Over 30% of spending is uncategorized — this is a significant blind spot in your finances.`
        );
      }
      recommendations.push(
        "Categorize these transactions to get an accurate picture of your spending."
      );
      recommendations.push(
        "Look for recurring payments in this category — they may hide subscriptions or bills."
      );
      if (merchants.length > 5) {
        recommendations.push(
          `Review the ${merchants.length} different recipients — many could be one-off purchases that don't need recurring review.`
        );
      }
      break;
    }
  }

  // Generic patterns that apply to any category
  if (txs.length === 0) {
    summary = "No transactions in this category.";
  }

  return { summary, patterns, recommendations };
}

// ── Helpers ──

function groupMonthly(txs: T[]): { month: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    const month = t.date.slice(0, 7);
    map.set(month, (map.get(month) || 0) + t.amount);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

function weeksBetween(txs: T[]): number {
  if (txs.length < 2) return 1;
  const dates = txs.map((t) => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
  const ms = dates[dates.length - 1].getTime() - dates[0].getTime();
  return Math.max(1, ms / (7 * 24 * 60 * 60 * 1000));
}

function monthsBetween(txs: T[]): number {
  if (txs.length < 2) return 1;
  const dates = txs.map((t) => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
  const months =
    (dates[dates.length - 1].getFullYear() - dates[0].getFullYear()) * 12 +
    (dates[dates.length - 1].getMonth() - dates[0].getMonth());
  return Math.max(1, months + 1);
}

function findSameDayClusters(txs: T[]): T[] {
  const byDate = new Map<string, T[]>();
  for (const t of txs) {
    const existing = byDate.get(t.date) || [];
    existing.push(t);
    byDate.set(t.date, existing);
  }
  for (const [, group] of byDate) {
    if (group.length > 1) return group;
  }
  return [];
}
