import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateInsightCard } from "@/lib/ai/forecast-insights";
import { detectAllAsync } from "@/lib/detection";
import { generateForecast } from "@/lib/forecast";
import { listVendors, saveVendors } from "@/lib/vendor-db";
import type { AIClassification } from "@/lib/detection/ai-classifier";
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

  const { patterns, newVendors } = await detectAllAsync(data.transactions, knownVendors);
  const forecast = generateForecast(patterns, data.summary.netFlow);
  const insight = await generateInsightCard(forecast, patterns);

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
    }))).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    insight: insight ?? {
      headline: forecast.statusReason,
      summary: "",
      severity: forecast.status === "safe" ? "info" : forecast.status === "watch" ? "warning" : "critical",
    },
  });
}
