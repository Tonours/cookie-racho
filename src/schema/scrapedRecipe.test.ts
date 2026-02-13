import { describe, expect, test } from "bun:test";

import { ScrapedRecipeSchema } from "./scrapedRecipe";

describe("ScrapedRecipeSchema", () => {
  test("accepts a valid recipe", () => {
    const recipe = {
      name: "Pates tomates basilic",
      description: "Pates rapides et simples.",
      vegetarian: true,
      max_prep_time: 20,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 4,
      allergens: ["gluten"],
      ingredients: [
        { name: "Pates", quantity: 350, unit: "g", aisle: "epicerie" },
        { name: "Tomates", quantity: 400, unit: "g", aisle: "fruits_legumes" }
      ],
      steps: [
        { description: "Cuire les pates.", minutes: 10 },
        { description: "Preparer la sauce tomate et melanger." }
      ],
      source_name: "MaSource",
      source_url: "https://example.com/recipes/pates-tomates",
      source_license: "CC BY 4.0",
      source_attribution: "Auteur / Site"
    };

    expect(ScrapedRecipeSchema.parse(recipe)).toEqual(recipe);
  });

  test("rejects invalid units", () => {
    const result = ScrapedRecipeSchema.safeParse({
      name: "X",
      description: "",
      vegetarian: false,
      max_prep_time: 20,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 2,
      allergens: [],
      ingredients: [
        // @ts-expect-error test
        { name: "Farine", quantity: 100, unit: "tbsp" },
        { name: "Eau", quantity: 100, unit: "ml" }
      ],
      steps: [{ description: "A" }, { description: "B" }],
      source_name: "S",
      source_url: "https://example.com/x",
      source_license: "unknown",
      source_attribution: "S"
    });

    expect(result.success).toBe(false);
  });

  test("rejects quantity <= 0", () => {
    const result = ScrapedRecipeSchema.safeParse({
      name: "X",
      description: "",
      vegetarian: false,
      max_prep_time: 20,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 2,
      allergens: [],
      ingredients: [
        { name: "Farine", quantity: 0, unit: "g" },
        { name: "Eau", quantity: 100, unit: "ml" }
      ],
      steps: [{ description: "A" }, { description: "B" }],
      source_name: "S",
      source_url: "https://example.com/x",
      source_license: "unknown",
      source_attribution: "S"
    });

    expect(result.success).toBe(false);
  });

  test("rejects recipes with too few ingredients or steps", () => {
    const tooFewIngredients = ScrapedRecipeSchema.safeParse({
      name: "X",
      description: "",
      vegetarian: false,
      max_prep_time: 20,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 2,
      allergens: [],
      ingredients: [{ name: "Farine", quantity: 100, unit: "g" }],
      steps: [{ description: "A" }, { description: "B" }],
      source_name: "S",
      source_url: "https://example.com/x",
      source_license: "unknown",
      source_attribution: "S"
    });

    const tooFewSteps = ScrapedRecipeSchema.safeParse({
      name: "X",
      description: "",
      vegetarian: false,
      max_prep_time: 20,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 2,
      allergens: [],
      ingredients: [
        { name: "Farine", quantity: 100, unit: "g" },
        { name: "Eau", quantity: 100, unit: "ml" }
      ],
      steps: [{ description: "A" }],
      source_name: "S",
      source_url: "https://example.com/x",
      source_license: "unknown",
      source_attribution: "S"
    });

    expect(tooFewIngredients.success).toBe(false);
    expect(tooFewSteps.success).toBe(false);
  });

  test("rejects out-of-range times and servings", () => {
    const badTime = ScrapedRecipeSchema.safeParse({
      name: "X",
      description: "",
      vegetarian: false,
      max_prep_time: 301,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 2,
      allergens: [],
      ingredients: [
        { name: "Farine", quantity: 100, unit: "g" },
        { name: "Eau", quantity: 100, unit: "ml" }
      ],
      steps: [{ description: "A" }, { description: "B" }],
      source_name: "S",
      source_url: "https://example.com/x",
      source_license: "unknown",
      source_attribution: "S"
    });

    const badServings = ScrapedRecipeSchema.safeParse({
      name: "X",
      description: "",
      vegetarian: false,
      max_prep_time: 20,
      is_seasonal: false,
      batch_friendly: false,
      base_servings: 0,
      allergens: [],
      ingredients: [
        { name: "Farine", quantity: 100, unit: "g" },
        { name: "Eau", quantity: 100, unit: "ml" }
      ],
      steps: [{ description: "A" }, { description: "B" }],
      source_name: "S",
      source_url: "https://example.com/x",
      source_license: "unknown",
      source_attribution: "S"
    });

    expect(badTime.success).toBe(false);
    expect(badServings.success).toBe(false);
  });
});
