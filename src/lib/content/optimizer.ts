import { queryLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm";

export interface OptimizationRequest {
  content: string;
  brandName: string;
  brandDomain: string;
  keywords: string[];
  competitorAnalysis: CompetitorInsight[];
  citationResults: CitationContext[];
  contentType: "article" | "faq" | "how-to" | "comparison";
}

export interface CompetitorInsight {
  name: string;
  citationRate: number;
  commonPatterns: string[];
}

export interface CitationContext {
  query: string;
  provider: string;
  cited: boolean;
  responseExcerpt: string;
}

export interface OptimizationResult {
  optimizedContent: string;
  changes: ContentChange[];
  estimatedScoreImprovement: number;
}

export interface ContentChange {
  type: "rewrite" | "add" | "restructure" | "schema";
  section: string;
  reason: string;
  before: string;
  after: string;
}

interface SectionBlock {
  heading: string;
  content: string;
}

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

function splitIntoSections(markdown: string): SectionBlock[] {
  const sections: SectionBlock[] = [];
  const lines = markdown.split("\n");
  let currentHeading = "(intro)";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentContent.length > 0 || currentHeading !== "(intro)") {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  sections.push({
    heading: currentHeading,
    content: currentContent.join("\n").trim(),
  });

  return sections;
}

function generateChanges(
  original: string,
  optimized: string
): ContentChange[] {
  const originalSections = splitIntoSections(original);
  const optimizedSections = splitIntoSections(optimized);
  const changes: ContentChange[] = [];

  const originalMap = new Map<string, string>();
  for (const section of originalSections) {
    originalMap.set(section.heading.toLowerCase(), section.content);
  }

  const optimizedMap = new Map<string, string>();
  for (const section of optimizedSections) {
    optimizedMap.set(section.heading.toLowerCase(), section.content);
  }

  // Detect rewrites and restructures
  for (const section of optimizedSections) {
    const key = section.heading.toLowerCase();
    const originalContent = originalMap.get(key);

    if (originalContent === undefined) {
      // New section added
      changes.push({
        type: "add",
        section: section.heading,
        reason: "New section added to improve coverage and citability",
        before: "",
        after: section.content.slice(0, 200),
      });
    } else if (originalContent !== section.content) {
      // Section was modified
      const originalWords = originalContent.split(/\s+/).length;
      const optimizedWords = section.content.split(/\s+/).length;
      const wordDiff = Math.abs(optimizedWords - originalWords);
      const changeRatio = originalWords > 0 ? wordDiff / originalWords : 1;

      const changeType: "rewrite" | "restructure" =
        changeRatio > 0.5 ? "restructure" : "rewrite";

      changes.push({
        type: changeType,
        section: section.heading,
        reason:
          changeType === "restructure"
            ? "Section significantly restructured for better AI extraction"
            : "Section rewritten to lead with direct, factual answers",
        before: originalContent.slice(0, 200),
        after: section.content.slice(0, 200),
      });
    }
  }

  // Detect removed sections (could indicate restructure)
  for (const section of originalSections) {
    const key = section.heading.toLowerCase();
    if (!optimizedMap.has(key) && section.content.length > 0) {
      changes.push({
        type: "restructure",
        section: section.heading,
        reason: "Section removed or merged during content restructuring",
        before: section.content.slice(0, 200),
        after: "",
      });
    }
  }

  return changes;
}

function estimateScoreFromChanges(changes: ContentChange[]): number {
  let estimate = 0;

  for (const change of changes) {
    switch (change.type) {
      case "rewrite":
        estimate += 3;
        break;
      case "add":
        estimate += 5;
        break;
      case "restructure":
        estimate += 4;
        break;
      case "schema":
        estimate += 6;
        break;
    }
  }

  return Math.min(estimate, 30);
}

function buildCitationResultsSection(
  citationResults: CitationContext[]
): string {
  if (citationResults.length === 0) {
    return "No citation probe results available.";
  }

  const cited = citationResults.filter((r) => r.cited);
  const notCited = citationResults.filter((r) => !r.cited);

  let section = "";

  if (cited.length > 0) {
    section += "### Queries where the brand WAS cited:\n";
    for (const result of cited) {
      section += `- Query: "${result.query}" (${result.provider})\n`;
      section += `  AI response excerpt: "${result.responseExcerpt}"\n\n`;
    }
  }

  if (notCited.length > 0) {
    section += "### Queries where the brand was NOT cited:\n";
    for (const result of notCited) {
      section += `- Query: "${result.query}" (${result.provider})\n`;
      section += `  AI response excerpt: "${result.responseExcerpt}"\n\n`;
    }
  }

  return section;
}

function buildCompetitorSection(competitors: CompetitorInsight[]): string {
  if (competitors.length === 0) {
    return "No competitor data available.";
  }

  let section = "";

  for (const competitor of competitors) {
    section += `### ${competitor.name} (Citation rate: ${competitor.citationRate}%)\n`;
    if (competitor.commonPatterns.length > 0) {
      section += "Patterns that earn citations:\n";
      for (const pattern of competitor.commonPatterns) {
        section += `- ${pattern}\n`;
      }
    }
    section += "\n";
  }

  return section;
}

export async function optimizeContent(
  request: OptimizationRequest,
  provider: LLMProvider = "openai"
): Promise<OptimizationResult> {
  const model = getModelForProvider(provider);

  const systemPrompt =
    "You are an AEO optimization specialist. You analyze how AI language models select and cite content in their responses. Your job is to restructure content so that AI models are more likely to reference it when answering user queries. Return ONLY the optimized markdown content.";

  const citationSection = buildCitationResultsSection(request.citationResults);
  const competitorSection = buildCompetitorSection(
    request.competitorAnalysis
  );

  const userPrompt = `Optimize the following content to maximize the chances of being cited by AI engines (ChatGPT, Claude, Gemini, Perplexity).

## Brand
Name: ${request.brandName}
Domain: ${request.brandDomain}
Target keywords: ${request.keywords.join(", ")}
Content type: ${request.contentType}

## Current Content
${request.content}

## Citation Probe Results
These are real results from querying AI engines about topics related to this content:

${citationSection}

## Competitor Analysis
How competitors perform in AI citations:

${competitorSection}

## Optimization Instructions
Rewrite the content above to maximize citability. Focus on:
a) Leading each section with a direct, factual answer that AI models can extract verbatim
b) Using the exact phrasing that matches common queries (see probe results above)
c) Including specific data points, numbers, and comparisons that AI models prefer to cite
d) Structuring information in clear hierarchical headings that map to search intent
e) Addressing gaps where competitors are cited but ${request.brandName} is not
f) Maintaining natural keyword integration for: ${request.keywords.join(", ")}

Return ONLY the optimized markdown content. Preserve the overall topic and brand voice. Start with a # title.`;

  const response = await queryLLM({
    provider,
    model,
    systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
    temperature: 0.3,
  });

  const optimizedContent = response.text.trim();
  const changes = generateChanges(request.content, optimizedContent);
  const estimatedScoreImprovement = estimateScoreFromChanges(changes);

  return {
    optimizedContent,
    changes,
    estimatedScoreImprovement,
  };
}
