import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type CacheEntry = {
  url: string;
  fetchedAtMs: number;
  resolvedUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
};

export interface PageCache {
  get(url: string): Promise<CacheEntry | null>;
  set(entry: CacheEntry): Promise<void>;
}

export class SqlitePageCache implements PageCache {
  private db: Database;

  constructor({ dbPath }: { dbPath: string }) {
    if (dbPath !== ":memory:") {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    this.db = new Database(dbPath);

    // This cache can be used by multiple processes (e.g. concurrent CLI runs).
    // Help avoid transient "database is locked" errors.
    try {
      this.db.run("PRAGMA busy_timeout = 5000;");
    } catch {
      // Ignore; not critical for cache correctness.
    }

    if (dbPath !== ":memory:") {
      try {
        this.db.run("PRAGMA journal_mode = WAL;");
      } catch {
        // Ignore; not critical for cache correctness.
      }
    }
    this.db.run(`
      CREATE TABLE IF NOT EXISTS page_cache (
        url TEXT PRIMARY KEY,
        fetched_at_ms INTEGER NOT NULL,
        resolved_url TEXT NOT NULL,
        status INTEGER NOT NULL,
        headers_json TEXT NOT NULL,
        body TEXT NOT NULL
      );
    `);
  }

  async get(url: string): Promise<CacheEntry | null> {
    const row = this.db
      .query(
        "SELECT url, fetched_at_ms, resolved_url, status, headers_json, body FROM page_cache WHERE url = ?"
      )
      .get(url) as
      | {
          url: string;
          fetched_at_ms: number;
          resolved_url: string;
          status: number;
          headers_json: string;
          body: string;
        }
      | null;

    if (!row) return null;

    let headers: Record<string, string> = {};
    try {
      headers = JSON.parse(row.headers_json) as Record<string, string>;
    } catch {
      headers = {};
    }

    return {
      url: row.url,
      fetchedAtMs: row.fetched_at_ms,
      resolvedUrl: row.resolved_url,
      status: row.status,
      headers,
      body: row.body
    };
  }

  async set(entry: CacheEntry): Promise<void> {
    this.db
      .query(
        "INSERT OR REPLACE INTO page_cache (url, fetched_at_ms, resolved_url, status, headers_json, body) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        entry.url,
        entry.fetchedAtMs,
        entry.resolvedUrl,
        entry.status,
        JSON.stringify(entry.headers),
        entry.body
      );
  }

  close(): void {
    this.db.close();
  }
}
