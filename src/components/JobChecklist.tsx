"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export default function JobChecklist({
  jobId,
  initialChecklist
}: {
  jobId: number;
  initialChecklist: ChecklistItem[];
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);
  const [saving, setSaving] = useState(false);

  async function toggleItem(index: number) {
    const updated = checklist.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    );
    setChecklist(updated);
    setSaving(true);

    try {
      await fetch("/api/jobs/update-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          checklist: updated,
          itemLabel: checklist[index].label,
          checked: !checklist[index].done
        })
      });
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const completedCount = checklist.filter((i) => i.done).length;
  const progressPercent = Math.round((completedCount / (checklist.length || 1)) * 100);

  return (
    <div className="rounded-3xl bg-white border border-brand-200/80 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-ink-900">Pre-Flight & Floor Checklist</h3>
          <p className="text-xs text-brand-500">Track raw materials, digital proof sign-off, and finishing</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-brand-900">{completedCount}/{checklist.length} Complete</span>
          <div className="w-24 bg-brand-100 h-2 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100 ? "bg-emerald" : "bg-amber"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-brand-200/60">
        {checklist.map((item, idx) => (
          <label
            key={item.id || idx}
            className={`flex items-center gap-3 p-3 rounded-2xl border transition cursor-pointer select-none ${
              item.done
                ? "bg-emerald-soft/40 border-emerald/20 text-emerald"
                : "bg-brand-50/60 border-brand-200 hover:bg-brand-50 text-ink-900"
            }`}
          >
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleItem(idx)}
              className="w-4 h-4 rounded text-emerald focus:ring-emerald/40"
            />
            <span className={`text-xs font-bold flex-1 ${item.done ? "line-through opacity-70" : ""}`}>
              {item.label}
            </span>
            {item.done && (
              <span className="text-[10px] font-extrabold text-emerald bg-white px-2 py-0.5 rounded-full shadow-2xs">
                DONE
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
