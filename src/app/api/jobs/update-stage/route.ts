import { NextRequest, NextResponse } from "next/server";
import { redirectAfterPost } from "@/lib/redirect";
import { db, addActivity, updateJob, getJobById } from "@/lib/db.mjs";
import { cookies } from "next/headers";
import { getUserByEmail } from "@/lib/db.mjs";

export async function POST(req: NextRequest) {
  let jobId: number = 0;
  let stage: string = "";
  let redirectUrl: string = "";
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    jobId = parseInt(String(body.jobId || ""), 10);
    stage = String(body.stage || "").trim();
    redirectUrl = body.redirectUrl || `/jobs/${jobId}`;
  } else {
    const form = await req.formData();
    jobId = parseInt(String(form.get("jobId") || ""), 10);
    stage = String(form.get("stage") || "").trim();
    redirectUrl = String(form.get("redirectUrl") || `/jobs/${jobId}`);
  }

  if (!jobId || !stage) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ success: false, error: "Missing jobId or stage" }, { status: 400 });
    }
    return redirectAfterPost("/jobs/" + (jobId || ""));
  }

  const c = cookies();
  const session = c.get("shyft_session")?.value;
  const user = session ? getUserByEmail(session) : null;

  const currentJob = getJobById(jobId);
  const oldStage = currentJob?.stage || "Unknown";

  updateJob(jobId, { stage, is_late: stage === "DELIVERED" ? 0 : (currentJob?.is_late ?? 0) });

  // Add activity
  if (user) {
    addActivity({
      description: `Moved stage from ${oldStage} → ${stage}`,
      byUserId: user.id,
      jobId,
      customerId: currentJob?.customer_id
    });
  }

  if (contentType.includes("application/json")) {
    return NextResponse.json({ success: true, jobId, stage });
  }

  return redirectAfterPost(redirectUrl || `/jobs/${jobId}`);
}
