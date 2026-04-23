/**
 * Model pricing — USD per 1M tokens (April 2026).
 *
 * Best-effort snapshot. Refresh quarterly. Used by bin/gstack-cost-report
 * to estimate per-skill per-model spend from timeline data. Accuracy goal:
 * trend detection, not billing reconciliation.
 *
 * Sources:
 *   - Anthropic: claude.com/pricing
 *   - OpenAI:    openai.com/api/pricing
 */
import type { Model } from './models';

export interface ModelPrice {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens (thinking tokens billed at output rate on Claude 4+) */
  output: number;
  /** Optional: per-1M cached-read input tokens (Anthropic prompt caching) */
  cachedRead?: number;
  /** Provider label for reporting */
  provider: 'anthropic' | 'openai' | 'google' | 'unknown';
  /** Pricing snapshot date (YYYY-MM) */
  asOf: string;
}

export const MODEL_PRICING: Partial<Record<Model, ModelPrice>> = {
  // ─── Anthropic (Apr 2026 pricing) ─────────────────────────
  claude: {
    input: 3.0,
    output: 15.0,
    cachedRead: 0.3,
    provider: 'anthropic',
    asOf: '2026-04',
  },
  'sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cachedRead: 0.3,
    provider: 'anthropic',
    asOf: '2026-04',
  },
  'sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    cachedRead: 0.3,
    provider: 'anthropic',
    asOf: '2026-04',
  },
  'opus-4-5': {
    input: 15.0,
    output: 75.0,
    cachedRead: 1.5,
    provider: 'anthropic',
    asOf: '2026-04',
  },
  'opus-4-6': {
    input: 5.0,
    output: 25.0,
    cachedRead: 0.5,
    provider: 'anthropic',
    asOf: '2026-04',
  },
  'opus-4-7': {
    input: 5.0,
    output: 25.0,
    cachedRead: 0.5,
    provider: 'anthropic',
    asOf: '2026-04',
  },

  // ─── OpenAI (Apr 2026 pricing — approximate) ────────────
  gpt: {
    input: 2.5,
    output: 10.0,
    provider: 'openai',
    asOf: '2026-04',
  },
  'gpt-5.4': {
    input: 2.5,
    output: 10.0,
    provider: 'openai',
    asOf: '2026-04',
  },
  'gpt-5.4-mini': {
    input: 0.5,
    output: 2.0,
    provider: 'openai',
    asOf: '2026-04',
  },
  'gpt-5.2': {
    input: 2.0,
    output: 8.0,
    provider: 'openai',
    asOf: '2026-04',
  },
  'gpt-5.2-codex': {
    input: 2.0,
    output: 8.0,
    provider: 'openai',
    asOf: '2026-04',
  },
  'gpt-5.3-codex': {
    input: 3.0,
    output: 12.0,
    provider: 'openai',
    asOf: '2026-04',
  },
  'gpt-5.3-codex-spark': {
    // Research preview; pricing TBD. Using a reasonable estimate.
    input: 0.5,
    output: 2.0,
    provider: 'openai',
    asOf: '2026-04',
  },

  gemini: {
    input: 1.25,
    output: 5.0,
    provider: 'google',
    asOf: '2026-04',
  },
  'o-series': {
    input: 15.0,
    output: 60.0,
    provider: 'openai',
    asOf: '2026-04',
  },
};

export function getPricing(model: string): ModelPrice | null {
  return (MODEL_PRICING as Record<string, ModelPrice>)[model] ?? null;
}

/**
 * Estimate USD for a (model, input_tokens, output_tokens) tuple.
 * Returns null if model unknown.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedReadTokens: number = 0
): number | null {
  const p = getPricing(model);
  if (!p) return null;
  const inputCost = ((inputTokens - cachedReadTokens) / 1_000_000) * p.input;
  const cachedCost = (p.cachedRead ?? p.input) * (cachedReadTokens / 1_000_000);
  const outputCost = (outputTokens / 1_000_000) * p.output;
  return inputCost + cachedCost + outputCost;
}
