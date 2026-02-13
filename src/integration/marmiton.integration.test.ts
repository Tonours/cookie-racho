import process from "node:process";

import { describe, expect, test } from "bun:test";

import { DomainRateLimiter } from "../core/fetcher";
import { scrapeRecipeFromUrl } from "../extract/recipe";

const RUN_INTEGRATION = process.env.COOKIE_RACHO_INTEGRATION === "1";
const it = test.serial.skipIf(!RUN_INTEGRATION);

describe("integration: Marmiton", () => {
  it(
    "scrapes a few known recipe URLs",
    async () => {
      const urls = [
        "https://www.marmiton.org/recettes/recette_pates-au-basilic-tomates-sechees-et-feta_28822.aspx",
        "https://www.marmiton.org/recettes/recette_salade-de-pates-aux-tomates-cerises-basilic-et-parmesan_18599.aspx",
        "https://www.marmiton.org/recettes/recette_pates-mascarpone-sauce-tomate_39023.aspx"
      ];

      const rateLimiter = new DomainRateLimiter({ minDelayMs: 1500, jitterMs: 0 });

      for (const url of urls) {
        const recipe = await scrapeRecipeFromUrl(url, {
          timeoutMs: 30_000,
          rateLimiter
        });

        expect(recipe.source_name).toBe("Marmiton");
        expect(recipe.source_url).toContain("marmiton.org");
        expect(recipe.source_url).not.toContain("/https&");

        expect(recipe.ingredients.length).toBeGreaterThanOrEqual(2);
        expect(recipe.steps.length).toBeGreaterThanOrEqual(2);
      }
    },
    { timeout: 120_000 }
  );
});
