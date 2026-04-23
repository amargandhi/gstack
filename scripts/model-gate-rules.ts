/**
 * Model gate rules — declarative (model, skill) compatibility.
 *
 * Emits "ESCALATE:<replacement-model>" when a (runtime_model, skill) pairing
 * is known to produce poor results, otherwise "OK".
 *
 * Rule structure:
 *   - forbidKinds: skill kinds (from thinking-profiles.ts) that this model
 *     should never be used for
 *   - forbidBuckets: skill thinking buckets that exceed this model's
 *     deliberation capability
 *   - suggest: which model to use instead
 *   - reason: one-line explanation for the agent to relay to the user
 *
 * Gates are deliberately conservative. A rule firing = HARD STOP. Soft
 * preferences belong in model-overlays/*.md, not here.
 */
import type { SkillKind, ThinkingBucket } from './thinking-profiles';
import type { Model } from './models';

export interface ModelGateRule {
  model: Model;
  forbidKinds?: readonly SkillKind[];
  forbidBuckets?: readonly ThinkingBucket[];
  suggest: Model;
  reason: string;
}

export const MODEL_GATE_RULES: readonly ModelGateRule[] = [
  {
    model: 'gpt-5.3-codex-spark',
    forbidKinds: ['strategy'],
    forbidBuckets: ['high', 'max'],
    suggest: 'gpt-5.3-codex',
    reason:
      'Spark is speed-first (no reasoning_effort knob). Strategy and high-bucket analysis skills need real deliberation Spark can\'t do.',
  },
];

/**
 * Evaluate a (model, skill kind, skill bucket) tuple.
 * Returns the matching rule or null.
 */
export function evaluateGate(
  model: string,
  kind: SkillKind,
  bucket: ThinkingBucket
): ModelGateRule | null {
  for (const rule of MODEL_GATE_RULES) {
    if (rule.model !== model) continue;
    const kindHit = rule.forbidKinds?.includes(kind) ?? false;
    const bucketHit = rule.forbidBuckets?.includes(bucket) ?? false;
    if (kindHit || bucketHit) return rule;
  }
  return null;
}
