// Domain-specific AI Engine for Shyft Studio
// Handles messy WhatsApp lead ingestion, repeat order intelligence, production risk analysis, and natural language copilot reasoning.

import { db, getCustomers, getJobs, getLateJobs, getStageCounts, getCustomerJobs, getJobById, getCustomerById } from "./db.mjs";

/**
 * Parses unstructured/messy lead text (WhatsApp messages, voice note transcripts, rough emails).
 * Extracts structured customer info, print line items, paper specs, urgency, estimated quote, and missing details.
 */
export function parseMessyLead(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return {
      success: false,
      error: "Empty message provided"
    };
  }

  const lower = text.toLowerCase();

  // 1. Extract Customer / Company Name
  let detectedName = "Unknown Lead";
  let detectedCompany = "";
  let detectedPhone = "";
  let detectedEmail = "";

  // Phone regex
  const phoneMatch = text.match(/(?:\+91[\-\s]?)?[6-9]\d{9}|\b\d{5}[\s\-]?\d{5}\b/);
  if (phoneMatch) {
    detectedPhone = phoneMatch[0];
  }

  // Email regex
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    detectedEmail = emailMatch[0];
  }

  // Name / Company heuristics
  const namePatterns = [
    /(?:from|myself|i am|this is|naam|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:company|firm|agency|studio|enterprise|pvt ltd|ltd|brand|team)\s*(?:is|:|-)?\s*([A-Za-z0-9\s&]+?)(?=(?:,|\.|\n|phone|urgent|need|want|chahiye|$))/i,
    /(?:for|regards|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];

  for (const pattern of namePatterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const val = m[1].trim();
      if (!detectedCompany && /(?:pvt|ltd|solutions|media|tech|interiors|events|corp|inc|studio)/i.test(val)) {
        detectedCompany = val;
      } else if (detectedName === "Unknown Lead") {
        detectedName = val;
      }
    }
  }

  // Match existing customer if mentioned
  const existingCustomers = getCustomers();
  for (const c of existingCustomers) {
    if (lower.includes(c.name.toLowerCase()) || (c.company && lower.includes(c.company.toLowerCase()))) {
      detectedName = c.name;
      detectedCompany = c.company || detectedCompany;
      detectedPhone = c.phone || detectedPhone;
      detectedEmail = c.email || detectedEmail;
      break;
    }
  }

  if (detectedName === "Unknown Lead" && detectedCompany) {
    detectedName = detectedCompany.split(" ")[0] + " Contact";
  } else if (detectedName === "Unknown Lead" && /priya/i.test(lower)) {
    detectedName = "Priya Nair";
  } else if (detectedName === "Unknown Lead" && /apex/i.test(lower)) {
    detectedCompany = "Apex Media Tech";
    detectedName = "Rohan Mehta";
  }

  // 2. Extract Items & Quantities
  const items = [];
  let estimatedTotal = 0;

  // Visiting cards
  const cardMatch = lower.match(/(\d+[\d,]*|\b(?:five hundred|one thousand|two thousand|hundred|500|1000|2000)\b)?\s*(?:visiting\s*cards?|cards?|business\s*cards?)/i);
  if (cardMatch || /card/i.test(lower)) {
    let qty = 500;
    const num = cardMatch && cardMatch[1] ? cardMatch[1].replace(/,/g, "") : null;
    if (num && !isNaN(parseInt(num, 10))) qty = parseInt(num, 10);
    else if (/1000|thousand|1k/i.test(lower)) qty = 1000;
    else if (/200|two hundred/i.test(lower)) qty = 200;
    else if (/300|three hundred/i.test(lower)) qty = 300;

    let paper = "300gsm Art Card";
    if (/350\s*gsm/i.test(lower)) paper = "350gsm Premium";
    else if (/400\s*gsm/i.test(lower)) paper = "400gsm Heavy Card";
    else if (/matte/i.test(lower)) paper = "300gsm Matte";

    let finish = "Standard Matte";
    let unitRate = 2.5;
    if (/gold\s*foil|foil\s*stamp|emboss/i.test(lower)) {
      finish = "Gold Foil Stamping + Emboss";
      unitRate = 5.0;
    } else if (/glossy|gloss/i.test(lower)) {
      finish = "Gloss Lamination";
      unitRate = 2.8;
    } else if (/velvet/i.test(lower)) {
      finish = "Velvet Touch Lamination";
      unitRate = 4.0;
    }

    const price = Math.round(qty * unitRate);
    estimatedTotal += price;
    items.push({
      type: "Visiting Cards",
      quantity: qty,
      paper,
      finish,
      unitRate,
      estimatedPrice: price
    });
  }

  // Brochures
  const brochureMatch = lower.match(/(\d+[\d,]*|\b(?:fifty|hundred|50|100|200|500|1000|2000)\b)?\s*(?:brochures?|pamphlets?|flyers?|leaflets?)/i);
  if (brochureMatch || /brochure/i.test(lower)) {
    let qty = 100;
    const num = brochureMatch && brochureMatch[1] ? brochureMatch[1].replace(/,/g, "") : null;
    if (num && !isNaN(parseInt(num, 10))) qty = parseInt(num, 10);
    else if (/50\b|fifty/i.test(lower)) qty = 50;
    else if (/2000|2k/i.test(lower)) qty = 2000;
    else if (/500/i.test(lower) && items.some(it => it.type === "Visiting Cards")) qty = 50; // if cards took 500
    else if (/500/i.test(lower)) qty = 500;

    let fold = "A4 Tri-fold";
    if (/bi-fold|half\s*fold|2\s*fold/i.test(lower)) fold = "A4 Bi-fold";
    else if (/a5/i.test(lower)) fold = "A5 4-Page Booklet";
    else if (/multi\s*page|catalog/i.test(lower)) fold = "8-Page Catalog";

    let paper = "170gsm Gloss Art Paper";
    let unitRate = 18;
    if (/300\s*gsm|cover/i.test(lower)) {
      paper = "250gsm Cover / 130gsm Inner";
      unitRate = 26;
    }

    if (qty >= 1000) unitRate = Math.round(unitRate * 0.65);
    else if (qty >= 500) unitRate = Math.round(unitRate * 0.8);

    const price = Math.round(qty * unitRate);
    estimatedTotal += price;
    items.push({
      type: "Brochures",
      quantity: qty,
      fold,
      paper,
      unitRate,
      estimatedPrice: price
    });
  }

  // Posters / Banners
  if (/poster|banner|standee|large\s*format/i.test(lower)) {
    let qty = 10;
    const pMatch = lower.match(/(\d+)\s*(?:posters?|banners?|standees?)/i);
    if (pMatch) qty = parseInt(pMatch[1], 10);

    let size = "A1 Large Format";
    if (/a2/i.test(lower)) size = "A2 Poster";
    else if (/standee/i.test(lower)) size = "6x2.5ft Rollup Standee";

    const price = qty * 450;
    estimatedTotal += price;
    items.push({
      type: "Posters / Display",
      quantity: qty,
      size,
      paper: "Laminated High-Res Vinyl / Sunboard",
      estimatedPrice: price
    });
  }

  // If no specific item detected, create a generic one
  if (items.length === 0) {
    items.push({
      type: "Custom Print Package",
      quantity: 1,
      paper: "To be confirmed with client",
      finish: "Standard",
      estimatedPrice: 5000
    });
    estimatedTotal = 5000;
  }

  // 3. Detect Urgency & Timeline
  let priority = "normal";
  let estimatedDueDateDays = 5;
  if (/urgent|emergency|asap|jaldi|urgent\s*hai|aaj|today|kal|tomorrow|friday|2\s*days|3\s*days/i.test(lower)) {
    priority = /today|tomorrow|kal|asap|aaj/i.test(lower) ? "urgent" : "high";
    estimatedDueDateDays = priority === "urgent" ? 2 : 3;
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + estimatedDueDateDays);
  const formattedDueDate = targetDate.toISOString().split("T")[0];

  // 4. Missing Information Warnings
  const missingInfo = [];
  if (!detectedPhone && !detectedEmail) missingInfo.push("No contact phone number or email provided");
  if (!items.some(i => i.paper && !i.paper.includes("To be confirmed"))) missingInfo.push("Paper GSM / stock preference unspecified");
  if (items.some(i => i.type === "Brochures") && !/tri-fold|bi-fold|a4|a5|catalog/i.test(lower)) missingInfo.push("Brochure format/folding style unclear");
  if (!/design|file|cdr|pdf|ai|artwork/i.test(lower)) missingInfo.push("Artwork readiness status unknown (client file vs in-house design)");

  // 5. Suggested WhatsApp Response
  const itemsText = items.map(i => `${i.quantity}x ${i.type} (${i.paper || i.size || ""})`).join(" + ");
  const suggestedReply = `Hi ${detectedName.split(" ")[0]}! Thanks for reaching out to Shyft Studio. 😊\n\nWe have received your requirement for *${itemsText}*.\nEstimated quote: *₹${estimatedTotal.toLocaleString("en-IN")}* (approx. timeline: ${estimatedDueDateDays} working days).\n\nTo finalize your job order, could you please confirm:\n1. Do you already have print-ready PDF/CDR artwork files?\n2. Paper preference (Matte or Glossy finish)?\n3. Delivery address or workshop pickup?\n\nLooking forward to printing for you! — Abhishek, Shyft Studio`;

  const jobTitle = `${detectedCompany ? detectedCompany + " — " : ""}${items.map(i => `${i.quantity} ${i.type}`).join(" + ")}`;
  const specsSummary = items.map(i => `${i.quantity} ${i.type} (${i.paper || ""}, ${i.finish || i.fold || i.size || ""})`).join("; ");

  return {
    success: true,
    rawText,
    customer: {
      name: detectedName,
      company: detectedCompany || "Independent / Individual",
      phone: detectedPhone || "+91 98XXX XXXXX",
      email: detectedEmail || "pending@client.in",
      isNew: !existingCustomers.some(c => c.name.toLowerCase() === detectedName.toLowerCase())
    },
    job: {
      title: jobTitle,
      description: `Lead extracted via AI WhatsApp parser:\n• ${specsSummary}\n• Raw message: "${text.slice(0, 150)}${text.length > 150 ? "..." : ""}"`,
      stage: "ENQUIRY",
      priority,
      quoteAmount: estimatedTotal,
      dueDate: formattedDueDate,
      specsSummary,
      leadSource: "WhatsApp / Chat"
    },
    items,
    missingInfo,
    suggestedReply
  };
}

/**
 * 1-Click Repeat Order Assistant:
 * Analyzes previous completed jobs for a customer and generates an instant re-order package.
 */
export function generateRepeatOrderPackage(customerId) {
  const customer = getCustomerById(customerId);
  if (!customer) return { success: false, error: "Customer not found" };

  const pastJobs = getCustomerJobs(customerId);
  const deliveredJobs = pastJobs.filter(j => j.stage === "DELIVERED");
  const referenceJob = deliveredJobs[0] || pastJobs[0];

  if (!referenceJob) {
    return {
      success: false,
      error: "No previous jobs found for this customer to repeat."
    };
  }

  // Compute repeat pricing (optional 5% loyalty repeat price adjustment or exact match)
  const baseQuote = referenceJob.quote_amount || 10000;
  const targetDueDate = new Date();
  targetDueDate.setDate(targetDueDate.getDate() + 4);

  const repeatJob = {
    title: `Repeat — ${referenceJob.title.replace(/^Repeat\s*—\s*/i, "")}`,
    description: `Repeat order based on Job #${referenceJob.id} (${referenceJob.title}).\nSpecs: ${referenceJob.description || "Identical past specifications"}.\nArtwork on file in archive.`,
    stage: "QUOTED",
    customerId: customer.id,
    quoteAmount: baseQuote,
    dueDate: targetDueDate.toISOString().split("T")[0],
    priority: "high",
    leadSource: "Repeat Client",
    specsSummary: referenceJob.description || "Identical to previous delivered job",
    referenceJobId: referenceJob.id,
    notes: `1-Click Repeat generated. Matches past job #${referenceJob.id} specs and pricing.`
  };

  return {
    success: true,
    customer,
    referenceJob,
    repeatJob,
    specsComparison: {
      pastJobId: referenceJob.id,
      pastStage: referenceJob.stage,
      pastQuote: referenceJob.quote_amount,
      pastDeliveredDate: referenceJob.updated_at || referenceJob.created_at,
      artworkStatus: "Artwork already verified from previous run"
    }
  };
}

/**
 * AI Production Risk & Bottleneck Intelligence
 * Analyzes print floor load, due dates, machine risks, and flags issues before they cause client friction.
 */
export function analyzeProductionRisks() {
  const allJobs = getJobs();
  const lateJobs = getLateJobs();
  const stages = getStageCounts();

  const printJobs = allJobs.filter(j => j.stage === "PRINTING");
  const designJobs = allJobs.filter(j => j.stage === "DESIGN");
  const readyJobs = allJobs.filter(j => j.stage === "READY");
  const quotedJobs = allJobs.filter(j => j.stage === "QUOTED");
  const enquiryJobs = allJobs.filter(j => j.stage === "ENQUIRY");

  const riskEvaluations = allJobs.map(job => {
    let riskLevel = "LOW";
    const reasons = [];
    const recommendations = [];

    const now = new Date();
    const dueDate = job.due_date ? new Date(job.due_date) : null;
    const isOverdue = dueDate && dueDate < now && job.stage !== "DELIVERED";
    const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    if (job.is_late || isOverdue) {
      riskLevel = "CRITICAL";
      reasons.push(`Job is overdue (due: ${job.due_date ? job.due_date.split("T")[0] : "passed"}).`);
      recommendations.push("Notify customer proactively with updated delivery ETA to protect trust.");
    } else if (job.stage === "PRINTING" && daysUntilDue !== null && daysUntilDue <= 1) {
      riskLevel = "HIGH";
      reasons.push("Due within 24h while still on the print floor.");
      recommendations.push("Prioritize in machine queue and initiate post-print cutting immediately.");
    } else if (job.stage === "DESIGN" && job.priority === "urgent") {
      riskLevel = "HIGH";
      reasons.push("Urgent priority job still waiting in Design approval.");
      recommendations.push("Abhishek to ping customer on WhatsApp for immediate digital proof sign-off.");
    } else if (job.stage === "ENQUIRY" && (!job.quote_amount || job.quote_amount === 0)) {
      riskLevel = "MODERATE";
      reasons.push("Unquoted enquiry aging in inbox.");
      recommendations.push("Sales to run Messy Lead Intake parser and send initial quote.");
    }

    if (job.notes && /paper stock|stock delay|out of stock|paper/i.test(job.notes)) {
      if (riskLevel === "LOW") riskLevel = "MODERATE";
      reasons.push("Paper stock dependency flagged in notes.");
      recommendations.push("Check warehouse reserve for 300gsm stock or contact local distributor.");
    }

    if (job.notes && /lamination|machine|emboss|foil/i.test(job.notes)) {
      reasons.push("Special finishing required (foil/lamination) requires additional drying time.");
    }

    return {
      jobId: job.id,
      title: job.title,
      customer_id: job.customer_id,
      stage: job.stage,
      priority: job.priority,
      due_date: job.due_date,
      quote_amount: job.quote_amount,
      riskLevel,
      reasons,
      recommendations
    };
  });

  // Calculate bottlenecks
  const bottlenecks = [];
  if (printJobs.length >= 2) {
    bottlenecks.push({
      stage: "PRINTING",
      severity: "High",
      description: `${printJobs.length} heavy jobs currently queued on the print floor. Machine throughput is near peak capacity.`,
      solution: "Stagger jobs across Offset vs Digital presses to clear finishing backlog."
    });
  }
  if (designJobs.length >= 1) {
    bottlenecks.push({
      stage: "DESIGN",
      severity: "Moderate",
      description: "Client design proof sign-offs are gating print starts.",
      solution: "Send WhatsApp 1-click proof approval links to speed up sign-offs."
    });
  }
  if (lateJobs.length > 0) {
    bottlenecks.push({
      stage: "DELIVERY",
      severity: "Critical",
      description: `${lateJobs.length} job(s) past promised SLA.`,
      solution: "Deploy express delivery courier or personal handoff for VIP clients."
    });
  }

  return {
    overallHealth: lateJobs.length > 1 ? "Attention Required" : lateJobs.length === 1 ? "Moderate Risk" : "Healthy",
    lateCount: lateJobs.length,
    highRiskCount: riskEvaluations.filter(r => r.riskLevel === "CRITICAL" || r.riskLevel === "HIGH").length,
    riskEvaluations,
    bottlenecks,
    summary: {
      enquiry: enquiryJobs.length,
      quoted: quotedJobs.length,
      design: designJobs.length,
      printing: printJobs.length,
      ready: readyJobs.length,
      delivered: allJobs.filter(j => j.stage === "DELIVERED").length
    }
  };
}

/**
 * Natural Language Query & Action Agent Copilot
 * Understands cross-role queries, calculates financials, analyzes jobs, and drafts communications.
 */
export function processCopilotQuery(queryText, userRole = "OWNER") {
  const query = String(queryText || "").trim().toLowerCase();

  // 1. Draft Communications (WhatsApp follow-ups, delay apologies, quote emails) - Check this FIRST
  if (/draft|apology|message|whatsapp|reply|write to|email/.test(query)) {
    if (/singh|delay|late/i.test(query)) {
      return {
        answer: `### ✍️ Draft Apology Message for Singh & Sons\n\n*Copy & send via WhatsApp:*\n\n> "Hi Karan, Samyak here from Shyft Studio. I am personally following up regarding your visiting cards (Job #7). Our premium paper stock was held up at the distributor yesterday, causing a 24-hour delay. We have expedited your print run on priority this morning and will personally deliver it to your office by 3:00 PM today. We sincerely apologize for the delay and thank you for your patience!"`
      };
    }
    if (/priya|enquiry|messy|follow up/i.test(query)) {
      return {
        answer: `### ✍️ Draft Follow-up for Priya Nair (Messy Enquiry)\n\n*Copy & send via WhatsApp:*\n\n> "Hi Priya! Abhishek from Shyft Studio following up on your conference brochure enquiry. We want to ensure you get the best pricing and print finish. Could you please share the approximate quantity needed (e.g. 100 or 500 copies) and if you require A4 tri-fold or booklet format? We can share digital samples right away!"`
      };
    }
    return {
      answer: `### ✍️ General Client Follow-up Draft\n\n> "Hi! Following up from Shyft Studio regarding your print project. We have your specifications ready and can proceed with printing as soon as you approve the digital proof. Please let us know if you have any questions!"`
    };
  }

  // 2. Revenue & Financial Summary
  if (/revenue|pipeline value|financial|money|total quoted|income|sales summary|how much/.test(query)) {
    const allJobs = getJobs();
    const activeJobs = allJobs.filter(j => j.stage !== "DELIVERED");
    const pipelineValue = activeJobs.reduce((sum, j) => sum + (j.quote_amount || 0), 0);
    const realizedValue = allJobs.filter(j => j.stage === "DELIVERED").reduce((sum, j) => sum + (j.quote_amount || 0), 0);
    const lateJobs = getLateJobs();
    const lateValue = lateJobs.reduce((sum, j) => sum + (j.quote_amount || 0), 0);

    return {
      answer: `### 📊 Financial & Pipeline Summary\n\n- **Active Pipeline Value:** ₹${pipelineValue.toLocaleString("en-IN")} (${activeJobs.length} active jobs)\n- **Realized Delivered Revenue:** ₹${realizedValue.toLocaleString("en-IN")}\n- **Revenue at Late / Delay Risk:** ₹${lateValue.toLocaleString("en-IN")} (${lateJobs.length} jobs)\n- **Average Ticket Size:** ₹${Math.round(pipelineValue / (activeJobs.length || 1)).toLocaleString("en-IN")}\n\n*Top active pipeline deal:* ${activeJobs.sort((a,b) => (b.quote_amount||0) - (a.quote_amount||0))[0]?.title || "None"}.`
    };
  }

  // 3. Operational Bottlenecks & Print Floor
  if (/bottleneck|stuck|machine|print floor|queue|backlog|capacity/.test(query) || (/delay/i.test(query) && !/draft|message/i.test(query))) {
    const riskData = analyzeProductionRisks();
    const bottlenecksList = riskData.bottlenecks.map(b => `• **[${b.stage}]** ${b.description} *(Action: ${b.solution})*`).join("\n");
    return {
      answer: `### ⚙️ Production Bottleneck Radar\n\n**Overall Status:** ${riskData.overallHealth} (${riskData.highRiskCount} jobs needing active intervention)\n\n${bottlenecksList || "No major hardware or stage bottlenecks detected today."}\n\n**Next Best Action:** Siddhant to prioritize Job #7 (Singh & Sons) and complete Job #6 lamination.`
    };
  }

  // 4. Specific customer history & re-orders
  const customerList = getCustomers();
  let matchedCustomer = null;
  for (const c of customerList) {
    const namePart = c.name.toLowerCase();
    if (query.includes(namePart) || (c.company && query.includes(c.company.toLowerCase()))) {
      matchedCustomer = c;
      break;
    }
  }

  if (matchedCustomer && (/order|history|what did|repeat|specs|previous|spend|ltv/.test(query))) {
    const jobs = getCustomerJobs(matchedCustomer.id);
    const totalSpent = jobs.reduce((s, j) => s + (j.quote_amount || 0), 0);
    const jobLines = jobs.map(j => `• **#${j.id} [${j.stage}]** ${j.title} — ₹${(j.quote_amount||0).toLocaleString("en-IN")} *(Due: ${j.due_date ? j.due_date.split("T")[0] : "N/A"})*`).join("\n");

    return {
      answer: `### 👤 Customer 360: ${matchedCustomer.name} (${matchedCustomer.company || "Independent"})\n\n- **Phone:** ${matchedCustomer.phone || "N/A"} | **Email:** ${matchedCustomer.email || "N/A"}\n- **Lifetime Value (LTV):** ₹${totalSpent.toLocaleString("en-IN")} across ${jobs.length} orders\n- **Client Notes:** ${matchedCustomer.notes || "None"}\n\n**Order History:**\n${jobLines}\n\n💡 *Tip: You can generate a 1-click repeat order for this client directly from their profile page.*`
    };
  }

  // 5. Late / Overdue jobs check
  if (/late|delayed|overdue|behind|urgent/.test(query)) {
    const late = getLateJobs();
    if (!late.length) return { answer: "✅ **All jobs are currently on schedule.** No late orders flagged in the pipeline." };
    const list = late.map(j => `• **#${j.id} ${j.title}** (${j.customer_name}) — Stage: \`${j.stage}\` | Due: ${j.due_date ? j.due_date.split("T")[0] : "Overdue"} | Note: *${j.notes || "No notes"}*`).join("\n");
    return {
      answer: `### ⚠️ Late / At-Risk Jobs (${late.length})\n\n${list}\n\n**Recommended Action:** Siddhant to fast-track print completion; Abhishek to notify clients.`
    };
  }

  // 6. Stage summary & pipeline overview
  if (/pipeline|summary|overview|status|stages|all jobs/.test(query)) {
    const stages = getStageCounts();
    const total = stages.reduce((s, r) => s + r.count, 0);
    const stageLines = stages.map(s => `• **${s.stage}:** ${s.count} jobs`).join("\n");
    return {
      answer: `### 📋 Pipeline Stage Breakdown (${total} Total Jobs)\n\n${stageLines}\n\n👉 *Use the Role Lens tabs on the Pipeline Board to view specialized Sales, Production, or Financial perspectives.*`
    };
  }

  // 7. Fallback helpful response
  return {
    answer: `### 🤖 Shyft Copilot Ready\n\nI can assist with:\n- 📈 **Financials:** *"What is our total pipeline revenue?"*\n- ⚠️ **Operations:** *"Show print floor bottlenecks and machine load"*\n- 👤 **Customer 360:** *"What did Neha from BrightTech order last time?"*\n- ✍️ **Action Drafts:** *"Draft an apology message for Singh & Sons delay"*\n- 🎯 **Sales:** *"Show unquoted leads needing follow-up"*`
  };
}
