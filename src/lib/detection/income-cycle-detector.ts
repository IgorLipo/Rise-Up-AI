import type { RecurringPayment } from "./pattern-detector";
import type { Transaction } from "@/types";

interface IncomeCycle {
  source: string;
  cycle: "monthly-salary" | "28-day" | "weekly" | "irregular";
  typicalAmount: number;
  typicalDayOfMonth: number | null;
  lastDate: string;
  nextExpected: string;
  confidence: number;
  occurrences: { date: string; amount: number }[];
}

export function detectIncomeCycles(
  recurringIncome: RecurringPayment[],
  incomeTransactions: Transaction[]
): IncomeCycle[] {
  const cycles: IncomeCycle[] = [];

  for (const income of recurringIncome) {
    const days = income.occurrences.map((o) => new Date(o.date).getDate());
    const dayAvg = days.reduce((s, d) => s + d, 0) / days.length;

    let cycle: IncomeCycle["cycle"] = "irregular";
    if (income.interval === "monthly") cycle = "monthly-salary";
    else if (income.interval === "28-day") cycle = "28-day";
    else if (income.interval === "weekly") cycle = "weekly";

    cycles.push({
      source: income.merchant,
      cycle,
      typicalAmount: income.typicalAmount,
      typicalDayOfMonth: cycle === "monthly-salary" ? Math.round(dayAvg) : null,
      lastDate: income.lastOccurrence,
      nextExpected: income.nextExpected,
      confidence: income.confidence,
      occurrences: income.occurrences,
    });
  }

  return cycles;
}
