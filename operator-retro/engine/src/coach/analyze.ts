import type { AiUsageEvent, AnalysisFinding, PrimaryAnalysis } from "../types";
import { readFeatureLedger } from "../guidance/ledger";

function includesAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function sampleEvidence(events: AiUsageEvent[], n = 3): string[] {
  return events.slice(0, n).map((event) => event.evidence_id);
}

function finding(kind: AnalysisFinding["kind"], title: string, body: string, evidence_ids: string[], source_ids: string[], feature_id?: string): AnalysisFinding {
  return { kind, title, body, evidence_ids, source_ids, feature_id };
}

export function analyzePromptPack(events: AiUsageEvent[], project: string): PrimaryAnalysis {
  const features = readFeatureLedger().features;
  const userPrompts = events.filter((event) => event.role === "user" && event.redacted_text);
  const toolEvents = events.filter((event) => event.role === "tool");
  const sessions = new Set(events.map((event) => event.session_id));
  const sourceCounts: Record<string, number> = {};
  for (const event of events) sourceCounts[event.source_kind] = (sourceCounts[event.source_kind] || 0) + 1;

  const promptTexts = userPrompts.map((event) => event.redacted_text || "");
  const allText = promptTexts.join("\n\n");
  const implementationPrompts = userPrompts.filter((event) => includesAny(event.redacted_text || "", ["implement", "fix", "build", "add", "update", "change", "refactor"]));
  const verificationPrompts = userPrompts.filter((event) => includesAny(event.redacted_text || "", ["test", "verify", "check", "run", "prove", "screenshot"]));
  const planningPrompts = userPrompts.filter((event) => includesAny(event.redacted_text || "", ["plan", "architecture", "design", "think", "diagram", "approach"]));
  const constraintPrompts = userPrompts.filter((event) => includesAny(event.redacted_text || "", ["only", "don't", "do not", "must", "keep", "avoid", "no "] ));
  const sourcePrompts = userPrompts.filter((event) => includesAny(event.redacted_text || "", ["source", "cite", "link", "guideline", "docs"]));

  const strengths: AnalysisFinding[] = [];
  if (planningPrompts.length > 0) {
    strengths.push(finding(
      "strength",
      "You often use AI for thinking before action",
      "You ask for plans, diagrams, or approach discussion before implementation. That is a strong use of latent model judgment when the problem shape is still uncertain.",
      sampleEvidence(planningPrompts),
      ["anthropic-claude-code-common-workflows"]
    ));
  }
  if (verificationPrompts.length > 0) {
    strengths.push(finding(
      "strength",
      "You already ask for verification in some sessions",
      "Several prompts ask the agent to run, verify, test, or prove the result. That is the habit that keeps AI coding from becoming plausible text without a check.",
      sampleEvidence(verificationPrompts),
      ["openai-code-generation"]
    ));
  }
  if (sourcePrompts.length > 0) {
    strengths.push(finding(
      "strength",
      "You ask for source-backed advice",
      "Your prompts sometimes demand links, source checks, or guideline grounding. That is exactly the right instinct for advice about AI usage.",
      sampleEvidence(sourcePrompts),
      ["openai-docs-mcp"]
    ));
  }

  const promptPatterns: AnalysisFinding[] = [];
  if (implementationPrompts.length > verificationPrompts.length + 2) {
    promptPatterns.push(finding(
      "pattern",
      "Implementation asks outnumber proof asks",
      "You have more prompts asking AI to make changes than prompts defining how the work will be proven correct. That pattern can make the agent optimize for activity instead of closure.",
      sampleEvidence(implementationPrompts),
      ["openai-code-generation"]
    ));
  }
  if (constraintPrompts.length === 0 && implementationPrompts.length > 0) {
    promptPatterns.push(finding(
      "pattern",
      "Implementation prompts often lack boundaries",
      "The implementation prompts in this window do not show many explicit constraints such as files to avoid, scope boundaries, or non-goals. The agent may have too much room to make unrelated edits.",
      sampleEvidence(implementationPrompts),
      ["agents-md-spec"]
    ));
  }
  if (userPrompts.length > 0 && allText.split(/\s+/).length / userPrompts.length < 12) {
    promptPatterns.push(finding(
      "pattern",
      "Many prompts are very short",
      "Short prompts are not automatically bad, but repeated short commands make the model infer intent, success criteria, and constraints from context rather than from your instruction.",
      sampleEvidence(userPrompts),
      ["anthropic-claude-code-memory"]
    ));
  }

  const underusedFeatures: AnalysisFinding[] = [];
  const featureById = new Map(features.map((feature) => [feature.id, feature]));
  const largeTaskEvidence = userPrompts.filter((event) => includesAny(event.redacted_text || "", ["all", "complete", "full", "large", "big", "entire", "everything"]));
  if (largeTaskEvidence.length > 0) {
    const feature = featureById.get("subagents")!;
    underusedFeatures.push(finding(
      "underused_feature",
      feature.label,
      "Some prompts describe broad work. For broad or parallelizable work, use subagents or a second context window to separate exploration, critique, and implementation instead of asking one context to hold everything.",
      sampleEvidence(largeTaskEvidence),
      feature.source_ids,
      feature.id
    ));
  }
  if (implementationPrompts.length > 1 && planningPrompts.length === 0) {
    const feature = featureById.get("plan-mode")!;
    underusedFeatures.push(finding(
      "underused_feature",
      feature.label,
      "This window contains implementation-shaped prompts without much up-front planning language. Plan mode is a better fit before asking the agent to change many files or make architecture choices.",
      sampleEvidence(implementationPrompts),
      feature.source_ids,
      feature.id
    ));
  }
  if (implementationPrompts.length > 2 && !includesAny(allText, ["review", "second opinion", "challenge"])) {
    const feature = featureById.get("codex-second-opinion")!;
    underusedFeatures.push(finding(
      "underused_feature",
      feature.label,
      "When a run includes multiple implementation prompts, an outside model review can catch blind spots before the same model validates its own work.",
      sampleEvidence(implementationPrompts),
      feature.source_ids,
      feature.id
    ));
  }
  if (includesAny(allText, ["same mistake", "remember", "always", "every time"])) {
    const feature = featureById.get("memory-or-agents-md")!;
    underusedFeatures.push(finding(
      "underused_feature",
      feature.label,
      "Prompts about repeated preferences or recurring mistakes are candidates for project instructions, memory, or AGENTS.md instead of being re-explained in each session.",
      sampleEvidence(userPrompts.filter((event) => includesAny(event.redacted_text || "", feature.signals))),
      feature.source_ids,
      feature.id
    ));
  }

  const teachingNotes: AnalysisFinding[] = [
    ...promptPatterns.slice(0, 3).map((pattern) => finding(
      "teaching_note",
      `Teaching note: ${pattern.title}`,
      `${pattern.body} Next time, attach the proof condition and scope boundary to the same prompt so the model can optimize for a finish line.`,
      pattern.evidence_ids,
      pattern.source_ids
    )),
    ...underusedFeatures.slice(0, 3).map((feature) => finding(
      "teaching_note",
      `Teaching note: ${feature.title}`,
      `${feature.body} Treat the feature as a workflow choice, not a moral grade: use it when the task shape matches.`,
      feature.evidence_ids,
      feature.source_ids,
      feature.feature_id
    ))
  ];

  const rewriteEvidence = implementationPrompts[0] ? [implementationPrompts[0].evidence_id] : sampleEvidence(userPrompts, 1);
  const betterPrompts: AnalysisFinding[] = rewriteEvidence.length ? [
    finding(
      "prompt_rewrite",
      "Rewrite one implementation prompt with a finish line",
      "Try: \"Implement the change. Done when [specific command/check] passes. Touch only [intended area]. Before editing, tell me the smallest plan and what you will not change.\"",
      rewriteEvidence,
      ["openai-code-generation", "agents-md-spec"]
    )
  ] : [];

  const nextSession: AnalysisFinding[] = [
    finding(
      "habit",
      "Next-session script",
      "After I ask AI to implement something, I will add the proof command and one scope boundary in the same prompt.",
      rewriteEvidence,
      ["openai-code-generation"]
    )
  ];

  const sourceIds = new Set<string>();
  for (const group of [strengths, promptPatterns, underusedFeatures, teachingNotes, betterPrompts, nextSession]) {
    for (const item of group) for (const source of item.source_ids) sourceIds.add(source);
  }

  const limits: string[] = [];
  if (userPrompts.length < 5) limits.push("Low prompt coverage: fewer than five user prompts were found for this project/window.");
  if (events.every((event) => event.source_kind !== "claude_desktop")) limits.push("Claude desktop coverage may be incomplete or schema-skipped.");
  if (events.every((event) => event.source_kind !== "codex_desktop")) limits.push("Codex desktop app cache coverage is experimental and not used by default.");

  const oneLine = userPrompts.length === 0
    ? "Not enough local prompt evidence to coach this run."
    : strengths.length > 0
      ? "You use AI best when you ask it to think and verify, but the next leverage point is making proof and scope explicit in implementation prompts."
      : "Your prompts give AI work to do, but the report needs more explicit success criteria, constraints, and source-backed workflow choices.";

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    project,
    one_line_read: oneLine,
    what_user_was_trying_to_do: inferGoal(userPrompts),
    strengths,
    prompt_patterns: promptPatterns,
    underused_features: underusedFeatures,
    teaching_notes: teachingNotes,
    better_next_time_prompts: betterPrompts,
    next_session_script: nextSession,
    source_ids: Array.from(sourceIds).sort(),
    evidence_coverage: {
      total_events: events.length,
      user_prompts: userPrompts.length,
      tool_events: toolEvents.length,
      sessions: sessions.size,
      sources: sourceCounts
    },
    limits
  };
}

function inferGoal(userPrompts: AiUsageEvent[]): string {
  if (userPrompts.length === 0) return "Not enough user prompts were found to infer the goal.";
  const text = userPrompts.slice(0, 5).map((event) => event.redacted_text || "").join(" ");
  if (includesAny(text, ["manifold", "xcode", "swift", "macos", "app"])) {
    return "The prompts look like a coding session around a local app or repo, with AI used for implementation, planning, or review.";
  }
  if (includesAny(text, ["plan", "diagram", "think"])) {
    return "The prompts look like a planning/coaching session where AI was used to shape an approach before implementation.";
  }
  return "The prompts show the user delegating work to AI, but the exact project goal is only partially visible from local prompt evidence.";
}
