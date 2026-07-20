<!-- language switcher -->
**English** | [한국어](README.ko.md)

# Dandi: AI Accounting Automation System

> Voice-first system for capturing and structuring cash transactions in
> offline-first environments, **built, deployed, and field-tested with ≈200
> users** in Busan's traditional markets.
>
> A working example of capturing non-card cash transactions: a structural
> blind spot in financial and tax systems across cash-heavy economies.

[![Status](https://img.shields.io/badge/status-working%20prototype%20·%20field--tested-green)](#)
[![Stack](https://img.shields.io/badge/stack-Next.js%20·%20Whisper%20·%20Claude-blue)](#)
[![Solo](https://img.shields.io/badge/built-solo-lightgrey)](#)

---

## TL;DR

- **5-screen working web app** (Next.js): voice (Whisper → Claude tool-use),
  image OCR (Claude Vision + Naver Clova), transaction caching, deployed on Vercel.
- Captures **non-card cash transactions**: the structural blind spot in
  card-network and tax-authority data, present in every cash-heavy economy.
- **Field-tested, not estimated:** ≈200 visitors used it at a public exhibition
  (May 2026). Total API cost **₩1,500 (≈$1.17)** across the run (about **₩7.5
  per session**), with ≈80% positive feedback.
- **Cost-aware architecture:** a transaction cache exploits repeat-transaction
  patterns to skip the LLM on repeat entries; hit/miss events are instrumented.
- **Human-confirmation gate:** every AI classification enters the ledger as
  *unconfirmed*. Misclassifications never silently reach the books.
- **Scoped to "ledger preparation," not tax filing**: deliberately stays clear
  of the Korean Tax Agent Act.

---

## Screens

<table>
  <tr>
    <td width="33%"><img src="docs/dandi-screen-voice.jpg" alt="Voice input" /></td>
    <td width="33%"><img src="docs/dandi-screen-report.jpg" alt="Monthly report" /></td>
    <td width="33%"><img src="docs/dandi-screen-ledger.jpg" alt="NTS-format ledger" /></td>
  </tr>
  <tr>
    <td align="center"><b>Voice input</b><br/>speak a transaction → AI fills date / category / amount</td>
    <td align="center"><b>Monthly report</b><br/>income / expense, category breakdown, weekday chart</td>
    <td align="center"><b>NTS-format ledger</b><br/>VAT split + explicit non-direct-upload disclosure</td>
  </tr>
</table>

<sub>Shown with seed demo data.</sub>

---

## System Constraint

> **Designed under the constraint that vendors will not consistently input data
> unless the recording process is faster than doing nothing.**

This is the binding constraint. Every architectural choice (voice-first input,
±20% cache matching, inline correction without a modal, on-device storage)
exists because failing to clear this bar means zero adoption, regardless of
feature quality.

---

## The Problem

Small vendors in Busan's traditional markets manage finances manually:
handwritten ledgers, paper receipts, and no structured data.

The deeper issue: **government statistics on small-business revenue are
structurally incomplete.** Card-network data and tax-authority records only
capture *reported* transactions. Cash sales (a substantial share of
small-vendor revenue) are invisible to both. The Korean government publicly
acknowledged this gap in August 2024 and announced plans for a separate
revenue-statistics system.

This pattern is not Korea-specific. **Any economy with significant cash
circulation has the same blind spot**: Southeast Asia, Latin America, parts of
Africa, and segments of the developed world.

For vendors, the gap creates three compounding issues:

- **No financial record**: vendors can't access credit or subsidies without
  verifiable transaction history.
- **Tax liability risk**: informal bookkeeping leads to errors and the 20%
  non-bookkeeping penalty under Korean tax law.
- **Zero anomaly visibility**: unusual expense spikes go unnoticed until too late.

Dandi converts unstructured inputs (voice, photos, handwritten ledgers) into
structured financial records on the user's device, with no central server
holding the originals.

---

## Why This Is an AI Financial Systems Problem

**1. Unstructured-to-structured financial data pipelines.** Converting voice and
image inputs into reliable accounting records needs the same robustness as
document intelligence in banking, insurance, and audit systems.

**2. Anomaly detection for financial health.** The expenditure alert follows the
core fraud-detection pattern: baseline → deviation → alert. Scaled to merchant
cohort data, it opens the door to detecting subsidy misuse and abnormal cash-flow
at the civic level.

**3. Cost-aware AI infrastructure.** External LLM calls scale linearly with
users, a known sustainability problem in production AI. Dandi's transaction
cache exploits the high repetition of small-business transactions (same vendor,
similar amount) to bypass the LLM on repeats; hit/miss is logged so the actual
reduction can be reported empirically rather than estimated.

---

## Core Features

### Shipped (working app, 5 screens)

| Feature | Stack | Notes |
|---|---|---|
| Voice-to-ledger | OpenAI Whisper STT → Claude Sonnet 4.6 tool-use | Two-stage; domain-prompted for Busan dialect (satoori) |
| Image OCR | Claude Vision; Naver Clova OCR fallback | Receipts, tax invoices, handwritten ledgers |
| Transaction caching | localStorage + ±20% range matching | Hit-rate logged; learns from confirmed entries only |
| VAT auto-split | Statutory 10% rule, sum-preserving invariant | 14 boundary tests in `lib/vat.test.ts` |
| Ganpyeon-jangbu CSV export | NTS 8-column schema | Explicit UI disclosure of the non-direct-upload limit |
| Tax deadline tracking | Dynamic from filing rules | VAT + comprehensive income tax |
| Vendor management + reports | CRUD + monthly/annual + PDF export | Weekday sales chart |

### Designed (operational stage)

| Feature | Approach |
|---|---|
| Donbaek-e-isgood payment integration | Payment-API ingestion (currently demo-mode in UI) |
| E2E-encrypted cloud sync | Supabase backup exists today; user-held-key E2EE designed |
| Civic-statistics privacy | k-anonymity (k≥5) + l-diversity + differential privacy |
| API cost optimization | Caching (shipped) → model routing → small in-house LLM |
| Multi-week vendor field pilot | Seeking an institutional partner (see Field Results) |

---

## Architecture

```
Input Layer
  ├── Voice       (MediaRecorder → Whisper → Claude tool-use)   [shipped]
  ├── Image       (Camera/Gallery → Claude Vision / Clova)      [shipped]
  └── Payment API (Donbaek-e-isgood ingestion)                  [demo mode]
            │
   Cache lookup ───── hit ──→ skip LLM, reuse classification
            │ (miss)
   LLM extraction & normalization
            │
   User confirmation gate ── (re-write to cache on confirm)
            │
   Local record store (localStorage)  ──→  Supabase backup (upsert, debounced)
            │
    ┌───────┴───────┐
  Reports        Anomaly alerts
  (Tax est.)     (Spend spikes)
            │
   CSV export (NTS format) → user → tax accountant
```

In the current build, ledgers live on-device first; Supabase holds an opt-in
backup. The E2E-encrypted sync and civic-statistics paths are operational-stage
design, not yet shipped.

---

## Field Results (real, measured)

The prototype was tested in the field rather than only estimated:

- **≈200 visitors** used Dandi at a public exhibition (Career Blossom, May 2026),
  each role-playing a vendor entering transactions.
- **Total API cost ₩1,500 (≈$1.17)** for the whole run (Anthropic $1.03 +
  OpenAI $0.14), i.e. **≈₩7.5 per session**.
- **≈80% positive** across 85 paper feedback forms (20 analyzed so far); top
  improvement requests: loading speed, app entry friction, a typing option.

Honest notes: this was a **booth role-play, not a multi-week vendor pilot**:
the real vendor pilot is still seeking an institutional partner. Server-side
usage logging (Supabase) was not enabled during the event, so per-request
server metrics for that run are unavailable; the cost figures above come from
the API dashboards.

---

## Failure Handling

Production-oriented choices baked into the prototype:

- **Unconfirmed gate**: every AI classification enters as `unconfirmed`; the
  user must confirm before it affects tax-relevant exports.
- **Inline correction**: every field editable in place, no modal, no round-trip
  (≈2s in self-testing).
- **Cache learns from corrections, not raw output**: only confirmed (post-edit)
  entries become cache seeds, so the cache improves rather than amplifying errors.
- **PII masking**: card / resident-registration / account numbers are masked
  before processing.
- **LLM failure fallback**: API errors fall through to manual entry with the
  original transcript preserved; no silent data loss.
- **Statutory disclaimer at export**: the NTS-format CSV screen warns it cannot
  be uploaded directly to the tax filing system, preventing misuse under the
  Korean Tax Agent Act.

---

## Engineering Trade-offs

- **Caching over fine-tuning**: fine-tuning would raise the accuracy ceiling but
  costs ≈2 orders of magnitude more upfront and needs accumulated data. Caching
  captures most of the cost reduction (repeat-heavy domain) at zero training cost.
- **Local-first storage with Supabase backup over server-side plaintext**:
  privacy-by-default; sync resolves later via user-held-key E2EE rather than
  reverting to plaintext on a server.
- **External LLM API over self-hosted**: managed APIs (Whisper, Claude) ship
  faster at prototype scale; the architecture is decoupled enough that a swap to
  self-hosted inference is a single-route change once volume justifies it.
- **Tax Agent Act compliance over feature breadth**: Dandi stops at "ledger
  preparation" and does not file. This narrows the product but keeps it in the
  unregulated zone; filing automation would require a licensed tax-agent partner.

---

## Project Context

Designed as a merchant-facing module for Busan's city-operated payment platform
(Donbaek-e-isgood), serving populations typically excluded from fintech
products: elderly merchants, dialect speakers, cash-heavy operators. As of
January 2026, ≈145,000 merchants already use Donbaek-e-isgood, so embedding Dandi
there means near-zero user-acquisition cost and no separate app install.

Operational ownership is left open to whichever entity Busan City selects to
build the production version.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Voice pipeline | OpenAI Whisper → Claude Sonnet 4.6 (tool-use for structured output) |
| Vision / OCR | Claude Vision (receipts, tax invoices) + Naver Clova OCR (handwriting fallback) |
| Storage | localStorage (offline-first) + Supabase PostgreSQL (backup) |
| Rate limiting | Upstash Redis (+ in-memory fallback) |
| Deployment | Vercel (serverless) |

---

## What I Can Do

Skills demonstrated through this build:

- **Build cost-aware LLM pipelines with measurable reduction**: caching,
  hit-rate logging, per-call cost tracking; cost decisions are data-driven.
- **Design financial data systems under regulatory constraints**: encoded
  Korean VAT statute as testable invariants, mapped Tax Agent Act boundaries to
  product scope, structured evidence types to match filing requirements.
- **Implement end-to-end voice/image → structured data pipelines**: shipped
  flows for dialect speech, handwritten ledgers, receipts, and tax invoices,
  all with consistent confirmation gating.
- **Ship and validate, not just design**: deployed to Vercel, ran a 200-user
  field test, and reported real cost/feedback numbers instead of projections.
- **Translate domain problems into engineering specs**: civic policy problem →
  product scope → architecture, with an explicit operational-stage handoff.

---

## Related Projects

The same pattern (*unstructured signals → structured records → anomaly
detection*) across financial domains:

> **[BakerStreet: Cross-Border Fraud Detection AI](https://github.com/si3ae/Cross-Border_Fraud_Detection_AI)**:
> verifiable AI for shell-company / AML investigation; anomaly detection scaled
> to cross-border fraud networks
>
> **[Financial Intelligence Terminal](https://github.com/si3ae/Financial_Intelligence_Terminal)**:
> multi-asset market signal aggregation at scale

---

## About the Author

Sinae Hong.

WorldQuant Brain consultant tier (progressed from zero prior quant experience to
consultant tier through intensive daily alpha submissions).
Recently transitioned into computer science and built Dandi end to end:
planning, development, security, and field validation, as a production-oriented
financial AI system focused on real-world data constraints.

The financial-domain rigor in Dandi (statutory VAT logic, tax-deadline calculus,
evidence-type taxonomy) draws from this background; the engineering execution was
learned in parallel with the build.

[LinkedIn](https://www.linkedin.com/in/sinae-hong-583306216/)
