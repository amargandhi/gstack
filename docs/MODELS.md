# Model-aware gstack — what this is, when to use what

gstack skills are host-agnostic by design (they generate for Claude Code, Codex CLI, Cursor, Kiro, OpenCode, Slate, OpenClaw, etc.), but the **model** actually running the skill matters a lot for quality, cost, and latency. This doc explains:

1. Which models gstack knows about
2. What behavior gstack changes per model
3. How to pick the right thinking/reasoning effort for each skill
4. How to regenerate skills for a specific model

Run `./bin/gstack-model-guide` to see live recommendations. Run `./bin/gstack-model-guide --matrix` for the full skill-kind × model table.

---

## Supported models

### Anthropic (Claude)

| Model | Thinking API | Default effort | When to use |
|---|---|---|---|
| `sonnet-4-5` | Manual only (`budget_tokens`) | medium | Legacy pin — prefer 4.6 if your harness supports it |
| `sonnet-4-6` | Adaptive (`effort=low\|medium\|high`) | medium | Daily driver. Adaptive skips thinking on easy tasks, engages on hard ones. |
| `opus-4-5` | Manual only | high | When you want deep Opus reasoning and your harness doesn't support adaptive |
| `opus-4-6` | Adaptive (+ `max` effort) | high | Hard problems where `max` effort pays off — novel architecture, security review |
| `opus-4-7` | **Adaptive only** (manual → 400) | high | Current flagship. Auto interleaved thinking. Parallelize tool calls explicitly |

### OpenAI (GPT / Codex)

| Model | Reasoning API | Default effort | When to use |
|---|---|---|---|
| `gpt-5.4` | `reasoning_effort=minimal\|low\|medium\|high` | medium | Daily-driver flagship. medium balances quality vs speed |
| `gpt-5.4-mini` | same as 5.4 | low | Subagents, focused narrow tasks, cost-sensitive runs |
| `gpt-5.2` | `none\|low\|medium\|high` | medium | Previous gen — skip unless pinned |
| `gpt-5.2-codex` | same as 5.2 | medium | Deliberate coding, style-matching refactors |
| `gpt-5.3-codex` | `low\|medium\|high\|xhigh` | high | Industry-leading coding. xhigh for long agentic runs only |
| `gpt-5.3-codex-spark` | **Speed-first, no effort knob** | minimal | Real-time iteration, ~1000+ tokens/s. Quick edits, not planning |

---

## Two ways gstack uses the model

### 1. Build-time model overlays

When you run `bun run gen:skill-docs --model opus-4-7`, gstack injects a **Model-Specific Behavioral Patch** section into every generated SKILL.md. The patch lives in `model-overlays/<model>.md` and tells the model things that its family quirks require — e.g. `opus-4-7.md` teaches the model to parallelize tool calls explicitly (Opus 4.7 defaults to serial tool use), and `gpt-5.3-codex-spark.md` tells the model to escalate to 5.3-codex for planning tasks.

Overlays can inherit via `{{INHERIT:claude}}` so `opus-4-7.md` stacks on top of `claude.md` without duplication. Missing overlay → empty section (graceful).

### 2. Per-skill thinking hints

Seven key skills (`investigate`, `review`, `qa`, `health`, `plan-ceo-review`, `plan-eng-review`, `cso`) include a `{{THINKING_HINT}}` placeholder. When generated for a specific model, this renders a short **Thinking Mode for this Skill** section that tells the agent which effort level to use, plus a rationale.

Example — for `opus-4-7` on `/investigate`:

```
## Thinking Mode for this Skill

**Recommended:** `high` effort on `opus-4-7` — `thinking: { type: "adaptive", effort: "high" }`

**Why:** Root-cause debugging. Shortcuts produce symptom-fixes, which create whack-a-mole bugs.

If the user is latency-sensitive or the task is clearly mechanical, drop to `medium`.

**Model note:** ADAPTIVE ONLY — manual mode returns HTTP 400...
```

The recommendation comes from [`scripts/thinking-profiles.ts`](../scripts/thinking-profiles.ts) which assigns each skill a semantic bucket (`minimal`, `low`, `medium`, `high`, `max`), and `scripts/resolvers/thinking-hint.ts` translates the bucket to the right provider-specific effort token.

---

## Skill × effort recommendations

Based on the skill's inherent deliberation requirement:

| Skill kind | Examples | Recommended bucket |
|---|---|---|
| **Strategy** | `plan-ceo-review`, `plan-eng-review`, `office-hours`, `autoplan` | `high` (upgrade to `max` when available) |
| **Analysis** | `investigate`, `review`, `cso`, `plan-design-review` | `high` |
| **Mixed execution** | `qa`, `ship`, `design-review`, `health`, `retro` | `medium` |
| **Execution-heavy** | `browse`, `setup-deploy`, `make-pdf` | `low` |
| **Safety / utility** | `careful`, `freeze`, `guard`, `gstack-upgrade` | (no thinking — mechanical) |

Upgrade or downgrade:
- If the user is cost-sensitive and the task is obvious → drop one bucket
- If the stakes are high (security, irreversible decisions) → bump one bucket
- If the model doesn't support the requested effort → the resolver falls back to the closest supported one

---

## Common model-skill pitfalls

### Spark for multi-step planning — DON'T

`gpt-5.3-codex-spark` is optimized for speed, not deliberation. It will happily run `/plan-ceo-review` and produce a result, but the result will skip depth the skill depends on. If a user is on Spark and asks for a plan review, escalate the model:

```
"This task benefits from real deliberation. I recommend switching to gpt-5.3-codex
for /plan-ceo-review and back to spark for quick edits after."
```

### Opus 4.7 serializing tool calls

Opus 4.7 defaults to serial tool use. The `opus-4-7.md` overlay explicitly tells it to parallelize independent sub-problems. When `/review`, `/investigate`, or `/cso` need to read multiple files, this overlay is what prevents 5-turn serial reads from eating the budget.

### Switching models mid-session

Don't. Prompt caching is per-model. Switching from Opus to Sonnet mid-conversation invalidates the entire cache. If you need a cheaper model for a subtask, spawn it as a **subagent** (the Agent tool) rather than swapping the primary model.

### Manual thinking on Sonnet 4.5 / Opus 4.5

These models don't support adaptive thinking. If you need deep reasoning, you must set `budget_tokens` up-front. The `sonnet-4-5.md` and `opus-4-5.md` overlays tell the model to respect the budget you were given and not ask the user to toggle thinking mid-flight.

---

## Regenerating for a different model

Default generation (no `--model` flag) uses the `claude` generic overlay:

```bash
bun run gen:skill-docs
```

Target a specific model:

```bash
bun run gen:skill-docs --model opus-4-7
bun run gen:skill-docs --model gpt-5.3-codex --host codex
bun run gen:skill-docs --model gpt-5.3-codex-spark --host codex
```

Generate for all hosts + claude model:

```bash
bun run gen:skill-docs --host all
```

---

## Where to look in the codebase

| File | What it does |
|---|---|
| `scripts/models.ts` | Model taxonomy, provider detection, thinking capabilities |
| `scripts/thinking-profiles.ts` | Skill → thinking bucket mapping |
| `scripts/resolvers/model-overlay.ts` | Reads `model-overlays/<model>.md`, handles `{{INHERIT}}` |
| `scripts/resolvers/thinking-hint.ts` | Translates bucket + model → effort recommendation |
| `model-overlays/` | Per-model behavioral patches (markdown) |
| `bin/gstack-model-guide` | CLI for querying recommendations |

---

## Runtime host + model detection

gstack now emits a runtime host/model probe on every skill invocation. Two bash
variables are available in every preamble:

- `$_RUNTIME_HOST` — one of `claude`, `codex`, `cursor`, `factory`, `kiro`, `opencode`, `openclaw`, `slate`, `gbrain`, or `unknown`
- `$_RUNTIME_MODEL` — one of the gstack model names (`opus-4-7`, `gpt-5.3-codex`, etc.) or `unknown`

The preamble also prints a `HOST_MISMATCH: ...` line if the runtime host differs
from the build-time host (catches mis-installed skill trees).

### How detection works

Host detection (`bin/gstack-detect-host`):
1. **Env vars first** — `CLAUDECODE=1` for Claude Code, `CODEX_HOME` for Codex CLI,
   `TERM_PROGRAM=cursor` / `CURSOR_TRACE_ID` for Cursor, `OPENCLAW_SESSION` /
   `KIRO_SESSION` / `OPENCODE_SESSION` / `DROID_SESSION_ID` for the rest.
2. **Path-based fallback** — if the script was invoked from
   `~/.claude/skills/...` / `~/.codex/skills/...` / etc., infer from that.
3. **Unknown** if neither signal fires.

Model detection (`bin/gstack-detect-model`):
1. **Provider env vars** — `ANTHROPIC_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`,
   `OPENAI_MODEL`, `CODEX_MODEL`.
2. Normalizes via the same family heuristics as `resolveModel()` in
   `scripts/models.ts`, so `claude-opus-4-7-20250115` → `opus-4-7`.
3. Falls back to `claude` if the host is Claude Code but no model is exported.

### What this enables

- **Skill-level branching** in bash blocks: `[ "$_RUNTIME_HOST" = "codex" ] && ...`
- **Installation sanity checks** — if you copy a `~/.claude/skills/gstack` tree to
  `~/.codex/skills/` by mistake, every skill invocation warns you.
- **Telemetry accuracy** — analytics can now record the actual runtime host, not
  just the build-time host.
- **Escalation opportunities** — a future enhancement could read `$_RUNTIME_MODEL`
  and say "this is `/plan-ceo-review` running on Spark — recommend escalating
  to `gpt-5.3-codex` before proceeding."

### Testing detection

```bash
# Claude Code
CLAUDECODE=1 bin/gstack-detect-host                                    # → claude
CLAUDECODE=1 ANTHROPIC_MODEL=claude-opus-4-7-20250115 bin/gstack-detect-model  # → opus-4-7

# Codex CLI
CODEX_HOME=/tmp/codex bin/gstack-detect-host                           # → codex
OPENAI_MODEL=gpt-5.3-codex-spark bin/gstack-detect-model              # → gpt-5.3-codex-spark

# No env (fallback)
env -i HOME=$HOME bin/gstack-detect-host                               # → unknown
```

---

## Enforcement layer (Phase A)

Beyond recommendations, gstack now **enforces** model-appropriate behavior
via runtime guardrails:

### Auto-escalation (`bin/gstack-model-gate`)

The preamble checks every skill invocation against `scripts/model-gate-rules.ts`.
If the (runtime model, skill) pairing is known-bad, a `<system-reminder>` block
tells the agent to STOP and recommend switching. Current rules:

- `gpt-5.3-codex-spark` + any `strategy` skill (plan-ceo-review, autoplan,
  office-hours) → HARD STOP, suggest `gpt-5.3-codex`
- `gpt-5.3-codex-spark` + `high`/`max` analysis bucket (investigate, cso, review)
  → same treatment

Add new rules to `scripts/model-gate-rules.ts` and mirror in
`bin/gstack-model-gate` bash.

### Subagent model pinning (`.claude/agents/*.md`)

Each of the 4 project subagents pins a model appropriate to its task:

- `explorer` → `haiku` — cheap "map, don't fix" recon
- `verifier` / `security-reviewer` / `adversarial-reviewer` → `sonnet` —
  adaptive thinking, balanced quality-per-cost

`scripts/subagent-model-map.ts` is the source of truth.
`test/subagent-model-pinning.test.ts` guards against drift.

### Codex effort routing (`bin/gstack-codex-effort`)

When `/codex` is invoked from another gstack skill (autoplan etc.), the outer
skill exports `CALLING_SKILL=<name>`. `/codex` reads it and picks effort from
the outer skill's thinking bucket, not just its own mode default:

- `/ship` calling `/codex` → medium (execution bucket)
- `/autoplan` calling `/codex` → xhigh (strategy bucket, upgraded from high)
- Direct `/codex <prompt>` with no env var set → mode default (backward compat)

### Output format tuning (`{{OUTPUT_FORMAT_HINT}}`)

Per-model format directives (terse for GPT-5.4, structured for Opus, minimal
for Spark). Opt-in via placeholder in: review, investigate, plan-ceo-review,
plan-eng-review, cso.

## Measurement + learning (Phase B)

### Timeline now tracks model

Every skill invocation's timeline entry now includes `model` and `host` fields.
This feeds three downstream tools:

### `bin/gstack-model-stats`
Aggregate per (skill, model): started, completed, rate, median duration.
```bash
gstack-model-stats               # all skills, current project
gstack-model-stats review        # one skill
gstack-model-stats --global      # across all projects
gstack-model-stats --json        # machine-readable
```

### `bin/gstack-model-recommend <skill>`
After ≥5 runs per model, surfaces data-driven suggestions:
```
Recommendation: opus-4-7
  Rate: 100% across 7 runs.
  vs sonnet-4-6: 30 pp higher success rate.
```
Requires timeline data (A6 must have shipped).

### `bin/gstack-cost-report`
Estimates USD per (skill, model) using `scripts/model-pricing.ts` (Apr 2026
snapshot). Token counts from harness when available; per-skill estimates
otherwise.
```bash
gstack-cost-report                  # current project
gstack-cost-report --global
gstack-cost-report --skill review
gstack-cost-report --branch main
```

## Dynamic overlay at runtime (B1)

When `$_RUNTIME_MODEL` differs from the build-time `--model`, the preamble now
emits the matching overlay as a `<system-reminder>` block at skill start. This
means users who don't regenerate gstack every time they swap models still get
model-specific guidance automatically.

Flow:
1. Preamble runs `gstack-detect-model` → `_RUNTIME_MODEL`
2. If that differs from build-time `${ctx.model}` AND an overlay file exists,
   `gstack-overlay-emit $_RUNTIME_MODEL` cats the overlay (with `{{INHERIT}}`
   chain resolved).
3. Output goes inside `<system-reminder>` tags — not in the cached prompt
   prefix, so it's cache-safe.

## Composed multi-model workflows (B3)

`/autoplan` now documents per-phase model recommendations in prose:

- **CEO phase**: Opus 4.7 with max effort (or GPT-5.3-Codex with xhigh)
- **Eng phase**: Opus 4.6/4.7 or GPT-5.3-Codex — coding-specialized
- **Design phase**: Sonnet 4.6 or GPT-5.4 — clear rubrics, adaptive is enough
- **DX phase**: Sonnet 4.6 or GPT-5.4 at medium — judgment over depth

Full recommendation matrix in `scripts/subagent-model-map.ts`
`ORCHESTRATION_PHASES` table. Surfaced at Phase 0 of autoplan.

## Multi-model benchmark (B5 — optional)

`test/skill-e2e-multi-model.test.ts` runs the same skill scenario across
multiple models to validate `scripts/thinking-profiles.ts` bucket
recommendations empirically.

**Double-gated** to prevent accidental runs:
```bash
EVALS=1 GSTACK_BENCH_MATRIX=1 bun test test/skill-e2e-multi-model.test.ts
```

Cost: ~$60 per full matrix (5 models × 3 skills). Writes
`docs/MODEL_BENCHMARKS.md`. Use `scripts/bench-matrix.ts` to re-render from
stored results without re-running.

## Future enhancements

- **Per-subagent model overrides** via the Agent tool's optional `model`
  parameter (today we use `subagent_type`; future Claude Code versions may
  accept explicit model selection).
- **Runtime tool allowlist filtering** — currently a skip (A4 cut from plan).
  Would block Spark from using Agent tool since orchestration overhead eats
  its speed advantage. Add when someone actually hits the case.
- **Quality scoring in benchmark harness** — layer `llm-judge.ts` output onto
  the pass-rate metric for semantic comparison, not just completion.
