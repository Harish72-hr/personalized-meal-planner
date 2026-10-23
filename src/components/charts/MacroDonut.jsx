import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#718f5b", "#d4a054", "#d68068"];

export default function MacroDonut({ nutrition, compact = false, size = compact ? 190 : 220 }) {
  const data = [
    { name: "Protein", value: nutrition.protein, grams: nutrition.protein, calories: nutrition.protein * 4 },
    { name: "Carbs", value: nutrition.carbs, grams: nutrition.carbs, calories: nutrition.carbs * 4 },
    { name: "Fat", value: nutrition.fat, grams: nutrition.fat, calories: nutrition.fat * 9 },
  ];
  const label = `Macro split: ${data.map((entry) => `${entry.name} ${entry.grams} g`).join(", ")}`;
  return (
    <div className="macro-donut" style={{ width: size, height: size }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="calories" nameKey="name" innerRadius="65%" outerRadius="88%" paddingAngle={4} stroke="none" isAnimationActive={false}>
            {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index]} />)}
          </Pie>
          <Tooltip formatter={(value, name) => [`${Math.round(value)} kcal`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center" aria-hidden="true"><strong>{nutrition.calories.toLocaleString()}</strong><span>kcal / day</span></div>
    </div>
  );
}
