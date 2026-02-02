import { Router, Request, Response } from "express";
import { getJobStats } from "../lib/job-manager";

const router = Router();

/**
 * GET /healthz
 * Health check endpoint
 */
router.get("/healthz", (req: Request, res: Response) => {
  const stats = getJobStats();

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    jobs: stats,
  });
});

/**
 * GET /health
 * Alias for /healthz
 */
router.get("/health", (req: Request, res: Response) => {
  const stats = getJobStats();

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    jobs: stats,
  });
});

export default router;
