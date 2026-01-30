import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings/config";

function maskApiKey(key: string | undefined): string | undefined {
  if (!key || key.length < 8) return undefined;
  return `${"*".repeat(key.length - 4)}${key.slice(-4)}`;
}

function maskSettingsKeys(
  settings: Record<string, unknown>
): Record<string, unknown> {
  const masked = { ...settings };

  const apiKeyFields = [
    "openaiApiKey",
    "anthropicApiKey",
    "googleApiKey",
    "perplexityApiKey",
  ];

  for (const field of apiKeyFields) {
    if (typeof masked[field] === "string") {
      masked[field] = maskApiKey(masked[field] as string);
    }
  }

  return masked;
}

export async function GET() {
  try {
    const settings = await getSettings();
    const masked = maskSettingsKeys(
      settings as unknown as Record<string, unknown>
    );

    return NextResponse.json(masked);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const updated = await updateSettings(body);
    const masked = maskSettingsKeys(
      updated as unknown as Record<string, unknown>
    );

    return NextResponse.json(masked);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
