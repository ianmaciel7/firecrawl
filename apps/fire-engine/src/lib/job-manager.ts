import { v4 as uuidv4 } from "uuid";
import { config } from "../config";
import { logger } from "./logger";
import { ScrapeRequest } from "../types/request";
import { SuccessResponse, ErrorResponse, ProcessingResponse, JobStatusResponse } from "../types/response";
import { scrape } from "../engines";

export interface Job {
  id: string;
  request: ScrapeRequest;
  status: "queued" | "processing" | "completed" | "failed";
  result?: SuccessResponse | ErrorResponse;
  createdAt: Date;
  completedAt?: Date;
}

// In-memory job store
// For production, you might want to use Redis
const jobs = new Map<string, Job>();

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the job cleanup interval
 */
export function startJobCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const ttl = config.JOB_TTL_MS;

    for (const [jobId, job] of jobs) {
      const age = now - job.createdAt.getTime();
      if (age > ttl) {
        jobs.delete(jobId);
        logger.debug("Cleaned up expired job", { jobId, age });
      }
    }
  }, config.JOB_CLEANUP_INTERVAL_MS);

  logger.info("Job cleanup started", { intervalMs: config.JOB_CLEANUP_INTERVAL_MS });
}

/**
 * Stop the job cleanup interval
 */
export function stopJobCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info("Job cleanup stopped");
  }
}

/**
 * Create a new job
 */
export function createJob(request: ScrapeRequest): Job {
  const job: Job = {
    id: uuidv4(),
    request,
    status: "queued",
    createdAt: new Date(),
  };

  jobs.set(job.id, job);
  logger.debug("Job created", { jobId: job.id, url: request.url });

  return job;
}

/**
 * Get a job by ID
 */
export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

/**
 * Delete a job by ID
 */
export function deleteJob(jobId: string): boolean {
  const deleted = jobs.delete(jobId);
  if (deleted) {
    logger.debug("Job deleted", { jobId });
  }
  return deleted;
}

/**
 * Update job status
 */
export function updateJobStatus(
  jobId: string,
  status: Job["status"],
  result?: SuccessResponse | ErrorResponse
): void {
  const job = jobs.get(jobId);
  if (job) {
    job.status = status;
    if (result) {
      job.result = result;
    }
    if (status === "completed" || status === "failed") {
      job.completedAt = new Date();
    }
    logger.debug("Job status updated", { jobId, status });
  }
}

/**
 * Execute a scrape job synchronously (for instantReturn=false)
 */
export async function executeJob(job: Job): Promise<SuccessResponse | ErrorResponse> {
  updateJobStatus(job.id, "processing");

  try {
    const result = await scrape(job.request, job.id);

    if (result.pageError && !result.content) {
      updateJobStatus(job.id, "failed", { error: result.pageError });
      return { error: result.pageError };
    }

    updateJobStatus(job.id, "completed", result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorResult: ErrorResponse = { error: errorMessage };
    updateJobStatus(job.id, "failed", errorResult);
    return errorResult;
  }
}

/**
 * Start a job in the background (for instantReturn=true)
 */
export function startJobAsync(job: Job): void {
  // Execute in background
  executeJob(job).catch((error) => {
    logger.error("Background job failed", { jobId: job.id, error });
  });
}

/**
 * Get job status response
 */
export function getJobStatus(jobId: string): JobStatusResponse | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }

  if (job.status === "queued" || job.status === "processing") {
    return {
      jobId: job.id,
      processing: true,
    } as ProcessingResponse;
  }

  if (job.result) {
    return job.result;
  }

  // Should not happen, but return processing as fallback
  return {
    jobId: job.id,
    processing: true,
  } as ProcessingResponse;
}

/**
 * Get job statistics
 */
export function getJobStats(): {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
} {
  let queued = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;

  for (const job of jobs.values()) {
    switch (job.status) {
      case "queued":
        queued++;
        break;
      case "processing":
        processing++;
        break;
      case "completed":
        completed++;
        break;
      case "failed":
        failed++;
        break;
    }
  }

  return {
    total: jobs.size,
    queued,
    processing,
    completed,
    failed,
  };
}
