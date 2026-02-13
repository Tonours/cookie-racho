import { describe, expect, test } from "bun:test";

import { parseIngredientLine } from "./ingredients";

describe("parseIngredientLine", () => {
  test("parses grams", () => {
    expect(parseIngredientLine("350 g de pates")).toEqual({
      name: "Pates",
      quantity: 350,
      unit: "g"
    });
  });

  test("parses centilitres (converts to ml)", () => {
    expect(parseIngredientLine("20 cl de lait")).toEqual({
      name: "Lait",
      quantity: 200,
      unit: "ml"
    });
  });

  test("parses tablespoons", () => {
    expect(parseIngredientLine("2 c. \u00e0 soupe d'huile d'olive")).toEqual({
      name: "Huile d'olive",
      quantity: 2,
      unit: "cs"
    });
  });

  test("parses fractions", () => {
    expect(parseIngredientLine("1/2 l d'eau")).toEqual({
      name: "Eau",
      quantity: 0.5,
      unit: "l"
    });
  });

  test("parses numeric ranges using the mean", () => {
    expect(parseIngredientLine("2 \u00e0 3 tomates")).toEqual({
      name: "Tomates",
      quantity: 2.5,
      unit: "unit"
    });
  });

  test("parses numeric ranges with a dash", () => {
    expect(parseIngredientLine("2-3 tomates")).toEqual({
      name: "Tomates",
      quantity: 2.5,
      unit: "unit"
    });
  });

  test("parses mixed fractions", () => {
    expect(parseIngredientLine("1 1/2 l d'eau")).toEqual({
      name: "Eau",
      quantity: 1.5,
      unit: "l"
    });
  });

  test("parses French word numbers", () => {
    expect(parseIngredientLine("deux tomates")).toEqual({
      name: "Tomates",
      quantity: 2,
      unit: "unit"
    });
  });

  test("defaults to a pinch for salt/pepper", () => {
    expect(parseIngredientLine("sel")).toEqual({
      name: "Sel",
      quantity: 1,
      unit: "pincee"
    });
    expect(parseIngredientLine("poivre")).toEqual({
      name: "Poivre",
      quantity: 1,
      unit: "pincee"
    });
  });

  test("returns null for empty lines", () => {
    expect(parseIngredientLine("  ")).toBeNull();
  });
});
