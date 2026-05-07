import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('/operator-retro lane separation', () => {
  test('skill description routes only operator AI-session reviews', () => {
    const skill = read('operator-retro/SKILL.md.tmpl');

    expect(skill).toContain('Use when transcript or AI-session evidence is required');
    expect(skill).toContain('Reviews operator behavior only');
    expect(skill).toContain('Do not use for shipping cadence, test');
    expect(skill).toContain('use /retro, /review, /qa, or /learn instead');
  });

  test('deprecated alias has no duplicate triggers or analysis workflow', () => {
    const alias = read('ai-usage-review/SKILL.md.tmpl');

    expect(alias).toContain('Deprecated alias for /operator-retro');
    expect(alias).toContain('Do not perform analysis here');
    expect(alias).not.toContain('triggers:');
    expect(alias).not.toContain('AI_USAGE_REVIEW_CMD');
    expect(alias).not.toContain('review --project');
  });

  test('operator-retro uses vendored packaging or explicit private bin only', () => {
    const skill = read('operator-retro/SKILL.md.tmpl');

    expect(skill).toContain('AI_USAGE_REVIEW_BIN');
    expect(skill).toContain('operator-retro/engine/src/cli.ts');
    expect(skill).not.toContain('/Users/');
    expect(skill).not.toContain('Developer/AI-Research/ai-usage-review');
  });

  test('README exposes operator-retro in Reflect without the deprecated alias', () => {
    const readme = read('README.md');

    expect(readme).toContain('| `/operator-retro` | **Operator Coach** |');
    expect(readme).toContain('| | `/operator-retro` | Operator retro for Claude/Codex/GStack usage |');
    expect(readme).not.toContain('| `/ai-usage-review` | **AI Usage Coach** |');
  });
});
