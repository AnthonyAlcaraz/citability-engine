import { queryLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm";
import type { CompetitiveAnalysis } from "@/lib/citation/competitive";

export interface ContentBrief {
  title: string;
  targetQueries: string[];
  requiredSections: BriefSection[];
  keyMessages: string[];
  targetKeywords: string[];
  competitiveGaps: string[];
  schemaType: "Article" | "FAQPage" | "HowTo";
  estimatedAeoScore: number;
  wordCountTarget: number;
}

export interface BriefSection {
  heading: string;
  purpose: string;
  mustInclude: string[];
  targetLength: number;
}

interface ContentBriefLLMResponse {
  title: string;
  targetQueries: string[];
  requiredSections: Array<{
    heading: string;
    purpose: string;
    mustInclude: string[];
    targetLength: number;
  }>;
  keyMessages: string[];
  competitiveGaps: string[];
  schemaType: "Article" | "FAQPage" | "HowTo";
  wordCountTarget: number;
}

const VALID_SCHEMA_TYPES = new Set<string>(["Article", "FAQPage", "HowTo"]);

function getModelForProvider(provider: LLMProvider): string {
  switch (provider) {
    case "openai":
      return "gpt-4o";
    case "anthropic":
      return "claude-sonnet-4-20250514";
    default:
      return "gpt-4o";
  }
}

function buildCompetitiveContext(analysis: CompetitiveAnalysis): string {
  let context = "";

  context += `## Brand Citation Rate: ${analysis.brandCitationRate}%\n\n`;

  if (analysis.competitors.length > 0) {
    context += "## Competitor Profiles\n";
    for (const competitor of analysis.competitors) {
      context += `### ${competitor.name} (${competitor.domain})\n`;
      context += `- Citation rate: ${competitor.citationRate}%\n`;
      context += `- Average position: ${competitor.avgPosition ?? "N/A"}\n`;
      context += `- Sentiment: ${competitor.avgSentiment}\n`;
      if (competitor.strongCategories.length > 0) {
        context += `- Strong in: ${competitor.strongCategories.join(", ")}\n`;
      }
      if (competitor.weakCategories.length > 0) {
        context += `- Weak in: ${competitor.weakCategories.join(", ")}\n`;
      }
      context += "\n";
    }
  }

  if (analysis.insights.length > 0) {
    context += "## Key Insights\n";
    for (const insight of analysis.insights) {
      context += `- [${insight.type.toUpperCase()}] ${insight.title}: ${insight.description}\n`;
    }
    context += "\n";
  }

  if (analysis.recommendations.length > 0) {
    context += "## Recommendations\n";
    for (const rec of analysis.recommendations) {
      context += `- ${rec}\n`;
    }
    context += "\n";
  }

  return context;
}

function identifyTargetQueries(analysis: CompetitiveAnalysis): string[] {
  const queries: string[] = [];

  for (const insight of analysis.insights) {
    if (insight.type === "opportunity" || insight.type === "weakness") {
      const queryMatch = insight.title.match(/"([^"]+)"/);
      if (queryMatch) {
        queries.push(queryMatch[1]);
      }
    }
  }

  return queries;
}

function estimateAeoScore(
  brief: ContentBriefLLMResponse,
  analysis: CompetitiveAnalysis
): number {
  let score = 40; // Base score for following the brief format

  // Bonus for targeting uncited queries
  const opportunities = analysis.insights.filter(
    (i) => i.type === "opportunity"
  ).length;
  score += Math.min(opportunities * 5, 15);

  // Bonus for structured sections
  if (brief.requiredSections.length >= 4) {
    score += 10;
  }

  // Bonus for schema type selection
  if (brief.schemaType === "FAQPage" || brief.schemaType === "HowTo") {
    score += 5;
  }

  // Bonus for competitive gap coverage
  if (brief.competitiveGaps.length >= 2) {
    score += 10;
  }

  // Bonus for key messages
  if (brief.keyMessages.length >= 3) {
    score += 5;
  }

  // Penalty if brand citation rate is low and brief doesn't address it
  if (analysis.brandCitationRate < 20 && brief.competitiveGaps.length < 2) {
    score -= 10;
  }

  return Math.max(0, Math.min(score, 100));
}

function extractJsonFromText(text: string): string | null {
  // Try to find JSON block in markdown code fences
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  // Try to find raw JSON object
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }

  return null;
}

function validateSchemaType(
  value: string
): "Article" | "FAQPage" | "HowTo" {
  if (VALID_SCHEMA_TYPES.has(value)) {
    return value as "Article" | "FAQPage" | "HowTo";
  }
  return "Article";
}

function validateBriefResponse(parsed: Record<string, unknown>): ContentBriefLLMResponse {
  const title =
    typeof parsed.title === "string" ? parsed.title : "Untitled Brief";

  const targetQueries = Array.isArray(parsed.targetQueries)
    ? (parsed.targetQueries as unknown[]).filter(
        (q): q is string => typeof q === "string"
      )
    : [];

  const requiredSections = Array.isArray(parsed.requiredSections)
    ? (parsed.requiredSections as unknown[])
        .filter(
          (s): s is Record<string, unknown> =>
            typeof s === "object" && s !== null
        )
        .map((s) => ({
          heading:
            typeof s.heading === "string" ? s.heading : "Section",
          purpose:
            typeof s.purpose === "string"
              ? s.purpose
              : "Improve citability",
          mustInclude: Array.isArray(s.mustInclude)
            ? (s.mustInclude as unknown[]).filter(
                (m): m is string => typeof m === "string"
              )
            : [],
          targetLength:
            typeof s.targetLength === "number" ? s.targetLength : 200,
        }))
    : [];

  const keyMessages = Array.isArray(parsed.keyMessages)
    ? (parsed.keyMessages as unknown[]).filter(
        (m): m is string => typeof m === "string"
      )
    : [];

  const competitiveGaps = Array.isArray(parsed.competitiveGaps)
    ? (parsed.competitiveGaps as unknown[]).filter(
        (g): g is string => typeof g === "string"
      )
    : [];

  const schemaType = validateSchemaType(
    typeof parsed.schemaType === "string" ? parsed.schemaType : "Article"
  );

  const wordCountTarget =
    typeof parsed.wordCountTarget === "number"
      ? parsed.wordCountTarget
      : 1200;

  return {
    title,
    targetQueries,
    requiredSections,
    keyMessages,
    competitiveGaps,
    schemaType,
    wordCountTarget,
  };
}

export async function generateContentBrief(
  brandName: string,
  brandDomain: string,
  topic: string,
  competitiveAnalysis: CompetitiveAnalysis,
  keywords: string[],
  provider?: LLMProvider
): Promise<ContentBrief> {
  const activeProvider = provider ?? "openai";
  const model = getModelForProvider(activeProvider);

  const competitiveContext = buildCompetitiveContext(competitiveAnalysis);
  const identifiedQueries = identifyTargetQueries(competitiveAnalysis);

  const systemPrompt = `You are a content strategist specializing in AI Engine Optimization. Based on competitive citation data, create a detailed content brief that will maximize the chances of being cited by AI language models. Return JSON matching this schema: {title: string, targetQueries: string[], requiredSections: [{heading: string, purpose: string, mustInclude: string[], targetLength: number}], keyMessages: string[], competitiveGaps: string[], schemaType: "Article" | "FAQPage" | "HowTo", wordCountTarget: number}.`;

  const userPrompt = `Create a content brief for "${brandName}" (${brandDomain}) on the topic: "${topic}"

Target keywords: ${keywords.join(", ")}

## Competitive Analysis Data
${competitiveContext}

${identifiedQueries.length > 0 ? `## Identified Target Queries (from probe results)\nThese queries represent opportunities or gaps:\n${identifiedQueries.map((q) => `- "${q}"`).join("\n")}\n` : ""}

## Requirements
1. The brief should target queries where ${brandName} can win AI citations
2. Each section should serve a specific purpose for AI citability
3. Include specific claims, data points, and facts that must be in the content
4. Address competitive gaps where rivals are cited but ${brandName} is not
5. Choose the schema type that best fits the topic and query intent
6. Set a realistic word count target (typically 1000-2500 words)

Return ONLY valid JSON. No markdown fences, no explanation text.`;

  const response = await queryLLM({
    provider: activeProvider,
    model,
    systemPrompt,
    prompt: userPrompt,
    maxTokens: 3000,
    temperature: 0.3,
  });

  let briefData: ContentBriefLLMResponse;

  try {
    const parsed = JSON.parse(response.text) as Record<string, unknown>;
    briefData = validateBriefResponse(parsed);
  } catch {
    // Fallback: try to extract JSON from text
    const extracted = extractJsonFromText(response.text);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted) as Record<string, unknown>;
        briefData = validateBriefResponse(parsed);
      } catch {
        // Final fallback: construct a minimal brief
        briefData = {
          title: `${topic} - ${brandName} Guide`,
          targetQueries: identifiedQueries.length > 0 ? identifiedQueries : [topic],
          requiredSections: [
            {
              heading: "Overview",
              purpose: "Provide a direct answer for AI extraction",
              mustInclude: [`Define ${topic}`, `Mention ${brandName}`],
              targetLength: 200,
            },
            {
              heading: "Key Features and Benefits",
              purpose: "Structured data points for comparison queries",
              mustInclude: keywords.slice(0, 3),
              targetLength: 300,
            },
            {
              heading: "Frequently Asked Questions",
              purpose: "Target question-based AI queries",
              mustInclude: ["Direct Q&A format", "Specific answers with data"],
              targetLength: 400,
            },
          ],
          keyMessages: [`${brandName} is a leading solution for ${topic}`],
          competitiveGaps: [],
          schemaType: "Article",
          wordCountTarget: 1200,
        };
      }
    } else {
      briefData = {
        title: `${topic} - ${brandName} Guide`,
        targetQueries: identifiedQueries.length > 0 ? identifiedQueries : [topic],
        requiredSections: [
          {
            heading: "Overview",
            purpose: "Provide a direct answer for AI extraction",
            mustInclude: [`Define ${topic}`, `Mention ${brandName}`],
            targetLength: 200,
          },
          {
            heading: "Key Features and Benefits",
            purpose: "Structured data points for comparison queries",
            mustInclude: keywords.slice(0, 3),
            targetLength: 300,
          },
          {
            heading: "Frequently Asked Questions",
            purpose: "Target question-based AI queries",
            mustInclude: ["Direct Q&A format", "Specific answers with data"],
            targetLength: 400,
          },
        ],
        keyMessages: [`${brandName} is a leading solution for ${topic}`],
        competitiveGaps: [],
        schemaType: "Article",
        wordCountTarget: 1200,
      };
    }
  }

  const estimatedAeoScore = estimateAeoScore(briefData, competitiveAnalysis);

  return {
    title: briefData.title,
    targetQueries: briefData.targetQueries,
    requiredSections: briefData.requiredSections,
    keyMessages: briefData.keyMessages,
    targetKeywords: keywords,
    competitiveGaps: briefData.competitiveGaps,
    schemaType: briefData.schemaType,
    estimatedAeoScore,
    wordCountTarget: briefData.wordCountTarget,
  };
}
