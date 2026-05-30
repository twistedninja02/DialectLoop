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
  runTranscriptionAuditor,
  runDialectVerifier,
  runCriticAgent,
  runSummariser
} from "./server-agents";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory data store for running batches
let batches: Record<string, BatchRun> = {};

// Initialize the default preloaded Bengali Speech Corpus batch
function initializeDefaultBatch() {
  const defaultBatchId = "bengali_speech_corpus_74h";
  batches[defaultBatchId] = {
    batch_id: defaultBatchId,
    name: "Bengali speech corpus (74-hour sample)",
    segments: [...SAMPLE_SEGMENTS],
    current_iteration: 1,
    status: "pending",
    error_rate_threshold: 0.05, // default τ = 0.05
    iterations: [],
    confirmed_corrections: {}
  };
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
    modelName: "gemini-3.5-flash",
  });
});

// 3. Get all active batches
app.get("/api/batches", (req, res) => {
  res.json(Object.values(batches));
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
      confirmed_corrections: {}
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
      confirmed_corrections: {}
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
    const criticDecisions: CriticDecision[] = [];

    // Process all segments sequentially/parallelly through the 3-agent pipeline
    const pipelinePromises = batch.segments.map(async (segment) => {
      // 1. Check if we have standard corrections already confirmed by researcher
      const hasCorrection = batch.confirmed_corrections[segment.segment_id];
      const segmentToEval = {
        ...segment,
        transcript: hasCorrection || segment.transcript
      };

      // Extract previously confirmed corrections list to inject as system prompt context (Mitigation FM-2)
      const confirmedList = Object.values(batch.confirmed_corrections);
      const forbiddenPatterns = batch.iterations.flatMap(iter => iter.top_patterns);

      // 2. Run Transcription Auditor
      const auditorErrors = await runTranscriptionAuditor(segmentToEval, confirmedList, forbiddenPatterns);

      // 3. Run Dialect Verifier
      const verifierReport = await runDialectVerifier(segmentToEval);

      // 4. Run Critic Agent (resolve conflicts, calculate uncertainty)
      const criticDecision = await runCriticAgent(segmentToEval, auditorErrors, verifierReport);

      // Preserve previously manually corrected transcript value if any exists
      if (hasCorrection) {
        criticDecision.researcher_correction = hasCorrection;
      }

      return criticDecision;
    });

    const results = await Promise.all(pipelinePromises);

    // Save temporary decisions as part of an incomplete iteration report
    const activeIterationIdx = batch.current_iteration;
    
    // Check if we need to escalate any segments (uncertainty > 0.6)
    const hasEscalations = results.some(d => d.escalated);

    batch.status = "needs_review";

    // Set temporary empty summary for iteration report before researcher input completes Gate #2
    const tempReport: IterationReport = {
      iteration_index: activeIterationIdx,
      batch_error_rate: 0.0,
      top_patterns: [],
      recommended_action: "Pending researcher correction review (Gate #1)",
      self_summary: "Pending review.",
      critic_decisions: results.reduce((acc, d) => {
        acc[d.segment_id] = d;
        return acc;
      }, {} as Record<string, CriticDecision>)
    };

    // Replace or append current iteration report
    const existingIdx = batch.iterations.findIndex(it => it.iteration_index === activeIterationIdx);
    if (existingIdx >= 0) {
      batch.iterations[existingIdx] = tempReport;
    } else {
      batch.iterations.push(tempReport);
    }

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
            // Empty auditor errors to signify cleared
            d.auditor_errors = [{
              segment_id: segId,
              error_type: "NONE",
              error_token: "",
              suggested_correction: "",
              confidence: 1.0
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
