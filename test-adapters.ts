/**
 * Citability Engine Adapter Test Script
 * Tests each provider adapter with real API calls where keys are available.
 * Run: npx tsx test-adapters.ts
 */

import "dotenv/config";
import { queryLLM, getEnabledProviders, type LLMProvider, type LLMResponse } from "./src/lib/llm/index";

const TEST_PROMPT = "What are the best open source CRM tools in 2026? List your top 3 with brief descriptions.";

async function testProvider(provider: LLMProvider): Promise<{ provider: string; success: boolean; response?: LLMResponse; error?: string }> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${provider.toUpperCase()}`);
  console.log("=".repeat(60));

  try {
    const start = Date.now();
    const response = await queryLLM({
      provider,
      prompt: TEST_PROMPT,
      maxTokens: 512,
    });
    const elapsed = Date.now() - start;

    console.log(`✓ SUCCESS (${elapsed}ms)`);
    console.log(`  Model: ${response.model}`);
    console.log(`  Tokens: ${response.tokensIn} in / ${response.tokensOut} out`);
    console.log(`  Cost: $${response.cost.toFixed(4)}`);
    console.log(`  Latency: ${response.latencyMs}ms`);
    console.log(`  Response preview: ${response.text.substring(0, 200)}...`);

    // Check for search indicators
    const hasUrls = /https?:\/\//.test(response.text);
    const hasCitations = /\[\d+\]|\[source/i.test(response.text);
    console.log(`  Has URLs in response: ${hasUrls}`);
    console.log(`  Has citation markers: ${hasCitations}`);

    return { provider, success: true, response };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`✗ FAILED: ${msg}`);
    return { provider, success: false, error: msg };
  }
}

async function main() {
  console.log("Citability Engine — Adapter Test Suite");
  console.log(`Test prompt: "${TEST_PROMPT}"`);

  // Check which providers are enabled
  const enabled = getEnabledProviders();
  console.log(`\nEnabled providers (API keys found): ${enabled.length > 0 ? enabled.join(", ") : "NONE"}`);

  const allProviders: LLMProvider[] = ["openai", "anthropic", "google", "perplexity", "tavily"];
  const disabled = allProviders.filter(p => !enabled.includes(p));
  if (disabled.length > 0) {
    console.log(`Disabled providers (no API key): ${disabled.join(", ")}`);
  }

  if (enabled.length === 0) {
    console.log("\n⚠ No API keys found. Set at least one in .env:");
    console.log("  OPENAI_API_KEY=sk-...");
    console.log("  ANTHROPIC_API_KEY=sk-ant-...");
    console.log("  GOOGLE_API_KEY=AI...");
    console.log("  PERPLEXITY_API_KEY=pplx-...");
    console.log("  TAVILY_API_KEY=tvly-...");
    process.exit(1);
  }

  // Test each enabled provider
  const results = [];
  for (const provider of enabled) {
    const result = await testProvider(provider);
    results.push(result);
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Passed: ${passed.length}/${results.length}`);
  passed.forEach(r => {
    const resp = r.response!;
    console.log(`  ✓ ${r.provider}: ${resp.model} — $${resp.cost.toFixed(4)} — ${resp.latencyMs}ms`);
  });

  if (failed.length > 0) {
    console.log(`Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => console.log(`  ✗ ${r.provider}: ${r.error}`));
  }

  // Total cost
  const totalCost = passed.reduce((sum, r) => sum + (r.response?.cost ?? 0), 0);
  console.log(`\nTotal test cost: $${totalCost.toFixed(4)}`);

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(console.error);
