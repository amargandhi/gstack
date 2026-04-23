/**
 * Thinking/reasoning hint resolver.
 *
 * Given a skill name and a compiled model, emit a human-readable section
 * telling the agent which thinking effort to use for this skill on this model,
 * plus a short rationale.
 *
 * This is opt-in via the `{{THINKING_HINT}}` placeholder — templates that
 * include it get the section injected. Skills that don't opt in stay lean.
 *
 * Gating:
 *   - No model set → returns '' (user hasn't pinned to a specific family)
 *   - Generic 'claude' or 'gpt' model → returns '' (too vague to give useful guidance)
 *   - Safety skills (careful, freeze, guard, unfreeze, gstack-upgrade) → returns ''
 *     (no reasoning decision to make)
 *
 * The emitted section includes:
 *   - The recommended bucket (low/medium/high/max)
 *   - The model-specific API translation (Anthropic effort, OpenAI reasoning_effort)
 *   - A one-line rationale from thinking-profiles.ts
 *   - Optional upgrade/downgrade hints
 *   - The model-specific note from THINKING_CAPABILITIES
 */

import type { TemplateContext } from './types';
import type { Model } from '../models';
import { THINKING_CAPABILITIES, modelProvider } from '../models';
import { getThinkingProfile, type ThinkingBucket } from '../thinking-profiles';

const GENERIC_MODELS = new Set(['claude', 'gpt']);

/**
 * Map a semantic bucket to a provider-specific effort token.
 * Falls back to the closest match when the provider doesn't support the exact bucket.
 */
function bucketToEffort(bucket: ThinkingBucket, model: Model): string {
  const cap = THINKING_CAPABILITIES[model];
  if (!cap) return bucket;

  // Direct match first
  if (cap.efforts.includes(bucket)) return bucket;

  // Fallbacks — pick the closest supported effort
  if (bucket === 'max') {
    if (cap.efforts.includes('high')) return 'high';
    if (cap.efforts.includes('xhigh')) return 'xhigh';
    return cap.efforts[cap.efforts.length - 1] ?? 'high';
  }
  if (bucket === 'minimal') {
    if (cap.efforts.includes('none')) return 'none';
    if (cap.efforts.includes('low')) return 'low';
    return cap.efforts[0] ?? 'low';
  }
  if (bucket === 'high') {
    if (cap.efforts.includes('xhigh')) return 'high'; // don't over-escalate to xhigh
    return cap.efforts[cap.efforts.length - 1] ?? 'high';
  }
  return cap.defaultEffort;
}

/**
 * Build the API-syntax example for the current model.
 */
function apiSyntaxExample(model: Model, effort: string): string {
  const provider = modelProvider(model);
  const cap = THINKING_CAPABILITIES[model];
  if (!cap) return '';

  if (provider === 'anthropic') {
    if (cap.mode === 'adaptive-only' || cap.mode === 'adaptive-or-manual') {
      return `\`thinking: { type: "adaptive", effort: "${effort}" }\``;
    }
    if (cap.mode === 'manual-only') {
      const [lo, hi] = cap.manualBudgetRange ?? [4000, 16000];
      const budget = effort === 'high' || effort === 'max' ? hi : Math.round((lo + hi) / 2);
      return `\`thinking: { type: "enabled", budget_tokens: ${budget} }\``;
    }
  }

  if (provider === 'openai') {
    if (cap.mode === 'minimal') {
      return `(speed-first model — no reasoning_effort knob)`;
    }
    // Codex CLI convention: -c 'model_reasoning_effort="..."'
    // Responses API convention: reasoning: { effort: "..." }
    return `\`reasoning: { effort: "${effort}" }\` (or Codex CLI: \`-c 'model_reasoning_effort="${effort}"'\`)`;
  }

  return `(effort="${effort}" — refer to provider docs for exact syntax)`;
}

export function generateThinkingHint(ctx: TemplateContext): string {
  if (!ctx.model) return '';
  if (GENERIC_MODELS.has(ctx.model)) return '';

  const profile = getThinkingProfile(ctx.skillName);
  if (profile.kind === 'safety' || profile.kind === 'utility') {
    // Safety/utility skills are mechanical — no thinking decision to make.
    return '';
  }

  const cap = THINKING_CAPABILITIES[ctx.model];
  if (!cap) return '';

  const effort = bucketToEffort(profile.bucket, ctx.model);
  const apiSyntax = apiSyntaxExample(ctx.model, effort);

  const parts: string[] = [];
  parts.push(`## Thinking Mode for this Skill`);
  parts.push('');
  parts.push(
    `**Recommended:** \`${effort}\` effort on \`${ctx.model}\` — ${apiSyntax}`
  );
  parts.push('');
  parts.push(`**Why:** ${profile.rationale}`);

  // Cost/quality adjustments
  const adjustments: string[] = [];
  if (profile.upgradeTo) {
    const upEffort = bucketToEffort(profile.upgradeTo, ctx.model);
    if (upEffort !== effort) {
      adjustments.push(
        `If the user wants more thoroughness (and is OK with the extra tokens), bump to \`${upEffort}\`.`
      );
    }
  }
  if (profile.downgradeTo) {
    const downEffort = bucketToEffort(profile.downgradeTo, ctx.model);
    if (downEffort !== effort) {
      adjustments.push(
        `If the user is latency-sensitive or the task is clearly mechanical, drop to \`${downEffort}\`.`
      );
    }
  }
  if (adjustments.length > 0) {
    parts.push('');
    parts.push(adjustments.join(' '));
  }

  // Model-specific note
  if (cap.note) {
    parts.push('');
    parts.push(`**Model note:** ${cap.note}`);
  }

  // Provider-specific caveats
  if (cap.mode === 'minimal') {
    parts.push('');
    parts.push(
      `**Heads up:** Spark is optimized for speed, not deliberation. If this skill needs real reasoning (multi-step planning, root-cause investigation, architectural review), escalate to \`gpt-5.3-codex\` or \`gpt-5.4\` before starting.`
    );
  }
  if (cap.mode === 'adaptive-only') {
    parts.push('');
    parts.push(
      `**Heads up:** This model rejects manual thinking mode (HTTP 400). Use adaptive effort only.`
    );
  }

  return parts.join('\n');
}
