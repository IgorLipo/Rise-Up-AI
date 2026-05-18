// Re-classify every stored transaction with the latest classifier.
//
// Background: transactions are persisted inside documents.statement_data JSON
// when uploaded, with a subcategory snapshot. Improvements to the classifier
// don't retroactively touch stored data, which is why old uploads can show
// stale "uncategorized" tags in the UI.
//
// This endpoint walks every document for the caller's company, runs the
// classifier afresh on each transaction's description, updates the
// statement_data JSON in place, then invalidates the aggregate cache so the
// next dashboard fetch picks up the new values.
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { classifySubcategory } from "@/lib/detection/subcategory-classifier";
import type { Transaction, StatementData } from "@/types";

// Bump this whenever the classifier rules change. Stored on a per-document
// basis (in statement_data) so the dashboard can detect stale documents.
export const CLASSIFIER_VERSION = 3;

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!member?.company_id) return NextResponse.json({ error: "No company" }, { status: 404 });
  const companyId = member.company_id;

  const { data: docs, error } = await supabase
    .from("documents")
    .select("id, statement_data")
    .eq("company_id", companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!docs?.length) return NextResponse.json({ updatedDocuments: 0, updatedTransactions: 0 });

  let updatedDocs = 0;
  let updatedTx = 0;
  let totalTx = 0;
  const reclassifiedByCategory: Record<string, number> = {};

  for (const doc of docs) {
    const stmt = doc.statement_data as unknown as StatementData & {
      classifierVersion?: number;
    };
    if (!stmt?.transactions?.length) continue;

    let docChanged = false;
    const newTx: Transaction[] = stmt.transactions.map((tx) => {
      totalTx++;
      const result = classifySubcategory(tx.description);
      // Don't overwrite user corrections — they have a separate marker.
      if ((tx as Transaction & { userCorrected?: boolean }).userCorrected) {
        return tx;
      }
      if (tx.subcategory !== result.subcategory) {
        docChanged = true;
        updatedTx++;
        reclassifiedByCategory[result.subcategory] =
          (reclassifiedByCategory[result.subcategory] ?? 0) + 1;
        return { ...tx, subcategory: result.subcategory } as Transaction;
      }
      return tx;
    });

    if (docChanged || stmt.classifierVersion !== CLASSIFIER_VERSION) {
      const updatedStmt = {
        ...stmt,
        transactions: newTx,
        classifierVersion: CLASSIFIER_VERSION,
      };
      const { error: updErr } = await supabase
        .from("documents")
        .update({ statement_data: updatedStmt })
        .eq("id", doc.id);
      if (!updErr) updatedDocs++;
    }
  }

  // Invalidate aggregate cache so the dashboard recomputes on next fetch.
  await supabase
    .from("company_aggregate_cache")
    .upsert({
      company_id: companyId,
      aggregate_data: {},
      needs_recalculation: true,
    });

  return NextResponse.json({
    updatedDocuments: updatedDocs,
    updatedTransactions: updatedTx,
    totalTransactions: totalTx,
    classifierVersion: CLASSIFIER_VERSION,
    byCategory: reclassifiedByCategory,
  });
}
