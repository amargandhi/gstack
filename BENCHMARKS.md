# Benchmarks

## Prompt Caching

Status: no measured prompt-cache runs yet.

Method: `bun run bin/bench-prompt-cost.ts` reads existing eval/timeline usage
records. It does not call a model and does not spend API budget.

Replication command:

```bash
bun run bin/bench-prompt-cost.ts --out BENCHMARKS.md
```

Paid benchmark runs remain opt-in behind explicit budget approval.

## Model Benchmarks

Status: pending. See `docs/MODEL_BENCHMARKS.md`.

Replication command:

```bash
GSTACK_BENCH_MATRIX=1 EVALS=1 bun test test/skill-e2e-multi-model.test.ts
```
