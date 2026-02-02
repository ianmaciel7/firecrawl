import { BlockedReason } from "../types/response";

export interface BlockDetectionResult {
  isBlocked: boolean;
  reason?: BlockedReason;
  confidence: number; // 0-1
}

// CAPTCHA patterns
const CAPTCHA_PATTERNS = [
  "captcha",
  "recaptcha",
  "hcaptcha",
  "cf-turnstile",
  "challenge-form",
  "challenge-running",
  "g-recaptcha",
  "h-captcha",
  "arkose",
  "funcaptcha",
];

// Bot detection / human verification patterns
const BOT_DETECTION_PATTERNS = [
  "verify you are human",
  "verify you are not a robot",
  "verify you're human",
  "verify you're not a robot",
  "prove you are human",
  "prove you're human",
  "are you a robot",
  "are you human",
  "confirm you are not a robot",
  "access denied",
  "access blocked",
  "blocked by",
  "suspicious activity",
  "unusual traffic",
  "automated access",
  "bot detected",
  "robot detected",
  "automated request",
  "please enable javascript",
  "javascript is required",
  "browser check",
  "security check",
];

// Cloudflare-specific patterns
const CLOUDFLARE_PATTERNS = [
  "cloudflare",
  "cf-ray",
  "checking your browser",
  "just a moment",
  "please wait while we verify",
  "ddos protection",
  "ray id:",
  "performance & security by cloudflare",
  "__cf_bm",
  "cf_chl_opt",
];

// Rate limiting patterns
const RATE_LIMIT_PATTERNS = [
  "rate limit",
  "rate-limit",
  "ratelimit",
  "too many requests",
  "slow down",
  "request limit exceeded",
  "quota exceeded",
  "throttled",
];

// IP block patterns
const IP_BLOCK_PATTERNS = [
  "ip blocked",
  "ip banned",
  "your ip",
  "ip address",
  "blocked ip",
  "banned ip",
  "forbidden",
  "403 forbidden",
];

/**
 * Detect if a response indicates blocking or bot detection
 */
export function detectBlock(
  statusCode: number,
  html: string,
  headers: Record<string, string>
): BlockDetectionResult {
  const normalizedHeaders = normalizeHeaders(headers);
  const lowerHtml = html.toLowerCase();

  // Check rate limit headers first (highest confidence)
  if (
    normalizedHeaders["retry-after"] ||
    normalizedHeaders["x-ratelimit-remaining"] === "0" ||
    normalizedHeaders["x-rate-limit-remaining"] === "0"
  ) {
    return { isBlocked: true, reason: "rate_limited", confidence: 0.95 };
  }

  // Status code patterns
  if (statusCode === 429) {
    return { isBlocked: true, reason: "rate_limited", confidence: 0.95 };
  }

  if (statusCode === 403) {
    // Check if it's a CAPTCHA page
    if (containsAny(lowerHtml, CAPTCHA_PATTERNS)) {
      return { isBlocked: true, reason: "captcha", confidence: 0.9 };
    }
    // Check if it's bot detection
    if (containsAny(lowerHtml, BOT_DETECTION_PATTERNS)) {
      return { isBlocked: true, reason: "robot_detected", confidence: 0.85 };
    }
    return { isBlocked: true, reason: "ip_block", confidence: 0.8 };
  }

  if (statusCode === 503) {
    // Could be Cloudflare challenge or maintenance
    if (containsAny(lowerHtml, CLOUDFLARE_PATTERNS)) {
      return { isBlocked: true, reason: "robot_detected", confidence: 0.85 };
    }
    return { isBlocked: true, reason: "ip_block", confidence: 0.6 };
  }

  if (statusCode === 401) {
    // Unauthorized - could be IP block behind auth
    if (containsAny(lowerHtml, IP_BLOCK_PATTERNS)) {
      return { isBlocked: true, reason: "ip_block", confidence: 0.7 };
    }
  }

  // For 200 responses, check content for signs of blocking
  // CAPTCHA detection (highest priority for content detection)
  if (containsAny(lowerHtml, CAPTCHA_PATTERNS)) {
    // Additional check: real CAPTCHA pages are usually short
    const isLikelyCaptchaPage = html.length < 50000;
    if (isLikelyCaptchaPage) {
      return { isBlocked: true, reason: "captcha", confidence: 0.9 };
    }
    // Could be a page that mentions captcha but isn't blocked
    return { isBlocked: true, reason: "captcha", confidence: 0.6 };
  }

  // Cloudflare challenge detection
  if (containsAny(lowerHtml, CLOUDFLARE_PATTERNS)) {
    // Cloudflare challenge pages are typically small
    const isLikelyChallengePage = html.length < 15000;
    if (isLikelyChallengePage) {
      return { isBlocked: true, reason: "robot_detected", confidence: 0.85 };
    }
    // Might just mention Cloudflare in footer
    return { isBlocked: false, confidence: 0 };
  }

  // Bot detection patterns
  if (containsAny(lowerHtml, BOT_DETECTION_PATTERNS)) {
    // Small pages with bot detection text are likely blocks
    const isLikelyBlockPage = html.length < 20000;
    if (isLikelyBlockPage) {
      return { isBlocked: true, reason: "robot_detected", confidence: 0.8 };
    }
    return { isBlocked: true, reason: "robot_detected", confidence: 0.5 };
  }

  // Rate limit patterns in content
  if (containsAny(lowerHtml, RATE_LIMIT_PATTERNS)) {
    return { isBlocked: true, reason: "rate_limited", confidence: 0.75 };
  }

  // IP block patterns in content
  if (containsAny(lowerHtml, IP_BLOCK_PATTERNS)) {
    const isLikelyBlockPage = html.length < 20000;
    if (isLikelyBlockPage) {
      return { isBlocked: true, reason: "ip_block", confidence: 0.7 };
    }
    return { isBlocked: true, reason: "ip_block", confidence: 0.4 };
  }

  // Check for empty or suspiciously short content
  if (html.trim().length === 0 && statusCode === 200) {
    return { isBlocked: true, reason: "unknown", confidence: 0.3 };
  }

  // No blocking detected
  return { isBlocked: false, confidence: 0 };
}

/**
 * Check if HTML contains any of the given patterns
 */
function containsAny(html: string, patterns: string[]): boolean {
  return patterns.some((pattern) => html.includes(pattern));
}

/**
 * Normalize header keys to lowercase for consistent lookup
 */
function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

/**
 * Determine if we should retry with stealth mode based on block detection
 */
export function shouldRetryWithStealth(result: BlockDetectionResult): boolean {
  if (!result.isBlocked) return false;

  // High confidence blocks should trigger stealth retry
  if (result.confidence >= 0.7) return true;

  // CAPTCHA and robot detection should always try stealth
  if (result.reason === "captcha" || result.reason === "robot_detected") {
    return result.confidence >= 0.5;
  }

  return false;
}
