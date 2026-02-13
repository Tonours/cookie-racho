import { describe, expect, test } from "bun:test";

import { fallbackNameFromUrl, searchRecipes } from "./search";

describe("searchRecipes", () => {
  test("searches across configured sites and returns deduped results", async () => {
    const htmlA = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/a","name":"A"}},
          {"@type":"ListItem","item":{"@id":"/recettes/b","name":"B"}}
        ]
      }</script>
    </head></html>`;

    const htmlB = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/b","name":"B"}},
          {"@type":"ListItem","item":{"@id":"/recettes/c","name":"C"}}
        ]
      }</script>
    </head></html>`;

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("marmiton.org")) return new Response(htmlA, { status: 200, headers: { "content-type": "text/html" } });
      if (url.includes("750g.com")) return new Response(htmlB, { status: 200, headers: { "content-type": "text/html" } });
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    };

    const { results, errors } = await searchRecipes("pates", {
      siteIds: ["marmiton", "750g"],
      maxResults: 10,
      maxResultsPerSite: 10,
      fetchImpl,
      rateLimitMs: 0
    });

    expect(errors).toEqual([]);
    expect(results.map((r) => r.source_url)).toEqual([
      "https://www.marmiton.org/recettes/a",
      "https://www.marmiton.org/recettes/b",
      "https://www.750g.com/recettes/b",
      "https://www.750g.com/recettes/c"
    ]);
    expect(results.map((r) => r.name)).toEqual(["A", "B", "B", "C"]);
  });

  test("records per-site errors and continues", async () => {
    const htmlOk = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/a","name":"A"}}
        ]
      }</script>
    </head></html>`;

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("marmiton.org")) return new Response("Forbidden", { status: 403 });
      if (url.includes("750g.com")) return new Response(htmlOk, { status: 200, headers: { "content-type": "text/html" } });
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    };

    const { results, errors } = await searchRecipes("pates", {
      siteIds: ["marmiton", "750g"],
      fetchImpl,
      rateLimitMs: 0
    });

    expect(errors.length).toBe(1);
    expect(errors[0]?.site_id).toBe("marmiton");
    expect(results.map((r) => r.source_name)).toEqual(["750g"]);
  });
});

describe("fallbackNameFromUrl", () => {
  test("derives a readable title from the last path segment", () => {
    expect(fallbackNameFromUrl("https://example.com/recettes/pates-tomates"))
      .toBe("Pates tomates");
  });

  test("falls back to host when path is empty", () => {
    expect(fallbackNameFromUrl("https://example.com/"))
      .toBe("example.com");
  });

  test("returns input for invalid URLs", () => {
    expect(fallbackNameFromUrl("not a url"))
      .toBe("not a url");
  });
});
