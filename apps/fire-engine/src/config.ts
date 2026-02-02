import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug", "trace"]).default("info"),

  // Authentication
  AUTH_TOKEN: z.string().optional(),

  // Concurrency & Performance
  MAX_CONCURRENT_PAGES: z.coerce.number().default(10),
  TIMEOUT_MS: z.coerce.number().default(300000),
  PAGE_LOAD_TIMEOUT_MS: z.coerce.number().default(60000),

  // Proxy settings
  PROXY_SERVER: z.string().optional(),
  PROXY_USERNAME: z.string().optional(),
  PROXY_PASSWORD: z.string().optional(),

  // Browser settings
  BLOCK_MEDIA: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .default("true"),
  HEADLESS: z
    .string()
    .transform((val) => val !== "false" && val !== "0")
    .default("true"),

  // Stealth settings
  STEALTH_ENABLED: z
    .string()
    .transform((val) => val === "true" || val === "1")
    .default("true"),

  // Job management
  JOB_TTL_MS: z.coerce.number().default(600000), // 10 minutes
  JOB_CLEANUP_INTERVAL_MS: z.coerce.number().default(60000), // 1 minute
});

export const config = configSchema.parse(process.env);

export type Config = z.infer<typeof configSchema>;
