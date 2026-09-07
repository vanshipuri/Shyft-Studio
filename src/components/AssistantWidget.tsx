"use client";

import { useState } from "react";

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{from:"user"|"ai"; text:string}[]>([
    {from:"ai", text:"Hi, I'm Shyft Assistant. Ask me anything — 'What did Neha order?', 'Which jobs are late?', 'Status of job 7', or 'Give me a pipeline summary'."},
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const q = input.trim();
    setMessages(m => [...m, {from:"user", text:q}]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({q}) });
      const data = await res.json();
      setMessages(m => [...m, {from:"ai", text:data.answer || "I couldn't find that. Try asking about a customer, a stage, or a job number."}]);
    } catch {
      setMessages(m => [...m, {from:"ai", text:"Sorry — I couldn't reach the assistant right now. Try again in a moment."}]);
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[360px] max-h-[520px] bg-white rounded-3xl shadow-2xl border border-brand-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-r from-brand-900 to-brand-800 px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-base leading-tight">Shyft Assistant</h3>
              <p className="text-brand-300 text-xs">Natural language for the pipeline</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Close">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[260px] bg-brand-50/60">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${m.from === "user" ? "bg-brand-900 text-white rounded-br-md" : "bg-white text-ink-800 border border-brand-200 rounded-bl-md"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-white border border-brand-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-brand-500 shadow-sm">Thinking…</div></div>}
          </div>
          <div className="p-3 bg-white border-t border-brand-200 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask anything…" className="flex-1 rounded-xl border border-brand-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/40 bg-brand-50/50" />
            <button onClick={send} className="rounded-xl bg-brand-900 text-white px-3 py-2 text-sm font-semibold hover:bg-brand-800 transition">Ask</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-900 to-brand-800 text-white shadow-2xl shadow-brand-900/30 flex items-center justify-center hover:scale-105 transition" aria-label="Assistant">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9 10h.01"/><path d="M13 10h.01"/><path d="M17 10h.01"/></svg>
      </button>
    </div>
  );
}
