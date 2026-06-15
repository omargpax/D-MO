"use client";
import { useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, Terminal } from "lucide-react";
import type { LogEntry } from "@/lib/etl-engine";

type Props = { logs: LogEntry[] };

const icons: Record<LogEntry["type"], React.ReactNode> = {
  success: <CheckCircle2 size={12} className="text-brand-500 flex-shrink-0 mt-0.5" />,
  warn:    <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />,
  error:   <XCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />,
  info:    <Info size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />,
  dim:     <span className="w-3 flex-shrink-0" />,
};

const textCls: Record<LogEntry["type"], string> = {
  success: "text-brand-600 dark:text-brand-400",
  warn:    "text-amber-600 dark:text-amber-400",
  error:   "text-red-600 dark:text-red-400",
  info:    "text-slate-600 dark:text-slate-300",
  dim:     "text-slate-400 dark:text-slate-500",
};

export function LogConsole({ logs }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <Terminal size={13} className="text-slate-400" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide uppercase select-none">
          Logs de procesamiento
        </span>
        {logs.length > 0 && (
          <span className="ml-auto text-xs text-slate-300 dark:text-slate-600 font-mono">
            {logs.length} entradas
          </span>
        )}
      </div>

      <div className="h-52 overflow-y-auto scrollbar-thin p-3 space-y-0.5 font-mono">
        {logs.length === 0 ? (
          <p className="text-xs text-slate-300 dark:text-slate-700 italic pt-2 pl-1">
            // El sistema está listo. Carga un archivo para comenzar.
          </p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              {icons[l.type]}
              <span className={`text-xs leading-relaxed ${textCls[l.type]}`}>
                <span className="text-slate-300 dark:text-slate-600 mr-2 select-none">[{l.ts}]</span>
                {l.message}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
