# AEO Engine

Self-hosted AI Engine Optimization platform. Tracks how often AI models (ChatGPT, Claude, Gemini, Perplexity) cite your brand, scores content with real citation validation, optimizes content based on competitive gaps, and monitors visibility trends over time.

## What it does

1. **Citation Tracking** -- Send probe queries to 4 LLM providers simultaneously and detect whether your brand appears in responses. Measures citation type, sentiment, list position, confidence score, and competitor mentions.

2. **Real AEO Scoring** -- 3-component scoring system that validates whether AI engines actually cite your content, not just whether it contains FAQ sections and headings. The score combines structural analysis (20%), live citation validation (50%), and competitive gap measurement (30%).

3. **Competitive Analysis** -- Head-to-head comparison against competitors. Profiles each competitor's citation rate, strong/weak categories, and generates SWOT-style insights with actionable recommendations.

4. **Content Optimization** -- Takes real probe results and competitor patterns to rewrite content for maximum citation likelihood. Shows before/after diffs and estimated score improvement.

5. **Content Generation** -- 3-stage AI pipeline (research, draft, schema markup) that produces content optimized for AI engine citations, with automatic JSON-LD structured data.

6. **Visibility Dashboard** -- Track citation rates over time by provider, share-of-voice breakdown, provider heatmap, and cost tracking across all API calls.

7. **Content Pipeline** -- Kanban board to manage content from idea through draft, review, and publication. Detail view shows score breakdown with structural/citation/competitive sub-scores, optimization tab, and recommendations list.

8. **Alert System** -- Notifications for citation gained/lost, competitor surge, sentiment drop, and cost spike events.

## The Scoring System

The old AEO score was circular: the generator told the LLM to include FAQ sections, headings, and lists, then the scorer checked whether those existed. It measured "did the LLM follow instructions", not "will AI engines cite this."

The new score has 3 independent components:

### Structural Score (20% weight)

The original heuristic checks, retained because they correlate with citability but no longer dominate the score:

| Factor | What it checks |
|--------|---------------|
| Schema markup | JSON-LD structured data present |
| FAQ section | Dedicated FAQ block exists |
| Heading count | 3+ clear section headings |
| Direct answers | Concise answer paragraphs |
| Structured lists | Bulleted or numbered lists |
| Keyword density | 1-3% target range |
| Brand mentions | 2-6 natural mentions |
| Readability grade | Flesch-Kincaid score |

### Citation Validation Score (50% weight)

Actually probes LLMs to test if the content would be cited:

1. Extracts probe queries from the content's headings and FAQ sections (via `query-extractor.ts`)
2. Sends queries to 2-3 enabled providers
3. Runs citation detection on each response
4. Base score = `(cited / total) * 100`
5. Bonuses for positive sentiment and top-3 list positions
6. Penalties when competitors beat you on the same query

### Competitive Gap Score (30% weight)

Compares your citation rate to competitors across historical probe data:

- Calculates your citation rate vs. average competitor rate
- Identifies your top competitor and their rate
- Produces a gap analysis string explaining where you stand
- Score formula: `100 - (gap * scaling_factor)` where gap = competitor advantage

The `AEOScore` interface returned by the scorer:

```typescript
interface AEOScore {
  overall: number;
  structural: StructuralScore;
  citationValidation: CitationValidationScore;
  competitiveGap: CompetitiveGapScore;
  recommendations: Recommendation[];
}
```

Each recommendation has a priority (critical/high/medium/low), category (content/structure/schema/competitive), title, description, and expected impact.

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Recharts, @dnd-kit
- **Backend:** Next.js API routes, Prisma ORM
- **Database:** SQLite (swappable to Postgres via Prisma)
- **LLM Providers:** OpenAI, Anthropic, Google Generative AI, Perplexity

## Setup

```bash
git clone https://github.com/AnthonyAlcaraz/aeo-engine.git
cd aeo-engine
npm install
```

Copy `.env` and add your API keys:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="AI..."
PERPLEXITY_API_KEY="pplx-..."
```

You only need at least one provider key to start. The system auto-detects which providers are available.

Initialize the database and start:

```bash
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). New users see an onboarding wizard that walks through brand setup, provider configuration, probe creation, and a first probe run.

## Workflow

### 1. Create a Brand

Navigate to **Brand Kit** and add your brand with:
- Name and domain
- Target keywords (comma-separated)
- Competitors (name + domain pairs)

Competitors are tracked alongside your brand in every probe run, so you can see who gets cited instead of you.

### 2. Create Probes

Navigate to **Probes** and create citation test queries. Each probe has a category that shapes the prompt template sent to LLMs:

| Category | Prompt Pattern |
|----------|---------------|
| `best-of` | "What are the best {query}?" |
| `top-list` | "What are the top 10 {query}? Rank them." |
| `comparison` | "Compare the leading {query}." |
| `how-to` | "How do I choose the right {query}?" |
| `recommendation` | "I need a recommendation for {query}." |
| `alternative` | "What are the best alternatives for {query}?" |

### 3. Run Probes

Click **Run** on any probe, or use **Batch Execute** to run all active probes at once. The system:

1. Builds the prompt from your query + category template
2. Sends it to all enabled LLM providers (GPT-4o-mini, Claude 3.5 Haiku, Gemini 2.0 Flash, Sonar)
3. Runs 3-layer citation detection on each response:
   - **URL matching** (confidence 1.0) -- finds links to your domain
   - **Name matching** (confidence 0.9) -- exact brand name with word boundaries
   - **Domain matching** (confidence 0.5) -- domain text mentioned without URL
4. Analyzes sentiment around brand mentions (positive/neutral/negative)
5. Detects list position if the response contains a ranked list
6. Identifies which competitors were mentioned
7. Stores all results with cost and latency tracking

Probes can also be scheduled with cron expressions for automated daily or weekly execution.

### 4. Review Results

Navigate to **Probes -> [probe] -> Results** to see:
- Per-provider response breakdown with cited/not-cited indicators
- Citation type (direct mention, URL link, recommendation, comparison)
- Sentiment badges and confidence bars
- Which competitors appeared in each response

### 5. Run Competitive Analysis

Navigate to **Competitive Analysis** to run head-to-head analysis against your competitors. The system:

1. Runs your existing probes against all enabled providers
2. Detects citations for your brand and each competitor
3. Builds competitor profiles with citation rate, average position, average sentiment, and strong/weak categories
4. Generates SWOT-style insights: opportunities (gaps where no one is cited), threats (competitors gaining ground), strengths (queries where you dominate), weaknesses (queries where competitors beat you)
5. Produces actionable recommendations

### 6. Generate Content

Navigate to **Content -> Generate Content** to create AEO-optimized articles:

**Stage 1 -- Research:** Identifies key questions people ask, relevant facts, and optimal structure for AI engine citation.

**Stage 2 -- Draft:** Produces full markdown content with clear headings, direct answers, FAQ sections, and natural keyword integration.

**Stage 3 -- Schema:** Generates JSON-LD structured data (Article, FAQPage, or HowTo) based on content type. Merges schemas when FAQ content appears in non-FAQ articles.

Each piece gets a real **AEO Score** (0-100) using the 3-component system described above.

### 7. Optimize Existing Content

Navigate to **Content -> [item] -> Optimize** to improve existing content. The optimizer:

1. Takes the current content, brand info, and keywords
2. Ingests real citation probe results showing which queries succeeded and failed
3. Incorporates competitor patterns (what gets cited and why)
4. Rewrites sections to maximize citation likelihood
5. Returns a diff of changes with type labels (rewrite, add, restructure, schema)
6. Estimates the score improvement

You can also generate **Content Briefs** from competitive gap data -- the system identifies which queries to target and what sections to include.

### 8. Manage Content Pipeline

The **Content** page has a Kanban board with drag-and-drop columns:

**Idea -> Draft -> Review -> Published**

Drag content cards between columns to update their status. Switch to list view for a table overview. Click into any content item for the detail page showing score breakdown, optimization tab, and recommendations.

### 9. Monitor Dashboard

The **Dashboard** shows:
- **Stat cards:** Total probes, citation runs, citation rate %, total cost
- **Trend chart:** Citation rate per provider over the last 30 days
- **Share of voice:** Pie chart of cited vs. not-cited responses
- **Provider heatmap:** Color-coded citation rates (green >70%, yellow 40-70%, red <40%)

### 10. Configure Settings

The **Settings** page manages:
- API keys per provider
- Daily cost budgets per provider
- Scoring weight configuration (structural/citation/competitive percentages)
- Monitoring and scheduling settings

## Architecture

```
src/
├── app/
│   ├── (app)/                         # App shell with sidebar
│   │   ├── dashboard/page.tsx         # Analytics dashboard
│   │   ├── brand/page.tsx             # Brand management
│   │   ├── probes/page.tsx            # Probe management
│   │   ├── probes/[id]/results/       # Probe results
│   │   ├── content/page.tsx           # Content pipeline + Kanban
│   │   ├── content/[id]/page.tsx      # Content detail + score breakdown
│   │   ├── competitive/page.tsx       # Competitive analysis
│   │   ├── settings/page.tsx          # Settings + API key management
│   │   └── onboarding/page.tsx        # 4-step onboarding wizard
│   ├── api/
│   │   ├── brand/                     # Brand CRUD
│   │   ├── probes/                    # Probe CRUD
│   │   ├── citations/probe/           # Probe execution engine
│   │   ├── content/                   # Content CRUD + generation + optimization
│   │   ├── scoring/                   # AEO validation + content briefs
│   │   ├── competitive/               # Competitive analysis
│   │   ├── dashboard/                 # Stats + trends aggregation
│   │   ├── settings/                  # Settings CRUD
│   │   ├── alerts/                    # Alert management
│   │   ├── scheduling/               # Job scheduling
│   │   └── onboarding/               # Onboarding flow
│   └── page.tsx                       # Redirect to /dashboard
├── components/
│   ├── layout/                        # Sidebar + app shell
│   └── ui/                            # Button, Card, Input, Select, etc.
├── lib/
│   ├── llm/                           # Unified LLM client
│   │   ├── index.ts                   # Interface + factory + cost calculation
│   │   ├── openai-adapter.ts          # OpenAI SDK adapter
│   │   ├── anthropic-adapter.ts       # Anthropic SDK adapter
│   │   ├── google-adapter.ts          # Google Generative AI adapter
│   │   └── perplexity-adapter.ts      # Perplexity (OpenAI-compatible) adapter
│   ├── citation/
│   │   ├── detector.ts                # 3-layer citation detection
│   │   ├── prompt-builder.ts          # 6 probe prompt templates
│   │   └── competitive.ts             # Competitive analysis engine
│   ├── content/
│   │   ├── generator.ts               # 3-stage content generation
│   │   ├── schema-markup.ts           # JSON-LD generation + markdown parsing
│   │   └── optimizer.ts               # Content optimization from probe data
│   ├── scoring/
│   │   ├── aeo-scorer.ts              # 3-component AEO scoring engine
│   │   └── query-extractor.ts         # Extract probe queries from content
│   ├── monitoring/
│   │   ├── rate-limiter.ts            # Per-provider token bucket + daily cost caps
│   │   └── cache.ts                   # SHA-256 keyed cache (24h probes, 7d content)
│   ├── db/index.ts                    # Prisma client singleton
│   └── utils.ts                       # cn(), formatCurrency, truncate, slugify
└── prisma/
    └── schema.prisma                  # Database models
```

**Counts:** 22 API routes, 9 pages, 13 lib modules.

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/brand` | GET | List brands with probe/run counts |
| `/api/brand` | POST | Create brand |
| `/api/brand/[id]` | GET/PUT/DELETE | Brand CRUD |
| `/api/probes` | GET | List probes (filter by `?brandId=`) |
| `/api/probes` | POST | Create probe |
| `/api/probes/[id]` | GET/PUT/DELETE | Probe CRUD |
| `/api/citations/probe` | POST | Execute probe across providers |
| `/api/content` | GET | List content (filter by `?brandId=` `?status=`) |
| `/api/content` | POST | Create content manually |
| `/api/content/[id]` | GET/PUT/DELETE | Content CRUD |
| `/api/content/generate` | POST | Generate AEO content (3-stage) |
| `/api/content/optimize` | POST | Optimize existing content from probe data |
| `/api/scoring/validate` | POST | Run real 3-component AEO scoring |
| `/api/scoring/brief` | POST | Generate data-driven content brief |
| `/api/competitive/analyze` | POST | Run competitive analysis |
| `/api/dashboard/stats` | GET | Aggregated citation stats |
| `/api/dashboard/trends` | GET | Daily trends (param: `?days=30`) |
| `/api/settings` | GET/PUT | Settings CRUD |
| `/api/alerts` | GET | List alerts |
| `/api/alerts/[id]` | PUT | Update alert |
| `/api/alerts/read-all` | POST | Mark all alerts read |
| `/api/scheduling` | GET/POST | Job scheduling management |
| `/api/onboarding` | GET/POST | Onboarding flow |

## Pages

| Path | Purpose |
|------|---------|
| `/dashboard` | Analytics dashboard |
| `/brand` | Brand management |
| `/probes` | Probe management |
| `/probes/[id]/results` | Probe results detail |
| `/content` | Content pipeline + Kanban |
| `/content/[id]` | Content detail + score breakdown + optimization |
| `/competitive` | Competitive analysis |
| `/settings` | API keys, budgets, scoring weights, monitoring |
| `/onboarding` | 4-step setup wizard |

## Default Models

Probing uses cheap, fast models to control costs:

| Provider | Model | Input $/1K tokens | Output $/1K tokens |
|----------|-------|-------------------|-------------------|
| OpenAI | gpt-4o-mini | $0.00015 | $0.0006 |
| Anthropic | claude-3-5-haiku-latest | $0.0008 | $0.004 |
| Google | gemini-2.0-flash | $0.0001 | $0.0004 |
| Perplexity | sonar | $0.001 | $0.001 |

Content generation and optimization use stronger models (gpt-4o, claude-sonnet-4).

## Rate Limiting

Per-provider defaults (in-memory, resets automatically):

- **100,000 tokens/minute** per provider
- **60 requests/minute** per provider
- **$5.00/day** cost cap per provider (configurable in Settings)

## Database

SQLite by default for zero-config local development. To switch to Postgres, change the datasource in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then update `DATABASE_URL` and run `npx prisma db push`.

## License

Private.
