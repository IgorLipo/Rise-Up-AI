import type { Transaction } from "@/types";
import { detectPatterns, type DetectedPatterns } from "./pattern-detector";
import { classifySubcategory } from "./subcategory-classifier";
import { detectIncomeCycles } from "./income-cycle-detector";
import { classifyWithAI, type AIClassification, type NewVendorEntry } from "./ai-classifier";

export interface EnrichedDetectedPatterns extends DetectedPatterns {
  incomeCycles: ReturnType<typeof detectIncomeCycles>;
}

export async function detectAllAsync(
  transactions: Transaction[],
  knownVendors?: Map<string, AIClassification>
): Promise<{ patterns: EnrichedDetectedPatterns; newVendors: NewVendorEntry[] }> {
  const patterns = detectPatterns(transactions);

  // Collect unique merchants for AI classification
  const merchants = new Set<string>();
  for (const payment of patterns.recurringExpenses) {
    merchants.add(payment.normalizedDescription);
  }
  for (const payment of patterns.recurringIncome) {
    merchants.add(payment.normalizedDescription);
  }

  // AI-powered classification (falls back to keyword), with vendor DB lookup
  const { classifications: aiResults, newVendors } = await classifyWithAI([...merchants], knownVendors);

  // Enrich with subcategories from AI
  for (const payment of patterns.recurringExpenses) {
    const ai = aiResults.get(payment.normalizedDescription);
    // @ts-expect-error — extending the type at runtime
    payment.subcategory = ai?.subcategory ?? classifySubcategory(payment.normalizedDescription).subcategory;
    // @ts-expect-error
    payment.aiConfidence = ai?.confidence ?? classifySubcategory(payment.normalizedDescription).confidence;
    // @ts-expect-error
    payment.aiReasoning = ai?.reasoning ?? "";
  }

  for (const payment of patterns.recurringIncome) {
    const ai = aiResults.get(payment.normalizedDescription);
    // @ts-expect-error
    payment.subcategory = ai?.subcategory ?? classifySubcategory(payment.normalizedDescription).subcategory;
    // @ts-expect-error
    payment.aiConfidence = ai?.confidence ?? classifySubcategory(payment.normalizedDescription).confidence;
  }

  const incomeTransactions = transactions.filter((t) => t.type === "credit");
  const incomeCycles = detectIncomeCycles(patterns.recurringIncome, incomeTransactions);

  return { patterns: { ...patterns, incomeCycles }, newVendors };
}

// Synchronous fallback (no AI) — used for client-side instant classification
export function detectAll(transactions: Transaction[]): EnrichedDetectedPatterns {
  const patterns = detectPatterns(transactions);

  for (const payment of patterns.recurringExpenses) {
    const classification = classifySubcategory(payment.normalizedDescription);
    // @ts-expect-error — extending the type at runtime
    payment.subcategory = classification.subcategory;
  }

  const incomeTransactions = transactions.filter((t) => t.type === "credit");
  const incomeCycles = detectIncomeCycles(patterns.recurringIncome, incomeTransactions);

  return { ...patterns, incomeCycles };
}
