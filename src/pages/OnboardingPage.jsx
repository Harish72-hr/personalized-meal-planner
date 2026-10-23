import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Info, Leaf, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createEmptyDraft, useProfile } from "../../context/ProfileContext.jsx";
import { usePlan } from "../../context/PlanContext.jsx";
import {
  ACTIVITY_LEVELS, GOAL_ADJUSTMENTS, INPUT_LIMITS, PACE_OPTIONS, calculateBMI, calculateNutrition, cmToFeetInches,
  feetInchesToCm, isMinor, kgToLb, lbToKg, normalizeProfile, validateProfile,
} from "../../utils/calorieCalculator.js";
import { ALLERGEN_OPTIONS } from "../../utils/mealEngine.js";
import { createRecipePlan } from "../../services/planRecipeService.js";
import ThemeToggle from "../common/ThemeToggle.jsx";
import { Field, RadioCards, UnitNumberInput } from "./FormControls.jsx";
import ResultsCard from "./ResultsCard.jsx";

const STEPS = [
  { group: "Personal info", title: "About you", subtitle: "A few basics to estimate how much energy your body uses." },
  { group: "Activity", title: "How active are you?", subtitle: "Pick the option that matches a typical week, not your best week." },
  { group: "Goal", title: "What’s your goal?", subtitle: "We’ll adjust your daily calories to match." },
  { group: "Results", title: "Your daily targets", subtitle: "Here’s your estimate. You can go back and change anything." },
  { group: "Preferences", title: "Food preferences", subtitle: "Tell us what you enjoy and how you like to cook." },
  { group: "Restrictions", title: "Restrictions", subtitle: "We’ll keep your plan aligned with your needs." },
  { group: "Review", title: "Review and confirm", subtitle: "Check your answers, then we’ll build your week." },
];
const RESULTS_STEP = 3;
const LAST_STEP = STEPS.length - 1;

const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];
const FORMULA_SEX_OPTIONS = [
  { value: "female", label: "Female equation", description: "Lower baseline, 1200 kcal minimum" },
  { value: "male", label: "Male equation", description: "Higher baseline, 1500 kcal minimum" },
];
const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LEVELS).map(([value, level]) => ({
  value, label: level.label, description: `${level.description} · ×${level.factor}`,
}));
const GOAL_OPTIONS = [
  { value: "lose", label: "Lose weight", description: "A steady calorie deficit" },
  { value: "maintain", label: "Maintain", description: "Eat at your estimated TDEE" },
  { value: "gain", label: "Gain weight", description: "A gradual calorie surplus" },
];
const CUISINES = ["North Indian", "South Indian", "Continental", "Asian", "No preference"];
const CONDITIONS = [
  ["diabetes", "Diabetes", "Lower-added-sugar meal choices"],
  ["high-bp", "High blood pressure", "Lower-sodium meal choices"],
  ["high-cholesterol", "High cholesterol", "Lower-sodium and moderate-fat choices"],
  ["pcos", "PCOS", "Lower-sugar meal choices"],
];
const STEP_FIELDS = {
  0: ["age", "gender", "formulaSex", "heightCm", "weightKg", "bodyFatPercent", "bmrFormula"],
  1: ["activityLevel"],
  2: ["goal"],
};
const NULLABLE_FIELDS = ["targetWeightKg", "bodyFatPercent"];

const round1 = (value) => Math.round(Number(value) * 10) / 10;
const splitTags = (text) => text.split(",").map((item) => item.trim()).filter(Boolean);

function stepErrors(step, draft) {
  const errors = {};
  if (step === 0 && !draft.name.trim()) errors.name = "Enter your name.";
  if (STEP_FIELDS[step]) Object.assign(errors, validateProfile(draft, { units: draft.units, fields: STEP_FIELDS[step] }));
  if (step === 2 && draft.goal !== "maintain" && draft.targetWeightKg !== "") {
    const target = Number(draft.targetWeightKg);
    const { min, max } = INPUT_LIMITS.weightKg;
    if (!Number.isFinite(target) || target < min || target > max) {
      errors.targetWeightKg = draft.units === "imperial"
        ? `Target weight must be between ${Math.ceil(kgToLb(min))} and ${Math.floor(kgToLb(max))} lb.`
        : `Target weight must be between ${min} and ${max} kg.`;
    } else if (draft.goal === "lose" && target >= Number(draft.weightKg)) {
      errors.targetWeightKg = "For weight loss, the target must be below your current weight.";
    } else if (draft.goal === "gain" && target <= Number(draft.weightKg)) {
      errors.targetWeightKg = "For weight gain, the target must be above your current weight.";
    }
  }
  if (step === 4) {
    if (!["vegetarian", "non-vegetarian", "vegan", "eggetarian"].includes(draft.dietType)) errors.dietType = "Choose a diet type.";
    if (!draft.cuisinePreferences.length) errors.cuisinePreferences = "Choose at least one cuisine or No preference.";
    if (![3, 4].includes(Number(draft.mealsPerDay))) errors.mealsPerDay = "Choose how many meals you want each day.";
    if (![15, 30, 60].includes(Number(draft.maxCookingTime))) errors.maxCookingTime = "Choose a maximum cooking time.";
  }
  return errors;
}

function firstInvalidStep(draft, upTo = LAST_STEP) {
  for (let step = 0; step <= upTo; step += 1) {
    if (Object.keys(stepErrors(step, draft)).length) return step;
  }
  return -1;
}

function formatHeight(draft) {
  if (draft.units !== "imperial") return `${round1(draft.heightCm)} cm`;
  const { feet, inches } = cmToFeetInches(Number(draft.heightCm));
  return `${feet} ft ${inches} in`;
}

function formatWeight(draft, kg = draft.weightKg) {
  return draft.units === "imperial" ? `${round1(kgToLb(Number(kg)))} lb` : `${round1(kg)} kg`;
}

function HeightFeetInches({ heightCm, error, onChange, onBlur }) {
  const initial = Number(heightCm) > 0 ? cmToFeetInches(Number(heightCm)) : null;
  const [feet, setFeet] = useState(initial ? String(initial.feet) : "");
  const [inches, setInches] = useState(initial ? String(initial.inches) : "");
  function change(nextFeet, nextInches) {
    setFeet(nextFeet);
    setInches(nextInches);
    if (nextFeet === "" && nextInches === "") return onChange("");
    const cm = feetInchesToCm(Number(nextFeet || 0), Number(nextInches || 0));
    return onChange(Number.isFinite(cm) ? cm : "");
  }
  return (
    <fieldset className={`field ${error ? "has-error" : ""}`} aria-describedby={error ? "height-error" : undefined} onBlur={onBlur}>
      <legend>Height</legend>
      <div className="imperial-height">
        <label><input type="number" inputMode="numeric" min="3" max="8" value={feet} aria-invalid={error ? true : undefined} onChange={(event) => change(event.target.value, inches)} /><span>ft</span></label>
        <label><input type="number" inputMode="decimal" min="0" max="11.9" step="0.5" value={inches} aria-invalid={error ? true : undefined} onChange={(event) => change(feet, event.target.value)} /><span>in</span></label>
      </div>
      {error && <p className="field-error" id="height-error">{error}</p>}
    </fieldset>
  );
}

function SummaryRow({ label, value, onEdit }) {
  return <div className="review-row"><span>{label}</span><strong>{value || "—"}</strong><button type="button" onClick={onEdit} aria-label={`Edit ${label}`}>Edit <ChevronRight size={13} /></button></div>;
}

export default function WizardPage() {
  const { profile, draft, setDraft, step: savedStep, setStep, setProfile, darkMode } = useProfile();
  const { setPlan, setGroceryChecks, favorites, onlineRecipes } = usePlan();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(() => Boolean(draft?.bodyFatPercent) || (draft?.bmrFormula ?? "mifflin") !== "mifflin");
  const step = Math.min(Math.max(Number(savedStep) || 0, 0), LAST_STEP);
  // Older drafts may lack new fields, hold legacy pace values, or store null for optional numbers.
  const normalizedDraft = useMemo(() => {
    const merged = { ...createEmptyDraft(), ...normalizeProfile(draft) };
    NULLABLE_FIELDS.forEach((field) => { if (merged[field] === null || merged[field] === undefined) merged[field] = ""; });
    return merged;
  }, [draft]);
  const errors = stepErrors(step, normalizedDraft);
  const calculatorReady = step >= RESULTS_STEP && firstInvalidStep(normalizedDraft, 2) === -1;
  const nutrition = useMemo(() => (calculatorReady ? calculateNutrition(normalizedDraft) : null), [calculatorReady, normalizedDraft]);
  const bmi = calculateBMI(normalizedDraft.weightKg, normalizedDraft.heightCm);
  const imperial = normalizedDraft.units === "imperial";
  const showError = (field) => ((attempted || touched[field]) ? errors[field] : undefined);
  const touch = (field) => () => setTouched((current) => ({ ...current, [field]: true }));

  function update(values) {
    setDraft((current) => ({ ...current, ...values }));
    setError("");
  }

  function goTo(targetStep) {
    setStep(targetStep);
    setAttempted(false);
    setTouched({});
    setError("");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo?.({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function focusFirstError() {
    requestAnimationFrame(() => document.querySelector(".wizard-card [aria-invalid='true'], .wizard-card .has-error input")?.focus());
  }

  function setUnits(units) {
    if (units === normalizedDraft.units) return;
    // Round to one decimal so switching back to metric shows tidy values.
    const tidy = (value) => (value === "" || !Number.isFinite(Number(value)) ? "" : round1(value));
    update({ units, heightCm: tidy(normalizedDraft.heightCm), weightKg: tidy(normalizedDraft.weightKg), targetWeightKg: tidy(normalizedDraft.targetWeightKg) });
  }

  function toggleCuisine(cuisine) {
    const current = normalizedDraft.cuisinePreferences;
    if (cuisine === "No preference") {
      update({ cuisinePreferences: ["No preference"] });
      return;
    }
    const withoutNoPreference = current.filter((item) => item !== "No preference");
    update({
      cuisinePreferences: withoutNoPreference.includes(cuisine)
        ? withoutNoPreference.filter((item) => item !== cuisine)
        : [...withoutNoPreference, cuisine],
    });
  }

  function toggleChip(field, value) {
    const selected = normalizedDraft[field];
    update({ [field]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] });
  }

  function addTags(field, inputField) {
    update({ [field]: [...new Set([...normalizedDraft[field], ...splitTags(normalizedDraft[inputField])])], [inputField]: "" });
  }

  function removeTag(field, value) {
    update({ [field]: normalizedDraft[field].filter((tag) => tag !== value) });
  }

  function next() {
    if (Object.keys(errors).length) {
      setAttempted(true);
      focusFirstError();
      return;
    }
    goTo(Math.min(step + 1, LAST_STEP));
  }

  function back() {
    goTo(Math.max(step - 1, 0));
  }

  async function generate() {
    const invalidStep = firstInvalidStep(normalizedDraft);
    if (invalidStep !== -1) {
      goTo(invalidStep);
      setAttempted(true);
      return;
    }
    setLoading(true);
    setError("");
    const completeProfile = {
      ...normalizedDraft,
      age: Number(normalizedDraft.age),
      heightCm: round1(normalizedDraft.heightCm),
      weightKg: round1(normalizedDraft.weightKg),
      bodyFatPercent: normalizedDraft.bodyFatPercent === "" ? null : Number(normalizedDraft.bodyFatPercent),
      formulaSex: normalizedDraft.gender === "other" ? normalizedDraft.formulaSex : "",
      targetWeightKg: normalizedDraft.goal === "maintain" || normalizedDraft.targetWeightKg === "" ? null : round1(normalizedDraft.targetWeightKg),
      mealsPerDay: Number(normalizedDraft.mealsPerDay),
      maxCookingTime: Number(normalizedDraft.maxCookingTime),
      allergies: [...new Set([...normalizedDraft.allergies, ...splitTags(normalizedDraft.allergyInput)])],
      dislikedFoods: [...new Set([...normalizedDraft.dislikedFoods, ...splitTags(normalizedDraft.dislikeInput)])],
    };
    try {
      const results = calculateNutrition(completeProfile);
      const plan = await createRecipePlan(completeProfile, results, favorites, { online: onlineRecipes });
      setProfile(completeProfile);
      setPlan(plan);
      setGroceryChecks([]);
      navigate("/dashboard", { replace: true });
    } catch (generationError) {
      console.error("Could not generate a meal plan.", generationError);
      setError("We couldn’t build your meal plan. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className={`loading-screen ${darkMode ? "theme-dark" : ""}`} role="status" aria-live="polite"><div className="loading-mark"><Leaf size={27} /></div><div className="loading-spinner" /><h1>Building your personalized week…</h1><p>Finding a week of meals that fits you.</p><div className="meal-skeletons" aria-hidden="true"><span /><span /><span /><span /></div></div>;
  }

  const dietLabel = { vegetarian: "Vegetarian", "non-vegetarian": "Non-vegetarian", vegan: "Vegan", eggetarian: "Eggetarian" }[normalizedDraft.dietType];
  const stepProgress = ((step + 1) / STEPS.length) * 100;
  const foodStepError = step === 4 && attempted ? Object.values(errors)[0] : "";
  const paceOptions = Object.entries(PACE_OPTIONS).map(([value, pace]) => ({
    value,
    label: pace.label,
    description: `${GOAL_ADJUSTMENTS[normalizedDraft.goal]?.[value] > 0 ? "+" : "−"}${Math.abs(GOAL_ADJUSTMENTS[normalizedDraft.goal]?.[value] ?? 0)} kcal/day · ${pace[normalizedDraft.goal] ?? ""}`,
  }));
  const formulaOptions = [
    { value: "mifflin", label: "Mifflin-St Jeor", description: "Recommended · most accurate for most adults" },
    { value: "harris", label: "Revised Harris-Benedict", description: "Older alternative · Roza & Shizgal, 1984" },
    { value: "katch", label: "Katch-McArdle", description: normalizedDraft.bodyFatPercent === "" ? "Enter body-fat % above to enable" : "Uses lean body mass · best if body fat was measured", disabled: normalizedDraft.bodyFatPercent === "" },
  ];

  return (
    <div className={`wizard-page ${darkMode ? "theme-dark" : ""}`}>
      <header className="wizard-header"><button className="brand wizard-brand" type="button" onClick={() => navigate(profile ? "/dashboard" : "/wizard")}><span className="brand-mark"><Leaf size={18} /></span><span>gather<span className="brand-period">.</span><small>MEAL PLANNER</small></span></button><div className="wizard-header-right"><span>YOUR PERSONAL PLAN</span><ThemeToggle /></div></header>
      <main className="wizard-main">
        <nav className="wizard-progress" aria-label="Progress">
          <div className="progress-meta"><span>Step {step + 1} of {STEPS.length}</span><span>{STEPS[step].group}</span></div>
          <div className="progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].group}`}><span style={{ width: `${stepProgress}%` }} /></div>
        </nav>
        <section className="wizard-card" key={step} aria-labelledby="wizard-step-title">
          <div className="wizard-card-heading"><span className="wizard-kicker"><span className="wizard-kicker-dot" /> {STEPS[step].group.toUpperCase()}</span><h1 id="wizard-step-title">{STEPS[step].title}</h1><p>{STEPS[step].subtitle}</p></div>

          {step === 0 && <div className="wizard-fields">
            <Field label="What should we call you?" error={showError("name")} className="full">
              {(props) => <input {...props} autoComplete="given-name" value={normalizedDraft.name} onChange={(event) => update({ name: event.target.value })} onBlur={touch("name")} placeholder="Your name" maxLength={60} />}
            </Field>
            <div className="field-row">
              <Field label="Age" unit="years" error={showError("age")} hint={`${INPUT_LIMITS.age.min}–${INPUT_LIMITS.age.max}`}>
                {(props) => <input {...props} type="number" inputMode="numeric" min={INPUT_LIMITS.age.min} max={INPUT_LIMITS.age.max} step="1" value={normalizedDraft.age} onChange={(event) => update({ age: event.target.value })} onBlur={touch("age")} placeholder="e.g. 28" />}
              </Field>
              <RadioCards name="gender" legend="Sex" layout="inline" options={SEX_OPTIONS} value={normalizedDraft.gender} onChange={(gender) => update({ gender })} error={attempted ? errors.gender : undefined} />
            </div>
            {isMinor(normalizedDraft.age) && <div className="notice notice-warning" role="status"><Info size={18} aria-hidden="true" /><p>These equations were developed for adults. For anyone under 18, growth needs vary a lot, so please use these numbers only as a rough guide and check with a doctor or registered dietitian.</p></div>}
            {normalizedDraft.gender === "other" && <RadioCards name="formulaSex" legend="Which equation should we use?" hint="The formulas were developed for female and male bodies. Pick the one closest to your current physiology, or ask your clinician." layout="grid" options={FORMULA_SEX_OPTIONS} value={normalizedDraft.formulaSex} onChange={(formulaSex) => update({ formulaSex })} error={attempted ? errors.formulaSex : undefined} />}

            <div className="unit-toggle" role="radiogroup" aria-label="Measurement units">
              {[["metric", "Metric", "cm · kg"], ["imperial", "Imperial", "ft / in · lb"]].map(([units, label, detail]) => (
                <button key={units} type="button" role="radio" aria-checked={normalizedDraft.units === units} className={normalizedDraft.units === units ? "selected" : ""} onClick={() => setUnits(units)}>{label} <span>{detail}</span></button>
              ))}
            </div>
            {imperial ? <div className="field-row" key="imperial">
              <HeightFeetInches heightCm={normalizedDraft.heightCm} error={attempted || touched.heightCm ? errors.heightCm : undefined} onBlur={touch("heightCm")} onChange={(heightCm) => update({ heightCm })} />
              <Field label="Weight" unit="lb" error={showError("weightKg")}>
                {(props) => <UnitNumberInput {...props} min="67" max="661" step="0.1" value={normalizedDraft.weightKg} toDisplay={kgToLb} fromDisplay={lbToKg} onChange={(weightKg) => update({ weightKg })} onBlur={touch("weightKg")} placeholder="e.g. 150" />}
              </Field>
            </div> : <div className="field-row" key="metric">
              <Field label="Height" unit="cm" error={showError("heightCm")}>
                {(props) => <input {...props} type="number" inputMode="decimal" min={INPUT_LIMITS.heightCm.min} max={INPUT_LIMITS.heightCm.max} step="0.1" value={normalizedDraft.heightCm} onChange={(event) => update({ heightCm: event.target.value })} onBlur={touch("heightCm")} placeholder="e.g. 165" />}
              </Field>
              <Field label="Weight" unit="kg" error={showError("weightKg")}>
                {(props) => <input {...props} type="number" inputMode="decimal" min={INPUT_LIMITS.weightKg.min} max={INPUT_LIMITS.weightKg.max} step="0.1" value={normalizedDraft.weightKg} onChange={(event) => update({ weightKg: event.target.value })} onBlur={touch("weightKg")} placeholder="e.g. 65" />}
              </Field>
            </div>}

            <div className="bmi-card" aria-live="polite">
              <div><span>BODY MASS INDEX</span><strong>{bmi && !errors.heightCm && !errors.weightKg ? bmi.value.toFixed(1) : "—"}</strong></div>
              {bmi && !errors.heightCm && !errors.weightKg ? <span className={`bmi-chip bmi-${bmi.category}`}>{bmi.label}</span> : <span className="bmi-placeholder">Enter height and weight</span>}
            </div>
            <p className="quiet-note">BMI is a rough screening tool only and doesn’t diagnose health conditions.</p>

            <details className="advanced-options" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
              <summary>Advanced options <span>body fat % and equation</span></summary>
              <div className="wizard-fields">
                <Field label="Body fat" unit="% · optional" error={showError("bodyFatPercent")} hint="Only if measured (e.g. DEXA, calipers, smart scale). Leave blank if unsure.">
                  {(props) => <input {...props} type="number" inputMode="decimal" min={INPUT_LIMITS.bodyFatPercent.min} max={INPUT_LIMITS.bodyFatPercent.max} step="0.1" value={normalizedDraft.bodyFatPercent} onChange={(event) => update({ bodyFatPercent: event.target.value, ...(event.target.value === "" && normalizedDraft.bmrFormula === "katch" ? { bmrFormula: "mifflin" } : {}) })} onBlur={touch("bodyFatPercent")} placeholder="e.g. 22" />}
                </Field>
                <RadioCards name="bmrFormula" legend="BMR equation" options={formulaOptions} value={normalizedDraft.bmrFormula} onChange={(bmrFormula) => update({ bmrFormula })} />
              </div>
            </details>
            <p className="quiet-note">Not suitable during pregnancy or breastfeeding, when energy needs are different.</p>
          </div>}

          {step === 1 && <div className="wizard-fields">
            <RadioCards name="activityLevel" legend="Your typical week" options={ACTIVITY_OPTIONS} value={normalizedDraft.activityLevel} onChange={(activityLevel) => update({ activityLevel })} error={attempted ? errors.activityLevel : undefined} />
            <p className="notice notice-info"><Info size={18} aria-hidden="true" /><span>Most people overestimate their activity. If you’re between two levels, choose the lower one. A desk job plus three gym sessions a week is usually “Lightly” or “Moderately active”.</span></p>
          </div>}

          {step === 2 && <div className="wizard-fields">
            <RadioCards name="goal" legend="Goal" layout="grid" options={GOAL_OPTIONS} value={normalizedDraft.goal} onChange={(goal) => update({ goal })} error={attempted ? errors.goal : undefined} />
            {normalizedDraft.goal !== "maintain" && <div className="goal-detail">
              <RadioCards name="pace" legend="Pace" layout="grid" options={paceOptions} value={normalizedDraft.pace} onChange={(pace) => update({ pace })} />
              <Field label="Target weight" unit={`${imperial ? "lb" : "kg"} · optional`} error={showError("targetWeightKg")}>
                {(props) => imperial
                  ? <UnitNumberInput {...props} key="lb" min="67" max="661" step="0.1" value={normalizedDraft.targetWeightKg} toDisplay={kgToLb} fromDisplay={lbToKg} onChange={(targetWeightKg) => update({ targetWeightKg })} onBlur={touch("targetWeightKg")} placeholder={normalizedDraft.goal === "lose" ? "Below your current weight" : "Above your current weight"} />
                  : <input {...props} type="number" inputMode="decimal" min={INPUT_LIMITS.weightKg.min} max={INPUT_LIMITS.weightKg.max} step="0.1" value={normalizedDraft.targetWeightKg} onChange={(event) => update({ targetWeightKg: event.target.value })} onBlur={touch("targetWeightKg")} placeholder={normalizedDraft.goal === "lose" ? "Below your current weight" : "Above your current weight"} />}
              </Field>
              <p className="quiet-note">Deficits are capped at 25% of your daily energy use, and targets never go below 1,200 kcal (female equation) or 1,500 kcal (male equation).</p>
            </div>}
          </div>}

          {step === RESULTS_STEP && (nutrition
            ? <ResultsCard profile={normalizedDraft} nutrition={nutrition} />
            : <div className="notice notice-warning" role="alert"><Info size={18} aria-hidden="true" /><p>Some details are missing. <button type="button" className="link-button" onClick={() => goTo(Math.max(firstInvalidStep(normalizedDraft, 2), 0))}>Go back and complete them</button> to see your results.</p></div>)}

          {step === 4 && <div className="wizard-fields">
            <fieldset className="field-set"><legend>How do you eat?</legend><div className="diet-options">{[["vegetarian","Vegetarian","Plant-forward, no meat or fish"],["non-vegetarian","Non-vegetarian","A little bit of everything"],["vegan","Vegan","Fully plant-based"],["eggetarian","Eggetarian","Vegetarian, with eggs"]].map(([key,title,description]) => <button type="button" key={key} className={`diet-option ${normalizedDraft.dietType === key ? "selected" : ""}`} onClick={() => update({ dietType: key })} aria-pressed={normalizedDraft.dietType === key}><span className="radio-dot" /><strong>{title}</strong><small>{description}</small></button>)}</div></fieldset>
            <fieldset className="field-set"><legend>Which cuisines do you enjoy? <span className="legend-hint">Choose as many as you like</span></legend><div className="chip-list">{CUISINES.map((cuisine) => <button type="button" key={cuisine} className={`select-chip ${normalizedDraft.cuisinePreferences.includes(cuisine) ? "selected" : ""}`} onClick={() => toggleCuisine(cuisine)} aria-pressed={normalizedDraft.cuisinePreferences.includes(cuisine)}>{normalizedDraft.cuisinePreferences.includes(cuisine) && <Check size={13} />}{cuisine}</button>)}</div></fieldset>
            <div className="field-row">
              <fieldset className="field"><legend>Meals each day</legend><div className="choice-row">{[3,4].map((count) => <button type="button" key={count} className={`choice-pill ${Number(normalizedDraft.mealsPerDay) === count ? "selected" : ""}`} onClick={() => update({ mealsPerDay: count })} aria-pressed={Number(normalizedDraft.mealsPerDay) === count}>{count} meals{count === 4 ? " + snack" : ""}</button>)}</div></fieldset>
              <fieldset className="field"><legend>Max cooking time</legend><div className="choice-row">{[15,30,60].map((minutes) => <button type="button" key={minutes} className={`choice-pill ${Number(normalizedDraft.maxCookingTime) === minutes ? "selected" : ""}`} onClick={() => update({ maxCookingTime: minutes })} aria-pressed={Number(normalizedDraft.maxCookingTime) === minutes}>{minutes} min</button>)}</div></fieldset>
            </div>
          </div>}

          {step === 5 && <div className="wizard-fields">
            <fieldset className="field-set"><legend>Any allergies or ingredients to avoid?</legend><div className="chip-list allergy-chips">{ALLERGEN_OPTIONS.map((allergen) => <button type="button" key={allergen} className={`select-chip ${normalizedDraft.allergies.includes(allergen) ? "selected" : ""}`} onClick={() => toggleChip("allergies", allergen)} aria-pressed={normalizedDraft.allergies.includes(allergen)}>{normalizedDraft.allergies.includes(allergen) && <Check size={13} />}{allergen}</button>)}</div></fieldset>
            <div className="tag-entry-row"><label className="field">Add another allergy <span className="field-unit">separate multiple with commas</span><div className="entry-with-button"><input value={normalizedDraft.allergyInput} onChange={(event) => update({ allergyInput: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTags("allergies", "allergyInput"); } }} placeholder="e.g. sesame" /><button type="button" onClick={() => addTags("allergies", "allergyInput")} aria-label="Add allergy"><Plus size={16} /></button></div></label></div>
            <div className="tag-cloud">{normalizedDraft.allergies.map((allergy) => <span className="tag" key={allergy}>{allergy}<button type="button" onClick={() => removeTag("allergies", allergy)} aria-label={`Remove ${allergy} allergy`}><X size={12} /></button></span>)}</div>
            <div className="tag-entry-row"><label className="field">Foods you dislike <span className="field-unit">separate multiple with commas</span><div className="entry-with-button"><input value={normalizedDraft.dislikeInput} onChange={(event) => update({ dislikeInput: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTags("dislikedFoods", "dislikeInput"); } }} placeholder="e.g. mushrooms, olives" /><button type="button" onClick={() => addTags("dislikedFoods", "dislikeInput")} aria-label="Add disliked foods"><Plus size={16} /></button></div></label></div>
            <div className="tag-cloud">{normalizedDraft.dislikedFoods.map((food) => <span className="tag tag-dislike" key={food}>{food}<button type="button" onClick={() => removeTag("dislikedFoods", food)} aria-label={`Remove ${food} dislike`}><X size={12} /></button></span>)}</div>
            <fieldset className="field-set"><legend>Anything you’d like us to consider? <span className="legend-hint">Optional</span></legend><div className="health-options">{CONDITIONS.map(([key,title,description]) => <button type="button" key={key} className={`health-option ${normalizedDraft.healthConditions.includes(key) ? "selected" : ""}`} onClick={() => toggleChip("healthConditions", key)} aria-pressed={normalizedDraft.healthConditions.includes(key)}><span className="check-square">{normalizedDraft.healthConditions.includes(key) && <Check size={12} />}</span><span><strong>{title}</strong><small>{description}</small></span></button>)}</div></fieldset>
            <p className="medical-note">These preferences only guide meal selection. This planner is not medical advice and does not replace care from a qualified health professional.</p>
          </div>}

          {step === LAST_STEP && <div className="review-content">
            <section className="review-section"><div className="review-section-title"><h2>Your profile</h2><span>Select Edit to make changes</span></div>
              <SummaryRow label="Name, age & sex" value={`${normalizedDraft.name}, ${normalizedDraft.age} · ${normalizedDraft.gender}${normalizedDraft.gender === "other" && normalizedDraft.formulaSex ? ` (${normalizedDraft.formulaSex} equation)` : ""}`} onEdit={() => goTo(0)} />
              <SummaryRow label="Height & weight" value={`${formatHeight(normalizedDraft)} · ${formatWeight(normalizedDraft)}${bmi ? ` · BMI ${bmi.value.toFixed(1)}` : ""}`} onEdit={() => goTo(0)} />
              <SummaryRow label="Activity" value={ACTIVITY_LEVELS[normalizedDraft.activityLevel]?.label} onEdit={() => goTo(1)} />
              <SummaryRow label="Goal" value={`${GOAL_OPTIONS.find(({ value }) => value === normalizedDraft.goal)?.label}${normalizedDraft.goal === "maintain" ? "" : ` · ${PACE_OPTIONS[normalizedDraft.pace].label.toLowerCase()} pace${normalizedDraft.targetWeightKg !== "" ? ` · target ${formatWeight(normalizedDraft, normalizedDraft.targetWeightKg)}` : ""}`}`} onEdit={() => goTo(2)} />
              {nutrition && <SummaryRow label="Daily target" value={`${nutrition.calories.toLocaleString()} kcal · P ${nutrition.protein} g · C ${nutrition.carbs} g · F ${nutrition.fat} g`} onEdit={() => goTo(RESULTS_STEP)} />}
              <SummaryRow label="Food preferences" value={`${dietLabel} · ${normalizedDraft.cuisinePreferences.join(", ")} · ${normalizedDraft.mealsPerDay} meals · max ${normalizedDraft.maxCookingTime} min`} onEdit={() => goTo(4)} />
              <SummaryRow label="Allergies" value={[...new Set([...normalizedDraft.allergies, ...splitTags(normalizedDraft.allergyInput)])].join(", ") || "None"} onEdit={() => goTo(5)} />
              <SummaryRow label="Disliked foods" value={[...new Set([...normalizedDraft.dislikedFoods, ...splitTags(normalizedDraft.dislikeInput)])].join(", ") || "None"} onEdit={() => goTo(5)} />
              <SummaryRow label="Health preferences" value={normalizedDraft.healthConditions.map((condition) => CONDITIONS.find(([key]) => key === condition)?.[1]).filter(Boolean).join(", ") || "None"} onEdit={() => goTo(5)} />
            </section>
            <div className="review-confirm"><div className="confirm-mark"><Check size={18} /></div><p>Your plan will include <strong>{Number(normalizedDraft.mealsPerDay)} meals a day</strong> and avoid your selected restrictions.</p></div>
          </div>}

          {(error || foodStepError) && <div className="inline-error" role="alert">{error || foodStepError}</div>}
          <div className="wizard-actions">
            <button className="back-button" type="button" onClick={back} disabled={step === 0}><ArrowLeft size={16} /> Back</button>
            <span className="autosave-note"><Check size={12} /> Progress saved automatically</span>
            {step < LAST_STEP
              ? <button className="button button-primary wizard-next" type="button" onClick={next}>{{ 2: "See my results", 5: "Review answers" }[step] ?? "Next"} <ArrowRight size={16} /></button>
              : <button className="button button-primary wizard-next" type="button" onClick={generate}>Generate my meal plan <ArrowRight size={16} /></button>}
          </div>
        </section>
        <footer className="wizard-footer"><span><Leaf size={13} /> Thoughtful food, tailored to you.</span><span>Private by design · Saved on this device</span></footer>
      </main>
    </div>
  );
}
