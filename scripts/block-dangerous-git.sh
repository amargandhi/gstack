#!/usr/bin/env bash
# block-dangerous-git.sh — Claude Code PreToolUse hook that blocks destructive git commands.
#
# Installed via: bin/gstack-install-git-guards
# Reads JSON tool-call payload on stdin, writes block reason to stderr, exits 2 to block.
#
# Rationale: these are the git operations that most commonly destroy work when an AI agent
# runs them confidently but wrongly. The hook adds a conversational speed bump — the agent
# must explain its reasoning before the user approves an override.
#
# Design notes:
# - Block, don't prohibit. The user can always run the command in their terminal directly.
#   The goal is to convert silent destruction into an explicit handshake.
# - Feature-branch force-push is NOT blocked (normal rebase workflow). Only force-push that
#   looks like it targets main/master/develop/trunk.
# - All logic runs in bun so the JSON payload and the command-string regex are both handled
#   by a real parser (bash can't handle NUL bytes in strings, and regex-on-JSON is fragile).

set -euo pipefail

# Bun must be available. Fail open (allow) if missing rather than blocking every Bash
# invocation — a broken guard that blocks everything is worse than no guard at all.
if ! command -v bun >/dev/null 2>&1; then
  exit 0
fi

bun -e '
  let data = "";
  process.stdin.on("data", c => data += c);
  process.stdin.on("end", () => {
    let payload;
    try { payload = JSON.parse(data); }
    catch { process.exit(0); } // malformed payload → allow

    if (payload.tool_name !== "Bash") process.exit(0);
    const cmd = (payload.tool_input && payload.tool_input.command) || "";
    if (!cmd) process.exit(0);

    // Normalize whitespace for pattern matching.
    const norm = cmd.replace(/\s+/g, " ");

    const rules = [
      {
        name: "git force-push to protected branch",
        test: (c) =>
          /\bgit\s+push\b/.test(c) &&
          /(--force\b|--force-with-lease\b|\s-f(\s|$))/.test(c) &&
          /\b(origin|upstream)\s+(main|master|develop|trunk)(\s|$)/.test(c),
        reason: "git force-push targets a protected branch (main/master/develop/trunk).",
        suggest: "Force-push on feature branches is fine; on shared branches it rewrites everyone else'\''s history. If you truly need to rewrite main, do it manually with the team informed."
      },
      {
        name: "git reset --hard",
        test: (c) => /\bgit\s+reset\s+--hard\b/.test(c),
        reason: "git reset --hard discards uncommitted changes AND rewrites HEAD.",
        suggest: "If you want to discard unstaged changes only: `git restore <paths>`. To undo the last commit but keep the changes: `git reset --soft HEAD~1`. If you really want a hard reset to a remote ref, the user should run it themselves after confirming nothing is uncommitted."
      },
      {
        name: "git clean -f",
        test: (c) => /\bgit\s+clean\s+(-[a-zA-Z]*f|--force)/.test(c),
        reason: "git clean -f deletes untracked files. Untracked files are not in git history — once deleted, they are gone.",
        suggest: "Run `git clean -n` (dry-run) first to list what would be deleted. If the list looks right, have the user run `git clean -f` themselves after confirming no drafts/notes/local configs are in the path."
      },
      {
        name: "git branch -D",
        test: (c) => /\bgit\s+branch\s+(-D\b|--delete\s+--force\b|-d\s+-f\b|-f\s+-d\b)/.test(c),
        reason: "git branch -D force-deletes a branch even if it has unmerged commits.",
        suggest: "Use `git branch -d <name>` (lowercase) — it fails safely when the branch has unmerged work. If you truly need to force-delete, the user should confirm the branch is not worth keeping."
      },
      {
        name: "git checkout . / git restore .",
        test: (c) => /\bgit\s+(checkout|restore)\s+(\.|:\/)(\s|$)/.test(c),
        reason: "git checkout . / git restore . silently discards ALL unstaged changes in the working tree.",
        suggest: "List the specific files to restore: `git restore path/to/file`. Or stash first: `git stash push -u -m \"before restore\"` so the work is recoverable."
      },
      {
        name: "git rebase -i",
        test: (c) => /\bgit\s+rebase\s+(-i\b|--interactive\b)/.test(c),
        reason: "git rebase -i requires interactive input that is not available in this shell.",
        suggest: "Use non-interactive rebase flags (e.g. `git rebase --onto <ref>`), or do the rebase manually in your terminal and report the result back."
      },
      {
        name: "--no-verify on push/commit",
        test: (c) => /\bgit\s+(push|commit)\b.*\s--no-verify\b/.test(c),
        reason: "--no-verify bypasses pre-commit/pre-push hooks that exist for a reason (lint, tests, secret scanning).",
        suggest: "If a hook is failing, fix the underlying issue. If the user explicitly asked you to bypass hooks, they should run the command in their terminal so the intent is theirs."
      }
    ];

    for (const r of rules) {
      if (r.test(norm)) {
        process.stderr.write(
`BLOCKED by gstack git-guards: ${r.reason}

Suggestion: ${r.suggest}

Override: if you genuinely want this, explain your reasoning to the user and ask
them to approve. They can run the command directly in their terminal, or they can
uninstall the guard temporarily with \`gstack-install-git-guards --uninstall\`.

Hook: scripts/block-dangerous-git.sh (installed by bin/gstack-install-git-guards)
Command that was blocked: ${cmd.length > 300 ? cmd.slice(0, 300) + "..." : cmd}
`);
        process.exit(2);
      }
    }

    process.exit(0);
  });
'
