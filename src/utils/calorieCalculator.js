export const ACTIVITY_MULTIPLIERS = Object.freeze({
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
});

export const GOAL_ADJUSTMENTS = Object.freeze({
  lose: { slow: -300, moderate: -400, fast: -500 },
  maintain: { slow: 0, moderate: 0, fast: 0 },
  gain: { slow: 250, moderate: 350, fast: 500 },
});

function validatedMeasurements(profile) {
  if (!profile || typeof profile !== "object") {
    throw new TypeError("A profile with age, height, weight, and gender is required.");
  }
  const age = Number(profile.age);
  const heightCm = Number(profile.heightCm);
  const weightKg = Number(profile.weightKg);
  if (!Number.isFinite(age) || age <= 0) throw new RangeError("Age must be a positive number.");
  if (!Number.isFinite(heightCm) || heightCm <= 0) throw new RangeError("Height in centimeters must be a positive number.");
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new RangeError("Weight in kilograms must be a positive number.");
  if (!["male", "female", "other"].includes(profile.gender)) {
    throw new RangeError(`Unsupported gender: ${profile.gender}`);
  }
  return { age, heightCm, weightKg };
}

function bmrForGender({ age, heightCm, weightKg }, gender) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === "male") return base + 5;
  return base - 161;
}

export function calculateMacros(calories, weightKg, goal) {
  const dailyCalories = Number(calories);
  const bodyWeightKg = Number(weightKg);
  if (!Number.isFinite(dailyCalories) || dailyCalories < 0) {
    throw new RangeError("Calories must be a non-negative number.");
  }
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) throw new RangeError("Weight must be a positive number.");
  if (!["lose", "maintain", "gain"].includes(goal)) throw new RangeError(`Unsupported goal: ${goal}`);
  const desiredProtein = bodyWeightKg * (goal === "lose" ? 2 : 1.6);
  const proteinCap = dailyCalories * 0.35 / 4;
  const protein = Math.min(desiredProtein, proteinCap);
  const proteinCalories = protein * 4;
  const remainingCalories = Math.max(0, dailyCalories - proteinCalories);
  const carbs = remainingCalories * 0.55 / 4;
  const fat = remainingCalories * 0.45 / 9;
  const macroSplit = dailyCalories
    ? { protein: proteinCalories / dailyCalories, carbs: carbs * 4 / dailyCalories, fat: fat * 9 / dailyCalories }
    : { protein: 0, carbs: 0, fat: 0 };

  return {
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    macroSplit,
    proteinCapApplied: desiredProtein > proteinCap,
  };
}

export function calculateBMR(profile) {
  const measurements = validatedMeasurements(profile);
  if (profile.gender === "other") {
    return (bmrForGender(measurements, "male") + bmrForGender(measurements, "female")) / 2;
  }
  return bmrForGender(measurements, profile.gender);
}

export function calculateNutrition(profile) {
  const bmr = calculateBMR(profile);
  const activityFactor = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  if (!Number.isFinite(activityFactor)) throw new RangeError(`Unsupported activity level: ${profile.activityLevel}`);
  const tdee = Math.round(bmr * activityFactor);
  const pace = profile.pace ?? "moderate";
  const adjustment = GOAL_ADJUSTMENTS[profile.goal]?.[pace];
  if (adjustment === undefined) throw new RangeError(`Unsupported goal or pace: ${profile.goal}/${pace}`);
  const requestedCalories = tdee + adjustment;
  const safetyFloor = profile.gender === "male" ? 1500 : 1200;
  const safetyFloorApplied = requestedCalories < safetyFloor;
  const calories = safetyFloorApplied ? safetyFloor : requestedCalories;
  const macros = calculateMacros(calories, profile.weightKg, profile.goal);

  return {
    bmr,
    tdee,
    calories,
    ...macros,
    safetyFloorApplied,
    safetyFloor,
    goalAdjustment: adjustment,
  };
}
