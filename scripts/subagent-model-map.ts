/**
 * Subagent model map — single source of truth for .claude/agents/*.md models.
 *
 * Claude Code's agent frontmatter `model:` field accepts aliases (`sonnet`,
 * `haiku`, `opus`) that map to the provider's current default for that tier.
 * This file uses the same aliases so the mapping is direct — no impedance
 * mismatch with the agent frontmatter.
 *
 * When we need a SPECIFIC model version (e.g., pin to opus-4-6 not opus-4-7),
 * the `explicitVersion` field captures that intent. Setting it doesn't change
 * runtime behavior (Claude Code follows the alias), but it documents the
 * intent for when Claude Code adds specific-version pinning.
 *
 * Used by:
 *   - test/subagent-model-pinning.test.ts  (drift guard against frontmatter)
 *   - scripts/resolvers/preamble.ts        (generateSubagentHint cites tiers)
 *   - bin/gstack-model-guide               (optional: show subagent map)
 */

export type ModelAlias = 'haiku' | 'sonnet' | 'opus';

export interface SubagentPin {
  alias: ModelAlias;
  explicitVersion?: string; // e.g. 'claude-sonnet-4-6' — documentation only
  rationale: string;
}

export const SUBAGENT_MODEL_MAP: Record<string, SubagentPin> = {
  explorer: {
    alias: 'haiku',
    explicitVersion: 'claude-haiku-4-5',
    rationale:
      'First-pass recon — follow imports, grep, synthesize a 200-500 word map. ' +
      'Narrow "map, don\'t fix" job; Haiku is cost-optimal here. Upgrade to ' +
      'sonnet if it misses structural hints on real codebases.',
  },
  verifier: {
    alias: 'sonnet',
    explicitVersion: 'claude-sonnet-4-6',
    rationale:
      'Fresh-eyes spec check. Needs to catch silent deviations + edge cases. ' +
      'Sonnet 4.6 adaptive thinking engages when verification surface is non-trivial.',
  },
  'security-reviewer': {
    alias: 'sonnet',
    explicitVersion: 'claude-sonnet-4-6',
    rationale:
      'Security review. Sonnet 4.6 adaptive thinking is the safer default than ' +
      'Opus 4.7 until we have data showing Opus catches things Sonnet misses. ' +
      'Opt-in upgrade per-repo if quality gap shows up in practice.',
  },
  'adversarial-reviewer': {
    alias: 'sonnet',
    explicitVersion: 'claude-sonnet-4-6',
    rationale:
      'Adversarial review — edge cases, race conditions, logic inversions. ' +
      'Sonnet 4.6 is adversarial-capable with adaptive effort. Same rationale ' +
      'as security-reviewer: safer default, upgrade path open.',
  },
};

export function getSubagentPin(name: string): SubagentPin | null {
  return SUBAGENT_MODEL_MAP[name] ?? null;
}

// ─── Orchestration phase recommendations (B3) ─────────────────
//
// These are per-phase model recommendations for multi-phase workflows like
// /autoplan. They do NOT pin the Agent tool directly (that uses the
// subagent_type frontmatter above) — instead they inform the autoplan prose
// so the agent knows which model is optimal for each phase and can
// recommend switching before starting or delegate to codex for that phase.

export interface OrchestrationPhase {
  phase: string;
  suggestAnthropic: string;   // claude model family recommendation
  suggestOpenAI: string;      // gpt/codex family recommendation
  rationale: string;
}

export const ORCHESTRATION_PHASES: OrchestrationPhase[] = [
  {
    phase: 'autoplan.ceo',
    suggestAnthropic: 'opus-4-7',
    suggestOpenAI: 'gpt-5.3-codex',
    rationale: 'CEO/strategy review — max effort pays off. Novel problems, scope trade-offs, 10x reframings.',
  },
  {
    phase: 'autoplan.eng',
    suggestAnthropic: 'opus-4-6',
    suggestOpenAI: 'gpt-5.3-codex',
    rationale: 'Eng architecture review — coding-specialized models shine here. 5.3-codex with xhigh catches real issues.',
  },
  {
    phase: 'autoplan.design',
    suggestAnthropic: 'sonnet-4-6',
    suggestOpenAI: 'gpt-5.4',
    rationale: 'Design review has clear rubrics — Sonnet 4.6 adaptive is cost-effective.',
  },
  {
    phase: 'autoplan.devex',
    suggestAnthropic: 'sonnet-4-6',
    suggestOpenAI: 'gpt-5.4',
    rationale: 'DevEx review — judgment over depth. Sonnet 4.6 or GPT-5.4 at medium effort is plenty.',
  },
  {
    phase: 'ship.review',
    suggestAnthropic: 'sonnet-4-6',
    suggestOpenAI: 'gpt-5.3-codex',
    rationale: 'Pre-landing review — structural issues. Sonnet catches them; Codex is specialized for code review.',
  },
];

