import { describe, expect, test } from "bun:test";

import { extractRecipeMicrodataFromHtml } from "./microdata";

describe("extractRecipeMicrodataFromHtml", () => {
  test("extracts basic Recipe microdata", () => {
    const html = `<!doctype html>
      <html>
        <body>
          <div itemscope itemtype="https://schema.org/Recipe">
            <span itemprop="name">Micro Pates</span>
            <p itemprop="description">  Desc  </p>
            <ul>
              <li itemprop="recipeIngredient">350 g de pates</li>
              <li itemprop="recipeIngredient">400 g tomates</li>
            </ul>
            <ol itemprop="recipeInstructions">
              <li>Cuire 10 min.</li>
              <li>Melanger.</li>
            </ol>
            <meta itemprop="totalTime" content="PT20M" />
            <span itemprop="recipeYield">4</span>
          </div>
        </body>
      </html>`;

    expect(extractRecipeMicrodataFromHtml(html)).toEqual({
      name: "Micro Pates",
      description: "Desc",
      recipeIngredient: ["350 g de pates", "400 g tomates"],
      recipeInstructions: ["Cuire 10 min.", "Melanger."],
      totalTime: "PT20M",
      recipeYield: "4"
    });
  });

  test("reads values from meta content", () => {
    const html = `<!doctype html>
      <html>
        <body>
          <div itemscope itemtype="https://schema.org/Recipe">
            <meta itemprop="name" content="MetaName" />
            <meta itemprop="recipeIngredient" content="100 g farine" />
            <meta itemprop="recipeIngredient" content="100 ml eau" />
            <meta itemprop="recipeInstructions" content="A" />
            <meta itemprop="recipeInstructions" content="B" />
          </div>
        </body>
      </html>`;

    expect(extractRecipeMicrodataFromHtml(html)).toEqual({
      name: "MetaName",
      recipeIngredient: ["100 g farine", "100 ml eau"],
      recipeInstructions: ["A", "B"]
    });
  });

  test("returns null when no Recipe microdata exists", () => {
    expect(extractRecipeMicrodataFromHtml("<html><body></body></html>")).toBeNull();
  });
});
