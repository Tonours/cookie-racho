import type { PageCache } from "./cache";
import { getUrlHost, normalizeUrlSpec } from "./url";

export type FetchHtmlResult = {
  url: string;
  resolvedUrl: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  fromCache: boolean;
};

export type FetchHtmlOptions = {
  timeoutMs?: number;
  userAgent?: string;
  acceptLanguage?: string;
  cache?: PageCache | null;
  cacheTtlMs?: number;
  rateLimiter?: DomainRateLimiter;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  fetchImpl?: typeof fetch;
};

export class DomainRateLimiter {
  private minDelayMs: number;
  private jitterMs: number;
  private now: () => number;
  private sleep: (ms: number) => Promise<void>;
  private random: () => number;
  private nextAllowedAtByHost = new Map<string, number>();

  constructor(options: {
    minDelayMs: number;
    jitterMs: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  }) {
    this.minDelayMs = Math.max(0, Math.trunc(options.minDelayMs));
    this.jitterMs = Math.max(0, Math.trunc(options.jitterMs));
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = options.random ?? Math.random;
  }

  async schedule(host: string): Promise<void> {
    const start = this.now();
    const allowedAt = this.nextAllowedAtByHost.get(host) ?? start;
    const waitMs = Math.max(0, allowedAt - start);
    if (waitMs > 0) await this.sleep(waitMs);

    const afterWait = this.now();
    const jitter = this.jitterMs > 0 ? Math.floor(this.random() * this.jitterMs) : 0;
    this.nextAllowedAtByHost.set(host, afterWait + this.minDelayMs + jitter);
  }
}

export async function fetchHtml(urlSpec: string, opts: FetchHtmlOptions = {}): Promise<FetchHtmlResult> {
  const now = opts.now ?? Date.now;
  const fetchImpl = opts.fetchImpl ?? fetch;

  const url = normalizeUrlSpec(urlSpec);
  const host = getUrlHost(url);

  const cache = opts.cache ?? null;
  const cacheTtlMs = opts.cacheTtlMs ?? 7 * 24 * 60 * 60 * 1000;
  if (cache) {
    const entry = await cache.get(url);
    if (entry && now() - entry.fetchedAtMs <= cacheTtlMs) {
      return {
        url,
        resolvedUrl: entry.resolvedUrl,
        status: entry.status,
        headers: entry.headers,
        html: entry.body,
        fromCache: true
      };
    }
  }

  if (opts.rateLimiter) {
    await opts.rateLimiter.schedule(host);
  }

  const timeoutMs = opts.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers({
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": opts.acceptLanguage ?? "fr-FR,fr;q=0.9,en;q=0.8",
      "User-Agent": opts.userAgent ?? "cookie-racho/1.0"
    });

    const response = await fetchImpl(url, {
      headers,
      redirect: "follow",
      signal: controller.signal
    });

    const status = response.status;
    if (!response.ok) {
      throw new Error(`Request failed: ${status} ${response.statusText}`);
    }

    const html = await response.text();
    const rawResolved = response.url || url;
    const resolvedUrl = safeNormalizeUrl(rawResolved) ?? url;
    const headersObj: Record<string, string> = {};
    for (const [k, v] of response.headers.entries()) headersObj[k] = v;

    if (cache) {
      await cache.set({
        url,
        fetchedAtMs: now(),
        resolvedUrl,
        status,
        headers: headersObj,
        body: html
      });
    }

    return {
      url,
      resolvedUrl,
      status,
      headers: headersObj,
      html,
      fromCache: false
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function safeNormalizeUrl(url: string): string | null {
  try {
    return normalizeUrlSpec(url);
  } catch {
    return null;
  }
}
