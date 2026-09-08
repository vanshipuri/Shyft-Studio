import { NextRequest, NextResponse } from "next/server";
import { parseMessyLead } from "@/lib/ai-engine.mjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = parseMessyLead(body.text || "");
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to parse lead" }, { status: 500 });
  }
}
