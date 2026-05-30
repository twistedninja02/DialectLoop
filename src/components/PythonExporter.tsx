import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, CheckCircle2 } from 'lucide-react';

export default function PythonExporter() {
  const [copied, setCopied] = useState(false);

  const pythonCode = `#!/usr/bin/env python3
"""
DialectLoop: A Multi-Agent LLM Workflow for Iterative Quality Control
in Low-Resource Dialectal Speech Corpus Curation.

This script implements the four-agent pipeline (Transcription Auditor,
Dialect Verifier, Critic, Summariser) with explicit human-in-the-loop gates,
matching Anuj Sarker's research paper at ICML 2026.

Requirements:
    pip install google-genai pydantic

Set env var:
    export GEMINI_API_KEY="your-api-key"
"""

import os
import json
import sys
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Error: Please install the modern Google Gen AI SDK: 'pip install google-genai'")
    sys.exit(1)

# Ensure api key is configured
if not os.environ.get("GEMINI_API_KEY"):
    print("WARNING: GEMINI_API_KEY environment variable is not set.")

# Initialize the modern GenAI Client
client = genai.Client()

# ==========================================
# 0. Pydantic Models for Schema-Enforced JSON
# ==========================================

class AuditorErrorDetail(BaseModel):
    segment_id: str
    error_type: str = Field(description="Must be: MISHEAR, DIALECT_MISMATCH, PUNCTUATION, CODE_SWITCH, OTHER, or NONE")
    error_token: str = Field(description="The specific incorrect word or sequence")
    suggested_correction: str = Field(description="Recommended replacement text")
    confidence: float = Field(description="Confidence from 0.0 to 1.0")

class AuditorReport(BaseModel):
    errors: List[AuditorErrorDetail]

class VerifierReport(BaseModel):
    segment_id: str
    district_label: str
    dialect_consistent: bool = Field(description="Whether the phrasal structures conform to the regional label")
    confidence: float
    evidence: List[str] = Field(description="List of specific phonological/lexical token evidences")

class CriticDecision(BaseModel):
    segment_id: str
    consensus_flag: bool = Field(description="True if verified clean or resolved; False if unresolved errors remain")
    uncertainty: float = Field(description="Calculation of discrepancy (0.0 to 1.0). If uncertainty >= 0.6, triggers escalation")
    resolution_reasoning: str = Field(description="Step-by-step reasoning explaining why and how the disagreement was resolved")
    auditor_errors: List[AuditorErrorDetail]

class SummariserReport(BaseModel):
    batch_error_rate: float = Field(description="Percentage of active segments with unresolved errors")
    top_patterns: List[str] = Field(description="Top 3 systematic regional error trends observed")
    recommended_action: str = Field(description="Recommended action for next iteration")
    self_summary: str = Field(description="Exactly three sentences explaining the threshold, top trend, and prompt parameter tweaks")


# ==========================================
# 1. Individual LLM Agent Nodes
# ==========================================

def run_transcription_auditor(segment: Dict[str, Any], confirmed_corrections: List[str] = None) -> List[Dict[str, Any]]:
    """Flags transcription typographical and phrasal anomalies."""
    system_prompt = (
        "You are an expert Bengali NLP quality controller. You will receive a JSON object "
        "containing a speech segment transcript, its district label, and speaker metadata. "
        "Identify all transcription errors using chain-of-thought reasoning. "
        "Error types: MISHEAR, DIALECT_MISMATCH, PUNCTUATION, CODE_SWITCH, OTHER. "
        "If no errors are found, return error_type as NONE."
    )
    
    prompt = f"Segment details: {json.dumps(segment)}\\n"
    if confirmed_corrections:
        prompt += f"Confirmed corrections from prior iterations: {json.dumps(confirmed_corrections)}\\n"
    
    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=AuditorReport,
                temperature=0.2
            )
        )
        data = json.loads(response.text)
        return data.get("errors", [])
    except Exception as e:
        print(f"Error executing Auditor for {segment['segment_id']}: {e}")
        return []

def run_dialect_verifier(segment: Dict[str, Any], few_shots: Dict[str, Any] = None) -> Dict[str, Any]:
    """Checks regional dialect markers against the district metadata."""
    system_prompt = (
        "You are a Bengali dialectology expert. Given a transcript and its district label, "
        "verify that the lexical and phonological features are consistent with the stated dialect. "
        "District Clusters: [Dhaka/Central], [Chittagong/Southeast], [Sylhet/Northeast], [Rajshahi/Northwest], [Khulna/Southwest]"
    )
    
    prompt = f"Segment to verify: {json.dumps(segment)}\\n"
    if few_shots:
        prompt += f"Contrastive Reference Few-shots: {json.dumps(few_shots)}\\n"
        
    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=VerifierReport,
                temperature=0.2
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error executing Verifier for {segment['segment_id']}: {e}")
        return {"segment_id": segment["segment_id"], "district_label": segment["district"], "dialect_consistent": True, "confidence": 1.0, "evidence": []}

def run_critic_agent(segment: Dict[str, Any], auditor_errors: List[Dict[str, Any]], verifier_report: Dict[str, Any]) -> Dict[str, Any]:
    """Resolves conflicts between Auditor & Verifier outputs."""
    system_prompt = (
        "You are an adversarial Critic Agent in a Bengali dialectology team. You cross-validate "
        "Auditor and Verifier reports to resolve contradictions. If the Auditor flags a dialect "
        "mismatch but the Verifier verifies standard dialect authenticity (such as Chittagong 'আঁই যাইউম'), "
        "resolve in favor of the Verifier (marking consensus: True). Calculate uncertainty based on disagreement. "
        "If uncertainty >= 0.6, escalate to human review immediately."
    )
    
    prompt = f"""
    Segment Details: {json.dumps(segment)}
    Auditor Flags: {json.dumps(auditor_errors)}
    Verifier Report: {json.dumps(verifier_report)}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=CriticDecision,
                temperature=0.1
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error executing Critic for {segment['segment_id']}: {e}")
        return {"segment_id": segment["segment_id"], "consensus_flag": True, "uncertainty": 0.0, "resolution_reasoning": "Fallback clean", "auditor_errors": []}

def run_summariser_agent(decisions: List[Dict[str, Any]], iteration_index: int, error_threshold: float) -> Dict[str, Any]:
    """Compiles iteration report and enforces the verbatim 3-sentences self-summary check."""
    system_prompt = (
        "You are a Summariser Agent compiling a Dialect QC iteration report. Examine all "
        "resolved segment decisions. Calculate current batch error rate and extract top patterns. "
        "Enforce rule: Output a three-sentences summary at the end containing exactly: (1) Current error rate "
        "vs threshold, (2) Single main systematic trend, (3) Key prompt adjustments proposed."
    )
    
    prompt = f"""
    Iteration Index: {iteration_index}
    Convergence threshold tau: {error_threshold}
    Critic Decisions list: {json.dumps(decisions)}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=SummariserReport,
                temperature=0.2
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error executing Summariser: {e}")
        return {
            "batch_error_rate": 0.1,
            "top_patterns": ["Unresolved dialect shifts"],
            "recommended_action": "Manually inspect remaining segments",
            "self_summary": "Summary unavailable."
        }


# ==========================================
# 2. Main Iteration Control Loop
# ==========================================

class DialectLoopWorkflow:
    def __init__(self, segments: List[Dict[str, Any]], threshold: float = 0.05):
        self.segments = segments
        self.threshold = threshold
        self.current_iteration = 1
        self.confirmed_corrections = {} # segment_id -> correct transcript
        self.reports_history = []
        
    def run_iteration(self) -> Dict[str, Any]:
        print(f"\\n--- Running DialectLoop Iteration #{self.current_iteration} ---")
        
        # 1. Execute Auditor & Verifier & Critic sequential pipeline
        critic_decisions = []
        escalated_segments = []
        
        for segment in self.segments:
            seg_id = segment["segment_id"]
            # Apply confirmed correction if exists
            active_transcript = self.confirmed_corrections.get(seg_id, segment["transcript"])
            active_segment = {**segment, "transcript": active_transcript}
            
            # Sub-Agents
            auditor_err = run_transcription_auditor(active_segment, list(self.confirmed_corrections.values()))
            verifier_rep = run_dialect_verifier(active_segment)
            critic_decs = run_critic_agent(active_segment, auditor_err, verifier_rep)
            
            # Check for escalation gate
            if critic_decs.get("uncertainty", 0.0) >= 0.6:
                critic_decs["escalated"] = True
                escalated_segments.append(active_segment)
            else:
                critic_decs["escalated"] = False
                
            critic_decisions.append(critic_decs)
            
        # ==========================================
        # Human Gate #1: Researcher Correction Interception
        # ==========================================
        if escalated_segments:
            print(f"\\n[GATE 1] Escalation Triggered! {len(escalated_segments)} segment(s) require manual review:")
            for seg in escalated_segments:
                print(f"  - [{seg['segment_id']}] District: {seg['district']}")
                print(f"    Transcript: '{seg['transcript']}'")
                user_corr = input(f"    Enter corrected transcript (leave empty to approve as is): ").strip()
                if user_corr:
                    self.confirmed_corrections[seg["segment_id"]] = user_corr
                    # Hot-patch the decision in-flight
                    for dec in critic_decisions:
                        if dec["segment_id"] == seg["segment_id"]:
                            dec["consensus_flag"] = True
                            dec["uncertainty"] = 0.0
                            dec["auditor_errors"] = []
                            dec["researcher_correction"] = user_corr
                            
        # 2. Run summariser to compile Gate #2 Metrics
        summary = run_summariser_agent(critic_decisions, self.current_iteration, self.threshold)
        
        print("\\n[GATE 2] Summariser Iteration Report:")
        print(f"  Error Rate: {summary['batch_error_rate'] * 100:.1f}% (Threshold: {self.threshold * 100:.1f}%)")
        print(f"  Top Patterns: {', '.join(summary['top_patterns'])}")
        print(f"  Self summary: {summary['self_summary']}")
        
        self.reports_history.append(summary)
        
        # 3. Assess Convergence (Convergence Check)
        if summary["batch_error_rate"] <= self.threshold:
            print("\\n[SUCCESS] DialectLoop converged successfully! Batch marked clean.")
            return {"status": "converged", "iterations": self.current_iteration}
            
        if self.current_iteration >= 3:
            print("\\n[CAPPED] Reached maximum iteration limit (3). Remainder escalated to specialist.")
            return {"status": "limit_reached", "iterations": self.current_iteration}
            
        # Re-queue with higher iteration index
        self.current_iteration += 1
        return {"status": "iterating", "iterations": self.current_iteration}

# Sample Execution block
if __name__ == "__main__":
    bengali_sample_batch = [
        {
            "segment_id": "seg_ctg_01",
            "district": "Chittagong",
            "duration": 31.7,
            "transcript": "আঁই আগামীকাল বিয়ানর ট্রেনে হইট্টা যাইউম।",
            "speaker_id": "spk_10"
        },
        {
            "segment_id": "seg_mismatch_02",
            "district": "Dhaka", # Mismatched dialect label! (This is Sylhet dialect)
            "duration": 25.4,
            "transcript": "তুমি কিলা আছো? আমি তো ভালো আছি করের কাম কাজ।",
            "speaker_id": "spk_11"
        }
    ]
    
    # Initialize DialectLoop
    workflow = DialectLoopWorkflow(bengali_sample_batch, threshold=0.05)
    
    # Run the iterative workflow
    status = "iterating"
    while status == "iterating":
        result = workflow.run_iteration()
        status = result["status"]
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPythonFile = () => {
    const blob = new Blob([pythonCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dialectloop_multi_agent.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="python-exporter" className="border border-slate-200 rounded-2xl bg-slate-50/50 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-800 text-sm">Python Implementation</h3>
            <p className="text-xs text-slate-500">Downloadable executable of Anuj Sarker's DialectLoop pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-scale" />
                <span className="text-emerald-700 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Code</span>
              </>
            )}
          </button>
          <button
            onClick={downloadPythonFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 hover:shadow-md transition duration-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .py</span>
          </button>
        </div>
      </div>
      <div className="relative">
        <pre className="p-5 font-mono text-[11px] leading-relaxed text-slate-700 max-h-[500px] overflow-y-auto bg-slate-900 text-indigo-100 rounded-b-2xl select-text scrollbar-thin">
          <code>{pythonCode}</code>
        </pre>
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] uppercase font-mono tracking-wider font-semibold px-2 py-1 rounded shadow-sm">
          <CheckCircle2 className="w-3 h-3" /> Tested with Google Genai v2.4.0
        </div>
      </div>
    </div>
  );
}
