AEO tools charge $300/month to show you a dashboard.
I built a self-improving agentic system that closes the loop for $2/month in API costs.

Most AEO/GEO tools probe an LLM, check if your brand appears, display a number. That is step 1 of 4. The system stops there. It never acts on the data. You stare at a dashboard, then manually rewrite content, then manually re-check. The feedback loop stays open.

AEO Engine closes it. The system probes, scores, optimizes, and re-probes autonomously. Each cycle feeds the next. Content improves without human intervention.

The self-improving loop:

1. PROBE: 5 providers search the live web. OpenAI (Bing), Claude (Brave), Gemini (Google), Perplexity (multi-index), Tavily (20+ sources). Every answer draws from real search indexes.

2. SCORE: Citation Validation (50%) auto-extracts queries from your content, sends them to 3 providers, checks if they cite you. Competitive Gap (30%) benchmarks you against competitors per query per provider. Structural (20%) checks extraction readiness.

3. OPTIMIZE: The optimizer receives what worked (preserve) and what failed (fix). It sees competitor citation patterns. Rewrites sections, returns diffs, estimates score improvement.

4. RE-PROBE: Fresh probes validate the optimized content. The alert engine fires on citation gained, citation lost, competitor surge, sentiment shift. Schedule via cron. The cycle repeats autonomously.

Each cycle produces data that makes the next cycle better. Queries that earn citations get preserved. Gaps get targeted. Competitor strategies get tracked across time.

Three nested agentic loops: citation validation auto-probes during scoring, competitive analysis runs head-to-head per query per provider, batch execution parallelizes across all probes with rate limiting and alert triggers.

The knowledge graph layer (KuzuDB) handles entity resolution across providers. When ChatGPT says "Salesforce CRM" and Perplexity says "Salesforce Sales Cloud", the graph resolves both to the same entity node. Citation path analysis tracks Entity to Citation to Provider to Search Backend. Temporal tracking shows citation trajectory over 30 days per entity per provider.

AI engines already do entity resolution and relationship traversal to decide what to cite. The system mirrors that reasoning to predict and improve citability.

The repo: github.com/AnthonyAlcaraz/aeo-engine

**Resources:**
- Agentic Graph RAG (O'Reilly): oreilly.com/library/view/agentic-graph-rag/9798341623163/
- AEO Engine: github.com/AnthonyAlcaraz/aeo-engine
- Princeton GEO Research: arxiv.org/abs/2311.09735
- HubSpot AEO Trends 2026: blog.hubspot.com/marketing/answer-engine-optimization-trends
