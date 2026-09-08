import { NextRequest, NextResponse } from "next/server";
import { redirectAfterPost } from "@/lib/redirect";
import { db, addActivity, updateJob, getJobById, getAllUsers, getUserById } from "@/lib/db.mjs";
import { cookies } from "next/headers";
import { getUserByEmail } from "@/lib/db.mjs";
import { isValidStage, resolveStageOwner } from "@/lib/pipeline.mjs";

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

  if (!jobId || !stage || !isValidStage(stage)) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ success: false, error: "Missing or invalid jobId/stage" }, { status: 400 });
    }
    return redirectAfterPost("/jobs/" + (jobId || ""));
  }

  const c = await cookies();
  const session = c.get("shyft_session")?.value;
  const user = session ? getUserByEmail(session) : null;

  const currentJob = getJobById(jobId);
  if (!currentJob) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }
    return redirectAfterPost("/jobs/" + (jobId || ""));
  }
  const oldStage = currentJob.stage;

  // Ownership is derived from the pipeline, not a free-text field: every stage
  // has exactly one default owner (Sales / Production), and the job follows it
  // on transition so "whose job is this?" always has a single answer.
  const currentAssignee = currentJob.assigned_to ? getUserById(currentJob.assigned_to) : null;
  const ownerUserId = resolveStageOwner(stage, currentAssignee, getAllUsers());
  const ownerChanged = ownerUserId !== currentJob.assigned_to;

  updateJob(jobId, {
    stage,
    is_late: stage === "DELIVERED" ? 0 : (currentJob.is_late ?? 0),
    assigned_to: ownerUserId
  });

  // Add activity — the audit trail records the handoff explicitly.
  if (user) {
    const owner = ownerUserId ? getUserById(ownerUserId) : null;
    const ownerSuffix = ownerChanged && owner
      ? ` — now owned by ${owner.name} (${owner.role})`
      : ` — owner: ${owner ? owner.name : "unassigned"}`;
    addActivity({
      description: `Moved stage from ${oldStage} → ${stage}${ownerSuffix}`,
      byUserId: user.id,
      jobId,
      customerId: currentJob.customer_id
    });
  }

  if (contentType.includes("application/json")) {
    return NextResponse.json({ success: true, jobId, stage });
  }

  return redirectAfterPost(redirectUrl || `/jobs/${jobId}`);
}
