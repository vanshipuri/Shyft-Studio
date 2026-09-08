import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  getUserByEmail,
  getCustomerById,
  getCustomerJobs,
  getNotesForCustomer,
  getCustomerMetrics,
  getCustomers
} from "@/lib/db.mjs";
import RoleSwitcher from "@/components/RoleSwitcher";
import TopNav from "@/components/TopNav";
import RepeatOrderModal from "@/components/RepeatOrderModal";
import MessyLeadModal from "@/components/MessyLeadModal";
import AssistantWidget from "@/components/AssistantWidget";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const customerId = parseInt(id, 10);
  const customer = getCustomerById(customerId);
  if (!customer) redirect("/customers");

  const allCustomers = getCustomers();
  const jobs = getCustomerJobs(customer.id);
  const notes = getNotesForCustomer(customer.id);
  const metrics = getCustomerMetrics(customer.id);

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
            <RepeatOrderModal customers={allCustomers} initialCustomerId={customer.id} />
            <MessyLeadModal />
          </>
        }
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Breadcrumb */}
        <section className="anim-fade-up">
          <nav className="flex items-center gap-2 text-xs font-bold text-brand-400" aria-label="Breadcrumb">
            <Link href="/customers" className="hover:text-brand-700 transition">
              ← Customers Directory
            </Link>
            <span aria-hidden="true" className="text-brand-300">•</span>
            <span className="text-brand-600">Customer #{customer.id}</span>
          </nav>
        </section>

        {/* Customer 360 Hero Profile */}
        <section className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-950 to-brand-800 text-white flex items-center justify-center text-xl font-black shadow-lg">
                {customer.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-ink-900">{customer.name}</h1>
                  {metrics.isRepeat && (
                    <span className="text-xs font-extrabold bg-emerald-soft text-emerald px-2.5 py-0.5 rounded-full border border-emerald/20">
                      Regular Client
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-500 mt-0.5">
                  {customer.company || "Independent Account"} • Account Active since {new Date(customer.created_at).toLocaleString("en-GB", { month: "short", year: "numeric" })}
                </p>
                <p className="text-xs text-brand-600 mt-1">
                  📞 {customer.phone || "No phone"} • ✉️ {customer.email || "No email"}
                </p>
              </div>
            </div>

          </div>

          {/* Metric KPI Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200/60">
              <div className="text-[10px] font-bold text-brand-400 uppercase">Lifetime Value (LTV)</div>
              <div className="text-2xl font-black text-brand-950 mt-1">
                ₹{metrics.totalSpend.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200/60">
              <div className="text-[10px] font-bold text-brand-400 uppercase">Total Orders</div>
              <div className="text-2xl font-black text-brand-950 mt-1">{metrics.totalOrders}</div>
            </div>

            <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200/60">
              <div className="text-[10px] font-bold text-brand-400 uppercase">Delivered Orders</div>
              <div className="text-2xl font-black text-emerald mt-1">{metrics.deliveredOrders}</div>
            </div>

            <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200/60">
              <div className="text-[10px] font-bold text-brand-400 uppercase">Average Order Size</div>
              <div className="text-2xl font-black text-brand-950 mt-1">
                ₹{metrics.averageOrderValue.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Client Notes & AI Preferences */}
          <div className="p-4 rounded-2xl bg-amber-soft/50 border border-amber/20 text-xs text-brand-800 leading-relaxed space-y-1">
            <div className="font-extrabold text-amber-deep flex items-center gap-1.5">
              <span>📋 Customer Preferences & Profile Notes:</span>
            </div>
            <p>{customer.notes || "No special paper or delivery instructions noted."}</p>
          </div>
        </section>

        {/* Order History Table */}
        <section className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-ink-900">Order & Quotation History</h3>
              <p className="text-xs text-brand-500">Historical jobs, specifications, and turnaround</p>
            </div>
            <span className="text-xs font-bold text-brand-600 bg-brand-100 px-3 py-1 rounded-full">
              {jobs.length} Orders
            </span>
          </div>

          <div className="divide-y divide-brand-100 border-t border-brand-100">
            {jobs.map((j: any) => (
              <div key={j.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-50/50 p-2 rounded-xl transition">
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/jobs/${j.id}`} className="font-extrabold text-sm text-ink-900 hover:text-amber-deep transition">
                      Job #{j.id}: {j.title}
                    </Link>
                    {j.is_late ? (
                      <span className="text-[9px] bg-rose text-white px-1.5 py-0.5 rounded-full font-black">
                        LATE
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-brand-500 mt-0.5">{j.description || "No description."}</p>
                  <p className="text-[11px] text-brand-400 mt-1">
                    Due: {j.due_date ? j.due_date.split("T")[0] : "—"} • Created: {new Date(j.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-black text-sm text-brand-950 block">
                      {j.quote_amount ? `₹${j.quote_amount.toLocaleString("en-IN")}` : "Unquoted"}
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      j.stage === "DELIVERED"
                        ? "bg-emerald-soft text-emerald"
                        : j.stage === "PRINTING"
                        ? "bg-brand-900 text-white"
                        : "bg-brand-200 text-brand-800"
                    }`}>
                      {j.stage}
                    </span>
                  </div>

                  <Link
                    href={`/jobs/${j.id}`}
                    className="px-3 py-1.5 rounded-xl bg-brand-100 hover:bg-brand-200 text-brand-800 text-xs font-bold transition"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}

            {jobs.length === 0 && (
              <div className="py-8 text-center text-xs text-brand-400">No past orders found for this customer.</div>
            )}
          </div>
        </section>

        {/* Customer Notes */}
        <section className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-extrabold text-ink-900">Communication Log</h3>
          <div className="space-y-3">
            {notes.map((n: any) => (
              <div key={n.id} className="p-3.5 rounded-2xl bg-brand-50/70 border border-brand-200/60 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-brand-400 font-bold">
                  <span className="text-brand-700">{n.author_name}</span>
                  <span>{new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-xs text-ink-900 leading-relaxed">{n.content}</p>
              </div>
            ))}
            {notes.length === 0 && (
              <div className="py-4 text-xs text-brand-400 text-center">No customer notes logged.</div>
            )}
          </div>
        </section>
      </main>

      <AssistantWidget role={user.role} />
    </div>
  );
}
