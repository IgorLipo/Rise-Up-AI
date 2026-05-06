import type { Transaction } from "@/types";
import { detectPatterns, type DetectedPatterns } from "./pattern-detector";
import { classifySubcategory } from "./subcategory-classifier";
import { detectIncomeCycles } from "./income-cycle-detector";

export interface EnrichedDetectedPatterns extends DetectedPatterns {
  incomeCycles: ReturnType<typeof detectIncomeCycles>;
}

export function detectAll(transactions: Transaction[]): EnrichedDetectedPatterns {
  const patterns = detectPatterns(transactions);

  // Enrich with subcategories
  for (const payment of patterns.recurringExpenses) {
    const classification = classifySubcategory(payment.normalizedDescription);
    // @ts-expect-error — extending the type at runtime for Phase 3
    payment.subcategory = classification.subcategory;
  }

  const incomeTransactions = transactions.filter((t) => t.type === "credit");
  const incomeCycles = detectIncomeCycles(patterns.recurringIncome, incomeTransactions);

  return { ...patterns, incomeCycles };
}
