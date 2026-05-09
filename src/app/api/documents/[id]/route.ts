import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDocument, deleteDocument } from "@/lib/db";

async function getAuthCompany() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  return member?.company_id ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const companyId = await getAuthCompany();
  if (!companyId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await getDocument(id, companyId);
  if (!doc) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, document: doc });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const companyId = await getAuthCompany();
  if (!companyId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteDocument(id, companyId);
  if (!ok) {
    return NextResponse.json({ success: false, error: "Failed to delete document" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
