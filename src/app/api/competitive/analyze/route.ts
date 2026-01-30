import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runCompetitiveAnalysis } from "@/lib/citation/competitive";
import type { ProbeCategory } from "@/lib/citation/prompt-builder";

const analyzeSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
  queries: z
    .array(
      z.object({
        query: z.string().min(1),
        category: z.string().min(1),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { brandId, queries: providedQueries } = parsed.data;

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    const keywords: string[] = brand.keywords
      ? JSON.parse(brand.keywords)
      : [];
    const competitors: Array<{ name: string; domain: string }> =
      brand.competitors ? JSON.parse(brand.competitors) : [];

    const queries: Array<{ query: string; category: ProbeCategory }> =
      (providedQueries as Array<{ query: string; category: ProbeCategory }>) ??
      keywords.flatMap((keyword) => [
        { query: `best ${keyword}`, category: "best-of" as const },
        { query: `${keyword} vs alternatives`, category: "comparison" as const },
        { query: `recommended ${keyword}`, category: "recommendation" as const },
      ]);

    if (queries.length === 0) {
      return NextResponse.json(
        { error: "No queries provided and brand has no keywords to auto-generate from" },
        { status: 400 }
      );
    }

    const result = await runCompetitiveAnalysis(
      brand.name,
      brand.domain,
      competitors,
      queries
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to run competitive analysis:", error);
    return NextResponse.json(
      { error: "Failed to run competitive analysis" },
      { status: 500 }
    );
  }
}
