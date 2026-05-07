import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

export function home(): string {
  return process.env.HOME || process.env.USERPROFILE || "";
}

export function expandHome(input: string): string {
  if (input === "~") return home();
  if (input.startsWith("~/")) return path.join(home(), input.slice(2));
  return input;
}

export function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function shortHash(input: string, len = 12): string {
  return hashText(input).slice(0, len);
}

export function slugForProject(projectPath: string): string {
  const resolved = path.resolve(expandHome(projectPath));
  const base = path.basename(resolved) || "project";
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${shortHash(resolved, 8)}`;
}

export function outputRoot(): string {
  return process.env.AI_USAGE_REVIEW_HOME || path.join(home(), ".ai-usage-review");
}

export function makeRunId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function runDirFor(projectPath: string, runId = makeRunId()): string {
  return path.join(outputRoot(), "projects", slugForProject(projectPath), "runs", runId);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function parseSince(value?: string): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const rel = trimmed.match(/^(\d+)\s*([dhwm])$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const days = unit === "d" ? n : unit === "w" ? n * 7 : unit === "m" ? n * 30 : n / 24;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function withinSince(timestamp: string | undefined, since: Date | undefined): boolean {
  if (!since || !timestamp) return true;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed >= since;
}

export function walkFiles(root: string, predicate: (file: string) => boolean, max = 10000): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;
  const stack = [root];
  while (stack.length && out.length < max) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && predicate(full)) out.push(full);
      if (out.length >= max) break;
    }
  }
  return out.sort();
}
