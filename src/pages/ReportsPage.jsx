import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
import { useDiary } from "../context/DiaryContext.jsx";
import { useProfile } from "../context/ProfileContext.jsx";
import { calculateNutrition } from "../utils/calorieCalculator.js";
import { addDaysToDateKey, dailyTotals, emptyDiaryDay, localDateKey } from "../utils/diary.js";

export default function ReportsPage() {
  const { profile } = useProfile();
  const { diary } = useDiary();
  const [range, setRange] = useState(7);
  const nutrition = calculateNutrition(profile);
  const chartData = useMemo(() => Array.from({ length: range }, (_, index) => {
    const date = addDaysToDateKey(localDateKey(), index - range + 1);
    const totals = dailyTotals(diary[date] || emptyDiaryDay());
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" }),
      calories: totals.calories,
      goal: nutrition.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      count: totals.count,
    };
  }), [diary, range, nutrition.calories]);
  const loggedDays = chartData.filter((day) => day.count > 0);
  const average = (key) => loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day[key], 0) / loggedDays.length * 10) / 10 : 0;
  let streak = 0;
  for (let offset = 0; offset < range; offset += 1) {
    const date = addDaysToDateKey(localDateKey(), -offset);
    if (dailyTotals(diary[date] || emptyDiaryDay()).count === 0) break;
    streak += 1;
  }
  const ranked = [...loggedDays].sort((left, right) => Math.abs(left.calories - nutrition.calories) - Math.abs(right.calories - nutrition.calories));
  const bestDay = ranked[0];
  const worstDay = ranked.at(-1);

  return <div className="reports-page">
    <div className="page-heading"><div><div className="eyebrow"><ChartNoAxesCombined size={13} /> YOUR TRENDS</div><h1>Reports</h1><p>See how your logged meals add up over time.</p></div><div className="report-range" role="group" aria-label="Report date range">{[7, 30].map((days) => <button key={days} type="button" className={range === days ? "active" : ""} aria-pressed={range === days} onClick={() => setRange(days)}>{days} days</button>)}</div></div>
    <section className="reports-stats">
      <article className="panel report-stat"><span>LOGGED DAYS</span><strong>{loggedDays.length}<small> / {range}</small></strong></article>
      <article className="panel report-stat"><span>LOGGING STREAK</span><strong>{streak}<small> day{streak === 1 ? "" : "s"}</small></strong></article>
      <article className="panel report-stat"><span>AVG. CALORIES</span><strong>{Math.round(average("calories")).toLocaleString()}<small> kcal</small></strong></article>
      <article className="panel report-stat"><span>AVG. MACROS</span><strong>{average("protein")}<small>g P</small> · {average("carbs")}<small>g C</small> · {average("fat")}<small>g F</small></strong></article>
    </section>
    <section className="panel report-chart-panel"><div className="panel-heading"><div><span className="eyebrow">DAILY INTAKE</span><h2>Calories vs goal</h2></div><span className="chart-target">Goal {nutrition.calories.toLocaleString()} kcal</span></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 14, right: 10, left: -15, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 9 }} interval={range === 30 ? 3 : 0} /><YAxis tick={{ fontSize: 9 }} tickFormatter={(value) => Math.round(value)} /><Tooltip formatter={(value, name) => [`${Math.round(value).toLocaleString()} kcal`, name]} /><Bar dataKey="goal" name="Goal" fill="#dce5d5" radius={[7, 7, 0, 0]} maxBarSize={25} /><Bar dataKey="calories" name="Food" fill="#6d8959" radius={[7, 7, 0, 0]} maxBarSize={25} /></BarChart></ResponsiveContainer></div></section>
    <section className="report-highlights"><article className="panel"><span className="eyebrow">CLOSEST TO GOAL</span><h2>{bestDay ? new Date(`${bestDay.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "Not enough data yet"}</h2><p>{bestDay ? `${Math.round(bestDay.calories).toLocaleString()} kcal · ${Math.round(Math.abs(bestDay.calories - nutrition.calories)).toLocaleString()} kcal from your goal` : "Log meals to see your best and worst days."}</p></article><article className="panel"><span className="eyebrow">FARTHEST FROM GOAL</span><h2>{worstDay ? new Date(`${worstDay.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "Not enough data yet"}</h2><p>{worstDay ? `${Math.round(worstDay.calories).toLocaleString()} kcal · ${Math.round(Math.abs(worstDay.calories - nutrition.calories)).toLocaleString()} kcal from your goal` : "A few logged days will reveal your trends."}</p></article></section>
  </div>;
}
