import { describe, expect, test } from "bun:test";

import { SqlitePageCache } from "./cache";

describe("SqlitePageCache", () => {
  test("set/get roundtrip", async () => {
    const cache = new SqlitePageCache({ dbPath: ":memory:" });

    await cache.set({
      url: "https://example.com/x",
      fetchedAtMs: 123,
      resolvedUrl: "https://example.com/x",
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html></html>"
    });

    expect(await cache.get("https://example.com/x")).toEqual({
      url: "https://example.com/x",
      fetchedAtMs: 123,
      resolvedUrl: "https://example.com/x",
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html></html>"
    });

    cache.close();
  });

  test("returns null for missing keys", async () => {
    const cache = new SqlitePageCache({ dbPath: ":memory:" });
    expect(await cache.get("https://example.com/missing")).toBeNull();
    cache.close();
  });
});
