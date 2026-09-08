import { NextRequest, NextResponse } from "next/server";
import { parseMessyLead } from "@/lib/ai-engine.mjs";
import { createLlmClient, enrichLeadWithLLM } from "@/lib/llm-provider.mjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text || "";

    // 1. Deterministic extraction always runs first: it is what prices the job.
    const base = parseMessyLead(text);

    // 2. The provider seam only fills gaps, and only if a key is configured.
    //    With no key this is a no-op; on provider error it degrades to `base`.
    const result = await enrichLeadWithLLM(text, base, createLlmClient());

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to parse lead" }, { status: 500 });
  }
}
