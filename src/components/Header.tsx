"use client";
import { DatabaseZap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Header() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-0 rounded-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-brand-500/10 dark:bg-brand-900/20">
            <DatabaseZap size={18} className="text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">D-MO</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-none mt-0.5">Motor de transformación local</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
