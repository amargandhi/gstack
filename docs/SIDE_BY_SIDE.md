# Running gstack and gstack-ag side-by-side

This fork can install itself under a custom brand name (e.g. `gstack-ag`) so it coexists with Garry Tan's canonical `gstack`. You can have both installed at the same time and flip which one owns the short skill names (`/qa`, `/ship`, `/review`, etc.) without uninstalling either.

## The model

Three layers:

| Layer | Example | What it does |
|---|---|---|
| **Install directory** | `~/.claude/skills/gstack/` or `~/.claude/skills/gstack-ag/` | Lives forever. Each brand has its own install dir. |
| **Prefixed skills** | `/gstack-qa`, `/gstack-ag-qa` | Always available. Each brand owns its prefixed names, doesn't collide. |
| **Short skills** | `/qa`, `/ship`, `/review` | Owned by exactly ONE brand at a time — the **active** one. Flips via `gstack-switch`. |

The active brand owns the short names. The other brands are still usable via their prefix. Every skill invocation prints `GSTACK_ACTIVE:` so you know which one you just called.

## Install this fork as `gstack-ag`

From the root of this repo:

```bash
./bin/gstack-install-brand gstack-ag
```

What it does:
1. Regenerates all SKILL.md files with `GSTACK_BRAND=gstack-ag` (paths now reference `~/.claude/skills/gstack-ag/` and data dir `~/.gstack-ag/`)
2. Creates `~/.claude/skills/gstack-ag/` symlink to this repo
3. Creates prefixed skill symlinks `gstack-ag-qa`, `gstack-ag-ship`, etc.
4. Does **not** touch the short names (`/qa`, `/ship`) — you control that via `gstack-switch`
5. Does **not** touch any existing `~/.claude/skills/gstack/` install — they coexist

## Install Garry's gstack alongside

Clone his repo to a separate directory and run his setup:

```bash
git clone https://github.com/garrytan/gstack ~/Developer/gstack-upstream
cd ~/Developer/gstack-upstream
./setup
```

His setup creates `~/.claude/skills/gstack/` (install dir) + `gstack-qa`, `gstack-ship` symlinks. No conflict with your `gstack-ag` install.

## Select which one is "active"

```bash
# See which is currently active
gstack-switch

# Flip to gstack-ag
gstack-switch gstack-ag

# Flip to gstack
gstack-switch gstack

# Remove all short-name symlinks (no active fork)
gstack-switch --clear
```

When you switch, the short `/qa`, `/ship`, `/review` symlinks are re-pointed atomically. Your prefixed names (`/gstack-qa`, `/gstack-ag-qa`) are unaffected — they always work.

## Know which version you're using

Three signals:

### 1. Statusline (always visible in Claude Code)

```
gstack-ag 1.6.1.0 | main | ACTIVE
```

or from the other install:

```
gstack 1.6.1.0 | main | INACTIVE (active: gstack-ag)
```

### 2. Preamble line (every skill invocation)

```
GSTACK_ACTIVE: gstack-ag (this fork) — short names /qa, /ship route here
```

or if you call a skill from the non-active brand:

```
GSTACK_ACTIVE: gstack-ag (different fork) — /qa, /ship go to gstack-ag; use /gstack-<skill> to target this fork
```

### 3. `gstack-switch` with no args

```bash
$ gstack-switch
ACTIVE: gstack-ag 1.6.1.0

Short names (/qa, /ship, etc.) route to gstack-ag.
Always-prefixed names (/gstack-ag-qa, etc.) always target gstack-ag.

Other installed forks:
  gstack
```

## Example daily usage

### Scenario: gstack-ag is active, you want a quick run on Garry's gstack

```bash
# Invoke Garry's review explicitly by prefix:
claude: /gstack-review

# Your fork's review (explicit):
claude: /gstack-ag-review

# Short name — routes to gstack-ag because it's active:
claude: /review
```

### Scenario: Switch to Garry's for the day

```bash
gstack-switch gstack
# Now /review, /qa, /ship all route to Garry's gstack.
# Your fork's skills are still available via /gstack-ag-review etc.
```

### Scenario: Update one without touching the other

```bash
# Update Garry's gstack:
cd ~/Developer/gstack-upstream && git pull && ./setup

# Update your fork (this repo):
cd ~/Developer/AI-Research/gstack && git pull && ./bin/gstack-install-brand gstack-ag
```

Neither touches the other's install. The switch (if any) stays put.

## Data separation

Each brand uses its own data directory:

| Brand | Data dir |
|---|---|
| `gstack` | `~/.gstack/` |
| `gstack-ag` | `~/.gstack-ag/` |

This keeps timelines, learnings, analytics, slug caches, and session state isolated. Your `/retro` on `gstack-ag` doesn't pull in commits from runs you did on Garry's.

## Uninstall a brand

```bash
# Remove a brand entirely:
rm ~/.claude/skills/gstack-ag
rm ~/.claude/skills/gstack-ag-*

# If it was active, also clear the active tracker:
gstack-switch --clear
```

The source repo is untouched — only the symlinks in `~/.claude/skills/` go away. Re-run `./bin/gstack-install-brand gstack-ag` any time to re-install.

## Technical notes

- Brand substitution is driven entirely by the `GSTACK_BRAND` env var at `gen-skill-docs` time. Setting it rewrites all host skill-dir paths (`.claude/skills/gstack` → `.claude/skills/<brand>`) and the data dir (`~/.gstack` → `~/.<brand>`) in generated SKILL.md files.
- Only path-shaped references are rewritten. Prose mentions of "gstack" the product stay intact.
- The `gstack-switch` tracker lives at `~/.claude/skills/.gstack-active` (single text file containing the active brand name).
- The preamble bash reads the tracker live on every skill invocation — no caching. Swap brands instantly via `gstack-switch` without restarting Claude Code.
- Caching: the `GSTACK_ACTIVE:` line is emitted from runtime bash, not baked into the prompt prefix. Prompt caching is unaffected.
