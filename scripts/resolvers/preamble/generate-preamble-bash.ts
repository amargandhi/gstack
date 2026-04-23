import type { TemplateContext } from '../types';
import { getHostConfig } from '../../../hosts/index';

/**
 * Derive the brand name for this build. Default is 'gstack'. Override via
 * GSTACK_BRAND env var at gen-skill-docs time. Used to populate
 * $_BUILD_BRAND in the preamble so skills know which fork they belong to
 * when side-by-side installs exist (see bin/gstack-switch).
 */
function getBrand(ctx: TemplateContext): string {
  return process.env.GSTACK_BRAND || 'gstack';
}

export function generatePreambleBash(ctx: TemplateContext): string {
  const hostConfig = getHostConfig(ctx.host);
  const runtimeRoot = hostConfig.usesEnvVars
    ? `_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
GSTACK_ROOT="$HOME/${hostConfig.globalRoot}"
[ -n "$_ROOT" ] && [ -d "$_ROOT/${ctx.paths.localSkillRoot}" ] && GSTACK_ROOT="$_ROOT/${ctx.paths.localSkillRoot}"
GSTACK_BIN="$GSTACK_ROOT/bin"
GSTACK_BROWSE="$GSTACK_ROOT/browse/dist"
GSTACK_DESIGN="$GSTACK_ROOT/design/dist"
`
    : '';

  return `## Preamble (run first)

\`\`\`bash
${runtimeRoot}_UPD=$(${ctx.paths.binDir}/gstack-update-check 2>/dev/null || ${ctx.paths.localSkillRoot}/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
_PROACTIVE=$(${ctx.paths.binDir}/gstack-config get proactive 2>/dev/null || echo "true")
_PROACTIVE_PROMPTED=$([ -f ~/.gstack/.proactive-prompted ] && echo "yes" || echo "no")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_SKILL_PREFIX=$(${ctx.paths.binDir}/gstack-config get skill_prefix 2>/dev/null || echo "false")
echo "PROACTIVE: $_PROACTIVE"
echo "PROACTIVE_PROMPTED: $_PROACTIVE_PROMPTED"
echo "SKILL_PREFIX: $_SKILL_PREFIX"
source <(${ctx.paths.binDir}/gstack-repo-mode 2>/dev/null) || true
REPO_MODE=\${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(${ctx.paths.binDir}/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: \${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
# Writing style verbosity (V1: default = ELI10, terse = tighter V0 prose.
# Read on every skill run so terse mode takes effect without a restart.)
_EXPLAIN_LEVEL=$(${ctx.paths.binDir}/gstack-config get explain_level 2>/dev/null || echo "default")
if [ "$_EXPLAIN_LEVEL" != "default" ] && [ "$_EXPLAIN_LEVEL" != "terse" ]; then _EXPLAIN_LEVEL="default"; fi
echo "EXPLAIN_LEVEL: $_EXPLAIN_LEVEL"
# Question tuning (see /plan-tune). Observational only in V1.
_QUESTION_TUNING=$(${ctx.paths.binDir}/gstack-config get question_tuning 2>/dev/null || echo "false")
echo "QUESTION_TUNING: $_QUESTION_TUNING"
mkdir -p ~/.gstack/analytics
if [ "$_TEL" != "off" ]; then
echo '{"skill":"${ctx.skillName}","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
# zsh-compatible: use find instead of glob to avoid NOMATCH error
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  if [ -f "$_PF" ]; then
    if [ "$_TEL" != "off" ] && [ -x "${ctx.paths.binDir}/gstack-telemetry-log" ]; then
      ${ctx.paths.binDir}/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
    fi
    rm -f "$_PF" 2>/dev/null || true
  fi
  break
done
# Learnings count
eval "$(${ctx.paths.binDir}/gstack-slug 2>/dev/null)" 2>/dev/null || true
_LEARN_FILE="\${GSTACK_HOME:-$HOME/.gstack}/projects/\${SLUG:-unknown}/learnings.jsonl"
if [ -f "$_LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$_LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries loaded"
  if [ "$_LEARN_COUNT" -gt 5 ] 2>/dev/null; then
    ${ctx.paths.binDir}/gstack-learnings-search --limit 3 2>/dev/null || true
  fi
else
  echo "LEARNINGS: 0"
fi
# Session timeline recorded below, after runtime host/model detection completes,
# so the entry captures the actual runtime model (A6 measurement foundation).
# Check if CLAUDE.md has routing rules
_HAS_ROUTING="no"
if [ -f CLAUDE.md ] && grep -q "## Skill routing" CLAUDE.md 2>/dev/null; then
  _HAS_ROUTING="yes"
fi
_ROUTING_DECLINED=$(${ctx.paths.binDir}/gstack-config get routing_declined 2>/dev/null || echo "false")
echo "HAS_ROUTING: $_HAS_ROUTING"
echo "ROUTING_DECLINED: $_ROUTING_DECLINED"
# Vendoring deprecation: detect if CWD has a vendored gstack copy
_VENDORED="no"
if [ -d ".claude/skills/gstack" ] && [ ! -L ".claude/skills/gstack" ]; then
  if [ -f ".claude/skills/gstack/VERSION" ] || [ -d ".claude/skills/gstack/.git" ]; then
    _VENDORED="yes"
  fi
fi
echo "VENDORED_GSTACK: $_VENDORED"
echo "MODEL_OVERLAY: ${ctx.model ?? 'none'}"
# Active-fork tracker: which gstack fork currently owns the short skill names
# (multi-install side-by-side). Written by bin/gstack-switch. Informational only.
# BUILD_BRAND is set at gen-skill-docs time; RUNTIME_ACTIVE is read live.
_BUILD_BRAND="${getBrand(ctx)}"
_SKILLS_ROOT="\${GSTACK_SKILLS_ROOT:-$HOME/.claude/skills}"
_ACTIVE_FORK=""
[ -f "$_SKILLS_ROOT/.gstack-active" ] && _ACTIVE_FORK=$(cat "$_SKILLS_ROOT/.gstack-active" 2>/dev/null)
if [ -z "$_ACTIVE_FORK" ]; then
  echo "GSTACK_ACTIVE: (none) — short names (/qa, /ship) not routed. Run: \${GSTACK_BIN:-~/.claude/skills/$_BUILD_BRAND/bin}/gstack-switch $_BUILD_BRAND"
elif [ "$_ACTIVE_FORK" = "$_BUILD_BRAND" ]; then
  echo "GSTACK_ACTIVE: $_BUILD_BRAND (this fork) — short names /qa, /ship route here"
else
  echo "GSTACK_ACTIVE: $_ACTIVE_FORK (different fork) — /qa, /ship go to $_ACTIVE_FORK; use /$_BUILD_BRAND-<skill> to target this fork"
fi
# Runtime host + model detection (advisory). Lets skills and downstream scripts
# know which agent/model is actually running, independent of the build-time host.
_RUNTIME_HOST=$(${ctx.paths.binDir}/gstack-detect-host 2>/dev/null || echo "unknown")
_RUNTIME_MODEL=$(${ctx.paths.binDir}/gstack-detect-model 2>/dev/null || echo "unknown")
echo "RUNTIME_HOST: $_RUNTIME_HOST"
echo "RUNTIME_MODEL: $_RUNTIME_MODEL"
# Warn if build-time host doesn't match runtime host (installation/copy mistake).
_BUILD_HOST="${ctx.host}"
if [ "$_RUNTIME_HOST" != "unknown" ] && [ "$_RUNTIME_HOST" != "$_BUILD_HOST" ]; then
  echo "HOST_MISMATCH: built for $_BUILD_HOST, running in $_RUNTIME_HOST — regenerate via: bun run gen:skill-docs --host $_RUNTIME_HOST"
fi
# Session timeline: record skill start with runtime model (local-only, never sent anywhere)
${ctx.paths.binDir}/gstack-timeline-log '{"skill":"${ctx.skillName}","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'","model":"'"$_RUNTIME_MODEL"'","host":"'"$_RUNTIME_HOST"'"}' 2>/dev/null &
# Dynamic overlay (B1): if runtime model differs from build model and we have an
# overlay for the runtime model, emit it as a system-reminder so the model gets
# its own behavioral guidance without requiring a regeneration.
_BUILD_MODEL="${ctx.model ?? 'claude'}"
if [ "$_RUNTIME_MODEL" != "unknown" ] && [ "$_RUNTIME_MODEL" != "$_BUILD_MODEL" ]; then
  _OVERLAY_CONTENT=$(${ctx.paths.binDir}/gstack-overlay-emit "$_RUNTIME_MODEL" 2>/dev/null || echo "")
  if [ -n "$_OVERLAY_CONTENT" ]; then
    echo ""
    echo "<system-reminder>"
    echo "Runtime model ($_RUNTIME_MODEL) differs from build model ($_BUILD_MODEL)."
    echo "Applying runtime overlay so behavioral guidance matches your actual model."
    echo "--- begin $_RUNTIME_MODEL overlay ---"
    echo "$_OVERLAY_CONTENT"
    echo "--- end overlay ---"
    echo "</system-reminder>"
  fi
fi
# Model gate — hard STOP if the runtime model is known to be unsuitable for this skill.
# Only fires for models with explicit rules (currently: gpt-5.3-codex-spark on strategy/high-analysis).
_GATE=$(${ctx.paths.binDir}/gstack-model-gate "$_RUNTIME_MODEL" "${ctx.skillName}" 2>/dev/null || echo "OK")
if [ "\${_GATE%%:*}" = "ESCALATE" ]; then
  _SUGGEST="\${_GATE#ESCALATE:}"
  _SUGGEST_MODEL="\${_SUGGEST%%|*}"
  _SUGGEST_REASON="\${_SUGGEST#*|}"
  echo ""
  echo "<system-reminder>"
  echo "MODEL_GATE: \$_RUNTIME_MODEL is not suitable for /${ctx.skillName}."
  echo "Reason: \$_SUGGEST_REASON"
  echo ""
  echo "STOP. Before continuing this skill, ask the user to either:"
  echo "  1. Re-run on a capable model: codex -m \$_SUGGEST_MODEL /${ctx.skillName}"
  echo "  2. Or switch the model in their current harness (e.g. /model in Claude Code)"
  echo ""
  echo "Explain the trade-off briefly so they understand why. Do not proceed with /${ctx.skillName} on \$_RUNTIME_MODEL."
  echo "</system-reminder>"
fi
# Checkpoint mode (explicit = no auto-commit, continuous = WIP commits as you go)
_CHECKPOINT_MODE=$(${ctx.paths.binDir}/gstack-config get checkpoint_mode 2>/dev/null || echo "explicit")
_CHECKPOINT_PUSH=$(${ctx.paths.binDir}/gstack-config get checkpoint_push 2>/dev/null || echo "false")
echo "CHECKPOINT_MODE: $_CHECKPOINT_MODE"
echo "CHECKPOINT_PUSH: $_CHECKPOINT_PUSH"
# Detect spawned session (OpenClaw or other orchestrator)
[ -n "$OPENCLAW_SESSION" ] && echo "SPAWNED_SESSION: true" || true${ctx.host === 'gbrain' || ctx.host === 'hermes' ? `
# GBrain health check (gbrain/hermes host only)
if command -v gbrain &>/dev/null; then
  _BRAIN_JSON=$(gbrain doctor --fast --json 2>/dev/null || echo '{}')
  _BRAIN_SCORE=$(echo "$_BRAIN_JSON" | grep -o '"health_score":[0-9]*' | cut -d: -f2)
  _BRAIN_FAILS=$(echo "$_BRAIN_JSON" | grep -o '"status":"fail"' | wc -l | tr -d ' ')
  _BRAIN_WARNS=$(echo "$_BRAIN_JSON" | grep -o '"status":"warn"' | wc -l | tr -d ' ')
  echo "BRAIN_HEALTH: \${_BRAIN_SCORE:-unknown} (\${_BRAIN_FAILS:-0} failures, \${_BRAIN_WARNS:-0} warnings)"
  if [ "\${_BRAIN_SCORE:-100}" -lt 50 ] 2>/dev/null; then
    echo "$_BRAIN_JSON" | grep -o '"name":"[^"]*","status":"[^"]*","message":"[^"]*"' || true
  fi
fi` : ''}
\`\`\``;
}

