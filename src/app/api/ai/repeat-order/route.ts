import { NextRequest, NextResponse } from "next/server";
import { generateRepeatOrderPackage } from "@/lib/ai-engine.mjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const customerId = parseInt(body.customerId, 10);
    if (!customerId) {
      return NextResponse.json({ success: false, error: "Invalid customer ID" }, { status: 400 });
    }
    const result = generateRepeatOrderPackage(customerId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to generate repeat package" }, { status: 500 });
  }
}
