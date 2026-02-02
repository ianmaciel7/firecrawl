import { request as undiciRequest, Agent, ProxyAgent } from "undici";
import { config } from "../config";
import { createChildLogger } from "../lib/logger";
import { ScrapeRequest } from "../types/request";
import { SuccessResponse, BlockedReason } from "../types/response";
import { detectBlock } from "../lib/block-detection";
import { getProxyConfig } from "../lib/proxy";

// Common browser user agents
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * TLS client scraping - HTTP only, no JavaScript rendering
 * Useful for simple pages or as a fast first attempt
 */
export async function scrapeWithTlsClient(
  scrapeRequest: ScrapeRequest,
  jobId: string
): Promise<SuccessResponse> {
  const scrapeLogger = createChildLogger({ jobId, url: scrapeRequest.url, engine: "tlsclient" });
  const startTime = Date.now();

  try {
    // Build headers
    const headers: Record<string, string> = {
      "User-Agent": scrapeRequest.userAgent ?? getRandomUserAgent(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      ...scrapeRequest.headers,
    };

    // Build request options
    const requestOptions: Parameters<typeof undiciRequest>[1] = {
      method: "GET",
      headers,
      maxRedirections: 10,
      bodyTimeout: scrapeRequest.timeout ?? 15000,
      headersTimeout: scrapeRequest.timeout ?? 15000,
    };

    // Handle proxy
    const proxyConfig = getProxyConfig(scrapeRequest.proxy, scrapeRequest.proxyProfile);
    if (proxyConfig) {
      scrapeLogger.debug("Using proxy", { server: proxyConfig.server });
      requestOptions.dispatcher = new ProxyAgent({
        uri: proxyConfig.server,
        token:
          proxyConfig.username && proxyConfig.password
            ? `Basic ${Buffer.from(`${proxyConfig.username}:${proxyConfig.password}`).toString("base64")}`
            : undefined,
      });
    }

    // Handle TLS verification
    if (scrapeRequest.skipTlsVerification) {
      requestOptions.dispatcher =
        requestOptions.dispatcher ??
        new Agent({
          connect: {
            rejectUnauthorized: false,
          },
        });
    }

    scrapeLogger.debug("Making HTTP request");
    const response = await undiciRequest(scrapeRequest.url, requestOptions);

    // Get response headers
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === "string") {
        responseHeaders[key] = value;
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(", ");
      }
    }

    // Get content
    const buffer = await response.body.arrayBuffer();
    let html = new TextDecoder("utf-8").decode(buffer);

    // Try to detect charset from content-type or meta tags
    const contentType = responseHeaders["content-type"] ?? "";
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch && charsetMatch[1].toLowerCase() !== "utf-8") {
      try {
        html = new TextDecoder(charsetMatch[1]).decode(buffer);
      } catch {
        // Keep UTF-8 decoded content
      }
    }

    // Check for blocking
    const statusCode = response.statusCode;
    const blockResult = detectBlock(statusCode, html, responseHeaders);
    let blockedReason: BlockedReason | undefined;

    if (blockResult.isBlocked && blockResult.confidence >= 0.5) {
      scrapeLogger.warn("Blocking detected", {
        reason: blockResult.reason,
        confidence: blockResult.confidence,
      });
      blockedReason = blockResult.reason;
    }

    const timeTaken = Date.now() - startTime;
    scrapeLogger.info("Scrape completed", {
      statusCode,
      contentLength: html.length,
      timeTaken,
      blocked: blockResult.isBlocked,
    });

    return {
      jobId,
      timeTaken,
      content: html,
      url: scrapeRequest.url, // Note: undici doesn't expose final URL after redirects easily
      pageStatusCode: statusCode,
      responseHeaders,
      blockedReason,
      usedMobileProxy: scrapeRequest.mobileProxy ?? false,
    };
  } catch (error) {
    const timeTaken = Date.now() - startTime;
    scrapeLogger.error("Scrape failed", { error, timeTaken });

    return {
      jobId,
      timeTaken,
      content: "",
      pageStatusCode: 0,
      pageError: error instanceof Error ? error.message : String(error),
    };
  }
}
