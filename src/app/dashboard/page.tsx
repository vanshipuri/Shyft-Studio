import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail, getCustomers, getJobs, getLateJobs, getStageCounts, getNotesForJob } from "@/lib/db.mjs";
import AssistantWidget from "../../components/AssistantWidget";

export default async function DashboardPage() {
  const c = cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const totalJobs = getJobs().length;
  const lateJobs = getLateJobs();
  const stages = getStageCounts();
  const customers = getCustomers();

  const stageColors: Record<string, string> = {
    ENQUIRY: "bg-amber-soft text-amber-deep border-amber/20",
    QUOTED: "bg-brand-200 text-brand-800 border-brand-300",
    DESIGN: "bg-rose-soft text-rose border-rose/20",
    PRINTING: "bg-brand-900 text-white border-brand-900",
    READY: "bg-emerald-soft text-emerald border-emerald/20",
    DELIVERED: "bg-brand-100 text-brand-700 border-brand-300",
  };

  const stageLabels: Record<string, string> = {
    ENQUIRY: "Enquiry", QUOTED: "Quoted", DESIGN: "Design", PRINTING: "Printing", READY: "Ready", DELIVERED: "Delivered",
  };

  const stageOrder = ["ENQUIRY", "QUOTED", "DESIGN", "PRINTING", "READY", "DELIVERED"];

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-900 to-brand-700 text-white flex items-center justify-center shadow-md shadow-brand-900/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 21a9 9 0 0 0 9-9c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9z"/><path d="M12 7v5l3 3"/></svg>
            </div>
            <div>
              <h1 className="font-extrabold text-lg leading-none tracking-tight text-ink-900">Shyft Studio</h1>
              <p className="text-[11px] text-brand-500 font-medium leading-none mt-1">Internal / {user.role === "OWNER" ? "Owner" : user.role === "SALES" ? "Sales" : "Production"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/customers" className="text-sm font-semibold text-brand-600 hover:text-brand-900 transition">Customers</a>
            <a href="/jobs" className="text-sm font-semibold text-brand-600 hover:text-brand-900 transition">Pipeline</a>
            <form action="/api/auth/logout" method="POST" className="inline"><button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Welcome + actions */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink-900 leading-tight">Welcome back, {user.name.split(" ")[0]}.</h2>
            <p className="text-brand-600 mt-2 text-base max-w-xl">{lateJobs.length > 0 ? `There ${lateJobs.length === 1 ? "is" : "are"} ${lateJobs.length} job${lateJobs.length === 1 ? "" : "s"} running late — let's get ahead of them.` : "Pipeline is healthy. Here's what needs your attention today."}</p>
          </div>
          <div className="flex gap-3">
            <a href="/jobs" className="inline-flex items-center gap-2 rounded-xl bg-brand-900 text-white px-5 py-3 text-sm font-bold shadow-xl shadow-brand-900/15 hover:shadow-2xl hover:-translate-y-0.5 transition">View pipeline</a>
            <a href="/customers" className="inline-flex items-center gap-2 rounded-xl bg-white border border-brand-200 text-brand-800 px-5 py-3 text-sm font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">Customers</a>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total jobs", value: totalJobs, sub: "In progress", color: "bg-brand-900 text-white" },
            { label: "Late / at risk", value: lateJobs.length, sub: "Need attention", color: lateJobs.length ? "bg-rose text-white" : "bg-emerald text-white" },
            { label: "In Design", value: stages.find((s: any) => s.stage === "DESIGN")?.count || 0, sub: "Waiting for sign-off", color: "bg-rose-soft text-rose border border-rose/10" },
            { label: "Customers", value: customers.length, sub: "Active accounts", color: "bg-brand-100 text-brand-800 border border-brand-200" },
          ].map((s) => (
            <a href={s.label === "Total jobs" || s.label === "Late / at risk" ? "/jobs" : s.label === "In Design" ? "/jobs" : "/customers"} key={s.label} className={`rounded-2xl p-6 shadow-sm border transition hover:-translate-y-0.5 hover:shadow-md ${s.color.includes("text-white") ? s.color + " shadow-lg shadow-brand-900/10" : s.color}`}>
              <div className="text-xs font-bold uppercase tracking-wide opacity-80">{s.label}</div>
              <div className="text-4xl font-extrabold tracking-tighter mt-1">{s.value}</div>
              <div className="text-xs font-medium mt-2 opacity-80">{s.sub}</div>
            </a>
          ))}
        </section>

        {/* Late banner */}
        {lateJobs.length > 0 && (
          <section className="rounded-2xl bg-gradient-to-r from-rose/10 to-rose-soft border border-rose/20 p-6 flex flex-col md:flex-row md:items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-rose text-white flex items-center justify-center shadow-md shadow-rose/20 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div className="flex-1">
              <h3 className="font-extrabold text-ink-900">Late / at-risk jobs</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {lateJobs.map((j: any) => (
                  <a key={j.id} href={`/jobs/${j.id}`} className="inline-flex items-center gap-2 rounded-lg bg-white/70 border border-rose/20 px-3 py-1.5 text-sm font-bold text-rose hover:bg-white transition shadow-sm">
                    {j.title} <span className="text-[10px] bg-rose text-white px-1.5 py-0.5 rounded-full font-extrabold">{j.stage}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Pipeline Preview */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-extrabold tracking-tight text-ink-900">Pipeline preview</h3>
            <a href="/jobs" className="text-sm font-bold text-brand-600 hover:text-brand-900 transition">Full view →</a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stageOrder.map((stage) => {
              const stageData = stages.find((s: any) => s.stage === stage);
              const count = stageData?.count || 0;
              return (
                <div key={stage} className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${stageColors[stage]}`}>
                  <div className="text-xs font-extrabold uppercase tracking-wider opacity-70">{stageLabels[stage]}</div>
                  <div className="text-3xl font-extrabold tracking-tighter mt-1">{count}</div>
                  <div className="mt-3 space-y-2">
                    {getJobs({ stage }).slice(0, 3).map((j: any) => (
                      <a key={j.id} href={`/jobs/${j.id}`} className={`block rounded-lg px-3 py-2 text-xs font-semibold leading-snug shadow-sm ${stage === "DESIGN" ? "bg-white/10 hover:bg-white/20" : stage === "PRINTING" ? "bg-white/10 hover:bg-white/20" : stage === "ENQUIRY" ? "bg-amber-soft/60 hover:bg-amber-soft" : "bg-brand-50/60 hover:bg-brand-50"} transition`}>
                        <div className="truncate">{j.title}</div>
                        <div className={`text-[10px] font-bold mt-0.5 ${stage === "DESIGN" ? "text-rose/80" : stage === "ENQUIRY" ? "text-amber-deep/70" : "text-brand-500"}`}>{j.assigned_to ? "Assigned" : "Unassigned"}</div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom: quick info + AI widget */}
        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-3xl bg-white border border-brand-200/60 shadow-sm p-6 md:p-8">
            <h3 className="text-xl font-extrabold tracking-tight text-ink-900 mb-4">Quick insight</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-brand-50 border border-brand-200/60 p-5">
                <h4 className="font-extrabold text-brand-900">Repeat order ready</h4>
                <p className="text-sm text-brand-600 mt-1">BrightTech Solutions called asking for the same order as last month (500 cards + 50 brochures). Design already approved.</p>
                <a href="/jobs" className="inline-block mt-3 text-xs font-extrabold text-amber-deep hover:underline">See quoted job →</a>
              </div>
              <div className="rounded-xl bg-brand-50 border border-brand-200/60 p-5">
                <h4 className="font-extrabold text-brand-900">Messy new enquiry</h4>
                <p className="text-sm text-brand-600 mt-1">Priya Nair called from an unknown number about "brochures for a conference." Unclear quantity or deadline — needs follow-up.</p>
                <a href="/customers/3" className="inline-block mt-3 text-xs font-extrabold text-amber-deep hover:underline">Customer profile →</a>
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-brand-900 to-brand-800 text-white p-6 md:p-8 shadow-xl shadow-brand-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <h3 className="text-xl font-extrabold tracking-tight relative">Shyft Assistant</h3>
            <p className="text-brand-300 text-sm mt-2 relative">Ask me in natural language. Try: <span className="text-white font-semibold">"What did Neha order last time?"</span></p>
            <ul className="mt-4 space-y-2 text-sm relative">
              {["Pipeline summary", "Late jobs", "Customer history", "Job status #7"].map(t => (
                <li key={t} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber" />{t}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <AssistantWidget />
    </div>
  );
}
