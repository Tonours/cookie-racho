import { z } from "zod";

export const UnitSchema = z.enum(["g", "kg", "ml", "l", "unit", "cs", "cc", "pincee"]);
export type Unit = z.infer<typeof UnitSchema>;

export const AisleCategorySchema = z.enum([
  "fruits_legumes",
  "boucherie_poisson",
  "cremerie",
  "epicerie",
  "surgeles",
  "boulangerie",
  "boissons",
  "entretien",
  "autres"
]);
export type AisleCategory = z.infer<typeof AisleCategorySchema>;

export const AllergenSchema = z.enum([
  "gluten",
  "lactose",
  "oeuf",
  "arachide",
  "fruits_a_coque",
  "soja",
  "poisson",
  "crustaces",
  "sesame"
]);
export type Allergen = z.infer<typeof AllergenSchema>;

export const ScrapedIngredientSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.number().finite().positive(),
  unit: UnitSchema,
  aisle: AisleCategorySchema.optional()
});
export type ScrapedIngredient = z.infer<typeof ScrapedIngredientSchema>;

export const ScrapedStepSchema = z.object({
  description: z.string().trim().min(1),
  minutes: z.number().int().positive().optional()
});
export type ScrapedStep = z.infer<typeof ScrapedStepSchema>;

export const ScrapedRecipeSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim(),
  vegetarian: z.boolean(),
  max_prep_time: z.number().int().min(5).max(300),
  is_seasonal: z.boolean(),
  batch_friendly: z.boolean(),
  base_servings: z.number().int().min(1).max(20),
  allergens: z.array(AllergenSchema),
  ingredients: z.array(ScrapedIngredientSchema).min(2),
  steps: z.array(ScrapedStepSchema).min(2),
  source_name: z.string().trim().min(1),
  source_url: z.string().url(),
  source_license: z.string().trim().min(1),
  source_attribution: z.string().trim().min(1)
});
export type ScrapedRecipe = z.infer<typeof ScrapedRecipeSchema>;
