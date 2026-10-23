import { roundTo } from "../../utils/calorieCalculator.js";

// BMR vs TDEE vs daily goal as three directly labelled horizontal bars on one kcal scale.
export default function CalorieComparisonChart({ nutrition }) {
  const rows = [
    { key: "bmr", label: "BMR", detail: "at rest", value: roundTo(nutrition.bmr, 10) },
    { key: "tdee", label: "TDEE", detail: "maintenance", value: roundTo(nutrition.tdee, 10) },
    { key: "goal", label: "Daily goal", detail: "what to eat", value: nutrition.calories },
  ];
  const max = Math.max(...rows.map((row) => row.value));
  return (
    <figure className="calorie-chart">
      <figcaption>Calories per day</figcaption>
      <ul>
        {rows.map((row) => (
          <li key={row.key} className={`calorie-bar-row calorie-bar-${row.key}`}>
            <span className="calorie-bar-label"><strong>{row.label}</strong><small>{row.detail}</small></span>
            <span className="calorie-bar-track" aria-hidden="true">
              <span className="calorie-bar" style={{ width: `${(row.value / max) * 100}%` }} title={`${row.label}: ${row.value.toLocaleString()} kcal`} />
            </span>
            <span className="calorie-bar-value">{row.value.toLocaleString()} <small>kcal</small></span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
