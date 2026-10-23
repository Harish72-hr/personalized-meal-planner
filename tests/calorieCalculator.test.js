import test from "node:test";
import assert from "node:assert/strict";
import {
  applyGoal, bmrHarrisBenedict, bmrKatchMcArdle, bmrMifflinStJeor, calculateBMI, calculateBMR, calculateMacros,
  calculateNutrition, calculateTDEE, cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, leanBodyMass,
  normalizeProfile, validateProfile,
} from "../src/utils/calorieCalculator.js";

const close = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);

const male = { age: 30, heightCm: 180, weightKg: 80, gender: "male", activityLevel: "moderate", goal: "maintain", pace: "standard" };
const female = { ...male, gender: "female" };

test("Mifflin-St Jeor: male 30 y, 80 kg, 180 cm → BMR 1780, TDEE 2759 at 1.55", () => {
  const bmr = bmrMifflinStJeor({ ...male, sex: "male" });
  assert.equal(bmr, 1780);
  close(calculateTDEE(bmr, "moderate"), 2759);
  const nutrition = calculateNutrition(male);
  assert.equal(nutrition.bmr, 1780);
  assert.equal(nutrition.tdee, 2759);
  assert.equal(nutrition.calories, 2760);
});

test("Mifflin-St Jeor: female path subtracts 161", () => {
  assert.equal(bmrMifflinStJeor({ ...female, sex: "female" }), 1614);
  const nutrition = calculateNutrition({ ...female, activityLevel: "sedentary" });
  assert.equal(nutrition.bmr, 1614);
  assert.equal(nutrition.tdee, 1937);
  assert.equal(nutrition.calories, 1940);
});

test("revised Harris-Benedict (Roza & Shizgal) for both sexes", () => {
  close(bmrHarrisBenedict({ ...male, sex: "male" }), 1853.632);
  close(bmrHarrisBenedict({ ...female, sex: "female" }), 1615.093);
  assert.equal(calculateNutrition({ ...male, bmrFormula: "harris" }).bmr, 1854);
});

test("Katch-McArdle uses lean body mass and requires body-fat %", () => {
  close(leanBodyMass(80, 20), 64);
  close(bmrKatchMcArdle({ weightKg: 80, bodyFatPercent: 20 }), 1752.4);
  assert.equal(calculateBMR({ ...male, bmrFormula: "katch", bodyFatPercent: "20" }), 1752.4);
  assert.throws(() => calculateBMR({ ...male, bmrFormula: "katch", bodyFatPercent: "" }), /body-fat %/);
  // Body fat alone does not switch the equation away from the default.
  assert.equal(calculateBMR({ ...male, bodyFatPercent: 20 }), 1780);
});

test("activity factors match the reference table", () => {
  const factors = ["sedentary", "light", "moderate", "active", "veryActive"].map((level) => calculateTDEE(1000, level));
  assert.deepEqual(factors.map((value) => Math.round(value * 1000) / 1000), [1200, 1375, 1550, 1725, 1900]);
  assert.throws(() => calculateTDEE(1000, "couch"), /Unsupported activity level/);
});

test("goal adjustments: ±250 mild, ±500 standard, rounded to the nearest 10 kcal", () => {
  const at = (goal, pace) => calculateNutrition({ ...male, goal, pace }).calories;
  assert.equal(at("lose", "standard"), 2260);
  assert.equal(at("lose", "mild"), 2510);
  assert.equal(at("maintain", "standard"), 2760);
  assert.equal(at("gain", "mild"), 3010);
  assert.equal(at("gain", "standard"), 3260);
  assert.equal(calculateNutrition({ ...male, goal: "lose" }).goalAdjustment, -500);
});

test("legacy slow/moderate/fast paces map onto mild/standard", () => {
  assert.equal(normalizeProfile({ pace: "slow" }).pace, "mild");
  assert.equal(normalizeProfile({ pace: "moderate" }).pace, "standard");
  assert.equal(normalizeProfile({ pace: "fast" }).pace, "standard");
  assert.equal(calculateNutrition({ ...male, goal: "lose", pace: "slow" }).goalAdjustment, -250);
  assert.equal(calculateNutrition({ ...male, goal: "lose", pace: "fast" }).goalAdjustment, -500);
});

test("deficit is capped at 25% of TDEE", () => {
  // Female 30 y, 60 kg, 165 cm, lightly active: TDEE ≈ 1815, 25% ≈ 454 < 500.
  const nutrition = calculateNutrition({
    age: 30, heightCm: 165, weightKg: 60, gender: "female", activityLevel: "light", goal: "lose", pace: "standard",
  });
  assert.equal(nutrition.tdee, 1815);
  assert.equal(nutrition.deficitCapApplied, true);
  assert.equal(nutrition.goalAdjustment, -454);
  assert.equal(nutrition.calories, 1360);
  assert.equal(nutrition.safetyFloorApplied, false);
  assert.ok((nutrition.tdee - nutrition.calories) / nutrition.tdee <= 0.251);
  assert.equal(calculateNutrition({ ...male, goal: "lose" }).deficitCapApplied, false);
});

test("safety floor clamps to 1200 kcal (female) and 1500 kcal (male)", () => {
  const small = { age: 70, heightCm: 150, weightKg: 45, activityLevel: "sedentary", goal: "lose", pace: "standard" };
  const woman = calculateNutrition({ ...small, gender: "female" });
  assert.equal(woman.calories, 1200);
  assert.equal(woman.safetyFloorApplied, true);
  const man = calculateNutrition({ ...small, gender: "male" });
  assert.equal(man.calories, 1500);
  assert.equal(man.safetyFloorApplied, true);
  assert.deepEqual(applyGoal({ tdee: 2000, goal: "maintain", sex: "female" }).safetyFloorApplied, false);
});

test("gender 'other' uses the explicitly chosen equation and its safety floor", () => {
  const other = { ...male, gender: "other" };
  assert.equal(calculateNutrition({ ...other, formulaSex: "female" }).bmr, 1614);
  assert.equal(calculateNutrition({ ...other, formulaSex: "male" }).bmr, 1780);
  assert.equal(calculateNutrition({ ...other, formulaSex: "female" }).safetyFloor, 1200);
  assert.throws(() => calculateNutrition(other), /Choose which equation/);
});

test("unit conversions use 1 lb = 0.453592 kg and 1 in = 2.54 cm", () => {
  close(lbToKg(1), 0.453592);
  close(kgToLb(0.453592), 1);
  close(feetInchesToCm(5, 11), 180.34);
  assert.deepEqual(cmToFeetInches(180), { feet: 5, inches: 11 });
  // 71.85 in rounds up to 72 → 6 ft 0 in, never "5 ft 12 in".
  assert.deepEqual(cmToFeetInches(182.5), { feet: 6, inches: 0 });
  // Imperial input converted to metric gives the same BMR as the metric input.
  const imperial = calculateBMR({ ...male, weightKg: lbToKg(176.37), heightCm: feetInchesToCm(5, 11) });
  close(imperial, 10 * lbToKg(176.37) + 6.25 * 180.34 - 150 + 5);
  close(imperial, 1782.1, 0.1);
});

test("macros: protein by activity and goal, fat 30%, carbs the remainder", () => {
  const maintain = calculateMacros(2760, 80, { activityLevel: "moderate", goal: "maintain" });
  assert.equal(maintain.proteinPerKg, 1.6);
  assert.deepEqual([maintain.protein, maintain.fat, maintain.carbs], [128, 92, 355]);
  const split = maintain.macroSplit;
  close(split.protein + split.carbs + split.fat, 1);
  assert.ok(split.fat >= 0.2 && split.fat <= 0.35);

  assert.equal(calculateMacros(2000, 80, { activityLevel: "sedentary", goal: "lose" }).protein, 64);
  assert.equal(calculateMacros(2400, 80, { activityLevel: "active", goal: "lose" }).protein, 160);

  const capped = calculateMacros(1200, 100, { activityLevel: "active", goal: "lose" });
  assert.equal(capped.proteinCapApplied, true);
  assert.deepEqual([capped.protein, capped.fat, capped.carbs], [105, 40, 105]);
});

test("macro energy adds back up to the calorie target", () => {
  for (const calories of [1200, 1500, 2000, 2760, 3500]) {
    for (const activityLevel of ["sedentary", "moderate", "veryActive"]) {
      const m = calculateMacros(calories, 70, { activityLevel, goal: "lose" });
      const kcal = m.protein * 4 + m.carbs * 4 + m.fat * 9;
      assert.ok(Math.abs(kcal - calories) <= 15, `${calories} kcal: macros sum to ${kcal}`);
      assert.ok(m.carbs > 0);
    }
  }
});

test("BMI uses WHO cut-offs and returns null instead of NaN", () => {
  assert.deepEqual(calculateBMI(80, 180), { value: 24.7, category: "healthy", label: "Healthy weight" });
  assert.equal(calculateBMI(18.4, 100).category, "underweight");
  assert.equal(calculateBMI(18.5, 100).category, "healthy");
  assert.equal(calculateBMI(25, 100).category, "overweight");
  assert.equal(calculateBMI(30, 100).category, "obese");
  assert.equal(calculateBMI(80, 0), null);
  assert.equal(calculateBMI("", ""), null);
});

test("validation rejects out-of-range and non-numeric inputs", () => {
  const errorsFor = (changes, options) => validateProfile({ ...male, ...changes }, options);
  assert.deepEqual(validateProfile(male), {});
  for (const age of [14, 81, 30.5, "", "abc", null]) assert.ok(errorsFor({ age }).age, `age ${age}`);
  for (const age of [15, 80]) assert.equal(errorsFor({ age }).age, undefined);
  for (const heightCm of [99, 251, "", NaN, Infinity]) assert.ok(errorsFor({ heightCm }).heightCm);
  for (const weightKg of [29.9, 301, "", -5]) assert.ok(errorsFor({ weightKg }).weightKg);
  for (const bodyFatPercent of [2, 61, "x"]) assert.ok(errorsFor({ bodyFatPercent }).bodyFatPercent);
  assert.equal(errorsFor({ bodyFatPercent: "" }).bodyFatPercent, undefined);
  assert.ok(errorsFor({ gender: "unknown" }).gender);
  assert.ok(errorsFor({ activityLevel: "" }).activityLevel);
  assert.ok(errorsFor({ goal: "bulk" }).goal);
  assert.match(errorsFor({ weightKg: 10 }, { units: "imperial" }).weightKg, /between 67 and 661 lb/);
  assert.match(errorsFor({ heightCm: 10 }, { units: "imperial" }).heightCm, /3 ft 4 in and 8 ft 2 in/);
  assert.deepEqual(Object.keys(errorsFor({ age: 5, weightKg: 5 }, { fields: ["age"] })), ["age"]);
});

test("calculateNutrition throws on invalid input instead of returning NaN", () => {
  assert.throws(() => calculateNutrition({ ...male, age: "not a number" }), /Age must be/);
  assert.throws(() => calculateNutrition({ ...male, weightKg: 0 }), /Weight must be/);
  assert.throws(() => calculateNutrition(null), RangeError);
  assert.throws(() => calculateMacros(0, 70), /Calories must be/);
});

test("every numeric output is finite and calories are multiples of 10", () => {
  for (const gender of ["male", "female"]) {
    for (const activityLevel of ["sedentary", "light", "moderate", "active", "veryActive"]) {
      for (const goal of ["lose", "maintain", "gain"]) {
        for (const pace of ["mild", "standard"]) {
          const result = calculateNutrition({ age: 45, heightCm: 170, weightKg: 75, gender, activityLevel, goal, pace });
          for (const key of ["bmr", "tdee", "calories", "protein", "carbs", "fat"]) {
            assert.ok(Number.isFinite(result[key]), `${key} is finite`);
          }
          assert.equal(result.calories % 10, 0);
        }
      }
    }
  }
});
