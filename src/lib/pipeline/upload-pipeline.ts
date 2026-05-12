import { learnFromHistory } from "@/lib/learning/cross-month-learner";
import { detectAllAsync } from "@/lib/detection";
import { detectAllSuspicious } from "@/lib/detection/suspicious-detector";
import { ensureCompleteVendorIntel } from "@/lib/vendor-intel";
import { validateStatementBalance } from "@/lib/financial/math";
import type { Transaction, StatementData } from "@/types";

export interface UploadSummary {
  importedPeriod: { from: string; to: string } | null;
  latestBalance: number | null;
  transactionCount: number;
  newVendors: string[];
  updatedPatterns: number;
  potentialPersonalExpenses: number;
  forecastUpdated: boolean;
}

export async function runUploadPipeline(
  statementData: StatementData,
  allTransactions: Transaction[],
  companyId: string
): Promise<UploadSummary> {
  const transactions = statementData.transactions;
  const accountInfo = statementData.accountInfo;

  // 1. Validate balances
  let balanceValid = false;
  if (accountInfo?.closingBalance != null) {
    const opening = accountInfo.openingBalance ?? 0;
    const credits = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const debits = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const validation = validateStatementBalance(opening, credits, debits, accountInfo.closingBalance);
    balanceValid = validation.valid;
  }

  // 2. Learn from all transactions (including new ones)
  const combinedTransactions = [...allTransactions, ...transactions];
  const learningReport = learnFromHistory(combinedTransactions);

  // 3. Ensure ALL vendors from ALL statements have complete vendor_intel entries
  // (researches unknown vendors via DeepSeek, updates existing, persists)
  await ensureCompleteVendorIntel(learningReport, companyId);

  // 4. Detect patterns
  const knownVendors = new Map<string, any>();
  for (const vendor of learningReport.vendors.values()) {
    knownVendors.set(vendor.canonicalName, {
      subcategory: vendor.subcategory,
      confidence: vendor.isRecurring ? 0.8 : 0.5,
      reasoning: `Learned from ${vendor.appearanceCount} appearances`,
    });
  }
  const { patterns, newVendors } = await detectAllAsync(combinedTransactions, knownVendors);

  // 5. Detect suspicious (with known business vendors gate)
  const knownBusinessVendors = new Set<string>();
  for (const vendor of learningReport.recurringCandidates) {
    const bizCategories = ["rent", "property-management", "property-income", "taxes", "supplier-payments", "utilities", "software"];
    if (bizCategories.includes(vendor.subcategory)) {
      knownBusinessVendors.add(vendor.canonicalName.toLowerCase());
    }
  }
  const suspicious = detectAllSuspicious(combinedTransactions, knownBusinessVendors);

  return {
    importedPeriod: accountInfo?.statementPeriod
      ? { from: accountInfo.statementPeriod.from, to: accountInfo.statementPeriod.to }
      : null,
    latestBalance: accountInfo?.closingBalance ?? null,
    transactionCount: transactions.length,
    newVendors: newVendors.map(v => v.merchantNormalized),
    updatedPatterns: patterns.recurringExpenses.length + patterns.recurringIncome.length,
    potentialPersonalExpenses: suspicious.length,
    forecastUpdated: true,
  };
}
