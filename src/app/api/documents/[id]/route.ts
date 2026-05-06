import { NextResponse } from "next/server";
import { getDocument } from "@/lib/db";

// TODO: replace with real companyId from auth once middleware is in place
const PLACEHOLDER_COMPANY_ID = "00000000-0000-0000-0000-000000000000";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await getDocument(id, PLACEHOLDER_COMPANY_ID);
  if (!doc) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, document: doc });
}
