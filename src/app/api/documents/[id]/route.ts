import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDocument } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!member?.company_id) {
    return NextResponse.json({ success: false, error: "No company found" }, { status: 404 });
  }

  const { id } = await params;
  const doc = await getDocument(id, member.company_id);
  if (!doc) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, document: doc });
}
