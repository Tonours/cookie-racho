import { describe, expect, test } from "bun:test";

import { detectAllergens } from "./allergens";

describe("detectAllergens", () => {
  test("detects common allergens from ingredient names", () => {
    const allergens = detectAllergens([
      "Farine",
      "Lait",
      "Oeufs",
      "Cacahuetes",
      "Noisettes",
      "Soja",
      "Saumon",
      "Crevettes",
      "Graines de s\u00e9same"
    ]);

    expect(allergens).toEqual([
      "gluten",
      "lactose",
      "oeuf",
      "arachide",
      "fruits_a_coque",
      "soja",
      "poisson",
      "crustaces",
      "sesame"
    ]);
  });

  test("returns empty array when nothing matches", () => {
    expect(detectAllergens(["Eau", "Tomates"]))
      .toEqual([]);
  });

  test("does not match substrings (e.g. lait in laitue)", () => {
    expect(detectAllergens(["Laitue"]))
      .toEqual([]);
  });
});
