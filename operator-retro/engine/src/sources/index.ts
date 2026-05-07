import type { RawEvent, RunManifest } from "../types";
import { collectClaudeCli, collectClaudeDesktop } from "./claude";
import { collectCodexCli, collectCodexDesktopExperimental } from "./codex";
import { collectGStackArtifacts } from "./gstack";
import { collectManualImport } from "./manual";

export type CollectOptions = {
  projectPath: string;
  since?: Date;
  sinceLabel?: string;
  includeExperimentalDesktopSources?: boolean;
  includeGStackArtifacts?: boolean;
  gstackHome?: string;
  gstackSlug?: string;
  importPath?: string;
};

export function collectAllSources(options: CollectOptions): { events: RawEvent[]; sourceSummary: RunManifest["sources"]; warnings: string[] } {
  const adapters = {
    claude_cli: collectClaudeCli(options),
    claude_desktop: collectClaudeDesktop(options),
    codex_cli: collectCodexCli(options),
    codex_desktop: collectCodexDesktopExperimental(options),
    gstack: collectGStackArtifacts(options),
    manual: collectManualImport({ importPath: options.importPath, since: options.since })
  };

  const events = Object.values(adapters).flatMap((result) => result.events);
  const sourceSummary: RunManifest["sources"] = {};
  const warnings: string[] = [];
  for (const [name, result] of Object.entries(adapters)) {
    sourceSummary[name] = { events: result.events.length, warnings: result.warnings };
    warnings.push(...result.warnings.map((warning) => `${name}: ${warning}`));
  }
  return { events, sourceSummary, warnings };
}
