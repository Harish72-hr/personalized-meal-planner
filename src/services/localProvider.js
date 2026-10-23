import meals from "../data/meals.json" with { type: "json" };

export function searchRecipes(filters = {}) {
  const slot = filters.slot;
  return meals
    .filter((meal) => !slot || meal.mealType === slot)
    .map((meal) => ({ ...meal, sourceUrl: meal.sourceUrl || "", source: "local" }));
}

export function getRecipeDetails(id) {
  const meal = meals.find((recipe) => recipe.id === id);
  if (!meal) throw new Error(`Local recipe "${id}" was not found.`);
  return { ...meal, sourceUrl: meal.sourceUrl || "", source: "local", instructions: "" };
}

export default { searchRecipes, getRecipeDetails };
