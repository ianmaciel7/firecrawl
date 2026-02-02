import { Router, Request, Response } from "express";
import { scrapeRequestSchema } from "../types/request";
import { logger } from "../lib/logger";
import { createJob, executeJob, startJobAsync } from "../lib/job-manager";
import { ZodError } from "zod";

const router = Router();

/**
 * POST /v1/scrape
 * Main scraping endpoint
 * Matches the Fire Engine API contract
 */
router.post("/v1/scrape", async (req: Request, res: Response) => {
  const requestId = req.headers["x-request-id"] ?? `req-${Date.now()}`;
  const requestLogger = logger.child({ requestId });

  try {
    // Validate request body
    const parseResult = scrapeRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      requestLogger.warn("Invalid request body", {
        errors: parseResult.error.errors,
      });
      res.status(400).json({
        error: "Invalid request body",
        details: parseResult.error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }

    const request = parseResult.data;
    requestLogger.info("Scrape request received", {
      url: request.url,
      engine: request.engine,
      instantReturn: request.instantReturn,
    });

    // Create job
    const job = createJob(request);

    // If instant return, start job in background and return immediately
    if (request.instantReturn) {
      startJobAsync(job);
      res.status(202).json({
        jobId: job.id,
        processing: true,
      });
      return;
    }

    // Execute synchronously
    const result = await executeJob(job);

    // Check if it's an error response
    if ("error" in result && !("content" in result)) {
      res.status(500).json(result);
      return;
    }

    // Success response
    res.json(result);
  } catch (error) {
    requestLogger.error("Scrape request failed", { error });

    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * POST /scrape
 * Legacy endpoint (without /v1 prefix)
 * Redirects to /v1/scrape
 */
router.post("/scrape", async (req: Request, res: Response) => {
  res.redirect(307, "/v1/scrape");
});

export default router;
