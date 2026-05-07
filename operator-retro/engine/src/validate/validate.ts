import * as fs from "fs";
import * as path from "path";
import type { AiUsageEvent, AnalysisFinding, OperatorRetroAnalysis, PrimaryAnalysis, SecondOpinion } from "../types";
import { guidanceIds, sourceIds } from "../guidance/ledger";
import { hasHighRiskSecret, hasPrivatePath } from "../privacy/redact";

export type ValidationResult = {
  ok: boolean;
  errors: string[];
};

function allFindings(analysis: PrimaryAnalysis): AnalysisFinding[] {
  return [
    ...analysis.strengths,
    ...analysis.prompt_patterns,
    ...analysis.underused_features,
    ...analysis.teaching_notes,
    ...analysis.better_next_time_prompts,
    ...analysis.next_session_script
  ];
}

export function validateAnalysis(events: AiUsageEvent[], analysis: PrimaryAnalysis, secondOpinion?: SecondOpinion): ValidationResult {
  const errors: string[] = [];
  const evidence = new Set(events.map((event) => event.evidence_id));
  const sources = sourceIds();

  for (const item of allFindings(analysis)) {
    if (item.evidence_ids.length === 0) errors.push(`${item.kind}:${item.title} has no evidence IDs.`);
    for (const id of item.evidence_ids) {
      if (!evidence.has(id)) errors.push(`${item.kind}:${item.title} cites missing evidence ID ${id}.`);
    }
    if (item.source_ids.length === 0 && item.kind !== "pattern") {
      errors.push(`${item.kind}:${item.title} has no source IDs.`);
    }
    for (const id of item.source_ids) {
      if (!sources.has(id)) errors.push(`${item.kind}:${item.title} cites missing source ID ${id}.`);
    }
  }

  if (secondOpinion && secondOpinion.status === "completed") {
    for (const id of secondOpinion.evidence_ids) {
      if (!evidence.has(id)) errors.push(`second_opinion cites missing evidence ID ${id}.`);
    }
    for (const id of secondOpinion.source_ids) {
      if (!sources.has(id)) errors.push(`second_opinion cites missing source ID ${id}.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateNoSecretsInFiles(files: string[]): ValidationResult {
  const errors: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    if (hasHighRiskSecret(content)) errors.push(`${path.basename(file)} contains a high-risk secret pattern.`);
    if (hasPrivatePath(content)) errors.push(`${path.basename(file)} contains an unredacted private path.`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateOperatorRetro(events: AiUsageEvent[], analysis: OperatorRetroAnalysis): ValidationResult {
  const errors: string[] = [];
  const evidence = new Set(events.map((event) => event.evidence_id));
  const guidance = guidanceIds();
  const findings = [
    ...analysis.operator_findings,
    ...analysis.best_runs,
    ...analysis.missed_gstack_leverage
  ];

  if (analysis.schema_version !== 2) errors.push("operator retro schema_version must be 2.");

  for (const item of findings) {
    if (item.evidence_ids.length === 0) errors.push(`${item.kind}:${item.title} has no evidence IDs.`);
    for (const id of item.evidence_ids) {
      if (!evidence.has(id)) errors.push(`${item.kind}:${item.title} cites missing evidence ID ${id}.`);
    }
    if (item.guidance_ids.length === 0) errors.push(`${item.kind}:${item.title} has no guidance IDs.`);
    for (const id of item.guidance_ids) {
      if (!guidance.has(id)) errors.push(`${item.kind}:${item.title} cites missing guidance ID ${id}.`);
    }
    if (item.kind === "missed_gstack_leverage" && !analysis.coverage.can_claim_skipped_gate) {
      const text = `${item.title}\n${item.body}`.toLowerCase();
      if (text.includes("skipped") && !text.includes("potential")) {
        errors.push(`${item.kind}:${item.title} claims a skipped gate without sufficient coverage.`);
      }
    }
  }

  for (const item of analysis.coverage_limits) {
    for (const id of item.evidence_ids) {
      if (!evidence.has(id)) errors.push(`${item.kind}:${item.title} cites missing evidence ID ${id}.`);
    }
    for (const id of item.guidance_ids) {
      if (!guidance.has(id)) errors.push(`${item.kind}:${item.title} cites missing guidance ID ${id}.`);
    }
  }

  for (const item of analysis.proposed_actions) {
    if (item.status !== "proposed") errors.push(`${item.type}:${item.title} status must be proposed.`);
    if (item.evidence_ids.length === 0) errors.push(`${item.type}:${item.title} has no evidence IDs.`);
    for (const id of item.evidence_ids) {
      if (!evidence.has(id)) errors.push(`${item.type}:${item.title} cites missing evidence ID ${id}.`);
    }
    if (item.guidance_ids.length === 0) errors.push(`${item.type}:${item.title} has no guidance IDs.`);
    for (const id of item.guidance_ids) {
      if (!guidance.has(id)) errors.push(`${item.type}:${item.title} cites missing guidance ID ${id}.`);
    }
  }

  const serialized = JSON.stringify(analysis);
  if (hasHighRiskSecret(serialized)) errors.push("operator retro analysis contains a high-risk secret pattern.");
  if (hasPrivatePath(serialized)) errors.push("operator retro analysis contains an unredacted private path.");

  return { ok: errors.length === 0, errors };
}
