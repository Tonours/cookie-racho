import { describe, expect, test } from "bun:test";

import {
  defaultSiteIds,
  getSiteByHost,
  getSiteById,
  getSiteByUrl,
  inferSourceMeta,
  listSites
} from "./registry";

describe("site registry", () => {
  test("lists known sites", () => {
    const sites = listSites();
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.some((s) => s.id === "marmiton")).toBe(true);
  });

  test("defaultSiteIds returns stable list", () => {
    expect(defaultSiteIds()).toEqual([
      "marmiton",
      "750g",
      "cuisineaz",
      "ptitchef",
      "cuisineactuelle",
      "journaldesfemmes"
    ]);
  });

  test("gets site by host suffix", () => {
    expect(getSiteByHost("www.marmiton.org")?.id).toBe("marmiton");
    expect(getSiteByHost("marmiton.org")?.id).toBe("marmiton");
    expect(getSiteByHost("cuisine.journaldesfemmes.fr")?.id).toBe("journaldesfemmes");
  });

  test("gets site by url", () => {
    expect(getSiteByUrl("https://www.750g.com/recettes/x")?.id).toBe("750g");
  });

  test("gets site by id", () => {
    expect(getSiteById("marmiton")?.source_name).toBe("Marmiton");
    expect(getSiteById("marmiton")?.id).toBe("marmiton");
  });

  test("inferSourceMeta falls back to host for unknown sites", () => {
    expect(inferSourceMeta("https://example.com/r")).toEqual({
      source_name: "example.com",
      source_license: "unknown",
      source_attribution: "example.com"
    });
  });

  test("inferSourceMeta uses known site metadata", () => {
    const meta = inferSourceMeta("https://www.marmiton.org/recettes/x");
    expect(meta.source_name).toBe("Marmiton");
    expect(meta.source_license).toBe("proprietary");
    expect(meta.source_attribution).toBe("Marmiton");
  });

  test("buildSearchUrl encodes queries", () => {
    const query = "pates tomates";
    for (const id of defaultSiteIds()) {
      const site = getSiteById(id);
      expect(site).not.toBeNull();
      expect(site?.search).toBeDefined();
      const url = site!.search!.buildSearchUrl(query);
      expect(url.startsWith("https://")).toBe(true);
      expect(url).toContain(encodeURIComponent(query));
    }
  });
});
