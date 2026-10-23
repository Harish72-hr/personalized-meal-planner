import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getRecipeDetails } from "../../services/recipeProvider.js";

function plainText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export default function RecipeDetailModal({ meal, onClose }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDetails(forceRefresh = false) {
    setLoading(true);
    setError("");
    try {
      setDetails(await getRecipeDetails(meal.id, {
        source: meal.source || "local",
        forceRefresh,
        fallbackRecipe: meal,
      }));
    } catch (loadError) {
      console.error("Could not load recipe details.", loadError);
      setError("Recipe details could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [meal.id]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="recipe-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title">
      <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close recipe details"><X size={18} /></button>
      {meal.image?.startsWith("http") && <img className="recipe-modal-image" src={meal.image} alt="" />}
      <div className="recipe-modal-content">
        <span className="source-badge">{meal.source === "api" ? "Spoonacular recipe" : "Local recipe"}</span>
        <h2 id="recipe-modal-title">{meal.name}</h2>
        {loading ? <p role="status">Loading ingredients and instructions…</p> : error ? <div className="inline-error" role="alert">{error}<button className="button button-outline" type="button" onClick={() => loadDetails(true)}>Retry</button></div> : <>
          {details?.detailsUnavailable && <p className="detail-offline-note" role="status">Using the cached recipe summary. Instructions are unavailable offline. <button type="button" onClick={() => loadDetails(true)}>Retry</button></p>}
          <h3>Ingredients</h3>
          <ul className="recipe-ingredient-list">{(details?.ingredients || meal.ingredients).map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>{ingredient.quantity ? `${ingredient.quantity} ${ingredient.unit} ` : ""}{ingredient.name}</li>)}</ul>
          <h3>Instructions</h3>
          <p className="recipe-instructions">{plainText(details?.instructions) || (meal.source === "api" ? "Instructions are unavailable from the cached recipe summary." : "Instructions are not available for this local recipe.")}</p>
          {meal.sourceUrl && <a className="recipe-source-link" href={meal.sourceUrl} target="_blank" rel="noreferrer">Open original recipe</a>}
        </>}
      </div>
    </section>
  </div>;
}
