import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { detectAllAsync } from "@/lib/detection";
import { generateForecast } from "@/lib/forecast";
import { listVendors, saveVendors } from "@/lib/vendor-db";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";
import type { AIClassification } from "@/lib/detection/ai-classifier";
import type { Transaction, StatementData } from "@/types";

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

  // Fetch ALL documents for this company
  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename, uploaded_at, statement_data")
    .eq("company_id", member.company_id)
    .order("uploaded_at", { ascending: true });

  if (!docs || docs.length === 0) {
    return NextResponse.json({ documents: [], transactionCount: 0 });
  }

  // Aggregate all transactions from all statements
  const allTransactions: Transaction[] = [];
  const statementSummaries: Array<{
    period: string;
    closingBalance: number;
    transactionCount: number;
  }> = [];

  for (const doc of docs) {
    const stmt = doc.statement_data as unknown as StatementData;
    if (stmt?.transactions) {
      allTransactions.push(...stmt.transactions);
      const period = stmt.accountInfo?.statementPeriod
        ? `${stmt.accountInfo.statementPeriod.from} to ${stmt.accountInfo.statementPeriod.to}`
        : doc.filename;
      statementSummaries.push({
        period,
        closingBalance: stmt.accountInfo?.closingBalance ?? 0,
        transactionCount: stmt.transactions.length,
      });
    }
  }

  // Get current balance from the most recent statement
  const latestDoc = docs[docs.length - 1];
  const latestStmt = latestDoc.statement_data as unknown as StatementData;
  const currentBalance = latestStmt?.accountInfo?.closingBalance
    ?? allTransactions.reduce((sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount), 0);

  // Load known vendor classifications from DB
  const vendors = await listVendors(member.company_id);
  const knownVendors = new Map<string, AIClassification>();
  for (const v of vendors) {
    knownVendors.set(v.merchantNormalized, {
      subcategory: v.subcategory,
      confidence: v.confidence,
      reasoning: `From ${v.source}`,
    });
  }

  // Run pattern detection on ALL historical transactions with vendor knowledge
  const { patterns, newVendors } = await detectAllAsync(allTransactions, knownVendors);
  const forecast = generateForecast(patterns, currentBalance);

  // Persist newly learned vendors
  if (newVendors.length > 0) {
    saveVendors(newVendors.map((v) => ({
      companyId: member.company_id,
      merchantRaw: v.merchantRaw,
      merchantNormalized: v.merchantNormalized,
      subcategory: v.subcategory,
      category: v.subcategory,
      confidence: v.confidence,
      source: "ai" as const,
      metadata: { reasoning: v.reasoning },
    }))).catch(() => {}); // fire-and-forget
  }

  return NextResponse.json({
    documents: statementSummaries,
    totalDocuments: docs.length,
    totalTransactions: allTransactions.length,
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
    },
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
  });
}
