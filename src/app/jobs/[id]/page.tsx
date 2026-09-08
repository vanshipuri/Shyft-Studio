import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUserByEmail, getJobById, getCustomers, getNotesForJob, getActivitiesForJob, getUserById } from "@/lib/db.mjs";

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const c = cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const job = getJobById(parseInt(params.id, 10));
  if (!job) redirect("/jobs");
  const customer = getCustomers().find((c: any) => c.id === job.customer_id);
  const notes = getNotesForJob(job.id);
  const activities = getActivitiesForJob(job.id);
  const assigned = job.assigned_to ? getUserById(job.assigned_to) : null;

  const stages = ["ENQUIRY", "QUOTED", "DESIGN", "PRINTING", "READY", "DELIVERED"];

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/jobs" className="text-xs font-bold text-brand-400 hover:text-brand-600">Pipeline</Link>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 leading-none mt-0.5">{job.title}</h1>
            <p className="text-sm text-brand-500">Job #{job.id} • {customer?.name || "Unknown customer"}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm font-bold text-brand-600 hover:text-brand-900">Dashboard</Link>
            <form action="/api/auth/logout" method="POST" className="inline"><button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Overview card */}
        <section className="rounded-3xl bg-white border border-brand-200/60 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${job.is_late ? "bg-rose text-white" : "bg-brand-100 text-brand-700"}`}>{job.stage}</span>
                {job.is_late && <span className="text-xs font-extrabold bg-rose/10 text-rose px-2 py-1 rounded-full">LATE</span>}
                <span className={`text-xs font-extrabold px-2 py-1 rounded-full ${job.priority === "urgent" ? "bg-rose/10 text-rose" : job.priority === "high" ? "bg-amber/10 text-amber-deep" : "bg-brand-100 text-brand-600"}`}>{job.priority}</span>
              </div>
              <h2 className="text-xl font-extrabold text-ink-900">{job.title}</h2>
              <p className="text-brand-600 text-sm mt-1 max-w-2xl">{job.description || "No description."}</p>
              <div className="flex flex-wrap gap-3 mt-4 text-sm font-medium text-brand-600">
                <span>Assigned to: <strong className="text-ink-900">{assigned ? assigned.name : "Unassigned"}</strong> ({user.role})</span>
                <span>•</span>
                <span>Due: <strong className="text-ink-900">{job.due_date ? new Date(job.due_date).toISOString().split("T")[0] : "—"}</strong></span>
                <span>•</span>
                <span>Quote: <strong className="text-ink-900">₹{job.quote_amount ? job.quote_amount.toLocaleString("en-IN") : "—"}</strong></span>
                <span>•</span>
                <span>Upfront: <strong className="text-ink-900">{job.paid_upfront ? "Yes" : "No"}</strong></span>
              </div>
            </div>
            {/* Stage update form */}
            <div className="md:w-[300px] shrink-0 rounded-2xl bg-brand-50 border border-brand-200/60 p-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-500 mb-3">Move stage</h3>
              <form action="/api/jobs/update-stage" method="POST" className="space-y-2">
                <input type="hidden" name="jobId" value={job.id} />
                <select name="stage" defaultValue={job.stage} className="w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-amber/40">
                  {stages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="submit" className="w-full rounded-lg bg-brand-900 text-white text-sm font-bold py-2 shadow-md hover:shadow-lg transition">Update stage</button>
              </form>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Notes */}
          <section className="lg:col-span-2 space-y-6">
            <section>
              <h3 className="text-lg font-extrabold text-ink-900 mb-3">Notes & updates</h3>
              <div className="rounded-2xl bg-white border border-brand-200/60 shadow-sm p-5 space-y-4">
                {notes.length === 0 && <div className="text-sm text-brand-400 font-medium">No notes yet.</div>}
                {notes.map((n: any) => (
                  <div key={n.id} className="border-b border-brand-100 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-brand-400 mb-1">
                      <span>{n.author_name}</span>
                      <span>•</span>
                      <span>{new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-sm text-ink-800 leading-relaxed">{n.content}</p>
                  </div>
                ))}
                <form action="/api/notes/add" method="POST" className="pt-2 flex gap-2">
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="userId" value={user.id} />
                  <textarea name="content" rows={2} placeholder="Add a note..." className="flex-1 rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none" />
                  <button type="submit" className="rounded-xl bg-brand-900 text-white px-4 text-sm font-bold hover:bg-brand-800 transition self-start">Post</button>
                </form>
              </div>
            </section>

            {/* Activities */}
            <section>
              <h3 className="text-lg font-extrabold text-ink-900 mb-3">Activity feed</h3>
              <div className="rounded-2xl bg-white border border-brand-200/60 shadow-sm divide-y divide-brand-100">
                {activities.map((a: any) => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-900 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">{(a.user_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0,2)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-800 truncate">{a.description}</p>
                      <p className="text-xs text-brand-400">{a.user_name} • {new Date(a.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && <div className="px-5 py-6 text-sm text-brand-400 font-medium">No activities yet.</div>}
              </div>
            </section>
          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section className="rounded-2xl bg-white border border-brand-200/60 shadow-sm p-5">
              <h3 className="font-extrabold text-ink-900 mb-3">Customer</h3>
              <div className="text-sm font-medium text-brand-600">{customer?.name}</div>
              <div className="text-xs text-brand-400">{customer?.company || "No company"}</div>
              <div className="text-xs text-brand-400">{customer?.phone || "No phone"}</div>
              <div className="mt-3">
                <Link href={`/customers/${customer?.id}`} className="text-xs font-extrabold text-amber-deep hover:underline">View full profile →</Link>
              </div>
            </section>

            <section className="rounded-2xl bg-gradient-to-br from-brand-900 to-brand-800 text-white p-5 shadow-xl shadow-brand-900/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
              <h3 className="font-extrabold text-lg relative">Quick ask</h3>
              <p className="text-brand-300 text-xs mt-2 relative">Use the assistant to ask about this job or customer.</p>
              <div className="mt-3 flex flex-wrap gap-2 relative">
                {["Status?", "Customer history", "Late?", "Assigned to?"].map(q => (
                  <span key={q} className="text-[10px] font-extrabold bg-white/10 px-2 py-1 rounded-md border border-white/10">{q}</span>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
