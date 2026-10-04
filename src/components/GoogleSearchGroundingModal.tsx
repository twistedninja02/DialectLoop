import React, { useState, useEffect } from 'react';
import { Search, Globe, ExternalLink, Loader2, Sparkles, CheckCircle2, BookOpen } from 'lucide-react';

interface GoogleSearchGroundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  districtCluster?: string;
}

export default function GoogleSearchGroundingModal({
  isOpen,
  onClose,
  initialQuery = "আঁই যাইউম",
  districtCluster = "Chittagong"
}: GoogleSearchGroundingModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [cluster, setCluster] = useState(districtCluster);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    explanation: string;
    dialectConfirmed: boolean;
    citations: { title: string; url: string }[];
    searchQueries: string[];
    modelUsed: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    setCluster(districtCluster);
    setResult(null);
    setErrorMsg(null);
  }, [initialQuery, districtCluster, isOpen]);

  if (!isOpen) return null;

  const handleSearchGrounding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch('/api/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          districtCluster: cluster
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Search grounding request failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to retrieve grounded search references.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base leading-tight">
                Google Search Grounding & Dialect Verifier
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Powered by <strong className="text-indigo-600 font-bold">gemini-3.5-flash</strong> with <span className="underline">googleSearch tool</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <form onSubmit={handleSearchGrounding} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-1">
                  Dialect Word / Idiom Phrase
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. আঁই যাইউম, কিলা আছো, য্যাতচি"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-1 focus:ring-blue-500 font-medium outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-1">
                  District Variety
                </label>
                <select
                  value={cluster}
                  onChange={(e) => setCluster(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-medium outline-none"
                >
                  <option value="Chittagong">Chittagong / Southeast</option>
                  <option value="Sylhet">Sylhet / Northeast</option>
                  <option value="Rajshahi">Rajshahi / Northwest</option>
                  <option value="Khulna">Khulna / Southwest</option>
                  <option value="Dhaka">Dhaka / Central</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400 font-mono">
                Verifies real-world regional usage against live web search citations
              </span>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 hover:shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {loading ? "Searching Web..." : "Run Google Grounding"}
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
              {errorMsg}
            </div>
          )}

          {/* Grounding Results */}
          {result && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-display">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Grounding Synthesis ({result.modelUsed})
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold
                  ${result.dialectConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {result.dialectConfirmed ? "Authentic Regional Dialect" : "Possible Transcription Divergence"}
                </span>
              </div>

              {/* Grounded Explanation */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans">
                {result.explanation}
              </div>

              {/* Citations & Sources */}
              {result.citations && result.citations.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block mb-1">
                    Grounded Web Citations:
                  </span>
                  <div className="space-y-1.5">
                    {result.citations.map((cite, i) => (
                      <a
                        key={i}
                        href={cite.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 text-xs text-blue-700 transition"
                      >
                        <span className="font-medium truncate mr-2">{cite.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Web queries executed */}
              {result.searchQueries && result.searchQueries.length > 0 && (
                <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
                  Search Grounding Queries: {result.searchQueries.join(' • ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
