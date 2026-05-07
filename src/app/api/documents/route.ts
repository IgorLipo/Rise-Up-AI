import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { listDocuments, saveDocument } from "@/lib/db";
import type { StatementData, AIInsights, SpendReviewResult, AnalysisMode } from "@/types";

async function getAuthContext() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return { userId: user.id, companyId: member?.company_id ?? null };
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx?.companyId) {
    return NextResponse.json({ success: true, documents: [] });
  }
  const docs = await listDocuments(ctx.companyId);
  return NextResponse.json({ success: true, documents: docs });
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx?.companyId) {
      return NextResponse.json({ success: false, error: "No company found" }, { status: 403 });
    }

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
      ctx.companyId,
      ctx.userId,
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
