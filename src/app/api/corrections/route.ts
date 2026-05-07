import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveAnnotation, listAnnotations, listVendorIntel } from "@/lib/vendor-intel";
import { saveCorrection } from "@/lib/vendor-db";
import { normalizeMerchant, coreMerchant } from "@/lib/detection/merchant-normalizer";

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

  const body = await req.json();
  const { transactionDescription, originalSubcategory, correctedSubcategory, transactionDate, transactionAmount, flagType, note } = body;

  if (!transactionDescription || !correctedSubcategory) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const companyId = member.company_id;
  const userId = user.id;

  // Save to legacy vendor_knowledge (backward compat)
  await saveCorrection({
    companyId,
    userId,
    transactionDescription,
    originalSubcategory: originalSubcategory ?? "",
    correctedSubcategory,
  });

  // Save to new transaction_annotations table
  await saveAnnotation({
    companyId,
    userId,
    transactionDescription,
    transactionDate: transactionDate ?? undefined,
    transactionAmount: transactionAmount ?? undefined,
    originalSubcategory: originalSubcategory ?? undefined,
    correctedSubcategory,
    flagType: flagType ?? undefined,
    note: note ?? undefined,
  });

  // Also update vendor_intel with user correction (high confidence)
  try {
    const supabaseClient = await createServerSupabase();
    const normalized = coreMerchant(normalizeMerchant(transactionDescription)).toLowerCase();

    await supabaseClient.from("vendor_intel").upsert({
      company_id: companyId,
      canonical_name: normalized,
      aliases: [transactionDescription],
      subcategory: correctedSubcategory,
      category: correctedSubcategory,
      confidence: 1.0,
      source: "user",
      is_business: flagType === "business" ? true : flagType === "personal" ? false : null,
      is_personal: flagType === "personal",
      is_suspicious: flagType === "suspicious",
      needs_review: flagType === "needs_review",
      include_in_forecast: flagType !== "exclude_from_forecast",
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "company_id, canonical_name",
    });
  } catch {
    // Non-critical — vendor_intel update is best-effort
  }

  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
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

  // Return both vendor intel and annotations for this company
  const [vendors, annotations] = await Promise.all([
    listVendorIntel(member.company_id),
    listAnnotations(member.company_id),
  ]);

  return NextResponse.json({
    vendors: vendors.map((v) => ({
      canonicalName: v.canonicalName,
      subcategory: v.subcategory,
      confidence: v.confidence,
      source: v.source,
      isSuspicious: v.isSuspicious,
      isPersonal: v.isPersonal,
      needsReview: v.needsReview,
    })),
    annotations: annotations.map((a: any) => ({
      id: a.id,
      merchantNormalized: a.merchant_normalized,
      originalSubcategory: a.original_subcategory,
      correctedSubcategory: a.corrected_subcategory,
      flagType: a.flag_type,
      note: a.note,
      createdAt: a.created_at,
    })),
  });
}
