import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { detectAllAsync } from "@/lib/detection";
import { generateForecast, daysBetween, validateDailyForecast } from "@/lib/forecast";
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
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
  status: "safe" | "watch" | "risk" | "critical";
  completeness?: "complete" | "partial";
  dataFrom?: string;
  dataTo?: string;
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

function monthStatus(income: number, expenses: number): MonthlySummary["status"] {
  if (income === 0 && expenses === 0) return "safe";
  if (expenses === 0) return "safe";
  const ratio = income / expenses;
  if (ratio >= 1.1) return "safe";
  if (ratio >= 0.75) return "watch";
  if (ratio >= 0.4) return "risk";
  return "critical";
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
  const url = new URL(req.url);
  const forceRecalculate = url.searchParams.get("recalculate") === "true";

  // ── Fast path: return cached aggregate if available ──
  if (!forceRecalculate) {
    const { data: cached } = await supabase
      .from("company_aggregate_cache")
      .select("aggregate_data, last_calculated_at, needs_recalculation")
      .eq("company_id", companyId)
      .maybeSingle();

    if (cached && !cached.needs_recalculation && cached.aggregate_data) {
      const data = cached.aggregate_data as Record<string, unknown>;
      return NextResponse.json({
        ...data,
        _cached: true,
        _lastCalculatedAt: cached.last_calculated_at,
      });
    }
  }

  // ── Slow path: full computation ──
  const result = await computeAggregate(supabase, companyId, req);

  // Save to cache
  await supabase
    .from("company_aggregate_cache")
    .upsert({
      company_id: companyId,
      aggregate_data: result as unknown as Record<string, unknown>,
      last_calculated_at: new Date().toISOString(),
      needs_recalculation: false,
    });

  return NextResponse.json({
    ...result,
    _cached: false,
    _lastCalculatedAt: new Date().toISOString(),
  });
}

async function computeAggregate(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  companyId: string,
  req: NextRequest,
) {
  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");
  const dateFilterActive = !!(dateFrom || dateTo);

  // ── Accurate counts from statement_history (deduplicated) ──
  const { data: statementHistory } = await supabase
    .from("statement_history")
    .select("statement_period_start, statement_period_end, transaction_count, opening_balance, closing_balance, total_income, total_expenses")
    .eq("company_id", companyId)
    .eq("parse_status", "ok")
    .order("uploaded_at", { ascending: false });

  const seenPeriods = new Set<string>();
  let accurateStatementCount = 0;
  let accurateTransactionCount = 0;

  for (const row of statementHistory ?? []) {
    const key = `${row.statement_period_start}|${row.statement_period_end}`;
    if (!seenPeriods.has(key)) {
      seenPeriods.add(key);
      accurateStatementCount++;
      accurateTransactionCount += row.transaction_count ?? 0;
    }
  }

  // Fetch ALL documents for this company
  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename, uploaded_at, statement_data")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: true });

  if (!docs || docs.length === 0) {
    return {
      documents: [],
      totalDocuments: 0,
      totalTransactions: 0,
      hasData: false,
    };
  }

  // Aggregate all transactions from all statements (for learning/forecast)
  const allTransactions: Transaction[] = [];
  const statementSummaries: StatementSummary[] = [];

  for (const doc of docs) {
    const stmt = doc.statement_data as unknown as StatementData;
    if (!stmt?.transactions) continue;
    allTransactions.push(...stmt.transactions);

    const periodFrom = stmt.accountInfo?.statementPeriod?.from ?? "";
    const periodTo = stmt.accountInfo?.statementPeriod?.to ?? "";
    const period = periodFrom && periodTo ? `${periodFrom} to ${periodTo}` : doc.filename;

    // Use statement_history totals for statement-level accuracy
    const historyRow = (statementHistory ?? []).find(
      (row) => row.statement_period_start === periodFrom && row.statement_period_end === periodTo
    );
    const income = historyRow?.total_income != null
      ? Number(historyRow.total_income)
      : stmt.transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const expenses = historyRow?.total_expenses != null
      ? Number(historyRow.total_expenses)
      : stmt.transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const closing = historyRow?.closing_balance != null
      ? Number(historyRow.closing_balance)
      : stmt.accountInfo?.closingBalance ?? 0;
    const txCount = historyRow?.transaction_count ?? stmt.transactions.length;

    statementSummaries.push({
      period,
      month: periodTo?.slice(0, 7) ?? "unknown",
      closingBalance: closing,
      transactionCount: txCount,
      totalIncome: income,
      totalExpenses: expenses,
      netFlow: income - expenses,
    });
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

  const workingTransactions = filteredTransactions;

  // ── Cross-Month Learning ──
  const learningReport = learnFromHistory(allTransactions);

  const vendorEntityAttrs = new Map<string, { linkedProperty: string | null; linkedPerson: string | null; personRole: string | null }>();
  for (const vendor of learningReport.vendors.values()) {
    vendorEntityAttrs.set(
      vendor.canonicalName,
      entityAttributesForVendor(vendor.canonicalName, vendor.allDescriptions)
    );
  }

  const vendorIntelEntries = buildVendorIntelEntries(learningReport, companyId);

  for (const entry of vendorIntelEntries) {
    const attrs = vendorEntityAttrs.get(entry.canonicalName);
    if (attrs) {
      entry.linkedProperty = entry.linkedProperty ?? attrs.linkedProperty;
      entry.linkedPerson = entry.linkedPerson ?? attrs.linkedPerson;
    }
  }

  // Background vendor intel research (non-blocking)
  ensureCompleteVendorIntel(learningReport, companyId).catch(() => {});

  // ── Suspicious Detection ──
  const knownBusinessVendors = new Set<string>();
  for (const vendor of learningReport.recurringCandidates) {
    const bizCategories = ["rent", "property-management", "property-income", "taxes", "supplier-payments", "utilities", "software", "professional-services"];
    if (bizCategories.includes(vendor.subcategory)) {
      knownBusinessVendors.add(vendor.canonicalName.toLowerCase());
    }
  }
  const allSuspicious = detectAllSuspicious(allTransactions, knownBusinessVendors);

  // ── Pattern Detection ──
  const knownVendors = new Map<string, AIClassification>();
  for (const vendor of learningReport.vendors.values()) {
    knownVendors.set(vendor.canonicalName, {
      subcategory: vendor.subcategory as any,
      confidence: vendor.isRecurring ? 0.8 : 0.5,
      reasoning: `Learned from ${vendor.appearanceCount} appearances across ${vendor.months.length} months`,
    });
  }

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
    // Non-critical
  }

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

  const filteredCoreKeys = new Set<string>();
  for (const tx of workingTransactions) {
    const coreKey = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
    filteredCoreKeys.add(coreKey);
    filteredCoreKeys.add(tx.description.toLowerCase().trim());
  }

  // ── Balance ──
  // Find the document with the latest statement period
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

  // Determine closing balance with fallbacks for old documents missing the field
  let latestClosingBalance: number | undefined = latestStmt?.accountInfo?.closingBalance;

  // Fallback 1: compute from openingBalance + net cash flow (statement-level totals)
  if (latestClosingBalance == null && latestStmt?.accountInfo?.openingBalance != null) {
    const credits = latestStmt.summary?.totalCredits ?? 0;
    const debits = latestStmt.summary?.totalDebits ?? 0;
    latestClosingBalance = latestStmt.accountInfo.openingBalance + credits - debits;
  }

  // Fallback 2: search docs (newest-first by period) for one with a known closingBalance
  if (latestClosingBalance == null) {
    const byPeriodDesc = [...docs].sort((a, b) => {
      const aTo = (a.statement_data as unknown as StatementData)?.accountInfo?.statementPeriod?.to ?? "";
      const bTo = (b.statement_data as unknown as StatementData)?.accountInfo?.statementPeriod?.to ?? "";
      return bTo.localeCompare(aTo);
    });
    for (const doc of byPeriodDesc) {
      const cb = (doc.statement_data as unknown as StatementData)?.accountInfo?.closingBalance;
      if (cb != null) {
        latestClosingBalance = cb;
        break;
      }
    }
  }

  // Fallback 3: use statement_history (authoritative after db.ts fix).
  // Find the entry with the latest statement_period_end, not the most recently uploaded.
  if (latestClosingBalance == null) {
    let bestClosing: number | undefined;
    let bestPeriodEnd = "";
    for (const row of statementHistory ?? []) {
      const r = row as Record<string, unknown>;
      const periodEnd = (r.statement_period_end as string) ?? "";
      if (periodEnd > bestPeriodEnd) {
        bestPeriodEnd = periodEnd;
        const shClosing = r.closing_balance;
        if (shClosing != null && Number(shClosing) !== 0) {
          bestClosing = Number(shClosing);
        } else {
          const opening = Number(r.opening_balance ?? 0);
          const income = Number(r.total_income ?? 0);
          const expenses = Number(r.total_expenses ?? 0);
          bestClosing = opening + income - expenses;
        }
      }
    }
    latestClosingBalance = bestClosing;
  }

  const latestPeriodFrom = latestStmt?.accountInfo?.statementPeriod?.from ?? "";

  const currentPosition = {
    balance: latestClosingBalance ?? null as number | null,
    date: latestPeriodTo || null as string | null,
    source: latestClosingBalance != null ? "statement" as const : "unavailable" as const,
    isEstimated: false,
    isStale: false,
    statementPeriodEnd: latestPeriodTo || null as string | null,
  };

  // Prefer statement_history totals (statement-header values) over transaction sums.
  // Fall back to computing from transactions when statement_history row is missing.
  const latestHistoryRow = (statementHistory ?? []).find(
    (row) => row.statement_period_start === latestPeriodFrom && row.statement_period_end === latestPeriodTo
  );
  const stmtTotalIncome = latestHistoryRow?.total_income != null
    ? Number(latestHistoryRow.total_income)
    : latestStmt?.transactions?.filter((t: { type: string }) => t.type === "credit").reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? null;
  const stmtTotalExpenses = latestHistoryRow?.total_expenses != null
    ? Number(latestHistoryRow.total_expenses)
    : latestStmt?.transactions?.filter((t: { type: string }) => t.type === "debit").reduce((s: number, t: { amount: number }) => s + t.amount, 0) ?? null;

  let balanceValidation: { valid: boolean; differencePence: number; message: string } | null = null;
  if (latestClosingBalance != null && latestStmt?.accountInfo) {
    const opening = latestHistoryRow?.opening_balance != null
      ? Number(latestHistoryRow.opening_balance)
      : latestStmt.accountInfo.openingBalance ?? 0;
    const credits = stmtTotalIncome ?? 0;
    const debits = stmtTotalExpenses ?? 0;
    balanceValidation = validateStatementBalance(opening, credits, debits, latestClosingBalance);
  }

  const statementInfo = latestStmt ? {
    openingBalance: latestHistoryRow?.opening_balance != null
      ? Number(latestHistoryRow.opening_balance)
      : latestStmt.accountInfo?.openingBalance ?? null as number | null,
    totalIncome: stmtTotalIncome as number | null,
    totalExpenses: stmtTotalExpenses as number | null,
    closingBalance: latestClosingBalance ?? null as number | null,
    periodFrom: latestPeriodFrom || null as string | null,
    periodTo: latestPeriodTo || null as string | null,
    bankName: latestStmt.accountInfo?.bankName ?? null as string | null,
  } : null;

  const forecastStartingBalance = currentPosition.balance;

  // ── Filter patterns to date range ──
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

    displaySuspicious = allSuspicious.filter((s) => {
      if (dateFrom && s.transaction.date < dateFrom) return false;
      if (dateTo && s.transaction.date > dateTo) return false;
      return true;
    });

    displayNewVendors = newVendors.filter((v) => {
      const key = v.merchantNormalized.toLowerCase();
      return filteredCoreKeys.has(key);
    });

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

    displayCrossMonthInsights = learningReport.crossMonthInsights.filter((insight) =>
      filteredCoreKeys.has(insight.vendor.toLowerCase())
    );
  }

  let forecast = forecastStartingBalance != null
    ? generateForecast(displayPatterns, forecastStartingBalance)
    : null;
  let forecastError: string | null = null;

  if (forecast) {
    const validation = validateDailyForecast(forecast.dailyForecast, forecast.currentBalance);
    if (!validation.valid) {
      console.error("Forecast validation failed:", validation.errors);
      forecastError = validation.errors.join("; ");
      forecast = null;
    }
  }

  // ── Catch-Up Estimate ──
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

  // ── Forecast Mode ──
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

  // ── Monthly grouping (from statement_history — bank-verified totals) ──
  const monthlySummaries: MonthlySummary[] = [];
  const seenMonthlyPeriods = new Set<string>();

  for (const row of statementHistory ?? []) {
    const periodKey = `${row.statement_period_start}|${row.statement_period_end}`;
    if (seenMonthlyPeriods.has(periodKey)) continue;
    seenMonthlyPeriods.add(periodKey);

    const periodEnd = row.statement_period_end;
    const month = periodEnd.slice(0, 7); // YYYY-MM of statement end date

    const label = new Date(periodEnd + "T00:00:00").toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
    });

    const income = row.total_income != null ? Number(row.total_income) : 0;
    const expenses = row.total_expenses != null ? Number(row.total_expenses) : 0;
    const opening = row.opening_balance != null ? Number(row.opening_balance) : 0;
    const closing = row.closing_balance != null ? Number(row.closing_balance) : 0;
    const netFlow = income - expenses;

    // Completeness: check that the statement covers a full ~month
    const periodDays = daysBetween(row.statement_period_start, row.statement_period_end);
    const completeness: "complete" | "partial" = periodDays >= 25 ? "complete" : "partial";

    // Statement period is the actual data range
    const dataFrom = row.statement_period_start;
    const dataTo = row.statement_period_end;

    monthlySummaries.push({
      month,
      label,
      openingBalance: opening,
      closingBalance: closing,
      totalIncome: income,
      totalExpenses: expenses,
      netFlow,
      transactionCount: row.transaction_count ?? 0,
      status: monthStatus(income, expenses),
      completeness,
      dataFrom,
      dataTo,
    });
  }
  monthlySummaries.sort((a, b) => b.month.localeCompare(a.month));

  // ── Category Breakdowns ──
  const categoryMap = new Map<string, { total: number; count: number; transactions: CategorySummary["transactions"] }>();
  for (const tx of workingTransactions) {
    if (tx.type !== "debit") continue;
    const coreKey = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
    const vendor = learningReport.vendors.get(coreKey);
    const subcategory = vendor?.subcategory ?? tx.subcategory ?? "uncategorized";
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

  function computeAmountTrend(occurrences: { date: string; amount: number }[]): string {
    if (occurrences.length < 3) return "insufficient-data";
    const firstHalf = occurrences.slice(0, Math.ceil(occurrences.length / 2));
    const secondHalf = occurrences.slice(Math.ceil(occurrences.length / 2));
    const firstAvg = firstHalf.reduce((s, o) => s + o.amount, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, o) => s + o.amount, 0) / secondHalf.length;
    const changePct = firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
    if (changePct > 0.1) return "increasing";
    if (changePct < -0.1) return "decreasing";
    return "stable";
  }

  // ── Vendor Learning Summaries ──
  const recurringVendors = displayRecurringVendors.map((v) => {
    let confidence = 0.4;
    if (v.appearanceCount >= 3) confidence += 0.2;
    if (v.months.length >= 2) confidence += 0.1;
    if (v.months.length >= 3) confidence += 0.1;
    if (v.isRecurring) confidence += 0.1;
    confidence = Math.min(1, confidence);

    const intelEntry = existingVendorMap.get(v.canonicalName.toLowerCase());
    const occurrences = v.dates.map((date, i) => ({
      date,
      amount: v.amounts[i] ?? 0,
      description: v.allDescriptions[i] ?? "",
    })).sort((a, b) => b.date.localeCompare(a.date));

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
      occurrences,
      monthlyFrequency: (v.appearanceCount / Math.max(1, v.months.length)).toFixed(1),
      amountTrend: computeAmountTrend(occurrences),
    };
  });

  const suspiciousVendors = displaySuspiciousVendors.map((v) => ({
    canonicalName: v.canonicalName,
    subcategory: v.subcategory,
    typicalAmount: v.typicalAmount,
    appearanceCount: v.appearanceCount,
    reason: v.isRecurring ? "Recurring personal-like expense" : "One-off personal-like expense",
  }));

  // ── Entity Extraction ──
  const txDescriptors = workingTransactions.map((tx) => ({ id: tx.id, description: tx.description }));
  const entities = extractEntities(txDescriptors);

  // ── Accumulated Stats ──
  const totalIncome = workingTransactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = workingTransactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  return {
    hasData: true,
    documents: statementSummaries,
    totalDocuments: accurateStatementCount,
    totalTransactions: accurateTransactionCount,

    currentPosition: {
      balance: currentPosition.balance,
      date: currentPosition.date,
      source: currentPosition.source,
      isEstimated: currentPosition.isEstimated,
      isStale: currentPosition.isStale,
      statementPeriodEnd: currentPosition.statementPeriodEnd,
    },

    statementInfo,

    balanceValidation: balanceValidation ? {
      valid: balanceValidation.valid,
      differencePence: balanceValidation.differencePence,
      message: balanceValidation.message,
    } : null,

    accumulated: {
      totalIncome,
      totalExpenses,
      netFlow: totalIncome - totalExpenses,
      statementCount: accurateStatementCount,
      totalTransactions: accurateTransactionCount,
      dateRange: workingTransactions.length > 0
        ? {
            from: workingTransactions.reduce((earliest, tx) => tx.date < earliest ? tx.date : earliest, workingTransactions[0].date),
            to: workingTransactions.reduce((latest, tx) => tx.date > latest ? tx.date : latest, workingTransactions[0].date),
          }
        : null,
    },

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
          monthlyOneOffExpenseAvg: learningReport.monthlyOneOffExpenseAvg,
          monthlyOneOffIncomeAvg: learningReport.monthlyOneOffIncomeAvg,
          oneOffHistoryMonths: learningReport.totalMonths,
        }
      : null,

    forecastError,

    monthly: monthlySummaries,

    categories,

    patterns: {
      recurringExpenses: displayPatterns.recurringExpenses.map((p) => ({
        merchant: (p as any).merchant,
        subcategory: (p as any).subcategory ?? "uncategorized",
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

    newVendors: displayNewVendors.map((v) => ({
      merchantRaw: v.merchantRaw,
      merchantNormalized: v.merchantNormalized,
      subcategory: v.subcategory,
      confidence: v.confidence,
      reasoning: v.reasoning,
    })),

    vendors: {
      total: displayTotalVendors,
      recurring: recurringVendors,
      suspicious: suspiciousVendors,
      oneOff: displayOneOffCandidates.map((name) => {
        const vendor = learningReport.vendors.get(name.toLowerCase());
        return {
          canonicalName: name,
          date: vendor?.dates[0] ?? "",
          amount: vendor?.amounts[0] ?? 0,
          description: vendor?.allDescriptions[0] ?? name,
          subcategory: vendor?.subcategory ?? "uncategorized",
        };
      }),
      oneOffIncome: displayOneOffIncomeCandidates.map((name) => {
        const vendor = learningReport.vendors.get(name.toLowerCase());
        return {
          canonicalName: name,
          date: vendor?.dates[0] ?? "",
          amount: vendor?.amounts[0] ?? 0,
          description: vendor?.allDescriptions[0] ?? name,
          subcategory: vendor?.subcategory ?? "uncategorized",
        };
      }),
      oneOffExpenses: displayOneOffExpenseCandidates.map((name) => {
        const vendor = learningReport.vendors.get(name.toLowerCase());
        return {
          canonicalName: name,
          date: vendor?.dates[0] ?? "",
          amount: vendor?.amounts[0] ?? 0,
          description: vendor?.allDescriptions[0] ?? name,
          subcategory: vendor?.subcategory ?? "uncategorized",
        };
      }),
    },

    crossMonthInsights: displayCrossMonthInsights,

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
  };
}
