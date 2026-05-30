import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Search,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Activity,
  FileText,
  Sliders,
  Database,
  Upload,
  RotateCcw,
  Sparkles,
  ArrowRight,
  BookOpen,
  Code,
  Check,
  ChevronRight,
  UserCheck,
  Percent,
  HelpCircle
} from 'lucide-react';

import { BatchRun, AudioSegment, CriticDecision, IterationReport } from './types';
import AgentBadge from './components/AgentBadge';
import BatchStats from './components/BatchStats';
import PythonExporter from './components/PythonExporter';

export default function App() {
  const [activeTab, setActiveTab] = useState<'workspace' | 'python' | 'research'>('workspace');
  const [batches, setBatches] = useState<BatchRun[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('bengali_speech_corpus_74h');
  const [activeBatch, setActiveBatch] = useState<BatchRun | null>(null);
  const [isApiKeyActive, setIsApiKeyActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // State for manual user editor corrections at Human Gate #1 (segment_id -> transcript)
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  
  // Custom batch upload JSON state
  const [customJson, setCustomJson] = useState<string>('');
  const [customName, setCustomName] = useState<string>('Custom Linguistic Sample');
  const [customThreshold, setCustomThreshold] = useState<number>(0.05);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Load config & initial batch list on startup
  useEffect(() => {
    fetchConfig();
    fetchBatches();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setIsApiKeyActive(data.hasApiKey);
      }
    } catch (err) {
      console.warn("Failed to fetch server config diagnostics.", err);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/batches');
      if (res.ok) {
        const list = await res.json();
        setBatches(list);
        
        // Select active batch
        const active = list.find((b: BatchRun) => b.batch_id === selectedBatchId) || list[0];
        if (active) {
          setActiveBatch(active);
          setSelectedBatchId(active.batch_id);
          initializeCorrections(active);
        }
      }
    } catch (err) {
      setErrorMsg("Unable to index linguistic batches from backend service.");
    }
  };

  const initializeCorrections = (batch: BatchRun) => {
    // Populate working corrections input from existing iteration if relevant
    const working: Record<string, string> = {};
    if (batch.iterations && batch.iterations.length > 0) {
      const latestReport = batch.iterations[batch.iterations.length - 1];
      Object.entries(latestReport.critic_decisions).forEach(([segId, dec]) => {
        if (dec.escalated && dec.auditor_errors.length > 0) {
          working[segId] = dec.researcher_correction || dec.verifier_report.segment_id ? (latestReport.critic_decisions[segId]?.auditor_errors[0]?.suggested_correction || '') : '';
        }
      });
    }
    setCorrections(working);
  };

  const handleSelectBatch = (id: string) => {
    const active = batches.find((b) => b.batch_id === id);
    if (active) {
      setActiveBatch(active);
      setSelectedBatchId(id);
      initializeCorrections(active);
    }
  };

  const resetBatch = async () => {
    if (!activeBatch) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/batches/${activeBatch.batch_id}/reset`, { method: 'POST' });
      if (res.ok) {
        const reseted = await res.json();
        const updatedList = batches.map(b => b.batch_id === reseted.batch_id ? reseted : b);
        setBatches(updatedList);
        setActiveBatch(reseted);
        setCorrections({});
      }
    } catch (err) {
      setErrorMsg("Failed to reset linguistic database state.");
    } finally {
      setLoading(false);
    }
  };

  const runMultiAgentPipeline = async () => {
    if (!activeBatch) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/batches/${activeBatch.batch_id}/run-agents`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        const updatedList = batches.map(b => b.batch_id === updated.batch_id ? updated : b);
        setBatches(updatedList);
        setActiveBatch(updated);
        initializeCorrections(updated);
      } else {
        setErrorMsg("Failed to execute conversational quality sub-agents.");
      }
    } catch (err) {
      setErrorMsg("Network exception running Multi-Agent transcription check.");
    } finally {
      setLoading(false);
    }
  };

  const submitCorrectionsAndSummarize = async () => {
    if (!activeBatch) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/batches/${activeBatch.batch_id}/submit-corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections }),
      });
      if (res.ok) {
        const updated = await res.json();
        const updatedList = batches.map(b => b.batch_id === updated.batch_id ? updated : b);
        setBatches(updatedList);
        setActiveBatch(updated);
        initializeCorrections(updated);
      } else {
        setErrorMsg("Failed to process researcher Gate #1 corrections and generate summaries.");
      }
    } catch (err) {
      setErrorMsg("Network error during Gate #2 Summariser compilation.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCustomBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const parsed = JSON.parse(customJson);
      if (!Array.isArray(parsed)) {
        setErrorMsg("Linguistic corpus file must be a JSON array of segment items.");
        return;
      }

      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          segments: parsed,
          threshold: customThreshold
        })
      });

      if (res.ok) {
        const newBatch = await res.json();
        setBatches([...batches, newBatch]);
        setActiveBatch(newBatch);
        setSelectedBatchId(newBatch.batch_id);
        setCorrections({});
        setShowUploadModal(false);
        setCustomJson('');
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Linguistic batch compilation rejected by server.");
      }
    } catch (err) {
      setErrorMsg("Malformed JSON syntax in script. Please check brackets and commas.");
    }
  };

  const loadSampleJsonTemplate = () => {
    const template = [
      {
        "segment_id": "seg_custom_001",
        "district": "Chittagong",
        "duration": 28.5,
        "transcript": "আঁই কাইলকা সকালের ট্রেনে চিটাগাং যাইউম ভাই।",
        "speaker_id": "usr_99"
      },
      {
        "segment_id": "seg_custom_002",
        "district": "Dhaka",
        "duration": 34.1,
        "transcript": "আমি বাজারে কিলা আছো না খাইয়া চলে যাচ্ছি।",
        "speaker_id": "usr_98"
      }
    ];
    setCustomJson(JSON.stringify(template, null, 2));
  };

  const currentReport = activeBatch?.iterations?.find(
    (it) => it.iteration_index === activeBatch.current_iteration
  ) || (activeBatch?.iterations?.length ? activeBatch.iterations[activeBatch.iterations.length - 1] : null);

  const getAgentStatuses = () => {
    if (!activeBatch) return { auditor: 'idle', verifier: 'idle', critic: 'idle', summariser: 'idle' };
    const st = activeBatch.status;
    if (st === 'auditing') {
      return { auditor: 'working', verifier: 'working', critic: 'working', summariser: 'idle' };
    }
    if (st === 'needs_review') {
      return { auditor: 'done', verifier: 'done', critic: 'done', summariser: 'idle' };
    }
    if (st === 'analyzing') {
      return { auditor: 'done', verifier: 'done', critic: 'done', summariser: 'working' };
    }
    if (st === 'completed') {
      return { auditor: 'done', verifier: 'done', critic: 'done', summariser: 'done' };
    }
    return { auditor: 'idle', verifier: 'idle', critic: 'idle', summariser: 'idle' };
  };

  const agentStatuses = getAgentStatuses();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navigation Frame */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md flex items-center justify-center">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-slate-900 text-lg tracking-tight">DialectLoop</span>
                <span className="text-[10px] font-mono leading-none bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded">v1.1</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono">ICML 2026 Workshop · Quality Control Framework</p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-250">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${activeTab === 'workspace' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}
            >
              <Activity className="w-3.5 h-3.5" />
              Linguistic Workspace
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${activeTab === 'python' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}
            >
              <Code className="w-3.5 h-3.5" />
              Python Module
            </button>
            <button
              onClick={() => setActiveTab('research')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition duration-150 cursor-pointer ${activeTab === 'research' ? 'bg-white text-indigo-700 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Research Appendix
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Core System Diagnostic Alert */}
        <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between border border-emerald-100 bg-emerald-50/55 p-4 rounded-2xl gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl mt-0.5 ${isApiKeyActive ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-500/10 text-slate-700'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">
                  {isApiKeyActive ? 'Active Live AI Connection' : 'Sandboxed Dialectology Mode'}
                </span>
                <span className={`text-[10px] uppercase font-mono font-bold tracking-wide px-2 py-0.5 rounded-full ${isApiKeyActive ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>
                  {isApiKeyActive ? 'LIVE' : 'DEMO'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isApiKeyActive 
                  ? 'DialectLoop is checking transcripts using real server-side Gemini 3.5-flash agent modules.' 
                  : 'Running in safe validation sandbox mode with pre-loaded expert insights. Set your API Key in Settings > Secrets to unlock live tests.'}
              </p>
            </div>
          </div>
          <div className="text-[10px] font-mono bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl shadow-xs self-stretch md:self-auto flex items-center justify-between md:justify-center gap-3">
            <span className="font-semibold text-slate-400">Author Checklist:</span>
            <span className="text-indigo-600">✓ ICML Peer-Reviewed Ready</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 border border-rose-100 bg-rose-50 text-rose-800 p-4 rounded-xl text-xs font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">✕</button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* 1. WORKSPACE TAB */}
          {activeTab === 'workspace' && (
            <motion.div
              key="workspace-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              
              {/* Workspace Left Rail: Configuration & Selectors */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                
                {/* Batch Controller Widget */}
                <div className="bg-white border border-slate-205 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600" /> Speech Corpora
                    </h3>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-indigo-600 font-bold hover:text-indigo-800 transition"
                    >
                      <PlusIcon className="w-3.5 h-3.5" /> Upload File
                    </button>
                  </div>

                  <div className="space-y-3">
                    {batches.map((b) => (
                      <button
                        key={b.batch_id}
                        onClick={() => handleSelectBatch(b.batch_id)}
                        className={`w-full text-left p-3.5 rounded-xl border border-solid flex items-start gap-3 transition-all duration-250 cursor-pointer ${selectedBatchId === b.batch_id ? 'bg-indigo-50/60 border-indigo-250 ring-2 ring-indigo-500/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'}`}
                      >
                        <div className={`p-1.5 rounded-lg border shadow-xs ${selectedBatchId === b.batch_id ? 'bg-white text-indigo-605 border-indigo-150' : 'bg-white text-slate-400 border-slate-200'}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-slate-800 truncate leading-tight">{b.name}</h4>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border text-slate-500 leading-none">
                              {b.segments.length} segments
                            </span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border leading-none capitalize
                              ${b.status === 'completed' ? 'bg-emerald-100 border-emerald-200 text-emerald-800' :
                                b.status === 'needs_review' ? 'bg-amber-100 border-amber-200 text-amber-800' :
                                b.status === 'pending' ? 'bg-zinc-100 border-zinc-200 text-zinc-600' :
                                'bg-indigo-100 border-indigo-200 text-indigo-800'}`}
                            >
                              {b.status === 'needs_review' ? 'Gate #1 Alert' : b.status === 'analyzing' ? 'Summarizing' : b.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dialectology Loop Parameter Tuning */}
                {activeBatch && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2 mb-4">
                      <Sliders className="w-4 h-4 text-emerald-600" /> Loop Parameters
                    </h3>

                    <div className="space-y-4 text-xs">
                      <div>
                        <div className="flex justify-between text-slate-500 mb-1.5 font-medium">
                          <span>Convergence Error Threshold (τ)</span>
                          <span className="font-mono font-bold text-slate-800">{(activeBatch.error_rate_threshold * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.01"
                          max="0.15"
                          step="0.01"
                          value={activeBatch.error_rate_threshold}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const updated = { ...activeBatch, error_rate_threshold: val };
                            setActiveBatch(updated);
                            setBatches(batches.map(b => b.batch_id === activeBatch.batch_id ? updated : b));
                          }}
                          className="w-full select-none cursor-ew-resize accent-indigo-600"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-400 mt-1 font-mono">
                          <span>0.01 (High Stringency)</span>
                          <span>0.15 (Low Stringency)</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Current Loop Index:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-indigo-600 text-sm">Iteration #{activeBatch.current_iteration}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">/ max 3</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        {activeBatch.status !== 'pending' && (
                          <button
                            onClick={resetBatch}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset Loop Lifecycle
                          </button>
                        )}
                        <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                           FM-2 Precaution: Batch automatically capped at 3 iterations to avoid observation hypothethical anchoring loop flaws.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Agent State Panel */}
                <div className="flex flex-col gap-3">
                  <h3 className="font-display font-semibold text-slate-800 text-xs uppercase tracking-wider px-1">Sub-Agent Pipelines</h3>
                  <AgentBadge
                    name="Auditor"
                    status={agentStatuses.auditor as any}
                    description="Identifies phonetic mishears, disfluency & mismatches Using chain-of-thought system prompts"
                  />
                  <AgentBadge
                    name="Verifier"
                    status={agentStatuses.verifier as any}
                    description="Performs few-shot lexical classification across the 5 Bangladeshi district clusters"
                  />
                  <AgentBadge
                    name="Critic"
                    status={agentStatuses.critic as any}
                    description="Adversarially cross-validates Auditor against Verifier to resolve dialectal contradictions"
                  />
                  <AgentBadge
                    name="Summariser"
                    status={agentStatuses.summariser as any}
                    description="Calculates error rate metrics and structures three sentences of self-summary"
                  />
                </div>
              </div>

              {/* Workspace Right Main Panel: Playground Arena */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {activeBatch && (
                  <>
                    {/* Execution Controls Panel */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-mono text-indigo-500 uppercase font-semibold">Active Run Scope</span>
                          <h2 className="font-display font-bold text-slate-900 text-base mt-0.5 leading-tight">{activeBatch.name}</h2>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeBatch.status === 'pending' && (
                            <button
                              onClick={runMultiAgentPipeline}
                              disabled={loading}
                              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 hover:shadow-md transition cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Initialize Multi-Agent QC check
                            </button>
                          )}

                          {activeBatch.status === 'needs_review' && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> Gate #1 Escalated
                              </span>
                              <button
                                onClick={submitCorrectionsAndSummarize}
                                disabled={loading}
                                className="flex items-center justify-center gap-1 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 hover:shadow-md transition cursor-pointer"
                              >
                                Submit Gate #1 Feedbacks
                                <ArrowRight className="w-3.5 h-3.5 ml-1" />
                              </button>
                            </div>
                          )}

                          {activeBatch.status === 'completed' && (
                            <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> Batch Verified Clean (τ satisfied)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Chart Statistics Tab */}
                    {activeBatch.iterations.length > 0 && (
                      <BatchStats
                        iterations={activeBatch.iterations}
                        threshold={activeBatch.error_rate_threshold}
                      />
                    )}

                    {/* Interactive Segments Explorer */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-semibold text-slate-800 text-sm">Transcription Segment Quality</span>
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                            {activeBatch.segments.length} items
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          Target Loop: Iteration #{activeBatch.current_iteration}
                        </span>
                      </div>

                      {/* Playground Grid of Active Segments */}
                      <div className="space-y-4">
                        {activeBatch.segments.map((seg) => {
                          // Extract decisions from the latest execution if available
                          const lReport = activeBatch.iterations[activeBatch.iterations.length - 1];
                          const decision = lReport?.critic_decisions[seg.segment_id];
                          const segmentCorrection = activeBatch.confirmed_corrections[seg.segment_id];

                          return (
                            <div
                              key={seg.segment_id}
                              className={`border border-solid p-4 rounded-xl transition duration-200 bg-white
                                ${decision?.escalated 
                                  ? 'border-amber-250 ring-2 ring-amber-500/5 bg-amber-50/15' 
                                  : segmentCorrection 
                                    ? 'border-emerald-250 bg-emerald-50/5' 
                                    : 'border-slate-150 hover:border-slate-250'}`}
                            >
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-2.5 border-b border-slate-100/50 pb-2 mb-3">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="text-xs font-semibold font-mono text-slate-500">{seg.segment_id}</span>
                                  <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-semibold font-mono">
                                    District: {seg.district}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{seg.duration}s</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {decision?.escalated && (
                                    <span className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 font-mono">
                                      <AlertTriangle className="w-3 h-3" /> Escalated (Uncertainty: {decision.uncertainty})
                                    </span>
                                  )}
                                  {segmentCorrection && (
                                    <span className="text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 font-mono">
                                      <UserCheck className="w-3 h-3" /> Corrected & Approved
                                    </span>
                                  )}
                                  {decision && !decision.escalated && !segmentCorrection && (
                                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full font-mono uppercase font-bold flex items-center gap-1">
                                      ✓ Verified Clean
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div>
                                  <div className="text-[10px] font-mono text-slate-400 font-semibold mb-0.5">Linguistic Transcript</div>
                                  <p className="text-sm font-semibold text-slate-800 tracking-tight leading-relaxed">{seg.transcript}</p>
                                </div>

                                {/* Detailed Subagent Findings */}
                                {decision && (
                                  <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-lg p-3 space-y-2.5">
                                    {/* Dialectology Report */}
                                    {decision.verifier_report && (
                                      <div className="flex items-start gap-2 text-xs">
                                        <span className={`w-2 h-2 mt-1.5 rounded-full ${decision.verifier_report.dialect_consistent ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-700">Dialectology Check:</span>
                                            <span className={`text-[10px] font-mono font-bold uppercase ${decision.verifier_report.dialect_consistent ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {decision.verifier_report.dialect_consistent ? 'Dialect-consistent' : 'Anomalous dialect usage'}
                                            </span>
                                          </div>
                                          {decision.verifier_report.evidence && decision.verifier_report.evidence.length > 0 && (
                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                              Features identified: {decision.verifier_report.evidence.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Auditor Flags */}
                                    {decision.auditor_errors && decision.auditor_errors.length > 0 && decision.auditor_errors[0].error_type !== "NONE" && (
                                      <div className="flex items-start gap-2 text-xs bg-rose-50/30 p-2 rounded-md border border-rose-100/50">
                                        <Search className="w-3.5 h-3.5 text-rose-500 mt-0.5" />
                                        <div className="flex-1">
                                          <div className="font-semibold text-slate-700">Transcription Auditor Flags:</div>
                                          <div className="space-y-1 mt-1">
                                            {decision.auditor_errors.map((err, i) => (
                                              <div key={i} className="flex items-center gap-2 text-[10px] flex-wrap">
                                                <span className="font-mono bg-rose-100 text-rose-800 px-1.5 rounded text-[9px] uppercase font-bold">{err.error_type}</span>
                                                <span className="font-medium text-slate-800 font-mono">"{err.error_token}"</span>
                                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                                <span className="text-indigo-800 bg-indigo-50/50 px-1.5 py-0.5 rounded-md font-mono">Suggest: "{err.suggested_correction}"</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Critic Reasoning */}
                                    {decision.resolution_reasoning && (
                                      <div className="text-[10px] text-zinc-500 font-mono bg-slate-50 border border-slate-150 p-2 rounded-md">
                                        <span className="font-bold text-indigo-700 uppercase">Critic Consensus Audit:</span> {decision.resolution_reasoning}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Interactive Manual Escalation Form Field at Human Gate #1 */}
                                {decision?.escalated && activeBatch.status === 'needs_review' && (
                                  <div className="mt-3 pt-3 border-t border-slate-200 bg-amber-50/40 rounded-xl p-3">
                                    <label className="text-[11px] font-mono text-amber-800 font-bold block mb-1">
                                      MANUAL ESCALATION BOX — GATE #1 CORRECTIVE INPUT
                                    </label>
                                    <div className="flex gap-2.5">
                                      <input
                                        type="text"
                                        placeholder="Input standard spelling, dialect correct phrase or click suggest to autocomplete..."
                                        value={corrections[seg.segment_id] || ''}
                                        onChange={(e) => setCorrections({ ...corrections, [seg.segment_id]: e.target.value })}
                                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-amber-250 bg-white shadow-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-medium"
                                      />
                                      {decision.auditor_errors && decision.auditor_errors.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setCorrections({
                                            ...corrections,
                                            [seg.segment_id]: decision.auditor_errors[0].suggested_correction || seg.transcript
                                          })}
                                          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 text-[10px] font-mono uppercase font-bold cursor-pointer transition whitespace-nowrap"
                                        >
                                          Suggest Correction
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-amber-600 mt-1.5 font-mono">
                                      Critic uncertain details: {decision.resolution_reasoning || 'Disagreement detected between sub-agent validations.'}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summariser Outputs Panel (Gate #2) */}
                    {activeBatch.iterations.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle2 className="w-5 h-5 text-purple-600" />
                          <h3 className="font-display font-semibold text-slate-800 text-sm">Gate #2 Summariser Logs</h3>
                        </div>

                        {activeBatch.iterations.map((iter) => (
                          <div key={iter.iteration_index} className="border-l border-solid border-purple-200 pl-4 space-y-3 mb-6 last:mb-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-purple-700 font-display">Iteration #{iter.iteration_index} Reports</span>
                              <span className="text-[10px] font-mono bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-0.5 rounded-full">
                                Calculated Error Rate: {(iter.batch_error_rate * 100).toFixed(1)}%
                              </span>
                            </div>

                            {iter.top_patterns && iter.top_patterns.length > 0 && (
                              <div className="text-xs space-y-1">
                                <span className="font-semibold text-slate-700">Top Observed Quality Patterns:</span>
                                <ul className="list-disc list-inside text-zinc-500 pl-2 space-y-0.5">
                                  {iter.top_patterns.map((pat, i) => (
                                    <li key={i}>{pat}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* MANDATORY THREE SENTENCE REPORT DISPLAY (AS IN PAPER SECTION 3.3) */}
                            {iter.self_summary && (
                              <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl">
                                <span className="text-[10px] font-mono font-bold text-purple-700 uppercase tracking-widest block mb-1">
                                  Mandatory Summariser Self-Summary (Verbatim 3-sentence output)
                                </span>
                                <p className="text-xs text-purple-900 leading-relaxed font-semibold italic">"{iter.self_summary}"</p>
                              </div>
                            )}

                            {iter.recommended_action && (
                              <div className="text-xs">
                                <span className="font-semibold text-slate-700">Recommended action: </span>
                                <span className="text-zinc-500 font-mono italic">{iter.recommended_action}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

              </div>
            </motion.div>
          )}

          {/* 2. PYTHON TAB */}
          {activeTab === 'python' && (
            <motion.div
              key="python-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="bg-white border border-slate-201 rounded-2xl p-6 shadow-sm">
                <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                  <Code className="w-5 h-5 text-indigo-600" /> Exportable Python Implementation
                </h2>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  To ensure full scientific reproducibility as described in the **reproducibility checklist (Appendix B)** of the research paper, we release the complete Python code implementation. It uses the official modern `google-genai` library and contains schema-enforced Pydantic declarations for the 3-agent pipeline and the human correction loops.
                </p>
              </div>

              <PythonExporter />
            </motion.div>
          )}

          {/* 3. RESEARCH APPENDIX TAB */}
          {activeTab === 'research' && (
            <motion.div
              key="research-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              
              {/* Paper overview summary card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                <div className="md:col-span-3">
                  <span className="text-[10px] font-mono text-indigo-600 uppercase font-bold tracking-widest">AISTUDIO RESEARCH SUMMARY</span>
                  <h2 className="font-display font-bold text-slate-950 text-lg mt-1 tracking-tight leading-snug">
                    DialectLoop: A Multi-Agent LLM Workflow for Iterative Quality Control in Low-Resource Dialectal Speech Corpus Curation
                  </h2>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Manual quality control of Bengali regional speech corpora spanning various districts requires deep domain expertise. DialectLoop deploys an adversarial multi-agent pipeline alongside explicit human gates to reduce evaluation hours by 78% while improving error detection from 71% to 91% compared to traditional single-agent schemes.
                  </p>
                </div>
                <div className="md:col-span-1 border-t md:border-t-0 md:border-l border-slate-105 pl-0 md:pl-6 pt-4 md:pt-0 flex flex-col gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Research Author:</div>
                    <div className="text-xs font-bold text-slate-800">Anuj Sarker</div>
                    <div className="text-[10px] text-zinc-400 font-mono">Ahsanullah Univ of Science and Tech</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Track Venue:</div>
                    <div className="text-xs font-bold text-indigo-700">ICML 2026 Workshop</div>
                    <div className="text-[10px] text-zinc-400 font-mono">Iterative Research Automation & Agents</div>
                  </div>
                </div>
              </div>

              {/* Research Metrics comparison table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-display font-semibold text-slate-850 text-sm mb-4">Table 2: DialectLoop performance vs. Manual QC and GPT-4o Single-Agent baseline</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono uppercase tracking-wider text-[10px]">
                        <th className="p-4 font-semibold">Metric</th>
                        <th className="p-4 font-semibold text-center">Manual QC</th>
                        <th className="p-4 font-semibold text-center">GPT-4o Baseline</th>
                        <th className="p-4 font-semibold text-center text-indigo-700 bg-indigo-50/50">DialectLoop (Ours)</th>
                        <th className="p-4 font-semibold text-center text-emerald-700">Improvement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      <tr>
                        <td className="p-4 font-medium text-slate-800">Time per 1h audio reviewed (hrs)</td>
                        <td className="p-4 text-center text-zinc-505">14.2</td>
                        <td className="p-4 text-center text-zinc-505">8.6</td>
                        <td className="p-4 text-center font-bold text-indigo-650 bg-indigo-50/20">3.1</td>
                        <td className="p-4 text-center font-semibold text-emerald-600">78% reduction</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-800">Error detection rate (%)</td>
                        <td className="p-4 text-center text-zinc-505">71%</td>
                        <td className="p-4 text-center text-zinc-505">79%</td>
                        <td className="p-4 text-center font-bold text-indigo-650 bg-indigo-50/20">91%</td>
                        <td className="p-4 text-center font-semibold text-emerald-600">+12 pp over GPT-4o</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-800">Dialect label metadata accuracy</td>
                        <td className="p-4 text-center text-zinc-505">84%</td>
                        <td className="p-4 text-center text-zinc-505">78%</td>
                        <td className="p-4 text-center font-bold text-indigo-650 bg-indigo-50/20">89%</td>
                        <td className="p-4 text-center font-semibold text-emerald-600">+5 pp over manual</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-slate-800">Inter-annotator agreement (Cohen's κ)</td>
                        <td className="p-4 text-center text-zinc-505">0.74</td>
                        <td className="p-4 text-center text-zinc-505">0.71</td>
                        <td className="p-4 text-center font-bold text-indigo-650 bg-indigo-50/20">0.86</td>
                        <td className="p-4 text-center font-semibold text-emerald-600">+0.12 κ improvement</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 5 Failure Modes and Mitigations */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-rose-50/20 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <span className="text-[10px] font-mono font-bold text-rose-700 uppercase tracking-widest block">Failure Mode 1 (FM-1)</span>
                  <h4 className="font-display font-semibold text-slate-850 text-xs">Dialect Cluster Hallucination</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono">
                    Verifier consistently misclassified northwestern Rajshahi as southwestern Khulna markers due to overlapping phonetics in low-resource pre-training.
                  </p>
                  <div className="bg-white border border-rose-100 p-3 rounded-lg text-[11px]">
                    <span className="font-bold text-rose-600 font-mono">MITIGATION:</span> Extended few-shot density from 1 to 3 contrastive boundary items. Mismatch classification error rate dropped from 23% to 7%.
                  </div>
                </div>

                <div className="bg-amber-50/20 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <span className="text-[10px] font-mono font-bold text-amber-750 uppercase tracking-widest block">Failure Mode 2 (FM-2)</span>
                  <h4 className="font-display font-semibold text-slate-850 text-xs">Hypothesis Anchoring Loops</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono">
                    Auditor repeats initial error flags even after corrections due to context accumulation overweighting historic inputs.
                  </p>
                  <div className="bg-white border border-amber-100 p-3 rounded-lg text-[11px]">
                    <span className="font-bold text-amber-700 font-mono">MITIGATION:</span> Added a 'Forbidden corrections patterns list' to the Auditor system instruction context and capped max iterations at 3.
                  </div>
                </div>

                <div className="bg-indigo-50/20 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <span className="text-[10px] font-mono font-bold text-indigo-750 uppercase tracking-widest block">Failure Mode 3 (FM-3)</span>
                  <h4 className="font-display font-semibold text-slate-850 text-xs">Overconfident Consensus</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono">
                    Critic produced high-confidence low uncertainty evaluations on highly ambiguous borderline dialect transcripts.
                  </p>
                  <div className="bg-white border border-indigo-100 p-3 rounded-lg text-[11px]">
                    <span className="font-bold text-indigo-700 font-mono">MITIGATION:</span> Introduced a strict calibration constraint: 'If any two of three samples disagree, force uncertainty &gt;= 0.6 regardless of majority vote'. Expert agreement rose to 91%.
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating JSON Custom Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              layout
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl w-full max-w-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" /> Upload Custom Corpus File
                </h3>
                <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
              </div>

              <form onSubmit={handleUploadCustomBatch} className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-400 block mb-1">Batch Title</label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="E.g. Sylhet Region Corpus Batch 4"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-slate-400">Audio Segment JSON Array</label>
                    <button
                      type="button"
                      onClick={loadSampleJsonTemplate}
                      className="text-[9px] font-mono text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      (Load Sample Template)
                    </button>
                  </div>
                  <textarea
                    required
                    value={customJson}
                    onChange={(e) => setCustomJson(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 text-[11px] font-mono rounded-xl border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 text-slate-700 leading-relaxed scrollbar-thin"
                    placeholder='[\n  {\n    "segment_id": "seg_01",\n    "district": "Dhaka",\n    "duration": 30.5,\n    "transcript": "আমি রাজশাহী যাচ্ছি।",\n    "speaker_id": "spk_1"\n  }\n]'
                  />
                </div>

                <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-4">
                  <div>
                    <label className="text-[10px] font-mono uppercase font-bold text-slate-400 block mb-1">Target Error Threshold (τ)</label>
                    <select
                      value={customThreshold}
                      onChange={(e) => setCustomThreshold(parseFloat(e.target.value))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-medium outline-none"
                    >
                      <option value="0.01">1% Threshold</option>
                      <option value="0.03">3% Threshold</option>
                      <option value="0.05">5% Threshold (Default)</option>
                      <option value="0.10">10% Threshold</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 hover:shadow-md transition cursor-pointer"
                    >
                      Compile and Load Corpus
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple Helper Components for Layout
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}
