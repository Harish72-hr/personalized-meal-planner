import { createContext, useContext, useMemo } from "react";
import useLocalStorage from "../hooks/useLocalStorage.js";

export const createEmptyDraft = () => ({
  name: "",
  age: "",
  gender: "female",
  heightCm: "",
  weightKg: "",
  units: "metric",
  activityLevel: "",
  goal: "maintain",
  targetWeightKg: "",
  pace: "moderate",
  dietType: "vegetarian",
  cuisinePreferences: ["No preference"],
  mealsPerDay: 4,
  maxCookingTime: 30,
  allergies: [],
  allergyInput: "",
  dislikedFoods: [],
  dislikeInput: "",
  healthConditions: [],
});

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useLocalStorage("gather-v2-profile", null);
  const [draft, setDraft] = useLocalStorage("gather-v3-wizard-draft", createEmptyDraft());
  const [step, setStep] = useLocalStorage("gather-v3-wizard-step", 0);
  const [darkMode, setDarkMode] = useLocalStorage("gather-v2-dark-mode", false);

  const value = useMemo(() => ({
    profile,
    setProfile,
    draft,
    setDraft,
    step,
    setStep,
    darkMode,
    setDarkMode,
    beginWizard(existingProfile = null) {
      if (existingProfile) {
        setDraft({ ...createEmptyDraft(), ...existingProfile, activityLevel: "", units: "metric" });
        setStep(0);
      }
    },
    resetWizard() {
      setDraft(createEmptyDraft());
      setStep(0);
    },
  }), [profile, setProfile, draft, setDraft, step, setStep, darkMode, setDarkMode]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used inside ProfileProvider.");
  return context;
}
