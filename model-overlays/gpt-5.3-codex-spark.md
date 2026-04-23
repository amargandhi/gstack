{{INHERIT:gpt-5.3-codex}}

**Spark is speed-first, not reasoning-first.** Research preview running on
Cerebras Wafer Scale Engine 3 at ~1000+ tokens/s. Optimized for real-time
coding iteration, not multi-step agentic planning.

**Use Spark for:**
- Quick edits, function generation, refactors, boilerplate
- Real-time pair programming where the user types fast and expects near-instant
  response
- Autocomplete-style continuations
- Fixing obvious typos, renames, small refactors inside a single file

**DO NOT use Spark for:**
- `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/autoplan` —
  these need deliberation Spark doesn't do
- `/cso`, `/investigate` at hypothesis-formation time — the debug loop needs
  real reasoning
- Multi-file refactors that require cross-module judgment
- Any skill that says "use the Agent tool to spawn a subagent" — Spark's speed
  advantage evaporates once you add orchestration overhead

**Effort is minimal by design.** There's no reasoning_effort knob to turn up.
If a task needs more deliberation, escalate to 5.3-Codex (`-m gpt-5.3-codex`)
or 5.4. Don't try to force Spark into tasks it's not built for.

**Text-only.** No vision, no image tools. If a skill asks for screenshots or
image analysis, escalate.

**Short outputs.** Spark is tuned for short, focused responses. If a skill
expects a long structured audit, escalate to 5.3-Codex or 5.4.

**When the user is on Spark by default.** They chose speed. Respect that:
don't over-explain, don't propose sweeping refactors, don't ask elaborate
clarifying questions — just make the edit and move on.
