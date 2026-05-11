import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { runUploadPipeline } from "@/lib/pipeline/upload-pipeline";
import type { StatementData, Transaction } from "@/types";

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

export async function POST() {
  try {
    const ctx = await getAuthContext();
    if (!ctx?.companyId) {
      return NextResponse.json({ success: false, error: "No company found" }, { status: 403 });
    }

    const supabase = await createServerSupabase();

    // Fetch all documents for this company, ordered by upload date
    const { data: docs, error } = await supabase
      .from("documents")
      .select("statement_data, uploaded_at")
      .eq("company_id", ctx.companyId)
      .order("uploaded_at", { ascending: true });

    if (error || !docs?.length) {
      return NextResponse.json({ success: false, error: "No documents found" }, { status: 404 });
    }

    // Collect all transactions from all documents
    const allTransactions: Transaction[] = [];
    let latestDoc: { data: StatementData; uploadedAt: string } | null = null;

    for (const doc of docs) {
      const data = doc.statement_data as unknown as StatementData;
      if (data?.transactions) {
        allTransactions.push(...data.transactions);
      }
      if (!latestDoc || doc.uploaded_at > latestDoc.uploadedAt) {
        latestDoc = { data, uploadedAt: doc.uploaded_at };
      }
    }

    if (!latestDoc) {
      return NextResponse.json({ success: false, error: "No statement data found" }, { status: 404 });
    }

    const summary = await runUploadPipeline(
      latestDoc.data,
      allTransactions,
      ctx.companyId,
    );

    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
