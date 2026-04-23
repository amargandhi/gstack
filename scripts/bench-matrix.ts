#!/usr/bin/env bun
/**
 * bench-matrix — post-process benchmark eval results into a markdown matrix.
 *
 * Reads eval-store results from ~/.gstack-dev/evals/ matching the
 * `multi-model-bench` collector, aggregates by (skill, model), and writes
 * docs/MODEL_BENCHMARKS.md with a summary table + per-model cost breakdown.
 *
 * Usage:
 *   bun run scripts/bench-matrix.ts [--out <path>]
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const EVAL_DIR = path.join(process.env.HOME || '', '.gstack-dev', 'evals');

interface BenchEntry {
  test_id: string;
  model: string;
  skill: string;
  status: string;
  cost_usd: number;
  duration_ms: number;
  first_response_ms?: number;
  max_inter_turn_ms?: number;
  timestamp?: string;
}

function readBenchResults(): BenchEntry[] {
  if (!fs.existsSync(EVAL_DIR)) return [];
  const results: BenchEntry[] = [];
  for (const f of fs.readdirSync(EVAL_DIR)) {
    if (!f.startsWith('multi-model-bench') || !f.endsWith('.jsonl')) continue;
    const full = path.join(EVAL_DIR, f);
    for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try { results.push(JSON.parse(line)); } catch {}
    }
  }
  return results;
}

function render(entries: BenchEntry[]): string {
  if (entries.length === 0) {
    return '# Model Benchmark Matrix\n\nNo benchmark runs found under `~/.gstack-dev/evals/`.\n\n' +
      'To generate data, run:\n\n```bash\nGSTACK_BENCH_MATRIX=1 EVALS=1 bun test test/skill-e2e-multi-model.test.ts\n```\n';
  }

  let md = '# Model Benchmark Matrix\n\n';
  md += `Aggregated from ${entries.length} benchmark runs.\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;

  // Aggregate by (skill, model)
  const byPair = new Map<string, BenchEntry[]>();
  for (const e of entries) {
    const key = `${e.skill}__${e.model}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(e);
  }

  md += '## Per (skill, model) summary\n\n';
  md += '| Skill | Model | Runs | Pass rate | Avg cost | Median duration |\n';
  md += '|---|---|---:|---:|---:|---:|\n';
  for (const [key, runs] of [...byPair.entries()].sort()) {
    const [skill, model] = key.split('__');
    const passes = runs.filter(r => r.status === 'PASS').length;
    const passRate = ((passes / runs.length) * 100).toFixed(0);
    const avgCost = runs.reduce((s, r) => s + r.cost_usd, 0) / runs.length;
    const durations = runs.map(r => r.duration_ms).sort((a, b) => a - b);
    const medDur = durations[Math.floor(durations.length / 2)];
    md += `| /${skill} | \`${model}\` | ${runs.length} | ${passRate}% | $${avgCost.toFixed(2)} | ${Math.round(medDur / 1000)}s |\n`;
  }

  // Model rollup
  const byModel = new Map<string, BenchEntry[]>();
  for (const e of entries) {
    if (!byModel.has(e.model)) byModel.set(e.model, []);
    byModel.get(e.model)!.push(e);
  }

  md += '\n## Cost by model\n\n';
  md += '| Model | Total runs | Total USD | Avg USD/run | Pass rate |\n';
  md += '|---|---:|---:|---:|---:|\n';
  for (const [model, runs] of [...byModel.entries()].sort()) {
    const total = runs.reduce((s, r) => s + r.cost_usd, 0);
    const avg = total / runs.length;
    const passes = runs.filter(r => r.status === 'PASS').length;
    const passRate = ((passes / runs.length) * 100).toFixed(0);
    md += `| \`${model}\` | ${runs.length} | $${total.toFixed(2)} | $${avg.toFixed(2)} | ${passRate}% |\n`;
  }

  md += '\n## Interpretation guide\n\n';
  md += '- **Pass rate** = skill completed successfully (no hard errors / turn-limit exceeded).\n';
  md += '- **Cost** uses harness-reported token counts. Multiply by thinking-bucket overhead for adaptive-thinking models.\n';
  md += '- If a model has low pass rate on `strategy`-kind skills (plan-ceo-review etc), validate against `scripts/thinking-profiles.ts` bucket recommendations.\n';
  md += '- If a cheaper model matches an expensive one on pass rate + quality, consider promoting it as the default in `scripts/subagent-model-map.ts`.\n';

  return md;
}

// ─── Entrypoint ──────────────────────────────────────
const args = process.argv.slice(2);
const outArg = args.indexOf('--out') >= 0 ? args[args.indexOf('--out') + 1] : null;
const outPath = outArg || path.join(ROOT, 'docs', 'MODEL_BENCHMARKS.md');

const entries = readBenchResults();
const md = render(entries);
fs.writeFileSync(outPath, md);
console.log(`Wrote ${outPath} (${entries.length} entries)`);
