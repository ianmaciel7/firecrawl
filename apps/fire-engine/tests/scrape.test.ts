import { scrapeRequestSchema } from "../src/types/request";

describe("Scrape Request Schema", () => {
  describe("URL validation", () => {
    it("accepts valid HTTP URLs", () => {
      const result = scrapeRequestSchema.safeParse({
        url: "https://example.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid URLs", () => {
      const result = scrapeRequestSchema.safeParse({
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing URL", () => {
      const result = scrapeRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("Engine selection", () => {
    it("defaults to chrome-cdp", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
      });
      expect(result.engine).toBe("chrome-cdp");
    });

    it("accepts playwright engine", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        engine: "playwright",
      });
      expect(result.engine).toBe("playwright");
    });

    it("accepts tlsclient engine", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        engine: "tlsclient",
      });
      expect(result.engine).toBe("tlsclient");
    });

    it("rejects invalid engine", () => {
      const result = scrapeRequestSchema.safeParse({
        url: "https://example.com",
        engine: "invalid-engine",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Actions validation", () => {
    it("accepts wait action", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        actions: [{ type: "wait", milliseconds: 1000 }],
      });
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe("wait");
    });

    it("accepts click action", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        actions: [{ type: "click", selector: "#button" }],
      });
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe("click");
    });

    it("accepts type action", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        actions: [{ type: "type", selector: "#input", text: "hello" }],
      });
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe("type");
    });

    it("accepts screenshot action", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        actions: [{ type: "screenshot", fullPage: true }],
      });
      expect(result.actions).toHaveLength(1);
      expect(result.actions![0].type).toBe("screenshot");
    });

    it("accepts multiple actions", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        actions: [
          { type: "wait", milliseconds: 500 },
          { type: "click", selector: "#button" },
          { type: "screenshot" },
        ],
      });
      expect(result.actions).toHaveLength(3);
    });
  });

  describe("Proxy configuration", () => {
    it("accepts proxy URL", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        proxy: "http://proxy.example.com:8080",
      });
      expect(result.proxy).toBe("http://proxy.example.com:8080");
    });

    it("accepts proxy profile", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        proxyProfile: {
          server: "http://proxy.example.com:8080",
          username: "user",
          password: "pass",
        },
      });
      expect(result.proxyProfile).toBeDefined();
      expect(result.proxyProfile!.server).toBe("http://proxy.example.com:8080");
    });
  });

  describe("Screenshot options", () => {
    it("accepts screenshot flag", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        screenshot: true,
      });
      expect(result.screenshot).toBe(true);
    });

    it("accepts fullPageScreenshot flag", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        fullPageScreenshot: true,
      });
      expect(result.fullPageScreenshot).toBe(true);
    });
  });

  describe("Default values", () => {
    it("sets correct defaults", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
      });

      expect(result.engine).toBe("chrome-cdp");
      expect(result.timeout).toBe(300000);
      expect(result.wait).toBe(0);
      expect(result.stealth).toBe(true);
      expect(result.blockMedia).toBe(true);
      expect(result.blockAds).toBe(true);
      expect(result.mobile).toBe(false);
      expect(result.skipTlsVerification).toBe(false);
      expect(result.instantReturn).toBe(false);
      expect(result.priority).toBe(1);
    });
  });

  describe("Headers and cookies", () => {
    it("accepts custom headers", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        headers: {
          "X-Custom-Header": "value",
          "Authorization": "Bearer token",
        },
      });
      expect(result.headers).toHaveProperty("X-Custom-Header", "value");
    });

    it("accepts cookies", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        cookies: [
          { name: "session", value: "abc123", domain: "example.com" },
        ],
      });
      expect(result.cookies).toHaveLength(1);
      expect(result.cookies![0].name).toBe("session");
    });
  });

  describe("Geolocation", () => {
    it("accepts geolocation with country", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        geolocation: { country: "US" },
      });
      expect(result.geolocation).toHaveProperty("country", "US");
    });

    it("accepts geolocation with languages", () => {
      const result = scrapeRequestSchema.parse({
        url: "https://example.com",
        geolocation: { languages: ["en-US", "en"] },
      });
      expect(result.geolocation).toHaveProperty("languages");
      expect(result.geolocation!.languages).toContain("en-US");
    });
  });
});
