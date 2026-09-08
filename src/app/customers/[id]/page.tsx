import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUserByEmail, getCustomerById, getCustomerJobs, getNotesForCustomer } from "@/lib/db.mjs";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const c = cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const customer = getCustomerById(parseInt(params.id, 10));
  if (!customer) redirect("/customers");
  const jobs = getCustomerJobs(customer.id);
  const notes = getNotesForCustomer(customer.id);

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/customers" className="text-xs font-bold text-brand-400 hover:text-brand-600">Customers</Link>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 leading-none mt-0.5">{customer.name}</h1>
            <p className="text-sm text-brand-500">{customer.company || "No company"} • {customer.phone || "—"}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm font-bold text-brand-600 hover:text-brand-900">Dashboard</Link>
            <form action="/api/auth/logout" method="POST" className="inline"><button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="rounded-3xl bg-white border border-brand-200/60 shadow-sm p-6 md:p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-900 to-brand-700 text-white flex items-center justify-center text-xl font-extrabold shadow-lg shadow-brand-900/10">{customer.name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}</div>
            <div>
              <h2 className="text-xl font-extrabold text-ink-900">{customer.name}</h2>
              <p className="text-sm text-brand-500">Customer since {new Date(customer.created_at).toLocaleString("en-GB", { year: "numeric", month: "long" })}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl bg-brand-50 border border-brand-200/60 p-4">
              <div className="text-xs font-bold text-brand-400">Jobs</div>
              <div className="text-2xl font-extrabold text-brand-900">{jobs.length}</div>
            </div>
            <div className="rounded-xl bg-brand-50 border border-brand-200/60 p-4">
              <div className="text-xs font-bold text-brand-400">Delivered</div>
              <div className="text-2xl font-extrabold text-brand-900">{jobs.filter((j: any) => j.stage === "DELIVERED").length}</div>
            </div>
            <div className="rounded-xl bg-brand-50 border border-brand-200/60 p-4">
              <div className="text-xs font-bold text-brand-400">Total quoted</div>
              <div className="text-2xl font-extrabold text-brand-900">₹{jobs.reduce((s: number, j: any) => s + (j.quote_amount || 0), 0).toLocaleString("en-IN")}</div>
            </div>
          </div>
          <div className="mt-5 p-4 rounded-xl bg-amber-soft/40 border border-amber/10 text-sm text-brand-700 leading-relaxed">
            <strong className="font-extrabold">Notes:</strong> {customer.notes || "None recorded."}
          </div>
        </section>

        <section>
          <h3 className="text-xl font-extrabold text-ink-900 mb-3">Order history</h3>
          <div className="rounded-2xl bg-white border border-brand-200/60 shadow-sm divide-y divide-brand-100">
            {jobs.map((j: any) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-brand-50/50 transition">
                <div>
                  <div className="font-extrabold text-ink-900">{j.title}</div>
                  <div className="text-xs text-brand-400 mt-0.5">Stage {j.stage} • {j.due_date ? new Date(j.due_date).toISOString().split("T")[0] : "—"} • Quote ₹{j.quote_amount ? j.quote_amount.toLocaleString("en-IN") : "—"}</div>
                </div>
                <div className={`text-xs font-extrabold px-2 py-1 rounded-full ${j.is_late ? "bg-rose text-white" : j.stage === "DELIVERED" ? "bg-emerald-soft text-emerald" : "bg-brand-100 text-brand-600"}`}>{j.stage}</div>
              </Link>
            ))}
            {jobs.length === 0 && <div className="px-5 py-6 text-sm text-brand-400">No orders.</div>}
          </div>
        </section>

        <section>
          <h3 className="text-xl font-extrabold text-ink-900 mb-3">Notes & follow-ups</h3>
          <div className="rounded-2xl bg-white border border-brand-200/60 shadow-sm divide-y divide-brand-100">
            {notes.map((n: any) => (
              <div key={n.id} className="px-5 py-4">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-400 mb-1">
                  <span>{n.author_name}</span>
                  <span>•</span>
                  <span>{new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-sm text-ink-800 leading-relaxed">{n.content}</p>
              </div>
            ))}
            {notes.length === 0 && <div className="px-5 py-6 text-sm text-brand-400">No notes.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
