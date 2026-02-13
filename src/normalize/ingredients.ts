import { toAsciiLower } from "../core/text";
import type { ScrapedIngredient, Unit } from "../schema/scrapedRecipe";

type QuantityParseResult = { quantity: number; rest: string };
type UnitParseResult = { unit: Unit; multiplier: number; rest: string };

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10
};

const UNICODE_FRACTIONS: Record<string, string> = {
  "\u00bc": "1/4",
  "\u00bd": "1/2",
  "\u00be": "3/4",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u215b": "1/8",
  "\u215c": "3/8",
  "\u215d": "5/8",
  "\u215e": "7/8"
};

export function parseIngredientLine(line: string): ScrapedIngredient | null {
  const original = line.replace(/\u00a0/g, " ").trim();
  if (!original) return null;

  let rest = original.replace(/^[\-*\u2022]\s+/u, "").trim();

  // Support unicode fraction glyphs at the start of a line.
  rest = replaceUnicodeFractions(rest);

  let quantity = 1;
  let unit: Unit = "unit";

  const qty = extractLeadingQuantity(rest);
  if (qty) {
    quantity = qty.quantity;
    rest = qty.rest.trim();

    const unitResult = extractLeadingUnit(rest);
    if (unitResult) {
      unit = unitResult.unit;
      quantity = quantity * unitResult.multiplier;
      rest = unitResult.rest.trim();
    }
  } else {
    const lowered = toAsciiLower(rest);
    if (isPinchIngredient(lowered)) {
      unit = "pincee";
      quantity = 1;
    }
  }

  rest = stripLeadingConnectors(rest);
  rest = stripContainerWord(rest);

  // Remove pure quantity hints like "(400 g)".
  rest = rest.replace(/\(\s*[\d.,]+\s*(?:g|gr|kg|ml|cl|l)\s*\)/gi, " ").trim();

  const name = capitalizeFirst(rest || original);

  return {
    name,
    quantity: normalizeQuantity(quantity),
    unit
  };
}

function normalizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  // Avoid -0 and tiny negatives from parsing bugs.
  return quantity;
}

function extractLeadingQuantity(input: string): QuantityParseResult | null {
  const s = input.trim();
  if (!s) return null;

  // Range: "2-3" or "2 a 3" / "2 à 3"
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:-|\u2013|\u2014|a|\u00e0)\s*(\d+(?:[.,]\d+)?)(\b|\s)/i);
  if (range) {
    const a = parseSimpleNumber(range[1]);
    const b = parseSimpleNumber(range[2]);
    if (a !== null && b !== null) return { quantity: (a + b) / 2, rest: s.slice(range[0].length) };
  }

  // Mixed fraction: "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)(\b|\s)/);
  if (mixed) {
    const whole = Number.parseInt(mixed[1], 10);
    const num = Number.parseInt(mixed[2], 10);
    const den = Number.parseInt(mixed[3], 10);
    if (den > 0) return { quantity: whole + num / den, rest: s.slice(mixed[0].length) };
  }

  // Fraction: "1/2"
  const frac = s.match(/^(\d+)\/(\d+)(\b|\s)/);
  if (frac) {
    const num = Number.parseInt(frac[1], 10);
    const den = Number.parseInt(frac[2], 10);
    if (den > 0) return { quantity: num / den, rest: s.slice(frac[0].length) };
  }

  // Decimal / integer
  const num = s.match(/^(\d+(?:[.,]\d+)?)(\b|\s)/);
  if (num) {
    const value = parseSimpleNumber(num[1]);
    if (value !== null) return { quantity: value, rest: s.slice(num[0].length) };
  }

  // French word numbers (small set)
  const word = s.match(/^(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)(\b|\s)/i);
  if (word) {
    const value = WORD_NUMBERS[toAsciiLower(word[1])];
    if (value) return { quantity: value, rest: s.slice(word[0].length) };
  }

  return null;
}

function extractLeadingUnit(input: string): UnitParseResult | null {
  const s = input.trim();
  if (!s) return null;

  // Metric
  {
    const m = s.match(/^(kg|kilogrammes?|kilos?)\b/i);
    if (m) return { unit: "kg", multiplier: 1, rest: s.slice(m[0].length) };
  }
  {
    const m = s.match(/^(g|gr|grammes?)\b/i);
    if (m) return { unit: "g", multiplier: 1, rest: s.slice(m[0].length) };
  }
  {
    const m = s.match(/^(ml|millilitres?)\b/i);
    if (m) return { unit: "ml", multiplier: 1, rest: s.slice(m[0].length) };
  }
  {
    const m = s.match(/^(cl|centilitres?)\b/i);
    if (m) return { unit: "ml", multiplier: 10, rest: s.slice(m[0].length) };
  }
  {
    const m = s.match(/^(l|litres?)\b/i);
    if (m) return { unit: "l", multiplier: 1, rest: s.slice(m[0].length) };
  }

  // Spoons (support "c. a soupe" and "c. à soupe")
  {
    const lowered = toAsciiLower(s);
    const re = /^(?:cs\b|c\.?\s*(?:a|\u00e0)\s*soupe\b|cuilleres?\s*(?:a|\u00e0)\s*soupe\b|cuilleres?\s*\u00e0\s*soupe\b)/;
    const m = lowered.match(re);
    if (m) return { unit: "cs", multiplier: 1, rest: s.slice(m[0].length) };
  }
  {
    const lowered = toAsciiLower(s);
    const re = /^(?:cc\b|c\.?\s*(?:a|\u00e0)\s*cafe\b|cuilleres?\s*(?:a|\u00e0)\s*cafe\b|cuilleres?\s*\u00e0\s*cafe\b)/;
    const m = lowered.match(re);
    if (m) return { unit: "cc", multiplier: 1, rest: s.slice(m[0].length) };
  }

  // Pinch
  {
    const lowered = toAsciiLower(s);
    const m = lowered.match(/^(pincee|pincees|pinc\u00e9e|pinc\u00e9es)\b/);
    if (m) return { unit: "pincee", multiplier: 1, rest: s.slice(m[0].length) };
  }

  return null;
}

function stripLeadingConnectors(s: string): string {
  return s
    .replace(/^de\s+/i, "")
    .replace(/^du\s+/i, "")
    .replace(/^des\s+/i, "")
    .replace(/^d['\u2019]\s*/i, "")
    .trim();
}

function stripContainerWord(s: string): string {
  return s.replace(
    /^(gousses?|tranches?|branches?|sachets?|boi(?:te|tes)s?)\s+(?:de|d'|d\u2019|du|des)\s+/i,
    ""
  );
}

function parseSimpleNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function replaceUnicodeFractions(s: string): string {
  let out = s;
  for (const [glyph, replacement] of Object.entries(UNICODE_FRACTIONS)) {
    out = out.replaceAll(glyph, replacement);
  }
  return out;
}

function isPinchIngredient(loweredAscii: string): boolean {
  return loweredAscii === "sel" || loweredAscii === "poivre";
}

function capitalizeFirst(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}
