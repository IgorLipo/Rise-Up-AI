import { NextRequest, NextResponse } from "next/server";
import { listDocuments, saveDocument } from "@/lib/db";
import type { StatementData, AIInsights, SpendReviewResult, AnalysisMode } from "@/types";

// TODO: replace with real companyId/userId from auth once middleware is in place
const PLACEHOLDER_COMPANY_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function GET() {
  const docs = await listDocuments(PLACEHOLDER_COMPANY_ID);
  return NextResponse.json({ success: true, documents: docs });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, filename, mode, data, insights } = body as {
      id: string;
      filename: string;
      mode: AnalysisMode;
      data: StatementData;
      insights: AIInsights | SpendReviewResult | null;
    };

    const ok = await saveDocument(
      id,
      filename,
      mode,
      data,
      insights,
      PLACEHOLDER_COMPANY_ID,
      PLACEHOLDER_USER_ID,
    );

    if (!ok) {
      return NextResponse.json({ success: false, error: "Failed to save document" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
