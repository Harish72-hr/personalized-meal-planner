import test from "node:test";
import assert from "node:assert/strict";
import { meals, mealMatchesProfile, generateWeeklyPlan, plannedEntryNutrition, scaleMeal, scoreMeal, swapMeal, getGroceryList } from "../src/utils/mealEngine.js";
import { calculateNutrition } from "../src/utils/calorieCalculator.js";

const baseProfile = {
  name: "Sam",
  age: 30,
  gender: "female",
  heightCm: 165,
  weightKg: 65,
  activityLevel: "moderate",
  goal: "maintain",
  pace: "moderate",
  dietType: "vegetarian",
  cuisinePreferences: ["No preference"],
  mealsPerDay: 4,
  maxCookingTime: 60,
  allergies: [],
  dislikedFoods: [],
  healthConditions: [],
};

test("dataset has 60+ complete meals and options for every slot", () => {
  assert.ok(meals.length >= 60);
  for (const slot of ["breakfast", "lunch", "snack", "dinner"]) {
    assert.ok(meals.filter((meal) => meal.mealType === slot).length >= 10);
  }
  for (const meal of meals) {
    assert.ok(Array.isArray(meal.dietType) && meal.dietType.length > 0);
    assert.ok(meal.ingredients.every(({ name, quantity, unit }) => name && quantity > 0 && unit));
    assert.ok(meal.sugar >= 0 && meal.sodium >= 0 && meal.prepTime > 0 && meal.image);
  }
});

test("hard filters protect diet, allergies, dislikes, prep time, and health rules", () => {
  const vegan = { ...baseProfile, dietType: "vegan", allergies: ["peanuts"], dislikedFoods: ["mango"], maxCookingTime: 15, healthConditions: ["diabetes"] };
  const plan = generateWeeklyPlan(vegan, calculateNutrition(vegan), [], () => 0);
  for (const day of plan.days) for (const { meal } of day.meals) {
    if (!meal) continue;
    assert.ok(meal.dietType.includes("vegan"));
    assert.ok(!meal.allergens.includes("peanuts"));
    assert.ok(!meal.ingredients.some(({ name }) => name.toLowerCase().includes("mango")));
    assert.ok(meal.prepTime <= 15 || plan.relaxedRules.includes("prepTime"));
    assert.ok(meal.sugar <= 10);
  }
  assert.equal(mealMatchesProfile(meals.find((meal) => meal.id === "b10"), vegan), false);
});

test("eggetarian and vegetarian profiles have separate egg rules", () => {
  const omelette = meals.find((meal) => meal.id === "b07");
  assert.equal(mealMatchesProfile(omelette, { ...baseProfile, dietType: "eggetarian" }), true);
  assert.equal(mealMatchesProfile(omelette, { ...baseProfile, dietType: "vegetarian" }), false);
});

test("scores calorie, protein, cuisine, repeat, and favorite signals", () => {
  const meal = meals.find((entry) => entry.id === "b05");
  const perfect = scoreMeal(meal, { targetCalories: meal.calories, targetProtein: meal.protein, cuisinePreferences: [meal.cuisine], randomValue: 0 });
  const repeatedFavorite = scoreMeal(meal, { targetCalories: meal.calories, targetProtein: meal.protein, cuisinePreferences: [meal.cuisine], usedCount: 1, favorites: [meal.id], randomValue: 0 });
  assert.equal(perfect, 100);
  assert.equal(repeatedFavorite, 95);
  assert.ok(scoreMeal(meal, { targetCalories: 1, targetProtein: 1, randomValue: 0 }) >= 0);
});

test("missing profile metadata is treated defensively and does not crash filtering", () => {
  const meal = { ...meals[0], allergens: undefined, dietType: ["vegetarian"], ingredients: meals[0].ingredients.map((ingredient) => ({ ...ingredient })) };
  assert.equal(mealMatchesProfile(meal, undefined), false);
  assert.equal(mealMatchesProfile(meal, {}), false);
  assert.doesNotThrow(() => mealMatchesProfile({ ...meal, allergens: undefined }, { dietType: "vegetarian", allergies: ["peanuts"], dislikedFoods: [], maxCookingTime: 60, healthConditions: [] }));
  assert.equal(getGroceryList({ days: [{ meals: [{ meal }] }] }).length > 0, true);
});

test("rejects peanut ingredients when allergen metadata is missing", () => {
  const veganPeanutProfile = { ...baseProfile, dietType: "vegan", allergies: ["peanuts"] };
  const meal = {
    name: "Satay bowl",
    dietType: ["vegan"],
    ingredients: [{ name: "peanut butter" }],
  };

  assert.equal(mealMatchesProfile(meal, veganPeanutProfile), false);
});

test("rejects a vegan recipe with missing diet metadata", () => {
  const veganPeanutProfile = { ...baseProfile, dietType: "vegan", allergies: ["peanuts"] };
  const meal = {
    name: "Mystery dish",
    allergens: [],
    ingredients: [{ name: "coconut" }],
  };

  assert.equal(mealMatchesProfile(meal, veganPeanutProfile), false);
});

test("missing profile does not produce an unfiltered meal plan", () => {
  let plan;
  assert.doesNotThrow(() => {
    plan = generateWeeklyPlan(undefined, calculateNutrition(baseProfile));
  });
  assert.ok(plan.days.flatMap(({ meals }) => meals).every(({ meal }) => meal === null));
});

test("weekly plan has seven days, the requested meal count, and no consecutive repeats", () => {
  for (const dietType of ["vegetarian", "non-vegetarian", "vegan", "eggetarian"]) {
    const profile = { ...baseProfile, dietType, mealsPerDay: 4 };
    const plan = generateWeeklyPlan(profile, calculateNutrition(profile), [], () => 0.25);
    assert.equal(plan.days.length, 7);
    assert.ok(plan.days.every((day) => day.meals.length === 4));
    for (let day = 1; day < plan.days.length; day += 1) {
      for (const entry of plan.days[day].meals) {
        const previous = plan.days[day - 1].meals.find((candidate) => candidate.slot === entry.slot);
        assert.ok(!entry.meal || !previous?.meal || entry.meal.id !== previous.meal.id);
      }
    }
  }
  const threeMealProfile = { ...baseProfile, mealsPerDay: 3 };
  const threeMealPlan = generateWeeklyPlan(threeMealProfile, calculateNutrition(threeMealProfile), [], () => 0);
  assert.ok(threeMealPlan.days.every((day) => day.meals.length === 3 && !day.meals.some(({ slot }) => slot === "snack")));
});

test("swap selects a different meal and grocery list aggregates ingredient quantities", () => {
  const plan = generateWeeklyPlan(baseProfile, calculateNutrition(baseProfile), [], () => 0.2);
  const currentId = plan.days[0].meals.find(({ slot }) => slot === "breakfast").meal.id;
  const swapped = swapMeal(plan, "breakfast", 0, baseProfile, calculateNutrition(baseProfile), [], () => 0.9);
  assert.notEqual(swapped.days[0].meals.find(({ slot }) => slot === "breakfast").meal.id, currentId);
  const grocery = getGroceryList(plan);
  assert.ok(grocery.length > 0);
  assert.ok(grocery.every((item) => item.name && item.quantity > 0 && item.category && item.unit));
});

test("portion scaling applies equally to nutrition and ingredient quantities", () => {
  const meal = meals.find((entry) => entry.id === "b05");
  const scaled = scaleMeal(meal, 1.5);
  assert.equal(scaled.calories, meal.calories * 1.5);
  assert.equal(scaled.protein, meal.protein * 1.5);
  assert.equal(scaled.sugar, meal.sugar * 1.5);
  assert.equal(scaled.sodium, meal.sodium * 1.5);
  assert.equal(scaled.ingredients[0].quantity, meal.ingredients[0].quantity * 1.5);
  assert.equal(meal.ingredients[0].quantity * 1.5, scaled.ingredients[0].quantity);
  const grocery = getGroceryList({ days: [{ meals: [{ meal, servings: 1.5 }] }] });
  assert.ok(grocery.some((item) => item.quantity === meal.ingredients[0].quantity * 1.5));
});

test("vegan peanut-allergy plans meet calorie targets from 1600 through 3000 kcal", () => {
  const profile = {
    ...baseProfile,
    dietType: "vegan",
    allergies: ["peanuts"],
    dislikedFoods: [],
    healthConditions: [],
    maxCookingTime: 60,
    mealsPerDay: 4,
  };
  for (const targetCalories of [1600, 2000, 2500, 3000]) {
    const nutrition = { calories: targetCalories, protein: 100, carbs: 250, fat: 80 };
    const plan = generateWeeklyPlan(profile, nutrition, [], () => 0.25);
    for (const day of plan.days) {
      const calories = day.meals.reduce((sum, entry) => sum + plannedEntryNutrition(entry).calories, 0);
      assert.ok(
        Math.abs(calories - targetCalories) <= targetCalories * 0.1,
        `target ${targetCalories}; day ${day.dayIndex} yielded ${calories}`,
      );
      assert.equal(day.calorieWarning, false);
      for (const entry of day.meals) {
        for (const component of entry.meal ? [entry.meal, ...(entry.sides || []).map(({ meal }) => meal)] : []) {
          assert.equal(mealMatchesProfile(component, profile, { ignorePrepTime: false }), true);
          assert.ok(!component.allergens?.includes("peanuts"));
          assert.ok(!component.ingredients.some(({ name }) => /\bpeanuts?\b/i.test(name)));
        }
      }
    }
  }
});

test("swap re-selects portion size and refreshes the day's calorie warning", () => {
  const profile = { ...baseProfile, mealsPerDay: 4 };
  const nutrition = { calories: 2200, protein: 120, carbs: 250, fat: 70 };
  const plan = generateWeeklyPlan(profile, nutrition, [], () => 0.2);
  const swapped = swapMeal(plan, "breakfast", 0, profile, nutrition, [], () => 0.9);
  const breakfast = swapped.days[0].meals.find(({ slot }) => slot === "breakfast");
  assert.ok(breakfast.servings >= 0.5 && breakfast.servings <= 2);
  assert.equal(breakfast.servings * 4, Math.round(breakfast.servings * 4));
  assert.equal(typeof swapped.days[0].calorieWarning, "boolean");
});
