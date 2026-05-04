import { NextResponse } from "next/server";
import { getDocument } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, document: doc });
}
