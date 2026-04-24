/**
 * Code Smells Checklist resolver.
 *
 * Emits Fowler's 24 smells (Refactoring 2nd ed., Ch.3) + 2 Ousterhout extensions
 * (A Philosophy of Software Design 2nd ed., Ch.7) as a compact, scannable
 * checklist grouped by category. Skills include `{{CODE_SMELLS_CHECKLIST}}`
 * in their code-quality review section to give the agent shared vocabulary
 * for flagging issues.
 *
 * Data source: scripts/code-smells.json (single source of truth — edit there,
 * not here). Resolver is pure formatting over the data.
 *
 * Not gated on host or model — the vocabulary is universally useful across
 * all AI agents doing code review.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { TemplateContext } from './types';

interface Smell {
  name: string;
  diagnostic: string;
  fix: string;
}

interface Category {
  name: string;
  description: string;
  smells: Smell[];
}

interface CodeSmellsData {
  $source_primary?: string;
  $source_extension?: string;
  categories: Category[];
}

function loadCodeSmells(): CodeSmellsData | null {
  const dataPath = path.join(__dirname, '..', 'code-smells.json');
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(raw) as CodeSmellsData;
    if (!Array.isArray(data?.categories)) return null;
    return data;
  } catch {
    return null;
  }
}

export function generateCodeSmellsChecklist(_ctx: TemplateContext): string {
  const data = loadCodeSmells();
  if (!data) {
    return `## Code Smells Checklist

(not loaded — \`scripts/code-smells.json\` missing or malformed. Fall back to general code-quality judgment for this review.)`;
  }

  const categoryBlocks = data.categories.map((cat) => {
    const smellLines = cat.smells.map((s) => {
      // "- **Name** — diagnostic → fix."
      // Keep fix terse; reader can dig into full entry if they want more.
      return `- **${s.name}** — ${s.diagnostic} → ${s.fix}`;
    }).join('\n');
    return `**${cat.name}** — ${cat.description}\n\n${smellLines}`;
  }).join('\n\n');

  return `## Code Smells Checklist (Fowler 2018 Ch.3 + Ousterhout 2021 Ch.7)

When scanning for code quality, name the smell by its canonical term. Shared vocabulary lets the author look up the full diagnostic and refactoring direction. Don't flag every possible match — focus on ones that meaningfully hurt readability, change-cost, or coupling on this diff.

${categoryBlocks}

**How to cite in a review finding:** "This has **Shotgun Surgery** (Fowler, *Refactoring*, 2018): adding a new currency requires edits in PricingService, Invoice, Report, and EmailFormatter. Consolidate currency handling into one class so the next currency addition touches one file." — name, source, observation, fix direction.`;
}
