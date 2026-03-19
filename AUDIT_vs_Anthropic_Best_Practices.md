# gstack Audit: Alignment with Anthropic Claude Code Best Practices

*Audit Date: 2026-03-19*
*Evaluated against: Anthropic "Lessons from Building Claude Code: How We Use Skills" blog post, Claude Code Best Practices (04), Prompting Best Practices (03), Advanced Features (06), and video transcripts from Boris Cherny (V3, V5) and Claude Code engineers (V6).*

---

## Executive Summary

**Overall: STRONG — with notable divergences in 3 areas**

gstack is one of the most sophisticated Claude Code skill suites in existence. It demonstrates deep understanding of how skills should work and pushes boundaries in areas Anthropic hasn't yet formally documented (template-generated skills, shared preambles, contributor field reports, completeness scoring). However, it diverges from Anthropic guidance in several meaningful ways that create real tradeoffs.

### Top Findings

| # | Finding | Verdict | Impact |
|---|---------|---------|--------|
| 1 | Skill descriptions written for humans, not model triggering | DIVERGENCE | Skills may undertrigger in auto-delegation |
| 2 | Shared preamble adds ~200 lines of context to every skill invocation | ISSUE | Significant context cost per skill call |
| 3 | Heavy railroading in workflow skills (review, ship, retro) | DIVERGENCE | Limits Claude's ability to adapt to unusual situations |
| 4 | No explicit gotchas sections (labeled as such) | PARTIAL | Best-practice gotchas are embedded but not structured for easy scanning |
| 5 | Excellent progressive disclosure via filesystem | STRONG ALIGNMENT | Reference files, templates, checklists in subfolders |
| 6 | Outstanding safety architecture (careful/freeze/guard + hooks) | STRONG ALIGNMENT | Layered, on-demand, composable |
| 7 | Error messages designed for AI agents | STRONG ALIGNMENT | Actionable guidance, not stack traces |
| 8 | Single source of truth for commands → docs → tests | STRONG ALIGNMENT | Prevents doc drift, enables validation |
| 9 | No subagent definitions (.claude/agents/) | DIVERGENCE | Missing writer/reviewer patterns |
| 10 | Strong measurement infrastructure (analytics, evals, LLM-judge) | STRONG ALIGNMENT | Exceeds Anthropic's "measure skills" recommendation |

---

## Alignment Highlights (What gstack Does Well)

### 1. Skill Type Coverage

**Anthropic says:** Skills cluster into 9 categories: Library/API Reference, Product Verification, Data Fetching, Business Process, Code Scaffolding, Code Quality, CI/CD, Runbooks, Infrastructure Ops.

**gstack covers 7 of 9:**

| Anthropic Category | gstack Skill(s) | Coverage |
|-------------------|-----------------|----------|
| Library/API Reference | `browse/SKILL.md` (headless browser API) | Full |
| Product Verification | `qa`, `qa-only`, `design-review` | Full |
| Data Fetching & Analysis | `retro` (git analytics, metrics) | Partial |
| Business Process | `ship`, `document-release`, `office-hours` | Full |
| Code Quality & Review | `review`, `codex` (adversarial review) | Full |
| CI/CD & Deployment | `ship` (PR creation, version bump, push) | Full |
| Runbooks | `investigate` (symptom-driven debugging) | Full |
| Code Scaffolding | *(not present)* | Missing |
| Infrastructure Ops | *(not present)* | Missing |

**Verdict: STRONG ALIGNMENT** — Missing scaffolding and infra ops is expected for a productivity suite (not an infrastructure tool). The categories covered are deeply implemented, not surface-level.

---

### 2. Progressive Disclosure via Filesystem

**Anthropic says:** "A skill is a folder, not just a markdown file. Think of the entire file system as a form of context engineering and progressive disclosure."

**gstack implements this extensively:**
- `review/checklist.md` — detailed code review checklist loaded on demand
- `review/greptile-triage.md` — Greptile integration instructions
- `review/design-checklist.md` — design-specific review criteria
- `qa/templates/qa-report-template.md` — QA report template
- `qa/references/issue-taxonomy.md` — bug classification reference
- `freeze/bin/check-freeze.sh` — runtime scope enforcement script
- `bin/gstack-update-check` — version management binary
- `bin/gstack-config` — persistent user preferences
- `bin/gstack-diff-scope` — diff analysis tool
- `browse/dist/browse` — compiled headless browser binary

**Verdict: STRONG ALIGNMENT** — gstack is one of the best examples of treating skills as folders with scripts, assets, references, and binaries. The compiled browser binary inside a skill folder is a creative application of this principle.

---

### 3. Safety Architecture (Swiss Cheese Model)

**Anthropic says (V3, V6):** "Implement safety at multiple layers. No single safety mechanism is perfect — layer them." Use on-demand hooks for opinionated safety. `/careful` and `/freeze` are explicitly cited as examples.

**gstack implements exactly this:**

| Layer | Mechanism | Skill |
|-------|-----------|-------|
| Advisory | CLAUDE.md warns about symlink risk | Project-level |
| On-demand hook | PreToolUse blocks `rm -rf`, `DROP TABLE`, `--force` | `/careful` |
| On-demand hook | PreToolUse blocks Edit/Write outside a directory | `/freeze` |
| Composed | Combines both hook sets | `/guard` |
| Cleanup | Removes freeze boundary | `/unfreeze` |
| Escalation | 3-strike rule, BLOCKED/NEEDS_CONTEXT protocol | `/investigate` |
| Scope lock | `investigate` auto-freezes to debug directory | `/investigate` |

The `/careful` → `/freeze` → `/guard` composition pattern is exactly what Anthropic recommends: "You only want this when you know you're touching prod — having it always on would drive you insane."

**Verdict: STRONG ALIGNMENT** — This is a textbook implementation of layered, composable, on-demand safety hooks. The `investigate` skill's automatic scope-lock via freeze hooks is a novel extension not yet documented by Anthropic.

---

### 4. Error Messages Designed for AI

**Anthropic says (V6):** "Error messages are prompts. Design tools with clear, actionable error messages that guide Claude toward solutions."

**gstack's `server.ts` `wrapError()` translates Playwright errors:**
- Timeout → "Element not found or not interactable. Run `snapshot -i` to see available elements."
- Multiple matches → "Selector matched multiple elements. Use @refs from `snapshot` instead."
- Navigation timeout → "Page may be slow or URL may be wrong."
- Stale ref → "Ref @e3 (button 'Submit') is stale — run snapshot again."
- 3+ consecutive failures → suggests `handoff` (user takes over visible browser)

**Verdict: STRONG ALIGNMENT** — Every error includes what went wrong AND what to do next. The failure-hint escalation (3+ failures → suggest handoff) is a pattern Anthropic should document.

---

### 5. Single Source of Truth

**Anthropic says (V3):** "Simplicity over complex abstractions."

**gstack's command registry pattern:**
- `commands.ts` defines `COMMAND_DESCRIPTIONS`, `READ_COMMANDS`, `WRITE_COMMANDS`, `META_COMMANDS`
- `server.ts` imports for runtime dispatch
- `gen-skill-docs.ts` imports for documentation generation
- `skill-parser.ts` imports for SKILL.md validation
- `skill-check.ts` imports for health dashboard
- Load-time validation ensures descriptions match command sets exactly

One definition → four consumers → zero drift. This is the architectural pattern Anthropic advocates.

**Verdict: STRONG ALIGNMENT**

---

### 6. Measurement Infrastructure

**Anthropic says:** "Use a PreToolUse hook that lets us log skill usage. Find skills that are popular or undertriggering."

**gstack implements:**
- `~/.gstack/analytics/skill-usage.jsonl` — every skill invocation logged with skill name, timestamp, repo
- Session tracking via `~/.gstack/sessions/` — counts concurrent Claude sessions
- Contributor field reports → `~/.gstack/contributor-logs/` — qualitative feedback
- Three-tier test pyramid: static validation (free, <2s) → LLM-as-judge (~$0.15) → E2E via `claude -p` (~$3.85)
- Eval comparison: `eval:compare` diffs two eval runs
- Diff-based test selection to minimize eval cost

**Verdict: STRONG ALIGNMENT** — Exceeds Anthropic's recommendation. The three-tier test pyramid and diff-based eval selection are more sophisticated than what Anthropic has publicly described.

---

### 7. Platform-Agnostic Design

**Anthropic says:** Skills should not hardcode framework-specific commands.

**gstack's CLAUDE.md explicitly mandates:**
> "Skills must NEVER hardcode framework-specific commands, file patterns, or directory structures. Instead: 1. Read CLAUDE.md. 2. If missing, AskUserQuestion. 3. Persist the answer to CLAUDE.md."

Every workflow skill (qa, review, ship) detects the project's test command, framework, and conventions at runtime rather than assuming them. The `qa` skill bootstraps by inspecting HTML, checking for common ports, and falling back to WebSearch.

**Verdict: STRONG ALIGNMENT**

---

### 8. Setup & Config Pattern

**Anthropic says:** "Store setup information in a config.json file in the skill directory. If not set up, the agent asks the user for information."

**gstack uses `gstack-config` binary:**
- Persistent key-value store in `~/.gstack/config.json`
- Stores: `proactive` (suggestions toggle), `gstack_contributor` (field reports), `auto_upgrade` (silent updates)
- Binary accessible via `bin/gstack-config get <key>` / `set <key> <value>`
- Skills read config in preamble, adapt behavior accordingly

**Verdict: STRONG ALIGNMENT**

---

## Issues & Divergences (What Needs Attention)

### ISSUE 1: Skill Descriptions Written for Humans, Not Model Triggering

**Anthropic says:** "The description field is not a summary — it's a description of when to trigger this skill. This listing is what Claude scans to decide 'is there a skill for this request?'"

**gstack's descriptions are mixed:**

| Skill | Description Style | Problem |
|-------|------------------|---------|
| `careful` | "Safety guardrails for destructive commands..." | Human-readable, explains what it does |
| `plan-ceo-review` | "CEO/founder-mode plan review. Rethink the problem..." | Product positioning |
| `office-hours` | "YC Office Hours brainstorming..." | Conceptual framing |
| `design-review` | "Designer's eye QA: finds visual inconsistency..." | Benefit-first |

Compare to Anthropic's recommendation: descriptions should help Claude decide *when to invoke*, not *what the skill does*. Good descriptions would be:
- `careful`: "Use when working with production systems, live databases, or running destructive commands like rm, DROP, or force-push."
- `plan-ceo-review`: "Use when the user wants strategic feedback on a plan — whether the problem is worth solving, if scope is right, or if the approach is fundamentally wrong."

**The root `SKILL.md` partially compensates** by listing all skills with trigger contexts in its description field. But individual skill descriptions don't follow the Anthropic guidance for self-triggering.

**Recommendation:** Rewrite each skill's `description` field to focus on trigger conditions: "Use when the user is doing X" or "Triggers on requests about Y". Keep the human-readable explanation in the skill body, not the frontmatter.

---

### ISSUE 2: Shared Preamble Creates Significant Context Overhead

**Anthropic says (04):** "Most best practices stem from one constraint: Claude's context window fills up fast, and performance degrades as it fills."

**Anthropic says (V6):** "We treat token spending like it's money we're actually spending."

**gstack's preamble adds ~200 lines to every skill invocation:**
- Update check logic (~15 lines)
- Session tracking (~10 lines)
- Contributor mode (~5 lines)
- Proactive suggestions (~5 lines)
- Branch detection (~5 lines)
- Completeness Principle intro (~25 lines)
- AskUserQuestion format (~30 lines)
- Completion Status Protocol (~30 lines)
- Contributor Mode instructions (~40 lines)
- Escalation protocol (~20 lines)
- Analytics logging (~5 lines)

This means a simple `/freeze` invocation (41 lines of actual skill logic) carries 200+ lines of preamble overhead — a 5:1 overhead ratio. For a `/careful` invocation (even smaller), it's worse.

**Mitigation:** The preamble is identical across skills, so Claude may learn to skim it after the first invocation. But each skill invocation within a session still pays the full context cost.

**Recommendation:**
1. Split the preamble into tiers: **essential** (branch, update check, analytics — ~30 lines) and **extended** (completeness principle, contributor mode, AskUserQuestion format — ~170 lines)
2. Only include extended preamble on first skill invocation per session, or move it to a reference file that Claude reads on demand
3. Safety skills (`careful`, `freeze`, `guard`, `unfreeze`) should use minimal preamble — they're quick tools, not full workflows

---

### ISSUE 3: Heavy Railroading in Workflow Skills

**Anthropic says:** "Give Claude the information it needs, but give it the flexibility to adapt to the situation." Show a screenshot of "Don't" being "1. Do X. 2. Do Y. 3. Do Z." and "Do" being guidelines with decision points.

**gstack's workflow skills are heavily prescriptive:**
- `/review`: 2-pass review with strict categories, mandatory Greptile integration, required TODOS cross-reference
- `/ship`: Linear sequence of ~15 steps (merge → tests → review → version → changelog → commit → push → PR) with no flexibility on ordering
- `/retro`: 14 sequential steps with specific git commands for each metric
- `/qa`: 11 phases with explicit phase numbering

**Why this matters:** When Claude encounters an unusual situation (e.g., no VERSION file, non-standard git workflow, monorepo), the rigid step sequence can cause it to get stuck rather than adapt. The Anthropic blog specifically warns against this with the "railroading" anti-pattern.

**Where gstack gets it right:** The `/browse` skill is correctly flexible — it's a reference tool, not a workflow. `/office-hours` has decision gates. `/investigate` has the 3-strike escalation.

**Recommendation:**
1. Convert numbered steps to **decision trees** with explicit "if X, skip to Y" branches
2. Add "ADAPT" sections that tell Claude when it's OK to deviate from the default flow
3. For `/ship`, make steps modular: "If no VERSION file exists, skip the version bump step"
4. For `/retro`, allow partial execution: "If git history is unavailable, skip metric collection and focus on qualitative analysis"

---

### ISSUE 4: No Explicit "Gotchas" Sections

**Anthropic says:** "The highest-signal content in any skill is the Gotchas section. These sections should be built up from common failure points that Claude runs into."

**gstack does not use labeled "Gotchas" sections.** Instead, gotcha-equivalent content is scattered throughout skills:
- `qa/SKILL.md` line 686: "Important Rules" (11 numbered rules)
- `review/SKILL.md` line 362: rationalization prevention
- `investigate/SKILL.md` line 263: "Red flags" (4 anti-patterns)
- `retro/SKILL.md` line 637: "Tone" section
- `design-consultation`: "Never recommend blacklisted fonts"
- `document-release`: "NEVER CLOBBER CHANGELOG ENTRIES"

**Why this matters:** Anthropic's guidance is that a consolidated "Gotchas" section is easier for Claude to reference and apply. Scattered warnings are more likely to be missed, especially as context fills.

**Recommendation:**
1. Add a clearly labeled `## Gotchas` section near the top of each skill (after setup, before workflow)
2. Consolidate scattered warnings into this section
3. Build up gotchas over time from contributor field reports (which gstack already collects)

---

### ISSUE 5: No Subagent Definitions

**Anthropic says (06):** "Define specialized assistants in `.claude/agents/`. Create project-specific subagents for team sharing."

**Anthropic says (V3):** "Use the writer/reviewer pattern. One writes code, another reviews it."

**Anthropic says (V6):** "Sub-agents should have independent context windows uncorrelated to the main agent's state."

**gstack has no `.claude/agents/` directory.** All skills are self-contained workflows. There are no:
- Security reviewer subagent
- Code quality checker subagent
- Test writer subagent

**The `/codex` skill partially fills this gap** by running OpenAI's Codex as an adversarial reviewer, but this is an external tool, not a Claude Code subagent.

**Why this matters:** The writer/reviewer pattern (V3, V6) is one of Anthropic's highest-confidence recommendations. The review quality from a fresh-context reviewer (separate subagent) is significantly better than review from the same agent that wrote the code.

**Recommendation:**
1. Create `.claude/agents/security-reviewer.md` — reviews code for injection, auth, secrets
2. Create `.claude/agents/test-writer.md` — generates tests from implementation with fresh context
3. Create `.claude/agents/adversarial-reviewer.md` — replace `/codex` dependency with native subagent

---

### ISSUE 6: Description Field Doubles as Skill Router

**Anthropic says:** Skills should have focused descriptions. The root skill should not try to be a skill router.

**gstack's root `SKILL.md` description field (lines 4-41) contains an entire routing table:**
```yaml
description: |
  Fast headless browser for QA testing...

  gstack also includes development workflow skills. When you notice the user is at
  these stages, suggest the appropriate skill:
  - Brainstorming a new idea -> suggest /office-hours
  - Reviewing a plan (strategy) -> suggest /plan-ceo-review
  ...
```

This 40-line description is loaded into context for **every session** as part of the skill listing. It adds significant context cost even when the user never uses any gstack skill.

**Recommendation:**
1. Move the routing table out of the description field into the skill body
2. Keep the description focused: "Fast headless browser for QA testing. Also includes /review, /qa, /ship, and other workflow skills. Use when testing features, reviewing code, or shipping changes."
3. Let individual skill descriptions handle their own trigger conditions

---

### ISSUE 7: Completeness Principle May Conflict with Anthropic's "Avoid Over-Engineering"

**Anthropic says (03):** "Avoid over-engineering. Only make changes directly requested or clearly necessary. Don't add features, refactor code, or make 'improvements' beyond what was asked."

**gstack says:** "AI-assisted coding makes the marginal cost of completeness near-zero. Always recommend the complete option over shortcuts. Don't skip the last 10%."

**This is a genuine philosophical divergence.** Anthropic's guidance is conservative: do what was asked, nothing more. gstack's Completeness Principle pushes for maximum coverage. Both have merits:
- Anthropic's approach prevents scope creep and respects user intent
- gstack's approach leverages AI's low marginal cost to deliver more value

**The risk:** The Completeness Principle can cause Claude to gold-plate work, add unnecessary edge case handling, or resist "good enough" solutions when the user explicitly wants something quick.

**Recommendation:**
1. Add a calibration note: "The Completeness Principle applies to *tasks the user has committed to*. It does NOT mean expanding scope or adding unrequested features."
2. Respect explicit user requests for quick/partial work: "If the user says 'just the happy path' or 'quick fix', override the Completeness Principle."

---

### ISSUE 8: Template Generation Prevents Direct Skill Editing

**Anthropic says:** "CLAUDE.md evolves with your project. Delete, add, and refactor it regularly." And for skills: "Build up gotchas over time."

**gstack's template system:**
- SKILL.md files are AUTO-GENERATED from `.tmpl` templates
- Header warns: `<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->`
- Changes require editing `.tmpl` → running `bun run gen:skill-docs` → committing both

**Why this matters:** The template system ensures doc consistency and prevents drift (a real benefit). But it also creates friction for iterative improvement. When Claude encounters a new gotcha during execution, it can't directly append it to the SKILL.md — it needs to edit the template, understand placeholders, and rebuild. This conflicts with Anthropic's "failure-driven evolution" principle.

**Recommendation:**
1. Add a `## Local Gotchas` section at the bottom of each SKILL.md that is **not** overwritten by the template generator
2. Or: have the contributor field report system (`~/.gstack/contributor-logs/`) automatically feed into a gotchas accumulator that the template system incorporates

---

## Dimension-by-Dimension Analysis

### Dimension 1: Skill Structure & Types
**Verdict: STRONG ALIGNMENT**
- 22 skills covering 7 of 9 recommended categories
- Each skill cleanly fits one category (no straddling)
- Well-defined boundaries between related skills (qa vs qa-only, review vs codex)

### Dimension 2: Skill Descriptions (Trigger Quality)
**Verdict: DIVERGENCE**
- Descriptions written for humans (what it does), not model triggering (when to use it)
- Root SKILL.md compensates with routing table, but this adds context overhead
- Individual skills would undertrigger in auto-delegation scenarios

### Dimension 3: Gotchas & Progressive Disclosure
**Verdict: PARTIAL ALIGNMENT**
- Progressive disclosure: STRONG (filesystem, reference files, scripts, binaries)
- Gotchas: PARTIAL (content exists but not structured in labeled sections)

### Dimension 4: CLAUDE.md Quality
**Verdict: STRONG ALIGNMENT**
- Includes build commands, testing instructions, project structure
- Includes what Claude can't guess: commit style, eval blame protocol, symlink awareness
- Excludes standard language conventions
- Living doc: failure-driven additions (eval blame protocol, vendored symlink warning)
- One concern: at 222 lines, it's approaching the "too long" threshold. If Claude starts ignoring rules, consider pruning

### Dimension 5: Context Management
**Verdict: PARTIAL ALIGNMENT**
- Server architecture is context-efficient (persistent daemon, ref system reduces queries)
- Chain command enables batching
- **But:** shared preamble adds ~200 lines per skill invocation
- **But:** root SKILL.md routing table in description adds ~40 lines to global skill listing
- No explicit token budgeting or awareness in skill design

### Dimension 6: Safety & Permissions
**Verdict: STRONG ALIGNMENT**
- Swiss cheese model: advisory (CLAUDE.md) + hooks (careful/freeze) + escalation (3-strike rule)
- On-demand hooks: exactly what Anthropic recommends
- Composable: guard = careful + freeze
- Default deny: explicit `allowed-tools` in every skill frontmatter
- URL validation blocks cloud metadata endpoints
- Bearer token auth on localhost
- State file permissions (0o600)

### Dimension 7: Verification & Testing
**Verdict: STRONG ALIGNMENT**
- Painter analogy realized: screenshot + snapshot system gives Claude visual verification
- Three-tier test pyramid: static → LLM-judge → E2E
- `snapshot -D` (diff mode) provides before/after verification
- `is` command provides programmatic assertions
- Annotated screenshots (`-a`) for evidence-based bug reports
- Handoff/resume for human-in-the-loop verification

### Dimension 8: Prompting Patterns
**Verdict: PARTIAL ALIGNMENT**
- AskUserQuestion format is excellent (re-ground, simplify, recommend, options)
- Platform-agnostic design avoids hardcoding
- Escalation protocol prevents infinite loops
- **But:** workflow skills railroad rather than guide (see Issue 3)
- **But:** Completeness Principle can push Claude toward over-engineering (see Issue 7)

### Dimension 9: Hook Usage
**Verdict: STRONG ALIGNMENT**
- On-demand hooks for safety (careful, freeze, guard) — exactly per Anthropic's examples
- PreToolUse hooks with bash validation scripts
- Hooks composed across skills (guard = careful + freeze)
- `/investigate` auto-engages freeze hooks — creative extension
- Hooks are NOT always-on (which Anthropic explicitly warns against)

### Dimension 10: Distribution & Composition
**Verdict: STRONG ALIGNMENT**
- Skills checked into repo (`.claude/skills/gstack/`)
- Version tracking per skill (frontmatter `version:`)
- Update check system with auto-upgrade option
- Analytics tracking for usage measurement
- Contributor mode for field reports
- Template generation ensures consistency across distribution
- **Minor gap:** no plugin marketplace packaging yet (skills are repo-based only)

---

## Prioritized Recommendations

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Rewrite skill descriptions for model triggering | Low (text changes) | Fixes undertriggering |
| P0 | Split preamble into essential (~30 lines) and extended (~170 lines) | Medium | Major context savings |
| P1 | Add labeled `## Gotchas` sections to each skill | Low | Better failure prevention |
| P1 | Add flexibility/adapt sections to workflow skills | Medium | Reduces railroading |
| P1 | Trim root SKILL.md routing table from description field | Low | Context savings |
| P2 | Create `.claude/agents/` with security-reviewer, test-writer | Medium | Enables writer/reviewer pattern |
| P2 | Add "Local Gotchas" section preserved by template generator | Low | Enables failure-driven evolution |
| P2 | Add calibration note to Completeness Principle | Low | Prevents over-engineering |
| P3 | Package as Claude Code plugin for marketplace | High | Broader distribution |

---

## Appendix: Source References

### Anthropic Sources
- "Lessons from Building Claude Code: How We Use Skills" (official blog, March 2026)
- Claude Code Best Practices guide (04_Claude_Code_Best_Practices.md)
- Prompting Best Practices (03_Prompting_Best_Practices.md)
- Claude Code Advanced Features (06_Claude_Code_Advanced_Features.md)
- V3: Building Claude Code Deep Dive (Boris Cherny)
- V5: Private Lesson Cowork and Code (Boris Cherny)
- V6: Inside Claude Code Engineers

### gstack Files Evaluated
- `CLAUDE.md` (222 lines)
- `SKILL.md` + `SKILL.md.tmpl` (root skill, 554 lines generated)
- 21 additional SKILL.md files across skill directories
- `browse/src/server.ts` — error handling, auth, dispatch
- `browse/src/commands.ts` — command registry
- `browse/src/snapshot.ts` — ref system, flags
- `browse/src/url-validation.ts` — security
- `browse/src/config.ts` — state management
- `scripts/gen-skill-docs.ts` — template system
