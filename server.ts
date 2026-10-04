import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Standard imports from our source files
import { SAMPLE_SEGMENTS } from "./src/data";
import { BatchRun, IterationReport, CriticDecision, AudioSegment } from "./src/types";
import {
  runTranscriptionAuditorBatch,
  runDialectVerifierBatch,
  runCriticAgentBatch,
  runTranscriptionAuditor,
  runDialectVerifier,
  runCriticAgent,
  runSummariser,
  transcribeAudioSegment,
  verifyDialectWithGoogleSearch
} from "./server-agents";
import { harvestBanglaAudioData, CURATED_YOUTUBE_SOURCES } from "./server-harvester";
import { BENGALIAI_KAGGLE_BENCHMARK_CORPUS, generateBengaliAiResearchArtifacts } from "./server-bengaliai";
import { generateBatchCsv } from "./src/utils/exportBatchCsv";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory data store for running batches
let batches: Record<string, BatchRun> = {};

// Helper to compute cumulative tokens & cost for a batch
function updateBatchTokens(batch: BatchRun) {
  let promptTokens = 0;
  let compTokens = 0;
  let totalCost = 0;

  for (const iter of batch.iterations) {
    if (iter.tokens_consumed) {
      promptTokens += iter.tokens_consumed.prompt_tokens;
      compTokens += iter.tokens_consumed.completion_tokens;
      totalCost += iter.tokens_consumed.estimated_cost_usd;
    }
  }

  // Calculate audio duration in hours for this batch
  const totalAudioSecs = batch.segments.reduce((acc, s) => acc + (s.duration || 30.0), 0);
  const totalAudioHours = Math.max(0.001, totalAudioSecs / 3600);
  const costPerHour = totalCost > 0 ? Number((totalCost / totalAudioHours).toFixed(3)) : 0.725;

  batch.cumulative_tokens = {
    prompt_tokens: promptTokens,
    completion_tokens: compTokens,
    total_tokens: promptTokens + compTokens,
    total_cost_usd: Number(totalCost.toFixed(4)),
    cost_per_audio_hour: costPerHour
  };
}

// Initialize the default preloaded Bengali Speech Corpus batch
function initializeDefaultBatch() {
  const defaultBatchId = "bengali_speech_corpus_74h";
  const defaultBatch: BatchRun = {
    batch_id: defaultBatchId,
    name: "Bengali speech corpus (74-hour sample)",
    segments: [...SAMPLE_SEGMENTS],
    current_iteration: 1,
    status: "pending",
    error_rate_threshold: 0.05, // default τ = 0.05
    iterations: [],
    confirmed_corrections: {},
    cumulative_tokens: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      total_cost_usd: 0.0000,
      cost_per_audio_hour: 0.725 // Paper benchmark: $0.725 / audio hour
    }
  };
  batches[defaultBatchId] = defaultBatch;
}

initializeDefaultBatch();

// 1. Health check Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 2. Configuration diagnostic Endpoint
app.get("/api/config", (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const isKeyActive = !!key && key !== "MY_GEMINI_API_KEY" && key.trim() !== "";
  res.json({
    hasApiKey: isKeyActive,
    modelName: "gemini-3.7-flash",
    transcribeModel: "gemini-3.5-transcribe",
    searchGroundingModel: "gemini-3.5-flash"
  });
});

// Audio Transcription via OpenAI Whisper (GitHub: openai/whisper), Kaldi ASR (GitHub: kaldi-asr/kaldi), or Gemini Multimodal
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audioBase64, mimeType, contextPrompt, asrEngine, whisperModel, kaldiModel } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required" });
    }

    const result = await transcribeAudioSegment(
      audioBase64,
      mimeType || "audio/webm",
      contextPrompt,
      asrEngine || "whisper",
      whisperModel || "large-v3",
      kaldiModel || "tdnn-f"
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to transcribe audio" });
  }
});

// Google Search Grounding via gemini-3.5-flash with googleSearch tool
app.post("/api/search-grounding", async (req, res) => {
  try {
    const { query, districtCluster } = req.body;
    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }

    const result = await verifyDialectWithGoogleSearch(query, districtCluster || "General Bengali");
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Search grounding verification failed" });
  }
});

// YouTube & Internet Bangla Audio Harvester Endpoints
app.get("/api/curated-youtube-sources", (req, res) => {
  res.json(CURATED_YOUTUBE_SOURCES);
});

app.post("/api/harvest-youtube-audio", async (req, res) => {
  try {
    const { url, targetDistrict, segmentCount, segmentDuration, autoGroundWithSearch, transcriber } = req.body;
    if (!url || !targetDistrict) {
      return res.status(400).json({ error: "url and targetDistrict are required" });
    }

    const extractionResult = await harvestBanglaAudioData({
      url,
      targetDistrict,
      segmentCount: Number(segmentCount) || 6,
      segmentDuration: Number(segmentDuration) || 18,
      autoGroundWithSearch: !!autoGroundWithSearch,
      transcriber: transcriber || "Whisper-large-v3"
    });

    res.json(extractionResult);
  } catch (err: any) {
    console.error("YouTube audio harvest error:", err);
    res.status(500).json({ error: err.message || "Failed to harvest Bangla audio from source" });
  }
});

// Bengali.AI Kaggle Speech Recognition Corpus Endpoints
app.get("/api/bengaliai-corpus", (req, res) => {
  try {
    const { district, split } = req.query;
    let items = [...BENGALIAI_KAGGLE_BENCHMARK_CORPUS];

    if (district && district !== "All") {
      items = items.filter(i => i.district.toLowerCase() === String(district).toLowerCase());
    }

    if (split && split !== "all") {
      items = items.filter(i => i.split.toLowerCase() === String(split).toLowerCase());
    }

    const artifacts = generateBengaliAiResearchArtifacts(items);

    res.json({
      items,
      totalCount: items.length,
      datasetName: "Bengali.AI Speech Recognition Kaggle Competition (bengaliai-speech)",
      provenance: "Kaggle Benchmark / MADASR 1,200-hour Multi-dialect Spoken Bengali Corpus",
      artifacts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch Bengali.AI Kaggle corpus" });
  }
});

app.post("/api/bengaliai-create-batch", (req, res) => {
  try {
    const { district, selectedIds, transcriber } = req.body;
    let items = [...BENGALIAI_KAGGLE_BENCHMARK_CORPUS];

    if (Array.isArray(selectedIds) && selectedIds.length > 0) {
      items = items.filter(i => selectedIds.includes(i.utterance_id));
    } else if (district && district !== "All") {
      items = items.filter(i => i.district.toLowerCase() === String(district).toLowerCase());
    }

    if (items.length === 0) {
      return res.status(400).json({ error: "No segments found matching the selection criteria." });
    }

    const segments: AudioSegment[] = items.map((item, idx) => ({
      segment_id: item.utterance_id,
      district: item.district,
      duration: item.duration_s,
      transcript: item.raw_asr_transcript, // Candidate ASR for DialectLoop to QC
      speaker_id: `bengaliai_${item.speaker_gender}_${item.district.toLowerCase().slice(0, 3)}_${(idx % 4) + 1}`,
      audio_url: `https://www.kaggle.com/competitions/bengaliai-speech/data?select=${item.split}/${item.utterance_id}.mp3`
    }));

    const batchId = `bengaliai_kaggle_${Date.now()}`;
    const newBatch: BatchRun = {
      batch_id: batchId,
      name: `Bengali.AI Kaggle Speech (${district || "Multi-District"} - ${items.length} segs)`,
      segments,
      current_iteration: 1,
      status: "pending",
      error_rate_threshold: 0.05,
      iterations: [],
      confirmed_corrections: {},
      transcriber_type: transcriber || "Whisper-large-v3",
      cumulative_tokens: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        total_cost_usd: 0,
        cost_per_audio_hour: 0.725
      }
    };

    batches[batchId] = newBatch;
    res.status(201).json(newBatch);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create Bengali.AI batch" });
  }
});

// 3. Get all active batches
app.get("/api/batches", (req, res) => {
  res.json(Object.values(batches));
});

// Download batch formatted research CSV
app.get("/api/batches/:id/csv", (req, res) => {
  const batch = batches[req.params.id];
  if (!batch) {
    return res.status(404).send("Batch not found");
  }
  const csvContent = generateBatchCsv(batch);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${batch.batch_id}_dialectloop_export.csv"`
  );
  res.send(csvContent);
});

// 4. Create custom batch via JSON upload
app.post("/api/batches", (req, res) => {
  try {
    const { name, segments, threshold } = req.body;
    if (!name || !segments || !Array.isArray(segments)) {
      return res.status(400).json({ error: "Invalid batch payload. Name and segments array required." });
    }

    const batchId = `custom_batch_${Date.now()}`;
    const newBatch: BatchRun = {
      batch_id: batchId,
      name,
      segments: segments.map((seg: any, idx: number) => ({
        segment_id: seg.segment_id || `seg_custom_${idx}`,
        district: seg.district || "Dhaka",
        duration: Number(seg.duration) || 30.0,
        transcript: seg.transcript || "",
        speaker_id: seg.speaker_id || `spk_custom_${idx}`
      })),
      current_iteration: 1,
      status: "pending",
      error_rate_threshold: Number(threshold) || 0.05,
      iterations: [],
      confirmed_corrections: {},
      cumulative_tokens: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        total_cost_usd: 0.0000,
        cost_per_audio_hour: 0.725
      }
    };

    batches[batchId] = newBatch;
    res.json(newBatch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Reset batch to default state
app.post("/api/batches/:batchId/reset", (req, res) => {
  const { batchId } = req.params;
  if (batchId === "bengali_speech_corpus_74h") {
    initializeDefaultBatch();
    res.json(batches[batchId]);
  } else if (batches[batchId]) {
    batches[batchId] = {
      ...batches[batchId],
      current_iteration: 1,
      status: "pending",
      iterations: [],
      confirmed_corrections: {},
      cumulative_tokens: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        total_cost_usd: 0.0000,
        cost_per_audio_hour: 0.725
      }
    };
    res.json(batches[batchId]);
  } else {
    res.status(404).json({ error: "Batch not found" });
  }
});

// 6. Step 1: Run Multi-Agent Quality Control (Auditor + Verifier + Critic)
app.post("/api/batches/:batchId/run-agents", async (req, res) => {
  const { batchId } = req.params;
  const batch = batches[batchId];
  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  // Update status
  batch.status = "auditing";

  try {
    // 1. Prepare segments with any confirmed corrections
    const segmentsToEval = batch.segments.map(segment => {
      const hasCorrection = batch.confirmed_corrections[segment.segment_id];
      return {
        ...segment,
        transcript: hasCorrection || segment.transcript
      };
    });

    const confirmedList = Object.values(batch.confirmed_corrections);
    const forbiddenPatterns = batch.iterations.flatMap(iter => iter.top_patterns);

    // 2. Run Transcription Auditor in batch
    const auditorErrorsMap = await runTranscriptionAuditorBatch(segmentsToEval, confirmedList, forbiddenPatterns);

    // 3. Run Dialect Verifier in batch
    const verifierReportsMap = await runDialectVerifierBatch(segmentsToEval);

    // 4. Run Critic Agent in batch (resolve conflicts, calculate uncertainty)
    const criticDecisionsMap = await runCriticAgentBatch(segmentsToEval, auditorErrorsMap, verifierReportsMap);

    // Preserve previously manually corrected transcript value if any exists
    const results: CriticDecision[] = segmentsToEval.map(seg => {
      const decision = criticDecisionsMap[seg.segment_id];
      const hasCorrection = batch.confirmed_corrections[seg.segment_id];
      if (hasCorrection && decision) {
        decision.researcher_correction = hasCorrection;
      }
      return decision;
    }).filter(Boolean);

    // Save temporary decisions as part of an incomplete iteration report
    const activeIterationIdx = batch.current_iteration;
    batch.status = "needs_review";

    // Set temporary token usage for audit stage
    const auditPromptTokens = 2400 * segmentsToEval.length;
    const auditCompTokens = 650 * segmentsToEval.length;
    const auditCost = Number(((auditPromptTokens * 0.00000015) + (auditCompTokens * 0.00000060)).toFixed(4));

    const tempReport: IterationReport = {
      iteration_index: activeIterationIdx,
      batch_error_rate: 0.0,
      top_patterns: [],
      recommended_action: "Pending researcher correction review (Gate #1)",
      self_summary: "Pending review.",
      critic_decisions: results.reduce((acc, d) => {
        acc[d.segment_id] = d;
        return acc;
      }, {} as Record<string, CriticDecision>),
      tokens_consumed: {
        prompt_tokens: auditPromptTokens,
        completion_tokens: auditCompTokens,
        total_tokens: auditPromptTokens + auditCompTokens,
        estimated_cost_usd: auditCost
      }
    };

    // Replace or append current iteration report
    const existingIdx = batch.iterations.findIndex(it => it.iteration_index === activeIterationIdx);
    if (existingIdx >= 0) {
      batch.iterations[existingIdx] = tempReport;
    } else {
      batch.iterations.push(tempReport);
    }

    updateBatchTokens(batch);
    res.json(batch);
  } catch (error: any) {
    batch.status = "needs_review";
    res.status(500).json({ error: error.message });
  }
});

// 7. Step 2: Submit Researcher Corrections & Run Summariser (Human Gate #2)
app.post("/api/batches/:batchId/submit-corrections", async (req, res) => {
  const { batchId } = req.params;
  const { corrections } = req.body; // Map of segment_id -> correct transcript
  const batch = batches[batchId];

  if (!batch) {
    return res.status(404).json({ error: "Batch not found" });
  }

  batch.status = "analyzing";

  try {
    const activeIterationIdx = batch.current_iteration;
    const reportIdx = batch.iterations.findIndex(it => it.iteration_index === activeIterationIdx);
    if (reportIdx < 0) {
      return res.status(400).json({ error: "No active agents execution report found for this iteration index." });
    }

    const currentReport = batch.iterations[reportIdx];

    // Update corrections in batch database
    if (corrections) {
      Object.entries(corrections).forEach(([segId, transcript]) => {
        if (transcript && typeof transcript === "string" && transcript.trim() !== "") {
          batch.confirmed_corrections[segId] = transcript;
          // Apply corrected values to Critic report instantly
          const d = currentReport.critic_decisions[segId];
          if (d) {
            d.researcher_correction = transcript;
            d.consensus_flag = true; // Approved as clean because researcher resolved it
            d.escalated = false; // De-escalate
            d.uncertainty = 0.0;
            d.critic_consensus_score = 1.0;
            // Empty auditor errors to signify cleared
            d.auditor_errors = [{
              segment_id: segId,
              error_type: "NONE",
              error_token: "",
              suggested_correction: "",
              confidence: 1.0,
              cot_reasoning: "Corrected and verified by human supervisor at Gate #1."
            }];
          }
        }
      });
    }

    // Convert decisions to array to pass to Summariser
    const decisionsArray = Object.values(currentReport.critic_decisions);

    // Call Summariser agent to compute statistical indices and generate the final iteration layout
    const finalReport = await runSummariser(
      decisionsArray,
      activeIterationIdx,
      batch.error_rate_threshold
    );

    // Update the in-memory iteration report with Summariser outputs
    batch.iterations[reportIdx] = finalReport;

    // Check convergence criteria (tau threshold) or maximum iterations limit
    const errorRateSatisfied = finalReport.batch_error_rate <= batch.error_rate_threshold;
    const maxIterationsReached = batch.current_iteration >= 3; // Max iterations capped at 3 as per paper

    if (errorRateSatisfied) {
      batch.status = "completed";
    } else if (maxIterationsReached) {
      // Force exit loop if max iterations exceeded, escalate remaining issues to manual expert review
      batch.status = "completed";
      finalReport.recommended_action = "Max iteration cap (3) reached. Batch stopped and final remaining errors escalated to human specialist verification.";
    } else {
      // Re-queue loop for next iteration
      batch.current_iteration += 1;
      batch.status = "pending";
    }

    updateBatchTokens(batch);
    res.json(batch);
  } catch (error: any) {
    batch.status = "needs_review";
    res.status(500).json({ error: error.message });
  }
});

// 8. Serve Client Assets using Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DialectLoop Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
