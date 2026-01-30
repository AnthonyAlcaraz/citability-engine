import { prisma } from "@/lib/db";
import type { Alert } from "@prisma/client";

export type AlertType =
  | "citation-gained"
  | "citation-lost"
  | "competitor-surge"
  | "sentiment-drop"
  | "score-drop"
  | "cost-spike";

export interface AlertConfig {
  citationLostThreshold: number;
  sentimentDropThreshold: number;
  costSpikeThreshold: number;
  competitorSurgeThreshold: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  citationLostThreshold: 3,
  sentimentDropThreshold: 30,
  costSpikeThreshold: 10,
  competitorSurgeThreshold: 20,
};

// ── Helpers ──────────────────────────────────────────────────────────────

async function createAlert(
  brandId: string,
  type: AlertType,
  message: string,
  details: Record<string, unknown>
): Promise<void> {
  await prisma.alert.create({
    data: {
      brandId,
      type,
      message,
      data: JSON.stringify(details),
    },
  });
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ── Individual checks ────────────────────────────────────────────────────

async function checkCitationLost(
  brandId: string,
  threshold: number
): Promise<void> {
  // Get probes for this brand
  const probes = await prisma.probe.findMany({
    where: { brandId, isActive: true },
    select: { id: true, query: true },
  });

  for (const probe of probes) {
    // Get the last N runs for this probe, ordered newest first
    const recentRuns = await prisma.citationRun.findMany({
      where: { probeId: probe.id, status: "completed" },
      orderBy: { startedAt: "desc" },
      take: threshold + 1,
      include: {
        results: {
          select: { cited: true },
        },
      },
    });

    if (recentRuns.length < threshold + 1) {
      continue; // Not enough history to evaluate
    }

    // Check if the oldest run (index = threshold) had at least one citation
    const olderRun = recentRuns[threshold];
    const wasCitedBefore = olderRun.results.some((r) => r.cited);

    if (!wasCitedBefore) {
      continue; // Was never cited, nothing lost
    }

    // Check if the last `threshold` runs all lack citations
    const recentRunsSlice = recentRuns.slice(0, threshold);
    const allMissed = recentRunsSlice.every(
      (run) => !run.results.some((r) => r.cited)
    );

    if (allMissed) {
      // Check we haven't already alerted for this probe recently (last 24h)
      const existingAlert = await prisma.alert.findFirst({
        where: {
          brandId,
          type: "citation-lost",
          createdAt: { gte: daysAgo(1) },
          data: { contains: probe.id },
        },
      });

      if (!existingAlert) {
        await createAlert(brandId, "citation-lost", `Citation lost for probe: "${probe.query}" — not cited in last ${threshold} consecutive runs.`, {
          probeId: probe.id,
          probeQuery: probe.query,
          consecutiveMisses: threshold,
        });
      }
    }
  }
}

async function checkCitationGained(brandId: string): Promise<void> {
  const probes = await prisma.probe.findMany({
    where: { brandId, isActive: true },
    select: { id: true, query: true },
  });

  for (const probe of probes) {
    const recentRuns = await prisma.citationRun.findMany({
      where: { probeId: probe.id, status: "completed" },
      orderBy: { startedAt: "desc" },
      take: 2,
      include: {
        results: {
          select: { cited: true },
        },
      },
    });

    if (recentRuns.length < 2) {
      continue;
    }

    const [latestRun, previousRun] = recentRuns;
    const isCitedNow = latestRun.results.some((r) => r.cited);
    const wasCitedBefore = previousRun.results.some((r) => r.cited);

    if (isCitedNow && !wasCitedBefore) {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          brandId,
          type: "citation-gained",
          createdAt: { gte: daysAgo(1) },
          data: { contains: probe.id },
        },
      });

      if (!existingAlert) {
        await createAlert(brandId, "citation-gained", `New citation detected for probe: "${probe.query}"`, {
          probeId: probe.id,
          probeQuery: probe.query,
        });
      }
    }
  }
}

async function checkCompetitorSurge(
  brandId: string,
  threshold: number
): Promise<void> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { competitors: true },
  });

  if (!brand) return;

  const competitors: Array<{ name: string; domain: string }> = JSON.parse(
    brand.competitors
  );

  if (competitors.length === 0) return;

  const now = new Date();
  const sevenDaysAgo = daysAgo(7);
  const fourteenDaysAgo = daysAgo(14);

  // Get results from last 7 days
  const recentResults = await prisma.citationResult.findMany({
    where: {
      run: { brandId, status: "completed" },
      createdAt: { gte: sevenDaysAgo },
    },
    select: { competitorsMentioned: true },
  });

  // Get results from 7-14 days ago
  const previousResults = await prisma.citationResult.findMany({
    where: {
      run: { brandId, status: "completed" },
      createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
    },
    select: { competitorsMentioned: true },
  });

  if (previousResults.length === 0) return;

  // Count competitor mentions in each period
  const countMentions = (
    results: Array<{ competitorsMentioned: string | null }>,
    competitorName: string
  ): number => {
    let count = 0;
    for (const result of results) {
      if (!result.competitorsMentioned) continue;
      const mentioned: string[] = JSON.parse(result.competitorsMentioned);
      if (mentioned.includes(competitorName)) {
        count++;
      }
    }
    return count;
  };

  for (const competitor of competitors) {
    const recentCount = countMentions(recentResults, competitor.name);
    const previousCount = countMentions(previousResults, competitor.name);

    if (previousCount === 0) continue;

    const recentRate = (recentCount / recentResults.length) * 100;
    const previousRate = (previousCount / previousResults.length) * 100;
    const increase = recentRate - previousRate;

    if (increase >= threshold) {
      const existingAlert = await prisma.alert.findFirst({
        where: {
          brandId,
          type: "competitor-surge",
          createdAt: { gte: daysAgo(1) },
          data: { contains: competitor.name },
        },
      });

      if (!existingAlert) {
        await createAlert(brandId, "competitor-surge", `Competitor "${competitor.name}" citation rate increased by ${increase.toFixed(1)}% over the last 7 days.`, {
          competitorName: competitor.name,
          recentRate: Math.round(recentRate * 10) / 10,
          previousRate: Math.round(previousRate * 10) / 10,
          increasePercent: Math.round(increase * 10) / 10,
        });
      }
    }
  }
}

async function checkSentimentDrop(
  brandId: string,
  threshold: number
): Promise<void> {
  const sevenDaysAgo = daysAgo(7);

  const recentResults = await prisma.citationResult.findMany({
    where: {
      run: { brandId, status: "completed" },
      cited: true,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { sentiment: true },
  });

  if (recentResults.length === 0) return;

  const negativeCount = recentResults.filter(
    (r) => r.sentiment === "negative"
  ).length;
  const negativePercent = (negativeCount / recentResults.length) * 100;

  if (negativePercent >= threshold) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        brandId,
        type: "sentiment-drop",
        createdAt: { gte: daysAgo(1) },
      },
    });

    if (!existingAlert) {
      await createAlert(brandId, "sentiment-drop", `Negative sentiment at ${negativePercent.toFixed(1)}% over last 7 days (threshold: ${threshold}%).`, {
        negativePercent: Math.round(negativePercent * 10) / 10,
        totalResults: recentResults.length,
        negativeCount,
      });
    }
  }
}

async function checkCostSpike(
  brandId: string,
  threshold: number
): Promise<void> {
  const todayStart = startOfToday();

  const todayCosts = await prisma.apiUsageLog.aggregate({
    _sum: { cost: true },
    where: {
      createdAt: { gte: todayStart },
    },
  });

  const totalCost = todayCosts._sum.cost ?? 0;

  if (totalCost >= threshold) {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        brandId,
        type: "cost-spike",
        createdAt: { gte: todayStart },
      },
    });

    if (!existingAlert) {
      await createAlert(brandId, "cost-spike", `Daily API cost has reached $${totalCost.toFixed(2)} (threshold: $${threshold}).`, {
        totalCost: Math.round(totalCost * 100) / 100,
        threshold,
      });
    }
  }
}

// ── Main entry point ─────────────────────────────────────────────────────

export async function runAlertChecks(
  brandId: string,
  config?: Partial<AlertConfig>
): Promise<void> {
  const mergedConfig: AlertConfig = { ...DEFAULT_CONFIG, ...config };

  await Promise.all([
    checkCitationLost(brandId, mergedConfig.citationLostThreshold),
    checkCitationGained(brandId),
    checkCompetitorSurge(brandId, mergedConfig.competitorSurgeThreshold),
    checkSentimentDrop(brandId, mergedConfig.sentimentDropThreshold),
    checkCostSpike(brandId, mergedConfig.costSpikeThreshold),
  ]);
}

// ── Alert retrieval ──────────────────────────────────────────────────────

export async function getAlerts(
  brandId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<Alert[]> {
  const where: Record<string, unknown> = { brandId };

  if (options?.unreadOnly) {
    where.isRead = false;
  }

  return prisma.alert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
  });
}

export async function markAlertRead(alertId: string): Promise<void> {
  await prisma.alert.update({
    where: { id: alertId },
    data: { isRead: true },
  });
}

export async function markAllAlertsRead(brandId: string): Promise<void> {
  await prisma.alert.updateMany({
    where: { brandId, isRead: false },
    data: { isRead: true },
  });
}
