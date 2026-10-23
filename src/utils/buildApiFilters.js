import { MEAL_SLOTS } from "./mealEngine.js";

const INTOLERANCE_MAP = {
  peanuts: "peanut",
  "tree nuts": "tree nut",
  dairy: "dairy",
  gluten: "gluten",
  eggs: "egg",
  soy: "soy",
  fish: "seafood",
  shellfish: "shellfish",
};

const DIET_MAP = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  eggetarian: "ovo-vegetarian",
};

export function getSlotCalorieFraction(slot, mealsPerDay = 4) {
  if (Number(mealsPerDay) === 3) {
    return { breakfast: 0.3, lunch: 0.4, dinner: 0.3 }[slot] || 0;
  }
  return MEAL_SLOTS.find(({ id }) => id === slot)?.fraction || 0;
}

export default function buildApiFilters(profile, nutrition, slot, offset = 0) {
  const targetCalories = nutrition.calories * getSlotCalorieFraction(slot, profile.mealsPerDay);
  const intolerances = [...new Set((profile.allergies || [])
    .map((allergy) => INTOLERANCE_MAP[String(allergy).trim().toLowerCase()])
    .filter(Boolean))];
  const cuisines = (profile.cuisinePreferences || []).filter((cuisine) => cuisine !== "No preference");
  const filters = {
    type: slot === "breakfast" ? "breakfast" : slot === "snack" ? "snack" : "main course",
    maxReadyTime: Number(profile.maxCookingTime) || undefined,
    minCalories: Math.max(1, Math.floor(targetCalories * 0.85)),
    maxCalories: Math.ceil(targetCalories * 1.15),
    addRecipeNutrition: true,
    number: 20,
    offset: Math.max(0, Number(offset) || 0),
  };
  if (DIET_MAP[profile.dietType]) filters.diet = DIET_MAP[profile.dietType];
  if (intolerances.length) filters.intolerances = intolerances.join(",");
  if (profile.dislikedFoods?.length) filters.excludeIngredients = profile.dislikedFoods.join(",");
  if (cuisines.length) filters.cuisine = cuisines.join(",");
  if (profile.healthConditions?.includes("diabetes")) filters.maxSugar = 10;
  if (profile.healthConditions?.includes("high-bp")) filters.maxSodium = 650;
  if (profile.healthConditions?.includes("high-cholesterol")) filters.maxSaturatedFat = 24;
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined));
}

export { INTOLERANCE_MAP };
