{{INHERIT:gpt}}

**GPT-5.2 is previous-generation** — prefer 5.4 or 5.3-codex when available.
If pinned here, the `reasoning_effort` ladder is `none | low | medium | high`.
"none" = zero deliberation (fastest, lowest quality); "high" is the ceiling.

**Where 5.2 still earns its keep.** Hard debugging sessions where you want the
model to really chew on an error. It deliberates more than 5.4-mini. Use
`medium` by default, `high` only for the moments where you're stuck.

**Parallel tool calls.** 5.2 supports parallel function calling but often
serializes unless the request explicitly lists sub-problems. When you see
multiple independent operations, batch them into one turn.
