import "server-only";

import { createServerSupabase } from "./supabase/server";
import type { StatementData, AIInsights, SpendReviewResult, AnalysisMode } from "@/types";
import type { DocumentHistoryEntry } from "./history";

export interface DocumentRecord {
  id: string;
  filename: string;
  uploaded_at: string;
  mode: AnalysisMode;
  statement_data: StatementData;
  insights: AIInsights | SpendReviewResult | null;
  company_id: string;
  uploaded_by: string;
}

export async function saveDocument(
  id: string,
  filename: string,
  mode: AnalysisMode,
  data: StatementData,
  insights: AIInsights | SpendReviewResult | null,
  companyId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("documents").upsert({
    id,
    filename,
    uploaded_at: new Date().toISOString(),
    mode,
    statement_data: data as unknown as Record<string, unknown>,
    insights: insights as unknown as Record<string, unknown> | null,
    company_id: companyId,
    uploaded_by: userId,
  });

  if (error) return false;

  // Also record to statement_history for accumulated learning
  const income = data.transactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = data.transactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  const { error: historyError } = await supabase.from("statement_history").insert({
    company_id: companyId,
    document_id: id,
    filename,
    statement_period_start: data.accountInfo?.statementPeriod?.from ?? null,
    statement_period_end: data.accountInfo?.statementPeriod?.to ?? null,
    opening_balance: data.accountInfo?.openingBalance ?? 0,
    closing_balance: data.accountInfo?.closingBalance ?? 0,
    total_income: income,
    total_expenses: expenses,
    transaction_count: data.transactions.length,
    net_flow: income - expenses,
    parse_status: "ok",
  });

  if (historyError) {
    console.error("Failed to record statement history:", historyError);
  }

  return true;
}

export async function getDocument(id: string, companyId: string): Promise<DocumentRecord | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    filename: data.filename,
    uploaded_at: data.uploaded_at,
    mode: data.mode,
    statement_data: data.statement_data as unknown as StatementData,
    insights: data.insights as unknown as AIInsights | SpendReviewResult | null,
    company_id: data.company_id,
    uploaded_by: data.uploaded_by,
  };
}

export async function listDocuments(companyId: string): Promise<DocumentHistoryEntry[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, uploaded_at, mode, insights, statement_data")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((d) => {
    const insights = d.insights as Record<string, unknown> | null;
    const stmt = d.statement_data as Record<string, unknown> | null;
    const bizInsights = d.mode === "business" ? insights : null;
    const personal = d.mode === "personal" ? insights : null;
    const bizItems = bizInsights && Array.isArray((bizInsights as any).insights)
      ? (bizInsights as any).insights
      : [];
    const personalRecs = personal && Array.isArray((personal as any).topRecommendations)
      ? (personal as any).topRecommendations
      : [];

    return {
      id: d.id,
      filename: d.filename,
      uploadedAt: d.uploaded_at,
      mode: d.mode as AnalysisMode,
      insightCount: bizItems.length || personalRecs.length || 0,
      topFinding: bizItems[0]?.short_title ?? personalRecs[0] ?? "",
      cashFlowHealth: (bizInsights as any)?.executive_summary?.estimated_monthly_savings?.amount > 0
        ? "good" : (personal as any)?.cashFlowHealth ?? "fair",
      netFlow: (stmt?.summary as any)?.netFlow ?? 0,
    };
  });
}
