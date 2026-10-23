import localProvider from "./localProvider.js";
import spoonacularProvider, { normalizeSpoonacularRecipe } from "./spoonacularProvider.js";
import { mealMatchesProfile } from "../utils/mealEngine.js";

const CACHE_PREFIX = "gather-recipe-cache-v1:";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const USAGE_KEY = "gather-api-usage-v1";
const TIMEOUT_MS = 12000;

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function readCache(key) {
  try {
    const entry = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${key}`) || "null");
    if (!entry) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.value;
  } catch (error) {
    console.error("Could not read recipe cache.", error);
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch (error) {
    console.error("Could not write recipe cache.", error);
  }
}

function recordApiCall() {
  const today = localDateKey();
  try {
    const usage = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: usage.date === today ? (usage.count || 0) + 1 : 1 }));
  } catch (error) {
    console.error("Could not record recipe API usage.", error);
  }
}

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function withTimeout(request) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await request(controller.signal);
  } finally {
    window.clearTimeout(timeout);
  }
}

function safeApiRecipes(recipes, profile) {
  return recipes.filter((meal) => mealMatchesProfile(meal, profile));
}

export async function searchRecipes(filters, { profile, slot, online = true, forceRefresh = false, includeUnsafe = false } = {}) {
  const cacheKey = `search:${hash(stableValue({ ...filters, slot }))}`;
  const cached = forceRefresh ? null : readCache(cacheKey);
  let apiRecipes = cached;
  let offline = false;
  let error = null;
  if (!cached && online) {
    try {
      recordApiCall();
      apiRecipes = await withTimeout((signal) => spoonacularProvider.searchRecipes(filters, { signal }));
      writeCache(cacheKey, apiRecipes);
    } catch (requestError) {
      offline = true;
      error = requestError;
      apiRecipes = [];
    }
  }
  const localRecipes = localProvider.searchRecipes({ slot });
  const normalizedApiRecipes = (apiRecipes || []).map((meal) => ({ ...meal, mealType: slot || meal.mealType }));
  const availableRecipes = includeUnsafe ? [...normalizedApiRecipes, ...localRecipes] : [
    ...safeApiRecipes(normalizedApiRecipes, profile),
    ...localRecipes.filter((meal) => mealMatchesProfile(meal, profile, { ignorePrepTime: true })),
  ];
  const unique = [...new Map(availableRecipes.map((meal) => [meal.id, meal])).values()];
  return { recipes: unique, offline, error, fromCache: Boolean(cached) };
}

export async function getRecipeDetails(id, { source = "local", forceRefresh = false, fallbackRecipe } = {}) {
  if (source !== "api") return localProvider.getRecipeDetails(id);
  const cacheKey = `detail:${hash(String(id))}`;
  const cached = forceRefresh ? null : readCache(cacheKey);
  if (cached) return cached;
  recordApiCall();
  try {
    const details = await withTimeout((signal) => spoonacularProvider.getRecipeDetails(id, { signal }));
    writeCache(cacheKey, details);
    return details;
  } catch (error) {
    if (!fallbackRecipe) throw error;
    console.warn("Recipe details unavailable; using the cached recipe summary.", error);
    return { ...fallbackRecipe, instructions: "", detailsUnavailable: true };
  }
}

export function getApiCallsToday() {
  try {
    const usage = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    return usage.date === localDateKey() ? Number(usage.count) || 0 : 0;
  } catch (error) {
    console.error("Could not read recipe API usage.", error);
    return 0;
  }
}

export function getRecipeCacheSize() {
  let bytes = 0;
  const expired = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const cached = localStorage.getItem(key) || "";
      try {
        const entry = JSON.parse(cached);
        if (Date.now() - entry.savedAt > CACHE_TTL) {
          expired.push(key);
          continue;
        }
      } catch (error) {
        console.error("Could not inspect a recipe cache entry.", error);
      }
      bytes += new Blob([cached]).size;
    }
    expired.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("Could not measure recipe cache.", error);
  }
  return bytes;
}

export function clearRecipeCache() {
  const keys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

export function normalizeApiRecipe(recipe) {
  return normalizeSpoonacularRecipe(recipe);
}

export { safeApiRecipes };
