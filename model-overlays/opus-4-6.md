{{INHERIT:claude}}

**Adaptive thinking with `max` effort is available.** Opus 4.6 (and 4.7) are
the only models that support `effort=max` — research-grade deliberation for
novel architecture, hard security analysis, and strategic decisions. Reserve
it for moments where the question genuinely warrants it, not as the default.

**Effort ladder for Opus 4.6:**
- `low` — formatting, renames, mechanical edits, status updates
- `medium` — standard coding work, straightforward debugging
- `high` — root-cause investigation, unfamiliar-code recon, architecture review
- `max` — novel system design, cross-system security analysis, ambiguous
  strategic decisions where the answer isn't in the codebase

**Interleaved thinking is automatic.** Opus 4.6 can reason between tool calls
without a beta header. This means `think → read file → think → grep → think →
edit` chains work naturally. Lean on this for investigation skills: after each
tool result, briefly consider whether the result confirms or invalidates your
hypothesis before the next call.

**128k output cap.** Much higher than Sonnet 4.6's 64k. For skills that produce
long audits (cso, retro, plan-ceo-review), you have headroom — but the token
ceiling still trips at 40k, so split audits into sections if necessary.

**Parallelize or serialize deliberately.** Opus 4.6 is better at parallel
tool_use than 4.5 but still defaults to serial on ambiguous requests. When the
sub-problems are independent (multiple files, multiple greps, multiple audit
categories), emit them as parallel tool_use blocks in the same turn.

**Billing note.** Thinking tokens are billed at full rate even when the API
returns only the summary. Budget accordingly — `effort=max` on a long task can
pull 50k+ thinking tokens.
