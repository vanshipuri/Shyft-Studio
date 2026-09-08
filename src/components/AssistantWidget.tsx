"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X, RotateCcw } from "lucide-react";

interface Message {
  id: number;
  from: "user" | "ai";
  text: string;
  time: string;
}

const WELCOME: Record<string, string> = {
  OWNER:
    "👋 Hi, I'm **Shyft Copilot**. Ask me for today's briefing, pipeline value, at-risk jobs, repeat clients due for a check-in — or ask me to **draft client messages**.",
  SALES:
    "👋 Hi, I'm **Shyft Copilot**. Ask me about unquoted enquiries, repeat orders, customer history — or ask me to **draft a WhatsApp follow-up**.",
  PRODUCTION:
    "👋 Hi, I'm **Shyft Copilot**. Ask me what's on the print floor, which jobs are at risk, or what needs finishing — I read the live pipeline."
};

const PROMPTS_BY_ROLE: Record<string, string[]> = {
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

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  SALES: "Sales",
  PRODUCTION: "Production"
};

function nowLabel() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(raw: string) {
  const str = escapeHtml(raw);
  return str
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`\n]+)`/g, "<code class='bg-brand-200/70 px-1 py-px rounded text-[11px] font-mono text-brand-900'>$1</code>");
}

function MessageBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      blocks.push(
        <p key={key++} className="font-extrabold text-[13px] text-ink-900 mt-2 first:mt-0">
          {heading[1]}
        </p>
      );
      i++;
      continue;
    }

    // Bullet list — group consecutive bullets into one <ul>
    if (/^[-•*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].replace(/^[-•*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="mt-1.5 first:mt-0 space-y-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber mt-1.5 shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: formatInline(it) }} className="min-w-0 flex-1" />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list — group consecutive numbers
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      const items: { n: string; t: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (!m) break;
        items.push({ n: m[1], t: m[2] });
        i++;
      }
      blocks.push(
        <ol key={key++} className="mt-1.5 first:mt-0 space-y-1 list-none">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="min-w-[20px] h-5 px-1 rounded-md bg-brand-100 text-brand-700 text-[10px] font-black flex items-center justify-center mt-px">
                {it.n}
              </span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(it.t) }} className="min-w-0 flex-1" />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line.trim())) {
      const quotes: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quotes.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="mt-1.5 first:mt-0 border-l-2 border-amber pl-3 pr-2 py-1 my-1 text-[12px] italic text-amber-deep bg-amber-soft/50 rounded-r-xl"
        >
          {quotes.map((q, idx) => (
            <p key={idx} className={idx > 0 ? "mt-1" : ""} dangerouslySetInnerHTML={{ __html: formatInline(q) }} />
          ))}
        </blockquote>
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="border-brand-200 my-2" />);
      i++;
      continue;
    }

    // Blank line → spacing
    if (line.trim() === "") {
      blocks.push(<div key={key++} className="h-2" />);
      i++;
      continue;
    }

    // Plain paragraph
    blocks.push(
      <p key={key++} className="leading-relaxed">
        <span dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{blocks}</div>;
}

function AiAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`shrink-0 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-brand-950 flex items-center justify-center shadow-md shadow-amber-600/30 ${
        size === "sm" ? "w-6 h-6 rounded-lg" : "w-7 h-7"
      }`}
    >
      <Sparkles size={size === "sm" ? 12 : 14} strokeWidth={2.6} />
    </span>
  );
}

export default function AssistantWidget({ role = "OWNER" }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const idRef = useRef(1);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: idRef.current++,
      from: "ai",
      text: WELCOME[role] || WELCOME.OWNER,
      time: nowLabel()
    }
  ]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const prompts = PROMPTS_BY_ROLE[role] || PROMPTS_BY_ROLE.OWNER;
  const showPrompts = messages.length <= 1 && !loading;

  // Keep the newest message in view, smoothly
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, loading]);

  const closePanel = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 190);
  }, []);

  // Escape closes the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  // Focus the composer shortly after opening
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 260);
    return () => window.clearTimeout(t);
  }, [open]);

  const pushMessage = useCallback((from: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: idRef.current++, from, text, time: nowLabel() }]);
  }, []);

  async function ask(raw?: string) {
    const q = (raw ?? input).trim();
    if (!q || loading) return;

    pushMessage("user", q);
    setFailedQuery(null);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, role })
      });
      const data = await res.json();
      pushMessage(
        "ai",
        data?.answer ||
          "I couldn't find an answer for that yet. Try asking about pipeline stats, late jobs, customer history, or draft messages."
      );
    } catch {
      setFailedQuery(q);
      pushMessage(
        "ai",
        "Sorry — I couldn't reach the assistant service just now. Your connection looks fine on my side, so please retry in a moment."
      );
    } finally {
      setLoading(false);
    }
  }

  // Auto-grow composer
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    setInput(el.value);
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  }

  const buttonDisabled = loading || !input.trim();

  return (
    <>
      {/* Mobile tap-away backdrop */}
      {open && !leaving && (
        <div
          className="fixed inset-0 z-40 bg-brand-950/25 backdrop-blur-[2px] md:hidden anim-fade"
          onClick={closePanel}
          aria-hidden="true"
        />
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Shyft Copilot chat"
          className={`fixed z-50 inset-x-0 bottom-0 md:inset-x-auto md:right-5 md:bottom-5 md:w-[400px] xl:w-[430px] h-[82dvh] md:h-[min(660px,calc(100dvh-2.5rem))] flex flex-col overflow-hidden bg-white border border-brand-200/80 md:rounded-[26px] rounded-t-[22px] shadow-[0_30px_80px_-20px_rgba(2,6,23,0.5)] ${
            leaving ? "anim-out" : "anim-rise md:anim-enter"
          }`}
        >
          {/* ---------- Header ---------- */}
          <div className="relative shrink-0 bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 px-4 pt-4 pb-3.5 overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber/15 blur-2xl pointer-events-none" />
            <div className="absolute -left-6 -bottom-10 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-brand-950 flex items-center justify-center shadow-lg shadow-amber-950/30">
                <Bot size={19} strokeWidth={2.3} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-extrabold text-sm leading-none tracking-tight">
                    Shyft Copilot
                  </h3>
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-amber border border-white/10">
                    {ROLE_LABEL[role] || role} lens
                  </span>
                </div>
                <p className="text-[11px] text-brand-400 font-medium mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald status-dot" />
                  Live · answers from your real pipeline data
                </p>
              </div>
              <button
                onClick={closePanel}
                aria-label="Close chat"
                className="w-8 h-8 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-brand-200 hover:text-white flex items-center justify-center transition active:scale-90"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* ---------- Suggested prompts ---------- */}
          {showPrompts && (
            <div className="shrink-0 px-3 py-2.5 bg-brand-100/60 border-b border-brand-200/70">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                <span className="text-[10px] font-black text-brand-400 uppercase tracking-wider shrink-0">
                  Try
                </span>
                {prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => ask(p)}
                    className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white text-brand-700 border border-brand-200 px-2.5 py-1.5 rounded-full hover:border-amber/60 hover:text-amber-deep hover:bg-amber-soft/50 active:scale-[0.97] transition shadow-sm"
                  >
                    <Sparkles size={11} className="text-amber" />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---------- Messages ---------- */}
          <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-slim px-4 py-4 space-y-3.5 bg-gradient-to-b from-brand-50/60 to-surface">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-end gap-2 anim-bubble-in ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.from === "ai" && <AiAvatar />}
                <div className={`flex flex-col ${m.from === "user" ? "items-end" : "items-start"} max-w-[86%]`}>
                  <div
                    className={
                      m.from === "user"
                        ? "text-[13px] text-white bg-gradient-to-br from-brand-900 to-brand-800 rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-md shadow-brand-900/15 whitespace-pre-wrap break-words"
                        : "text-[13px] text-brand-800 bg-white border border-brand-200/80 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm break-words"
                    }
                  >
                    {m.from === "user" ? m.text : <MessageBody text={m.text} />}
                  </div>
                  <span className="text-[9px] text-brand-400 font-medium mt-1 px-1">{m.time}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2 anim-bubble-in">
                <AiAvatar />
                <div className="rounded-2xl rounded-bl-md bg-white border border-brand-200/80 px-4 py-3 shadow-sm flex items-center gap-2">
                  <span className="flex items-center gap-1 text-brand-400">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                  <span className="text-[11px] font-semibold text-brand-400">
                    Pulling live pipeline data…
                  </span>
                </div>
              </div>
            )}

            {failedQuery && !loading && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={() => ask(failedQuery)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-600 bg-white border border-brand-200 px-3 py-1.5 rounded-full hover:border-amber hover:text-amber-deep transition"
                >
                  <RotateCcw size={11} />
                  Retry last question
                </button>
              </div>
            )}
          </div>

          {/* ---------- Composer ---------- */}
          <div className="shrink-0 bg-white border-t border-brand-200/80 px-3 pt-2.5 pb-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask anything about your pipeline…"
                aria-label="Ask Shyft Copilot"
                className="flex-1 resize-none rounded-2xl bg-brand-50/70 border border-brand-200/90 px-3.5 py-2.5 text-[13px] leading-snug text-ink-900 placeholder:text-brand-400 focus:outline-none focus:ring-2 focus:ring-amber/40 focus:border-amber/60 transition min-h-[42px] max-h-[130px] scrollbar-slim"
              />
              <button
                onClick={() => ask()}
                disabled={buttonDisabled}
                aria-label="Send message"
                className={`w-[46px] h-[46px] shrink-0 rounded-2xl flex items-center justify-center transition active:scale-90 ${
                  buttonDisabled
                    ? "bg-brand-200 text-brand-400 cursor-not-allowed"
                    : "bg-gradient-to-tr from-brand-950 to-brand-800 text-white shadow-lg shadow-brand-900/25 hover:shadow-xl hover:-translate-y-px"
                }`}
              >
                <Send size={17} strokeWidth={2.4} className={loading ? "opacity-60 animate-pulse" : ""} />
              </button>
            </div>
            <p className="hidden sm:block text-[10px] text-brand-400 font-medium mt-1.5 px-1">
              Enter to send · Shift + Enter for a new line · Esc to close
            </p>
          </div>
        </div>
      )}

      {/* ---------- Floating action button ---------- */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Shyft Copilot"
          className={`group fixed z-50 bottom-5 right-5 md:bottom-6 md:right-6 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-tr from-brand-950 via-brand-900 to-brand-800 text-white pl-3 pr-4 md:pr-5 h-14 shadow-2xl shadow-brand-950/40 border border-brand-700/50 transition duration-200 hover:-translate-y-0.5 hover:shadow-brand-950/60 active:scale-95 anim-fade-up`}
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-brand-950">
            <Sparkles size={15} strokeWidth={2.6} />
          </span>
          <span className="flex flex-col items-start leading-none">
            <span className="text-[13px] font-extrabold tracking-wide">AI Copilot</span>
            <span className="text-[9px] text-brand-400 font-semibold mt-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald" />
              Ask about pipeline
            </span>
          </span>
        </button>
      )}
    </>
  );
}
