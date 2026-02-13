import * as cheerio from "cheerio";

import type { JsonObject } from "./jsonld";

export function extractRecipeMicrodataFromHtml(html: string): JsonObject | null {
  const $ = cheerio.load(html);
  const root = findRecipeRoot($);
  if (!root) return null;

  const name = readFirstItempropValue($, root, ["name"]);
  const description = readFirstItempropValue($, root, ["description"]);
  const recipeIngredient = readAllItempropValues($, root, ["recipeIngredient", "ingredients"]);
  const recipeInstructions = readInstructions($, root);
  const totalTime = readFirstItempropValue($, root, ["totalTime"]);
  const prepTime = readFirstItempropValue($, root, ["prepTime"]);
  const cookTime = readFirstItempropValue($, root, ["cookTime"]);
  const recipeYield = readFirstItempropValue($, root, ["recipeYield", "yield"]);
  const suitableForDiet = readFirstItempropValue($, root, ["suitableForDiet"]);
  const url = readFirstItempropValue($, root, ["url"]);

  const node: JsonObject = {};
  if (name) node.name = name;
  if (description) node.description = description;
  if (recipeIngredient.length) node.recipeIngredient = recipeIngredient;
  if (recipeInstructions.length) node.recipeInstructions = recipeInstructions;
  if (totalTime) node.totalTime = totalTime;
  if (prepTime) node.prepTime = prepTime;
  if (cookTime) node.cookTime = cookTime;
  if (recipeYield) node.recipeYield = recipeYield;
  if (suitableForDiet) node.suitableForDiet = suitableForDiet;
  if (url) node.url = url;

  return Object.keys(node).length ? node : null;
}

function findRecipeRoot($: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.Element> | null {
  const candidates = $("[itemscope][itemtype]")
    .toArray()
    .map((el) => $(el))
    .filter((el) => {
      const itemtype = (el.attr("itemtype") ?? "").toLowerCase();
      return itemtype.includes("schema.org") && itemtype.includes("recipe");
    });

  return candidates.length ? candidates[0] : null;
}

function readFirstItempropValue(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<cheerio.Element>,
  props: string[]
): string | null {
  for (const prop of props) {
    const el = root.find(`[itemprop="${prop}"]`).first();
    if (!el.length) continue;
    const value = readValue(el);
    if (value) return value;
  }
  return null;
}

function readAllItempropValues(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<cheerio.Element>,
  props: string[]
): string[] {
  const out: string[] = [];
  const selector = props.map((p) => `[itemprop="${p}"]`).join(",");
  root.find(selector).each((_i, elem) => {
    const value = readValue($(elem));
    if (value) out.push(value);
  });

  return out;
}

function readInstructions($: cheerio.CheerioAPI, root: cheerio.Cheerio<cheerio.Element>): string[] {
  const selector = `[itemprop="recipeInstructions"],[itemprop="instructions"]`;
  const out: string[] = [];

  root.find(selector).each((_i, elem) => {
    const el = $(elem);
    const value = readValue(el);

    const liTexts = el
      .find("li")
      .toArray()
      .map((li) => normalizeWhitespace($(li).text()))
      .filter(Boolean);

    if (liTexts.length >= 2) {
      out.push(...liTexts);
      return;
    }

    if (value) out.push(value);
  });

  return out;
}

function readValue(el: cheerio.Cheerio<cheerio.Element>): string | null {
  const content = el.attr("content");
  if (content) return normalizeWhitespace(content);

  const value = el.attr("value");
  if (value) return normalizeWhitespace(value);

  const href = el.attr("href");
  if (href) return normalizeWhitespace(href);

  const src = el.attr("src");
  if (src) return normalizeWhitespace(src);

  const text = normalizeWhitespace(el.text());
  return text ? text : null;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
