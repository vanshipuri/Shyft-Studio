import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  getUserByEmail,
  getCustomers,
  getJobs,
  getLateJobs,
  getStageCounts,
  getPipelineMetrics,
  getTeamWorkload,
  getCustomerMetrics
} from "@/lib/db.mjs";
import { analyzeProductionRisks, computeReengagementNudges, generateDailyBriefing } from "@/lib/ai-engine.mjs";
import AssistantWidget from "@/components/AssistantWidget";
import RoleSwitcher from "@/components/RoleSwitcher";
import TopNav from "@/components/TopNav";
import MessyLeadModal from "@/components/MessyLeadModal";
import RepeatOrderModal from "@/components/RepeatOrderModal";

export default async function DashboardPage() {
  const c = await cookies();
  const session = c.get("shyft_session")?.value;
  if (!session) redirect("/login");
  const user = getUserByEmail(session);
  if (!user) redirect("/login");

  const allJobs = getJobs();
  const lateJobs = getLateJobs();
  const stages = getStageCounts();
  const customers = getCustomers();
  const metrics = getPipelineMetrics();
  const teamWorkload = getTeamWorkload();
  const riskAnalysis = analyzeProductionRisks();
  const reengagementNudges = computeReengagementNudges();
  const briefing = generateDailyBriefing(user.role);

  const customerMap = new Map<number, any>(customers.map((c: any) => [c.id, c]));

  const stageColors: Record<string, string> = {
    ENQUIRY: "bg-amber-soft text-amber-deep border-amber/20",
    QUOTED: "bg-brand-200 text-brand-800 border-brand-300",
    DESIGN: "bg-rose-soft text-rose border-rose/20",
    PRINTING: "bg-brand-900 text-white border-brand-900",
    READY: "bg-emerald-soft text-emerald border-emerald/20",
    DELIVERED: "bg-brand-100 text-brand-700 border-brand-300",
  };

  const stageLabels: Record<string, string> = {
    ENQUIRY: "Enquiry",
    QUOTED: "Quoted",
    DESIGN: "Design",
    PRINTING: "Printing",
    READY: "Ready",
    DELIVERED: "Delivered",
  };

  const stageOrder = ["ENQUIRY", "QUOTED", "DESIGN", "PRINTING", "READY", "DELIVERED"];

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Persona Switcher Bar */}
      <RoleSwitcher currentUser={user} />

      {/* Shared responsive navigation */}
      <TopNav
        user={user}
        active="dashboard"
        quickActions={
          <>
            <MessyLeadModal />
            <RepeatOrderModal customers={customers} />
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Welcome Section */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 anim-fade-up">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-500 mb-1 uppercase tracking-wider">
              {user.role === "OWNER" ? "Executive Radar" : user.role === "SALES" ? "Sales Pipeline & Ingestion" : "Print Floor Operations"}
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink-900 leading-tight">
              Welcome back, {user.name.split(" ")[0]}.
            </h2>
            <p className="text-brand-600 mt-1 text-sm max-w-2xl">
              {user.role === "OWNER"
                ? `Active pipeline sits at ₹${metrics.pipelineValue.toLocaleString("en-IN")}. ${lateJobs.length > 0 ? `⚠️ ${lateJobs.length} job running late requiring floor intervention.` : "All stages operating on schedule."}`
                : user.role === "SALES"
                ? `You have ${allJobs.filter((j: any) => j.stage === "ENQUIRY").length} unquoted enquiry and ₹${metrics.quotedValue.toLocaleString("en-IN")} in quoted deals awaiting client sign-off.`
                : `You have ${allJobs.filter((j: any) => j.stage === "PRINTING").length} jobs on the print floor and ${allJobs.filter((j: any) => j.stage === "READY").length} ready for dispatch.`}
            </p>
          </div>

          <div className="flex gap-2.5 shrink-0">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-900 hover:bg-brand-800 text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-brand-900/15 transition hover:-translate-y-0.5"
            >
              Open Pipeline Board →
            </Link>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 1. OWNER / EXECUTIVE ROLE VIEW                                */}
        {/* ------------------------------------------------------------- */}
        {user.role === "OWNER" && (
          <div className="space-y-8">
            {/* Daily Briefing — the owner's one-screen "what needs me today" */}
            <section className="rounded-3xl bg-gradient-to-br from-brand-950 to-brand-900 text-white shadow-lg shadow-brand-950/10 border border-brand-800/60 p-6 md:p-7 space-y-4 overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-44 h-44 bg-amber/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber text-brand-950 flex items-center justify-center font-black text-base shadow-md">📌</div>
                  <div>
                    <h3 className="text-lg font-extrabold tracking-tight">Daily Briefing — {briefing.date}</h3>
                    <p className="text-[11px] text-brand-400 font-medium">Auto-generated from live pipeline data each morning</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-white/10 text-amber border border-white/10 w-fit">
                  {briefing.counts.atRisk > 0 ? `${briefing.counts.atRisk} at-risk · action needed` : "All clear"}
                </span>
              </div>

              <p className="text-sm text-brand-100 leading-relaxed bg-black/20 border border-white/5 rounded-2xl p-3.5 font-medium">
                {briefing.headline}
              </p>

              <ul className="grid md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-brand-200">
                {briefing.bullets.map((b: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-amber mt-0.5 shrink-0">◆</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-center">
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                  <div className="text-lg font-black text-amber leading-none">{briefing.counts.atRisk}</div>
                  <div className="text-[10px] text-brand-400 mt-1 font-semibold uppercase tracking-wide">At-Risk Jobs</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                  <div className="text-lg font-black text-white leading-none">{briefing.counts.overdueCheckIns}</div>
                  <div className="text-[10px] text-brand-400 mt-1 font-semibold uppercase tracking-wide">Clients Due Check-in</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                  <div className="text-lg font-black text-white leading-none">{briefing.counts.agingEnquiries}</div>
                  <div className="text-[10px] text-brand-400 mt-1 font-semibold uppercase tracking-wide">Aging Enquiries</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                  <div className="text-lg font-black text-amber leading-none">₹{Math.round(briefing.counts.pipelineValue / 1000)}k</div>
                  <div className="text-[10px] text-brand-400 mt-1 font-semibold uppercase tracking-wide">Active Pipeline</div>
                </div>
              </div>
            </section>

            {/* Executive KPIs */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl p-5 shadow-sm border bg-brand-950 text-white">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-300">Active Pipeline Value</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-amber">₹{metrics.pipelineValue.toLocaleString("en-IN")}</div>
                <div className="text-xs text-brand-400 mt-1.5">{metrics.activeJobsCount} active jobs across stages</div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border bg-white border-brand-200">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-500">Delivered Realized Revenue</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-emerald">₹{metrics.realizedRevenue.toLocaleString("en-IN")}</div>
                <div className="text-xs text-brand-400 mt-1.5">{metrics.deliveredJobsCount} completed jobs</div>
              </div>

              <div className={`rounded-2xl p-5 shadow-sm border ${lateJobs.length > 0 ? "bg-rose-soft border-rose/30 text-rose" : "bg-white border-brand-200 text-brand-900"}`}>
                <div className="text-xs font-bold uppercase tracking-wide opacity-80">Revenue at Late Risk</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1">₹{metrics.lateRevenue.toLocaleString("en-IN")}</div>
                <div className="text-xs font-semibold mt-1.5 opacity-80">{lateJobs.length} job(s) past promised SLA</div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border bg-white border-brand-200">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-500">Average Ticket Size</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-ink-900">₹{metrics.averageTicketSize.toLocaleString("en-IN")}</div>
                <div className="text-xs text-brand-400 mt-1.5">Across {customers.length} client accounts</div>
              </div>
            </section>

            {/* Bottlenecks Radar & Workload Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Bottleneck Radar */}
              <div className="lg:col-span-2 rounded-3xl bg-white border border-brand-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-ink-900">Operational Bottleneck Radar</h3>
                    <p className="text-xs text-brand-500">Automated diagnostic of print floor throughput & delays</p>
                  </div>
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${riskAnalysis.overallHealth === "Healthy" ? "bg-emerald-soft text-emerald" : "bg-rose-soft text-rose"}`}>
                    {riskAnalysis.overallHealth}
                  </span>
                </div>

                <div className="space-y-3">
                  {riskAnalysis.bottlenecks.map((b: any, i: number) => (
                    <div key={i} className="p-4 rounded-2xl bg-brand-50 border border-brand-200/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-ink-900 uppercase tracking-wider">
                          Stage: {b.stage}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${b.severity === "Critical" ? "bg-rose text-white" : b.severity === "High" ? "bg-amber text-brand-950" : "bg-brand-200 text-brand-800"}`}>
                          {b.severity} Severity
                        </span>
                      </div>
                      <p className="text-xs text-brand-700">{b.description}</p>
                      <div className="pt-2 text-xs font-bold text-amber-deep flex items-center gap-1.5">
                        <span>💡 Recommended Action:</span> {b.solution}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Workload Distribution */}
              <div className="rounded-3xl bg-white border border-brand-200 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-ink-900">Team Workload Split</h3>
                  <p className="text-xs text-brand-500">Active assignments across the 3-person team</p>
                </div>

                <div className="space-y-3">
                  {teamWorkload.map((member: any) => (
                    <div key={member.userId} className="p-3.5 rounded-2xl bg-brand-50 border border-brand-200/60">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-ink-900">{member.name}</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-200 text-brand-700">{member.role}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-brand-600">
                        <span>{member.activeJobsCount} Active Jobs</span>
                        <span className="font-extrabold text-brand-900">₹{member.activeValue.toLocaleString("en-IN")}</span>
                      </div>
                      {member.lateCount > 0 && (
                        <div className="mt-1 text-[11px] font-extrabold text-rose">⚠️ {member.lateCount} job running late</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Customer Lifetime Value Leaderboard */}
            <section className="rounded-3xl bg-white border border-brand-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-ink-900">Customer Lifetime Value (LTV) Leaderboard</h3>
                  <p className="text-xs text-brand-500">Instant intelligence on top accounts — no need to phone Abhishek</p>
                </div>
                <Link href="/customers" className="text-xs font-bold text-amber-deep hover:underline">
                  All Customers →
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers.map((c: any) => {
                  const m = getCustomerMetrics(c.id);
                  return (
                    <Link
                      key={c.id}
                      href={`/customers/${c.id}`}
                      className="p-4 rounded-2xl bg-brand-50/70 border border-brand-200 hover:border-amber hover:bg-white transition group block"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-ink-900 group-hover:text-amber-deep transition">{c.name}</span>
                        {m.isRepeat && (
                          <span className="text-[10px] font-extrabold bg-emerald-soft text-emerald px-2 py-0.5 rounded-full border border-emerald/20">
                            Repeat Client
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-brand-500 mt-0.5">{c.company || "Independent"}</p>
                      <div className="mt-3 pt-3 border-t border-brand-200/60 flex items-center justify-between text-xs">
                        <span className="text-brand-500">{m.totalOrders} total jobs</span>
                        <span className="font-extrabold text-brand-950">LTV: ₹{m.totalSpend.toLocaleString("en-IN")}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 2. SALES ROLE VIEW (Abhishek)                                 */}
        {/* ------------------------------------------------------------- */}
        {user.role === "SALES" && (
          <div className="space-y-8">
            {/* Sales KPIs */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl p-5 shadow-sm border bg-amber-soft border-amber/30 text-amber-deep">
                <div className="text-xs font-bold uppercase tracking-wide">Unquoted Enquiries</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1">
                  {allJobs.filter((j: any) => j.stage === "ENQUIRY").length}
                </div>
                <div className="text-xs font-semibold mt-1.5 opacity-80">Needs quote & clarification</div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border bg-brand-900 text-white">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-300">Quoted Pipeline</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-amber">
                  ₹{metrics.quotedValue.toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-brand-400 mt-1.5">
                  {allJobs.filter((j: any) => j.stage === "QUOTED").length} deals awaiting approval
                </div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border bg-white border-brand-200">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-500">Design Sign-Offs</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-ink-900">
                  {allJobs.filter((j: any) => j.stage === "DESIGN").length}
                </div>
                <div className="text-xs text-brand-400 mt-1.5">Client proof approvals pending</div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border bg-white border-brand-200">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-500">Repeat Accounts</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-emerald">
                  {customers.filter((c: any) => getCustomerMetrics(c.id).isRepeat).length}
                </div>
                <div className="text-xs text-brand-400 mt-1.5">1-click re-order enabled</div>
              </div>
            </section>

            {/* Quick Actions for Sales: Messy Lead Parser & Follow-up Radar */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Messy Lead Intake Launcher Card */}
              <div className="rounded-3xl bg-gradient-to-br from-brand-900 to-brand-950 text-white p-6 md:p-8 shadow-xl shadow-brand-900/10 space-y-4 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-36 h-36 bg-amber/10 rounded-full blur-2xl pointer-events-none" />
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber text-brand-950 font-extrabold text-xs">
                  ⚡ Sales Power Feature
                </div>
                <h3 className="text-2xl font-extrabold tracking-tight">Messy WhatsApp & Chat Ingestion</h3>
                <p className="text-xs text-brand-300 leading-relaxed max-w-lg">
                  Turn informal Hindi/English WhatsApp messages, voice note transcripts, or vague client calls into structured jobs with auto-estimated pricing and pre-filled specs.
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <MessyLeadModal />
                  <RepeatOrderModal customers={customers} />
                </div>
              </div>

              {/* Follow-up & Stale Lead Radar */}
              <div className="rounded-3xl bg-white border border-brand-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-ink-900">Leads Needing Follow-up</h3>
                  <span className="text-xs font-bold bg-amber-soft text-amber-deep px-2.5 py-0.5 rounded-full border border-amber/20">
                    High Priority
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-amber-soft/40 border border-amber/20 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="font-extrabold text-ink-900">Priya Nair (Unconfirmed Enquiry)</strong>
                      <span className="text-amber-deep font-bold">Needs Specs</span>
                    </div>
                    <p className="text-brand-600">Client asked for conference brochures. Quantity and paper finish still missing.</p>
                    <div className="pt-1 flex gap-2">
                      <Link href="/customers/3" className="text-xs font-bold text-amber-deep hover:underline">View Client Profile →</Link>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-brand-50 border border-brand-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="font-extrabold text-ink-900">BrightTech Solutions (Repeat Quote)</strong>
                      <span className="text-emerald font-bold">Quoted: ₹12,600</span>
                    </div>
                    <p className="text-brand-600">Same as last time quote prepared. Confirm paper stock and trigger print run.</p>
                    <div className="pt-1 flex gap-2">
                      <Link href="/jobs/2" className="text-xs font-bold text-brand-900 hover:underline">View Job #2 →</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Proactive Re-engagement: repeat customers whose own cadence says "call me now" */}
            <section className="rounded-3xl bg-white border border-brand-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-ink-900">Repeat Customers Due for a Check-in</h3>
                  <p className="text-xs text-brand-500">Cadence learned from each client's own order history — catch the next order before they ask.</p>
                </div>
                <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${reengagementNudges.length > 0 ? "bg-emerald-soft text-emerald border-emerald/20" : "bg-brand-100 text-brand-600 border-brand-200"}`}>
                  {reengagementNudges.length} due now
                </span>
              </div>

              {reengagementNudges.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-3">
                  {reengagementNudges.map((n: any) => (
                    <div key={n.customerId} className="p-4 rounded-2xl border border-brand-200 bg-brand-50/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-sm font-extrabold text-ink-900 block">{n.customerName}</strong>
                          <span className="text-[11px] text-brand-500">{n.company || "Independent Account"}</span>
                        </div>
                        {n.priority === "high" ? (
                          <span className="text-[9px] bg-rose text-white px-2 py-0.5 rounded-full font-black">HOT LEAD</span>
                        ) : (
                          <span className="text-[9px] bg-amber text-brand-950 px-2 py-0.5 rounded-full font-black">RE-ENGAGE</span>
                        )}
                      </div>
                      <p className="text-[11px] text-brand-700 leading-relaxed bg-white border border-brand-200/70 rounded-xl p-2.5">
                        Last order: <strong>Job #{n.lastOrderId}</strong> — {n.lastOrderTitle} ({n.lastOrderDate})
                        <br />
                        <strong>{n.daysSinceLastOrder} days</strong> since last order · usual cadence ~<strong>{n.avgIntervalDays} days</strong> · <strong className="text-rose">{n.overdueByDays} days past window</strong>
                      </p>
                      <div className="pt-0.5">
                        <Link href={`/customers/${n.customerId}`} className="text-xs font-bold text-amber-deep hover:underline">
                          Open profile → 1-click repeat order
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-brand-400 bg-brand-50/60 rounded-2xl border border-dashed border-brand-200">
                  ✅ No repeat customer is currently outside their reorder window.
                </div>
              )}
            </section>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 3. PRODUCTION ROLE VIEW (Siddhant)                            */}
        {/* ------------------------------------------------------------- */}
        {user.role === "PRODUCTION" && (
          <div className="space-y-8">
            {/* Production KPIs */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl p-5 shadow-sm border bg-brand-950 text-white">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-300">Jobs in Printing</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-amber">
                  {allJobs.filter((j: any) => j.stage === "PRINTING").length}
                </div>
                <div className="text-xs text-brand-400 mt-1.5">Active on offset / digital presses</div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border bg-white border-brand-200">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-500">Ready for Dispatch</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-emerald">
                  {allJobs.filter((j: any) => j.stage === "READY").length}
                </div>
                <div className="text-xs text-brand-400 mt-1.5">Packaged and QC checked</div>
              </div>

              <div className={`rounded-2xl p-5 shadow-sm border ${lateJobs.length > 0 ? "bg-rose-soft border-rose/30 text-rose" : "bg-white border-brand-200 text-brand-900"}`}>
                <div className="text-xs font-bold uppercase tracking-wide opacity-80">Overdue on Floor</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1">{lateJobs.length}</div>
                <div className="text-xs font-semibold mt-1.5 opacity-80">Requires floor fast-track</div>
              </div>

              <div className="rounded-2xl p-5 shadow-sm border bg-white border-brand-200">
                <div className="text-xs font-bold uppercase tracking-wide text-brand-500">In Pre-Press Design</div>
                <div className="text-3xl font-extrabold tracking-tight mt-1 text-ink-900">
                  {allJobs.filter((j: any) => j.stage === "DESIGN").length}
                </div>
                <div className="text-xs text-brand-400 mt-1.5">Waiting for proof sign-off</div>
              </div>
            </section>

            {/* Print Floor Queue & Machine Load */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Print Queue */}
              <div className="lg:col-span-2 rounded-3xl bg-white border border-brand-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-ink-900">Print Floor Priority Queue</h3>
                    <p className="text-xs text-brand-500">Machine sequencing sorted by urgency and SLA due date</p>
                  </div>
                  <span className="text-xs font-bold text-brand-600 bg-brand-100 px-3 py-1 rounded-full">
                    Active Floor Load
                  </span>
                </div>

                <div className="space-y-3">
                  {allJobs
                    .filter((j: any) => j.stage === "PRINTING" || j.stage === "DESIGN" || j.stage === "READY")
                    .map((j: any) => {
                      const cust = customerMap.get(j.customer_id);
                      return (
                        <div
                          key={j.id}
                          className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            j.is_late
                              ? "border-rose bg-rose-soft/40"
                              : j.priority === "urgent"
                              ? "border-amber bg-amber-soft/30"
                              : "border-brand-200 bg-brand-50/50"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-ink-900">Job #{j.id}: {j.title}</span>
                              {j.is_late && (
                                <span className="text-[10px] bg-rose text-white px-2 py-0.5 rounded-full font-extrabold">
                                  OVERDUE
                                </span>
                              )}
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${j.priority === "urgent" ? "bg-rose/10 text-rose" : "bg-brand-200 text-brand-700"}`}>
                                {j.priority.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-brand-600 mt-1">Client: {cust?.name} ({cust?.company || "Independent"})</p>
                            <p className="text-[11px] text-brand-500 mt-0.5">Due: {j.due_date ? j.due_date.split("T")[0] : "No date"} • {j.notes || "No special notes"}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              href={`/jobs/${j.id}`}
                              className="px-3 py-1.5 rounded-xl bg-brand-900 hover:bg-brand-800 text-white text-xs font-bold transition shadow-sm"
                            >
                              Open Work Order →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Machine & Paper Stock Status Panel */}
              <div className="rounded-3xl bg-white border border-brand-200 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-ink-900">Paper & Machine Alerts</h3>
                  <p className="text-xs text-brand-500">Hardware dependencies & raw stock status</p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-rose-soft border border-rose/20 text-rose space-y-1">
                    <strong className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose" />
                      Paper Stock Delay (Job #7)
                    </strong>
                    <p className="text-brand-700 text-[11px]">Premium foil cardstock delivery delayed from supplier. Expected arrival today 11:00 AM.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-soft border border-amber/20 text-amber-deep space-y-1">
                    <strong className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber" />
                      Lamination Machine Queue (Job #6)
                    </strong>
                    <p className="text-brand-700 text-[11px]">Vihaan Interiors A1 posters require heavy matte thermal lamination after printing.</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-soft border border-emerald/20 text-emerald space-y-1">
                    <strong className="font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald" />
                      300gsm Art Card Stock: OK
                    </strong>
                    <p className="text-brand-700 text-[11px]">Sufficient inventory for BrightTech repeat run.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Pipeline Stage Distribution (Universal for all roles)         */}
        {/* ------------------------------------------------------------- */}
        <section className="space-y-4 pt-4 border-t border-brand-200/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold tracking-tight text-ink-900">Pipeline Stage Overview</h3>
              <p className="text-xs text-brand-500">Live summary of jobs moving across production stages</p>
            </div>
            <Link href="/jobs" className="text-xs font-bold text-amber-deep hover:underline">
              Full Kanban Board →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stageOrder.map((stage) => {
              const stageData = stages.find((s: any) => s.stage === stage);
              const count = stageData?.count || 0;
              const stageJobs = allJobs.filter((j: any) => j.stage === stage);
              const totalStageQuote = stageJobs.reduce((s: number, j: any) => s + (j.quote_amount || 0), 0);

              return (
                <div key={stage} className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${stageColors[stage]}`}>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider opacity-75">{stageLabels[stage]}</div>
                  <div className="text-2xl font-black tracking-tight mt-1">{count}</div>
                  <div className="text-[11px] font-bold opacity-80 mt-0.5">₹{totalStageQuote.toLocaleString("en-IN")}</div>

                  <div className="mt-3 space-y-1.5">
                    {stageJobs.slice(0, 2).map((j: any) => (
                      <Link
                        key={j.id}
                        href={`/jobs/${j.id}`}
                        className={`block rounded-lg px-2.5 py-1.5 text-[11px] font-semibold leading-snug shadow-2xs transition truncate ${
                          stage === "PRINTING"
                            ? "bg-white/10 hover:bg-white/20 text-white"
                            : stage === "DESIGN"
                            ? "bg-rose-soft/80 hover:bg-rose-soft text-rose"
                            : "bg-white/80 hover:bg-white text-ink-900"
                        }`}
                      >
                        {j.title}
                      </Link>
                    ))}
                    {count > 2 && (
                      <div className="text-[10px] font-bold opacity-60 text-center pt-0.5">
                        +{count - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Floating AI Copilot Widget */}
      <AssistantWidget role={user.role} />
    </div>
  );
}
