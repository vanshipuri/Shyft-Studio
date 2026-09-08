import { NextResponse } from "next/server";
import { analyzeProductionRisks } from "@/lib/ai-engine.mjs";

export async function GET() {
  try {
    const analysis = analyzeProductionRisks();
    return NextResponse.json(analysis);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to analyze risks" }, { status: 500 });
  }
}
