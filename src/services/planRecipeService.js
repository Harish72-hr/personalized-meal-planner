import buildApiFilters from "../utils/buildApiFilters.js";
import { generateWeeklyPlan, MEAL_SLOTS } from "../utils/mealEngine.js";
import { searchRecipes } from "./recipeProvider.js";

const PLAN_SLOTS = MEAL_SLOTS.map(({ id }) => id);

export async function fetchPlanRecipes(profile, nutrition, { online = true, forceRefresh = false } = {}) {
  const slots = PLAN_SLOTS;
  const responses = await Promise.all(slots.map(async (slot) => {
    const filters = buildApiFilters(profile, nutrition, slot);
    const result = await searchRecipes(filters, { profile, slot, online, forceRefresh });
    return { slot, ...result };
  }));
  const candidatePool = [...new Map(responses.flatMap(({ recipes }) => recipes).map((meal) => [meal.id, meal])).values()];
  return {
    candidatePool,
    offline: responses.some(({ offline }) => offline),
    errors: responses.filter(({ error }) => error).map(({ error }) => error),
    apiOffsets: Object.fromEntries(slots.map((slot) => [slot, 20])),
  };
}

export async function createRecipePlan(profile, nutrition, favorites = [], options = {}) {
  const recipeResults = await fetchPlanRecipes(profile, nutrition, options);
  const plan = generateWeeklyPlan(profile, nutrition, favorites, Math.random, recipeResults.candidatePool);
  return { ...plan, ...recipeResults, offlineRecipes: recipeResults.offline };
}
