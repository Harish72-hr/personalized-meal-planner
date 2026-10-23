import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowRight, Flame, Leaf, PencilLine, RefreshCw, ShoppingBasket, Sparkles, UtensilsCrossed } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import MealCard from "../components/dashboard/MealCard.jsx";
import { usePlan } from "../context/PlanContext.jsx";
import { useProfile } from "../context/ProfileContext.jsx";
import { ROUTES, dailyProgress, hasMealPreferences, planIsOutdated } from "../utils/appFlow.js";
import { plannedEntryNutrition, swapMeal } from "../utils/mealEngine.js";
import buildApiFilters from "../utils/buildApiFilters.js";
import { createRecipePlan } from "../services/planRecipeService.js";
import { searchRecipes } from "../services/recipeProvider.js";
import { useDiary } from "../context/DiaryContext.jsx";
import { createDiaryEntry, dailyTotals, emptyDiaryDay, localDateKey } from "../utils/diary.js";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PlanCharts = lazy(() => import("../components/charts/PlanCharts.jsx"));

export default function DashboardPage() {
  const { profile, beginWizard } = useProfile();
  const navigate = useNavigate();
  const { diary, setDiary } = useDiary();
  const { plan, setPlan, favorites, setFavorites, setGroceryChecks, onlineRecipes } = usePlan();
  const [selectedDay, setSelectedDay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [swappingSlot, setSwappingSlot] = useState("");
  const [error, setError] = useState("");
  const day = plan?.days?.[selectedDay];
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayDate = localDateKey();
  const todaysPlan = plan?.days?.[todayIndex];
  const eatenToday = dailyTotals(diary[todayDate] || emptyDiaryDay());
  const progress = useMemo(() => dailyProgress(profile, eatenToday.calories), [profile, eatenToday.calories]);
  const { nutrition } = progress;
  const todaysPlannedCalories = (todaysPlan?.meals || []).reduce((sum, item) => sum + plannedEntryNutrition(item).calories, 0);

  function toggleFavorite(mealId) {
    setFavorites((current) => current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId]);
  }

  function logMeal(meal, slot, dayIndex) {
    const now = new Date();
    now.setDate(now.getDate() - ((now.getDay() + 6) % 7) + dayIndex);
    const dateKey = localDateKey(now);
    const id = `plan:${dateKey}:${slot}:${meal.id}`;
    const targetSlot = slot === "snack" ? "snacks" : slot;
    setDiary((current) => {
      const currentDay = current[dateKey] || emptyDiaryDay();
      if (currentDay[targetSlot]?.some((item) => item.id === id)) return current;
      const planEntry = plan?.days?.[dayIndex]?.meals.find((item) => item.slot === slot && item.meal?.id === meal.id);
      const servings = planEntry?.servings || 1;
      const portion = planEntry ? plannedEntryNutrition(planEntry) : null;
      const diaryFood = planEntry?.sides?.length ? {
        ...meal,
        name: [meal.name, ...planEntry.sides.map(({ meal: side }) => side.name)].join(" + "),
        ...portion,
        ingredients: [
          ...meal.ingredients,
          ...planEntry.sides.flatMap(({ meal: side }) => side.ingredients),
        ],
        source: "plan",
      } : { ...meal, source: "plan" };
      const entry = createDiaryEntry(diaryFood, planEntry?.sides?.length ? 1 : servings, id);
      return { ...current, [dateKey]: { ...currentDay, [targetSlot]: [...(currentDay[targetSlot] || []), entry] } };
    });
  }

  async function changeMeal(dayIndex, slot) {
    setSwappingSlot(slot);
    setError("");
    const offset = plan?.apiOffsets?.[slot] || 20;
    try {
      const result = await searchRecipes(buildApiFilters(profile, nutrition, slot, offset), {
        profile, slot, online: onlineRecipes,
      });
      setPlan((current) => {
        const candidatePool = [...new Map([
          ...(current.candidatePool || []),
          ...result.recipes,
        ].map((meal) => [meal.id, meal])).values()];
        const nextPlan = swapMeal(current, slot, dayIndex, profile, nutrition, favorites, undefined, candidatePool);
        return {
          ...nextPlan,
          candidatePool,
          offlineRecipes: current.offlineRecipes || result.offline,
          apiOffsets: { ...current.apiOffsets, [slot]: offset + 20 },
        };
      });
    } catch (swapError) {
      console.error("Could not load another recipe.", swapError);
      setError("We couldn’t load another recipe. Please try again.");
    } finally {
      setSwappingSlot("");
    }
  }

  async function regeneratePlan(forceRefresh = false) {
    setRefreshing(true);
    setError("");
    try {
      const nextPlan = await createRecipePlan(profile, nutrition, favorites, { online: onlineRecipes, forceRefresh });
      setPlan(nextPlan);
      setGroceryChecks([]);
      setSelectedDay(0);
    } catch (generationError) {
      console.error("Could not regenerate the meal plan.", generationError);
      setError("We couldn’t refresh your meal plan. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  if (refreshing) return <div className="dashboard-loading" role="status" aria-live="polite"><div className="loading-spinner" /><h2>Refreshing your meal plan…</h2><p>Keeping your preferences in mind.</p><div className="meal-skeletons" aria-hidden="true"><span /><span /><span /><span /></div></div>;

  const dayCalories = (day?.meals || []).reduce((sum, entry) => sum + plannedEntryNutrition(entry).calories, 0);
  const plannedMealCount = (plan?.days || []).reduce((sum, planDay) => sum + planDay.meals.filter(({ meal }) => meal).length, 0);
  const groceryCount = (plan?.days || []).flatMap((planDay) => planDay.meals).reduce((sum, entry) => sum + (entry.meal?.ingredients.length || 0), 0);
  const editProfile = () => { beginWizard(profile); navigate(ROUTES.onboarding); };

  return <div className="dashboard-page">
    <div className="page-heading"><div><div className="eyebrow"><Sparkles size={13} /> MADE FOR YOUR RHYTHM</div><h1>Hi {profile.name}, here’s your day.</h1><p>Your goal is personal to you and updates whenever you edit your profile.</p></div><div className="page-heading-actions"><button className="button button-outline" type="button" onClick={editProfile}><PencilLine size={15} /> Edit profile</button>{day && <button className="button button-outline" type="button" onClick={() => regeneratePlan()}><RefreshCw size={15} /> Regenerate plan</button>}</div></div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    <section className="panel today-panel" aria-labelledby="today-title">
      <div className="today-heading"><div><span className="eyebrow">TODAY</span><h2 id="today-title">Calories</h2></div><Link className="button button-outline" to="/diary">Log food <ArrowRight size={14} /></Link></div>
      <dl className="today-stats">
        <div><dt>Daily goal</dt><dd>{progress.goal.toLocaleString()} <small>kcal</small></dd></div>
        <div><dt>Eaten</dt><dd>{progress.eaten.toLocaleString()} <small>kcal</small></dd></div>
        <div className={progress.over ? "is-over" : ""}><dt>{progress.over ? "Over goal" : "Remaining"}</dt><dd>{Math.abs(progress.remaining).toLocaleString()} <small>kcal</small></dd></div>
      </dl>
      <div className={`today-progress ${progress.over ? "is-over" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label={`${progress.eaten.toLocaleString()} of ${progress.goal.toLocaleString()} kcal eaten today`}><span style={{ width: `${progress.percent}%` }} /></div>
      <p className="today-note">{progress.percent}% of your goal{day ? ` · today’s plan has ${Math.round(todaysPlannedCalories).toLocaleString()} kcal` : ""}</p>
    </section>
    {planIsOutdated(plan, nutrition) && <div className="notice notice-info dashboard-notice" role="status"><Sparkles size={18} aria-hidden="true" /><p>Your daily goal is now {nutrition.calories.toLocaleString()} kcal, but your meal plan was built for {plan.targetCalories.toLocaleString()} kcal. <button type="button" className="link-button" onClick={() => regeneratePlan()}>Rebuild the plan to match</button></p></div>}
    {plan?.offlineRecipes && <div className="offline-banner" role="status"><span>Using offline recipes</span><button type="button" onClick={() => regeneratePlan(true)}>Retry online recipes</button></div>}
    {nutrition.safetyFloorApplied && <div className="safety-warning dashboard-warning" role="status">Your calorie target has been raised to the {nutrition.safetyFloor.toLocaleString()} kcal safety floor. Please speak with a doctor or registered dietitian before eating less than this. This planner is not medical advice.</div>}
    {plan?.relaxedRules?.length > 0 && <div className="relaxed-notice"><Sparkles size={15} /> To fill your week, we relaxed {plan.relaxedRules.map((rule) => rule === "cuisine" ? "some cuisine preferences" : "your cooking-time limit").join(" and ")}. Your diet type, allergies, dislikes, and health rules were kept.</div>}
    {plan?.unavailableSlots?.length > 0 && <div className="relaxed-notice warning-notice">No meal matched all your hard restrictions for {plan.unavailableSlots.join(", ")}. Hard filters were never relaxed.</div>}
    <section className="stats-row">
      <article className="stat-card stat-highlight"><div className="stat-icon"><Flame size={17} /></div><div><span>DAILY CALORIE TARGET</span><strong>{Math.round(nutrition.calories).toLocaleString()} <small>kcal</small></strong><p>BMR {Math.round(nutrition.bmr).toLocaleString()} · TDEE {Math.round(nutrition.tdee).toLocaleString()}</p></div></article>
      <article className="stat-card"><div className="stat-icon icon-protein"><Leaf size={17} /></div><div><span>PROTEIN</span><strong>{nutrition.protein}<small>g / day</small></strong><p>{Math.round(nutrition.macroSplit.protein * 100)}% of energy</p></div></article>
      <article className="stat-card"><div className="stat-icon icon-carbs">◒</div><div><span>CARBS</span><strong>{nutrition.carbs}<small>g / day</small></strong><p>{Math.round(nutrition.macroSplit.carbs * 100)}% of energy</p></div></article>
      <article className="stat-card"><div className="stat-icon icon-fat">◌</div><div><span>HEALTHY FATS</span><strong>{nutrition.fat}<small>g / day</small></strong><p>{Math.round(nutrition.macroSplit.fat * 100)}% of energy</p></div></article>
    </section>
    {day && todaysPlan?.calorieWarning && <p className="safety-warning" role="status">Today’s planned portions are still more than 10% from your calorie target.</p>}
    {day ? <>
    <Suspense fallback={<div className="charts-grid"><div className="panel chart-loading">Loading your nutrition charts…</div><div className="panel chart-loading">Loading your nutrition charts…</div></div>}>
      <PlanCharts plan={plan} diary={diary} nutrition={nutrition} />
    </Suspense>
    <section className="weekly-section">
      <div className="section-heading"><div><div className="eyebrow">YOUR PERSONALIZED MENU</div><h2>This week <span className="week-badge">7 days</span></h2></div><div className="day-total"><strong>{Math.round(dayCalories).toLocaleString()}</strong> kcal planned today</div></div>
      <div className="day-tabs" role="tablist" aria-label="Choose a day">{DAY_NAMES.map((name, index) => <button type="button" key={name} role="tab" aria-selected={selectedDay === index} className={selectedDay === index ? "active" : ""} onClick={() => setSelectedDay(index)}><span>{name.slice(0,3)}</span><small>{new Date(Date.now() + ((index - new Date().getDay() + 1 + 7) % 7) * 86400000).getDate()}</small></button>)}</div>
      <div className="selected-day-heading"><div><span className="eyebrow">{selectedDay === 0 ? "START FRESH" : "A DAY TO ENJOY"}</span><h2>{DAY_NAMES[selectedDay]}’s menu</h2></div><span className="day-calorie-pill">{Math.round(dayCalories).toLocaleString()} kcal</span></div>
      {day.calorieWarning && <div className="safety-warning" role="status">This day’s portions remain more than 10% from your calorie target after adjustment.</div>}
      <div className="meal-grid">{day.meals.map((entry) => {
        const plannedDate = new Date();
        plannedDate.setDate(plannedDate.getDate() - ((plannedDate.getDay() + 6) % 7) + selectedDay);
        const targetDate = localDateKey(plannedDate);
        const targetSlot = entry.slot === "snack" ? "snacks" : entry.slot;
        const logId = `plan:${targetDate}:${entry.slot}:${entry.meal?.id}`;
        const logged = Boolean(diary[targetDate]?.[targetSlot]?.some((item) => item.id === logId));
        return <MealCard key={entry.slot} entry={entry} dayIndex={selectedDay} onSwap={changeMeal} favorite={favorites.includes(entry.meal?.id)} onToggleFavorite={toggleFavorite} canSwap={Boolean(entry.meal) && swappingSlot !== entry.slot} logged={logged} onLog={entry.meal ? () => logMeal(entry.meal, entry.slot, selectedDay) : undefined} />;
      })}</div>
    </section>
    <div className="bottom-callout"><div className="callout-icon"><ShoppingBasket size={19} /></div><div><strong>Your week, one shopping trip.</strong><p>{plannedMealCount} planned meals · {groceryCount} ingredient portions across the week</p></div><Link className="button button-dark" to="/grocery">Build grocery list <ArrowRight size={15} /></Link></div>
    </> : <section className="panel empty-state plan-setup" aria-labelledby="plan-setup-title">
      <UtensilsCrossed size={28} aria-hidden="true" />
      <h2 id="plan-setup-title">{hasMealPreferences(profile) ? "Build this week’s meals" : "Set up your meal plan"}</h2>
      <p>{hasMealPreferences(profile) ? "We’ll plan a week of meals around your daily goal." : "Tell us what you like to eat and anything to avoid, and we’ll plan a week of meals around your daily goal."}</p>
      {hasMealPreferences(profile)
        ? <button className="button button-primary" type="button" onClick={() => regeneratePlan()}>Build my week <ArrowRight size={15} /></button>
        : <Link className="button button-primary" to={ROUTES.preferences}>Choose food preferences <ArrowRight size={15} /></Link>}
    </section>}
  </div>;
}
