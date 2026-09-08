"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MessyLeadModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const samples = [
    {
      label: "Sample 1: Mixed Hindi/English WhatsApp with Rush Order",
      text: "bhaiya 500 visiting cards chahiye urgently matte finish 300gsm with gold foil for Nexus Media and 100 corporate brochures before Friday budget around 15k please confirm"
    },
    {
      label: "Sample 2: Vague Conference Enquiry (Priya Nair)",
      text: "Hi Abhishek, Priya Nair here (+91 91234 56789). We need brochures printed for our regional tech summit next week. Please send quotation and finish options."
    },
    {
      label: "Sample 3: Repeat Request for BrightTech",
      text: "Hey Abhishek, Neha here from BrightTech Solutions. Please repeat our standard 500 visiting cards and 50 brochures order same as last month. Need them by Wednesday."
    }
  ];

  async function parseLead(textToParse: string) {
    if (!textToParse.trim()) return;
    setIsParsing(true);
    setParsedData(null);
    try {
      const res = await fetch("/api/ai/parse-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToParse })
      });
      const data = await res.json();
      if (data.success) {
        setParsedData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  }

  async function createJobFromParsed() {
    if (!parsedData) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: parsedData.job.title,
          description: parsedData.job.description,
          stage: "ENQUIRY",
          priority: parsedData.job.priority,
          quoteAmount: parsedData.job.quoteAmount,
          dueDate: parsedData.job.dueDate,
          customerName: parsedData.customer.name,
          company: parsedData.customer.company,
          phone: parsedData.customer.phone,
          email: parsedData.customer.email,
          leadSource: "WhatsApp / AI Ingestion",
          specsSummary: parsedData.job.specsSummary,
          notes: `Raw input: ${parsedData.rawText}`
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
      setIsCreating(false);
    }
  }

  function copyReply() {
    if (parsedData?.suggestedReply) {
      navigator.clipboard.writeText(parsedData.suggestedReply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => {
          setIsOpen(true);
          if (!inputText) {
            setInputText(samples[0].text);
            parseLead(samples[0].text);
          }
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-amber-900/10 transition hover:-translate-y-0.5"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>AI WhatsApp Intake</span>
      </button>

      {/* Modal dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl border border-brand-200 space-y-6 relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-700 flex items-center justify-center font-bold text-sm transition"
            >
              ✕
            </button>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-soft text-amber-deep font-extrabold text-xs mb-2 border border-amber/20">
                ⚡ Real-world AI Feature for Sales
              </div>
              <h2 className="text-2xl font-extrabold text-ink-900">Messy Channel & WhatsApp Lead Ingestion</h2>
              <p className="text-brand-600 text-sm mt-1">
                Paste any unstructured WhatsApp message, audio transcript, or messy email. The AI extracts print specs, calculates estimates, flags missing details, and creates a pipeline card in 1 click.
              </p>
            </div>

            {/* Presets */}
            <div>
              <div className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-2">Try Demo Samples:</div>
              <div className="grid sm:grid-cols-3 gap-2">
                {samples.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(s.text);
                      parseLead(s.text);
                    }}
                    className="text-left p-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-xs font-semibold text-brand-800 transition"
                  >
                    <span className="text-amber-deep font-bold block mb-1">Preset #{idx + 1}</span>
                    <span className="line-clamp-2 text-brand-600 text-[11px]">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input textarea */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brand-700">Paste Unstructured Text / Client Chat:</label>
              <div className="flex gap-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={3}
                  placeholder="e.g. bhaiya 500 visiting cards chahiye urgently matte finish 300gsm with gold foil..."
                  className="flex-1 rounded-xl border border-brand-300 bg-brand-50/50 p-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => parseLead(inputText)}
                  disabled={isParsing || !inputText.trim()}
                  className="px-5 rounded-xl bg-brand-900 text-white text-xs font-bold shadow-md hover:bg-brand-800 transition shrink-0 flex items-center gap-2"
                >
                  {isParsing ? "Extracting…" : "Extract Specs ✨"}
                </button>
              </div>
            </div>

            {/* Parsed Output */}
            {parsedData && (
              <div className="space-y-4 pt-4 border-t border-brand-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-ink-900 uppercase tracking-wider">AI Extracted Structure</h3>
                  <span className="text-xs font-bold text-emerald bg-emerald-soft px-2.5 py-1 rounded-full border border-emerald/20">
                    Ready to Ingest into SQLite
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Customer & Job specs */}
                  <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-brand-500 uppercase tracking-wider">Customer Contact</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${parsedData.customer.isNew ? "bg-amber text-brand-950" : "bg-brand-200 text-brand-800"}`}>
                        {parsedData.customer.isNew ? "New Client" : "Existing Account"}
                      </span>
                    </div>

                    <div className="text-sm">
                      <strong className="text-ink-900 font-bold block">{parsedData.customer.name}</strong>
                      <span className="text-brand-600 text-xs block">{parsedData.customer.company || "Independent"}</span>
                      <span className="text-brand-500 text-xs block mt-1">{parsedData.customer.phone} • {parsedData.customer.email}</span>
                    </div>

                    <div className="pt-2 border-t border-brand-200 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-brand-500">Suggested Title:</span>
                        <span className="font-bold text-ink-900 truncate max-w-[200px]">{parsedData.job.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-brand-500">Priority & Timeline:</span>
                        <span className="font-bold text-rose">{parsedData.job.priority.toUpperCase()} (Target: {parsedData.job.dueDate})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-brand-500">Estimated Total Quote:</span>
                        <span className="font-extrabold text-brand-900 text-sm">₹{parsedData.job.quoteAmount.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="rounded-2xl bg-brand-50 border border-brand-200 p-4 space-y-3">
                    <span className="text-xs font-extrabold text-brand-500 uppercase tracking-wider">Detected Print Line Items</span>
                    <div className="space-y-2">
                      {parsedData.items.map((item: any, i: number) => (
                        <div key={i} className="rounded-xl bg-white p-2.5 border border-brand-200/80 text-xs shadow-sm flex items-center justify-between">
                          <div>
                            <span className="font-bold text-ink-900">{item.quantity}x {item.type}</span>
                            <span className="block text-[11px] text-brand-500 mt-0.5">{item.paper || item.size || ""} • {item.finish || item.fold || "Standard"}</span>
                          </div>
                          <span className="font-extrabold text-brand-900 shrink-0">₹{item.estimatedPrice.toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Missing Specs Warnings */}
                {parsedData.missingInfo.length > 0 && (
                  <div className="rounded-2xl bg-amber-soft/60 border border-amber/30 p-4">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-amber-deep mb-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      Missing Information to Clarify with Client:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-xs text-brand-700 pl-1">
                      {parsedData.missingInfo.map((info: string, i: number) => (
                        <li key={i}>{info}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested WhatsApp response */}
                <div className="rounded-2xl bg-brand-900 text-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-300">Suggested WhatsApp Reply (1-Click Copy):</span>
                    <button
                      type="button"
                      onClick={copyReply}
                      className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg transition border border-white/10 flex items-center gap-1.5"
                    >
                      {copied ? "✓ Copied!" : "📋 Copy Reply"}
                    </button>
                  </div>
                  <pre className="text-xs text-brand-100 whitespace-pre-wrap font-sans bg-black/20 p-3 rounded-xl border border-white/5 leading-relaxed">
                    {parsedData.suggestedReply}
                  </pre>
                </div>

                {/* Bottom Action */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-brand-300 text-brand-700 text-xs font-bold hover:bg-brand-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={createJobFromParsed}
                    disabled={isCreating}
                    className="px-6 py-2.5 rounded-xl bg-brand-900 hover:bg-brand-800 text-white text-xs font-extrabold shadow-lg shadow-brand-900/20 transition flex items-center gap-2"
                  >
                    {isCreating ? "Ingesting..." : "Create Enquiry in Pipeline →"}
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
