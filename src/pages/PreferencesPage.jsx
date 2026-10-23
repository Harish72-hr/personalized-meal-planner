import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Leaf, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../context/ProfileContext.jsx";
import { usePlan } from "../context/PlanContext.jsx";
import { calculateNutrition } from "../utils/calorieCalculator.js";
import { ALLERGEN_OPTIONS } from "../utils/mealEngine.js";
import { ROUTES } from "../utils/appFlow.js";
import { createRecipePlan } from "../services/planRecipeService.js";
import FlowShell, { FlowFooter } from "../components/wizard/FlowShell.jsx";

const DIETS = [["vegetarian", "Vegetarian", "Plant-forward, no meat or fish"], ["non-vegetarian", "Non-vegetarian", "A little bit of everything"], ["vegan", "Vegan", "Fully plant-based"], ["eggetarian", "Eggetarian", "Vegetarian, with eggs"]];
const CUISINES = ["North Indian", "South Indian", "Continental", "Asian", "No preference"];
const CONDITIONS = [
  ["diabetes", "Diabetes", "Lower-added-sugar meal choices"],
  ["high-bp", "High blood pressure", "Lower-sodium meal choices"],
  ["high-cholesterol", "High cholesterol", "Lower-sodium and moderate-fat choices"],
  ["pcos", "PCOS", "Lower-sugar meal choices"],
];
const splitTags = (text) => text.split(",").map((item) => item.trim()).filter(Boolean);

function preferencesError(prefs) {
  if (!DIETS.some(([key]) => key === prefs.dietType)) return "Choose a diet type.";
  if (!prefs.cuisinePreferences.length) return "Choose at least one cuisine or No preference.";
  if (![3, 4].includes(Number(prefs.mealsPerDay))) return "Choose how many meals you want each day.";
  if (![15, 30, 60].includes(Number(prefs.maxCookingTime))) return "Choose a maximum cooking time.";
  return "";
}

// Food preferences and restrictions, collected after the calorie plan so onboarding stays short.
// Saving builds the week's meal plan.
export default function PreferencesPage() {
  const { profile, setProfile, darkMode } = useProfile();
  const { setPlan, setGroceryChecks, favorites, onlineRecipes } = usePlan();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState(() => ({
    dietType: profile.dietType ?? "vegetarian",
    cuisinePreferences: profile.cuisinePreferences?.length ? profile.cuisinePreferences : ["No preference"],
    mealsPerDay: profile.mealsPerDay ?? 4,
    maxCookingTime: profile.maxCookingTime ?? 30,
    allergies: profile.allergies ?? [],
    dislikedFoods: profile.dislikedFoods ?? [],
    healthConditions: profile.healthConditions ?? [],
    allergyInput: "",
    dislikeInput: "",
  }));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(values) {
    setPrefs((current) => ({ ...current, ...values }));
    setError("");
  }

  function toggleCuisine(cuisine) {
    if (cuisine === "No preference") return update({ cuisinePreferences: ["No preference"] });
    const current = prefs.cuisinePreferences.filter((item) => item !== "No preference");
    return update({ cuisinePreferences: current.includes(cuisine) ? current.filter((item) => item !== cuisine) : [...current, cuisine] });
  }

  function toggleChip(field, value) {
    const selected = prefs[field];
    update({ [field]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] });
  }

  function addTags(field, inputField) {
    update({ [field]: [...new Set([...prefs[field], ...splitTags(prefs[inputField])])], [inputField]: "" });
  }

  function removeTag(field, value) {
    update({ [field]: prefs[field].filter((tag) => tag !== value) });
  }

  async function save() {
    const validation = preferencesError(prefs);
    if (validation) {
      setError(validation);
      return;
    }
    const { allergyInput, dislikeInput, ...rest } = prefs;
    const updated = {
      ...profile,
      ...rest,
      mealsPerDay: Number(rest.mealsPerDay),
      maxCookingTime: Number(rest.maxCookingTime),
      allergies: [...new Set([...rest.allergies, ...splitTags(allergyInput)])],
      dislikedFoods: [...new Set([...rest.dislikedFoods, ...splitTags(dislikeInput)])],
      preferencesSet: true,
    };
    setLoading(true);
    try {
      const plan = await createRecipePlan(updated, calculateNutrition(updated), favorites, { online: onlineRecipes });
      setProfile(updated);
      setPlan(plan);
      setGroceryChecks([]);
      navigate(ROUTES.dashboard, { replace: true });
    } catch (planError) {
      console.error("Could not generate a meal plan.", planError);
      setError("We couldn’t build your meal plan. Please try again.");
      setLoading(false);
    }
  }

  if (loading) {
    return <div className={`loading-screen ${darkMode ? "theme-dark" : ""}`} role="status" aria-live="polite"><div className="loading-mark"><Leaf size={27} /></div><div className="loading-spinner" /><h1>Building your personalized week…</h1><p>Finding a week of meals that fits you.</p><div className="meal-skeletons" aria-hidden="true"><span /><span /><span /><span /></div></div>;
  }

  return (
    <FlowShell>
      <section className="wizard-card" aria-labelledby="preferences-title">
        <div className="wizard-card-heading"><span className="wizard-kicker"><span className="wizard-kicker-dot" /> MEAL PLAN</span><h1 id="preferences-title">Food preferences</h1><p>Tell us what you enjoy and anything to avoid. We’ll build a week of meals around your calorie goal.</p></div>
        <div className="wizard-fields">
          <fieldset className="field-set"><legend>How do you eat?</legend><div className="diet-options">{DIETS.map(([key, title, description]) => <button type="button" key={key} className={`diet-option ${prefs.dietType === key ? "selected" : ""}`} onClick={() => update({ dietType: key })} aria-pressed={prefs.dietType === key}><span className="radio-dot" /><strong>{title}</strong><small>{description}</small></button>)}</div></fieldset>
          <fieldset className="field-set"><legend>Which cuisines do you enjoy? <span className="legend-hint">Choose as many as you like</span></legend><div className="chip-list">{CUISINES.map((cuisine) => <button type="button" key={cuisine} className={`select-chip ${prefs.cuisinePreferences.includes(cuisine) ? "selected" : ""}`} onClick={() => toggleCuisine(cuisine)} aria-pressed={prefs.cuisinePreferences.includes(cuisine)}>{prefs.cuisinePreferences.includes(cuisine) && <Check size={13} />}{cuisine}</button>)}</div></fieldset>
          <div className="field-row">
            <fieldset className="field"><legend>Meals each day</legend><div className="choice-row">{[3, 4].map((count) => <button type="button" key={count} className={`choice-pill ${Number(prefs.mealsPerDay) === count ? "selected" : ""}`} onClick={() => update({ mealsPerDay: count })} aria-pressed={Number(prefs.mealsPerDay) === count}>{count} meals{count === 4 ? " + snack" : ""}</button>)}</div></fieldset>
            <fieldset className="field"><legend>Max cooking time</legend><div className="choice-row">{[15, 30, 60].map((minutes) => <button type="button" key={minutes} className={`choice-pill ${Number(prefs.maxCookingTime) === minutes ? "selected" : ""}`} onClick={() => update({ maxCookingTime: minutes })} aria-pressed={Number(prefs.maxCookingTime) === minutes}>{minutes} min</button>)}</div></fieldset>
          </div>
          <fieldset className="field-set"><legend>Any allergies or ingredients to avoid?</legend><div className="chip-list allergy-chips">{ALLERGEN_OPTIONS.map((allergen) => <button type="button" key={allergen} className={`select-chip ${prefs.allergies.includes(allergen) ? "selected" : ""}`} onClick={() => toggleChip("allergies", allergen)} aria-pressed={prefs.allergies.includes(allergen)}>{prefs.allergies.includes(allergen) && <Check size={13} />}{allergen}</button>)}</div></fieldset>
          <div className="tag-entry-row"><label className="field">Add another allergy <span className="field-unit">separate multiple with commas</span><div className="entry-with-button"><input value={prefs.allergyInput} onChange={(event) => update({ allergyInput: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTags("allergies", "allergyInput"); } }} placeholder="e.g. sesame" /><button type="button" onClick={() => addTags("allergies", "allergyInput")} aria-label="Add allergy"><Plus size={16} /></button></div></label></div>
          <div className="tag-cloud">{prefs.allergies.map((allergy) => <span className="tag" key={allergy}>{allergy}<button type="button" onClick={() => removeTag("allergies", allergy)} aria-label={`Remove ${allergy} allergy`}><X size={12} /></button></span>)}</div>
          <div className="tag-entry-row"><label className="field">Foods you dislike <span className="field-unit">separate multiple with commas</span><div className="entry-with-button"><input value={prefs.dislikeInput} onChange={(event) => update({ dislikeInput: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTags("dislikedFoods", "dislikeInput"); } }} placeholder="e.g. mushrooms, olives" /><button type="button" onClick={() => addTags("dislikedFoods", "dislikeInput")} aria-label="Add disliked foods"><Plus size={16} /></button></div></label></div>
          <div className="tag-cloud">{prefs.dislikedFoods.map((food) => <span className="tag tag-dislike" key={food}>{food}<button type="button" onClick={() => removeTag("dislikedFoods", food)} aria-label={`Remove ${food} dislike`}><X size={12} /></button></span>)}</div>
          <fieldset className="field-set"><legend>Anything you’d like us to consider? <span className="legend-hint">Optional</span></legend><div className="health-options">{CONDITIONS.map(([key, title, description]) => <button type="button" key={key} className={`health-option ${prefs.healthConditions.includes(key) ? "selected" : ""}`} onClick={() => toggleChip("healthConditions", key)} aria-pressed={prefs.healthConditions.includes(key)}><span className="check-square">{prefs.healthConditions.includes(key) && <Check size={12} />}</span><span><strong>{title}</strong><small>{description}</small></span></button>)}</div></fieldset>
          <p className="medical-note">These preferences only guide meal selection. This planner is not medical advice and does not replace care from a qualified health professional.</p>
        </div>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <div className="wizard-actions">
          <button className="back-button" type="button" onClick={() => navigate(ROUTES.dashboard)}><ArrowLeft size={16} /> Dashboard</button>
          <button className="button button-primary wizard-next" type="button" onClick={save}>Save and build my meal plan <ArrowRight size={16} /></button>
        </div>
      </section>
      <FlowFooter />
    </FlowShell>
  );
}
