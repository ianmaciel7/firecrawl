import { chromium, Browser, BrowserContext, Page, devices } from "playwright";
import UserAgent from "user-agents";
import { config } from "../config";
import { logger, createChildLogger } from "../lib/logger";
import { ScrapeRequest } from "../types/request";
import { SuccessResponse, BlockedReason } from "../types/response";
import { detectBlock, shouldRetryWithStealth } from "../lib/block-detection";
import { getProxyConfig, formatProxyForPlaywright } from "../lib/proxy";
import { executeActions, ActionError } from "../lib/actions";

// Browser pool for reuse
let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

// Concurrency control
let activePages = 0;
const pageQueue: Array<{
  resolve: (value: void) => void;
  reject: (reason: unknown) => void;
}> = [];

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = (async () => {
    logger.info("Launching browser instance");

    browserInstance = await chromium.launch({
      headless: config.HEADLESS,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    browserInstance.on("disconnected", () => {
      logger.warn("Browser disconnected");
      browserInstance = null;
      browserLaunchPromise = null;
    });

    return browserInstance;
  })();

  return browserLaunchPromise;
}

/**
 * Acquire a page slot (concurrency control)
 */
async function acquirePageSlot(): Promise<void> {
  if (activePages < config.MAX_CONCURRENT_PAGES) {
    activePages++;
    return;
  }

  return new Promise((resolve, reject) => {
    pageQueue.push({ resolve, reject });
  });
}

/**
 * Release a page slot
 */
function releasePageSlot(): void {
  if (pageQueue.length > 0) {
    const next = pageQueue.shift();
    next?.resolve();
  } else {
    activePages--;
  }
}

/**
 * Apply stealth techniques to browser context
 */
async function applyStealthSettings(context: BrowserContext): Promise<void> {
  // Override navigator properties
  await context.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Hide automation indicators
    // @ts-ignore
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    // @ts-ignore
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    // @ts-ignore
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

    // Override chrome runtime
    // @ts-ignore
    window.chrome = {
      runtime: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      (parameters as any).name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    // Override plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    // Override platform
    Object.defineProperty(navigator, "platform", {
      get: () => "Win32",
    });

    // Override hardware concurrency
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => 8,
    });

    // Override device memory
    Object.defineProperty(navigator, "deviceMemory", {
      get: () => 8,
    });
  });
}

/**
 * Media blocking domains
 */
const AD_SERVING_DOMAINS = [
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "googletagmanager.com",
  "facebook.net",
  "fbcdn.net",
  "amazon-adsystem.com",
  "adsrvr.org",
  "adnxs.com",
  "rubiconproject.com",
  "pubmatic.com",
  "criteo.com",
  "outbrain.com",
  "taboola.com",
];

const MEDIA_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".mp3",
  ".wav",
  ".ogg",
  ".gif",
  ".webp",
];

/**
 * Main scrape function using Playwright
 */
export async function scrapeWithPlaywright(
  request: ScrapeRequest,
  jobId: string
): Promise<SuccessResponse> {
  const scrapeLogger = createChildLogger({ jobId, url: request.url });
  const startTime = Date.now();

  await acquirePageSlot();
  scrapeLogger.info("Acquired page slot", { activePages });

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const browser = await getBrowser();

    // Build context options
    const contextOptions: Parameters<Browser["newContext"]>[0] = {
      ignoreHTTPSErrors: request.skipTlsVerification,
      javaScriptEnabled: true,
    };

    // Set user agent
    if (request.userAgent) {
      contextOptions.userAgent = request.userAgent;
    } else {
      // Generate random user agent for stealth
      const userAgent = new UserAgent({ deviceCategory: request.mobile ? "mobile" : "desktop" });
      contextOptions.userAgent = userAgent.toString();
    }

    // Set viewport
    if (request.mobile) {
      const mobileDevice = devices["iPhone 12"];
      contextOptions.viewport = mobileDevice.viewport;
      contextOptions.userAgent = mobileDevice.userAgent;
      contextOptions.deviceScaleFactor = mobileDevice.deviceScaleFactor;
      contextOptions.isMobile = true;
      contextOptions.hasTouch = true;
    } else {
      contextOptions.viewport = { width: 1920, height: 1080 };
    }

    // Set geolocation
    if (request.geolocation) {
      contextOptions.locale = request.geolocation.languages?.[0] ?? "en-US";
      // Note: actual geolocation requires permissions
    }

    // Set proxy
    const proxyConfig = getProxyConfig(request.proxy, request.proxyProfile);
    if (proxyConfig) {
      contextOptions.proxy = formatProxyForPlaywright(proxyConfig);
      scrapeLogger.debug("Using proxy", { server: proxyConfig.server });
    }

    // Create context
    context = await browser.newContext(contextOptions);

    // Apply stealth settings if enabled
    if (request.stealth ?? config.STEALTH_ENABLED) {
      await applyStealthSettings(context);
      scrapeLogger.debug("Stealth mode enabled");
    }

    // Set custom headers
    if (request.headers) {
      await context.setExtraHTTPHeaders(request.headers);
    }

    // Set cookies
    if (request.cookies) {
      const cookiesForPlaywright = request.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain ?? new URL(request.url).hostname,
        path: c.path ?? "/",
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as "Strict" | "Lax" | "None" | undefined,
      }));
      await context.addCookies(cookiesForPlaywright);
    }

    // Create page
    page = await context.newPage();

    // Set up request interception for blocking
    if (request.blockMedia || request.blockAds) {
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        const resourceType = route.request().resourceType();

        // Block ads
        if (request.blockAds) {
          for (const domain of AD_SERVING_DOMAINS) {
            if (url.includes(domain)) {
              return route.abort();
            }
          }
        }

        // Block media
        if (request.blockMedia) {
          if (["media", "font"].includes(resourceType)) {
            return route.abort();
          }
          for (const ext of MEDIA_EXTENSIONS) {
            if (url.toLowerCase().includes(ext)) {
              return route.abort();
            }
          }
        }

        return route.continue();
      });
    }

    // Navigate to URL
    scrapeLogger.debug("Navigating to URL");
    const response = await page.goto(request.url, {
      waitUntil: request.waitUntil ?? "load",
      timeout: request.timeout ?? config.PAGE_LOAD_TIMEOUT_MS,
    });

    // Wait for selector if specified
    if (request.waitForSelector) {
      scrapeLogger.debug("Waiting for selector", { selector: request.waitForSelector });
      await page.waitForSelector(request.waitForSelector, {
        timeout: Math.min(request.timeout ?? 30000, 30000),
      });
    }

    // Wait additional time if specified
    if (request.wait && request.wait > 0) {
      await page.waitForTimeout(Math.min(request.wait, 30000));
    }

    // Get response info
    const statusCode = response?.status() ?? 0;
    const responseHeaders: Record<string, string> = {};
    if (response) {
      for (const [key, value] of Object.entries(response.headers())) {
        responseHeaders[key] = value;
      }
    }

    // Get page content
    let html = await page.content();
    const finalUrl = page.url();

    // Execute actions if provided
    let actionResult;
    if (request.actions && request.actions.length > 0) {
      scrapeLogger.debug("Executing actions", { actionCount: request.actions.length });
      actionResult = await executeActions(page, request.actions);
      // Update HTML after actions
      html = await page.content();
    }

    // Take screenshot if requested (outside of actions)
    let screenshot: string | undefined;
    if (request.screenshot || request.fullPageScreenshot) {
      const buffer = await page.screenshot({
        fullPage: request.fullPageScreenshot,
        type: "png",
      });
      screenshot = buffer.toString("base64");
    }

    // Check for blocking
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
      url: finalUrl,
      pageStatusCode: statusCode,
      responseHeaders,
      screenshot,
      screenshots: actionResult?.screenshots,
      actionContent: actionResult?.scrapes,
      actionResults: actionResult?.actionResults,
      blockedReason,
      usedMobileProxy: request.mobileProxy ?? false,
    };
  } catch (error) {
    const timeTaken = Date.now() - startTime;
    scrapeLogger.error("Scrape failed", { error, timeTaken });

    if (error instanceof ActionError) {
      throw error;
    }

    // Return error response
    return {
      jobId,
      timeTaken,
      content: "",
      pageStatusCode: 0,
      pageError: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Cleanup
    if (page) {
      try {
        await page.close();
      } catch (e) {
        scrapeLogger.warn("Failed to close page", { error: e });
      }
    }
    if (context) {
      try {
        await context.close();
      } catch (e) {
        scrapeLogger.warn("Failed to close context", { error: e });
      }
    }
    releasePageSlot();
    scrapeLogger.debug("Released page slot", { activePages });
  }
}

/**
 * Cleanup browser instance on shutdown
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    browserLaunchPromise = null;
    logger.info("Browser instance closed");
  }
}
