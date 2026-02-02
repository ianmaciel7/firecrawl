import { z } from "zod";

// Block reason enum
export const blockedReasonSchema = z.enum([
  "ip_block",
  "robot_detected",
  "captcha",
  "rate_limited",
  "unknown",
]);

export type BlockedReason = z.infer<typeof blockedReasonSchema>;

// Action result types
export const actionResultSchema = z.discriminatedUnion("type", [
  z.object({
    idx: z.number(),
    type: z.literal("screenshot"),
    result: z.object({
      path: z.string().optional(),
      base64: z.string().optional(),
    }),
  }),
  z.object({
    idx: z.number(),
    type: z.literal("scrape"),
    result: z.object({
      url: z.string(),
      html: z.string().optional(),
      accessibility: z.string().optional(),
    }),
  }),
  z.object({
    idx: z.number(),
    type: z.literal("executeJavascript"),
    result: z.object({
      return: z.string(),
    }),
  }),
  z.object({
    idx: z.number(),
    type: z.literal("pdf"),
    result: z.object({
      link: z.string(),
    }),
  }),
]);

export type ActionResult = z.infer<typeof actionResultSchema>;

// Processing response (job started, not yet complete)
export const processingResponseSchema = z.object({
  jobId: z.string(),
  processing: z.literal(true),
});

export type ProcessingResponse = z.infer<typeof processingResponseSchema>;

// Success response
export const successResponseSchema = z.object({
  // Job info (optional for instant return)
  jobId: z.string().optional(),

  // Timing
  timeTaken: z.number(),

  // Content
  content: z.string(),
  url: z.string().optional(),

  // Status
  pageStatusCode: z.number(),
  pageError: z.string().optional(),

  // Headers
  responseHeaders: z.record(z.string()).optional(),

  // Screenshots
  screenshot: z.string().optional(), // Base64
  screenshots: z.array(z.string()).optional(),

  // Actions results
  actionContent: z
    .array(
      z.object({
        url: z.string(),
        html: z.string(),
      })
    )
    .optional(),
  actionResults: z.array(actionResultSchema).optional(),

  // File download (chrome-cdp)
  file: z
    .object({
      name: z.string(),
      content: z.string(), // Base64
    })
    .optional()
    .nullable(),

  // Block detection
  blockedReason: blockedReasonSchema.optional(),

  // Metadata
  usedMobileProxy: z.boolean().optional(),
  timezone: z.string().optional(),

  // GCS (not used in self-hosted)
  docUrl: z.string().optional(),
});

export type SuccessResponse = z.infer<typeof successResponseSchema>;

// Error response
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  blockedReason: blockedReasonSchema.optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// Union type for all responses
export type ScrapeResponse = ProcessingResponse | SuccessResponse | ErrorResponse;

// Job status response
export const jobStatusResponseSchema = z.union([
  processingResponseSchema,
  successResponseSchema,
  errorResponseSchema,
]);

export type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;
