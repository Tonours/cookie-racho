import { describe, expect, test } from "bun:test";

import type { CacheEntry, PageCache } from "./cache";
import { DomainRateLimiter, fetchHtml } from "./fetcher";

function createFakeClock(startMs = 0) {
  let nowMs = startMs;
  const slept: number[] = [];
  return {
    now: () => nowMs,
    sleep: async (ms: number) => {
      slept.push(ms);
      nowMs += ms;
    },
    slept
  };
}

class InMemoryCache implements PageCache {
  entries = new Map<string, CacheEntry>();
  sets: CacheEntry[] = [];

  async get(url: string): Promise<CacheEntry | null> {
    return this.entries.get(url) ?? null;
  }

  async set(entry: CacheEntry): Promise<void> {
    this.sets.push(entry);
    this.entries.set(entry.url, entry);
  }
}

describe("DomainRateLimiter", () => {
  test("waits between requests to same host", async () => {
    const clock = createFakeClock(0);
    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      jitterMs: 0,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0
    });

    await limiter.schedule("example.com");
    await limiter.schedule("example.com");

    expect(clock.slept).toEqual([1000]);
  });

  test("does not block different hosts", async () => {
    const clock = createFakeClock(0);
    const limiter = new DomainRateLimiter({
      minDelayMs: 1000,
      jitterMs: 0,
      now: clock.now,
      sleep: clock.sleep,
      random: () => 0
    });

    await limiter.schedule("a.com");
    await limiter.schedule("b.com");
    expect(clock.slept).toEqual([]);
  });

  test("uses default sleep when injected sleep is missing", async () => {
    const limiter = new DomainRateLimiter({
      minDelayMs: 1,
      jitterMs: 0,
      // constant clock to ensure waitMs > 0 on second call
      now: () => 0,
      random: () => 0
    });

    await limiter.schedule("example.com");
    await limiter.schedule("example.com");
  });
});

describe("fetchHtml", () => {
  test("returns cached response when fresh", async () => {
    const clock = createFakeClock(10_000);
    const cache = new InMemoryCache();
    cache.entries.set("https://example.com/x", {
      url: "https://example.com/x",
      fetchedAtMs: 9_500,
      resolvedUrl: "https://example.com/x",
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html>cached</html>"
    });

    let fetchCalls = 0;
    const result = await fetchHtml("https://example.com/x", {
      cache,
      cacheTtlMs: 1_000,
      now: clock.now,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response("<html>live</html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        });
      }
    });

    expect(fetchCalls).toBe(0);
    expect(result.fromCache).toBe(true);
    expect(result.html).toBe("<html>cached</html>");
  });

  test("fetches and stores when cache is stale", async () => {
    const clock = createFakeClock(10_000);
    const cache = new InMemoryCache();
    cache.entries.set("https://example.com/x", {
      url: "https://example.com/x",
      fetchedAtMs: 1,
      resolvedUrl: "https://example.com/x",
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html>cached</html>"
    });

    let fetchCalls = 0;
    const result = await fetchHtml("https://example.com/x", {
      cache,
      cacheTtlMs: 100,
      now: clock.now,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response("<html>live</html>", {
          status: 200,
          headers: { "content-type": "text/html" }
        });
      }
    });

    expect(fetchCalls).toBe(1);
    expect(result.fromCache).toBe(false);
    expect(result.html).toBe("<html>live</html>");
    expect(cache.sets).toHaveLength(1);
  });

  test("times out when fetch does not resolve", async () => {
    let message = "";
    try {
      await fetchHtml("https://example.com/slow", {
        timeoutMs: 5,
        fetchImpl: async (_input, init) => {
          return await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true }
            );
          });
        }
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    expect(message).toContain("Request timed out");
  });
});
