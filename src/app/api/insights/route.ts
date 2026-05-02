import { NextRequest, NextResponse } from "next/server";
import type { StatementData, AnalysisMode } from "@/types";
import { generateInsights, generateFallbackInsights } from "@/lib/ai/insights";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = body.data as StatementData;
    const mode: AnalysisMode = body.mode === "business" ? "business" : "personal";

    if (!data?.transactions?.length) {
      return NextResponse.json(
        { error: "No transaction data provided" },
        { status: 400 },
      );
    }

    let insights;
    if (process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY) {
      try {
        insights = await generateInsights(data, mode);
      } catch {
        insights = generateFallbackInsights(data, mode);
      }
    } else {
      insights = generateFallbackInsights(data, mode);
    }

    return NextResponse.json({ success: true, insights, mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
