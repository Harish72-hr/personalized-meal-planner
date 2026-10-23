import { useMemo, useState } from "react";
import { Heart, Search, Sparkles } from "lucide-react";
import { usePlan } from "../context/PlanContext.jsx";
import { useProfile } from "../context/ProfileContext.jsx";
import MealCard from "../components/dashboard/MealCard.jsx";
import { calculateNutrition } from "../utils/calorieCalculator.js";
import { meals } from "../utils/mealEngine.js";
import { createRecipePlan } from "../services/planRecipeService.js";

export default function FavoritesPage() {
  const { profile } = useProfile();
  const { plan, setPlan, favorites, setFavorites, setGroceryChecks, onlineRecipes } = usePlan();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nutrition = useMemo(() => calculateNutrition(profile), [profile]);
  const availableMeals = [...new Map([...meals, ...(plan?.candidatePool || [])].map((meal) => [meal.id, meal])).values()];
  const savedMeals = availableMeals.filter((meal) => favorites.includes(meal.id) && meal.name.toLowerCase().includes(search.toLowerCase()));

  function toggleFavorite(id) {
    setFavorites((current) => current.filter((favorite) => favorite !== id));
  }

  async function planFromFavorites() {
    setLoading(true);
    setError("");
    try {
      setPlan(await createRecipePlan(profile, nutrition, favorites, { online: onlineRecipes }));
      setGroceryChecks([]);
    } catch (planError) {
      console.error("Could not create a plan from favorites.", planError);
      setError("We couldn’t create a plan from your favorites. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="favorites-page">
    <div className="page-heading"><div><div className="eyebrow"><Heart size={13} /> A COLLECTION OF YOUR YESes</div><h1>Your feel-good favorites.</h1><p>Keep the meals you love close, and let them inspire your next week.</p></div></div>
    {favorites.length > 0 && <div className="favorite-toolbar"><span><strong>{favorites.length}</strong> saved meals</span><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your favorites" /></label></div>}
    {error && <div className="inline-error" role="alert">{error}</div>}
    {savedMeals.length ? <><div className="favorite-grid">{savedMeals.map((meal) => <article className="favorite-wrap" key={meal.id}><div className="favorite-art">{meal.image?.startsWith("http") ? <img src={meal.image} alt="" /> : <span>{meal.image}</span>}<span>{meal.cuisine}</span></div><MealCard entry={{ slot: meal.mealType, meal }} dayIndex={0} onSwap={() => {}} favorite onToggleFavorite={() => toggleFavorite(meal.id)} canSwap={false} /></article>)}</div><button className="button button-outline favorites-apply" type="button" onClick={planFromFavorites} disabled={loading}><Sparkles size={15} /> {loading ? "Building your plan…" : "Regenerate plan with favorites"}</button></> : favorites.length ? <div className="empty-state panel"><Search size={27} /><h2>No saved meals match</h2><p>Try another search term.</p></div> : <div className="empty-state panel"><div className="empty-heart"><Heart size={34} /></div><h2>Your favorites are waiting</h2><p>Tap the heart on any meal in your weekly plan to save it here.</p></div>}
    {plan?.days?.length ? <p className="favorites-hint">Favorites get an extra boost when you regenerate your plan.</p> : null}
  </div>;
}
