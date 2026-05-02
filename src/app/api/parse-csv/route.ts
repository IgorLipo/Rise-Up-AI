import { NextRequest, NextResponse } from "next/server";
import { parseCSVStatement } from "@/lib/parsers/csv";
import type { ParseResult } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json<ParseResult>(
        { success: false, error: "No file provided", parser: "csv", fileName: "" },
        { status: 400 },
      );
    }

    if (!file.name.endsWith(".csv") && !file.type.includes("csv")) {
      return NextResponse.json<ParseResult>(
        { success: false, error: "File must be a CSV", parser: "csv", fileName: file.name },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await parseCSVStatement(buffer);

    return NextResponse.json<ParseResult>({
      success: true,
      data,
      parser: "csv",
      fileName: file.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json<ParseResult>(
      { success: false, error: message, parser: "csv", fileName: "" },
      { status: 500 },
    );
  }
}
