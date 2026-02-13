import { describe, expect, test } from "bun:test";

import { getUrlHost, normalizeUrlSpec } from "./url";

describe("normalizeUrlSpec", () => {
  test("adds https:// when missing", () => {
    expect(normalizeUrlSpec("example.com/recipe")).toBe("https://example.com/recipe");
  });

  test("preserves http/https and strips fragments", () => {
    expect(normalizeUrlSpec("http://example.com/r#x")).toBe("http://example.com/r");
    expect(normalizeUrlSpec("https://example.com/r#x")).toBe("https://example.com/r");
  });

  test("rejects non-http(s)", () => {
    expect(() => normalizeUrlSpec("ftp://example.com/file")).toThrow();
  });
});

describe("getUrlHost", () => {
  test("returns lowercased hostname", () => {
    expect(getUrlHost("HTTPS://EXAMPLE.COM/Recipe")).toBe("example.com");
  });
});
