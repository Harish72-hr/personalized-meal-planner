import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dailyTotals, emptyDiaryDay, localDateKey, addDaysToDateKey } from "../../utils/diary.js";
import { plannedEntryNutrition } from "../../utils/mealEngine.js";

const MACRO_COLORS = ["#718f5b", "#d4a054", "#d68068"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MacroChart({ nutrition }) {
  const data = [
    { name: "Protein", calories: nutrition.protein * 4 },
    { name: "Carbs", calories: nutrition.carbs * 4 },
    { name: "Fat", calories: nutrition.fat * 9 },
  ];
  return <div className="dashboard-donut">
    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="calories" nameKey="name" innerRadius="65%" outerRadius="88%" paddingAngle={4} stroke="none">{data.map((item, index) => <Cell key={item.name} fill={MACRO_COLORS[index]} />)}</Pie><Tooltip formatter={(value, name) => [`${Math.round(value)} kcal`, name]} /></PieChart></ResponsiveContainer>
    <div className="donut-center"><strong>{Math.round(nutrition.calories).toLocaleString()}</strong><span>kcal target</span></div>
  </div>;
}

function calorieTooltip(target) {
  return (value, name) => [`${Math.round(value).toLocaleString()} kcal · ${target ? Math.round(value / target * 100) : 0}% of target`, name];
}

export default function PlanCharts({ plan, diary = {}, nutrition }) {
  const target = nutrition.calories;
  const plannedDays = (plan?.days || []).map((day, index) => ({
    day: DAY_NAMES[index],
    calories: day.meals.reduce((sum, entry) => sum + plannedEntryNutrition(entry).calories, 0),
    warning: Boolean(day.calorieWarning),
  }));
  const tallestPlannedBar = Math.max(0, ...plannedDays.map(({ calories }) => calories));
  const plannedAxisMaximum = Math.max(target, tallestPlannedBar) * 1.1;
  const today = localDateKey();
  const loggedDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDateKey(today, index - 6);
    const totals = dailyTotals(diary[date] || emptyDiaryDay());
    return {
      date,
      day: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      calories: totals.count ? totals.calories : null,
      count: totals.count,
    };
  });
  const daysWithinTarget = loggedDays.filter(({ calories, count }) =>
    count > 0 && Math.abs(calories - target) <= target * 0.1,
  ).length;
  const hasLoggedMeals = loggedDays.some(({ count }) => count > 0);

  return <section className="charts-grid">
    <article className="panel chart-panel">
      <div className="panel-heading"><div><span className="eyebrow">WEEK AT A GLANCE</span><h2>Calories by day</h2></div><span className="chart-target">Target {Math.round(target).toLocaleString()} kcal</span></div>
      <div className="plan-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={plannedDays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#92978d", fontSize: 10 }} /><YAxis domain={[0, plannedAxisMaximum]} axisLine={false} tickLine={false} tick={{ fill: "#92978d", fontSize: 9 }} /><Tooltip formatter={calorieTooltip(target)} /><ReferenceLine y={target} stroke="#cf886b" strokeDasharray="4 4" label={{ value: "Target", fill: "#a17b68", fontSize: 9, position: "insideTopRight" }} /><Bar dataKey="calories" name="Planned" radius={[5,5,0,0]} maxBarSize={35}>{plannedDays.map((day) => <Cell key={day.day} fill={day.warning ? "#d99449" : "#718f5b"} />)}</Bar></BarChart></ResponsiveContainer></div>
    </article>
    <article className="panel chart-panel">
      <div className="panel-heading"><div><span className="eyebrow">DAILY TARGET</span><h2>Macro split</h2></div></div>
      <div className="macro-panel-layout"><MacroChart nutrition={nutrition} /><div className="macro-legend">{[["Protein",nutrition.protein,"protein-dot"],["Carbs",nutrition.carbs,"carb-dot"],["Fat",nutrition.fat,"fat-dot"]].map(([name,grams,color]) => <div key={name}><i className={color} />{name}<strong>{grams}g</strong></div>)}</div></div>
      {nutrition.proteinCapApplied && <p className="protein-cap-note" role="status">Protein was capped at 35% of your calorie target.</p>}
    </article>
    <article className="panel chart-panel trend-panel">
      <div className="panel-heading"><div><span className="eyebrow">LAST 7 DAYS</span><h2>Logged calorie trend</h2></div><span className="chart-target">{daysWithinTarget} days within ±10% of target</span></div>
      {hasLoggedMeals
        ? <div className="plan-chart trend-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={loggedDays} margin={{ top: 12, right: 16, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0e9" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#92978d", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#92978d", fontSize: 9 }} /><Tooltip formatter={calorieTooltip(target)} /><ReferenceLine y={target} stroke="#cf886b" strokeDasharray="4 4" label={{ value: "Target", fill: "#a17b68", fontSize: 9, position: "insideTopRight" }} /><Line type="monotone" dataKey="calories" name="Logged" stroke="#d49c54" strokeWidth={2.5} dot={{ fill: "#d49c54", r: 3 }} activeDot={{ r: 5 }} connectNulls={false} /></LineChart></ResponsiveContainer></div>
        : <div className="empty-state chart-empty-state">Log meals in your diary to see your trend</div>}
    </article>
  </section>;
}
