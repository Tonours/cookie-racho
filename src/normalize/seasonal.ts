import { includesKeyword, tokenizeForMatching } from "../core/text";

export function inferIsSeasonal(ingredientNames: string[]): boolean {
  const seasonal = [
    "asperge",
    "potimarron",
    "courge",
    "marron",
    "chataigne",
    "girolle",
    "morille",
    "cepe",
    "rhubarbe",
    "cerise",
    "fraise",
    "figue",
    "artichaut"
  ];

  for (const name of ingredientNames) {
    const tokens = tokenizeForMatching(name);
    if (seasonal.some((k) => includesKeyword(tokens, k))) return true;
  }

  return false;
}
