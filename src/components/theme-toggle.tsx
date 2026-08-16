"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("dashboard-theme");
    const shouldUseLight = storedTheme === "light";

    document.documentElement.classList.toggle("light-mode", shouldUseLight);
    setIsLight(shouldUseLight);
  }, []);

  function toggleTheme() {
    const nextIsLight = !isLight;

    document.documentElement.classList.toggle("light-mode", nextIsLight);
    window.localStorage.setItem("dashboard-theme", nextIsLight ? "light" : "dark");
    setIsLight(nextIsLight);
  }

  return (
    <button
      type="button"
      aria-pressed={isLight}
      onClick={toggleTheme}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      <span className="relative h-5 w-9 rounded-full bg-slate-200 ring-1 ring-slate-300">
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-sky-600 shadow transition ${
            isLight ? "left-4" : "left-0.5"
          }`}
        />
      </span>
      {isLight ? "Light" : "Dark"}
    </button>
  );
}
