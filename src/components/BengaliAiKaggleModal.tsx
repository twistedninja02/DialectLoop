import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Play,
  Pause,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Terminal,
  BookOpen,
  ArrowRight,
  Filter,
  X
} from 'lucide-react';
import { BatchRun } from '../types';

interface BengaliAiKaggleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadBatchIntoWorkspace: (batch: BatchRun) => void;
}

export default function BengaliAiKaggleModal({
  isOpen,
  onClose,
  onLoadBatchIntoWorkspace
}: BengaliAiKaggleModalProps) {
  const [districtFilter, setDistrictFilter] = useState<string>('All');
  const [splitFilter, setSplitFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [corpusData, setCorpusData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'segments' | 'latex' | 'csv' | 'bibtex' | 'cli'>('segments');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isCreatingBatch, setIsCreatingBatch] = useState<boolean>(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchCorpus();
  }, [isOpen, districtFilter, splitFilter]);

  const fetchCorpus = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (districtFilter !== 'All') params.append('district', districtFilter);
      if (splitFilter !== 'all') params.append('split', splitFilter);

      const res = await fetch(`/api/bengaliai-corpus?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCorpusData(data);
      }
    } catch (e) {
      console.warn("Error fetching Bengali.AI corpus:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleDownloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleSelectAll = () => {
    if (!corpusData?.items) return;
    if (selectedIds.length === corpusData.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(corpusData.items.map((i: any) => i.utterance_id));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreateWorkspaceBatch = async () => {
    setIsCreatingBatch(true);
    try {
      const res = await fetch('/api/bengaliai-create-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district: districtFilter,
          selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
          transcriber: 'Whisper-large-v3'
        })
      });

      if (res.ok) {
        const batch = await res.json();
        onLoadBatchIntoWorkspace(batch);
        onClose();
      }
    } catch (e) {
      console.error("Batch creation failed:", e);
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const items = corpusData?.items || [];
  const artifacts = corpusData?.artifacts || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/50">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <Database className="w-3 h-3 text-amber-400" />
                Kaggle Benchmark
              </span>
              <span className="text-[10px] font-mono text-indigo-300">
                1,200h Multi-accented Spoken Bengali
              </span>
              <a
                href="https://www.kaggle.com/competitions/bengaliai-speech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-cyan-300 hover:underline flex items-center gap-1"
              >
                kaggle.com/bengaliai-speech <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <h2 className="text-xl font-display font-extrabold tracking-tight">
              Bengali.AI Speech Recognition Corpus Fetcher
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Stratified regional Bengali dialect evaluation dataset for academic publications and DialectLoop quality control.
            </p>
          </div>

          <button
            onClick={onClose}
            className="self-start sm:self-auto p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls & Workspace Injector Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>District:</span>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-250 bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="All">All Districts (64 Strata)</option>
                <option value="Chittagong">Chittagong (Southeast)</option>
                <option value="Sylhet">Sylhet (Northeast)</option>
                <option value="Rajshahi">Rajshahi (Northwest)</option>
                <option value="Rangpur">Rangpur (Northwest)</option>
                <option value="Barisal">Barisal (South Central)</option>
                <option value="Khulna">Khulna (Southwest)</option>
                <option value="Jessore">Jessore (Southwest)</option>
                <option value="Dhaka">Dhaka (Central / Kutti)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <span>Split:</span>
              <select
                value={splitFilter}
                onChange={(e) => setSplitFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-250 bg-white text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Splits</option>
                <option value="train">Train (In-Domain)</option>
                <option value="validation">Validation</option>
                <option value="test">Test (Out-of-Domain)</option>
              </select>
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              Showing <strong>{items.length}</strong> utterances
            </span>
          </div>

          {/* Action: Inject into Workspace */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateWorkspaceBatch}
              disabled={isCreatingBatch || items.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 hover:shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {isCreatingBatch ? "Creating Batch..." : "Load into DialectLoop Workspace"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation for Academic Paper Artifacts */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-white text-xs font-medium">
          <button
            onClick={() => setActiveTab('segments')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'segments' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <Database className="w-3.5 h-3.5" /> Dataset Explorer ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('latex')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'latex' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <FileText className="w-3.5 h-3.5" /> Publication LaTeX Table
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'csv' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Gold Benchmark CSV
          </button>
          <button
            onClick={() => setActiveTab('bibtex')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'bibtex' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> BibTeX Citation
          </button>
          <button
            onClick={() => setActiveTab('cli')}
            className={`pb-2.5 px-2 border-b-2 font-semibold transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'cli' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
          >
            <Terminal className="w-3.5 h-3.5" /> Kaggle CLI & Ingestion
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
          
          {/* TAB 1: Dataset Explorer */}
          {activeTab === 'segments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                  />
                  <span>Select all for batch creation ({selectedIds.length} selected)</span>
                </div>
                <span>Source: Kaggle `bengaliai-speech` 32kHz FLAC/MP3</span>
              </div>

              <div className="space-y-2.5">
                {items.map((item: any) => (
                  <div
                    key={item.utterance_id}
                    className={`p-4 rounded-2xl border transition-all ${
                      selectedIds.includes(item.utterance_id)
                        ? 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.utterance_id)}
                          onChange={() => toggleSelectId(item.utterance_id)}
                          className="w-3.5 h-3.5 text-indigo-600 rounded"
                        />
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {item.utterance_id}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          {item.district} ({item.district_cluster})
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          item.split === 'test' ? 'bg-purple-100 text-purple-800' :
                          item.split === 'validation' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.split}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {item.duration_s}s | {item.speaker_gender}, {item.age_group}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          item.raw_asr_has_error
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {item.raw_asr_has_error ? 'ASR Slips Flagged' : 'Raw ASR Clean'}
                        </span>
                      </div>
                    </div>

                    {/* Transcripts Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
                          Raw Kaggle ASR Hypothesis
                        </span>
                        <p className="font-serif text-slate-800 text-[13px] leading-relaxed">
                          {item.raw_asr_transcript}
                        </p>
                      </div>

                      <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-200/80">
                        <span className="text-[10px] font-mono text-emerald-700 uppercase font-bold block mb-1">
                          Gold Phonetic Annotation (Target Ground Truth)
                        </span>
                        <p className="font-serif text-emerald-950 font-medium text-[13px] leading-relaxed">
                          {item.gold_annotated_transcript}
                        </p>
                      </div>
                    </div>

                    {/* Dialect tokens badges */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-400">Dialect Tokens:</span>
                      {item.dialectal_phonetic_tokens.map((tok: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 font-semibold"
                        >
                          {tok}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Publication LaTeX Table */}
          {activeTab === 'latex' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-display">
                    LaTeX Publication Table (ICML / ACL Ready)
                  </h4>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Include directly into your research paper manuscript under empirical results or dataset appendices.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(artifacts.latexTable, 'latex')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition cursor-pointer"
                  >
                    {copiedType === 'latex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedType === 'latex' ? "Copied LaTeX" : "Copy Code"}
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-slate-900 text-emerald-300 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-slate-800 max-h-96">
                {artifacts.latexTable || "% Loading LaTeX..."}
              </pre>
            </div>
          )}

          {/* TAB 3: Gold Benchmark CSV */}
          {activeTab === 'csv' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-display">
                    Bengali.AI Speech Recognition Gold Evaluation CSV
                  </h4>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Stratified evaluation CSV formatted with Kaggle utterance IDs, dialect tokens, and ASR ground-truth flags.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(artifacts.researchCsv, 'csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition cursor-pointer"
                  >
                    {copiedType === 'csv' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy CSV
                  </button>
                  <button
                    onClick={() => handleDownloadFile(artifacts.researchCsv, 'bengaliai_speech_eval_gold.csv', 'text/csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download .csv
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-slate-900 text-slate-200 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-slate-800 max-h-96">
                {artifacts.researchCsv || "Loading CSV..."}
              </pre>
            </div>
          )}

          {/* TAB 4: BibTeX Citation */}
          {activeTab === 'bibtex' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-display">
                    BibTeX Reference for Research Papers
                  </h4>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Cite the official Bengali.AI speech recognition benchmark in your research bibliography.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(artifacts.bibtexCitation, 'bibtex')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition cursor-pointer"
                >
                  {copiedType === 'bibtex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy BibTeX
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-amber-300 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-slate-800">
                {artifacts.bibtexCitation || "Loading BibTeX..."}
              </pre>
            </div>
          )}

          {/* TAB 5: Kaggle CLI & Python Ingestion */}
          {activeTab === 'cli' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-display">
                    Kaggle CLI & Dataset Ingestion Command
                  </h4>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Commands to pull the raw 1,200-hour multi-accent audio files directly from Kaggle.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(artifacts.kaggleCliScript, 'cli')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition cursor-pointer"
                >
                  {copiedType === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Commands
                </button>
              </div>

              <pre className="p-4 bg-slate-900 text-cyan-300 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed border border-slate-800">
                {artifacts.kaggleCliScript || "Loading CLI script..."}
              </pre>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Ethically cleared crowdsourced spoken Bengali under CC BY-SA 4.0 license.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-250 text-slate-700 rounded-xl hover:bg-slate-50 transition cursor-pointer font-semibold"
            >
              Close
            </button>
            <button
              onClick={handleCreateWorkspaceBatch}
              disabled={isCreatingBatch || items.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              {isCreatingBatch ? "Creating Batch..." : "Load into DialectLoop Workspace"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
