import { ScrapedRecipeSchema, type ScrapedRecipe } from "../schema/scrapedRecipe";
import { normalizeUrlSpec } from "../core/url";
import { includesKeyword, toAsciiLower, tokenizeForMatching } from "../core/text";
import { inferSourceMeta } from "../sites/registry";
import { parseIso8601DurationToMinutes } from "./duration";
import { detectAllergens } from "./allergens";
import { inferAisleCategory } from "./aisle";
import { inferBatchFriendly } from "./batch";
import { inferIsSeasonal } from "./seasonal";
import { parseIngredientLine } from "./ingredients";
import { normalizeInstructionsToSteps } from "./steps";

type JsonObject = Record<string, unknown>;

export type NormalizeContext = {
  sourceUrl: string;
  canonicalUrl?: string | null;
  pageTitle?: string | null;
  sourceNameOverride?: string;
  sourceLicenseOverride?: string;
  sourceAttributionOverride?: string;
};

export function normalizeRecipeFromJsonLd(node: JsonObject, ctx: NormalizeContext): ScrapedRecipe {
  const baseUrl = normalizeUrlSpec(ctx.sourceUrl);
  const sourceUrl = pickSourceUrl(node, ctx, baseUrl);

  const inferred = inferSourceMeta(sourceUrl);
  const source_name = ctx.sourceNameOverride ?? inferred.source_name;
  const source_license = ctx.sourceLicenseOverride ?? inferred.source_license;
  const source_attribution = ctx.sourceAttributionOverride ?? inferred.source_attribution;

  const name = (typeof node.name === "string" ? node.name : ctx.pageTitle ?? "").trim();
  if (!name) throw new Error("Unable to derive recipe name");

  const description = typeof node.description === "string" ? node.description.trim() : "";

  const ingredientLines = coerceStringArray(node.recipeIngredient);
  const ingredientsRaw = ingredientLines
    .map((l) => parseIngredientLine(l))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const ingredients = ingredientsRaw.map((ing) => {
    if (ing.aisle) return ing;
    const aisle = inferAisleCategory(ing.name);
    return aisle ? { ...ing, aisle } : ing;
  });

  const steps = normalizeInstructionsToSteps(node.recipeInstructions);

  if (ingredients.length < 2) throw new Error("Not enough ingredients extracted");
  if (steps.length < 2) throw new Error("Not enough steps extracted");

  const allergens = detectAllergens(ingredients.map((i) => i.name));
  const vegetarian = deriveVegetarian(node, ingredients.map((i) => i.name));

  const max_prep_time = clampInt(deriveTotalMinutes(node), 5, 300);
  const base_servings = clampInt(deriveServings(node), 1, 20);

  const is_seasonal = inferIsSeasonal(ingredients.map((i) => i.name));
  const batch_friendly = inferBatchFriendly({ name, description, steps });

  const recipe: ScrapedRecipe = {
    name,
    description,
    vegetarian,
    max_prep_time,
    is_seasonal,
    batch_friendly,
    base_servings,
    allergens,
    ingredients,
    steps,
    source_name,
    source_url: sourceUrl,
    source_license,
    source_attribution
  };

  // Runtime validation (typing + guarantees)
  return ScrapedRecipeSchema.parse(recipe);
}

function pickSourceUrl(node: JsonObject, ctx: NormalizeContext, baseUrl: string): string {
  const candidates: Array<unknown> = [
    ctx.canonicalUrl,
    node.mainEntityOfPage,
    node.url
  ];

  for (const c of candidates) {
    const resolved = resolveUrlCandidate(c, baseUrl);
    if (resolved) return resolved;
  }

  return baseUrl;
}

function resolveUrlCandidate(value: unknown, baseUrl: string): string | null {
  if (!value) return null;
  if (typeof value === "string") return normalizeToAbsolute(value, baseUrl);
  if (typeof value === "object") {
    const obj = value as JsonObject;
    const id = obj["@id"];
    if (typeof id === "string") return normalizeToAbsolute(id, baseUrl);
  }
  return null;
}

function normalizeToAbsolute(maybeRelative: string, baseUrl: string): string | null {
  try {
    const abs = new URL(maybeRelative, baseUrl).toString();
    return normalizeUrlSpec(abs);
  } catch {
    return null;
  }
}

function coerceStringArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string") as string[];
  return [];
}

function deriveServings(node: JsonObject): number {
  const yieldValue = node.recipeYield ?? node.yield;
  const text = Array.isArray(yieldValue)
    ? yieldValue.find((x) => typeof x === "string")
    : typeof yieldValue === "string"
      ? yieldValue
      : "";
  const match = text.match(/(\d+)/);
  const servings = match ? Number.parseInt(match[1], 10) : 4;
  return Number.isFinite(servings) && servings > 0 ? servings : 4;
}

function deriveTotalMinutes(node: JsonObject): number {
  const total = typeof node.totalTime === "string" ? parseIso8601DurationToMinutes(node.totalTime) : null;
  if (typeof total === "number") return total;

  const prep = typeof node.prepTime === "string" ? parseIso8601DurationToMinutes(node.prepTime) : null;
  const cook = typeof node.cookTime === "string" ? parseIso8601DurationToMinutes(node.cookTime) : null;

  if (typeof prep === "number" && typeof cook === "number") return prep + cook;
  if (typeof prep === "number") return prep;
  if (typeof cook === "number") return cook;

  return 30;
}

function deriveVegetarian(node: JsonObject, ingredientNames: string[]): boolean {
  const diet = collectDietStrings(node.suitableForDiet);
  const isDietVeg = diet.some((d) => d.includes("vegetariandiet") || d.includes("vegandiet"));
  if (isDietVeg) return true;

  const tokenized = ingredientNames.map((x) => tokenizeForMatching(x));
  const nonVegKeywords = [
    "boeuf",
    "b\u0153uf",
    "poulet",
    "dinde",
    "porc",
    "jambon",
    "lardon",
    "saucisse",
    "saumon",
    "thon",
    "poisson",
    "crevette",
    "crabe",
    "homard",
    "gelatine",
    "anchois"
  ];

  const hasNonVeg = tokenized.some((tokens) => nonVegKeywords.some((k) => includesKeyword(tokens, k)));
  return !hasNonVeg;
}

function collectDietStrings(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [toAsciiLower(value)];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? (v as JsonObject)["@id"] : null))
      .filter((v): v is string => typeof v === "string")
      .map((v) => toAsciiLower(v));
  }
  if (typeof value === "object") {
    const id = (value as JsonObject)["@id"];
    return typeof id === "string" ? [toAsciiLower(id)] : [];
  }
  return [];
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.trunc(value) : min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
