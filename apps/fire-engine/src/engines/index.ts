import { ScrapeRequest } from "../types/request";
import { SuccessResponse } from "../types/response";
import { scrapeWithPlaywright } from "./playwright";
import { scrapeWithTlsClient } from "./tlsclient";
import { logger } from "../lib/logger";

export type EngineType = "chrome-cdp" | "playwright" | "tlsclient";

/**
 * Main entry point for scraping - routes to appropriate engine
 */
export async function scrape(
  request: ScrapeRequest,
  jobId: string
): Promise<SuccessResponse> {
  const engine = request.engine ?? "chrome-cdp";

  logger.info("Routing scrape request", {
    jobId,
    url: request.url,
    engine,
  });

  switch (engine) {
    case "chrome-cdp":
    case "playwright":
      // Both use Playwright internally for self-hosted version
      // chrome-cdp is the same as playwright in this implementation
      // (the proprietary Fire Engine has different implementations)
      return scrapeWithPlaywright(request, jobId);

    case "tlsclient":
      // TLS client for HTTP-only scraping (no JS rendering)
      return scrapeWithTlsClient(request, jobId);

    default:
      logger.warn("Unknown engine type, defaulting to playwright", { engine });
      return scrapeWithPlaywright(request, jobId);
  }
}

/**
 * Get max reasonable time for an engine type
 */
export function getEngineMaxTime(request: ScrapeRequest): number {
  const engine = request.engine ?? "chrome-cdp";
  const baseTimeout = request.timeout ?? 300000;
  const waitTime = request.wait ?? 0;

  switch (engine) {
    case "tlsclient":
      return Math.min(15000, baseTimeout);

    case "playwright":
      return Math.min(waitTime + 30000, baseTimeout);

    case "chrome-cdp":
    default: {
      // Calculate action time
      let actionTime = 0;
      if (request.actions) {
        for (const action of request.actions) {
          if (action.type === "wait") {
            actionTime += action.milliseconds ?? 1000;
          } else {
            actionTime += 250; // Default time for other actions
          }
        }
      }
      return Math.min(waitTime + actionTime + 30000, baseTimeout);
    }
  }
}
