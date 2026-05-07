import type { AiUsageEvent, OperatorRetroAnalysis } from "../types";
import { analyzeOperatorRetroDeterministic } from "./operator-retro";

export function buildOperatorCoachPrompt(events: AiUsageEvent[], deterministic: OperatorRetroAnalysis): string {
  return [
    "# Operator Retro Coach Prompt",
    "",
    "You are producing a strict JSON operator-retro analysis. Do not write markdown.",
    "Use only the redacted evidence IDs and deterministic features provided here.",
    "Do not include raw transcript fragments, private paths, secrets, or uncited claims.",
    "",
    "Required top-level shape:",
    "```json",
    JSON.stringify({
      schema_version: 2,
      generated_at: "ISO-8601",
      project: deterministic.project,
      analysis_engine: "model",
      one_line_read: "string",
      operator_findings: [],
      best_runs: [],
      missed_gstack_leverage: [],
      proposed_actions: [],
      coverage_limits: [],
      guidance_ids: [],
      coverage: deterministic.coverage,
      evidence_coverage: deterministic.evidence_coverage
    }, null, 2),
    "```",
    "",
    "Rules:",
    "- Every operator_findings/best_runs/missed_gstack_leverage item needs evidence_ids and guidance_ids.",
    "- Every proposed_actions item needs status=\"proposed\", evidence_ids, and guidance_ids.",
    "- Use only guidance_ids visible in the deterministic analysis.",
    "- If coverage cannot support a skipped-gate claim, write \"Potential missed leverage\".",
    "",
    "Deterministic baseline:",
    "```json",
    JSON.stringify(deterministic, null, 2),
    "```",
    "",
    "Redacted evidence summary:",
    "```json",
    JSON.stringify(events.map((event) => ({
      evidence_id: event.evidence_id,
      source_kind: event.source_kind,
      role: event.role,
      session_id: event.session_id,
      timestamp: event.timestamp,
      tool_name: event.tool_name,
      text: event.redacted_text
    })), null, 2),
    "```",
    ""
  ].join("\n");
}

export function maybeRunModelCoach(prompt: string, deterministic: OperatorRetroAnalysis, mode: "auto" | "deterministic" | "model"): OperatorRetroAnalysis {
  if (mode === "deterministic") return deterministic;
  const allowed = process.env.AI_USAGE_REVIEW_ALLOW_MODEL_CALL === "ok";
  const command = process.env.AI_USAGE_REVIEW_MODEL_CMD;
  if (!allowed || !command) {
    if (mode === "model") {
      throw new Error("Model analysis requires AI_USAGE_REVIEW_ALLOW_MODEL_CALL=ok and AI_USAGE_REVIEW_MODEL_CMD.");
    }
    return deterministic;
  }

  const result = Bun.spawnSync({
    cmd: ["sh", "-lc", command],
    stdin: new TextEncoder().encode(prompt),
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0) {
    if (mode === "model") throw new Error(result.stderr.toString() || "Model analysis command failed.");
    return deterministic;
  }
  let parsed: OperatorRetroAnalysis;
  try {
    parsed = JSON.parse(result.stdout.toString()) as OperatorRetroAnalysis;
  } catch {
    if (mode === "model") throw new Error("Model analysis command did not return JSON.");
    return deterministic;
  }
  return { ...parsed, analysis_engine: "model" };
}
