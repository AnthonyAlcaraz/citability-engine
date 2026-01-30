# AEO Engine -- One Pager

## The Problem

AI engines (ChatGPT, Claude, Gemini, Perplexity) are replacing traditional search for millions of users. When someone asks "what's the best CRM tool?", the AI's answer determines who gets the customer. There is no reliable way to know whether your brand appears in those answers, how often, in what context, or what you can do to improve it.

## The Solution

AEO Engine is a self-hosted platform that tracks your brand's visibility across AI models, validates whether your content actually earns citations, and optimizes content based on real probe data and competitive intelligence.

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

## Scoring: The Core Difference

The old approach was circular: generate content with FAQ sections and headings, then check if those exist. That measured "did the LLM follow formatting instructions", not "will AI engines cite this."

The new score validates citation likelihood against real LLM responses:

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| **Structural** | 20% | Schema markup, FAQ sections, headings, keyword density, readability |
| **Citation Validation** | 50% | Sends extracted queries to LLMs, checks if your content gets cited |
| **Competitive Gap** | 30% | Your citation rate vs. competitors across historical probe data |

Citation Validation dominates because it answers the only question that matters: does the AI actually mention you?

## Core Capabilities

**Citation Tracking** -- Query 4 LLM providers with probe templates (best-of, top-list, comparison, how-to, recommendation, alternative). 3-layer detection analyzes responses for brand mentions, URLs, sentiment, list position, and competitor presence. Each result gets a confidence score (0.5-1.0).

**Real AEO Scoring** -- 3-component score that probes live LLMs to validate citation likelihood. Extracts queries from your content's headings and FAQ sections, tests them against providers, and factors in competitive positioning. Returns prioritized recommendations.

**Competitive Analysis** -- Run head-to-head analysis against competitors. Builds profiles with citation rates, strong/weak categories, and SWOT-style insights (opportunities, threats, strengths, weaknesses). Identifies where competitors win and you don't.

**Content Optimization** -- Takes real probe results and competitor patterns to rewrite content. Shows before/after diffs with change types (rewrite, add, restructure, schema) and estimated score improvement.

**Content Briefs** -- Generate data-driven briefs from competitive gaps. Identifies which queries to target, what sections to include, and where competitors are vulnerable.

**Visibility Dashboard** -- Citation rate trends by provider, share-of-voice chart, provider heatmap, and cost tracking. Filter by date range (default 30 days).

**Content Pipeline** -- Drag-and-drop Kanban board. Content detail page shows score breakdown with sub-scores, optimization tab, and recommendations list.

**Alert System** -- Notifications for citation gained/lost, competitor surge, sentiment drop, and cost spike.

**Batch Execution + Scheduling** -- Run all probes at once. Schedule with cron for automated daily or weekly execution.

**Onboarding Wizard** -- 4-step setup: brand info, provider API keys, probe creation, first probe run.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind, Recharts, @dnd-kit |
| API | 22 Next.js API routes with Zod validation |
| Pages | 9 pages including competitive analysis, content detail, settings, onboarding |
| Lib Modules | 13 modules: LLM adapters, citation detection, competitive analysis, content generation, optimization, scoring, monitoring |
| Database | Prisma + SQLite (swappable to Postgres) |
| LLM Integration | OpenAI, Anthropic, Google Generative AI, Perplexity |
| Cost Control | Per-provider rate limiter (100K tokens/min, $5/day cap, configurable) |
| Caching | SHA-256 keyed, 24h TTL for probes, 7d for content |

## Cost Profile

Probing uses cheap models by default. A full probe across 4 providers costs roughly $0.002-0.005. Running 10 probes daily across 4 providers costs under $2/month. Content generation and optimization with stronger models (GPT-4o, Claude Sonnet) costs $0.05-0.15 per article.

## Quick Start

```bash
git clone https://github.com/AnthonyAlcaraz/aeo-engine.git
cd aeo-engine
npm install
# Add API keys to .env (at least one provider)
npx prisma db push
npm run dev
```

New users see a 4-step onboarding wizard on first launch.

## What's Next

- WordPress publishing integration
- Historical comparison (before/after content publication impact on citation rates)
- Multi-language probe support
- Provider-specific optimization strategies (what works for GPT vs. Claude vs. Gemini)
