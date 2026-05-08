import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { compareForecastVsActuals, summarizeAccuracy, type ForecastSnapshot, type MonthActuals } from "@/lib/forecast/accuracy-tracker";
import type { Transaction } from "@/types";

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

  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename, statement_data")
    .eq("company_id", member.company_id)
    .order("uploaded_at", { ascending: true });

  if (!docs?.length || docs.length < 2) {
    return NextResponse.json({
      summary: { overall: { avgIncomeMAPE: 0, avgExpenseMAPE: 0, avgBalanceError: 0, avgConfidence: 0, totalMonthsCompared: 0 }, months: [], trend: "insufficient-data" },
      message: "Need at least 2 months of statements for accuracy comparison",
    });
  }

  // Build month-by-month actuals from statement data
  const actuals: Record<string, MonthActuals> = {};
  for (const doc of docs) {
    const stmt = doc.statement_data as Record<string, unknown> | null;
    const transactions = (stmt as any)?.transactions as Transaction[] | undefined;
    const closingBalance = (stmt as any)?.accountInfo?.closingBalance as number | undefined;

    if (!transactions?.length) continue;

    // Determine which month this statement covers
    const month = transactions[0]?.date?.slice(0, 7);
    if (!month) continue;

    const income = transactions.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);

    actuals[month] = {
      totalIncome: income,
      totalExpenses: expenses,
      closingBalance: closingBalance ?? 0,
    };
  }

  // Build forecasts from what the system would have predicted
  // For past months, we use the actual data from the prior month as a simplified "forecast"
  const forecasts: ForecastSnapshot[] = [];
  const months = Object.keys(actuals).sort();

  for (let i = 1; i < months.length; i++) {
    const prevMonth = months[i - 1];
    const currentMonth = months[i];
    const prevActuals = actuals[prevMonth];

    // Simple forecast: assume same income/expenses as last month
    forecasts.push({
      month: currentMonth,
      predictedIncome: prevActuals.totalIncome,
      predictedExpenses: prevActuals.totalExpenses,
      predictedMonthEnd: actuals[currentMonth]?.closingBalance
        ? actuals[currentMonth]?.closingBalance - (prevActuals.totalIncome - prevActuals.totalExpenses)
        : 0,
      confidence: 0.5,
    });
  }

  const results = compareForecastVsActuals(forecasts, actuals);
  const summary = summarizeAccuracy(results);

  return NextResponse.json({
    summary,
    details: results,
  });
}
