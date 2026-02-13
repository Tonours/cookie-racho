import { getUrlHost, normalizeUrlSpec } from "../core/url";

export type SiteId =
  | "marmiton"
  | "750g"
  | "cuisineaz"
  | "ptitchef"
  | "cuisineactuelle"
  | "journaldesfemmes";

export type Site = {
  id: SiteId;
  source_name: string;
  source_license: string;
  source_attribution: string;
  host_suffixes: string[];
  search?: {
    buildSearchUrl: (query: string) => string;
  };
};

const SITES: Site[] = [
  {
    id: "marmiton",
    source_name: "Marmiton",
    source_license: "proprietary",
    source_attribution: "Marmiton",
    host_suffixes: ["marmiton.org"],
    search: {
      buildSearchUrl: (query) =>
        `https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(query)}`
    }
  },
  {
    id: "750g",
    source_name: "750g",
    source_license: "proprietary",
    source_attribution: "750g",
    host_suffixes: ["750g.com"],
    search: {
      buildSearchUrl: (query) => `https://www.750g.com/recherche/?q=${encodeURIComponent(query)}`
    }
  },
  {
    id: "cuisineaz",
    source_name: "CuisineAZ",
    source_license: "proprietary",
    source_attribution: "CuisineAZ",
    host_suffixes: ["cuisineaz.com"],
    search: {
      buildSearchUrl: (query) =>
        `https://www.cuisineaz.com/recettes/recherche_terme.aspx?recherche=${encodeURIComponent(query)}`
    }
  },
  {
    id: "ptitchef",
    source_name: "Ptitchef",
    source_license: "proprietary",
    source_attribution: "Ptitchef",
    host_suffixes: ["ptitchef.com"],
    search: {
      buildSearchUrl: (query) =>
        `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:ptitchef.com recette ${query}`)}`
    }
  },
  {
    id: "cuisineactuelle",
    source_name: "Cuisine Actuelle",
    source_license: "proprietary",
    source_attribution: "Cuisine Actuelle",
    host_suffixes: ["cuisineactuelle.fr"],
    search: {
      buildSearchUrl: (query) =>
        `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:cuisineactuelle.fr recette ${query}`)}`
    }
  },
  {
    id: "journaldesfemmes",
    source_name: "Journal des Femmes",
    source_license: "proprietary",
    source_attribution: "Journal des Femmes",
    host_suffixes: ["journaldesfemmes.fr"],
    search: {
      buildSearchUrl: (query) =>
        `https://duckduckgo.com/html/?q=${encodeURIComponent(
          `site:cuisine.journaldesfemmes.fr recette ${query}`
        )}`
    }
  }
];

export function listSites(): Site[] {
  return [...SITES];
}

export function getSiteById(id: SiteId): Site | null {
  return SITES.find((s) => s.id === id) ?? null;
}

export function defaultSiteIds(): SiteId[] {
  return ["marmiton", "750g", "cuisineaz", "ptitchef", "cuisineactuelle", "journaldesfemmes"];
}

export function getSiteByHost(host: string): Site | null {
  const h = host.toLowerCase();
  return SITES.find((s) => s.host_suffixes.some((suffix) => h === suffix || h.endsWith(`.${suffix}`))) ?? null;
}

export function getSiteByUrl(urlSpec: string): Site | null {
  const url = normalizeUrlSpec(urlSpec);
  const host = getUrlHost(url);
  return getSiteByHost(host);
}

export function inferSourceMeta(urlSpec: string): {
  source_name: string;
  source_license: string;
  source_attribution: string;
} {
  const host = getUrlHost(urlSpec);
  const site = getSiteByHost(host);
  if (!site) {
    return {
      source_name: host,
      source_license: "unknown",
      source_attribution: host
    };
  }

  return {
    source_name: site.source_name,
    source_license: site.source_license,
    source_attribution: site.source_attribution
  };
}
