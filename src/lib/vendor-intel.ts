import "server-only";

import OpenAI from "openai";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";
import type { Subcategory } from "@/lib/detection/subcategory-classifier";
import type { LearningReport } from "@/lib/learning/cross-month-learner";
import { buildVendorIntelEntries } from "@/lib/learning/cross-month-learner";

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
  researchedAt: string | null;
  researchData: Record<string, unknown> | null;
  isFirstSeen: boolean;
  direction: string | null;
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
  researched_at: string | null;
  research_data: Record<string, unknown> | null;
  is_first_seen: boolean;
  direction: string | null;
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
    researchedAt: row.researched_at ?? null,
    researchData: row.research_data ?? null,
    isFirstSeen: row.is_first_seen ?? false,
    direction: row.direction ?? null,
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
    researched_at: entry.researchedAt ?? null,
    research_data: entry.researchData ?? {},
    is_first_seen: entry.isFirstSeen ?? false,
    direction: entry.direction ?? null,
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
    researched_at: e.researchedAt ?? null,
    research_data: e.researchData ?? {},
    is_first_seen: e.isFirstSeen ?? false,
    direction: e.direction ?? null,
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
  return (data as RawVendorRow[]).map(mapRow);
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
  return (data as RawVendorRow[]).map(mapRow);
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

export interface AnnotationRow {
  id: string;
  company_id: string;
  user_id: string;
  transaction_description: string;
  merchant_normalized: string;
  original_subcategory: string | null;
  corrected_subcategory: string | null;
  flag_type: string | null;
  note: string | null;
  created_at: string;
}

// Get all annotations for a company
export async function listAnnotations(companyId: string): Promise<AnnotationRow[]> {
  const supabase = await createServerSupabase();

  const { data } = await supabase
    .from("transaction_annotations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(500);

  return data ?? [];
}

// ── Vendor Research (DeepSeek v4 Flash) ──

export interface VendorResearchResult {
  canonicalName: string;
  category: string;
  subcategory: string;
  typicalPurpose: string;
  isBusiness: boolean | null;
  confidence: number;
  reasoning: string;
}

const VENDOR_RESEARCH_PROMPT = `You are a business vendor researcher. Given a merchant name from a UK bank statement, identify what this business does, what category it falls into, and whether it's likely a business expense for a property management / supported accommodation company.

Return a JSON object with these fields:
{
  "canonicalName": "clean normalized name of the business",
  "category": "one of: Car & Transport, Food & Dining, Software/Tools, Rent & Property, Salaries & Wages, Taxes, Loan Repayments, Subscriptions, Utilities, Bank Fees, Suppliers & Services, Shopping, Insurance, Other Income, Professional Services, Uncategorized",
  "subcategory": "specific subcategory matching the classification system",
  "typicalPurpose": "brief description of what this vendor is and why someone would pay them",
  "isBusiness": true/false/null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export async function researchVendorWithAI(
  merchantName: string,
  companyContext?: string
): Promise<VendorResearchResult | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  try {
    const deepseek = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });

    const completion = await deepseek.chat.completions.create({
      model: "deepseek-v4-flash",
      temperature: 0.2,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `${VENDOR_RESEARCH_PROMPT}\n\nResearch this vendor from a bank statement:\n"${merchantName}"\n\nCompany context: ${companyContext ?? "UK property management / supported accommodation business"}`,
      }],
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return null;

    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return {
      canonicalName: json.canonicalName ?? merchantName,
      category: json.category ?? "Uncategorized",
      subcategory: json.subcategory ?? "one-off",
      typicalPurpose: json.typicalPurpose ?? "",
      isBusiness: json.isBusiness ?? null,
      confidence: Math.min(1, Math.max(0, json.confidence ?? 0.5)),
      reasoning: json.reasoning ?? "AI-researched vendor",
    };
  } catch {
    return null;
  }
}

export async function researchAndCacheVendor(
  companyId: string,
  merchantName: string,
  existingEntry?: VendorIntelEntry | null
): Promise<VendorIntelEntry> {
  const canonicalName = coreMerchant(normalizeMerchant(merchantName)).toLowerCase();

  // Check if we already have researched data that's fresh (< 90 days)
  if (existingEntry?.researchedAt) {
    const researchedAge = Date.now() - new Date(existingEntry.researchedAt).getTime();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    if (researchedAge < ninetyDays) {
      return existingEntry;
    }
  }

  // Research with DeepSeek
  const researchResult = await researchVendorWithAI(merchantName);

  if (!researchResult) {
    // AI unavailable — return basic entry
    return {
      companyId,
      canonicalName,
      aliases: [merchantName],
      subcategory: "one-off" as Subcategory,
      category: "Uncategorized",
      typicalAmountMin: null,
      typicalAmountMax: null,
      typicalAmountAvg: null,
      recurrencePattern: null,
      recurrenceConfidence: 0,
      firstSeenDate: new Date().toISOString().split("T")[0],
      lastSeenDate: new Date().toISOString().split("T")[0],
      appearanceCount: 1,
      monthsSeen: [],
      linkedProperty: null,
      linkedPerson: null,
      isBusiness: null,
      isSuspicious: false,
      isPersonal: false,
      needsReview: true,
      includeInForecast: false,
      aiExplanation: "AI vendor research unavailable",
      confidence: 0.3,
      source: "keyword",
      researchedAt: null,
      researchData: null,
      isFirstSeen: true,
      direction: null,
    };
  }

  return {
    companyId,
    canonicalName: coreMerchant(normalizeMerchant(researchResult.canonicalName)).toLowerCase(),
    aliases: [merchantName, researchResult.canonicalName],
    subcategory: researchResult.subcategory as Subcategory,
    category: researchResult.category,
    typicalAmountMin: null,
    typicalAmountMax: null,
    typicalAmountAvg: null,
    recurrencePattern: null,
    recurrenceConfidence: 0,
    firstSeenDate: new Date().toISOString().split("T")[0],
    lastSeenDate: new Date().toISOString().split("T")[0],
    appearanceCount: 1,
    monthsSeen: [],
    linkedProperty: null,
    linkedPerson: null,
    isBusiness: researchResult.isBusiness,
    isSuspicious: false,
    isPersonal: false,
    needsReview: researchResult.confidence < 0.7,
    includeInForecast: false,
    aiExplanation: researchResult.reasoning,
    confidence: researchResult.confidence,
    source: "ai",
    researchedAt: new Date().toISOString(),
    researchData: researchResult as unknown as Record<string, unknown>,
    isFirstSeen: true,
    direction: null,
  };
}

// Ensure ALL vendors from the learning report have vendor_intel entries.
// Researches unknown vendors via DeepSeek, updates existing ones with latest stats.
export async function ensureCompleteVendorIntel(
  learningReport: LearningReport,
  companyId: string
): Promise<VendorIntelEntry[]> {
  const entries = buildVendorIntelEntries(learningReport, companyId);
  const existingVendorIntel = await listVendorIntel(companyId);
  const existingMap = new Map(
    existingVendorIntel.map(v => [v.canonicalName.toLowerCase(), v])
  );

  const allEntries: VendorIntelEntry[] = [...entries];

  for (const [coreName, vendor] of learningReport.vendors) {
    const alreadyAdded = allEntries.some(
      e => e.canonicalName.toLowerCase() === coreName.toLowerCase()
    );
    if (alreadyAdded) continue;

    const existing = existingMap.get(coreName.toLowerCase());
    if (existing) {
      // Update existing entry with latest stats
      existing.appearanceCount = vendor.appearanceCount;
      existing.lastSeenDate = vendor.lastSeen;
      existing.monthsSeen = vendor.months;
      existing.isFirstSeen = false;
      existing.direction = vendor.direction;
      allEntries.push(existing);
    } else {
      // New vendor — research with AI
      const researchEntry = await researchAndCacheVendor(
        companyId,
        vendor.canonicalName,
        null
      );
      researchEntry.appearanceCount = vendor.appearanceCount;
      researchEntry.firstSeenDate = vendor.firstSeen;
      researchEntry.lastSeenDate = vendor.lastSeen;
      researchEntry.monthsSeen = vendor.months;
      researchEntry.isFirstSeen = true;
      researchEntry.direction = vendor.direction;
      allEntries.push(researchEntry);
    }
  }

  // Persist all entries to Supabase (fire-and-forget)
  if (allEntries.length > 0) {
    await upsertVendorIntelBatch(allEntries);
  }

  return allEntries;
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
