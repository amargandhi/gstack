import * as fs from "fs";
import * as path from "path";
import { expandHome, home, shortHash, walkFiles, withinSince } from "../paths";
import type { RawEvent } from "../types";
import { extractText, firstString, isoFromUnknown, readJsonl } from "./shared";

type CollectOptions = {
  projectPath: string;
  since?: Date;
  includeExperimentalDesktopSources?: boolean;
};

export type AdapterResult = {
  events: RawEvent[];
  warnings: string[];
};

function claudeProjectDirFragment(projectPath: string): string {
  const resolved = path.resolve(projectPath);
  return resolved.replace(/\//g, "-").toLowerCase();
}

function projectPathMatchesExact(candidate: string | undefined, projectPath: string): boolean {
  if (!candidate) return false;
  try {
    return path.resolve(candidate) === path.resolve(projectPath);
  } catch {
    return false;
  }
}

function projectFileMatchesExact(file: string, projectPath: string): boolean {
  return file.toLowerCase().includes(claudeProjectDirFragment(projectPath));
}

function roleFromClaude(obj: Record<string, unknown>): RawEvent["role"] {
  const type = firstString(obj.type, (obj.message as any)?.role, obj.role, obj.operation);
  if (type === "user" || type === "assistant" || type === "system") return type;
  if (String(type || "").toLowerCase().includes("tool")) return "tool";
  return "metadata";
}

function rawFromClaudeObject(obj: unknown, file: string, index: number, sourceKind: RawEvent["source_kind"], projectPath: string): RawEvent | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  const role = roleFromClaude(record);
  const message = record.message && typeof record.message === "object" ? record.message as Record<string, unknown> : {};
  const text = extractText(record.content ?? message.content ?? record.display ?? record.text);
  const sessionId = firstString(record.sessionId, record.session_id, message.sessionId) || shortHash(file);
  const timestamp = isoFromUnknown(record.timestamp ?? record.created_at ?? message.timestamp);
  const toolName = firstString(record.toolName, record.tool_name, record.name);
  const project = firstString(record.project, record.cwd);
  const project_match = project
    ? projectPathMatchesExact(project, projectPath)
    : projectFileMatchesExact(file, projectPath);

  if (!text && !toolName && role !== "metadata") return undefined;
  return {
    source_kind: sourceKind,
    source_confidence: sourceKind === "claude_cli" ? "A" : "B",
    session_id: sessionId,
    timestamp,
    role,
    text,
    tool_name: toolName,
    model: firstString(record.model, message.model),
    cwd_hash: project ? shortHash(project) : undefined,
    project_match,
    raw_pointer: `${file}:${index + 1}`
  };
}

export function collectClaudeCli(options: CollectOptions): AdapterResult {
  const warnings: string[] = [];
  const events: RawEvent[] = [];
  const projectRoot = expandHome("~/.claude/projects");
  const files = walkFiles(projectRoot, (file) => file.endsWith(".jsonl"))
    .filter((file) => projectFileMatchesExact(file, options.projectPath));

  for (const file of files) {
    readJsonl(file).forEach((obj, index) => {
      const event = rawFromClaudeObject(obj, file, index, "claude_cli", options.projectPath);
      if (event && withinSince(event.timestamp, options.since)) events.push(event);
    });
  }

  const history = path.join(home(), ".claude", "history.jsonl");
  if (fs.existsSync(history)) {
    readJsonl(history).forEach((obj, index) => {
      const event = rawFromClaudeObject(obj, history, index, "claude_cli", options.projectPath);
      if (event && event.project_match && withinSince(event.timestamp, options.since)) events.push(event);
    });
  }

  if (events.length === 0) warnings.push("No Claude CLI events matched this project/window.");
  return { events, warnings };
}

export function collectClaudeDesktop(options: CollectOptions): AdapterResult {
  const root = path.join(home(), "Library", "Application Support", "Claude", "claude-code-sessions");
  const warnings: string[] = [];
  const events: RawEvent[] = [];
  if (!options.includeExperimentalDesktopSources) {
    return { events, warnings: ["Claude desktop session source skipped; pass --include-experimental-desktop-sources to probe exact-provenance exports."] };
  }
  if (!fs.existsSync(root)) return { events, warnings: ["Claude desktop session directory not found."] };

  const files = walkFiles(root, (file) => file.endsWith(".json"), 20000);
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    for (const [index, row] of rows.entries()) {
      const event = rawFromClaudeObject(row, file, index, "claude_desktop", options.projectPath);
      if (event && event.project_match && withinSince(event.timestamp, options.since)) events.push(event);
    }
  }

  if (events.length === 0) warnings.push("Claude desktop schema was absent, empty, or not recognized for this project/window.");
  return { events, warnings };
}
