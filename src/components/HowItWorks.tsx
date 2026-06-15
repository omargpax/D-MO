"use client";
import { Upload, Sliders, Cpu, Download } from "lucide-react";

export function HowItWorks() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 mb-4">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cómo funciona</p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800"><Upload size={18} /></div>
          <div className="text-center">1. Subir archivo</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800"><Sliders size={18} /></div>
          <div className="text-center">2. Seleccionar modo</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800"><Download size={18} /></div>
          <div className="text-center">3. Procesar y descargar</div>
        </div>
      </div>
    </div>
  );
}
