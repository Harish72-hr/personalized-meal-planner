import test from "node:test";
import assert from "node:assert/strict";
import buildApiFilters from "../src/utils/buildApiFilters.js";
import { normalizeSpoonacularRecipe } from "../src/services/spoonacularProvider.js";
import { safeApiRecipes } from "../src/services/recipeProvider.js";

const profile = {
  dietType: "vegan",
  allergies: ["peanuts"],
  dislikedFoods: [],
  healthConditions: [],
  maxCookingTime: 60,
  cuisinePreferences: ["No preference"],
  mealsPerDay: 4,
};

test("API filters map user restrictions, slot calories, and health limits", () => {
  const filters = buildApiFilters({
    ...profile,
    dietType: "eggetarian",
    allergies: ["peanuts", "tree nuts", "fish"],
    dislikedFoods: ["mushrooms", "olives"],
    cuisinePreferences: ["Asian"],
    healthConditions: ["diabetes", "high-bp", "high-cholesterol"],
    maxCookingTime: 30,
  }, { calories: 1800 }, "breakfast", 40);

  assert.equal(filters.diet, "ovo-vegetarian");
  assert.equal(filters.intolerances, "peanut,tree nut,seafood");
  assert.equal(filters.excludeIngredients, "mushrooms,olives");
  assert.equal(filters.cuisine, "Asian");
  assert.equal(filters.maxReadyTime, 30);
  assert.equal(filters.minCalories, 382);
  assert.equal(filters.maxCalories, 518);
  assert.equal(filters.maxSugar, 10);
  assert.equal(filters.maxSodium, 650);
  assert.equal(filters.maxSaturatedFat, 24);
  assert.equal(filters.type, "breakfast");
  assert.equal(filters.addRecipeNutrition, true);
  assert.equal(filters.number, 20);
  assert.equal(filters.offset, 40);
});

test("normalization and hard filters reject peanut and meat recipes for a vegan allergic profile", () => {
  const mockApiRecipes = [
    {
      id: 901,
      title: "Peanut tofu bowl",
      diets: ["vegan", "vegetarian"],
      cuisines: ["Asian"],
      readyInMinutes: 20,
      extendedIngredients: [{ name: "peanuts", amount: 1, unit: "tbsp" }, { name: "tofu", amount: 100, unit: "g" }],
      nutrition: { nutrients: [{ name: "Calories", amount: 400 }, { name: "Protein", amount: 25 }] },
    },
    {
      id: 902,
      title: "Vegan chicken salad",
      diets: ["vegan", "vegetarian"],
      cuisines: ["American"],
      readyInMinutes: 15,
      extendedIngredients: [{ name: "chicken breast", amount: 100, unit: "g" }, { name: "lettuce", amount: 50, unit: "g" }],
      nutrition: { nutrients: [{ name: "Calories", amount: 350 }, { name: "Protein", amount: 30 }] },
    },
  ];
  const normalized = mockApiRecipes.map((recipe) => normalizeSpoonacularRecipe(recipe));

  assert.equal(normalized[0].source, "api");
  assert.equal(normalized[0].calories, 400);
  assert.equal(normalized[0].ingredients[0].name, "peanuts");
  assert.deepEqual(safeApiRecipes(normalized, profile), []);
});

test("API recipes are not passed through when the profile is missing", () => {
  const recipe = normalizeSpoonacularRecipe({
    id: 903,
    title: "Vegan bowl",
    diets: ["vegan", "vegetarian"],
    extendedIngredients: [{ name: "tofu", amount: 100, unit: "g" }],
    nutrition: { nutrients: [{ name: "Calories", amount: 300 }] },
  });

  assert.deepEqual(safeApiRecipes([recipe], undefined), []);
});
