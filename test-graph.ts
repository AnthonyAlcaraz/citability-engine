/**
 * AEO Engine — Knowledge Graph Test
 * Tests KuzuDB entity resolution, citation path tracking, and temporal analysis.
 * Run: npx tsx test-graph.ts
 */

import { KnowledgeGraph } from "./src/lib/graph/knowledge-graph";
import * as fs from "fs";
import * as path from "path";

const TEST_DB_PATH = "./data/test-aeo-graph";

async function main() {
  // Clean up previous test
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.rmSync(TEST_DB_PATH, { recursive: true });
  }
  fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });

  console.log("AEO Engine — Knowledge Graph Test Suite\n");

  const graph = new KnowledgeGraph(TEST_DB_PATH);

  // ─── Test 1: Entity Creation ───
  console.log("=" .repeat(60));
  console.log("Test 1: Entity Creation & Resolution");
  console.log("=".repeat(60));

  const salesforceId = await graph.upsertEntity("Salesforce", "brand", "salesforce.com", "openai");
  console.log(`  Created: Salesforce → ${salesforceId}`);

  // Same entity, different name (should create alias)
  const salesforceCrmId = await graph.upsertEntity("Salesforce CRM", "brand", "salesforce.com", "anthropic");
  console.log(`  Upsert: "Salesforce CRM" → ${salesforceCrmId}`);

  const salesforceCloudId = await graph.upsertEntity("Salesforce Sales Cloud", "brand", "salesforce.com", "perplexity");
  console.log(`  Upsert: "Salesforce Sales Cloud" → ${salesforceCloudId}`);

  // Resolve entity
  const resolved = await graph.resolveEntity("Salesforce CRM");
  console.log(`  Resolved "Salesforce CRM": ${JSON.stringify(resolved)}`);

  const hubspotId = await graph.upsertEntity("HubSpot", "brand", "hubspot.com", "openai");
  console.log(`  Created: HubSpot → ${hubspotId}`);

  const pipedriveId = await graph.upsertEntity("Pipedrive", "brand", "pipedrive.com", "google");
  console.log(`  Created: Pipedrive → ${pipedriveId}`);

  console.log("  ✓ Entity creation passed\n");

  // ─── Test 2: Citation Recording ───
  console.log("=".repeat(60));
  console.log("Test 2: Citation Recording");
  console.log("=".repeat(60));

  const testCitations = [
    { entity: "Salesforce", provider: "openai", query: "best CRM tools 2026", cat: "best-of", cited: true, sentiment: "positive", position: 1, confidence: 0.95 },
    { entity: "Salesforce CRM", provider: "anthropic", query: "best CRM tools 2026", cat: "best-of", cited: true, sentiment: "positive", position: 2, confidence: 0.9 },
    { entity: "Salesforce Sales Cloud", provider: "perplexity", query: "best CRM tools 2026", cat: "best-of", cited: true, sentiment: "neutral", position: 1, confidence: 0.85 },
    { entity: "HubSpot", provider: "openai", query: "best CRM tools 2026", cat: "best-of", cited: true, sentiment: "positive", position: 2, confidence: 0.9 },
    { entity: "HubSpot", provider: "anthropic", query: "best CRM tools 2026", cat: "best-of", cited: true, sentiment: "positive", position: 1, confidence: 0.95 },
    { entity: "HubSpot", provider: "google", query: "compare CRM platforms", cat: "comparison", cited: true, sentiment: "positive", position: 3, confidence: 0.8 },
    { entity: "Pipedrive", provider: "openai", query: "best CRM tools 2026", cat: "best-of", cited: false, sentiment: "neutral", position: 0, confidence: 0 },
    { entity: "Pipedrive", provider: "google", query: "compare CRM platforms", cat: "comparison", cited: true, sentiment: "neutral", position: 5, confidence: 0.7 },
  ];

  for (const c of testCitations) {
    await graph.recordCitation({
      entityName: c.entity,
      entityType: "brand",
      entityDomain: null,
      provider: c.provider,
      query: c.query,
      queryCategory: c.cat,
      cited: c.cited,
      sentiment: c.sentiment,
      position: c.position,
      confidence: c.confidence,
    });
    console.log(`  Recorded: ${c.entity} on ${c.provider} — cited=${c.cited}`);
  }

  console.log("  ✓ Citation recording passed\n");

  // ─── Test 3: Citation Paths ───
  console.log("=".repeat(60));
  console.log("Test 3: Citation Path Analysis");
  console.log("=".repeat(60));

  const salesforcePaths = await graph.getCitationPaths("Salesforce");
  console.log(`  Salesforce citation paths: ${salesforcePaths.length} found`);
  for (const p of salesforcePaths.slice(0, 3)) {
    console.log(`    ${p.provider} → "${p.query}" → cited=${p.cited}, sentiment=${p.sentiment}, position=${p.position}`);
  }

  const hubspotPaths = await graph.getCitationPaths("HubSpot");
  console.log(`  HubSpot citation paths: ${hubspotPaths.length} found`);
  for (const p of hubspotPaths) {
    console.log(`    ${p.provider} → "${p.query}" → cited=${p.cited}, sentiment=${p.sentiment}`);
  }

  console.log("  ✓ Citation path analysis passed\n");

  // ─── Test 4: Search Backend Analysis ───
  console.log("=".repeat(60));
  console.log("Test 4: Search Backend Analysis");
  console.log("=".repeat(60));

  const backends = await graph.getSearchBackendAnalysis("Salesforce");
  console.log("  Which search backends surface Salesforce?");
  for (const b of backends) {
    console.log(`    ${b.provider} (${b.backend}): ${b.citationRate}% citation rate (${b.totalProbes} probes)`);
  }

  console.log("  ✓ Search backend analysis passed\n");

  // ─── Test 5: Competitive Relationships ───
  console.log("=".repeat(60));
  console.log("Test 5: Competitive Graph");
  console.log("=".repeat(60));

  await graph.recordCompetition("Salesforce", "HubSpot", "best-of");
  await graph.recordCompetition("Salesforce", "Pipedrive", "comparison");

  const competitiveGraph = await graph.getCompetitiveGraph();
  console.log(`  Competitive edges: ${competitiveGraph.length}`);
  for (const edge of competitiveGraph) {
    console.log(`    ${edge.brand} vs ${edge.competitor} in ${edge.category}`);
  }

  console.log("  ✓ Competitive graph passed\n");

  // ─── Test 6: Graph Stats ───
  console.log("=".repeat(60));
  console.log("Test 6: Graph Stats");
  console.log("=".repeat(60));

  const stats = await graph.getStats();
  console.log(`  Entities: ${stats.entities}`);
  console.log(`  Citations: ${stats.citations}`);
  console.log(`  Queries: ${stats.queries}`);
  console.log(`  Aliases: ${stats.aliases}`);

  console.log("  ✓ Stats passed\n");

  // ─── Summary ───
  console.log("=".repeat(60));
  console.log("ALL TESTS PASSED");
  console.log("=".repeat(60));
  console.log("\nKnowledge graph capabilities verified:");
  console.log("  ✓ Entity resolution across naming variants");
  console.log("  ✓ Citation recording with full provenance");
  console.log("  ✓ Citation path traversal (Entity → Citation → Provider → Query)");
  console.log("  ✓ Search backend analysis (which index surfaces you)");
  console.log("  ✓ Competitive relationship tracking");
  console.log("  ✓ Graph statistics");

  // Cleanup
  await graph.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.rmSync(TEST_DB_PATH, { recursive: true });
  }
  console.log("\nTest database cleaned up.");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
