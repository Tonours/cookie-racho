# Cookie Racho

CLI (Bun + TypeScript) to scrape recipe pages (mostly francophone cooking sites) and normalize them into a strict JSON schema.

It extracts `schema.org/Recipe` from JSON-LD first, then falls back to microdata when possible, and validates the final output with Zod.

## Requirements

- Bun (this project uses Bun APIs like `bun:sqlite`)

## Install

```sh
bun install
```

## Usage

Extract + normalize a recipe from a URL:

```sh
bun run dev -- extract "https://example.com/recette"
```

Multiple URLs (JSON array output):

```sh
bun run dev -- extract "https://example.com/a" "https://example.com/b"
```

JSONL output (one recipe per line):

```sh
bun run dev -- extract --format jsonl "https://example.com/a" "https://example.com/b"
```

Useful scraping knobs:

```sh
bun run dev -- extract \
  --cache-ttl 7d \
  --rate 1500ms \
  --timeout 30s \
  --user-agent "cookie-racho/1.0" \
  "https://example.com/recette"
```

Search recipe URLs (best-effort):

```sh
bun run dev -- search "pates tomates"
```

Limit search to specific sites:

```sh
bun run dev -- search --sites marmiton,750g "pates tomates"
```

Search output as JSONL:

```sh
bun run dev -- search --format jsonl "pates tomates"
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
- Search relies on structured data (JSON-LD `ItemList`) on the search pages, and may return empty results depending on the site.

## Development

```sh
bun test
bun test --coverage
```
