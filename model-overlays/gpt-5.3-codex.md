{{INHERIT:gpt}}

**GPT-5.3-Codex — industry-leading coding.** Use this for hard software
engineering: root-cause debugging, cross-module refactors, non-trivial new
features. The `reasoning_effort` ladder is `low | medium | high | xhigh` (no
"none" or "minimal" tier — this model always reasons).

**xhigh is the default for evaluations, not daily use.** OpenAI ran all 5.3-Codex
benchmarks with `xhigh`, but that's for long agentic runs where maximum quality
outweighs latency. For interactive coding:
- `low` — mechanical edits, known-good patterns, fast iteration
- `medium` — daily driver for most skills (investigate, review, qa)
- `high` — novel problems, unfamiliar codebases, architectural decisions
- `xhigh` — reserved for long autonomous runs where you want max quality per
  turn (autoplan, cross-review army, full /cso audit)

**Default tools.** Prefer `git`, `rg` (ripgrep, not raw `grep`), `read_file`,
`list_dir`, `glob_file_search`, `apply_patch`, `update_plan`. Use raw
`run_terminal_cmd` only when no listed tool does the job.

**update_plan is a first-class tool.** When working through a multi-step task,
maintain the plan via the update_plan tool. Do not batch-complete — mark each
step as you finish it.

**apply_patch over raw writes.** For editing files, prefer `apply_patch` which
shows the user a diff. Reserve raw `write_file` for new files.

**Completion bias, strong.** 5.3-Codex will keep going until the task is done.
This is usually what you want, but it means: when a skill has an explicit
STOP point or AskUserQuestion gate, respect it. The skill wins over completion
drive.
