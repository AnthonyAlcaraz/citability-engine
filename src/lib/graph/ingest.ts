/**
 * Graph Ingestion — Bridges citation detection results into the knowledge graph.
 *
 * After every probe run, citation results flow into KuzuDB:
 *   CitationResult → Entity nodes + Citation events + Provider edges
 *
 * This creates the feedback loop:
 *   Probe → Detect → Ingest → Graph → Analyze → Optimize → Re-probe
 */

import { getKnowledgeGraph } from "./knowledge-graph";
import type { CitationAnalysis } from "@/lib/citation/detector";

interface CitationResultInput {
  brandName: string;
  brandDomain: string;
  provider: string;
  query: string;
  queryCategory: string;
  citation: CitationAnalysis;
  competitorsCited: Array<{
    name: string;
    domain: string;
    citation: CitationAnalysis;
  }>;
}

/**
 * Ingest a single citation result into the knowledge graph.
 * Called after each probe execution completes.
 */
export async function ingestCitationResult(
  result: CitationResultInput
): Promise<void> {
  const graph = getKnowledgeGraph();

  // Record brand citation
  await graph.recordCitation({
    entityName: result.brandName,
    entityType: "brand",
    entityDomain: result.brandDomain,
    provider: result.provider,
    query: result.query,
    queryCategory: result.queryCategory,
    cited: result.citation.cited,
    sentiment: result.citation.sentiment ?? "neutral",
    position: result.citation.position ?? 0,
    confidence: result.citation.confidence,
  });

  // Record competitor citations
  for (const competitor of result.competitorsCited) {
    await graph.recordCitation({
      entityName: competitor.name,
      entityType: "brand",
      entityDomain: competitor.domain,
      provider: result.provider,
      query: result.query,
      queryCategory: result.queryCategory,
      cited: competitor.citation.cited,
      sentiment: competitor.citation.sentiment ?? "neutral",
      position: competitor.citation.position ?? 0,
      confidence: competitor.citation.confidence,
    });

    // Record competitive relationship
    if (competitor.citation.cited || result.citation.cited) {
      await graph.recordCompetition(
        result.brandName,
        competitor.name,
        result.queryCategory
      );
    }
  }
}

/**
 * Ingest a full competitive analysis into the graph.
 * Called after runCompetitiveAnalysis completes.
 */
export async function ingestCompetitiveAnalysis(
  brandName: string,
  brandDomain: string,
  competitors: Array<{ name: string; domain: string }>,
  probeResults: Array<{
    query: string;
    category: string;
    provider: string;
    brandCitation: CitationAnalysis;
    competitorCitations: Map<string, CitationAnalysis>;
  }>
): Promise<void> {
  const graph = getKnowledgeGraph();

  for (const result of probeResults) {
    // Ingest brand citation
    await graph.recordCitation({
      entityName: brandName,
      entityType: "brand",
      entityDomain: brandDomain,
      provider: result.provider,
      query: result.query,
      queryCategory: result.category,
      cited: result.brandCitation.cited,
      sentiment: result.brandCitation.sentiment ?? "neutral",
      position: result.brandCitation.position ?? 0,
      confidence: result.brandCitation.confidence,
    });

    // Ingest each competitor
    for (const competitor of competitors) {
      const citation = result.competitorCitations.get(competitor.name);
      if (!citation) continue;

      await graph.recordCitation({
        entityName: competitor.name,
        entityType: "brand",
        entityDomain: competitor.domain,
        provider: result.provider,
        query: result.query,
        queryCategory: result.category,
        cited: citation.cited,
        sentiment: citation.sentiment ?? "neutral",
        position: citation.position ?? 0,
        confidence: citation.confidence,
      });

      await graph.recordCompetition(brandName, competitor.name, result.category);
    }
  }
}
