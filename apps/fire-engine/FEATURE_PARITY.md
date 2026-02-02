# Fire Engine Feature Parity Checklist

This document tracks the implementation status of Fire Engine features for the self-hosted version.

## Reliability & Anti-bot Features

| Feature | Status | Implementation Location | Notes |
|---------|--------|------------------------|-------|
| Detect IP blocking (403/429 + block pages) | ✅ Implemented | [src/lib/block-detection.ts:43-59](src/lib/block-detection.ts#L43-L59) | Detects 403, 429, 503 status codes |
| Detect robot/bot challenges | ✅ Implemented | [src/lib/block-detection.ts:61-88](src/lib/block-detection.ts#L61-L88) | Detects "verify you are human", bot detection patterns |
| Detect CAPTCHA markers | ✅ Implemented | [src/lib/block-detection.ts:90-101](src/lib/block-detection.ts#L90-L101) | Detects reCAPTCHA, hCaptcha, Turnstile, etc. |
| Detect Cloudflare challenges | ✅ Implemented | [src/lib/block-detection.ts:103-113](src/lib/block-detection.ts#L103-L113) | Detects CF challenge pages |
| Detect rate limiting headers | ✅ Implemented | [src/lib/block-detection.ts:55-60](src/lib/block-detection.ts#L55-L60) | Detects Retry-After, X-RateLimit headers |
| Return `blockedReason` in response | ✅ Implemented | [src/types/response.ts:6-12](src/types/response.ts#L6-L12) | Enum: ip_block, robot_detected, captcha, rate_limited, unknown |
| Stealth mode routing | ✅ Implemented | [src/engines/playwright.ts:117-148](src/engines/playwright.ts#L117-L148) | WebDriver hiding, navigator overrides |
| Proxy support | ✅ Implemented | [src/lib/proxy.ts](src/lib/proxy.ts) | Request-level and environment proxy support |
| Proxy rotation | ⚠️ Stubbed | [src/lib/proxy.ts:63-88](src/lib/proxy.ts#L63-L88) | ProxyRotator class exists, needs external proxy list |

## API Integration (apps/api)

| Feature | Status | Implementation Location | Notes |
|---------|--------|------------------------|-------|
| Config variables for self-hosted | ✅ Implemented | [apps/api/src/config.ts:77-81](../api/src/config.ts#L77-L81) | SELF_HOSTED_FIRE_ENGINE_* variables |
| Engine selection logic | ✅ Implemented | [apps/api/src/scraper/scrapeURL/engines/index.ts:40-53](../api/src/scraper/scrapeURL/engines/index.ts#L40-L53) | useCloudFireEngine OR useSelfHostedFireEngine |
| URL selection (self-hosted vs cloud) | ✅ Implemented | [apps/api/src/scraper/scrapeURL/engines/fire-engine/scrape.ts:176-187](../api/src/scraper/scrapeURL/engines/fire-engine/scrape.ts#L176-L187) | getFireEngineURL() function |
| Auth token support | ✅ Implemented | [apps/api/src/scraper/scrapeURL/engines/fire-engine/scrape.ts:197-206](../api/src/scraper/scrapeURL/engines/fire-engine/scrape.ts#L197-L206) | getFireEngineHeaders() function |
| Auto-fallback to Fire Engine on block | ✅ Exists | [apps/api/src/scraper/scrapeURL/engines/index.ts:574-578](../api/src/scraper/scrapeURL/engines/index.ts#L574-L578) | Quality-based engine selection already handles this |

## Dynamic Content Features

| Feature | Status | Implementation Location | Notes |
|---------|--------|------------------------|-------|
| JavaScript rendering | ✅ Implemented | [src/engines/playwright.ts](src/engines/playwright.ts) | Full Playwright-based rendering |
| Wait for selector | ✅ Implemented | [src/engines/playwright.ts:237-241](src/engines/playwright.ts#L237-L241) | waitForSelector option |
| Wait time | ✅ Implemented | [src/engines/playwright.ts:244-246](src/engines/playwright.ts#L244-L246) | wait option in ms |
| Click action | ✅ Implemented | [src/lib/actions.ts:73-76](src/lib/actions.ts#L73-L76) | Waits for selector, then clicks |
| Type action | ✅ Implemented | [src/lib/actions.ts:78-81](src/lib/actions.ts#L78-L81) | Waits for selector, then fills |
| Wait action | ✅ Implemented | [src/lib/actions.ts:68-71](src/lib/actions.ts#L68-L71) | Capped at 30s |
| Scroll action | ✅ Implemented | [src/lib/actions.ts:83-95](src/lib/actions.ts#L83-L95) | Supports up/down, amount, selector |
| Screenshot action | ✅ Implemented | [src/lib/actions.ts:97-109](src/lib/actions.ts#L97-L109) | Full page option, custom viewport |
| Execute JavaScript action | ✅ Implemented | [src/lib/actions.ts:120-134](src/lib/actions.ts#L120-L134) | Returns stringified result |
| PDF action | ⚠️ Stubbed | [src/lib/actions.ts:66-71](src/lib/actions.ts#L66-L71) | Placeholder, returns stub link |

## Screenshot Features

| Feature | Status | Implementation Location | Notes |
|---------|--------|------------------------|-------|
| Basic screenshot | ✅ Implemented | [src/engines/playwright.ts:257-264](src/engines/playwright.ts#L257-L264) | PNG format, base64 encoded |
| Full page screenshot | ✅ Implemented | [src/engines/playwright.ts:259](src/engines/playwright.ts#L259) | fullPageScreenshot option |
| Custom viewport | ✅ Implemented | [src/lib/actions.ts:100-102](src/lib/actions.ts#L100-L102) | Via screenshot action |
| Mobile emulation | ✅ Implemented | [src/engines/playwright.ts:193-200](src/engines/playwright.ts#L193-L200) | Uses iPhone 12 profile |

## Operational Features

| Feature | Status | Implementation Location | Notes |
|---------|--------|------------------------|-------|
| `/healthz` endpoint | ✅ Implemented | [src/routes/health.ts](src/routes/health.ts) | Returns status + job stats |
| Structured logging | ✅ Implemented | [src/lib/logger.ts](src/lib/logger.ts) | Winston-based, configurable level |
| Concurrency limiting | ✅ Implemented | [src/engines/playwright.ts:63-88](src/engines/playwright.ts#L63-L88) | Semaphore-based page slot management |
| Timeout handling | ✅ Implemented | [src/engines/playwright.ts:228-231](src/engines/playwright.ts#L228-L231) | Configurable via timeout option |
| Job cleanup | ✅ Implemented | [src/lib/job-manager.ts:26-44](src/lib/job-manager.ts#L26-L44) | TTL-based automatic cleanup |
| Auth token middleware | ✅ Implemented | [src/middleware/auth.ts](src/middleware/auth.ts) | Bearer token authentication |
| Async job support | ✅ Implemented | [src/lib/job-manager.ts](src/lib/job-manager.ts) | instantReturn=true triggers async |

## Docker & Deployment

| Feature | Status | Implementation Location | Notes |
|---------|--------|------------------------|-------|
| Dockerfile | ✅ Implemented | [Dockerfile](Dockerfile) | Node 22-slim, Playwright+Chromium |
| Docker Compose service | ✅ Implemented | [docker-compose.yaml](../../docker-compose.yaml#L89-L122) | Optional profile: fire-engine |
| Environment variables | ✅ Implemented | [.env.example](../api/.env.example#L75-L84) | Documented in API .env.example |
| Health check | ✅ Implemented | [Dockerfile:31-33](Dockerfile#L31-L33) | curl-based healthcheck |

## Request/Response Compatibility

| Feature | Status | Implementation Location | Notes |
|---------|--------|------------------------|-------|
| Request schema matches Fire Engine | ✅ Implemented | [src/types/request.ts](src/types/request.ts) | Matches FireEngineScrapeRequest* types |
| Response schema matches Fire Engine | ✅ Implemented | [src/types/response.ts](src/types/response.ts) | Matches successSchema from API |
| Processing response (async) | ✅ Implemented | [src/types/response.ts:44-48](src/types/response.ts#L44-L48) | jobId + processing: true |
| Error response | ✅ Implemented | [src/types/response.ts:80-85](src/types/response.ts#L80-L85) | error + optional code |

## Features Requiring External Services (Stubbed)

| Feature | Status | Notes |
|---------|--------|-------|
| IP rotation | ⚠️ Stub | Requires external rotating proxy service |
| CAPTCHA solving | ⚠️ Stub | Requires external service (2captcha, etc.) |
| Residential proxies | ⚠️ Stub | Requires external proxy provider |
| GCS storage | ❌ Not implemented | Cloud-only feature, not needed for self-host |
| A/B testing | ❌ Not implemented | Cloud-only feature |

## Tests

| Test Suite | Status | Location |
|------------|--------|----------|
| Block detection unit tests | ✅ Implemented | [tests/block-detection.test.ts](tests/block-detection.test.ts) |
| Request schema tests | ✅ Implemented | [tests/scrape.test.ts](tests/scrape.test.ts) |
| API integration tests | ✅ Implemented | [apps/api/src/__tests__/self-hosted-fire-engine.test.ts](../api/src/__tests__/self-hosted-fire-engine.test.ts) |

---

## Legend

- ✅ **Implemented** - Feature is fully implemented and tested
- ⚠️ **Stubbed** - API/interface exists but requires external dependencies
- ❌ **Not implemented** - Feature not available in self-hosted version

## Verification Steps

1. **Start Fire Engine service:**
   ```bash
   docker compose --profile fire-engine up -d
   ```

2. **Verify health endpoint:**
   ```bash
   curl http://localhost:3000/healthz
   ```

3. **Test basic scrape:**
   ```bash
   curl -X POST http://localhost:3000/v1/scrape \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}'
   ```

4. **Run unit tests:**
   ```bash
   cd apps/fire-engine && npm test
   ```

5. **Run integration tests:**
   ```bash
   SELF_HOSTED_FIRE_ENGINE_ENABLED=true pnpm harness jest self-hosted-fire-engine
   ```
