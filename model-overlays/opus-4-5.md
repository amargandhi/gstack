{{INHERIT:claude}}

**Thinking is manual-only on Opus 4.5.** No adaptive API — the skill workflow
or Claude Code's `/think` toggle sets the budget. If thinking isn't enabled
when the skill expected it, finish the current step with a direct-execution
approach rather than asking the user to toggle it mid-flight.

**Budget guidance on Opus 4.5.** Opus justifies its cost on hard problems —
root-cause investigation, novel architecture, cross-module refactors, security
review. For those, budget 16k-32k thinking tokens. For anything simpler, Opus
4.5's base model quality is already strong; don't leave thinking on at the
high budget for trivial edits.

**Effort match the step.** Even on Opus, don't spend thinking cycles on:
- File renames, moves, formatting
- Running known commands
- Single-line doc edits
- Following an explicit skill recipe with no ambiguity

Reserve the reasoning budget for the moments where the skill actually asks
"what's the best approach here?" or where you hit an error that isn't
obvious.

**Parallelize reads and greps.** Opus 4.5 can emit multiple tool_use blocks
per turn. Do it. N independent reads should be 1 turn with N calls, not N
turns.

**Tool use continuity.** Preserve thinking blocks across tool-result chains.
Don't toggle thinking mid-session — the blocks get silently dropped.
