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

type AdapterResult = {
  events: RawEvent[];
  warnings: string[];
};

function runSqlite(db: string, sql: string): string {
  const result = Bun.spawnSync({
    cmd: ["sqlite3", db, "-separator", "\t", sql],
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0) return "";
  return result.stdout.toString();
}

export function codexEventFromRollout(obj: unknown, file: string, index: number): RawEvent | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  const payload = record.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : {};
  const type = firstString(record.type, payload.type);
  const timestamp = isoFromUnknown(record.timestamp ?? payload.timestamp);

  if (type === "session_meta") {
    return {
      source_kind: "codex_cli",
      source_confidence: "A",
      session_id: firstString((payload as any).id) || shortHash(file),
      timestamp,
      role: "metadata",
      text: firstString((payload as any).title, (payload as any).originator),
      model: firstString((payload as any).model),
      cwd_hash: firstString((payload as any).cwd) ? shortHash(String((payload as any).cwd)) : undefined,
      project_match: true,
      raw_pointer: `${file}:${index + 1}`
    };
  }

  if (type === "turn_context") {
    return {
      source_kind: "codex_cli",
      source_confidence: "A",
      session_id: firstString((payload as any).turn_id) || shortHash(file),
      timestamp,
      role: "metadata",
      text: firstString((payload as any).cwd, (payload as any).model),
      model: firstString((payload as any).model),
      reasoning_effort: firstString((payload as any).effort),
      cwd_hash: firstString((payload as any).cwd) ? shortHash(String((payload as any).cwd)) : undefined,
      project_match: true,
      raw_pointer: `${file}:${index + 1}`
    };
  }

  const role = firstString(payload.role, (payload as any).message?.role);
  if (type === "response_item" && payload.type === "message") {
    const text = extractText(payload.content);
    if (!text) return undefined;
    return {
      source_kind: "codex_cli",
      source_confidence: "A",
      session_id: shortHash(file),
      timestamp,
      role: role === "user" ? "user" : role === "assistant" ? "assistant" : "metadata",
      text,
      project_match: true,
      raw_pointer: `${file}:${index + 1}`
    };
  }

  if (type === "response_item" && typeof payload.name === "string") {
    return {
      source_kind: "codex_cli",
      source_confidence: "A",
      session_id: shortHash(file),
      timestamp,
      role: "tool",
      tool_name: payload.name,
      tool_args_redacted: (payload as any).arguments || (payload as any).input || undefined,
      project_match: true,
      raw_pointer: `${file}:${index + 1}`
    };
  }

  return undefined;
}

export function collectCodexCli(options: CollectOptions): AdapterResult {
  const warnings: string[] = [];
  const events: RawEvent[] = [];
  const codexHome = expandHome("~/.codex");
  const dbs = walkFiles(codexHome, (file) => /^state_.*\.sqlite$/.test(path.basename(file)), 20);
  const rolloutPaths = new Set<string>();
  const projectSessionIds = new Set<string>();
  const project = path.resolve(options.projectPath).replace(/'/g, "''");

  for (const db of dbs) {
    const rows = runSqlite(db, `select id, rollout_path, model, reasoning_effort, cwd from threads where cwd = '${project}' order by updated_at_ms desc;`);
    for (const line of rows.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [threadId, rolloutPath, model, effort, cwd] = line.split("\t");
      if (rolloutPath) rolloutPaths.add(rolloutPath);
      if (threadId) projectSessionIds.add(threadId);
      events.push({
        source_kind: "codex_cli",
        source_confidence: "A",
        session_id: threadId || shortHash(line),
        role: "metadata",
        text: "Codex thread metadata",
        model,
        reasoning_effort: effort,
        cwd_hash: cwd ? shortHash(cwd) : undefined,
        project_match: true,
        raw_pointer: `${db}:threads:${threadId}`
      });
    }
  }

  for (const rolloutPath of rolloutPaths) {
    if (!fs.existsSync(rolloutPath)) continue;
    readJsonl(rolloutPath).forEach((obj, index) => {
      const event = codexEventFromRollout(obj, rolloutPath, index);
      if (event && withinSince(event.timestamp, options.since)) events.push(event);
    });
  }

  const history = path.join(codexHome, "history.jsonl");
  if (fs.existsSync(history) && projectSessionIds.size > 0) {
    readJsonl(history).forEach((obj, index) => {
      if (!obj || typeof obj !== "object") return;
      const record = obj as Record<string, unknown>;
      const text = extractText(record.text);
      if (!text) return;
      const sessionId = firstString(record.session_id);
      if (!sessionId || !projectSessionIds.has(sessionId)) return;
      const timestamp = isoFromUnknown(record.ts);
      if (!withinSince(timestamp, options.since)) return;
      events.push({
        source_kind: "codex_cli",
        source_confidence: "B",
        session_id: sessionId,
        timestamp,
        role: "user",
        text,
        project_match: true,
        raw_pointer: `${history}:${index + 1}`
      });
    });
  }

  if (events.length === 0) warnings.push("No Codex CLI/Desktop events matched this project/window.");
  return { events, warnings };
}

export function collectCodexDesktopExperimental(options: CollectOptions): AdapterResult {
  if (!options.includeExperimentalDesktopSources) {
    return { events: [], warnings: ["Codex app support sources skipped; pass --include-experimental-desktop-sources to probe them."] };
  }
  const roots = [
    path.join(home(), "Library", "Application Support", "Codex"),
    path.join(home(), "Library", "Application Support", "com.openai.chat")
  ];
  const warnings: string[] = [];
  const events: RawEvent[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      warnings.push(`${root} not found.`);
      continue;
    }
    warnings.push(`${root} exists but has no stable public export schema; skipped without reading cache bodies.`);
  }
  return { events, warnings };
}
