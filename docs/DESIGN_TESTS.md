# Named Tests from the Canon

Sharp vocabulary shortcuts long debates. This is gstack's curated set of named design tests pulled from primary sources (not paraphrases). Skills reference individual tests by section; reviewers use them as grep-able criteria.

Each test: **Name** — Source — Rule — When to apply.

---

## Module depth

**Ousterhout, *A Philosophy of Software Design*, 2018 (Ch. 4–6).**

A deep module has a **small interface hiding a large implementation**. A shallow module has an interface nearly as wide as its implementation, hiding nothing. Prefer deep.

Red flags to grep for (Ousterhout names these explicitly):

- **Pass-through method** — a method that does little except invoke another method with a similar signature. Adds interface cost without hiding anything. Example: `UserController.findUser(id) { return userService.findUser(id) }`.
- **Pass-through variable** — a variable threaded down many layers and consumed only at the bottom. Every intermediate layer is coupled to it. Example: passing `requestId` through 6 function signatures just so the logger at the bottom can include it.
- **Thin wrappers** — Decorator pattern applied reflexively, or a class that wraps a widely-used API by a hair. Ousterhout calls out Java's IO stream layers as the canonical anti-example.

**Apply in:** `/review`, `/plan-eng-review` (module audit). When a plan adds a module, ask depth first. When `/review` sees a PR with one-liner wrappers, flag pass-through.

## Design it twice

**Ousterhout, *A Philosophy of Software Design*, 2018 (Ch. 11).**

Your first interface idea is unlikely to be the best. Generate **≥ 2 radically different** designs with different constraints (minimalist / flexible / common-case-optimized / ports-and-adapters), compare on simplicity vs generality vs depth, then pick. Design twice before implementing.

**Apply in:** `/plan-eng-review` (when reviewing a plan's interface choices — did the author consider alternates?). `/autoplan` could orchestrate this as parallel subagents.

## Information hiding + design by contract

**Parnas, *On the Criteria to Be Used in Decomposing Systems into Modules*, CACM 1972** + **Meyer, *Object-Oriented Software Construction*, 1988 (Ch. 11).**

A module is defined by (a) what it **promises callers** (the contract: pre/post conditions, invariants) and (b) what it **hides** (implementation choices that can change without breaking callers). File paths, class names, line numbers are implementation — not contract. Describe changes, bugs, and fix plans in terms of contracts and hidden choices; paths go in an appendix.

**Apply in:** `/investigate` (bug reports + fix plans), `/plan-eng-review` (proposed module boundaries), any skill that files GitHub issues. A good diagnosis reads like a spec. A bad one reads like a diff.

## Characterization tests first

**Feathers, *Working Effectively with Legacy Code*, 2004 (Ch. 13).**

When changing untested code: first write tests that **lock down current behavior — including bugs and quirks**. Run them. Green. Then make your change. If a characterization test starts failing for a reason you didn't expect, your change has a side effect you didn't know about.

The goal is not correctness (the current behavior may be wrong). The goal is **behavioral preservation where you haven't intentionally changed things**.

**Apply in:** `/investigate` when the code path has no existing tests. `/plan-eng-review` when reviewing refactor plans that touch untested areas. Always order: characterize → change → verify characterization still green except where intentionally changed.

## RED → GREEN → REFACTOR

**Beck, *Test-Driven Development by Example*, 2002.**

One failing test (RED). Minimal code to pass (GREEN). Clean up with tests green (REFACTOR). Repeat. **One cycle at a time — never "write all tests, then all code."** Writing all tests up-front produces imagined-behavior tests that break on the first real contact with the domain.

**Apply in:** `/investigate` fix plans, `/qa` when adding coverage. When a fix needs N tests, the output is N RED→GREEN cycles, not a bundle of pre-written tests followed by a bundle of pre-written code.

## Structural vs behavioral commits

**Beck, *Tidy First? A Personal Exercise in Empirical Software Design*, 2024.**

A commit is either **structural** (rename, extract, move, dead-code removal, reformat — tests pass identically before and after without modification) or **behavioral** (adds, changes, or removes user-visible behavior — tests change, are added, or start passing). **Never mix both in one commit.** If a branch needs both, split: structural commit first ("make the change easy"), then behavioral ("then make the easy change").

This is sharper than generic "bisect commits" — it names the axis to bisect on.

**Apply in:** `/ship` Step 15 (commit splitting), any review of a commit or PR.

## Tracer bullets ≠ prototypes ≠ walking skeleton

**Hunt & Thomas, *The Pragmatic Programmer*, 1999 (Ch. 2) + Freeman & Pryce, *Growing Object-Oriented Software, Guided by Tests*, 2009 (Ch. 4).**

Three distinct ideas commonly confused:

| Term | What it is | Keep or discard |
|---|---|---|
| **Tracer bullet** | Thin end-to-end production-quality code exercising all layers, grown feature by feature | **Keep** — becomes the skeleton of the final system |
| **Prototype** | Disposable exploratory code aimed at a specific question (UI, algorithm, perf) | **Discard** after the question is answered |
| **Walking skeleton** | Minimal deployable end-to-end pipeline with zero features — proves the architecture and the deployment | **Keep** — becomes the first production push |

**Apply in:** `/autoplan` when greenfield → walking-skeleton first. `/investigate` may use a prototype to isolate a reproduction — but code produced this way is not part of the fix. `/ship` for greenfield's first deploy targets the walking skeleton.

## Conceptual integrity

**Brooks, *The Mythical Man-Month*, 1975 (Ch. 4–5).**

> It is better to have a system omit certain anomalous features and improvements, but to reflect one set of design ideas, than to have one that contains many good but independent and uncoordinated ideas.

When a plan adds features that fight the existing design's logic, flag it. When a plan introduces a second idiom for something the codebase already has one idiom for, flag it. One coherent mind > more functionality.

**Apply in:** `/plan-ceo-review`, `/plan-eng-review`. Reviewers earn their keep by spotting anomalies that violate the codebase's implicit design voice.

---

## How to cite in a review

In prose: name the test, cite the book in parentheses on first use per session.

> "This endpoint has a pass-through method (Ousterhout, *Philosophy of Software Design*) — `UserController.find` adds nothing over `userService.find`. Delete the controller method, hit the service directly."

> "The fix plan is paths and line numbers, not contracts (Parnas/Meyer). Reformulate: what does `auth.validateSession` promise callers after this change?"

> "Commit 3 mixes a rename with a behavior change (Beck, *Tidy First?*). Split into two."

Sourcing strengthens the critique. "I think" is disputable; Ousterhout is not.

## How to add a test to this doc

Keep entries tight (name / source / rule / when). Only primary sources. If the rule is a paraphrase of another rule already here, don't add it — refine the existing one.
