import { toAsciiLower } from "../core/text";
import type { ScrapedStep } from "../schema/scrapedRecipe";

export function inferBatchFriendly(input: {
  name: string;
  description: string;
  steps: ScrapedStep[];
}): boolean {
  const hay = toAsciiLower([input.name, input.description, ...input.steps.map((s) => s.description)].join(" \n "));
  if (!hay) return false;

  const keywords = [
    "batch cooking",
    "meal prep",
    "se conserve",
    "se garde",
    "a l'avance",
    "la veille",
    "preparer a l'avance",
    "congeler",
    "congelation",
    "congelateur",
    "se congele",
    "rechauffer",
    "se rechauffe"
  ];

  return keywords.some((k) => hay.includes(toAsciiLower(k)));
}
