import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { coreMerchant, normalizeMerchant } from "@/lib/detection/merchant-normalizer";
import { classifyWithAI } from "@/lib/detection/ai-classifier";
import type { Transaction } from "@/types";

export async function POST(req: NextRequest) {
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

  // Fetch all documents for this company
  const { data: docs } = await supabase
    .from("documents")
    .select("id, statement_data")
    .eq("company_id", member.company_id);

  if (!docs?.length) {
    return NextResponse.json({ rescanned: 0, reclassified: [], message: "No documents found" });
  }

  // Collect all transactions
  const allTx: Array<{ id: string; description: string; date: string }> = [];
  for (const doc of docs) {
    const stmt = doc.statement_data as Record<string, unknown> | null;
    const transactions = (stmt as any)?.transactions as Transaction[] | undefined;
    if (transactions) {
      for (const tx of transactions) {
        allTx.push({ id: tx.id, description: tx.description, date: tx.date });
      }
    }
  }

  // Build context: all known vendors and their categories
  const vendorContext = new Map<string, { count: number; subcategory: string; amountRange: string }>();
  for (const tx of allTx) {
    const core = coreMerchant(normalizeMerchant(tx.description)).toLowerCase();
    if (!core || core.length < 2) continue;
    const existing = vendorContext.get(core);
    if (existing) {
      existing.count++;
    } else {
      vendorContext.set(core, { count: 1, subcategory: "unknown", amountRange: "" });
    }
  }

  // Find one-off merchants (appearing only once) to rescan
  const oneOffs = [...vendorContext.entries()]
    .filter(([, info]) => info.count === 1)
    .map(([merchant]) => merchant);

  if (oneOffs.length === 0) {
    return NextResponse.json({ rescanned: 0, reclassified: [], message: "No one-off transactions to rescan" });
  }

  // Build rich context for the AI
  const contextForAI = [...vendorContext.entries()]
    .filter(([, info]) => info.count >= 2)
    .map(([merchant, info]) => `"${merchant}" (appears ${info.count}x)`)
    .slice(0, 200) // Limit context to top 200 recurring vendors
    .join("\n");

  // Rescan one-offs through AI with full context
  const result = await classifyWithAI(oneOffs);

  // Collect reclassified merchants
  const reclassified = result.newVendors.map((v) => ({
    merchant: v.merchantRaw,
    normalized: v.merchantNormalized,
    subcategory: v.subcategory,
    confidence: v.confidence,
    reasoning: v.reasoning,
  }));

  return NextResponse.json({
    rescanned: oneOffs.length,
    reclassified,
    contextVendors: vendorContext.size,
    recurringContext: contextForAI.length > 0 ? `${[...vendorContext.values()].filter((v) => v.count >= 2).length} recurring vendors as context` : "no recurring context",
  });
}
