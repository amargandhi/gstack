import * as fs from "fs";
import * as path from "path";
import type { PrimaryAnalysis, SecondOpinion } from "./types";

export function skippedSecondOpinion(provider: SecondOpinion["provider"] = "none"): SecondOpinion {
  return {
    schema_version: 1,
    status: "skipped",
    provider,
    evidence_ids: [],
    source_ids: []
  };
}

export function budgetRequiredSecondOpinion(provider: SecondOpinion["provider"], analysis: PrimaryAnalysis): SecondOpinion {
  return {
    schema_version: 1,
    status: "budget_required",
    provider,
    other_model_used: provider,
    agreement: "Second opinion was requested but not run because AI_USAGE_REVIEW_ALLOW_MODEL_CALL=ok was not set.",
    evidence_ids: analysis.strengths[0]?.evidence_ids || [],
    source_ids: analysis.source_ids.slice(0, 2)
  };
}

export function writeSecondOpinionPrompt(runDir: string, provider: SecondOpinion["provider"], analysis: PrimaryAnalysis): string {
  const prompt = [
    "# AI Usage Review Second Opinion",
    "",
    "You are the optional other-model critique pass. Use only the redacted prompt pack and primary analysis in this run directory.",
    "",
    "Answer exactly these questions:",
    "1. What did the primary coach overstate?",
    "2. What important pattern did it miss?",
    "3. Which recommendation is weakest?",
    "4. Which recommendation is strongest?",
    "5. What should the user focus on next session?",
    "",
    "Rules:",
    "- Cite only existing evidence_id values from evidence.normalized.jsonl.",
    "- Cite only existing source_id values from references/source-ledger.json.",
    "- Do not introduce raw transcript data.",
    "- Do not rewrite the whole report.",
    "",
    `Requested provider: ${provider}`,
    "",
    "Primary analysis summary:",
    JSON.stringify({
      one_line_read: analysis.one_line_read,
      strengths: analysis.strengths.map((item) => item.title),
      prompt_patterns: analysis.prompt_patterns.map((item) => item.title),
      underused_features: analysis.underused_features.map((item) => item.title),
      source_ids: analysis.source_ids
    }, null, 2),
    ""
  ].join("\n");
  const file = path.join(runDir, "second-opinion-prompt.md");
  fs.writeFileSync(file, prompt);
  return file;
}
