import { detectBlock, shouldRetryWithStealth } from "../src/lib/block-detection";

describe("Block Detection", () => {
  describe("detectBlock", () => {
    describe("Status code detection", () => {
      it("detects 403 as IP block", () => {
        const result = detectBlock(403, "", {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("ip_block");
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      });

      it("detects 429 as rate limited", () => {
        const result = detectBlock(429, "", {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("rate_limited");
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });

      it("detects 503 as potential IP block", () => {
        const result = detectBlock(503, "", {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("ip_block");
      });

      it("does not flag 200 as blocked with normal content", () => {
        const html = "<html><body><h1>Welcome to our website</h1><p>This is normal content.</p></body></html>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(false);
      });

      it("does not flag 404 as blocked", () => {
        const result = detectBlock(404, "Page not found", {});
        expect(result.isBlocked).toBe(false);
      });
    });

    describe("Rate limit header detection", () => {
      it("detects Retry-After header", () => {
        const result = detectBlock(200, "", { "Retry-After": "60" });
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("rate_limited");
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      });

      it("detects x-ratelimit-remaining: 0", () => {
        const result = detectBlock(200, "", { "x-ratelimit-remaining": "0" });
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("rate_limited");
      });

      it("detects X-Rate-Limit-Remaining: 0", () => {
        const result = detectBlock(200, "", { "X-Rate-Limit-Remaining": "0" });
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("rate_limited");
      });
    });

    describe("CAPTCHA detection", () => {
      it("detects reCAPTCHA in HTML", () => {
        const html = '<div class="g-recaptcha" data-sitekey="..."></div>';
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("captcha");
      });

      it("detects hCaptcha in HTML", () => {
        const html = '<div class="h-captcha" data-sitekey="..."></div>';
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("captcha");
      });

      it("detects Cloudflare Turnstile", () => {
        const html = '<div class="cf-turnstile"></div>';
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("captcha");
      });

      it("detects generic captcha text", () => {
        const html = "<p>Please complete the captcha to continue</p>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("captcha");
      });
    });

    describe("Bot detection patterns", () => {
      it("detects 'verify you are human' text", () => {
        const html = "<h1>Please verify you are human</h1>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("robot_detected");
      });

      it("detects 'verify you are not a robot' text", () => {
        const html = "<p>Verify you are not a robot to continue.</p>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("robot_detected");
      });

      it("detects 'access denied' text", () => {
        const html = "<h1>Access Denied</h1><p>You do not have permission.</p>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("robot_detected");
      });

      it("detects 'suspicious activity' text", () => {
        const html = "<p>We detected suspicious activity from your IP.</p>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("robot_detected");
      });

      it("detects 'unusual traffic' text", () => {
        const html = "<p>Unusual traffic detected from your network.</p>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("robot_detected");
      });
    });

    describe("Cloudflare detection", () => {
      it("detects Cloudflare challenge page", () => {
        const html = `
          <html>
            <head><title>Just a moment...</title></head>
            <body>
              <h1>Checking your browser before accessing</h1>
              <p>Cloudflare</p>
            </body>
          </html>
        `;
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("robot_detected");
      });

      it("detects cf-ray in short pages", () => {
        const html = "<html><body>Checking...<span id='cf-ray'></span></body></html>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("robot_detected");
      });

      it("does not flag large pages that mention Cloudflare in footer", () => {
        // Large page with Cloudflare mentioned only in footer
        const html = `
          <html>
            <body>
              ${"<p>This is a real content paragraph with lots of text. </p>".repeat(1000)}
              <footer>Performance & security by Cloudflare</footer>
            </body>
          </html>
        `;
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(false);
      });
    });

    describe("IP block detection", () => {
      it("detects 'IP blocked' text", () => {
        const html = "<p>Your IP has been blocked due to abuse.</p>";
        const result = detectBlock(200, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("ip_block");
      });

      it("detects '403 Forbidden' text with 403 status", () => {
        const html = "<h1>403 Forbidden</h1><p>Access to this resource is denied.</p>";
        const result = detectBlock(403, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("ip_block");
      });
    });

    describe("Combined patterns", () => {
      it("CAPTCHA on 403 returns captcha reason", () => {
        const html = '<div class="g-recaptcha"></div>';
        const result = detectBlock(403, html, {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("captcha");
      });

      it("empty content on 200 returns unknown reason", () => {
        const result = detectBlock(200, "", {});
        expect(result.isBlocked).toBe(true);
        expect(result.reason).toBe("unknown");
        expect(result.confidence).toBeLessThan(0.5);
      });
    });
  });

  describe("shouldRetryWithStealth", () => {
    it("returns true for high confidence blocks", () => {
      const result = { isBlocked: true, reason: "ip_block" as const, confidence: 0.8 };
      expect(shouldRetryWithStealth(result)).toBe(true);
    });

    it("returns true for captcha with medium confidence", () => {
      const result = { isBlocked: true, reason: "captcha" as const, confidence: 0.6 };
      expect(shouldRetryWithStealth(result)).toBe(true);
    });

    it("returns true for robot_detected with medium confidence", () => {
      const result = { isBlocked: true, reason: "robot_detected" as const, confidence: 0.5 };
      expect(shouldRetryWithStealth(result)).toBe(true);
    });

    it("returns false for low confidence blocks", () => {
      const result = { isBlocked: true, reason: "unknown" as const, confidence: 0.3 };
      expect(shouldRetryWithStealth(result)).toBe(false);
    });

    it("returns false when not blocked", () => {
      const result = { isBlocked: false, confidence: 0 };
      expect(shouldRetryWithStealth(result)).toBe(false);
    });
  });
});
