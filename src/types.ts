export interface AudioSegment {
  segment_id: string;
  district: string;
  duration: number; // in seconds
  transcript: string;
  speaker_id: string;
  audio_url?: string; // synthetic or linked audio stream snippet
  audio_blob_b64?: string; // base64 encoded audio for immediate browser playback
}

export type ErrorType = 'MISHEAR' | 'DIALECT_MISMATCH' | 'PUNCTUATION' | 'CODE_SWITCH' | 'OTHER' | 'NONE';

export interface AuditorError {
  segment_id: string;
  error_type: ErrorType;
  error_token: string;
  suggested_correction: string;
  confidence: number;
  cot_reasoning?: string; // Chain-of-thought step-by-step reasoning
}

export interface VerifierReport {
  segment_id: string;
  district_label: string;
  dialect_consistent: boolean;
  confidence: number;
  evidence: string[];
  few_shot_matched?: { standard: string; dialect: string; markers: string[] }[]; // Few-shot contextual evidence
  cot_phonology_notes?: string;
}

export interface CriticDecision {
  segment_id: string;
  consensus_flag: boolean; // if true, dialect consistent or validated clean; if false, discrepancy
  uncertainty: number; // calculated from self-consistency or discrepancy
  auditor_errors: AuditorError[];
  verifier_report: VerifierReport;
  escalated: boolean; // true if uncertainty > 0.6
  researcher_correction?: string; // free-text researcher feedback injected at Human Gate #1
  resolution_reasoning?: string;
  critic_consensus_score?: number; // 0.0 to 1.0 confidence score
  critic_step_reasoning?: string[]; // Step-by-step multi-sample reconciliation
}

export interface IterationReport {
  iteration_index: number;
  batch_error_rate: number;
  top_patterns: string[];
  recommended_action: string;
  self_summary: string; // Three verbatim sentences from Summarizer Self-Summary prompt
  critic_decisions: Record<string, CriticDecision>;
  tokens_consumed?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
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
  transcriber_type?: 'Whisper-large-v3' | 'Whisper-medium' | 'Gemini-3.5-Transcribe' | 'Kaldi-TDNN-F' | string;
  cumulative_tokens?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
    cost_per_audio_hour: number;
  };
}

export interface ExtractedAudioSegment {
  segment_id: string;
  source_type: 'youtube' | 'web_stream' | 'direct_audio';
  source_url: string;
  video_title: string;
  channel_or_author?: string;
  timestamp_start: string; // e.g. "00:14"
  timestamp_end: string;   // e.g. "00:42"
  timestamp_start_sec: number;
  timestamp_end_sec: number;
  duration_s: number;
  district: string;
  district_cluster: string;
  speaker_id: string;
  transcript: string;
  phonetic_dialect_tokens: string[];
  transcriber_model?: string;
  // ICML 1200 predictions columns
  has_error_gt: number; // 0 or 1
  dialect_gt: string;
  manual_pred_err: number;
  manual_pred_dialect: string;
  gpt4o_pred_err: number;
  gpt4o_pred_dialect: string;
  loop_pred_err: number;
  loop_pred_dialect: string;
  // Qualitative & Research Grounding
  search_grounded_citation?: string;
  search_grounded_evidence?: string;
  audio_blob_b64?: string;
}

export interface AudioExtractionJob {
  job_id: string;
  source_url: string;
  video_title: string;
  channel_name: string;
  district: string;
  district_cluster: string;
  transcriber?: string;
  total_duration_sec: number;
  extracted_segments: ExtractedAudioSegment[];
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
}

