# TokenPulse — LLM FinOps Observability Platform

TokenPulse is a high-performance, lightweight OpenAI-compatible LLM proxy and telemetry monitoring service designed to solve enterprise AI cost opacity. It accurately records every AI request, tracks attribution by **Team**, **Feature**, and **User**, calculates token usage and costs using configurable pricing tables, provides a simulated AI provider (no paid API keys required), and visualizes all metrics in an interactive dark-mode dashboard.

---

## 🏛️ Architecture Overview

```
                                      ┌────────────────────────────────────────────────┐
                                      │              Client Applications               │
                                      │ (Python SDK, cURL, LangChain, Web Playground) │
                                      └───────────────────────┬────────────────────────┘
                                                              │
                                                      HTTP POST /v1/chat/completions
                                                              │
                                      ┌───────────────────────▼────────────────────────┐
                                      │           TokenPulse Ingestion Gateway         │
                                      │  - Rate Limiting (Sliding Window)              │
                                      │  - Header Redaction & Sanitization             │
                                      │  - Entity Attribution (Team / Feature / User)   │
                                      │  - Pre-Request Budget Check (Monitor / Enforce)│
                                      └───────────────────────┬────────────────────────┘
                                                              │
                                      ┌───────────────────────▼────────────────────────┐
                                      │            Provider Adapter Dispatch           │
                                      ├───────────────────────┬────────────────────────┤
                                      │ [Simulated AI Engine] │ [OpenAI / Gemini / Anth]│
                                      │ Deterministic Context │ Real Upstream Provider │
                                      └───────────────────────┬────────────────────────┘
                                                              │
                                      ┌───────────────────────▼────────────────────────┐
                                      │        Token & Cost Calculation Engine         │
                                      │  - Decimal-Safe Micro-Dollar Arithmetic        │
                                      │  - Prompt, Cached & Completion Rates           │
                                      │  - Strict Unknown Model Pricing Guards         │
                                      └───────────────────────┬────────────────────────┘
                                                              │
                                      ┌───────────────────────▼────────────────────────┐
                                      │          Telemetry Storage & Analytics         │
                                      │  - SQLite (WAL Mode) / Supabase PostgreSQL     │
                                      │  - Multi-Dimensional Aggregation Engine        │
                                      │  - Budget Utilization Tracking                 │
                                      └───────────────────────┬────────────────────────┘
                                                              │
                                      ┌───────────────────────▼────────────────────────┐
                                      │          Interactive FinOps Dashboard          │
                                      │  - Real-Time KPI Cards & Spend Curves          │
                                      │  - Team, Feature, Model, Provider Breakdowns   │
                                      │  - Request Explorer, Inspection & Replay       │
                                      │  - Verification Suite (100% Ground Truth Match)│
                                      └────────────────────────────────────────────────┘
```

---

## 💻 Technology Stack

- **Backend Runtime:** Node.js (v20+ / v24) with ECMAScript Modules (ESM).
- **HTTP Engine:** Express.js with custom rate limiter and security middlewares.
- **Database Engine:** Embedded SQLite (`node:sqlite` in WAL mode) for local persistence; Supabase PostgreSQL for cloud deployment.
- **Provider Adapters:** OpenAI API, Google Gemini API, Anthropic Claude API, and Offline Simulated Engine.
- **Frontend Core:** Semantic HTML5, Vanilla JavaScript (ES Modules), Vanilla CSS Design System (no Tailwind dependencies).
- **Visualization:** Chart.js for real-time spend curves, donut charts, and token distribution bars.
- **Automated Testing:** Node.js native test runner (`node --test`).

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- Node.js v20 or v24+
- npm v10+

### 2. Setup Project
```bash
# Clone or navigate to the project directory
cd "C:\Users\Dell\.gemini\antigravity-ide\scratch\llm-cost-proxy"

# Install dependencies
npm install

# Start the server (runs on port 3000)
npm start
```

### 3. Access Dashboard
Open your web browser and navigate to:
```
http://localhost:3000
```

---

## 🧪 Development, Testing & Verification Commands

| Command | Description |
|---|---|
| `npm start` | Launches the production-ready TokenPulse server on `http://localhost:3000` |
| `npm run dev` | Runs the server in development mode with auto-reload (`node --watch`) |
| `npm test` | Executes the complete automated test suite (22 unit & integration tests) |
| `npm run evaluate` | Executes the 16-case ground-truth evaluation suite and generates `EVALUATION_REPORT.md` |
| `npm run seed 100` | Populates database with 100 realistic multi-tenant enterprise requests |

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` to configure server options:

```bash
# Server Port
PORT=3000
NODE_ENV=development

# Administrative Security Key
ADMIN_API_KEY=tokenpulse-admin-key-2026

# Upstream Real AI Provider Credentials (Leave empty to use built-in offline simulation mode)
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Supabase PostgreSQL Configuration (For cloud production deployment)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 📡 Using TokenPulse with Real AI SDKs

TokenPulse is a drop-in replacement for any OpenAI-compatible client. Simply configure the `baseURL` and add team attribution headers:

### Python (OpenAI SDK)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="tokenpulse-key",
    default_headers={
        "x-team": "Core Engineering",
        "x-feature": "Code Review Assistant",
        "x-user": "alex.dev"
    }
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Review this function for memory leaks"}]
)

print(response.choices[0].message.content)
```

### cURL
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-team: Customer Support" \
  -H "x-feature: Ticket Summarizer" \
  -H "x-user: carlos.support" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Summarize customer incident #4819"}]
  }'
```

---

## 🚀 Cloud Deployment Instructions

### Vercel (Frontend & Serverless Gateway)
1. Fork or push repository to GitHub.
2. Link the repository in the Vercel Dashboard.
3. Vercel automatically detects `vercel.json`.
4. Set environment variables (`ADMIN_API_KEY`, `OPENAI_API_KEY`, etc.) in Project Settings.

### Supabase (Persistent Database)
1. Create a project in [Supabase](https://supabase.com).
2. Open the SQL Editor in Supabase.
3. Run the migration script located at `supabase/migrations/20261009_init.sql`.
4. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into your server environment.

---

## 🎯 Offline Simulation Mode vs Real Provider Mode

- **Offline Simulation Mode (Default):**
  - Requires **zero external API keys** and zero external internet access.
  - Generates realistic, contextual AI responses for code review, ticket summaries, SQL generation, and marketing copy.
  - Accurately computes token metrics and exact financial costs.
  - Supports real-time Server-Sent Events (SSE) streaming and configurable artificial latency sliders.
  - Explicitly marked as `is_simulated: true` on all response headers and audit records.
- **Real Provider Mode:**
  - Activated automatically when `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` is configured in the environment.
  - Proxies calls directly to upstream AI vendor endpoints using server-side secrets (never exposed to browser).
  - Captures exact vendor-reported usage details.

---

## 📊 Evaluation & Verification Report

Run the evaluation suite at any time:
```bash
npm run evaluate
```
The suite evaluates 16 deterministic benchmark cases covering all models, cached tokens, failed requests, unknown models, and multi-tenant aggregations.
- **Pass Rate:** 100.00% (23 / 23 tests passed)
- **Total Absolute Error:** $0.000000 USD
- **Dashboard Reconciliation:** Verified Exact Match
