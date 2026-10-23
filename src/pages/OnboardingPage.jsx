import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createEmptyDraft, useProfile } from "../context/ProfileContext.jsx";
import {
  ACTIVITY_LEVELS, GOAL_ADJUSTMENTS, INPUT_LIMITS, PACE_OPTIONS, calculateBMI, cmToFeetInches, feetInchesToCm,
  isMinor, kgToLb, lbToKg, normalizeProfile, validateProfile,
} from "../utils/calorieCalculator.js";
import { ROUTES } from "../utils/appFlow.js";
import FlowShell, { FlowFooter } from "../components/wizard/FlowShell.jsx";
import { Field, RadioCards, UnitNumberInput } from "../components/wizard/FormControls.jsx";

const STEPS = [
  { group: "Personal info", title: "About you", subtitle: "A few basics to estimate how much energy your body uses." },
  { group: "Body", title: "Your measurements", subtitle: "Height and weight drive the calorie equations." },
  { group: "Activity", title: "How active are you?", subtitle: "Pick the option that matches a typical week, not your best week." },
  { group: "Goal", title: "What’s your goal?", subtitle: "We’ll adjust your daily calories to match." },
];
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
const STEP_FIELDS = {
  0: ["age", "gender", "formulaSex"],
  1: ["heightCm", "weightKg", "bodyFatPercent", "bmrFormula"],
  2: ["activityLevel"],
  3: ["goal"],
};
const NULLABLE_FIELDS = ["targetWeightKg", "bodyFatPercent"];

const round1 = (value) => Math.round(Number(value) * 10) / 10;
const splitTags = (text = "") => text.split(",").map((item) => item.trim()).filter(Boolean);

function stepErrors(step, draft) {
  const errors = {};
  if (step === 0 && !draft.name.trim()) errors.name = "Enter your name.";
  Object.assign(errors, validateProfile(draft, { units: draft.units, fields: STEP_FIELDS[step] }));
  if (step === 3 && draft.goal !== "maintain" && draft.targetWeightKg !== "") {
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
  return errors;
}

function firstInvalidStep(draft) {
  for (let step = 0; step <= LAST_STEP; step += 1) {
    if (Object.keys(stepErrors(step, draft)).length) return step;
  }
  return -1;
}

// Turns the form draft into the saved profile (metric numbers, optional fields as null).
function profileFromDraft(draft) {
  return {
    ...draft,
    age: Number(draft.age),
    heightCm: round1(draft.heightCm),
    weightKg: round1(draft.weightKg),
    bodyFatPercent: draft.bodyFatPercent === "" ? null : Number(draft.bodyFatPercent),
    formulaSex: draft.gender === "other" ? draft.formulaSex : "",
    targetWeightKg: draft.goal === "maintain" || draft.targetWeightKg === "" ? null : round1(draft.targetWeightKg),
    mealsPerDay: Number(draft.mealsPerDay),
    maxCookingTime: Number(draft.maxCookingTime),
    allergies: [...new Set([...draft.allergies, ...splitTags(draft.allergyInput)])],
    dislikedFoods: [...new Set([...draft.dislikedFoods, ...splitTags(draft.dislikeInput)])],
    allergyInput: "",
    dislikeInput: "",
  };
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
        <label><input type="number" inputMode="numeric" min="3" max="8" value={feet} aria-label="Height, feet" aria-invalid={error ? true : undefined} onChange={(event) => change(event.target.value, inches)} /><span>ft</span></label>
        <label><input type="number" inputMode="decimal" min="0" max="11.9" step="0.5" value={inches} aria-label="Height, inches" aria-invalid={error ? true : undefined} onChange={(event) => change(feet, event.target.value)} /><span>in</span></label>
      </div>
      {error && <p className="field-error" id="height-error">{error}</p>}
    </fieldset>
  );
}

export default function OnboardingPage() {
  const { profile, draft, setDraft, step: savedStep, setStep, setProfile, resetWizard } = useProfile();
  const navigate = useNavigate();
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
  const bmi = calculateBMI(normalizedDraft.weightKg, normalizedDraft.heightCm);
  const imperial = normalizedDraft.units === "imperial";
  const editing = Boolean(profile);
  const showError = (field) => ((attempted || touched[field]) ? errors[field] : undefined);
  const touch = (field) => () => setTouched((current) => ({ ...current, [field]: true }));

  function update(values) {
    setDraft((current) => ({ ...current, ...values }));
  }

  function goTo(targetStep) {
    setStep(targetStep);
    setAttempted(false);
    setTouched({});
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

  function finish() {
    const invalidStep = firstInvalidStep(normalizedDraft);
    if (invalidStep !== -1) {
      goTo(invalidStep);
      setAttempted(true);
      return;
    }
    setProfile(profileFromDraft(normalizedDraft));
    resetWizard();
    navigate(ROUTES.results);
  }

  function next() {
    if (Object.keys(errors).length) {
      setAttempted(true);
      focusFirstError();
      return;
    }
    if (step === LAST_STEP) finish();
    else goTo(step + 1);
  }

  const stepProgress = ((step + 1) / STEPS.length) * 100;
  const paceOptions = Object.entries(PACE_OPTIONS).map(([value, pace]) => {
    const adjustment = GOAL_ADJUSTMENTS[normalizedDraft.goal]?.[value] ?? 0;
    return { value, label: pace.label, description: `${adjustment > 0 ? "+" : "−"}${Math.abs(adjustment)} kcal/day · ${pace[normalizedDraft.goal] ?? ""}` };
  });
  const formulaOptions = [
    { value: "mifflin", label: "Mifflin-St Jeor", description: "Recommended · most accurate for most adults" },
    { value: "harris", label: "Revised Harris-Benedict", description: "Older alternative · Roza & Shizgal, 1984" },
    { value: "katch", label: "Katch-McArdle", description: normalizedDraft.bodyFatPercent === "" ? "Enter body-fat % above to enable" : "Uses lean body mass · best if body fat was measured", disabled: normalizedDraft.bodyFatPercent === "" },
  ];

  return (
    <FlowShell>
      <nav className="wizard-progress" aria-label="Progress">
        <div className="progress-meta"><span>Step {step + 1} of {STEPS.length}</span><span>{STEPS[step].group}</span></div>
        <div className="progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step].group}`}><span style={{ width: `${stepProgress}%` }} /></div>
      </nav>
      <section className="wizard-card" key={step} aria-labelledby="wizard-step-title">
        <div className="wizard-card-heading"><span className="wizard-kicker"><span className="wizard-kicker-dot" /> {editing ? "EDIT PROFILE" : STEPS[step].group.toUpperCase()}</span><h1 id="wizard-step-title">{STEPS[step].title}</h1><p>{STEPS[step].subtitle}</p></div>

        {step === 0 && <div className="wizard-fields">
          <Field label="What should we call you?" error={showError("name")} className="full">
            {(props) => <input {...props} autoComplete="given-name" value={normalizedDraft.name} onChange={(event) => update({ name: event.target.value })} onBlur={touch("name")} placeholder="Your name" maxLength={60} />}
          </Field>
          <Field label="Age" unit="years" error={showError("age")} hint={`${INPUT_LIMITS.age.min}–${INPUT_LIMITS.age.max}`}>
            {(props) => <input {...props} type="number" inputMode="numeric" min={INPUT_LIMITS.age.min} max={INPUT_LIMITS.age.max} step="1" value={normalizedDraft.age} onChange={(event) => update({ age: event.target.value })} onBlur={touch("age")} placeholder="e.g. 28" />}
          </Field>
          {isMinor(normalizedDraft.age) && <div className="notice notice-warning" role="status"><Info size={18} aria-hidden="true" /><p>These equations were developed for adults. For anyone under 18, growth needs vary a lot, so please use these numbers only as a rough guide and check with a doctor or registered dietitian.</p></div>}
          <RadioCards name="gender" legend="Sex" layout="inline" options={SEX_OPTIONS} value={normalizedDraft.gender} onChange={(gender) => update({ gender })} error={attempted ? errors.gender : undefined} />
          {normalizedDraft.gender === "other" && <RadioCards name="formulaSex" legend="Which equation should we use?" hint="The formulas were developed for female and male bodies. Pick the one closest to your current physiology, or ask your clinician." layout="grid" options={FORMULA_SEX_OPTIONS} value={normalizedDraft.formulaSex} onChange={(formulaSex) => update({ formulaSex })} error={attempted ? errors.formulaSex : undefined} />}
          <p className="quiet-note">Not suitable during pregnancy or breastfeeding, when energy needs are different.</p>
        </div>}

        {step === 1 && <div className="wizard-fields">
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
        </div>}

        {step === 2 && <div className="wizard-fields">
          <RadioCards name="activityLevel" legend="Your typical week" options={ACTIVITY_OPTIONS} value={normalizedDraft.activityLevel} onChange={(activityLevel) => update({ activityLevel })} error={attempted ? errors.activityLevel : undefined} />
          <p className="notice notice-info"><Info size={18} aria-hidden="true" /><span>Most people overestimate their activity. If you’re between two levels, choose the lower one. A desk job plus three gym sessions a week is usually “Lightly” or “Moderately active”.</span></p>
        </div>}

        {step === 3 && <div className="wizard-fields">
          <RadioCards name="goal" legend="Goal" layout="grid" options={GOAL_OPTIONS} value={normalizedDraft.goal} onChange={(goal) => update({ goal })} error={attempted ? errors.goal : undefined} />
          {normalizedDraft.goal !== "maintain" && <div className="goal-detail">
            <RadioCards name="pace" legend="Target pace" layout="grid" options={paceOptions} value={normalizedDraft.pace} onChange={(pace) => update({ pace })} />
            <Field label="Target weight" unit={`${imperial ? "lb" : "kg"} · optional`} error={showError("targetWeightKg")}>
              {(props) => imperial
                ? <UnitNumberInput {...props} key="lb" min="67" max="661" step="0.1" value={normalizedDraft.targetWeightKg} toDisplay={kgToLb} fromDisplay={lbToKg} onChange={(targetWeightKg) => update({ targetWeightKg })} onBlur={touch("targetWeightKg")} placeholder={normalizedDraft.goal === "lose" ? "Below your current weight" : "Above your current weight"} />
                : <input {...props} type="number" inputMode="decimal" min={INPUT_LIMITS.weightKg.min} max={INPUT_LIMITS.weightKg.max} step="0.1" value={normalizedDraft.targetWeightKg} onChange={(event) => update({ targetWeightKg: event.target.value })} onBlur={touch("targetWeightKg")} placeholder={normalizedDraft.goal === "lose" ? "Below your current weight" : "Above your current weight"} />}
            </Field>
            <p className="quiet-note">Deficits are capped at 25% of your daily energy use, and targets never go below 1,200 kcal (female equation) or 1,500 kcal (male equation).</p>
          </div>}
        </div>}

        <div className="wizard-actions">
          {step === 0 && editing
            ? <button className="back-button" type="button" onClick={() => { resetWizard(); navigate(ROUTES.dashboard); }}><ArrowLeft size={16} /> Cancel</button>
            : <button className="back-button" type="button" onClick={() => goTo(Math.max(step - 1, 0))} disabled={step === 0}><ArrowLeft size={16} /> Back</button>}
          <span className="autosave-note"><Check size={12} /> Progress saved automatically</span>
          <button className="button button-primary wizard-next" type="button" onClick={next}>{step === LAST_STEP ? "See my results" : "Next"} <ArrowRight size={16} /></button>
        </div>
      </section>
      <FlowFooter />
    </FlowShell>
  );
}
