import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
    return NextResponse.json({ exists: false });
  }

  const body = await req.json();
  const { from, to } = body as { from: string; to: string };

  if (!from || !to) {
    return NextResponse.json({ exists: false });
  }

  // Check if any existing document covers this period
  const { data: docs } = await supabase
    .from("documents")
    .select("statement_data")
    .eq("company_id", member.company_id);

  for (const doc of docs ?? []) {
    const stmt = doc.statement_data as Record<string, unknown> | null;
    const period = (stmt as any)?.accountInfo?.statementPeriod;
    if (!period?.from || !period?.to) continue;

    // Overlap check: existing period overlaps with new period
    if (period.from <= to && period.to >= from) {
      return NextResponse.json({
        exists: true,
        existingDocumentId: (doc as any).id,
        existingFilename: (doc as any).filename,
        existingPeriod: `${period.from} to ${period.to}`,
      });
    }
  }

  return NextResponse.json({ exists: false });
}
