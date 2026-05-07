import { shortHash } from "../paths";
import type { AiUsageEvent, CoverageLevel, OperatorRetroAnalysis, OperatorRetroFinding, ProposedAction } from "../types";

function lower(text: string | undefined): string {
  return (text || "").toLowerCase();
}

function includesAny(text: string | undefined, words: string[]): boolean {
  const haystack = lower(text);
  return words.some((word) => haystack.includes(word));
}

function sample(events: AiUsageEvent[], n = 3): string[] {
  return events.slice(0, n).map((event) => event.evidence_id);
}

function coverageLevel(count: number): CoverageLevel {
  if (count === 0) return "none";
  if (count < 3) return "low";
  if (count < 8) return "medium";
  return "high";
}

function actionId(type: ProposedAction["type"], evidence: string[], title: string): string {
  return `act-${shortHash([type, title, ...evidence].join("|"), 12)}`;
}

function finding(
  kind: OperatorRetroFinding["kind"],
  title: string,
  body: string,
  evidence_ids: string[],
  guidance_ids: string[],
  confidence: CoverageLevel = "medium",
  claim_strength: OperatorRetroFinding["claim_strength"] = "observed"
): OperatorRetroFinding {
  return { kind, title, body, evidence_ids, guidance_ids, confidence, claim_strength };
}

function action(
  type: ProposedAction["type"],
  title: string,
  body: string,
  evidence_ids: string[],
  guidance_ids: string[],
  command_hint?: string
): ProposedAction {
  return {
    action_id: actionId(type, evidence_ids, title),
    type,
    title,
    body,
    status: "proposed",
    evidence_ids,
    guidance_ids,
    command_hint
  };
}

function evidenceCoverage(events: AiUsageEvent[]): OperatorRetroAnalysis["evidence_coverage"] {
  const sources: Record<string, number> = {};
  for (const event of events) sources[event.source_kind] = (sources[event.source_kind] || 0) + 1;
  return {
    total_events: events.length,
    user_prompts: events.filter((event) => event.role === "user").length,
    tool_events: events.filter((event) => event.role === "tool").length,
    sessions: new Set(events.map((event) => event.session_id)).size,
    sources
  };
}

export function extractOperatorFeatures(events: AiUsageEvent[]) {
  const userPrompts = events.filter((event) => event.role === "user" && event.redacted_text);
  const toolEvents = events.filter((event) => event.role === "tool");
  const gstackEvents = events.filter((event) => event.source_kind === "gstack");
  const timelineEvents = gstackEvents.filter((event) => event.raw_pointer.includes("timeline.jsonl"));
  const artifactEvents = gstackEvents.filter((event) => !event.raw_pointer.includes("timeline.jsonl") && !event.raw_pointer.includes("learnings.jsonl"));

  const implementationPrompts = userPrompts.filter((event) => includesAny(event.redacted_text, ["implement", "fix", "build", "add", "update", "change", "refactor", "make"]));
  const proofPrompts = userPrompts.filter((event) => includesAny(event.redacted_text, ["test", "verify", "check", "run", "prove", "screenshot", "done when", "acceptance"]));
  const planningPrompts = userPrompts.filter((event) => includesAny(event.redacted_text, ["plan", "architecture", "design", "approach", "before editing", "think"]));
  const scopePrompts = userPrompts.filter((event) => includesAny(event.redacted_text, ["only", "do not", "don't", "must", "avoid", "scope", "non-goal", "touch only"]));
  const broadPrompts = implementationPrompts.filter((event) => includesAny(event.redacted_text, ["all", "complete", "entire", "everything", "full", "whole", "large", "broad"]));
  const repeatedPreferencePrompts = userPrompts.filter((event) => includesAny(event.redacted_text, ["always", "remember", "prefer", "every time", "same mistake", "don't use", "do not use"]));
  const fixLoopPrompts = userPrompts.filter((event) => includesAny(event.redacted_text, ["still failing", "still broken", "same error", "try again", "fix again", "didn't work", "doesn't work", "keeps failing"]));
  const uiPrompts = implementationPrompts.filter((event) => includesAny(event.redacted_text, ["ui", "screen", "button", "browser", "screenshot", "layout", "visual", "css", "swiftui", "view"]));

  const completedSkills = timelineEvents.map((event) => lower(`${event.tool_name || ""} ${event.redacted_text || ""}`));
  const hasReview = completedSkills.some((text) => text.includes("review"));
  const hasShip = completedSkills.some((text) => text.includes("ship"));
  const hasQA = completedSkills.some((text) => text.includes("qa"));
  const hasInvestigate = completedSkills.some((text) => text.includes("investigate"));

  const timeline_coverage = coverageLevel(timelineEvents.length);
  const artifact_coverage = coverageLevel(artifactEvents.length);

  return {
    userPrompts,
    toolEvents,
    gstackEvents,
    implementationPrompts,
    proofPrompts,
    planningPrompts,
    scopePrompts,
    broadPrompts,
    repeatedPreferencePrompts,
    fixLoopPrompts,
    uiPrompts,
    hasReview,
    hasShip,
    hasQA,
    hasInvestigate,
    coverage: {
      timeline_coverage,
      artifact_coverage,
      can_claim_skipped_gate: timeline_coverage === "high"
    }
  };
}

export function summarizeOperatorFeatures(events: AiUsageEvent[]) {
  const features = extractOperatorFeatures(events);
  return {
    user_prompts: features.userPrompts.length,
    tool_events: features.toolEvents.length,
    gstack_events: features.gstackEvents.length,
    implementation_prompts: features.implementationPrompts.length,
    proof_prompts: features.proofPrompts.length,
    planning_prompts: features.planningPrompts.length,
    scope_prompts: features.scopePrompts.length,
    broad_prompts: features.broadPrompts.length,
    repeated_preference_prompts: features.repeatedPreferencePrompts.length,
    fix_loop_prompts: features.fixLoopPrompts.length,
    ui_prompts: features.uiPrompts.length,
    gstack_signals: {
      has_review: features.hasReview,
      has_ship: features.hasShip,
      has_qa: features.hasQA,
      has_investigate: features.hasInvestigate
    },
    coverage: features.coverage
  };
}

export function analyzeOperatorRetroDeterministic(events: AiUsageEvent[], project: string): OperatorRetroAnalysis {
  const features = extractOperatorFeatures(events);
  const operator_findings: OperatorRetroFinding[] = [];
  const best_runs: OperatorRetroFinding[] = [];
  const missed_gstack_leverage: OperatorRetroFinding[] = [];
  const proposed_actions: ProposedAction[] = [];
  const coverage_limits: OperatorRetroFinding[] = [];

  if (features.userPrompts.length === 0) {
    coverage_limits.push(finding(
      "coverage_limit",
      "No usable operator prompts were found",
      "The collector did not find redacted user prompts for this project/window, so the retro cannot judge operator behavior.",
      sample(events, 1),
      ["gstack.operator-retro-boundary"],
      "low",
      "limited"
    ));
  }

  const plannedAndProved = features.userPrompts.filter((event) =>
    includesAny(event.redacted_text, ["plan", "approach", "before editing"]) &&
    includesAny(event.redacted_text, ["test", "verify", "done when", "prove"])
  );
  if (plannedAndProved.length > 0) {
    best_runs.push(finding(
      "best_run",
      "Best operator move: planning and proof were bundled",
      "At least one prompt paired an upfront plan with an explicit proof condition. That is the cleanest operator pattern because it gives the agent both direction and closure.",
      sample(plannedAndProved),
      ["operator.proof-with-implementation", "gstack.plan-before-build"],
      "high"
    ));
  }

  if (features.implementationPrompts.length > features.proofPrompts.length + 1) {
    const ev = sample(features.implementationPrompts);
    operator_findings.push(finding(
      "operator_finding",
      "Implementation asks outnumber proof asks",
      "The window contains more change requests than verification requests. That pushes the AI toward activity instead of an observable finish line.",
      ev,
      ["operator.proof-with-implementation"],
      "medium"
    ));
    proposed_actions.push(action(
      "next_prompt",
      "Attach proof to implementation prompts",
      "Next prompt template: \"Implement this. Done when <command/check> passes. Touch only <scope>. Before editing, state the smallest plan and what you will not change.\"",
      ev,
      ["operator.proof-with-implementation", "operator.scope-boundary"]
    ));
  }

  if (features.broadPrompts.length > 0 && features.scopePrompts.length === 0) {
    const ev = sample(features.broadPrompts);
    operator_findings.push(finding(
      "operator_finding",
      "Broad implementation prompts lacked explicit scope",
      "A broad change request appeared without matching scope boundaries or non-goals. That makes unrelated edits more likely.",
      ev,
      ["operator.scope-boundary", "gstack.plan-before-build"],
      "medium"
    ));
    proposed_actions.push(action(
      "skill_suggestion",
      "Use planning before broad implementation",
      "For broad work, start with /plan-eng-review or an explicit plan step before allowing edits.",
      ev,
      ["gstack.plan-before-build"],
      "/plan-eng-review"
    ));
  }

  if (features.fixLoopPrompts.length >= 2 && !features.hasInvestigate) {
    const ev = sample(features.fixLoopPrompts);
    operator_findings.push(finding(
      "operator_finding",
      "Repeated fix-loop language appeared without an investigation reset",
      "The operator pushed further fixes after signs that the same failure was recurring. After two misses, the next useful move is hypothesis-driven investigation.",
      ev,
      ["gstack.investigate-after-fix-loop"],
      "high"
    ));
    proposed_actions.push(action(
      "skill_suggestion",
      "Switch to /investigate after two failed fixes",
      "Candidate operating rule: after the second failed patch for the same symptom, stop patching and run /investigate.",
      ev,
      ["gstack.investigate-after-fix-loop"],
      "/investigate"
    ));
    proposed_actions.push(action(
      "learning_candidate",
      "Persist the fix-loop rule",
      "Learning candidate: \"After two failed fixes on the same issue, run /investigate before patching again.\"",
      ev,
      ["gstack.learn-repeated-preference", "gstack.investigate-after-fix-loop"]
    ));
  }

  if (features.repeatedPreferencePrompts.length > 0) {
    const ev = sample(features.repeatedPreferencePrompts);
    operator_findings.push(finding(
      "operator_finding",
      "Repeated preferences belong in durable instructions",
      "The operator repeated preference or memory-shaped language. That is a sign the preference should move into a learning or project instruction instead of being retyped.",
      ev,
      ["gstack.learn-repeated-preference"],
      "medium"
    ));
    proposed_actions.push(action(
      "learning_candidate",
      "Promote repeated preference into /learn",
      "Learning candidate should capture the preference in neutral project language without raw transcript text.",
      ev,
      ["gstack.learn-repeated-preference"],
      "/learn"
    ));
  }

  if (features.uiPrompts.length > 0 && (features.hasReview || features.hasShip) && !features.hasQA) {
    const ev = sample(features.uiPrompts);
    const canClaimSkipped = features.coverage.can_claim_skipped_gate;
    missed_gstack_leverage.push(finding(
      "missed_gstack_leverage",
      canClaimSkipped ? "UI work appears to have skipped QA" : "Potential missed leverage: QA after UI work",
      canClaimSkipped
        ? "GStack timeline coverage is high enough to say UI-shaped work had review or ship activity without a matching QA event in this window."
        : "UI-shaped work appeared, but GStack timeline/artifact coverage is not high enough to claim QA was skipped. Treat this as a prompt to check the workflow, not a finding of failure.",
      ev,
      ["gstack.qa-after-ui-change"],
      features.coverage.timeline_coverage,
      canClaimSkipped ? "observed" : "potential"
    ));
    proposed_actions.push(action(
      "skill_suggestion",
      "Run /qa after UI-affecting changes",
      "For UI changes, add /qa before /ship when browser or rendered-state evidence is available.",
      ev,
      ["gstack.qa-after-ui-change"],
      "/qa"
    ));
  }

  if (features.gstackEvents.length === 0) {
    coverage_limits.push(finding(
      "coverage_limit",
      "No GStack artifacts were available",
      "The retro can inspect prompt behavior, but it cannot strongly judge missed GStack workflow leverage without timeline or artifact coverage.",
      sample(features.userPrompts, 1),
      ["gstack.operator-retro-boundary"],
      "low",
      "limited"
    ));
  }

  const guidance_ids = Array.from(new Set([
    ...operator_findings,
    ...best_runs,
    ...missed_gstack_leverage,
    ...coverage_limits
  ].flatMap((item) => item.guidance_ids).concat(proposed_actions.flatMap((item) => item.guidance_ids)))).sort();

  const one_line_read = features.userPrompts.length === 0
    ? "Not enough operator evidence was found for an operator retro."
    : operator_findings.length || missed_gstack_leverage.length
      ? "The main operator opportunity is to turn implementation requests into proof-bound, scope-bound workflows and use GStack resets when loops appear."
      : "The reviewed window shows usable operator discipline; keep pairing planning, proof, and explicit routing choices.";

  return {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    project,
    analysis_engine: "deterministic",
    one_line_read,
    operator_findings,
    best_runs,
    missed_gstack_leverage,
    proposed_actions,
    coverage_limits,
    guidance_ids,
    coverage: features.coverage,
    evidence_coverage: evidenceCoverage(events)
  };
}
