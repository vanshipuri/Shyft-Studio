"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: number;
  name: string;
  email: string;
  role: "OWNER" | "SALES" | "PRODUCTION";
}

export default function RoleSwitcher({ currentUser }: { currentUser: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const personas = [
    {
      role: "OWNER",
      name: "Samyak Mehta",
      email: "samyak@shyft.studio",
      title: "Owner / Executive",
      badge: "👑 Executive Lens",
      description: "Needs high-level revenue visibility, pipeline health, team workload, and customer LTV without needing to call Abhishek.",
      focus: ["Total Pipeline & At-Risk Revenue", "Operational Bottleneck Radar", "Team Workload Split", "Customer Lifetime Value"],
      theme: "from-amber-500 to-amber-700"
    },
    {
      role: "SALES",
      name: "Abhishek Rao",
      email: "abhishek@shyft.studio",
      title: "Sales Lead",
      badge: "💼 Sales Lens",
      description: "Handles messy WhatsApp inquiries, generates quotes instantly, follows up on stale leads, and executes 1-click repeat orders.",
      focus: ["Messy WhatsApp Lead Ingestion", "1-Click 'Same as Last Time' Re-orders", "Quoting Speed & Follow-up Alarms", "Unquoted Enquiry Aging"],
      theme: "from-blue-600 to-indigo-700"
    },
    {
      role: "PRODUCTION",
      name: "Siddhant Yadav",
      email: "siddhant@shyft.studio",
      title: "Production Lead",
      badge: "⚙️ Print Floor Lens",
      description: "Oversees print queues, pre-flight checklists (paper stock, proofing, lamination), machine schedules, and SLA late risk alarms.",
      focus: ["Machine Print Queue Priority", "Pre-flight Production Checklists", "Paper Stock & Finishing Dependencies", "SLA & Late Risk Alarms"],
      theme: "from-emerald-600 to-teal-800"
    }
  ];

  async function switchRole(email: string) {
    if (email === currentUser.email) return;
    setSwitching(true);
    try {
      await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectUrl: pathname })
      });
      router.refresh();
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setSwitching(false);
    }
  }

  const activePersona = personas.find(p => p.role === currentUser.role) || personas[0];

  return (
    <>
      <div className="bg-brand-950 text-white border-b border-brand-800/80 px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Active persona indicator */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber/20 text-amber font-extrabold text-[11px] border border-amber/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
              Interactive Persona Simulator
            </span>
            <span className="text-brand-300 hidden sm:inline">Viewing as:</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald" />
              {currentUser.name} <span className="text-brand-400 font-normal">({currentUser.role})</span>
            </span>
          </div>

          {/* Quick switcher buttons */}
          <div className="flex items-center gap-2">
            <span className="text-brand-400 text-[11px] hidden md:inline">Switch Role:</span>
            <div className="flex items-center bg-brand-900 rounded-lg p-0.5 border border-brand-800">
              {personas.map((p) => {
                const isActive = currentUser.role === p.role;
                return (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => switchRole(p.email)}
                    disabled={switching}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                      isActive
                        ? "bg-amber text-brand-950 shadow-sm font-extrabold"
                        : "text-brand-300 hover:text-white hover:bg-brand-800"
                    }`}
                    title={`Switch to ${p.name} (${p.title})`}
                  >
                    <span>{p.role === "OWNER" ? "👑 Owner" : p.role === "SALES" ? "💼 Sales" : "⚙️ Production"}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowGuide(true)}
              className="px-2.5 py-1 rounded-lg bg-brand-800 hover:bg-brand-700 text-brand-200 hover:text-white font-semibold text-[11px] transition flex items-center gap-1 border border-brand-700"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Persona Tour
            </button>
          </div>
        </div>
      </div>

      {/* Persona Tour & Architecture Rationale Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-brand-200 space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 flex items-center justify-center font-bold text-sm transition"
            >
              ✕
            </button>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-soft text-amber-deep font-extrabold text-xs mb-2">
                🌟 Recruitment Architecture Walkthrough
              </div>
              <h2 className="text-2xl font-extrabold text-ink-900">Why Shyft Studio Features Role-Specific Workflows</h2>
              <p className="text-brand-600 text-sm mt-1">
                In a 3-person commercial printing business, generic Kanban boards fail because Sales, Ops, and Ownership have completely different daily cognitive needs. Here is how our architecture addresses each persona:
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {personas.map((p) => (
                <div
                  key={p.role}
                  className={`rounded-2xl p-4 border flex flex-col justify-between ${
                    p.role === currentUser.role
                      ? "border-amber bg-amber-soft/30 shadow-md ring-2 ring-amber/20"
                      : "border-brand-200 bg-brand-50/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-ink-900">{p.badge}</span>
                      {p.role === currentUser.role && (
                        <span className="text-[10px] font-extrabold bg-amber text-brand-950 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-sm text-ink-900">{p.name}</h3>
                    <p className="text-[11px] text-brand-500 font-medium mb-3">{p.title}</p>
                    <p className="text-xs text-brand-700 leading-relaxed mb-3">{p.description}</p>
                    
                    <div className="space-y-1 pt-2 border-t border-brand-200/60">
                      <p className="text-[10px] font-extrabold text-brand-500 uppercase tracking-wider">Tailored Features:</p>
                      {p.focus.map((f, i) => (
                        <div key={i} className="text-[11px] text-brand-800 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-amber-deep shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      switchRole(p.email);
                      setShowGuide(false);
                    }}
                    className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                      p.role === currentUser.role
                        ? "bg-brand-900 text-white"
                        : "bg-white border border-brand-300 text-brand-800 hover:bg-brand-100"
                    }`}
                  >
                    {p.role === currentUser.role ? "Currently Active" : `Switch to ${p.name.split(" ")[0]}`}
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-brand-900 text-white flex items-center justify-between gap-4">
              <div className="text-xs">
                <span className="font-extrabold text-amber">💡 Key Innovation:</span> Use the <strong className="text-white">Messy Lead AI Intake</strong> tool (in header) to paste rough WhatsApp text and see automatic quote calculation, item extraction, and customer creation!
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-xl bg-amber text-brand-950 font-bold text-xs shrink-0 hover:bg-amber/90 transition shadow-md"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
