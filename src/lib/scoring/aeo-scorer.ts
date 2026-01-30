import { queryLLM, getEnabledProviders } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm";
import { detectCitation } from "@/lib/citation/detector";
import { extractProbeQueries } from "./query-extractor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AEOScore {
  overall: number;
  structural: StructuralScore;
  citationValidation: CitationValidationScore;
  competitiveGap: CompetitiveGapScore;
  recommendations: Recommendation[];
}

export interface StructuralScore {
  score: number;
  weight: number;
  factors: {
    hasSchemaMarkup: boolean;
    hasFaqSection: boolean;
    headingCount: number;
    hasDirectAnswers: boolean;
    hasStructuredLists: boolean;
    keywordDensity: number;
    brandMentionCount: number;
    wordCount: number;
    readabilityGrade: number;
  };
}

export interface CitationValidationScore {
  score: number;
  weight: number;
  probeResults: ValidationProbeResult[];
}

export interface ValidationProbeResult {
  query: string;
  provider: string;
  cited: boolean;
  position: number | null;
  sentiment: string | null;
  competitorsCited: string[];
}

export interface CompetitiveGapScore {
  score: number;
  weight: number;
  yourCitationRate: number;
  avgCompetitorCitationRate: number;
  topCompetitor: string | null;
  topCompetitorRate: number;
  gapAnalysis: string;
}

export interface Recommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: "content" | "structure" | "schema" | "competitive";
  title: string;
  description: string;
  impact: string;
}

interface Competitor {
  name: string;
  domain: string;
}

// Reused by analyzeCompetitiveGap to accept existing citation data
export interface CitationResult {
  query: string;
  provider: string;
  brandCited: boolean;
  competitorsCited: string[];
}

// ---------------------------------------------------------------------------
// Readability helpers
// ---------------------------------------------------------------------------

/**
 * Count syllables in a word using a vowel-group heuristic.
 * Not perfect, but sufficient for Flesch-Kincaid approximation.
 */
function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length <= 2) return 1;

  // Count vowel groups
  const vowelGroups = cleaned.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Silent e at end
  if (cleaned.endsWith("e") && count > 1) {
    count--;
  }

  // Words like "le" at the end (e.g., "table")
  if (cleaned.endsWith("le") && cleaned.length > 2 && !/[aeiouy]/.test(cleaned.charAt(cleaned.length - 3))) {
    count++;
  }

  return Math.max(1, count);
}

/**
 * Approximate Flesch-Kincaid grade level.
 * FK Grade = 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 */
function calculateReadabilityGrade(text: string): number {
  const plainText = text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .trim();

  const words = plainText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  const sentences = plainText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);

  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const grade =
    0.39 * (wordCount / sentenceCount) +
    11.8 * (totalSyllables / wordCount) -
    15.59;

  return Math.round(Math.max(0, grade) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Structural scoring
// ---------------------------------------------------------------------------

export function calculateStructuralScore(
  body: string,
  schemaMarkup: string,
  brandName: string,
  keywords: string[]
): StructuralScore {
  const lowerBody = body.toLowerCase();
  const plainText = body
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "");

  const words = plainText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  // Schema markup
  const hasSchemaMarkup =
    schemaMarkup.trim().length > 0 &&
    (schemaMarkup.includes('"@type"') || schemaMarkup.includes("@context"));

  // FAQ section
  const hasFaqSection =
    /#{1,3}\s*(faq|frequently\s+asked|common\s+questions)/i.test(body) ||
    /\bQ:\s/i.test(body);

  // Headings
  const headingMatches = body.match(/^#{1,6}\s+.+$/gm);
  const headingCount = headingMatches ? headingMatches.length : 0;

  // Direct answers in first paragraph
  const firstParagraphMatch = body
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/^#{1,6}\s+.+\n*/m, "")
    .match(/^(?!#|\s*$)(.{1,500})/m);
  const firstParagraph = firstParagraphMatch
    ? firstParagraphMatch[1].toLowerCase()
    : "";
  const directAnswerPatterns = [
    /\bis\b/,
    /\bare\b/,
    /\bthe best\b/,
    /\brefers to\b/,
    /\bmeans\b/,
    /\bdefined as\b/,
    /\bprovides\b/,
    /\boffers\b/,
    /\benables\b/,
  ];
  const hasDirectAnswers = directAnswerPatterns.some((p) =>
    p.test(firstParagraph)
  );

  // Structured lists
  const hasStructuredLists =
    /^[\s]*[-*+]\s+.+$/m.test(body) || /^[\s]*\d+[.)]\s+.+$/m.test(body);

  // Keyword density
  let totalKeywordOccurrences = 0;
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase().trim();
    if (keywordLower.length === 0) continue;
    const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, "gi");
    const matches = lowerBody.match(regex);
    totalKeywordOccurrences += matches ? matches.length : 0;
  }
  const keywordDensity =
    wordCount > 0
      ? Math.round((totalKeywordOccurrences / wordCount) * 100 * 100) / 100
      : 0;

  // Brand mentions
  const brandRegex = new RegExp(`\\b${escapeRegex(brandName)}\\b`, "gi");
  const brandMatches = lowerBody.match(brandRegex);
  const brandMentionCount = brandMatches ? brandMatches.length : 0;

  // Readability
  const readabilityGrade = calculateReadabilityGrade(body);

  // --- Calculate score ---
  let score = 0;

  // Schema: 15 points
  if (hasSchemaMarkup) score += 15;

  // FAQ: 10 points
  if (hasFaqSection) score += 10;

  // Headings: up to 15 points (3+ headings = full marks)
  score += Math.min(15, headingCount * 5);

  // Direct answers: 15 points
  if (hasDirectAnswers) score += 15;

  // Structured lists: 5 points
  if (hasStructuredLists) score += 5;

  // Keyword density: up to 10 points (1-3% is ideal)
  if (keywordDensity >= 1 && keywordDensity <= 3) {
    score += 10;
  } else if (keywordDensity > 0 && keywordDensity < 1) {
    score += Math.round(keywordDensity * 10);
  } else if (keywordDensity > 3 && keywordDensity <= 5) {
    score += Math.round(10 - (keywordDensity - 3) * 3);
  }

  // Brand mentions: up to 5 points (2+ mentions = full)
  score += Math.min(5, brandMentionCount * 2.5);

  // Word count: up to 15 points (800-2000 is ideal)
  if (wordCount >= 800 && wordCount <= 2000) {
    score += 15;
  } else if (wordCount >= 500 && wordCount < 800) {
    score += Math.round((wordCount / 800) * 15);
  } else if (wordCount > 2000 && wordCount <= 3000) {
    score += Math.round(15 - ((wordCount - 2000) / 1000) * 10);
  } else if (wordCount > 0 && wordCount < 500) {
    score += Math.round((wordCount / 800) * 15);
  }

  // Readability: up to 10 points (grade 8-12 is ideal)
  if (readabilityGrade >= 8 && readabilityGrade <= 12) {
    score += 10;
  } else if (readabilityGrade >= 5 && readabilityGrade < 8) {
    score += Math.round(((readabilityGrade - 5) / 3) * 10);
  } else if (readabilityGrade > 12 && readabilityGrade <= 16) {
    score += Math.round(10 - ((readabilityGrade - 12) / 4) * 10);
  }

  // Clamp
  score = Math.round(Math.min(100, Math.max(0, score)));

  return {
    score,
    weight: 0.2,
    factors: {
      hasSchemaMarkup,
      hasFaqSection,
      headingCount,
      hasDirectAnswers,
      hasStructuredLists,
      keywordDensity,
      brandMentionCount,
      wordCount,
      readabilityGrade,
    },
  };
}

// ---------------------------------------------------------------------------
// Citation validation
// ---------------------------------------------------------------------------

/**
 * Select up to `count` cheap providers for probe queries.
 * Prefers smaller/cheaper models to keep validation costs low.
 */
function selectProbeProviders(count: number): LLMProvider[] {
  const enabled = getEnabledProviders();
  // Preference order: cheapest first
  const preferenceOrder: LLMProvider[] = [
    "google",
    "openai",
    "perplexity",
    "anthropic",
  ];
  const selected: LLMProvider[] = [];

  for (const provider of preferenceOrder) {
    if (selected.length >= count) break;
    if (enabled.includes(provider)) {
      selected.push(provider);
    }
  }

  return selected;
}

export async function validateCitability(
  content: string,
  brandName: string,
  brandDomain: string,
  keywords: string[],
  competitors: Competitor[]
): Promise<CitationValidationScore> {
  // 1. Generate probe queries from content
  const probeQueries = extractProbeQueries(content, keywords, 5);

  if (probeQueries.length === 0) {
    return {
      score: 0,
      weight: 0.5,
      probeResults: [],
    };
  }

  // 2. Select 2-3 providers
  const providers = selectProbeProviders(3);
  if (providers.length === 0) {
    return {
      score: 0,
      weight: 0.5,
      probeResults: [],
    };
  }

  // 3. Query each provider with each probe query
  const probeResults: ValidationProbeResult[] = [];
  const probePromises: Promise<void>[] = [];

  for (const probe of probeQueries) {
    for (const provider of providers) {
      const promise = (async () => {
        try {
          const response = await queryLLM({
            provider,
            prompt: probe.query,
            systemPrompt:
              "Answer the question concisely. If you know of specific products, tools, or companies, mention them by name.",
            temperature: 0.3,
            maxTokens: 500,
          });

          const citation = detectCitation(
            response.text,
            brandName,
            brandDomain,
            competitors
          );

          probeResults.push({
            query: probe.query,
            provider,
            cited: citation.cited,
            position: citation.position,
            sentiment: citation.sentiment,
            competitorsCited: citation.competitorsMentioned,
          });
        } catch {
          // Provider failed for this query; record as not cited
          probeResults.push({
            query: probe.query,
            provider,
            cited: false,
            position: null,
            sentiment: null,
            competitorsCited: [],
          });
        }
      })();
      probePromises.push(promise);
    }
  }

  await Promise.all(probePromises);

  // 4. Calculate score
  const totalProbes = probeResults.length;
  if (totalProbes === 0) {
    return { score: 0, weight: 0.5, probeResults };
  }

  const citedCount = probeResults.filter((r) => r.cited).length;
  let score = (citedCount / totalProbes) * 100;

  // Bonuses
  const positiveSentimentCount = probeResults.filter(
    (r) => r.cited && r.sentiment === "positive"
  ).length;
  if (positiveSentimentCount > 0) {
    score += 10;
  }

  const topPositionCount = probeResults.filter(
    (r) => r.cited && r.position !== null && r.position <= 3
  ).length;
  if (topPositionCount > 0) {
    score += 15;
  }

  // Cited by multiple providers for the same query
  const queryProviderMap = new Map<string, number>();
  for (const r of probeResults) {
    if (r.cited) {
      queryProviderMap.set(
        r.query,
        (queryProviderMap.get(r.query) ?? 0) + 1
      );
    }
  }
  const multiProviderCited = Array.from(queryProviderMap.values()).some(
    (count) => count >= 2
  );
  if (multiProviderCited) {
    score += 10;
  }

  // Penalties: competitors cited more than you
  const competitorCiteCounts = new Map<string, number>();
  for (const r of probeResults) {
    for (const comp of r.competitorsCited) {
      competitorCiteCounts.set(
        comp,
        (competitorCiteCounts.get(comp) ?? 0) + 1
      );
    }
  }
  for (const [, compCount] of competitorCiteCounts) {
    if (compCount > citedCount) {
      score -= 10;
    }
  }

  score = Math.round(Math.min(100, Math.max(0, score)));

  return {
    score,
    weight: 0.5,
    probeResults,
  };
}

// ---------------------------------------------------------------------------
// Competitive gap analysis
// ---------------------------------------------------------------------------

export async function analyzeCompetitiveGap(
  brandName: string,
  _brandDomain: string,
  competitors: Competitor[],
  existingResults: CitationResult[]
): Promise<CompetitiveGapScore> {
  if (existingResults.length === 0) {
    return {
      score: 50,
      weight: 0.3,
      yourCitationRate: 0,
      avgCompetitorCitationRate: 0,
      topCompetitor: null,
      topCompetitorRate: 0,
      gapAnalysis: "Insufficient data. Run citation validation probes first.",
    };
  }

  // Your citation rate
  const yourCitedCount = existingResults.filter((r) => r.brandCited).length;
  const yourCitationRate =
    Math.round((yourCitedCount / existingResults.length) * 100 * 10) / 10;

  // Competitor citation rates
  const competitorCiteCounts = new Map<string, number>();
  for (const comp of competitors) {
    competitorCiteCounts.set(comp.name, 0);
  }

  for (const result of existingResults) {
    for (const citedComp of result.competitorsCited) {
      const current = competitorCiteCounts.get(citedComp);
      if (current !== undefined) {
        competitorCiteCounts.set(citedComp, current + 1);
      }
    }
  }

  const competitorRates: { name: string; rate: number }[] = [];
  for (const [name, count] of competitorCiteCounts) {
    const rate =
      Math.round((count / existingResults.length) * 100 * 10) / 10;
    competitorRates.push({ name, rate });
  }

  competitorRates.sort((a, b) => b.rate - a.rate);

  const avgCompetitorRate =
    competitorRates.length > 0
      ? Math.round(
          (competitorRates.reduce((sum, c) => sum + c.rate, 0) /
            competitorRates.length) *
            10
        ) / 10
      : 0;

  const topCompetitor =
    competitorRates.length > 0 ? competitorRates[0] : null;

  // Score: 100 if you're ahead, decreases as gap widens
  let score: number;
  if (avgCompetitorRate <= yourCitationRate) {
    score = 100;
  } else {
    const gap = avgCompetitorRate - yourCitationRate;
    score = Math.max(0, Math.round(100 - gap * 1.5));
  }

  // Build gap analysis string
  let gapAnalysis: string;
  if (yourCitationRate >= avgCompetitorRate && yourCitationRate > 0) {
    gapAnalysis = `${brandName} leads with a ${yourCitationRate}% citation rate vs competitor average of ${avgCompetitorRate}%. Maintain current content strategy.`;
  } else if (yourCitationRate === 0 && avgCompetitorRate === 0) {
    gapAnalysis =
      "Neither you nor competitors are being cited. This is a greenfield opportunity to establish AEO dominance.";
  } else if (yourCitationRate === 0) {
    gapAnalysis = `${brandName} is not being cited while competitors average ${avgCompetitorRate}%. Immediate content restructuring required.`;
  } else {
    const deficit = Math.round((avgCompetitorRate - yourCitationRate) * 10) / 10;
    const topName = topCompetitor ? topCompetitor.name : "Unknown";
    const topRate = topCompetitor ? topCompetitor.rate : 0;
    gapAnalysis = `${brandName} trails competitors by ${deficit} percentage points. ${topName} leads at ${topRate}% citation rate. Focus on matching their content depth and direct-answer patterns.`;
  }

  return {
    score,
    weight: 0.3,
    yourCitationRate,
    avgCompetitorCitationRate: avgCompetitorRate,
    topCompetitor: topCompetitor ? topCompetitor.name : null,
    topCompetitorRate: topCompetitor ? topCompetitor.rate : 0,
    gapAnalysis,
  };
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export function generateRecommendations(
  structural: StructuralScore,
  citation: CitationValidationScore,
  competitive: CompetitiveGapScore
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Citation score is the primary indicator
  if (citation.score < 30) {
    recommendations.push({
      priority: "critical",
      category: "content",
      title: "Content is not being cited by AI engines",
      description:
        "Your content is not appearing in AI-generated responses. Restructure to directly answer common questions in the first paragraph. Use clear, factual statements that AI engines can extract as authoritative answers.",
      impact: "Could improve citation rate by 30-50%",
    });
  }

  if (!structural.factors.hasSchemaMarkup) {
    recommendations.push({
      priority: "high",
      category: "schema",
      title: "Add JSON-LD structured data",
      description:
        "AI engines use schema markup to validate content authority and extract structured information. Add FAQPage, Article, or HowTo schema as appropriate.",
      impact: "Schema markup improves AI extraction accuracy by 15-25%",
    });
  }

  if (structural.factors.keywordDensity < 1) {
    recommendations.push({
      priority: "high",
      category: "content",
      title: "Increase keyword usage",
      description: `Current keyword density is ${structural.factors.keywordDensity}%, which is below the 1-3% target range. Naturally integrate target keywords into headings, first paragraphs, and answer statements.`,
      impact: "Proper keyword density improves topic relevance signals",
    });
  }

  if (structural.factors.keywordDensity > 3) {
    recommendations.push({
      priority: "medium",
      category: "content",
      title: "Reduce keyword stuffing",
      description: `Current keyword density of ${structural.factors.keywordDensity}% exceeds the 3% threshold. Over-optimization may trigger AI quality filters and reduce citation likelihood.`,
      impact: "Reducing keyword stuffing prevents quality filter penalties",
    });
  }

  if (!structural.factors.hasFaqSection) {
    recommendations.push({
      priority: "medium",
      category: "structure",
      title: "Add a FAQ section",
      description:
        "AI engines frequently extract Q&A pairs for direct answers. Add a FAQ section with 3-5 questions that your target audience asks, each with concise 2-3 sentence answers.",
      impact: "FAQ sections increase AI extraction by 20-30%",
    });
  }

  if (structural.factors.readabilityGrade > 14) {
    recommendations.push({
      priority: "medium",
      category: "content",
      title: "Simplify language for AI extraction",
      description: `Current readability is grade level ${structural.factors.readabilityGrade}, which is too complex for optimal AI extraction. Target grade 8-12 using shorter sentences and common vocabulary.`,
      impact: "Simpler language improves AI comprehension and citation accuracy",
    });
  }

  // Competitive gap
  if (
    competitive.topCompetitor &&
    competitive.topCompetitorRate > competitive.yourCitationRate
  ) {
    const gap =
      Math.round(
        (competitive.topCompetitorRate - competitive.yourCitationRate) * 10
      ) / 10;
    recommendations.push({
      priority: "high",
      category: "competitive",
      title: `Competitor ${competitive.topCompetitor} cited ${gap}% more`,
      description: `${competitive.topCompetitor} achieves a ${competitive.topCompetitorRate}% citation rate compared to your ${competitive.yourCitationRate}%. Analyze their content structure, heading patterns, and direct-answer format.`,
      impact: `Closing this gap could increase your citations by ${gap} percentage points`,
    });
  }

  if (structural.factors.wordCount < 800) {
    recommendations.push({
      priority: "medium",
      category: "content",
      title: "Expand thin content",
      description: `Content is only ${structural.factors.wordCount} words. Aim for 1000-1500 words for comprehensive coverage that AI engines recognize as authoritative.`,
      impact:
        "Longer, comprehensive content is more likely to be cited as a primary source",
    });
  }

  if (!structural.factors.hasDirectAnswers) {
    recommendations.push({
      priority: "high",
      category: "content",
      title: "Lead with a direct answer",
      description:
        "The first paragraph does not contain a clear, direct answer. AI engines extract the first substantive paragraph as the primary answer candidate. Open with a definitive statement.",
      impact:
        "Direct first-paragraph answers are 2-3x more likely to be cited",
    });
  }

  // Sort by priority
  const priorityOrder: Record<Recommendation["priority"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return recommendations;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function scoreContent(
  body: string,
  schemaMarkup: string,
  brandName: string,
  brandDomain: string,
  keywords: string[],
  competitors: Competitor[],
  skipValidation?: boolean
): Promise<AEOScore> {
  // 1. Structural scoring (sync, fast)
  const structural = calculateStructuralScore(
    body,
    schemaMarkup,
    brandName,
    keywords
  );

  // 2. Citation validation (async, costs tokens)
  let citationValidation: CitationValidationScore;
  if (skipValidation) {
    citationValidation = {
      score: 0,
      weight: 0.5,
      probeResults: [],
    };
  } else {
    citationValidation = await validateCitability(
      body,
      brandName,
      brandDomain,
      keywords,
      competitors
    );
  }

  // 3. Competitive gap from validation probe results
  const citationResults: CitationResult[] = citationValidation.probeResults.map(
    (r) => ({
      query: r.query,
      provider: r.provider,
      brandCited: r.cited,
      competitorsCited: r.competitorsCited,
    })
  );

  const competitiveGap = await analyzeCompetitiveGap(
    brandName,
    brandDomain,
    competitors,
    citationResults
  );

  // 4. Composite score
  const overall = Math.round(
    structural.score * structural.weight +
      citationValidation.score * citationValidation.weight +
      competitiveGap.score * competitiveGap.weight
  );

  // 5. Recommendations
  const recommendations = generateRecommendations(
    structural,
    citationValidation,
    competitiveGap
  );

  return {
    overall,
    structural,
    citationValidation,
    competitiveGap,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
