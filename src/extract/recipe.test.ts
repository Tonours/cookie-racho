import { describe, expect, test } from "bun:test";

import { scrapeRecipeFromUrl } from "./recipe";

describe("scrapeRecipeFromUrl", () => {
  test("fetches a page, extracts JSON-LD and normalizes to ScrapedRecipe", async () => {
    const html = `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://example.com/recettes/pates-tomates" />
          <script type="application/ld+json">{
            "@context": "https://schema.org/",
            "@type": "Recipe",
            "name": "Pates tomates",
            "description": "Rapide.",
            "recipeIngredient": ["350 g de pates", "400 g de tomates"],
            "recipeInstructions": ["Cuire.", "Melanger."],
            "totalTime": "PT20M",
            "recipeYield": "4"
          }</script>
        </head>
        <body></body>
      </html>`;

    const recipe = await scrapeRecipeFromUrl("https://example.com/x", {
      fetchImpl: async () =>
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" }
        })
    });

    expect(recipe.source_url).toBe("https://example.com/recettes/pates-tomates");
    expect(recipe.name).toBe("Pates tomates");
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.steps).toHaveLength(2);
  });
});
