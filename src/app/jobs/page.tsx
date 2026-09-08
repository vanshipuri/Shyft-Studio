import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail, getJobs, getCustomers, getLateJobs, getAllUsers } from "@/lib/db.mjs";
import PipelineBoard from "@/components/PipelineBoard";
import RoleSwitcher from "@/components/RoleSwitcher";
import MessyLeadModal from "@/components/MessyLeadModal";
import RepeatOrderModal from "@/components/RepeatOrderModal";
import AssistantWidget from "@/components/AssistantWidget";

export default function JobsPage() {
  const c = cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const allJobs = getJobs();
  const lateJobs = getLateJobs();
  const customers = getCustomers();
  const users = getAllUsers();

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Role Switcher */}
      <RoleSwitcher currentUser={user} />

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-brand-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Pipeline Board</h1>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-700">
                {allJobs.length} Jobs Total
              </span>
            </div>
            <p className="text-xs text-brand-500 mt-0.5">
              Clear ownership across stages • {lateJobs.length > 0 ? `⚠️ ${lateJobs.length} late/at risk.` : "All on track."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <MessyLeadModal />
            <RepeatOrderModal customers={customers} />
            <div className="h-4 w-px bg-brand-200 hidden sm:block" />
            <Link href="/dashboard" className="text-sm font-bold text-brand-700 hover:text-brand-950 transition">Dashboard</Link>
            <Link href="/customers" className="text-sm font-bold text-brand-700 hover:text-brand-950 transition">Customers</Link>
            <form action="/api/auth/logout" method="POST" className="inline">
              <button className="text-xs font-bold text-rose bg-rose-soft hover:bg-rose/10 px-3 py-1.5 rounded-lg transition">Log out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <PipelineBoard
          initialJobs={allJobs}
          customers={customers}
          users={users}
          currentUser={user}
        />
      </main>

      <AssistantWidget role={user.role} />
    </div>
  );
}
