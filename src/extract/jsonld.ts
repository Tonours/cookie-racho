export type JsonObject = Record<string, unknown>;

const JSONLD_SCRIPT_RE =
  /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi;

export function extractJsonLdObjects(html: string): unknown[] {
  const objects: unknown[] = [];

  for (const match of html.matchAll(JSONLD_SCRIPT_RE)) {
    const raw = match[1] ?? "";
    const parsed = parseJsonLd(raw);
    if (parsed !== null) objects.push(parsed);
  }

  return objects;
}

export function extractRecipeJsonLdFromHtml(html: string): JsonObject | null {
  const jsonlds = extractJsonLdObjects(html);
  return findFirstRecipeNode(jsonlds);
}

function parseJsonLd(scriptContent: string): unknown | null {
  const cleaned = cleanupJsonLd(scriptContent);
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function cleanupJsonLd(content: string): string {
  let s = content.trim();

  // Some sites wrap JSON-LD in HTML comments.
  if (s.startsWith("<!--")) s = s.replace(/^<!--\s*/u, "");
  if (s.endsWith("-->")) s = s.replace(/\s*-->$/u, "");

  return s.trim();
}

function findFirstRecipeNode(jsonlds: unknown[]): JsonObject | null {
  const candidates: JsonObject[] = [];
  for (const root of jsonlds) collectObjects(root, candidates);

  for (const obj of candidates) {
    if (hasType(obj, "Recipe")) return obj;
  }

  return null;
}

function collectObjects(value: unknown, out: JsonObject[]): void {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const v of value) collectObjects(v, out);
    return;
  }

  if (typeof value !== "object") return;

  const obj = value as JsonObject;
  out.push(obj);

  for (const v of Object.values(obj)) collectObjects(v, out);
}

function hasType(obj: JsonObject, expected: string): boolean {
  const raw = obj["@type"];
  if (typeof raw === "string") return normalizeType(raw) === expected;
  if (Array.isArray(raw)) {
    return raw.some((t) => typeof t === "string" && normalizeType(t) === expected);
  }
  return false;
}

function normalizeType(typeValue: string): string {
  const trimmed = typeValue.trim();
  const lastSlash = trimmed.lastIndexOf("/");
  const lastColon = trimmed.lastIndexOf(":");
  const idx = Math.max(lastSlash, lastColon);
  return (idx >= 0 ? trimmed.slice(idx + 1) : trimmed) || trimmed;
}
