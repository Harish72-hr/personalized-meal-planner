import { useId, useState } from "react";
import { Check } from "lucide-react";

// A labelled input wrapper. The error is announced and linked via aria-describedby.
export function Field({ label, unit, hint, error, className = "", children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`}>
      <label htmlFor={id}>{label}{unit && <span className="field-unit">{unit}</span>}</label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && <p className="field-hint" id={hintId}>{hint}</p>}
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  );
}

// Single-choice cards built on real radio inputs, so arrow keys and screen readers work natively.
export function RadioCards({ name, legend, hint, options, value, onChange, error, layout = "list" }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset className={`radio-cards radio-cards-${layout} ${error ? "has-error" : ""}`} aria-describedby={errorId}>
      <legend>{legend}{hint && <span className="legend-hint">{hint}</span>}</legend>
      <div className="radio-cards-options">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label key={option.value} className={`radio-card ${selected ? "selected" : ""} ${option.disabled ? "disabled" : ""}`}>
              <input type="radio" name={name} value={option.value} checked={selected} disabled={option.disabled} onChange={() => onChange(option.value)} />
              <span className="radio-dot" aria-hidden="true" />
              <span className="radio-card-text">
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {selected && <Check className="radio-card-check" size={16} aria-hidden="true" />}
            </label>
          );
        })}
      </div>
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </fieldset>
  );
}

// A number input shown in display units (e.g. lb) while the stored value stays metric.
// It keeps the typed text locally so conversion rounding never rewrites what the user is typing.
export function UnitNumberInput({ value, toDisplay, fromDisplay, decimals = 1, onChange, ...inputProps }) {
  const [text, setText] = useState(() => {
    if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "";
    const factor = 10 ** decimals;
    return String(Math.round(toDisplay(Number(value)) * factor) / factor);
  });
  return (
    <input
      type="number"
      inputMode="decimal"
      {...inputProps}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const number = Number(event.target.value);
        onChange(event.target.value === "" || !Number.isFinite(number) ? "" : fromDisplay(number));
      }}
    />
  );
}
