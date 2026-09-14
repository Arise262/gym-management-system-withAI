/**
 * Food suggestions for each nutrition phase — foods a member in the
 * Philippines can buy at a palengke or grocery.
 *
 * A static list rather than rows in the FoodItems table: it is reviewed in
 * code, versioned with the app, and needs no admin screen to keep up.
 *
 * Macros are per the stated serving, rounded, from USDA FoodData Central.
 * Local recipes change them — frying, sauces and cooking oil add fat — so the
 * page presents these as guides, not exact counts.
 */

import type { Phase } from "@/lib/nutrition";

export type FoodGroup = "protein" | "carbs" | "fats" | "vegetables";

export type Food = {
  name: string;
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  group: FoodGroup;
  /** Phases this food is especially useful for. */
  goodFor: Phase[];
  note?: string;
};

export const FOODS: Food[] = [
  // ── Protein ──
  { name: "Chicken breast, skinless", serving: "100 g cooked", kcal: 165, proteinG: 31, carbsG: 0, fatG: 4, group: "protein", goodFor: ["CUT", "MAINTAIN", "BULK"], note: "Grilled or boiled, not fried." },
  { name: "Eggs", serving: "2 large", kcal: 144, proteinG: 13, carbsG: 1, fatG: 10, group: "protein", goodFor: ["CUT", "MAINTAIN", "BULK"] },
  { name: "Tilapia", serving: "100 g cooked", kcal: 128, proteinG: 26, carbsG: 0, fatG: 3, group: "protein", goodFor: ["CUT", "MAINTAIN"] },
  { name: "Bangus (milkfish)", serving: "100 g cooked", kcal: 190, proteinG: 26, carbsG: 0, fatG: 9, group: "protein", goodFor: ["MAINTAIN", "BULK"] },
  { name: "Tuna in water", serving: "100 g drained", kcal: 116, proteinG: 26, carbsG: 0, fatG: 1, group: "protein", goodFor: ["CUT", "MAINTAIN"], note: "The in-oil kind has several times the fat." },
  { name: "Pork tenderloin (lomo)", serving: "100 g cooked", kcal: 143, proteinG: 26, carbsG: 0, fatG: 4, group: "protein", goodFor: ["CUT", "MAINTAIN"], note: "The lean cut — liempo is mostly fat." },
  { name: "Tokwa (firm tofu)", serving: "100 g", kcal: 144, proteinG: 17, carbsG: 3, fatG: 9, group: "protein", goodFor: ["CUT", "MAINTAIN", "BULK"] },
  { name: "Monggo (mung beans)", serving: "1 cup cooked", kcal: 212, proteinG: 14, carbsG: 39, fatG: 1, group: "protein", goodFor: ["MAINTAIN", "BULK"] },
  { name: "Fresh milk", serving: "1 cup", kcal: 149, proteinG: 8, carbsG: 12, fatG: 8, group: "protein", goodFor: ["BULK"], note: "An easy way to add calories on a bulk." },

  // ── Carbs ──
  { name: "White rice", serving: "1 cup cooked", kcal: 205, proteinG: 4, carbsG: 45, fatG: 0, group: "carbs", goodFor: ["MAINTAIN", "BULK"], note: "Measure the cup — extra rice is where a cut usually slips." },
  { name: "Brown rice", serving: "1 cup cooked", kcal: 216, proteinG: 5, carbsG: 45, fatG: 2, group: "carbs", goodFor: ["CUT", "MAINTAIN"], note: "More fibre, keeps you full longer." },
  { name: "Kamote (sweet potato)", serving: "100 g boiled", kcal: 76, proteinG: 1, carbsG: 18, fatG: 0, group: "carbs", goodFor: ["CUT", "MAINTAIN"] },
  { name: "Oats", serving: "1/2 cup dry", kcal: 150, proteinG: 5, carbsG: 27, fatG: 3, group: "carbs", goodFor: ["CUT", "MAINTAIN", "BULK"] },
  { name: "Banana (lakatan)", serving: "1 medium", kcal: 105, proteinG: 1, carbsG: 27, fatG: 0, group: "carbs", goodFor: ["MAINTAIN", "BULK"], note: "Good before training." },

  // ── Vegetables ──
  { name: "Kangkong", serving: "1 cup cooked", kcal: 20, proteinG: 2, carbsG: 3, fatG: 0, group: "vegetables", goodFor: ["CUT", "MAINTAIN", "BULK"] },
  { name: "Pechay", serving: "1 cup cooked", kcal: 20, proteinG: 3, carbsG: 3, fatG: 0, group: "vegetables", goodFor: ["CUT", "MAINTAIN", "BULK"] },
  { name: "Malunggay", serving: "1 cup leaves", kcal: 13, proteinG: 2, carbsG: 2, fatG: 0, group: "vegetables", goodFor: ["CUT", "MAINTAIN", "BULK"], note: "Add to tinola or monggo." },

  // ── Fats ──
  { name: "Peanuts, roasted", serving: "a handful (28 g)", kcal: 166, proteinG: 7, carbsG: 6, fatG: 14, group: "fats", goodFor: ["MAINTAIN", "BULK"], note: "Easy to overeat on a cut — count the handful." },
  { name: "Peanut butter", serving: "2 tbsp", kcal: 188, proteinG: 8, carbsG: 6, fatG: 16, group: "fats", goodFor: ["BULK"] },
  { name: "Avocado", serving: "1/2 fruit", kcal: 160, proteinG: 2, carbsG: 9, fatG: 15, group: "fats", goodFor: ["MAINTAIN", "BULK"] },
  { name: "Cooking oil", serving: "1 tbsp", kcal: 120, proteinG: 0, carbsG: 0, fatG: 14, group: "fats", goodFor: [], note: "Counts too. Measure it instead of pouring." },
];

export const GROUP_LABEL: Record<FoodGroup, string> = {
  protein: "Protein",
  carbs: "Carbs",
  vegetables: "Vegetables",
  fats: "Fats",
};

/** What to lean on in each phase, in one line. */
export const PHASE_FOOD_TIP: Record<Phase, string> = {
  CUT: "Build each meal around a lean protein and a big serving of vegetables, then add a measured portion of carbs. Vegetables fill you up for very few calories.",
  MAINTAIN: "Aim for protein at every meal and a balanced plate. You don't need to cut anything out — just keep portions steady.",
  BULK: "Add calories that are easy to eat: an extra cup of rice, eggs, milk, peanut butter. Keep protein high so the surplus goes to muscle.",
};

/** Foods for one phase, grouped, most useful first. */
export function foodsFor(phase: Phase): Record<FoodGroup, Food[]> {
  const order: FoodGroup[] = ["protein", "carbs", "vegetables", "fats"];
  const out = {} as Record<FoodGroup, Food[]>;
  for (const group of order) {
    out[group] = FOODS.filter((f) => f.group === group).sort(
      (a, b) => Number(b.goodFor.includes(phase)) - Number(a.goodFor.includes(phase))
    );
  }
  return out;
}
