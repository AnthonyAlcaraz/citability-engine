import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { markAllAlertsRead } from "@/lib/monitoring/alert-engine";

const readAllSchema = z.object({
  brandId: z.string().min(1, "Brand ID is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = readAllSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { brandId } = parsed.data;

    await markAllAlertsRead(brandId);

    return NextResponse.json({
      message: "All alerts marked as read",
    });
  } catch (error) {
    console.error("Failed to mark all alerts as read:", error);
    return NextResponse.json(
      { error: "Failed to mark all alerts as read" },
      { status: 500 }
    );
  }
}
