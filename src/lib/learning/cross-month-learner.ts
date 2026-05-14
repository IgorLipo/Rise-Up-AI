// Cross-month learning engine.
// Compares transactions across multiple months to build a rich understanding
// of the company's financial behaviour — vendors, recurrence, anomalies.

import type { Transaction } from "@/types";
import { coreMerchant, normalizeMerchant } from "@/lib/detection/merchant-normalizer";
import { classifySubcategory } from "@/lib/detection/subcategory-classifier";
import type { VendorIntelEntry } from "@/lib/vendor-intel";

interface MonthlyGroup {
  month: string;
  transactions: Transaction[];
}

interface VendorLearning {
  canonicalName: string;
  aliases: string[];
  allDescriptions: string[];
  amounts: number[];
  dates: string[];
  months: string[];
  subcategory: string;
  category: string;
  isRecurring: boolean;
  recurrencePattern: string | null;
  firstSeen: string;
  lastSeen: string;
  appearanceCount: number;
  typicalAmount: number;
  amountRange: { min: number; max: number };
  amountVariance: number;
  direction: "income" | "expense" | "mixed";
  incomeAmounts: number[];
  expenseAmounts: number[];
}

interface CrossMonthInsight {
  vendor: string;
  type: "new_vendor" | "disappeared_vendor" | "amount_change" | "frequency_change" | "became_recurring";
  detail: string;
  previousAmount?: number;
  currentAmount?: number;
  previousMonths?: number;
  currentMonths?: number;
}

export interface LearningReport {
  vendors: Map<string, VendorLearning>;
  recurringCandidates: VendorLearning[];
  oneOffCandidates: string[];
  oneOffIncomeCandidates: string[];
  oneOffExpenseCandidates: string[];
  crossMonthInsights: CrossMonthInsight[];
  suspiciousCandidates: VendorLearning[];
  totalMonths: number;
  totalVendors: number;
  totalTransactions: number;
  monthlyOneOffExpenseAvg: number;
  monthlyOneOffIncomeAvg: number;
}

// Group transactions by calendar month
function groupByMonth(transactions: Transaction[]): MonthlyGroup[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(tx);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, txs]) => ({ month, transactions: txs }));
}

// Normalize and group all transactions by vendor across all time
export function learnFromHistory(
  transactions: Transaction[],
  existingVendors?: Map<string, VendorIntelEntry>
): LearningReport {
  const byMonth = groupByMonth(transactions);
  const vendorMap = new Map<string, VendorLearning>();

  for (const tx of transactions) {
    const normalized = normalizeMerchant(tx.description);
    const core = coreMerchant(normalized).toLowerCase();
    if (!core || core.length < 2) continue;

    if (!vendorMap.has(core)) {
      const classification = classifySubcategory(normalized);
      vendorMap.set(core, {
        canonicalName: core,
        aliases: [tx.description],
        allDescriptions: [tx.description],
        amounts: [tx.amount],
        dates: [tx.date],
        months: [tx.date.slice(0, 7)],
        subcategory: classification.subcategory,
        category: classification.category,
        isRecurring: false,
        recurrencePattern: null,
        firstSeen: tx.date,
        lastSeen: tx.date,
        appearanceCount: 1,
        typicalAmount: tx.amount,
        amountRange: { min: tx.amount, max: tx.amount },
        amountVariance: 0,
        direction: tx.type === "credit" ? "income" : "expense",
        incomeAmounts: tx.type === "credit" ? [tx.amount] : [],
        expenseAmounts: tx.type === "debit" ? [tx.amount] : [],
      });
    } else {
      const v = vendorMap.get(core)!;
      v.allDescriptions.push(tx.description);
      if (!v.aliases.includes(tx.description)) {
        v.aliases.push(tx.description);
      }
      v.amounts.push(tx.amount);
      v.dates.push(tx.date);
      const month = tx.date.slice(0, 7);
      if (!v.months.includes(month)) v.months.push(month);
      v.lastSeen = tx.date > v.lastSeen ? tx.date : v.firstSeen;
      v.firstSeen = tx.date < v.firstSeen ? tx.date : v.firstSeen;
      v.appearanceCount++;

      // Track income/expense amounts separately
      if (tx.type === "credit") {
        v.incomeAmounts.push(tx.amount);
      } else {
        v.expenseAmounts.push(tx.amount);
      }

      // Recalculate amount stats
      const avg = v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length;
      v.typicalAmount = avg;
      v.amountRange.min = Math.min(...v.amounts);
      v.amountRange.max = Math.max(...v.amounts);
      const variance = v.amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / v.amounts.length;
      v.amountVariance = Math.sqrt(variance) / (avg || 1);
    }
  }

  // Finalize direction for all vendors (depends on all transactions)
  for (const vendor of vendorMap.values()) {
    vendor.direction = vendor.incomeAmounts.length > 0 && vendor.expenseAmounts.length > 0 ? "mixed"
      : vendor.incomeAmounts.length > 0 ? "income"
      : "expense";
  }

  // Classify recurrence
  const recurringCandidates: VendorLearning[] = [];
  const oneOffCandidates: string[] = [];
  const oneOffIncomeCandidates: string[] = [];
  const oneOffExpenseCandidates: string[] = [];
  const suspiciousCandidates: VendorLearning[] = [];

  for (const vendor of vendorMap.values()) {
    // Only found once = one-off candidate
    if (vendor.appearanceCount < 2) {
      oneOffCandidates.push(vendor.canonicalName);
      if (vendor.direction === "income") {
        oneOffIncomeCandidates.push(vendor.canonicalName);
      } else if (vendor.direction === "expense") {
        oneOffExpenseCandidates.push(vendor.canonicalName);
      } else {
        oneOffExpenseCandidates.push(vendor.canonicalName);
      }
      continue;
    }

    // Multiple appearances across months → recurring
    const uniqueMonths = new Set(vendor.months).size;
    const uniqueDates = vendor.dates.length;

    if (uniqueMonths >= 2 && uniqueDates >= 2) {
      vendor.isRecurring = true;

      // Detect recurrence interval
      const dates = [...vendor.dates].sort();
      if (dates.length >= 2) {
        const gaps: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          gaps.push(
            Math.round(
              (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
        }
        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

        if (avgGap >= 6 && avgGap <= 8) vendor.recurrencePattern = "weekly";
        else if (avgGap >= 13 && avgGap <= 15) vendor.recurrencePattern = "bi-weekly";
        else if (avgGap >= 27 && avgGap <= 29) vendor.recurrencePattern = "28-day";
        else if (avgGap >= 28 && avgGap <= 31) vendor.recurrencePattern = "monthly";
        else if (avgGap >= 85 && avgGap <= 95) vendor.recurrencePattern = "quarterly";
        else if (avgGap >= 350 && avgGap <= 380) vendor.recurrencePattern = "annual";
        else vendor.recurrencePattern = "irregular";
      }
    }

    // Separate by confidence tier and transaction type
    if (vendor.isRecurring) {
      recurringCandidates.push(vendor);
    } else if (vendor.months.length >= 2 && vendor.appearanceCount >= 3) {
      // Frequent but irregular — still recurring for learning purposes
      vendor.isRecurring = true;
      recurringCandidates.push(vendor);
    }

    // Suspicious: always round amounts, personal-like patterns
    const isRound = vendor.amounts.every((a) => a % 10 === 0 || a % 100 === 0);
    const isSmallPersonal =
      vendor.typicalAmount < 50 &&
      /coffee|costa|starbucks|pret|mcdonald|kfc|burger|pizza|deliveroo|uber.*eat|justeat/i.test(
        vendor.canonicalName
      );
    const isWeekendOnly = vendor.dates
      .map((d) => new Date(d).getDay())
      .every((day) => day === 0 || day === 6);
    const isLuxuryOrPersonal =
      /hotel|spa|airbnb|booking\.com|flight|trainline|theatre|cinema|netflix|spotify|amazon\s*prime|sky\s*sports/i.test(
        vendor.canonicalName
      );

    if (isSmallPersonal || isWeekendOnly || isLuxuryOrPersonal) {
      suspiciousCandidates.push(vendor);
    }
  }

  // Monthly one-off averages (display-only — not injected into forecast)
  let totalOneOffExpense = 0;
  let totalOneOffIncome = 0;
  for (const name of oneOffExpenseCandidates) {
    const vendor = vendorMap.get(name);
    if (vendor) totalOneOffExpense += vendor.amounts.reduce((s, a) => s + a, 0);
  }
  for (const name of oneOffIncomeCandidates) {
    const vendor = vendorMap.get(name);
    if (vendor) totalOneOffIncome += vendor.amounts.reduce((s, a) => s + a, 0);
  }
  const monthlyOneOffExpenseAvg = byMonth.length > 0 ? totalOneOffExpense / byMonth.length : 0;
  const monthlyOneOffIncomeAvg = byMonth.length > 0 ? totalOneOffIncome / byMonth.length : 0;

  // Cross-month insights
  const crossMonthInsights: CrossMonthInsight[] = [];
  if (byMonth.length >= 2) {
    const prevMonthVendors = new Set(
      byMonth[byMonth.length - 2].transactions.map((t) =>
        coreMerchant(normalizeMerchant(t.description)).toLowerCase()
      )
    );
    const currMonthVendors = new Set(
      byMonth[byMonth.length - 1].transactions.map((t) =>
        coreMerchant(normalizeMerchant(t.description)).toLowerCase()
      )
    );

    // New vendors this month
    for (const v of currMonthVendors) {
      if (!prevMonthVendors.has(v)) {
        crossMonthInsights.push({
          vendor: v,
          type: "new_vendor",
          detail: `First seen in ${byMonth[byMonth.length - 1].month}`,
        });
      }
    }

    // Disappeared vendors
    for (const v of prevMonthVendors) {
      if (!currMonthVendors.has(v)) {
        crossMonthInsights.push({
          vendor: v,
          type: "disappeared_vendor",
          detail: `Not seen since ${byMonth[byMonth.length - 2].month}`,
        });
      }
    }

    // Amount changes between months
    for (const v of vendorMap.values()) {
      if (v.appearanceCount < 2) continue;
      const byMonthAmounts: Record<string, number[]> = {};
      for (const tx of transactions) {
        const core = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
        if (core !== v.canonicalName) continue;
        const m = tx.date.slice(0, 7);
        if (!byMonthAmounts[m]) byMonthAmounts[m] = [];
        byMonthAmounts[m].push(tx.amount);
      }
      const monthKeys = Object.keys(byMonthAmounts).sort();
      if (monthKeys.length >= 2) {
        const lastMonth = monthKeys[monthKeys.length - 1];
        const prevMonth = monthKeys[monthKeys.length - 2];
        const lastAvg =
          byMonthAmounts[lastMonth].reduce((s, a) => s + a, 0) /
          byMonthAmounts[lastMonth].length;
        const prevAvg =
          byMonthAmounts[prevMonth].reduce((s, a) => s + a, 0) /
          byMonthAmounts[prevMonth].length;
        const changePct = prevAvg > 0 ? Math.abs(lastAvg - prevAvg) / prevAvg : 0;
        if (changePct > 0.3 && lastAvg > 50) {
          crossMonthInsights.push({
            vendor: v.canonicalName,
            type: "amount_change",
            detail: `${prevMonth}: £${prevAvg.toFixed(0)} → ${lastMonth}: £${lastAvg.toFixed(0)}`,
            previousAmount: prevAvg,
            currentAmount: lastAvg,
          });
        }
      }
    }
  }

  return {
    vendors: vendorMap,
    recurringCandidates,
    oneOffCandidates,
    oneOffIncomeCandidates,
    oneOffExpenseCandidates,
    crossMonthInsights,
    suspiciousCandidates,
    totalMonths: byMonth.length,
    totalVendors: vendorMap.size,
    totalTransactions: transactions.length,
    monthlyOneOffExpenseAvg,
    monthlyOneOffIncomeAvg,
  };
}

// Build vendor intel entries from learning report
export function buildVendorIntelEntries(
  report: LearningReport,
  companyId: string,
  existingVendors?: Map<string, VendorIntelEntry>
): VendorIntelEntry[] {
  const entries: VendorIntelEntry[] = [];

  for (const vendor of report.vendors.values()) {
    const existing = existingVendors?.get(vendor.canonicalName);

    // Determine if personal or suspicious
    const isSuspicious = report.suspiciousCandidates.some(
      (s) => s.canonicalName === vendor.canonicalName
    );

    // Confidence: higher with more months and more appearances
    let confidence = 0.4;
    if (vendor.appearanceCount >= 3) confidence += 0.2;
    if (vendor.months.length >= 2) confidence += 0.1;
    if (vendor.months.length >= 3) confidence += 0.1;
    if (vendor.isRecurring) confidence += 0.1;
    if (existing?.source === "user") confidence = 1.0;
    confidence = Math.min(1, confidence);

    entries.push({
      companyId,
      canonicalName: vendor.canonicalName,
      aliases: vendor.aliases.slice(0, 10),
      subcategory: vendor.subcategory as any,
      category: vendor.category,
      typicalAmountMin: vendor.amountRange.min,
      typicalAmountMax: vendor.amountRange.max,
      typicalAmountAvg: vendor.typicalAmount,
      recurrencePattern: vendor.recurrencePattern,
      recurrenceConfidence: vendor.isRecurring ? Math.min(0.9, 0.4 + vendor.months.length * 0.1) : 0,
      firstSeenDate: vendor.firstSeen,
      lastSeenDate: vendor.lastSeen,
      appearanceCount: vendor.appearanceCount,
      monthsSeen: vendor.months,
      linkedProperty: existing?.linkedProperty ?? null,
      linkedPerson: existing?.linkedPerson ?? null,
      isBusiness: isSuspicious ? false : null,
      isSuspicious,
      isPersonal: false,
      needsReview: isSuspicious,
      includeInForecast: vendor.isRecurring && !isSuspicious,
      aiExplanation: existing?.aiExplanation ?? null,
      confidence,
      source: existing?.source ?? "system",
      researchedAt: existing?.researchedAt ?? null,
      researchData: existing?.researchData ?? null,
      isFirstSeen: existing?.isFirstSeen ?? false,
      direction: vendor.direction,
    });
  }

  return entries;
}
