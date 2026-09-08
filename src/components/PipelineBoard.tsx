"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PIPELINE, ownerShortLabelForStage } from "@/lib/pipeline.mjs";

interface Job {
  id: number;
  title: string;
  description?: string;
  stage: string;
  assigned_to?: number;
  customer_id: number;
  quote_amount?: number;
  due_date?: string;
  paid_upfront?: number;
  priority: string;
  notes?: string;
  is_late?: number;
  created_at: string;
  updated_at: string;
  checklist?: string;
  lead_source?: string;
  specs_summary?: string;
}

interface Customer {
  id: number;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "OWNER" | "SALES" | "PRODUCTION";
}

export default function PipelineBoard({
  initialJobs,
  customers,
  users,
  currentUser
}: {
  initialJobs: Job[];
  customers: Customer[];
  users: User[];
  currentUser: User;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [selectedLens, setSelectedLens] = useState<"ALL" | "SALES" | "PRODUCTION" | "EXECUTIVE">(
    currentUser.role === "SALES" ? "SALES" : currentUser.role === "PRODUCTION" ? "PRODUCTION" : "ALL"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [onlyLate, setOnlyLate] = useState(false);
  const [updatingJobId, setUpdatingJobId] = useState<number | null>(null);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const stages = PIPELINE.map((s) => s.id) as string[];
  const stageLabels: Record<string, string> = {
    ENQUIRY: "Enquiry",
    QUOTED: "Quoted",
    DESIGN: "Design",
    PRINTING: "Printing",
    READY: "Ready",
    DELIVERED: "Delivered"
  };

  const stageColors: Record<string, string> = {
    ENQUIRY: "bg-amber-soft border-amber/20 text-amber-deep",
    QUOTED: "bg-brand-200 border-brand-300 text-brand-800",
    DESIGN: "bg-rose-soft border-rose/20 text-rose",
    PRINTING: "bg-brand-900 text-white border-brand-900",
    READY: "bg-emerald-soft border-emerald/20 text-emerald",
    DELIVERED: "bg-brand-100 border-brand-300 text-brand-700"
  };

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Lens filter
      if (selectedLens === "SALES" && (job.stage === "READY" || job.stage === "DELIVERED")) {
        // Sales focuses primarily on active pipeline & closing
      }
      if (selectedLens === "PRODUCTION" && job.stage === "ENQUIRY") {
        // Production focuses on Quoted/Design/Printing/Ready
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cust = customerMap.get(job.customer_id);
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesCust = cust?.name.toLowerCase().includes(q) || (cust?.company && cust.company.toLowerCase().includes(q));
        const matchesSpecs = (job.specs_summary || "").toLowerCase().includes(q);
        const matchesNotes = (job.notes || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesCust && !matchesSpecs && !matchesNotes) return false;
      }

      // Priority filter
      if (priorityFilter !== "ALL" && job.priority !== priorityFilter) return false;

      // Assignee filter
      if (assigneeFilter !== "ALL") {
        if (assigneeFilter === "UNASSIGNED" && job.assigned_to) return false;
        if (assigneeFilter !== "UNASSIGNED" && job.assigned_to !== parseInt(assigneeFilter, 10)) return false;
      }

      // Late filter
      if (onlyLate && !job.is_late && (!job.due_date || new Date(job.due_date) >= new Date())) return false;

      return true;
    });
  }, [jobs, selectedLens, searchQuery, priorityFilter, assigneeFilter, onlyLate, customerMap]);

  // Stage quick move function
  async function moveStage(jobId: number, direction: "prev" | "next") {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    const currentIdx = stages.indexOf(job.stage as any);
    if (currentIdx === -1) return;

    const newIdx = direction === "next" ? currentIdx + 1 : currentIdx - 1;
    if (newIdx < 0 || newIdx >= stages.length) return;

    const targetStage = stages[newIdx];
    setUpdatingJobId(jobId);

    // Optimistic UI update
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, stage: targetStage, is_late: targetStage === "DELIVERED" ? 0 : j.is_late } : j))
    );

    try {
      const res = await fetch("/api/jobs/update-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, stage: targetStage })
      });
      if (!res.ok) {
        // Revert on failure
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      router.refresh();
    } finally {
      setUpdatingJobId(null);
    }
  }

  // Calculate completion percentage for pre-flight checklist
  function getChecklistCount(job: Job) {
    const stageIdx = stages.indexOf(job.stage as any);
    if (stageIdx === 0) return { done: 0, total: 6 };
    if (stageIdx === 1) return { done: 1, total: 6 };
    if (stageIdx === 2) return { done: 2, total: 6 };
    if (stageIdx === 3) return { done: 3, total: 6 };
    if (stageIdx === 4) return { done: 5, total: 6 };
    return { done: 6, total: 6 };
  }

  return (
    <div className="space-y-6">
      {/* Perspective Lens Selector & Controls */}
      <div className="bg-white rounded-3xl p-5 border border-brand-200/80 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Lens Pills */}
          <div>
            <div className="text-[11px] font-extrabold text-brand-400 uppercase tracking-wider mb-1.5">
              Role Perspective Lens:
            </div>
            <div className="flex flex-wrap items-center gap-1.5 bg-brand-100 p-1 rounded-2xl border border-brand-200">
              <button
                type="button"
                onClick={() => setSelectedLens("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedLens === "ALL" ? "bg-white text-ink-900 shadow-sm" : "text-brand-600 hover:text-ink-900"
                }`}
              >
                🌐 All Jobs Overview
              </button>
              <button
                type="button"
                onClick={() => setSelectedLens("SALES")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedLens === "SALES" ? "bg-amber text-brand-950 shadow-sm font-extrabold" : "text-brand-600 hover:text-ink-900"
                }`}
              >
                💼 Sales Lens (Quotes & Enquiries)
              </button>
              <button
                type="button"
                onClick={() => setSelectedLens("PRODUCTION")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedLens === "PRODUCTION" ? "bg-brand-900 text-white shadow-sm font-extrabold" : "text-brand-600 hover:text-ink-900"
                }`}
              >
                ⚙️ Production Floor Lens (Checklists & SLA)
              </button>
              <button
                type="button"
                onClick={() => setSelectedLens("EXECUTIVE")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedLens === "EXECUTIVE" ? "bg-emerald text-white shadow-sm font-extrabold" : "text-brand-600 hover:text-ink-900"
                }`}
              >
                👑 Owner / Revenue Lens
              </button>
            </div>
          </div>

          {/* Quick Stats Banner based on lens */}
          <div className="flex items-center gap-4 text-xs font-semibold text-brand-600">
            <div className="bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200">
              Showing <strong className="text-ink-900 font-extrabold">{filteredJobs.length}</strong> of {jobs.length} jobs
            </div>
            <div className="bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200">
              Active Pipeline: <strong className="text-amber-deep font-extrabold">₹{filteredJobs.filter(j => j.stage !== "DELIVERED").reduce((s, j) => s + (j.quote_amount || 0), 0).toLocaleString("en-IN")}</strong>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-brand-200/60">
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, customer, specs…"
              className="w-full rounded-xl border border-brand-300 bg-brand-50/50 px-3 py-2 text-xs text-ink-900 placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-amber/40"
            />
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-xl border border-brand-300 bg-brand-50/50 px-3 py-2 text-xs font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-amber/40"
            >
              <option value="ALL">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="normal">⚪ Normal</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>

          <div>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full rounded-xl border border-brand-300 bg-brand-50/50 px-3 py-2 text-xs font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-amber/40"
            >
              <option value="ALL">All Assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned Only</option>
            </select>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-rose select-none">
              <input
                type="checkbox"
                checked={onlyLate}
                onChange={(e) => setOnlyLate(e.target.checked)}
                className="rounded text-rose focus:ring-rose/40"
              />
              <span>⚠️ Show Overdue / Late Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* 6-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stages.map((stage) => {
          const stageJobs = filteredJobs.filter((j) => j.stage === stage);
          const stageTotalRevenue = stageJobs.reduce((s, j) => s + (j.quote_amount || 0), 0);

          return (
            <div key={stage} className="rounded-3xl bg-white border border-brand-200/80 shadow-sm flex flex-col min-h-[280px] sm:min-h-[340px] lg:min-h-[440px] xl:min-h-[520px]">
              {/* Column Header */}
              <div className={`px-4 py-3.5 rounded-t-3xl border-b flex items-center justify-between ${stageColors[stage]}`}>
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">{stageLabels[stage]}</h3>
                  <div className="text-[11px] font-bold opacity-80 mt-0.5">
                    ₹{stageTotalRevenue.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] font-semibold opacity-75 mt-0.5">
                    👤 Owner: {ownerShortLabelForStage(stage)}
                  </div>
                </div>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  stage === "PRINTING" ? "bg-white/20 text-white" : "bg-white text-ink-900 shadow-2xs"
                }`}>
                  {stageJobs.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="p-3 overflow-y-auto space-y-3 flex-1">
                {stageJobs.map((j) => {
                  const cust = customerMap.get(j.customer_id);
                  const assignedUser = j.assigned_to ? userMap.get(j.assigned_to) : null;
                  const checklist = getChecklistCount(j);
                  const isCurrentUpdating = updatingJobId === j.id;

                  const now = new Date();
                  const dueDate = j.due_date ? new Date(j.due_date) : null;
                  const isOverdue = dueDate && dueDate < now && j.stage !== "DELIVERED";

                  return (
                    <div
                      key={j.id}
                      className={`rounded-2xl border p-3.5 shadow-sm hover:shadow-md transition duration-150 flex flex-col justify-between group ${
                        j.is_late || isOverdue
                          ? "border-rose/50 bg-rose-soft/30"
                          : j.priority === "urgent"
                          ? "border-amber/40 bg-amber-soft/20"
                          : "border-brand-200 bg-brand-50/40 hover:bg-white"
                      } ${isCurrentUpdating ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/jobs/${j.id}`}
                            className="font-extrabold text-xs leading-snug text-ink-900 hover:text-amber-deep transition line-clamp-2"
                          >
                            #{j.id} {j.title}
                          </Link>
                          {j.is_late || isOverdue ? (
                            <span className="text-[9px] bg-rose text-white px-1.5 py-0.5 rounded-full font-black shrink-0 tracking-wider">
                              LATE
                            </span>
                          ) : null}
                        </div>

                        {/* Customer */}
                        <div className="mt-1 flex items-center justify-between text-[11px] text-brand-500">
                          <Link href={`/customers/${j.customer_id}`} className="hover:underline truncate max-w-[130px] font-medium">
                            {cust?.name || "Customer"}
                          </Link>
                          {cust?.company && <span className="text-[10px] text-brand-400 truncate max-w-[80px]">({cust.company})</span>}
                        </div>

                        {/* Specs summary tag if present */}
                        {j.specs_summary && (
                          <div className="mt-1.5 text-[10px] text-brand-700 bg-brand-100/70 p-1.5 rounded-lg line-clamp-2 font-mono">
                            {j.specs_summary}
                          </div>
                        )}

                        {/* Production Pre-flight Checklist indicator */}
                        {selectedLens === "PRODUCTION" && (
                          <div className="mt-2 pt-2 border-t border-brand-200/60 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-brand-500">
                              <span>Pre-flight Checklist</span>
                              <span className="text-ink-900">{checklist.done}/{checklist.total}</span>
                            </div>
                            <div className="w-full bg-brand-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald h-full transition-all duration-300"
                                style={{ width: `${(checklist.done / checklist.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Quote & SLA */}
                        <div className="mt-2.5 pt-2 border-t border-brand-200/50 flex items-center justify-between text-[11px]">
                          <span className="font-black text-ink-900">
                            {j.quote_amount ? `₹${j.quote_amount.toLocaleString("en-IN")}` : "Unquoted"}
                          </span>
                          <span className={`text-[10px] font-bold ${
                            isOverdue ? "text-rose" : "text-brand-500"
                          }`}>
                            {j.due_date ? j.due_date.split("T")[0] : "No date"}
                          </span>
                        </div>

                        {/* Assignee & Priority */}
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            j.priority === "urgent"
                              ? "bg-rose/10 text-rose"
                              : j.priority === "high"
                              ? "bg-amber/20 text-amber-deep"
                              : "bg-brand-200 text-brand-700"
                          }`}>
                            {j.priority}
                          </span>
                          <span className="text-brand-500 font-medium">
                            Owner: {assignedUser ? assignedUser.name.split(" ")[0] : ownerShortLabelForStage(j.stage)}
                          </span>
                        </div>
                      </div>

                      {/* Quick Advance / Move Buttons */}
                      <div className="mt-3 pt-2 border-t border-brand-200/60 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          disabled={stages.indexOf(stage) === 0}
                          onClick={() => moveStage(j.id, "prev")}
                          className="px-2 py-1 rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-700 disabled:opacity-30 disabled:pointer-events-none text-[10px] font-bold transition"
                          title="Move to previous stage"
                        >
                          ←
                        </button>
                        <Link
                          href={`/jobs/${j.id}`}
                          className="text-[10px] font-bold text-amber-deep hover:underline px-1"
                        >
                          View Details
                        </Link>
                        <button
                          type="button"
                          disabled={stages.indexOf(stage) === stages.length - 1}
                          onClick={() => moveStage(j.id, "next")}
                          className="px-2 py-1 rounded-lg bg-brand-900 hover:bg-brand-800 text-white disabled:opacity-30 disabled:pointer-events-none text-[10px] font-bold transition shadow-2xs"
                          title="Advance to next stage"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  );
                })}

                {stageJobs.length === 0 && (
                  <div className="text-xs text-brand-300 font-medium text-center py-10">
                    No jobs in {stageLabels[stage]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
