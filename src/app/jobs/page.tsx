import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail, getJobs, getCustomers, getLateJobs } from "@/lib/db.mjs";

export default function JobsPage() {
  const c = cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const allJobs = getJobs();
  const lateJobs = getLateJobs();
  const customers = getCustomers();
  const customerMap = new Map(customers.map((c: any) => [c.id, c.name]));

  const stages = ["ENQUIRY", "QUOTED", "DESIGN", "PRINTING", "READY", "DELIVERED"] as const;
  const stageLabels: Record<string, string> = { ENQUIRY: "Enquiry", QUOTED: "Quoted", DESIGN: "Design", PRINTING: "Printing", READY: "Ready", DELIVERED: "Delivered" };
  const stageColors: Record<string, string> = {
    ENQUIRY: "bg-amber-soft border-amber/20 text-amber-deep",
    QUOTED: "bg-brand-200 border-brand-300 text-brand-800",
    DESIGN: "bg-rose-soft border-rose/20 text-rose",
    PRINTING: "bg-brand-900 text-white border-brand-900",
    READY: "bg-emerald-soft border-emerald/20 text-emerald",
    DELIVERED: "bg-brand-100 border-brand-300 text-brand-700",
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Pipeline board</h1>
            <p className="text-sm text-brand-500">Clear ownership at every stage. {lateJobs.length > 0 ? `⚠ ${lateJobs.length} late.` : "All on track."}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-bold text-brand-600 hover:text-brand-900">Dashboard</Link>
            <Link href="/customers" className="text-sm font-bold text-brand-600 hover:text-brand-900">Customers</Link>
            <form action="/api/auth/logout" method="POST" className="inline"><button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stages.map((stage) => {
            const jobs = allJobs.filter((j: any) => j.stage === stage);
            return (
              <div key={stage} className="rounded-3xl bg-white border border-brand-200/60 shadow-sm flex flex-col max-h-[80vh]">
                <div className={`px-4 py-3 rounded-t-3xl border-b flex items-center justify-between ${stageColors[stage]}`}>
                  <div>
                    <h3 className="font-extrabold text-sm leading-tight">{stageLabels[stage]}</h3>
                    <div className="text-xs font-bold opacity-70">{jobs.length} job{jobs.length === 1 ? "" : "s"}</div>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${stage === "PRINTING" ? "bg-white/20 text-white" : stage === "DESIGN" ? "bg-rose-soft text-rose" : "bg-brand-100 text-brand-700"}`}>{jobs.length}</span>
                </div>
                <div className="p-3 overflow-y-auto space-y-3 flex-1 min-h-[180px]">
                  {jobs.map((j: any) => (
                    <Link key={j.id} href={`/jobs/${j.id}`} className={`block rounded-2xl border p-3 shadow-sm hover:shadow-md transition hover:-translate-y-0.5 ${j.is_late ? "border-rose bg-rose-soft/30" : "border-brand-200 bg-brand-50/40"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-extrabold text-sm leading-snug text-ink-900 truncate">{j.title}</h4>
                        {j.is_late && <span className="text-[10px] bg-rose text-white px-1.5 py-0.5 rounded-full font-extrabold shrink-0">LATE</span>}
                      </div>
                      <p className="text-xs text-brand-500 mt-1">{String(customerMap.get(j.customer_id) || "Unknown")}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs font-medium">
                        <span className={`px-2 py-0.5 rounded-full ${j.priority === "urgent" ? "bg-rose/10 text-rose font-extrabold" : j.priority === "high" ? "bg-amber/10 text-amber-deep font-bold" : "bg-brand-200 text-brand-600"}`}>{j.priority}</span>
                        <span className="text-brand-400">•</span>
                        <span className="text-brand-600">{j.assigned_to ? "Assigned" : "Unassigned"}</span>
                      </div>
                      <div className="mt-2 text-xs text-brand-400">Quote ₹{j.quote_amount ? j.quote_amount.toLocaleString("en-IN") : "—"} • Due {j.due_date ? new Date(j.due_date).toISOString().split("T")[0] : "—"}</div>
                    </Link>
                  ))}
                  {jobs.length === 0 && <div className="text-xs text-brand-300 font-medium text-center py-6">No jobs</div>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
