import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail, getCustomers, getJobs, getCustomerMetrics } from "@/lib/db.mjs";
import RoleSwitcher from "@/components/RoleSwitcher";
import TopNav from "@/components/TopNav";
import MessyLeadModal from "@/components/MessyLeadModal";
import RepeatOrderModal from "@/components/RepeatOrderModal";
import AssistantWidget from "@/components/AssistantWidget";

export default async function CustomersPage() {
  const c = await cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const customers = getCustomers();
  const jobs = getJobs();

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Persona Switcher Bar */}
      <RoleSwitcher currentUser={user} />

      {/* Shared responsive navigation */}
      <TopNav
        user={user}
        active="customers"
        quickActions={
          <>
            <MessyLeadModal />
            <RepeatOrderModal customers={customers} />
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Page heading */}
        <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 anim-fade-up">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-400 mb-1">
              Account memory · no more phone-book hunting
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900 leading-tight">
                Customer 360 Accounts
              </h1>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 border border-brand-200/70">
                {customers.length} accounts
              </span>
            </div>
            <p className="text-brand-600 mt-1.5 text-sm text-pretty max-w-2xl">
              Order history, lifetime value, and repeat orders — without having to call sales.
            </p>
          </div>
        </section>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
