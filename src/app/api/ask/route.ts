import { NextRequest, NextResponse } from "next/server";
import { db, getCustomerById, getCustomers, getJobById, getLateJobs, getStageCounts, getCustomerJobs } from "@/lib/db.mjs";

export async function POST(req: NextRequest) {
  const { q } = await req.json();
  const query = String(q || "").toLowerCase();

  // Pipeline / summary
  if (/pipeline|summary|overview|status of|what('s)? happening/.test(query)) {
    const stages = getStageCounts();
    const total = stages.reduce((s: any, r: any) => s + r.count, 0);
    const late = getLateJobs();
    const lines = stages.map((s: any) => `• ${s.stage}: ${s.count}`).join("\n");
    return NextResponse.json({ answer: `Pipeline overview (${total} jobs):\n${lines}\n\nLate / at-risk: ${late.length} job${late.length === 1 ? "" : "s"}. ${late.length ? "Notably: " + late.map((l: any) => `${l.title} (due ${l.due_date ? new Date(l.due_date).toISOString().split("T")[0] : "N/A"})`).join(", ") + "." : "None flagged."}` });
  }

  // Late / delayed / overdue
  if (/late|delayed|overdue|running late|behind/.test(query)) {
    const jobs = getLateJobs();
    if (!jobs.length) return NextResponse.json({ answer: "Good news — no jobs are currently flagged as late." });
    const list = jobs.map((j: any) => `• ${j.title} (${j.stage}) — customer: ${j.customer_name || j.customer_id}, due ${j.due_date ? new Date(j.due_date).toISOString().split("T")[0] : "N/A"}, assigned: ${j.assigned_to || "unassigned"}`).join("\n");
    return NextResponse.json({ answer: `Late / at-risk jobs (${jobs.length}):\n${list}` });
  }

  // Customer history / last order / what did they order
  const customerNames = getCustomers();
  let matchedCustomer: any = null;
  for (const c of customerNames) {
    const namePart = c.name.toLowerCase();
    if (query.includes(namePart) || (namePart.includes(query.replace(/[^a-z]/g, "")) && query.length > 2)) {
      matchedCustomer = c; break;
    }
  }
  // Try partial match on company
  if (!matchedCustomer && query.includes("bright")) { matchedCustomer = customerNames.find((c:any) => c.name.toLowerCase().includes("neha")); }
  if (!matchedCustomer && query.includes("city")) { matchedCustomer = customerNames.find((c:any) => c.name.toLowerCase().includes("rahul")); }
  if (!matchedCustomer && query.includes("vihaan")) { matchedCustomer = customerNames.find((c:any) => c.company && c.company.toLowerCase().includes("vihaan")); }
  if (!matchedCustomer && query.includes("singh")) { matchedCustomer = customerNames.find((c:any) => c.name.toLowerCase().includes("karan")); }

  if (matchedCustomer && (/history|last order|ordered|what did|previous|repeat|same as/.test(query))) {
    const jobs = getCustomerJobs(matchedCustomer.id);
    if (!jobs.length) return NextResponse.json({ answer: `No past orders found for ${matchedCustomer.name}.` });
    const summary = jobs.map((j: any) => `• [${j.stage}] ${j.title} — quote ₹${j.quote_amount ? j.quote_amount.toLocaleString("en-IN") : "N/A"}, due ${j.due_date ? new Date(j.due_date).toISOString().split("T")[0] : "N/A"}`).join("\n");
    return NextResponse.json({ answer: `History for ${matchedCustomer.name} (${matchedCustomer.company || "no company"}, ${matchedCustomer.phone || "no phone"}):\n${summary}` });
  }

  // Job details by number
  const jobIdMatch = query.match(/(?:job|#)?\s*(\d+)/);
  if (jobIdMatch) {
    const jid = parseInt(jobIdMatch[1], 10);
    const job = getJobById(jid);
    if (job) {
      const customer = db.prepare("SELECT name FROM customers WHERE id = ?").get(job.customer_id);
      return NextResponse.json({ answer: `Job #${jid}: ${job.title} (${job.stage}) — customer: ${customer?.name || job.customer_id}, assigned: ${job.assigned_to ? db.prepare("SELECT name FROM users WHERE id = ?").get(job.assigned_to)?.name || job.assigned_to : "unassigned"}, quote ₹${job.quote_amount ? job.quote_amount.toLocaleString("en-IN") : "N/A"}, due ${job.due_date ? new Date(job.due_date).toISOString().split("T")[0] : "N/A"}, priority: ${job.priority}, notes: ${job.notes || "none"}` });
    }
  }

  // Quote / price
  if ((/quote|price|cost|how much|amount/.test(query)) && matchedCustomer) {
    const jobs = getCustomerJobs(matchedCustomer.id);
    const quoted = jobs.filter((j:any) => j.stage === "QUOTED");
    const totalQuoted = quoted.reduce((s:number, j:any) => s + (j.quote_amount || 0), 0);
    return NextResponse.json({ answer: `For ${matchedCustomer.name}, there are ${quoted.length} quoted job(s) totaling ₹${totalQuoted.toLocaleString("en-IN")}. Latest quoted: ${quoted[0] ? quoted[0].title + " (₹" + (quoted[0].quote_amount ? quoted[0].quote_amount.toLocaleString("en-IN") : "N/A") + ")" : "none"}.` });
  }

  // Design stage
  if (/design/.test(query)) {
    const designJobs = db.prepare("SELECT j.*, c.name as customer_name FROM jobs j JOIN customers c ON j.customer_id = c.id WHERE j.stage = 'DESIGN'").all();
    if (!designJobs.length) return NextResponse.json({ answer: "No jobs currently in Design stage." });
    const list = designJobs.map((j: any) => `• ${j.title} (${j.customer_name}) — assigned ${j.assigned_to ? db.prepare("SELECT name FROM users WHERE id = ?").get(j.assigned_to)?.name || j.assigned_to : "unassigned"}, due ${j.due_date ? new Date(j.due_date).toISOString().split("T")[0] : "N/A"}`).join("\n");
    return NextResponse.json({ answer: `Design stage (${designJobs.length}):\n${list}` });
  }

  // Assigned / who is working
  if (/who|assigned|working on|responsible/.test(query)) {
    const assigned = db.prepare("SELECT j.*, u.name as user_name, c.name as customer_name FROM jobs j LEFT JOIN users u ON j.assigned_to = u.id JOIN customers c ON j.customer_id = c.id WHERE j.assigned_to IS NOT NULL ORDER BY j.updated_at DESC LIMIT 5").all();
    const lines = assigned.map((a: any) => `• ${a.title} → ${a.user_name} (${a.customer_name}) [${a.stage}]`).join("\n");
    return NextResponse.json({ answer: `Recent assignments:\n${lines || "None found."}` });
  }

  // Specific customer info by company/name partial
  if (matchedCustomer && (/what is|who is|info|details/.test(query))) {
    return NextResponse.json({ answer: `${matchedCustomer.name} (${matchedCustomer.company || "independent"}) — phone ${matchedCustomer.phone || "N/A"}, email ${matchedCustomer.email || "N/A"}, notes: ${matchedCustomer.notes || "none"}` });
  }

  // General help / unknown
  return NextResponse.json({ answer: `I can help with: pipeline summary, late jobs, customer history (say a name like Neha or BrightTech), job status by number (#7), design stage, quotes, and assignments. What would you like to know?` });
}
