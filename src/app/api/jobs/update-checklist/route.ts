import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByEmail, getJobById, updateJob, addActivity } from "@/lib/db.mjs";

export async function POST(req: NextRequest) {
  try {
    const c = cookies();
    const session = c.get("shyft_session")?.value;
    const user = session ? getUserByEmail(session) : null;

    const body = await req.json();
    const jobId = parseInt(String(body.jobId || ""), 10);
    const checklist = body.checklist;
    const itemLabel = body.itemLabel;
    const checked = body.checked;

    if (!jobId || !checklist) {
      return NextResponse.json({ success: false, error: "Missing jobId or checklist" }, { status: 400 });
    }

    const job = getJobById(jobId);
    if (!job) {
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    const checklistStr = typeof checklist === "string" ? checklist : JSON.stringify(checklist);
    updateJob(jobId, { checklist: checklistStr });

    if (user && itemLabel) {
      addActivity({
        description: `${checked ? "Completed" : "Unchecked"} task: "${itemLabel}"`,
        byUserId: user.id,
        jobId,
        customerId: job.customer_id
      });
    }

    return NextResponse.json({ success: true, checklist });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to update checklist" }, { status: 500 });
  }
}
