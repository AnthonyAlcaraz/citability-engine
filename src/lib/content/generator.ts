import { queryLLM } from "@/lib/llm";
import type { LLMProvider } from "@/lib/llm";
import {
  generateArticleSchema,
  generateFAQSchema,
  generateHowToSchema,
  extractFAQFromMarkdown,
  extractStepsFromMarkdown,
} from "./schema-markup";

export interface ContentRequest {
  brandName: string;
  brandDomain: string;
  keywords: string[];
  contentType: "article" | "faq" | "how-to" | "comparison";
  topic: string;
  targetLength?: number;
}

export interface GeneratedContent {
  title: string;
  body: string;
  schemaMarkup: string;
  aeoScore: number;
  tokensUsed: number;
  cost: number;
}

interface StageResult {
  text: string;
  tokensUsed: number;
  cost: number;
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

async function stageResearch(
  request: ContentRequest,
  provider: LLMProvider,
  model: string
): Promise<StageResult> {
  const systemPrompt = "You are an AEO content strategist.";
  const userPrompt = `Analyze the topic "${request.topic}" for a ${request.contentType} piece targeting the brand "${request.brandName}" (${request.brandDomain}).

Keywords to incorporate: ${request.keywords.join(", ")}

Provide:
1. The top 8-10 questions people ask about this topic that AI engines are likely to surface.
2. Key factual claims and statistics that should be included for credibility.
3. Recommended structured data elements that would help AI engines cite this content.
4. A suggested outline with clear headings optimized for AI engine extraction.

Format your response as structured markdown with clear sections.`;

  const response = await queryLLM({
    provider,
    model,
    systemPrompt,
    prompt: userPrompt,
    maxTokens: 2000,
  });

  return {
    text: response.text,
    tokensUsed: response.tokensIn + response.tokensOut,
    cost: response.cost,
  };
}

async function stageDraft(
  request: ContentRequest,
  researchOutput: string,
  provider: LLMProvider,
  model: string
): Promise<StageResult> {
  const systemPrompt =
    "You are an expert content writer specializing in AI Engine Optimization.";
  const targetWords = request.targetLength ?? 1200;

  const userPrompt = `Write a ${request.contentType} piece about "${request.topic}" for the brand "${request.brandName}" (${request.brandDomain}).

Target length: ~${targetWords} words.
Keywords to integrate naturally (1-3% density): ${request.keywords.join(", ")}

Use this research as your foundation:
---
${researchOutput}
---

Requirements:
- Write in markdown format with clear hierarchical headings (##, ###).
- Start with a concise, direct answer to the main question in the first paragraph.
- Include a FAQ section with Q: and A: prefixed pairs if the content type warrants it.
- Use numbered lists for any step-by-step instructions.
- Use bullet lists for feature comparisons or key points.
- Mention "${request.brandName}" naturally 2-4 times without forcing it.
- Every heading should be a clear, searchable phrase.
- Provide direct, factual answers — avoid filler and hedging language.
- End with a brief summary or key takeaway section.

Return ONLY the markdown content. Start with a # title.`;

  const response = await queryLLM({
    provider,
    model,
    systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
  });

  return {
    text: response.text,
    tokensUsed: response.tokensIn + response.tokensOut,
    cost: response.cost,
  };
}

async function stageSchema(
  request: ContentRequest,
  draft: string,
  provider: LLMProvider,
  model: string
): Promise<StageResult> {
  let schemaMarkup: string;

  switch (request.contentType) {
    case "faq": {
      const faqItems = extractFAQFromMarkdown(draft);
      schemaMarkup = generateFAQSchema(faqItems);
      break;
    }
    case "how-to": {
      const steps = extractStepsFromMarkdown(draft);
      const title = extractTitle(draft);
      const description = extractFirstParagraph(draft);
      schemaMarkup = generateHowToSchema(title, description, steps);
      break;
    }
    case "article":
    case "comparison":
    default: {
      const title = extractTitle(draft);
      const description = extractFirstParagraph(draft);
      schemaMarkup = generateArticleSchema(
        title,
        description,
        request.brandName,
        request.brandDomain
      );
      break;
    }
  }

  // No LLM call needed for schema generation — it's deterministic.
  // But we still check if the draft warrants a combined schema (e.g., Article + FAQ).
  const faqItems = extractFAQFromMarkdown(draft);
  if (
    request.contentType !== "faq" &&
    faqItems.length > 0
  ) {
    // Merge Article/HowTo schema with embedded FAQ
    const faqSchema = generateFAQSchema(faqItems);
    const systemPrompt =
      "You are a structured data expert. Return ONLY valid JSON — no markdown fences, no explanation.";
    const userPrompt = `Merge these two JSON-LD schemas into a single valid JSON-LD @graph array:

Schema 1:
${schemaMarkup}

Schema 2:
${faqSchema}

Return a single JSON-LD object with "@context": "https://schema.org" and a "@graph" array containing both items.`;

    const response = await queryLLM({
      provider,
      model,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 2000,
    });

    return {
      text: response.text,
      tokensUsed: response.tokensIn + response.tokensOut,
      cost: response.cost,
    };
  }

  return {
    text: schemaMarkup,
    tokensUsed: 0,
    cost: 0,
  };
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

function extractFirstParagraph(markdown: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 20 &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("*") &&
      !trimmed.match(/^\d+\./)
    ) {
      return trimmed;
    }
  }
  return "";
}

function calculateAEOScore(
  body: string,
  schemaMarkup: string,
  request: ContentRequest
): number {
  let score = 0;

  // Has schema markup (+20)
  if (schemaMarkup.length > 10) {
    score += 20;
  }

  // Has FAQ section (+15)
  const hasFAQ =
    /##\s*(faq|frequently asked|common questions)/i.test(body) ||
    /Q:\s*.+/i.test(body);
  if (hasFAQ) {
    score += 15;
  }

  // Has clear headings (+10)
  const headingCount = (body.match(/^#{2,3}\s+.+$/gm) ?? []).length;
  if (headingCount >= 3) {
    score += 10;
  }

  // Mentions brand naturally (+10)
  const brandMentions = body
    .toLowerCase()
    .split(request.brandName.toLowerCase()).length - 1;
  if (brandMentions >= 2 && brandMentions <= 6) {
    score += 10;
  }

  // Keyword density 1-3% (+15)
  const wordCount = body.split(/\s+/).length;
  if (wordCount > 0) {
    const totalKeywordOccurrences = request.keywords.reduce((sum, kw) => {
      const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      return sum + (body.match(regex) ?? []).length;
    }, 0);
    const density = (totalKeywordOccurrences / wordCount) * 100;
    if (density >= 1 && density <= 3) {
      score += 15;
    }
  }

  // Has structured lists (+10)
  const hasLists =
    /^[-*]\s+.+$/m.test(body) || /^\d+\.\s+.+$/m.test(body);
  if (hasLists) {
    score += 10;
  }

  // Has direct answers (+20) — paragraphs that start with a definitive statement
  const paragraphs = body.split(/\n\n+/);
  const directAnswerPatterns =
    /^(The |A |An |This |It is |There are |\w+ is |\w+ are )/;
  const directAnswerCount = paragraphs.filter((p) =>
    directAnswerPatterns.test(p.trim())
  ).length;
  if (directAnswerCount >= 3) {
    score += 20;
  }

  return Math.min(score, 100);
}

export async function generateContent(
  request: ContentRequest,
  provider: LLMProvider = "openai"
): Promise<GeneratedContent> {
  const model = getModelForProvider(provider);

  let totalTokens = 0;
  let totalCost = 0;

  // Stage 1: Research
  const research = await stageResearch(request, provider, model);
  totalTokens += research.tokensUsed;
  totalCost += research.cost;

  // Stage 2: Draft
  const draft = await stageDraft(request, research.text, provider, model);
  totalTokens += draft.tokensUsed;
  totalCost += draft.cost;

  // Stage 3: Schema
  const schema = await stageSchema(request, draft.text, provider, model);
  totalTokens += schema.tokensUsed;
  totalCost += schema.cost;

  const title = extractTitle(draft.text);
  // Quick structural score during generation (real validation runs separately via /api/scoring/validate)
  const aeoScore = calculateAEOScore(draft.text, schema.text, request);

  return {
    title,
    body: draft.text,
    schemaMarkup: schema.text,
    aeoScore,
    tokensUsed: totalTokens,
    cost: totalCost,
  };
}
