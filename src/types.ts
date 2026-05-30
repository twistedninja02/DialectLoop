export interface AudioSegment {
  segment_id: string;
  district: string;
  duration: number; // in seconds
  transcript: string;
  speaker_id: string;
}

export type ErrorType = 'MISHEAR' | 'DIALECT_MISMATCH' | 'PUNCTUATION' | 'CODE_SWITCH' | 'OTHER' | 'NONE';

export interface AuditorError {
  segment_id: string;
  error_type: ErrorType;
  error_token: string;
  suggested_correction: string;
  confidence: number;
}

export interface VerifierReport {
  segment_id: string;
  district_label: string;
  dialect_consistent: boolean;
  confidence: number;
  evidence: string[];
}

export interface CriticDecision {
  segment_id: string;
  consensus_flag: boolean; // if true, dialect consistent or validated clean; if false, discrepancy
  uncertainty: number; // calculated from self-consistency or discrepancy
  auditor_errors: AuditorError[];
  verifier_report: VerifierReport;
  escalated: boolean; // true if uncertainty > 0.6
  researcher_correction?: string; // free-text researcher feedback injected at Human Gate #1
}

export interface IterationReport {
  iteration_index: number;
  batch_error_rate: number;
  top_patterns: string[];
  recommended_action: string;
  self_summary: string; // Three verbatim sentences from Summarizer Self-Summary prompt
  critic_decisions: Record<string, CriticDecision>;
}

export interface BatchRun {
  batch_id: string;
  name: string;
  segments: AudioSegment[];
  current_iteration: number; // 1-indexed, max 3
  status: 'pending' | 'auditing' | 'needs_review' | 'analyzing' | 'completed';
  error_rate_threshold: number; // default τ = 0.05
  iterations: IterationReport[];
  confirmed_corrections: Record<string, string>; // segment_id -> correct transcript
}
