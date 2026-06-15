"use client";
import { useState, useCallback } from "react";
import { DatabaseZap, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropZone } from "@/components/DropZone";
import { CustomColumnSelector } from "@/components/CustomColumnSelector";
import { LogConsole } from "@/components/LogConsole";
import { StatsBar } from "@/components/StatsBar";
import { parseExcel, parseCSV, exportFile } from "@/lib/file-parser";
import {
  processClientes, processClientesIN, processClientesOUT,
  processColocaciones, processCartera, processFondoComun,
  processCustom, type LogEntry, type ETLResult,
} from "@/lib/etl-engine";

const RFE_REPORTS = [
  { value: "clientes", label: "Clientes" },
  { value: "clientes_in", label: "Clientes IN" },
  { value: "clientes_out", label: "Clientes OUT" },
  { value: "colocaciones", label: "Colocaciones" },
  { value: "cartera", label: "Cartera" },
  { value: "fondo_comun", label: "Fondo Común" },
];

const OUTPUT_FORMATS = [
  { value: "xlsx", label: "XLSX" },
  { value: "csv", label: "CSV" },
  { value: "xls", label: "XLS" },
  { value: "xlsb", label: "XLSB" },
];

function mkLog(type: LogEntry["type"], message: string): LogEntry {
  return { type, message, ts: new Date().toISOString().split("T")[1].split(".")[0] };
}

type FileState = {
  name: string;
  size: number;
  data: Record<string, unknown>[];
  headers: string[];
  isCSV: boolean;
  csvDelimiter?: string;
  rawRows?: unknown[][];
  headerRowIndex?: number;
};

export default function Home() {
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>("");
  const [kpi, setKpi] = useState("RFE");
  const [report, setReport] = useState("clientes");
  const [outputFormat, setOutputFormat] = useState("xlsx");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<{ total: number | null; exported: number | null; cols: number | null; ms: number | null }>({
    total: null, exported: null, cols: null, ms: null,
  });

  const handleFile = useCallback((file: File) => {
    setLoadingFile(true);
    setLoadingProgress("Leyendo archivo…");
    setLogs([]);
    setStats({ total: null, exported: null, cols: null, ms: null });

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const fileMB = file.size / (1024 * 1024);

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable && fileMB > 10) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setLoadingProgress(`Leyendo archivo… ${pct}%`);
      }
    };

    reader.onload = (e) => {
      try {
        setLoadingProgress("Detectando estructura…");
        let parsed;
        const initLogs: LogEntry[] = [];

        if (ext === ".csv") {
          parsed = parseCSV(e.target!.result as string);
          initLogs.push(mkLog("info", `Archivo CSV cargado: ${file.name}`));
          initLogs.push(mkLog("info", `Delimitador detectado: "${parsed.csvDelimiter === "\t" ? "\\t (tab)" : parsed.csvDelimiter}"`));
        } else {
          parsed = parseExcel(e.target!.result as ArrayBuffer);
          initLogs.push(mkLog("info", `Archivo Excel cargado: ${file.name}`));
          initLogs.push(mkLog("dim", `Hoja activa: "${parsed.sheetName}"`));
        }

        initLogs.push(mkLog("dim", `${parsed.data.length} filas · ${parsed.headers.length} columnas detectadas`));
        if (fileMB >= 1) {
          initLogs.push(mkLog("dim", `Tamaño: ${fileMB.toFixed(1)} MB`));
        }

        setFileState({
          name: file.name,
          size: file.size,
          data: parsed.data,
          headers: parsed.headers,
          isCSV: parsed.isCSV,
          csvDelimiter: parsed.csvDelimiter,
          rawRows: parsed.rawRows,
          headerRowIndex: parsed.headerRowIndex,
        });
        setSelectedCols(new Set(parsed.headers));
        setLogs(initLogs);
      } catch (err) {
        setLogs([mkLog("error", `[ERROR] No se pudo leer el archivo: ${(err as Error).message}`)]);
      } finally {
        setLoadingFile(false);
        setLoadingProgress("");
      }
    };

    reader.onerror = () => {
      setLogs([mkLog("error", "[ERROR] Fallo al leer el archivo.")]);
      setLoadingFile(false);
      setLoadingProgress("");
    };

    ext === ".csv" ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
  }, []);

  const handleKpiChange = (val: string) => {
    setKpi(val);
    if (val === "CUSTOM" && !fileState) {
      setLogs((prev) => [...prev, mkLog("warn", "[ADVERTENCIA] Carga un archivo antes de activar el modo Custom.")]);
    }
    if (val === "RFE") setReport("clientes");
  };

  const handleProcess = async () => {
    if (!fileState) return;
    setProcessing(true);
    const t0 = performance.now();
    const runLogs: LogEntry[] = [
      mkLog("info", "══════════════════════════════════════════"),
      mkLog("info", "  INICIANDO MOTOR D-MO PROCESSOR"),
      mkLog("info", "══════════════════════════════════════════"),
      mkLog("dim", `  KPI    : ${kpi}`),
      mkLog("dim", `  REPORTE: ${kpi === "CUSTOM" ? "CUSTOM (selección manual)" : report.toUpperCase()}`),
      mkLog("dim", `  SALIDA : ${outputFormat.toUpperCase()}`),
      mkLog("dim", `  INICIO : ${new Date().toISOString()}`),
      mkLog("info", "──────────────────────────────────────────"),
    ];

    let result: ETLResult | null = null;
    try {
      if (kpi === "CUSTOM") {
        result = processCustom(fileState.data, Array.from(selectedCols), runLogs);
      } else {
        switch (report) {
          case "clientes": result = processClientes(fileState.data, fileState.headers); break;
          case "clientes_in": result = processClientesIN(fileState.data, fileState.headers); break;
          case "clientes_out": result = processClientesOUT(fileState.data, fileState.headers); break;
          case "colocaciones": result = processColocaciones(fileState.data, fileState.headers); break;
          case "cartera": result = processCartera(fileState.data, fileState.headers); break;
          case "fondo_comun":
            result = processFondoComun(
              fileState.data,
              fileState.headers,
              fileState.rawRows,        // ← pasa las filas crudas para el ajuste estructural
              fileState.headerRowIndex
            );
            break;
          default: result = { rows: fileState.data, cols: fileState.headers, logs: [] };
        }
        runLogs.push(...result.logs);
      }

      const REPORT_LABELS: Record<string, string> = {
        clientes: "CBC",
        clientes_in: "CBC_IN",
        clientes_out: "CBC_OUT",
        colocaciones: "COLOC",
        cartera: "CART",
        fondo_comun: "FC_BC",
      };

      const reportLabel = kpi === "CUSTOM" ? "CUSTOM" : REPORT_LABELS[report] || report;
      exportFile(result.rows, result.cols, outputFormat, reportLabel);

      const elapsed = Math.round(performance.now() - t0);
      runLogs.push(mkLog("dim", `  FIN    : ${new Date().toISOString()}`));
      runLogs.push(mkLog("success", "══════════════════════════════════════════"));
      runLogs.push(mkLog("success", `  ✔  EXPORTACIÓN EXITOSA`));
      runLogs.push(mkLog("success", `     Filas exportadas : ${result.rows.length}`));
      runLogs.push(mkLog("success", `     Columnas finales : ${result.cols.length}`));
      runLogs.push(mkLog("success", `     Tiempo total     : ${elapsed} ms`));
      runLogs.push(mkLog("success", "══════════════════════════════════════════"));

      setStats({ total: fileState.data.length, exported: result.rows.length, cols: result.cols.length, ms: elapsed });
    } catch (err) {
      runLogs.push(mkLog("error", `[ERROR] ${(err as Error).message}`));
    }

    setLogs(runLogs);
    setProcessing(false);
  };

  const SelectField = ({
    label, value, onChange, options, disabled,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    disabled?: boolean;
  }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="
            w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-800
            bg-white dark:bg-slate-900
            text-slate-700 dark:text-slate-200
            text-sm px-3 py-2.5 pr-8
            focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-150
          "
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-500/10">
              <DatabaseZap size={18} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                D-MO
              </h1>
              <p className="text-xs text-slate-400 leading-none mt-0.5">Motor de transformación local</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Drop zone */}
        <div className="mb-4">
          <DropZone
            onFile={handleFile}
            fileName={fileState?.name}
            fileSize={fileState?.size}
            onClear={() => {
              setFileState(null);
              setLogs([]);
              setStats({ total: null, exported: null, cols: null, ms: null });
            }}
            loading={loadingFile}
            loadingProgress={loadingProgress}
            maxMB={200}
          />
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <SelectField
            label="KPI"
            value={kpi}
            onChange={handleKpiChange}
            options={[{ value: "RFE", label: "RFE" }, { value: "CUSTOM", label: "Custom" }]}
          />
          <SelectField
            label="Reporte"
            value={report}
            onChange={setReport}
            options={kpi === "RFE" ? RFE_REPORTS : [{ value: "custom", label: "— Selección manual —" }]}
            disabled={kpi === "CUSTOM"}
          />
          <SelectField
            label="Formato de salida"
            value={outputFormat}
            onChange={setOutputFormat}
            options={OUTPUT_FORMATS}
          />
        </div>

        {/* Custom column picker */}
        {kpi === "CUSTOM" && fileState && (
          <div className="mb-4">
            <CustomColumnSelector
              headers={fileState.headers}
              selected={selectedCols}
              onChange={setSelectedCols}
            />
          </div>
        )}

        {/* Process button */}
        <button
          onClick={handleProcess}
          disabled={!fileState || processing || loadingFile}
          className="
            w-full py-2.5 rounded-lg text-sm font-medium tracking-wide
            bg-brand-500 hover:bg-brand-600 active:bg-brand-700
            text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-150
            shadow-sm hover:shadow-md
            mb-4
          "
        >
          {processing ? "Procesando…" : "Procesar y exportar"}
        </button>

        {/* Console */}
        <div className="mb-4">
          <LogConsole logs={logs} />
        </div>

        {/* Stats */}
        <StatsBar stats={[
          { label: "Total filas", value: stats.total },
          { label: "Exportadas", value: stats.exported },
          { label: "Columnas", value: stats.cols },
          { label: "Tiempo (ms)", value: stats.ms },
        ]} />

        <p className="text-center text-xs text-slate-300 dark:text-slate-700 mt-6">
          Procesamiento 100% local · Sin envío de datos
        </p>

        {/* Developer Badge */}
        <p className="text-center text-xs text-slate-300 dark:text-slate-700 mt-2">
          <span>Developed by </span>
          <a
            href="https://omargpax.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-600 hover:text-brand-500 transition-colors cursor-pointer"
          >
            @omargpax
          </a>

        </p>

      </div>
    </div>
  );
}
