#!/usr/bin/env bun
/**
 * Documentation honesty gate for the fork hardening surface.
 *
 * Keeps README and benchmark docs aligned with what the repo can verify
 * without spending API budget.
 */

import * as fs from 'fs';
import * as path from 'path';
import { discoverTemplates } from '../scripts/discover-skills';

const ROOT = path.resolve(import.meta.dir, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

const requiredDocs = [
  'MERGE_NOTES.md',
  'MODEL_ROUTING.md',
  'BENCHMARKS.md',
  'CACHING.md',
  'DEMO_SCRIPT.md',
];

const violations: string[] = [];

for (const rel of requiredDocs) {
  if (!fs.existsSync(path.join(ROOT, rel))) violations.push(`missing ${rel}`);
}

if (fs.existsSync(path.join(ROOT, 'README.md'))) {
  const readme = read('README.md');
  if (!readme.startsWith("# gstack - Amar's fork\n")) {
    violations.push('README.md must start with "# gstack - Amar\'s fork"');
  }
  if (!readme.includes('## Fork delta')) {
    violations.push('README.md missing Fork delta section');
  }
  const opening = readme.split('\n').slice(0, 80).join('\n');
  if (/Jony Ive/i.test(opening)) {
    violations.push('README.md opening still leads with Jony Ive/design philosophy framing');
  }
  const skillCount = discoverTemplates(ROOT).length;
  if (!readme.includes(`${skillCount} generated skills`)) {
    violations.push(`README.md must state current generated skill count (${skillCount} generated skills)`);
  }
  if (!readme.includes('bun run fork:doctor')) {
    violations.push('README.md must cite bun run fork:doctor as the auditable fork check');
  }
}

if (fs.existsSync(path.join(ROOT, 'docs/MODEL_BENCHMARKS.md'))) {
  const benchmark = read('docs/MODEL_BENCHMARKS.md');
  const honestPending = /No benchmark runs found|pending|not yet executed/i.test(benchmark);
  const measured = /cache_read_input_tokens|input tokens|cost reduction/i.test(benchmark) && /\|/.test(benchmark);
  if (!honestPending && !measured) {
    violations.push('docs/MODEL_BENCHMARKS.md must be explicit pending status or measured results');
  }
}

for (const rel of ['BENCHMARKS.md', 'CACHING.md']) {
  if (!fs.existsSync(path.join(ROOT, rel))) continue;
  const content = read(rel);
  if (!/pending|no measured runs|replication command|Method/i.test(content)) {
    violations.push(`${rel} must contain method/replication wording or explicit pending status`);
  }
}

if (violations.length > 0) {
  console.error(`Docs honesty check failed (${violations.length}):`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Docs honesty check passed.');
