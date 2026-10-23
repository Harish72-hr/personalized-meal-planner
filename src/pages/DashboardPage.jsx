import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowRight, Flame, Leaf, RefreshCw, ShoppingBasket, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import MealCard from "../components/dashboard/MealCard.jsx";
import { usePlan } from "../context/PlanContext.jsx";
import { useProfile } from "../context/ProfileContext.jsx";
import { calculateNutrition } from "../utils/calorieCalculator.js";
import { plannedEntryNutrition, swapMeal } from "../utils/mealEngine.js";
import buildApiFilters from "../utils/buildApiFilters.js";
import { createRecipePlan } from "../services/planRecipeService.js";
import { searchRecipes } from "../services/recipeProvider.js";
import { useDiary } from "../context/DiaryContext.jsx";
import { createDiaryEntry, dailyTotals, emptyDiaryDay, localDateKey, roundNutrition } from "../utils/diary.js";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PlanCharts = lazy(() => import("../components/charts/PlanCharts.jsx"));

export default function DashboardPage() {
  const { profile } = useProfile();
  const { diary, setDiary } = useDiary();
  const { plan, setPlan, favorites, setFavorites, setGroceryChecks, onlineRecipes } = usePlan();
  const [selectedDay, setSelectedDay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [swappingSlot, setSwappingSlot] = useState("");
  const [error, setError] = useState("");
  const nutrition = useMemo(() => calculateNutrition(profile), [profile]);
  const day = plan?.days?.[selectedDay];
  const todayIndex = (new Date().getDay() + 6) % 7;
  const todayDate = localDateKey();
  const todaysPlan = plan?.days?.[todayIndex];
  const eatenToday = dailyTotals(diary[todayDate] || emptyDiaryDay());
  const roundedEatenToday = roundNutrition(eatenToday);
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
  if (!day) return <div className="empty-state panel"><h2>Your plan needs a refresh</h2><button className="button button-primary" onClick={regeneratePlan}>Build this week</button></div>;

  const dayCalories = day.meals.reduce((sum, entry) => sum + plannedEntryNutrition(entry).calories, 0);
  const plannedMealCount = plan.days.reduce((sum, planDay) => sum + planDay.meals.filter(({ meal }) => meal).length, 0);
  const groceryCount = plan.days.flatMap((planDay) => planDay.meals).reduce((sum, entry) => sum + (entry.meal?.ingredients.length || 0), 0);

  return <div className="dashboard-page">
    <div className="page-heading"><div><div className="eyebrow"><Sparkles size={13} /> MADE FOR YOUR RHYTHM</div><h1>Your week, thoughtfully planned.</h1><p>A little structure, plenty of flavor. Here’s what’s on the menu, {profile.name}.</p></div><button className="button button-outline" type="button" onClick={regeneratePlan}><RefreshCw size={15} /> Regenerate plan</button></div>
    {error && <div className="inline-error" role="alert">{error}</div>}
    {plan.offlineRecipes && <div className="offline-banner" role="status"><span>Using offline recipes</span><button type="button" onClick={() => regeneratePlan(true)}>Retry online recipes</button></div>}
    {nutrition.safetyFloorApplied && <div className="safety-warning dashboard-warning" role="status">Your calorie target has been raised to the {nutrition.safetyFloor.toLocaleString()} kcal safety floor. Please speak with a doctor or registered dietitian before eating less than this. This planner is not medical advice.</div>}
    {plan.relaxedRules?.length > 0 && <div className="relaxed-notice"><Sparkles size={15} /> To fill your week, we relaxed {plan.relaxedRules.map((rule) => rule === "cuisine" ? "some cuisine preferences" : "your cooking-time limit").join(" and ")}. Your diet type, allergies, dislikes, and health rules were kept.</div>}
    {plan.unavailableSlots?.length > 0 && <div className="relaxed-notice warning-notice">No meal matched all your hard restrictions for {plan.unavailableSlots.join(", ")}. Hard filters were never relaxed.</div>}
    <section className="stats-row">
      <article className="stat-card stat-highlight"><div className="stat-icon"><Flame size={17} /></div><div><span>DAILY CALORIE TARGET</span><strong>{Math.round(nutrition.calories).toLocaleString()} <small>kcal</small></strong><p>BMR {Math.round(nutrition.bmr).toLocaleString()} · TDEE {Math.round(nutrition.tdee).toLocaleString()}</p></div></article>
      <article className="stat-card"><div className="stat-icon icon-protein"><Leaf size={17} /></div><div><span>PROTEIN</span><strong>{nutrition.protein}<small>g / day</small></strong><p>{Math.round(nutrition.macroSplit.protein * 100)}% of energy</p></div></article>
      <article className="stat-card"><div className="stat-icon icon-carbs">◒</div><div><span>CARBS</span><strong>{nutrition.carbs}<small>g / day</small></strong><p>{Math.round(nutrition.macroSplit.carbs * 100)}% of energy</p></div></article>
      <article className="stat-card"><div className="stat-icon icon-fat">◌</div><div><span>HEALTHY FATS</span><strong>{nutrition.fat}<small>g / day</small></strong><p>{Math.round(nutrition.macroSplit.fat * 100)}% of energy</p></div></article>
    </section>
    <section className="panel planned-eaten-panel"><div><span className="eyebrow">TODAY’S CHECK-IN</span><h2>Planned vs actually eaten</h2><p>Today’s plan is {Math.round(todaysPlannedCalories).toLocaleString()} kcal. Your diary has {roundedEatenToday.calories.toLocaleString()} kcal logged.</p>{todaysPlan?.calorieWarning && <p className="safety-warning" role="status">Today’s planned portions are still more than 10% from your calorie target.</p>}</div><Link className="button button-outline" to="/diary">Open food diary <ArrowRight size={14} /></Link></section>
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
  </div>;
}
