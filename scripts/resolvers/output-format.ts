/**
 * Output format hint resolver.
 *
 * Emits a short directive tuning output format to the compiled model's
 * strengths. Opt-in via `{{OUTPUT_FORMAT_HINT}}` placeholder.
 *
 * Gated on specific model families (not generic `claude`/`gpt`) — default
 * generation stays silent. Overlap with model overlays is intentional:
 * overlays describe the model's quirks broadly; this resolver targets
 * the OUTPUT layer specifically at skill-generation time.
 */
import type { TemplateContext } from './types';
import type { Model } from '../models';

interface OutputFormat {
  label: string;
  directive: string;
}

const OUTPUT_FORMATS: Partial<Record<Model, OutputFormat>> = {
  'gpt-5.4': {
    label: 'terse-bullets',
    directive:
      'Output format for GPT-5.4: Terse bullets. No preamble. Status updates are one line. ' +
      'Code explanations only when genuinely surprising. Markdown headings only when structural, ' +
      'not decorative. Cap answers at the shortest form containing the answer.',
  },
  'gpt-5.4-mini': {
    label: 'terse-bullets',
    directive:
      'Output format for GPT-5.4-mini: Terse. Subagent tier — return the conclusion, not the work. ' +
      'File:line references beat file contents. "PASS" or "FAIL + 3 discrepancies" beats prose.',
  },
  'gpt-5.3-codex': {
    label: 'structured-terse',
    directive:
      'Output format for GPT-5.3-Codex: Structured + terse. Use update_plan to track multi-step work. ' +
      'apply_patch over raw writes (shows diff). Narrate only when non-obvious.',
  },
  'gpt-5.3-codex-spark': {
    label: 'minimal-just-do-it',
    directive:
      'Output format for Spark: Minimal. Do not narrate. Do not explain. Make the edit and stop. ' +
      'No preamble, no "I will now", no recapping. One-line confirmation when done.',
  },
  'opus-4-7': {
    label: 'structured-markdown',
    directive:
      'Output format for Opus 4.7: Structured markdown with clear section headers. ' +
      'Parallelize tool calls in a single turn for independent sub-problems. ' +
      'When explaining decisions, show the competing constraints briefly, then the verdict.',
  },
  'opus-4-6': {
    label: 'structured-markdown',
    directive:
      'Output format for Opus 4.6: Structured markdown. For max-effort tasks, surface the ' +
      'reasoning path briefly — users want to see the trade-offs considered, not just the answer.',
  },
  'sonnet-4-6': {
    label: 'structured-markdown',
    directive:
      'Output format for Sonnet 4.6: Structured markdown. Adaptive thinking engages on hard ' +
      'subproblems; don\'t over-explain simple steps.',
  },
  'sonnet-4-5': {
    label: 'structured-markdown',
    directive:
      'Output format for Sonnet 4.5: Structured markdown. When thinking budget is enabled, ' +
      'reserve it for decisions, not narration.',
  },
};

export function generateOutputFormat(ctx: TemplateContext): string {
  if (!ctx.model) return '';
  const fmt = OUTPUT_FORMATS[ctx.model as Model];
  if (!fmt) return '';
  return `## Output Format (${ctx.model})

${fmt.directive}`;
}
