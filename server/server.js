import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;
const apiKey = process.env.SPOONACULAR_API_KEY;
const apiBaseUrl = "https://api.spoonacular.com";
const allowedSearchParams = new Set([
  "diet", "intolerances", "excludeIngredients", "cuisine", "maxReadyTime",
  "minCalories", "maxCalories", "maxSugar", "maxSodium", "maxSaturatedFat",
  "type", "addRecipeNutrition", "number", "offset",
]);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || /^http:\/\/localhost:\d+$/ }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));

async function forward(url, res) {
  if (!apiKey) {
    return res.status(503).json({ error: "Recipe API is not configured. Add SPOONACULAR_API_KEY to the server environment." });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    res.status(response.status).type(response.headers.get("content-type") || "application/json").send(body);
  } catch (error) {
    console.error("Spoonacular request failed.", error);
    res.status(error.name === "AbortError" ? 504 : 502).json({ error: "Recipe provider is temporarily unavailable." });
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/api/recipes/search", async (req, res) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (!allowedSearchParams.has(key) || typeof value !== "string") continue;
    params.set(key, value);
  }
  params.set("apiKey", apiKey || "");
  await forward(`${apiBaseUrl}/recipes/complexSearch?${params}`, res);
});

app.get("/api/recipes/:id/details", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Recipe id must be numeric." });
  const url = new URL(`${apiBaseUrl}/recipes/${req.params.id}/information`);
  url.searchParams.set("includeNutrition", "true");
  url.searchParams.set("apiKey", apiKey || "");
  await forward(url.toString(), res);
});

app.listen(port, () => {
  console.log(`Recipe proxy listening on http://localhost:${port}`);
});
