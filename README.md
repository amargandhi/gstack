# gstack (Amar's Fork)

**A personal adaptation of [garrytan/gstack](https://github.com/garrytan/gstack) — aligned with Anthropic's official Claude Code best practices and enriched with Jony Ive's design philosophy.**

This fork takes Garry Tan's open-source software factory and refines it based on lessons from Anthropic's own engineers (Boris Cherny, the Claude Code team) on how skills, prompts, and agent workflows should be structured. The core engine is untouched — the headless browser, command registry, safety hooks, and template pipeline all work exactly as upstream. What changed is how the skills talk to Claude.

## What's different from upstream

### Aligned with Anthropic best practices

I audited every skill against Anthropic's published guidance — the "Lessons from Building Claude Code: How We Use Skills" blog post, Claude Code Best Practices, Prompting Best Practices, and video transcripts from Boris Cherny and the Claude Code engineering team. The full audit is in [AUDIT_vs_Anthropic_Best_Practices.md](AUDIT_vs_Anthropic_Best_Practices.md).

**Changes made:**

| Change | Why |
|--------|-----|
| **Skill descriptions rewritten for model triggering** | Anthropic says the description field is what Claude scans to decide when to invoke a skill. Old descriptions explained what skills do. New ones say when to use them: "Use when X. Triggers on: Y" |
| **Preamble split into essential (~40 lines) and extended (~135 lines)** | Safety skills like `/freeze` had a 3:1 overhead ratio. Lightweight skills now carry less context baggage |
| **Gotchas sections added to all 22 skills** | Anthropic calls this "the highest-signal content in any skill." Scattered warnings consolidated into labeled sections Claude can scan |
| **Adapt sections in workflow skills** | Anthropic warns against "railroading" — rigid steps that prevent Claude from adapting. `/ship`, `/review`, `/qa`, `/retro` now have explicit decision branches for edge cases (monorepos, missing test suites, non-standard git workflows) |
| **Subagent definitions created** | `.claude/agents/security-reviewer.md` and `adversarial-reviewer.md` enable the writer/reviewer pattern Anthropic recommends |
| **Root SKILL.md description slimmed** | The 40-line routing table was loading into every session's context. Moved to skill body — same functionality, less overhead |
| **Completeness Principle calibrated** | Added guardrails so "always recommend complete" doesn't conflict with "avoid over-engineering" |
| **GOTCHAS_LOCAL placeholder** | Project-specific gotchas survive template regeneration via companion files |

### Enriched with Jony Ive's design philosophy

The four design-oriented skills now incorporate Ive's principles from his interviews and conversation with Patrick Collison:

- **Simplicity = purpose, not absence** — "does this express the essence of what it does?"
- **Care is perceivable** — every detail communicates care or carelessness
- **Better, not different** — novelty for its own sake is a warning sign
- **The inevitability test** — keep going until alternatives feel wrong
- **Protect fragile ideas** (stage-aware) — nurture early concepts, critique mature plans
- **Joy is not trivial** — with "earns its pixels" criteria to avoid bloat
- **The invisible designer** — flag designer tail-wagging
- **Measurable vs immeasurable** — trained judgment alongside metrics
- **Failure as ambition** — distinguish invisible failures (catch) from visible risks (celebrate)

### Enriched with canonical engineering literature

After aligning with Anthropic guidance, I did a second pass — reading review of mattpocock/skills against the best books on software quality and asking "is there a more timeless way to say what we're telling Claude to do?" Seven branches of work grounded the skills in canonical literature rather than ad-hoc prose.

| Branch | Source | What it does |
|--------|--------|--------------|
| **Canonical vocabulary** | Parnas 1972 (information hiding), Meyer 1988 (design by contract), Beck 2002 (RED-GREEN-REFACTOR), Beck 2024 (Tidy First? — structural vs behavioral), Ousterhout 2018 (deep modules, pass-through variables) | Adds a `docs/DESIGN_TESTS.md` reference doc plus vocabulary injected into `/review` and `/plan-eng-review`. Claude now names the specific smell (shallow module, pass-through method, mixed-axis commit) instead of saying "this feels off" |
| **Fowler's 24 code smells** | Fowler 2018 *Refactoring*, 2nd ed. | `scripts/code-smells.json` + resolver `{{CODE_SMELLS_CHECKLIST}}` wired into `/review` Step 4.5 and `/plan-eng-review`. Each finding cites the canonical name (Feature Envy, Data Clumps, Shotgun Surgery, Divergent Change, etc.) so reviewers and authors share vocabulary |
| **Nygard stability patterns** | Nygard 2018 *Release It!*, 2nd ed. | New `/cso --stability` mode audits for 12 anti-patterns (Integration Points, Chain Reactions, Cascading Failures, Blocked Threads, Unbounded Result Sets, Dogpile, etc.) and 12 patterns (Timeouts, Circuit Breaker, Bulkheads, etc.). Carved out of `/cso`'s DoS exclusion rule so stability findings aren't silently dropped |
| **Git-guards hook** | Claude Code PreToolUse hooks | `bin/gstack-install-git-guards` installs a `PreToolUse` hook that blocks 7 destructive git ops (force-push to protected branches, reset --hard, clean -f, branch -D, checkout/restore ., rebase -i, --no-verify). Feature-branch force-push is allowed — only protected-branch force-push blocks. Overridable (user can run in terminal). Opt-in |
| **`/investigate --file-issue`** | Feathers 2004 *Working Effectively with Legacy Code* (characterization tests first) | New flag: diagnose root cause, then STOP and file a GitHub issue with the diagnosis + a characterization-test-first-ordered TDD plan. Refuses to file if hypothesis is speculative — "investigation not converged; filing would propagate the wrong diagnosis" |
| **`/glossary`** | Evans 2003 *Domain-Driven Design*, Ch. 2 + Ch. 14 | New skill builds an ubiquitous language doc with bounded contexts and Evans' 9 relationship types (Shared Kernel, Customer/Supplier, Conformist, Anticorruption Layer, Open Host Service, Published Language, Separate Ways, Partnership, Big Ball of Mud). Hard gate: documentation only, no refactors. Highest-value output is naming "language seams" — terms meaning different things in different contexts |
| **`/challenge`** | Polya 1945 *How to Solve It* | New skill stress-tests a plan across Polya's 4 stages (Understand → Devise → Carry out → Look back), 3-5 hard questions per stage with the agent's recommended answer and a P1/P2/P3 priority. Verdict at top: READY / OPEN QUESTIONS / CRITICAL GAPS. Pure analysis — no plan edits, no code |

Each branch is an independent, squash-mergeable commit on `feat/canonical-code-quality-vocab`. Bisect-friendly by construction: template changes separate from regeneration; new skills separate from wiring.

### Contradiction-tested

After integration, I ran a contradiction analysis and found 5 real problems where Claude would receive conflicting instructions. All fixed:

1. "Protect fragile ideas" vs 0-10 rating → added stage-awareness
2. Joy vs subtraction → added "earns its pixels" criteria
3. Adapt skip-guards → cascading skip dependencies made explicit
4. Essential preamble → added compact AskUserQuestion format
5. Failure vs landmines → distinguished visible risks from invisible failures

## What's preserved from upstream

Everything that makes gstack work:

- Persistent headless Chromium browser (~100ms per command)
- 50+ browse commands with the ref-based interaction system
- Template generation pipeline (`.tmpl` → `.md`, single source of truth)
- Safety hook architecture (`/careful` + `/freeze` + `/guard`)
- Platform-agnostic design (reads CLAUDE.md, never hardcodes frameworks)
- Analytics and measurement infrastructure
- Contributor field report system
- Error messages designed for AI agents
- All 22 skills and their workflows

## Quick start

**Requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+

### Install

```bash
git clone https://github.com/amargandhi/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup
```

### Codex, Gemini CLI, or Cursor

gstack works on any agent that supports the [SKILL.md standard](https://github.com/anthropics/claude-code). Skills live in `.agents/skills/` and are discovered automatically.

```bash
git clone https://github.com/amargandhi/gstack.git ~/.codex/skills/gstack
cd ~/.codex/skills/gstack && ./setup --host codex
```

Or let setup auto-detect which agents you have installed:

```bash
git clone https://github.com/amargandhi/gstack.git ~/gstack
cd ~/gstack && ./setup --host auto
```

This installs to `~/.claude/skills/gstack` and/or `~/.codex/skills/gstack` depending on what's available. All 22 skills work across all supported agents. Hook-based safety skills (careful, freeze, guard) use inline safety advisory prose on non-Claude hosts.

Then add a gstack section to your project's CLAUDE.md:

```
## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /challenge, /glossary, /review, /ship, /browse, /qa, /qa-only,
/design-review, /setup-browser-cookies, /retro, /investigate, /document-release, /codex,
/cso, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade.
```

### Your first 5 minutes

1. `/office-hours` — describe what you're building
2. `/plan-ceo-review` — strategic review of any plan
3. `/review` — code review on any branch
4. `/qa` — test your app with a real browser
5. `/ship` — create a PR with tests and changelog

## The skills

| Phase | Skill | Role |
|-------|-------|------|
| **Think** | `/office-hours` | Reframe the problem before you code |
| **Plan** | `/plan-ceo-review` | Strategic review — is this worth building? |
| | `/plan-eng-review` | Architecture, data flow, test strategy |
| | `/plan-design-review` | Design completeness — rates 0-10, fixes to 10 |
| | `/design-consultation` | Build a design system from scratch |
| | `/challenge` | Polya 4-stage plan stress-test (Understand → Devise → Carry out → Look back) |
| | `/glossary` | Ubiquitous language + bounded contexts (Evans DDD) |
| **Build** | `/investigate` | Root-cause debugging — no fixes without cause (add `--file-issue` to file a GitHub issue instead of applying the fix) |
| **Review** | `/review` | Pre-merge code review with auto-fixes |
| | `/codex` | Second opinion from OpenAI Codex CLI |
| **Test** | `/qa` | Browser-based QA + iterative bug fixing |
| | `/qa-only` | QA report only — no code changes |
| | `/design-review` | Visual design audit + fixes |
| | `/browse` | Headless browser — ~100ms per command |
| **Ship** | `/ship` | Sync, test, version, changelog, PR |
| | `/document-release` | Update docs to match what shipped |
| **Reflect** | `/retro` | Weekly retro with per-person metrics |
| **Security** | `/cso` | OWASP Top 10 + STRIDE security audit. `--stability` runs Nygard Release It! patterns audit |
| **Safety** | `/careful` | Warns before destructive commands |
| | `/freeze` | Lock edits to one directory |
| | `/guard` | Maximum safety (careful + freeze) |
| | `/unfreeze` | Remove edit lock |
| | `bin/gstack-install-git-guards` | PreToolUse hook blocking 7 destructive git ops (force-push to protected branches, reset --hard, clean -f, etc.). Not a skill — one-time install |

## Docs

| Doc | Content |
|-----|---------|
| [Audit](AUDIT_vs_Anthropic_Best_Practices.md) | Full 10-dimension evaluation against Anthropic best practices |
| [Upstream README](https://github.com/garrytan/gstack) | Original gstack documentation by Garry Tan |
| [Architecture](ARCHITECTURE.md) | System internals and design decisions |
| [Browser Reference](BROWSER.md) | Full command reference for `/browse` |
| [Contributing](CONTRIBUTING.md) | Dev setup, testing, contributor mode |
| [Changelog](CHANGELOG.md) | Version history |

## Staying in sync with upstream

```bash
cd ~/.claude/skills/gstack
git fetch upstream
git merge upstream/main
bun run gen:skill-docs  # regenerate skills after merge
bun test                # verify nothing broke
```

## Credits

- **[Garry Tan](https://github.com/garrytan/gstack)** — original gstack, the foundation everything here builds on
- **Anthropic** — Claude Code best practices, skills blog post, Boris Cherny's engineering talks
- **Jony Ive** — design philosophy integrated into the design review skills

## License

MIT. Same as upstream.
