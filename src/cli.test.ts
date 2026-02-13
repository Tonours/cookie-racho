import { describe, expect, test } from "bun:test";

import { parseDurationToMs, runCli } from "./cli";

function createBufferWriter() {
  let buffer = "";
  return {
    write: (chunk: string) => {
      buffer += chunk;
    },
    toString: () => buffer
  };
}

function recipeHtml() {
  return `<!doctype html>
    <html>
      <head>
        <link rel="canonical" href="https://example.com/recettes/pates-tomates" />
        <script type="application/ld+json">{
          "@context": "https://schema.org/",
          "@type": "Recipe",
          "name": "Pates tomates",
          "description": "Rapide.",
          "recipeIngredient": ["350 g de pates", "400 g de tomates"],
          "recipeInstructions": ["Cuire.", "Melanger."],
          "totalTime": "PT20M",
          "recipeYield": "4"
        }</script>
      </head>
      <body></body>
    </html>`;
}

function noRecipeHtml() {
  return "<html><head><title>No Recipe</title></head><body>nope</body></html>";
}

describe("parseDurationToMs", () => {
  test("parses raw milliseconds", () => {
    expect(parseDurationToMs("1500")).toBe(1500);
  });

  test("parses unit-suffixed durations", () => {
    expect(parseDurationToMs("2s")).toBe(2000);
    expect(parseDurationToMs("1.5s")).toBe(1500);
    expect(parseDurationToMs("2m")).toBe(120000);
    expect(parseDurationToMs("1h")).toBe(3600000);
    expect(parseDurationToMs("1d")).toBe(86400000);
    expect(parseDurationToMs("250ms")).toBe(250);
  });

  test("returns null for invalid", () => {
    expect(parseDurationToMs("")).toBeNull();
    expect(parseDurationToMs("nope")).toBeNull();
  });
});

describe("runCli", () => {
  test("prints help", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(["bun", "src/cli.ts", "--help"], { stdout: out, stderr: err });
    expect(code).toBe(0);
    expect(out.toString()).toContain("cookie-racho");
    expect(err.toString()).toBe("");
  });

  test("rejects unknown commands", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(["bun", "src/cli.ts", "nope"], { stdout: out, stderr: err });
    expect(code).toBe(1);
    expect(err.toString()).toContain("Unknown command");
    expect(out.toString()).toContain("Usage:");
  });

  test("extract requires at least one URL", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(["bun", "src/cli.ts", "extract"], { stdout: out, stderr: err });
    expect(code).toBe(1);
    expect(err.toString()).toContain("extract requires at least one URL");
    expect(out.toString()).toContain("cookie-racho");
  });

  test("rejects unknown options", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(["bun", "src/cli.ts", "extract", "--wat", "https://example.com/x"], {
      stdout: out,
      stderr: err
    });
    expect(code).toBe(1);
    expect(err.toString()).toContain("Unknown option");
  });

  test("extract scrapes a single URL and prints JSON", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();

    const code = await runCli(["bun", "src/cli.ts", "extract", "--no-cache", "https://example.com/x"], {
      stdout: out,
      stderr: err,
      fetchImpl: async () =>
        new Response(recipeHtml(), {
          status: 200,
          headers: { "content-type": "text/html" }
        })
    });

    expect(code).toBe(0);
    expect(err.toString()).toBe("");
    const parsed = JSON.parse(out.toString());
    expect(parsed.source_url).toBe("https://example.com/recettes/pates-tomates");
    expect(parsed.ingredients).toHaveLength(2);
    expect(parsed.steps).toHaveLength(2);
  });

  test("extract supports jsonl output", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();

    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "extract",
        "--format",
        "jsonl",
        "--no-cache",
        "https://example.com/a",
        "https://example.com/b"
      ],
      {
        stdout: out,
        stderr: err,
        fetchImpl: async () =>
          new Response(recipeHtml(), {
            status: 200,
            headers: { "content-type": "text/html" }
          })
      }
    );

    expect(code).toBe(0);
    expect(err.toString()).toBe("");
    const lines = out
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).source_url).toBe("https://example.com/recettes/pates-tomates");
  });

  test("extract accepts cache/time/rate/user-agent options", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();

    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "extract",
        "--cache-path",
        ":memory:",
        "--cache-ttl",
        "1d",
        "--timeout",
        "2s",
        "--rate",
        "0",
        "--user-agent",
        "MyUA",
        "--accept-language",
        "fr-FR",
        "https://example.com/x"
      ],
      {
        stdout: out,
        stderr: err,
        fetchImpl: async () =>
          new Response(recipeHtml(), {
            status: 200,
            headers: { "content-type": "text/html" }
          })
      }
    );

    expect(code).toBe(0);
    expect(err.toString()).toBe("");
    expect(JSON.parse(out.toString()).source_url).toBe("https://example.com/recettes/pates-tomates");
  });

  test("extract reports per-URL failures and returns non-zero", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const html = url.includes("good") ? recipeHtml() : noRecipeHtml();
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    };

    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "extract",
        "--no-cache",
        "--rate",
        "0",
        "https://example.com/good",
        "https://example.com/bad"
      ],
      { stdout: out, stderr: err, fetchImpl }
    );

    expect(code).toBe(1);
    expect(err.toString()).toContain("Failed to scrape");
    expect(JSON.parse(out.toString()).source_url).toBe("https://example.com/recettes/pates-tomates");
  });

  test("extract validates option values", async () => {
    const badFormat = await runCli(
      ["bun", "src/cli.ts", "extract", "--format", "nope", "https://example.com/x"],
      { stdout: createBufferWriter(), stderr: createBufferWriter() }
    );
    expect(badFormat).toBe(1);

    const missingCachePath = await runCli(["bun", "src/cli.ts", "extract", "--cache-path"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(missingCachePath).toBe(1);

    const badTtl = await runCli(["bun", "src/cli.ts", "extract", "--cache-ttl", "0", "x.com"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badTtl).toBe(1);

    const badTimeout = await runCli(["bun", "src/cli.ts", "extract", "--timeout", "0", "x.com"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badTimeout).toBe(1);

    const badRate = await runCli(["bun", "src/cli.ts", "extract", "--rate", "-1", "x.com"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badRate).toBe(1);

    const missingUa = await runCli(["bun", "src/cli.ts", "extract", "--user-agent"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(missingUa).toBe(1);

    const missingLang = await runCli(["bun", "src/cli.ts", "extract", "--accept-language"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(missingLang).toBe(1);
  });

  test("search requires a query", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(["bun", "src/cli.ts", "search"], { stdout: out, stderr: err });
    expect(code).toBe(1);
    expect(err.toString()).toContain("search requires a query");
    expect(out.toString()).toContain("cookie-racho");
  });

  test("search rejects unknown site ids", async () => {
    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(["bun", "src/cli.ts", "search", "--sites", "nope", "pates"], {
      stdout: out,
      stderr: err
    });
    expect(code).toBe(1);
    expect(err.toString()).toContain("Unknown site id");
  });

  test("search scrapes a query and prints JSON", async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/a","name":"A"}},
          {"@type":"ListItem","item":{"@id":"/recettes/b","name":"B"}}
        ]
      }</script>
    </head></html>`;

    const out = createBufferWriter();
    const err = createBufferWriter();

    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      expect(url.hostname).toContain("marmiton.org");
      expect(url.searchParams.get("aqt")).toBe("pates tomates");
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    };

    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "search",
        "--sites",
        "marmiton",
        "--no-cache",
        "--rate",
        "0",
        "pates",
        "tomates"
      ],
      { stdout: out, stderr: err, fetchImpl }
    );

    expect(code).toBe(0);
    expect(err.toString()).toBe("");
    const results = JSON.parse(out.toString());
    expect(results).toHaveLength(2);
    expect(results[0].source_name).toBe("Marmiton");
    expect(results[0].source_url).toBe("https://www.marmiton.org/recettes/a");
  });

  test("search supports jsonl output", async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/a","name":"A"}},
          {"@type":"ListItem","item":{"@id":"/recettes/b","name":"B"}}
        ]
      }</script>
    </head></html>`;

    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "search",
        "--sites",
        "marmiton",
        "--format",
        "jsonl",
        "--no-cache",
        "--rate",
        "0",
        "pates"
      ],
      {
        stdout: out,
        stderr: err,
        fetchImpl: async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } })
      }
    );

    expect(code).toBe(0);
    expect(err.toString()).toBe("");
    const lines = out
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).source_name).toBe("Marmiton");
  });

  test("search respects max-results and max-results-per-site", async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/a","name":"A"}},
          {"@type":"ListItem","item":{"@id":"/recettes/b","name":"B"}},
          {"@type":"ListItem","item":{"@id":"/recettes/c","name":"C"}}
        ]
      }</script>
    </head></html>`;

    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "search",
        "--sites",
        "marmiton",
        "--max-results",
        "1",
        "--max-results-per-site",
        "2",
        "--no-cache",
        "--rate",
        "0",
        "pates"
      ],
      {
        stdout: out,
        stderr: err,
        fetchImpl: async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } })
      }
    );

    expect(code).toBe(0);
    expect(err.toString()).toBe("");
    const results = JSON.parse(out.toString());
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("A");
  });

  test("search accepts cache/time/rate/user-agent options", async () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/a","name":"A"}},
          {"@type":"ListItem","item":{"@id":"/recettes/b","name":"B"}}
        ]
      }</script>
    </head></html>`;

    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "search",
        "--sites",
        "marmiton",
        "--cache-path",
        ":memory:",
        "--cache-ttl",
        "1d",
        "--timeout",
        "2s",
        "--rate",
        "0",
        "--user-agent",
        "MyUA",
        "--accept-language",
        "fr-FR",
        "pates"
      ],
      {
        stdout: out,
        stderr: err,
        fetchImpl: async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } })
      }
    );

    expect(code).toBe(0);
    expect(err.toString()).toBe("");
    const results = JSON.parse(out.toString());
    expect(results).toHaveLength(2);
    expect(results[0].source_name).toBe("Marmiton");
  });

  test("search reports site errors and returns non-zero", async () => {
    const htmlOk = `<!doctype html><html><head>
      <script type="application/ld+json">{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          {"@type":"ListItem","item":{"@id":"/recettes/a","name":"A"}}
        ]
      }</script>
    </head></html>`;

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("marmiton.org")) return new Response("Forbidden", { status: 403 });
      if (url.includes("750g.com")) return new Response(htmlOk, { status: 200, headers: { "content-type": "text/html" } });
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    };

    const out = createBufferWriter();
    const err = createBufferWriter();
    const code = await runCli(
      [
        "bun",
        "src/cli.ts",
        "search",
        "--sites",
        "marmiton,750g",
        "--no-cache",
        "--rate",
        "0",
        "pates"
      ],
      { stdout: out, stderr: err, fetchImpl }
    );

    expect(code).toBe(1);
    expect(err.toString()).toContain("Search failed for");
    const results = JSON.parse(out.toString());
    expect(results).toHaveLength(1);
    expect(results[0].source_name).toBe("750g");
  });

  test("search validates option values", async () => {
    const badFormat = await runCli(["bun", "src/cli.ts", "search", "--format", "nope", "pates"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badFormat).toBe(1);

    const missingSites = await runCli(["bun", "src/cli.ts", "search", "--sites"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(missingSites).toBe(1);

    const badMax = await runCli(["bun", "src/cli.ts", "search", "--max-results", "0", "pates"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badMax).toBe(1);

    const badMaxPerSite = await runCli(
      ["bun", "src/cli.ts", "search", "--max-results-per-site", "0", "pates"],
      { stdout: createBufferWriter(), stderr: createBufferWriter() }
    );
    expect(badMaxPerSite).toBe(1);

    const missingCachePath = await runCli(["bun", "src/cli.ts", "search", "--cache-path"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(missingCachePath).toBe(1);

    const badTtl = await runCli(["bun", "src/cli.ts", "search", "--cache-ttl", "0", "pates"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badTtl).toBe(1);

    const badTimeout = await runCli(["bun", "src/cli.ts", "search", "--timeout", "0", "pates"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badTimeout).toBe(1);

    const badRate = await runCli(["bun", "src/cli.ts", "search", "--rate", "-1", "pates"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(badRate).toBe(1);

    const missingUa = await runCli(["bun", "src/cli.ts", "search", "--user-agent"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(missingUa).toBe(1);

    const missingLang = await runCli(["bun", "src/cli.ts", "search", "--accept-language"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(missingLang).toBe(1);

    const unknownOpt = await runCli(["bun", "src/cli.ts", "search", "--wat", "pates"], {
      stdout: createBufferWriter(),
      stderr: createBufferWriter()
    });
    expect(unknownOpt).toBe(1);
  });
});
