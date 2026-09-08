"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Customer {
  id: number;
  name: string;
  company?: string;
}

export default function RepeatOrderModal({
  customers,
  initialCustomerId
}: {
  customers: Customer[];
  initialCustomerId?: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(initialCustomerId || (customers[0]?.id || 1));
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadRepeatProposal(custId: number) {
    setSelectedCustomerId(custId);
    setLoading(true);
    setProposal(null);
    try {
      const res = await fetch("/api/ai/repeat-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: custId })
      });
      const data = await res.json();
      if (data.success) {
        setProposal(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setIsOpen(true);
    loadRepeatProposal(selectedCustomerId);
  }

  async function confirmRepeatJob() {
    if (!proposal?.repeatJob) return;
    setIsSubmitting(true);
    try {
      const job = proposal.repeatJob;
      const res = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: job.title,
          description: job.description,
          stage: "QUOTED",
          priority: "high",
          quoteAmount: job.quoteAmount,
          dueDate: job.dueDate,
          customerId: selectedCustomerId,
          leadSource: "Repeat Client",
          specsSummary: job.specsSummary,
          notes: job.notes
        })
      });
      const result = await res.json();
      if (result.success && result.jobId) {
        setIsOpen(false);
        router.push(`/jobs/${result.jobId}`);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-xl bg-white border border-brand-300 text-brand-800 hover:border-amber hover:text-amber-deep px-3.5 py-2 text-xs font-bold shadow-sm transition hover:-translate-y-0.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        <span>1-Click Repeat Order</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-brand-200 space-y-6 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 flex items-center justify-center font-bold text-sm transition"
            >
              ✕
            </button>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-soft text-emerald font-extrabold text-xs mb-2 border border-emerald/20">
                🔄 "Same as Last Time" Smart Assistant
              </div>
              <h2 className="text-2xl font-extrabold text-ink-900">1-Click Repeat Order Generator</h2>
              <p className="text-brand-600 text-sm mt-1">
                When regular clients call saying <em>"send me the same as last month"</em>, match previous order specs, retain paper weights & finishes, and create the quote in seconds.
              </p>
            </div>

            {/* Select Customer */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-700">Select Customer Account:</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => loadRepeatProposal(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-brand-300 bg-brand-50 p-3 text-sm font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-amber/40"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {loading && (
              <div className="p-10 text-center text-sm font-semibold text-brand-500">
                Analyzing past jobs and retrieving historical print specifications…
              </div>
            )}

            {proposal && (
              <div className="space-y-5 pt-2 border-t border-brand-200">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Reference Job */}
                  <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-brand-400 uppercase tracking-wider">Historical Reference</span>
                      <span className="text-[10px] font-extrabold bg-emerald-soft text-emerald px-2 py-0.5 rounded-full">
                        Job #{proposal.referenceJob.id}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-ink-900">{proposal.referenceJob.title}</h4>
                    <p className="text-xs text-brand-600 leading-relaxed">{proposal.referenceJob.description}</p>
                    <div className="pt-2 border-t border-brand-200/60 flex justify-between text-xs text-brand-500">
                      <span>Past Quote: <strong className="text-ink-900 font-bold">₹{proposal.referenceJob.quote_amount ? proposal.referenceJob.quote_amount.toLocaleString("en-IN") : "—"}</strong></span>
                      <span>Stage: {proposal.referenceJob.stage}</span>
                    </div>
                  </div>

                  {/* New Draft Repeat Job */}
                  <div className="rounded-2xl bg-amber-soft/40 border border-amber/30 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-amber-deep uppercase tracking-wider">New Repeat Job Draft</span>
                      <span className="text-[10px] font-extrabold bg-amber text-brand-950 px-2 py-0.5 rounded-full">
                        QUOTED
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-ink-900">{proposal.repeatJob.title}</h4>
                    <p className="text-xs text-brand-700 leading-relaxed">{proposal.repeatJob.description}</p>
                    <div className="pt-2 border-t border-amber/20 flex justify-between text-xs text-brand-700">
                      <span>Target Quote: <strong className="text-brand-950 font-extrabold">₹{proposal.repeatJob.quoteAmount.toLocaleString("en-IN")}</strong></span>
                      <span>Target Due: <strong className="text-brand-950 font-bold">{proposal.repeatJob.dueDate}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-brand-900 text-white text-xs flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-amber">✨ Pre-flight Ready:</span> Artwork files and color profiles are automatically linked from previous run. Production can skip design proofing and begin paper preparation.
                  </div>
                  <button
                    type="button"
                    onClick={confirmRepeatJob}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-amber text-brand-950 font-extrabold text-xs shrink-0 hover:bg-amber/90 transition shadow-md"
                  >
                    {isSubmitting ? "Creating..." : "Confirm & Create Repeat Job →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
