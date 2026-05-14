import type { Transaction } from "@/types";
import { coreMerchant } from "./merchant-normalizer";

export type ConfidenceTier = "high" | "medium" | "low";

export interface RecurringPayment {
  id: string;
  merchant: string;
  normalizedDescription: string;
  interval: "weekly" | "bi-weekly" | "28-day" | "monthly" | "quarterly" | "annual" | "irregular";
  typicalAmount: number;
  amountVariance: number;
  lastOccurrence: string;
  nextExpected: string;
  confidence: number;
  confidenceTier: ConfidenceTier;
  occurrences: { date: string; amount: number }[];
}

export interface DetectedPatterns {
  recurringExpenses: RecurringPayment[];
  recurringIncome: RecurringPayment[];
  oneOffExpenses: Transaction[];
  oneOffIncome: Transaction[];
}

const DAY_MS = 86400000;

function daysBetween(d1: string, d2: string): number {
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / DAY_MS);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function classifyInterval(gaps: number[]): { interval: RecurringPayment["interval"]; consistency: number } {
  if (gaps.length === 0) return { interval: "irregular", consistency: 0 };

  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const maxDev = Math.max(...gaps.map((g) => Math.abs(g - avg)));
  const consistency = avg > 0 ? 1 - maxDev / avg : 0;

  if (avg >= 6 && avg <= 8) return { interval: "weekly", consistency };
  if (avg >= 13 && avg <= 15) return { interval: "bi-weekly", consistency };
  if (avg >= 27 && avg <= 29) return { interval: "28-day", consistency };
  if (avg >= 28 && avg <= 31) return { interval: "monthly", consistency };
  if (avg >= 85 && avg <= 95) return { interval: "quarterly", consistency };
  if (avg >= 350 && avg <= 380) return { interval: "annual", consistency };
  return { interval: "irregular", consistency: 0 };
}

function computeDayOfMonthVariance(occurrences: { date: string; amount: number }[]): number {
  if (occurrences.length < 2) return 999;
  const days = occurrences.map(o => new Date(o.date).getDate());
  const mean = days.reduce((s, d) => s + d, 0) / days.length;
  const variance = days.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / days.length;
  return Math.sqrt(variance); // standard deviation in days
}

function countUniqueMonths(occurrences: { date: string; amount: number }[]): number {
  return new Set(occurrences.map(o => o.date.slice(0, 7))).size;
}

function scoreConfidence(
  occurrences: number,
  amountCV: number,
  intervalConsistency: number,
  uniqueMonths: number,
  dayOfMonthStdDev: number
): number {
  // 5-factor weighted confidence
  const occurrenceScore = Math.min(1, (occurrences - 1) / 3); // 0→1 at 4 occurrences
  const monthSpreadScore = Math.min(1, (uniqueMonths - 1) / 3); // 0→1 at 4 months
  const amountStabilityScore = amountCV < 0.05 ? 1 : amountCV < 0.15 ? 0.7 : amountCV < 0.3 ? 0.4 : 0.1;
  const intervalScore = Math.max(0, Math.min(1, intervalConsistency));
  const dayVarianceScore = dayOfMonthStdDev <= 2 ? 1 : dayOfMonthStdDev <= 5 ? 0.7 : dayOfMonthStdDev <= 10 ? 0.4 : 0.1;

  // Weighted sum
  const weights = { occurrence: 0.30, monthSpread: 0.25, amountStability: 0.20, interval: 0.15, dayVariance: 0.10 };
  let score = occurrenceScore * weights.occurrence
    + monthSpreadScore * weights.monthSpread
    + amountStabilityScore * weights.amountStability
    + intervalScore * weights.interval
    + dayVarianceScore * weights.dayVariance;

  // Cap at MEDIUM if amount variance is too high
  if (amountCV > 0.3) score = Math.min(score, 0.65);

  return Math.max(0, Math.min(1, score));
}

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 0.70) return "high";
  if (score >= 0.40) return "medium";
  return "low";
}

/**
 * Detects recurring patterns and one-off transactions from the provided transaction set.
 *
 * IMPORTANT: One-off classification here is PROVISIONAL — it is based only on the
 * transactions passed to this function. A merchant appearing once in this call's data
 * will be marked as one-off here. The cross-month learner (learnFromHistory) is the
 * AUTHORITATIVE source: it classifies a vendor as one-off only if appearanceCount &lt; 2
 * across ALL statements ever uploaded. For forecast/display purposes, rely on the
 * cross-month learner's oneOffCandidates, not the pattern detector's oneOffExpenses/oneOffIncome.
 */
export function detectPatterns(transactions: Transaction[]): DetectedPatterns {
  // Group by core merchant
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = coreMerchant(tx.description).toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const recurringExpenses: RecurringPayment[] = [];
  const recurringIncome: RecurringPayment[] = [];
  const oneOffExpenses: Transaction[] = [];
  const oneOffIncome: Transaction[] = [];

  for (const [_, group] of groups) {
    if (group.length < 2) {
      const tx = group[0];
      if (tx.type === "credit") oneOffIncome.push(tx);
      else oneOffExpenses.push(tx);
      continue;
    }

    // Sort by date
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }

    const { interval, consistency } = classifyInterval(gaps);

    // Amount analysis (needed early for irregular path as well)
    const amounts = sorted.map((t) => t.amount);

    if (interval === "irregular") {
      // Irregular BUT has 2+ occurrences → still NOT one-off.
      // Create a RecurringPayment with "irregular" interval and low confidence.
      const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const last = sorted[sorted.length - 1];

      const payment: RecurringPayment = {
        id: crypto.randomUUID(),
        merchant: coreMerchant(sorted[0].description),
        normalizedDescription: sorted[0].description,
        interval: "irregular",
        typicalAmount: mean,
        amountVariance: 0,
        lastOccurrence: last.date,
        nextExpected: last.date, // can't predict irregular
        confidence: 0.1,
        confidenceTier: "low",
        occurrences: sorted.map((t) => ({ date: t.date, amount: t.amount })),
      };

      if (sorted[0].type === "credit") {
        recurringIncome.push(payment);
      } else {
        recurringExpenses.push(payment);
      }
      continue;
    }
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
    const cv = Math.sqrt(variance) / mean;

    const uniqueMonths = countUniqueMonths(sorted.map(t => ({ date: t.date, amount: t.amount })));
    const dayStdDev = computeDayOfMonthVariance(sorted.map(t => ({ date: t.date, amount: t.amount })));
    const confidence = scoreConfidence(sorted.length, cv, consistency, uniqueMonths, dayStdDev);
    const tier = getConfidenceTier(confidence);

    const last = sorted[sorted.length - 1];
    const gap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);

    // Project nextExpected forward to be at or after today
    const today = new Date().toISOString().split("T")[0];
    let nextExpected = addDays(last.date, gap);
    while (nextExpected < today) {
      nextExpected = addDays(nextExpected, gap);
    }

    const payment: RecurringPayment = {
      id: crypto.randomUUID(),
      merchant: coreMerchant(sorted[0].description),
      normalizedDescription: sorted[0].description,
      interval,
      typicalAmount: mean,
      amountVariance: cv,
      lastOccurrence: last.date,
      nextExpected,
      confidence,
      confidenceTier: tier,
      occurrences: sorted.map((t) => ({ date: t.date, amount: t.amount })),
    };

    if (sorted[0].type === "credit") {
      recurringIncome.push(payment);
    } else {
      recurringExpenses.push(payment);
    }
  }

  return { recurringExpenses, recurringIncome, oneOffExpenses, oneOffIncome };
}
