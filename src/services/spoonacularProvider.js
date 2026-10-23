const NUTRIENTS = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbohydrates",
  fat: "Fat",
  sugar: "Sugar",
  sodium: "Sodium",
};

function nutrientValue(nutrients, name) {
  const nutrient = nutrients?.find((entry) => entry.name?.toLowerCase() === name.toLowerCase());
  return Number(nutrient?.amount) || 0;
}

function dietTypes(diets = []) {
  const normalized = diets.map((diet) => diet.toLowerCase());
  if (normalized.includes("vegan")) return ["vegan", "vegetarian"];
  if (normalized.some((diet) => diet.includes("ovo-vegetarian"))) return ["eggetarian"];
  if (normalized.some((diet) => diet.includes("vegetarian"))) return ["vegetarian"];
  if (normalized.some((diet) => diet.includes("pescetarian") || diet.includes("ketogenic") || diet.includes("paleo"))) {
    return ["non-vegetarian"];
  }
  return [];
}

const ALLERGEN_RULES = [
  ["peanuts", /\b(peanuts?|groundnuts?)\b/i],
  ["tree nuts", /\b(tree nuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?)\b/i],
  ["dairy", /\b(milk|cheese|paneer|yogurt|yoghurt|curd|butter|ghee|cream|whey|casein)\b/i],
  ["gluten", /\b(wheat|barley|rye|semolina|durum|spelt)\b/i],
  ["eggs", /\beggs?\b/i],
  ["soy", /\b(soy|soya|tofu|edamame)\b/i],
  ["fish", /\b(seafood|fish|salmon|tuna|cod|anchov(?:y|ies))\b/i],
  ["shellfish", /\b(seafood|shrimp|prawns?|crab|lobster|shellfish|mussels?|oysters?)\b/i],
];

export function normalizeSpoonacularRecipe(recipe) {
  if (!recipe || recipe.id === undefined || !recipe.title) {
    throw new TypeError("Spoonacular recipe is missing its id or title.");
  }
  const nutrients = recipe.nutrition?.nutrients || [];
  const ingredientText = (recipe.extendedIngredients || []).map((ingredient) =>
    `${ingredient.name || ""} ${ingredient.original || ""}`,
  ).join(" ");
  const allergens = ALLERGEN_RULES.filter(([, pattern]) => pattern.test(ingredientText)).map(([name]) => name);
  const cuisine = recipe.cuisines?.[0] || "International";
  const readyInMinutes = Number(recipe.readyInMinutes);
  const diets = dietTypes(recipe.diets || []);
  if (!diets.length && /\b(beef|pork|bacon|ham|lamb|mutton|chicken|turkey|duck|fish|salmon|tuna|shrimp|prawn|crab|lobster)\b/i.test(ingredientText)) {
    diets.push("non-vegetarian");
  }
  if (!diets.length && /\beggs?\b/i.test(ingredientText)) diets.push("eggetarian");
  return {
    id: `spoonacular:${recipe.id}`,
    name: recipe.title,
    mealType: recipe.type === "breakfast" ? "breakfast" : recipe.type === "snack" ? "snack" : "main course",
    calories: nutrientValue(nutrients, NUTRIENTS.calories),
    protein: nutrientValue(nutrients, NUTRIENTS.protein),
    carbs: nutrientValue(nutrients, NUTRIENTS.carbs),
    fat: nutrientValue(nutrients, NUTRIENTS.fat),
    sugar: nutrientValue(nutrients, NUTRIENTS.sugar),
    sodium: nutrientValue(nutrients, NUTRIENTS.sodium),
    saturatedFat: nutrientValue(nutrients, "Saturated Fat"),
    dietType: diets,
    allergens,
    cuisine,
    ingredients: (recipe.extendedIngredients || []).map((ingredient) => ({
      name: ingredient.name || ingredient.nameClean || ingredient.original || "",
      quantity: Number(ingredient.amount) || 0,
      unit: ingredient.unit || "",
      aisle: ingredient.aisle || "",
    })).filter(({ name }) => name),
    prepTime: Number.isFinite(readyInMinutes) && readyInMinutes > 0 ? readyInMinutes : 9999,
    image: recipe.image || "",
    sourceUrl: recipe.sourceUrl || "",
    source: "api",
  };
}

export function normalizeSpoonacularDetails(detail) {
  const normalized = normalizeSpoonacularRecipe(detail);
  return {
    ...normalized,
    instructions: detail.instructions || detail.summary || "No instructions were provided for this recipe.",
  };
}

export async function searchRecipes(filters, { signal } = {}) {
  const query = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
  const response = await fetch(`/api/recipes/search?${query}`, { signal });
  if (!response.ok) {
    const error = new Error(`Recipe service returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  return (payload.results || []).map(normalizeSpoonacularRecipe);
}

export async function getRecipeDetails(id, { signal } = {}) {
  const recipeId = String(id).replace(/^spoonacular:/, "");
  const response = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}/details`, { signal });
  if (!response.ok) {
    const error = new Error(`Recipe details returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return normalizeSpoonacularDetails(await response.json());
}

export default { searchRecipes, getRecipeDetails };
