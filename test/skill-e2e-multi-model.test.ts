/**
 * Multi-model benchmark harness — parameterized evaluation across 5+ models.
 *
 * B5. Validates or invalidates the recommendations in scripts/thinking-profiles.ts
 * by running the SAME skill scenario against multiple models and scoring via
 * llm-judge. Produces comparable results per (skill, model).
 *
 * COST: each model-skill run ≈ $4. A 5-model × 3-skill matrix = ~$60 per run.
 * This test is gated behind BOTH:
 *   1. EVALS=1 (standard gstack eval gate)
 *   2. GSTACK_BENCH_MATRIX=1 (explicit opt-in so it never runs by default)
 *
 * To run:
 *   GSTACK_BENCH_MATRIX=1 EVALS=1 bun test test/skill-e2e-multi-model.test.ts
 *
 * Classify as `periodic` tier — run weekly or on-demand only.
 * Output: docs/MODEL_BENCHMARKS.md (via scripts/bench-matrix.ts)
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { runSkillTest } from './helpers/session-runner';
import { EvalCollector } from './helpers/eval-store';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BENCH_ENABLED = process.env.EVALS === '1' && process.env.GSTACK_BENCH_MATRIX === '1';

// Models to benchmark. Keep the set small — cost scales linearly.
// Order roughly increasing cost: Sonnet tier first, Opus last.
const MODELS_TO_BENCHMARK = [
  { family: 'sonnet-4-6', clCodeId: 'claude-sonnet-4-6' },
  { family: 'opus-4-6', clCodeId: 'claude-opus-4-6' },
  { family: 'opus-4-7', clCodeId: 'claude-opus-4-7' },
] as const;

// Skills to benchmark across models. Start with 3 representative skills
// from different kinds (strategy/analysis/execution).
const SKILLS_TO_BENCHMARK = [
  {
    skill: 'investigate',
    kind: 'analysis',
    prompt: 'Trace the call path for gstack-detect-host through the bash preamble. Identify where the runtime host variable gets set.',
  },
  {
    skill: 'review',
    kind: 'analysis',
    prompt: 'Review the diff in scripts/resolvers/preamble/generate-preamble-bash.ts for the new runtime detection logic. Flag any structural issues.',
  },
  {
    skill: 'ship',
    kind: 'execution',
    prompt: 'Run /ship in --dry-run mode — report what steps would execute, do not actually ship.',
  },
] as const;

describe.skipIf(!BENCH_ENABLED)('Multi-model benchmark matrix (B5)', () => {
  const collector = new EvalCollector('multi-model-bench');

  afterAll(() => {
    if (collector.hasResults()) {
      collector.finalize();
      // Emit markdown summary
      const summary = collector.getEntries();
      const md = renderMarkdown(summary);
      const outPath = path.join(ROOT, 'docs', 'MODEL_BENCHMARKS.md');
      fs.writeFileSync(outPath, md);
      console.log(`\n✓ Benchmark matrix written to ${outPath}`);
    }
  });

  for (const model of MODELS_TO_BENCHMARK) {
    for (const s of SKILLS_TO_BENCHMARK) {
      test(
        `/${s.skill} on ${model.family}`,
        async () => {
          // Regenerate SKILL.md for this specific model, then run the skill
          const genResult = spawnSync(
            'bun',
            ['run', 'scripts/gen-skill-docs.ts', '--model', model.family],
            { cwd: ROOT, stdio: 'pipe' }
          );
          expect(genResult.status).toBe(0);

          const result = await runSkillTest({
            skill: s.skill,
            prompt: s.prompt,
            model: model.clCodeId,
            testId: `bench-${s.skill}-${model.family}`,
            maxTurns: 20,
          });

          collector.add({
            test_id: `${s.skill}-${model.family}`,
            model: model.clCodeId,
            skill: s.skill,
            status: result.success ? 'PASS' : 'FAIL',
            cost_usd: result.costEstimate,
            duration_ms: result.duration,
            first_response_ms: result.firstResponseMs,
            max_inter_turn_ms: result.maxInterTurnMs,
          });

          // No hard assertion on quality — benchmark is observational.
          // We're building the matrix, not gating on it.
          expect(result).toBeDefined();
        },
        { timeout: 600_000 } // 10 min per run
      );
    }
  }
});

function renderMarkdown(entries: any[]): string {
  const byModel: Record<string, any[]> = {};
  for (const e of entries) {
    if (!byModel[e.model]) byModel[e.model] = [];
    byModel[e.model].push(e);
  }

  let md = '# Model Benchmark Matrix\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += '## Summary\n\n';
  md += '| Skill | Model | Status | Cost (USD) | Duration (s) |\n';
  md += '|---|---|---|---|---|\n';

  for (const e of entries.sort((a, b) => `${a.skill}__${a.model}`.localeCompare(`${b.skill}__${b.model}`))) {
    md += `| /${e.skill} | ${e.model} | ${e.status} | $${e.cost_usd.toFixed(2)} | ${Math.round(e.duration_ms / 1000)} |\n`;
  }

  md += '\n## Cost by model\n\n';
  md += '| Model | Total runs | Total USD | Avg USD/run |\n';
  md += '|---|---|---|---|\n';
  for (const [model, runs] of Object.entries(byModel)) {
    const total = runs.reduce((sum, r) => sum + r.cost_usd, 0);
    const avg = total / runs.length;
    md += `| ${model} | ${runs.length} | $${total.toFixed(2)} | $${avg.toFixed(2)} |\n`;
  }

  md += '\n## Observations\n\n';
  md += '- Cost is estimated from token counts (harness-provided when available).\n';
  md += '- Duration includes regeneration + skill execution.\n';
  md += '- Quality scoring is NOT included in this harness — use scripts/bench-matrix.ts to layer llm-judge results on top.\n';
  md += '- To validate scripts/thinking-profiles.ts bucket recommendations, compare completion rate and judge scores per (skill, model).\n';

  return md;
}

// When not enabled, emit a single informational test so the file shows up in dry-runs
describe.skipIf(BENCH_ENABLED)('Multi-model benchmark matrix (B5) — disabled', () => {
  test('requires EVALS=1 GSTACK_BENCH_MATRIX=1 to run', () => {
    expect(BENCH_ENABLED).toBe(false);
    // No-op when disabled. This ensures the file is parseable and tracked.
  });
});
