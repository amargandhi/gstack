import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { discoverTemplates } from '../scripts/discover-skills';
import { THINKING_PROFILES, type ThinkingBucket } from '../scripts/thinking-profiles';

const ROOT = path.resolve(import.meta.dir, '..');
const VALID_BUCKETS: readonly ThinkingBucket[] = ['minimal', 'low', 'medium', 'high', 'max'];

function readNameFromTemplate(relPath: string): string {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  const match = content.match(/^name:\s*(.+)$/m);
  if (!match) throw new Error(`${relPath} missing name frontmatter`);
  return match[1].trim();
}

function route(skill: string): string {
  const result = Bun.spawnSync({
    cmd: ['bun', 'run', 'bin/gstack-model-route', skill],
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(`gstack-model-route ${skill} failed: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

describe('Skill model routing', () => {
  test('every generated skill has an explicit thinking profile', () => {
    const missing: string[] = [];
    for (const template of discoverTemplates(ROOT)) {
      const name = readNameFromTemplate(template.tmpl);
      if (!THINKING_PROFILES[name]) missing.push(name);
    }
    expect(missing.sort()).toEqual([]);
  });

  test('every thinking profile is structurally complete', () => {
    for (const [skill, profile] of Object.entries(THINKING_PROFILES)) {
      expect(skill.length).toBeGreaterThan(0);
      expect(VALID_BUCKETS).toContain(profile.bucket);
      expect(profile.rationale.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(5);
    }
  });

  test('compatibility CLI maps canonical skills to current tiers', () => {
    expect(route('review')).toBe('claude-sonnet-4-6');
    expect(route('ship')).toBe('claude-sonnet-4-6');
    expect(route('freeze')).toBe('claude-haiku-4-5');
    expect(route('office-hours')).toBe('claude-opus-4-7');
  });
});
