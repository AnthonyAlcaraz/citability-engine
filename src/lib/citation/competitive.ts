import { queryLLM, getEnabledProviders } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm";
import { detectCitation } from "@/lib/citation/detector";
import { buildProbePrompt } from "@/lib/citation/prompt-builder";
import type { ProbeCategory } from "@/lib/citation/prompt-builder";
import type { CitationAnalysis } from "@/lib/citation/detector";

export interface CompetitiveAnalysis {
  brandCitationRate: number;
  competitors: CompetitorProfile[];
  insights: CompetitiveInsight[];
  recommendations: string[];
}

export interface CompetitorProfile {
  name: string;
  domain: string;
  citationRate: number;
  avgPosition: number | null;
  avgSentiment: "positive" | "neutral" | "negative";
  strongCategories: string[];
  weakCategories: string[];
}

export interface CompetitiveInsight {
  type: "opportunity" | "threat" | "strength" | "weakness";
  title: string;
  description: string;
  relatedCompetitor: string | null;
  suggestedAction: string;
}

interface ProbeResult {
  query: string;
  category: ProbeCategory;
  provider: LLMProvider;
  responseText: string;
  brandCitation: CitationAnalysis;
  competitorCitations: Map<string, CitationAnalysis>;
}

interface CompetitorInput {
  name: string;
  domain: string;
}

function computeAvgSentiment(
  sentiments: Array<"positive" | "neutral" | "negative">
): "positive" | "neutral" | "negative" {
  if (sentiments.length === 0) return "neutral";

  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const s of sentiments) {
    counts[s]++;
  }

  if (counts.positive >= counts.negative && counts.positive >= counts.neutral) {
    return "positive";
  }
  if (counts.negative > counts.positive && counts.negative >= counts.neutral) {
    return "negative";
  }
  return "neutral";
}

function computeAvgPosition(positions: number[]): number | null {
  const valid = positions.filter((p) => p > 0);
  if (valid.length === 0) return null;
  return Math.round(
    (valid.reduce((sum, p) => sum + p, 0) / valid.length) * 10
  ) / 10;
}

function buildCompetitorProfile(
  competitor: CompetitorInput,
  results: ProbeResult[],
  allCategories: ProbeCategory[]
): CompetitorProfile {
  const citedResults: ProbeResult[] = [];
  const sentiments: Array<"positive" | "neutral" | "negative"> = [];
  const positions: number[] = [];
  const categoryCitations = new Map<ProbeCategory, number>();
  const categoryTotals = new Map<ProbeCategory, number>();

  for (const result of results) {
    const citation = result.competitorCitations.get(competitor.name);
    const category = result.category;

    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + 1);

    if (citation?.cited) {
      citedResults.push(result);
      categoryCitations.set(
        category,
        (categoryCitations.get(category) ?? 0) + 1
      );

      if (citation.sentiment) {
        sentiments.push(citation.sentiment);
      }
      if (citation.position !== null) {
        positions.push(citation.position);
      }
    }
  }

  const totalProbes = results.length;
  const citationRate =
    totalProbes > 0
      ? Math.round((citedResults.length / totalProbes) * 100)
      : 0;

  const strongCategories: string[] = [];
  const weakCategories: string[] = [];

  for (const category of allCategories) {
    const cited = categoryCitations.get(category) ?? 0;
    const total = categoryTotals.get(category) ?? 0;
    if (total === 0) continue;

    const rate = cited / total;
    if (rate >= 0.6) {
      strongCategories.push(category);
    } else if (rate <= 0.2) {
      weakCategories.push(category);
    }
  }

  return {
    name: competitor.name,
    domain: competitor.domain,
    citationRate,
    avgPosition: computeAvgPosition(positions),
    avgSentiment: computeAvgSentiment(sentiments),
    strongCategories,
    weakCategories,
  };
}

function generateInsights(
  brandCitationRate: number,
  brandResults: ProbeResult[],
  competitorProfiles: CompetitorProfile[]
): CompetitiveInsight[] {
  const insights: CompetitiveInsight[] = [];

  // Find queries where no one is cited well (opportunity)
  for (const result of brandResults) {
    const anyoneCited =
      result.brandCitation.cited ||
      Array.from(result.competitorCitations.values()).some((c) => c.cited);

    if (!anyoneCited) {
      insights.push({
        type: "opportunity",
        title: `Unclaimed query: "${result.query}"`,
        description: `No brand is consistently cited for "${result.query}" on ${result.provider}. This is a greenfield opportunity.`,
        relatedCompetitor: null,
        suggestedAction: `Create authoritative content targeting the query "${result.query}" with direct, factual answers.`,
      });
    }
  }

  // Find threats (competitors dominate, brand absent)
  for (const profile of competitorProfiles) {
    if (profile.citationRate > brandCitationRate + 20) {
      insights.push({
        type: "threat",
        title: `${profile.name} dominates with ${profile.citationRate}% citation rate`,
        description: `${profile.name} is cited ${profile.citationRate - brandCitationRate}% more often across AI engines. Their strongest categories: ${profile.strongCategories.join(", ") || "general"}.`,
        relatedCompetitor: profile.name,
        suggestedAction: `Analyze ${profile.name}'s content patterns in their strong categories and create competing content that provides more specific, data-driven answers.`,
      });
    }
  }

  // Find strengths (brand consistently wins)
  const brandCitedQueries = brandResults.filter((r) => r.brandCitation.cited);
  const brandCitedCategories = new Map<ProbeCategory, number>();
  const brandCategoryTotals = new Map<ProbeCategory, number>();

  for (const result of brandResults) {
    brandCategoryTotals.set(
      result.category,
      (brandCategoryTotals.get(result.category) ?? 0) + 1
    );
    if (result.brandCitation.cited) {
      brandCitedCategories.set(
        result.category,
        (brandCitedCategories.get(result.category) ?? 0) + 1
      );
    }
  }

  for (const [category, cited] of brandCitedCategories) {
    const total = brandCategoryTotals.get(category) ?? 0;
    if (total > 0 && cited / total >= 0.7) {
      insights.push({
        type: "strength",
        title: `Strong citation performance in "${category}" queries`,
        description: `Brand is cited in ${Math.round((cited / total) * 100)}% of "${category}" probes. This category is a competitive advantage.`,
        relatedCompetitor: null,
        suggestedAction: `Continue producing "${category}" content and expand into related subtopics.`,
      });
    }
  }

  // Find weaknesses (brand never cited in a category)
  for (const [category, total] of brandCategoryTotals) {
    const cited = brandCitedCategories.get(category) ?? 0;
    if (total >= 2 && cited === 0) {
      const competitorInCategory = competitorProfiles.find((p) =>
        p.strongCategories.includes(category)
      );

      insights.push({
        type: "weakness",
        title: `Zero citations in "${category}" queries`,
        description: `Brand was never cited across ${total} "${category}" probes.${competitorInCategory ? ` ${competitorInCategory.name} performs well here.` : ""}`,
        relatedCompetitor: competitorInCategory?.name ?? null,
        suggestedAction: `Create targeted "${category}" content with direct answers, structured data, and specific claims.`,
      });
    }
  }

  return insights;
}

function generateRecommendations(
  insights: CompetitiveInsight[],
  competitorProfiles: CompetitorProfile[]
): string[] {
  const recommendations: string[] = [];

  const opportunities = insights.filter((i) => i.type === "opportunity");
  if (opportunities.length > 0) {
    recommendations.push(
      `Target ${opportunities.length} unclaimed queries where no competitor is consistently cited. These represent the fastest path to AI visibility.`
    );
  }

  const threats = insights.filter((i) => i.type === "threat");
  for (const threat of threats) {
    if (threat.relatedCompetitor) {
      recommendations.push(threat.suggestedAction);
    }
  }

  const weaknesses = insights.filter((i) => i.type === "weakness");
  if (weaknesses.length > 0) {
    const categories = weaknesses
      .map((w) => w.title.match(/"(.+)"/)?.[1])
      .filter((c): c is string => c !== undefined);
    recommendations.push(
      `Prioritize content creation for weak categories: ${categories.join(", ")}. Focus on direct factual answers with structured data.`
    );
  }

  const topCompetitor = competitorProfiles.reduce<CompetitorProfile | null>(
    (top, p) => {
      if (top === null || p.citationRate > top.citationRate) return p;
      return top;
    },
    null
  );

  if (topCompetitor && topCompetitor.citationRate > 50) {
    recommendations.push(
      `Study ${topCompetitor.name}'s content structure and citation patterns. They achieve ${topCompetitor.citationRate}% citation rate with ${topCompetitor.avgSentiment} sentiment.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue monitoring AI citation performance and expand probe coverage to identify new opportunities."
    );
  }

  return recommendations;
}

export async function runCompetitiveAnalysis(
  brandName: string,
  brandDomain: string,
  competitors: CompetitorInput[],
  probeQueries: Array<{ query: string; category: ProbeCategory }>,
  providers?: LLMProvider[]
): Promise<CompetitiveAnalysis> {
  const activeProviders = providers ?? getEnabledProviders();
  if (activeProviders.length === 0) {
    throw new Error(
      "No LLM providers enabled. Configure at least one API key."
    );
  }

  const allCompetitors = competitors.map((c) => ({
    name: c.name,
    domain: c.domain,
  }));

  const allResults: ProbeResult[] = [];

  // Run all probes across all providers
  for (const probe of probeQueries) {
    const prompt = buildProbePrompt(probe.query, probe.category);

    for (const provider of activeProviders) {
      const response = await queryLLM({
        provider,
        prompt,
        temperature: 0.3,
        maxTokens: 2000,
      });

      const brandCitation = detectCitation(
        response.text,
        brandName,
        brandDomain,
        allCompetitors
      );

      const competitorCitations = new Map<string, CitationAnalysis>();
      for (const competitor of competitors) {
        const otherCompetitors = allCompetitors.filter(
          (c) => c.name !== competitor.name
        );
        const brandAsCompetitor = { name: brandName, domain: brandDomain };
        const citation = detectCitation(
          response.text,
          competitor.name,
          competitor.domain,
          [...otherCompetitors, brandAsCompetitor]
        );
        competitorCitations.set(competitor.name, citation);
      }

      allResults.push({
        query: probe.query,
        category: probe.category,
        provider,
        responseText: response.text,
        brandCitation,
        competitorCitations,
      });
    }
  }

  // Calculate brand citation rate
  const brandCitedCount = allResults.filter(
    (r) => r.brandCitation.cited
  ).length;
  const brandCitationRate =
    allResults.length > 0
      ? Math.round((brandCitedCount / allResults.length) * 100)
      : 0;

  // Get unique categories
  const allCategories = [
    ...new Set(probeQueries.map((p) => p.category)),
  ];

  // Build competitor profiles
  const competitorProfiles = competitors.map((c) =>
    buildCompetitorProfile(c, allResults, allCategories)
  );

  // Generate insights and recommendations
  const insights = generateInsights(
    brandCitationRate,
    allResults,
    competitorProfiles
  );
  const recommendations = generateRecommendations(insights, competitorProfiles);

  return {
    brandCitationRate,
    competitors: competitorProfiles,
    insights,
    recommendations,
  };
}

export async function analyzeCompetitorContent(
  competitorName: string,
  competitorDomain: string,
  citedResponses: string[]
): Promise<string[]> {
  if (citedResponses.length === 0) {
    return [];
  }

  const responseSamples = citedResponses
    .slice(0, 10)
    .map((r, i) => `--- Response ${i + 1} ---\n${r}`)
    .join("\n\n");

  const systemPrompt =
    "You are a citation pattern analyst. Analyze how this brand is referenced in AI responses and identify the specific phrases, contexts, and patterns that lead to it being cited. Return a bullet list of patterns.";

  const userPrompt = `Analyze how "${competitorName}" (${competitorDomain}) is cited in these AI engine responses. Identify the patterns that lead to this brand being mentioned.

For each pattern, note:
- The exact context (list, comparison, standalone recommendation, etc.)
- The claims or attributes associated with the brand (pricing, features, ease of use, etc.)
- The phrasing used around the brand mention

${responseSamples}

Return ONLY a bullet list of citation patterns. Each bullet should be a concise, specific observation like:
- "Frequently cited as 'affordable alternative'"
- "Mentioned in top-3 lists for CRM tools"
- "Associated with 'ease of use' and 'small business'"`;

  const response = await queryLLM({
    provider: "openai",
    model: "gpt-4o-mini",
    systemPrompt,
    prompt: userPrompt,
    maxTokens: 1500,
    temperature: 0.2,
  });

  const patterns = response.text
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 10);

  return patterns;
}
