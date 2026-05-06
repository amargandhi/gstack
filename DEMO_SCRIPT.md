# 5-minute demo

This demo shows the fork as a post-use hardening pass: the personal additions
remain, but the claims are backed by deterministic checks.

```bash
git log --oneline | head -15
bun install
bun run fork:doctor
bun run bin/gstack-model-route review
bun run bin/gstack-model-route freeze
bun run bin/gstack-model-route office-hours
cat MODEL_ROUTING.md
cat BENCHMARKS.md
cat MERGE_NOTES.md
```

Expected model route outputs:

```text
claude-sonnet-4-6
claude-haiku-4-5
claude-opus-4-7
```

What this proves:

- `fork:doctor` composes the free structural gates.
- `gstack-model-route` resolves model choice from existing thinking profiles,
  not a fork-only routing file.
- `BENCHMARKS.md` is honest when no paid benchmark has run.
- `MERGE_NOTES.md` records upstream state and deferred work.

Upstream contribution path:

```bash
git switch -c upstream-pr/dry-run-metadata upstream/main
git cherry-pick <dry-run-fix-commit>
bun test test/gen-skill-docs.test.ts
```

Open the upstream PR only for the deterministic dry-run metadata fix. Keep the
fork-specific doctrine, routing fixtures, and docs hardening in this fork.
