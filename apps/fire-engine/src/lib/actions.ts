import { Page } from "playwright";
import { Action } from "../types/request";
import { ActionResult } from "../types/response";
import { logger } from "./logger";

export interface ActionExecutionResult {
  screenshots: string[];
  scrapes: { url: string; html: string }[];
  actionResults: ActionResult[];
}

/**
 * Execute a list of browser actions and collect results
 */
export async function executeActions(
  page: Page,
  actions: Action[]
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    screenshots: [],
    scrapes: [],
    actionResults: [],
  };

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const actionLogger = logger.child({ actionIndex: i, actionType: action.type });

    try {
      actionLogger.debug("Executing action", { action });

      switch (action.type) {
        case "wait":
          await executeWait(page, action.milliseconds ?? 1000);
          break;

        case "click":
          await executeClick(page, action.selector);
          break;

        case "type":
          await executeType(page, action.selector, action.text);
          break;

        case "scroll":
          await executeScroll(page, action.direction, action.amount, action.selector);
          break;

        case "screenshot": {
          const screenshot = await executeScreenshot(page, action.fullPage, action.viewport);
          result.screenshots.push(screenshot);
          result.actionResults.push({
            idx: i,
            type: "screenshot",
            result: { base64: screenshot },
          });
          break;
        }

        case "scrape": {
          const scrapeResult = await executeScrape(page, action.selector);
          result.scrapes.push(scrapeResult);
          result.actionResults.push({
            idx: i,
            type: "scrape",
            result: scrapeResult,
          });
          break;
        }

        case "executeJavascript": {
          const jsResult = await executeJavascript(page, action.script);
          result.actionResults.push({
            idx: i,
            type: "executeJavascript",
            result: { return: jsResult },
          });
          break;
        }

        case "pdf": {
          // PDF generation - return placeholder for self-hosted
          // Full implementation would save PDF and return URL
          actionLogger.warn("PDF action not fully implemented in self-hosted mode");
          result.actionResults.push({
            idx: i,
            type: "pdf",
            result: { link: "pdf-not-supported-in-self-hosted" },
          });
          break;
        }

        default:
          actionLogger.warn("Unknown action type", { action });
      }

      actionLogger.debug("Action completed successfully");
    } catch (error) {
      actionLogger.error("Action failed", { error });
      throw new ActionError(
        `Action ${action.type} at index ${i} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

async function executeWait(page: Page, milliseconds: number): Promise<void> {
  // Cap wait time at 30 seconds
  const cappedMs = Math.min(milliseconds, 30000);
  await page.waitForTimeout(cappedMs);
}

async function executeClick(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector);
}

async function executeType(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.fill(selector, text);
}

async function executeScroll(
  page: Page,
  direction: "up" | "down" = "down",
  amount?: number,
  selector?: string
): Promise<void> {
  if (selector) {
    const element = await page.$(selector);
    if (element) {
      await element.scrollIntoViewIfNeeded();
    }
  } else {
    const scrollAmount = amount ?? 500;
    const scrollY = direction === "down" ? scrollAmount : -scrollAmount;
    await page.evaluate((y) => window.scrollBy(0, y), scrollY);
  }
}

async function executeScreenshot(
  page: Page,
  fullPage: boolean = false,
  viewport?: { width: number; height: number }
): Promise<string> {
  if (viewport) {
    await page.setViewportSize(viewport);
  }

  const buffer = await page.screenshot({
    fullPage,
    type: "png",
  });

  return buffer.toString("base64");
}

async function executeScrape(
  page: Page,
  selector?: string
): Promise<{ url: string; html: string }> {
  let html: string;

  if (selector) {
    const element = await page.$(selector);
    if (element) {
      html = await element.innerHTML();
    } else {
      html = "";
    }
  } else {
    html = await page.content();
  }

  return {
    url: page.url(),
    html,
  };
}

async function executeJavascript(page: Page, script: string): Promise<string> {
  const result = await page.evaluate((code) => {
    try {
      // eslint-disable-next-line no-eval
      const evalResult = eval(code);
      return JSON.stringify(evalResult);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, script);

  return result;
}

/**
 * Custom error for action failures
 */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}
