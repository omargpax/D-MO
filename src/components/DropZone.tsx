"use client";
import { Spinner } from "@/components/Spinner";
import { useRef, useState, useCallback } from "react";
import { UploadCloud, FileSpreadsheet, X, AlertCircle } from "lucide-react";

type Props = {
  onFile: (file: File) => void;
  fileName?: string;
  fileSize?: number;
  onClear: () => void;
  loading?: boolean;          // ← NUEVO
  loadingProgress?: string;   // ← NUEVO: texto descriptivo del estado
  maxMB?: number;             // ← NUEVO: límite configurable (default 200 MB)
};

const ALLOWED = [".xls", ".xlsx", ".xlsb", ".csv"];

export function DropZone({
  onFile, fileName, fileSize, onClear,
  loading = false,
  loadingProgress,
  maxMB = 200,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  const handle = useCallback((f: File) => {
    setSizeError(null);
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();

    if (!ALLOWED.includes(ext)) {
      setSizeError(`Tipo de archivo no soportado: ${ext.toUpperCase()}`);
      return;
    }

    const fileMB = f.size / (1024 * 1024);
    if (fileMB > maxMB) {
      setSizeError(
        `El archivo pesa ${fileMB.toFixed(1)} MB y supera el límite de ${maxMB} MB.`
      );
      return;
    }

    onFile(f);
  }, [onFile, maxMB]);

  const isActive = !fileName && !loading;

  return (
    <div className="space-y-2">
      <div
        role={isActive ? "button" : undefined}
        tabIndex={isActive ? 0 : undefined}
        onClick={() => isActive && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && isActive && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (isActive) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f && isActive) handle(f);
        }}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-xl border-2 border-dashed px-6 py-10
          transition-all duration-200
          ${isActive ? "cursor-pointer" : "cursor-default"}
          ${loading
            ? "border-brand-300 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10"
            : fileName
              ? "border-brand-400 bg-brand-50 dark:bg-brand-900/10"
              : dragging
                ? "border-brand-400 bg-brand-50 dark:bg-brand-900/10 scale-[1.01]"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".xls,.xlsx,.xlsb,.csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ""; }}
        />

        {/* ── Estado: cargando ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-2">
            <Spinner />
            <div className="text-center">
              <p className="text-sm font-medium text-green-600 min-w-[180px]">
                {loadingProgress ?? "Leyendo archivo…"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Procesamiento local · los datos no salen del navegador
              </p>
            </div>
          </div>
        )}
        {/* ── Estado: archivo cargado ── */}
        {!loading && fileName && (
          <>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                <FileSpreadsheet size={20} className="text-brand-600 dark:text-brand-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-xs">
                  {fileName}
                </p>
                {fileSize !== undefined && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fileSize >= 1024 * 1024
                      ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
                      : `${(fileSize / 1024).toFixed(1)} KB`}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setSizeError(null); onClear(); }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X size={12} /> Cambiar archivo
            </button>
          </>
        )}

        {/* ── Estado: idle ── */}
        {!loading && !fileName && (
          <>
            <div className={`p-3 rounded-xl transition-colors duration-200 ${dragging ? "bg-brand-100 dark:bg-brand-900/30" : "bg-slate-100 dark:bg-slate-800"}`}>
              <UploadCloud size={22} className={`transition-colors ${dragging ? "text-brand-500" : "text-slate-400"}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Arrastra tu archivo o haz clic para subir
              </p>
              <p className="text-xs text-slate-400 mt-1">
                XLS · XLSX · XLSB · CSV · máx. {maxMB} MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Error de validación ── */}
      {sizeError && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">{sizeError}</p>
        </div>
      )}
    </div>
  );
}