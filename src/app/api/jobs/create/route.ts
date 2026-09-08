import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, getUserByEmail, createJob, createCustomer, addActivity, getCustomers, getAllUsers } from "@/lib/db.mjs";
import { redirectAfterPost } from "@/lib/redirect";
import { resolveStageOwner } from "@/lib/pipeline.mjs";

export async function POST(req: NextRequest) {
  try {
    const c = cookies();
    const session = c.get("shyft_session")?.value;
    const currentUser = session ? getUserByEmail(session) : null;

    let data: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      data = await req.json();
    } else {
      const form = await req.formData();
      data = {
        title: String(form.get("title") || ""),
        description: String(form.get("description") || ""),
        stage: String(form.get("stage") || "ENQUIRY"),
        priority: String(form.get("priority") || "normal"),
        quoteAmount: form.get("quoteAmount") ? parseFloat(String(form.get("quoteAmount"))) : null,
        dueDate: form.get("dueDate") ? String(form.get("dueDate")) : null,
        customerId: form.get("customerId") ? parseInt(String(form.get("customerId")), 10) : null,
        customerName: form.get("customerName") ? String(form.get("customerName")) : null,
        company: form.get("company") ? String(form.get("company")) : null,
        phone: form.get("phone") ? String(form.get("phone")) : null,
        email: form.get("email") ? String(form.get("email")) : null,
        leadSource: form.get("leadSource") ? String(form.get("leadSource")) : "Direct",
        assignedTo: form.get("assignedTo") ? parseInt(String(form.get("assignedTo")), 10) : null,
        specsSummary: form.get("specsSummary") ? String(form.get("specsSummary")) : null,
      };
    }

    if (!data.title) {
      if (contentType.includes("application/json")) {
        return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
      }
      return redirectAfterPost("/jobs");
    }

    let customerId = data.customerId;

    // Create customer if not provided or customerName is specified and customerId is missing
    if (!customerId && (data.customerName || data.name)) {
      const custName = data.customerName || data.name;
      const existing = getCustomers().find((c: any) => c.name.toLowerCase() === custName.toLowerCase());
      if (existing) {
        customerId = existing.id;
      } else {
        customerId = createCustomer({
          name: custName,
          company: data.company || null,
          phone: data.phone || null,
          email: data.email || null,
          notes: `Created via ${data.leadSource || "Pipeline Intake"}`
        });
      }
    }

    if (!customerId) {
      // fallback to first customer or create general
      const firstCust = getCustomers()[0];
      customerId = firstCust ? firstCust.id : createCustomer({ name: "General Client" });
    }

    const newJobStage = data.stage || "ENQUIRY";
    // Default the assignee to the stage's canonical owner unless one was given.
    const assignedTo = data.assignedTo || resolveStageOwner(newJobStage, null, getAllUsers());

    const newJobId = createJob({
      title: data.title,
      description: data.description || "",
      stage: newJobStage,
      assignedTo,
      customerId,
      quoteAmount: data.quoteAmount || null,
      dueDate: data.dueDate || null,
      priority: data.priority || "normal",
      notes: data.notes || "",
      isLate: data.isLate || false,
      leadSource: data.leadSource || "Direct",
      specsSummary: data.specsSummary || null,
      checklist: data.checklist ? (typeof data.checklist === "string" ? data.checklist : JSON.stringify(data.checklist)) : null,
    });

    if (currentUser) {
      addActivity({
        description: `Created new job #${newJobId} (${data.title}) via ${data.leadSource || "Intake"}`,
        byUserId: currentUser.id,
        jobId: newJobId,
        customerId
      });
    }

    if (contentType.includes("application/json")) {
      return NextResponse.json({ success: true, jobId: newJobId });
    }

    return redirectAfterPost(`/jobs/${newJobId}`);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to create job" }, { status: 500 });
  }
}
