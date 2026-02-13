import { describe, expect, test } from "bun:test";

import { extractCanonicalUrl, extractHtmlTitle } from "./htmlMeta";

describe("extractCanonicalUrl", () => {
  test("extracts canonical link href", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://example.com/recipe" />
        </head>
      </html>`;

    expect(extractCanonicalUrl(html)).toBe("https://example.com/recipe");
  });

  test("extracts canonical link when attribute order differs", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <link href='https://example.com/recipe' rel='canonical'>
        </head>
      </html>`;

    expect(extractCanonicalUrl(html)).toBe("https://example.com/recipe");
  });

  test("falls back to og:url when canonical is missing", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <meta property="og:url" content="https://example.com/og" />
        </head>
      </html>`;

    expect(extractCanonicalUrl(html)).toBe("https://example.com/og");
  });

  test("returns null when missing", () => {
    expect(extractCanonicalUrl("<html></html>")).toBeNull();
  });
});

describe("extractHtmlTitle", () => {
  test("extracts title text", () => {
    const html = "<html><head><title>  Hello  </title></head></html>";
    expect(extractHtmlTitle(html)).toBe("Hello");
  });

  test("returns null when missing", () => {
    expect(extractHtmlTitle("<html></html>")).toBeNull();
  });
});
