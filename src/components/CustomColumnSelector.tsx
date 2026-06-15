"use client";
import { Check } from "lucide-react";

type Props = {
  headers: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
};

export function CustomColumnSelector({ headers, selected, onChange }: Props) {
  const toggle = (h: string) => {
    const next = new Set(selected);
    next.has(h) ? next.delete(h) : next.add(h);
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 tracking-wide uppercase">
            Selección de columnas
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{selected.size} de {headers.length} seleccionadas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onChange(new Set(headers))}
            className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            Todas
          </button>
          <button
            onClick={() => onChange(new Set())}
            className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-red-300 hover:text-red-500 transition-colors"
          >
            Ninguna
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto scrollbar-thin pr-1">
        {headers.map((h) => {
          const on = selected.has(h);
          return (
            <button
              key={h}
              onClick={() => toggle(h)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs truncate
                border transition-all duration-150
                ${on
                  ? "border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium"
                  : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-300"
                }
              `}
            >
              <div className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${on ? "border-brand-400 bg-brand-500" : "border-slate-300 dark:border-slate-600"}`}>
                {on && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              <span className="truncate">{h}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
