import type { PageCache } from "../core/cache";
import { DomainRateLimiter, fetchHtml } from "../core/fetcher";
import { getUrlHost } from "../core/url";
import { defaultSiteIds, getSiteById, type SiteId } from "../sites/registry";
import { extractItemListResultsFromHtml } from "./jsonldItemList";

export type SearchResult = {
  name: string;
  source_name: string;
  source_url: string;
};

export type SearchSiteError = {
  site_id: SiteId;
  site_name: string;
  search_url: string;
  message: string;
};

export type SearchOptions = {
  siteIds?: SiteId[];
  maxResults?: number;
  maxResultsPerSite?: number;
  timeoutMs?: number;
  userAgent?: string;
  acceptLanguage?: string;
  cache?: PageCache | null;
  cacheTtlMs?: number;
  rateLimiter?: DomainRateLimiter;
  rateLimitMs?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
};

export async function searchRecipes(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; errors: SearchSiteError[] }> {
  const q = query.trim();
  if (!q) throw new Error("Query is required");

  const siteIds = options.siteIds ?? defaultSiteIds();
  const maxResults = options.maxResults ?? 10;
  const maxResultsPerSite = options.maxResultsPerSite ?? 5;

  const cache = options.cache ?? null;
  const rateLimiter =
    options.rateLimiter ??
    new DomainRateLimiter({
      minDelayMs: options.rateLimitMs ?? 1500,
      jitterMs: 200,
      now: options.now,
      random: Math.random
    });

  const errors: SearchSiteError[] = [];
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const siteId of siteIds) {
    const site = getSiteById(siteId);
    if (!site?.search) continue;

    const searchUrl = site.search.buildSearchUrl(q);
    try {
      const page = await fetchHtml(searchUrl, {
        timeoutMs: options.timeoutMs,
        userAgent: options.userAgent,
        acceptLanguage: options.acceptLanguage,
        cache,
        cacheTtlMs: options.cacheTtlMs,
        rateLimiter,
        now: options.now,
        fetchImpl: options.fetchImpl
      });

      const allowed = site.host_suffixes;
      const parsed = extractItemListResultsFromHtml(page.html, {
        baseUrl: page.resolvedUrl,
        allowedHostSuffixes: allowed
      });

      let addedForSite = 0;
      for (const item of parsed) {
        if (addedForSite >= maxResultsPerSite) break;
        if (results.length >= maxResults) break;

        const source_url = item.url;
        if (seen.has(source_url)) continue;
        seen.add(source_url);

        results.push({
          name: (item.name ?? fallbackNameFromUrl(source_url)).trim(),
          source_name: site.source_name,
          source_url
        });
        addedForSite += 1;
      }
    } catch (err) {
      errors.push({
        site_id: site.id,
        site_name: site.source_name,
        search_url: searchUrl,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return { results, errors };
}

export function fallbackNameFromUrl(urlSpec: string): string {
  try {
    const url = new URL(urlSpec);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments.at(-1) ?? "";
    const cleaned = last
      .replace(/\.[a-zA-Z0-9]+$/u, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (!cleaned) return getUrlHost(urlSpec);
    return cleaned[0].toUpperCase() + cleaned.slice(1);
  } catch {
    return urlSpec;
  }
}
