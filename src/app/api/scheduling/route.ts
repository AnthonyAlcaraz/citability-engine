import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { scheduleJob, listJobs, stopJob } from "@/lib/monitoring/scheduler";
import { runBatchProbes } from "@/lib/monitoring/batch-runner";

export async function GET() {
  try {
    const jobs = listJobs();

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Failed to list scheduled jobs:", error);
    return NextResponse.json(
      { error: "Failed to list scheduled jobs" },
      { status: 500 }
    );
  }
}

const createJobSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cron: z.string().min(1, "Cron expression is required"),
  brandId: z.string().optional(),
  probeIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, cron, brandId, probeIds } = parsed.data;

    const schedule = await prisma.monitoringSchedule.create({
      data: {
        name,
        cron,
        probeIds: JSON.stringify(probeIds ?? []),
        isActive: true,
      },
    });

    scheduleJob(schedule.id, name, cron, async () => {
      await runBatchProbes(brandId, probeIds);
      await prisma.monitoringSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: new Date() },
      });
    });

    return NextResponse.json(
      {
        id: schedule.id,
        name: schedule.name,
        cron: schedule.cron,
        isActive: schedule.isActive,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create scheduled job:", error);
    return NextResponse.json(
      { error: "Failed to create scheduled job" },
      { status: 500 }
    );
  }
}

const deleteJobSchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
});

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = deleteJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { jobId } = parsed.data;

    const schedule = await prisma.monitoringSchedule.findUnique({
      where: { id: jobId },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Scheduled job not found" },
        { status: 404 }
      );
    }

    stopJob(jobId);

    await prisma.monitoringSchedule.delete({
      where: { id: jobId },
    });

    return NextResponse.json({ message: "Scheduled job deleted" });
  } catch (error) {
    console.error("Failed to delete scheduled job:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled job" },
      { status: 500 }
    );
  }
}
