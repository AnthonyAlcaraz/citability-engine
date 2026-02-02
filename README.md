# AEO Engine

**Self-hosted AI Engine Optimization platform.** Track how AI models cite your brand, validate citation likelihood with real LLM probes, and optimize content based on competitive intelligence.

AI engines (ChatGPT, Claude, Gemini, Perplexity) are replacing traditional search for millions of users. When someone asks "what's the best CRM tool?", the AI's answer determines who gets the customer. AEO Engine gives you visibility into those answers and tools to improve your position.

## Features

### Citation Tracking
Send probe queries to 4 LLM providers simultaneously. Detect whether your brand appears in responses with 3-layer detection (URL matching, name matching, domain matching). Measures citation type, sentiment, list position, confidence score, and competitor mentions.

### Real AEO Scoring
3-component scoring system that validates whether AI engines actually cite your content — not just whether it follows SEO formatting conventions.

| Component | Weight | What It Measures |
|-----------|--------|-----------------|
| **Structural** | 20% | Schema markup, FAQ sections, headings, keyword density, readability |
| **Citation Validation** | 50% | Sends extracted queries to LLMs, checks if your content gets cited |
| **Competitive Gap** | 30% | Your citation rate vs. competitors across historical probe data |

Citation Validation dominates because it answers the only question that matters: does the AI actually mention you?

### Competitive Analysis
Head-to-head comparison against competitors. Profiles each competitor's citation rate by category, generates SWOT-style insights (opportunities, threats, strengths, weaknesses), and produces actionable recommendations.

### Content Optimization
Takes real probe results and competitor patterns to rewrite content for maximum citation likelihood. Shows before/after diffs with change types (rewrite, add, restructure, schema) and estimated score improvement.

### Content Generation
3-stage AI pipeline:
1. **Research** — Analyzes topic for questions AI engines ask, identifies key facts and structure
2. **Draft** — Produces full markdown with headings, FAQ, lists, and natural brand mentions
3. **Schema** — Generates JSON-LD structured data (Article, FAQPage, HowTo)

### Visibility Dashboard
Citation rate trends by provider, share-of-voice chart, provider heatmap, cost tracking. Filter by date range.

### Content Pipeline
Drag-and-drop Kanban board (Idea → Draft → Review → Published). Detail view shows score breakdown with sub-scores, optimization tab, and recommendations.

### Alert System
Notifications for citation gained/lost, competitor surge, sentiment drop, and cost spike events.

### Batch Execution & Scheduling
Run all probes at once. Schedule with cron expressions for automated daily or weekly execution.

### Onboarding Wizard
4-step setup: brand info → provider API keys → probe creation → first probe run.

---

## Quick Start

```bash
git clone https://github.com/AnthonyAlcaraz/aeo-engine.git
cd aeo-engine
npm install
```

Create a `.env` file with your API keys (you need at least one provider):

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="AI..."
PERPLEXITY_API_KEY="pplx-..."
```

Initialize the database and start:

```bash
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). New users see an onboarding wizard that walks through brand setup, provider configuration, probe creation, and a first probe run.

---

## How It Works

```
Define Brand + Competitors
        |
        v
  Create Probes ----------- "What are the best CRM tools?"
        |                   "Compare top sales platforms"
        v
  Run Against LLMs -------- GPT-4o-mini, Claude Haiku, Gemini Flash, Perplexity Sonar
        |
        v
  Detect Citations -------- Cited? Position? Sentiment? Competitors mentioned?
        |
        v
  Score (3-component) ----- Structural (20%) + Citation Validation (50%) + Competitive Gap (30%)
        |
        v
  Competitive Analysis ---- Head-to-head vs. competitors, SWOT insights
        |
        v
  Optimize Content -------- Rewrite sections based on probe results + competitor patterns
        |
        v
  Re-probe & Measure ------ Validate improvements with fresh citation checks
        |
        v
  Dashboard + Alerts ------ Track trends, get notified on citation changes
```

---

## Workflow

### 1. Create a Brand

Navigate to **Brand Kit** and add your brand with name, domain, target keywords, and competitors (name + domain pairs). Competitors are tracked alongside your brand in every probe run.

### 2. Create Probes

Navigate to **Probes** and create citation test queries. Each probe has a category that shapes the prompt template:

| Category | Prompt Pattern |
|----------|---------------|
| `best-of` | "What are the best {query}?" |
| `top-list` | "What are the top 10 {query}? Rank them." |
| `comparison` | "Compare the leading {query}." |
| `how-to` | "How do I choose the right {query}?" |
| `recommendation` | "I need a recommendation for {query}." |
| `alternative` | "What are the best alternatives for {query}?" |

### 3. Run Probes

Click **Run** on any probe, or use **Batch Execute** to run all active probes. The system queries all enabled providers in parallel, runs 3-layer citation detection, analyzes sentiment, detects list position, and identifies competitor mentions.

### 4. Run Competitive Analysis

Navigate to **Competitive Analysis** for head-to-head comparison. The system runs your probes, builds competitor profiles (citation rate, avg position, sentiment, strong/weak categories), and generates SWOT-style insights with actionable recommendations.

### 5. Generate or Optimize Content

**Generate:** 3-stage pipeline produces content with automatic JSON-LD structured data and a real AEO score.

**Optimize:** Feed citation validation results and competitor patterns into the optimizer. It rewrites sections, returns a detailed change log with before/after diffs, and estimates score improvement.

**Content Briefs:** Generate data-driven briefs from competitive gaps — identifies which queries to target and where competitors are vulnerable.

### 6. Manage Pipeline

Drag-and-drop Kanban board: **Idea → Draft → Review → Published**. Each content item has a detail page with score breakdown, optimization tab, and recommendations.

### 7. Monitor

Dashboard shows stat cards, trend charts, share-of-voice breakdown, and provider heatmap. Alerts notify you of citation changes, competitor movements, and cost spikes.

---

## Architecture

```
src/
├── app/
│   ├── (app)/                         # App shell with sidebar
│   │   ├── dashboard/                 # Analytics dashboard
│   │   ├── brand/                     # Brand management
│   │   ├── probes/                    # Probe management + results
│   │   ├── content/                   # Content pipeline + Kanban + detail
│   │   ├── competitive/               # Competitive analysis
│   │   ├── settings/                  # Configuration
│   │   └── onboarding/                # Setup wizard
│   └── api/
│       ├── brand/                     # Brand CRUD
│       ├── probes/                    # Probe CRUD
│       ├── citations/probe/           # Probe execution engine
│       ├── content/                   # Content CRUD + generation + optimization
│       ├── scoring/                   # AEO validation + content briefs
│       ├── competitive/               # Competitive analysis
│       ├── dashboard/                 # Stats + trends aggregation
│       ├── settings/                  # Settings CRUD
│       ├── alerts/                    # Alert management
│       └── scheduling/                # Job scheduling
├── components/
│   ├── layout/                        # Sidebar + app shell
│   └── ui/                            # Button, Card, Input, Dialog, etc.
├── lib/
│   ├── llm/                           # Unified LLM client + 4 provider adapters
│   ├── citation/                      # 3-layer detection + prompt templates + competitive engine
│   ├── content/                       # 3-stage generation + optimization + schema markup
│   ├── scoring/                       # 3-component AEO scorer + query extractor
│   ├── monitoring/                    # Rate limiter + cache
│   └── db/                            # Prisma client singleton
└── prisma/
    └── schema.prisma                  # 11 database models
```

**22 API routes · 9 pages · 13 lib modules · 11 database models**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts, @dnd-kit |
| API | Next.js API routes with Zod validation |
| Database | Prisma ORM + SQLite (swappable to PostgreSQL) |
| LLM Integration | OpenAI, Anthropic, Google Generative AI, Perplexity |
| Cost Control | Per-provider rate limiter (100K tokens/min, $5/day cap, configurable) |
| Caching | SHA-256 keyed, 24h TTL for probes, 7d for content |

---

## Default Models

Probing uses cheap, fast models to keep costs low:

| Provider | Model | Input $/1K | Output $/1K |
|----------|-------|-----------|------------|
| OpenAI | gpt-4o-mini | $0.00015 | $0.0006 |
| Anthropic | claude-3-5-haiku-latest | $0.0008 | $0.004 |
| Google | gemini-2.0-flash | $0.0001 | $0.0004 |
| Perplexity | sonar | $0.001 | $0.001 |

A full probe across 4 providers costs ~$0.002-0.005. Running 10 probes daily costs under $2/month. Content generation with stronger models (GPT-4o, Claude Sonnet) costs $0.05-0.15 per article.

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/brand` | GET/POST | List or create brands |
| `/api/brand/[id]` | GET/PUT/DELETE | Brand CRUD |
| `/api/probes` | GET/POST | List or create probes |
| `/api/probes/[id]` | GET/PUT/DELETE | Probe CRUD |
| `/api/citations/probe` | POST | Execute probe across providers |
| `/api/content` | GET/POST | List or create content |
| `/api/content/[id]` | GET/PUT/DELETE | Content CRUD |
| `/api/content/generate` | POST | Generate AEO content (3-stage) |
| `/api/content/optimize` | POST | Optimize content from probe data |
| `/api/scoring/validate` | POST | Run 3-component AEO scoring |
| `/api/scoring/brief` | POST | Generate data-driven content brief |
| `/api/competitive/analyze` | POST | Run competitive analysis |
| `/api/dashboard/stats` | GET | Aggregated citation stats |
| `/api/dashboard/trends` | GET | Daily trends (`?days=30`) |
| `/api/settings` | GET/PUT | Settings CRUD |
| `/api/alerts` | GET | List alerts |
| `/api/alerts/[id]` | PUT | Update alert |
| `/api/alerts/read-all` | POST | Mark all alerts read |
| `/api/scheduling` | GET/POST | Job scheduling |
| `/api/onboarding` | GET/POST | Onboarding flow |

---

## Database

SQLite by default for zero-config local development. To switch to PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Update `DATABASE_URL` in `.env` and run `npx prisma db push`.

**Models:** Brand, Probe, CitationRun, CitationResult, Content, PublishTarget, PublishLog, MonitoringSchedule, Alert, ApiUsageLog, CacheEntry.

---

## Rate Limiting

Per-provider defaults (configurable in Settings):

- **100,000 tokens/minute** per provider
- **60 requests/minute** per provider
- **$5.00/day** cost cap per provider

---

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npx prisma db push   # Sync schema to database
npx prisma studio    # Visual database editor
```

---

## Roadmap

- WordPress publishing integration
- Historical comparison (before/after content publication impact on citation rates)
- Multi-language probe support
- Provider-specific optimization strategies (what works for GPT vs. Claude vs. Gemini)

---

## License

MIT
