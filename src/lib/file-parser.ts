import * as XLSX from "xlsx";
import Papa from "papaparse";

export type ParsedFile = {
  data: Record<string, unknown>[];
  headers: string[];
  isCSV: boolean;
  csvDelimiter?: string;
  sheetName?: string;
  rawRows?: unknown[][];          // filas sin procesar
  headerRowIndex?: number; 
};

export function parseExcel(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Filas crudas en formato array (sin encabezados)
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // ── DETECCIÓN DE FILA TÍTULO (celda combinada) ──────────────────────────────
  // Una fila de título/celda-combinada tiene muy pocas celdas no vacías (≤ 2)
  // mientras que una fila de headers tiene muchas columnas con texto.
  // Detectamos si rawRows[0] es título y rawRows[1] son los headers reales.
  let headerRowIndex = 0;

  if (rawRows.length >= 2) {
    const firstRowNonEmpty  = (rawRows[0] as unknown[]).filter((c) => String(c ?? "").trim() !== "").length;
    const secondRowNonEmpty = (rawRows[1] as unknown[]).filter((c) => String(c ?? "").trim() !== "").length;

    // Si la fila 0 tiene ≤ 2 celdas con contenido Y la fila 1 tiene muchas más → fila 0 es título
    if (firstRowNonEmpty <= 2 && secondRowNonEmpty > firstRowNonEmpty * 2) {
      headerRowIndex = 1;
    }
  }

  // Parse normal usando el índice de fila de headers detectado
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    range: headerRowIndex,   // le dice a SheetJS desde qué fila leer encabezados
  });
  const headers = data.length ? Object.keys(data[0]) : [];

  return {
    data,
    headers,
    isCSV: false,
    sheetName,
    rawRows,
    headerRowIndex,          // ← para que el engine sepa qué pasó
  };
}

export function parseCSV(text: string): ParsedFile {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const headers = (result.meta.fields ?? []) as string[];
  return {
    data: result.data,
    headers,
    isCSV: true,
    csvDelimiter: result.meta.delimiter ?? ",",
  };
}

export function exportFile(
  rows: Record<string, unknown>[],
  cols: string[],
  format: string,
  reportName: string
): void {
  const ordered = rows.map((r) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c) => { o[c] = r[c] !== undefined ? r[c] : ""; });
    return o;
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const fname = `ETL_${reportName.toUpperCase()}_${ts}.${format}`;

  if (format === "csv") {
    const csv = Papa.unparse(ordered, { columns: cols });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
  } else {
    const ws = XLSX.utils.json_to_sheet(ordered, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DMO_WORKSHEET");
    const bookType = format === "xls" ? "biff8" : (format as XLSX.BookType);
    XLSX.writeFile(wb, fname, { bookType });
  }
}
