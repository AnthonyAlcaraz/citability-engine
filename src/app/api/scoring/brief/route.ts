import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runCompetitiveAnalysis } from "@/lib/citation/competitive";
import { generateContentBrief } from "@/lib/content/content-brief";

const briefSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
  topic: z.string().min(1, "Topic is required"),
  keywords: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = briefSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { brandId, topic, keywords } = parsed.data;

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    const competitors: Array<{ name: string; domain: string }> = brand.competitors
      ? JSON.parse(brand.competitors)
      : [];

    const probeQueries = [
      { query: `best ${topic}`, category: "best-of" },
      { query: `${topic} vs alternatives comparison`, category: "comparison" },
      { query: `recommended ${topic} solutions`, category: "recommendation" },
      { query: `how to choose ${topic}`, category: "how-to" },
    ];

    const competitiveData = await runCompetitiveAnalysis(
      brand.name,
      brand.domain,
      competitors,
      probeQueries as Array<{ query: string; category: import("@/lib/citation/prompt-builder").ProbeCategory }>
    );

    const brief = await generateContentBrief(
      brand.name,
      brand.domain,
      topic,
      competitiveData,
      keywords
    );

    return NextResponse.json(brief);
  } catch (error) {
    console.error("Failed to generate content brief:", error);
    return NextResponse.json(
      { error: "Failed to generate content brief" },
      { status: 500 }
    );
  }
}
