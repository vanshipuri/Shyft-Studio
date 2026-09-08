import { NextRequest, NextResponse } from "next/server";
import { db, addActivity, updateJob } from "@/lib/db.mjs";
import { cookies } from "next/headers";
import { getUserByEmail } from "@/lib/db.mjs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const jobId = parseInt(String(form.get("jobId") || ""), 10);
  const stage = String(form.get("stage") || "").trim();
  if (!jobId || !stage) return NextResponse.redirect(new URL("/jobs/" + jobId, req.url));

  const c = cookies();
  const session = c.get("shyft_session")?.value;
  const user = session ? getUserByEmail(session) : null;

  updateJob(jobId, { stage, is_late: stage === "DELIVERED" ? 0 : undefined });

  // Add activity
  if (user) {
    addActivity({ description: `Moved to ${stage}`, byUserId: user.id, jobId });
  }

  return NextResponse.redirect(new URL("/jobs/" + jobId, req.url));
}
