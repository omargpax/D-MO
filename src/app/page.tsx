"use client";
import { useState, useCallback } from "react";
import { DatabaseZap, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropZone } from "@/components/DropZone";
import { CustomColumnSelector } from "@/components/CustomColumnSelector";
import { LogConsole } from "@/components/LogConsole";
import { StatsBar } from "@/components/StatsBar";
import { HowItWorks } from "@/components/HowItWorks";
import { PreviewTable } from "@/components/PreviewTable";
import { SummaryLogs } from "@/components/SummaryLogs";
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

function normalizeKey(k: string) {
  return k.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const EXPECTED_COLUMNS: Record<string, string[]> = {
  clientes: ["estado bc", "cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "situación"],
  clientes_in: ["AGENCIA", "CODIGO AS", "ASESOR DE SERVICIO", "CODIGO AC", "ASOCIACION COMUNAL", "CODIGO CLIENTE", "NOMBRE CLIENTE", "TIPO SOCIO", "Mes"],
  clientes_out: ["AGENCIA", "CODIGO AS", "ASESOR DE SERVICIO", "CODIGO AC", "ASOCIACION COMUNAL", "CODIGO CLIENTE", "NOMBRE CLIENTE", "TIPO SOCIO", "MOTIVO SALIDA", "Mes"],
  colocaciones: ["cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "cod_cliente", "cliente", "num_credito", "monto_colocado"],
  cartera: ["cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "num_credito", "tipo_credito", "monto_colocado", "saldo_total"],
  fondo_comun: ["Nombre Agencia", "Asesor de banca comunal", "Nro de operación", "Codigo de bc", "Nombre banca comunal", "Monto desembolsado"],
};

function getMockSample(report: string, kpi: string) {
  if (kpi === "CUSTOM") {
    return {
      name: "inventario_demo.csv",
      headers: ["producto_id", "nombre_producto", "sku", "cantidad", "ubicacion", "estado", "ultima_actualizacion"],
      data: Array.from({ length: 8 }).map((_, i) => ({
        producto_id: `P-${1000 + i}`,
        nombre_producto: `Producto ${String.fromCharCode(65 + i)}`,
        sku: `SKU-${200 + i}`,
        cantidad: 10 + i * 5,
        ubicacion: [`Bodega A`, `Bodega B`, `Sucursal 1`, `Sucursal 2`][i % 4],
        estado: i % 2 === 0 ? "En stock" : "Reservado",
        ultima_actualizacion: `2026-06-${10 + i}`,
      })),
    };
  }

  return null;
}

function ColumnValidation({ fileHeaders, report }: { fileHeaders: string[]; report: string }) {
  const expected = EXPECTED_COLUMNS[report] || [];
  const normMap: Record<string, string> = {};
  fileHeaders.forEach((h) => { normMap[normalizeKey(h)] = h; });

  const status = expected.map((e) => ({
    expected: e,
    found: !!normMap[normalizeKey(e)],
  }));

  const extras = fileHeaders.filter((h) => !expected.some((e) => normalizeKey(e) === normalizeKey(h)));

  return (
    <div className="mt-2 grid grid-cols-1 gap-2 text-xs">
      <div className="flex flex-wrap gap-2">
        {status.map((s) => (
          <div key={s.expected} className={`px-2 py-1 rounded-md ${s.found ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {s.found ? "✅" : "⚠"} {s.expected}
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-400">Columnas detectadas: {fileHeaders.length} · Extras: {extras.length}</div>
    </div>
  );
}

type ScoreResult = { reporte: string; score: number; matched: number; total: number };

const RFE_SCHEMAS = EXPECTED_COLUMNS; // reuse expected columns as schemas for detection

// Reports that should be treated as equivalent for detection/suggestions
const EQUIVALENT_REPORT_GROUPS: string[][] = [
  ["cartera", "colocaciones"],
];

function reportsInSameGroup(a: string, b: string) {
  if (!a || !b) return false;
  for (const g of EQUIVALENT_REPORT_GROUPS) {
    if (g.includes(a) && g.includes(b)) return true;
  }
  return false;
}

function calculateCompatibility(fileColumns: string[], schema: string[], reporteName = ""): ScoreResult {
  const fileSet = new Set(fileColumns.map((c) => normalizeKey(String(c))));
  const normSchema = schema.map((s) => normalizeKey(String(s)));
  let matched = 0;
  for (const s of normSchema) if (fileSet.has(s)) matched++;
  const total = normSchema.length || 0;
  const score = total === 0 ? 0 : matched / total;
  return { reporte: reporteName, score, matched, total };
}

function detectBestMatch(fileColumns: string[]) {
  const results: ScoreResult[] = Object.entries(RFE_SCHEMAS).map(([reporte, schema]) =>
    calculateCompatibility(fileColumns, schema, reporte)
  );
  results.sort((a, b) => b.score - a.score);
  return results;
}

function getValidationState(score: number) {
  if (score > 0.85) return "success";
  if (score > 0.6) return "warning";
  return "error";
}

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
  const [kpi, setKpi] = useState("CUSTOM");
  const [report, setReport] = useState("custom");
  const [outputFormat, setOutputFormat] = useState("csv");
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>("");
  const [stats, setStats] = useState<{ total: number | null; exported: number | null; cols: number | null; ms: number | null }>({
    total: null, exported: null, cols: null, ms: null,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [detectionResults, setDetectionResults] = useState<{
    reporte: string;
    score: number;
    matched: number;
    total: number;
  }[] | null>(null);
  const [bestMatch, setBestMatch] = useState<{ reporte: string; score: number; matched: number; total: number } | null>(null);
  const [validationState, setValidationState] = useState<string | null>(null);

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
        setHasRun(false);
        setShowPreview(true);
        // run detection on the parsed headers (use normalized keys)
        try {
          const results = detectBestMatch(parsed.headers || []);
          setDetectionResults(results);
          setBestMatch(results.length ? results[0] : null);
          // compute validation for currently selected report if applicable
          if (RFE_SCHEMAS[report]) {
            const sel = calculateCompatibility(parsed.headers || [], RFE_SCHEMAS[report], report);
            setValidationState(getValidationState(sel.score));
          } else {
            setValidationState(null);
          }
        } catch (e) {
          // ignore detection errors
          setDetectionResults(null);
          setBestMatch(null);
          setValidationState(null);
        }
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
    setShowPreview(false);
    setProcessingMessage("Procesando columnas...");
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
        setProcessingMessage("Aplicando reglas...");
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
        setProcessingMessage("");
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
    setHasRun(true);
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

        <HowItWorks />

        {/* Drop zone */}
        <div className="mb-3">
          <DropZone
            onFile={handleFile}
            fileName={fileState?.name}
            fileSize={fileState?.size}
            onClear={() => {
              setFileState(null);
              setLogs([]);
              setStats({ total: null, exported: null, cols: null, ms: null });
              setHasRun(false);
              setDetectionResults(null);
              setBestMatch(null);
              setValidationState(null);
            }}
            loading={loadingFile}
            loadingProgress={loadingProgress}
            maxMB={200}
          />

          <div className="flex items-center justify-between mt-2 gap-3">
            <p className="text-xs text-slate-500">Procesamiento local</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const sample = getMockSample(report, kpi);
                  if (!sample) return;
                  setFileState({ name: sample.name, size: 12345, data: sample.data, headers: sample.headers, isCSV: true });
                  setSelectedCols(new Set(sample.headers));
                  setLogs([mkLog("info", "Dataset de prueba cargado para CUSTOM.")]);
                  setHasRun(false);
                  setShowPreview(true);
                  // run detection for test sample as well
                  const results = detectBestMatch(sample.headers || []);
                  setDetectionResults(results);
                  setBestMatch(results.length ? results[0] : null);
                  setValidationState(null);
                }}
                disabled={kpi !== "CUSTOM"}
                title={kpi !== "CUSTOM" ? "Solo disponible en modo CUSTOM" : undefined}
                className={`text-xs px-3 py-1.5 rounded-md border ${kpi !== "CUSTOM" ? "border-slate-100 bg-slate-50/40 text-slate-400 cursor-not-allowed" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"}`}
              >
                Usar datos de prueba
              </button>
            </div>
          </div>
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

        {/* Export formats info removed from this location; moved to About D-MO in footer */}

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

        {/* Column validation (RFE) */}
        {/* Detection summary & suggestion */}
        {fileState && detectionResults && (
          <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 text-xs text-slate-600">
                <div className="font-medium text-slate-700 dark:text-slate-200">Archivo analizado</div>
                <div className="mt-1 text-xs text-slate-500">
                  ✔ {fileState.headers.length} columnas detectadas · {
                    RFE_SCHEMAS[report]
                      ? `${calculateCompatibility(fileState.headers, RFE_SCHEMAS[report], report).matched} coinciden con ${report}`
                      : "— Selección manual —"
                  }
                </div>
              </div>
              <div className="text-right">
                {bestMatch && (
                  <div className="text-xs">
                    <div className="text-slate-500">Mejor coincidencia:</div>
                    <div className="font-medium text-slate-700 dark:text-slate-200">{bestMatch.reporte} ({Math.round(bestMatch.score * 100)}%)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Suggestion */}
            {kpi === "RFE" && bestMatch && bestMatch.reporte !== report && bestMatch.score > 0.7 && !reportsInSameGroup(report, bestMatch.reporte) && (
              <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-100 text-amber-800 text-sm">
                <div className="font-medium">⚠ Posible error de selección de reporte</div>
                <div className="mt-1">Este archivo coincide más con: <span className="font-semibold">{bestMatch.reporte}</span> ({Math.round(bestMatch.score * 100)}%)</div>
                <div className="mt-2">
                  <button
                    onClick={() => {
                      if (!bestMatch) return;
                      setReport(bestMatch.reporte);
                      setLogs((l) => [...l, mkLog("info", `Reporte cambiado automáticamente a ${bestMatch.reporte}`)]);
                      setValidationState(getValidationState(bestMatch.score));
                    }}
                    className="mt-1 inline-flex items-center gap-2 text-xs px-3 py-1 rounded-md bg-amber-600 text-white"
                  >
                    Cambiar automáticamente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Column validation (RFE) */}
        {fileState && kpi === "RFE" && (
          <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Validación de columnas (RFE)</p>
            <ColumnValidation fileHeaders={fileState.headers} report={report} />
          </div>
        )}

        {/* Preview */}
        {fileState && showPreview && (
          <div className="mb-4">
            <PreviewTable headers={fileState.headers} rows={fileState.data} limit={10} />
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
          {processing ? (processingMessage || "Procesando…") : "Procesar y descargar"}
        </button>

        {/* Console / Resultado */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Resultado</p>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowTechnicalLogs((s) => !s)}
                disabled={!hasRun}
                className={`text-xs px-2 py-1 rounded-md border text-slate-600 ${hasRun ? "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800" : "border-slate-100 bg-slate-50/40 opacity-50 cursor-not-allowed"}`}
              >
                {showTechnicalLogs ? "Ocultar logs técnicos" : "Ver logs técnicos"}
              </button>
            </div>
          </div>

          {showTechnicalLogs ? (
            <LogConsole logs={logs} />
          ) : (
            <SummaryLogs stats={stats} logs={logs} />
          )}
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
          <span className="mx-2">·</span>
          <a href="/about" className="text-xs font-medium text-brand-600 hover:text-brand-500 underline">About D-MO</a>
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
