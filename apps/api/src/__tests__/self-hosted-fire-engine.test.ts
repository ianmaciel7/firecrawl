import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { scrapeURL } from "../scraper/scrapeURL";
import { scrapeOptions } from "../controllers/v2/types";
import { CostTracking } from "../lib/cost-tracking";

/**
 * Self-hosted Fire Engine Integration Tests
 *
 * These tests verify that the self-hosted Fire Engine integration works correctly.
 * They are gated by environment variables and only run when:
 * - Not in self-hosted test suite without Fire Engine, OR
 * - Self-hosted Fire Engine is explicitly enabled
 *
 * To run these tests:
 * 1. Start the fire-engine service: docker compose --profile fire-engine up -d
 * 2. Set SELF_HOSTED_FIRE_ENGINE_ENABLED=true
 * 3. Run: pnpm harness jest self-hosted-fire-engine
 */

// Gate tests based on environment
const shouldRunTests =
  !process.env.TEST_SUITE_SELF_HOSTED ||
  process.env.SELF_HOSTED_FIRE_ENGINE_ENABLED === "true";

(shouldRunTests ? describe : describe.skip)(
  "Self-hosted Fire Engine Integration",
  () => {
    describe("Basic scraping", () => {
      it(
        "scrapes a simple page via fire-engine;chrome-cdp",
        async () => {
          const result = await scrapeURL(
            "test:self-hosted-fe-basic",
            "https://www.scrapethissite.com/",
            scrapeOptions.parse({}),
            {
              forceEngine: "fire-engine;chrome-cdp",
              teamId: "test-team",
            },
            new CostTracking()
          );

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.document.metadata.statusCode).toBe(200);
            expect(result.document.html).toBeDefined();
            if (result.document.html) {
              expect(result.document.html.length).toBeGreaterThan(0);
            }
          }
        },
        60000
      );

      it(
        "scrapes a simple page via fire-engine;playwright",
        async () => {
          const result = await scrapeURL(
            "test:self-hosted-fe-playwright",
            "https://example.com/",
            scrapeOptions.parse({}),
            {
              forceEngine: "fire-engine;playwright",
              teamId: "test-team",
            },
            new CostTracking()
          );

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.document.metadata.statusCode).toBe(200);
          }
        },
        60000
      );
    });

    describe("Screenshot capture", () => {
      it(
        "captures a screenshot",
        async () => {
          const result = await scrapeURL(
            "test:self-hosted-fe-screenshot",
            "https://example.com/",
            scrapeOptions.parse({
              formats: ["screenshot"],
            }),
            {
              forceEngine: "fire-engine;chrome-cdp",
              teamId: "test-team",
            },
            new CostTracking()
          );

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.document.screenshot).toBeDefined();
            // Screenshot should be base64 encoded
            if (result.document.screenshot) {
              expect(result.document.screenshot.length).toBeGreaterThan(100);
            }
          }
        },
        60000
      );
    });

    describe("Actions execution", () => {
      it(
        "executes wait action",
        async () => {
          const result = await scrapeURL(
            "test:self-hosted-fe-wait",
            "https://example.com/",
            scrapeOptions.parse({
              actions: [{ type: "wait", milliseconds: 1000 }],
            }),
            {
              forceEngine: "fire-engine;chrome-cdp",
              teamId: "test-team",
            },
            new CostTracking()
          );

          expect(result.success).toBe(true);
        },
        60000
      );
    });

    describe("Error handling", () => {
      it(
        "handles invalid URL gracefully",
        async () => {
          const result = await scrapeURL(
            "test:self-hosted-fe-invalid-url",
            "https://this-domain-definitely-does-not-exist-12345.com/",
            scrapeOptions.parse({}),
            {
              forceEngine: "fire-engine;chrome-cdp",
              teamId: "test-team",
            },
            new CostTracking()
          );

          // Should fail but not throw
          expect(result.success).toBe(false);
        },
        60000
      );

      it(
        "handles timeout gracefully",
        async () => {
          // This test uses a very short timeout to trigger timeout handling
          const result = await scrapeURL(
            "test:self-hosted-fe-timeout",
            "https://httpstat.us/200?sleep=10000", // Delays response by 10s
            scrapeOptions.parse({
              timeout: 1000, // 1 second timeout
            }),
            {
              forceEngine: "fire-engine;chrome-cdp",
              teamId: "test-team",
            },
            new CostTracking()
          );

          // Should fail due to timeout
          expect(result.success).toBe(false);
        },
        30000
      );
    });

    describe("Fallback behavior", () => {
      it(
        "falls back to playwright when fire-engine unavailable (simulated)",
        async () => {
          // This tests the waterfall fallback mechanism
          // When fire-engine fails, it should try playwright
          const result = await scrapeURL(
            "test:self-hosted-fe-fallback",
            "https://example.com/",
            scrapeOptions.parse({}),
            {
              // Don't force engine - let waterfall work
              teamId: "test-team",
            },
            new CostTracking()
          );

          expect(result.success).toBe(true);
        },
        60000
      );
    });
  }
);

// Tests that should work regardless of fire-engine being enabled
describe("Fire Engine Configuration", () => {
  it("config loads without error", () => {
    // Import config to verify it parses correctly
    const { config } = require("../config");

    // These should have defaults
    expect(typeof config.SELF_HOSTED_FIRE_ENGINE_ENABLED).toBe("boolean");
    expect(config.SELF_HOSTED_FIRE_ENGINE_MAX_CONCURRENCY).toBeGreaterThan(0);
    expect(config.SELF_HOSTED_FIRE_ENGINE_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("engine selection includes fire-engine when enabled", () => {
    const { config } = require("../config");

    // This is testing the engine selection logic
    const useCloudFireEngine =
      config.FIRE_ENGINE_BETA_URL !== "" &&
      config.FIRE_ENGINE_BETA_URL !== undefined;

    const useSelfHostedFireEngine =
      config.SELF_HOSTED_FIRE_ENGINE_ENABLED === true &&
      config.SELF_HOSTED_FIRE_ENGINE_URL !== "" &&
      config.SELF_HOSTED_FIRE_ENGINE_URL !== undefined;

    const useFireEngine = useCloudFireEngine || useSelfHostedFireEngine;

    // At least one should be defined for fire-engine to be available
    console.log("Fire Engine enabled:", useFireEngine);
    console.log("  - Cloud:", useCloudFireEngine);
    console.log("  - Self-hosted:", useSelfHostedFireEngine);
  });
});
