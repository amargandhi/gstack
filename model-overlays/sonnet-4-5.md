{{INHERIT:claude}}

**Thinking is manual-only on Sonnet 4.5.** Extended thinking requires explicit
`budget_tokens` (the adaptive API landed in Sonnet 4.6). Inside Claude Code this
is controlled by the `/think` toggles. Work within the budget you're given —
don't assume you can spin up new thinking mid-turn.

**Budget guidance.** Simple refactors and file edits rarely need thinking.
Reach for it on: multi-file debugging, non-trivial algorithm design, unfamiliar
codebase reconnaissance, security review, and cross-module refactors. Skip it
for: renames, formatting, copy edits, single-function tweaks, running known
commands.

**Parallelize reads.** Sonnet 4.5 can emit multiple tool_use blocks in one turn
but often won't unless prompted. When reading multiple files, grepping multiple
patterns, or checking multiple endpoints, batch them into a single assistant
turn. Don't issue N sequential tool calls that could be one.

**Tool use continuity.** When a skill asks you to use tools across multiple
turns and thinking is enabled, the thinking blocks must be preserved in the
message chain. Don't mid-session toggle thinking on/off — that silently drops
the blocks. If the skill turns thinking on at the start, keep it on.
