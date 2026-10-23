// Every number used by the calorie calculator lives here, with its source.
// Change values in this file only; calorieCalculator.js reads from it.

// Unit conversions — international yard and pound agreement (1959).
export const KG_PER_LB = 0.453592;
export const CM_PER_IN = 2.54;
export const IN_PER_FT = 12;

// BMR equations.
// Mifflin MD, St Jeor ST, et al. "A new predictive equation for resting energy expenditure in healthy
// individuals." Am J Clin Nutr. 1990;51(2):241-247. Default: most accurate for the general population
// (Frankenfield D, et al. J Am Diet Assoc. 2005;105(5):775-789).
export const MIFFLIN_ST_JEOR = Object.freeze({
  weight: 10, height: 6.25, age: -5, male: 5, female: -161,
});
// Roza AM, Shizgal HM. "The Harris Benedict equation reevaluated." Am J Clin Nutr. 1984;40(1):168-182.
export const HARRIS_BENEDICT_REVISED = Object.freeze({
  male: { constant: 88.362, weight: 13.397, height: 4.799, age: -5.677 },
  female: { constant: 447.593, weight: 9.247, height: 3.098, age: -4.330 },
});
// Katch-McArdle (McArdle WD, Katch FI, Katch VL. Exercise Physiology). Only valid with a measured body-fat %.
export const KATCH_MCARDLE = Object.freeze({ constant: 370, leanMass: 21.6 });

export const BMR_FORMULAS = Object.freeze({
  mifflin: { label: "Mifflin-St Jeor (1990)", short: "Mifflin-St Jeor" },
  harris: { label: "Revised Harris-Benedict (Roza & Shizgal, 1984)", short: "Revised Harris-Benedict" },
  katch: { label: "Katch-McArdle (uses body-fat %)", short: "Katch-McArdle" },
});
export const DEFAULT_BMR_FORMULA = "mifflin";

// Activity factors for TDEE = BMR × factor (McArdle, Katch & Katch; FAO/WHO/UNU 2004 PAL ranges).
export const ACTIVITY_LEVELS = Object.freeze({
  sedentary: { factor: 1.2, label: "Sedentary", description: "Little or no exercise · mostly sitting (desk job, driving)" },
  light: { factor: 1.375, label: "Lightly active", description: "Light exercise 1–3 days/week · e.g. walks or easy workouts" },
  moderate: { factor: 1.55, label: "Moderately active", description: "Moderate exercise 3–5 days/week · e.g. 45+ min sessions" },
  active: { factor: 1.725, label: "Very active", description: "Hard exercise 6–7 days/week" },
  veryActive: { factor: 1.9, label: "Extremely active", description: "Physical job plus training, or twice-daily training" },
});

// Goal adjustments in kcal/day. ~7,700 kcal ≈ 1 kg of body fat, so ±500 kcal/day ≈ ±0.5 kg/week
// (Hall KD, et al. Lancet. 2011;378(9793):826-837 notes this is an initial-rate approximation).
export const GOAL_ADJUSTMENTS = Object.freeze({
  lose: { mild: -250, standard: -500 },
  maintain: { mild: 0, standard: 0 },
  gain: { mild: 250, standard: 500 },
});
export const PACE_OPTIONS = Object.freeze({
  mild: { label: "Mild", lose: "~0.25 kg (0.5 lb) per week", gain: "~0.25 kg (0.5 lb) per week" },
  standard: { label: "Standard", lose: "~0.5 kg (1 lb) per week", gain: "~0.5 kg (1 lb) per week" },
});
export const DEFAULT_PACE = "standard";
// Saved profiles from earlier versions used three paces.
export const LEGACY_PACE_MAP = Object.freeze({ slow: "mild", moderate: "standard", fast: "standard" });
// A fixed deficit should not exceed ~25% of TDEE.
export const MAX_DEFICIT_FRACTION = 0.25;

// Minimum daily intake without medical supervision (NIH NHLBI, "Clinical Guidelines on the Identification,
// Evaluation, and Treatment of Overweight and Obesity in Adults", 1998).
export const SAFETY_FLOOR_KCAL = Object.freeze({ male: 1500, female: 1200 });

// Protein, g per kg bodyweight. 0.8 g/kg is the adult RDA (IOM DRI, 2005). 1.6–2.2 g/kg for exercising
// people: Jäger R, et al. "ISSN Position Stand: protein and exercise." J Int Soc Sports Nutr. 2017;14:20.
// The upper part of that range is used during a calorie deficit to help retain lean mass.
export const PROTEIN_G_PER_KG = Object.freeze({ sedentary: 0.8, active: 1.6, activeDeficit: 2.0 });
// Acceptable Macronutrient Distribution Ranges (IOM DRI, 2005): protein 10–35%, fat 20–35%.
export const PROTEIN_MAX_FRACTION = 0.35;
export const FAT_FRACTION = Object.freeze({ min: 0.20, default: 0.30, max: 0.35 });
// Atwater general factors, kcal per gram.
export const KCAL_PER_GRAM = Object.freeze({ protein: 4, carbs: 4, fat: 9 });

// BMI = kg / m². WHO adult categories (WHO Technical Report Series 894, 2000). Screening tool only.
export const BMI_CATEGORIES = Object.freeze([
  { max: 18.5, key: "underweight", label: "Underweight" },
  { max: 25, key: "healthy", label: "Healthy weight" },
  { max: 30, key: "overweight", label: "Overweight" },
  { max: Infinity, key: "obese", label: "Obesity" },
]);

// Input ranges accepted by the calculator (metric).
export const INPUT_LIMITS = Object.freeze({
  age: { min: 15, max: 80 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
  bodyFatPercent: { min: 3, max: 60 },
});
// The equations were validated in adults; show a note for anyone younger.
export const ADULT_AGE = 18;

// Results are estimates; show calories to the nearest 10 kcal.
export const CALORIE_ROUNDING = 10;
