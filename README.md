# Gather — Personalized Meal Planner

A responsive React/Vite meal planner. The six-step questionnaire saves its draft locally, and the app generates a seven-day meal plan only after the user confirms the review screen.

## Run locally

```bash
npm install
Copy-Item .env.example .env
# Add your Spoonacular API key to .env
npm run dev
```

Open the local URL printed by Vite. `npm run dev` starts Vite and the Express recipe proxy together. To run separately, use `npm run dev:client` for Vite and `npm run dev:server` for the proxy. `npm run dev:all` is an alias for `npm run dev`. Put `SPOONACULAR_API_KEY` in the server-side `.env` file only; it is never exposed in the Vite client bundle. The app can still build plans from local recipes without an API key. For a production build, use `npm run build`; run the unit tests with `npm test`.

To scaffold an equivalent project from scratch:

```bash
npm create vite@latest personalized-meal-planner -- --template react
cd personalized-meal-planner
npm install
npm install react-router-dom recharts lucide-react
npm run dev
```

## Nutrition formulas

All constants, with source citations, live in `src/utils/nutritionConstants.js`; the pure calculation functions are in `src/utils/calorieCalculator.js`. Measurements are stored in centimeters and kilograms (1 lb = 0.453592 kg, 1 in = 2.54 cm) and shown in the user's chosen units.

- BMR defaults to Mifflin–St Jeor (1990): `10 × kg + 6.25 × cm − 5 × age + 5` (male) or `− 161` (female). Revised Harris–Benedict (Roza & Shizgal, 1984) is optional, and Katch–McArdle (`370 + 21.6 × lean mass kg`) is available only when body-fat % is entered. People who choose “Other” pick which equation (female or male) to use.
- TDEE is BMR × activity factor: 1.2, 1.375, 1.55, 1.725, or 1.9.
- Goal adjustments are ±250 kcal (mild, ~0.25 kg/week) or ±500 kcal (standard, ~0.5 kg/week). A deficit is capped at 25% of TDEE. The result is rounded to the nearest 10 kcal.
- Targets are never below 1,200 kcal (female equation) or 1,500 kcal (male equation); the app flags the clamp and recommends a doctor or registered dietitian.
- Protein is 0.8 g/kg for sedentary profiles and 1.6 g/kg for active ones (2.0 g/kg when losing weight), capped at 35% of calories. Fat is 30% of calories and carbohydrates are the remainder (4/4/9 kcal per gram).
- Inputs are validated: age 15–80, height 100–250 cm, weight 30–300 kg, body fat 3–60%. BMI uses WHO categories and is presented as a screening tool only.

These estimates are informational, not medical advice.

## Recommendation rules

The meal engine first applies non-negotiable diet, allergen, disliked-food, health-condition, and cooking-time filters. Dietary compatibility comes from each meal’s `dietType` array. Diabetes and PCOS apply sugar limits; high blood pressure applies a sodium limit; high cholesterol applies sodium and fat limits.

For remaining candidates, a bounded 0–100 score combines calorie closeness (40 points), protein closeness (25), cuisine match (15), and a base preparation-fit score (20). Repeated meals lose 20 points per prior weekly use; favorites earn 15 points, and a small random tiebreaker breaks ties. If fewer than seven meals remain in a slot, cuisine preference is relaxed first, then cooking time. Diet, allergy, dislike, and health filters are never relaxed. A selected meal is excluded from the same slot on the previous day; if no alternative satisfies the hard filters, the slot is shown as unavailable rather than repeating it.

The meal database is `src/data/meals.json`. Its ingredient quantities are per serving; the grocery page totals those amounts across the week and groups them by category.

## Online recipes, caching, and safety

The recipe provider uses a Vite `/api` proxy to a small Express server. The browser never receives the Spoonacular key. Profile filters map to Spoonacular diet, intolerance, excluded-ingredient, cuisine, prep-time, slot calorie range (±15%), and meal-type parameters. Diabetes, high blood pressure, and high cholesterol add sugar, sodium, and saturated-fat limits respectively.

Each slot search is requested in parallel during plan generation. Searches and lazily fetched recipe details are cached in local storage by request hash for seven days; cache hits avoid API requests. The dashboard combines cached/online recipes with the local `meals.json` pool. Network errors, timeouts, missing keys, and API quota/rate-limit errors automatically use local recipes. The dashboard shows an offline notice with a retry action. Settings can disable online recipes, clear the recipe cache, and display its size and this device’s API calls today.

Spoonacular filters are only an initial filter. Every normalized API meal is checked again by `mealEngine.js` against the profile’s diet, allergen terms in both the recipe name and ingredient text, dislikes, preparation time, and health-condition limits. Recipes that fail are removed; allergy and diet rules are never relaxed.
