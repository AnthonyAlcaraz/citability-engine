---
title: "I Built an Open Source AEO/GEO Engine Because $300/Month for LLM Probing is Absurd"
date: 2026-02-02
type: medium
status: draft
featured-image: https://i.imgur.com/n7rLnxj.png
themes: [aeo, geo, answer-engine-optimization, generative-engine-optimization, ai-search, knowledge-graphs, open-source]
vault-sources: [_meta.md, Chapter 3 - Knowledge & Memory/_meta.md]
gist-url: https://gist.github.com/AnthonyAlcaraz/242221d064f103e85deffb394ddca76c
medium-publish-url:
---

> **Publishing Instructions:**
> 1. **Import from Gist**: https://medium.com/p/import?url=https://gist.github.com/AnthonyAlcaraz/242221d064f103e85deffb394ddca76c
> 2. Add featured image from: https://i.imgur.com/n7rLnxj.png
> 3. Add tags: Answer Engine Optimization, Generative Engine Optimization, AI Search, Knowledge Graphs, Open Source
> 4. Update medium-publish-url in frontmatter after publishing

---

# I Built an Open Source AEO/GEO Engine Because $300/Month for LLM Probing is Absurd

The shift happened faster than anyone predicted. Gartner forecasts a 25% drop in traditional search engine volume by the end of 2026. Traffic from AI-generated answers grew 527% year-over-year. Visitors arriving from ChatGPT and Perplexity convert at 4.4x the rate of traditional organic search. And 72% of consumers say they will use AI-powered search more frequently, according to HubSpot's Consumer Trends Report.

When someone asks an AI engine "what's the best project management tool?", the model synthesizes information from multiple sources and presents a consolidated answer. If your brand appears in that answer, you captured a customer. If it doesn't, you're invisible. Over 70% of searches now end without a single click. The AI gave the answer. The user moved on.

This created two overlapping industries overnight: **Answer Engine Optimization (AEO)** and **Generative Engine Optimization (GEO)**.

## AEO vs GEO: The Artificial Split

The industry draws a line between AEO and GEO that does not hold up under examination.

**AEO** targets featured snippets, People Also Ask, voice assistants, and Google's AI Overviews — anywhere a direct answer replaces a blue link. It optimizes for extraction: concise answers, schema markup, FAQ sections, headings that match query patterns.

**GEO** targets generative AI platforms — ChatGPT, Claude, Perplexity, Gemini — that synthesize multi-source responses. Princeton researchers demonstrated that GEO techniques (statistics inclusion, structured formatting, topic coverage) boost AI visibility by up to 40%. GEO optimizes for citation: content depth, authority signals, entity clarity.

Some argue these are the same strategy with different labels. Profound calls them "one strategy." The underlying mechanics overlap significantly: structured content, entity consistency, and authoritative sourcing improve both extraction and citation.

The practical difference matters for measurement. AEO success shows up in SERP features. GEO success shows up in generative AI responses. You need to measure both. Citability Engine does — the Structural Analysis component validates extraction readiness (AEO), while Citation Validation probes generative AI responses (GEO).

## The AEO/GEO Gold Rush

The market responded predictably. HubSpot launched a free AEO Grader that benchmarks brand visibility across GPT-4o, Perplexity, and Gemini. Profound tracks citations across 10+ AI engines with millions of daily queries. OtterlyAI monitors brand mentions for 15,000+ marketing professionals. Finseo, Visby, Conductor, and a dozen others compete for the same budget. G2 created an entire product category for AEO tools. Enterprise pricing starts at $200/month and climbs to $500+.

Princeton researchers demonstrated that Generative Engine Optimization (GEO) techniques can boost visibility by up to 40% through statistics inclusion, structured formatting, and comprehensive topic coverage. The research validated that this is a real, measurable phenomenon.

But look at what these tools fundamentally do.

## What $300/Month Actually Buys You

Strip away the dashboards, the trend charts, and the enterprise SSO, and most AEO tools perform three operations:

1. Send a query to one or more LLM APIs
2. Scan the response for your brand name or domain
3. Display the results in a dashboard

That's it. The core detection logic is approximately 50 lines of code. The value proposition is monitoring over time, competitive benchmarking, and alerting. But the underlying capability is API query + string matching.

The scoring systems are typically opaque. You see a number. You don't see how it was calculated. You can't inspect which queries were run, what detection logic was applied, or how the weights were determined. The methodology is proprietary, which means you're optimizing for a black box inside another black box (the LLM).

## Why I Built Citability Engine

I built Citability Engine as a self-hosted, self-improving agentic system because I wanted to see exactly what was happening — and close the feedback loop that dashboard tools leave open. The full codebase is 22 API routes, 9 pages, 13 library modules, 5 search-enabled provider adapters, and 11 database models. Everything is inspectable.

The repo: [github.com/AnthonyAlcaraz/citability-engine](https://github.com/AnthonyAlcaraz/citability-engine)

### 3-Layer Citation Detection

Most tools check if your brand name appears in a response. Citability Engine runs three detection layers with explicit confidence scoring:

| Layer | Method | Confidence |
|-------|--------|-----------|
| URL matching | Finds `https://yourdomain.com` links in response | 1.0 |
| Name matching | Word-bounded exact brand name match | 0.9 |
| Domain matching | Domain text mentioned without URL context | 0.5 |
| Partial matching | Substring match of brand name | 0.7 |

Each citation gets classified by type (direct mention, URL link, recommendation, comparison), analyzed for sentiment (positive, neutral, negative), checked for list position if the response contains rankings, and cross-referenced against competitor mentions.

The detection runs across five providers — **all with live web search enabled**:

- **OpenAI** (GPT-4o-mini Search Preview with `web_search_options`) — searches via Bing's index
- **Anthropic** (Claude 3.5 Haiku with `web_search_20250305` tool) — searches via Brave Search, returns inline citations
- **Google** (Gemini 2.0 Flash with Google Search grounding) — searches via Google's production index + Knowledge Graph
- **Perplexity** (Sonar with built-in multi-index search) — searches Bing + Google + its own PerplexityBot crawler index
- **Tavily** (AI search aggregator) — searches and filters from 20+ web sources with scored relevance

Every provider searches the live web. No raw LLM baselines. This distinction matters. Most AEO tools probe raw LLMs, which tests what models memorized during training. Real users interact with ChatGPT Search, Claude with web access, Gemini with grounding on, and Perplexity with live citations. Citability Engine tests what users actually see — search-augmented responses that pull from live web content across five different search backends (Bing, Brave, Google, multi-index, aggregated web).

### 3-Component Scoring (The Part That Actually Matters)

The standard AEO scoring approach is circular. Content generation tools produce articles with FAQ sections, clear headings, and schema markup. Scoring tools then check whether those elements exist. This measures "did the content follow formatting instructions," not "will AI engines cite this."

Citability Engine splits the score into three independent components:

**Structural Analysis (20% weight):** The traditional heuristic checks — schema markup presence, FAQ sections, heading count, keyword density, readability grade, brand mention count, word count. These correlate with citability but are not sufficient indicators on their own.

**Citation Validation (50% weight):** The engine extracts probe queries from the content's headings and FAQ sections, sends those queries to 2-3 enabled LLM providers, and runs citation detection on each response. The base score is the ratio of citations to total queries. Bonuses apply for positive sentiment and top-3 list positions. Penalties apply when competitors get cited on the same queries you don't.

This component answers the only question that matters: does the AI actually mention you when someone asks a question your content addresses?

**Competitive Gap (30% weight):** Compares your citation rate against competitors across historical probe data. Identifies your top competitor and their citation rate. Produces a gap analysis explaining where you stand and what it would take to close the gap.

The weighting is deliberate. Citation Validation dominates because it is the only component that tests against reality rather than proxy signals. A piece of content can have perfect structural scores (all the right headings, schema markup, keyword density) and still never get cited by any AI engine. The Citation Validation score catches that.

### Competitive Analysis

Citability Engine runs all your probes against all enabled providers, detecting citations for both your brand and every competitor you've configured. It builds competitor profiles:

- **Citation rate** per provider and per probe category
- **Average position** when cited in ranked lists
- **Average sentiment** across all citations
- **Strong categories** where they're cited 60%+ of the time
- **Weak categories** where they're cited less than 20%

From these profiles, the system generates SWOT-style insights: opportunities (queries where no one is cited well), threats (competitors gaining ground), strengths (queries where you dominate), and weaknesses (queries where competitors consistently beat you).

### Content Optimization Loop

This is where the system closes the loop. The optimizer takes:

1. Your current content
2. Citation validation results (which queries succeeded, which failed)
3. Competitor analysis (what patterns work for them)

It rewrites sections to maximize citation likelihood, returns a detailed change log with before/after diffs, labels each change (rewrite, add, restructure, schema), and estimates the score improvement. You can then re-probe to validate whether the changes actually improved citations.

### The Agentic Feedback Loop

This is what separates Citability Engine from a dashboard. Most AEO/GEO tools stop at step 1: probe and display. Citability Engine runs a closed feedback loop:

```
PROBE → SCORE → OPTIMIZE → RE-PROBE → (repeat)
  ↑                                        │
  └────────────────────────────────────────┘
```

**Probe** creates `CitationRun` records with per-provider `CitationResult` data: cited (bool), citation type, sentiment, position, competitor mentions, confidence, full response text.

**Score** runs three autonomous sub-processes. Citation Validation auto-extracts 5 queries from your content's headings and FAQ sections, sends them to 2-3 providers, and checks if the AI cites you — a probe-within-a-probe that validates citability without user input. Competitive Gap compares your citation rate to every configured competitor across all historical runs.

**Optimize** receives the specific queries where you were cited (patterns to preserve) and queries where you were not cited (gaps to close), plus competitor citation patterns. The LLM rewrites sections targeting the gaps.

**Re-Probe** validates whether the optimization worked. New `CitationRun` records enable before/after comparison. The alert engine fires on citation gained, citation lost, competitor surge, or sentiment shift.

**Schedule** via cron for autonomous daily or weekly cycles. The system continuously optimizes toward higher citation rates without manual intervention.

Three nested agentic loops run autonomously:

1. **Citation Validation Loop** — During scoring, auto-extracts queries from content, probes 3 providers, analyzes responses. No user input required.
2. **Competitive Analysis Loop** — For each probe query × each provider × each competitor: queries, detects citations, builds SWOT profiles. Fully parallelized.
3. **Batch Execution Loop** — Runs all active probes across all providers, respects per-provider rate limits (100K tokens/min, $5/day cap), logs API usage, triggers alert checks post-execution.

### Cost Structure

All 5 providers search the live web:

| Provider | Model | Search Backend | Cost per Probe |
|----------|-------|---------------|---------------|
| OpenAI | gpt-4o-mini-search-preview | Bing via `web_search_options` | ~$0.026 |
| Anthropic | claude-3-5-haiku-latest | Brave via `web_search_20250305` | ~$0.015 |
| Google | gemini-2.0-flash | Google Search grounding | ~$0.001 |
| Perplexity | sonar | Multi-index (Bing + Google + own) | ~$0.002 |
| Tavily | tavily-search | AI aggregator (20+ sources) | $0.016 |

A full probe across all 5 providers costs approximately $0.06. Running 10 probes daily costs under $20/month. Content generation and optimization with stronger models (GPT-4o, Claude Sonnet) costs $0.05-0.15 per article.

Compare that to $300/month for a SaaS dashboard. And you get all-search probing across five different search backends — Bing, Brave, Google, multi-index, and aggregated web.

### How AI Engines Find Information to Cite

Understanding the retrieval pipeline is essential for AEO. When ChatGPT, Claude, Gemini, or Perplexity answer a question, they follow a consistent pattern:

**Query → Search Index → Re-rank → Fetch → Generate with Citations**

Each engine uses a different search backend. ChatGPT queries Bing. Claude queries Brave Search. Gemini queries Google's production index and Knowledge Graph. Perplexity queries Bing, Google, and its own crawler index simultaneously. Tavily aggregates from 20+ sources.

The retrieval step is the bottleneck. If your content does not appear in the top 10-20 search results for a query, it has zero chance of being cited — regardless of quality. The LLM cannot cite what it never sees in context.

This creates a five-layer AEO stack:

1. **Crawlability** — Allow AI crawlers (GPTBot, PerplexityBot, Google-Extended) in robots.txt
2. **Indexation** — Domain authority, topical depth, backlinks — same signals that drive traditional SEO
3. **Entity Resolution** — Schema.org JSON-LD markup, Wikipedia/Wikidata presence, consistent naming across sources
4. **Content Structure** — Direct answers, question-matching headers, specific data points
5. **Multi-Engine Presence** — Rank in Bing AND Google AND Brave (covers all AI search backends)

## The Knowledge Graph Connection

Here's the deeper point that the AEO tool market is missing.

AEO success maps directly to how well your content is structured as entities and relationships. Schema markup (JSON-LD), entity consistency across channels, structured FAQ sections, clear entity taxonomy — these are knowledge graph principles applied to content marketing.

When an AI engine decides which brands to cite in a response, it is performing a form of entity resolution and relationship traversal. The model identifies entities in the query ("CRM tools"), retrieves information about those entities from its training data and any available context, evaluates the relationships between entities (brand → category → feature → use case), and selects the entities with the strongest, most consistent relationship signals.

Brands with clear entity structures get cited. Their name, domain, products, and categories are consistent across every source the model has seen. Their content is structured so that the relationship between the brand and the category is unambiguous.

Brands with keyword-stuffed content get ignored. The entity signals are muddled. The relationship between brand and category is diluted across competing signals.

### The Knowledge Graph Layer (KuzuDB)

Citability Engine includes a knowledge graph layer backed by KuzuDB (`src/lib/graph/`) that solves three problems the relational DB cannot handle.

**Entity Resolution Across Providers.** When ChatGPT mentions "Salesforce CRM" and Perplexity mentions "Salesforce Sales Cloud", the relational DB treats these as different strings. The knowledge graph resolves both to the same canonical entity node via `ALIAS_OF` edges. Citation counts become accurate across naming variants.

**Citation Path Analysis.** Every probe result creates a traversable path: `Entity → CITED_IN → Citation → FROM_PROVIDER → Provider`. The `getSearchBackendAnalysis()` method reveals which search backends (Bing, Brave, Google) surface your brand most frequently — a graph traversal, not a SQL join.

**Temporal Tracking.** Each citation event carries a timestamp. The `getCitationTrajectory()` method returns citation rate over time per entity per provider over 30 days. You see whether your visibility is rising or declining across each AI engine.

**Competitive Relationship Mapping.** `COMPETES_WITH` edges connect brands across categories. Traverse the graph to find category-provider pairs where competitors get cited and you don't.

The graph grows automatically. After every probe run, the ingestion bridge (`ingestCitationResult()`) creates entity nodes, citation events, and competitive edges. Each feedback cycle enriches the graph.

### The Architectural Parallel

This is the same principle that drives knowledge graph superiority over vector databases in agent systems. Vector search finds semantically similar chunks. Knowledge graphs find structurally connected entities. When an agent needs to traverse relationships (customer → product → feature → documentation), vectors fail because they index similarity, not structure. When an AI engine needs to identify the right brand for a category, keyword density fails because it measures frequency, not entity clarity.

Structured knowledge wins in agent memory systems. Structured knowledge wins in AI search visibility. The architectural principle is identical.

HubSpot's AEO trends research confirms this: "Entity consistency — maintaining identical information about name, services, pricing, and product categories across all channels — directly impacts entity trust scores and citation likelihood." They recommend implementing schema types (Organization, Product, Service, FAQ) and creating a centralized "Source of Truth" document. That's knowledge graph engineering with different vocabulary.

## Limitations and Honest Assessment

AEO measurement is inherently noisy. LLMs are non-deterministic. The same query to GPT-4o-mini returns different brands on different days. Any tool selling certainty in individual probe results is selling a mirage. What matters is trends over time, averaged across multiple probes and providers.

AEO amplifies existing authority. If you have 5 blog posts and no schema markup, no tool (mine included) will make ChatGPT cite you. AEO works for brands that already have content depth and domain authority. It helps you get credit for what you already know.

Regulated industries face structural ceilings. AI engines deliberately avoid specific recommendations in healthcare, finance, and legal domains. AEO metrics in these sectors may be capped regardless of optimization effort.

The AEO SaaS market is a land grab for what is fundamentally a commodity capability. The value should be in the optimization loop (how to improve citations), not the measurement layer (checking if you appear). Citability Engine provides both — with all 5 providers searching the live web — and the measurement layer is free.

## Getting Started

```bash
git clone https://github.com/AnthonyAlcaraz/citability-engine.git
cd citability-engine
npm install
```

Add at least one provider API key to `.env`:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="AI..."
PERPLEXITY_API_KEY="pplx-..."
TAVILY_API_KEY="tvly-..."
```

Initialize and run:

```bash
npx prisma db push
npm run dev
```

Open `http://localhost:3000`. The onboarding wizard walks you through brand setup, provider configuration, probe creation, and your first citation check.

The architecture is Next.js 15, React 19, TypeScript, Tailwind CSS, Prisma ORM with SQLite (swappable to PostgreSQL), and Zod validation across all 22 API routes. Five search-enabled providers out of the box. The full tech stack is documented in the README.

---

## Resource Guide

### Research & Data

| Source | Key Finding | Link |
|--------|------------|------|
| Gartner | 25% drop in traditional search by 2026 | [gartner.com](https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-25-percent-decrease-in-traditional-search-volume-by-2026) |
| Princeton GEO Study | GEO techniques boost AI visibility up to 40% | [arxiv.org](https://arxiv.org/abs/2311.09735) |
| HubSpot Consumer Trends | 72% of users will use AI search more; 4.4x conversion rate from AI traffic | [hubspot.com](https://blog.hubspot.com/marketing/answer-engine-optimization-trends) |
| Semrush | AI traffic converts 4.4x better than organic; 527% YoY growth | [semrush.com](https://www.semrush.com/) |

### AEO/GEO Tools Landscape

| Tool | Focus | Link |
|------|-------|------|
| HubSpot AEO Grader | Free brand visibility benchmark across LLMs | [hubspot.com](https://www.hubspot.com/aeo-grader) |
| Profound | 10+ AI engine monitoring, AEO+GEO unified | [tryprofound.com](https://www.tryprofound.com) |
| OtterlyAI | AI search monitoring for 15K+ professionals | [otterly.ai](https://otterly.ai) |
| Finseo | Real-time visibility tracking + sentiment | [finseo.ai](https://www.finseo.ai) |
| Citability Engine | Open source, self-hosted, 5 search-enabled providers, AEO+GEO scoring | [github.com](https://github.com/AnthonyAlcaraz/citability-engine) |

### Search API Providers (Used by Citability Engine)

| Provider | Search Backend | Type | Link |
|----------|---------------|------|------|
| OpenAI | Bing | LLM + search via `web_search_options` | [platform.openai.com](https://platform.openai.com/docs) |
| Anthropic | Brave Search | LLM + search via `web_search_20250305` tool | [docs.anthropic.com](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool) |
| Google | Google Search | LLM + grounding via `googleSearchRetrieval` | [ai.google.dev](https://ai.google.dev/gemini-api/docs) |
| Perplexity | Bing + Google + own index | Search-native LLM | [docs.perplexity.ai](https://docs.perplexity.ai) |
| Tavily | 20+ aggregated sources | AI search aggregator | [tavily.com](https://tavily.com) |

### GitHub Repositories

| Repository | Purpose | Link |
|------------|---------|------|
| Citability Engine | Self-hosted AEO/GEO platform with 3-component scoring | [github.com/AnthonyAlcaraz/citability-engine](https://github.com/AnthonyAlcaraz/citability-engine) |

### Books

| Title | Author | Relevance | Link |
|-------|--------|-----------|------|
| Agentic Graph RAG | Anthony Alcaraz | Knowledge graph architectures — same structural principles that drive AEO | [O'Reilly](https://www.oreilly.com/library/view/agentic-graph-rag/9798341623163/) |

### Key Articles

| Article | Source | Link |
|---------|--------|------|
| AEO Trends in 2026 | HubSpot Blog | [hubspot.com](https://blog.hubspot.com/marketing/answer-engine-optimization-trends) |
| GEO vs AEO: What's the Difference? | Neil Patel | [neilpatel.com](https://neilpatel.com/blog/geo-vs-aeo/) |
| AEO vs GEO: Why They're the Same Thing | Profound | [tryprofound.com](https://www.tryprofound.com/blog/aeo-vs-geo) |
| Complete Guide to SEO vs AEO vs GEO | Ladybugz | [ladybugz.com](https://www.ladybugz.com/seo-aeo-geo-guide-2026/) |
| AEO vs GEO: Differences and Use Cases | Wellows | [wellows.com](https://wellows.com/blog/aeo-vs-geo/) |
| Best AEO Tracking Tools 2026 | AI Clicks | [aiclicks.io](https://aiclicks.io/blog/best-aeo-tracking-tools) |
| AI Citation Tracking Guide 2026 | Averi AI | [averi.ai](https://www.averi.ai/how-to/how-to-track-ai-citations-and-measure-geo-success-the-2026-metrics-guide) |

---

## Sources

This analysis drew from the following vault notes and external sources:

### Vault Notes Consulted
- [[Agentic Graph Book/_meta.md]] — Book thesis: structured knowledge > statistical similarity; agents as nodes in knowledge graphs
- [[Chapter 3 - Knowledge & Memory/_meta.md]] — Knowledge graphs as connective tissue; GraphRAG; entity resolution; ontological modeling

### External Sources
- [Gartner: 25% Search Volume Decline Prediction](https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-25-percent-decrease-in-traditional-search-volume-by-2026)
- [HubSpot AEO Trends 2026](https://blog.hubspot.com/marketing/answer-engine-optimization-trends)
- [Princeton GEO Research](https://arxiv.org/abs/2311.09735)
- [HubSpot AEO Grader](https://www.hubspot.com/aeo-grader)
- [Profound: AEO vs GEO](https://www.tryprofound.com/blog/aeo-vs-geo)
- [Wellows: AEO vs GEO Differences](https://wellows.com/blog/aeo-vs-geo/)
- [Ladybugz: Complete SEO vs AEO vs GEO Guide](https://www.ladybugz.com/seo-aeo-geo-guide-2026/)
- [OtterlyAI](https://otterly.ai)
- [Finseo](https://www.finseo.ai)
- [Anthropic Web Search API](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool)
- [Tavily AI Search API](https://tavily.com)
- [AI Clicks: Best AEO Tools](https://aiclicks.io/blog/best-aeo-tracking-tools)

*Total sources: 2 vault notes, 12 external references*
