import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import { deleteJob, getJob } from "../lib/job-manager";

const router = Router();

/**
 * DELETE /v1/scrape/:jobId
 * Delete/cleanup a scrape job
 */
router.delete("/v1/scrape/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;

  const job = getJob(jobId);
  if (!job) {
    // Return success even if not found (idempotent)
    res.json({ success: true, message: "Job not found or already deleted" });
    return;
  }

  const deleted = deleteJob(jobId);
  logger.debug("Job deletion requested", { jobId, deleted });

  res.json({ success: deleted });
});

/**
 * DELETE /scrape/:jobId
 * Legacy endpoint (without /v1 prefix)
 */
router.delete("/scrape/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;

  const deleted = deleteJob(jobId);
  res.json({ success: deleted || true }); // Idempotent
});

export default router;
