#!/usr/bin/env bun
/**
 * Structural routing eval. No LLM calls.
 *
 * Fixture format:
 *   {"intent":"review this PR before I merge","expected_skill":"review"}
 *   {"intent":"what is the weather","expected_skill":null}
 */

import * as fs from 'fs';
import * as path from 'path';
import { discoverTemplates } from '../scripts/discover-skills';

const ROOT = path.resolve(import.meta.dir, '..');
const FIXTURE_PATH = path.join(ROOT, 'routing-eval.jsonl');
const NULL_THRESHOLD = 5;

interface Fixture {
  intent: string;
  expected_skill: string | null;
}

interface Skill {
  name: string;
  description: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'for', 'from', 'how', 'i', 'in',
  'into', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'this', 'to', 'use', 'when',
  'with', 'you', 'your',
]);

const ALIASES: Record<string, string[]> = {
  autoplan: ['autoplan', 'ceo', 'design', 'eng', 'dx', 'review', 'pipeline'],
  'ai-usage-review': [],
  benchmark: ['benchmark', 'performance', 'vitals', 'regression', 'latency', 'load'],
  'benchmark-models': ['model', 'models', 'benchmark', 'compare', 'claude', 'gpt', 'gemini'],
  browse: ['browser', 'browse', 'page', 'click', 'selector', 'dom', 'chromium'],
  canary: ['canary', 'production', 'postdeploy', 'monitor', 'console', 'live'],
  careful: ['careful', 'destructive', 'rm', 'force', 'reset', 'delete', 'warn'],
  challenge: ['challenge', 'stress', 'polya', 'assumptions', 'plan', 'questions'],
  claude: ['claude', 'outside', 'voice', 'second', 'opinion'],
  codex: ['codex', 'openai', 'second', 'opinion', 'challenge', 'consult'],
  'context-restore': ['restore', 'resume', 'context', 'checkpoint', 'saved'],
  'context-save': ['save', 'context', 'checkpoint', 'handoff', 'resume'],
  cso: ['security', 'cso', 'owasp', 'stride', 'threat', 'secrets', 'vulnerabilities'],
  'design-consultation': ['design', 'system', 'aesthetic', 'consultation', 'brand'],
  'design-html': ['html', 'css', 'pretext', 'approved', 'mockup', 'design'],
  'design-review': ['visual', 'design', 'audit', 'spacing', 'hierarchy', 'polish'],
  'design-shotgun': ['variants', 'shotgun', 'mockups', 'designs', 'comparison'],
  'devex-review': ['developer', 'dx', 'devex', 'tthw', 'onboarding', 'docs'],
  'document-release': ['documentation', 'release', 'changelog', 'readme', 'docs'],
  freeze: ['freeze', 'lock', 'edits', 'directory', 'scope'],
  glossary: ['glossary', 'ubiquitous', 'language', 'bounded', 'contexts', 'domain'],
  guard: ['guard', 'freeze', 'careful', 'safety', 'destructive'],
  gstack: ['gstack', 'commands', 'skills', 'help', 'reference'],
  'gstack-upgrade': ['upgrade', 'update', 'latest', 'gstack', 'version'],
  health: ['health', 'lint', 'typecheck', 'quality', 'dead', 'dashboard'],
  investigate: ['investigate', 'debug', 'root', 'cause', 'prod', 'production', 'break', 'broke', 'broken', 'failure', 'why'],
  'land-and-deploy': ['land', 'merge', 'pr', 'deploy', 'production', 'verify', 'health', 'ci'],
  'landing-report': ['landing', 'queue', 'version', 'slots', 'claimed'],
  learn: ['learn', 'learnings', 'memory', 'search', 'prune'],
  'make-pdf': ['pdf', 'markdown', 'export', 'document'],
  'office-hours': ['office', 'hours', 'yc', 'startup', 'reframe', 'idea'],
  'open-gstack-browser': ['open', 'visible', 'browser', 'side', 'panel', 'chrome'],
  'operator-retro': ['ai', 'usage', 'prompts', 'prompt', 'prompted', 'operator', 'retro', 'claude', 'code', 'codex', 'gstack', 'sessions', 'coach', 'coaching', 'workflow', 'source', 'linked', 'feedback', 'agents', 'fix', 'loops', 'verification'],
  'pair-agent': ['pair', 'remote', 'agent', 'setup', 'key', 'browser'],
  'plan-ceo-review': ['ceo', 'founder', 'strategy', 'scope', 'product', '10-star'],
  'plan-design-review': ['plan', 'design', 'review', 'dimension', '10', 'visual'],
  'plan-devex-review': ['plan', 'devex', 'developer', 'experience', 'persona'],
  'plan-eng-review': ['plan', 'engineering', 'architecture', 'data', 'flow', 'edge'],
  'plan-tune': ['tune', 'question', 'sensitivity', 'askuserquestion'],
  qa: ['qa', 'test', 'browser', 'login', 'staging', 'fix', 'verify'],
  'qa-only': ['qa-only', 'report', 'findings', 'test', 'browser', 'no', 'without', 'editing', 'fix'],
  retro: ['retro', 'retrospective', 'weekly', 'commits', 'streak'],
  review: ['review', 'pr', 'diff', 'merge', 'landing', 'bugs'],
  scrape: ['scrape', 'extract', 'data', 'page', 'json'],
  'setup-browser-cookies': ['cookies', 'authenticated', 'browser', 'import', 'login'],
  'setup-deploy': ['setup', 'deploy', 'fly', 'render', 'vercel', 'netlify'],
  'setup-gbrain': ['setup', 'gbrain', 'memory', 'sync', 'install'],
  ship: ['ship', 'branch', 'tests', 'pr', 'changelog', 'version'],
  skillify: ['skillify', 'codify', 'scrape', 'flow', 'permanent', 'skill'],
  'sync-gbrain': ['sync', 'gbrain', 'memory', 'refresh', 'guidance'],
  unfreeze: ['unfreeze', 'unlock', 'edits', 'scope'],
};

function tokens(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^\//, ''))
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  return new Set(normalized);
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: '', description: '' };
  const fm = match[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() || '';
  const descLines = fm.match(/^description:\s*(.*)$/m)?.[1]?.trim() || '';
  return { name, description: descLines };
}

function loadSkills(): Skill[] {
  return discoverTemplates(ROOT).map((template) => {
    const content = fs.readFileSync(path.join(ROOT, template.tmpl), 'utf-8');
    return parseFrontmatter(content);
  }).filter((skill) => skill.name);
}

function loadFixtures(): Fixture[] {
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error('Missing routing-eval.jsonl');
    process.exit(1);
  }
  return fs.readFileSync(FIXTURE_PATH, 'utf-8')
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line, index) => {
      try {
        const parsed = JSON.parse(line) as Fixture;
        if (typeof parsed.intent !== 'string') throw new Error('intent must be string');
        if (parsed.expected_skill !== null && typeof parsed.expected_skill !== 'string') {
          throw new Error('expected_skill must be string or null');
        }
        return parsed;
      } catch (error) {
        throw new Error(`routing-eval.jsonl:${index + 1}: ${(error as Error).message}`);
      }
    });
}

function score(intent: string, skill: Skill): number {
  if (skill.name === 'ai-usage-review' && !intent.toLowerCase().includes('/ai-usage-review')) return 0;
  const intentTokens = tokens(intent);
  const skillTokens = tokens(`${skill.name} ${skill.description} ${(ALIASES[skill.name] || []).join(' ')}`);
  let score = 0;
  for (const token of intentTokens) {
    if (skillTokens.has(token)) score += 1;
  }
  if (intent.toLowerCase().includes(`/${skill.name}`)) score += 8;
  if (intent.toLowerCase().includes(skill.name)) score += 6;
  const skillParts = skill.name.split('-').filter((part) => part.length > 1);
  if (skillParts.length > 1 && skillParts.every((part) => intentTokens.has(part))) score += 8;
  let aliasHits = 0;
  for (const alias of ALIASES[skill.name] || []) {
    if (intentTokens.has(alias)) {
      score += 3;
      aliasHits += 1;
    }
  }
  if (aliasHits >= 3) score += 4;
  return score;
}

function route(intent: string, skills: Skill[]): { skill: string | null; score: number } {
  const ranked = skills
    .map((skill) => ({ skill: skill.name, score: score(intent, skill) }))
    .sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill));
  const best = ranked[0];
  if (!best || best.score < NULL_THRESHOLD) return { skill: null, score: best?.score || 0 };
  return best;
}

const skills = loadSkills();
const knownSkills = new Set(skills.map((skill) => skill.name));
const fixtures = loadFixtures();
const failures: Array<{ fixture: Fixture; actual: string | null; score: number }> = [];

if (fixtures.length < 30) {
  console.error(`routing-eval.jsonl has ${fixtures.length} fixtures; expected at least 30`);
  process.exit(1);
}

for (const fixture of fixtures) {
  if (fixture.expected_skill && !knownSkills.has(fixture.expected_skill)) {
    failures.push({ fixture, actual: '__unknown_expected_skill__', score: 0 });
    continue;
  }
  const actual = route(fixture.intent, skills);
  if (actual.skill !== fixture.expected_skill) {
    failures.push({ fixture, actual: actual.skill, score: actual.score });
  }
}

if (failures.length > 0) {
  const report = {
    ok: false,
    fixture_count: fixtures.length,
    failures,
  };
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, fixture_count: fixtures.length }, null, 2));
