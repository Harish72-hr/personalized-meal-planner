import test from "node:test";
import assert from "node:assert/strict";
import { dailyTotals, remainingCalories, roundNutrition, scaleNutrition, sumNutrition } from "../src/utils/diary.js";

test("serving scaler preserves precision until display rounding", () => {
  const scaled = scaleNutrition({ calories: 123.45, protein: 4.26, carbs: 8.15, fat: 1.04 }, 1.5);
  assert.equal(scaled.calories, 185.175);
  assert.ok(Math.abs(scaled.carbs - 12.225) < 1e-10);
  assert.deepEqual(roundNutrition(scaled), { calories: 185, protein: 6.4, carbs: 12.2, fat: 1.6 });
});

test("daily totals sum unrounded diary values across slots and count duplicate IDs once", () => {
  assert.deepEqual(dailyTotals({
    breakfast: [
      { id: "one", calories: 221.4, protein: 12.14, carbs: 23, fat: 8 },
      { id: "one", calories: 221.4, protein: 12.14, carbs: 23, fat: 8 },
    ],
    lunch: [{ id: "two", calories: 490.25, protein: 30.25, carbs: 48.5, fat: 17.55 }],
    dinner: [],
    snacks: [{ id: "three", calories: 100.25, protein: 2.25, carbs: 15, fat: 3 }],
  }), { calories: 811.9, protein: 44.64, carbs: 86.5, fat: 28.55, count: 3 });
});

test("plan nutrition totals apply servings exactly once", () => {
  assert.deepEqual(sumNutrition([
    { meal: { calories: 101.5, protein: 4.25, carbs: 10.5, fat: 2.1 }, servings: 1.5 },
    { meal: { calories: 200, protein: 10, carbs: 25, fat: 5 } },
  ]), { calories: 352.25, protein: 16.375, carbs: 40.75, fat: 8.15 });
});

test("remaining calories preserve raw precision and can go negative", () => {
  assert.equal(remainingCalories(2000, 1850.5), 149.5);
  assert.equal(remainingCalories(2000, 2125), -125);
});
