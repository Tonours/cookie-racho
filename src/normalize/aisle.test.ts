import { describe, expect, test } from "bun:test";

import { inferAisleCategory } from "./aisle";

describe("inferAisleCategory", () => {
  test("classifies common ingredients", () => {
    expect(inferAisleCategory("Tomates")).toBe("fruits_legumes");
    expect(inferAisleCategory("Poulet")).toBe("boucherie_poisson");
    expect(inferAisleCategory("Saumon")).toBe("boucherie_poisson");
    expect(inferAisleCategory("Lait")).toBe("cremerie");
    expect(inferAisleCategory("Farine"))
      .toBe("epicerie");
    expect(inferAisleCategory("Pain"))
      .toBe("boulangerie");
    expect(inferAisleCategory("Vin blanc"))
      .toBe("boissons");
    expect(inferAisleCategory("Vinaigre"))
      .toBe("epicerie");
  });

  test("returns undefined when no rule matches", () => {
    expect(inferAisleCategory("Xyz"))
      .toBeUndefined();
  });
});
