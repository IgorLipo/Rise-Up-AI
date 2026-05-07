import { NextRequest, NextResponse } from "next/server";
import { generateInsightCard } from "@/lib/ai/forecast-insights";
import { detectAll } from "@/lib/detection";
import { generateForecast } from "@/lib/forecast";
import { getDocument } from "@/lib/db";

const PLACEHOLDER_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");
  if (!docId) {
    return NextResponse.json({ success: false, error: "docId required" }, { status: 400 });
  }

  const doc = await getDocument(docId, PLACEHOLDER_COMPANY_ID);
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
