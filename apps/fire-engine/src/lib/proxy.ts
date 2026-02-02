import { config } from "../config";
import { logger } from "./logger";

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Get proxy configuration from environment or request
 */
export function getProxyConfig(
  requestProxy?: string,
  requestProxyProfile?: { server: string; username?: string; password?: string }
): ProxyConfig | undefined {
  // Request-level proxy takes precedence
  if (requestProxyProfile) {
    return {
      server: requestProxyProfile.server,
      username: requestProxyProfile.username,
      password: requestProxyProfile.password,
    };
  }

  if (requestProxy) {
    return parseProxyUrl(requestProxy);
  }

  // Fall back to environment proxy
  if (config.PROXY_SERVER) {
    return {
      server: config.PROXY_SERVER,
      username: config.PROXY_USERNAME,
      password: config.PROXY_PASSWORD,
    };
  }

  return undefined;
}

/**
 * Parse a proxy URL into components
 * Supports formats:
 * - http://host:port
 * - http://user:pass@host:port
 * - host:port
 */
export function parseProxyUrl(proxyUrl: string): ProxyConfig {
  try {
    // Add protocol if missing
    let url = proxyUrl;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `http://${url}`;
    }

    const parsed = new URL(url);
    return {
      server: `${parsed.protocol}//${parsed.hostname}:${parsed.port || "80"}`,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    };
  } catch (error) {
    logger.warn("Failed to parse proxy URL, using as-is", { proxyUrl, error });
    return { server: proxyUrl };
  }
}

/**
 * Format proxy config for Playwright
 */
export function formatProxyForPlaywright(
  proxyConfig: ProxyConfig
): { server: string; username?: string; password?: string } {
  return {
    server: proxyConfig.server,
    username: proxyConfig.username,
    password: proxyConfig.password,
  };
}

/**
 * Rotate through a list of proxies (round-robin)
 */
export class ProxyRotator {
  private proxies: ProxyConfig[];
  private currentIndex: number = 0;

  constructor(proxies: ProxyConfig[]) {
    this.proxies = proxies;
  }

  getNext(): ProxyConfig | undefined {
    if (this.proxies.length === 0) return undefined;

    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }

  addProxy(proxy: ProxyConfig): void {
    this.proxies.push(proxy);
  }

  removeProxy(server: string): void {
    this.proxies = this.proxies.filter((p) => p.server !== server);
    if (this.currentIndex >= this.proxies.length) {
      this.currentIndex = 0;
    }
  }

  get count(): number {
    return this.proxies.length;
  }
}
