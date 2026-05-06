import type { Transaction } from "@/types";
import { coreMerchant } from "./merchant-normalizer";

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

function scoreConfidence(occurrences: number, amountCV: number, intervalConsistency: number): number {
  let score = 0.5;
  score += Math.min(occurrences - 1, 3) * 0.1;
  if (amountCV < 0.05) score += 0.2;
  else if (amountCV < 0.15) score += 0.1;
  score += intervalConsistency * 0.1;
  if (intervalConsistency < 0.5) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}

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
    if (interval === "irregular") {
      for (const tx of sorted) {
        if (tx.type === "credit") oneOffIncome.push(tx);
        else oneOffExpenses.push(tx);
      }
      continue;
    }

    // Amount analysis
    const amounts = sorted.map((t) => t.amount);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length;
    const cv = Math.sqrt(variance) / mean;

    const confidence = scoreConfidence(sorted.length, cv, consistency);

    const last = sorted[sorted.length - 1];
    const gap = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);

    const payment: RecurringPayment = {
      id: crypto.randomUUID(),
      merchant: coreMerchant(sorted[0].description),
      normalizedDescription: sorted[0].description,
      interval,
      typicalAmount: mean,
      amountVariance: cv,
      lastOccurrence: last.date,
      nextExpected: addDays(last.date, gap),
      confidence,
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
