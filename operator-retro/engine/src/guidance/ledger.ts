import * as fs from "fs";
import * as path from "path";
import type { FeatureLedger, GuidanceLedger, SourceLedger } from "../types";

const ROOT = path.resolve(import.meta.dir, "..", "..");

export function readSourceLedger(): SourceLedger {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "references", "source-ledger.json"), "utf8"));
}

export function readFeatureLedger(): FeatureLedger {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "references", "feature-ledger.json"), "utf8"));
}

export function readGuidanceLedger(): GuidanceLedger {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "references", "operator-guidance-ledger.json"), "utf8"));
}

export function sourceIds(): Set<string> {
  return new Set(readSourceLedger().sources.map((source) => source.id));
}

export function sourceMap(): Map<string, SourceLedger["sources"][number]> {
  return new Map(readSourceLedger().sources.map((source) => [source.id, source]));
}

export function guidanceIds(): Set<string> {
  return new Set(readGuidanceLedger().guidance.map((item) => item.id));
}

export function guidanceMap(): Map<string, GuidanceLedger["guidance"][number]> {
  return new Map(readGuidanceLedger().guidance.map((item) => [item.id, item]));
}
