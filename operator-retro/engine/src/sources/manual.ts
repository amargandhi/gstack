import * as fs from "fs";
import * as path from "path";
import { shortHash, walkFiles, withinSince } from "../paths";
import type { RawEvent } from "../types";
import { extractText, isoFromUnknown, readJsonl } from "./shared";

type CollectOptions = {
  importPath?: string;
  since?: Date;
};

export function collectManualImport(options: CollectOptions): { events: RawEvent[]; warnings: string[] } {
  if (!options.importPath) return { events: [], warnings: [] };
  const warnings: string[] = [];
  const events: RawEvent[] = [];
  const stat = fs.existsSync(options.importPath) ? fs.statSync(options.importPath) : undefined;
  if (!stat) return { events, warnings: [`Manual import path not found: ${options.importPath}`] };
  const files = stat.isDirectory()
    ? walkFiles(options.importPath, (file) => file.endsWith(".jsonl") || file.endsWith(".md") || file.endsWith(".txt"))
    : [options.importPath];

  for (const file of files) {
    if (file.endsWith(".jsonl")) {
      readJsonl(file).forEach((obj, index) => {
        if (!obj || typeof obj !== "object") return;
        const record = obj as Record<string, unknown>;
        const text = extractText(record.text ?? record.content ?? record.prompt);
        const timestamp = isoFromUnknown(record.timestamp ?? record.ts);
        if (!text || !withinSince(timestamp, options.since)) return;
        events.push({
          source_kind: "manual",
          source_confidence: "B",
          session_id: String(record.session_id || record.sessionId || shortHash(file)),
          timestamp,
          role: record.role === "assistant" ? "assistant" : record.role === "tool" ? "tool" : "user",
          text,
          project_match: true,
          raw_pointer: `${file}:${index + 1}`
        });
      });
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    if (content.trim()) {
      events.push({
        source_kind: "manual",
        source_confidence: "C",
        session_id: shortHash(file),
        role: "user",
        text: content,
        project_match: true,
        raw_pointer: file
      });
    }
  }
  return { events, warnings };
}
