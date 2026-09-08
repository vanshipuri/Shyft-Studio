import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  getUserByEmail,
  getJobById,
  getCustomerById,
  getNotesForJob,
  getActivitiesForJob,
  getUserById,
  getJobChecklist
} from "@/lib/db.mjs";
import RoleSwitcher from "@/components/RoleSwitcher";
import JobChecklist from "@/components/JobChecklist";
import JobStageStepper from "@/components/JobStageStepper";
import JobAiActions from "@/components/JobAiActions";
import AssistantWidget from "@/components/AssistantWidget";
import MessyLeadModal from "@/components/MessyLeadModal";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const c = cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const jobId = parseInt(params.id, 10);
  const job = getJobById(jobId);
  if (!job) redirect("/jobs");

  const customer = getCustomerById(job.customer_id);
  const notes = getNotesForJob(job.id);
  const activities = getActivitiesForJob(job.id);
  const assigned = job.assigned_to ? getUserById(job.assigned_to) : null;
  const checklist = getJobChecklist(job);

  const stages = ["ENQUIRY", "QUOTED", "DESIGN", "PRINTING", "READY", "DELIVERED"];

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Persona Switcher */}
      <RoleSwitcher currentUser={user} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/jobs" className="text-xs font-bold text-brand-400 hover:text-brand-700">
                ← Pipeline Board
              </Link>
              <span className="text-brand-300">•</span>
              <span className="text-xs font-bold text-brand-500">Job #{job.id}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 leading-tight mt-0.5">
              {job.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <MessyLeadModal />
            <Link href="/dashboard" className="text-sm font-bold text-brand-700 hover:text-brand-950 transition">Dashboard</Link>
            <Link href="/customers" className="text-sm font-bold text-brand-700 hover:text-brand-950 transition">Customers</Link>
            <form action="/api/auth/logout" method="POST" className="inline">
              <button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Interactive Stage Stepper */}
        <JobStageStepper jobId={job.id} currentStage={job.stage} />

        {/* Overview card */}
        <section className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-black px-3 py-1 rounded-full ${
                  job.is_late ? "bg-rose text-white" : "bg-brand-900 text-white"
                }`}>
                  {job.stage}
                </span>

                {job.is_late ? (
                  <span className="text-xs font-extrabold bg-rose-soft text-rose px-2.5 py-1 rounded-full border border-rose/20">
                    ⚠️ LATE / OVERDUE
                  </span>
                ) : null}

                <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                  job.priority === "urgent"
                    ? "bg-rose/10 text-rose"
                    : job.priority === "high"
                    ? "bg-amber/20 text-amber-deep"
                    : "bg-brand-100 text-brand-700"
                }`}>
                  {job.priority?.toUpperCase()} PRIORITY
                </span>

                {job.lead_source && (
                  <span className="text-xs font-bold text-brand-500 bg-brand-100 px-2.5 py-1 rounded-full">
                    Source: {job.lead_source}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-extrabold text-ink-900">{job.title}</h2>
              <p className="text-brand-700 text-sm leading-relaxed whitespace-pre-wrap max-w-2xl bg-brand-50/50 p-4 rounded-2xl border border-brand-200/60">
                {job.description || "No description provided."}
              </p>

              {/* Specs and financial chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-brand-50 border border-brand-200/60">
                  <div className="text-[10px] font-bold text-brand-400 uppercase">Quote Amount</div>
                  <div className="text-base font-black text-ink-900 mt-0.5">
                    {job.quote_amount ? `₹${job.quote_amount.toLocaleString("en-IN")}` : "Unquoted"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-brand-50 border border-brand-200/60">
                  <div className="text-[10px] font-bold text-brand-400 uppercase">Target SLA Due</div>
                  <div className="text-sm font-bold text-ink-900 mt-0.5">
                    {job.due_date ? job.due_date.split("T")[0] : "None"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-brand-50 border border-brand-200/60">
                  <div className="text-[10px] font-bold text-brand-400 uppercase">Assignee</div>
                  <div className="text-sm font-bold text-ink-900 mt-0.5">
                    {assigned ? assigned.name : "Unassigned"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-brand-50 border border-brand-200/60">
                  <div className="text-[10px] font-bold text-brand-400 uppercase">Deposit Status</div>
                  <div className="text-sm font-bold text-emerald mt-0.5">
                    {job.paid_upfront ? "50% Paid" : "Pending"}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick manual stage updater dropdown */}
            <div className="md:w-[280px] shrink-0 rounded-2xl bg-brand-50 border border-brand-200 p-4 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-500">Update Stage Directly</h3>
              <form action="/api/jobs/update-stage" method="POST" className="space-y-2">
                <input type="hidden" name="jobId" value={job.id} />
                <select
                  name="stage"
                  defaultValue={job.stage}
                  className="w-full rounded-xl border border-brand-300 bg-white px-3 py-2 text-xs font-bold text-ink-900 focus:outline-none focus:ring-2 focus:ring-amber/40"
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-brand-900 hover:bg-brand-800 text-white text-xs font-bold py-2.5 shadow-sm transition"
                >
                  Save Stage Update
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Checklists & AI Automation Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pre-flight Checklist */}
          <JobChecklist jobId={job.id} initialChecklist={checklist} />

          {/* AI Quick Actions & Message Generator */}
          <JobAiActions job={job} customer={customer} />
        </div>

        {/* Notes, Timeline & Customer Info */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Notes and Activity Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notes Section */}
            <section className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-ink-900">Notes & Internal Handoffs</h3>
                <span className="text-xs font-bold text-brand-500">{notes.length} notes</span>
              </div>

              <div className="space-y-3">
                {notes.map((n: any) => (
                  <div key={n.id} className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200/60 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-brand-400 font-bold">
                      <span className="text-brand-700">{n.author_name}</span>
                      <span>{new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-xs text-ink-900 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))}

                {notes.length === 0 && (
                  <div className="text-xs text-brand-400 py-4 text-center">No internal notes added yet.</div>
                )}

                <form action="/api/notes/add" method="POST" className="pt-2 flex gap-2">
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="userId" value={user.id} />
                  <textarea
                    name="content"
                    rows={2}
                    placeholder="Add an internal note or handoff detail..."
                    className="flex-1 rounded-xl border border-brand-300 bg-brand-50 px-3.5 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-brand-900 text-white px-4 text-xs font-bold hover:bg-brand-800 transition self-start py-2.5 shadow-sm"
                  >
                    Post Note
                  </button>
                </form>
              </div>
            </section>

            {/* Activities Audit Timeline */}
            <section className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 space-y-4">
              <h3 className="text-base font-extrabold text-ink-900">Audit Trail & Activity Log</h3>
              <div className="divide-y divide-brand-100">
                {activities.map((a: any) => (
                  <div key={a.id} className="py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-900 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                      {(a.user_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink-900">{a.description}</p>
                      <p className="text-[10px] text-brand-400">
                        {a.user_name} • {new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="py-4 text-xs text-brand-400 text-center">No activity history recorded yet.</div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar Customer Card */}
          <aside className="space-y-6">
            <section className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-brand-400">Client Account</span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-950 to-brand-800 text-white flex items-center justify-center font-extrabold text-xs shadow-md">
                  {customer?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-ink-900">{customer?.name}</h4>
                  <p className="text-xs text-brand-500">{customer?.company || "Independent"}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-brand-200/60 space-y-1 text-xs text-brand-600">
                <div>Phone: <strong className="text-ink-900">{customer?.phone || "—"}</strong></div>
                <div>Email: <strong className="text-ink-900">{customer?.email || "—"}</strong></div>
              </div>

              <div className="pt-2">
                <Link
                  href={`/customers/${customer?.id}`}
                  className="block text-center py-2 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-xs font-bold text-amber-deep transition"
                >
                  View Customer 360 Profile →
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <AssistantWidget role={user.role} />
    </div>
  );
}
