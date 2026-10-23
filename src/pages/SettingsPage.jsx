import { useEffect, useState } from "react";
import { Database, Settings } from "lucide-react";
import { usePlan } from "../context/PlanContext.jsx";
import { clearRecipeCache, getApiCallsToday, getRecipeCacheSize } from "../services/recipeProvider.js";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SettingsPage() {
  const { onlineRecipes, setOnlineRecipes } = usePlan();
  const [cacheSize, setCacheSize] = useState(0);
  const [callsToday, setCallsToday] = useState(0);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    setCacheSize(getRecipeCacheSize());
    setCallsToday(getApiCallsToday());
  }, []);

  function clearCache() {
    clearRecipeCache();
    setCacheSize(getRecipeCacheSize());
    setCacheCleared(true);
  }

  return <div className="settings-page">
    <div className="page-heading"><div><div className="eyebrow"><Settings size={13} /> YOUR PREFERENCES</div><h1>Settings</h1><p>Choose how recipes are fetched and stored on this device.</p></div></div>
    <section className="panel settings-panel">
      <div className="settings-row"><div><strong>Use online recipes</strong><p>Search Spoonacular for more recipe options. Your local recipes remain available as a fallback.</p></div><label className="settings-toggle"><input type="checkbox" checked={onlineRecipes} onChange={(event) => setOnlineRecipes(event.target.checked)} /><span>{onlineRecipes ? "On" : "Off"}</span></label></div>
      <div className="settings-row"><div><strong><Database size={15} /> Recipe cache</strong><p>{formatBytes(cacheSize)} stored locally · Cached searches and details expire after 7 days.</p></div><button className="button button-outline" type="button" onClick={clearCache}>Clear cache</button></div>
      {cacheCleared && <p className="settings-confirmation" role="status">Recipe cache cleared.</p>}
      <div className="settings-row"><div><strong>API calls used today</strong><p>Calls made from this device today. Cache hits are not counted.</p></div><strong className="settings-call-count">{callsToday}</strong></div>
    </section>
  </div>;
}
