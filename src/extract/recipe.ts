import type { PageCache } from "../core/cache";
import type { DomainRateLimiter } from "../core/fetcher";
import { fetchHtml } from "../core/fetcher";
import type { ScrapedRecipe } from "../schema/scrapedRecipe";
import { normalizeRecipeFromJsonLd } from "../normalize/recipe";

import { extractCanonicalUrl, extractHtmlTitle } from "./htmlMeta";
import { extractMergedRecipeNodeFromHtml } from "./recipeNode";

export type ScrapeOptions = {
  timeoutMs?: number;
  userAgent?: string;
  acceptLanguage?: string;
  cache?: PageCache | null;
  cacheTtlMs?: number;
  rateLimiter?: DomainRateLimiter;
  now?: () => number;
  fetchImpl?: typeof fetch;
};

export async function scrapeRecipeFromUrl(url: string, options: ScrapeOptions = {}): Promise<ScrapedRecipe> {
  const page = await fetchHtml(url, {
    timeoutMs: options.timeoutMs,
    userAgent: options.userAgent,
    acceptLanguage: options.acceptLanguage,
    cache: options.cache,
    cacheTtlMs: options.cacheTtlMs,
    rateLimiter: options.rateLimiter,
    now: options.now,
    fetchImpl: options.fetchImpl
  });

  const canonicalUrl = extractCanonicalUrl(page.html);
  const pageTitle = extractHtmlTitle(page.html);

  const recipeNode = extractMergedRecipeNodeFromHtml(page.html);
  if (!recipeNode) throw new Error("No recipe data found (JSON-LD or microdata)");

  return normalizeRecipeFromJsonLd(recipeNode, {
    sourceUrl: page.resolvedUrl,
    canonicalUrl,
    pageTitle
  });
}
