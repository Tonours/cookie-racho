import { describe, expect, test } from "bun:test";

import { extractDuckDuckGoResultsFromHtml } from "./duckduckgo";

describe("extractDuckDuckGoResultsFromHtml", () => {
  test("extracts result__a links and resolves uddg redirects", () => {
    const html = `<!doctype html><html><body>
      <a class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.ptitchef.com%2Frecettes%2Frecette_pates-tomates.htm&amp;rut=abc">Pates &amp; tomates</a>
      <a class="result__a" href="https://www.ptitchef.com/recettes/recette_direct.htm"><span>Direct</span></a>
      <a class="result__a" href="/l/?uddg=https%3A%2F%2Fwww.example.com%2Fnope&amp;rut=abc">Nope</a>
    </body></html>`;

    expect(
      extractDuckDuckGoResultsFromHtml(html, {
        baseUrl: "https://duckduckgo.com/html/?q=x",
        allowedHostSuffixes: ["ptitchef.com"]
      })
    ).toEqual([
      { url: "https://www.ptitchef.com/recettes/recette_pates-tomates.htm", name: "Pates & tomates" },
      { url: "https://www.ptitchef.com/recettes/recette_direct.htm", name: "Direct" }
    ]);
  });

  test("dedupes by URL while preserving order", () => {
    const html = `<!doctype html><html><body>
      <a class="result__a" href="https://example.com/a">A</a>
      <a class="result__a" href="https://example.com/a">A again</a>
      <a class="result__a" href="https://example.com/b">B</a>
    </body></html>`;

    expect(
      extractDuckDuckGoResultsFromHtml(html, {
        baseUrl: "https://duckduckgo.com/html/?q=x"
      })
    ).toEqual([
      { url: "https://example.com/a", name: "A" },
      { url: "https://example.com/b", name: "B" }
    ]);
  });
});
