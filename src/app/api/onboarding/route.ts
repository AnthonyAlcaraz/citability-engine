import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSettings, updateSettings } from "@/lib/settings/config";
import type { AppSettings } from "@/lib/settings/config";
import { runBatchProbes } from "@/lib/monitoring/batch-runner";

interface OnboardingStep {
  id: string;
  label: string;
  complete: boolean;
}

export async function GET() {
  try {
    const [brandCount, providerKeys, probeCount, citationCount] =
      await Promise.all([
        prisma.brand.count(),
        getSettings(),
        prisma.probe.count(),
        prisma.citationResult.count(),
      ]);

    const settings = providerKeys as unknown as Record<string, unknown>;
    const hasProviderKey =
      !!settings.openaiApiKey ||
      !!settings.anthropicApiKey ||
      !!settings.googleApiKey ||
      !!settings.perplexityApiKey;

    const steps: OnboardingStep[] = [
      {
        id: "brand",
        label: "Create your first brand",
        complete: brandCount > 0,
      },
      {
        id: "providers",
        label: "Configure at least one AI provider API key",
        complete: hasProviderKey,
      },
      {
        id: "probes",
        label: "Create your first probe queries",
        complete: probeCount > 0,
      },
      {
        id: "first-run",
        label: "Run your first citation check",
        complete: citationCount > 0,
      },
    ];

    const setupComplete = steps.every((step) => step.complete);

    return NextResponse.json({ setupComplete, steps });
  } catch (error) {
    console.error("Failed to fetch onboarding status:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}

const brandStepSchema = z.object({
  name: z.string().min(1),
  domain: z.string().url(),
  description: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  competitors: z
    .array(z.object({ name: z.string(), domain: z.string() }))
    .default([]),
});

const providersStepSchema = z.object({
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),
  perplexityApiKey: z.string().optional(),
});

const probesStepSchema = z.object({
  brandId: z.string().min(1),
  probes: z.array(
    z.object({
      query: z.string().min(1),
      category: z.string().min(1),
    })
  ),
});

const firstRunStepSchema = z.object({
  brandId: z.string().min(1),
});

const onboardingSchema = z.object({
  step: z.enum(["brand", "providers", "probes", "first-run"]),
  data: z.record(z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { step, data } = parsed.data;

    switch (step) {
      case "brand": {
        const brandData = brandStepSchema.safeParse(data);
        if (!brandData.success) {
          return NextResponse.json(
            { error: "Invalid brand data", details: brandData.error.flatten() },
            { status: 400 }
          );
        }

        const brand = await prisma.brand.create({
          data: {
            name: brandData.data.name,
            domain: brandData.data.domain,
            description: brandData.data.description,
            keywords: JSON.stringify(brandData.data.keywords),
            competitors: JSON.stringify(brandData.data.competitors),
          },
        });

        return NextResponse.json({ brand }, { status: 201 });
      }

      case "providers": {
        const providerData = providersStepSchema.safeParse(data);
        if (!providerData.success) {
          return NextResponse.json(
            {
              error: "Invalid provider data",
              details: providerData.error.flatten(),
            },
            { status: 400 }
          );
        }

        const providerSettings: Record<string, { enabled: boolean; apiKey: string; dailyBudget: number }> = {};
        if (providerData.data.openaiApiKey) {
          providerSettings.openai = { enabled: true, apiKey: providerData.data.openaiApiKey, dailyBudget: 5 };
        }
        if (providerData.data.anthropicApiKey) {
          providerSettings.anthropic = { enabled: true, apiKey: providerData.data.anthropicApiKey, dailyBudget: 5 };
        }
        if (providerData.data.googleApiKey) {
          providerSettings.google = { enabled: true, apiKey: providerData.data.googleApiKey, dailyBudget: 5 };
        }
        if (providerData.data.perplexityApiKey) {
          providerSettings.perplexity = { enabled: true, apiKey: providerData.data.perplexityApiKey, dailyBudget: 5 };
        }
        await updateSettings({ providers: providerSettings } as Partial<AppSettings>);

        return NextResponse.json({ message: "Provider keys saved" });
      }

      case "probes": {
        const probeData = probesStepSchema.safeParse(data);
        if (!probeData.success) {
          return NextResponse.json(
            { error: "Invalid probe data", details: probeData.error.flatten() },
            { status: 400 }
          );
        }

        const brand = await prisma.brand.findUnique({
          where: { id: probeData.data.brandId },
        });

        if (!brand) {
          return NextResponse.json(
            { error: "Brand not found" },
            { status: 404 }
          );
        }

        const probes = await prisma.$transaction(
          probeData.data.probes.map((probe) =>
            prisma.probe.create({
              data: {
                brandId: probeData.data.brandId,
                query: probe.query,
                category: probe.category,
                isActive: true,
              },
            })
          )
        );

        return NextResponse.json({ probes }, { status: 201 });
      }

      case "first-run": {
        const runData = firstRunStepSchema.safeParse(data);
        if (!runData.success) {
          return NextResponse.json(
            { error: "Invalid run data", details: runData.error.flatten() },
            { status: 400 }
          );
        }

        const probes = await prisma.probe.findMany({
          where: { brandId: runData.data.brandId, isActive: true },
          select: { id: true },
        });

        const probeIds = probes.map((p) => p.id);

        await runBatchProbes(runData.data.brandId, probeIds);

        // Check if all steps are now complete
        const [brandCount, settings, probeCount, citationCount] =
          await Promise.all([
            prisma.brand.count(),
            getSettings(),
            prisma.probe.count(),
            prisma.citationResult.count(),
          ]);

        const settingsObj = settings as unknown as Record<string, unknown>;
        const hasProviderKey =
          !!settingsObj.openaiApiKey ||
          !!settingsObj.anthropicApiKey ||
          !!settingsObj.googleApiKey ||
          !!settingsObj.perplexityApiKey;

        const allComplete =
          brandCount > 0 && hasProviderKey && probeCount > 0 && citationCount > 0;

        if (allComplete) {
          await updateSettings({ general: { brandName: "", brandDomain: "", setupComplete: true, timezone: "UTC" } });
        }

        return NextResponse.json({
          message: "First citation run completed",
          setupComplete: allComplete,
        });
      }

      default: {
        return NextResponse.json(
          { error: `Unknown onboarding step: ${step}` },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error("Failed to process onboarding step:", error);
    return NextResponse.json(
      { error: "Failed to process onboarding step" },
      { status: 500 }
    );
  }
}
