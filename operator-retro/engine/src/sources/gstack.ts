import * as fs from "fs";
import * as path from "path";
import { expandHome, home, shortHash, slugForProject, walkFiles, withinSince } from "../paths";
import type { RawEvent } from "../types";
import { extractText, firstString, isoFromUnknown, readJsonl } from "./shared";

type CollectOptions = {
  projectPath: string;
  since?: Date;
  gstackHome?: string;
  gstackSlug?: string;
  includeGStackArtifacts?: boolean;
};

type AdapterResult = {
  events: RawEvent[];
  warnings: string[];
};

function projectDir(options: CollectOptions): string {
  const root = path.resolve(expandHome(options.gstackHome || path.join(home(), ".gstack")));
  const slug = options.gstackSlug || slugForProject(options.projectPath);
  return path.join(root, "projects", slug);
}

function pushJsonlEvents(events: RawEvent[], file: string, kind: string, options: CollectOptions): void {
  readJsonl(file).forEach((obj, index) => {
    if (!obj || typeof obj !== "object") return;
    const record = obj as Record<string, unknown>;
    const timestamp = isoFromUnknown(record.ts ?? record.timestamp);
    if (!withinSince(timestamp, options.since)) return;
    const skill = firstString(record.skill);
    const event = firstString(record.event, record.status, record.outcome);
    const text = extractText(record.text ?? record.summary ?? record.insight) ||
      `${kind}: ${[skill, event].filter(Boolean).join(" ") || "gstack event"}`;
    events.push({
      source_kind: "gstack",
      source_confidence: "B",
      session_id: firstString(record.session) || shortHash(file),
      timestamp,
      role: "metadata",
      text,
      tool_name: skill,
      project_match: true,
      raw_pointer: `${file}:${index + 1}`
    });
  });
}

function pushArtifactEvents(events: RawEvent[], dir: string, options: CollectOptions): void {
  const files = walkFiles(dir, (file) => /\.(md|json|jsonl|txt)$/i.test(file), 200);
  for (const file of files) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    const timestamp = stat.mtime.toISOString();
    if (!withinSince(timestamp, options.since)) continue;
    const rel = path.relative(dir, file);
    events.push({
      source_kind: "gstack",
      source_confidence: "C",
      session_id: shortHash(file),
      timestamp,
      role: "metadata",
      text: `gstack artifact: ${rel}`,
      project_match: true,
      raw_pointer: file
    });
  }
}

export function collectGStackArtifacts(options: CollectOptions): AdapterResult {
  if (!options.includeGStackArtifacts) return { events: [], warnings: [] };
  const dir = projectDir(options);
  const events: RawEvent[] = [];
  const warnings: string[] = [];
  if (!fs.existsSync(dir)) {
    return { events, warnings: [`No GStack project directory found: ${dir}`] };
  }

  const timeline = path.join(dir, "timeline.jsonl");
  if (fs.existsSync(timeline)) pushJsonlEvents(events, timeline, "timeline", options);
  else warnings.push("No GStack timeline found for project slug.");

  const learnings = path.join(dir, "learnings.jsonl");
  if (fs.existsSync(learnings)) pushJsonlEvents(events, learnings, "learning", options);

  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith("-reviews.jsonl")) pushJsonlEvents(events, path.join(dir, file), "review", options);
  }

  for (const subdir of ["checkpoints", "qa", "qa-only", "ship", "test-plans", "operator-retro"]) {
    const artifactDir = path.join(dir, subdir);
    if (fs.existsSync(artifactDir)) pushArtifactEvents(events, artifactDir, options);
  }

  return { events, warnings };
}
