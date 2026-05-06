# Prompt Caching

The shared preamble now contains cache-anchor markers:

```md
<!-- gstack:cache-anchor:start -->
...
<!-- gstack:cache-anchor:end -->
```

## Zones

| Zone | Content | Stability |
|---|---|---|
| Before anchor | bootstrap, environment, update checks, host setup | can vary by invocation |
| Cache anchor | behavioral rules, model overlay, context/repo guidance | stable enough for host-level prefix reuse |
| After anchor | completion status and telemetry closeout | can vary by invocation |

## API Surface

No fork-owned Anthropic SDK call surface was changed in this pass. The current
change is structural: generated prompts expose a stable zone that host runtimes
can use for prompt-cache segmentation when they control the API call.

## Benchmark Harness

Method: `bin/bench-prompt-cost.ts` reads existing usage records and emits a
markdown summary. It does not call a model.

```bash
bun run bin/bench-prompt-cost.ts
```

Status: pending until an explicit paid run creates usage records with
`cache_creation_input_tokens` and `cache_read_input_tokens`.
