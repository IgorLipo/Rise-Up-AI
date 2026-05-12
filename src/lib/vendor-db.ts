import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";
import type { Subcategory } from "@/lib/detection/subcategory-classifier";

export interface VendorEntry {
  id?: string;
  companyId: string;
  merchantRaw: string;
  merchantNormalized: string;
  subcategory: Subcategory;
  category: string;
  confidence: number;
  source: "ai" | "user" | "system";
  metadata?: Record<string, unknown>;
}

export interface UserCorrection {
  companyId: string;
  userId: string;
  transactionDescription: string;
  originalSubcategory: string;
  correctedSubcategory: string;
}

// Look up a merchant in the knowledge base
export async function lookupVendor(
  companyId: string,
  description: string
): Promise<VendorEntry | null> {
  const supabase = await createServerSupabase();
  const normalized = coreMerchant(normalizeMerchant(description)).toLowerCase();

  const { data } = await supabase
    .from("vendor_knowledge")
    .select("*")
    .eq("company_id", companyId)
    .eq("merchant_normalized", normalized)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    merchantRaw: data.merchant_raw,
    merchantNormalized: data.merchant_normalized,
    subcategory: data.subcategory,
    category: data.category,
    confidence: data.confidence,
    source: data.source,
    metadata: data.metadata as Record<string, unknown> | undefined,
  };
}

// Save or update vendor knowledge
export async function saveVendor(entry: VendorEntry): Promise<void> {
  const supabase = await createServerSupabase();
  const normalized = coreMerchant(normalizeMerchant(entry.merchantRaw)).toLowerCase();

  await supabase.from("vendor_knowledge").upsert({
    company_id: entry.companyId,
    merchant_raw: entry.merchantRaw,
    merchant_normalized: normalized,
    subcategory: entry.subcategory,
    category: entry.category,
    confidence: entry.confidence,
    source: entry.source,
    metadata: entry.metadata ?? {},
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "company_id, merchant_normalized",
  });
}

// Batch save vendors
export async function saveVendors(entries: VendorEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const supabase = await createServerSupabase();

  const rows = entries.map((e) => ({
    company_id: e.companyId,
    merchant_raw: e.merchantRaw,
    merchant_normalized: coreMerchant(normalizeMerchant(e.merchantRaw)).toLowerCase(),
    subcategory: e.subcategory,
    category: e.category,
    confidence: e.confidence,
    source: e.source,
    metadata: e.metadata ?? {},
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("vendor_knowledge").upsert(rows, {
    onConflict: "company_id, merchant_normalized",
  });
}

interface VendorKnowledgeRow {
  id: string;
  company_id: string;
  merchant_raw: string;
  merchant_normalized: string;
  subcategory: string;
  category: string;
  confidence: number;
  source: string;
  metadata: Record<string, unknown> | null;
}

function mapVendorKnowledgeRow(d: VendorKnowledgeRow): VendorEntry {
  return {
    id: d.id,
    companyId: d.company_id,
    merchantRaw: d.merchant_raw,
    merchantNormalized: d.merchant_normalized,
    subcategory: d.subcategory as VendorEntry["subcategory"],
    category: d.category,
    confidence: d.confidence,
    source: d.source as VendorEntry["source"],
    metadata: d.metadata ?? undefined,
  };
}

// Get all vendor knowledge for a company
export async function listVendors(companyId: string): Promise<VendorEntry[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("vendor_knowledge")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (!data) return [];

  return (data as VendorKnowledgeRow[]).map(mapVendorKnowledgeRow);
}

// Save a user correction
export async function saveCorrection(correction: UserCorrection): Promise<void> {
  const supabase = await createServerSupabase();

  // Save the correction log
  await supabase.from("user_corrections").insert({
    company_id: correction.companyId,
    user_id: correction.userId,
    transaction_description: correction.transactionDescription,
    original_subcategory: correction.originalSubcategory,
    corrected_subcategory: correction.correctedSubcategory,
  });

  // Update vendor knowledge with user correction (high confidence)
  await saveVendor({
    companyId: correction.companyId,
    merchantRaw: correction.transactionDescription,
    merchantNormalized: coreMerchant(normalizeMerchant(correction.transactionDescription)),
    subcategory: correction.correctedSubcategory as Subcategory,
    category: correction.correctedSubcategory,
    confidence: 1.0,
    source: "user",
  });
}
