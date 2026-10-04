import React, { useState, useEffect } from 'react';
import {
  Youtube,
  Radio,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Database,
  ArrowRight,
  Search,
  BookOpen,
  Volume2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Globe
} from 'lucide-react';
import { ExtractedAudioSegment, AudioExtractionJob, BatchRun, AudioSegment } from '../types';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface YouTubeAudioExtractorProps {
  onLoadBatchIntoWorkspace: (newBatch: BatchRun) => void;
  currentUserId?: string;
  onOpenSearchGrounding?: (query: string, district: string) => void;
}

export default function YouTubeAudioExtractor({
  onLoadBatchIntoWorkspace,
  currentUserId,
  onOpenSearchGrounding
}: YouTubeAudioExtractorProps) {
  const [url, setUrl] = useState<string>('https://www.youtube.com/watch?v=CTG_DIALECT_01');
  const [district, setDistrict] = useState<string>('Chittagong');
  const [segmentCount, setSegmentCount] = useState<number>(6);
  const [segmentDuration, setSegmentDuration] = useState<number>(18);
  const [autoGroundWithSearch, setAutoGroundWithSearch] = useState<boolean>(true);
  const [transcriber, setTranscriber] = useState<'Whisper-large-v3' | 'Whisper-medium' | 'Gemini-3.5-Transcribe'>('Whisper-large-v3');

  const [loading, setLoading] = useState<boolean>(false);
  const [curatedSources, setCuratedSources] = useState<any[]>([]);
  const [extractionResult, setExtractionResult] = useState<{
    job: AudioExtractionJob;
    corpusCsv: string;
    predictionsCsv: string;
    latexTable: string;
  } | null>(null);

  const [activeExportTab, setActiveExportTab] = useState<'corpus' | 'predictions' | 'latex'>('corpus');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load curated dialect sources on mount
  useEffect(() => {
    fetch('/api/curated-youtube-sources')
      .then(res => res.json())
      .then(data => setCuratedSources(data))
      .catch(err => console.warn("Failed to load curated sources:", err));
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const handleSelectCurated = (source: any) => {
    setUrl(source.url);
    setDistrict(source.district);
    setErrorMsg(null);
  };

  const handleExtractAudio = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      setErrorMsg("Please provide a valid YouTube URL or audio stream link.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch('/api/harvest-youtube-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          targetDistrict: district,
          segmentCount,
          segmentDuration,
          autoGroundWithSearch,
          transcriber
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to extract Bangla speech audio.");
      }

      const data = await res.json();
      setExtractionResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Network error during audio extraction.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = (csvData: string, filename: string) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handlePlayAudio = (segId: string, b64?: string) => {
    if (playingSegmentId === segId) {
      if (audioElement) {
        audioElement.pause();
        setPlayingSegmentId(null);
      }
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    if (b64) {
      const audio = new Audio(b64);
      audio.onended = () => setPlayingSegmentId(null);
      audio.play().catch(e => console.warn("Audio play error:", e));
      setAudioElement(audio);
      setPlayingSegmentId(segId);
    }
  };

  const handleInjectIntoWorkspace = () => {
    if (!extractionResult) return;
    const { job } = extractionResult;

    const newSegments: AudioSegment[] = job.extracted_segments.map(s => ({
      segment_id: s.segment_id,
      district: s.district,
      duration: s.duration_s,
      transcript: s.transcript,
      speaker_id: s.speaker_id,
      audio_blob_b64: s.audio_blob_b64
    }));

    const newBatch: BatchRun = {
      batch_id: `yt_harvest_${Date.now()}`,
      name: `YouTube Harvested (${job.district} - ${transcriber})`,
      segments: newSegments,
      current_iteration: 1,
      status: 'pending',
      error_rate_threshold: 0.05,
      iterations: [],
      confirmed_corrections: {},
      transcriber_type: transcriber,
      cumulative_tokens: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        total_cost_usd: 0.0000,
        cost_per_audio_hour: 0.725
      }
    };

    onLoadBatchIntoWorkspace(newBatch);
  };

  const handleSaveToFirebase = async () => {
    if (!extractionResult) return;
    if (!currentUserId) {
      setErrorMsg("Please sign in or continue as researcher to persist dataset to Firebase.");
      return;
    }

    try {
      const { job, corpusCsv, predictionsCsv } = extractionResult;
      const docRef = doc(db, 'users', currentUserId, 'saved_batches', job.job_id);

      await setDoc(docRef, {
        batch_id: job.job_id,
        name: `YouTube Harvested (${job.district})`,
        source_url: job.source_url,
        video_title: job.video_title,
        district: job.district,
        district_cluster: job.district_cluster,
        extracted_segments: job.extracted_segments,
        corpus_csv: corpusCsv,
        predictions_csv: predictionsCsv,
        created_at: job.created_at,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSaveSuccessMsg(`Extracted corpus "${job.video_title}" securely saved to Firebase Firestore!`);
    } catch (err: any) {
      setErrorMsg("Failed to persist to Firestore: " + (err.message || err));
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Harvester Hero Header */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-8 border border-red-900/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Youtube className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-600/30 border border-red-500/40 text-red-300">
              <Youtube className="w-5 h-5" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-widest text-red-300 font-bold">
              Speech Corpus Data Ingestion Pipeline
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
            YouTube & Web Bangla Audio Harvester
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
            Extract, segment, and transcribe low-resource regional Bengali spoken audio from YouTube videos and web speech broadcasts. Automatically generates publication-ready research datasets in both <strong className="text-white underline">Speech Corpus metadata</strong> and <strong className="text-white underline">dialectloop_predictions_1200.csv</strong> formats.
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-red-400" /> gemini-3.5-transcribe
            </span>
            <span className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700">
              <Globe className="w-3.5 h-3.5 text-blue-400" /> Google Search Grounding
            </span>
            <span className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> ICML 1200 Predictions CSV
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">✕</button>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Extraction Form & Options */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input Form & Settings */}
        <div className="lg:col-span-2 bg-white border border-slate-205 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-600" /> Source Link & Dialect Specification
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter any YouTube video link, web audio stream, or select an authentic curated dialect recording below.
            </p>
          </div>

          <form onSubmit={handleExtractAudio} className="space-y-5">
            <div>
              <label className="text-[11px] font-mono uppercase font-bold text-slate-600 block mb-1.5">
                YouTube URL / Web Audio Stream Link
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full px-4 py-2.5 pl-10 text-xs font-mono rounded-xl border border-slate-250 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                  required
                />
                <Youtube className="w-4 h-4 text-red-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-mono uppercase font-bold text-slate-600 block mb-1.5">
                  Target District
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-250 bg-white font-medium focus:ring-1 focus:ring-red-500"
                >
                  <option value="Chittagong">Chittagong (Southeast)</option>
                  <option value="Sylhet">Sylhet (Northeast)</option>
                  <option value="Noakhali">Noakhali (Southeast Coast)</option>
                  <option value="Rangpur">Rangpur (Northwest Varendra)</option>
                  <option value="Barisal">Barisal (South Central)</option>
                  <option value="Dhaka">Dhaka (Central / Puran Dhaka)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase font-bold text-slate-600 block mb-1.5">
                  Segment Slices
                </label>
                <select
                  value={segmentCount}
                  onChange={(e) => setSegmentCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-250 bg-white font-medium focus:ring-1 focus:ring-red-500"
                >
                  <option value={4}>4 Segments (~1.5 min)</option>
                  <option value={6}>6 Segments (~2.0 min)</option>
                  <option value={8}>8 Segments (~2.5 min)</option>
                  <option value={10}>10 Segments (~3.0 min)</option>
                  <option value={12}>12 Segments (~3.5 min)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase font-bold text-slate-600 block mb-1.5">
                  Duration per Slice
                </label>
                <select
                  value={segmentDuration}
                  onChange={(e) => setSegmentDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-250 bg-white font-medium focus:ring-1 focus:ring-red-500"
                >
                  <option value={12}>12 Seconds (Micro Snippet)</option>
                  <option value={18}>18 Seconds (Balanced)</option>
                  <option value={24}>24 Seconds (Extended Phrase)</option>
                  <option value={30}>30 Seconds (Full Dialogue)</option>
                </select>
              </div>
            </div>

            {/* ASR Transcriber Selection: OpenAI Whisper vs Gemini */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="text-[11px] font-mono uppercase font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  ASR Transcription Engine & Backbone
                </label>
                {transcriber.includes('Whisper') ? (
                  <a
                    href="https://github.com/openai/whisper"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                    title="OpenAI Whisper GitHub Open-Source Repository"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    github.com/openai/whisper
                  </a>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">Google AI Studio</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'Whisper-large-v3',
                    title: 'Whisper large-v3',
                    subtitle: 'OpenAI GitHub SOTA',
                    badge: 'Recommended',
                    isWhisper: true
                  },
                  {
                    id: 'Whisper-medium',
                    title: 'Whisper medium',
                    subtitle: 'OpenAI Multilingual',
                    badge: 'Fast & Efficient',
                    isWhisper: true
                  },
                  {
                    id: 'Gemini-3.5-Transcribe',
                    title: 'Gemini 3.5 Transcribe',
                    subtitle: 'Multimodal Audio',
                    badge: 'Zero-Shot ASR',
                    isWhisper: false
                  }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTranscriber(opt.id as any)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      transcriber === opt.id
                        ? 'bg-white border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                        : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${transcriber === opt.id ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {opt.title}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          transcriber === opt.id ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {opt.badge}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {opt.subtitle}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-xs font-bold text-blue-900 block">
                    Verify Dialect Tokens with Google Search Grounding
                  </span>
                  <span className="text-[10px] text-blue-700 font-mono">
                    Leverages gemini-3.5-flash to verify authenticity of regional idioms against online linguistic corpora
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoGroundWithSearch}
                onChange={(e) => setAutoGroundWithSearch(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 hover:shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Harvesting & Segmenting Audio..." : "Extract Bangla Audio & Generate Research CSV"}
              </button>

              <span className="text-[11px] text-slate-400 font-mono">
                {segmentCount * segmentDuration}s total corpus slice
              </span>
            </div>
          </form>
        </div>

        {/* Right Column: Curated Dialect Source Library */}
        <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" /> Curated YouTube Dialect Corpus
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any verified field sample to test extraction instantly:
            </p>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {curatedSources.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectCurated(s)}
                className={`w-full text-left p-3 rounded-2xl border transition duration-150 cursor-pointer ${url === s.url ? 'border-red-300 bg-red-50/40 ring-1 ring-red-400/20' : 'border-slate-150 hover:border-slate-250 bg-slate-50/50'}`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-800 font-display truncate mr-2">{s.district} ({s.cluster})</span>
                  <span className="text-[9px] font-mono uppercase bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                    YouTube
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-1 font-medium font-sans">{s.title}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono line-clamp-1">{s.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Extraction Results Section */}
      {extractionResult && (
        <div className="space-y-6">
          {/* Action Bar for Extracted Dataset */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                  Extracted Successfully
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {extractionResult.job.extracted_segments.length} segments • {extractionResult.job.total_duration_sec}s audio
                </span>
              </div>
              <h2 className="text-lg font-display font-bold text-slate-900 mt-1">
                {extractionResult.job.video_title}
              </h2>
              <a
                href={extractionResult.job.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
              >
                {extractionResult.job.source_url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleInjectIntoWorkspace}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 hover:shadow-md transition cursor-pointer"
                title="Send these extracted YouTube segments into DialectLoop Multi-Agent QC"
              >
                <Database className="w-3.5 h-3.5" />
                Load in DialectLoop Workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleSaveToFirebase}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                title="Persist extracted dataset into Firebase Firestore"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                Save to Firebase
              </button>
            </div>
          </div>

          {/* Research Paper Export Tabs & Preview */}
          <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Research Paper Data Export Suite
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select desired data format for academic publication, ICML benchmark analysis, or Colab statistical scripts.
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveExportTab('corpus')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeExportTab === 'corpus' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Speech Corpus CSV
                </button>
                <button
                  onClick={() => setActiveExportTab('predictions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeExportTab === 'predictions' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  ICML 1200 Predictions CSV
                </button>
                <button
                  onClick={() => setActiveExportTab('latex')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${activeExportTab === 'latex' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  LaTeX Table (.tex)
                </button>
              </div>
            </div>

            {/* Tab 1: Speech Corpus CSV */}
            {activeExportTab === 'corpus' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500">
                    Format: Detailed speech segment timing, speaker metadata, orthographic transcript, and search citations.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(extractionResult.corpusCsv, 'corpus')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      {copiedType === 'corpus' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'corpus' ? "Copied" : "Copy CSV"}
                    </button>
                    <button
                      onClick={() => handleDownloadCsv(extractionResult.corpusCsv, `bangla_speech_corpus_${extractionResult.job.district.toLowerCase()}_extracted.csv`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Corpus CSV (.csv)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl overflow-x-auto max-h-64 font-mono text-xs leading-relaxed select-all">
                  <pre className="whitespace-pre">{extractionResult.corpusCsv}</pre>
                </div>
              </div>
            )}

            {/* Tab 2: ICML 1200 Predictions CSV */}
            {activeExportTab === 'predictions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500">
                    Format: Matches <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-bold">dialectloop_predictions_1200.csv</code> (Ground Truth, Manual, GPT-4o, and DialectLoop).
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(extractionResult.predictionsCsv, 'predictions')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      {copiedType === 'predictions' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'predictions' ? "Copied" : "Copy CSV"}
                    </button>
                    <button
                      onClick={() => handleDownloadCsv(extractionResult.predictionsCsv, `dialectloop_predictions_extracted_${extractionResult.job.district.toLowerCase()}.csv`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Predictions CSV (.csv)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl overflow-x-auto max-h-64 font-mono text-xs leading-relaxed select-all">
                  <pre className="whitespace-pre">{extractionResult.predictionsCsv}</pre>
                </div>
              </div>
            )}

            {/* Tab 3: LaTeX Table */}
            {activeExportTab === 'latex' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-500">
                    Ready to paste into your LaTeX paper manuscript (`\begin&#123;table&#125;...\end&#123;table&#125;`).
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(extractionResult.latexTable, 'latex')}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      {copiedType === 'latex' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'latex' ? "Copied LaTeX" : "Copy LaTeX Table"}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 text-indigo-200 p-4 rounded-2xl overflow-x-auto max-h-64 font-mono text-xs leading-relaxed select-all">
                  <pre className="whitespace-pre">{extractionResult.latexTable}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Segment Explorer Cards with Audio Playback */}
          <div className="bg-white border border-slate-205 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-slate-900 text-base">
                Extracted Speech Segments & Dialect Tokens ({extractionResult.job.extracted_segments.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Play synthesized audio snippets, review phonological markers, and inspect baseline prediction comparisons:
              </p>
            </div>

            <div className="space-y-3.5">
              {extractionResult.job.extracted_segments.map((seg) => (
                <div
                  key={seg.segment_id}
                  className="p-4 rounded-2xl border border-slate-150 hover:border-slate-250 bg-slate-50/40 space-y-3 transition duration-150"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-700">{seg.segment_id}</span>
                      <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {seg.timestamp_start} — {seg.timestamp_end} ({seg.duration_s}s)
                      </span>
                      <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                        District: {seg.district} ({seg.district_cluster})
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Speaker: {seg.speaker_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full
                        ${seg.has_error_gt ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        GT: {seg.has_error_gt ? "Raw ASR Error" : "Clean Dialect"}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full
                        ${seg.loop_pred_err ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        DialectLoop: {seg.loop_pred_err ? "Flagged" : "Validated"}
                      </span>
                    </div>
                  </div>

                  {/* Transcript */}
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                      Extracted Dialect Transcript
                    </span>
                    <p className="text-sm font-semibold text-slate-900 leading-relaxed font-sans">
                      "{seg.transcript}"
                    </p>
                  </div>

                  {/* Dialect Tokens & Audio Playback Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-500 font-bold">Tokens:</span>
                      {seg.phonetic_dialect_tokens.map((tok, i) => (
                        <span key={i} className="text-[10px] font-mono bg-white border border-slate-200 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                          {tok}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onOpenSearchGrounding && (
                        <button
                          type="button"
                          onClick={() => onOpenSearchGrounding(seg.transcript, seg.district)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                          title="Verify with Google Search Grounding (gemini-3.5-flash)"
                        >
                          <Search className="w-3 h-3 text-blue-600" />
                          Verify Grounding
                        </button>
                      )}

                      {seg.audio_blob_b64 && (
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(seg.segment_id, seg.audio_blob_b64)}
                          className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                        >
                          {playingSegmentId === seg.segment_id ? (
                            <>
                              <Pause className="w-3 h-3 text-rose-400" /> Stop
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 text-emerald-400" /> Play Audio
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grounded Citation */}
                  {seg.search_grounded_citation && (
                    <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/50 flex items-center gap-1">
                      <span className="text-slate-400 font-bold">Citation:</span> {seg.search_grounded_citation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
