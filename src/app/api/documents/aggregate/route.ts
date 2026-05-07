import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { detectAllAsync } from "@/lib/detection";
import { generateForecast } from "@/lib/forecast";
import { learnFromHistory, buildVendorIntelEntries } from "@/lib/learning/cross-month-learner";
import { detectAllSuspicious } from "@/lib/detection/suspicious-detector";
import { upsertVendorIntelBatch, listVendorIntel, listAnnotations } from "@/lib/vendor-intel";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";
import type { AIClassification } from "@/lib/detection/ai-classifier";
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

  // Get current balance from the most recent statement
  const latestDoc = docs[docs.length - 1];
  const latestStmt = latestDoc.statement_data as unknown as StatementData;
  const currentBalance = latestStmt?.accountInfo?.closingBalance
    ?? allTransactions.reduce((sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount), 0);

  // ── Cross-Month Learning ──
  const learningReport = learnFromHistory(allTransactions);

  // Build vendor intel entries from learning
  const vendorIntelEntries = buildVendorIntelEntries(learningReport, companyId);

  // Persist vendor intel to Supabase (fire-and-forget)
  if (vendorIntelEntries.length > 0) {
    upsertVendorIntelBatch(vendorIntelEntries).catch(() => {});
  }

  // ── Suspicious Detection ──
  const suspicious = detectAllSuspicious(allTransactions);

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
  try {
    const dbVendors = await listVendorIntel(companyId);
    for (const v of dbVendors) {
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

  const { patterns, newVendors } = await detectAllAsync(allTransactions, knownVendors);
  const forecast = generateForecast(patterns, currentBalance);

  // ── Monthly grouping ──
  const byMonth = new Map<string, Transaction[]>();
  for (const tx of allTransactions) {
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
    });
  }
  monthlySummaries.sort((a, b) => b.month.localeCompare(a.month));

  // ── Category Breakdowns (from all transactions, classified) ──
  const categoryMap = new Map<string, { total: number; count: number; transactions: CategorySummary["transactions"] }>();
  for (const tx of allTransactions) {
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
  const recurringVendors = learningReport.recurringCandidates.map((v) => {
    let confidence = 0.4;
    if (v.appearanceCount >= 3) confidence += 0.2;
    if (v.months.length >= 2) confidence += 0.1;
    if (v.months.length >= 3) confidence += 0.1;
    if (v.isRecurring) confidence += 0.1;
    confidence = Math.min(1, confidence);

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
    };
  });

  const suspiciousVendors = learningReport.suspiciousCandidates.map((v) => ({
    canonicalName: v.canonicalName,
    subcategory: v.subcategory,
    typicalAmount: v.typicalAmount,
    appearanceCount: v.appearanceCount,
    reason: v.isRecurring ? "Recurring personal-like expense" : "One-off personal-like expense",
  }));

  // ── Accumulated Stats ──
  const totalIncome = allTransactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = allTransactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    hasData: true,
    documents: statementSummaries,
    totalDocuments: docs.length,
    totalTransactions: allTransactions.length,

    // Accumulated stats
    accumulated: {
      totalIncome,
      totalExpenses,
      netFlow: totalIncome - totalExpenses,
      statementCount: docs.length,
      totalTransactions: allTransactions.length,
      dateRange: docs.length > 0
        ? {
            from: docs[0].uploaded_at,
            to: docs[docs.length - 1].uploaded_at,
          }
        : null,
    },

    // Current balance + forecast
    currentBalance,
    forecast: {
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
    },

    // Monthly breakdown
    monthly: monthlySummaries,

    // Category breakdowns
    categories,

    // Patterns
    patterns: {
      recurringExpenses: patterns.recurringExpenses.map((p) => ({
        merchant: (p as any).merchant,
        subcategory: (p as any).subcategory ?? "one-off",
        typicalAmount: p.typicalAmount,
        interval: p.interval,
        confidence: p.confidence,
        nextExpected: p.nextExpected,
        occurrences: p.occurrences.length,
      })),
      recurringIncome: patterns.recurringIncome.map((p) => ({
        merchant: (p as any).merchant,
        subcategory: (p as any).subcategory ?? "salary",
        typicalAmount: p.typicalAmount,
        interval: p.interval,
        confidence: p.confidence,
        nextExpected: p.nextExpected,
        occurrences: p.occurrences.length,
      })),
      oneOffExpenses: patterns.oneOffExpenses.length,
      oneOffIncome: patterns.oneOffIncome.length,
    },

    // Vendor learning
    vendors: {
      total: learningReport.totalVendors,
      recurring: recurringVendors,
      suspicious: suspiciousVendors,
      oneOff: learningReport.oneOffCandidates,
    },

    // Cross-month insights
    crossMonthInsights: learningReport.crossMonthInsights,

    // Suspicious transactions
    suspicious: suspicious.map((s) => ({
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
