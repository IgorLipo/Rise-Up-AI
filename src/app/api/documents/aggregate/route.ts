import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { detectAllAsync } from "@/lib/detection";
import { generateForecast, daysBetween } from "@/lib/forecast";
import { learnFromHistory, buildVendorIntelEntries } from "@/lib/learning/cross-month-learner";
import { detectAllSuspicious } from "@/lib/detection/suspicious-detector";
import { ensureCompleteVendorIntel, listVendorIntel, listAnnotations } from "@/lib/vendor-intel";
import type { VendorIntelEntry } from "@/lib/vendor-intel";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";
import { extractEntities, entityAttributesForVendor } from "@/lib/detection/entity-extractor";
import type { AIClassification } from "@/lib/detection/ai-classifier";
import { validateStatementBalance } from "@/lib/financial/math";
import type { Transaction, StatementData } from "@/types";

interface StatementSummary {
  period: string;
  month: string;
  closingBalance: number;
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
}

interface MonthlySummary {
  month: string;
  label: string;
  closingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
  /** Per-month health status: safe | watch | risk | critical */
  status: "safe" | "watch" | "risk" | "critical";
}

interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
  }>;
}

/** Compute per-month status based on income/expense ratio and net flow direction. */
function monthStatus(income: number, expenses: number): MonthlySummary["status"] {
  if (income === 0 && expenses === 0) return "safe";
  if (expenses === 0) return "safe"; // all income, no outgoings
  const ratio = income / expenses;
  if (ratio >= 1.1) return "safe";       // comfortably above break-even
  if (ratio >= 0.75) return "watch";     // tight
  if (ratio >= 0.4) return "risk";       // burning cash
  return "critical";                      // income way below expenses
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member?.company_id) {
    return NextResponse.json({ error: "No company found" }, { status: 404 });
  }

  const companyId = member.company_id;

  // Optional date range filtering
  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");
  const dateFilterActive = !!(dateFrom || dateTo);

  // Fetch ALL documents for this company
  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename, uploaded_at, statement_data")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: true });

  if (!docs || docs.length === 0) {
    return NextResponse.json({
      documents: [],
      totalDocuments: 0,
      totalTransactions: 0,
      hasData: false,
    });
  }

  // Aggregate all transactions from all statements
  const allTransactions: Transaction[] = [];
  const statementSummaries: StatementSummary[] = [];

  for (const doc of docs) {
    const stmt = doc.statement_data as unknown as StatementData;
    if (stmt?.transactions) {
      allTransactions.push(...stmt.transactions);
      const period = stmt.accountInfo?.statementPeriod
        ? `${stmt.accountInfo.statementPeriod.from} to ${stmt.accountInfo.statementPeriod.to}`
        : doc.filename;
      const month = stmt.accountInfo?.statementPeriod?.from?.slice(0, 7)
        ?? stmt.transactions[0]?.date?.slice(0, 7)
        ?? doc.uploaded_at?.slice(0, 7)
        ?? "unknown";
      const income = stmt.transactions
        .filter((t) => t.type === "credit")
        .reduce((s, t) => s + t.amount, 0);
      const expenses = stmt.transactions
        .filter((t) => t.type === "debit")
        .reduce((s, t) => s + t.amount, 0);
      statementSummaries.push({
        period,
        month,
        closingBalance: stmt.accountInfo?.closingBalance ?? 0,
        transactionCount: stmt.transactions.length,
        totalIncome: income,
        totalExpenses: expenses,
        netFlow: income - expenses,
      });
    }
  }

  // Apply date range filter to transactions
  const filteredTransactions = dateFrom || dateTo
    ? allTransactions.filter((tx) => {
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;
        return true;
      })
    : allTransactions;

  // If filtering, update statement summaries to reflect filtered data
  if (dateFrom || dateTo) {
    for (const summary of statementSummaries) {
      const stmtTxs = allTransactions.filter((tx) => {
        const txMonth = tx.date.slice(0, 7);
        return txMonth === summary.month;
      });
      const filteredStmtTxs = stmtTxs.filter((tx) => {
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;
        return true;
      });
      const income = filteredStmtTxs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
      const expenses = filteredStmtTxs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
      summary.totalIncome = income;
      summary.totalExpenses = expenses;
      summary.netFlow = income - expenses;
      summary.transactionCount = filteredStmtTxs.length;
    }
  }

  // Use filtered transactions for all downstream processing
  const workingTransactions = filteredTransactions;

  // ── Cross-Month Learning (always uses all transactions for accuracy) ──
  const learningReport = learnFromHistory(allTransactions);

  // Build entity attributes for vendors (must be before vendorIntel enrichment)
  const vendorEntityAttrs = new Map<string, { linkedProperty: string | null; linkedPerson: string | null; personRole: string | null }>();
  for (const vendor of learningReport.vendors.values()) {
    vendorEntityAttrs.set(
      vendor.canonicalName,
      entityAttributesForVendor(vendor.canonicalName, vendor.allDescriptions)
    );
  }

  // Build initial vendor intel entries from learning (synchronous, no AI calls)
  const vendorIntelEntries = buildVendorIntelEntries(learningReport, companyId);

  // Enrich vendor intel with entity attributes
  for (const entry of vendorIntelEntries) {
    const attrs = vendorEntityAttrs.get(entry.canonicalName);
    if (attrs) {
      entry.linkedProperty = entry.linkedProperty ?? attrs.linkedProperty;
      entry.linkedPerson = entry.linkedPerson ?? attrs.linkedPerson;
    }
  }

  // Ensure ALL vendors from ALL statements have complete vendor_intel entries
  // (Researches unknown vendors via DeepSeek, updates existing ones, persists)
  // Run in background — response doesn't depend on this completing
  ensureCompleteVendorIntel(learningReport, companyId).catch(() => {});

  // ── Suspicious Detection (always uses all transactions) ──
  // Build known business vendors to skip personal detection for business transactions
  const knownBusinessVendors = new Set<string>();
  for (const vendor of learningReport.recurringCandidates) {
    const bizCategories = ["rent", "property-management", "property-income", "taxes", "supplier-payments", "utilities", "software", "professional-services"];
    if (bizCategories.includes(vendor.subcategory)) {
      knownBusinessVendors.add(vendor.canonicalName.toLowerCase());
    }
  }
  const allSuspicious = detectAllSuspicious(allTransactions, knownBusinessVendors);

  // ── Pattern Detection (with known vendors + DB intel) ──
  // Build known vendor map from cross-month learning
  const knownVendors = new Map<string, AIClassification>();
  for (const vendor of learningReport.vendors.values()) {
    knownVendors.set(vendor.canonicalName, {
      subcategory: vendor.subcategory as any,
      confidence: vendor.isRecurring ? 0.8 : 0.5,
      reasoning: `Learned from ${vendor.appearanceCount} appearances across ${vendor.months.length} months`,
    });
  }

  // Load existing vendor_intel from DB (includes user corrections)
  const existingVendorMap = new Map<string, VendorIntelEntry>();
  try {
    const dbVendors = await listVendorIntel(companyId);
    for (const v of dbVendors) {
      existingVendorMap.set(v.canonicalName.toLowerCase(), v);
      if (v.source === "user" || !knownVendors.has(v.canonicalName)) {
        knownVendors.set(v.canonicalName, {
          subcategory: v.subcategory as any,
          confidence: v.confidence,
          reasoning: v.aiExplanation ?? `From ${v.source} — ${v.appearanceCount} appearances`,
        });
      }
    }
  } catch {
    // Non-critical — proceed with learned vendors only
  }

  // Read user annotations and apply as high-confidence overrides
  try {
    const annotations = await listAnnotations(companyId);
    for (const a of annotations) {
      if (a.corrected_subcategory && a.merchant_normalized) {
        knownVendors.set(a.merchant_normalized, {
          subcategory: a.corrected_subcategory as any,
          confidence: 1.0,
          reasoning: a.note ?? "User-corrected category",
        });
      }
    }
  } catch {
    // Non-critical
  }

  // Pattern detection always uses all transactions for accuracy
  const { patterns, newVendors } = await detectAllAsync(allTransactions, knownVendors);

  // ── Build a set of canonical merchant names visible in the filtered range ──
  const filteredCoreKeys = new Set<string>();
  for (const tx of workingTransactions) {
    const coreKey = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
    filteredCoreKeys.add(coreKey);
    // Also collect the description itself as a fallback check
    filteredCoreKeys.add(tx.description.toLowerCase().trim());
  }

  // ── Balance ──
  // currentPosition = authoritative bank balance from latest statement only.
  // accumulated = computed net flow across all statements (shown separately).

  // Find the document with the most recent statement period end date
  let latestDoc = docs[0];
  let latestStmt = latestDoc.statement_data as unknown as StatementData;
  let latestPeriodTo = latestStmt?.accountInfo?.statementPeriod?.to ?? "";
  for (const doc of docs) {
    const stmt = doc.statement_data as unknown as StatementData;
    const periodTo = stmt?.accountInfo?.statementPeriod?.to ?? "";
    if (periodTo > latestPeriodTo) {
      latestPeriodTo = periodTo;
      latestDoc = doc;
      latestStmt = stmt;
    }
  }

  const latestClosingBalance = latestStmt?.accountInfo?.closingBalance;
  const latestPeriodFrom = latestStmt?.accountInfo?.statementPeriod?.from ?? "";

  // Build current position from bank-verified data only
  const currentPosition = {
    balance: latestClosingBalance ?? null as number | null,
    date: latestPeriodTo || null as string | null,
    source: latestClosingBalance != null ? "statement" as const : "unavailable" as const,
    isEstimated: false,
    isStale: false,
    statementPeriodEnd: latestPeriodTo || null as string | null,
  };

  // Balance validation on the latest statement
  let balanceValidation: { valid: boolean; differencePence: number; message: string } | null = null;
  if (latestClosingBalance != null && latestStmt?.accountInfo) {
    const opening = latestStmt.accountInfo.openingBalance ?? 0;
    const credits = latestStmt.transactions
      ?.filter((t: { type: string }) => t.type === "credit")
      .reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? 0;
    const debits = latestStmt.transactions
      ?.filter((t: { type: string }) => t.type === "debit")
      .reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? 0;
    balanceValidation = validateStatementBalance(opening, credits, debits, latestClosingBalance);
  }

  // ── Statement Source-of-Truth ──
  const statementInfo = latestStmt ? {
    openingBalance: latestStmt.accountInfo?.openingBalance ?? null as number | null,
    totalIncome: latestStmt.transactions
      ?.filter((t: { type: string }) => t.type === "credit")
      .reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? null as number | null,
    totalExpenses: latestStmt.transactions
      ?.filter((t: { type: string }) => t.type === "debit")
      .reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? null as number | null,
    closingBalance: latestClosingBalance ?? null as number | null,
    periodFrom: latestPeriodFrom || null as string | null,
    periodTo: latestPeriodTo || null as string | null,
    bankName: latestStmt.accountInfo?.bankName ?? null as string | null,
  } : null;

  // For forecast start: use bank-verified balance, or null if unavailable
  const forecastStartingBalance = currentPosition.balance;

  // ── Filter patterns, suspicious items, vendors to date range when filter is active ──
  let displayPatterns = patterns;
  let displaySuspicious = allSuspicious;
  let displayNewVendors = newVendors;
  let displayRecurringVendors = learningReport.recurringCandidates;
  let displaySuspiciousVendors = learningReport.suspiciousCandidates;
  let displayOneOffCandidates = learningReport.oneOffCandidates;
  let displayOneOffIncomeCandidates = learningReport.oneOffIncomeCandidates;
  let displayOneOffExpenseCandidates = learningReport.oneOffExpenseCandidates;
  let displayCrossMonthInsights = learningReport.crossMonthInsights;
  let displayTotalVendors = learningReport.totalVendors;

  if (dateFilterActive) {
    // Filter patterns: keep only those with at least one occurrence in the date range
    const patternOccurrenceInRange = (occurrences: { date: string; amount: number }[]): boolean =>
      occurrences.some((o) => {
        if (dateFrom && o.date < dateFrom) return false;
        if (dateTo && o.date > dateTo) return false;
        return true;
      });

    displayPatterns = {
      ...patterns,
      recurringExpenses: patterns.recurringExpenses.filter(
        (p) => patternOccurrenceInRange(p.occurrences)
      ),
      recurringIncome: patterns.recurringIncome.filter(
        (p) => patternOccurrenceInRange(p.occurrences)
      ),
    };

    // Filter suspicious: keep only those whose transaction date falls in the range
    displaySuspicious = allSuspicious.filter((s) => {
      if (dateFrom && s.transaction.date < dateFrom) return false;
      if (dateTo && s.transaction.date > dateTo) return false;
      return true;
    });

    // Filter new vendors: keep only those whose merchant name appears in filtered transactions
    displayNewVendors = newVendors.filter((v) => {
      const key = v.merchantNormalized.toLowerCase();
      return filteredCoreKeys.has(key);
    });

    // Filter vendor learning: keep only vendors that appear in filtered transactions
    displayRecurringVendors = learningReport.recurringCandidates.filter((v) =>
      filteredCoreKeys.has(v.canonicalName.toLowerCase())
    );
    displaySuspiciousVendors = learningReport.suspiciousCandidates.filter((v) =>
      filteredCoreKeys.has(v.canonicalName.toLowerCase())
    );
    displayOneOffCandidates = learningReport.oneOffCandidates.filter((v) =>
      filteredCoreKeys.has(v.toLowerCase())
    );
    displayOneOffIncomeCandidates = learningReport.oneOffIncomeCandidates.filter((v) =>
      filteredCoreKeys.has(v.toLowerCase())
    );
    displayOneOffExpenseCandidates = learningReport.oneOffExpenseCandidates.filter((v) =>
      filteredCoreKeys.has(v.toLowerCase())
    );
    displayTotalVendors = displayRecurringVendors.length + displaySuspiciousVendors.length + displayOneOffCandidates.length;

    // Filter cross-month insights: keep only those mentioning vendors in the filtered range
    displayCrossMonthInsights = learningReport.crossMonthInsights.filter((insight) =>
      filteredCoreKeys.has(insight.vendor.toLowerCase())
    );
  }

  // Generate forecast using filtered patterns when date filter is active
  // Only generate when we have a bank-verified starting balance
  const forecast = forecastStartingBalance != null
    ? generateForecast(displayPatterns, forecastStartingBalance)
    : null;

  // ── Catch-Up Estimate (computed in route, not in forecast engine) ──
  let catchUpEstimate: {
    daysSinceStatement: number;
    likelySpent: number;
    likelyReceived: number;
    estimatedBalance: number;
    confidence: number;
  } | null = null;

  if (latestPeriodTo && latestClosingBalance != null && forecast) {
    const todayStr = new Date().toISOString().split("T")[0];
    const daysSince = Math.max(0, daysBetween(latestPeriodTo, todayStr));
    if (daysSince > 0 && daysSince <= 30) {
      let likelySpent = 0;
      let likelyReceived = 0;
      for (const payment of displayPatterns.recurringExpenses) {
        if (payment.occurrences.length < 2) continue;
        if ((payment as any).confidenceTier !== "high") continue;
        if ((payment as any).nextExpected > latestPeriodTo && (payment as any).nextExpected <= todayStr) {
          likelySpent += payment.typicalAmount;
        }
      }
      for (const income of displayPatterns.recurringIncome) {
        if (income.occurrences.length < 2) continue;
        if ((income as any).confidenceTier !== "high") continue;
        if ((income as any).nextExpected > latestPeriodTo && (income as any).nextExpected <= todayStr) {
          likelyReceived += income.typicalAmount;
        }
      }
      const estimatedBalance = latestClosingBalance + likelyReceived - likelySpent;
      const confidence = Math.max(0, 1.0 - (daysSince / 30) * 0.5);
      catchUpEstimate = {
        daysSinceStatement: daysSince,
        likelySpent,
        likelyReceived,
        estimatedBalance,
        confidence,
      };
    }
  }

  // ── Forecast Mode (low-confidence detection) ──
  const forecastMode: { isLowConfidence: boolean; reason: string | null } = (() => {
    if (!latestPeriodTo) return { isLowConfidence: false, reason: null };
    const todayDay = new Date().getDate();
    const lastStatementDay = new Date(latestPeriodTo).getDate();
    if (todayDay > 25 && lastStatementDay <= 5) {
      return {
        isLowConfidence: true,
        reason: "Latest statement is from early in the month and we're past the 25th. Consider uploading a newer statement.",
      };
    }
    return { isLowConfidence: false, reason: null };
  })();

  // ── Monthly grouping ──
  const byMonth = new Map<string, Transaction[]>();
  for (const tx of workingTransactions) {
    const m = tx.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(tx);
  }

  const monthlySummaries: MonthlySummary[] = [];
  for (const [month, txs] of byMonth) {
    const income = txs.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const label = new Date(month + "-01").toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
    });
    monthlySummaries.push({
      month,
      label,
      closingBalance: 0,
      totalIncome: income,
      totalExpenses: expenses,
      netFlow: income - expenses,
      transactionCount: txs.length,
      status: monthStatus(income, expenses),
    });
  }
  monthlySummaries.sort((a, b) => b.month.localeCompare(a.month));

  // ── Category Breakdowns (from filtered transactions, classified) ──
  const categoryMap = new Map<string, { total: number; count: number; transactions: CategorySummary["transactions"] }>();
  for (const tx of workingTransactions) {
    if (tx.type !== "debit") continue;
    const coreKey = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
    const vendor = learningReport.vendors.get(coreKey);
    const subcategory = vendor?.subcategory ?? tx.subcategory ?? "one-off";
    if (!categoryMap.has(subcategory)) {
      categoryMap.set(subcategory, { total: 0, count: 0, transactions: [] });
    }
    const cat = categoryMap.get(subcategory)!;
    cat.total += tx.amount;
    cat.count++;
    cat.transactions.push({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
    });
  }

  const grandTotalExpenses = [...categoryMap.values()].reduce((s, c) => s + c.total, 0);
  const categories: CategorySummary[] = [...categoryMap.entries()]
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percentage: grandTotalExpenses > 0 ? (data.total / grandTotalExpenses) * 100 : 0,
      transactions: data.transactions.slice(0, 20),
    }))
    .sort((a, b) => b.total - a.total);

  // ── Vendor Learning Summaries ──
  const recurringVendors = displayRecurringVendors.map((v) => {
    let confidence = 0.4;
    if (v.appearanceCount >= 3) confidence += 0.2;
    if (v.months.length >= 2) confidence += 0.1;
    if (v.months.length >= 3) confidence += 0.1;
    if (v.isRecurring) confidence += 0.1;
    confidence = Math.min(1, confidence);

    const intelEntry = existingVendorMap.get(v.canonicalName.toLowerCase());
    return {
      canonicalName: v.canonicalName,
      subcategory: v.subcategory,
      category: v.category,
      typicalAmount: v.typicalAmount,
      recurrencePattern: v.recurrencePattern,
      appearanceCount: v.appearanceCount,
      monthsSeen: v.months.length,
      confidence,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      amountRange: v.amountRange,
      isFirstSeen: intelEntry?.isFirstSeen ?? false,
      direction: v.direction ?? "expense",
    };
  });

  const suspiciousVendors = displaySuspiciousVendors.map((v) => ({
    canonicalName: v.canonicalName,
    subcategory: v.subcategory,
    typicalAmount: v.typicalAmount,
    appearanceCount: v.appearanceCount,
    reason: v.isRecurring ? "Recurring personal-like expense" : "One-off personal-like expense",
  }));

  // ── Entity Extraction (properties + people) ──
  const txDescriptors = workingTransactions.map((tx) => ({ id: tx.id, description: tx.description }));
  const entities = extractEntities(txDescriptors);

  // ── Accumulated Stats ──
  const totalIncome = workingTransactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = workingTransactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    hasData: true,
    documents: statementSummaries,
    totalDocuments: docs.length,
    totalTransactions: workingTransactions.length,

    // Current position (bank-verified)
    currentPosition: {
      balance: currentPosition.balance,
      date: currentPosition.date,
      source: currentPosition.source,
      isEstimated: currentPosition.isEstimated,
      isStale: currentPosition.isStale,
      statementPeriodEnd: currentPosition.statementPeriodEnd,
    },

    // Statement source-of-truth
    statementInfo,

    // Balance validation
    balanceValidation: balanceValidation ? {
      valid: balanceValidation.valid,
      differencePence: balanceValidation.differencePence,
      message: balanceValidation.message,
    } : null,

    // Accumulated performance (computed — separate from current position)
    accumulated: {
      totalIncome,
      totalExpenses,
      netFlow: totalIncome - totalExpenses,
      statementCount: docs.length,
      totalTransactions: workingTransactions.length,
      dateRange: workingTransactions.length > 0
        ? {
            from: workingTransactions.reduce((earliest, tx) => tx.date < earliest ? tx.date : earliest, workingTransactions[0].date),
            to: workingTransactions.reduce((latest, tx) => tx.date > latest ? tx.date : latest, workingTransactions[0].date),
          }
        : null,
    },

    // Forecast (only generated when we have a starting balance)
    forecast: forecast != null
      ? {
          currentBalance: forecast.currentBalance,
          predictedMonthEnd: forecast.predictedMonthEnd,
          remainingIncome: forecast.remainingIncome,
          remainingExpenses: forecast.remainingExpenses,
          status: forecast.status,
          statusReason: forecast.statusReason,
          confidence: forecast.confidence,
          dailyForecast: forecast.dailyForecast,
          nextIncomeDate: forecast.nextIncomeDate,
          dangerWindow: forecast.dangerWindow,
          biggestRisks: forecast.biggestRisks,
          generatedAt: forecast.generatedAt,
          catchUpEstimate,
          calculationAudit: forecast.calculationAudit,
          forecastMode,
        }
      : null,

    // Monthly breakdown
    monthly: monthlySummaries,

    // Category breakdowns
    categories,

    // Patterns
    patterns: {
      recurringExpenses: displayPatterns.recurringExpenses.map((p) => ({
        merchant: (p as any).merchant,
        subcategory: (p as any).subcategory ?? "one-off",
        typicalAmount: p.typicalAmount,
        interval: p.interval,
        confidence: p.confidence,
        nextExpected: p.nextExpected,
        occurrences: p.occurrences.length,
        aiReasoning: (p as any).aiReasoning ?? "",
      })),
      recurringIncome: displayPatterns.recurringIncome.map((p) => ({
        merchant: (p as any).merchant,
        subcategory: (p as any).subcategory ?? "salary",
        typicalAmount: p.typicalAmount,
        interval: p.interval,
        confidence: p.confidence,
        nextExpected: p.nextExpected,
        occurrences: p.occurrences.length,
        aiReasoning: (p as any).aiReasoning ?? "",
      })),
      oneOffExpenses: displayPatterns.oneOffExpenses.length,
      oneOffIncome: displayPatterns.oneOffIncome.length,
    },

    // New vendors discovered by AI (with reasoning)
    newVendors: displayNewVendors.map((v) => ({
      merchantRaw: v.merchantRaw,
      merchantNormalized: v.merchantNormalized,
      subcategory: v.subcategory,
      confidence: v.confidence,
      reasoning: v.reasoning,
    })),

    // Vendor learning
    vendors: {
      total: displayTotalVendors,
      recurring: recurringVendors,
      suspicious: suspiciousVendors,
      oneOff: displayOneOffCandidates,
      oneOffIncome: displayOneOffIncomeCandidates,
      oneOffExpenses: displayOneOffExpenseCandidates,
    },

    // Cross-month insights
    crossMonthInsights: displayCrossMonthInsights,

    // Entity extraction (properties + people)
    entities: {
      properties: [...entities.properties.entries()].map(([key, match]) => ({
        key,
        displayName: match.displayName,
        confidence: match.confidence,
        matchType: match.matchType,
        transactionCount: entities.propertyTransactions.get(key)?.length ?? 0,
      })),
      people: [...entities.people.entries()].map(([key, match]) => ({
        key,
        personName: match.personName,
        role: match.role,
        confidence: match.confidence,
        indicators: match.indicators,
        transactionCount: entities.personTransactions.get(key)?.length ?? 0,
      })),
    },

    // Suspicious transactions
    suspicious: displaySuspicious.map((s) => ({
      merchant: s.merchant,
      reason: s.reason,
      riskLevel: s.riskLevel,
      suggestedCategory: s.suggestedCategory,
      shouldExcludeFromBusiness: s.shouldExcludeFromBusiness,
      date: s.transaction.date,
      amount: s.transaction.amount,
      description: s.transaction.description,
    })),
  });
}
