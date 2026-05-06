/**
 * Preamble composition root.
 *
 * Each generator lives in its own file under ./preamble/*.ts. This file only
 * wires them together via generatePreamble(). Keep composition declarative —
 * no inline logic beyond tier gating.
 *
 * Each skill runs independently via `claude -p` (or the host's equivalent).
 * There is no shared loader. The preamble provides: update checks, session
 * tracking, user preferences, repo mode detection, model overlays, and
 * telemetry.
 *
 * Telemetry data flow:
 *   1. Always: local JSONL append to ~/.gstack/analytics/ (inline, inspectable)
 *   2. If _TEL != "off" AND binary exists: gstack-telemetry-log for remote reporting
 */


import type { TemplateContext } from './types';
import { generateModelOverlay } from './model-overlay';
import { generateQuestionTuning } from './question-tuning';

// Core bootstrap
import { generatePreambleBash } from './preamble/generate-preamble-bash';
import { generateUpgradeCheck } from './preamble/generate-upgrade-check';
import {
  generateCompletionStatus,
  generatePlanModeInfo,
} from './preamble/generate-completion-status';

// One-time onboarding prompts
import { generateLakeIntro } from './preamble/generate-lake-intro';
import { generateTelemetryPrompt } from './preamble/generate-telemetry-prompt';
import { generateProactivePrompt } from './preamble/generate-proactive-prompt';
import { generateRoutingInjection } from './preamble/generate-routing-injection';
import { generateVendoringDeprecation } from './preamble/generate-vendoring-deprecation';
import { generateSpawnedSessionCheck } from './preamble/generate-spawned-session-check';
import { generateWritingStyleMigration } from './preamble/generate-writing-style-migration';

// Host-specific instructions
import { generateBrainHealthInstruction } from './preamble/generate-brain-health-instruction';

// GBrain cross-machine sync (runs at skill start; end-side handled in completion-status)
import { generateBrainSyncBlock } from './preamble/generate-brain-sync-block';

// Behavioral / voice
import { generateVoiceDirective } from './preamble/generate-voice-directive';

// Tier 2+ context and interaction framework
import { generateContextRecovery } from './preamble/generate-context-recovery';
import { generateAskUserFormat } from './preamble/generate-ask-user-format';
import { generateWritingStyle } from './preamble/generate-writing-style';
import { generateCompletenessSection } from './preamble/generate-completeness-section';
import { generateConfusionProtocol } from './preamble/generate-confusion-protocol';
import { generateContinuousCheckpoint } from './preamble/generate-continuous-checkpoint';
import { generateContextHealth } from './preamble/generate-context-health';

// Tier 3+ repo mode + search
import { generateRepoModeSection } from './preamble/generate-repo-mode-section';
import { generateSearchBeforeBuildingSection } from './preamble/generate-search-before-building';

// Standalone export used directly by the resolver registry
export { generateTestFailureTriage } from './preamble/generate-test-failure-triage';

function generateClaudeCodeHints(ctx: TemplateContext): string {
  // Claude Code-specific session management guidance.
  // Gated on host=claude so other hosts (codex, factory, kiro, etc.) are unaffected.
  // Gated on tier >= 2 so safety/utility skills (careful, freeze, guard, unfreeze,
  // setup-cookies, gstack-upgrade, browse, benchmark) stay lean.
  if (ctx.host !== 'claude') return '';
  const tier = ctx.preambleTier ?? 4;
  if (tier < 2) return '';
  return `## Claude Code Session Management

You're running inside Claude Code with up to 1M tokens of context. Use it deliberately:

- **New task, no shared context** → \`/clear\` (you control what carries forward).
- **Same task, wrong approach taken** → \`/rewind\` (or double-tap Esc). Drops failed attempts but keeps file reads, then re-prompt with the lesson learned ("don't use approach A, the foo module doesn't expose that — go straight to B").
- **Mid-task, context bloated with old debugging** → \`/compact <hint>\` (e.g. \`/compact focus on the auth refactor, drop test debugging\`). Steer the summarizer rather than letting auto-compaction guess.
- **Next step generates voluminous output** (codebase recon, large file scan, verification pass, parallel design variants) → spawn a subagent via the Agent tool. The child's intermediate output stays in its context; only the conclusion returns to yours. Mental model: *will I need this tool output again, or just the conclusion?*
- **Approaching context limit** → run \`${ctx.paths.binDir}/gstack-detect-context-pressure\` for guidance, or \`/compact\` proactively before auto-compaction kicks in.

After \`/compact\` or \`/clear\`, the Context Recovery block above re-reads recent checkpoints, timeline events, and learnings — so resuming is cheap.`;
}

function generateSubagentHint(ctx: TemplateContext): string {
  // Per-skill subagent encouragement. Templates opt in by including {{SUBAGENT_HINT}}.
  // Gated on host=claude — other hosts have different agent semantics.
  if (ctx.host !== 'claude') return '';
  const recommendations: Record<string, string> = {
    investigate: 'For root-cause investigation across an unfamiliar codebase, spawn an `explorer` subagent (`.claude/agents/explorer.md`) to map the call graph and return only the suspect files. Keeps your parent context clean for the actual fix.',
    review: 'For diffs > 500 lines or touching > 5 files, spawn parallel subagents: `security-reviewer`, `adversarial-reviewer`, and `explorer` (for unfamiliar areas of the codebase). Aggregate findings in the parent context.',
    qa: 'QA produces voluminous browser output (snapshots, console logs, network traces). Spawn a subagent per test scenario; only the pass/fail + repro steps return to parent.',
    health: 'Health checks read across the whole repo. Spawn an `explorer` subagent to compute metrics; the score + 3 worst offenders return to parent.',
    cso: 'Already uses subagents for finding verification. For new audit categories, spawn a `verifier` subagent per finding to confirm the issue is real before reporting.',
  };
  const hint = recommendations[ctx.skillName];
  if (!hint) return '';
  return `## Use Subagents Here

${hint}

Available agents in \`.claude/agents/\`: \`explorer\`, \`verifier\`, \`security-reviewer\`, \`adversarial-reviewer\`. Spawn via the Agent tool and aggregate results in the parent context.`;
}

export function generateSubagentHintResolver(ctx: TemplateContext): string {
  return generateSubagentHint(ctx);
}

// Preamble Composition (tier → sections)
// ─────────────────────────────────────────────
// T1: core + upgrade + lake + telemetry + voice(trimmed) + completion
// T2: T1 + voice(full) + ask + writing-style + completeness + context-recovery
//     + confusion + checkpoint + context-health + question-tuning + claude-code-hints (claude only)
// T3: T2 + repo-mode + search
// T4: (same as T3 — TEST_FAILURE_TRIAGE is a separate {{}} placeholder, not preamble)
//
// Skills by tier:
//   T1: browse, setup-cookies, benchmark
//   T2: investigate, cso, retro, doc-release, setup-deploy, canary, context-save, context-restore, health
//   T3: autoplan, codex, design-consult, office-hours, ceo/design/eng-review
//   T4: ship, review, qa, qa-only, design-review, land-deploy
export function generatePreamble(ctx: TemplateContext): string {
  const tier = ctx.preambleTier ?? 4;
  if (tier < 1 || tier > 4) {
    throw new Error(`Invalid preamble-tier: ${tier} in ${ctx.tmplPath}. Must be 1-4.`);
  }
  const cacheAnchorStart = ctx.host === 'claude' ? '<!-- gstack:cache-anchor:start -->' : '';
  const cacheAnchorEnd = ctx.host === 'claude' ? '<!-- gstack:cache-anchor:end -->' : '';
  const sections = [
    generatePreambleBash(ctx),
    // Plan-mode-skill semantics at position 1: after bash (so _SESSION_ID /
    // _BRANCH / _TEL env vars are live) and before all onboarding gates so
    // models read the authoritative "AskUserQuestion satisfies plan mode's
    // end-of-turn" rule before any other instruction. Renders for all skills
    // (not interactive-gated); the text applies universally.
    generatePlanModeInfo(ctx),
    generateUpgradeCheck(ctx),
    generateWritingStyleMigration(ctx),
    generateLakeIntro(),
    generateTelemetryPrompt(ctx),
    generateProactivePrompt(ctx),
    generateRoutingInjection(ctx),
    generateVendoringDeprecation(ctx),
    generateSpawnedSessionCheck(),
    generateBrainHealthInstruction(ctx),
    cacheAnchorStart,
    // AskUserQuestion Format renders BEFORE the model overlay so the pacing rule
    // is the ambient default; the overlay's behavioral nudges land as subordinate
    // patches. Opus 4.7 reads top-to-bottom and absorbs the first pacing directive
    // it hits; reversing this order regresses plan-review cadence (v1.6.4.0 bug).
    ...(tier >= 2 ? [generateAskUserFormat(ctx)] : []),
    generateBrainSyncBlock(ctx),
    generateModelOverlay(ctx),
    generateVoiceDirective(tier),
    ...(tier >= 2 ? [
      generateContextRecovery(ctx),
      generateClaudeCodeHints(ctx),
      generateWritingStyle(ctx),
      generateCompletenessSection(),
      generateConfusionProtocol(),
      generateContinuousCheckpoint(),
      generateContextHealth(),
      generateQuestionTuning(ctx),
    ] : []),
    ...(tier >= 3 ? [generateRepoModeSection(), generateSearchBeforeBuildingSection(ctx)] : []),
    cacheAnchorEnd,
    generateCompletionStatus(ctx),
  ];
  // Drop empty sections (from host-gated generators that return '') to avoid trailing whitespace gaps.
  return sections.filter(s => s && s.trim().length > 0).join('\n\n');
}
