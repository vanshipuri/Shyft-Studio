"use client";

import { useState } from "react";

export default function JobAiActions({
  job,
  customer
}: {
  job: any;
  customer: any;
}) {
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generateClientWhatsApp() {
    let msg = `Hi ${customer?.name?.split(" ")[0] || "there"}! Abhishek from Shyft Studio updating you on your order: *${job.title}*.\n\n`;
    if (job.stage === "ENQUIRY") {
      msg += `We are preparing your custom quote. Could you please confirm your preferred paper stock (e.g. 300gsm matte or glossy) and target delivery date?`;
    } else if (job.stage === "QUOTED") {
      msg += `Your quotation of *₹${job.quote_amount ? job.quote_amount.toLocaleString("en-IN") : "—"}* is ready. Once approved, we will begin proof preparation immediately.`;
    } else if (job.stage === "DESIGN") {
      msg += `Our design team has prepared your digital print proof. Please review and send your sign-off so we can send it to the offset press!`;
    } else if (job.stage === "PRINTING") {
      msg += `Your job is currently running on the print press. Finishing & quality inspection will follow. Target dispatch: *${job.due_date ? job.due_date.split("T")[0] : "on schedule"}*.`;
    } else if (job.stage === "READY") {
      msg += `Great news! Your print order is packed and ready for pickup / delivery. Please let us know if you'd like us to dispatch via courier.`;
    } else {
      msg += `Your order has been delivered! Thank you for choosing Shyft Studio. Let us know when you need your next print run!`;
    }
    setOutput(msg);
  }

  function generatePrintWorkOrder() {
    const text = `=== SHYFT STUDIO PRINT FLOOR WORK ORDER ===\n` +
      `Job #${job.id}: ${job.title}\n` +
      `Customer: ${customer?.name} (${customer?.company || "Independent"})\n` +
      `Due Date: ${job.due_date ? job.due_date.split("T")[0] : "Urgent / ASAP"}\n` +
      `Priority: ${job.priority?.toUpperCase()}\n` +
      `Specs: ${job.specs_summary || job.description}\n` +
      `Special Floor Notes: ${job.notes || "Standard offset/digital run"}\n` +
      `QC Check: Inspection required before packaging.\n` +
      `===========================================`;
    setOutput(text);
  }

  function copyText() {
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="rounded-3xl bg-brand-950 text-white p-6 space-y-4 shadow-xl border border-brand-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber animate-pulse" />
          <h3 className="font-extrabold text-sm text-white">AI Quick Assistant</h3>
        </div>
        <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full text-brand-300">
          Domain Automation
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generateClientWhatsApp}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition flex items-center gap-1.5"
        >
          📱 Draft Client WhatsApp Update
        </button>
        <button
          type="button"
          onClick={generatePrintWorkOrder}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition flex items-center gap-1.5"
        >
          🖨️ Generate Floor Work Order
        </button>
      </div>

      {output && (
        <div className="pt-2 border-t border-brand-800/80 space-y-2 anim-fade">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-brand-400">Generated Output:</span>
            <button
              type="button"
              onClick={copyText}
              className="text-xs font-bold text-amber hover:underline flex items-center gap-1"
            >
              {copied ? "✓ Copied to clipboard!" : "📋 Copy"}
            </button>
          </div>
          <pre className="text-xs text-brand-100 bg-black/40 p-3 rounded-2xl border border-white/10 whitespace-pre-wrap font-sans leading-relaxed">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
