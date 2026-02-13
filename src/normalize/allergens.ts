import { includesKeyword, tokenizeForMatching } from "../core/text";
import type { Allergen } from "../schema/scrapedRecipe";

type AllergenRule = { allergen: Allergen; keywords: string[] };

const RULES: AllergenRule[] = [
  {
    allergen: "gluten",
    keywords: [
      "farine",
      "ble",
      "pate",
      "pates",
      "pain",
      "semoule",
      "biscuit",
      "gateau",
      "couscous",
      "seigle",
      "orge",
      "avoine"
    ]
  },
  {
    allergen: "lactose",
    keywords: ["lait", "beurre", "creme", "fromage", "yaourt", "yoghourt", "lactose"]
  },
  { allergen: "oeuf", keywords: ["oeuf", "oeufs"] },
  { allergen: "arachide", keywords: ["arachide", "cacahuete", "cacahuetes"] },
  {
    allergen: "fruits_a_coque",
    keywords: [
      "noix",
      "noisette",
      "noisettes",
      "amande",
      "amandes",
      "cajou",
      "pistache",
      "pecan",
      "macadamia"
    ]
  },
  { allergen: "soja", keywords: ["soja"] },
  {
    allergen: "poisson",
    keywords: ["poisson", "saumon", "thon", "cabillaud", "sardine", "maquereau", "anchois"]
  },
  { allergen: "crustaces", keywords: ["crustace", "crevette", "crevettes", "crabe", "homard"] },
  { allergen: "sesame", keywords: ["sesame"] }
];

export function detectAllergens(ingredientNames: string[]): Allergen[] {
  const tokenized = ingredientNames.map((s) => tokenizeForMatching(s));
  const found: Allergen[] = [];

  for (const rule of RULES) {
    const hit = tokenized.some((tokens) => rule.keywords.some((k) => includesKeyword(tokens, k)));
    if (hit) found.push(rule.allergen);
  }

  return found;
}
