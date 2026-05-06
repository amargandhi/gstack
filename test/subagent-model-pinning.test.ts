/**
 * Drift guard — asserts .claude/agents/*.md frontmatter `model:` field
 * matches scripts/subagent-model-map.ts.
 *
 * This prevents silent drift between the documented intent and the actual
 * Claude Code-consumed frontmatter.
 */
import { expect, test, describe } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { SUBAGENT_MODEL_MAP, type ModelAlias } from '../scripts/subagent-model-map';

const ROOT = path.resolve(import.meta.dir, '..');
const AGENTS_DIR = path.join(ROOT, '.claude', 'agents');

function readFrontmatter(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

const VALID_ALIASES: readonly ModelAlias[] = ['haiku', 'sonnet', 'opus'];
const WRITE_OR_SHELL_TOOLS = new Set(['Bash', 'Edit', 'Write']);

function parseTools(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((tool) => tool.trim()).filter(Boolean);
}

describe('Subagent model pinning', () => {
  test('every agent file in .claude/agents/ has a mapping entry', () => {
    const agentFiles = fs
      .readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.md'));
    const mappedNames = new Set(Object.keys(SUBAGENT_MODEL_MAP));
    const unmapped: string[] = [];
    for (const file of agentFiles) {
      const fm = readFrontmatter(path.join(AGENTS_DIR, file));
      const name = fm.name;
      if (!name) continue;
      if (!mappedNames.has(name)) unmapped.push(name);
    }
    expect(unmapped).toEqual([]);
  });

  test.each(Object.entries(SUBAGENT_MODEL_MAP))(
    'agent %s frontmatter matches map',
    (name, pin) => {
      const filePath = path.join(AGENTS_DIR, `${name}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
      const fm = readFrontmatter(filePath);
      expect(fm.name).toBe(name);
      expect(VALID_ALIASES).toContain(pin.alias);
      expect(fm.model).toBe(pin.alias);
    }
  );

  test('every map entry has a non-empty rationale', () => {
    for (const [name, pin] of Object.entries(SUBAGENT_MODEL_MAP)) {
      expect(pin.rationale.length).toBeGreaterThan(30);
      expect(pin.explicitVersion).toBeDefined();
    }
  });

  test('reviewer and verifier agents are read-only', () => {
    const violations: Array<{ name: string; tool: string }> = [];
    const agentFiles = fs
      .readdirSync(AGENTS_DIR)
      .filter((f) => f.endsWith('.md') && (f.includes('reviewer') || f.includes('verifier')));

    for (const file of agentFiles) {
      const fm = readFrontmatter(path.join(AGENTS_DIR, file));
      for (const tool of parseTools(fm.tools)) {
        if (WRITE_OR_SHELL_TOOLS.has(tool)) {
          violations.push({ name: fm.name || file, tool });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
