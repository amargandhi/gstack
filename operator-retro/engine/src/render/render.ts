import type { AiUsageEvent, AnalysisFinding, OperatorRetroAnalysis, OperatorRetroFinding, OperatorRetroReportJson, PrimaryAnalysis, ProposedAction, ReportJson, SecondOpinion, SourceLedger } from "../types";
import { guidanceMap, readGuidanceLedger, readSourceLedger, sourceMap } from "../guidance/ledger";

function cited(evidence: string[], sources: string[]): string {
  const ev = evidence.length ? `Evidence: ${evidence.map((id) => `\`${id}\``).join(", ")}` : "Evidence: none";
  const src = sources.length ? `Sources: ${sources.map((id) => `\`${id}\``).join(", ")}` : "Sources: coach_interpretation";
  return `${ev}. ${src}.`;
}

function listFindings(items: AnalysisFinding[], empty: string): string {
  if (items.length === 0) return `${empty}\n`;
  return items.map((item) => `- **${item.title}.** ${item.body}\n  ${cited(item.evidence_ids, item.source_ids)}`).join("\n");
}

function sourceLinks(ledger: SourceLedger, used: string[]): string {
  const usedSet = new Set(used);
  return ledger.sources
    .filter((source) => usedSet.has(source.id))
    .map((source) => `- \`${source.id}\` - [${source.title}](${source.url})`)
    .join("\n") || "- No source-backed recommendations were produced.";
}

export function buildPromptPack(events: AiUsageEvent[], options: { includeAssistantContext?: boolean } = {}): string {
  const lines = [
    "# AI Usage Review Prompt Pack",
    "",
    "This pack is redacted. Use evidence IDs when making claims.",
    options.includeAssistantContext
      ? "Assistant context is included because --include-assistant-context was set."
      : "Assistant prose is omitted by default; this review focuses on user prompts and tool/session metadata.",
    ""
  ];
  for (const event of events) {
    if (event.role === "assistant" && !options.includeAssistantContext) continue;
    if (event.role === "assistant" && !event.redacted_text) continue;
    const label = event.tool_name ? `${event.role}:${event.tool_name}` : event.role;
    lines.push(`## ${event.evidence_id} (${label})`);
    if (event.timestamp) lines.push(`Timestamp: ${event.timestamp}`);
    if (event.model) lines.push(`Model: ${event.model}`);
    if (event.reasoning_effort) lines.push(`Reasoning effort: ${event.reasoning_effort}`);
    if (event.redacted_text) lines.push("", event.redacted_text);
    if (event.tool_args_redacted !== undefined) lines.push("", "Tool args:", "```json", JSON.stringify(event.tool_args_redacted, null, 2), "```");
    lines.push("");
  }
  return lines.join("\n");
}

export function renderMarkdown(report: ReportJson): string {
  const analysis = report.analysis;
  const second = report.second_opinion;
  const ledger = readSourceLedger();
  const usedSources = Array.from(new Set([
    ...analysis.source_ids,
    ...second.source_ids
  ])).sort();
  const sourceLookup = sourceMap();

  const secondOpinion = second.status === "completed"
    ? [
      `**Other model used:** ${second.other_model_used || second.provider}`,
      "",
      `**Agreement:** ${second.agreement || "Not provided."}`,
      "",
      `**Disagreement:** ${second.disagreement || "Not provided."}`,
      "",
      `**Missed pattern:** ${second.missed_pattern || "Not provided."}`,
      "",
      `**Final adjustment:** ${second.final_adjustment || "Not provided."}`,
      "",
      cited(second.evidence_ids, second.source_ids)
    ].join("\n")
    : `Skipped or unavailable. Status: \`${second.status}\`.`;

  return [
    "# AI Usage Review",
    "",
    "## One-Line Read",
    analysis.one_line_read,
    "",
    "## What You Were Trying To Do",
    analysis.what_user_was_trying_to_do,
    "",
    "## What You Are Good At",
    listFindings(analysis.strengths, "No high-confidence strengths were visible from the available prompt evidence."),
    "",
    "## Patterns In How You Ask AI To Work",
    listFindings(analysis.prompt_patterns, "No recurring prompt pattern rose above the evidence threshold."),
    "",
    "## Where AI Was Underused",
    listFindings(analysis.underused_features, "No clear underused AI feature was visible from this evidence window."),
    "",
    "## Feature-Fit Coaching",
    listFindings(analysis.underused_features, "No feature-fit recommendations."),
    "",
    "## Second Opinion",
    secondOpinion,
    "",
    "## Teaching Notes",
    listFindings(analysis.teaching_notes, "No teaching notes were generated."),
    "",
    "## Better Next-Time Prompts",
    listFindings(analysis.better_next_time_prompts, "No prompt rewrites were generated."),
    "",
    "## Next Session Script",
    listFindings(analysis.next_session_script, "No next-session script was generated."),
    "",
    "## Source Links",
    sourceLinks(ledger, usedSources),
    "",
    "## Evidence Coverage",
    `- Total events: ${analysis.evidence_coverage.total_events}`,
    `- User prompts: ${analysis.evidence_coverage.user_prompts}`,
    `- Tool events: ${analysis.evidence_coverage.tool_events}`,
    `- Sessions: ${analysis.evidence_coverage.sessions}`,
    `- Sources: ${Object.entries(analysis.evidence_coverage.sources).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`,
    "",
    "## Limits Of This Review",
    analysis.limits.length ? analysis.limits.map((limit) => `- ${limit}`).join("\n") : "- No major coverage limitation was detected.",
    "",
    "<!-- source titles: " + usedSources.map((id) => `${id}:${sourceLookup.get(id)?.title || "unknown"}`).join(" | ") + " -->",
    ""
  ].join("\n");
}

function citeGuidance(evidence: string[], guidance: string[]): string {
  const ev = evidence.length ? `Evidence: ${evidence.map((id) => `\`${id}\``).join(", ")}` : "Evidence: none";
  const guide = guidance.length ? `Guidance: ${guidance.map((id) => `\`${id}\``).join(", ")}` : "Guidance: none";
  return `${ev}. ${guide}.`;
}

function listOperatorFindings(items: OperatorRetroFinding[], empty: string): string {
  if (items.length === 0) return `${empty}\n`;
  return items.map((item) => [
    `- **${item.title}.** ${item.body}`,
    `  ${citeGuidance(item.evidence_ids, item.guidance_ids)} Confidence: ${item.confidence}.`
  ].join("\n")).join("\n");
}

function listProposedActions(items: ProposedAction[], empty: string): string {
  if (items.length === 0) return `${empty}\n`;
  return items.map((item) => {
    const hint = item.command_hint ? ` Command: \`${item.command_hint}\`.` : "";
    return [
      `- **${item.title}.** ${item.body}${hint}`,
      `  Type: \`${item.type}\`; status: \`${item.status}\`. ${citeGuidance(item.evidence_ids, item.guidance_ids)}`
    ].join("\n");
  }).join("\n");
}

function guidanceLinks(used: string[]): string {
  const map = guidanceMap();
  return used.map((id) => {
    const item = map.get(id);
    if (!item) return `- \`${id}\` - missing guidance entry`;
    return `- \`${id}\` - ${item.claim} (${item.source_path_or_url})`;
  }).join("\n") || "- No guidance IDs were used.";
}

export function renderOperatorRetroMarkdown(report: OperatorRetroReportJson): string {
  const analysis: OperatorRetroAnalysis = report.analysis;
  return [
    "# Operator Retro",
    "",
    "## One-Line Read",
    analysis.one_line_read,
    "",
    "## Best Runs",
    listOperatorFindings(analysis.best_runs, "No high-confidence best-run pattern was visible in this window."),
    "",
    "## Operator Findings",
    listOperatorFindings(analysis.operator_findings, "No high-confidence operator issue was visible in this window."),
    "",
    "## Missed GStack Leverage",
    listOperatorFindings(analysis.missed_gstack_leverage, "No missed GStack leverage was visible from the available evidence."),
    "",
    "## Actions To Approve",
    listProposedActions(analysis.proposed_actions, "No durable action is proposed from this window."),
    "",
    "## Coverage",
    `- Timeline coverage: ${analysis.coverage.timeline_coverage}`,
    `- Artifact coverage: ${analysis.coverage.artifact_coverage}`,
    `- Can claim skipped gate: ${analysis.coverage.can_claim_skipped_gate}`,
    `- Analysis engine: ${analysis.analysis_engine}`,
    "",
    "## Coverage Limits",
    listOperatorFindings(analysis.coverage_limits, "No major coverage limits were detected."),
    "",
    "## Evidence Coverage",
    `- Total events: ${analysis.evidence_coverage.total_events}`,
    `- User prompts: ${analysis.evidence_coverage.user_prompts}`,
    `- Tool events: ${analysis.evidence_coverage.tool_events}`,
    `- Sessions: ${analysis.evidence_coverage.sessions}`,
    `- Sources: ${Object.entries(analysis.evidence_coverage.sources).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`,
    "",
    "## Guidance",
    guidanceLinks(analysis.guidance_ids),
    "",
    "<!-- guidance titles: " + readGuidanceLedger().guidance.filter((item) => analysis.guidance_ids.includes(item.id)).map((item) => `${item.id}:${item.claim}`).join(" | ") + " -->",
    ""
  ].join("\n");
}
