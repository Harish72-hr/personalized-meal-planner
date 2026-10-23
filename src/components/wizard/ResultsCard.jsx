import { lazy, Suspense } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { ACTIVITY_LEVELS, BMR_FORMULAS, PACE_OPTIONS, kgToLb, leanBodyMass, roundTo } from "../../utils/calorieCalculator.js";
import {
  CALORIE_ROUNDING, FAT_FRACTION, HARRIS_BENEDICT_REVISED, KATCH_MCARDLE, MAX_DEFICIT_FRACTION, MIFFLIN_ST_JEOR, PROTEIN_MAX_FRACTION,
} from "../../utils/nutritionConstants.js";

const MacroDonut = lazy(() => import("../charts/MacroDonut.jsx"));

const kcal = (value) => Math.round(value).toLocaleString();
const approxKcal = (value) => roundTo(value, CALORIE_ROUNDING).toLocaleString();
const signed = (value) => `${value < 0 ? "−" : "+"} ${Math.abs(value)}`;
const one = (value) => (Math.round(Number(value) * 10) / 10).toLocaleString();

function bmrEquation(profile, nutrition) {
  const { age, heightCm, weightKg, bodyFatPercent } = profile;
  const sex = nutrition.formulaSex;
  if (nutrition.bmrFormula === "katch") {
    const lbm = leanBodyMass(Number(weightKg), Number(bodyFatPercent));
    return `${KATCH_MCARDLE.constant} + ${KATCH_MCARDLE.leanMass} × ${one(lbm)} kg lean mass (${one(weightKg)} kg × (1 − ${one(bodyFatPercent)}% body fat))`;
  }
  if (nutrition.bmrFormula === "harris") {
    const c = HARRIS_BENEDICT_REVISED[sex];
    return `${c.constant} + ${c.weight} × ${one(weightKg)} kg + ${c.height} × ${one(heightCm)} cm − ${-c.age} × ${age} years`;
  }
  const c = MIFFLIN_ST_JEOR;
  return `${c.weight} × ${one(weightKg)} kg + ${c.height} × ${one(heightCm)} cm − ${-c.age} × ${age} years ${signed(c[sex])}`;
}

function goalSentence(profile, nutrition) {
  if (profile.goal === "maintain") return "to maintain your current weight";
  const rate = PACE_OPTIONS[profile.pace]?.[profile.goal];
  if (nutrition.safetyFloorApplied || nutrition.deficitCapApplied) return `to ${profile.goal} weight gradually`;
  return `to ${profile.goal} ${rate}`;
}

export default function ResultsCard({ profile, nutrition }) {
  const activity = ACTIVITY_LEVELS[profile.activityLevel];
  const imperial = profile.units === "imperial";
  const macros = [
    { key: "protein", label: "Protein", grams: nutrition.protein, share: nutrition.macroSplit.protein },
    { key: "carbs", label: "Carbs", grams: nutrition.carbs, share: nutrition.macroSplit.carbs },
    { key: "fat", label: "Fat", grams: nutrition.fat, share: nutrition.macroSplit.fat },
  ];
  const bmi = nutrition.bmi;

  return (
    <section className="results-card" aria-labelledby="results-title">
      <div className="results-hero">
        <span className="results-eyebrow" id="results-title">Your daily calorie target</span>
        <strong className="results-number">{nutrition.calories.toLocaleString()}<small>kcal / day</small></strong>
        <p>{goalSentence(profile, nutrition)}</p>
      </div>

      {nutrition.safetyFloorApplied && <div className="notice notice-warning" role="alert"><AlertTriangle size={18} aria-hidden="true" /><p>
        <strong>Raised to the {nutrition.safetyFloor.toLocaleString()} kcal minimum.</strong> Your calculated target was lower than we recommend without medical supervision. Please talk to a doctor or registered dietitian before eating less than this.
      </p></div>}
      {nutrition.deficitCapApplied && <div className="notice notice-info" role="status"><Info size={18} aria-hidden="true" /><p>
        Your deficit was limited to {Math.round(MAX_DEFICIT_FRACTION * 100)}% of your daily energy use ({kcal(Math.abs(nutrition.goalAdjustment))} kcal instead of {Math.abs(nutrition.requestedAdjustment)} kcal) so it stays sustainable.
      </p></div>}
      {profile.goal === "lose" && nutrition.calories - nutrition.bmr > 1000 && <div className="notice notice-info" role="status"><Info size={18} aria-hidden="true" /><p>
        <strong>Does this look right?</strong> Your target is more than 1,000 kcal above your BMR. People often overestimate activity, so double-check your activity level.
      </p></div>}

      <dl className="results-stats">
        <div><dt>BMR <span>at rest</span></dt><dd>≈ {approxKcal(nutrition.bmr)} <small>kcal</small></dd></div>
        <div><dt>TDEE <span>with activity</span></dt><dd>≈ {approxKcal(nutrition.tdee)} <small>kcal</small></dd></div>
        <div><dt>Goal <span>adjustment</span></dt><dd>{nutrition.goalAdjustment === 0 ? "0" : signed(nutrition.goalAdjustment)} <small>kcal</small></dd></div>
      </dl>

      <div className="results-grid">
        <section className="results-panel" aria-labelledby="macros-title">
          <h3 id="macros-title">Macronutrients</h3>
          <div className="macro-summary">
            <Suspense fallback={<div className="macro-donut macro-loading" style={{ width: 168, height: 168 }}>Loading chart…</div>}>
              <MacroDonut nutrition={nutrition} size={168} />
            </Suspense>
            <ul className="macro-list">{macros.map((macro) => (
              <li key={macro.key}>
                <span className={`legend-swatch ${macro.key}-swatch`} aria-hidden="true" />
                <span>{macro.label}</span>
                <strong>{macro.grams} g</strong>
                <small>{Math.round(macro.share * 100)}%</small>
              </li>
            ))}</ul>
          </div>
        </section>
        <section className="results-panel" aria-labelledby="bmi-title">
          <h3 id="bmi-title">Body mass index</h3>
          {bmi ? <div className="bmi-result">
            <strong>{bmi.value.toFixed(1)}</strong>
            <span className={`bmi-chip bmi-${bmi.category}`}>{bmi.label}</span>
          </div> : <p>—</p>}
          <p className="panel-note">BMI is a rough screening tool. It doesn’t account for muscle, age, ethnicity or body shape, and it isn’t a diagnosis.</p>
        </section>
      </div>

      <details className="how-calculated">
        <summary>How is this calculated?</summary>
        <ol>
          <li><strong>Basal metabolic rate (BMR)</strong> — energy used at complete rest, using the {BMR_FORMULAS[nutrition.bmrFormula].label} equation
            {profile.gender === "other" && ` (${nutrition.formulaSex} version, as you chose)`}:
            <code>{bmrEquation(profile, nutrition)} = {kcal(nutrition.bmr)} kcal</code></li>
          <li><strong>Total daily energy expenditure (TDEE)</strong> — BMR × your activity factor ({activity.label}):
            <code>{kcal(nutrition.bmr)} × {activity.factor} = {kcal(nutrition.tdee)} kcal</code></li>
          <li><strong>Goal</strong> — {profile.goal === "maintain" ? "no change for maintenance" : `${signed(nutrition.requestedAdjustment)} kcal/day for your chosen pace`}
            {nutrition.deficitCapApplied && `, limited to ${Math.round(MAX_DEFICIT_FRACTION * 100)}% of TDEE`}
            {nutrition.safetyFloorApplied && `, then raised to the ${nutrition.safetyFloor.toLocaleString()} kcal minimum`}. Rounded to the nearest {CALORIE_ROUNDING} kcal: <code>{nutrition.calories.toLocaleString()} kcal</code></li>
          <li><strong>Macros</strong> — protein {nutrition.proteinPerKg} g per kg of body weight
            {imperial && ` (${one(nutrition.proteinPerKg / kgToLb(1))} g per lb)`}, up to {Math.round(PROTEIN_MAX_FRACTION * 100)}% of calories;
            fat {Math.round(FAT_FRACTION.default * 100)}% of calories; carbohydrates make up the rest. Protein and carbs have 4 kcal/g, fat 9 kcal/g.</li>
        </ol>
        <p className="panel-note">Sources: Mifflin-St Jeor (1990), Roza &amp; Shizgal (1984), Katch-McArdle, ISSN protein position stand (2017), IOM macronutrient ranges (2005), WHO BMI categories.</p>
      </details>

      <p className="disclaimer"><Info size={14} aria-hidden="true" /> These are estimates, not medical advice. Equations can be off by 10% or more for an individual and are not validated for people under 18 or during pregnancy or breastfeeding. Check with a doctor or registered dietitian for personal guidance.</p>
    </section>
  );
}
