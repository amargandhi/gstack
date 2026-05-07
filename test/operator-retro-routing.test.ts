import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const FIXTURES = path.join(ROOT, 'operator-retro', 'references', 'RESOLVER_FIXTURES.jsonl');

type Fixture = {
  intent: string;
  expected_skill: string | null;
};

function readFixtures(): Fixture[] {
  return fs.readFileSync(FIXTURES, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Fixture);
}

describe('/operator-retro resolver fixtures', () => {
  test('fixture split covers positive and discriminator lanes', () => {
    const fixtures = readFixtures();
    const count = (skill: string | null) => fixtures.filter((item) => item.expected_skill === skill).length;

    expect(count('operator-retro')).toBeGreaterThanOrEqual(12);
    expect(count('retro')).toBeGreaterThanOrEqual(10);
    expect(count('learn')).toBeGreaterThanOrEqual(5);
    expect(count('review') + count('qa')).toBeGreaterThanOrEqual(5);
    expect(count(null)).toBeGreaterThanOrEqual(3);
  });

  test('positive fixtures require AI-session or operator evidence language', () => {
    const positives = readFixtures().filter((item) => item.expected_skill === 'operator-retro');
    const evidenceWords = /\b(claude|codex|gstack|ai|agent|prompts?|operator|fix loops?|fixes|investigating|verification|sessions?)\b/i;

    for (const fixture of positives) {
      expect(fixture.intent).toMatch(evidenceWords);
    }
  });

  test('global routing eval uses operator-retro, not the deprecated alias', () => {
    const routingEval = fs.readFileSync(path.join(ROOT, 'routing-eval.jsonl'), 'utf8');
    expect(routingEval).toContain('"expected_skill":"operator-retro"');
    expect(routingEval).not.toContain('"expected_skill":"ai-usage-review"');
  });
});
