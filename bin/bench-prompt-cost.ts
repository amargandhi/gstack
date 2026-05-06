#!/usr/bin/env bun
/**
 * Prompt-cost benchmark reporter.
 *
 * No-spend mode: reads existing eval/timeline usage records and emits a
 * markdown report. It does not call a model. If no usage records exist, the
 * report says so explicitly.
 *
 * Usage:
 *   bun run bin/bench-prompt-cost.ts
 *   bun run bin/bench-prompt-cost.ts --out BENCHMARKS.md
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const OUT_INDEX = process.argv.indexOf('--out');
const OUT_PATH = OUT_INDEX >= 0 ? process.argv[OUT_INDEX + 1] : null;

interface UsageRecord {
  source: string;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

function candidateFiles(): string[] {
  const roots = [
    path.join(process.env.HOME || '', '.gstack-dev', 'evals'),
    path.join(process.env.GSTACK_HOME || path.join(process.env.HOME || '', '.gstack'), 'evals'),
    path.join(ROOT, 'docs', 'evals'),
  ];
  const files: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(full);
        if (entry.isFile() && /\.(json|jsonl)$/.test(entry.name)) files.push(full);
      }
    }
  }
  return files;
}

function extractUsage(value: unknown, source: string, out: UsageRecord[]): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const usage = (record.usage && typeof record.usage === 'object')
    ? record.usage as Record<string, unknown>
    : record;

  const input = Number(usage.input_tokens ?? usage.inputTokens ?? 0);
  const creation = Number(usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens ?? 0);
  const read = Number(usage.cache_read_input_tokens ?? usage.cacheReadInputTokens ?? 0);
  const output = Number(usage.output_tokens ?? usage.outputTokens ?? 0);

  if (input > 0 || creation > 0 || read > 0 || output > 0) {
    out.push({
      source,
      input_tokens: input,
      cache_creation_input_tokens: creation,
      cache_read_input_tokens: read,
      output_tokens: output,
    });
  }

  for (const [key, nested] of Object.entries(record)) {
    if (key === 'usage') continue;
    if (Array.isArray(nested)) {
      for (const item of nested) extractUsage(item, source, out);
    } else if (nested && typeof nested === 'object') {
      extractUsage(nested, source, out);
    }
  }
}

function readRecords(): UsageRecord[] {
  const records: UsageRecord[] = [];
  for (const file of candidateFiles()) {
    const content = fs.readFileSync(file, 'utf-8');
    if (file.endsWith('.jsonl')) {
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try { extractUsage(JSON.parse(line), path.relative(ROOT, file), records); } catch {}
      }
    } else {
      try { extractUsage(JSON.parse(content), path.relative(ROOT, file), records); } catch {}
    }
  }
  return records;
}

function sum(records: UsageRecord[], key: keyof UsageRecord): number {
  return records.reduce((total, record) => {
    const value = record[key];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}

function render(records: UsageRecord[]): string {
  const lines: string[] = [];
  lines.push('# Benchmarks');
  lines.push('');
  lines.push('## Prompt Caching');
  lines.push('');
  lines.push('Method: `bun run bin/bench-prompt-cost.ts` reads existing eval/timeline usage records. It does not call a model.');
  lines.push('');

  if (records.length === 0) {
    lines.push('Status: no measured prompt-cache runs yet.');
    lines.push('');
    lines.push('Replication command: run a benchmark with `EVALS=1` after approving budget, then run `bun run bin/bench-prompt-cost.ts --out BENCHMARKS.md`.');
    lines.push('');
    return lines.join('\n');
  }

  const input = sum(records, 'input_tokens');
  const creation = sum(records, 'cache_creation_input_tokens');
  const read = sum(records, 'cache_read_input_tokens');
  const output = sum(records, 'output_tokens');
  const cacheable = creation + read;
  const readShare = cacheable > 0 ? Math.round((read / cacheable) * 100) : 0;

  lines.push('| Records | Input tokens | Cache creation input tokens | Cache read input tokens | Output tokens | Cache read share |');
  lines.push('|---:|---:|---:|---:|---:|---:|');
  lines.push(`| ${records.length} | ${input} | ${creation} | ${read} | ${output} | ${readShare}% |`);
  lines.push('');
  lines.push('Interpretation: cache read share measures reuse of the stable preamble prefix. It is not a cost claim unless the source records came from a paid benchmark run.');
  lines.push('');
  lines.push('Replication command: `bun run bin/bench-prompt-cost.ts --out BENCHMARKS.md`.');
  lines.push('');
  return lines.join('\n');
}

const markdown = render(readRecords());

if (OUT_PATH) {
  fs.writeFileSync(path.resolve(ROOT, OUT_PATH), markdown);
  console.log(`Wrote ${OUT_PATH}`);
} else {
  console.log(markdown);
}
