import { extractJsonLdObjects, type JsonObject } from "../extract/jsonld";
import { getUrlHost, normalizeUrlSpec } from "../core/url";

export type ItemListResult = {
  url: string;
  name?: string;
};

export function extractItemListResultsFromHtml(
  html: string,
  options: { baseUrl: string; allowedHostSuffixes?: string[] }
): ItemListResult[] {
  const baseUrl = normalizeUrlSpec(options.baseUrl);
  const allowed = options.allowedHostSuffixes?.map((s) => s.toLowerCase()) ?? null;

  const jsonlds = extractJsonLdObjects(html);
  const objects: JsonObject[] = [];
  for (const root of jsonlds) collectObjects(root, objects);

  const results: ItemListResult[] = [];
  for (const obj of objects) {
    if (!hasType(obj, "ItemList")) continue;
    const elements = obj.itemListElement;
    extractItemListElements(elements, baseUrl, allowed, results);
  }

  // Deduplicate while preserving order.
  const seen = new Set<string>();
  const deduped: ItemListResult[] = [];
  for (const r of results) {
    const key = r.url;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  return deduped;
}

function extractItemListElements(
  value: unknown,
  baseUrl: string,
  allowed: string[] | null,
  out: ItemListResult[]
): void {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const v of value) extractItemListElements(v, baseUrl, allowed, out);
    return;
  }

  if (typeof value === "string") {
    const url = resolveUrl(value, baseUrl);
    if (url && isAllowed(url, allowed)) out.push({ url });
    return;
  }

  if (typeof value !== "object") return;
  const obj = value as JsonObject;

  const itemName = extractNameFromItem(obj.item);
  const name = typeof obj.name === "string" ? obj.name.trim() : itemName;
  const urlCandidate =
    (typeof obj.url === "string" ? obj.url : null) ??
    (typeof obj["@id"] === "string" ? (obj["@id"] as string) : null) ??
    extractUrlFromItem(obj.item);

  const url = urlCandidate ? resolveUrl(urlCandidate, baseUrl) : null;
  if (url && isAllowed(url, allowed)) out.push(name ? { url, name } : { url });
}

function extractNameFromItem(item: unknown): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  const obj = item as JsonObject;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  return name ? name : undefined;
}

function extractUrlFromItem(item: unknown): string | null {
  if (!item) return null;
  if (typeof item === "string") return item;
  if (typeof item !== "object") return null;
  const obj = item as JsonObject;
  if (typeof obj["@id"] === "string") return obj["@id"] as string;
  if (typeof obj.url === "string") return obj.url;
  return null;
}

function resolveUrl(spec: string, baseUrl: string): string | null {
  try {
    const abs = new URL(spec, baseUrl).toString();
    return normalizeUrlSpec(abs);
  } catch {
    return null;
  }
}

function isAllowed(urlSpec: string, allowed: string[] | null): boolean {
  if (!allowed) return true;
  const host = getUrlHost(urlSpec);
  return allowed.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
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
