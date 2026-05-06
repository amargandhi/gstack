# Merge Notes

Branch: `feat/canonical-code-quality-vocab`.
Implementation SHA before hardening: `9f575d40efb258c3a82ef339d047c5e0cc704f8f`.
Fetched upstream: `upstream/main` at `19e699ab9b69de9e1bf10d4b7c2682703b56f984`.

## Hardening Frame

This fork was used as a practical implementation while building an open-source
app. That usage exposed fork drift: prose claims, generated-file assumptions,
implicit routing, and local conventions that were not enforced by code.

This pass keeps the current fork additions, but moves their trust surface into
deterministic checks. The target shape is a personal implementation aligned
with upstream GStack's thin-harness / fat-skills design, not a competing
rewrite of upstream.

## Upstream State

This hardening pass fetched upstream and recorded the advanced SHA. It did not
merge `19e699ab` into the current feature branch because this plan preserves
the existing fork additions on `feat/canonical-code-quality-vocab` first.

Deferred upstream delta: local `upstream/main` had previously been at
`db9447c3`; `git fetch upstream` advanced it to `19e699ab`.

## Preserved Fork Changes

- `challenge` and `glossary` skills.
- Canonical code-quality vocabulary and `docs/DESIGN_TESTS.md`.
- Model overlays, thinking profiles, model gate rules, and subagent model map.
- Side-by-side host install support.
- Existing audit and subagent model-pinning tests.

## Hardening Decisions

| Area | Resolution | Evidence |
|---|---|---|
| `skill:check` template coverage | Honors `HostConfig.generation.skipSkills` for Claude-skipped `claude` skill | `bun run skill:check` |
| `gen-skill-docs --dry-run` | Avoids external host directory and metadata writes | `bun test test/gen-skill-docs.test.ts` |
| `--host all --dry-run` | Any host failure exits non-zero | `bun test test/gen-skill-docs.test.ts` |
| Model routing | Uses `scripts/thinking-profiles.ts`, not a parallel YAML file | `bun run check:model-routing` |
| Subagent tools | Reviewer/verifier agents are read-only | `bun run check:subagents` |
| Benchmark claims | Marked pending until an explicit paid run exists | `bun run check:docs-honesty` |

## Deferred

- Merge or rebase onto upstream `19e699ab`.
- Any paid benchmark or LLM eval run.
- Upstream PR branch for the dry-run metadata fix.
