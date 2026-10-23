import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Droplets, Plus, Save, Scale, Search, Trash2, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import meals from "../data/meals.json";
import { useDiary } from "../context/DiaryContext.jsx";
import { usePlan } from "../context/PlanContext.jsx";
import { useProfile } from "../context/ProfileContext.jsx";
import { searchRecipes } from "../services/recipeProvider.js";
import { calculateNutrition } from "../utils/calorieCalculator.js";
import { mealMatchesProfile } from "../utils/mealEngine.js";
import { addDaysToDateKey, createDiaryEntry, dailyTotals, DIARY_SLOTS, emptyDiaryDay, localDateKey, roundNutrition, scaleNutrition } from "../utils/diary.js";

function classifyFood(food) {
  const text = [food.name, ...(food.ingredients || []).map((item) => typeof item === "string" ? item : item.name)].join(" ").toLowerCase();
  if (/\b(beef|pork|bacon|ham|lamb|mutton|chicken|turkey|duck|fish|salmon|tuna|cod|shrimp|prawns?|crab|lobster|seafood)\b/.test(text)) return ["non-vegetarian"];
  if (/\beggs?\b/.test(text)) return ["eggetarian", "vegetarian"];
  if (/\b(milk|cream|butter|ghee|cheese|yogurt|yoghurt|honey|gelatin|casein|whey)\b/.test(text)) return ["vegetarian"];
  if (/\b(vegetable|vegan|plant-based|beans?|lentils?|tofu|oats?|rice|fruit|apple|banana|berries|salad|chickpeas?|hummus)\b/.test(text)) return ["vegan", "vegetarian"];
  return [];
}

function conflictsWithProfile(food, profile) {
  const ingredients = food.ingredients?.length
    ? food.ingredients.map((item) => typeof item === "string" ? { name: item } : item)
    : [{ name: food.name }];
  const candidate = {
    ...food,
    ingredients,
    dietType: food.dietType?.length ? food.dietType : classifyFood(food),
    prepTime: 0,
    sugar: Number(food.sugar) || 0,
    sodium: Number(food.sodium) || 0,
  };
  return !mealMatchesProfile(candidate, profile, { ignorePrepTime: true });
}

function foodRecord(entry) {
  return { ...entry, source: entry.source || "manual", ingredients: entry.ingredients || [{ name: entry.name }] };
}

function FoodSearchModal({ slot, profile, online, customFoods, savedMeals, recentFoods, frequentFoods, onClose, onAdd, onSaveCustom, onDeleteCustom, onSaveMeal, onDeleteMeal }) {
  const [tab, setTab] = useState("Search");
  const [query, setQuery] = useState("");
  const [servings, setServings] = useState(1);
  const [selected, setSelected] = useState(null);
  const [remoteResults, setRemoteResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", servingSize: "1 serving", calories: "", protein: "", carbs: "", fat: "" });
  const [savedName, setSavedName] = useState("");
  const [savedNutrition, setSavedNutrition] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [manageMealId, setManageMealId] = useState("");

  useEffect(() => {
    if (tab !== "Search" || query.trim().length < 2 || !online) {
      setRemoteResults([]);
      setLoading(false);
      return undefined;
    }
    let current = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError("");
      try {
        const apiType = slot === "breakfast" ? "breakfast" : slot === "snacks" ? "snack" : "main course";
        const result = await searchRecipes({ type: apiType, number: 30, addRecipeNutrition: true }, {
          profile, slot: slot === "snacks" ? "snack" : slot, online, includeUnsafe: true,
        });
        if (!current) return;
        const term = query.trim().toLowerCase();
        setRemoteResults(result.recipes.filter((recipe) =>
          `${recipe.name} ${(recipe.ingredients || []).map((item) => item.name).join(" ")}`.toLowerCase().includes(term),
        ));
        if (result.offline) setSearchError("Online search is unavailable. Showing matches from your local foods and recipes.");
      } catch (error) {
        console.error("Food search failed.", error);
        if (current) setSearchError("Online food search failed. You can still search local foods or create a custom food.");
      } finally {
        if (current) setLoading(false);
      }
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query, tab, slot, profile, online]);

  const localResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    return meals.filter((meal) => !term || `${meal.name} ${meal.ingredients.map((item) => item.name).join(" ")}`.toLowerCase().includes(term));
  }, [query]);
  const searchResults = [...new Map([...localResults, ...remoteResults, ...customFoods].map((food) => [food.id || food.name, food])).values()];
  const displayedFoods = tab === "Search" ? searchResults : tab === "Recent" ? recentFoods : tab === "Frequent" ? frequentFoods : tab === "My Foods" ? customFoods : savedMeals;

  function chooseFood(food) {
    setSelected(foodRecord(food));
    setServings(1);
  }

  function addSelected() {
    const amount = Number(servings);
    if (selected && Number.isFinite(amount) && amount > 0) onAdd(selected, amount);
  }

  function saveCustom(event) {
    event.preventDefault();
    const food = {
      id: `custom:${Date.now()}`,
      name: customForm.name.trim(),
      servingSize: customForm.servingSize.trim(),
      calories: Number(customForm.calories),
      protein: Number(customForm.protein) || 0,
      carbs: Number(customForm.carbs) || 0,
      fat: Number(customForm.fat) || 0,
      ingredients: [{ name: customForm.name.trim() }],
      dietType: classifyFood({ name: customForm.name }),
      source: "custom",
    };
    onSaveCustom(food);
    setShowCreate(false);
    setTab("My Foods");
    setQuery("");
  }

  function addSavedMealAsFood(meal) {
    const food = { ...meal, ingredients: meal.ingredients || [{ name: meal.name }], source: "saved meal" };
    onAdd(food, 1);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="recipe-modal food-search-modal" role="dialog" aria-modal="true" aria-labelledby="food-search-title">
      <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close food search"><X size={18} /></button>
      <div className="recipe-modal-content">
        <span className="eyebrow">ADD TO {slot.toUpperCase()}</span><h2 id="food-search-title">Find a food</h2>
        <div className="food-tabs" role="tablist">{["Search", "Recent", "Frequent", "My Foods", "Saved Meals"].map((name) => <button type="button" role="tab" aria-selected={tab === name} className={tab === name ? "active" : ""} key={name} onClick={() => { setTab(name); setSelected(null); }}>{name}</button>)}</div>
        {tab === "Search" && <label className="food-search-field"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods and recipes" /><button type="button" onClick={() => setShowCreate(true)}>Create food</button></label>}
        {searchError && <p className="food-search-notice" role="status">{searchError}</p>}
        {loading && <div className="food-result-list" aria-label="Loading search results" role="status"><div className="food-skeleton" /><div className="food-skeleton" /><div className="food-skeleton" /></div>}
        {!loading && displayedFoods.length > 0 && <div className="food-result-list">{displayedFoods.map((food, index) => {
          const warning = conflictsWithProfile(food, profile);
          const isSavedMeal = tab === "Saved Meals";
          return <article className={`food-result ${selected?.id === food.id ? "selected" : ""}`} key={food.id || `${food.name}-${index}`}>
            <button className="food-result-pick" type="button" onClick={() => isSavedMeal ? addSavedMealAsFood(food) : chooseFood(food)}>
              <span><strong>{food.name}</strong><small>{food.calories} kcal · P {Number(food.protein || 0).toFixed(1)}g · C {Number(food.carbs || 0).toFixed(1)}g · F {Number(food.fat || 0).toFixed(1)}g{food.servingSize ? ` · ${food.servingSize}` : ""}</small></span>
              {warning && <span className="safety-food-badge">Check diet / allergy</span>}
            </button>
            {(tab === "Recent" || tab === "Frequent") && <button type="button" className="button button-primary food-quick-add" onClick={() => onAdd(foodRecord(food), 1)}>Add</button>}
            {tab === "My Foods" && <button type="button" className="icon-button" onClick={() => onDeleteCustom(food.id)} aria-label={`Delete ${food.name}`}><Trash2 size={14} /></button>}
            {isSavedMeal && <span className="food-manage-actions">{manageMealId === food.id ? <><input aria-label="Saved meal name" value={savedName} onChange={(event) => setSavedName(event.target.value)} />{["calories", "protein", "carbs", "fat"].map((key) => <input key={key} aria-label={`${key} per serving`} type="number" min="0" step={key === "calories" ? "1" : "0.1"} value={savedNutrition[key]} onChange={(event) => setSavedNutrition({ ...savedNutrition, [key]: event.target.value })} />)}<button type="button" onClick={() => { if (!savedName.trim()) return; onSaveMeal({ ...food, name: savedName.trim(), calories: Number(savedNutrition.calories), protein: Number(savedNutrition.protein), carbs: Number(savedNutrition.carbs), fat: Number(savedNutrition.fat) }); setManageMealId(""); }}>Save</button><button type="button" onClick={() => setManageMealId("")}>Cancel</button></> : <button type="button" onClick={() => { setManageMealId(food.id); setSavedName(food.name); setSavedNutrition({ calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat }); }}>Edit</button>}<button type="button" onClick={() => onDeleteMeal(food.id)}>Delete</button></span>}
          </article>;
        })}</div>}
        {!loading && tab === "Search" && displayedFoods.length === 0 && <div className="empty-state food-empty"><p>No matching foods found.</p><button className="button button-outline" type="button" onClick={() => setShowCreate(true)}>Create a custom food</button></div>}
        {(tab === "Recent" || tab === "Frequent" || tab === "My Foods" || tab === "Saved Meals") && displayedFoods.length === 0 && <div className="empty-state food-empty"><p>{tab === "Recent" ? "Foods you log will appear here." : tab === "Frequent" ? "Foods you log often will appear here." : tab === "My Foods" ? "Your custom foods will appear here." : "Save foods from your diary to reuse them here."}</p>{tab === "My Foods" && <button className="button button-outline" type="button" onClick={() => setShowCreate(true)}>Create a custom food</button>}</div>}
        {selected && <div className="food-selection"><div><strong>{selected.name}</strong><small>Per {selected.servingSize || "serving"} · {Math.round(scaleNutrition(selected, Number(servings) > 0 ? Number(servings) : 1).calories)} kcal</small></div><label>Servings<input type="number" min="0.1" step="0.1" value={servings} onChange={(event) => setServings(event.target.value)} /></label><span>P {(Math.round(scaleNutrition(selected, Number(servings) > 0 ? Number(servings) : 1).protein * 10) / 10).toFixed(1)}g · C {(Math.round(scaleNutrition(selected, Number(servings) > 0 ? Number(servings) : 1).carbs * 10) / 10).toFixed(1)}g · F {(Math.round(scaleNutrition(selected, Number(servings) > 0 ? Number(servings) : 1).fat * 10) / 10).toFixed(1)}g</span><button className="button button-primary" type="button" onClick={addSelected} disabled={!Number.isFinite(Number(servings)) || Number(servings) <= 0}>Add food</button></div>}
        {showCreate && <form className="custom-food-form" onSubmit={saveCustom}><div className="modal-subheading"><h3>Create custom food</h3><button className="icon-button" type="button" onClick={() => setShowCreate(false)} aria-label="Close custom food form"><X size={14} /></button></div><label>Name<input required value={customForm.name} onChange={(event) => setCustomForm({ ...customForm, name: event.target.value })} /></label><label>Serving size<input required value={customForm.servingSize} onChange={(event) => setCustomForm({ ...customForm, servingSize: event.target.value })} /></label><div className="field-row">{["calories", "protein", "carbs", "fat"].map((key) => <label key={key}>{key === "calories" ? "Calories" : key}<input required min="0" step={key === "calories" ? "1" : "0.1"} type="number" value={customForm[key]} onChange={(event) => setCustomForm({ ...customForm, [key]: event.target.value })} /></label>)}</div><button className="button button-primary" type="submit">Save custom food</button></form>}
      </div>
    </section>
  </div>;
}

function caloriesRingPercent(eaten, goal) {
  return Math.min(100, Math.max(0, goal > 0 ? eaten / goal * 100 : 0));
}

export default function DiaryPage() {
  const { profile } = useProfile();
  const { onlineRecipes } = usePlan();
  const { diary, setDiary, customFoods, setCustomFoods, savedMeals, setSavedMeals, recentFoods, setRecentFoods, water, setWater, waterGoal, setWaterGoal, weights, setWeights } = useDiary();
  const nutrition = calculateNutrition(profile);
  const today = localDateKey();
  const [date, setDate] = useState(today);
  const [activeSlot, setActiveSlot] = useState("");
  const [quickAdd, setQuickAdd] = useState({ name: "", calories: "" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [savedMealName, setSavedMealName] = useState("");
  const [showSaveMeal, setShowSaveMeal] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const day = diary[date] || emptyDiaryDay();
  const totals = dailyTotals(day);
  const displayedTotals = roundNutrition(totals);
  const ringPercent = caloriesRingPercent(totals.calories, nutrition.calories);
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const todayWater = water[date] || 0;
  const weightData = [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-14).map((entry) => ({
    ...entry, label: new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  const frequentFoods = useMemo(() => {
    const counts = new Map();
    Object.values(diary).forEach((dayData) => DIARY_SLOTS.forEach(({ id }) => (dayData[id] || []).forEach((entry) => {
      const key = entry.name.toLowerCase();
      const current = counts.get(key);
      if (current) current.count += 1;
      else counts.set(key, { ...entry, count: 1 });
    })));
    return [...counts.values()].sort((left, right) => right.count - left.count).slice(0, 20);
  }, [diary]);

  function updateSlot(slot, update) {
    setDiary((current) => {
      const currentDay = current[date] || emptyDiaryDay();
      const entries = currentDay[slot] || [];
      return { ...current, [date]: { ...currentDay, [slot]: update(entries) } };
    });
  }

  function addFood(food, servings) {
    const entry = createDiaryEntry(food, servings);
    updateSlot(activeSlot, (entries) => [...entries, entry]);
    setRecentFoods((current) => [foodRecord(food), ...current.filter((item) => item.id !== food.id)].slice(0, 30));
    setActiveSlot("");
  }

  function updateEntry(entryId, changes) {
    updateSlot(activeSlot, (entries) => entries.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry));
  }

  function copyYesterday() {
    const sourceDate = addDaysToDateKey(date, -1);
    const previousDay = diary[sourceDate];
    if (!previousDay) return;
    setDiary((current) => {
      const target = current[date] || emptyDiaryDay();
      const copy = Object.fromEntries(DIARY_SLOTS.map(({ id }) => [id, [
        ...(target[id] || []),
        ...(previousDay[id] || []).map((entry) => ({ ...entry, id: `copy:${Date.now()}:${Math.random().toString(36).slice(2)}`, source: "copied", loggedAt: new Date().toISOString() })),
      ]]));
      return { ...current, [date]: copy };
    });
  }

  function quickAddEntry(event) {
    event.preventDefault();
    const food = { name: quickAdd.name.trim(), calories: Number(quickAdd.calories), protein: 0, carbs: 0, fat: 0, source: "manual" };
    updateSlot("snacks", (entries) => [...entries, createDiaryEntry(food)]);
    setQuickAdd({ name: "", calories: "" });
  }

  function saveSelectedMeal(event) {
    event.preventDefault();
    const selected = DIARY_SLOTS.flatMap(({ id }) => day[id].filter((entry) => selectedIds.includes(entry.id)));
    if (!selected.length) return;
    const summed = dailyTotals({ breakfast: selected, lunch: [], dinner: [], snacks: [] });
    setSavedMeals((current) => [...current, {
      id: `saved:${Date.now()}`, name: savedMealName.trim(), calories: summed.calories,
      protein: summed.protein, carbs: summed.carbs, fat: summed.fat,
      ingredients: selected.map((entry) => ({ name: entry.name })), source: "saved meal",
      dietType: classifyFood({ name: selected.map((entry) => entry.name).join(" ") }),
    }]);
    setSavedMealName("");
    setSelectedIds([]);
    setShowSaveMeal(false);
  }

  function logWeight(event) {
    event.preventDefault();
    const value = Number(weightInput);
    if (!Number.isFinite(value) || value <= 0) return;
    setWeights((current) => [...current.filter((item) => item.date !== date), { date, kg: value }]);
    setWeightInput("");
  }

  return <div className="diary-page">
    <div className="page-heading"><div><div className="eyebrow"><Scale size={13} /> YOUR DAILY CHECK-IN</div><h1>Food diary</h1><p>Track what you eat, one day at a time.</p></div><button className="button button-outline" type="button" onClick={copyYesterday}><Copy size={14} /> Copy yesterday’s meals</button></div>
    <section className="diary-date-nav panel"><button className="icon-button" type="button" onClick={() => setDate(addDaysToDateKey(date, -1))} aria-label="Previous day"><ArrowLeft size={16} /></button><div><strong>{dateLabel}</strong>{date === today && <span>Today</span>}</div><button className="icon-button" type="button" onClick={() => setDate(addDaysToDateKey(date, 1))} aria-label="Next day"><ArrowRight size={16} /></button>{date !== today && <button className="button button-outline" type="button" onClick={() => setDate(today)}>Today</button>}</section>
    <section className="panel diary-summary">
      <div className="diary-summary-main"><div className={`calorie-ring ${displayedTotals.calories > nutrition.calories ? "over-goal" : ""}`} style={{ "--ring-progress": `${ringPercent}%` }} role="img" aria-label={`${displayedTotals.calories} of ${nutrition.calories} calories`}>
      <div><strong>{Math.max(0, Math.round(nutrition.calories - totals.calories)).toLocaleString()}</strong><span>kcal left</span></div>
      </div><div className="calorie-equation"><span>Goal <strong>{nutrition.calories.toLocaleString()}</strong></span><b>−</b><span>Food <strong>{displayedTotals.calories.toLocaleString()}</strong></span><b>=</b><span>Remaining <strong className={totals.calories > nutrition.calories ? "over-text" : ""}>{Math.round(nutrition.calories - totals.calories).toLocaleString()}</strong></span></div></div>
      <div className="macro-bars">{[["Protein", displayedTotals.protein, nutrition.protein, "protein"], ["Carbs", displayedTotals.carbs, nutrition.carbs, "carbs"], ["Fat", displayedTotals.fat, nutrition.fat, "fat"]].map(([name, eaten, target, className]) => <div className={`macro-bar ${className}`} key={name}><div><strong>{name}</strong><span>{eaten.toFixed(1)} / {target} g</span></div><div className="macro-track"><span style={{ width: `${Math.min(100, target ? eaten / target * 100 : 0)}%` }} /></div></div>)}</div>
    </section>
    <div className="diary-columns"><div className="diary-meals">
      {DIARY_SLOTS.map(({ id, label }) => {
        const entries = day[id] || [];
        const subtotal = Math.round(dailyTotals({ [id]: entries }).calories);
        return <section className="panel diary-slot-card" key={id}>
          <header><div><h2>{label}</h2><span>{subtotal.toLocaleString()} kcal</span></div><button className="button button-outline" type="button" onClick={() => { setActiveSlot(id); setSelectedIds([]); }}><Plus size={14} /> Add food</button></header>
          {entries.length ? <div className="diary-entry-list">{entries.map((entry) => <DiaryEntryRow key={entry.id} entry={entry} selected={selectedIds.includes(entry.id)} onSelect={() => setSelectedIds((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])} onDelete={() => updateSlot(id, (items) => items.filter((item) => item.id !== entry.id))} onSaveEdit={(changes) => setDiary((current) => ({ ...current, [date]: { ...(current[date] || emptyDiaryDay()), [id]: (current[date]?.[id] || []).map((item) => item.id === entry.id ? { ...item, ...changes } : item) } }))} profile={profile} />)}</div> : <p className="diary-empty-slot">Nothing logged yet.</p>}
        </section>;
      })}
      <form className="panel quick-add-panel" onSubmit={quickAddEntry}><div><h2>Quick add calories</h2><p>Log a calorie amount without detailed macros.</p></div><label>Food name<input required value={quickAdd.name} onChange={(event) => setQuickAdd({ ...quickAdd, name: event.target.value })} /></label><label>Calories<input required type="number" min="0" step="1" value={quickAdd.calories} onChange={(event) => setQuickAdd({ ...quickAdd, calories: event.target.value })} /></label><button className="button button-primary" type="submit">Add to snacks</button></form>
      {selectedIds.length > 0 && <div className="diary-save-toolbar"><span>{selectedIds.length} items selected</span><button className="button button-outline" type="button" onClick={() => setShowSaveMeal(!showSaveMeal)}><Save size={14} /> Save as meal</button>{showSaveMeal && <form onSubmit={saveSelectedMeal}><input required value={savedMealName} onChange={(event) => setSavedMealName(event.target.value)} placeholder="Name this meal" /><button className="button button-primary" type="submit">Save</button></form>}</div>}
    </div><aside className="diary-side">
      <section className="panel water-panel"><div className="panel-heading"><div><span className="eyebrow"><Droplets size={13} /> HYDRATION</span><h2>Water</h2></div><span>{todayWater} / {waterGoal} glasses</span></div><div className="water-glasses">{Array.from({ length: Math.min(12, Math.max(waterGoal, todayWater, 1)) }, (_, index) => <button key={index} type="button" className={index < todayWater ? "filled" : ""} aria-label={`${index + 1} glasses`} onClick={() => setWater((current) => ({ ...current, [date]: index + 1 }))}><Droplets size={17} /></button>)}</div><div className="water-actions"><button className="button button-primary" type="button" onClick={() => setWater((current) => ({ ...current, [date]: (current[date] || 0) + 1 }))}><Plus size={14} /> Add a glass</button><label>Daily goal<input type="number" min="1" max="20" value={waterGoal} onChange={(event) => setWaterGoal(Math.max(1, Number(event.target.value) || 1))} /></label></div></section>
      <section className="panel weight-panel"><div className="panel-heading"><div><span className="eyebrow"><Scale size={13} /> WEIGHT</span><h2>Weight log</h2></div></div><form onSubmit={logWeight}><label>Weight (kg)<input type="number" min="1" step="0.1" required value={weightInput} onChange={(event) => setWeightInput(event.target.value)} placeholder={String(profile.weightKg || "")} /></label><button className="button button-outline" type="submit">Log weight</button></form>{weightData.length > 1 ? <div className="weight-chart"><ResponsiveContainer width="100%" height={130}><LineChart data={weightData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 8 }} /><YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 8 }} width={28} /><Tooltip /><Line dataKey="kg" name="Weight (kg)" stroke="#6d8959" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <p className="weight-hint">Log your weight on a few days to see your trend.</p>}</section>
    </aside></div>
    {activeSlot && <FoodSearchModal slot={activeSlot} profile={profile} online={onlineRecipes} customFoods={customFoods} savedMeals={savedMeals} recentFoods={recentFoods} frequentFoods={frequentFoods} onClose={() => setActiveSlot("")} onAdd={addFood} onSaveCustom={(food) => setCustomFoods((current) => [food, ...current])} onDeleteCustom={(id) => setCustomFoods((current) => current.filter((food) => food.id !== id))} onSaveMeal={(meal) => { if (meal.id) setSavedMeals((current) => current.some((item) => item.id === meal.id) ? current.map((item) => item.id === meal.id ? { ...item, ...meal } : item) : [...current, meal]); }} onDeleteMeal={(id) => setSavedMeals((current) => current.filter((meal) => meal.id !== id))} />}
  </div>;
}

function DiaryEntryRow({ entry, selected, onSelect, onDelete, onSaveEdit, profile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: entry.name, servings: entry.servings, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat });
  const warning = conflictsWithProfile(foodRecord(entry), profile);
  function save(event) {
    event.preventDefault();
    const servings = Number(form.servings);
    if (!Number.isFinite(servings) || servings <= 0) return;
    const previousServings = Number(entry.servings) || 1;
    const scaled = scaleNutrition({
      calories: Number(form.calories) / previousServings,
      protein: Number(form.protein) / previousServings,
      carbs: Number(form.carbs) / previousServings,
      fat: Number(form.fat) / previousServings,
    }, servings);
    onSaveEdit({
      name: form.name.trim(),
      servings,
      ...scaled,
    });
    setEditing(false);
  }
  return <article className="diary-entry">
    <input className="entry-select" type="checkbox" aria-label={`Select ${entry.name} for saved meal`} checked={selected} onChange={onSelect} />
    <div className="diary-entry-main"><strong>{entry.name}</strong><span>{entry.servings} serving{entry.servings === 1 ? "" : "s"} · {Math.round(entry.calories)} kcal · P {(Math.round(Number(entry.protein) * 10) / 10).toFixed(1)}g · C {(Math.round(Number(entry.carbs) * 10) / 10).toFixed(1)}g · F {(Math.round(Number(entry.fat) * 10) / 10).toFixed(1)}g</span>{warning && <span className="safety-food-badge">Check diet / allergy</span>}</div>
    <div className="diary-entry-actions"><button type="button" className="icon-button" onClick={() => setEditing(!editing)} aria-label={`Edit ${entry.name}`}>{editing ? <X size={14} /> : "Edit"}</button><button type="button" className="icon-button danger-icon" onClick={onDelete} aria-label={`Delete ${entry.name}`}><Trash2 size={14} /></button></div>
    {editing && <form className="entry-edit-form" onSubmit={save}><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Servings<input required type="number" min="0.1" step="0.1" value={form.servings} onChange={(event) => setForm({ ...form, servings: event.target.value })} /></label>{["calories", "protein", "carbs", "fat"].map((key) => <label key={key}>{key}<input required type="number" min="0" step={key === "calories" ? "1" : "0.1"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}<button className="button button-primary" type="submit"><Check size={13} /> Save changes</button></form>}
  </article>;
}
