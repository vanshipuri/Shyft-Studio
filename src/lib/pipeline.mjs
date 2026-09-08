// Canonical pipeline definition for Shyft Studio.
//
// This module is the SINGLE SOURCE OF TRUTH for what the job pipeline looks
// like and — critically — WHO owns a job at each stage. Ownership is not a
// free-text "status": every stage carries a default-owner role baked into the
// data model, and `/api/jobs/update-stage` re-assigns the job to that owner on
// every transition. Anyone on the team can tell at a glance whose job it is.

export const PIPELINE = [
  {
    id: "ENQUIRY",
    label: "Enquiry",
    ownerRole: "SALES",
    ownerLabel: "Abhishek (Sales)",
    nextAction: "Qualify the lead, collect specs, and send a quote.",
  },
  {
    id: "QUOTED",
    label: "Quoted",
    ownerRole: "SALES",
    ownerLabel: "Abhishek (Sales)",
    nextAction: "Win the order — confirm price, advance payment, and artwork source.",
  },
  {
    id: "DESIGN",
    label: "Design",
    ownerRole: "SALES",
    ownerLabel: "Abhishek (Sales)",
    nextAction: "Chase client proof sign-off so the print run can start.",
  },
  {
    id: "PRINTING",
    label: "Printing",
    ownerRole: "PRODUCTION",
    ownerLabel: "Siddhant (Production)",
    nextAction: "Run the press, then finish (lamination / die-cut / binding).",
  },
  {
    id: "READY",
    label: "Ready",
    ownerRole: "PRODUCTION",
    ownerLabel: "Siddhant (Production)",
    nextAction: "Final QC, bundle, and dispatch / hand over to the customer.",
  },
  {
    id: "DELIVERED",
    label: "Delivered",
    ownerRole: "SALES",
    ownerLabel: "Abhishek (Sales)",
    nextAction: "Collect the balance payment and schedule the post-delivery check-in.",
  },
];

export const STAGE_IDS = PIPELINE.map((s) => s.id);

/** Role (OWNER | SALES | PRODUCTION) that owns a given stage by default. */
export function ownerRoleForStage(stageId) {
  const stage = PIPELINE.find((s) => s.id === stageId);
  return stage ? stage.ownerRole : null;
}

/** Human-friendly default owner for a stage, e.g. "Siddhant (Production)". */
export function ownerLabelForStage(stageId) {
  const stage = PIPELINE.find((s) => s.id === stageId);
  return stage ? stage.ownerLabel : "Unassigned";
}

/** Single word role label for compact UIs, e.g. "Sales" / "Production". */
export function ownerShortLabelForStage(stageId) {
  const role = ownerRoleForStage(stageId);
  if (role === "SALES") return "Sales";
  if (role === "PRODUCTION") return "Production";
  return role || "—";
}

export function isValidStage(stageId) {
  return STAGE_IDS.includes(stageId);
}

/** Next stage in the canonical order (or null at the end of the pipeline). */
export function nextStage(stageId) {
  const idx = STAGE_IDS.indexOf(stageId);
  return idx >= 0 && idx < STAGE_IDS.length - 1 ? STAGE_IDS[idx + 1] : null;
}

export function previousStage(stageId) {
  const idx = STAGE_IDS.indexOf(stageId);
  return idx > 0 ? STAGE_IDS[idx - 1] : null;
}

/**
 * Decides the effective owner for a job at `stage`.
 * - An existing assignee whose role already matches the stage's default owner is kept.
 * - Anyone else (wrong role, or an OWNER who grabbed the job) yields to the stage owner,
 *   so every job stage has exactly one clear, correct owner at all times.
 */
export function resolveStageOwner(stageId, currentAssignee, allUsers) {
  const ownerRole = ownerRoleForStage(stageId);
  if (!ownerRole) return currentAssignee ? currentAssignee.id : null;
  if (currentAssignee && currentAssignee.role === ownerRole) return currentAssignee.id;
  const stageOwner = (allUsers || []).find((u) => u.role === ownerRole);
  return stageOwner ? stageOwner.id : currentAssignee ? currentAssignee.id : null;
}
