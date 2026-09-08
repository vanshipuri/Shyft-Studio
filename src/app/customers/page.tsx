import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail, getCustomers, getJobs, getCustomerMetrics } from "@/lib/db.mjs";
import RoleSwitcher from "@/components/RoleSwitcher";
import MessyLeadModal from "@/components/MessyLeadModal";
import RepeatOrderModal from "@/components/RepeatOrderModal";
import AssistantWidget from "@/components/AssistantWidget";

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
      {/* Top Role Switcher */}
      <RoleSwitcher currentUser={user} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Customer 360 Accounts</h1>
            <p className="text-xs text-brand-500 mt-0.5">Order history, lifetime value, and repeat orders without calling sales.</p>
          </div>

          <div className="flex items-center gap-3">
            <MessyLeadModal />
            <RepeatOrderModal customers={customers} />
            <div className="h-4 w-px bg-brand-200 hidden sm:block" />
            <Link href="/dashboard" className="text-sm font-bold text-brand-700 hover:text-brand-950 transition">Dashboard</Link>
            <Link href="/jobs" className="text-sm font-bold text-brand-700 hover:text-brand-950 transition">Pipeline</Link>
            <form action="/api/auth/logout" method="POST" className="inline">
              <button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {customers.map((c: any) => {
            const m = getCustomerMetrics(c.id);
            const customerJobs = jobs.filter((j: any) => j.customer_id === c.id);

            return (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="rounded-3xl bg-white border border-brand-200/80 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition block group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-950 to-brand-800 text-white flex items-center justify-center font-extrabold text-base shadow-md">
                      {c.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-ink-900 group-hover:text-amber-deep transition leading-tight">
                        {c.name}
                      </h3>
                      <p className="text-xs text-brand-500 font-medium mt-0.5">{c.company || "Independent Account"}</p>
                    </div>
                  </div>

                  {m.isRepeat && (
                    <span className="text-[10px] font-extrabold bg-emerald-soft text-emerald px-2 py-0.5 rounded-full border border-emerald/20">
                      Repeat
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-brand-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200/60">
                    <span className="text-[10px] text-brand-400 font-bold uppercase block">Lifetime Value</span>
                    <strong className="text-sm font-black text-brand-950">₹{m.totalSpend.toLocaleString("en-IN")}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200/60">
                    <span className="text-[10px] text-brand-400 font-bold uppercase block">Orders Count</span>
                    <strong className="text-sm font-black text-brand-950">{m.totalOrders} total ({m.deliveredOrders} delivered)</strong>
                  </div>
                </div>

                <div className="mt-3 text-xs text-brand-600 line-clamp-2 leading-relaxed bg-surface p-2.5 rounded-xl border border-brand-200/50">
                  <span className="font-bold text-brand-700">Notes: </span>
                  {c.notes || "No specific preferences recorded."}
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <AssistantWidget role={user.role} />
    </div>
  );
}
