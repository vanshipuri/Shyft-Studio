import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserByEmail, getJobs, getCustomers, getLateJobs, getAllUsers } from "@/lib/db.mjs";
import PipelineBoard from "@/components/PipelineBoard";
import RoleSwitcher from "@/components/RoleSwitcher";
import TopNav from "@/components/TopNav";
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
      {/* Top Persona Switcher Bar */}
      <RoleSwitcher currentUser={user} />

      {/* Shared responsive navigation */}
      <TopNav
        user={user}
        active="pipeline"
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
              Live operations · one owner per stage
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900 leading-tight">
                Pipeline Board
              </h1>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 border border-brand-200/70">
                {allJobs.length} jobs
              </span>
            </div>
            <p className="text-brand-600 mt-1.5 text-sm text-pretty max-w-2xl">
              {lateJobs.length > 0
                ? `⚠️ ${lateJobs.length} job${lateJobs.length > 1 ? "s" : ""} running late — flagged for fast-track.`
                : "Every stage is running on schedule. No late jobs."}
            </p>
          </div>
        </section>

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
