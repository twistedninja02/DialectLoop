import { GoogleGenAI, Type } from "@google/genai";
import { AudioSegment, AuditorError, VerifierReport, CriticDecision, IterationReport, ErrorType } from "./src/types";

// Helper to initialize GenAI client only if key is present
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// System prompts from paper verbatim
const AUDITOR_SYSTEM_PROMPT = `You are an expert Bengali NLP quality controller. You will receive a JSON object containing a speech segment transcript, its district label, and speaker metadata. Identify all transcription errors using chain-of-thought reasoning.
For each error, output a record containing: {segment_id, error_type, error_token, suggested_correction, confidence}.
Error types MUST be one of: MISHEAR, DIALECT_MISMATCH, PUNCTUATION, CODE_SWITCH, OTHER.
If no errors are found, return error_type as NONE and empty/placeholder values for error_token, suggested_correction, confidence.
Do not guess - if confidence < 0.5, mark the error as UNCERTAIN or use lower confidence score.`;

const VERIFIER_SYSTEM_PROMPT = `You are a Bengali dialectology expert. Given a transcript and its district label, verify that the lexical and phonological features are consistent with the stated dialect. Use the following district clusters: [Dhaka/Central], [Chittagong/Southeast], [Sylhet/Northeast], [Rajshahi/Northwest], [Khulna/Southwest].
Output a verified report containing: {segment_id, district_label, dialect_consistent: true/false, confidence: 0.0–1.0, evidence: [list of specific tokens]}`;

const CRITIC_SYSTEM_PROMPT = `You are an adversarial Critic Agent in a Bengali dialect QC team. You receive outputs from:
1. A Transcription Auditor (finds exact typos, mishears, punctuation, and suspected dialect mismatches).
2. A Dialect Verifier (checks if the overall phrasal, phonological, or lexical style of the transcript fits the district label).

Your job is to resolve contradictions. For example, if the Auditor suspects a DIALECT_MISMATCH but the Verifier reports the transcript is highly consistent (e.g. Chittagong dialect), verify if it is indeed a correct dialect representation (like আঁই যাইউম) rather than a transcription typo or code switch.
Perform self-consistency analysis:
1. Examine if either agent had low confidence.
2. If the Auditor or Verifier disagree heavily, or if there is structural ambiguity, calculate a high uncertainty score (0.0 to 1.0).
3. If any contradictions are deep or unresolved, escalate by setting uncertainty >= 0.6.
If you find there are real errors, output them in the final error list. If resolved clean, clear the errors or set error_type to NONE.`;

const SUMMARISER_SYSTEM_PROMPT = `You are a Summariser Agent compiling a Dialect QC iteration report. Examine the resolved segment decisions from this batch. Calculate the current batch error rate (percentage of segments containing unresolved errors). Identify the top 3 systematic error patterns.

As a core self-summary constraint, you MUST append three sentences verbatim at the end of your report answering:
(1) The current batch error rate and whether it meets threshold τ.
(2) The single most common systematic error pattern you observed.
(3) The one change to prompting or batching that would most improve the next iteration.`;

// Runs the Transcription Auditor
export async function runTranscriptionAuditor(
  segment: AudioSegment,
  confirmedCorrections?: string[],
  forbiddenCorrections?: string[]
): Promise<AuditorError[]> {
  const ai = getGenAI();
  if (!ai) {
    return getMockAuditorResult(segment);
  }

  const prompt = `
Segment Details:
${JSON.stringify(segment)}

${confirmedCorrections && confirmedCorrections.length > 0 ? `Confirmed corrections already applied (do not recheck these): ${JSON.stringify(confirmedCorrections)}` : ""}
${forbiddenCorrections && forbiddenCorrections.length > 0 ? `Do not re-flag the following error patterns: ${JSON.stringify(forbiddenCorrections)}` : ""}

Analyze the segment for errors and output JSON matching the specified schema.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: AUDITOR_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            errors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  segment_id: { type: Type.STRING },
                  error_type: { type: Type.STRING, description: "Must be MISHEAR, DIALECT_MISMATCH, PUNCTUATION, CODE_SWITCH, OTHER, or NONE" },
                  error_token: { type: Type.STRING },
                  suggested_correction: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                },
                required: ["segment_id", "error_type", "error_token", "suggested_correction", "confidence"]
              }
            }
          },
          required: ["errors"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return parsed.errors || [];
  } catch (error) {
    console.error("Error in Transcription Auditor LLM call:", error);
    return getMockAuditorResult(segment);
  }
}

// Runs the Dialect Verifier
export async function runDialectVerifier(
  segment: AudioSegment,
  fewShotExamples?: Record<string, any>
): Promise<VerifierReport> {
  const ai = getGenAI();
  if (!ai) {
    return getMockVerifierResult(segment);
  }

  const prompt = `
Segment to verify:
${JSON.stringify(segment)}

Few-Shot Examples context:
${JSON.stringify(fewShotExamples || {})}

Analyze the Dialectology of this segment and verify if the dialect features align with the district label. Return JSON.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: VERIFIER_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segment_id: { type: Type.STRING },
            district_label: { type: Type.STRING },
            dialect_consistent: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            evidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["segment_id", "district_label", "dialect_consistent", "confidence", "evidence"]
        }
      }
    });

    return JSON.parse(response.text || "{}") as VerifierReport;
  } catch (error) {
    console.error("Error in Dialect Verifier LLM call:", error);
    return getMockVerifierResult(segment);
  }
}

// Runs the Critic Agent (Human Gate #1 cross-validation)
export async function runCriticAgent(
  segment: AudioSegment,
  auditorErrors: AuditorError[],
  verifierReport: VerifierReport
): Promise<CriticDecision> {
  const ai = getGenAI();
  if (!ai) {
    return getMockCriticResult(segment, auditorErrors, verifierReport);
  }

  const prompt = `
Segment Details:
${JSON.stringify(segment)}

Transcription Auditor Flags:
${JSON.stringify(auditorErrors)}

Dialect Verifier Report:
${JSON.stringify(verifierReport)}

Analyze both reports. Cross-reference them to resolve contradictions.
If the Auditor reports a dialect mismatch but the Verifier confirms the dialect features are highly consistent for this district, resolve in favor of the Verifier (mark consensus_flag: true, clear dialect error flag or reduce uncertainty, indicating that regional features are correct).
If there are high-ambiguity boundary phrases or disagreement between agents, output uncertainty score >= 0.6 to alert the researcher (escalation).
`;

  try {
    // Perform self-consistency prompting by asking the model to think carefully
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: CRITIC_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segment_id: { type: Type.STRING },
            consensus_flag: { type: Type.BOOLEAN, description: "True if clean/resolved, false if there are unresolved systematic discrepancies" },
            uncertainty: { type: Type.NUMBER, description: "Uncertainty score from 0.0 to 1.0. Set >= 0.6 if there is severe contradiction, ambiguity or need for escalation" },
            resolution_reasoning: { type: Type.STRING },
            auditor_errors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  segment_id: { type: Type.STRING },
                  error_type: { type: Type.STRING },
                  error_token: { type: Type.STRING },
                  suggested_correction: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                },
                required: ["segment_id", "error_type", "error_token", "suggested_correction", "confidence"]
              }
            }
          },
          required: ["segment_id", "consensus_flag", "uncertainty", "resolution_reasoning", "auditor_errors"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    const uncertainty = parsed.uncertainty ?? 0.3;
    const escalated = uncertainty >= 0.6;

    return {
      segment_id: segment.segment_id,
      consensus_flag: parsed.consensus_flag ?? true,
      uncertainty,
      auditor_errors: parsed.auditor_errors || [],
      verifier_report: verifierReport,
      escalated
    };
  } catch (error) {
    console.error("Error in Critic Agent LLM call:", error);
    return getMockCriticResult(segment, auditorErrors, verifierReport);
  }
}

// Runs the Summariser (Human Gate #2 report aggregator)
export async function runSummariser(
  decisions: CriticDecision[],
  iterationIndex: number,
  threshold: number
): Promise<IterationReport> {
  const ai = getGenAI();

  // Basic stats
  const total = decisions.length;
  // A segment has errors if consensus_flag is false OR any auditor_error is not NONE/UNCERTAIN or has escalated
  const errorCount = decisions.filter(
    d => !d.consensus_flag || d.auditor_errors.some(e => e.error_type !== "NONE") || d.escalated
  ).length;
  const errorRate = total > 0 ? Number((errorCount / total).toFixed(3)) : 0.0;

  if (!ai) {
    return getMockSummariserResult(decisions, iterationIndex, errorRate, threshold);
  }

  const prompt = `
We have processed Batch Iteration #${iterationIndex}.
Here are the Critic Agent Decisions:
${JSON.stringify(decisions)}

Target Convergence Error Rate Threshold (tau): ${threshold}
Current custom calculated Error Rate: ${errorRate} (${errorCount} out of ${total} segments have outstanding quality flags).

Analyze these decisions to:
1. Extract top 3 systematic error patterns across this dialect batch.
2. Recommend concrete actions for the next iteration (e.g., prompt modifications, few-shot updates).
3. Draft the mandatory three-sentences self-summary exactly under the rules in the system instructions.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SUMMARISER_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            top_patterns: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            recommended_action: { type: Type.STRING },
            self_summary: { type: Type.STRING, description: "Exactly three sentences answering current error rate, common custom pattern, and suggested prompt parameter adjustments" }
          },
          required: ["top_patterns", "recommended_action", "self_summary"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");

    return {
      iteration_index: iterationIndex,
      batch_error_rate: errorRate,
      top_patterns: parsed.top_patterns || ["None observed"],
      recommended_action: parsed.recommended_action || "Advance to next batch",
      self_summary: parsed.self_summary || `The current batch error rate is ${errorRate * 100}%, which does metadata threshold validation check. The most prevalent error is dialectal code-switching indicators. Recommend introducing more contrastive boundary few-shots to reduce false flagging.`,
      critic_decisions: decisions.reduce((acc, curr) => {
        acc[curr.segment_id] = curr;
        return acc;
      }, {} as Record<string, CriticDecision>)
    };
  } catch (error) {
    console.error("Error in Summariser Agent LLM call:", error);
    return getMockSummariserResult(decisions, iterationIndex, errorRate, threshold);
  }
}

// ==========================================
// GRACEFUL MOCK FALLBACK DATA GENERATION
// ==========================================

function getMockAuditorResult(segment: AudioSegment): AuditorError[] {
  // Return realistic mock results based on the pre-loaded Bengali segments
  const { segment_id, transcript } = segment;

  if (segment_id === "seg_code_switch_001") {
    return [
      {
        segment_id,
        error_type: "CODE_SWITCH",
        error_token: "weather",
        suggested_correction: "আবহাওয়া (weather)",
        confidence: 0.95,
      },
      {
        segment_id,
        error_type: "CODE_SWITCH",
        error_token: "market",
        suggested_correction: "বাজার",
        confidence: 0.92,
      },
    ];
  }

  if (segment_id === "seg_dhaka_typo_003") {
    return [
      {
        segment_id,
        error_type: "MISHEAR",
        error_token: "জেতে",
        suggested_correction: "যেতে",
        confidence: 0.88,
      },
    ];
  }

  if (segment_id === "seg_ctg_mismatch_002") {
    return [
      {
        segment_id,
        error_type: "DIALECT_MISMATCH",
        error_token: "আঁই যাইউম",
        suggested_correction: "আমি যাবো (Dhaka/Standard)",
        confidence: 0.90,
      },
    ];
  }

  if (segment_id === "seg_sylhet_mismatch_002") {
    return [
      {
        segment_id,
        error_type: "DIALECT_MISMATCH",
        error_token: "কিলা আছো",
        suggested_correction: "কেমন আছো (Dhaka/Standard)",
        confidence: 0.93,
      },
    ];
  }

  if (segment_id === "seg_raj_mismatch_002") {
    return [
      {
        segment_id,
        error_type: "DIALECT_MISMATCH",
        error_token: "য্যাতচি",
        suggested_correction: "যাচ্ছি (Khulna/Standard)",
        confidence: 0.82,
      },
    ];
  }

  if (segment_id === "seg_audio_typo_002") {
    return [
      {
        segment_id,
        error_type: "PUNCTUATION",
        error_token: "যাইহু— না না কাইল",
        suggested_correction: "যাবো না, আগামীকাল সকালের ট্রেনে চট্টগ্রাম যাবো।",
        confidence: 0.75,
      },
    ];
  }

  return [
    {
      segment_id,
      error_type: "NONE",
      error_token: "",
      suggested_correction: "",
      confidence: 1.0,
    },
  ];
}

function getMockVerifierResult(segment: AudioSegment): VerifierReport {
  const { segment_id, district, transcript } = segment;

  if (segment_id === "seg_ctg_001") {
    return {
      segment_id,
      district_label: "Chittagong",
      dialect_consistent: true,
      confidence: 0.98,
      evidence: ["আঁই", "বিয়ানর", "যাইউম"],
    };
  }

  if (segment_id === "seg_dhaka_001") {
    return {
      segment_id,
      district_label: "Dhaka",
      dialect_consistent: true,
      confidence: 0.99,
      evidence: ["আমি", "আগামীকাল", "যাচ্ছি"],
    };
  }

  if (segment_id === "seg_ctg_mismatch_002") {
    return {
      segment_id,
      district_label: "Dhaka",
      dialect_consistent: false,
      confidence: 0.94,
      evidence: ["আঁই", "যাইউম", "কেন আছ"],
    };
  }

  if (segment_id === "seg_sylhet_001") {
    return {
      segment_id,
      district_label: "Sylhet",
      dialect_consistent: true,
      confidence: 0.92,
      evidence: ["কাইলকা", "সিলেট", "যাইয়ার"],
    };
  }

  if (segment_id === "seg_sylhet_mismatch_002") {
    return {
      segment_id,
      district_label: "Dhaka",
      dialect_consistent: false,
      confidence: 0.95,
      evidence: ["কিলা আছো", "করের"],
    };
  }

  if (segment_id === "seg_raj_mismatch_002") {
    return {
      segment_id,
      district_label: "Khulna",
      dialect_consistent: false,
      confidence: 0.88,
      evidence: ["য্যাতচি", "উ काम", "কত্তিছে"],
    };
  }

  if (segment_id === "seg_ctg_uncertain_001") {
    return {
      segment_id,
      district_label: "Chittagong",
      dialect_consistent: false, // Disagree context!
      confidence: 0.45,
      evidence: ["আঁই", "যাইউম", "আইজকা", "বইয়া রিউম"],
    };
  }

  return {
    segment_id,
    district_label: district,
    dialect_consistent: true,
    confidence: 0.85,
    evidence: [],
  };
}

function getMockCriticResult(
  segment: AudioSegment,
  auditorErrors: AuditorError[],
  verifierReport: VerifierReport
): CriticDecision {
  const { segment_id } = segment;

  // If there's an active dialect mismatch, or if it's the pre-seeded uncertain segment
  if (segment_id === "seg_ctg_uncertain_001") {
    return {
      segment_id,
      consensus_flag: false,
      uncertainty: 0.85, // Escalated trigger!
      auditor_errors: [
        {
          segment_id,
          error_type: "MISHEAR",
          error_token: "বইয়া রিউম বুঝতে পারতাছি না",
          suggested_correction: "বসে থাকবো বুঝতে পারছি না",
          confidence: 0.55,
        },
      ],
      verifier_report: verifierReport,
      escalated: true,
    };
  }

  // Mismatch error cases are resolved with consensus but flagged as needing corrections
  const hasDialectMismatch = verifierReport.dialect_consistent === false;
  const initialAuditorHasError = auditorErrors.some(e => e.error_type !== "NONE");

  let uncertainty = 0.2;
  if (hasDialectMismatch && !initialAuditorHasError) {
    uncertainty = 0.65; // Severe mismatch, escalate
  } else if (!hasDialectMismatch && initialAuditorHasError && auditorErrors[0].error_type === "DIALECT_MISMATCH") {
    // Critic resolves conflict! The auditor thought it was a dialect mismatch, but verifier said it is perfectly consistent!
    // This is the classic "Critic adversarial role" described in Section 2.2 of the paper.
    return {
      segment_id,
      consensus_flag: true,
      uncertainty: 0.35, // Low uncertainty because Critic successfully resolved it in favor of dialectal consistency
      auditor_errors: [
        {
          segment_id,
          error_type: "NONE", // Resolved
          error_token: "",
          suggested_correction: "",
          confidence: 0.90,
        },
      ],
      verifier_report: verifierReport,
      escalated: false,
    };
  }

  const hasErrors = initialAuditorHasError || hasDialectMismatch;

  return {
    segment_id,
    consensus_flag: !hasErrors,
    uncertainty,
    auditor_errors: auditorErrors,
    verifier_report: verifierReport,
    escalated: uncertainty >= 0.6 || hasErrors && segment_id.includes("mismatch"),
  };
}

function getMockSummariserResult(
  decisions: CriticDecision[],
  iterationIndex: number,
  errorRate: number,
  threshold: number
): IterationReport {
  const meetsThreshold = errorRate <= threshold;

  const topPatterns = [
    "Rajshahi morphological shifts mislabeled as Khulna boundary dialect clusters (FM-1)",
    "Sylhet lexical features ('কিলা আছো') mistakenly categorized as Dhaka standard dialect due to default LLM pre-training gaps",
    "Audio disfluency and punctuation issues flagged as code-switches in Chittagong segments",
  ];

  const recommendedAction = meetsThreshold
    ? "Batch meets quality convergence threshold. Marked as clean."
    : `Batch exhibits an error rate of ${(errorRate * 100).toFixed(1)}% which exceeds the threshold of ${(threshold * 100).toFixed(1)}%. Re-queue the batch with verified corrections injected into the system prompt context.`;

  const selfSummary = `The current iteration error rate is ${(errorRate * 100).toFixed(1)}%, which ${meetsThreshold ? "successfully satisfies" : "does not satisfy"} our target threshold of ${(threshold * 100).toFixed(1)}%. The single most common systematic error is the misclassification of northwestern Rajshahi features as southwestern Khulna boundaries. Recommend extending few-shot contrastive example density to 3 items per cluster to counter early anchoring loops.`;

  return {
    iteration_index: iterationIndex,
    batch_error_rate: errorRate,
    top_patterns: topPatterns,
    recommended_action: recommendedAction,
    self_summary: selfSummary,
    critic_decisions: decisions.reduce((acc, curr) => {
      acc[curr.segment_id] = curr;
      return acc;
    }, {} as Record<string, CriticDecision>),
  };
}
