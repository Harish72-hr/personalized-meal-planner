import { useMemo } from "react";
import { ArrowRight, PencilLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../context/ProfileContext.jsx";
import { PACE_OPTIONS, calculateNutrition, normalizeProfile } from "../utils/calorieCalculator.js";
import { ROUTES, goalExplanation } from "../utils/appFlow.js";
import FlowShell, { FlowFooter } from "../components/wizard/FlowShell.jsx";
import ResultsCard from "../components/wizard/ResultsCard.jsx";

// Second screen of the flow: the calorie plan calculated from the saved profile.
export default function ResultsPage() {
  const { profile, beginWizard } = useProfile();
  const navigate = useNavigate();
  const normalized = useMemo(() => normalizeProfile(profile), [profile]);
  const nutrition = useMemo(() => calculateNutrition(normalized), [normalized]);
  const paceLabel = PACE_OPTIONS[normalized.pace]?.[normalized.goal];

  return (
    <FlowShell>
      <section className="wizard-card" aria-labelledby="results-page-title">
        <div className="wizard-card-heading">
          <span className="wizard-kicker"><span className="wizard-kicker-dot" /> YOUR CALORIE PLAN</span>
          <h1 id="results-page-title">Here’s your plan, {profile.name}</h1>
          <p className="results-explanation">{goalExplanation(nutrition, normalized, paceLabel)}</p>
        </div>
        <ResultsCard profile={normalized} nutrition={nutrition} />
        <div className="wizard-actions">
          <button className="back-button" type="button" onClick={() => { beginWizard(profile); navigate(ROUTES.onboarding); }}><PencilLine size={16} /> Edit details</button>
          <button className="button button-primary wizard-next" type="button" onClick={() => navigate(ROUTES.dashboard)}>Go to Dashboard <ArrowRight size={16} /></button>
        </div>
      </section>
      <FlowFooter />
    </FlowShell>
  );
}
