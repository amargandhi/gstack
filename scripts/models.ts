/**
 * Model taxonomy — neutral module with no imports from hosts/ or resolvers/.
 *
 * Model families supported by model overlays in model-overlays/{family}.md.
 * Host configs can reference these as `defaultModel` strings (validated at
 * generation time), but the model axis is independent of the host axis.
 *
 * IMPORTANT: host ≠ model. Claude Code can run any Claude model (Opus, Sonnet,
 * Haiku, future). Codex CLI runs GPT/o-series models. Cursor and OpenCode can
 * front multiple providers. We do NOT auto-detect the model from the host —
 * users pass --model explicitly. Default is 'claude'.
 *
 * ─── Supported models (Apr 2026) ─────────────────────────────────────
 *
 * Claude side (via Claude Code, Cursor, OpenCode, etc.):
 *   claude           — Generic Claude base overlay (fallback when nothing specific matches)
 *   sonnet-4-5       — Manual extended thinking only (budget_tokens); Feb 2025 release
 *   sonnet-4-6       — Adaptive thinking (effort=low/medium/high); supersedes 4.5
 *   opus-4-5         — Manual extended thinking only; Mar 2025 release
 *   opus-4-6         — Adaptive thinking (effort=low/medium/high/max); 128k output
 *   opus-4-7         — Adaptive thinking ONLY (manual mode returns 400); interleaved auto
 *
 * Codex side (via Codex CLI, Cursor, OpenCode, etc.):
 *   gpt              — Generic GPT base overlay
 *   gpt-5.5          — Flagship coding + agent model (Apr 2026). reasoning_effort=low/medium/high/xhigh.
 *                      NOTE: released as `gpt-5.5`, NOT `gpt-5.5-codex`. OpenAI collapsed the naming —
 *                      one model ID sits at the top of both ChatGPT and Codex CLI. Defensively
 *                      accept `gpt-5.5-codex*` inputs as aliases to `gpt-5.5`.
 *   gpt-5.4          — Previous flagship; reasoning_effort=minimal/low/medium/high
 *   gpt-5.4-mini     — Efficient; same effort scale, smaller/faster, good for subagents
 *   gpt-5.2          — Previous gen; reasoning_effort=none/low/medium/high
 *   gpt-5.2-codex    — Coding-specialized 5.2 variant
 *   gpt-5.3-codex    — Still available. reasoning_effort=low/medium/high/xhigh. NOT superseded.
 *   gpt-5.3-codex-spark — Research preview, real-time iteration (~1000+ tokens/s on Cerebras).
 *                         NOT superseded by 5.5 — no Cerebras variant shipped for 5.5.
 *
 * Other:
 *   o-series         — o3, o4, o4-mini (non-Codex reasoning models)
 *   gemini           — Gemini 2.5 Pro, Flash, etc.
 */

export const ALL_MODEL_NAMES = [
  'claude',
  'sonnet-4-5',
  'sonnet-4-6',
  'opus-4-5',
  'opus-4-6',
  'opus-4-7',
  'gpt',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gemini',
  'o-series',
] as const;

export type Model = (typeof ALL_MODEL_NAMES)[number];

/**
 * Resolve a model argument from CLI input to a known Model family.
 *
 * Precedence rules:
 * 1. Exact match against ALL_MODEL_NAMES → return as-is.
 * 2. Family heuristics for common variants:
 *    - `claude-sonnet-4-5-*` → `sonnet-4-5`
 *    - `claude-sonnet-4-6-*` → `sonnet-4-6`
 *    - `claude-opus-4-5-*` → `opus-4-5`
 *    - `claude-opus-4-6-*` → `opus-4-6`
 *    - `claude-opus-4-7-*` → `opus-4-7`
 *    - `claude-*` (anything else Claude) → `claude`
 *    - `gpt-5.3-codex-spark*` → `gpt-5.3-codex-spark`
 *    - `gpt-5.3-codex*` → `gpt-5.3-codex`
 *    - `gpt-5.2-codex*` → `gpt-5.2-codex`
 *    - `gpt-5.5-codex*` → `gpt-5.5` (defensive — no such ID exists at OpenAI, but users will type it)
 *    - `gpt-5.5*` → `gpt-5.5`
 *    - `gpt-5.4-mini*` → `gpt-5.4-mini`
 *    - `gpt-5.4*` → `gpt-5.4`
 *    - `gpt-5.2*` → `gpt-5.2`
 *    - `gpt-*` (anything else GPT) → `gpt`
 *    - `o3`, `o4`, `o4-mini`, `o1`, `o1-mini`, `o1-pro` → `o-series`
 *    - `gemini-*` (2.5-pro, flash, etc.) → `gemini`
 * 3. Unknown input → returns null (caller decides: error, or fall back).
 *
 * Check longer-prefix variants BEFORE shorter ones (e.g. spark before codex,
 * codex before 5.3, mini before 5.4 base).
 */
export function resolveModel(input: string): Model | null {
  const s = input.trim();
  if (!s) return null;

  // Exact match first
  if ((ALL_MODEL_NAMES as readonly string[]).includes(s)) {
    return s as Model;
  }

  // Claude family heuristics (longer-prefix first)
  if (/^claude-sonnet-4-5(-|$)/.test(s)) return 'sonnet-4-5';
  if (/^claude-sonnet-4-6(-|$)/.test(s)) return 'sonnet-4-6';
  if (/^claude-opus-4-5(-|$)/.test(s)) return 'opus-4-5';
  if (/^claude-opus-4-6(-|$)/.test(s)) return 'opus-4-6';
  if (/^claude-opus-4-7(-|$)/.test(s)) return 'opus-4-7';
  if (/^claude(-|$)/.test(s)) return 'claude';

  // GPT/Codex family heuristics (longer-prefix first — spark > codex > mini > 5.5/5.4/5.2)
  if (/^gpt-5\.3-codex-spark(-|$)/.test(s)) return 'gpt-5.3-codex-spark';
  if (/^gpt-5\.3-codex(-|$)/.test(s)) return 'gpt-5.3-codex';
  if (/^gpt-5\.2-codex(-|$)/.test(s)) return 'gpt-5.2-codex';
  // Defensive: `gpt-5.5-codex*` is not a real OpenAI ID, but users will type it because
  // 5.5 is what Codex CLI defaults to. Map to `gpt-5.5` rather than rejecting.
  if (/^gpt-5\.5-codex(-|$)/.test(s)) return 'gpt-5.5';
  if (/^gpt-5\.5(-|$)/.test(s)) return 'gpt-5.5';
  if (/^gpt-5\.4-mini(-|$)/.test(s)) return 'gpt-5.4-mini';
  if (/^gpt-5\.4(-|$)/.test(s)) return 'gpt-5.4';
  if (/^gpt-5\.2(-|$)/.test(s)) return 'gpt-5.2';
  if (/^gpt(-|$)/.test(s)) return 'gpt';

  // o-series / gemini
  if (/^o[0-9]+(-|$)/.test(s)) return 'o-series';
  if (/^gemini(-|$)/.test(s)) return 'gemini';

  return null;
}

/**
 * Validate a string against ALL_MODEL_NAMES. Used by host-config validators
 * when a HostConfig declares `defaultModel`. Returns an error message or null
 * if valid.
 */
export function validateModel(input: string): string | null {
  if ((ALL_MODEL_NAMES as readonly string[]).includes(input)) return null;
  return `'${input}' is not a known model. Use ${ALL_MODEL_NAMES.join(', ')}.`;
}

/**
 * Provider detection. Drives which thinking/reasoning API applies.
 */
export type Provider = 'anthropic' | 'openai' | 'google' | 'unknown';

export function modelProvider(model: Model): Provider {
  if (model === 'claude' || model.startsWith('sonnet') || model.startsWith('opus')) {
    return 'anthropic';
  }
  if (model === 'gpt' || model.startsWith('gpt-') || model === 'o-series') {
    return 'openai';
  }
  if (model === 'gemini') return 'google';
  return 'unknown';
}

/**
 * Thinking/reasoning API capability per model family.
 * Used by the thinking-hint resolver to emit the correct syntax.
 */
export interface ThinkingCapability {
  /** Which API parameter structure this model uses. */
  mode: 'adaptive-only' | 'adaptive-or-manual' | 'manual-only' | 'reasoning-effort' | 'minimal';
  /** Allowed effort tokens (for Anthropic adaptive / OpenAI reasoning_effort). */
  efforts: readonly string[];
  /** Default recommended effort for standard coding tasks. */
  defaultEffort: string;
  /** Budget hint for manual thinking (Anthropic legacy). Ignored if mode != manual. */
  manualBudgetRange?: readonly [number, number];
  /** Free-text note appended to the thinking hint. */
  note: string;
}

export const THINKING_CAPABILITIES: Record<Model, ThinkingCapability> = {
  // ─── Anthropic ─────────────────────────────────────────────
  claude: {
    mode: 'adaptive-or-manual',
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'medium',
    note: 'Generic Claude fallback — assumes Sonnet 4.6-class capabilities.',
  },
  'sonnet-4-5': {
    mode: 'manual-only',
    efforts: [],
    defaultEffort: 'medium',
    manualBudgetRange: [4000, 16000],
    note: 'Manual thinking only. Set budget_tokens (4k for simple coding, 16k for hard debug). No adaptive API.',
  },
  'sonnet-4-6': {
    mode: 'adaptive-or-manual',
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'medium',
    manualBudgetRange: [4000, 32000],
    note: 'Adaptive thinking recommended (effort=medium for coding). Manual mode still works but deprecated.',
  },
  'opus-4-5': {
    mode: 'manual-only',
    efforts: [],
    defaultEffort: 'high',
    manualBudgetRange: [8000, 32000],
    note: 'Manual thinking only. Budget 8-32k for hard problems, 4k for simple. No adaptive API.',
  },
  'opus-4-6': {
    mode: 'adaptive-or-manual',
    efforts: ['low', 'medium', 'high', 'max'],
    defaultEffort: 'high',
    manualBudgetRange: [8000, 64000],
    note: 'Adaptive preferred. Only Opus 4.6/4.7 support "max" effort for research-grade tasks. 128k output.',
  },
  'opus-4-7': {
    mode: 'adaptive-only',
    efforts: ['low', 'medium', 'high', 'max'],
    defaultEffort: 'high',
    note: 'ADAPTIVE ONLY — manual mode returns HTTP 400. Interleaved thinking is automatic. Parallelize tool calls explicitly (overlay addresses the serial-default quirk).',
  },

  // ─── OpenAI ───────────────────────────────────────────────
  gpt: {
    mode: 'reasoning-effort',
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'medium',
    note: 'Generic GPT fallback. Pass reasoning_effort via Responses API or `-c \'model_reasoning_effort="..."\'` for Codex CLI.',
  },
  'gpt-5.5': {
    mode: 'reasoning-effort',
    efforts: ['low', 'medium', 'high', 'xhigh'],
    defaultEffort: 'medium',
    note: 'New flagship (Apr 2026). Agentic long-horizon work, 1M API context (400K Codex CLI), $5/$30 per MTok. Released as `gpt-5.5` — no `-codex` suffix. xhigh reserved for long autonomous runs. Codex 0.124.0+ resets reasoning_effort on model upgrade, so re-set it explicitly after switching from 5.3-codex. Default value `medium` is gstack-chosen (OpenAI default UNVERIFIED at launch).',
  },
  'gpt-5.4': {
    mode: 'reasoning-effort',
    efforts: ['minimal', 'low', 'medium', 'high'],
    defaultEffort: 'medium',
    note: 'Previous flagship (superseded by 5.5 Apr 2026 for agentic work, still valid for cheap daily driver). medium balances intelligence + speed. Use minimal for trivial tasks, high only when evals justify it.',
  },
  'gpt-5.4-mini': {
    mode: 'reasoning-effort',
    efforts: ['minimal', 'low', 'medium', 'high'],
    defaultEffort: 'low',
    note: 'Efficient tier — great for subagents doing focused work. Low effort usually enough; reserve medium/high for parent-agent decisions.',
  },
  'gpt-5.2': {
    mode: 'reasoning-effort',
    efforts: ['none', 'low', 'medium', 'high'],
    defaultEffort: 'medium',
    note: 'Previous generation. Prefer 5.4 unless the user pins it. "none" = zero reasoning (fastest).',
  },
  'gpt-5.2-codex': {
    mode: 'reasoning-effort',
    efforts: ['none', 'low', 'medium', 'high'],
    defaultEffort: 'medium',
    note: 'Coding-specialized 5.2 variant. Good for deliberation on hard debugging.',
  },
  'gpt-5.3-codex': {
    mode: 'reasoning-effort',
    efforts: ['low', 'medium', 'high', 'xhigh'],
    defaultEffort: 'high',
    note: 'Industry-leading coding. xhigh for long agentic runs (avoid as default). OpenAI ran all 5.3-Codex evals with xhigh.',
  },
  'gpt-5.3-codex-spark': {
    mode: 'minimal',
    efforts: [],
    defaultEffort: 'minimal',
    note: 'Speed-first research preview (~1000+ tokens/s on Cerebras). Text-only. Use for real-time iteration, quick edits, refactors, boilerplate — NOT for multi-step agentic planning.',
  },

  // ─── Other ────────────────────────────────────────────────
  gemini: {
    mode: 'reasoning-effort',
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'medium',
    note: 'Thinking config varies by 2.5 vs 3 generation. Defer to Google docs.',
  },
  'o-series': {
    mode: 'reasoning-effort',
    efforts: ['low', 'medium', 'high'],
    defaultEffort: 'high',
    note: 'o-series models reason by default. Use high for math/proofs, medium for standard coding.',
  },
};
