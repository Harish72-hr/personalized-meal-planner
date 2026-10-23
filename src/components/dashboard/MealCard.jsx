import { Check, Heart, Plus, RefreshCw, Utensils } from "lucide-react";
import { useState } from "react";
import RecipeDetailModal from "./RecipeDetailModal.jsx";
import { plannedEntryNutrition } from "../../utils/mealEngine.js";

export default function MealCard({ entry, dayIndex, onSwap, favorite, onToggleFavorite, canSwap = true, logged = false, onLog }) {
  const [showDetails, setShowDetails] = useState(false);
  if (!entry.meal) {
    return <article className="meal-card empty-meal"><span className="meal-slot">{entry.slot}</span><p>No matching meal fits these restrictions.</p></article>;
  }
  const { meal } = entry;
  const portion = plannedEntryNutrition(entry);
  const mealLabel = [meal.name, ...(entry.sides || []).map(({ meal: side }) => side.name)].join(" + ");
  return (
    <article className="meal-card">
      <div className="meal-card-header"><span className={`meal-slot slot-${entry.slot}`}>{meal.image?.startsWith("http") ? <img className="meal-thumbnail" src={meal.image} alt="" /> : meal.image} <span>{entry.slot}</span></span><button className={`icon-button meal-favorite ${favorite ? "is-favorite" : ""}`} type="button" onClick={() => onToggleFavorite(meal.id)} aria-label={favorite ? `Remove ${meal.name} from favorites` : `Add ${meal.name} to favorites`} aria-pressed={favorite}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button></div>
      <h3>{mealLabel}</h3>
      <span className={`source-badge ${meal.source === "api" ? "source-api" : ""}`}>{meal.source === "api" ? "Spoonacular" : "Local"}</span>
      <div className="meal-meta"><span>{Math.round(portion.calories)} kcal</span><span>{meal.prepTime} min</span><span>{meal.cuisine}</span><span>{entry.servings} serving{entry.servings === 1 ? "" : "s"}{(entry.sides || []).map((side) => ` + ${side.servings} side serving${side.servings === 1 ? "" : "s"}`)}</span></div>
      <div className="meal-macros"><span><strong>{(Math.round(portion.protein * 10) / 10).toFixed(1)}g</strong> protein</span><span><strong>{(Math.round(portion.carbs * 10) / 10).toFixed(1)}g</strong> carbs</span><span><strong>{(Math.round(portion.fat * 10) / 10).toFixed(1)}g</strong> fat</span></div>
      <div className="meal-card-actions"><button className="swap-button" type="button" onClick={() => onSwap(dayIndex, entry.slot)} disabled={!canSwap}><RefreshCw size={13} /> Swap meal</button><span><Utensils size={12} /> {(Math.round(portion.sugar * 10) / 10).toFixed(1)}g sugar</span></div>
      {onLog && <button className={`button meal-log-button ${logged ? "logged" : "button-primary"}`} type="button" onClick={onLog} disabled={logged} aria-label={logged ? `${meal.name} already logged` : `Log ${meal.name}`}>{logged ? <Check size={14} /> : <Plus size={14} />} {logged ? "Logged" : "Log this meal"}</button>}
      <div className="meal-card-recipe-actions"><button type="button" onClick={() => setShowDetails(true)}>View recipe</button>{meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer">Original</a>}</div>
      {showDetails && <RecipeDetailModal meal={meal} onClose={() => setShowDetails(false)} />}
    </article>
  );
}
