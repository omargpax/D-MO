"use client";
import React from "react";

type Props = { headers: string[]; rows: Record<string, unknown>[]; limit?: number };

export function PreviewTable({ headers, rows, limit = 10 }: Props) {
  const slice = rows.slice(0, limit);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 overflow-auto">
      <div className="text-xs text-slate-500 mb-2">Vista previa ({slice.length} filas)</div>
      <div className="overflow-auto">
        <table className="min-w-max w-full table-auto text-sm">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-2 py-1 text-left text-xs font-medium text-slate-500 border-b border-slate-100">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className="odd:bg-slate-50 even:bg-white dark:odd:bg-slate-900/50">
                {headers.map((h) => (
                  <td key={h} className="px-2 py-1 text-xs text-slate-700 dark:text-slate-200 truncate max-w-xs">
                    {String(r[h] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
