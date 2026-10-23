import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Leaf, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../context/ProfileContext.jsx";
import { usePlan } from "../../context/PlanContext.jsx";
import { ACTIVITY_MULTIPLIERS, calculateNutrition } from "../../utils/calorieCalculator.js";
import { ALLERGEN_OPTIONS } from "../../utils/mealEngine.js";
import { createRecipePlan } from "../../services/planRecipeService.js";
import ThemeToggle from "../common/ThemeToggle.jsx";

const MacroDonut = lazy(() => import("../charts/MacroDonut.jsx"));
const STEPS = [
  { title: "About you", subtitle: "Let’s start with the basics." },
  { title: "Body measurements", subtitle: "A couple of measurements help us personalize your nutrition." },
  { title: "Lifestyle and goal", subtitle: "Your routine and goal shape your daily targets." },
  { title: "Food preferences", subtitle: "Tell us what you enjoy and how you like to cook." },
  { title: "Restrictions", subtitle: "We’ll keep your plan aligned with your needs." },
  { title: "Review and confirm", subtitle: "Here’s your profile and estimated daily nutrition." },
];

const ACTIVITY_OPTIONS = [
  ["sedentary", "Mostly sitting", "0–1 exercise days/week · desk job, little planned activity"],
  ["light", "Light activity", "1–3 days/week · desk job + gym 3x/week fits here"],
  ["moderate", "Moderate activity", "4–5 days/week · regular workouts or active recreation"],
  ["active", "Very active", "6–7 days/week · hard training most days"],
  ["veryActive", "Athlete or physical job", "Daily strenuous training or a physically demanding job"],
];
const CUISINES = ["North Indian", "South Indian", "Continental", "Asian", "No preference"];
const CONDITIONS = [
  ["diabetes", "Diabetes", "Lower-added-sugar meal choices"],
  ["high-bp", "High blood pressure", "Lower-sodium meal choices"],
  ["high-cholesterol", "High cholesterol", "Lower-sodium and moderate-fat choices"],
  ["pcos", "PCOS", "Lower-sugar meal choices"],
];
const PACE_OPTIONS = [
  ["slow", "Slow", "Gentler adjustment"],
  ["moderate", "Moderate", "Steady adjustment"],
  ["fast", "Fast", "Largest adjustment within the app’s limits"],
];
const STEP_GROUPS = ["About you", "Measurements", "Lifestyle", "Preferences", "Restrictions", "Review"];

function asNumber(value) {
  return value === "" ? NaN : Number(value);
}

function getStepError(step, draft) {
  if (step === 0) {
    if (!draft.name.trim()) return "Enter your name to continue.";
    if (!Number.isFinite(asNumber(draft.age)) || Number(draft.age) < 10 || Number(draft.age) > 100) return "Age must be between 10 and 100.";
    if (!["male", "female", "other"].includes(draft.gender)) return "Choose a gender option.";
  }
  if (step === 1) {
    if (!Number.isFinite(asNumber(draft.heightCm)) || draft.heightCm < 100 || draft.heightCm > 250) return "Height must be between 100 and 250 cm.";
    if (!Number.isFinite(asNumber(draft.weightKg)) || draft.weightKg < 25 || draft.weightKg > 300) return "Weight must be between 25 and 300 kg.";
  }
  if (step === 2) {
    if (!ACTIVITY_OPTIONS.some(([key]) => key === draft.activityLevel)) return "Choose your activity level.";
    if (!["lose", "maintain", "gain"].includes(draft.goal)) return "Choose a goal.";
    if (draft.goal !== "maintain" && draft.targetWeightKg !== "") {
      const target = Number(draft.targetWeightKg);
      if (!Number.isFinite(target) || target < 25 || target > 300) return "Target weight must be between 25 and 300 kg.";
      if (draft.goal === "lose" && target >= Number(draft.weightKg)) return "For weight loss, target weight must be lower than your current weight.";
      if (draft.goal === "gain" && target <= Number(draft.weightKg)) return "For weight gain, target weight must be higher than your current weight.";
    }
  }
  if (step === 3) {
    if (!["vegetarian", "non-vegetarian", "vegan", "eggetarian"].includes(draft.dietType)) return "Choose a diet type.";
    if (!draft.cuisinePreferences.length) return "Choose at least one cuisine or No preference.";
    if (![3, 4].includes(Number(draft.mealsPerDay))) return "Choose how many meals you want each day.";
    if (![15, 30, 60].includes(Number(draft.maxCookingTime))) return "Choose a maximum cooking time.";
  }
  return "";
}

function heightDisplay(draft) {
  const inches = Number(draft.heightCm || 0) / 2.54;
  return { feet: Math.floor(inches / 12), inches: Math.round(inches % 12) };
}

function SummaryRow({ label, value, onEdit }) {
  return <div className="review-row"><span>{label}</span><strong>{value || "—"}</strong><button type="button" onClick={onEdit}>Edit <ChevronRight size={13} /></button></div>;
}

export default function WizardPage() {
  const { profile, draft, setDraft, step, setStep, setProfile, darkMode } = useProfile();
  const { setPlan, setGroceryChecks, favorites, onlineRecipes } = usePlan();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Analyzing your profile…");
  const normalizedDraft = useMemo(() => {
    if (!draft || !profile) return draft;
    return draft;
  }, [draft, profile]);
  const currentError = getStepError(step, normalizedDraft);
  const nutrition = useMemo(() => {
    if (step !== 5 || currentError) return null;
    return calculateNutrition(normalizedDraft);
  }, [step, currentError, normalizedDraft]);

  function update(values) {
    setDraft((current) => ({ ...current, ...values }));
    setError("");
  }

  function goToReviewEdit(targetStep) {
    setStep(targetStep);
    setError("");
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
    const values = normalizedDraft[inputField].split(",").map((item) => item.trim()).filter(Boolean);
    update({ [field]: [...new Set([...normalizedDraft[field], ...values])], [inputField]: "" });
  }

  function removeTag(field, value) {
    update({ [field]: normalizedDraft[field].filter((tag) => tag !== value) });
  }

  function next() {
    const validation = getStepError(step, normalizedDraft);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setStep(Math.min(step + 1, 5));
  }

  function back() {
    setError("");
    setStep(Math.max(step - 1, 0));
  }

  async function generate() {
    const validation = getStepError(0, normalizedDraft) || getStepError(1, normalizedDraft) ||
      getStepError(2, normalizedDraft) || getStepError(3, normalizedDraft);
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    setLoadingText("Building your personalized week…");
    setError("");
    const completeProfile = {
      ...normalizedDraft,
      age: Number(normalizedDraft.age),
      heightCm: Number(normalizedDraft.heightCm),
      weightKg: Number(normalizedDraft.weightKg),
      targetWeightKg: normalizedDraft.targetWeightKg === "" ? null : Number(normalizedDraft.targetWeightKg),
      mealsPerDay: Number(normalizedDraft.mealsPerDay),
      maxCookingTime: Number(normalizedDraft.maxCookingTime),
      allergies: [...new Set([...normalizedDraft.allergies, ...normalizedDraft.allergyInput.split(",").map((item) => item.trim()).filter(Boolean)])],
      dislikedFoods: [...new Set([...normalizedDraft.dislikedFoods, ...normalizedDraft.dislikeInput.split(",").map((item) => item.trim()).filter(Boolean)])],
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
    return <div className={`loading-screen ${darkMode ? "theme-dark" : ""}`} role="status" aria-live="polite"><div className="loading-mark"><Leaf size={27} /></div><div className="loading-spinner" /><h1>{loadingText}</h1><p>Finding a week of meals that fits you.</p><div className="meal-skeletons" aria-hidden="true"><span /><span /><span /><span /></div></div>;
  }

  const ftIn = heightDisplay(normalizedDraft);
  const bmi = Number(normalizedDraft.weightKg) / ((Number(normalizedDraft.heightCm) / 100) ** 2);
  const bmiCategory = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy range" : bmi < 30 ? "Overweight" : "Obesity range";
  const dietLabel = { vegetarian: "Vegetarian", "non-vegetarian": "Non-vegetarian", vegan: "Vegan", eggetarian: "Eggetarian" }[normalizedDraft.dietType];
  const stepProgress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className={`wizard-page ${darkMode ? "theme-dark" : ""}`}>
      <header className="wizard-header"><button className="brand wizard-brand" type="button" onClick={() => navigate(profile ? "/dashboard" : "/wizard")}><span className="brand-mark"><Leaf size={18} /></span><span>gather<span className="brand-period">.</span><small>MEAL PLANNER</small></span></button><div className="wizard-header-right"><span>YOUR PERSONAL PLAN</span><ThemeToggle /></div></header>
      <main className="wizard-main">
        <div className="wizard-progress">        <div className="progress-meta"><span>Step {step + 1} of 6</span><span>{STEP_GROUPS[step]}</span></div><div className="progress-track" role="progressbar" aria-valuemin="1" aria-valuemax="6" aria-valuenow={step + 1} aria-label={`Step ${step + 1} of 6`}><span style={{ width: `${stepProgress}%` }} /></div></div>
        <section className="wizard-card" key={step}>
          <div className="wizard-card-heading"><span className="wizard-kicker"><span className="wizard-kicker-dot" /> A FEW QUICK QUESTIONS</span><h1>{STEPS[step].title}</h1><p>{STEPS[step].subtitle}</p></div>

          {step === 0 && <div className="wizard-fields">
            <label className="field full">What should we call you?<input autoFocus autoComplete="given-name" value={normalizedDraft.name} onChange={(event) => update({ name: event.target.value })} placeholder="Your name" maxLength={60} /></label>
            <div className="field-row">
              <label className="field">Age<input type="number" min="10" max="100" value={normalizedDraft.age} onChange={(event) => update({ age: event.target.value })} placeholder="e.g. 28" /></label>
              <fieldset className="field gender-field"><legend>Gender</legend><div className="choice-row">{[["female","Female"],["male","Male"],["other","Other"]].map(([key,label]) => <button key={key} type="button" className={`choice-pill ${normalizedDraft.gender === key ? "selected" : ""}`} onClick={() => update({ gender: key })} aria-pressed={normalizedDraft.gender === key}>{label}</button>)}</div></fieldset>
            </div>
          </div>}

          {step === 1 && <div className="wizard-fields">
            <div className="unit-toggle" role="group" aria-label="Measurement units"><button className={normalizedDraft.units === "metric" ? "selected" : ""} type="button" onClick={() => update({ units: "metric" })}>Metric <span>cm · kg</span></button><button className={normalizedDraft.units === "imperial" ? "selected" : ""} type="button" onClick={() => update({ units: "imperial" })}>Imperial <span>ft / in · lb</span></button></div>
            {normalizedDraft.units === "metric" ? <div className="field-row">
              <label className="field">Height <span className="field-unit">cm</span><input type="number" min="100" max="250" step="0.1" value={normalizedDraft.heightCm} onChange={(event) => update({ heightCm: event.target.value })} placeholder="165" /></label>
              <label className="field">Weight <span className="field-unit">kg</span><input type="number" min="25" max="300" step="0.1" value={normalizedDraft.weightKg} onChange={(event) => update({ weightKg: event.target.value })} placeholder="65" /></label>
            </div> : <div className="field-row imperial-fields">
              <fieldset className="field"><legend>Height</legend><div className="imperial-height"><label><input aria-label="Height feet" type="number" min="3" max="8" value={ftIn.feet || ""} onChange={(event) => { const inches = Number(event.target.value || 0) * 12 + ftIn.inches; update({ heightCm: Math.round(inches * 2.54 * 10) / 10 }); }} /><span>ft</span></label><label><input aria-label="Height inches" type="number" min="0" max="11" value={ftIn.inches || ""} onChange={(event) => { const inches = ftIn.feet * 12 + Number(event.target.value || 0); update({ heightCm: Math.round(inches * 2.54 * 10) / 10 }); }} /><span>in</span></label></div></fieldset>
              <label className="field">Weight <span className="field-unit">lb</span><input type="number" min="55" max="661" step="0.1" value={normalizedDraft.weightKg ? Math.round(Number(normalizedDraft.weightKg) * 2.20462262 * 10) / 10 : ""} onChange={(event) => update({ weightKg: event.target.value ? Math.round(Number(event.target.value) / 2.20462262 * 10) / 10 : "" })} placeholder="143" /></label>
            </div>}
            <div className="bmi-card" aria-live="polite"><div className="bmi-symbol">↗</div><div><span>YOUR BODY MASS INDEX</span><strong>{Number.isFinite(bmi) && Number(normalizedDraft.heightCm) > 0 && Number(normalizedDraft.weightKg) > 0 ? bmi.toFixed(1) : "—"}</strong></div><div className="bmi-category">{Number.isFinite(bmi) && Number(normalizedDraft.heightCm) > 0 && Number(normalizedDraft.weightKg) > 0 ? bmiCategory : "Enter your measurements"}</div></div>
            <p className="quiet-note">BMI is a general screening measure and does not diagnose health conditions.</p>
          </div>}

          {step === 2 && <div className="wizard-fields">
            <fieldset className="field-set"><legend>How active are you on a typical week?</legend><div className="activity-list">{ACTIVITY_OPTIONS.map(([key,title,description]) => <button type="button" key={key} className={`activity-option ${normalizedDraft.activityLevel === key ? "selected" : ""}`} onClick={() => update({ activityLevel: key })} aria-pressed={normalizedDraft.activityLevel === key}><span className="radio-dot" /><span><strong>{title}</strong><small>{description}</small></span>{normalizedDraft.activityLevel === key && <Check size={16} />}</button>)}</div><p className="activity-estimate-note">Most people overestimate their activity level. Count planned exercise and your typical daily movement honestly.</p></fieldset>
            <fieldset className="field-set goal-set"><legend>What’s your goal?</legend><div className="goal-options">{[["lose","Lose weight","A gentle, steady deficit"],["maintain","Maintain","Support your current weight"],["gain","Gain weight","A gradual calorie surplus"]].map(([key,title,description]) => <button type="button" key={key} className={`goal-option ${normalizedDraft.goal === key ? "selected" : ""}`} onClick={() => update({ goal: key })} aria-pressed={normalizedDraft.goal === key}><span className="radio-dot" /><strong>{title}</strong><small>{description}</small></button>)}</div></fieldset>
            {normalizedDraft.goal !== "maintain" && <div className="goal-detail">
              <label className="field">Target weight <span className="field-unit">{normalizedDraft.units === "imperial" ? "lb" : "kg"} · optional</span><input type="number" min={normalizedDraft.units === "imperial" ? 55 : 25} max={normalizedDraft.units === "imperial" ? 661 : 300} step="0.1" value={normalizedDraft.targetWeightKg === "" ? "" : normalizedDraft.units === "imperial" ? Math.round(Number(normalizedDraft.targetWeightKg) * 2.20462262 * 10) / 10 : normalizedDraft.targetWeightKg} onChange={(event) => update({ targetWeightKg: event.target.value ? normalizedDraft.units === "imperial" ? Math.round(Number(event.target.value) / 2.20462262 * 10) / 10 : event.target.value : "" })} placeholder={normalizedDraft.goal === "lose" ? "Optional, below current weight" : "Optional, above current weight"} /></label>
              <fieldset className="field"><legend>Preferred pace</legend><div className="pace-row">{PACE_OPTIONS.map(([key,title,description]) => <button type="button" title={description} key={key} className={`choice-pill ${normalizedDraft.pace === key ? "selected" : ""}`} onClick={() => update({ pace: key })} aria-pressed={normalizedDraft.pace === key}>{title}</button>)}</div></fieldset>
            </div>}
          </div>}

          {step === 3 && <div className="wizard-fields">
            <fieldset className="field-set"><legend>How do you eat?</legend><div className="diet-options">{[["vegetarian","Vegetarian","Plant-forward, no meat or fish"],["non-vegetarian","Non-vegetarian","A little bit of everything"],["vegan","Vegan","Fully plant-based"],["eggetarian","Eggetarian","Vegetarian, with eggs"]].map(([key,title,description]) => <button type="button" key={key} className={`diet-option ${normalizedDraft.dietType === key ? "selected" : ""}`} onClick={() => update({ dietType: key })} aria-pressed={normalizedDraft.dietType === key}><span className="radio-dot" /><strong>{title}</strong><small>{description}</small></button>)}</div></fieldset>
            <fieldset className="field-set"><legend>Which cuisines do you enjoy? <span className="legend-hint">Choose as many as you like</span></legend><div className="chip-list">{CUISINES.map((cuisine) => <button type="button" key={cuisine} className={`select-chip ${normalizedDraft.cuisinePreferences.includes(cuisine) ? "selected" : ""}`} onClick={() => toggleCuisine(cuisine)} aria-pressed={normalizedDraft.cuisinePreferences.includes(cuisine)}>{normalizedDraft.cuisinePreferences.includes(cuisine) && <Check size={13} />}{cuisine}</button>)}</div></fieldset>
            <div className="field-row">
              <fieldset className="field"><legend>Meals each day</legend><div className="choice-row">{[3,4].map((count) => <button type="button" key={count} className={`choice-pill ${Number(normalizedDraft.mealsPerDay) === count ? "selected" : ""}`} onClick={() => update({ mealsPerDay: count })} aria-pressed={Number(normalizedDraft.mealsPerDay) === count}>{count} meals{count === 4 ? " + snack" : ""}</button>)}</div></fieldset>
              <fieldset className="field"><legend>Max cooking time</legend><div className="choice-row">{[15,30,60].map((minutes) => <button type="button" key={minutes} className={`choice-pill ${Number(normalizedDraft.maxCookingTime) === minutes ? "selected" : ""}`} onClick={() => update({ maxCookingTime: minutes })} aria-pressed={Number(normalizedDraft.maxCookingTime) === minutes}>{minutes} min</button>)}</div></fieldset>
            </div>
          </div>}

          {step === 4 && <div className="wizard-fields">
            <fieldset className="field-set"><legend>Any allergies or ingredients to avoid?</legend><div className="chip-list allergy-chips">{ALLERGEN_OPTIONS.map((allergen) => <button type="button" key={allergen} className={`select-chip ${normalizedDraft.allergies.includes(allergen) ? "selected" : ""}`} onClick={() => toggleChip("allergies", allergen)} aria-pressed={normalizedDraft.allergies.includes(allergen)}>{normalizedDraft.allergies.includes(allergen) && <Check size={13} />}{allergen}</button>)}</div></fieldset>
            <div className="tag-entry-row"><label className="field">Add another allergy <span className="field-unit">separate multiple with commas</span><div className="entry-with-button"><input value={normalizedDraft.allergyInput} onChange={(event) => update({ allergyInput: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTags("allergies", "allergyInput"); } }} placeholder="e.g. sesame" /><button type="button" onClick={() => addTags("allergies", "allergyInput")} aria-label="Add allergy"><Plus size={16} /></button></div></label></div>
            <div className="tag-cloud">{normalizedDraft.allergies.map((allergy) => <span className="tag" key={allergy}>{allergy}<button type="button" onClick={() => removeTag("allergies", allergy)} aria-label={`Remove ${allergy} allergy`}><X size={12} /></button></span>)}</div>
            <div className="tag-entry-row"><label className="field">Foods you dislike <span className="field-unit">separate multiple with commas</span><div className="entry-with-button"><input value={normalizedDraft.dislikeInput} onChange={(event) => update({ dislikeInput: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTags("dislikedFoods", "dislikeInput"); } }} placeholder="e.g. mushrooms, olives" /><button type="button" onClick={() => addTags("dislikedFoods", "dislikeInput")} aria-label="Add disliked foods"><Plus size={16} /></button></div></label></div>
            <div className="tag-cloud">{normalizedDraft.dislikedFoods.map((food) => <span className="tag tag-dislike" key={food}>{food}<button type="button" onClick={() => removeTag("dislikedFoods", food)} aria-label={`Remove ${food} dislike`}><X size={12} /></button></span>)}</div>
            <fieldset className="field-set"><legend>Anything you’d like us to consider? <span className="legend-hint">Optional</span></legend><div className="health-options">{CONDITIONS.map(([key,title,description]) => <button type="button" key={key} className={`health-option ${normalizedDraft.healthConditions.includes(key) ? "selected" : ""}`} onClick={() => toggleChip("healthConditions", key)} aria-pressed={normalizedDraft.healthConditions.includes(key)}><span className="check-square">{normalizedDraft.healthConditions.includes(key) && <Check size={12} />}</span><span><strong>{title}</strong><small>{description}</small></span></button>)}</div></fieldset>
            <p className="medical-note">These preferences only guide meal selection. This planner is not medical advice and does not replace care from a qualified health professional.</p>
          </div>}

          {step === 5 && nutrition && <div className="review-content">
            <div className="review-columns"><section className="review-section"><div className="review-section-title"><h2>Your profile</h2><span>Tap Edit to make changes</span></div>
              <SummaryRow label="Name, age & gender" value={`${normalizedDraft.name}, ${normalizedDraft.age} · ${normalizedDraft.gender}`} onEdit={() => goToReviewEdit(0)} />
              <SummaryRow label="Height & weight" value={`${Number(normalizedDraft.heightCm).toFixed(0)} cm · ${Number(normalizedDraft.weightKg).toFixed(1)} kg · BMI ${Number.isFinite(bmi) ? bmi.toFixed(1) : "—"}`} onEdit={() => goToReviewEdit(1)} />
              <SummaryRow label="Activity & goal" value={`${ACTIVITY_OPTIONS.find(([key]) => key === normalizedDraft.activityLevel)?.[1]} · ${normalizedDraft.goal}${normalizedDraft.goal === "maintain" ? "" : `, ${normalizedDraft.pace} pace${normalizedDraft.targetWeightKg ? `, target ${normalizedDraft.targetWeightKg} kg` : ""}`}`} onEdit={() => goToReviewEdit(2)} />
              <SummaryRow label="Food preferences" value={`${dietLabel} · ${normalizedDraft.cuisinePreferences.join(", ")} · ${normalizedDraft.mealsPerDay} meals · max ${normalizedDraft.maxCookingTime} min`} onEdit={() => goToReviewEdit(3)} />
              <SummaryRow label="Allergies" value={[...new Set([...normalizedDraft.allergies, ...normalizedDraft.allergyInput.split(",").map((x) => x.trim()).filter(Boolean)])].join(", ") || "None"} onEdit={() => goToReviewEdit(4)} />
              <SummaryRow label="Disliked foods" value={[...new Set([...normalizedDraft.dislikedFoods, ...normalizedDraft.dislikeInput.split(",").map((x) => x.trim()).filter(Boolean)])].join(", ") || "None"} onEdit={() => goToReviewEdit(4)} />
              <SummaryRow label="Health preferences" value={normalizedDraft.healthConditions.map((condition) => CONDITIONS.find(([key]) => key === condition)?.[1]).filter(Boolean).join(", ") || "None"} onEdit={() => goToReviewEdit(4)} />
            </section><section className="review-section nutrition-preview"><div className="review-section-title"><h2>Your daily targets</h2><span>Estimated</span></div><div className="nutrition-preview-inner"><Suspense fallback={<div className="macro-loading">Loading macro chart…</div>}><MacroDonut nutrition={nutrition} compact /></Suspense><div className="target-legend"><div><span className="legend-swatch protein-swatch" />Protein<strong>{nutrition.protein}g</strong></div><div><span className="legend-swatch carbs-swatch" />Carbs<strong>{nutrition.carbs}g</strong></div><div><span className="legend-swatch fat-swatch" />Fat<strong>{nutrition.fat}g</strong></div></div></div><div className="target-rows"><div><span>BMR</span><strong>{nutrition.bmr.toLocaleString(undefined, { maximumFractionDigits: 2 })} kcal</strong></div><div><span>Activity multiplier</span><strong>×{ACTIVITY_MULTIPLIERS[normalizedDraft.activityLevel]}</strong></div><div><span>TDEE</span><strong>{nutrition.tdee.toLocaleString()} kcal</strong></div><div className="target-calories"><span>Daily calorie target</span><strong>{nutrition.calories.toLocaleString()} kcal</strong></div></div>{nutrition.safetyFloorApplied && <p className="safety-warning" role="alert">Your requested deficit would fall below our safety floor. Your daily target has been raised to {nutrition.safetyFloor.toLocaleString()} kcal. Please consult a health professional for personal guidance.</p>}{normalizedDraft.goal === "lose" && nutrition.calories - nutrition.bmr > 1000 && <p className="safety-warning activity-target-warning" role="alert"><strong>Does this look right?</strong> Your daily target is more than 1,000 kcal above your BMR. Check that your activity level and weight-loss goal are correct before continuing.</p>}</section></div>
            <div className="review-confirm"><div className="confirm-mark"><Check size={18} /></div><p>Your plan will include <strong>{Number(normalizedDraft.mealsPerDay)} meals a day</strong> and avoid your selected restrictions.</p></div>
          </div>}

          {(error || currentError) && <div className="inline-error" role="alert">{error || currentError}</div>}
          <div className="wizard-actions">
            <button className="back-button" type="button" onClick={back} disabled={step === 0}><ArrowLeft size={16} /> Back</button>
            <span className="autosave-note"><Check size={12} /> Progress saved automatically</span>
            {step < 5 ? <button className="button button-primary wizard-next" type="button" onClick={next} disabled={Boolean(currentError)}>{step === 4 ? "Review answers" : "Next"} <ArrowRight size={16} /></button> : <button className="button button-primary wizard-next" type="button" onClick={generate}>Generate my meal plan <ArrowRight size={16} /></button>}
          </div>
        </section>
        <footer className="wizard-footer"><span><Leaf size={13} /> Thoughtful food, tailored to you.</span><span>Private by design · Saved on this device</span></footer>
      </main>
    </div>
  );
}
