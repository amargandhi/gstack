#!/usr/bin/env bun
/**
 * Install local git hooks for this fork.
 *
 * The fork keeps `fork:doctor` as a local verification command instead of
 * relying on GitHub Actions runners. This installer writes a pre-push hook
 * that runs the free structural doctor before code leaves the machine.
 */

import { existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const MARKER = 'gstack-local-fork-doctor';

function git(args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout.trim();
}

const root = git(['rev-parse', '--show-toplevel']);
const rawHookPath = git(['rev-parse', '--git-path', 'hooks/pre-push']);
const hookPath = isAbsolute(rawHookPath) ? rawHookPath : join(root, rawHookPath);

if (existsSync(hookPath)) {
  const existing = readFileSync(hookPath, 'utf8');
  if (!existing.includes(MARKER)) {
    console.error(`Refusing to overwrite existing pre-push hook: ${hookPath}`);
    console.error('Move that hook aside or merge it manually, then rerun bun run install:local-hooks.');
    process.exit(1);
  }
}

const hook = `#!/usr/bin/env sh
# ${MARKER}
set -eu

if [ "\${SKIP_FORK_DOCTOR:-}" = "1" ]; then
  echo "Skipping fork:doctor because SKIP_FORK_DOCTOR=1"
  exit 0
fi

echo "Running local fork:doctor before push..."
bun run fork:doctor
`;

await mkdir(dirname(hookPath), { recursive: true });
await writeFile(hookPath, hook, 'utf8');
await chmod(hookPath, 0o755);

console.log(`Installed local pre-push hook: ${hookPath}`);
