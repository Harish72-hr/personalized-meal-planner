import meals from "../data/meals.json" with { type: "json" };

export const ALLERGEN_OPTIONS = [
  "peanuts", "tree nuts", "dairy", "gluten", "eggs", "soy", "fish", "shellfish",
];

export const MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast", fraction: 0.25 },
  { id: "lunch", label: "Lunch", fraction: 0.35 },
  { id: "snack", label: "Snack", fraction: 0.1 },
  { id: "dinner", label: "Dinner", fraction: 0.3 },
];

const ALLERGEN_ALIASES = {
  peanut: "peanuts", almond: "tree nuts", almonds: "tree nuts", cashew: "tree nuts",
  cashews: "tree nuts", walnut: "tree nuts", walnuts: "tree nuts", "tree nuts": "tree nuts",
  milk: "dairy", lactose: "dairy", cheese: "dairy", paneer: "dairy",
  yogurt: "dairy", yoghurt: "dairy", curd: "dairy", wheat: "gluten",
  barley: "gluten", rye: "gluten", egg: "eggs", prawn: "shellfish", prawns: "shellfish",
  shrimp: "shellfish",
};
const SLOT_IDS = MEAL_SLOTS.map(({ id }) => id);
const MIN_VARIETY_POOL = 7;
const SERVING_OPTIONS = Array.from({ length: 7 }, (_, index) => 0.5 + index * 0.25);

function normalize(value) {
  return String(value).trim().toLowerCase();
}

function normalizeAllergen(value) {
  const normalized = normalize(value);
  return ALLERGEN_ALIASES[normalized] || normalized;
}

function profileDietMatches(meal, dietType) {
  if (!Array.isArray(meal.ingredients) || meal.ingredients.length === 0) return false;
  const mealDietTypes = Array.isArray(meal.dietType) ? meal.dietType : [];
  const ingredientText = meal.ingredients.map(({ name }) => normalize(name)).join(" ");
  const containsMeatOrSeafood = /\b(beef|pork|bacon|ham|lamb|mutton|chicken|turkey|duck|meat|fish|salmon|tuna|cod|shrimp|prawn|crab|lobster|shellfish|anchov(?:y|ies))\b/.test(ingredientText);
  const containsEgg = /\beggs?\b/.test(ingredientText);
  const containsAnimalProduct = containsMeatOrSeafood || containsEgg ||
    /\b(milk|cream|butter|ghee|cheese|yogurt|yoghurt|honey|gelatin|casein|whey)\b/.test(ingredientText);
  if (dietType === "vegan") return mealDietTypes.includes("vegan") && !containsAnimalProduct;
  if (dietType === "vegetarian") {
    return mealDietTypes.includes("vegetarian") && !mealDietTypes.includes("eggetarian") &&
      !containsMeatOrSeafood && !containsEgg;
  }
  if (dietType === "eggetarian") {
    return (mealDietTypes.includes("vegetarian") || mealDietTypes.includes("eggetarian")) &&
      !containsMeatOrSeafood;
  }
  return dietType === "non-vegetarian" && mealDietTypes.length > 0;
}

export function mealMatchesProfile(meal, profile, { ignorePrepTime = false } = {}) {
  if (!meal || !Array.isArray(meal.ingredients)) return false;
  const safeProfile = profile || {};
  if (safeProfile.allergies?.length && meal.ingredients.length === 0) return false;
  if (!profileDietMatches(meal, safeProfile.dietType)) return false;

  const allergens = (safeProfile.allergies || []).map(normalizeAllergen).filter(Boolean);
  const mealIngredients = meal.ingredients.map(({ name }) => normalize(name));
  const allergenText = [meal.name, ...mealIngredients].join(" ").toLowerCase();
  const allergenPatterns = {
    peanuts: /\b(peanuts?|groundnuts?)\b/,
    "tree nuts": /\b(tree nuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?)\b/,
    dairy: /\b(milk|lactose|cheese|paneer|yogurt|yoghurt|curd|butter|ghee|cream|whey|casein)\b/,
    gluten: /\b(wheat|barley|rye|semolina|durum|spelt)\b/,
    eggs: /\beggs?\b/,
    soy: /\b(soy|soya|tofu|edamame)\b/,
    fish: /\b(seafood|fish|salmon|tuna|cod|anchov(?:y|ies))\b/,
    shellfish: /\b(seafood|shrimp|prawns?|crab|lobster|shellfish|mussels?|oysters?)\b/,
  };
  const mealAllergens = Array.isArray(meal.allergens) ? meal.allergens : [];
  if (mealAllergens.some((allergen) => allergens.includes(normalizeAllergen(allergen))) ||
    allergens.some((allergen) => allergenPatterns[allergen]
      ? allergenPatterns[allergen].test(allergenText)
      : allergenText.includes(allergen))) return false;

  const dislikes = (safeProfile.dislikedFoods || []).map(normalize).filter(Boolean);
  const mealText = [meal.name, ...meal.ingredients.map(({ name }) => name)].join(" ").toLowerCase();
  if (dislikes.some((food) => mealText.includes(food))) return false;

  if (!ignorePrepTime && meal.prepTime > Number(safeProfile.maxCookingTime || Infinity)) return false;

  const conditions = safeProfile.healthConditions || [];
  if (conditions.includes("diabetes") && meal.sugar > 10) return false;
  if (conditions.includes("pcos") && meal.sugar > 15) return false;
  if (conditions.includes("high-bp") && meal.sodium > 650) return false;
  if (conditions.includes("high-cholesterol") &&
    (meal.sodium > 650 || meal.fat > 24 || (meal.source === "api" && meal.saturatedFat > 24))) return false;

  return true;
}

function getSlotFraction(slotId, mealsPerDay) {
  if (slotId === "snack" && Number(mealsPerDay) === 3) return 0;
  if (Number(mealsPerDay) === 3 && slotId === "breakfast") return 0.3;
  if (Number(mealsPerDay) === 3 && slotId === "lunch") return 0.4;
  if (Number(mealsPerDay) === 3 && slotId === "dinner") return 0.3;
  return MEAL_SLOTS.find((slot) => slot.id === slotId)?.fraction || 0;
}

export function scaleMeal(meal, servings = 1) {
  return {
    ...meal,
    calories: Number(meal.calories || 0) * servings,
    protein: Number(meal.protein || 0) * servings,
    carbs: Number(meal.carbs || 0) * servings,
    fat: Number(meal.fat || 0) * servings,
    sugar: Number(meal.sugar || 0) * servings,
    sodium: Number(meal.sodium || 0) * servings,
    saturatedFat: Number(meal.saturatedFat || 0) * servings,
    ingredients: (meal.ingredients || []).map((ingredient) => ({
      ...ingredient,
      quantity: Number(ingredient.quantity || 0) * servings,
    })),
  };
}

function closestServingMultiplier(meal, calorieTarget) {
  return SERVING_OPTIONS.reduce((best, servings) => {
    const difference = Math.abs(meal.calories * servings - calorieTarget);
    return difference < best.difference ? { servings, difference } : best;
  }, { servings: SERVING_OPTIONS[0], difference: Infinity }).servings;
}

function planEntryCalories(entry) {
  if (!entry.meal) return 0;
  const mainServings = Number(entry.servings) || 1;
  return entry.meal.calories * mainServings +
    (entry.sides || []).reduce((sum, side) => sum + side.meal.calories * side.servings, 0);
}

export function plannedEntryNutrition(entry) {
  if (!entry?.meal) return { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0 };
  const main = scaleMeal(entry.meal, Number(entry.servings) || 1);
  return (entry.sides || []).reduce((total, side) => {
    const scaledSide = scaleMeal(side.meal, side.servings);
    for (const nutrient of ["calories", "protein", "carbs", "fat", "sugar", "sodium"]) {
      total[nutrient] += scaledSide[nutrient];
    }
    return total;
  }, {
    calories: main.calories,
    protein: main.protein,
    carbs: main.carbs,
    fat: main.fat,
    sugar: main.sugar,
    sodium: main.sodium,
  });
}

function addComplementarySide(entry, candidates, slotTarget) {
  if (!entry.meal || entry.servings !== 2 || planEntryCalories(entry) >= slotTarget * 0.9) return entry;
  const remainingCalories = slotTarget - planEntryCalories(entry);
  const existingIds = new Set([entry.meal.id, ...(entry.sides || []).map(({ meal }) => meal.id)]);
  const bestSide = candidates
    .filter((candidate) => !existingIds.has(candidate.id))
    .flatMap((meal) => SERVING_OPTIONS.map((servings) => ({
      meal,
      servings,
      difference: Math.abs(remainingCalories - meal.calories * servings),
    })))
    .sort((left, right) => left.difference - right.difference || left.meal.id.localeCompare(right.meal.id))[0];
  if (!bestSide || bestSide.difference >= remainingCalories) return entry;
  return { ...entry, sides: [...(entry.sides || []), { meal: bestSide.meal, servings: bestSide.servings }] };
}

function createPortionedEntry(slotId, meal, profile, nutrition, candidates) {
  if (!meal) return { slot: slotId, meal: null, servings: 1, sides: [] };
  const target = nutrition.calories * getSlotFraction(slotId, profile.mealsPerDay);
  const servings = closestServingMultiplier(meal, target);
  return addComplementarySide({ slot: slotId, meal, servings, sides: [] }, candidates, target);
}

function dayCalories(entries) {
  return entries.reduce((sum, entry) => sum + planEntryCalories(entry), 0);
}

function correctDayPortions(entries, dailyTarget) {
  const mealSlots = ["lunch", "dinner"];
  const adjustable = entries.filter((entry) => mealSlots.includes(entry.slot) && entry.meal);
  if (!adjustable.length || !dailyTarget) return entries;
  const currentDifference = Math.abs(dayCalories(entries) - dailyTarget);
  let bestDifference = currentDifference;
  let bestEntries = entries;

  for (const lunchServings of SERVING_OPTIONS) {
    for (const dinnerServings of SERVING_OPTIONS) {
      const candidateEntries = entries.map((entry) => {
        if (entry.slot === "lunch" && entry.meal) return { ...entry, servings: lunchServings };
        if (entry.slot === "dinner" && entry.meal) return { ...entry, servings: dinnerServings };
        return entry;
      });
      const difference = Math.abs(dayCalories(candidateEntries) - dailyTarget);
      if (difference < bestDifference) {
        bestDifference = difference;
        bestEntries = candidateEntries;
      }
    }
  }
  return bestEntries;
}

function finalizeDay(dayIndex, entries, nutrition) {
  const correctedMeals = correctDayPortions(entries, nutrition.calories);
  const calories = dayCalories(correctedMeals);
  return {
    dayIndex,
    meals: correctedMeals,
    calories,
    calorieWarning: Math.abs(calories - nutrition.calories) > nutrition.calories * 0.1,
  };
}

export function scoreMeal(meal, {
  targetCalories,
  targetProtein,
  maxCookingTime = Infinity,
  usedCount = 0,
  cuisinePreferences = [],
  favorites = [],
  randomValue = 0,
} = {}) {
  const calorieMatch = Math.max(0, 1 - Math.abs(meal.calories - targetCalories) / Math.max(targetCalories, 1));
  const proteinMatch = Math.max(0, 1 - Math.abs(meal.protein - targetProtein) / Math.max(targetProtein, 1));
  const preferredCuisines = cuisinePreferences.filter((cuisine) => cuisine !== "No preference");
  const cuisineMatch = !preferredCuisines.length || preferredCuisines.includes(meal.cuisine) ? 1 : 0;
  const prepTimeMatch = meal.prepTime <= maxCookingTime ? 1 : 0;
  const base = 40 * calorieMatch + 25 * proteinMatch + 15 * cuisineMatch + 20 * prepTimeMatch;
  const repeatPenalty = Math.max(0, usedCount) * 20;
  const favoriteBonus = favorites.includes(meal.id) ? 15 : 0;
  const tiebreaker = Math.max(0, Math.min(1, randomValue)) * 2;
  return Math.max(0, Math.min(100, base - repeatPenalty + favoriteBonus + tiebreaker));
}

function resolveCandidates(slotId, profile = {}, relaxationSet, candidatePool) {
  const safeProfile = profile || {};
  const hardFiltered = candidatePool.filter((meal) =>
    meal.mealType === slotId &&
    mealMatchesProfile(meal, safeProfile, { ignorePrepTime: relaxationSet.has("prepTime") }),
  );
  const cuisines = (safeProfile.cuisinePreferences || []).filter((cuisine) => cuisine !== "No preference");
  if (cuisines.length && !relaxationSet.has("cuisine")) {
    return hardFiltered.filter((meal) => cuisines.includes(meal.cuisine));
  }
  return hardFiltered;
}

function candidatesForSlot(slotId, profile = {}, candidatePool = meals) {
  const safeProfile = profile || {};
  const selectedCuisines = (safeProfile.cuisinePreferences || []).filter((item) => item !== "No preference");
  const strict = resolveCandidates(slotId, safeProfile, new Set(), candidatePool);
  if (strict.length >= MIN_VARIETY_POOL) return { meals: strict, relaxed: [] };

  if (selectedCuisines.length) {
    const cuisineRelaxed = resolveCandidates(slotId, profile, new Set(["cuisine"]), candidatePool);
    if (cuisineRelaxed.length >= MIN_VARIETY_POOL) {
      return { meals: cuisineRelaxed, relaxed: ["cuisine"] };
    }
  }

  const prepRelaxed = resolveCandidates(
    slotId,
    profile,
    new Set([...(selectedCuisines.length ? ["cuisine"] : []), "prepTime"]),
    candidatePool,
  );
  if (prepRelaxed.length) {
    return {
      meals: prepRelaxed,
      relaxed: [...(selectedCuisines.length ? ["cuisine"] : []), "prepTime"],
    };
  }
  return { meals: [], relaxed: [] };
}

function pickMeal(slotId, profile = {}, nutrition, state, random, candidatePool) {
  const safeProfile = profile || {};
  const { meals: candidates, relaxed } = candidatesForSlot(slotId, safeProfile, candidatePool);
  if (!candidates.length) return { meal: null, relaxed };
  const fraction = getSlotFraction(slotId, safeProfile.mealsPerDay);
  const preferredCuisines = (safeProfile.cuisinePreferences || []).filter((item) => item !== "No preference");
  const previousDayId = state.previousDayBySlot[slotId];
  const ranked = candidates
    .filter((meal) => meal.id !== previousDayId)
    .map((meal) => ({
      meal,
      score: scoreMeal(meal, {
        targetCalories: nutrition.calories * fraction,
        targetProtein: nutrition.protein * fraction,
        maxCookingTime: Number(safeProfile.maxCookingTime || Infinity),
        usedCount: state.usedCounts[meal.id] || 0,
        cuisinePreferences: relaxed.includes("cuisine") ? [] : preferredCuisines,
        favorites: state.favorites,
        randomValue: random(),
      }),
    }))
    .sort((a, b) => b.score - a.score || a.meal.id.localeCompare(b.meal.id));
  const selected = ranked[0]?.meal;
  if (!selected) return { meal: null, relaxed };
  state.usedCounts[selected.id] = (state.usedCounts[selected.id] || 0) + 1;
  state.previousDayBySlot[slotId] = selected.id;
  return { meal: selected, relaxed, candidates };
}

export function generateWeeklyPlan(profile = {}, nutrition, favorites = [], random = Math.random, candidatePool = meals) {
  const safeProfile = profile || {};
  const state = { usedCounts: {}, previousDayBySlot: {}, favorites };
  const slotIds = Number(safeProfile.mealsPerDay) === 3
    ? SLOT_IDS.filter((slot) => slot !== "snack")
    : SLOT_IDS;
  const relaxedRules = new Set();
  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const entries = slotIds.map((slot) => {
      const result = pickMeal(slot, safeProfile, nutrition, state, random, candidatePool);
      result.relaxed.forEach((rule) => relaxedRules.add(rule));
      return createPortionedEntry(slot, result.meal, safeProfile, nutrition, result.candidates || []);
    });
    return finalizeDay(dayIndex, entries, nutrition);
  });
  return {
    days,
    relaxedRules: [...relaxedRules],
    unavailableSlots: [...new Set(days.flatMap((day) =>
      day.meals.filter(({ meal }) => !meal).map(({ slot }) => slot),
    ))],
  };
}

export function swapMeal(plan, slotId, dayIndex, profile = {}, nutrition, favorites = [], random = Math.random, candidatePool = meals) {
  if (!SLOT_IDS.includes(slotId) || !plan?.days?.[dayIndex]) return plan;
  const safeProfile = profile || {};
  const day = plan.days[dayIndex];
  const current = day.meals.find((entry) => entry.slot === slotId);
  if (!current) return plan;
  const previousDayId = plan.days[dayIndex - 1]?.meals.find((entry) => entry.slot === slotId)?.meal?.id;
  const nextDayId = plan.days[dayIndex + 1]?.meals.find((entry) => entry.slot === slotId)?.meal?.id;
  const selectedCuisines = (safeProfile.cuisinePreferences || []).filter((item) => item !== "No preference");
  const { meals: candidates, relaxed } = candidatesForSlot(slotId, safeProfile, candidatePool);
  const usedCounts = {};
  plan.days.forEach((planDay) => planDay.meals.forEach(({ meal }) => {
    if (meal) usedCounts[meal.id] = (usedCounts[meal.id] || 0) + 1;
  }));
  if (current.meal) usedCounts[current.meal.id] = Math.max(0, (usedCounts[current.meal.id] || 0) - 1);
  const fraction = getSlotFraction(slotId, safeProfile.mealsPerDay);
  const alternative = candidates
    .filter((meal) => meal.id !== current.meal?.id && meal.id !== previousDayId && meal.id !== nextDayId)
    .map((meal) => ({
      meal,
      score: scoreMeal(meal, {
        targetCalories: nutrition.calories * fraction,
        targetProtein: nutrition.protein * fraction,
        maxCookingTime: Number(safeProfile.maxCookingTime || Infinity),
        usedCount: usedCounts[meal.id] || 0,
        cuisinePreferences: relaxed.includes("cuisine") ? [] : selectedCuisines,
        favorites,
        randomValue: random(),
      }),
    }))
    .sort((a, b) => b.score - a.score || a.meal.id.localeCompare(b.meal.id))[0]?.meal;
  if (!alternative) return plan;

  const replacement = createPortionedEntry(slotId, alternative, safeProfile, nutrition, candidates);
  const updatedEntries = day.meals.map((entry) => entry.slot === slotId ? replacement : entry);
  const days = plan.days.map((planDay, index) => index !== dayIndex
    ? planDay
    : finalizeDay(dayIndex, updatedEntries, nutrition));
  const relaxedRules = [...new Set([...plan.relaxedRules, ...relaxed])];
  return { ...plan, days, relaxedRules };
}

const INGREDIENT_CATEGORIES = [
  ["Produce", /apple|avocado|banana|bean sprout|bell pepper|blueberr|broccoli|cabbage|carrot|cauliflower|cherry tomato|cucumber|drumstick|eggplant|green beans|kale|lemon|mango|mushroom|orange|onion|papaya|pear|peas|pineapple|potato|pumpkin|spinach|strawberr|sweet potato|tomato|zucchini/],
  ["Protein & dairy", /chicken|cod|cottage cheese|curd|dal|egg|edamame|fish|greek yogurt|ground turkey|kidney beans|lentil|moong dal|paneer|prawn|red lentil|salmon|tofu|tuna|turkey|yogurt/],
  ["Grains & bakery", /bread|brown rice|dosa batter|farro|foxtail millet|idli|makhana|noodle|oat|poha|quinoa|ragi|rice|roti|semolina|tortilla|whole wheat/],
  ["Pantry & spices", /almond|besan|black beans|coconut|corn|curry leaves|hummus|mustard seeds|olive oil|peanut|pumpkin seeds|sesame|soy milk|spice|sunflower|turmeric/],
];

function categoryForIngredient(name) {
  return INGREDIENT_CATEGORIES.find(([, pattern]) => pattern.test(name))?.[0] || "Pantry & spices";
}

export function getGroceryList(plan) {
  const items = new Map();
  (plan?.days || []).forEach((day) => (day?.meals || []).forEach((entry) => {
    const portions = entry.meal ? [
      { meal: entry.meal, servings: Number(entry.servings) || 1 },
      ...(entry.sides || []),
    ] : [];
    portions.forEach(({ meal, servings }) => scaleMeal(meal, servings).ingredients.forEach((ingredient) => {
      const canonicalName = normalize(ingredient.name)
        .replace(/\b(onions|carrots|lemons|apples|bananas|peanuts)\b/g, (word) => word.slice(0, -1))
        .replace(/\b(tomatoes)\b/g, "tomato")
        .replace(/\b(potatoes)\b/g, "potato")
        .replace(/\b(blueberries|strawberries)\b/g, (word) => `${word.slice(0, -3)}y`)
        .replace(/\s+/g, " ");
      const unit = String(ingredient.unit || "").toLowerCase().trim()
        .replace(/^(grams?|gms?)$/, "g")
        .replace(/^(milliliters?|mls?)$/, "ml")
        .replace(/^(teaspoons?|tsp\.?)$/, "tsp")
        .replace(/^(tablespoons?|tbsp\.?)$/, "tbsp");
      const key = `${canonicalName}|${unit}`;
      const current = items.get(key);
      items.set(key, {
        name: current?.name || canonicalName,
        quantity: (current?.quantity || 0) + Number(ingredient.quantity),
        unit,
        category: ingredient.aisle || current?.category || categoryForIngredient(ingredient.name),
      });
    }));
  }));
  return [...items.values()].sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

export { meals };
