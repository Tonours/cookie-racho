import type { ScrapedStep } from "../schema/scrapedRecipe";

type JsonObject = Record<string, unknown>;

export function normalizeInstructionsToSteps(instructions: unknown): ScrapedStep[] {
  const rawSteps = extractInstructionTexts(instructions)
    .map((s) => normalizeWhitespace(s))
    .map((s) => stripLeadingStepIndex(s))
    .filter((s) => s.length > 0);

  const steps: ScrapedStep[] = rawSteps.map((description) => {
    const minutes = extractMinutes(description);
    return minutes ? { description, minutes } : { description };
  });

  return steps;
}

function extractInstructionTexts(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") return splitInstructionString(value);
  if (Array.isArray(value)) return value.flatMap((v) => extractInstructionTexts(v));
  if (typeof value !== "object") return [];

  const obj = value as JsonObject;
  const text = obj.text;
  if (typeof text === "string") return [text];
  const itemListElement = obj.itemListElement;
  if (itemListElement) return extractInstructionTexts(itemListElement);
  const steps = obj.steps;
  if (steps) return extractInstructionTexts(steps);
  const name = obj.name;
  if (typeof name === "string" && hasType(obj, "HowToStep")) return [name];

  return [];
}

function splitInstructionString(s: string): string[] {
  const raw = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return [];

  const byLines = raw
    .split(/\n+/)
    .map((x) => normalizeWhitespace(x))
    .filter(Boolean);
  if (byLines.length >= 2) return byLines;

  // Fallback: sentence split
  const normalized = normalizeWhitespace(raw);
  const bySentences = normalized
    .split(/(?:\.|;)(?:\s+|$)/)
    .map((x) => x.trim())
    .filter(Boolean);

  return bySentences.length >= 2 ? bySentences : [normalized];
}

function stripLeadingStepIndex(s: string): string {
  return s.replace(/^\s*(?:etape|step)?\s*\d+\s*[\)\.:\-]\s*/i, "").trim();
}

function extractMinutes(description: string): number | undefined {
  const s = description;

  // 1 h 30
  const hm = s.match(/(\d+)\s*(?:h|heures?)\s*(\d+)\s*(?:min|minutes?)?/i);
  if (hm) {
    const h = Number.parseInt(hm[1], 10);
    const m = Number.parseInt(hm[2], 10);
    const total = h * 60 + m;
    return total > 0 ? total : undefined;
  }

  // 1 h
  const hOnly = s.match(/(\d+)\s*(?:h|heures?)\b/i);
  if (hOnly) {
    const h = Number.parseInt(hOnly[1], 10);
    const total = h * 60;
    return total > 0 ? total : undefined;
  }

  // 10 min
  const mOnly = s.match(/(\d+)\s*(?:min|minutes?)\b/i);
  if (mOnly) {
    const m = Number.parseInt(mOnly[1], 10);
    return m > 0 ? m : undefined;
  }

  return undefined;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function hasType(obj: JsonObject, expected: string): boolean {
  const raw = obj["@type"];
  if (typeof raw === "string") return raw === expected;
  if (Array.isArray(raw)) return raw.some((t) => t === expected);
  return false;
}
