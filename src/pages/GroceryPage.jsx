import { useMemo, useState } from "react";
import { ArrowDownToLine, Check, Copy, ShoppingBasket } from "lucide-react";
import { usePlan } from "../context/PlanContext.jsx";
import { getGroceryList } from "../utils/mealEngine.js";

export default function GroceryPage() {
  const { plan, groceryChecks, setGroceryChecks } = usePlan();
  const [copied, setCopied] = useState(false);
  const items = useMemo(() => getGroceryList(plan), [plan]);
  const categories = [...new Set(items.map((item) => item.category))];
  const completedCount = items.filter((item) => groceryChecks.includes(`${item.name}|${item.unit}`)).length;

  function toggleItem(item) {
    const key = `${item.name}|${item.unit}`;
    setGroceryChecks((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
  }

  async function copyList() {
    const text = categories.map((category) => {
      const categoryItems = items.filter((item) => item.category === category);
      return `${category}\n${categoryItems.map((item) => `- ${item.name}: ${item.quantity} ${item.unit}`).join("\n")}`;
    }).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.error("Could not copy the grocery list to the clipboard.", error);
      window.print();
    }
  }

  return <div className="grocery-page">
    <div className="page-heading"><div><div className="eyebrow"><ShoppingBasket size={13} /> ONE LIST, ONE LESS THING TO THINK ABOUT</div><h1>Good things go in the basket.</h1><p>Your ingredients, gathered from every meal in this week’s plan.</p></div><div className="grocery-actions"><button className="button button-outline" type="button" onClick={copyList}><Copy size={15} />{copied ? "Copied!" : "Copy list"}</button><button className="button button-primary" type="button" onClick={() => window.print()}><ArrowDownToLine size={15} /> Print</button></div></div>
    <section className="panel grocery-panel">
      <div className="grocery-summary"><div><span className="eyebrow">YOUR WEEKLY SHOP</span><h2>{items.length} ingredients to gather</h2><p>{completedCount} of {items.length} checked off · Quantities reflect this week’s meal plan.</p></div><div className="grocery-count"><ShoppingBasket size={18} /><strong>{items.length}</strong><span>ingredients</span></div></div>
      {categories.length ? <div className="grocery-categories">{categories.map((category) => <section className="grocery-category" key={category}><h3>{category}</h3><div className="grocery-grid">{items.filter((item) => item.category === category).map((item) => {
        const key = `${item.name}|${item.unit}`;
        return <label className="grocery-item" key={key}><input type="checkbox" checked={groceryChecks.includes(key)} onChange={() => toggleItem(item)} /><span className="checkmark"><Check size={13} /></span><span className="grocery-name">{item.name}</span><small>{item.quantity} {item.unit}</small></label>;
      })}</div></section>)}</div> : <div className="empty-state"><ShoppingBasket size={30} /><h2>Your list is taking shape</h2><p>Generate a meal plan and your ingredients will appear here.</p></div>}
    </section>
  </div>;
}
