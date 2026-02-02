import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import { getJobStatus, getJob } from "../lib/job-manager";

const router = Router();

/**
 * GET /v1/scrape/:jobId
 * Check status of an async scrape job
 */
router.get("/v1/scrape/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;

  const status = getJobStatus(jobId);

  if (!status) {
    res.status(404).json({
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    });
    return;
  }

  // If still processing, return 202
  if ("processing" in status && status.processing) {
    res.status(202).json(status);
    return;
  }

  // Return result
  res.json(status);
});

/**
 * GET /scrape/:jobId
 * Legacy endpoint (without /v1 prefix)
 */
router.get("/scrape/:jobId", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const status = getJobStatus(jobId);

  if (!status) {
    res.status(404).json({
      error: "Job not found",
      code: "JOB_NOT_FOUND",
    });
    return;
  }

  if ("processing" in status && status.processing) {
    res.status(202).json(status);
    return;
  }

  res.json(status);
});

export default router;
