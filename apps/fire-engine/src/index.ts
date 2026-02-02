import express from "express";
import bodyParser from "body-parser";
import { config } from "./config";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middleware/auth";
import { startJobCleanup, stopJobCleanup } from "./lib/job-manager";
import { closeBrowser } from "./engines/playwright";

// Import routes
import healthRoutes from "./routes/health";
import scrapeRoutes from "./routes/scrape";
import statusRoutes from "./routes/status";
import deleteRoutes from "./routes/delete";

const app = express();

// Middleware
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? "warn" : "debug";
    logger.log(logLevel, "Request completed", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
});

// Health routes (no auth required)
app.use(healthRoutes);

// Auth middleware for protected routes
app.use(authMiddleware);

// Protected routes
app.use(scrapeRoutes);
app.use(statusRoutes);
app.use(deleteRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown handler
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  stopJobCleanup();
  await closeBrowser();

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start server
const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`Fire Engine started`, {
    host: config.HOST,
    port: config.PORT,
    authEnabled: !!config.AUTH_TOKEN,
    maxConcurrentPages: config.MAX_CONCURRENT_PAGES,
    stealthEnabled: config.STEALTH_ENABLED,
  });

  // Start job cleanup
  startJobCleanup();
});

export default app;
