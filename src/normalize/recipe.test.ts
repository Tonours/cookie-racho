import { describe, expect, test } from "bun:test";

import { normalizeRecipeFromJsonLd } from "./recipe";

describe("normalizeRecipeFromJsonLd", () => {
  function baseNode(overrides: Record<string, unknown> = {}) {
    return {
      "@type": "Recipe",
      name: "X",
      recipeIngredient: ["100 g de farine", "100 ml d'eau"],
      recipeInstructions: ["A", "B"],
      totalTime: "PT20M",
      recipeYield: "4",
      ...overrides
    };
  }

  test("normalizes a schema.org Recipe JSON-LD node", () => {
    const node = {
      "@type": "Recipe",
      name: "Pates tomates basilic",
      description: "Pates rapides et simples.",
      recipeIngredient: ["350 g de pates", "400 g de tomates"],
      recipeInstructions: ["Cuire les pates 10 min.", "Melanger."],
      totalTime: "PT20M",
      recipeYield: "4",
      suitableForDiet: "https://schema.org/VegetarianDiet"
    };

    const recipe = normalizeRecipeFromJsonLd(node, {
      sourceUrl: "https://example.com/recettes/pates",
      canonicalUrl: "https://example.com/recettes/pates-tomates"
    });

    expect(recipe).toMatchObject({
      name: "Pates tomates basilic",
      description: "Pates rapides et simples.",
      vegetarian: true,
      max_prep_time: 20,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 4,
      allergens: ["gluten"],
      source_url: "https://example.com/recettes/pates-tomates",
      source_license: "unknown"
    });
    expect(recipe.ingredients).toHaveLength(2);
    expect(recipe.steps).toHaveLength(2);
  });

  test("throws when required fields cannot be derived", () => {
    const node = {
      "@type": "Recipe",
      name: "X",
      recipeIngredient: ["100 g farine"],
      recipeInstructions: ["A"],
      totalTime: "PT20M",
      recipeYield: "4"
    };

    expect(() =>
      normalizeRecipeFromJsonLd(node, {
        sourceUrl: "https://example.com/x"
      })
    ).toThrow();
  });

  test("resolves source_url from a relative canonicalUrl", () => {
    const recipe = normalizeRecipeFromJsonLd(baseNode({ url: "https://example.com/from-node" }), {
      sourceUrl: "https://example.com/base",
      canonicalUrl: "/canon"
    });

    expect(recipe.source_url).toBe("https://example.com/canon");
  });

  test("falls back to node.url when canonicalUrl is invalid", () => {
    const recipe = normalizeRecipeFromJsonLd(baseNode({ url: "https://example.com/from-node" }), {
      sourceUrl: "https://example.com/base",
      // invalid URL to trigger resolve errors
      canonicalUrl: "http::://bad"
    });

    expect(recipe.source_url).toBe("https://example.com/from-node");
  });

  test("uses mainEntityOfPage @id when present", () => {
    const recipe = normalizeRecipeFromJsonLd(
      baseNode({
        mainEntityOfPage: { "@id": "/from-main-entity" }
      }),
      {
        sourceUrl: "https://example.com/base"
      }
    );

    expect(recipe.source_url).toBe("https://example.com/from-main-entity");
  });

  test("derives time from prepTime + cookTime when totalTime is missing", () => {
    const recipe = normalizeRecipeFromJsonLd(
      baseNode({
        totalTime: undefined,
        prepTime: "PT10M",
        cookTime: "PT5M"
      }),
      { sourceUrl: "https://example.com/x" }
    );
    expect(recipe.max_prep_time).toBe(15);
  });

  test("clamps max_prep_time to [5..300]", () => {
    const tooSmall = normalizeRecipeFromJsonLd(baseNode({ totalTime: "PT1M" }), {
      sourceUrl: "https://example.com/x"
    });
    expect(tooSmall.max_prep_time).toBe(5);

    const tooBig = normalizeRecipeFromJsonLd(baseNode({ totalTime: "PT400M" }), {
      sourceUrl: "https://example.com/x"
    });
    expect(tooBig.max_prep_time).toBe(300);
  });

  test("handles non-finite durations defensively", () => {
    const huge = "9".repeat(400);
    const recipe = normalizeRecipeFromJsonLd(baseNode({ totalTime: `PT${huge}H` }), {
      sourceUrl: "https://example.com/x"
    });

    expect(recipe.max_prep_time).toBe(5);
  });

  test("derives and clamps servings", () => {
    const fromArray = normalizeRecipeFromJsonLd(baseNode({ recipeYield: ["Pour 6 personnes"] }), {
      sourceUrl: "https://example.com/x"
    });
    expect(fromArray.base_servings).toBe(6);

    const clamped = normalizeRecipeFromJsonLd(baseNode({ recipeYield: "100" }), {
      sourceUrl: "https://example.com/x"
    });
    expect(clamped.base_servings).toBe(20);
  });

  test("marks recipes as non-vegetarian when meat/fish is detected", () => {
    const recipe = normalizeRecipeFromJsonLd(
      {
        "@type": "Recipe",
        name: "Poulet",
        recipeIngredient: ["200 g de poulet", "100 g de riz"],
        recipeInstructions: ["A", "B"],
        totalTime: "PT20M",
        recipeYield: "2"
      },
      { sourceUrl: "https://example.com/x" }
    );

    expect(recipe.vegetarian).toBe(false);
  });

  test("supports suitableForDiet arrays and objects", () => {
    const fromArray = normalizeRecipeFromJsonLd(
      baseNode({
        suitableForDiet: [{ "@id": "https://schema.org/VeganDiet" }]
      }),
      { sourceUrl: "https://example.com/x" }
    );
    expect(fromArray.vegetarian).toBe(true);

    const fromObject = normalizeRecipeFromJsonLd(
      baseNode({
        suitableForDiet: { "@id": "https://schema.org/VeganDiet" }
      }),
      { sourceUrl: "https://example.com/x" }
    );
    expect(fromObject.vegetarian).toBe(true);
  });

  test("infers source_name from known francophone cooking domains", () => {
    const cases: Array<[string, string]> = [
      ["https://www.marmiton.org/recettes/x", "Marmiton"],
      ["https://www.750g.com/x", "750g"],
      ["https://www.cuisineaz.com/x", "CuisineAZ"],
      ["https://www.ptitchef.com/x", "Ptitchef"],
      ["https://www.cuisineactuelle.fr/x", "Cuisine Actuelle"],
      ["https://cuisine.journaldesfemmes.fr/x", "Journal des Femmes"]
    ];

    for (const [url, expected] of cases) {
      const recipe = normalizeRecipeFromJsonLd(baseNode(), { sourceUrl: url });
      expect(recipe.source_name).toBe(expected);
    }
  });

  test("supports source metadata overrides", () => {
    const recipe = normalizeRecipeFromJsonLd(baseNode(), {
      sourceUrl: "https://example.com/x",
      sourceNameOverride: "Override",
      sourceLicenseOverride: "CC BY",
      sourceAttributionOverride: "Someone"
    });

    expect(recipe.source_name).toBe("Override");
    expect(recipe.source_license).toBe("CC BY");
    expect(recipe.source_attribution).toBe("Someone");
  });

  test("falls back to baseUrl when all source URL candidates fail", () => {
    const recipe = normalizeRecipeFromJsonLd(
      baseNode({
        // invalid candidates to force full fallback
        url: "http::://bad",
        mainEntityOfPage: { "@id": 123 }
      }),
      {
        sourceUrl: "https://example.com/base",
        canonicalUrl: "http::://bad"
      }
    );

    expect(recipe.source_url).toBe("https://example.com/base");
  });

  test("throws when recipeIngredient is not a string or array", () => {
    expect(() =>
      normalizeRecipeFromJsonLd(
        baseNode({
          // triggers coerceStringArray() object fallback
          recipeIngredient: { foo: "bar" }
        }),
        { sourceUrl: "https://example.com/x" }
      )
    ).toThrow();
  });

  test("derives time from prepTime only / cookTime only / fallback", () => {
    const prepOnly = normalizeRecipeFromJsonLd(
      baseNode({ totalTime: undefined, prepTime: "PT8M", cookTime: undefined }),
      { sourceUrl: "https://example.com/x" }
    );
    expect(prepOnly.max_prep_time).toBe(8);

    const cookOnly = normalizeRecipeFromJsonLd(
      baseNode({ totalTime: undefined, prepTime: undefined, cookTime: "PT9M" }),
      { sourceUrl: "https://example.com/x" }
    );
    expect(cookOnly.max_prep_time).toBe(9);

    const fallback = normalizeRecipeFromJsonLd(
      baseNode({ totalTime: undefined, prepTime: undefined, cookTime: undefined }),
      { sourceUrl: "https://example.com/x" }
    );
    expect(fallback.max_prep_time).toBe(30);
  });

  test("ignores suitableForDiet values of unsupported types", () => {
    const recipe = normalizeRecipeFromJsonLd(baseNode({ suitableForDiet: 123 }), {
      sourceUrl: "https://example.com/x"
    });
    expect(recipe.vegetarian).toBe(true);
  });
});
