import { shortHash } from "../paths";
import { redactText } from "../privacy/redact";
import type { AiUsageEvent, RawEvent } from "../types";

function redactUnknown(value: unknown, projectPath: string): unknown {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return undefined;
  const redacted = redactText(serialized, projectPath).text;
  try {
    return JSON.parse(redacted);
  } catch {
    return "[REDACTED_UNPARSEABLE_TOOL_ARGS]";
  }
}

export function normalizeEvents(raw: RawEvent[], projectPath: string): AiUsageEvent[] {
  const events = raw.map((event) => {
    const redacted = redactText(event.redacted_text || event.text || "", projectPath).text;
    const toolArgs = event.tool_args_redacted === undefined
      ? undefined
      : redactUnknown(event.tool_args_redacted, projectPath);
    const stable = [
      event.source_kind,
      event.session_id,
      event.timestamp || "",
      event.role,
      redacted,
      event.tool_name || "",
      event.raw_pointer
    ].join("\u001f");
    return {
      ...event,
      redacted_text: redacted || undefined,
      tool_args_redacted: toolArgs,
      evidence_id: `ev-${shortHash(stable, 16)}`
    };
  });
  return events.sort((a, b) => {
    const at = a.timestamp || "";
    const bt = b.timestamp || "";
    if (at !== bt) return at.localeCompare(bt);
    return a.evidence_id.localeCompare(b.evidence_id);
  });
}
