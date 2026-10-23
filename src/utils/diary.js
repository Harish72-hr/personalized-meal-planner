export const DIARY_SLOTS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDaysToDateKey(key, days) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function emptyDiaryDay() {
  return { breakfast: [], lunch: [], dinner: [], snacks: [] };
}

function nutritionNumber(value, name) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`${name} must be a non-negative number.`);
  return number;
}

export function scaleNutrition(food, servings = 1) {
  const multiplier = Number(servings);
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new RangeError("Servings must be greater than zero.");
  return {
    calories: nutritionNumber(food.calories, "Calories") * multiplier,
    protein: nutritionNumber(food.protein, "Protein") * multiplier,
    carbs: nutritionNumber(food.carbs, "Carbohydrates") * multiplier,
    fat: nutritionNumber(food.fat, "Fat") * multiplier,
  };
}

export function sumNutrition(entries = []) {
  return entries.reduce((total, entry) => {
    const food = entry.meal || entry;
    const servings = entry.meal ? (entry.servings ?? 1) : 1;
    const scaled = scaleNutrition(food, servings);
    total.calories += scaled.calories;
    total.protein += scaled.protein;
    total.carbs += scaled.carbs;
    total.fat += scaled.fat;
    return total;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

export function roundNutrition(nutrition) {
  return {
    calories: Math.round(nutrition.calories),
    protein: Math.round(nutrition.protein * 10) / 10,
    carbs: Math.round(nutrition.carbs * 10) / 10,
    fat: Math.round(nutrition.fat * 10) / 10,
  };
}

export function dailyTotals(day = emptyDiaryDay()) {
  const entries = DIARY_SLOTS.flatMap(({ id }) => Array.isArray(day[id]) ? day[id] : []);
  const uniqueEntries = [];
  const seenIds = new Set();
  for (const entry of entries) {
    if (entry.id && seenIds.has(entry.id)) continue;
    if (entry.id) seenIds.add(entry.id);
    uniqueEntries.push(entry);
  }
  const totals = sumNutrition(uniqueEntries);
  return {
    ...totals,
    count: uniqueEntries.length,
  };
}

export function remainingCalories(goal, eaten) {
  const goalCalories = Number(goal);
  const eatenCalories = Number(eaten);
  if (!Number.isFinite(goalCalories) || !Number.isFinite(eatenCalories)) {
    throw new RangeError("Calorie goal and eaten calories must be valid numbers.");
  }
  return goalCalories - eatenCalories;
}

export function createDiaryEntry(food, servings = 1, id = globalThis.crypto?.randomUUID?.()) {
  const amount = Number(servings);
  const nutrition = scaleNutrition(food, amount);
  return {
    id: id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: String(food.name || "").trim(),
    servings: amount,
    ...nutrition,
    source: food.source || "manual",
    loggedAt: new Date().toISOString(),
  };
}
