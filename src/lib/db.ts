import { supabase } from "./supabase";
import type { StatementData, AIInsights, SpendReviewResult, AnalysisMode } from "@/types";
import type { DocumentHistoryEntry } from "./history";

export interface DocumentRecord {
  id: string;
  filename: string;
  uploaded_at: string;
  mode: AnalysisMode;
  statement_data: StatementData;
  insights: AIInsights | SpendReviewResult | null;
}

export async function saveDocument(
  id: string,
  filename: string,
  mode: AnalysisMode,
  data: StatementData,
  insights: AIInsights | SpendReviewResult | null,
): Promise<boolean> {
  const { error } = await supabase.from("documents").upsert({
    id,
    filename,
    uploaded_at: new Date().toISOString(),
    mode,
    statement_data: data as unknown as Record<string, unknown>,
    insights: insights as unknown as Record<string, unknown> | null,
  });
  return !error;
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    filename: data.filename,
    uploaded_at: data.uploaded_at,
    mode: data.mode,
    statement_data: data.statement_data as unknown as StatementData,
    insights: data.insights as unknown as AIInsights | SpendReviewResult | null,
  };
}

export async function listDocuments(): Promise<DocumentHistoryEntry[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, uploaded_at, mode, insights, statement_data")
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
