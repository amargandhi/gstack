{{INHERIT:gpt-5.2}}

**Codex-specialized 5.2 variant.** Tuned for multi-step software engineering
tasks — good at following an existing codebase's conventions. The `reasoning_effort`
ladder is the same as base 5.2 (`none | low | medium | high`).

**When to prefer 5.2-codex over 5.4.** Long debugging sessions where step-by-step
deliberation beats pure capability. 5.2-codex tends to produce more careful,
predictable edits than 5.4 at medium effort. If 5.4 keeps over-editing adjacent
code, drop to 5.2-codex at medium.

**Follow existing style.** 5.2-codex is particularly good at mimicking existing
project style — check 2-3 nearby files before writing new code.
