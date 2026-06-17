"use client";
import { useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
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
  clientes: ["estado bc", "cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "Situacion"],
  clientes_in: ["AGENCIA", "CODIGO AS", "ASESOR DE SERVICIO", "CODIGO AC", "ASOCIACION COMUNAL", "CODIGO CLIENTE", "NOMBRE CLIENTE", "TIPO SOCIO"],
  clientes_out: ["AGENCIA", "CODIGO AS", "ASESOR DE SERVICIO", "CODIGO AC", "ASOCIACION COMUNAL", "CODIGO CLIENTE", "NOMBRE CLIENTE", "TIPO SOCIO", "MOTIVO SALIDA"],
  colocaciones: ["cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "cod_cliente", "cliente", "num_credito", "monto_colocado"],
  cartera: ["cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "num_credito", "tipo_credito", "monto_colocado", "saldo_total"],
  fondo_comun: ["Nombre Agencia", "Asesor de banca comunal", "Nro de operación", "Codigo de bc", "Nombre banca comunal", "Monto desembolsado"],
};

const EXPECTED_COLUMN_COUNT: Record<string, number> = {
  clientes: 57,
  clientes_in: 21,
  clientes_out: 22,
  colocaciones: 74,
  cartera: 93,
  fondo_comun: 32,
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
  const expectedCount = EXPECTED_COLUMN_COUNT[report] ?? 0;
  const normMap: Record<string, string> = {};
  fileHeaders.forEach((h) => { normMap[normalizeKey(h)] = h; });

  const status = expected.map((e) => ({
    expected: e,
    found: !!normMap[normalizeKey(e)],
  }));

  const extras = fileHeaders.filter(
    (h) => !expected.some((e) => normalizeKey(e) === normalizeKey(h))
  );

  const totalOk = expectedCount === 0 || fileHeaders.length === expectedCount;
  const totalWarn = expectedCount > 0 && fileHeaders.length !== expectedCount;

  return (
    <div className="mt-2 grid grid-cols-1 gap-3 text-xs">
      {/* Validación de conteo total */}
      {expectedCount > 0 && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md border ${totalOk
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
        >
          <span>
            <span className="font-semibold">
              {fileHeaders.length} columnas detectadas
            </span>{" "}
            — se esperan{" "}
            <span className="font-semibold">{expectedCount}</span>
            {totalWarn && (
              <span className="ml-1">
                ({fileHeaders.length > expectedCount ? `+${fileHeaders.length - expectedCount} extra` : `-${expectedCount - fileHeaders.length} faltantes`})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Validación de columnas clave */}
      <div className="flex flex-wrap gap-2">
        {status.map((s) => (
          <div
            key={s.expected}
            className={`px-2 py-1 rounded-md ${s.found
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
              }`}
          >
            {s.found ? "✅" : "⚠"} {s.expected}
          </div>
        ))}
      </div>

      {/* Resumen de extras */}
      <div className="text-xs text-slate-400">
        Columnas en archivo: {fileHeaders.length}
        {expectedCount > 0 && (
          <> · Esperadas: {expectedCount}</>
        )}
        {" "}· Columnas extra (no en esquema): {extras.length}
      </div>
    </div>
  );
}

type ScoreResult = {
  reporte: string;
  score: number;        // score de columnas clave (0-1)
  matched: number;
  total: number;
  columnScore: number;  // score de conteo total (0-1)
  compositeScore: number; // score final combinado
  fileCount: number;    // columnas del archivo
  expectedCount: number; // columnas esperadas para el reporte
};

const RFE_SCHEMAS = EXPECTED_COLUMNS;

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

function calculateCompatibility(
  fileColumns: string[],
  schema: string[],
  reporteName = ""
): ScoreResult {
  const fileSet = new Set(fileColumns.map((c) => normalizeKey(String(c))));
  const normSchema = schema.map((s) => normalizeKey(String(s)));
  let matched = 0;
  for (const s of normSchema) if (fileSet.has(s)) matched++;
  const total = normSchema.length || 0;
  const score = total === 0 ? 0 : matched / total;

  const expectedCount = EXPECTED_COLUMN_COUNT[reporteName] ?? 0;
  const fileCount = fileColumns.length;

  // Si no hay restricción de conteo, columnScore neutro (1)
  const columnScore =
    expectedCount === 0
      ? 1
      : 1 - Math.min(1, Math.abs(fileCount - expectedCount) / expectedCount);

  // Score compuesto: 70% columnas clave + 30% conteo total
  const compositeScore = score * 0.7 + columnScore * 0.3;

  return {
    reporte: reporteName,
    score,
    matched,
    total,
    columnScore,
    compositeScore,
    fileCount,
    expectedCount,
  };
}

function detectBestMatch(fileColumns: string[]) {
  const results: ScoreResult[] = Object.entries(RFE_SCHEMAS).map(
    ([reporte, schema]) => calculateCompatibility(fileColumns, schema, reporte)
  );
  results.sort((a, b) => b.compositeScore - a.compositeScore);
  return results;
}

const PRIVACY_MATCH_THRESHOLD = 0.5;

function getValidationState(score: number, report?: string, fileHeaders?: string[]) {
  const expectedCount = report ? (EXPECTED_COLUMN_COUNT[report] ?? 0) : 0;
  const countOk =
    expectedCount === 0 ||
    (fileHeaders && fileHeaders.length === expectedCount);

  if (score > 0.85 && countOk !== false) return "success";
  if (score > 0.6 || countOk === false) return "warning";
  return "error";
}

function mkLog(type: LogEntry["type"], message: string): LogEntry {
  return { type, message, ts: new Date().toISOString().split("T")[1].split(".")[0] };
}

// ─── NUEVA FUNCIÓN AUXILIAR ───────────────────────────────────────────────────
/**
 * Dado el array de filas crudas (rawRows) y el índice de fila de encabezado
 * (1-based), devuelve:
 *  - headers: string[] con los nombres de columna de esa fila
 *  - data: Record<string, unknown>[] con las filas posteriores mapeadas
 *
 * Si rawRows no está disponible (CSV simple), devuelve null para que el
 * llamador use el fallback de `data` original.
 */
function remapByHeaderRow(
  rawRows: unknown[][] | undefined,
  targetRow: number // 1-based
): { headers: string[]; data: Record<string, unknown>[] } | null {
  if (!rawRows || rawRows.length < targetRow) return null;

  // La fila de encabezado (índice 0-based = targetRow - 1)
  const headerIdx = targetRow - 1;
  const rawHeaders = (rawRows[headerIdx] as unknown[]).map((cell) =>
    cell != null && String(cell).trim() !== "" ? String(cell).trim() : `Col_${String(cell)}`
  );

  // Deduplicar encabezados vacíos/repetidos añadiendo sufijo
  const seen: Record<string, number> = {};
  const headers = rawHeaders.map((h) => {
    if (!seen[h]) { seen[h] = 1; return h; }
    const suffixed = `${h}_${seen[h]++}`;
    return suffixed;
  });

  // Filas de datos: todo lo que venga DESPUÉS del encabezado
  const dataRows = rawRows.slice(headerIdx + 1);
  const data: Record<string, unknown>[] = dataRows
    .filter((row) => (row as unknown[]).some((cell) => cell != null && String(cell).trim() !== "")) // omitir filas vacías
    .map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = (row as unknown[])[i] ?? null; });
      return obj;
    });

  return { headers, data };
}
// ─────────────────────────────────────────────────────────────────────────────

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
  const [detectionResults, setDetectionResults] = useState<ScoreResult[] | null>(null);
  const [bestMatch, setBestMatch] = useState<ScoreResult | null>(null);
  const [validationState, setValidationState] = useState<string | null>(null);

  // ─── NUEVO ESTADO: fila de encabezado seleccionada (1-based, default 1) ────
  const [headerRow, setHeaderRow] = useState<number>(1);
  // Valor crudo del input como string para permitir edición libre (ej. borrar "1" antes de escribir "3")
  const [headerRowInput, setHeaderRowInput] = useState<string>("1");
  // Vista "efectiva" del archivo según la fila de encabezado elegida
  const [effectiveHeaders, setEffectiveHeaders] = useState<string[]>([]);
  const [effectiveData, setEffectiveData] = useState<Record<string, unknown>[]>([]);
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── NUEVA FUNCIÓN: aplica el re-mapeo cuando cambia la fila de encabezado ──
  const applyHeaderRow = useCallback(
    (row: number, fs: FileState) => {
      const remapped = remapByHeaderRow(fs.rawRows, row);
      if (remapped) {
        setEffectiveHeaders(remapped.headers);
        setEffectiveData(remapped.data);
        setSelectedCols(new Set(remapped.headers));
        setLogs((prev) => [
          ...prev,
          mkLog("info", `Encabezado actualizado → fila ${row}: [${remapped.headers.slice(0, 4).join(", ")}${remapped.headers.length > 4 ? "…" : ""}]`),
          mkLog("dim", `${remapped.data.length} filas de datos disponibles (filas 1-${row - 1} descartadas)`),
        ]);
      } else {
        // Fallback: sin rawRows (ej. CSV sin filas crudas o fila = 1 original)
        setEffectiveHeaders(fs.headers);
        setEffectiveData(fs.data);
        setSelectedCols(new Set(fs.headers));
      }
    },
    []
  );
  // ─────────────────────────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    setLoadingFile(true);
    setLoadingProgress("Leyendo archivo…");
    setLogs([]);
    setStats({ total: null, exported: null, cols: null, ms: null });

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const fileMB = file.size / (1024 * 1024);

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setLoadingProgress(`Leyendo archivo… ${pct}%`);
      }
    };

    reader.onload = (e) => {
      setLoadingProgress("Detectando estructura…");

      setTimeout(() => {
        try {
          let parsed;
          const initLogs: LogEntry[] = [];

          if (ext === ".csv") {
            parsed = parseCSV(e.target!.result as string);
            setLoadingProgress("Procesando CSV…");
            initLogs.push(mkLog("info", `Archivo CSV cargado: ${file.name}`));
            initLogs.push(
              mkLog("info", `Delimitador detectado: "${parsed.csvDelimiter === "\t" ? "\\t (tab)" : parsed.csvDelimiter}"`)
            );
          } else {
            parsed = parseExcel(e.target!.result as ArrayBuffer);
            setLoadingProgress("Procesando Excel…");
            initLogs.push(mkLog("info", `Archivo Excel cargado: ${file.name}`));
            initLogs.push(mkLog("dim", `Hoja activa: "${parsed.sheetName}"`));
          }

          setLoadingProgress("Analizando columnas…");

          initLogs.push(mkLog("dim", `${parsed.data.length} filas · ${parsed.headers.length} columnas detectadas`));
          if (fileMB >= 1) {
            initLogs.push(mkLog("dim", `Tamaño: ${fileMB.toFixed(1)} MB`));
          }

          const newFileState: FileState = {
            name: file.name,
            size: file.size,
            data: parsed.data,
            headers: parsed.headers,
            isCSV: parsed.isCSV,
            csvDelimiter: parsed.csvDelimiter,
            rawRows: parsed.rawRows,
            headerRowIndex: parsed.headerRowIndex,
          };

          setFileState(newFileState);
          setLogs(initLogs);
          setHasRun(false);
          setShowPreview(true);

          setHeaderRow(1);
          setHeaderRowInput("1");
          setEffectiveHeaders(parsed.headers);
          setEffectiveData(parsed.data);
          setSelectedCols(new Set(parsed.headers));

          setLoadingProgress("¡Listo!");

          // Detección automática
          try {
            const results = detectBestMatch(parsed.headers || []);
            setDetectionResults(results);
            setBestMatch(results.length ? results[0] : null);
            if (RFE_SCHEMAS[report]) {
              const sel = calculateCompatibility(parsed.headers || [], RFE_SCHEMAS[report], report);
              setValidationState(getValidationState(sel.score, report, parsed.headers));
            } else {
              setValidationState(null);
            }
          } catch {
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
      }, 0);
    };

    reader.onerror = () => {
      setLogs([mkLog("error", "[ERROR] Fallo al leer el archivo.")]);
      setLoadingFile(false);
      setLoadingProgress("");
    };

    ext === ".csv" ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
  }, [report]);

  const handleKpiChange = (val: string) => {
    setKpi(val);
    if (val === "CUSTOM" && !fileState) {
      setLogs((prev) => [...prev, mkLog("warn", "[ADVERTENCIA] Carga un archivo antes de activar el modo Custom.")]);
    }
    if (val === "RFE") setReport("clientes");
  };

  // ─── NUEVO HANDLER: cambio de fila de encabezado ─────────────────────────
  const handleHeaderRowChange = (val: number) => {
    if (!fileState) return;
    const safeVal = Math.max(1, Math.min(val, (fileState.rawRows?.length ?? fileState.data.length + 1) - 1));
    setHeaderRow(safeVal);
    applyHeaderRow(safeVal, fileState);
    setShowPreview(true);
    setHasRun(false);
  };
  // ─────────────────────────────────────────────────────────────────────────

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
        // ─── CAMBIO: usar effectiveData/effectiveHeaders en lugar de fileState.data ──
        // effectiveData ya tiene las filas previas al encabezado descartadas y
        // los nombres de columna correctos según la fila seleccionada.
        runLogs.push(mkLog("dim", `  FILA ENCABEZADO: ${headerRow} · Filas descartadas: ${headerRow - 1}`));
        runLogs.push(mkLog("dim", `  Filas a procesar: ${effectiveData.length}`));
        result = processCustom(effectiveData, Array.from(selectedCols), runLogs);
        // ─────────────────────────────────────────────────────────────────────
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
              fileState.rawRows,
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

      setStats({ total: effectiveData.length, exported: result.rows.length, cols: result.cols.length, ms: elapsed });
    } catch (err) {
      runLogs.push(mkLog("error", `[ERROR] ${(err as Error).message}`));
    }

    setLogs(runLogs);
    setProcessing(false);
    setHasRun(true);
  };

  // ─── Número máximo de filas disponibles para elegir como encabezado ────────
  const maxHeaderRow = fileState
    ? Math.max(1, (fileState.rawRows?.length ?? fileState.data.length + 1) - 1)
    : 10;
  // ─────────────────────────────────────────────────────────────────────────────

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
      <div className="max-w-2xl mx-auto px-4 py-2">

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
              // ─── Resetear estado de encabezado ─────────────────────────────
              setHeaderRow(1);
              setHeaderRowInput("1");
              setEffectiveHeaders([]);
              setEffectiveData([]);
              // ───────────────────────────────────────────────────────────────
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
                  const mockFileState: FileState = {
                    name: sample.name,
                    size: 12345,
                    data: sample.data,
                    headers: sample.headers,
                    isCSV: true,
                  };
                  setFileState(mockFileState);
                  setHeaderRow(1);
                  setEffectiveHeaders(sample.headers);
                  setEffectiveData(sample.data);
                  setSelectedCols(new Set(sample.headers));
                  setLogs([mkLog("info", "Dataset de prueba cargado para CUSTOM.")]);
                  setHasRun(false);
                  setShowPreview(true);
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

        {/* ─── Selectors ──────────────────────────────────────────────────────── */}
        {/* En modo CUSTOM mostramos 3 columnas + 1 extra para "Selección de encabezado" */}
        {/* En modo RFE mantenemos el grid de 3 columnas original */}
        <div className={`grid gap-3 mb-4 ${kpi === "CUSTOM" ? "grid-cols-4" : "grid-cols-3"}`}>
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

          {/* ─── NUEVO CAMPO: Selección de encabezado (solo en CUSTOM) ──────── */}
          {kpi === "CUSTOM" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Fila encabezado
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={headerRowInput}
                  disabled={!fileState}
                  onChange={(e) => {
                    // Permitir solo dígitos o campo vacío mientras el usuario edita
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setHeaderRowInput(raw);
                  }}
                  onBlur={() => {
                    // Al salir del campo, confirmar el valor o volver al anterior
                    const v = parseInt(headerRowInput, 10);
                    if (!isNaN(v) && v >= 1) {
                      handleHeaderRowChange(v);
                      setHeaderRowInput(String(Math.max(1, Math.min(v, maxHeaderRow))));
                    } else {
                      // Campo vacío o inválido → restaurar el valor confirmado
                      setHeaderRowInput(String(headerRow));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="
                    w-full rounded-lg border border-slate-200 dark:border-slate-800
                    bg-white dark:bg-slate-900
                    text-slate-700 dark:text-slate-200
                    text-sm px-3 py-2.5
                    focus:outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-150
                  "
                />
                {/* Indicador de rango disponible */}
                {fileState && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 text-xs pointer-events-none select-none">
                    /{maxHeaderRow}
                  </span>
                )}
              </div>
              {/* Hint bajo el campo */}
              <p className="text-[10px] text-slate-400 leading-tight">
                {fileState
                  ? headerRow === 1
                    ? "Fila 1 = encabezado original"
                    : `Descarta ${headerRow - 1} fila${headerRow - 1 > 1 ? "s" : ""} previas`
                  : "Carga un archivo primero"}
              </p>
            </div>
          )}
          {/* ──────────────────────────────────────────────────────────────────── */}
        </div>

        {/* Custom column picker — ahora usa effectiveHeaders */}
        {kpi === "CUSTOM" && fileState && (
          <div className="mb-4">
            <CustomColumnSelector
              headers={effectiveHeaders}
              selected={selectedCols}
              onChange={setSelectedCols}
            />
          </div>
        )}

        {/* Column validation (RFE) — detection summary & suggestion */}
        {fileState && detectionResults && (() => {
          // ── Usar compositeScore como criterio principal ──────────────────────
          const isLowMatch = kpi === "RFE" && (
            !bestMatch || bestMatch.compositeScore <= PRIVACY_MATCH_THRESHOLD
          );

          // ── Veredicto de conteo para el bestMatch ───────────────────────────
          const countDiff = bestMatch
            ? bestMatch.fileCount - bestMatch.expectedCount
            : 0;

          return (
            <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 text-xs text-slate-600">
                  <div className="font-medium text-slate-700 dark:text-slate-200">Archivo analizado</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {isLowMatch
                      ? "Posible error de selección de reporte"
                      : `✔ ${effectiveHeaders.length} columnas detectadas · ${RFE_SCHEMAS[report]
                        ? `${calculateCompatibility(effectiveHeaders, RFE_SCHEMAS[report], report).matched} coinciden con ${report}`
                        : "— Selección manual —"}`}
                  </div>
                </div>

                {/* ── Panel derecho: bestMatch con veredicto completo ──────────── */}
                <div className="text-right">
                  {!isLowMatch && bestMatch && (
                    <div className="text-xs space-y-1">
                      <div className="text-slate-500">Mejor coincidencia:</div>
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        {bestMatch.reporte}{" "}
                        <span className="text-slate-400">
                          ({Math.round(bestMatch.compositeScore * 100)}%)
                        </span>
                      </div>
                      {/* Sub-scores desglosados */}
                      <div className="text-slate-400 text-[10px] leading-tight pt-0.5">
                        Columnas clave: {Math.round(bestMatch.score * 100)}%
                        {bestMatch.expectedCount > 0 && (
                          <> · Conteo: {Math.round(bestMatch.columnScore * 100)}%</>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Alertas ──────────────────────────────────────────────────────── */}
              {isLowMatch ? (
                <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-100 text-amber-800 text-sm">
                  <div className="font-medium">⚠ Posible error de selección de reporte</div>
                  <div className="mt-1 text-slate-600 text-xs">
                    No se puede determinar con suficiente confianza el layout del reporte.
                  </div>
                </div>
              ) : (
                kpi === "RFE" &&
                bestMatch &&
                bestMatch.reporte !== report &&
                bestMatch.compositeScore > 0.7 &&          // ← compositeScore, no score
                !reportsInSameGroup(report, bestMatch.reporte) && (
                  <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-100 text-amber-800 text-sm">
                    <div className="font-medium">⚠ Posible error de selección de reporte</div>
                    <div className="mt-1">
                      Este archivo coincide más con:{" "}
                      <span className="font-semibold">{bestMatch.reporte}</span>{" "}
                      ({Math.round(bestMatch.compositeScore * 100)}%)
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          if (!bestMatch) return;
                          setReport(bestMatch.reporte);
                          setLogs((l) => [
                            ...l,
                            mkLog("info", `Reporte cambiado automáticamente a ${bestMatch.reporte}`),
                          ]);
                          setValidationState(
                            getValidationState(bestMatch.compositeScore, bestMatch.reporte, effectiveHeaders)
                          );
                        }}
                        className="mt-1 inline-flex items-center gap-2 text-xs px-3 py-1 rounded-md bg-amber-600 text-white"
                      >
                        Cambiar automáticamente
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          );
        })()}

        {/* Column validation (RFE) */}
        {fileState && kpi === "RFE" && bestMatch && bestMatch.score > PRIVACY_MATCH_THRESHOLD && (
          <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Validación de columnas (RFE)</p>
            <ColumnValidation fileHeaders={effectiveHeaders} report={report} />
          </div>
        )}

        {/* Preview — usa effectiveHeaders y effectiveData */}
        {fileState && showPreview && (
          <div className="mb-4">
            <PreviewTable headers={effectiveHeaders} rows={effectiveData} limit={10} />
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
                {showTechnicalLogs ? "Ocultar logs" : "Ver logs"}
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