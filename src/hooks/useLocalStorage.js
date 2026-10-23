import { useEffect, useState } from "react";

export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    const initial = () => (typeof initialValue === "function" ? initialValue() : initialValue);
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initial() : JSON.parse(stored);
    } catch (error) {
      console.error(`Could not read localStorage key "${key}".`, error);
      return initial();
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Could not write localStorage key "${key}".`, error);
    }
  }, [key, value]);

  return [value, setValue];
}
