type Stat = { label: string; value: string | number | null };

export function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-center"
        >
          <p className={`text-xl font-semibold tabular-nums ${s.value !== null ? "text-brand-600 dark:text-brand-400" : "text-slate-300 dark:text-slate-700"}`}>
            {s.value ?? "—"}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 tracking-wide">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
