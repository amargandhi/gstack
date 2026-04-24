/**
 * Per-skill thinking/reasoning recommendations.
 *
 * Maps skill name → "how much deliberation this skill benefits from."
 * Used by scripts/resolvers/thinking-hint.ts to emit model-appropriate guidance
 * into generated SKILL.md files.
 *
 * The semantic buckets below are provider-agnostic. The resolver translates
 * them to Anthropic adaptive `effort=...` or OpenAI `reasoning_effort=...`
 * using the THINKING_CAPABILITIES table in models.ts.
 *
 * Buckets (in increasing order of deliberation):
 *   - 'minimal'  — mechanical execution, status reporting, workflow plumbing
 *   - 'low'      — straightforward work with predictable outcomes
 *   - 'medium'   — mixed analysis + execution, the default for coding work
 *   - 'high'     — root-cause analysis, architecture, security review
 *   - 'max'      — novel architecture, strategic decisions, research-grade analysis
 *
 * A skill-type marker (`execution` vs `analysis` vs `strategy`) also informs
 * the output text so users understand the reasoning.
 */

export type ThinkingBucket = 'minimal' | 'low' | 'medium' | 'high' | 'max';
export type SkillKind = 'execution' | 'analysis' | 'strategy' | 'safety' | 'utility';

export interface ThinkingProfile {
  bucket: ThinkingBucket;
  kind: SkillKind;
  /** One-line rationale shown to the user. */
  rationale: string;
  /** If the user wants to trade cost for quality, bump to this. */
  upgradeTo?: ThinkingBucket;
  /** If the user wants to trade quality for speed, downgrade to this. */
  downgradeTo?: ThinkingBucket;
}

export const THINKING_PROFILES: Record<string, ThinkingProfile> = {
  // ─── Strategy / deep analysis (high or max) ──────────────────
  'plan-ceo-review': {
    bucket: 'high',
    kind: 'strategy',
    rationale: 'Reviews plans at the product/strategy layer. Novel problems, scope decisions, trade-offs.',
    upgradeTo: 'max',
  },
  'plan-eng-review': {
    bucket: 'high',
    kind: 'strategy',
    rationale: 'Architecture-level review. Data flow, edge cases, performance characteristics.',
    upgradeTo: 'max',
  },
  'plan-design-review': {
    bucket: 'high',
    kind: 'analysis',
    rationale: 'Design critique requires seeing what is missing, not just what is present.',
  },
  'plan-devex-review': {
    bucket: 'high',
    kind: 'analysis',
    rationale: 'Developer-experience review needs holistic judgment about workflows.',
  },
  'office-hours': {
    bucket: 'high',
    kind: 'strategy',
    rationale: 'YC-style problem framing. The questions are easy; the answers require depth.',
    upgradeTo: 'max',
  },
  investigate: {
    bucket: 'high',
    kind: 'analysis',
    rationale: 'Root-cause debugging. Shortcuts produce symptom-fixes, which create whack-a-mole bugs.',
    downgradeTo: 'medium',
  },
  cso: {
    bucket: 'high',
    kind: 'analysis',
    rationale: 'Security audit. Missing a threat is worse than overthinking. Use high or above.',
    upgradeTo: 'max',
  },
  review: {
    bucket: 'high',
    kind: 'analysis',
    rationale: 'Pre-landing code review. Finds structural issues tests miss. High effort catches more.',
    downgradeTo: 'medium',
  },
  'devex-review': {
    bucket: 'medium',
    kind: 'analysis',
    rationale: 'DX review has clear rubrics; medium is enough for most cases.',
    upgradeTo: 'high',
  },
  'design-review': {
    bucket: 'medium',
    kind: 'analysis',
    rationale: 'Visual audit against a rubric. Higher effort rarely pays off for deterministic checks.',
  },
  'design-consultation': {
    bucket: 'high',
    kind: 'strategy',
    rationale: 'Proposing a design system from scratch. Aesthetic judgment at stake.',
  },
  'design-html': {
    bucket: 'medium',
    kind: 'execution',
    rationale: 'Translating approved mockups to HTML. Structured output, moderate deliberation.',
  },
  'design-shotgun': {
    bucket: 'medium',
    kind: 'analysis',
    rationale: 'Generating N variants in parallel. Each variant is medium; orchestration is low.',
  },
  autoplan: {
    bucket: 'high',
    kind: 'strategy',
    rationale: 'Orchestrates CEO + Eng + Design + DX reviews. Decision-heavy at the orchestration layer.',
    upgradeTo: 'max',
  },
  codex: {
    bucket: 'high',
    kind: 'analysis',
    rationale: 'Cross-model second opinion. Uses the other model at high/xhigh effort explicitly.',
  },

  // ─── Mixed (medium) ─────────────────────────────────────────
  qa: {
    bucket: 'medium',
    kind: 'execution',
    rationale: 'QA testing is mostly mechanical, but triage and fix classification need real thinking.',
    downgradeTo: 'low',
  },
  'qa-only': {
    bucket: 'low',
    kind: 'execution',
    rationale: 'Report-only QA. Detection over deliberation.',
  },
  ship: {
    bucket: 'medium',
    kind: 'execution',
    rationale: 'Ship pipeline has a lot of steps but each is mechanical. Medium catches surprises.',
    downgradeTo: 'low',
  },
  'land-and-deploy': {
    bucket: 'medium',
    kind: 'execution',
    rationale: 'Merge + deploy + canary. Needs judgment for canary interpretation only.',
  },
  retro: {
    bucket: 'medium',
    kind: 'analysis',
    rationale: 'Retrospective analysis. Pattern recognition across commits.',
  },
  'context-save': {
    bucket: 'medium',
    kind: 'utility',
    rationale: 'Deciding what matters from a session. Too low drops key decisions.',
    downgradeTo: 'low',
  },
  'context-restore': {
    bucket: 'low',
    kind: 'utility',
    rationale: 'Loading saved state. Mechanical.',
  },
  'document-release': {
    bucket: 'medium',
    kind: 'execution',
    rationale: 'Post-ship doc reconciliation. Cross-referencing diff against README/ARCHITECTURE.',
  },
  glossary: {
    bucket: 'medium',
    kind: 'analysis',
    rationale: 'Mapping bounded contexts + naming language seams is synthesis, not mechanical catalog.',
    downgradeTo: 'low',
  },
  health: {
    bucket: 'medium',
    kind: 'analysis',
    rationale: 'Wraps existing tools. Scoring + trend analysis need judgment, not deep reasoning.',
    downgradeTo: 'low',
  },
  canary: {
    bucket: 'medium',
    kind: 'execution',
    rationale: 'Post-deploy monitoring. Interpretation of anomalies is the hard part.',
  },
  benchmark: {
    bucket: 'medium',
    kind: 'execution',
    rationale: 'Performance regression detection. Interpretation of deltas matters.',
  },

  // ─── Execution-heavy (low) ─────────────────────────────────
  browse: {
    bucket: 'low',
    kind: 'execution',
    rationale: 'Direct browser commands. No deliberation needed.',
  },
  'open-gstack-browser': {
    bucket: 'minimal',
    kind: 'utility',
    rationale: 'Launches a browser window. One-shot.',
  },
  'connect-chrome': {
    bucket: 'minimal',
    kind: 'utility',
    rationale: 'Connection helper. Mechanical.',
  },
  'setup-browser-cookies': {
    bucket: 'low',
    kind: 'utility',
    rationale: 'Interactive cookie picker. Thin harness around a CLI.',
  },
  'setup-deploy': {
    bucket: 'low',
    kind: 'utility',
    rationale: 'One-time deploy config detection + file writes.',
  },
  'pair-agent': {
    bucket: 'low',
    kind: 'utility',
    rationale: 'Connection harness. All the heavy lifting is in the remote agent.',
  },
  'make-pdf': {
    bucket: 'low',
    kind: 'execution',
    rationale: 'Markdown to PDF conversion. Layout decisions are deterministic.',
  },
  learn: {
    bucket: 'low',
    kind: 'utility',
    rationale: 'Learnings management — list, search, prune. Mechanical.',
  },

  // ─── Safety / guardrails (minimal) ─────────────────────────
  careful: {
    bucket: 'minimal',
    kind: 'safety',
    rationale: 'Registers a PreToolUse hook. Pure guardrail, no deliberation.',
  },
  freeze: {
    bucket: 'minimal',
    kind: 'safety',
    rationale: 'Writes a freeze-dir.txt. One file write.',
  },
  unfreeze: {
    bucket: 'minimal',
    kind: 'safety',
    rationale: 'Removes freeze-dir.txt.',
  },
  guard: {
    bucket: 'minimal',
    kind: 'safety',
    rationale: 'Combines freeze + careful. Thin wrapper.',
  },
  'gstack-upgrade': {
    bucket: 'minimal',
    kind: 'utility',
    rationale: 'Upgrade harness. Pure git + setup call.',
  },
};

/**
 * Default profile for any skill not explicitly listed.
 * Conservative: medium effort, execution kind.
 */
export const DEFAULT_PROFILE: ThinkingProfile = {
  bucket: 'medium',
  kind: 'execution',
  rationale: 'Default — no explicit profile registered for this skill.',
};

export function getThinkingProfile(skillName: string): ThinkingProfile {
  return THINKING_PROFILES[skillName] ?? DEFAULT_PROFILE;
}
