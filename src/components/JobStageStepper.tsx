"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JobStageStepper({
  jobId,
  currentStage
}: {
  jobId: number;
  currentStage: string;
}) {
  const router = useRouter();
  const [loadingStage, setLoadingStage] = useState<string | null>(null);

  const stages = ["ENQUIRY", "QUOTED", "DESIGN", "PRINTING", "READY", "DELIVERED"];
  const currentIdx = stages.indexOf(currentStage);

  async function updateStage(targetStage: string) {
    if (targetStage === currentStage) return;
    setLoadingStage(targetStage);
    try {
      await fetch("/api/jobs/update-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, stage: targetStage })
      });
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStage(null);
    }
  }

  return (
    <div className="bg-white rounded-3xl p-5 border border-brand-200/80 shadow-sm space-y-3">
      <div className="flex items-center justify-between text-xs font-bold text-brand-500 uppercase tracking-wider">
        <span>Lifecycle Progression:</span>
        <span className="text-ink-900 font-extrabold">Current: {currentStage}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {stages.map((stage, idx) => {
          const isPassed = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <button
              key={stage}
              type="button"
              disabled={loadingStage !== null}
              onClick={() => updateStage(stage)}
              className={`p-3 rounded-2xl text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 border ${
                isCurrent
                  ? "bg-brand-950 text-amber border-brand-950 shadow-md ring-2 ring-amber/30"
                  : isPassed
                  ? "bg-emerald-soft text-emerald border-emerald/20 hover:bg-emerald-soft/80"
                  : "bg-brand-50 text-brand-500 border-brand-200 hover:bg-brand-100 hover:text-ink-900"
              }`}
            >
              <span className="text-[10px] opacity-75">Step {idx + 1}</span>
              <span>{stage}</span>
              {isPassed && <span className="text-[10px]">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
