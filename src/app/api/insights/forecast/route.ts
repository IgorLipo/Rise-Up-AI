import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateInsightCard } from "@/lib/ai/forecast-insights";
import { detectAll } from "@/lib/detection";
import { generateForecast } from "@/lib/forecast";
import { getDocument } from "@/lib/db";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member?.company_id) {
    return NextResponse.json({ success: false, error: "No company found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");
  if (!docId) {
    return NextResponse.json({ success: false, error: "docId required" }, { status: 400 });
  }

  const doc = await getDocument(docId, member.company_id);
  if (!doc) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }

  const data = doc.statement_data;
  if (!data?.transactions?.length) {
    return NextResponse.json({ success: false, error: "No transactions" }, { status: 400 });
  }

  const patterns = detectAll(data.transactions);
  const forecast = generateForecast(patterns, data.summary.netFlow);
  const insight = await generateInsightCard(forecast, patterns);

  return NextResponse.json({
    success: true,
    insight: insight ?? {
      headline: forecast.statusReason,
      summary: "",
      severity: forecast.status === "safe" ? "info" : forecast.status === "watch" ? "warning" : "critical",
    },
  });
}
