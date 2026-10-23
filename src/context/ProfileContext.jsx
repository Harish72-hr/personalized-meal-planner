import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useLocalStorage from "../hooks/useLocalStorage.js";
import { normalizeProfile } from "../utils/calorieCalculator.js";
import { hasMealPreferences } from "../utils/appFlow.js";

export const createEmptyDraft = () => ({
  name: "",
  age: "",
  gender: "",
  formulaSex: "",
  heightCm: "",
  weightKg: "",
  bodyFatPercent: "",
  bmrFormula: "mifflin",
  units: "metric",
  activityLevel: "",
  goal: "maintain",
  targetWeightKg: "",
  pace: "standard",
  dietType: "vegetarian",
  cuisinePreferences: ["No preference"],
  mealsPerDay: 4,
  maxCookingTime: 30,
  allergies: [],
  allergyInput: "",
  dislikedFoods: [],
  dislikeInput: "",
  healthConditions: [],
  // Food preferences are collected after onboarding, on the meal preferences screen.
  preferencesSet: false,
});

const ProfileContext = createContext(null);
const darkQuery = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

// Earlier versions stored a boolean; an explicit "dark" choice is kept, anything else follows the system.
function legacyTheme() {
  try {
    return JSON.parse(window.localStorage.getItem("gather-v2-dark-mode")) === true ? "dark" : "system";
  } catch {
    return "system";
  }
}

function useSystemDark() {
  const [systemDark, setSystemDark] = useState(() => Boolean(darkQuery()?.matches));
  useEffect(() => {
    const query = darkQuery();
    if (!query) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return systemDark;
}

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useLocalStorage("gather-v2-profile", null);
  const [draft, setDraft] = useLocalStorage("gather-v3-wizard-draft", createEmptyDraft());
  // Onboarding became four calculator steps in v5, so older saved step numbers are not reused.
  const [step, setStep] = useLocalStorage("gather-v5-onboarding-step", 0);
  const [theme, setTheme] = useLocalStorage("gather-v3-theme", legacyTheme);
  const systemDark = useSystemDark();
  const darkMode = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", darkMode ? "#171e18" : "#f6f7f2");
  }, [darkMode]);

  const value = useMemo(() => ({
    profile,
    setProfile,
    draft,
    setDraft,
    step,
    setStep,
    darkMode,
    setDarkMode: (dark) => setTheme(dark ? "dark" : "light"),
    beginWizard(existingProfile = null) {
      if (existingProfile) {
        setDraft({ ...createEmptyDraft(), ...normalizeProfile(existingProfile), preferencesSet: hasMealPreferences(existingProfile) });
        setStep(0);
      }
    },
    resetWizard() {
      setDraft(createEmptyDraft());
      setStep(0);
    },
  }), [profile, setProfile, draft, setDraft, step, setStep, darkMode, setTheme]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider.");
  return context;
}
