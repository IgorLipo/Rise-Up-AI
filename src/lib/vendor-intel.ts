import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";
import type { Subcategory } from "@/lib/detection/subcategory-classifier";

export interface VendorIntelEntry {
  id?: string;
  companyId: string;
  canonicalName: string;
  aliases: string[];
  subcategory: Subcategory;
  category: string;
  typicalAmountMin: number | null;
  typicalAmountMax: number | null;
  typicalAmountAvg: number | null;
  recurrencePattern: string | null;
  recurrenceConfidence: number;
  firstSeenDate: string | null;
  lastSeenDate: string | null;
  appearanceCount: number;
  monthsSeen: string[];
  linkedProperty: string | null;
  linkedPerson: string | null;
  isBusiness: boolean | null;
  isSuspicious: boolean;
  isPersonal: boolean;
  needsReview: boolean;
  includeInForecast: boolean;
  aiExplanation: string | null;
  confidence: number;
  source: "ai" | "user" | "system" | "keyword";
}

interface RawVendorRow {
  id: string;
  company_id: string;
  canonical_name: string;
  aliases: string[];
  subcategory: string;
  category: string | null;
  typical_amount_min: number | null;
  typical_amount_max: number | null;
  typical_amount_avg: number | null;
  recurrence_pattern: string | null;
  recurrence_confidence: number;
  first_seen_date: string | null;
  last_seen_date: string | null;
  appearance_count: number;
  months_seen: string[];
  linked_property: string | null;
  linked_person: string | null;
  is_business: boolean | null;
  is_suspicious: boolean;
  is_personal: boolean;
  needs_review: boolean;
  include_in_forecast: boolean;
  ai_explanation: string | null;
  confidence: number;
  source: string;
}

function mapRow(row: RawVendorRow): VendorIntelEntry {
  return {
    id: row.id,
    companyId: row.company_id,
    canonicalName: row.canonical_name,
    aliases: row.aliases ?? [],
    subcategory: row.subcategory as Subcategory,
    category: row.category ?? row.subcategory,
    typicalAmountMin: row.typical_amount_min ? Number(row.typical_amount_min) : null,
    typicalAmountMax: row.typical_amount_max ? Number(row.typical_amount_max) : null,
    typicalAmountAvg: row.typical_amount_avg ? Number(row.typical_amount_avg) : null,
    recurrencePattern: row.recurrence_pattern,
    recurrenceConfidence: Number(row.recurrence_confidence ?? 0),
    firstSeenDate: row.first_seen_date,
    lastSeenDate: row.last_seen_date,
    appearanceCount: row.appearance_count ?? 1,
    monthsSeen: row.months_seen ?? [],
    linkedProperty: row.linked_property,
    linkedPerson: row.linked_person,
    isBusiness: row.is_business,
    isSuspicious: row.is_suspicious ?? false,
    isPersonal: row.is_personal ?? false,
    needsReview: row.needs_review ?? false,
    includeInForecast: row.include_in_forecast ?? true,
    aiExplanation: row.ai_explanation,
    confidence: Number(row.confidence ?? 0.5),
    source: (row.source as "ai" | "user" | "system" | "keyword") ?? "ai",
  };
}

// Look up a vendor by normalized name
export async function lookupVendorIntel(
  companyId: string,
  description: string
): Promise<VendorIntelEntry | null> {
  const supabase = await createServerSupabase();
  const normalized = coreMerchant(normalizeMerchant(description)).toLowerCase();

  const { data } = await supabase
    .from("vendor_intel")
    .select("*")
    .eq("company_id", companyId)
    .eq("canonical_name", normalized)
    .maybeSingle();

  if (!data) return null;
  return mapRow(data as RawVendorRow);
}

// Look up vendor by alias match (for fuzzy matching across different spellings)
export async function lookupVendorByAlias(
  companyId: string,
  description: string
): Promise<VendorIntelEntry | null> {
  const supabase = await createServerSupabase();
  const normalized = coreMerchant(normalizeMerchant(description)).toLowerCase();

  // Try exact match first
  let { data } = await supabase
    .from("vendor_intel")
    .select("*")
    .eq("company_id", companyId)
    .eq("canonical_name", normalized)
    .maybeSingle();

  if (!data) {
    // Try alias array contains match
    const { data: aliasData } = await supabase
      .from("vendor_intel")
      .select("*")
      .eq("company_id", companyId)
      .contains("aliases", [normalized])
      .maybeSingle();
    data = aliasData;
  }

  if (!data) return null;
  return mapRow(data as RawVendorRow);
}

// Save or update vendor intelligence
export async function upsertVendorIntel(entry: VendorIntelEntry): Promise<void> {
  const supabase = await createServerSupabase();
  const name = coreMerchant(normalizeMerchant(entry.canonicalName)).toLowerCase();

  await supabase.from("vendor_intel").upsert({
    company_id: entry.companyId,
    canonical_name: name,
    aliases: entry.aliases,
    subcategory: entry.subcategory,
    category: entry.category,
    typical_amount_min: entry.typicalAmountMin,
    typical_amount_max: entry.typicalAmountMax,
    typical_amount_avg: entry.typicalAmountAvg,
    recurrence_pattern: entry.recurrencePattern,
    recurrence_confidence: entry.recurrenceConfidence,
    first_seen_date: entry.firstSeenDate,
    last_seen_date: entry.lastSeenDate,
    appearance_count: entry.appearanceCount,
    months_seen: entry.monthsSeen,
    linked_property: entry.linkedProperty,
    linked_person: entry.linkedPerson,
    is_business: entry.isBusiness,
    is_suspicious: entry.isSuspicious,
    is_personal: entry.isPersonal,
    needs_review: entry.needsReview,
    include_in_forecast: entry.includeInForecast,
    ai_explanation: entry.aiExplanation,
    confidence: entry.confidence,
    source: entry.source,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "company_id, canonical_name",
  });
}

// Batch upsert
export async function upsertVendorIntelBatch(entries: VendorIntelEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const supabase = await createServerSupabase();

  const rows = entries.map((e) => ({
    company_id: e.companyId,
    canonical_name: coreMerchant(normalizeMerchant(e.canonicalName)).toLowerCase(),
    aliases: e.aliases,
    subcategory: e.subcategory,
    category: e.category,
    typical_amount_min: e.typicalAmountMin,
    typical_amount_max: e.typicalAmountMax,
    typical_amount_avg: e.typicalAmountAvg,
    recurrence_pattern: e.recurrencePattern,
    recurrence_confidence: e.recurrenceConfidence,
    first_seen_date: e.firstSeenDate,
    last_seen_date: e.lastSeenDate,
    appearance_count: e.appearanceCount,
    months_seen: e.monthsSeen,
    linked_property: e.linkedProperty,
    linked_person: e.linkedPerson,
    is_business: e.isBusiness,
    is_suspicious: e.isSuspicious,
    is_personal: e.isPersonal,
    needs_review: e.needsReview,
    include_in_forecast: e.includeInForecast,
    ai_explanation: e.aiExplanation,
    confidence: e.confidence,
    source: e.source,
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("vendor_intel").upsert(rows, {
    onConflict: "company_id, canonical_name",
  });
}

// List all vendor intelligence for a company
export async function listVendorIntel(companyId: string): Promise<VendorIntelEntry[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("vendor_intel")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (!data) return [];
  return data.map((d: any) => mapRow(d as RawVendorRow));
}

// Get vendors flagged for review
export async function getVendorsNeedingReview(companyId: string): Promise<VendorIntelEntry[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("vendor_intel")
    .select("*")
    .eq("company_id", companyId)
    .or("needs_review.eq.true,is_suspicious.eq.true,is_personal.eq.true")
    .order("updated_at", { ascending: false });

  if (!data) return [];
  return data.map((d: any) => mapRow(d as RawVendorRow));
}

// Save a transaction annotation (user correction, flag, etc.)
export async function saveAnnotation(params: {
  companyId: string;
  userId: string;
  transactionDescription: string;
  transactionDate?: string;
  transactionAmount?: number;
  originalSubcategory?: string;
  correctedSubcategory?: string;
  flagType?: "personal" | "suspicious" | "business" | "needs_review" | "exclude_from_forecast";
  note?: string;
}): Promise<void> {
  const supabase = await createServerSupabase();

  await supabase.from("transaction_annotations").insert({
    company_id: params.companyId,
    user_id: params.userId,
    transaction_description: params.transactionDescription,
    transaction_date: params.transactionDate ?? null,
    transaction_amount: params.transactionAmount ?? null,
    merchant_normalized: coreMerchant(normalizeMerchant(params.transactionDescription)).toLowerCase(),
    original_subcategory: params.originalSubcategory ?? null,
    corrected_subcategory: params.correctedSubcategory ?? null,
    flag_type: params.flagType ?? null,
    note: params.note ?? null,
  });
}

// Get all annotations for a company
export async function listAnnotations(companyId: string): Promise<any[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("transaction_annotations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(500);

  return data ?? [];
}

// Save forecast accuracy after month-end
export async function logForecastAccuracy(params: {
  companyId: string;
  forecastMonth: string;
  predictedMonthEnd: number;
  actualMonthEnd: number;
  predictedIncome: number;
  actualIncome: number;
  predictedExpenses: number;
  actualExpenses: number;
  predictedLowest: number;
  actualLowest: number;
  confidenceAtTime: number;
}): Promise<void> {
  const supabase = await createServerSupabase();

  await supabase.from("forecast_accuracy_log").upsert({
    company_id: params.companyId,
    forecast_month: params.forecastMonth,
    predicted_month_end: params.predictedMonthEnd,
    actual_month_end: params.actualMonthEnd,
    predicted_income: params.predictedIncome,
    actual_income: params.actualIncome,
    predicted_expenses: params.predictedExpenses,
    actual_expenses: params.actualExpenses,
    predicted_lowest: params.predictedLowest,
    actual_lowest: params.actualLowest,
    confidence_at_time: params.confidenceAtTime,
  }, {
    onConflict: "company_id, forecast_month",
  });
}
