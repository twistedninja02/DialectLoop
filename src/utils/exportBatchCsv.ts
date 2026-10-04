import { BatchRun } from '../types';

/**
 * Generates a research-grade formatted CSV string from a BatchRun instance.
 * Maps all columns from the BatchRun schema including transcriber type, error rates,
 * iterative critic decisions, and human-verified corrections.
 * Includes UTF-8 Byte Order Mark (\uFEFF) for native compatibility with Excel, R, Pandas, and SPSS.
 */
export function generateBatchCsv(batch: BatchRun): string {
  const headers = [
    "batch_id",
    "batch_name",
    "transcriber_type",
    "segment_id",
    "district",
    "duration_s",
    "speaker_id",
    "initial_transcript",
    "confirmed_correction",
    "final_adjudicated_transcript",
    "has_human_correction",
    "current_iteration",
    "batch_status",
    "error_rate_threshold_tau",
    "initial_error_rate",
    "latest_error_rate",
    "has_converged",
    "latest_critic_decision",
    "latest_critic_suggested_correction",
    "latest_critic_uncertainty",
    "latest_critic_predicted_dialect",
    "latest_critic_reasoning",
    "audio_url",
    "exported_at"
  ];

  const initialErrorRate = batch.iterations.length > 0
    ? batch.iterations[0].batch_error_rate
    : 0;

  const latestIteration = batch.iterations.length > 0
    ? batch.iterations[batch.iterations.length - 1]
    : null;

  const latestErrorRate = latestIteration
    ? latestIteration.batch_error_rate
    : 0;

  const hasConverged = latestIteration
    ? (latestErrorRate <= batch.error_rate_threshold ? 1 : 0)
    : 0;

  const exportedAt = new Date().toISOString();

  const rows = batch.segments.map((seg) => {
    const confirmedCorrection = batch.confirmed_corrections[seg.segment_id] || "";
    const hasHumanCorrection = confirmedCorrection.trim().length > 0 ? 1 : 0;
    const finalAdjudicatedTranscript = hasHumanCorrection ? confirmedCorrection : seg.transcript;

    const criticDecision = latestIteration?.critic_decisions?.[seg.segment_id];
    const decisionType = criticDecision?.action || "PENDING";
    const suggestedCorrection = criticDecision?.suggested_correction || "";
    const uncertainty = criticDecision?.uncertainty !== undefined ? criticDecision.uncertainty : "";
    const predictedDialect = criticDecision?.verified_dialect || seg.district;
    const reasoning = (criticDecision?.reasoning || "").replace(/"/g, '""');

    return [
      `"${batch.batch_id}"`,
      `"${batch.name.replace(/"/g, '""')}"`,
      `"${batch.transcriber_type || 'Whisper-large-v3'}"`,
      `"${seg.segment_id}"`,
      `"${seg.district}"`,
      seg.duration,
      `"${seg.speaker_id || ''}"`,
      `"${seg.transcript.replace(/"/g, '""')}"`,
      `"${confirmedCorrection.replace(/"/g, '""')}"`,
      `"${finalAdjudicatedTranscript.replace(/"/g, '""')}"`,
      hasHumanCorrection,
      batch.current_iteration,
      `"${batch.status}"`,
      batch.error_rate_threshold,
      initialErrorRate.toFixed(4),
      latestErrorRate.toFixed(4),
      hasConverged,
      `"${decisionType}"`,
      `"${suggestedCorrection.replace(/"/g, '""')}"`,
      uncertainty,
      `"${predictedDialect}"`,
      `"${reasoning}"`,
      `"${seg.audio_url || ''}"`,
      `"${exportedAt}"`
    ].join(",");
  });

  // Prepend UTF-8 BOM so spreadsheet and statistical tools render Bengali Unicode without font mojibake
  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

/**
 * Triggers a browser download of the generated CSV file.
 */
export function downloadBatchCsv(batch: BatchRun): void {
  const csvContent = generateBatchCsv(batch);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const sanitizedBatchName = batch.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  link.setAttribute('href', url);
  link.setAttribute('download', `${sanitizedBatchName || batch.batch_id}_dialectloop_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
