import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail, getCustomers, getJobs } from "@/lib/db.mjs";

export default function CustomersPage() {
  const c = cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const customers = getCustomers();
  const jobs = getJobs();

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Customers</h1>
            <p className="text-sm text-brand-500">History, orders, and follow-up — all in one view.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm font-bold text-brand-600 hover:text-brand-900">Dashboard</Link>
            <Link href="/jobs" className="text-sm font-bold text-brand-600 hover:text-brand-900">Pipeline</Link>
            <form action="/api/auth/logout" method="POST" className="inline"><button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c: any) => {
            const customerJobs = jobs.filter((j: any) => j.customer_id === c.id);
            const delivered = customerJobs.filter((j: any) => j.stage === "DELIVERED").length;
            const totalQuote = customerJobs.reduce((s: number, j: any) => s + (j.quote_amount || 0), 0);
            return (
              <Link key={c.id} href={`/customers/${c.id}`} className="rounded-2xl bg-white border border-brand-200/60 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition block">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-900 to-brand-700 text-white flex items-center justify-center font-extrabold shadow-md shadow-brand-900/10">{c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</div>
                  <div>
                    <h3 className="font-extrabold text-ink-900 leading-tight">{c.name}</h3>
                    <p className="text-xs text-brand-400 font-medium">{c.company || "No company"}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-xs font-semibold text-brand-600">
                  <span>{customerJobs.length} job{customerJobs.length === 1 ? "" : "s"}</span>
                  <span>•</span>
                  <span>{delivered} delivered</span>
                </div>
                <div className="mt-3 text-xs font-bold text-brand-400">Total quoted: ₹{totalQuote.toLocaleString("en-IN")}</div>
                <div className="mt-3 text-xs text-brand-400 leading-relaxed truncate">{c.notes || "No notes."}</div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
