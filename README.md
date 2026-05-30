# DialectLoop 📂🔄

> **A Multi-Agent LLM Workflow for Iterative Quality Control in Low-Resource Dialectal Speech Corpus Curation**  
> *Author: Anuj Sarker (anujsarker02@gmail.com)*  
> *Affiliation: Ahsanullah University of Science and Technology, Dhaka, Bangladesh*  
> *Under Review / Accepted at AI4Research @ ICML 2026 Workshop · Track: Iterative Research Automation & Agents*

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tested: Gemini-3.5-Flash](https://img.shields.io/badge/Model-Gemini--3.5--Flash-indigo)](https://ai.google.dev/)
[![Status: Peer-Reviewed Ready](https://img.shields.io/badge/Status-Peer--Reviewed%20Ready-emerald)](#)
[![Live App: Shared Preview Build](https://img.shields.io/badge/Live--App-Preview-forestgreen)](https://ais-pre-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)
[![Live App: Development Build](https://img.shields.io/badge/Live--App-Development-blue)](https://ais-dev-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)

DialectLoop is a reproducible multi-agent LLM workflow designed to automate iterative quality control (QC) check procedures for low-resource dialectal speech corpora. By deploying four conversational agents in tandem with lightweight human-in-the-loop validation barriers, DialectLoop reduces specialist transcription audit time by **78%** and raises error detection rates from **71%** to **91%** compared to standard manual checks.

This repository releases the complete reference platform, including prompts, custom model parameters, structural multi-agent scripts, and a ready-to-run web dashboard.

### 🌐 Live Application URLs
*   **Production/Shared Preview Build:** [https://ais-pre-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app](https://ais-pre-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)
*   **Active Development Build:** [https://ais-dev-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app](https://ais-dev-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)

---

## 🎨 System Architecture Overview

DialectLoop operates as a cascading multi-agent quality assurance pipeline incorporating two explicit researcher validation gates:

```
        +-------------------------------------------------+
        | Batch Input: Transcript segments & metadata labels |
        +-----------------------+-------------------------+
                                |
                                v
               [ Transcription Auditor ] --- (Chain-of-Thought Typo Analyzer)
               [ Dialect Verifier     ] --- (Few-Shot Phonetic Classifier)
                                |
                                v
               [          Critic Agent           ]
                                |
     (Resolve Ambiguities & Discrepancies; Calculate Uncertainty Score)
                                |
                                v
        +-----------------------+-------------------------+
        |  HUMAN GATE #1: Interactive Escalations (Unc >= 0.6)  |
        +-----------------------+-------------------------+
                                |
                                v
               [        Summariser Agent         ]
                                |
         (Enforce Verbatim 3-Sentence Loop Report Outputs)
                                |
                                v
        +-----------------------+-------------------------+
        |     HUMAN GATE #2: Performance Convergence     |
        +-------------------------------------------------+
```

### The Four Dialectology Sub-Agents:
1. **Transcription Auditor:** Diagnoses literal speech segment mishears, disfluency markers, and suspected boundary typos.
2. **Dialect Verifier:** Verifies regional characteristics against five district clusters (*Dhaka/Central*, *Chittagong/Southeast*, *Sylhet/Northeast*, *Rajshahi/Northwest*, *Khulna/Southwest*).
3. **Critic Agent:** Resolves contradictions between sub-agents and flags high-discrepancy rows to trigger manual oversight.
4. **Summariser Agent:** Orchestrates progress analytics and suggests prompt context modifications to handle persistent error cycles.

---

## 🚀 Rapid Getting Started

### 1. Run the Full-Stack React + Node Ecosystem
To interact with the visual workspace, inspect local stats, and simulate the research gates on default paper datasets:

#### Prerequisites
- Node.js (v18 or newer)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

#### Commands
```bash
# Clone and install dependencies
git clone https://github.com/your-username/dialectloop.git
cd dialectloop
npm install

# Declare your secret API credentials
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY="..."

# Boot development environment
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🐍 Standalone Reproducibility Script (Python)

Included at the project root is the standalone script `dialectloop_multi_agent.py` utilizing the modern schema-enforced `google-genai` SDK.

### Prerequisites
```bash
pip install google-genai pydantic
export GEMINI_API_KEY="your-gemini-api-key"
```

### Running the Python Workflow
```bash
python dialectloop_multi_agent.py
```
This runs the full multi-agent cascade, processes native examples, prompts you for corrective console input if uncertainty exceeds 0.6 (**Human Gate #1**), and logs the structured **Gate #2** outputs verbatim.

---

## 📊 Evaluation Summary (ICML 2026 Baseline)

| Metric Evaluated | Traditional Manual QC | GPT-4o Baseline (Single Agent) | DialectLoop (Ours) | Cumulative Improvement |
| :--- | :---: | :---: | :---: | :---: |
| **QC Time per 1h Audio** | 14.2 hrs | 8.6 hrs | **3.1 hrs** | **78% reduction** |
| **Error Detection Rate** | 71.0% | 79.0% | **91.0%** | **+12 pp over baseline** |
| **Dialect Label Accuracy**| 84.0% | 78.0% | **89.0%** | **+5 pp over manual** |
| **Inter-annotator (κ)** | 0.74 | 0.71 | **0.86** | **+0.12 kappa improvement** |

---

## 🛠️ Documented Failure Modes & Mitigations

We treat systematic failure points as first-class scientific insights:

*   **FM-1: Dialect Cluster Hallucination:** Verifier frequently mixed Rajshahi and Khulna regional boundaries. *Mitigation:* Extended few-shot density from 1 to 3 items per cluster in the verifier's system prompts.
*   **FM-2: Hypothesis Anchoring:** LLMs over-weighted early iterations in continuous batches. *Mitigation:* Capped the loop strictly at 3 passes and re-queued outstanding anomalies on the companion escalation terminal.
*   **FM-3: Overconfident Consensus:** Critic calculated low uncertainty on high-ambiguity phonemes. *Mitigation:* Introduced strict calibration protocols (forcing uncertainty to `0.6` if any two of three self-consistency samples disagreed).

---

## 📜 Citation

If you use DialectLoop's prompt strategies, Python workflow templates, or benchmarking architectures in your research, please cite:

```bibtex
@inproceedings{sarker2026dialectloop,
  title={DialectLoop: A Multi-Agent LLM Workflow for Iterative Quality Control in Low-Resource Dialectal Speech Corpus Curation},
  author={Sarker, Anuj},
  booktitle={ICML Workshop on Iterative Research Automation & Agents},
  year={2026},
  url={https://github.com/your-username/dialectloop}
}
```
