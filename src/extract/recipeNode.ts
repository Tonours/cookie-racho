import { extractRecipeJsonLdFromHtml, type JsonObject } from "./jsonld";
import { extractRecipeMicrodataFromHtml } from "./microdata";

export function extractMergedRecipeNodeFromHtml(html: string): JsonObject | null {
  const jsonld = extractRecipeJsonLdFromHtml(html);
  const micro = extractRecipeMicrodataFromHtml(html);
  return mergeRecipeNodes(jsonld, micro);
}

export function mergeRecipeNodes(primary: JsonObject | null, fallback: JsonObject | null): JsonObject | null {
  if (!primary && !fallback) return null;
  if (primary && !fallback) return primary;
  if (!primary && fallback) return fallback;

  const a = primary as JsonObject;
  const b = fallback as JsonObject;

  const merged: JsonObject = { ...b, ...a };

  // Prefer non-empty strings from primary; fill missing/empty from fallback.
  for (const key of [
    "name",
    "description",
    "totalTime",
    "prepTime",
    "cookTime",
    "recipeYield",
    "suitableForDiet",
    "url"
  ]) {
    const chosen = chooseNonEmptyString(a[key], b[key]);
    if (chosen !== null) merged[key] = chosen;
  }

  merged.recipeIngredient = chooseBestArray(a.recipeIngredient, b.recipeIngredient);
  merged.recipeInstructions = chooseBestInstructions(a.recipeInstructions, b.recipeInstructions);

  return merged;
}

function chooseNonEmptyString(a: unknown, b: unknown): string | null {
  const aa = typeof a === "string" ? a.trim() : "";
  if (aa) return aa;
  const bb = typeof b === "string" ? b.trim() : "";
  return bb ? bb : null;
}

function chooseBestArray(a: unknown, b: unknown): unknown {
  const aArr = Array.isArray(a) ? a : typeof a === "string" && a.trim() ? [a] : [];
  const bArr = Array.isArray(b) ? b : typeof b === "string" && b.trim() ? [b] : [];

  if (aArr.length >= 2) return aArr;
  if (bArr.length >= 2) return bArr;
  if (aArr.length > 0) return aArr;
  if (bArr.length > 0) return bArr;
  return [];
}

function chooseBestInstructions(a: unknown, b: unknown): unknown {
  const aArr = Array.isArray(a) ? a : null;
  const bArr = Array.isArray(b) ? b : null;

  if (aArr && aArr.length >= 2) return aArr;
  if (bArr && bArr.length >= 2) return bArr;
  if (aArr && aArr.length > 0) return aArr;
  if (typeof a === "string" && a.trim()) return a;
  if (bArr && bArr.length > 0) return bArr;
  if (typeof b === "string" && b.trim()) return b;
  return [];
}
