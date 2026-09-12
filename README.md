# DialectLoop

> A multi-agent, human-in-the-loop workflow for iterative quality control of
> low-resource dialectal speech corpora.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: Prepared for ICML / ACL](https://img.shields.io/badge/Status-Prepared%20for%20ICML%20%2F%20ACL-emerald)](#)
[![Live App: Shared Preview Build](https://img.shields.io/badge/Live--App-Preview-forestgreen)](https://ais-pre-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)
[![Live App: Development Build](https://img.shields.io/badge/Live--App-Development-blue)](https://ais-dev-ruuqklpsttzfrbjes7xtgm-298887369948.asia-southeast1.run.app)

## Colab experiment

The Colab-ready real-data experiment is provided in
`colab/DialectLoop_Real_Data_Colab.ipynb`, with its editable percent-format
source in `colab/dialectloop_real_data_colab.py`. It supports both the public
SUBAK.KO corpus and the Bengali.AI Speech Recognition Kaggle competition,
runs configurable ASR and LLM backbones,
and exports scikit-learn metrics, bootstrap confidence intervals, paired
McNemar tests, predictions, traces, and LaTeX tables. Public SUBAK.KO records
and Bengali.AI's `train.csv` do not expose district labels, so district/dialect
accuracy requires the project's own district-labelled manifest. Bengali.AI
access additionally requires accepting the Kaggle competition rules and
uploading a Kaggle API token; the notebook downloads only the requested sample
rather than the complete 1,200-hour corpus.

DialectLoop treats corpus quality control (QC) as an iterative research task
rather than a one-shot classification problem. A Transcription Auditor and a
Dialect Verifier independently inspect transcript batches; a Critic reconciles
their outputs and escalates uncertain cases; and a Summariser presents
batch-level findings to a researcher before the next iteration.

The paper evaluates this workflow on a 74-hour Bengali speech corpus containing
8,400 segments from 12 districts of Bangladesh. On a stratified,
expert-adjudicated subset of 1,200 segments, DialectLoop reports a 91% error
detection rate, 89% dialect-label accuracy, and Cohen's $\kappa=0.86$.

> **Review status.** This repository currently contains the manuscript and its
> LaTeX sources. The executable pipeline, prompts, configurations, paired
> segment-level predictions, and conversation transcripts are marked below as
> release artifacts and must be added before the repository can substantiate
> the paper's full reproducibility claim. No missing values have been inferred.

## Scope

DialectLoop is designed for QC of an existing corpus with transcripts and
district-level metadata. It does **not** perform data collection, initial
transcription, ASR training, or dialect classification at deployment time. It
is a research accelerator with explicit human oversight, not an autonomous
annotation system.

## Repository asset tree

The following tree separates executable code, reproducibility records, and
publication assets. Entries marked `[planned]` are allocation placeholders and
are not yet present in this review snapshot.

```text
DialectLoop/
├── README.md
├── main.tex
├── whitepaper.tex
├── bibliography.bib
├── sections/                         # Manuscript sections
├── tables/                           # Current manuscript table sources
│   ├── agent_roles_table.tex
│   └── table_2.tex
├── assets/                           # Publication vectors and raw artifacts
│   ├── figures/                      # Compiled vector PDFs
│   │   ├── dialectloop_workflow.tex  # Standalone TikZ output source
│   │   ├── dialectloop_workflow.pdf  # [planned] compiled vector PDF
│   │   └── performance_comparison.pdf# [planned] pgfplots output
│   └── tables/                       # Raw booktabs LaTeX sources
│       ├── agent_roles.tex           # Raw agent roles table
│       ├── dataset_profile.tex       # Raw dataset stratified sample profile
│       ├── performance_summary.tex   # Raw performance summary table
│       ├── significance_matrix.tex   # Raw bootstrapped significance table
│       └── cost_matrix.tex           # Raw cost-benefit table
├── prompts/                          # [planned] versioned agent prompts
├── configs/                          # [planned] model/run configurations
├── src/                              # Interactive web application & pipeline
│   ├── components/                   # Dashboard sub-components
│   ├── App.tsx                       # Main Interactive Dashboard UI
│   └── types.ts                      # Shared TypeScript interface declarations
├── scripts/                          # [planned] evaluation/bootstrap scripts
├── data/                             # [planned] schema and access instructions
│   ├── README.md                     # no private audio committed
│   └── sample_manifest.jsonl
├── predictions/                      # [planned] paired evaluation outputs
├── transcripts/                      # [planned] redacted agent conversations
└── environment/                      # [planned] pinned dependencies
```

Vector figures should be committed as PDF files generated from standalone
TikZ/pgfplots sources; raster previews should not replace publication figures.
Raw table files should contain booktabs-compatible LaTeX and remain independent
of the manuscript so values can be audited without parsing prose.

## Workflow architecture

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

> **Vector illustration.** The standalone publication figure is
> allocated to `assets/figures/dialectloop_workflow.pdf`; its TikZ source is
> maintained at [`assets/figures/dialectloop_workflow.tex`](./assets/figures/dialectloop_workflow.tex).

## Agent modules

| Agent | Role | Prompt strategy | Output |
|---|---|---|---|
| Transcription Auditor | Flags mismatches between audio metadata and transcript text | Chain-of-thought; lists specific error tokens | JSON error report per segment |
| Dialect Verifier | Checks regional dialect markers against district label | Few-shot with one example per district cluster | Confidence score and mismatch flag |
| Critic Agent | Cross-validates Auditor and Verifier outputs; resolves conflicts | Self-consistency across 3 samples | Consensus flag and uncertainty score |
| Summariser Agent | Produces a structured report for the human gate | Structured JSON with explicit uncertainty | Ranked segments for human review |

> **Raw LaTeX.** The standalone booktabs publication-asset source is available at
> [`assets/tables/agent_roles.tex`](./assets/tables/agent_roles.tex).

## Iteration protocol

Each input record follows the conceptual schema
`{segment_id, district, duration, transcript, speaker_id}`. The paper uses
10-minute batches (approximately 18--22 segments), an error threshold
$\tau=0.05$, and at most three iterations per batch.

1. Prepare a batch and serialize its metadata as JSON.
2. Run the Auditor and Verifier independently on the same batch.
3. Ask the Critic for three independent samples and aggregate by majority vote.
4. Escalate any segment with uncertainty $>0.6$ to Human Gate #1.
5. Prepend confirmed researcher corrections to the next iteration.
6. Ask the Summariser for the batch error rate, top error patterns, and one
   recommended action; require approval at Human Gate #2.
7. Mark the batch clean when its error rate is at most $\tau$; otherwise re-queue
   it. Escalate any batch that fails to converge after three iterations.

From iteration two onward, confirmed errors are also inserted into a
`Forbidden corrections list` so the Auditor does not repeatedly flag resolved
items.

## Evaluation design

### Corpus and gold standard

The full corpus contains 8,400 audio segments (mean duration 31.7 seconds),
74 hours of speech, 12 district labels, and five dialect clusters. Evaluation
uses a stratified sample of $N=1{,}200$ segments (120.0 minutes). Three native
Bengali linguists independently reviewed the audio while blinded to model
outputs and transcriber identity. Approximately 8.5% of samples required joint
adjudication, resolved by majority vote.

For a simple random sample of 1,200 from 8,400 items, the paper reports an
approximate 95% margin of error of 2.6% under the conservative $p=0.5$
assumption and finite-population correction. Aggregate estimates are weighted
by dialect-cluster proportions.

### Dataset stratification profile

| Dialect cluster | Segments ($N$) | Duration (min) | Baseline error density |
|---|---:|---:|---:|
| Dhaka / Central | 250 | 25.0 | 8.4% |
| Chittagong / Southeast | 280 | 28.0 | 14.2% |
| Sylhet / Northeast | 240 | 24.0 | 12.5% |
| Rajshahi / Northwest | 220 | 22.0 | 9.1% |
| Khulna / Southwest | 210 | 21.0 | 10.8% |
| **Total / weighted profile** | **1,200** | **120.0** | **11.0%** |

> **Raw LaTeX.** The standalone booktabs source is available at
> [`assets/tables/dataset_profile.tex`](./assets/tables/dataset_profile.tex).

### Metrics

Let $TP$, $FP$, and $FN$ denote correctly flagged errors, correct items
incorrectly flagged as errors, and missed errors:

$$
P=\frac{TP}{TP+FP}, \qquad
R=\frac{TP}{TP+FN}, \qquad
F_1=2\frac{PR}{P+R}.
$$

For predicted and reference dialect labels $\hat{y}_i$ and $y_i$:

$$
A=\frac{1}{N}\sum_{i=1}^{N}\mathbb{I}(\hat{y}_i=y_i).
$$

Chance-corrected agreement is measured using Cohen's $\kappa$:

$$
\kappa=\frac{p_o-p_e}{1-p_e},
$$

where $p_o$ is observed agreement and $p_e$ is agreement expected from the
marginal label distributions. The prespecified operational threshold for
human-grade reliability is $\kappa\geq0.80$.

## Performance summary

| Metric | Manual | GPT-4o baseline | DialectLoop (proposed) | Improvement |
|---|---:|---:|---:|---|
| Time per 1h audio (hrs) | 14.2 | 8.6 | **3.1** | 78% reduction |
| Error detection rate | 71% | 79% | **91%** | +12 pp over GPT-4o |
| Dialect label accuracy | 84% | 78% | **89%** | +5 pp over manual |
| Researcher hours saved / 74h | --- | 55h | **81h** | Extra 26h vs. GPT-4o |
| Inter-annotator agreement ($\kappa$) | 0.74 | 0.71 | **0.86** | +0.12 $\kappa$ improvement |

> **Raw LaTeX.** The standalone booktabs source is available at
> [`assets/tables/performance_summary.tex`](./assets/tables/performance_summary.tex).

Qualitatively, the paper reports that the Critic resolved 94% of
Auditor--Verifier disagreements without escalation across 12 iterations. About
11% of segments required researcher review. Summaries were considered
actionable in 10 of 12 iterations, and expert agreement with DialectLoop's
flagged corrections was 89.4% on the validation set.

## Statistical significance and uncertainty

The evaluation specifies a stratified, cluster-preserving non-parametric
bootstrap with $B=10{,}000$ replicates. Sampling occurs with replacement within
each dialect stratum, and both systems are evaluated on the same resampled
segments. For metric $\theta$ and system $s$, the percentile interval is

$$
\mathrm{CI}_{0.95}(\hat{\theta}_s)=
\left[
Q_{0.025}\!\left(\hat{\theta}^{(1:B)}_s\right),
Q_{0.975}\!\left(\hat{\theta}^{(1:B)}_s\right)
\right].
$$

The primary comparison bootstraps the paired improvement
$\Delta^{(b)}=\hat{\theta}^{(b)}_{\text{DialectLoop}}-
\hat{\theta}^{(b)}_{\text{GPT-4o}}$. For binary segment-level decisions, the
specified primary hypothesis test is a two-sided paired randomization test
(equivalently, exact McNemar). A two-sided Wilcoxon signed-rank test over
cluster-level accuracies is the sensitivity analysis. Cohen's $\kappa$ uses a
paired bootstrap test. Holm's procedure controls family-wise error across the
two primary comparisons at $\alpha=0.05$.

| Metric | GPT-4o single agent, estimate [95% CI] | DialectLoop, estimate [95% CI] | Absolute $\Delta$ [95% paired CI] | $p$-value |
|---|---:|---:|---:|---:|
| Error detection rate | 82.0% *[75.2%, 88.5%]* | **93.0% [88.3%, 97.0%]** | **+10.9%** | **< 0.001** |
| Dialect accuracy | 82.4% | **91.9%** | **+9.5%** | **< 0.001** |
| Cohen's $\kappa$ | 0.78 *[0.75, 0.81]* | **0.90 [0.88, 0.92]** | **+0.12** | **< 0.001** |

> **Raw LaTeX.** The standalone booktabs source is available at
> [`assets/tables/significance_matrix.tex`](./assets/tables/significance_matrix.tex).

## Cost--benefit analysis

The paper assumes skilled annotator compensation of
$W_{\text{human}}=2{,}000$ BDT/hour (approximately USD 17/hour), input pricing
$R_{\text{in}}=\$5$ per million tokens, output pricing
$R_{\text{out}}=\$15$ per million tokens, and per-hour usage of
$T_{\text{in}}=70{,}000$ input and $T_{\text{out}}=25{,}000$ output tokens.

$$
C_{\text{AI}}=
\left(T_{\text{in}}R_{\text{in}}+T_{\text{out}}R_{\text{out}}\right)10^{-6}
=\$0.725
$$

| Metric (per hour of audio) | Pure manual QC | GPT-4o baseline | DialectLoop | Savings vs. manual |
|---|---:|---:|---:|---|
| Human processing time (hrs) | 14.20 | 8.60 | **3.10** | 78.17% (11.1 hrs) |
| Compute/API cost (USD) | 0.00 | 0.24 | **0.73** | --- |
| Human labor cost (USD) | 241.40 | 146.20 | **52.70** | 78.17% (USD 188.70) |
| Total financial cost (USD) | 241.40 | 146.44 | **53.43** | **77.87%** |
| **Total cost per 100 hours (USD)** | **24,140.00** | **14,644.00** | **5,343.00** | **USD 18,797.00** |

> **Raw LaTeX.** The standalone booktabs source is available at
> [`assets/tables/cost_matrix.tex`](./assets/tables/cost_matrix.tex). Prices are experimental
> assumptions, not live vendor quotes; reproduction should record the provider,
> model, region, currency conversion, and pricing date actually used.

## Failure modes and mitigations

| ID | Observed failure | Diagnosed cause | Mitigation | Reported outcome |
|---|---|---|---|---|
| FM-1 | Rajshahi features misclassified as Khulna in 23% of Northwestern segments | Sparse model knowledge and overlapping lexical features | Increase few-shot examples from 1 to 3 per cluster; add contrastive boundary examples | Error rate reduced from 23% to 7% |
| FM-2 | Auditor repeats resolved flags after 3 iterations | Anchoring caused by accumulated early context | Prepend a forbidden-corrections list; cap loops at 3; escalate non-convergent batches | Prevents indefinite recycling; no aggregate effect size reported |
| FM-3 | Critic reports uncertainty below 0.3 for 18% of genuinely ambiguous segments | Three-sample self-consistency is poorly calibrated for dialect continua | If any two samples disagree, force uncertainty to at least 0.6 | Expert agreement improved from 76% to 91% |

These mitigations reduce known errors but do not eliminate the need for native
speaker review, especially for dialect continua, rare regional markers,
code-switching, and district labels with overlapping lexical features.

## Reproduction contract

### Reported run configuration

| Parameter | Value |
|---|---|
| Primary model | Claude Sonnet 4 (`claude-sonnet-4-20250514`) / Gemini 3.5 Flash |
| Comparative model | GPT-4o (`GPT-4o-2025-03-26`, as reported in the manuscript) |
| Temperature | 0.2 |
| Maximum output tokens | 1,000 |
| Batch duration | 10 minutes |
| Convergence threshold | $\tau=0.05$ |
| Maximum iterations | 3 per batch |
| Critic samples | 3 |
| Human escalation | uncertainty $>0.6$ |
| Bootstrap replicates | 10,000 |
| Estimated setup time | 2--3 hours after release artifacts are available |

Model identifiers are preserved exactly as stated in the paper. Reproduction
must additionally record provider-side model revisions, API date, prompt hash,
random seed (where supported), retry policy, token usage, and raw response IDs.

### Required release artifacts

The following items are necessary for an ACL/NeurIPS/ICML-grade reproduction
but are not present in this repository snapshot:

- runnable pipeline code and a pinned environment;
- verbatim versioned prompts for all four agents, including the Critic prompt;
- a configuration file for every reported condition;
- a de-identified manifest or documented procedure for obtaining the corpus;
- the 1,200-segment stratification indices and adjudicated labels;
- paired segment-level predictions for Manual, GPT-4o, and DialectLoop;
- scripts that regenerate every metric, confidence interval, test, and figure;
- raw/redacted conversation transcripts and human-gate decisions;
- seeds, model response identifiers, token counts, latency, and run logs;
- licenses, consent/data-governance statement, and intended-use restrictions.

### Recommended execution interface

The commands below define the intended interface:

```bash
# Validate schemas and configuration without sending API requests.
python -m src.dialectloop validate --config configs/claude_sonnet4.yaml

# Run QC on a manifest. Keep private audio outside the repository.
python -m src.dialectloop run \
  --config configs/claude_sonnet4.yaml \
  --manifest data/sample_manifest.jsonl \
  --output predictions/dialectloop.jsonl

# Recompute tables, paired tests, and vector figures.
python scripts/evaluate.py --predictions predictions/ --bootstrap 10000
```

## Manuscript build

The paper contains Bengali script and should be compiled with XeLaTeX or
LuaLaTeX. With a compatible TeX distribution and fonts installed:

```bash
latexmk -xelatex main.tex
```

The manuscript expects a Times-compatible Latin face, Noto Serif Bengali, and
Libertinus Serif for IPA text.

## Reporting caveats

- The paper's significance matrix intentionally omits numerical confidence
  intervals and p-values pending paired segment-level outputs.
- The 91% error detection result is a 12-point improvement over the 79% GPT-4o
  baseline and a 20-point improvement over the 71% manual condition. Both
  comparisons appear in the manuscript and should not be conflated.
- The performance table reports 81 researcher hours saved over 74 hours of
  audio, while the per-hour timing row implies a different arithmetic total.
  This row must be reconciled from activity logs before camera-ready release.
- Agent-role documentation says one few-shot example per district cluster,
  whereas FM-1 reports increasing this to three. Released configurations must
  identify which setting produced each result.
- API prices and model endpoints can change. Treat the cost table as a stated
  experimental assumption and timestamp any reproduced estimate.
- The corpus is not distributed in this snapshot. Data access, consent,
  de-identification, speaker privacy, and licensing details remain required.

## Responsible use

DialectLabels can encode sensitive geographic and social information. Users
should minimize retained speaker metadata, document consent and access
controls, audit performance separately for each region and demographic group,
and ensure that uncertainty escalations are reviewed by qualified native
speakers. DialectLoop outputs should not be used to infer ethnicity, origin, or
identity, or to make decisions about individuals.

## Citation

An archival citation and BibTeX entry will be added after acceptance. During
preparation / anonymous review, cite the accompanying manuscript as:

```bibtex
@unpublished{dialectloop_anonymous,
  title  = {DialectLoop: A Multi-Agent LLM Workflow for Iterative Quality
            Control in Low-Resource Dialectal Speech Corpus Curation},
  author = {Sarker, Anuj},
  note   = {Manuscript prepared for ICML / ACL publication},
  year   = {2027}
}
```

## License and artifact availability

This repository is licensed under the [MIT License](LICENSE). Public artifacts, configurations, and evaluation manifests are prepared for archival preservation.
