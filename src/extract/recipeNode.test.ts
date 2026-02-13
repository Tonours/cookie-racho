import { describe, expect, test } from "bun:test";

import { extractMergedRecipeNodeFromHtml, mergeRecipeNodes } from "./recipeNode";

describe("extractMergedRecipeNodeFromHtml", () => {
  test("returns null when no recipe is present", () => {
    expect(extractMergedRecipeNodeFromHtml("<html></html>")).toBeNull();
  });

  test("merges JSON-LD with microdata (fills missing arrays)", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context":"https://schema.org/",
            "@type":"Recipe",
            "name":"JsonLdName",
            "recipeIngredient":["only one"],
            "recipeInstructions":["only one"]
          }</script>
        </head>
        <body>
          <div itemscope itemtype="https://schema.org/Recipe">
            <span itemprop="name">MicroName</span>
            <ul>
              <li itemprop="recipeIngredient">A</li>
              <li itemprop="recipeIngredient">B</li>
            </ul>
            <ol itemprop="recipeInstructions">
              <li>Step A</li>
              <li>Step B</li>
            </ol>
          </div>
        </body>
      </html>`;

    expect(extractMergedRecipeNodeFromHtml(html)).toMatchObject({
      name: "JsonLdName",
      recipeIngredient: ["A", "B"],
      recipeInstructions: ["Step A", "Step B"]
    });
  });

  test("prefers JSON-LD arrays when they look complete", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context":"https://schema.org/",
            "@type":"Recipe",
            "name":"JsonLdName",
            "recipeIngredient":["I1","I2"],
            "recipeInstructions":["S1","S2"]
          }</script>
        </head>
        <body>
          <div itemscope itemtype="https://schema.org/Recipe">
            <span itemprop="name">MicroName</span>
            <ul>
              <li itemprop="recipeIngredient">A</li>
              <li itemprop="recipeIngredient">B</li>
            </ul>
            <ol itemprop="recipeInstructions">
              <li>Step A</li>
              <li>Step B</li>
            </ol>
          </div>
        </body>
      </html>`;

    expect(extractMergedRecipeNodeFromHtml(html)).toMatchObject({
      name: "JsonLdName",
      recipeIngredient: ["I1", "I2"],
      recipeInstructions: ["S1", "S2"]
    });
  });

  test("uses microdata when JSON-LD is missing", () => {
    const html = `<!doctype html>
      <html>
        <body>
          <div itemscope itemtype="https://schema.org/Recipe">
            <span itemprop="name">MicroName</span>
            <meta itemprop="recipeIngredient" content="A" />
            <meta itemprop="recipeIngredient" content="B" />
            <meta itemprop="recipeInstructions" content="S1" />
            <meta itemprop="recipeInstructions" content="S2" />
          </div>
        </body>
      </html>`;

    expect(extractMergedRecipeNodeFromHtml(html)).toEqual({
      name: "MicroName",
      recipeIngredient: ["A", "B"],
      recipeInstructions: ["S1", "S2"]
    });
  });
});

describe("mergeRecipeNodes", () => {
  test("prefers primary non-empty arrays even when size is 1", () => {
    const merged = mergeRecipeNodes(
      { recipeIngredient: ["a"], recipeInstructions: [] } as any,
      { recipeIngredient: ["b"], recipeInstructions: [] } as any
    );
    expect(merged && (merged as any).recipeIngredient).toEqual(["a"]);
  });

  test("uses fallback arrays when primary is empty", () => {
    const merged = mergeRecipeNodes(
      { recipeIngredient: [], recipeInstructions: [] } as any,
      { recipeIngredient: ["b"], recipeInstructions: [] } as any
    );
    expect(merged && (merged as any).recipeIngredient).toEqual(["b"]);
  });

  test("returns empty arrays when both are empty", () => {
    const merged = mergeRecipeNodes({} as any, {} as any);
    expect(merged && (merged as any).recipeIngredient).toEqual([]);
    expect(merged && (merged as any).recipeInstructions).toEqual([]);
  });

  test("instruction selection supports arrays and strings", () => {
    const aArr = mergeRecipeNodes(
      { recipeInstructions: ["one"], recipeIngredient: ["x", "y"] } as any,
      { recipeInstructions: [], recipeIngredient: ["x", "y"] } as any
    );
    expect(aArr && (aArr as any).recipeInstructions).toEqual(["one"]);

    const aStr = mergeRecipeNodes(
      { recipeInstructions: "one", recipeIngredient: ["x", "y"] } as any,
      { recipeInstructions: [], recipeIngredient: ["x", "y"] } as any
    );
    expect(aStr && (aStr as any).recipeInstructions).toBe("one");

    const bArr = mergeRecipeNodes(
      { recipeInstructions: "", recipeIngredient: ["x", "y"] } as any,
      { recipeInstructions: ["two"], recipeIngredient: ["x", "y"] } as any
    );
    expect(bArr && (bArr as any).recipeInstructions).toEqual(["two"]);

    const bStr = mergeRecipeNodes(
      { recipeInstructions: "", recipeIngredient: ["x", "y"] } as any,
      { recipeInstructions: "two", recipeIngredient: ["x", "y"] } as any
    );
    expect(bStr && (bStr as any).recipeInstructions).toBe("two");
  });
});
