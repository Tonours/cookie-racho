import { describe, expect, test } from "bun:test";

import { extractJsonLdObjects, extractRecipeJsonLdFromHtml } from "./jsonld";

describe("extractJsonLdObjects", () => {
  test("extracts and parses application/ld+json scripts", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org/",
            "@type": "Recipe",
            "name": "Pates"
          }</script>
        </head>
      </html>`;

    const jsonlds = extractJsonLdObjects(html);
    expect(jsonlds).toHaveLength(1);
    expect((jsonlds[0] as any)["@type"]).toBe("Recipe");
  });

  test("supports HTML-entity encoded type attribute", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application&#x2F;ld&#x2B;json">{"@type":"Recipe","name":"EntityType"}</script>
        </head>
      </html>`;

    const jsonlds = extractJsonLdObjects(html);
    expect(jsonlds).toHaveLength(1);
    expect((jsonlds[0] as any).name).toBe("EntityType");
  });

  test("ignores invalid JSON", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{not json</script>
          <script type="application/ld+json">{"@type":"Recipe","name":"Ok"}</script>
        </head>
      </html>`;

    const jsonlds = extractJsonLdObjects(html);
    expect(jsonlds).toHaveLength(1);
    expect((jsonlds[0] as any).name).toBe("Ok");
  });
});

describe("extractRecipeJsonLdFromHtml", () => {
  test("finds a Recipe node at root", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org/",
            "@type": "Recipe",
            "name": "Pates",
            "recipeIngredient": ["350 g de pates", "400 g tomates"],
            "recipeInstructions": ["Cuire", "Melanger"],
            "totalTime": "PT20M",
            "recipeYield": "4"
          }</script>
        </head>
      </html>`;

    const recipe = extractRecipeJsonLdFromHtml(html);
    expect(recipe && (recipe as any).name).toBe("Pates");
  });

  test("supports @type arrays", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org/",
            "@type": ["Thing", "Recipe"],
            "name": "ArrayType",
            "recipeIngredient": ["x", "y"],
            "recipeInstructions": ["a", "b"]
          }</script>
        </head>
      </html>`;

    const recipe = extractRecipeJsonLdFromHtml(html);
    expect(recipe && (recipe as any).name).toBe("ArrayType");
  });

  test("finds a Recipe node inside @graph", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org/",
            "@graph": [
              {"@type": "WebPage", "name": "X"},
              {"@type": "Recipe", "name": "InsideGraph", "recipeIngredient": ["x","y"], "recipeInstructions": ["a","b"]}
            ]
          }</script>
        </head>
      </html>`;

    const recipe = extractRecipeJsonLdFromHtml(html);
    expect(recipe && (recipe as any).name).toBe("InsideGraph");
  });

  test("returns null when no Recipe node exists", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org/",
            "@type": "WebPage",
            "name": "Not a recipe"
          }</script>
        </head>
      </html>`;

    expect(extractRecipeJsonLdFromHtml(html)).toBeNull();
  });
});
