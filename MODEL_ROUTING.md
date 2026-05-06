# Model Routing

Source of truth:

- `scripts/thinking-profiles.ts`: per-skill semantic bucket and rationale.
- `scripts/models.ts`: supported model families and reasoning capabilities.
- `scripts/model-gate-rules.ts`: hard incompatibility rules.
- `scripts/subagent-model-map.ts`: `.claude/agents/*.md` model aliases.

This fork does not add a separate `model-routing.yaml`. The compatibility CLI
reads the existing thinking profiles:

```bash
bun run bin/gstack-model-route review
bun run bin/gstack-model-route freeze
bun run bin/gstack-model-route office-hours
```

## Tiers

| Tier | Model | Rule |
|---|---|---|
| router | `claude-haiku-4-5` | `minimal` and `low` buckets |
| worker | `claude-sonnet-4-6` | `medium` bucket and most `high` analysis work |
| reasoner | `claude-opus-4-7` | `max`, `high` strategy, `investigate`, and `cso` |

The rule keeps common execution/review work on Sonnet while reserving Opus for
strategy and multi-hop root-cause/security reasoning.

## Verification

```bash
bun run check:model-routing
bun run bin/gstack-model-route review
bun run bin/gstack-model-route freeze
bun run bin/gstack-model-route office-hours
```

`test/model-routing-completeness.test.ts` fails if any generated skill lacks an
explicit thinking profile.
