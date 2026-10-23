import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTES, dailyProgress, entryRoute, goalExplanation, guardProfileRoute, hasMealPreferences, planIsOutdated,
} from "../src/utils/appFlow.js";
import { calculateNutrition } from "../src/utils/calorieCalculator.js";

const person = { name: "Sam", age: 30, heightCm: 180, weightKg: 80, gender: "male", activityLevel: "moderate", goal: "maintain", pace: "standard" };

test("a new user with no saved profile starts at onboarding", () => {
  assert.equal(entryRoute(null), ROUTES.onboarding);
  assert.equal(entryRoute(undefined), ROUTES.onboarding);
});

test("a returning user with a profile skips onboarding", () => {
  assert.equal(entryRoute(person), ROUTES.dashboard);
});

test("opening the dashboard without a profile redirects to onboarding", () => {
  assert.deepEqual(guardProfileRoute(null), { redirect: ROUTES.onboarding });
  assert.deepEqual(guardProfileRoute(person), { allow: true });
});

test("a saved profile that fails validation is asked to update instead of rendering", () => {
  const guard = guardProfileRoute({ ...person, age: 95 });
  assert.ok(guard.needsUpdate.age);
  assert.equal(guard.allow, undefined);
});

test("lose < maintain < gain for the same person", () => {
  const goalFor = (goal, pace = "standard") => calculateNutrition({ ...person, goal, pace }).calories;
  const maintain = goalFor("maintain");
  assert.ok(goalFor("lose") < maintain);
  assert.ok(goalFor("lose", "mild") < maintain);
  assert.ok(goalFor("lose") < goalFor("lose", "mild"));
  assert.ok(goalFor("gain") > maintain);
  assert.ok(goalFor("gain", "mild") > maintain);
  assert.ok(goalFor("gain") > goalFor("gain", "mild"));
  assert.deepEqual([goalFor("lose"), goalFor("lose", "mild"), maintain, goalFor("gain", "mild"), goalFor("gain")], [2260, 2510, 2760, 3010, 3260]);
});

test("loss goals sit below maintenance (TDEE) unless the safety floor is applied", () => {
  for (const activityLevel of ["sedentary", "light", "moderate", "active", "veryActive"]) {
    for (const profile of [person, { ...person, gender: "female", weightKg: 55, heightCm: 160, age: 60 }]) {
      const nutrition = calculateNutrition({ ...profile, activityLevel, goal: "lose" });
      if (!nutrition.safetyFloorApplied) assert.ok(nutrition.calories < nutrition.tdee, `${activityLevel}: ${nutrition.calories} < ${nutrition.tdee}`);
      const gain = calculateNutrition({ ...profile, activityLevel, goal: "gain" });
      assert.ok(gain.calories > gain.tdee);
    }
  }
});

test("deficit clamp and calorie floor", () => {
  const capped = calculateNutrition({ age: 30, heightCm: 165, weightKg: 60, gender: "female", activityLevel: "light", goal: "lose", pace: "standard" });
  assert.equal(capped.deficitCapApplied, true);
  assert.ok(capped.tdee - capped.calories <= capped.tdee * 0.25 + 5);
  const floored = calculateNutrition({ age: 70, heightCm: 150, weightKg: 45, gender: "female", activityLevel: "sedentary", goal: "lose", pace: "standard" });
  assert.equal(floored.calories, 1200);
  assert.equal(floored.safetyFloorApplied, true);
  assert.match(goalExplanation(floored, { goal: "lose", pace: "standard" }), /1,200 kcal minimum.*doctor or dietitian/);
  const flooredMan = calculateNutrition({ age: 70, heightCm: 150, weightKg: 45, gender: "male", activityLevel: "sedentary", goal: "lose", pace: "standard" });
  assert.equal(flooredMan.calories, 1500);
});

test("dashboard progress: goal, eaten, remaining, percent", () => {
  const today = dailyProgress(person, 1380.4);
  assert.deepEqual({ goal: today.goal, eaten: today.eaten, remaining: today.remaining, percent: today.percent, over: today.over },
    { goal: 2760, eaten: 1380, remaining: 1380, percent: 50, over: false });
  const over = dailyProgress(person, 3000);
  assert.equal(over.remaining, -240);
  assert.equal(over.over, true);
  assert.equal(over.percent, 100);
  assert.equal(dailyProgress(person, undefined).eaten, 0);
});

test("editing the profile changes the dashboard's daily goal", () => {
  const before = dailyProgress(person, 500);
  const edited = dailyProgress({ ...person, goal: "lose" }, 500);
  assert.equal(before.goal, 2760);
  assert.equal(edited.goal, 2260);
  assert.equal(edited.remaining, 1760);
  const lighter = dailyProgress({ ...person, weightKg: 70 }, 500);
  assert.ok(lighter.goal < before.goal);
});

test("goal explanation names maintenance and the goal", () => {
  const lose = calculateNutrition({ ...person, goal: "lose" });
  assert.equal(goalExplanation(lose, { goal: "lose", pace: "standard" }), "Your maintenance is about 2,760 kcal. To lose ~0.5 kg/week, your goal is 2,260 kcal.");
  const maintain = calculateNutrition(person);
  assert.match(goalExplanation(maintain, { goal: "maintain" }), /steady/);
});

test("meal preferences and outdated plans", () => {
  assert.equal(hasMealPreferences({ ...person, preferencesSet: false }), false);
  assert.equal(hasMealPreferences(person), true);
  assert.equal(hasMealPreferences(null), false);
  assert.equal(planIsOutdated({ targetCalories: 2760 }, { calories: 2260 }), true);
  assert.equal(planIsOutdated({ targetCalories: 2260 }, { calories: 2260 }), false);
  assert.equal(planIsOutdated({}, { calories: 2260 }), false);
});
