"use client";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Cambiar tema"
      className="
        inline-flex items-center justify-center w-9 h-9 rounded-lg
        border border-slate-200 dark:border-slate-800
        bg-white dark:bg-slate-900
        text-slate-500 dark:text-slate-400
        hover:text-slate-700 dark:hover:text-slate-200
        hover:border-slate-300 dark:hover:border-slate-700
        transition-all duration-200
        shadow-sm
      "
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
