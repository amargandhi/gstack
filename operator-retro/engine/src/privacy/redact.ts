import * as path from "path";

export type RedactionResult = {
  text: string;
  redactions: number;
};

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  /\b(?:xoxb|xoxp|xapp)-[A-Za-z0-9-]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi,
  /\b(?:OPENAI|ANTHROPIC|GITHUB|SUPABASE|STRIPE|AWS)[A-Z0-9_]*=[^\s'"]+/g,
  /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s'")]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
];

const PII_PATTERNS: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d[\d .().-]{8,}\d)\b/g
];

export function redactText(input: string | undefined, projectPath?: string): RedactionResult {
  if (!input) return { text: "", redactions: 0 };
  let text = input;
  let redactions = 0;
  const replace = (regex: RegExp, token: string) => {
    text = text.replace(regex, () => {
      redactions++;
      return token;
    });
  };

  for (const regex of SECRET_PATTERNS) replace(regex, "[REDACTED_SECRET]");
  for (const regex of PII_PATTERNS) replace(regex, "[REDACTED_CONTACT]");

  if (projectPath) {
    const normalized = path.resolve(projectPath);
    if (normalized && text.includes(normalized)) {
      text = text.split(normalized).join("[PROJECT_PATH]");
      redactions++;
    }
  }

  replace(/\/Users\/[^/\s'")]+(?:\/[^\s'")]+){1,}/g, "[LOCAL_PATH]");
  replace(/\/home\/[^/\s'")]+(?:\/[^\s'")]+){1,}/g, "[LOCAL_PATH]");

  return { text, redactions };
}

export function hasHighRiskSecret(input: string): boolean {
  return SECRET_PATTERNS.some((regex) => {
    regex.lastIndex = 0;
    return regex.test(input);
  });
}

export function hasPrivatePath(input: string): boolean {
  return /\/Users\/[^/\s'")]+\/|\/home\/[^/\s'")]+\//.test(input);
}
