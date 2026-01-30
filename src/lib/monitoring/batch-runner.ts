import { prisma } from "@/lib/db";
import { queryLLM, getEnabledProviders } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm";
import { buildProbePrompt } from "@/lib/citation/prompt-builder";
import type { ProbeCategory } from "@/lib/citation/prompt-builder";
import { detectCitation } from "@/lib/citation/detector";
import { canMakeRequest, recordUsage } from "@/lib/monitoring/rate-limiter";
import { runAlertChecks } from "@/lib/monitoring/alert-engine";

export interface BatchRunResult {
  totalProbes: number;
  completed: number;
  failed: number;
  skipped: number;
  totalCost: number;
  duration: number;
  errors: Array<{ probeId: string; error: string }>;
}

interface ProbeWithBrand {
  id: string;
  brandId: string;
  query: string;
  category: string;
  brand: {
    name: string;
    domain: string;
    competitors: string;
  };
}

async function executeProbeForProvider(
  probe: ProbeWithBrand,
  provider: LLMProvider,
  runId: string
): Promise<{ cost: number }> {
  const prompt = buildProbePrompt(
    probe.query,
    probe.category as ProbeCategory
  );

  const llmResponse = await queryLLM({
    provider,
    prompt,
  });

  const competitors: Array<{ name: string; domain: string }> = JSON.parse(
    probe.brand.competitors
  );

  const citation = detectCitation(
    llmResponse.text,
    probe.brand.name,
    probe.brand.domain,
    competitors
  );

  await prisma.citationResult.create({
    data: {
      runId,
      provider,
      model: llmResponse.model,
      response: llmResponse.text,
      cited: citation.cited,
      citationType: citation.citationType,
      sentiment: citation.sentiment,
      position: citation.position,
      competitorsMentioned: JSON.stringify(citation.competitorsMentioned),
      confidence: citation.confidence,
      latencyMs: llmResponse.latencyMs,
      tokensUsed: llmResponse.tokensIn + llmResponse.tokensOut,
      cost: llmResponse.cost,
    },
  });

  // Record usage for rate limiting
  recordUsage(
    provider,
    llmResponse.tokensIn + llmResponse.tokensOut,
    llmResponse.cost
  );

  // Log to API usage table
  await prisma.apiUsageLog.create({
    data: {
      provider,
      model: llmResponse.model,
      endpoint: "chat/completions",
      tokensIn: llmResponse.tokensIn,
      tokensOut: llmResponse.tokensOut,
      cost: llmResponse.cost,
      latencyMs: llmResponse.latencyMs,
    },
  });

  return { cost: llmResponse.cost };
}

export async function runBatchProbes(
  brandId?: string,
  probeIds?: string[],
  providers?: LLMProvider[]
): Promise<BatchRunResult> {
  const startTime = Date.now();
  const result: BatchRunResult = {
    totalProbes: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    totalCost: 0,
    duration: 0,
    errors: [],
  };

  // Build filter for probes query
  const whereClause: Record<string, unknown> = { isActive: true };
  if (brandId) {
    whereClause.brandId = brandId;
  }
  if (probeIds && probeIds.length > 0) {
    whereClause.id = { in: probeIds };
  }

  const probes = await prisma.probe.findMany({
    where: whereClause,
    include: {
      brand: {
        select: {
          name: true,
          domain: true,
          competitors: true,
        },
      },
    },
  });

  result.totalProbes = probes.length;

  const activeProviders = providers ?? getEnabledProviders();
  if (activeProviders.length === 0) {
    result.duration = Date.now() - startTime;
    return result;
  }

  // Track which brands had probes run (for alert checks)
  const brandIdsProcessed = new Set<string>();

  for (const probe of probes) {
    // Determine which providers can be used for this probe
    const availableProviders = activeProviders.filter((p) =>
      canMakeRequest(p)
    );

    if (availableProviders.length === 0) {
      result.skipped++;
      continue;
    }

    // Create a CitationRun for this probe
    const citationRun = await prisma.citationRun.create({
      data: {
        brandId: probe.brandId,
        probeId: probe.id,
        status: "running",
      },
    });

    let probeSucceeded = false;

    for (const provider of availableProviders) {
      // Re-check rate limits before each provider call
      if (!canMakeRequest(provider)) {
        continue;
      }

      try {
        const { cost } = await executeProbeForProvider(
          probe as ProbeWithBrand,
          provider,
          citationRun.id
        );
        result.totalCost += cost;
        probeSucceeded = true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push({
          probeId: probe.id,
          error: `${provider}: ${errorMessage}`,
        });
      }
    }

    // Update run status
    await prisma.citationRun.update({
      where: { id: citationRun.id },
      data: {
        status: probeSucceeded ? "completed" : "failed",
        endedAt: new Date(),
      },
    });

    if (probeSucceeded) {
      result.completed++;
    } else {
      result.failed++;
    }

    brandIdsProcessed.add(probe.brandId);
  }

  // Run alert checks for all brands that had probes executed
  const alertPromises = Array.from(brandIdsProcessed).map((bid) =>
    runAlertChecks(bid).catch(() => {
      // Alert check failures should not break the batch run
    })
  );
  await Promise.all(alertPromises);

  result.duration = Date.now() - startTime;
  return result;
}

export async function runSingleProbe(
  probeId: string,
  providers?: LLMProvider[]
): Promise<{ runId: string; results: number; cost: number }> {
  const probe = await prisma.probe.findUnique({
    where: { id: probeId },
    include: {
      brand: {
        select: {
          name: true,
          domain: true,
          competitors: true,
        },
      },
    },
  });

  if (!probe) {
    throw new Error(`Probe not found: ${probeId}`);
  }

  const activeProviders = providers ?? getEnabledProviders();
  if (activeProviders.length === 0) {
    throw new Error("No LLM providers are enabled or configured.");
  }

  const citationRun = await prisma.citationRun.create({
    data: {
      brandId: probe.brandId,
      probeId: probe.id,
      status: "running",
    },
  });

  let totalCost = 0;
  let resultCount = 0;
  let hasSuccess = false;

  for (const provider of activeProviders) {
    if (!canMakeRequest(provider)) {
      continue;
    }

    try {
      const { cost } = await executeProbeForProvider(
        probe as ProbeWithBrand,
        provider,
        citationRun.id
      );
      totalCost += cost;
      resultCount++;
      hasSuccess = true;
    } catch {
      // Individual provider failures are acceptable in single probe runs
    }
  }

  await prisma.citationRun.update({
    where: { id: citationRun.id },
    data: {
      status: hasSuccess ? "completed" : "failed",
      endedAt: new Date(),
    },
  });

  // Run alert checks for the brand
  await runAlertChecks(probe.brandId).catch(() => {
    // Non-critical
  });

  return {
    runId: citationRun.id,
    results: resultCount,
    cost: totalCost,
  };
}
