# Citability Engine

**Self-hosted platform that tracks, scores, and improves how AI engines cite your brand.** Covers both Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO) through a self-improving agentic feedback loop: Probe → Score → Optimize → Re-probe.

AI engines (ChatGPT, Claude, Gemini, Perplexity) are replacing traditional search for millions of users. When someone asks "what's the best CRM tool?", the AI's answer determines who gets the customer. Citability Engine gives you visibility into those answers and an autonomous system that improves your position.

### AEO + GEO: One Platform, Both Strategies

The industry uses two terms for the same fundamental challenge: getting your content cited by AI systems.

- **AEO (Answer Engine Optimization)** targets featured snippets, voice assistants, People Also Ask, and AI Overviews on Google — anywhere a direct answer replaces a blue link.
- **GEO (Generative Engine Optimization)** targets generative AI platforms (ChatGPT, Claude, Perplexity, Gemini) that synthesize multi-source responses with citations.

Citability Engine covers both. The probe system tests your content against generative AI platforms (GEO) while the structural scoring validates answer-engine readiness (AEO). The 3-component scoring system measures both: Citation Validation (50%) tests GEO — does the generative AI cite you? Structural Analysis (20%) tests AEO — is your content formatted for extraction? Competitive Gap (30%) benchmarks both against competitors.

## Features

### Citation Tracking (All Providers Search-Enabled)
Send probe queries to 5 providers — **all with live web search**. OpenAI Search Preview (Bing), Claude with native web search (Brave), Gemini with Google Search grounding, Perplexity Sonar (multi-index), and Tavily (AI search aggregator). Every provider searches the live web, testing what users actually see — not what models memorized during training. Detect whether your brand appears in responses with 3-layer detection (URL matching, name matching, domain matching). Measures citation type, sentiment, list position, confidence score, and competitor mentions.

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

## Agentic Feedback Loop

Citability Engine is not a dashboard that shows static metrics. It is a self-improving agentic system that closes the loop between measurement and action.

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENTIC FEEDBACK LOOP                         │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │  PROBE   │───→│  SCORE   │───→│ OPTIMIZE │───→│ RE-PROBE │ │
│   │          │    │          │    │          │    │          │ │
│   │ 5 search │    │ 3-comp   │    │ LLM      │    │ Validate │ │
│   │ providers│    │ scoring  │    │ rewriter │    │ improve  │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│        ↑                                               │        │
│        └───────────────────────────────────────────────┘        │
│                     Continuous Loop                              │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ ALERT ENGINE: monitors citation changes between cycles   │  │
│   └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### How the Loop Works

**Step 1: Probe** — Execute queries across 5 search-enabled providers. Each probe creates a `CitationRun` with per-provider `CitationResult` records: cited (bool), citation type, sentiment, list position, competitor mentions, confidence score, full response text.

**Step 2: Score** — The 3-component scorer runs autonomously:
- **Structural Analysis** (20%) inspects the content's markdown structure
- **Citation Validation** (50%) extracts probe queries from the content's own headings and FAQ sections, sends them to 2-3 providers, and checks if the content gets cited — a **probe-within-a-probe** that validates citability against the content's own topic claims
- **Competitive Gap** (30%) compares your citation rate to competitors across historical probe data

**Step 3: Optimize** — The optimizer receives:
1. Queries where your brand **was** cited (patterns to preserve)
2. Queries where your brand **was not** cited (gaps to fix)
3. Competitor citation patterns (what works for them)

It rewrites sections to maximize citation likelihood, returns before/after diffs, and estimates score improvement.

**Step 4: Re-Probe** — New probes run against the optimized content. The system stores historical `CitationRun` records, enabling before/after comparison. The alert engine fires on citation gained, citation lost, competitor surge, or sentiment shift.

**Step 5: Repeat** — Schedule with cron for automated daily or weekly cycles. The system continuously optimizes toward higher citation rates.

### Three Autonomous Agentic Loops

The system contains three nested autonomous loops:

1. **Citation Validation Loop** — During scoring, auto-extracts 5 queries from content, probes 3 providers, analyzes responses. Runs without user input.
2. **Competitive Analysis Loop** — For each probe query × each provider × each competitor: queries, detects citations, builds SWOT profiles. Parallelized.
3. **Batch Execution Loop** — Runs all active probes, respects per-provider rate limits, logs API usage, triggers alert checks post-execution. Schedulable via cron.

---

## Knowledge Graph Layer (KuzuDB)

The knowledge graph (`src/lib/graph/`) stores citation data as a property graph in KuzuDB, solving three problems the relational DB cannot handle.

### Entity Resolution

When ChatGPT mentions "Salesforce CRM" and Perplexity mentions "Salesforce Sales Cloud", the relational DB treats these as different strings. The knowledge graph resolves both to the same canonical entity node via `ALIAS_OF` edges. Citation counts become accurate across naming variants.

```
Entity("Salesforce") ←─ ALIAS_OF ─ Entity("Salesforce CRM")
                     ←─ ALIAS_OF ─ Entity("Salesforce Sales Cloud")
```

### Citation Path Analysis

Every probe result creates a traversable path: `Entity → CITED_IN → Citation → FROM_PROVIDER → Provider`. This reveals which search backends (Bing, Brave, Google) surface your brand most frequently. The `getSearchBackendAnalysis()` method answers: "Which search index cites us and which doesn't?"

### Temporal Tracking

Each citation event carries a timestamp. The `getCitationTrajectory()` method returns citation rate over time per entity per provider — showing whether your visibility is rising or declining across each AI engine over 30 days.

### Graph Schema

```
Nodes: Entity, Provider, Query, Citation
Edges: ALIAS_OF, CITED_IN, FROM_PROVIDER, FOR_QUERY, COMPETES_WITH
```

### Ingestion Bridge

`src/lib/graph/ingest.ts` connects citation detection to the graph. After every probe run, `ingestCitationResult()` creates entity nodes, citation events, and competitive edges automatically. The graph grows with every probe cycle.

### The Architectural Parallel

AI engines already perform entity resolution and relationship traversal to decide what to cite. The knowledge graph mirrors that reasoning — brands with clear entity structures, consistent naming, and interconnected content are the ones that get cited. Citability Engine models the same structure that produces citations.

---

## Quick Start

```bash
git clone https://github.com/AnthonyAlcaraz/citability-engine.git
cd citability-engine
npm install
```

Create a `.env` file with your API keys (you need at least one provider):

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="AI..."
PERPLEXITY_API_KEY="pplx-..."
TAVILY_API_KEY="tvly-..."
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
  Run Against LLMs -------- GPT-4o Search, Claude + Web Search, Gemini + Grounding, Perplexity Sonar, Tavily
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
│   ├── llm/                           # Unified LLM client + 5 provider adapters (all search-enabled)
│   ├── citation/                      # 3-layer detection + prompt templates + competitive engine
│   ├── content/                       # 3-stage generation + optimization + schema markup
│   ├── scoring/                       # 3-component AEO scorer + query extractor
│   ├── graph/                         # KuzuDB knowledge graph (entity resolution, citation paths, temporal)
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
| Knowledge Graph | KuzuDB — entity resolution, citation path analysis, temporal tracking |
| LLM Integration | OpenAI (Bing search), Anthropic (Brave search), Google (Google Search grounding), Perplexity (multi-index), Tavily (AI search aggregator) |
| Cost Control | Per-provider rate limiter (100K tokens/min, $5/day cap, configurable) |
| Caching | SHA-256 keyed, 24h TTL for probes, 7d for content |

---

## Default Models

**Every provider searches the live web.** No raw LLM baselines — Citability Engine tests what users actually see.

| Provider | Model | Search Backend | Cost per Probe |
|----------|-------|---------------|---------------|
| OpenAI | gpt-4o-mini-search-preview | Bing via `web_search_options` | ~$0.026 (tokens + $0.025/call) |
| Anthropic | claude-3-5-haiku-latest | Brave via `web_search_20250305` tool | ~$0.015 (tokens + $0.01/search) |
| Google | gemini-2.0-flash | Google Search grounding | ~$0.001 (tokens only) |
| Perplexity | sonar | Multi-index (Bing + Google + own) | ~$0.002 (tokens only) |
| Tavily | tavily-search | AI search aggregator (20+ sources) | $0.016/query (flat rate) |

### How Each Provider Searches

- **OpenAI:** Uses Bing's search index via `web_search_options` parameter. OAI-SearchBot fetches full page content from top results.
- **Anthropic:** Native `web_search_20250305` server-side tool backed by Brave Search. Claude chains multiple searches autonomously and returns inline citations.
- **Google:** `googleSearchRetrieval` grounding with dynamic threshold — uses Google's production search index and Knowledge Graph.
- **Perplexity:** Multi-source retrieval from Bing, Google, and its own crawler index (PerplexityBot). Deduplicates and re-ranks across all sources.
- **Tavily:** AI-native search aggregator that scrapes and filters from 20+ web sources. Returns scored results with optional full page content.

### Why All-Search Probing Matters

Users don't query raw LLMs. They ask ChatGPT with search on, Claude with web access, Gemini with grounding, Perplexity with citations. Testing raw model responses tells you what the model memorized during training. Testing search-enabled responses tells you what users actually see when they ask about your brand today. Citability Engine probes all 5 providers with live web search — covering Bing (OpenAI), Brave (Anthropic), Google (Gemini), multi-index (Perplexity), and aggregated web (Tavily).

A full probe across 5 providers costs approximately $0.06. Running 10 probes daily costs under $20/month. Content generation with stronger models (GPT-4o, Claude Sonnet) costs $0.05-0.15 per article.

### How AI Engines Find Information to Cite

Understanding the retrieval pipeline explains why structured content wins:

```
User Query → Query Reformulation → Search Index Lookup → Re-ranking → Content Fetching → Context Assembly → LLM Generation with Citations
```

1. **Crawlability:** AI crawlers (GPTBot, PerplexityBot, Google-Extended) must access your pages. Block them in robots.txt and you're invisible.
2. **Indexation:** Your content must rank in the search indexes (Bing, Google) that AI engines query. Domain authority, topical depth, and backlinks still matter.
3. **Entity Resolution:** AI systems recognize brands as entities. Schema.org markup, Wikipedia presence, consistent naming across sources — these make your brand unambiguous.
4. **Content Structure:** Direct answers, question-matching headers, specific data points. The LLM cites the source that most directly answers the query.
5. **Multi-Engine Presence:** ChatGPT uses Bing, Gemini uses Google, Perplexity uses both + its own index. You need to rank across all search backends.

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

- Additional search aggregators (Exa neural search, Linkup, Brave Search API)
- WordPress publishing integration
- Historical comparison (before/after content publication impact on citation rates)
- Multi-language probe support
- Provider-specific optimization strategies (what works for GPT vs. Claude vs. Gemini)
- Search backend analytics (which search index surfaces your content most)

---

## License

MIT
