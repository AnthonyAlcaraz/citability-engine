import cron from "node-cron";

export interface ScheduledJob {
  id: string;
  name: string;
  cron: string;
  handler: () => Promise<void>;
  isRunning: boolean;
  lastRun: Date | null;
  lastError: string | null;
  nextRun: Date | null;
}

interface JobEntry {
  task: cron.ScheduledTask;
  meta: ScheduledJob;
}

// In-memory job registry
const jobs = new Map<string, JobEntry>();

function computeNextRun(cronExpr: string): Date | null {
  try {
    const interval = cron.getTasks();
    // node-cron doesn't expose next run natively, approximate from expression
    // Return null as node-cron lacks built-in next-run computation
    return null;
  } catch {
    return null;
  }
}

export function scheduleJob(
  id: string,
  name: string,
  cronExpr: string,
  handler: () => Promise<void>
): ScheduledJob {
  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid cron expression: ${cronExpr}`);
  }

  // Stop existing job with same id if present
  const existing = jobs.get(id);
  if (existing) {
    existing.task.stop();
    jobs.delete(id);
  }

  const meta: ScheduledJob = {
    id,
    name,
    cron: cronExpr,
    handler,
    isRunning: false,
    lastRun: null,
    lastError: null,
    nextRun: null,
  };

  const wrappedHandler = async (): Promise<void> => {
    if (meta.isRunning) {
      return; // Prevent overlapping runs
    }

    meta.isRunning = true;
    meta.lastError = null;

    try {
      await handler();
    } catch (error) {
      meta.lastError =
        error instanceof Error ? error.message : String(error);
    } finally {
      meta.isRunning = false;
      meta.lastRun = new Date();
    }
  };

  const task = cron.schedule(cronExpr, () => {
    void wrappedHandler();
  });

  jobs.set(id, { task, meta });

  return meta;
}

export function stopJob(id: string): boolean {
  const entry = jobs.get(id);
  if (!entry) {
    return false;
  }

  entry.task.stop();
  jobs.delete(id);
  return true;
}

export function getJob(id: string): ScheduledJob | null {
  const entry = jobs.get(id);
  return entry ? entry.meta : null;
}

export function listJobs(): ScheduledJob[] {
  return Array.from(jobs.values()).map((entry) => entry.meta);
}

export function stopAllJobs(): void {
  for (const [id, entry] of jobs) {
    entry.task.stop();
  }
  jobs.clear();
}
