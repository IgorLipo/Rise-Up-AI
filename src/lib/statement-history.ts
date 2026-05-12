import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { StatementData } from "@/types";

export interface StatementHistoryEntry {
  id: string;
  companyId: string;
  documentId: string | null;
  filename: string;
  uploadedAt: string;
  statementPeriodStart: string | null;
  statementPeriodEnd: string | null;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  netFlow: number;
  parseStatus: "ok" | "partial" | "failed";
}

export interface StatementSummary {
  month: string;
  label: string;
  statementCount: number;
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  openingBalance: number;
  closingBalance: number;
  transactionCount: number;
  entries: StatementHistoryEntry[];
}

// Record a newly processed statement in permanent history
export async function recordStatement(params: {
  companyId: string;
  documentId?: string;
  filename: string;
  data: StatementData;
  parseStatus?: "ok" | "partial" | "failed";
}): Promise<StatementHistoryEntry | null> {
  const supabase = await createServerSupabase();

  const income = params.data.transactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const expenses = params.data.transactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);
  const netFlow = income - expenses;

  const periodStart = params.data.accountInfo?.statementPeriod?.from ?? null;
  const periodEnd = params.data.accountInfo?.statementPeriod?.to ?? null;
  const openingBalance = params.data.accountInfo?.openingBalance ?? 0;
  const closingBalance = params.data.accountInfo?.closingBalance ?? 0;

  const { data, error } = await supabase
    .from("statement_history")
    .insert({
      company_id: params.companyId,
      document_id: params.documentId ?? null,
      filename: params.filename,
      statement_period_start: periodStart,
      statement_period_end: periodEnd,
      opening_balance: openingBalance,
      closing_balance: closingBalance,
      total_income: income,
      total_expenses: expenses,
      transaction_count: params.data.transactions.length,
      net_flow: netFlow,
      parse_status: params.parseStatus ?? "ok",
    })
    .select()
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    documentId: data.document_id,
    filename: data.filename,
    uploadedAt: data.uploaded_at,
    statementPeriodStart: data.statement_period_start,
    statementPeriodEnd: data.statement_period_end,
    openingBalance: Number(data.opening_balance ?? 0),
    closingBalance: Number(data.closing_balance ?? 0),
    totalIncome: Number(data.total_income ?? 0),
    totalExpenses: Number(data.total_expenses ?? 0),
    transactionCount: data.transaction_count ?? 0,
    netFlow: Number(data.net_flow ?? 0),
    parseStatus: data.parse_status as "ok" | "partial" | "failed",
  };
}

interface StatementHistoryRow {
  id: string;
  company_id: string;
  document_id: string | null;
  filename: string;
  uploaded_at: string;
  statement_period_start: string | null;
  statement_period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  total_income: number | null;
  total_expenses: number | null;
  transaction_count: number | null;
  net_flow: number | null;
  parse_status: string;
}

function mapStatementHistoryRow(d: StatementHistoryRow): StatementHistoryEntry {
  return {
    id: d.id,
    companyId: d.company_id,
    documentId: d.document_id,
    filename: d.filename,
    uploadedAt: d.uploaded_at,
    statementPeriodStart: d.statement_period_start,
    statementPeriodEnd: d.statement_period_end,
    openingBalance: Number(d.opening_balance ?? 0),
    closingBalance: Number(d.closing_balance ?? 0),
    totalIncome: Number(d.total_income ?? 0),
    totalExpenses: Number(d.total_expenses ?? 0),
    transactionCount: d.transaction_count ?? 0,
    netFlow: Number(d.net_flow ?? 0),
    parseStatus: d.parse_status as "ok" | "partial" | "failed",
  };
}

// List all statements for a company, newest first
export async function listStatementHistory(companyId: string): Promise<StatementHistoryEntry[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("statement_history")
    .select("*")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false })
    .limit(50);

  if (!data) return [];

  return (data as StatementHistoryRow[]).map(mapStatementHistoryRow);
}

// Group statements by calendar month for monthly views
export function groupStatementsByMonth(entries: StatementHistoryEntry[]): StatementSummary[] {
  const byMonth = new Map<string, StatementHistoryEntry[]>();

  for (const entry of entries) {
    const monthKey = entry.statementPeriodStart
      ? entry.statementPeriodStart.slice(0, 7)
      : entry.uploadedAt.slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey)!.push(entry);
  }

  const summaries: StatementSummary[] = [];
  for (const [month, stmts] of byMonth) {
    const label = new Date(month + "-01").toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
    });

    summaries.push({
      month,
      label,
      statementCount: stmts.length,
      totalIncome: stmts.reduce((s, e) => s + e.totalIncome, 0),
      totalExpenses: stmts.reduce((s, e) => s + e.totalExpenses, 0),
      netFlow: stmts.reduce((s, e) => s + e.netFlow, 0),
      openingBalance: stmts[stmts.length - 1]?.openingBalance ?? 0,
      closingBalance: stmts[0]?.closingBalance ?? 0,
      transactionCount: stmts.reduce((s, e) => s + e.transactionCount, 0),
      entries: stmts,
    });
  }

  return summaries.sort((a, b) => b.month.localeCompare(a.month));
}

// Accumulated stats across all statements
export function accumulatedStats(entries: StatementHistoryEntry[]) {
  return {
    totalIncome: entries.reduce((s, e) => s + e.totalIncome, 0),
    totalExpenses: entries.reduce((s, e) => s + e.totalExpenses, 0),
    netFlow: entries.reduce((s, e) => s + e.netFlow, 0),
    statementCount: entries.length,
    totalTransactions: entries.reduce((s, e) => s + e.transactionCount, 0),
    monthlyAverage: entries.length > 0 ? {
      income: entries.reduce((s, e) => s + e.totalIncome, 0) / entries.length,
      expenses: entries.reduce((s, e) => s + e.totalExpenses, 0) / entries.length,
      netFlow: entries.reduce((s, e) => s + e.netFlow, 0) / entries.length,
    } : null,
    dateRange: entries.length > 0 ? {
      from: entries[entries.length - 1].statementPeriodStart ?? entries[entries.length - 1].uploadedAt,
      to: entries[0].statementPeriodEnd ?? entries[0].uploadedAt,
    } : null,
  };
}
