import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { scoreContent } from "@/lib/scoring/aeo-scorer";

const validateSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  skipCitationTest: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = validateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { contentId, skipCitationTest } = parsed.data;

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

    const aeoScore = await scoreContent(
      content.body,
      content.schemaMarkup ?? "",
      content.brand.name,
      content.brand.domain,
      keywords,
      competitors,
      skipCitationTest
    );

    await prisma.content.update({
      where: { id: contentId },
      data: { aeoScore: aeoScore.overall },
    });

    return NextResponse.json(aeoScore);
  } catch (error) {
    console.error("Failed to validate AEO score:", error);
    return NextResponse.json(
      { error: "Failed to validate AEO score" },
      { status: 500 }
    );
  }
}
