#!/usr/bin/env bun
/**
 * Structural reachability check for generated skill surfaces.
 *
 * Hermetic default: verifies that every tracked Claude SKILL.md exists, every
 * external host can derive an output path for every included template, and root
 * docs mention each public skill name at least once. Ignored host outputs
 * (.agents, .factory, .cursor, etc.) are install artifacts, so this check does
 * not require them to exist in a fresh checkout. If GSTACK_STRICT_GBRAIN=1 and
 * gbrain is on PATH, also runs gbrain check-resolvable as an optional stricter
 * layer.
 */

import * as fs from 'fs';
import * as path from 'path';
import { discoverTemplates } from '../scripts/discover-skills';
import { ALL_HOST_CONFIGS } from '../hosts/index';
import type { HostConfig } from '../scripts/host-config';

const ROOT = path.resolve(import.meta.dir, '..');

interface SkillTemplate {
  dir: string;
  name: string;
  tmpl: string;
}

function readFrontmatterName(relPath: string): string {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
  const match = content.match(/^name:\s*(.+)$/m);
  if (!match) throw new Error(`${relPath} missing name frontmatter`);
  return match[1].trim();
}

function skillDirFromTemplate(relPath: string): string {
  const dir = path.dirname(relPath);
  return dir === '.' ? '' : dir;
}

function externalSkillName(skillDir: string, frontmatterName: string): string {
  if (skillDir === '') return 'gstack';
  const baseName = frontmatterName && frontmatterName !== skillDir ? frontmatterName : skillDir;
  if (baseName.startsWith('gstack-')) return baseName;
  return `gstack-${baseName}`;
}

function includedForHost(config: HostConfig, dir: string): boolean {
  const generatorDir = dir || path.basename(ROOT);
  if (config.generation.includeSkills?.length && !config.generation.includeSkills.includes(generatorDir)) {
    return false;
  }
  if (config.generation.skipSkills?.includes(generatorDir)) return false;
  return true;
}

function expectedOutput(config: HostConfig, skill: SkillTemplate): string {
  if (config.name === 'claude') {
    return skill.dir ? path.join(skill.dir, 'SKILL.md') : 'SKILL.md';
  }
  return path.join(config.hostSubdir, 'skills', externalSkillName(skill.dir, skill.name), 'SKILL.md');
}

function externalOutputLooksValid(config: HostConfig, rel: string): boolean {
  if (config.name === 'claude') return true;
  const prefix = `${config.hostSubdir}/skills/`;
  return rel.startsWith(prefix) && rel.endsWith('/SKILL.md') && rel.length > prefix.length + '/SKILL.md'.length;
}

function docCorpus(): string {
  const docs = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'docs/skills.md', 'SKILL.md'];
  return docs
    .filter((rel) => fs.existsSync(path.join(ROOT, rel)))
    .map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8'))
    .join('\n\n');
}

function isMentioned(name: string, corpus: string): boolean {
  if (name === 'gstack') return /\bgstack\b/i.test(corpus);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(/${escaped}|\\bgstack-${escaped}\\b|\\b${escaped}\\b)`, 'i').test(corpus);
}

function maybeRunGbrain(): string | null {
  if (process.env.GSTACK_STRICT_GBRAIN !== '1') return null;
  const which = Bun.spawnSync({ cmd: ['bash', '-lc', 'command -v gbrain'], stdout: 'pipe', stderr: 'pipe' });
  if (which.exitCode !== 0) return 'gbrain not found; skipped optional strict resolver check';
  const result = Bun.spawnSync({
    cmd: ['gbrain', 'check-resolvable', '--strict'],
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    console.error(result.stdout.toString());
    console.error(result.stderr.toString());
    process.exit(result.exitCode || 1);
  }
  return 'gbrain check-resolvable --strict passed';
}

const skills: SkillTemplate[] = discoverTemplates(ROOT).map((template) => ({
  dir: skillDirFromTemplate(template.tmpl),
  name: readFrontmatterName(template.tmpl),
  tmpl: template.tmpl,
}));

const violations: string[] = [];

for (const host of ALL_HOST_CONFIGS) {
  for (const skill of skills) {
    if (!includedForHost(host, skill.dir)) continue;
    const rel = expectedOutput(host, skill);
    if (host.name !== 'claude') {
      if (!externalOutputLooksValid(host, rel)) {
        violations.push(`${host.name}: ${skill.tmpl} derived invalid output ${rel}`);
      }
      continue;
    }
    if (!fs.existsSync(path.join(ROOT, rel))) {
      violations.push(`${host.name}: ${skill.tmpl} expected ${rel}`);
    }
  }
}

const corpus = docCorpus();
for (const skill of skills) {
  if (!isMentioned(skill.name, corpus)) {
    violations.push(`docs: ${skill.name} is not mentioned in README.md/AGENTS.md/CLAUDE.md/docs/skills.md/SKILL.md`);
  }
}

if (violations.length > 0) {
  console.error(`Skill reachability check failed (${violations.length}):`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

const gbrain = maybeRunGbrain();
console.log(`Skill reachability check passed (${skills.length} skills x ${ALL_HOST_CONFIGS.length} host configs).`);
if (gbrain) console.log(gbrain);
