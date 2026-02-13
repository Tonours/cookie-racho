import { includesKeyword, tokenizeForMatching } from "../core/text";
import type { AisleCategory } from "../schema/scrapedRecipe";

type Rule = { aisle: AisleCategory; keywords: string[] };

const RULES: Rule[] = [
  {
    aisle: "boucherie_poisson",
    keywords: [
      "boeuf",
      "veau",
      "porc",
      "poulet",
      "dinde",
      "agneau",
      "jambon",
      "lardon",
      "saucisse",
      "saumon",
      "thon",
      "poisson",
      "crevette",
      "crabe",
      "homard"
    ]
  },
  {
    aisle: "cremerie",
    keywords: ["lait", "beurre", "creme", "fromage", "yaourt", "yoghourt", "oeuf", "oeufs"]
  },
  {
    aisle: "fruits_legumes",
    keywords: [
      "tomate",
      "oignon",
      "ail",
      "carotte",
      "courgette",
      "aubergine",
      "poivron",
      "pomme",
      "banane",
      "citron",
      "orange",
      "fraise",
      "salade",
      "epinard",
      "champignon",
      "asperge",
      "brocoli",
      "chou",
      "concombre"
    ]
  },
  { aisle: "boulangerie", keywords: ["pain", "baguette", "brioche"] },
  { aisle: "surgeles", keywords: ["surgele", "congele"] },
  { aisle: "boissons", keywords: ["vin", "biere", "jus", "sirop"] },
  { aisle: "entretien", keywords: ["papier", "aluminium", "film alimentaire", "liquide vaisselle"] },
  {
    aisle: "epicerie",
    keywords: [
      "farine",
      "sucre",
      "sel",
      "poivre",
      "riz",
      "pate",
      "pates",
      "huile",
      "vinaigre",
      "levure",
      "chocolat",
      "cacao",
      "epice",
      "epices",
      "lentille",
      "pois chiche",
      "haricot"
    ]
  }
];

export function inferAisleCategory(ingredientName: string): AisleCategory | undefined {
  const tokens = tokenizeForMatching(ingredientName);
  if (tokens.length === 0) return undefined;

  for (const rule of RULES) {
    if (rule.keywords.some((k) => includesKeyword(tokens, k))) return rule.aisle;
  }

  return undefined;
}
