"use client";
import React from "react";
import type { LogEntry } from "@/lib/etl-engine";

type Props = { stats: { total: number | null; exported: number | null; cols: number | null; ms: number | null }; logs: LogEntry[] };

export function SummaryLogs({ stats, logs }: Props) {
  const errors = logs.filter((l) => l.type === "error");
  const warn = logs.filter((l) => l.type === "warn");
  const lastError = errors.length ? errors[errors.length - 1].message : null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{stats.exported ?? 0} filas procesadas</div>
          <div className="text-xs text-slate-500 mt-1">Columnas: {stats.cols ?? "—"} · Total: {stats.total ?? "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-700 dark:text-slate-200">Tiempo</div>
          <div className="text-xs text-slate-500">{stats.ms ?? "—"} ms</div>
        </div>
      </div>

      <div className="mt-3 text-xs">
        <div className="mb-1">Errores: <span className="font-medium">{errors.length}</span></div>
        {errors.length > 0 ? (
          <div className="text-xs text-red-600">{lastError}</div>
        ) : warn.length > 0 ? (
          <div className="text-xs text-amber-600">Advertencias: {warn.length}</div>
        ) : (
          <div className="text-xs text-slate-500">Sin errores reportados</div>
        )}
      </div>
    </div>
  );
}
