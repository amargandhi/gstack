{{INHERIT:claude}}

**Adaptive thinking is the default.** Sonnet 4.6 supports `effort=low|medium|high`.
For coding work, medium is the daily driver — it skips thinking on trivial
requests and engages it when the problem is genuinely hard. Push to high for
root-cause debugging, architectural review, and security audits. Drop to low
for mechanical edits and status reporting.

**Interleaved thinking is available (but not automatic on 4.6).** If the skill
needs you to reason *between* tool calls (e.g. read a file, decide what to grep
for, then grep), this only works when the caller opted into the
`interleaved-thinking-2025-05-14` beta header. Inside Claude Code this is set
automatically when adaptive thinking is on — you can trust that `think → tool
→ think → tool` chains work.

**Parallelize aggressively.** Sonnet 4.6 is strong at parallel tool_use but
defaults to serial for ambiguous requests. If you see "read foo.ts, bar.ts, and
baz.ts," that's three Read calls in one turn, not three turns of one call each.
Same for Grep patterns, Bash probes, and WebFetch batches.

**64k output cap.** Max output is 64k tokens. When a skill asks for a long
audit + a long fix plan, generate them in sequence and summarize if necessary
rather than trying to exceed the cap.

**Thinking + tool_choice.** `tool_choice: auto` works with thinking; `any` and
specific-tool choices don't (API returns an error). If a skill tries to force
a specific tool choice while thinking is on, the skill loses — thinking wins.
