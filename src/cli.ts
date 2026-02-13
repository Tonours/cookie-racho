import path from "node:path";
import process from "node:process";

import { SqlitePageCache } from "./core/cache";
import { DomainRateLimiter } from "./core/fetcher";
import { scrapeRecipeFromUrl } from "./extract/recipe";
import { searchRecipes } from "./search/search";
import { defaultSiteIds, getSiteById, type SiteId } from "./sites/registry";

type Writer = { write: (chunk: string) => void };

export type CliDeps = {
  stdout?: Writer;
  stderr?: Writer;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  fetchImpl?: typeof fetch;
};

type OutputFormat = "json" | "jsonl";

export async function runCli(argv: string[] = process.argv, deps: CliDeps = {}): Promise<number> {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;

  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    stdout.write(renderHelp());
    return 0;
  }

  const command = args[0];
  if (command === "extract") {
    return await runExtract(args.slice(1), { stdout, stderr, deps });
  }
  if (command === "search") {
    return await runSearch(args.slice(1), { stdout, stderr, deps });
  }

  stderr.write(`Unknown command: ${command}\n\n`);
  stdout.write(renderHelp());
  return 1;
}

async function runSearch(
  args: string[],
  ctx: { stdout: Writer; stderr: Writer; deps: CliDeps }
): Promise<number> {
  const parsed = parseSearchArgs(args);
  if (!parsed.ok) {
    ctx.stderr.write(`${parsed.error}\n\n`);
    ctx.stdout.write(renderHelp());
    return 1;
  }

  const {
    query,
    siteIds,
    maxResults,
    maxResultsPerSite,
    format,
    cacheEnabled,
    cachePath,
    cacheTtlMs,
    timeoutMs,
    rateLimitMs,
    userAgent,
    acceptLanguage
  } = parsed.value;

  const now = ctx.deps.now;

  const rateLimiter = createRateLimiter(rateLimitMs, ctx.deps);
  const cache = createCache(cacheEnabled, cachePath);

  try {
    const { results, errors } = await searchRecipes(query, {
      siteIds,
      maxResults,
      maxResultsPerSite,
      timeoutMs,
      userAgent,
      acceptLanguage,
      cache,
      cacheTtlMs,
      rateLimiter,
      now,
      fetchImpl: ctx.deps.fetchImpl
    });

    for (const e of errors) {
      ctx.stderr.write(`Search failed for ${e.site_name} (${e.site_id}): ${e.message}\n`);
    }

    if (format === "jsonl") {
      for (const r of results) ctx.stdout.write(`${JSON.stringify(r)}\n`);
    } else {
      ctx.stdout.write(`${JSON.stringify(results)}\n`);
    }

    return errors.length > 0 ? 1 : 0;
  } finally {
    cache?.close();
  }
}

async function runExtract(
  args: string[],
  ctx: { stdout: Writer; stderr: Writer; deps: CliDeps }
): Promise<number> {
  const parsed = parseExtractArgs(args);
  if (!parsed.ok) {
    ctx.stderr.write(`${parsed.error}\n\n`);
    ctx.stdout.write(renderHelp());
    return 1;
  }

  const {
    urls,
    format,
    cacheEnabled,
    cachePath,
    cacheTtlMs,
    timeoutMs,
    rateLimitMs,
    userAgent,
    acceptLanguage
  } = parsed.value;

  const now = ctx.deps.now;

  const rateLimiter = createRateLimiter(rateLimitMs, ctx.deps);
  const cache = createCache(cacheEnabled, cachePath);

  const results: unknown[] = [];
  let hadError = false;

  try {
    for (const url of urls) {
      try {
        const recipe = await scrapeRecipeFromUrl(url, {
          timeoutMs,
          userAgent,
          acceptLanguage,
          cache,
          cacheTtlMs,
          rateLimiter,
          now,
          fetchImpl: ctx.deps.fetchImpl
        });
        results.push(recipe);
      } catch (err) {
        hadError = true;
        const message = err instanceof Error ? err.message : String(err);
        ctx.stderr.write(`Failed to scrape ${url}: ${message}\n`);
      }
    }
  } finally {
    cache?.close();
  }

  if (results.length === 0) return hadError ? 1 : 0;

  if (format === "jsonl") {
    for (const r of results) ctx.stdout.write(`${JSON.stringify(r)}\n`);
  } else {
    const payload = results.length === 1 ? results[0] : results;
    ctx.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  return hadError ? 1 : 0;
}

function createRateLimiter(rateLimitMs: number, deps: CliDeps): DomainRateLimiter {
  return new DomainRateLimiter({
    minDelayMs: rateLimitMs,
    jitterMs: Math.min(500, Math.max(0, Math.trunc(rateLimitMs / 3))),
    now: deps.now,
    sleep: deps.sleep,
    random: deps.random
  });
}

function createCache(cacheEnabled: boolean, cachePath: string): SqlitePageCache | null {
  return cacheEnabled ? new SqlitePageCache({ dbPath: cachePath }) : null;
}

type ExtractArgs = {
  urls: string[];
  format: OutputFormat;
  cacheEnabled: boolean;
  cachePath: string;
  cacheTtlMs: number;
  timeoutMs: number;
  rateLimitMs: number;
  userAgent: string;
  acceptLanguage: string;
};

type SearchArgs = {
  query: string;
  siteIds: SiteId[];
  maxResults: number;
  maxResultsPerSite: number;
  format: OutputFormat;
  cacheEnabled: boolean;
  cachePath: string;
  cacheTtlMs: number;
  timeoutMs: number;
  rateLimitMs: number;
  userAgent: string;
  acceptLanguage: string;
};

type CommonCliOptions = {
  format: OutputFormat;
  cacheEnabled: boolean;
  cachePath: string | null;
  cacheTtlMs: number;
  timeoutMs: number;
  rateLimitMs: number;
  userAgent: string;
  acceptLanguage: string;
};

function initCommonCliOptions(defaultCacheTtlMs: number): CommonCliOptions {
  return {
    format: "json",
    cacheEnabled: true,
    cachePath: null,
    cacheTtlMs: defaultCacheTtlMs,
    timeoutMs: 30_000,
    rateLimitMs: 1500,
    userAgent: "cookie-racho/1.0",
    acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8"
  };
}

function parseCommonCliOption(
  args: string[],
  i: number,
  common: CommonCliOptions
): { handled: true; i: number; error?: string } | { handled: false; i: number } {
  const a = args[i];
  if (!a) return { handled: false, i };

  if (a === "--no-cache") {
    common.cacheEnabled = false;
    return { handled: true, i };
  }

  if (a === "--format") {
    const v = args[i + 1];
    if (v !== "json" && v !== "jsonl") return { handled: true, i, error: "--format must be json or jsonl" };
    common.format = v;
    return { handled: true, i: i + 1 };
  }

  if (a === "--cache-path") {
    const v = args[i + 1];
    if (!v) return { handled: true, i, error: "--cache-path requires a value" };
    common.cachePath = v;
    return { handled: true, i: i + 1 };
  }

  if (a === "--cache-ttl") {
    const v = args[i + 1];
    const ms = v ? parseDurationToMs(v) : null;
    if (!ms || ms <= 0) return { handled: true, i, error: "--cache-ttl must be a positive duration" };
    common.cacheTtlMs = ms;
    return { handled: true, i: i + 1 };
  }

  if (a === "--timeout") {
    const v = args[i + 1];
    const ms = v ? parseDurationToMs(v) : null;
    if (!ms || ms <= 0) return { handled: true, i, error: "--timeout must be a positive duration" };
    common.timeoutMs = ms;
    return { handled: true, i: i + 1 };
  }

  if (a === "--rate") {
    const v = args[i + 1];
    const ms = v ? parseDurationToMs(v) : null;
    if (ms === null || ms < 0) return { handled: true, i, error: "--rate must be a non-negative duration" };
    common.rateLimitMs = ms;
    return { handled: true, i: i + 1 };
  }

  if (a === "--user-agent") {
    const v = args[i + 1];
    if (!v) return { handled: true, i, error: "--user-agent requires a value" };
    common.userAgent = v;
    return { handled: true, i: i + 1 };
  }

  if (a === "--accept-language") {
    const v = args[i + 1];
    if (!v) return { handled: true, i, error: "--accept-language requires a value" };
    common.acceptLanguage = v;
    return { handled: true, i: i + 1 };
  }

  return { handled: false, i };
}

function parseSearchArgs(args: string[]):
  | { ok: true; value: SearchArgs }
  | { ok: false; error: string } {
  const queryParts: string[] = [];
  let siteIds: SiteId[] = defaultSiteIds();
  let maxResults = 10;
  let maxResultsPerSite = 5;
  const common = initCommonCliOptions(24 * 60 * 60 * 1000);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;

    if (!a.startsWith("--")) {
      queryParts.push(a);
      continue;
    }

    if (a === "--sites") {
      const v = args[++i];
      if (!v) return { ok: false, error: "--sites requires a value" };
      const ids = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as SiteId[];
      for (const id of ids) {
        if (!getSiteById(id)) return { ok: false, error: `Unknown site id: ${id}` };
      }
      siteIds = ids;
      continue;
    }

    if (a === "--max-results") {
      const v = args[++i];
      const n = v ? Number.parseInt(v, 10) : NaN;
      if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "--max-results must be a positive integer" };
      maxResults = n;
      continue;
    }

    if (a === "--max-results-per-site") {
      const v = args[++i];
      const n = v ? Number.parseInt(v, 10) : NaN;
      if (!Number.isFinite(n) || n <= 0)
        return { ok: false, error: "--max-results-per-site must be a positive integer" };
      maxResultsPerSite = n;
      continue;
    }

    const commonResult = parseCommonCliOption(args, i, common);
    if (commonResult.handled) {
      if (commonResult.error) return { ok: false, error: commonResult.error };
      i = commonResult.i;
      continue;
    }

    return { ok: false, error: `Unknown option: ${a}` };
  }

  const query = queryParts.join(" ").trim();
  if (!query) return { ok: false, error: "search requires a query" };

  const finalCachePath = common.cachePath ?? path.join(process.cwd(), ".cookie-racho", "cache.sqlite");
  return {
    ok: true,
    value: {
      query,
      siteIds,
      maxResults,
      maxResultsPerSite,
      format: common.format,
      cacheEnabled: common.cacheEnabled,
      cachePath: finalCachePath,
      cacheTtlMs: common.cacheTtlMs,
      timeoutMs: common.timeoutMs,
      rateLimitMs: common.rateLimitMs,
      userAgent: common.userAgent,
      acceptLanguage: common.acceptLanguage
    }
  };
}

function parseExtractArgs(args: string[]):
  | { ok: true; value: ExtractArgs }
  | { ok: false; error: string } {
  const urls: string[] = [];
  const common = initCommonCliOptions(7 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;

    if (!a.startsWith("--")) {
      urls.push(a);
      continue;
    }

    const commonResult = parseCommonCliOption(args, i, common);
    if (commonResult.handled) {
      if (commonResult.error) return { ok: false, error: commonResult.error };
      i = commonResult.i;
      continue;
    }

    return { ok: false, error: `Unknown option: ${a}` };
  }

  if (urls.length === 0) return { ok: false, error: "extract requires at least one URL" };

  const finalCachePath = common.cachePath ?? path.join(process.cwd(), ".cookie-racho", "cache.sqlite");
  return {
    ok: true,
    value: {
      urls,
      format: common.format,
      cacheEnabled: common.cacheEnabled,
      cachePath: finalCachePath,
      cacheTtlMs: common.cacheTtlMs,
      timeoutMs: common.timeoutMs,
      rateLimitMs: common.rateLimitMs,
      userAgent: common.userAgent,
      acceptLanguage: common.acceptLanguage
    }
  };
}

export function parseDurationToMs(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const ms = Number.parseInt(raw, 10);
    return Number.isFinite(ms) ? ms : null;
  }

  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
  if (!match) return null;

  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;

  const unit = match[2].toLowerCase();
  const factor =
    unit === "ms"
      ? 1
      : unit === "s"
        ? 1000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 3_600_000
            : 86_400_000;

  return Math.round(value * factor);
}

function renderHelp(): string {
  return (
    "cookie-racho - scrape and normalize francophone recipes\n" +
    "\n" +
    "Usage:\n" +
    "  cookie-racho extract [options] <url...>\n" +
    "  cookie-racho search [options] <query...>\n" +
    "\n" +
    "Commands:\n" +
    "  extract   Fetch page(s), extract recipe data, output normalized JSON\n" +
    "  search    Search recipe URLs on selected sites\n" +
    "\n" +
    "Options (extract):\n" +
    "  --format json|jsonl        Output format (default: json)\n" +
    "  --no-cache                 Disable on-disk cache\n" +
    "  --cache-path <path>        Cache sqlite path (default: .cookie-racho/cache.sqlite)\n" +
    "  --cache-ttl <dur>          Cache TTL (e.g. 7d, 12h, 30m, 2s, 1500, 250ms)\n" +
    "  --timeout <dur>            Request timeout (default: 30s)\n" +
    "  --rate <dur>               Min delay per host between requests (default: 1500ms)\n" +
    "  --user-agent <ua>          Override User-Agent\n" +
    "  --accept-language <value>  Override Accept-Language\n" +
    "\n" +
    "Options (search):\n" +
    "  --sites <ids>              Comma-separated site ids (default: all known)\n" +
    "  --max-results <n>          Max total results (default: 10)\n" +
    "  --max-results-per-site <n> Max results per site (default: 5)\n" +
    "  --format json|jsonl        Output format (default: json)\n" +
    "  --no-cache                 Disable on-disk cache\n" +
    "  --cache-path <path>        Cache sqlite path (default: .cookie-racho/cache.sqlite)\n" +
    "  --cache-ttl <dur>          Cache TTL (default: 1d)\n" +
    "  --timeout <dur>            Request timeout (default: 30s)\n" +
    "  --rate <dur>               Min delay per host between requests (default: 1500ms)\n" +
    "  --user-agent <ua>          Override User-Agent\n" +
    "  --accept-language <value>  Override Accept-Language\n" +
    "\n"
  );
}
