export type SourceKind = "claude_cli" | "claude_desktop" | "codex_cli" | "codex_desktop" | "gstack" | "manual";
export type SourceConfidence = "A" | "B" | "C";
export type EventRole = "user" | "assistant" | "tool" | "system" | "metadata";

export type AiUsageEvent = {
  evidence_id: string;
  source_kind: SourceKind;
  source_confidence: SourceConfidence;
  session_id: string;
  timestamp?: string;
  role: EventRole;
  redacted_text?: string;
  tool_name?: string;
  tool_args_redacted?: unknown;
  model?: string;
  reasoning_effort?: string;
  cwd_hash?: string;
  project_match?: boolean;
  raw_pointer: string;
};

export type RawEvent = Omit<AiUsageEvent, "evidence_id"> & {
  text?: string;
};

export type GuidanceLedger = {
  version: number;
  guidance: Array<{
    id: string;
    source_type: "public_doc" | "gstack_skill" | "gstack_doc" | "local_protocol";
    source_path_or_url: string;
    claim: string;
    last_verified: string;
    content_hash: string;
  }>;
};

export type SourceLedger = {
  version: number;
  sources: Array<{
    id: string;
    vendor: string;
    title: string;
    url: string;
    relevance: string[];
  }>;
};

export type FeatureLedger = {
  version: number;
  features: Array<{
    id: string;
    label: string;
    source_ids: string[];
    signals: string[];
  }>;
};

export type AnalysisFinding = {
  title: string;
  body: string;
  evidence_ids: string[];
  source_ids: string[];
  feature_id?: string;
  kind: "strength" | "pattern" | "underused_feature" | "teaching_note" | "prompt_rewrite" | "habit";
};

export type PrimaryAnalysis = {
  schema_version: 1;
  generated_at: string;
  project: string;
  one_line_read: string;
  what_user_was_trying_to_do: string;
  strengths: AnalysisFinding[];
  prompt_patterns: AnalysisFinding[];
  underused_features: AnalysisFinding[];
  teaching_notes: AnalysisFinding[];
  better_next_time_prompts: AnalysisFinding[];
  next_session_script: AnalysisFinding[];
  source_ids: string[];
  evidence_coverage: {
    total_events: number;
    user_prompts: number;
    tool_events: number;
    sessions: number;
    sources: Record<string, number>;
  };
  limits: string[];
};

export type SecondOpinion = {
  schema_version: 1;
  status: "skipped" | "unavailable" | "budget_required" | "completed";
  provider: "claude" | "codex" | "auto" | "none";
  other_model_used?: string;
  agreement?: string;
  disagreement?: string;
  missed_pattern?: string;
  weakest_recommendation?: string;
  strongest_recommendation?: string;
  final_adjustment?: string;
  evidence_ids: string[];
  source_ids: string[];
};

export type ReportJson = {
  schema_version: 1;
  generated_at: string;
  project: string;
  analysis: PrimaryAnalysis;
  second_opinion: SecondOpinion;
};

export type CoverageLevel = "none" | "low" | "medium" | "high";

export type OperatorRetroCoverage = {
  timeline_coverage: CoverageLevel;
  artifact_coverage: CoverageLevel;
  can_claim_skipped_gate: boolean;
};

export type OperatorRetroFinding = {
  kind: "operator_finding" | "best_run" | "missed_gstack_leverage" | "coverage_limit";
  title: string;
  body: string;
  evidence_ids: string[];
  guidance_ids: string[];
  confidence: CoverageLevel;
  claim_strength?: "observed" | "potential" | "limited";
};

export type ProposedAction = {
  action_id: string;
  type: "learning_candidate" | "routing_suggestion" | "next_prompt" | "skill_suggestion";
  title: string;
  body: string;
  status: "proposed";
  evidence_ids: string[];
  guidance_ids: string[];
  command_hint?: string;
};

export type OperatorRetroAnalysis = {
  schema_version: 2;
  generated_at: string;
  project: string;
  analysis_engine: "deterministic" | "model";
  one_line_read: string;
  operator_findings: OperatorRetroFinding[];
  best_runs: OperatorRetroFinding[];
  missed_gstack_leverage: OperatorRetroFinding[];
  proposed_actions: ProposedAction[];
  coverage_limits: OperatorRetroFinding[];
  guidance_ids: string[];
  coverage: OperatorRetroCoverage;
  evidence_coverage: {
    total_events: number;
    user_prompts: number;
    tool_events: number;
    sessions: number;
    sources: Record<string, number>;
  };
};

export type OperatorRetroReportJson = {
  schema_version: 2;
  generated_at: string;
  project: string;
  analysis: OperatorRetroAnalysis;
};

export type RunManifest = {
  schema_version: 1;
  run_id: string;
  project: string;
  project_path_hash: string;
  since?: string;
  generated_at: string;
  run_dir: string;
  warnings: string[];
  sources: Record<string, { events: number; warnings: string[] }>;
};
