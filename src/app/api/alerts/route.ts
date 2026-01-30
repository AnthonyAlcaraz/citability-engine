import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAlerts, runAlertChecks } from "@/lib/monitoring/alert-engine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    const unread = searchParams.get("unread");
    const limit = searchParams.get("limit");

    if (!brandId) {
      return NextResponse.json(
        { error: "brandId query parameter is required" },
        { status: 400 }
      );
    }

    const alerts = await getAlerts(brandId, {
      unreadOnly: unread === "true" ? true : undefined,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

const triggerSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = triggerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { brandId } = parsed.data;
    await runAlertChecks(brandId);

    const newAlerts = await getAlerts(brandId, { unreadOnly: true, limit: 5 });

    return NextResponse.json({
      count: newAlerts.length,
      message: `Alert check complete. ${newAlerts.length} unread alert${newAlerts.length === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    console.error("Failed to run alert checks:", error);
    return NextResponse.json(
      { error: "Failed to run alert checks" },
      { status: 500 }
    );
  }
}
