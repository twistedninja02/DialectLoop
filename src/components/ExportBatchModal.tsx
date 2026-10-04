import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Sliders,
  Sparkles,
  Info,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { BatchRun } from '../types';
import { generateBatchCsv, downloadBatchCsv } from '../utils/exportBatchCsv';

interface ExportBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchRun;
}

export default function ExportBatchModal({
  isOpen,
  onClose,
  batch
}: ExportBatchModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'preview' | 'schema'>('preview');

  if (!isOpen) return null;

  const csvString = generateBatchCsv(batch);
  const humanCorrectionCount = Object.keys(batch.confirmed_corrections || {}).filter(
    k => (batch.confirmed_corrections[k] || '').trim().length > 0
  ).length;

  const latestIteration = batch.iterations.length > 0
    ? batch.iterations[batch.iterations.length - 1]
    : null;

  const latestErrorRate = latestIteration
    ? (latestIteration.batch_error_rate * 100).toFixed(1)
    : 'N/A';

  const initialErrorRate = batch.iterations.length > 0
    ? (batch.iterations[0].batch_error_rate * 100).toFixed(1)
    : 'N/A';

  const handleCopy = () => {
    navigator.clipboard.writeText(csvString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadBatchCsv(batch);
  };

  // Preview first 5 rows
  const previewLines = csvString.replace(/^\uFEFF/, '').trim().split('\n').slice(0, 7);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3 h-3 text-indigo-400" />
                Research Dataset Exporter
              </span>
              <span className="text-[10px] font-mono text-purple-300">
                UTF-8 BOM Encoded
              </span>
            </div>
            <h2 className="text-xl font-display font-extrabold tracking-tight">
              Export Batch to Research CSV
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Export comprehensive per-segment annotations, transcriber backbones, convergence rates, and Gate #1 human corrections.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Metadata Summary Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Transcriber</span>
            <span className="font-mono font-bold text-purple-700 text-xs truncate block mt-0.5">
              {batch.transcriber_type || 'Whisper-large-v3'}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Total Segments</span>
            <span className="font-mono font-bold text-slate-800 text-xs block mt-0.5">
              {batch.segments.length} segments
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Error Rate</span>
            <span className="font-mono font-bold text-indigo-700 text-xs block mt-0.5">
              {initialErrorRate}% &rarr; {latestErrorRate}%
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Human Corrections</span>
            <span className="font-mono font-bold text-emerald-700 text-xs block mt-0.5">
              {humanCorrectionCount} verified
            </span>
          </div>
        </div>

        {/* Tab View Selector */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-white text-xs font-medium">
          <button
            onClick={() => setActiveView('preview')}
            className={`pb-2 px-2 border-b-2 font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeView === 'preview' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <FileText className="w-3.5 h-3.5" /> CSV Data Preview
          </button>
          <button
            onClick={() => setActiveView('schema')}
            className={`pb-2 px-2 border-b-2 font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeView === 'schema' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Column Schema Mapping Guide
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
          {activeView === 'preview' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-500">
                  Showing first {Math.min(previewLines.length - 1, 6)} rows of {batch.segments.length} records:
                </span>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  24 Research Columns Mapped
                </span>
              </div>

              <div className="p-4 bg-slate-900 text-slate-200 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-slate-800 max-h-72">
                <pre>{previewLines.join('\n')}</pre>
              </div>

              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>UTF-8 Unicode Notice:</strong> The file is exported with a Byte Order Mark (<code className="font-mono bg-white px-1 py-0.2 rounded">U+FEFF</code>). This guarantees native rendering of Bengali script characters (e.g., <em>আঁই</em>, <em>যাইউম</em>, <em>হামরা</em>) in Microsoft Excel, Python Pandas (<code className="font-mono bg-white px-1 py-0.2 rounded">encoding='utf-8-sig'</code>), R, Stata, and SPSS without character corruption.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                The exported CSV aligns strictly with the <code className="font-mono font-bold text-slate-800">BatchRun</code> schema and reproduces all variables needed for statistical hypothesis testing, ASR comparative evaluation, and qualitative error classification.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    name: 'transcriber_type',
                    desc: 'ASR engine that generated initial transcript (e.g. Whisper-large-v3, Kaldi-TDNN-F, Gemini-3.5).'
                  },
                  {
                    name: 'confirmed_correction',
                    desc: 'Ground-truth transcript edited and confirmed by human linguists at Human Gate #1.'
                  },
                  {
                    name: 'final_adjudicated_transcript',
                    desc: 'Coalesced gold transcript: confirmed correction if edited, else original ASR transcript.'
                  },
                  {
                    name: 'has_human_correction',
                    desc: 'Binary flag (1 or 0) indicating whether human intervention was applied.'
                  },
                  {
                    name: 'initial_error_rate & latest_error_rate',
                    desc: 'Convergence metrics measured before and after agent loop iterations.'
                  },
                  {
                    name: 'has_converged',
                    desc: 'Binary flag indicating whether latest error rate fell below target threshold τ.'
                  },
                  {
                    name: 'latest_critic_decision',
                    desc: 'Final action decision from Critic agent (CONFIRM, CORRECT, FLAG_FOR_REVIEW).'
                  },
                  {
                    name: 'latest_critic_uncertainty',
                    desc: 'Stochastic epistemic uncertainty score u ∈ [0, 1]. Values ≥ 0.6 trigger Gate #1.'
                  }
                ].map((col, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="font-mono font-bold text-indigo-700 text-[11px] block">{col.name}</span>
                    <span className="text-[11px] text-slate-600 mt-1 block leading-snug">{col.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            Filename: <strong>{batch.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_dialectloop_export.csv</strong>
          </span>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-250 text-slate-700 rounded-xl hover:bg-slate-50 transition cursor-pointer font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied CSV" : "Copy to Clipboard"}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 hover:shadow-md transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Formatted CSV
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
