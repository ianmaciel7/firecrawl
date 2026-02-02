import { z } from "zod";

// Action types matching the Firecrawl API contract
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("wait"),
    milliseconds: z.number().optional().default(1000),
  }),
  z.object({
    type: z.literal("click"),
    selector: z.string(),
  }),
  z.object({
    type: z.literal("type"),
    selector: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("scroll"),
    direction: z.enum(["up", "down"]).optional().default("down"),
    amount: z.number().optional(),
    selector: z.string().optional(),
  }),
  z.object({
    type: z.literal("screenshot"),
    fullPage: z.boolean().optional().default(false),
    viewport: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("scrape"),
    selector: z.string().optional(),
  }),
  z.object({
    type: z.literal("executeJavascript"),
    script: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("pdf"),
  }),
]);

export type Action = z.infer<typeof actionSchema>;

// Geolocation schema
export const geolocationSchema = z.object({
  country: z.string().optional(),
  languages: z.array(z.string()).optional(),
});

// Cookie schema
export const cookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
});

// Proxy profile schema
export const proxyProfileSchema = z.object({
  server: z.string(),
  username: z.string().optional(),
  password: z.string().optional(),
});

// Main scrape request schema - matching the Fire Engine API contract
export const scrapeRequestSchema = z.object({
  // Required
  url: z.string().url(),

  // Engine selection
  engine: z.enum(["chrome-cdp", "playwright", "tlsclient"]).default("chrome-cdp"),

  // Headers and cookies
  headers: z.record(z.string()).optional(),
  cookies: z.array(cookieSchema).optional(),
  userAgent: z.string().optional(),

  // Timing
  timeout: z.number().optional().default(300000),
  wait: z.number().optional().default(0),

  // Rendering options
  actions: z.array(actionSchema).optional(),
  waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).optional(),
  waitForSelector: z.string().optional(),

  // Screenshot
  screenshot: z.boolean().optional().default(false),
  fullPageScreenshot: z.boolean().optional().default(false),

  // Anti-bot / proxy
  proxy: z.string().optional(),
  proxyProfile: proxyProfileSchema.optional(),
  mobileProxy: z.boolean().optional(),
  stealth: z.boolean().optional().default(true),

  // Other options
  blockMedia: z.boolean().optional().default(true),
  blockAds: z.boolean().optional().default(true),
  mobile: z.boolean().optional().default(false),
  geolocation: geolocationSchema.optional(),
  skipTlsVerification: z.boolean().optional().default(false),

  // Job options
  instantReturn: z.boolean().optional().default(false),
  priority: z.number().optional().default(1),
  logRequest: z.boolean().optional().default(true),

  // Data retention
  saveScrapeResultToGCS: z.boolean().optional().default(false),
  zeroDataRetention: z.boolean().optional().default(false),

  // Chrome CDP specific
  disableSmartWaitCache: z.boolean().optional(),

  // TLS client specific
  atsv: z.boolean().optional(),
  disableJsDom: z.boolean().optional(),
});

export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;
