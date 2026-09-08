import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "pyo-theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode / blocked storage */
  }
  return "system";
}

/** Persisted light/dark/system toggle. Writes data-theme on <html>. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const cycle = useCallback(() => {
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  }, []);

  return [theme, cycle];
}
