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

## Future: runtime model detection

Today gstack's model selection is **build-time** — you pass `--model` to `gen-skill-docs` and the SKILL.md files are baked with that overlay. Runtime detection (reading `CLAUDE_MODEL`, `OPENAI_MODEL` env vars and switching overlays on the fly) is a future enhancement.

For now, if your team uses a specific model, generate for it and treat gstack as tuned-for-that-model. If you use multiple models, regenerate when you swap, or pin a specific model in team mode.
