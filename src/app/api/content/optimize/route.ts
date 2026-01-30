import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { optimizeContent } from "@/lib/content/optimizer";
import type { CitationContext, CompetitorInsight } from "@/lib/content/optimizer";
import type { LLMProvider } from "@/lib/llm";

const optimizeSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  provider: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = optimizeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { contentId, provider } = parsed.data;

    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: { brand: true },
    });

    if (!content) {
      return NextResponse.json(
        { error: "Content not found" },
        { status: 404 }
      );
    }

    const keywords: string[] = content.brand.keywords
      ? JSON.parse(content.brand.keywords)
      : [];
    const competitors: Array<{ name: string; domain: string }> =
      content.brand.competitors
        ? JSON.parse(content.brand.competitors)
        : [];

    // Fetch recent citation results for this brand
    const recentRuns = await prisma.citationRun.findMany({
      where: { brandId: content.brandId },
      include: {
        probe: true,
        results: true,
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    const citationResults: CitationContext[] = recentRuns.flatMap((run) =>
      run.results.map((result) => ({
        query: run.probe.query,
        provider: result.provider,
        cited: result.cited,
        responseExcerpt: result.response.slice(0, 300),
      }))
    );

    // Build competitor insights from citation data
    const competitorInsights: CompetitorInsight[] = competitors.map((comp) => {
      const mentionedInResults = recentRuns.flatMap((run) =>
        run.results.filter((r) => {
          const mentioned: string[] = r.competitorsMentioned
            ? JSON.parse(r.competitorsMentioned)
            : [];
          return mentioned.some(
            (m) => m.toLowerCase() === comp.name.toLowerCase()
          );
        })
      );

      const totalResults = recentRuns.flatMap((r) => r.results).length;
      const citationRate =
        totalResults > 0
          ? Math.round((mentionedInResults.length / totalResults) * 100)
          : 0;

      return {
        name: comp.name,
        citationRate,
        commonPatterns: [],
      };
    });

    const result = await optimizeContent(
      {
        content: content.body,
        brandName: content.brand.name,
        brandDomain: content.brand.domain,
        keywords,
        competitorAnalysis: competitorInsights,
        citationResults,
        contentType: content.contentType as
          | "article"
          | "faq"
          | "how-to"
          | "comparison",
      },
      (provider as LLMProvider) ?? "openai"
    );

    await prisma.content.update({
      where: { id: contentId },
      data: { body: result.optimizedContent },
    });

    return NextResponse.json({
      changes: result.changes,
      estimatedImprovement: result.estimatedScoreImprovement,
    });
  } catch (error) {
    console.error("Failed to optimize content:", error);
    return NextResponse.json(
      { error: "Failed to optimize content" },
      { status: 500 }
    );
  }
}
