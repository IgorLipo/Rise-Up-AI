import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveCorrection, listVendors } from "@/lib/vendor-db";

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
  const { transactionDescription, originalSubcategory, correctedSubcategory } = body;

  if (!transactionDescription || !originalSubcategory || !correctedSubcategory) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await saveCorrection({
    companyId: member.company_id,
    userId: user.id,
    transactionDescription,
    originalSubcategory,
    correctedSubcategory,
  });

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

  const vendors = await listVendors(member.company_id);
  return NextResponse.json({ vendors });
}
