import { getUrlHost, normalizeUrlSpec } from "../core/url";
import { decodeHtmlEntities } from "../extract/htmlEntities";

export type DuckDuckGoResult = {
  url: string;
  name?: string;
};

export function extractDuckDuckGoResultsFromHtml(
  html: string,
  options: { baseUrl: string; allowedHostSuffixes?: string[] }
): DuckDuckGoResult[] {
  const baseUrl = normalizeUrlSpec(options.baseUrl);
  const allowed = options.allowedHostSuffixes?.map((s) => s.toLowerCase()) ?? null;

  const results: DuckDuckGoResult[] = [];
  const aTagRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(aTagRe)) {
    const attrs = match[1] ?? "";
    if (!/\bresult__a\b/i.test(attrs)) continue;

    const hrefRaw = getAttr(attrs, "href");
    if (!hrefRaw) continue;

    const href = decodeHtmlEntities(hrefRaw).trim();
    const url = resolveDuckDuckGoHrefToTargetUrl(href, baseUrl);
    if (!url) continue;
    if (!isAllowed(url, allowed)) continue;

    const titleHtml = match[2] ?? "";
    const name = cleanupText(decodeHtmlEntities(stripTags(titleHtml)));
    results.push(name ? { url, name } : { url });
  }

  // Deduplicate while preserving order.
  const seen = new Set<string>();
  const deduped: DuckDuckGoResult[] = [];
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    deduped.push(r);
  }
  return deduped;
}

function resolveDuckDuckGoHrefToTargetUrl(href: string, baseUrl: string): string | null {
  let abs: URL;
  try {
    abs = new URL(href, baseUrl);
  } catch {
    return null;
  }

  const host = abs.hostname.toLowerCase();
  const isDuckDuckGo = host === "duckduckgo.com" || host.endsWith(".duckduckgo.com");
  if (isDuckDuckGo) {
    const uddg = abs.searchParams.get("uddg");
    if (!uddg) return null;
    try {
      // URLSearchParams already percent-decodes query values. Decoding again may corrupt URLs
      // that legitimately contain `%xx` sequences in their own query strings.
      return normalizeUrlSpec(uddg);
    } catch {
      return null;
    }
  }

  try {
    return normalizeUrlSpec(abs.toString());
  } catch {
    return null;
  }
}

function isAllowed(urlSpec: string, allowed: string[] | null): boolean {
  if (!allowed) return true;
  const host = getUrlHost(urlSpec);
  return allowed.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\">]+))`, "i");
  const m = attrs.match(re);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? null) as string | null;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ");
}

function cleanupText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
