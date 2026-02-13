import { describe, expect, test } from "bun:test";

import { includesKeyword, tokenizeForMatching, toAsciiLower } from "./text";

describe("toAsciiLower", () => {
  test("lowercases and strips diacritics", () => {
    expect(toAsciiLower("Cr\u00e8me br\u00fbl\u00e9e")).toBe("creme brulee");
  });

  test("replaces common ligatures", () => {
    expect(toAsciiLower("b\u0153uf")).toBe("boeuf");
    expect(toAsciiLower("\u00c6ther")).toBe("aether");
  });
});

describe("tokenizeForMatching", () => {
  test("tokenizes on non-alphanumerics", () => {
    expect(tokenizeForMatching("Film alimentaire"))
      .toEqual(["film", "alimentaire"]);
  });
});

describe("includesKeyword", () => {
  test("matches singular/plural tokens", () => {
    expect(includesKeyword(tokenizeForMatching("tomates"), "tomate")).toBe(true);
    expect(includesKeyword(tokenizeForMatching("tomate"), "tomates")).toBe(true);
  });

  test("does not match substrings", () => {
    expect(includesKeyword(tokenizeForMatching("laitue"), "lait")).toBe(false);
  });

  test("matches multi-word phrases", () => {
    expect(includesKeyword(tokenizeForMatching("film alimentaire"), "film alimentaire")).toBe(true);
  });

  test("finds phrases after an initial mismatch", () => {
    expect(includesKeyword(tokenizeForMatching("a film alimentaire"), "film alimentaire")).toBe(true);
  });

  test("matches pluralized last token in phrases", () => {
    expect(includesKeyword(tokenizeForMatching("pois chiches"), "pois chiche")).toBe(true);
  });

  test("returns false when a phrase is not found", () => {
    expect(includesKeyword(tokenizeForMatching("film eau"), "film alimentaire")).toBe(false);
  });
});
