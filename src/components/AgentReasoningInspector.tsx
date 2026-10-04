import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, Search, ShieldAlert, Sparkles, BookOpen, CheckCircle } from 'lucide-react';
import { CriticDecision, AuditorError, VerifierReport } from '../types';

interface AgentReasoningInspectorProps {
  segmentId: string;
  decision: CriticDecision;
}

export default function AgentReasoningInspector({
  segmentId,
  decision
}: AgentReasoningInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'auditor' | 'verifier' | 'critic'>('critic');

  const { verifier_report, auditor_errors, uncertainty, consensus_flag, critic_consensus_score, critic_step_reasoning, resolution_reasoning } = decision;

  return (
    <div className="mt-2.5 border border-indigo-100 rounded-xl overflow-hidden bg-white shadow-xs">
      {/* Toggle Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-indigo-50/30 flex items-center justify-between text-left hover:bg-indigo-50 transition cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[11px] font-semibold text-slate-800">
            Expandable Agent Reasoning (CoT Inspector)
          </span>
          <span className="text-[10px] font-mono bg-white border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
            Consensus: {critic_consensus_score ? `${Math.round(critic_consensus_score * 100)}%` : `${Math.round((1 - uncertainty) * 100)}%`}
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase
            ${uncertainty >= 0.6 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            Uncertainty: {uncertainty.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-mono font-medium">
          <span>{isExpanded ? "Collapse Reasoning" : "Inspect Step-by-Step CoT"}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded Reasoning Panel */}
      {isExpanded && (
        <div className="p-3.5 border-t border-indigo-100/70 bg-slate-50/40 space-y-3">
          {/* Sub-Agent Selector Tabs */}
          <div className="flex gap-1.5 p-1 bg-slate-200/60 rounded-lg text-xs font-mono">
            <button
              onClick={() => setActiveSubTab('critic')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition cursor-pointer flex items-center justify-center gap-1.5
                ${activeSubTab === 'critic' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              1. Critic Adversarial Consensus
            </button>
            <button
              onClick={() => setActiveSubTab('auditor')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition cursor-pointer flex items-center justify-center gap-1.5
                ${activeSubTab === 'auditor' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              2. Auditor CoT Flags
            </button>
            <button
              onClick={() => setActiveSubTab('verifier')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition cursor-pointer flex items-center justify-center gap-1.5
                ${activeSubTab === 'verifier' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Brain className="w-3.5 h-3.5 text-emerald-600" />
              3. Verifier Few-Shot Evidence
            </button>
          </div>

          {/* TAB 1: CRITIC ADVERSARIAL REASONING */}
          {activeSubTab === 'critic' && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-display">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Critic Agent Cross-Validation & Consensus Engine
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  Consensus Metric: <strong className="text-slate-800 font-mono">{critic_consensus_score ? `${Math.round(critic_consensus_score * 100)}%` : `${Math.round((1 - uncertainty) * 100)}%`}</strong>
                </span>
              </div>

              {/* Resolution Verdict */}
              <div className={`p-2.5 rounded-lg border text-xs
                ${decision.escalated ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'}`}>
                <span className="font-bold uppercase text-[10px] font-mono block mb-0.5">
                  Resolution Decision: {decision.escalated ? "Escalated to Human Gate #1" : "Auto-Resolved Clean by Consensus"}
                </span>
                <p className="leading-relaxed">
                  {resolution_reasoning || "Sub-agent consensus evaluated without escalation."}
                </p>
              </div>

              {/* Multi-step reconciliation trace */}
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                  Reconciliation Steps Trace
                </span>
                <ul className="space-y-1 text-[11px] font-mono text-slate-700">
                  {(critic_step_reasoning || [
                    "Checked Auditor proposed error flags against regional dialect lexicon.",
                    "Evaluated Verifier dialect consistency and evidence markers.",
                    `Computed self-consistency uncertainty margin (u = ${uncertainty.toFixed(2)}).`,
                    decision.escalated ? "Discrepancy exceeded 0.60 threshold. Triggered Human Gate #1." : "Resolved without researcher intervention."
                  ]).map((step, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-150">
                      <span className="text-indigo-600 font-bold">›</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: AUDITOR CHAIN-OF-THOUGHT FLAGS */}
          {activeSubTab === 'auditor' && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-display">
                  <Search className="w-4 h-4 text-indigo-600" />
                  Auditor Step-by-Step Chain-of-Thought (CoT)
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {auditor_errors.length} flag(s) logged
                </span>
              </div>

              <div className="space-y-2">
                {auditor_errors.map((err, i) => (
                  <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                        {err.error_type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Confidence: {(err.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="text-xs">
                      <span className="text-slate-500">Suspected Token:</span>{" "}
                      <strong className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-150">"{err.error_token || 'N/A'}"</strong>
                      {err.suggested_correction && (
                        <>
                          <span className="mx-2 text-slate-300">→</span>
                          <span className="text-slate-500">Suggested:</span>{" "}
                          <strong className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-150">"{err.suggested_correction}"</strong>
                        </>
                      )}
                    </div>

                    {err.cot_reasoning && (
                      <div className="p-2 bg-white rounded border border-slate-200 text-[11px] font-mono text-slate-600 leading-relaxed">
                        <span className="text-indigo-600 font-bold block mb-0.5 text-[10px]">CoT Reasoning Trace:</span>
                        {err.cot_reasoning}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VERIFIER FEW-SHOT EVIDENCE */}
          {activeSubTab === 'verifier' && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-display">
                  <Brain className="w-4 h-4 text-emerald-600" />
                  Dialect Verifier Few-Shot Grounding
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full
                  ${verifier_report.dialect_consistent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {verifier_report.dialect_consistent ? "Dialect-Consistent" : "Anomalous Label"}
                </span>
              </div>

              {/* Evidence Tokens */}
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block mb-1">
                  Identified Regional Dialect Markers
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {verifier_report.evidence && verifier_report.evidence.length > 0 ? (
                    verifier_report.evidence.map((token, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono text-[11px] font-semibold">
                        ✓ {token}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 font-mono text-[11px]">No deviant dialect markers detected (Standard form).</span>
                  )}
                </div>
              </div>

              {/* Phonology Notes */}
              {verifier_report.cot_phonology_notes && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 leading-relaxed">
                  <span className="text-emerald-700 font-bold block mb-0.5 text-[10px] uppercase">
                    Dialectology Phonological Notes:
                  </span>
                  {verifier_report.cot_phonology_notes}
                </div>
              )}

              {/* Few-Shot Contextual Examples Grounding */}
              {verifier_report.few_shot_matched && verifier_report.few_shot_matched.length > 0 && (
                <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-150 text-[10px] font-mono space-y-1">
                  <span className="text-indigo-800 font-bold flex items-center gap-1 uppercase">
                    <BookOpen className="w-3 h-3 text-indigo-600" /> Few-Shot Prompt Context for {verifier_report.district_label}:
                  </span>
                  {verifier_report.few_shot_matched.map((ex, idx) => (
                    <div key={idx} className="text-slate-700">
                      • Standard: "{ex.standard}" ↔ Dialect: <strong className="text-indigo-900">"{ex.dialect}"</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
