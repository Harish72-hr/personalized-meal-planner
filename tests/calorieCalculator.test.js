import test from "node:test";
import assert from "node:assert/strict";
import { calculateBMR, calculateMacros, calculateNutrition } from "../src/utils/calorieCalculator.js";

test("Mifflin-St Jeor preserves decimal BMR precision for all genders", () => {
  const measurements = { age: 25, heightCm: 175, weightKg: 70 };
  assert.equal(calculateBMR({ ...measurements, gender: "male" }), 1673.75);
  assert.equal(calculateBMR({ ...measurements, gender: "female" }), 1507.75);
  assert.equal(calculateBMR({ ...measurements, gender: "other" }), 1590.75);
});

test("calculates male TDEE and moderate weight loss from the configured deficit", () => {
  const profile = {
    age: 25, heightCm: 175, weightKg: 70, gender: "male",
    activityLevel: "moderate", goal: "maintain", pace: "moderate",
  };
  const maintain = calculateNutrition(profile);
  assert.equal(maintain.bmr, 1673.75);
  assert.equal(maintain.tdee, 2594);
  assert.equal(maintain.calories, 2594);
  const lose = calculateNutrition({ ...profile, goal: "lose" });
  assert.equal(lose.goalAdjustment, -400);
  assert.equal(lose.calories, 2194);
});

test("calculates female sedentary TDEE", () => {
  const nutrition = calculateNutrition({
    age: 25, heightCm: 165, weightKg: 60, gender: "female",
    activityLevel: "sedentary", goal: "maintain", pace: "moderate",
  });
  assert.equal(nutrition.bmr, 1345.25);
  assert.equal(nutrition.tdee, 1614);
});

test("calculates macro grams from the calorie split", () => {
  assert.deepEqual(calculateMacros(2000, 70, "maintain"), {
    protein: 112, carbs: 213.4, fat: 77.6,
    macroSplit: { protein: 0.224, carbs: 0.4268, fat: 0.3492 },
    proteinCapApplied: false,
  });
});

test("weight-loss protein targets 2 g/kg and caps at 35% of calories", () => {
  const nutrition = calculateNutrition({
    age: 35, heightCm: 175, weightKg: 70, gender: "male",
    activityLevel: "moderate", goal: "lose", pace: "moderate",
  });
  assert.equal(nutrition.protein, 140);
  assert.equal(nutrition.proteinCapApplied, false);

  const capped = calculateMacros(1600, 100, "lose");
  assert.equal(capped.protein, 140);
  assert.equal(capped.proteinCapApplied, true);
  const remainingCalories = 1600 - 140 * 4;
  assert.equal(capped.carbs, Math.round((remainingCalories * 0.55 / 4) * 10) / 10);
  assert.equal(capped.fat, Math.round((remainingCalories * 0.45 / 9) * 10) / 10);
});

test("macro donut energy split reflects macro gram targets", () => {
  const macros = calculateMacros(2000, 70, "maintain");
  assert.equal(macros.protein * 4 + macros.carbs * 4 + macros.fat * 9, 2000);
  assert.equal(macros.macroSplit.protein + macros.macroSplit.carbs + macros.macroSplit.fat, 1);
});

test("applies the safety floor only when the target falls below it", () => {
  const base = {
    age: 100, heightCm: 140, weightKg: 25, activityLevel: "sedentary",
    goal: "lose", pace: "fast",
  };
  const female = calculateNutrition({ ...base, gender: "female" });
  assert.equal(female.calories, 1200);
  assert.equal(female.safetyFloorApplied, true);
  const male = calculateNutrition({ ...base, gender: "male" });
  assert.equal(male.calories, 1500);
  assert.equal(male.safetyFloorApplied, true);
  const aboveFloor = calculateNutrition({
    age: 25, heightCm: 165, weightKg: 60, gender: "female",
    activityLevel: "sedentary", goal: "maintain", pace: "moderate",
  });
  assert.equal(aboveFloor.safetyFloorApplied, false);
  assert.equal(aboveFloor.calories, 1614);
});

test("coerces valid numeric string inputs and rejects invalid values", () => {
  const nutrition = calculateNutrition({
    age: "25", heightCm: "175", weightKg: "70", gender: "male",
    activityLevel: "moderate", goal: "maintain", pace: "moderate",
  });
  assert.equal(nutrition.bmr, 1673.75);
  assert.throws(() => calculateBMR({ age: "not a number", heightCm: "175", weightKg: "70", gender: "male" }), /Age must be a positive number/);
  assert.throws(() => calculateNutrition({
    age: 25, heightCm: 175, weightKg: 70, gender: "male",
    activityLevel: "unknown", goal: "maintain", pace: "moderate",
  }), /Unsupported activity level/);
});

test("uses the requested gain adjustment schedule", () => {
  const base = {
    age: 25, heightCm: 175, weightKg: 70, gender: "male",
    activityLevel: "moderate", goal: "gain",
  };
  assert.equal(calculateNutrition({ ...base, pace: "slow" }).goalAdjustment, 250);
  assert.equal(calculateNutrition({ ...base, pace: "moderate" }).goalAdjustment, 350);
  assert.equal(calculateNutrition({ ...base, pace: "fast" }).goalAdjustment, 500);
});
