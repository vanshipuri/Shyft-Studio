import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByEmail } from "@/lib/db.mjs";
import { processCopilotQuery } from "@/lib/ai-engine.mjs";

export async function POST(req: NextRequest) {
  try {
    const { q, role } = await req.json();
    const query = String(q || "").trim();

    const c = await cookies();
    const session = c.get("shyft_session")?.value;
    const user = session ? getUserByEmail(session) : null;
    const activeRole = role || user?.role || "OWNER";

    const result = processCopilotQuery(query, activeRole);
    return NextResponse.json({ answer: result.answer });
  } catch (err: any) {
    return NextResponse.json({
      answer: "I encountered an issue processing your query. Please ask about pipeline stats, late jobs, customer history, or draft messages."
    });
  }
}
