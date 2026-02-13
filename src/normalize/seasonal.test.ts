import { describe, expect, test } from "bun:test";

import { inferIsSeasonal } from "./seasonal";

describe("inferIsSeasonal", () => {
  test("returns true for strongly seasonal produce", () => {
    expect(inferIsSeasonal(["Asperges", "Pates"])).toBe(true);
    expect(inferIsSeasonal(["Potimarron", "Creme"])).toBe(true);
  });

  test("returns false for common pantry staples", () => {
    expect(inferIsSeasonal(["Pates", "Farine"]))
      .toBe(false);
  });
});
