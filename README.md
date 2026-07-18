# DialectLoop 📂🔄

> **A Multi-Agent LLM Workflow for Iterative Quality Control in Low-Resource Dialectal Speech Corpus Curation**  
> *Author: Anuj Sarker (anujsarker02@gmail.com)*  
> *Affiliation: Ahsanullah University of Science and Technology, Dhaka, Bangladesh*  
> *Prepared for AI4Research @ ICML 2026 Workshop (Couldn't submit due deadline) · Track: Iterative Research Automation & Agents*

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tested: Gemini-3.5-Flash](https://img.shields.io/badge/Model-Gemini--3.5--Flash-indigo)](https://ai.google.dev/)
[![Status: Peer-Reviewed Ready](https://img.shields.io/badge/Status-Peer--Reviewed%20Ready-emerald)](#)
[![Live App: Shared Preview Build](https://img.shields.io/badge/Live--App-Preview-forestgreen)](https://ais-pre-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)
[![Live App: Development Build](https://img.shields.io/badge/Live--App-Development-blue)](https://ais-dev-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)

DialectLoop treats corpus quality control (QC) as an iterative research task rather than a one-shot classification problem. A Transcription Auditor and a Dialect Verifier independently inspect transcript batches; a Critic reconciles their outputs and escalates uncertain cases; and a Summariser presents batch-level findings to a researcher before the next iteration.

The paper evaluates this workflow on a 74-hour Bengali speech corpus containing 8,400 segments from 12 districts of Bangladesh. On a stratified, expert-adjudicated subset of 1,200 segments, DialectLoop reports a 91% error detection rate, 89% dialect-label accuracy, and Cohen's $\kappa=0.86$.

### 🌐 Live Application URLs
*   **Production/Shared Preview Build:** [https://ais-pre-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app](https://ais-pre-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)
*   **Active Development Build:** [https://ais-dev-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app](https://ais-dev-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)

---

## 🔍 Scope

DialectLoop is designed for QC of an existing corpus with transcripts and district-level metadata. It does **not** perform data collection, initial transcription, ASR training, or dialect classification at deployment time. It is a research accelerator with explicit human oversight, not an autonomous annotation system.

---

## 📂 Repository Directory Structure

The following tree separates executable code, reproducibility records, and publication assets. Entries marked `[planned]` are allocation placeholders and are not yet present in this review snapshot.

```text
DialectLoop/
├── README.md                         # Publication & setup documentation
├── LICENSE                            # MIT License File
├── main.tex                          # Main LaTeX paper source (XeLaTeX/LuaLaTeX)
├── assets/                           # Publication vectors and raw artifacts
│   ├── figures/                      # Compiled vector PDFs
│   │   ├── dialectloop_workflow.pdf  # [planned] Standalone TikZ output
│   │   └── performance_comparison.pdf# [planned] pgfplots output
│   └── tables/                       # Raw booktabs LaTeX source files
│       ├── cost_matrix.tex            # Raw cost-benefit table
│       ├── validation_profile.tex     # Raw dataset stratified sample profile
│       └── significance_matrix.tex    # Raw bootstrapped significance table
├── src/                              # Interactive web application & pipeline
│   ├── components/                    # Dashboard sub-components
│   ├── App.tsx                        # Main Interactive Dashboard UI
│   └── types.ts                       # Shared TypeScript interface declarations
├── server.ts                          # Express-Vite Full-Stack Development Server
├── server-agents.ts                   # Backend Multi-Agent Processors & Gemini Integrations
└── package.json                       # Node/Vite Build Configuration
```

Vector figures should be committed as PDF files generated from standalone TikZ/pgfplots sources; raster previews should not replace publication figures. Raw table files should contain booktabs-compatible LaTeX and remain independent of the manuscript so values can be audited without parsing prose.

---

## 🎨 Workflow Architecture

```text
 Corpus transcripts + district metadata + optional domain notes
                              |
                    10-minute JSON batches
                              |
                 +------------+------------+
                 |                         |
                 v                         v
       +---------------------+   +---------------------+
       | Transcription       |   | Dialect Verifier    |
       | Auditor             |   |                     |
       | token-level errors  |   | regional features   |
       +----------+----------+   +----------+----------+
                  |                         |
                  +------------+------------+
                               v
                    +----------------------+
                    | Critic Agent         |
                    | 3-sample consensus   |
                    | + uncertainty score  |
                    +----------+-----------+
                               |
                  uncertainty > 0.6?
                     +---------+---------+
                  yes|                   |no
                     v                   |
          +----------------------+       |
          | Human Gate #1        |       |
          | expert correction    |       |
          +----------+-----------+       |
                     +-----------+-------+
                                 v
                    +----------------------+
                    | Summariser Agent     |
                    | rate, patterns, next |
                    | recommended action   |
                    +----------+-----------+
                               v
                    +----------------------+
                    | Human Gate #2        |
                    | approve next action  |
                    +----------+-----------+
                               v
                    batch error rate <= tau?
                     +---------+---------+
                  yes|                   |no
                     v                   v
              next batch       prepend corrections and
                               re-queue (maximum 3 loops)
```

> **Vector illustration placeholder.** The standalone publication figure is allocated to `assets/figures/dialectloop_workflow.pdf`; its TikZ source and compiled vector PDF have been planned.

---

## 🤖 Agent Modules

| Agent | Role | Prompt strategy | Output |
| :--- | :--- | :--- | :--- |
| **Transcription Auditor** | Flags mismatches between audio metadata and transcript text | Chain-of-thought; lists specific error tokens | JSON error report per segment |
| **Dialect Verifier** | Checks regional dialect markers against district label | Few-shot with one example per district cluster | Confidence score and mismatch flag |
| **Critic Agent** | Cross-validates Auditor and Verifier outputs; resolves conflicts | Self-consistency across 3 samples | Consensus flag and uncertainty score |
| **Summariser Agent** | Produces a structured report for the human gate | Structured JSON with explicit uncertainty | Ranked segments for human review |

> **Raw LaTeX.** Standalone booktabs sources are maintained inside `/assets/tables/` for publication rendering.

---

## 🔄 Iteration Protocol

Each input record follows the conceptual schema `{segment_id, district, duration, transcript, speaker_id}`. The paper uses 10-minute batches (approximately 18–22 segments), an error threshold $\tau=0.05$, and at most three iterations per batch.

1. Prepare a batch and serialize its metadata as JSON.
2. Run the Auditor and Verifier independently on the same batch.
3. Ask the Critic for three independent samples and aggregate by majority vote.
4. Escalate any segment with uncertainty $>0.6$ to Human Gate #1.
5. Prepend confirmed researcher corrections to the next iteration.
6. Ask the Summariser for the batch error rate, top error patterns, and one recommended action; require approval at Human Gate #2.
7. Mark the batch clean when its error rate is at most $\tau$; otherwise re-queue it. Escalate any batch that fails to converge after three iterations.

From iteration two onward, confirmed errors are also inserted into a `Forbidden corrections list` so the Auditor does not repeatedly flag resolved items.

---

## 🔬 Evaluation Design & Gold Standard

The full corpus contains 8,400 audio segments (mean duration 31.7 seconds), 74 hours of speech, 12 district labels, and five dialect clusters. Evaluation uses a stratified sample of $N=1,200$ segments (120.0 minutes). Three native Bengali linguists independently reviewed the audio while blinded to model outputs and transcriber identity. Approximately 8.5% of samples required joint adjudication, resolved by majority vote.

For a simple random sample of 1,200 from 8,400 items, the paper reports an approximate 95% margin of error of 2.6% under the conservative $p=0.5$ assumption and finite-population correction. Aggregate estimates are weighted by dialect-cluster proportions.

### Dataset Stratification Profile

| Dialect cluster | Segments ($N$) | Duration (min) | Baseline error density |
| :--- | :---: | :---: | :---: |
| Dhaka / Central | 250 | 25.0 | 8.4% |
| Chittagong / Southeast | 280 | 28.0 | 14.2% |
| Sylhet / Northeast | 240 | 24.0 | 12.5% |
| Rajshahi / Northwest | 220 | 22.0 | 9.1% |
| Khulna / Southwest | 210 | 21.0 | 10.8% |
| **Total / weighted profile** | **1,200** | **120.0** | **11.0%** |

> 📄 *Raw LaTeX booktabs source code for paper drafting is available at `/assets/tables/validation_profile.tex`.*

### Evaluation Metrics

Let $TP$, $FP$, and $FN$ denote correctly flagged errors, correct items incorrectly flagged as errors, and missed errors:

$$P=\frac{TP}{TP+FP}, \qquad R=\frac{TP}{TP+FN}, \qquad F_1=2\frac{PR}{P+R}.$$

For predicted and reference dialect labels $\hat{y}_i$ and $y_i$:

$$A=\frac{1}{N}\sum_{i=1}^{N}\mathbb{I}(\hat{y}_i=y_i).$$

Chance-corrected agreement is measured using Cohen's $\kappa$:

$$\kappa=\frac{p_o-p_e}{1-p_e},$$

where $p_o$ is observed agreement and $p_e$ is agreement expected from the marginal label distributions. The prespecified operational threshold for human-grade reliability is $\kappa\geq0.80$.

---

## 📊 Performance Summary

| Metric | Manual | GPT-4o baseline | DialectLoop (proposed) | Improvement |
| :--- | :---: | :---: | :---: | :--- |
| **Time per 1h audio (hrs)** | 14.2 | 8.6 | **3.1** | 78% reduction |
| **Error detection rate** | 71% | 79% | **91%** | +12 pp over GPT-4o |
| **Dialect label accuracy** | 84% | 78% | **89%** | +5 pp over manual |
| **Researcher hours saved / 74h** | --- | 55h | **81h** | Extra 26h vs. GPT-4o |
| **Inter-annotator agreement ($\kappa$)** | 0.74 | 0.71 | **0.86** | +0.12 $\kappa$ improvement |

Qualitatively, the paper reports that the Critic resolved 94% of Auditor–Verifier disagreements without escalation across 12 iterations. About 11% of segments required researcher review. Summaries were considered actionable in 10 of 12 iterations, and expert agreement with DialectLoop's flagged corrections was 89.4% on the validation set.

---

## 📈 Statistical Significance and Uncertainty

The evaluation specifies a stratified, cluster-preserving non-parametric bootstrap with $B=5,000$ replicates. Sampling occurs with replacement within each dialect stratum, and both systems are evaluated on the same resampled segments. For metric $\theta$ and system $s$, the percentile interval is

$$\mathrm{CI}_{0.95}(\hat{\theta}_s)= \left[ Q_{0.025}\!\left(\hat{\theta}^{(1:B)}_s\right), Q_{0.975}\!\left(\hat{\theta}^{(1:B)}_s\right) \right].$$

The primary comparison bootstraps the paired improvement $\Delta^{(b)}=\hat{\theta}^{(b)}_{\text{DialectLoop}}-\hat{\theta}^{(b)}_{\text{GPT-4o}}$. Cohen's $\kappa$ uses a paired bootstrap test. Holm's procedure controls family-wise error across the primary comparisons at $\alpha=0.05$.

### Statistical Significance Matrix (B = 5,000 Bootstrap Resamples)

| Evaluation Metric | GPT-4o Baseline (95% CI) | DialectLoop (95% CI) | Improvement ($\Delta$) | p-value |
| :--- | :---: | :---: | :---: | :---: |
| **Error Detection Acc.** | 79.0% [77.2%, 80.8%] | **91.0% [89.4%, 92.6%]** | **+12.0%** | **< 0.001** |
| **Cohen's Kappa ($\kappa$)** | 0.71 [0.68, 0.74] | **0.86 [0.83, 0.89]** | **+0.15** | **< 0.001** |

> 📄 *Raw LaTeX booktabs source code for paper drafting is available at `/assets/tables/significance_matrix.tex`.*

---

## 💰 Cost–Benefit & Economic Analysis

The paper assumes skilled annotator compensation of $W_{\text{human}}=2,000$ BDT/hour (approximately USD 17/hour), input pricing $R_{\text{in}}=\$5$ per million tokens, output pricing $R_{\text{out}}=\$15$ per million tokens, and per-hour usage of $T_{\text{in}}=70,000$ input and $T_{\text{out}}=25,000$ output tokens.

$$C_{\text{AI}}= \left(T_{\text{in}}R_{\text{in}}+T_{\text{out}}R_{\text{out}}\right)10^{-6} =\$0.725$$

### Economic Cost Matrix (per 100 Hours of Audio)

| Cost Component | Pure Manual Baseline | GPT-4o Single-Agent | DialectLoop (Ours) |
| :--- | :---: | :---: | :---: |
| **Processing Time** | 1,420 hrs | 860 hrs | **310 hrs** |
| **API/Compute Cost (USD)** | $0.00 | $35.00 | **$72.50** |
| **Human Expert Labor Cost (USD)** | $24,140.00 | $14,620.00 | **$5,270.00** |
| **Total Financial Cost (USD)** | **$24,140.00** | **$14,655.00** | **$5,342.50** |
| **Net Savings vs. Manual** | Baseline | $9,485.00 (39%) | **$18,797.50 (78%)** |

> 📄 *Raw LaTeX booktabs source code for paper drafting is available at `/assets/tables/cost_matrix.tex`.*

---

## 🛠️ Documented Failure Modes and Mitigations

| ID | Observed failure | Diagnosed cause | Mitigation | Reported outcome |
|---|---|---|---|---|
| **FM-1** | Rajshahi features misclassified as Khulna in 23% of Northwestern segments | Sparse model knowledge and overlapping lexical features | Increase few-shot examples from 1 to 3 per cluster; add contrastive boundary examples | Error rate reduced from 23% to 7% |
| **FM-2** | Auditor repeats resolved flags after 3 iterations | Anchoring caused by accumulated early context | Prepend a forbidden-corrections list; cap loops at 3; escalate non-convergent batches | Prevents indefinite recycling |
| **FM-3** | Critic reports uncertainty below 0.3 for 18% of genuinely ambiguous segments | Three-sample self-consistency is poorly calibrated for dialect continua | If any two samples disagree, force uncertainty to at least 0.6 | Expert agreement improved from 76% to 91% |

These mitigations reduce known errors but do not eliminate the need for native speaker review, especially for dialect continua, rare regional markers, code-switching, and district labels with overlapping lexical features.

---

## 🚀 Rapid Local Deployment

### Prerequisites
- Node.js (v18 or newer)
- A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Commands
```bash
# Clone the repository
git clone https://github.com/your-username/dialectloop.git
cd dialectloop

# Install package dependencies
npm install

# Declare your secret API credentials
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY="..."

# Boot development environment
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 📜 Academic Citation

If you use DialectLoop's prompt strategies, statistical benchmarks, or evaluation code in your research, please cite:

```bibtex
@inproceedings{sarker2026dialectloop,
  title={DialectLoop: A Multi-Agent LLM Workflow for Iterative Quality Control in Low-Resource Dialectal Speech Corpus Curation},
  author={Sarker, Anuj},
  booktitle={ICML Workshop on Iterative Research Automation \& Agents},
  year={2026},
  url={https://github.com/twistedninja02/dialectloop}
}
```

---

## 📄 License

This repository is licensed under the [MIT License](LICENSE).
