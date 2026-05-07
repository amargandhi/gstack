#!/usr/bin/env bun
import * as fs from "fs";
import * as path from "path";
import { analyzePromptPack } from "./coach/analyze";
import { buildOperatorCoachPrompt, maybeRunModelCoach } from "./coach/model";
import { analyzeOperatorRetroDeterministic, summarizeOperatorFeatures } from "./coach/operator-retro";
import { normalizeEvents } from "./normalize/evidence";
import { ensureDir, expandHome, home, parseSince, runDirFor, shortHash } from "./paths";
import { buildPromptPack, renderMarkdown, renderOperatorRetroMarkdown } from "./render/render";
import { budgetRequiredSecondOpinion, skippedSecondOpinion, writeSecondOpinionPrompt } from "./second-opinion";
import { collectAllSources } from "./sources";
import type { AiUsageEvent, OperatorRetroAnalysis, OperatorRetroReportJson, PrimaryAnalysis, ReportJson, RunManifest, SecondOpinion } from "./types";
import { validateAnalysis, validateNoSecretsInFiles, validateOperatorRetro } from "./validate/validate";

type Args = Record<string, string | boolean | undefined> & { _: string[] };

function parseArgs(argv: string[]): Args {
  const args: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const [rawKey, inline] = token.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (inline !== undefined) {
      args[key] = inline;
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      args[key] = argv[++i];
    } else {
      args[key] = true;
    }
  }
  return args;
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function findLatestRun(projectPath: string): string {
  const projectDir = path.dirname(runDirFor(projectPath, "placeholder"));
  if (!fs.existsSync(projectDir)) throw new Error(`No runs found for ${projectPath}`);
  const runs = fs.readdirSync(projectDir).filter((name) => fs.existsSync(path.join(projectDir, name, "manifest.json"))).sort();
  if (runs.length === 0) throw new Error(`No runs found for ${projectPath}`);
  return path.join(projectDir, runs[runs.length - 1]);
}

function resolveRun(args: Args): string {
  if (typeof args.run === "string") return expandHome(args.run);
  if (typeof args.project === "string") return findLatestRun(args.project);
  throw new Error("Pass --run <run-dir> or --project <path>.");
}

function commandStatus(args: Args): void {
  const statuses = {
    claude_projects: fs.existsSync(path.join(home(), ".claude", "projects")),
    claude_history: fs.existsSync(path.join(home(), ".claude", "history.jsonl")),
    claude_desktop_sessions: fs.existsSync(path.join(home(), "Library", "Application Support", "Claude", "claude-code-sessions")),
    codex_state: fs.existsSync(path.join(home(), ".codex")),
    codex_history: fs.existsSync(path.join(home(), ".codex", "history.jsonl")),
    codex_app_support: fs.existsSync(path.join(home(), "Library", "Application Support", "Codex")),
    output_root: path.join(home(), ".ai-usage-review")
  };
  if (args.json) console.log(JSON.stringify(statuses, null, 2));
  else {
    console.log("AI Usage Review local source status:");
    for (const [key, value] of Object.entries(statuses)) console.log(`- ${key}: ${value}`);
  }
}

function commandCollect(args: Args): string {
  if (typeof args.project !== "string") throw new Error("collect requires --project <path>.");
  const projectPath = path.resolve(expandHome(args.project));
  const sinceLabel = typeof args.since === "string" ? args.since : undefined;
  const since = parseSince(sinceLabel);
  const runDir = typeof args.outputDir === "string"
    ? path.resolve(expandHome(args.outputDir))
    : typeof args.output === "string"
      ? path.resolve(expandHome(args.output))
      : runDirFor(projectPath);
  ensureDir(runDir);

  const collected = collectAllSources({
    projectPath,
    since,
    sinceLabel,
    includeExperimentalDesktopSources: Boolean(args.includeExperimentalDesktopSources),
    includeGStackArtifacts: Boolean(args.includeGStackArtifacts),
    gstackHome: typeof args.gstackHome === "string" ? expandHome(args.gstackHome) : undefined,
    gstackSlug: typeof args.gstackSlug === "string" ? args.gstackSlug : undefined,
    importPath: typeof args.import === "string" ? expandHome(args.import) : undefined
  });
  const events = normalizeEvents(collected.events, projectPath);
  const manifest: RunManifest = {
    schema_version: 1,
    run_id: path.basename(runDir),
    project: projectPath,
    project_path_hash: shortHash(projectPath),
    since: sinceLabel,
    generated_at: new Date().toISOString(),
    run_dir: runDir,
    warnings: collected.warnings,
    sources: collected.sourceSummary
  };

  writeJson(path.join(runDir, "manifest.json"), manifest);
  fs.writeFileSync(path.join(runDir, "evidence.normalized.jsonl"), events.map((event) => JSON.stringify(event)).join("\n") + (events.length ? "\n" : ""));
  fs.writeFileSync(path.join(runDir, "prompt-pack.md"), buildPromptPack(events, {
    includeAssistantContext: Boolean(args.includeAssistantContext)
  }));
  console.log(runDir);
  return runDir;
}

function readEvents(runDir: string): AiUsageEvent[] {
  const file = path.join(runDir, "evidence.normalized.jsonl");
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as AiUsageEvent);
}

function projectLabel(projectPath: string): string {
  return path.basename(projectPath) || "project";
}

function commandAnalyze(args: Args): string {
  const runDir = resolveRun(args);
  const manifest = readJson<RunManifest>(path.join(runDir, "manifest.json"));
  const events = readEvents(runDir);
  const analysis = analyzePromptPack(events, projectLabel(manifest.project));
  writeJson(path.join(runDir, "primary-analysis.json"), analysis);
  console.log(path.join(runDir, "primary-analysis.json"));
  return runDir;
}

function commandSecondOpinion(args: Args): string {
  const runDir = resolveRun(args);
  const analysis = readJson<PrimaryAnalysis>(path.join(runDir, "primary-analysis.json"));
  const provider = (typeof args.provider === "string" ? args.provider : typeof args.secondOpinionProvider === "string" ? args.secondOpinionProvider : "auto") as SecondOpinion["provider"];
  writeSecondOpinionPrompt(runDir, provider, analysis);
  const second = budgetRequiredSecondOpinion(provider, analysis);
  writeJson(path.join(runDir, "second-opinion.json"), second);
  console.log(path.join(runDir, "second-opinion.json"));
  return runDir;
}

function ensureSecondOpinion(runDir: string, args: Args): SecondOpinion {
  const file = path.join(runDir, "second-opinion.json");
  if (fs.existsSync(file)) return readJson<SecondOpinion>(file);
  const second = args.secondOpinion
    ? budgetRequiredSecondOpinion((typeof args.secondOpinionProvider === "string" ? args.secondOpinionProvider : "auto") as SecondOpinion["provider"], readJson<PrimaryAnalysis>(path.join(runDir, "primary-analysis.json")))
    : skippedSecondOpinion("none");
  writeJson(file, second);
  return second;
}

function commandValidate(args: Args): string {
  const runDir = resolveRun(args);
  const events = readEvents(runDir);
  const analysis = readJson<PrimaryAnalysis>(path.join(runDir, "primary-analysis.json"));
  const second = fs.existsSync(path.join(runDir, "second-opinion.json"))
    ? readJson<SecondOpinion>(path.join(runDir, "second-opinion.json"))
    : skippedSecondOpinion();
  const structural = validateAnalysis(events, analysis, second);
  const privacy = validateNoSecretsInFiles([
    path.join(runDir, "prompt-pack.md"),
    path.join(runDir, "report.json"),
    path.join(runDir, "report.md")
  ]);
  const errors = [...structural.errors, ...privacy.errors];
  if (errors.length) {
    for (const error of errors) console.error(`VALIDATION_ERROR ${error}`);
    process.exitCode = 1;
  } else {
    console.log("VALIDATION_OK");
  }
  return runDir;
}

function commandRender(args: Args): string {
  const runDir = resolveRun(args);
  const manifest = readJson<RunManifest>(path.join(runDir, "manifest.json"));
  const analysis = readJson<PrimaryAnalysis>(path.join(runDir, "primary-analysis.json"));
  const second = ensureSecondOpinion(runDir, args);
  const report: ReportJson = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    project: projectLabel(manifest.project),
    analysis,
    second_opinion: second
  };
  writeJson(path.join(runDir, "report.json"), report);
  fs.writeFileSync(path.join(runDir, "report.md"), renderMarkdown(report));
  console.log(path.join(runDir, "report.md"));
  return runDir;
}

function commandReview(args: Args): void {
  const runDir = commandCollect(args);
  commandAnalyze({ ...args, run: runDir, _: [] });
  if (args.secondOpinion && !args.noSecondOpinion) commandSecondOpinion({ ...args, run: runDir, _: [] });
  else writeJson(path.join(runDir, "second-opinion.json"), skippedSecondOpinion("none"));
  commandRender({ ...args, run: runDir, _: [] });
  commandValidate({ ...args, run: runDir, _: [] });
}

function writeJsonl(file: string, values: unknown[]): void {
  fs.writeFileSync(file, values.map((value) => JSON.stringify(value)).join("\n") + (values.length ? "\n" : ""));
}

function commandOperatorRetro(args: Args): void {
  if (typeof args.project !== "string") throw new Error("operator-retro requires --project <path>.");
  const projectPath = path.resolve(expandHome(args.project));
  const sinceLabel = typeof args.since === "string" ? args.since : "7d";
  const since = parseSince(sinceLabel);
  const runDir = typeof args.outputDir === "string"
    ? path.resolve(expandHome(args.outputDir))
    : typeof args.output === "string"
      ? path.resolve(expandHome(args.output))
      : runDirFor(projectPath);
  ensureDir(runDir);

  const collected = collectAllSources({
    projectPath,
    since,
    sinceLabel,
    includeExperimentalDesktopSources: Boolean(args.includeExperimentalDesktopSources),
    includeGStackArtifacts: true,
    gstackHome: typeof args.gstackHome === "string" ? expandHome(args.gstackHome) : undefined,
    gstackSlug: typeof args.gstackSlug === "string" ? args.gstackSlug : undefined,
    importPath: typeof args.import === "string" ? expandHome(args.import) : undefined
  });
  const events = normalizeEvents(collected.events, projectPath);
  const manifest: RunManifest = {
    schema_version: 1,
    run_id: path.basename(runDir),
    project: projectPath,
    project_path_hash: shortHash(projectPath),
    since: sinceLabel,
    generated_at: new Date().toISOString(),
    run_dir: runDir,
    warnings: collected.warnings,
    sources: collected.sourceSummary
  };

  const deterministic = analyzeOperatorRetroDeterministic(events, projectLabel(projectPath));
  const coachPrompt = buildOperatorCoachPrompt(events, deterministic);
  const mode = (typeof args.analysisEngine === "string" ? args.analysisEngine : "auto") as "auto" | "deterministic" | "model";
  const analysis: OperatorRetroAnalysis = maybeRunModelCoach(coachPrompt, deterministic, mode);

  const structural = validateOperatorRetro(events, analysis);
  if (!structural.ok) {
    for (const error of structural.errors) console.error(`VALIDATION_ERROR ${error}`);
    process.exitCode = 1;
    return;
  }

  const report: OperatorRetroReportJson = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    project: projectLabel(projectPath),
    analysis
  };

  writeJson(path.join(runDir, "manifest.json"), manifest);
  fs.writeFileSync(path.join(runDir, "evidence.normalized.jsonl"), events.map((event) => JSON.stringify(event)).join("\n") + (events.length ? "\n" : ""));
  writeJson(path.join(runDir, "features.json"), summarizeOperatorFeatures(events));
  fs.writeFileSync(path.join(runDir, "coach-prompt.md"), coachPrompt);
  writeJson(path.join(runDir, "primary-analysis.json"), analysis);
  writeJsonl(path.join(runDir, "candidate-learnings.jsonl"), analysis.proposed_actions.filter((item) => item.type === "learning_candidate"));
  writeJson(path.join(runDir, "routing-suggestions.json"), analysis.proposed_actions.filter((item) => item.type === "routing_suggestion" || item.type === "skill_suggestion"));
  writeJson(path.join(runDir, "report.json"), report);
  fs.writeFileSync(path.join(runDir, "report.md"), renderOperatorRetroMarkdown(report));

  const privacy = validateNoSecretsInFiles([
    path.join(runDir, "coach-prompt.md"),
    path.join(runDir, "report.json"),
    path.join(runDir, "report.md")
  ]);
  if (!privacy.ok) {
    for (const error of privacy.errors) console.error(`VALIDATION_ERROR ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(path.join(runDir, "report.md"));
}

function usage(): void {
  console.log(`Usage:
  ai-usage-review status [--json]
  ai-usage-review collect --project <path> [--since 21d] [--output <dir>]
  ai-usage-review analyze --run <run-dir>
  ai-usage-review second-opinion --run <run-dir> [--provider auto|claude|codex]
  ai-usage-review validate --run <run-dir>
  ai-usage-review render --run <run-dir>
  ai-usage-review review --project <path> [--since 21d] [--no-questions] [--second-opinion] [--include-assistant-context]
  ai-usage-review operator-retro --project <path> [--since 7d] [--output-dir <dir>] [--analysis-engine auto|deterministic|model]
`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] || "status";

try {
  if (command === "status") commandStatus(args);
  else if (command === "collect") commandCollect(args);
  else if (command === "analyze") commandAnalyze(args);
  else if (command === "second-opinion") commandSecondOpinion(args);
  else if (command === "validate") commandValidate(args);
  else if (command === "render") commandRender(args);
  else if (command === "review") commandReview(args);
  else if (command === "operator-retro") commandOperatorRetro(args);
  else {
    usage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
