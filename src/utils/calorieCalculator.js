import {
  ACTIVITY_LEVELS, ADULT_AGE, BMI_CATEGORIES, BMR_FORMULAS, CALORIE_ROUNDING, CM_PER_IN, DEFAULT_BMR_FORMULA,
  DEFAULT_PACE, FAT_FRACTION, GOAL_ADJUSTMENTS, HARRIS_BENEDICT_REVISED, IN_PER_FT, INPUT_LIMITS, KATCH_MCARDLE,
  KCAL_PER_GRAM, KG_PER_LB, LEGACY_PACE_MAP, MAX_DEFICIT_FRACTION, MIFFLIN_ST_JEOR, PACE_OPTIONS,
  PROTEIN_G_PER_KG, PROTEIN_MAX_FRACTION, SAFETY_FLOOR_KCAL,
} from "./nutritionConstants.js";

export { ACTIVITY_LEVELS, BMR_FORMULAS, GOAL_ADJUSTMENTS, INPUT_LIMITS, PACE_OPTIONS };
export const ACTIVITY_MULTIPLIERS = Object.freeze(Object.fromEntries(
  Object.entries(ACTIVITY_LEVELS).map(([key, level]) => [key, level.factor]),
));

const SEXES = ["male", "female"];
const GENDERS = ["male", "female", "other"];
const GOALS = ["lose", "maintain", "gain"];

// ---- Units -------------------------------------------------------------------------------------

export const lbToKg = (lb) => lb * KG_PER_LB;
export const kgToLb = (kg) => kg / KG_PER_LB;
export const inToCm = (inches) => inches * CM_PER_IN;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const feetInchesToCm = (feet, inches) => inToCm(feet * IN_PER_FT + inches);

export function cmToFeetInches(cm) {
  const totalInches = Math.round(cmToIn(cm));
  return { feet: Math.floor(totalInches / IN_PER_FT), inches: totalInches % IN_PER_FT };
}

export function roundTo(value, step) {
  return Math.round(value / step) * step;
}

// ---- Profile normalisation and validation --------------------------------------------------------

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  return Number(value);
}

function hasBodyFat(profile) {
  return Number.isFinite(toNumber(profile.bodyFatPercent));
}

// Returns the sex whose equation is used. "other" requires an explicit choice of equation.
export function formulaSexFor(profile) {
  if (SEXES.includes(profile?.gender)) return profile.gender;
  if (profile?.gender === "other" && SEXES.includes(profile.formulaSex)) return profile.formulaSex;
  return null;
}

// Fills defaults and maps values saved by older versions of the app.
export function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const pace = LEGACY_PACE_MAP[profile.pace] ?? (PACE_OPTIONS[profile.pace] ? profile.pace : DEFAULT_PACE);
  const bmrFormula = BMR_FORMULAS[profile.bmrFormula] ? profile.bmrFormula : DEFAULT_BMR_FORMULA;
  return { ...profile, pace, bmrFormula };
}

function inRange(value, { min, max }) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function rangeMessage(field, units) {
  const { min, max } = INPUT_LIMITS[field];
  if (units === "imperial" && field === "heightCm") {
    const low = cmToFeetInches(inToCm(Math.ceil(cmToIn(min))));
    const high = cmToFeetInches(inToCm(Math.floor(cmToIn(max))));
    return `Height must be between ${low.feet} ft ${low.inches} in and ${high.feet} ft ${high.inches} in.`;
  }
  if (units === "imperial" && field === "weightKg") {
    return `Weight must be between ${Math.ceil(kgToLb(min))} and ${Math.floor(kgToLb(max))} lb.`;
  }
  return {
    age: `Age must be a whole number between ${min} and ${max}.`,
    heightCm: `Height must be between ${min} and ${max} cm.`,
    weightKg: `Weight must be between ${min} and ${max} kg.`,
    bodyFatPercent: `Body fat must be between ${min}% and ${max}%.`,
  }[field];
}

// Returns { field: message } for every invalid field; an empty object means the profile is valid.
// `fields` limits the check to a subset (used by the wizard step by step).
export function validateProfile(profile, { units = "metric", fields } = {}) {
  const errors = {};
  if (!profile || typeof profile !== "object") return { profile: "A profile is required." };
  const check = (field) => !fields || fields.includes(field);
  const age = toNumber(profile.age);
  if (check("age") && !(inRange(age, INPUT_LIMITS.age) && Number.isInteger(age))) errors.age = rangeMessage("age");
  if (check("gender") && !GENDERS.includes(profile.gender)) errors.gender = "Choose an option.";
  if (check("formulaSex") && profile.gender === "other" && !SEXES.includes(profile.formulaSex)) {
    errors.formulaSex = "Choose which equation to use for your estimate.";
  }
  if (check("heightCm") && !inRange(toNumber(profile.heightCm), INPUT_LIMITS.heightCm)) {
    errors.heightCm = rangeMessage("heightCm", units);
  }
  if (check("weightKg") && !inRange(toNumber(profile.weightKg), INPUT_LIMITS.weightKg)) {
    errors.weightKg = rangeMessage("weightKg", units);
  }
  const bodyFatEntered = !["", null, undefined].includes(profile.bodyFatPercent);
  if (check("bodyFatPercent")) {
    if (bodyFatEntered && !inRange(toNumber(profile.bodyFatPercent), INPUT_LIMITS.bodyFatPercent)) {
      errors.bodyFatPercent = rangeMessage("bodyFatPercent");
    } else if (profile.bmrFormula === "katch" && !bodyFatEntered) {
      errors.bodyFatPercent = "Enter your body-fat % to use Katch-McArdle, or choose another equation.";
    }
  }
  if (check("bmrFormula") && profile.bmrFormula !== undefined && !BMR_FORMULAS[profile.bmrFormula]) {
    errors.bmrFormula = "Choose a supported equation.";
  }
  if (check("activityLevel") && !ACTIVITY_LEVELS[profile.activityLevel]) errors.activityLevel = "Choose your activity level.";
  if (check("goal") && !GOALS.includes(profile.goal)) errors.goal = "Choose a goal.";
  return errors;
}

const BMR_FIELDS = ["age", "gender", "formulaSex", "heightCm", "weightKg", "bodyFatPercent", "bmrFormula"];

function assertValid(profile, fields) {
  const errors = validateProfile(profile, { fields });
  const first = Object.values(errors)[0];
  if (first) throw new RangeError(first);
}

export function isMinor(age) {
  return Number.isFinite(toNumber(age)) && toNumber(age) < ADULT_AGE;
}

// ---- BMR -----------------------------------------------------------------------------------------

export function bmrMifflinStJeor({ weightKg, heightCm, age, sex }) {
  const c = MIFFLIN_ST_JEOR;
  return c.weight * weightKg + c.height * heightCm + c.age * age + c[sex];
}

export function bmrHarrisBenedict({ weightKg, heightCm, age, sex }) {
  const c = HARRIS_BENEDICT_REVISED[sex];
  return c.constant + c.weight * weightKg + c.height * heightCm + c.age * age;
}

export function leanBodyMass(weightKg, bodyFatPercent) {
  return weightKg * (1 - bodyFatPercent / 100);
}

export function bmrKatchMcArdle({ weightKg, bodyFatPercent }) {
  return KATCH_MCARDLE.constant + KATCH_MCARDLE.leanMass * leanBodyMass(weightKg, bodyFatPercent);
}

const BMR_FUNCTIONS = { mifflin: bmrMifflinStJeor, harris: bmrHarrisBenedict, katch: bmrKatchMcArdle };

export function calculateBMR(rawProfile) {
  const profile = normalizeProfile(rawProfile);
  assertValid(profile, BMR_FIELDS);
  const inputs = {
    age: toNumber(profile.age),
    heightCm: toNumber(profile.heightCm),
    weightKg: toNumber(profile.weightKg),
    bodyFatPercent: hasBodyFat(profile) ? toNumber(profile.bodyFatPercent) : undefined,
    sex: formulaSexFor(profile),
  };
  return BMR_FUNCTIONS[profile.bmrFormula](inputs);
}

// ---- TDEE, goal, safety floor ----------------------------------------------------------------------

export function calculateTDEE(bmr, activityLevel) {
  const level = ACTIVITY_LEVELS[activityLevel];
  if (!level) throw new RangeError(`Unsupported activity level: ${activityLevel}`);
  return bmr * level.factor;
}

export function applyGoal({ tdee, goal, pace = DEFAULT_PACE, sex }) {
  const requestedAdjustment = GOAL_ADJUSTMENTS[goal]?.[LEGACY_PACE_MAP[pace] ?? pace];
  if (requestedAdjustment === undefined) throw new RangeError(`Unsupported goal or pace: ${goal}/${pace}`);
  if (!SEXES.includes(sex)) throw new RangeError(`Unsupported sex for safety floor: ${sex}`);
  const maxDeficit = tdee * MAX_DEFICIT_FRACTION;
  const deficitCapApplied = requestedAdjustment < 0 && -requestedAdjustment > maxDeficit;
  const adjustment = deficitCapApplied ? -maxDeficit : requestedAdjustment;
  const target = roundTo(tdee + adjustment, CALORIE_ROUNDING);
  const safetyFloor = SAFETY_FLOOR_KCAL[sex];
  const safetyFloorApplied = target < safetyFloor;
  return {
    calories: safetyFloorApplied ? safetyFloor : target,
    requestedAdjustment,
    goalAdjustment: Math.round(adjustment),
    deficitCapApplied,
    safetyFloor,
    safetyFloorApplied,
  };
}

// ---- Macros ------------------------------------------------------------------------------------

export function proteinPerKgFor({ activityLevel, goal }) {
  if (activityLevel === "sedentary") return PROTEIN_G_PER_KG.sedentary;
  return goal === "lose" ? PROTEIN_G_PER_KG.activeDeficit : PROTEIN_G_PER_KG.active;
}

export function calculateMacros(calories, weightKg, { activityLevel = "moderate", goal = "maintain" } = {}) {
  const dailyCalories = Number(calories);
  const bodyWeightKg = Number(weightKg);
  if (!Number.isFinite(dailyCalories) || dailyCalories <= 0) throw new RangeError("Calories must be a positive number.");
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) throw new RangeError("Weight must be a positive number.");
  const proteinPerKg = proteinPerKgFor({ activityLevel, goal });
  const desiredProteinKcal = bodyWeightKg * proteinPerKg * KCAL_PER_GRAM.protein;
  const proteinKcal = Math.min(desiredProteinKcal, dailyCalories * PROTEIN_MAX_FRACTION);
  const fatKcal = dailyCalories * FAT_FRACTION.default;
  // Protein ≤ 35% and fat = 30%, so carbs are always ≥ 35% of calories.
  const carbsKcal = dailyCalories - proteinKcal - fatKcal;

  return {
    protein: Math.round(proteinKcal / KCAL_PER_GRAM.protein),
    carbs: Math.round(carbsKcal / KCAL_PER_GRAM.carbs),
    fat: Math.round(fatKcal / KCAL_PER_GRAM.fat),
    macroSplit: { protein: proteinKcal / dailyCalories, carbs: carbsKcal / dailyCalories, fat: fatKcal / dailyCalories },
    proteinPerKg,
    proteinCapApplied: desiredProteinKcal > proteinKcal,
  };
}

// ---- BMI ----------------------------------------------------------------------------------------

export function calculateBMI(weightKg, heightCm) {
  const kg = toNumber(weightKg);
  const metres = toNumber(heightCm) / 100;
  if (!(kg > 0) || !(metres > 0)) return null;
  const value = kg / metres ** 2;
  if (!Number.isFinite(value)) return null;
  const category = BMI_CATEGORIES.find(({ max }) => value < max);
  return { value: Math.round(value * 10) / 10, category: category.key, label: category.label };
}

// ---- Everything together ---------------------------------------------------------------------------

export function calculateNutrition(rawProfile) {
  const profile = normalizeProfile(rawProfile);
  assertValid(profile);
  const sex = formulaSexFor(profile);
  const weightKg = toNumber(profile.weightKg);
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const goal = applyGoal({ tdee, goal: profile.goal, pace: profile.pace, sex });
  const macros = calculateMacros(goal.calories, weightKg, profile);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    ...goal,
    ...macros,
    activityFactor: ACTIVITY_LEVELS[profile.activityLevel].factor,
    bmrFormula: profile.bmrFormula,
    formulaSex: sex,
    bmi: calculateBMI(weightKg, profile.heightCm),
  };
}
