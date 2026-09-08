"use client";

import { useState } from "react";

export default function AssistantWidget({ role = "OWNER" }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: "user" | "ai"; text: string }[]>([
    {
      from: "ai",
      text: "👋 Hi, I'm **Shyft Copilot**. Ask me anything about pipeline revenue, print floor bottlenecks, customer order histories, or ask me to draft client messages!"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const promptsByRole: Record<string, string[]> = {
    OWNER: [
      "Give me today's briefing",
      "What is our active pipeline value?",
      "Which repeat clients are due for a check-in?",
      "Show production bottlenecks & machine load",
      "Draft an apology message for Singh & Sons delay"
    ],
    SALES: [
      "Show unquoted leads needing follow-up",
      "Which repeat clients are due for a check-in?",
      "Who hasn't ordered in 60 days?",
      "What did BrightTech order previously?",
      "Draft follow-up for Priya Nair enquiry"
    ],
    PRODUCTION: [
      "Show jobs currently on the print floor",
      "Which jobs have paper stock or lamination flags?",
      "What is our active pipeline value?",
      "Show production bottlenecks & machine load",
      "Give me today's briefing"
    ]
  };

  const currentPrompts = promptsByRole[role] || promptsByRole.OWNER;

  async function send(queryText?: string) {
    const q = (queryText || input).trim();
    if (!q) return;

    setMessages((m) => [...m, { from: "user", text: q }]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, role })
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          from: "ai",
          text: data.answer || "I couldn't find that. Try asking about pipeline stats, customer history, or late jobs."
        }
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          from: "ai",
          text: "Sorry — I couldn't reach the assistant server right now. Try again in a moment."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderFormattedText(text: string) {
    // Simple markdown-like rendering for bold, quotes, and bullet points
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h4 key={idx} className="font-extrabold text-sm text-ink-900 mt-2 mb-1">{line.replace("### ", "")}</h4>;
      }
      if (line.startsWith("> ")) {
        return (
          <blockquote key={idx} className="border-l-2 border-amber pl-2 my-1 text-xs italic text-brand-800 bg-amber-soft/40 py-1 rounded-r">
            {line.replace("> ", "")}
          </blockquote>
        );
      }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        const clean = line.replace(/^[-•]\s*/, "");
        return (
          <li key={idx} className="text-xs text-brand-800 ml-3 list-disc">
            <span dangerouslySetInnerHTML={{ __html: formatInline(clean) }} />
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs text-brand-800 leading-relaxed">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        </p>
      );
    });
  }

  function formatInline(str: string) {
    return str
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code class='bg-brand-200 px-1 py-0.5 rounded text-[11px] font-mono'>$1</code>");
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[380px] sm:w-[420px] max-h-[580px] bg-white rounded-3xl shadow-2xl border border-brand-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber text-brand-950 flex items-center justify-center font-black text-xs shadow-md">
                AI
              </div>
              <div>
                <h3 className="text-white font-extrabold text-sm leading-tight flex items-center gap-2">
                  Shyft Copilot
                  <span className="text-[10px] font-bold bg-white/20 text-brand-200 px-1.5 py-0.2 rounded-full">
                    {role} Mode
                  </span>
                </h3>
                <p className="text-brand-400 text-[11px]">Natural language pipeline & operations</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Prompt chips */}
          <div className="px-4 py-2 bg-brand-100/70 border-b border-brand-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-brand-500 shrink-0 uppercase tracking-wider">Try:</span>
            {currentPrompts.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => send(p)}
                className="shrink-0 text-[11px] font-medium bg-white hover:bg-amber-soft hover:border-amber hover:text-amber-deep text-brand-700 px-2.5 py-1 rounded-full border border-brand-300 shadow-2xs transition"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[300px] max-h-[380px] bg-surface">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                    m.from === "user"
                      ? "bg-brand-900 text-white rounded-br-xs"
                      : "bg-white text-ink-900 border border-brand-200/80 rounded-bl-xs space-y-1"
                  }`}
                >
                  {m.from === "user" ? m.text : renderFormattedText(m.text)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-brand-200 rounded-2xl rounded-bl-xs px-4 py-2.5 text-xs text-brand-500 shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber animate-ping" />
                  <span>Copilot analyzing database & operational metrics…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="p-3 bg-white border-t border-brand-200 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything (e.g. 'pipeline value', 'draft follow-up')..."
              className="flex-1 rounded-xl border border-brand-300 px-3.5 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-amber/40 bg-brand-50/50"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-brand-900 text-white px-4 py-2 text-xs font-bold hover:bg-brand-800 transition disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </div>
      )}

      {/* Trigger floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="group relative flex items-center gap-2 rounded-full bg-gradient-to-tr from-brand-950 via-brand-900 to-brand-800 text-white px-4 py-3 shadow-2xl shadow-brand-950/40 hover:scale-105 transition duration-200 border border-brand-700/60"
        aria-label="Open Shyft Assistant"
      >
        <span className="w-3 h-3 rounded-full bg-amber animate-pulse" />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M9 10h.01" />
          <path d="M13 10h.01" />
          <path d="M17 10h.01" />
        </svg>
        <span className="text-xs font-bold tracking-wide">AI Copilot</span>
      </button>
    </div>
  );
}
