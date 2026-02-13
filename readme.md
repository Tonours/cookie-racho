# Cookie Racho

Bun + TypeScript CLI to search, scrape, and normalize francophone recipe pages into a strict JSON schema.

Extraction prefers `schema.org/Recipe` from JSON-LD, then falls back to microdata when available, and validates the final output with Zod.

## Requirements

- Bun (this project uses Bun APIs like `bun:sqlite`)

## Install

```sh
bun install
```

## Build / Install CLI

Build a standalone executable:

```sh
bun run build:compile
./dist/cookie-racho --help
```

Install it in your PATH (creates a symlink, defaulting to `~/.local/bin`):

```sh
bun run cli:install
cookie-racho --help
```

## Usage

If you have not installed the CLI yet, you can also run commands in development mode:

```sh
bun run dev -- --help
```

Extract + normalize a recipe from a URL:

```sh
cookie-racho extract "https://example.com/recette"
```

Multiple URLs (JSON array output):

```sh
cookie-racho extract "https://example.com/a" "https://example.com/b"
```

JSONL output (one recipe per line):

```sh
cookie-racho extract --format jsonl "https://example.com/a" "https://example.com/b"
```

Useful scraping knobs:

```sh
cookie-racho extract \
  --cache-ttl 7d \
  --rate 1500ms \
  --timeout 30s \
  --user-agent "cookie-racho/1.0" \
  "https://example.com/recette"
```

Search recipe URLs (best-effort):

```sh
cookie-racho search "pates tomates"
```

Limit search to specific sites:

```sh
cookie-racho search --sites marmiton,750g "pates tomates"
```

Search output as JSONL:

```sh
cookie-racho search --format jsonl "pates tomates"
```

Supported site ids (for `--sites`):

- `marmiton`
- `750g`
- `cuisineaz`
- `ptitchef`
- `cuisineactuelle`
- `journaldesfemmes`

## Notes

- Polite defaults: per-host rate limiting + on-disk cache (SQLite).
- If a site does not expose `schema.org/Recipe` (JSON-LD or microdata), extraction will fail.
- Search prefers structured data (JSON-LD `ItemList`) when the site exposes it, and falls back to DuckDuckGo HTML results for some sites.
- Some sites render search results client-side, so on-site search pages may contain no results in the initial HTML.

## Development

Run unit tests:

```sh
bun test
```

Coverage:

```sh
bun test --coverage --coverage-reporter=text
```

Run the integration test (hits real URLs):

```sh
COOKIE_RACHO_INTEGRATION=1 bun test src/integration/marmiton.integration.test.ts
```
