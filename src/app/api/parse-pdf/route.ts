import { NextRequest, NextResponse } from "next/server";
import { parsePDFStatement } from "@/lib/parsers/pdf";
import type { ParseResult } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json<ParseResult>(
        { success: false, error: "No file provided", parser: "pdf", fileName: "" },
        { status: 400 },
      );
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json<ParseResult>(
        { success: false, error: "File must be a PDF", parser: "pdf", fileName: file.name },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await parsePDFStatement(buffer);

    return NextResponse.json<ParseResult>({
      success: true,
      data,
      parser: "pdf",
      fileName: file.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json<ParseResult>(
      { success: false, error: message, parser: "pdf", fileName: "" },
      { status: 500 },
    );
  }
}
